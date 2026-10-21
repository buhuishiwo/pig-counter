"""
watermark_ocr.py — 水印识别模块
调用阿里云 DashScope qwen-vl-ocr 模型，从猪舍照片左下角水印中提取结构化信息。
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

_PROMPT = (
    "请识别图片左下角的水印文字，提取以下字段并以JSON格式返回：\n"
    "- time: 拍摄时间\n"
    "- location: 地点\n"
    "- building: 所在栋舍（如\"育肥C区\"）\n"
    "- pen_label: 栏舍号（完整原始文本，如\"1单元10号栏\"）\n"
    "- count: 数量（仅数字）\n"
    "- storage_unit: 承储单位\n"
    "如果某个字段无法识别，返回空字符串。只返回JSON，不要其他文字。"
)


def _parse_count(raw: str) -> int | None:
    m = re.search(r'\d+', str(raw))
    return int(m.group()) if m else None


def _parse_pen_label(raw: str) -> tuple[str, str]:
    """从栏舍号文本解析出单元和栏号，如 '1单元10号栏' → ('1单元', '10')。"""
    s = str(raw).strip()
    unit_m = re.search(r'(\d+)\s*单元', s)
    pen_m = re.search(r'(\d+)\s*号', s)
    unit = f"{unit_m.group(1)}单元" if unit_m else ""
    pen = pen_m.group(1) if pen_m else ""
    return unit, pen


async def recognize_watermark(image_bytes: bytes) -> dict | None:
    """识别单张图片水印，返回结构化字段，失败返回 None。"""
    if not OCR_API_KEY:
        return None
    b64 = base64.b64encode(image_bytes).decode()
    payload = {
        "model": OCR_MODEL,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
                {"type": "text", "text": _PROMPT}
            ]
        }],
        "max_tokens": 512
    }
    headers = {
        "Authorization": f"Bearer {OCR_API_KEY}",
        "Content-Type": "application/json"
    }
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(f"{OCR_BASE_URL}/chat/completions", json=payload, headers=headers)
            resp.raise_for_status()
            resp_json = resp.json()
            content = resp_json["choices"][0]["message"]["content"]
            # Strip markdown code block wrapper if present
            stripped = content.strip()
            if stripped.startswith("```"):
                stripped = re.sub(r'^```(?:json)?\s*', '', stripped)
                stripped = re.sub(r'\s*```$', '', stripped)
            data = json.loads(stripped)
            pen_label = str(data.get("pen_label", ""))
            unit_name, pen_number = _parse_pen_label(pen_label)
            return {
                "time": str(data.get("time", "")),
                "location": str(data.get("location", "")),
                "building": str(data.get("building", "")),
                "unit_name": unit_name,
                "pen_number": pen_number,
                "count": _parse_count(data.get("count", "")),
                "storage_unit": str(data.get("storage_unit", "")),
                "raw_text": content
            }
    except Exception:
        return None


async def recognize_watermarks_batch(images: list[bytes], concurrency: int = 5) -> list[dict | None]:
    """批量识别水印，并发限制为 concurrency。"""
    sem = asyncio.Semaphore(concurrency)

    async def _limited(img_bytes: bytes) -> dict | None:
        async with sem:
            return await recognize_watermark(img_bytes)

    return await asyncio.gather(*[_limited(img) for img in images])
