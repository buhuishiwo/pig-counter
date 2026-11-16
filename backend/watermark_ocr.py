"""
watermark_ocr.py — 水印识别模块（qwen-vl-ocr）

设计依据（实测）：
  qwen-vl-ocr 用"让模型自己抽字段的 JSON prompt"时，对排版稍有变化的图片会把
  日期当栏舍号、把 GPS 当栋舍（试过 4 种 prompt 都一样）。但让它**原样逐行输出文字**
  时，每行都是准确的，因此改为：
      原样输出文字  →  本地按"标签"抽取字段（与行的顺序无关）
  抽取不到时，再退回结构化 prompt 兜底。

输出字段与历史版本完全一致（DB / 前端 / Excel 均不受影响）：
  time, location, building, unit_name, pen_number, count, storage_unit, raw_text
"""

import asyncio
import base64
import json
import os
import re

import httpx
from dotenv import load_dotenv

load_dotenv()

OCR_API_KEY = os.getenv("OCR_API_KEY", "")
OCR_BASE_URL = os.getenv("OCR_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1")
OCR_MODEL = os.getenv("OCR_MODEL", "qwen-vl-ocr")

_TEXT_PROMPT = (
    "请把图片左下角水印区域内的所有文字原样逐行识别出来。"
    "不要解释、不要输出 JSON、不要改写或合并文字，不要遗漏任何一行。"
)

# 兜底：结构化抽取
_PROMPT = (
    "请识别图片左下角的水印文字，提取以下字段并以JSON格式返回：\n"
    "- time: 拍摄时间\n"
    "- location: 地点\n"
    "- building: 所在栋舍（如\"育肥一区7楼\"）\n"
    "- pen_label: 栏舍号（完整原文，如\"14单元20号栏\"或\"1单元10栏\"）\n"
    "- count: 数量/头数（仅数字）\n"
    "- storage_unit: 承储单位\n"
    "如果某个字段无法识别，返回空字符串。只返回JSON，不要其他文字。"
)

# 行首坐标前缀（qwen-vl-ocr 原样输出时会带）："192,804,31,305,90,"
_COORD_PREFIX = re.compile(r'^\s*\d+(?:\s*,\s*\d+){3,5}\s*,?\s*')

# 各字段的"标签别名"——不同猪场标签写法不同，但维度相同
_LABELS = {
    "building": r'栋舍|猪舍|栋号',
    "pen": r'栏舍号|栏号|圈舍号|栏位号|栏位',
    "count": r'头数|数量|存栏|实存',
    "time": r'时\s*间',
    "location": r'地\s*点',
    "storage_unit": r'承储单位|养殖场名称|养殖单位',
}

# 模型偶尔把 GPS / 日期 / 打卡信息误填进"所在栋舍"
_BAD_VALUE = (
    re.compile(r'^\s*\d{1,3}\.\d+\s*°?\s*[NS]', re.I),                          # 28.201845°N
    re.compile(r'^\s*\d{4}\s*[.\-/]\s*\d{1,2}\s*[.\-/]\s*\d{1,2}'),             # 2026.11.16
    re.compile(r'星期|打卡|今日水印|请输入内容'),
)

# 整段原样输出失败时（模型只回坐标），对缺失字段逐个"定向提问"。
# 实测：问法必须是"读出「某标签」后面的文字"，加上冒号/强调不要输出其他内容反而会失败。
_ASK = {
    "building": '请读出图片左下角水印中「所在栋舍」后面的文字，只输出那几个字。',
    "pen": '请读出图片左下角水印中「栏舍号」后面的文字，只输出那几个字。',
    "count": '请读出图片左下角水印中「头数」或「数量」后面的数字，只输出数字。',
    "storage_unit": '请读出图片左下角水印中「承储单位」或「养殖场名称」后面的文字，只输出那几个字。',
}

_EMPTY = {
    "time": "", "location": "", "building": "",
    "unit_name": "", "pen_number": "", "count": None,
    "storage_unit": "", "raw_text": "",
}


def _parse_count(raw) -> int | None:
    m = re.search(r'\d+', str(raw))
    return int(m.group()) if m else None


def _parse_pen_label(raw: str) -> tuple[str, str]:
    """栏舍号文本 → (单元, 栏号)。

    '14单元20号栏' → ('14单元', '20')
    '1单元10栏'    → ('1单元', '10')
    '13栋35栏'     → ('', '35')
    """
    s = str(raw).strip()
    unit_m = re.search(r'(\d+)\s*单元', s)
    pen_m = re.search(r'(\d+)\s*[栏号]', s)
    unit = f"{unit_m.group(1)}单元" if unit_m else ""
    pen = pen_m.group(1) if pen_m else ""
    return unit, pen


# 供 backend 复用（水印漏读栏舍号时，用文件名兜底）
parse_unit_pen = _parse_pen_label


def _clean_value(v) -> str:
    v = str(v or '').strip(" :：\t")
    if not v:
        return ''
    for pat in _BAD_VALUE:
        if pat.search(v):
            return ''
    return v


def _clean_text(text: str) -> list[str]:
    """去坐标前缀 / markdown 包装，返回逐行文字。"""
    s = (text or '').strip()
    if s.startswith("```"):
        s = re.sub(r'^```(?:json|text)?\s*', '', s)
        s = re.sub(r'\s*```$', '', s)
    lines = []
    for line in s.splitlines():
        line = _COORD_PREFIX.sub('', line).strip()
        if line:
            lines.append(line)
    return lines


def _grab(lines: list[str], label_pat: str) -> str:
    """按"标签: 值"取值，与行的顺序无关。"""
    pat = re.compile(rf'(?:{label_pat})\s*[:：]\s*(.+)$')
    for line in lines:
        m = pat.search(line)
        if m:
            v = _clean_value(m.group(1))
            if v:
                return v
    return ""


def parse_watermark_text(text: str) -> dict:
    """水印原文 → 标准字段（与历史接口一致）。"""
    lines = _clean_text(text)
    out = dict(_EMPTY)
    # 只保留纯文字（坐标前缀已剔除），坐标信息一律不留
    out["raw_text"] = "\n".join(lines)

    out["building"] = _grab(lines, _LABELS["building"])
    out["time"] = _grab(lines, _LABELS["time"])
    out["location"] = _grab(lines, _LABELS["location"])
    out["storage_unit"] = _grab(lines, _LABELS["storage_unit"])

    unit_name, pen_number = _parse_pen_label(_grab(lines, _LABELS["pen"]))
    out["unit_name"] = unit_name
    out["pen_number"] = pen_number

    count_raw = _grab(lines, _LABELS["count"])
    if count_raw:
        out["count"] = _parse_count(count_raw)
    else:
        m = re.search(r'(\d+)\s*头', "\n".join(lines))
        out["count"] = int(m.group(1)) if m else None

    if not out["time"]:
        m = re.search(r'\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}(?:\s+\d{1,2}:\d{2})?', "\n".join(lines))
        out["time"] = m.group() if m else ""

    return out


async def _call_ocr(image_bytes: bytes, prompt: str, max_tokens: int = 800) -> str | None:
    b64 = base64.b64encode(image_bytes).decode()
    payload = {
        "model": OCR_MODEL,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
                {"type": "text", "text": prompt},
            ],
        }],
        "max_tokens": max_tokens,
    }
    headers = {"Authorization": f"Bearer {OCR_API_KEY}", "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(f"{OCR_BASE_URL}/chat/completions", json=payload, headers=headers)
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]


async def _ask_field(image_bytes: bytes, field: str) -> str:
    """定向问单个字段：去掉回答里的"标签:"前缀，并丢弃无效值（坐标/日期/占位符）。"""
    ans = (await _call_ocr(image_bytes, _ASK[field], max_tokens=64) or "").strip()
    ans = re.sub(r'^[^:：\n]{0,10}[:：]\s*', '', ans).strip()
    return _clean_value(ans)


async def _recognize_structured(image_bytes: bytes) -> dict | None:
    """兜底：让模型直接抽字段。"""
    content = await _call_ocr(image_bytes, _PROMPT, max_tokens=512)
    stripped = content.strip()
    if stripped.startswith("```"):
        stripped = re.sub(r'^```(?:json)?\s*', '', stripped)
        stripped = re.sub(r'\s*```$', '', stripped)
    data = json.loads(stripped)
    unit_name, pen_number = _parse_pen_label(str(data.get("pen_label", "")))
    return {
        "time": _clean_value(data.get("time", "")),
        "location": _clean_value(data.get("location", "")),
        "building": _clean_value(data.get("building", "")),
        "unit_name": unit_name,
        "pen_number": pen_number,
        "count": _parse_count(data.get("count", "")),
        "storage_unit": _clean_value(data.get("storage_unit", "")),
        "raw_text": json.dumps(data, ensure_ascii=False),
    }


async def recognize_watermark(image_bytes: bytes) -> dict | None:
    """识别单张水印：原样输出 + 本地按标签抽取；缺字段定向补问；仍失败再走结构化兜底。"""
    if not OCR_API_KEY:
        return None

    # 1) 原样输出 + 本地正则
    parsed = dict(_EMPTY)
    try:
        text = await _call_ocr(image_bytes, _TEXT_PROMPT)
        parsed = parse_watermark_text(text or "")
    except Exception:
        parsed = dict(_EMPTY)

    # 2) 对缺失的关键字段定向补问（整段读不出文字时，模型对"问单个字段"仍能答对）
    async def ask(field):
        # 单次问法偶尔也会失手，最多问两次
        for _ in range(2):
            try:
                ans = await _ask_field(image_bytes, field)
            except Exception:
                ans = ""
            if ans:
                return ans
        return ""

    if not parsed["pen_number"]:
        u, p = _parse_pen_label(await ask("pen"))
        if p:
            parsed["pen_number"] = p
            parsed["unit_name"] = parsed["unit_name"] or u
    if not parsed["building"]:
        parsed["building"] = await ask("building")
    if not parsed["storage_unit"]:
        parsed["storage_unit"] = await ask("storage_unit")
    if parsed["count"] is None:
        parsed["count"] = _parse_count(await ask("count"))

    if parsed["pen_number"] or parsed["count"] is not None or parsed["building"]:
        return parsed

    # 3) 兜底：让模型直接抽字段
    try:
        return await _recognize_structured(image_bytes)
    except Exception:
        return None


async def recognize_watermarks_batch(images: list[bytes], concurrency: int = 5) -> list[dict | None]:
    """批量识别水印，并发限制为 concurrency。"""
    sem = asyncio.Semaphore(concurrency)

    async def _limited(img_bytes: bytes) -> dict | None:
        async with sem:
            return await recognize_watermark(img_bytes)

    return await asyncio.gather(*[_limited(img) for img in images])
