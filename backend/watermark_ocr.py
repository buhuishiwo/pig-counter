"""
watermark_ocr.py — 水印识别模块（Qwen OCR 官方接入）

设计（2026-11-21 起）：
  一次请求返回结构化 JSON，不再做"原样输出 + 多轮定向补问"。
    - 单张耗时从 ~14.6s 降到 ~3s（模型是单实例，调用次数直接决定耗时）
    - 批量并发固定为 1（官方示例客户端即串行；并发只会排队并把单张拖到超时）

  失败策略：请求失败 / 返回非 JSON → 重试 1 次 → 仍失败则本图水印记 None，主流程继续。

  历史经验仍保留：
    - 数字必须阿拉伯数字：提示词里显式要求；模型不听话时 _cn_to_arabic 兜底
    - 栋舍/地点/承储单位可能被误填 GPS、日期、打卡信息 → _BAD_VALUE 过滤
    - 栏舍号拆分单元/栏号 → _parse_pen_label

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
OCR_CA_FILE = os.getenv("OCR_CA_FILE", "")  # 私有 CA 证书路径（不填则用默认信任链）

# 单张总超时（秒）。正常约 3 秒，留足余量但不至于把整批拖死。
OCR_IMAGE_TIMEOUT = float(os.getenv("OCR_IMAGE_TIMEOUT", "180"))
# 单次请求最大输出。只返回 5 个短字段，256 足够；被截断时 finish_reason=length 会拦住重试。
OCR_MAX_TOKENS = int(os.getenv("OCR_MAX_TOKENS", "256"))

_PROMPT_JSON = (
    "读取这张照片左下角水印中的文字，只输出一个 JSON 对象，包含这 6 个键：\n"
    "\"栋舍\"：水印中「所在栋舍」后面的文字，如\"育肥一区7楼\"；\n"
    "\"栏舍号\"：水印中「栏舍号」后面的完整文字，如\"1单元10栏\"；\n"
    "\"头数\"：水印中「头数」后面的数字，只抄数字，不要数猪；\n"
    "\"时间\"：水印上的日期或打卡时间，保留原格式；\n"
    "\"地点\"：水印中「地点」后面的文字，多行合并成一行；\n"
    "\"存储单位\"：水印中「承储单位」或「养殖场名称」后面的文字。\n"
    "读不到的键填 null，不要猜。数字一律用阿拉伯数字（\"一单元十栏\"→\"1单元10栏\"）。\n"
    "只输出这个 JSON，不要输出任何其他文字或字段。"
)

# 模型返回的键名 → 我们的字段（同一字段可能换写法，按顺序取第一个非空）
_FIELD_ALIASES = {
    "building": ("栋舍", "所在栋舍", "猪舍", "栋号"),
    "pen": ("栏舍号", "栏号", "圈舍号", "栏位号", "栏位"),
    "count": ("头数", "数量", "存栏", "实存"),
    "time": ("打卡时间", "时间"),
    "date": ("日期",),
    "location": ("地点原文", "地点"),
    "storage_unit": ("存储单位", "承储单位", "养殖场名称", "养殖单位"),
}

# 模型偶尔把 GPS / 日期 / 打卡信息塞进"栋舍"之类的字段
_BAD_GPS_OR_MARK = (
    re.compile(r'^\s*\d{1,3}\.\d+\s*°?\s*[NS]', re.I),                          # 28.201845°N
    re.compile(r'星期|打卡|今日水印|请输入内容'),
)
_BAD_VALUE = _BAD_GPS_OR_MARK + (
    re.compile(r'^\s*\d{4}\s*[.\-/]\s*\d{1,2}\s*[.\-/]\s*\d{1,2}'),             # 2026.11.16
)

# ── 中文数字 → 阿拉伯数字 ──────────────────────────────
# 水印偶尔写成「一单元十栏」「头数：三十六」，而下游解析/比对都是阿拉伯数字。
# 提示词已要求模型输出阿拉伯数字，这段是模型不听话时的兜底。
_CN_DIGIT = {"零": 0, "〇": 0, "一": 1, "二": 2, "两": 2, "三": 3, "四": 4,
             "五": 5, "六": 6, "七": 7, "八": 8, "九": 9}
_CN_UNIT = {"十": 10, "百": 100, "千": 1000}
_CN_SEQ = re.compile(r"[零〇一二三四五六七八九十二百千两]+|[零〇一二三四五六七八九]+")


def _cn2int(s: str) -> int | None:
    """'十'→10 '十二'→12 '二十'→20 '一百二十'→120 '三六'→36；失败返回 None。"""
    if not s:
        return None
    if any(c in _CN_UNIT for c in s):
        total = cur = 0
        for c in s:
            if c in _CN_DIGIT:
                cur = _CN_DIGIT[c]
            elif c in _CN_UNIT:
                total += (cur or 1) * _CN_UNIT[c]
                cur = 0
            else:
                return None
        return total + cur
    if all(c in _CN_DIGIT for c in s):
        return int("".join(str(_CN_DIGIT[c]) for c in s))
    return None


def _cn_to_arabic(text: str) -> str:
    def repl(m):
        v = _cn2int(m.group())
        return str(v) if v is not None else m.group()
    return _CN_SEQ.sub(repl, text)


def _parse_count(raw) -> int | None:
    if raw is None:
        return None
    m = re.search(r'\d+', _cn_to_arabic(str(raw)))
    return int(m.group()) if m else None


def _parse_pen_label(raw: str) -> tuple[str, str]:
    """栏舍号文本 → (单元, 栏号)。

    '14单元20号栏' → ('14单元', '20')
    '1单元10栏'    → ('1单元', '10')
    '13栋35栏'     → ('', '35')
    '一单元十栏'   → ('1单元', '10')
    """
    s = _cn_to_arabic(str(raw or "")).strip()
    unit_m = re.search(r'(\d+)\s*单元', s)
    pen_m = re.search(r'(\d+)\s*[栏号]', s)
    unit = f"{unit_m.group(1)}单元" if unit_m else ""
    pen = pen_m.group(1) if pen_m else ""
    return unit, pen


# 供 backend 复用（水印漏读栏舍号时，用文件名兜底）
parse_unit_pen = _parse_pen_label


def _clean_value(v) -> str:
    """去空白与占位符；命中 GPS/日期/打卡等误填时丢弃。"""
    if v is None:
        return ""
    v = str(v).strip(" :：\t\r\n")
    if not v or v.lower() in ("null", "none", "nan", "-", "无"):
        return ""
    for pat in _BAD_VALUE:
        if pat.search(v):
            return ""
    return v


def _clean_time(v) -> str:
    """时间字段：日期就是正常内容，只过滤 GPS / 打卡之类的噪声。"""
    if v is None:
        return ""
    v = str(v).strip(" :：\t\r\n")
    if not v or v.lower() in ("null", "none", "nan", "-", "无"):
        return ""
    for pat in _BAD_GPS_OR_MARK:
        if pat.search(v):
            return ""
    return v


def _norm_key(k) -> str:
    """键名规范化：去空格/冒号，便于匹配「所在栋舍 」「栋舍:」之类写法。"""
    return re.sub(r'[\s:：*`"]', '', str(k))


def _parse_json_reply(text: str) -> dict | None:
    """把模型输出解析成 dict。容忍 markdown 围栏、前后多余文字。"""
    if not text:
        return None
    s = text.strip()
    s = re.sub(r'^```(?:json)?\s*', '', s)
    s = re.sub(r'\s*```$', '', s).strip()

    candidates = [s]
    m = re.search(r'\{.*\}', s, re.S)          # 前后带解释文字时抠第一个对象
    if m:
        candidates.append(m.group(0))

    for c in candidates:
        try:
            data = json.loads(c)
        except Exception:
            continue
        if isinstance(data, dict):
            return {_norm_key(k): v for k, v in data.items()}
    return None


def _pick(data: dict, field: str) -> str:
    for alias in _FIELD_ALIASES[field]:
        v = data.get(_norm_key(alias))
        if isinstance(v, (int, float)):
            return str(v)
        if isinstance(v, str) and v.strip():
            return v
    return ""


def _to_fields(data: dict, raw_text: str) -> dict:
    """JSON → 数据库字段（与历史输出结构一致）。"""
    building = _clean_value(_pick(data, "building"))
    location = _clean_value(_pick(data, "location"))
    storage_unit = _clean_value(_pick(data, "storage_unit"))
    unit_name, pen_number = _parse_pen_label(_pick(data, "pen"))
    count = _parse_count(_pick(data, "count"))
    when = _clean_time(_pick(data, "time")) or _clean_time(_pick(data, "date"))

    return {
        "time": when,
        "location": location,
        "building": building,
        "unit_name": unit_name,
        "pen_number": pen_number,
        "count": count,
        "storage_unit": storage_unit,
        "raw_text": raw_text,
    }


async def _call_ocr(image_bytes: bytes, prompt: str) -> str | None:
    """单次请求：一张图 + 提示词 → 模型文本输出。"""
    b64 = base64.b64encode(image_bytes).decode()
    mime = "image/png" if image_bytes[:8] == b"\x89PNG\r\n\x1a\n" else "image/jpeg"
    payload = {
        "model": OCR_MODEL,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
            ],
        }],
        "temperature": 0,
        "max_completion_tokens": OCR_MAX_TOKENS,
        # 不关推理模式时，答案会全部落在 message.reasoning 里，content 为 null
        "chat_template_kwargs": {"enable_thinking": False},
        "stream": False,
    }
    headers = {"Authorization": f"Bearer {OCR_API_KEY}", "Content-Type": "application/json"}
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(connect=5.0, read=120.0, write=30.0, pool=5.0),
        verify=OCR_CA_FILE or True,
    ) as client:
        resp = await client.post(f"{OCR_BASE_URL}/chat/completions", json=payload, headers=headers)
        resp.raise_for_status()
        choice = resp.json()["choices"][0]
        if choice.get("finish_reason") == "length":
            return None  # 被截断，宁可重试也不解析半截 JSON
        content = choice["message"].get("content")
        return content if content else None


async def _recognize_watermark_impl(image_bytes: bytes) -> dict | None:
    """一次 JSON 调用；失败重试 1 次。"""
    if not OCR_API_KEY:
        return None

    for attempt in (1, 2):
        try:
            content = await _call_ocr(image_bytes, _PROMPT_JSON)
            if not content:
                continue
            data = _parse_json_reply(content)
            if data:
                fields = _to_fields(data, content)
                # 一条有效信息都没有 → 当作失败（避免写全 NULL 的水印行）
                if fields["pen_number"] or fields["count"] is not None or fields["building"]:
                    return fields
                print(f"[OCR] 第 {attempt} 次返回字段全空，重试")
                continue
            print(f"[OCR] 第 {attempt} 次返回的不是合法 JSON，前 80 字符: {content[:80]!r}")
        except Exception as exc:
            print(f"[OCR] 第 {attempt} 次请求失败: {exc}")
    return None


async def recognize_watermark(image_bytes: bytes) -> dict | None:
    """单张水印识别入口：整张图最多 OCR_IMAGE_TIMEOUT 秒，失败返回 None。"""
    try:
        return await asyncio.wait_for(_recognize_watermark_impl(image_bytes), timeout=OCR_IMAGE_TIMEOUT)
    except asyncio.TimeoutError:
        print(f"[OCR] 单张识别超过 {OCR_IMAGE_TIMEOUT:.0f} 秒，已放弃（视为水印不可用）")
        return None
    except Exception as exc:  # noqa: BLE001 - OCR 失败不影响主流程
        print(f"[OCR] 识别异常，已忽略: {exc}")
        return None


async def recognize_watermarks_batch(images: list[bytes], concurrency: int = 1) -> list[dict | None]:
    """批量识别水印。

    默认串行（concurrency=1）：OCR 服务是单实例，并发请求只会在服务端排队，
    反而把单张耗时拖过超时线（实测 5 并发时单张 >120 秒）。
    """
    sem = asyncio.Semaphore(max(1, concurrency))

    async def _limited(img_bytes: bytes) -> dict | None:
        async with sem:
            return await recognize_watermark(img_bytes)

    if not images:
        return []
    return await asyncio.gather(*[_limited(img) for img in images])
