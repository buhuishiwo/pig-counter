"""
OCR 标记识别模块 — 混合架构（PaddleOCR + qwen-vl-ocr）

图片进来 → PaddleOCR 先扫（本地）→ 高置信度直接出 → 低置信度调 qwen-vl-ocr
→ API 失败回退 PaddleOCR 低分结果 → 仍无结果返回空。
"""

from __future__ import annotations

import base64
import os
import threading
from io import BytesIO
from typing import Any

import numpy as np
from PIL import Image

_PADDLE_OCR: Any = None
_PADDLE_LOCK = threading.Lock()

_PADDLE_HIGH_CONF = float(os.getenv("OCR_PADDLE_HIGH_CONF", "0.9"))
_PADDLE_LOW_CONF = float(os.getenv("OCR_PADDLE_LOW_CONF", "0.5"))


def _get_paddle() -> Any:
    global _PADDLE_OCR
    with _PADDLE_LOCK:
        if _PADDLE_OCR is None:
            import logging as _logging
            import warnings as _warnings

            _warnings.filterwarnings("ignore")
            _logging.getLogger("modelscope").setLevel(_logging.ERROR)

            import paddlex  # noqa: F401
            import logging

            for _name in logging.root.manager.loggerDict:
                if _name.startswith("paddlex") or _name.startswith("paddle"):
                    logging.getLogger(_name).setLevel(logging.ERROR)

            os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")

            from paddleocr import PaddleOCR

            _PADDLE_OCR = PaddleOCR(
                lang="ch",
                use_doc_orientation_classify=False,
                use_doc_unwarping=False,
                use_textline_orientation=False,
            )
    return _PADDLE_OCR


def _preprocess_for_api(image_bgr: np.ndarray, max_side: int = 960) -> str:
    """缩放到 API 有效分辨率（匹配 qwen-vl-ocr 视觉 token 上限），PNG 无损编码。"""
    rgb = image_bgr[..., ::-1]
    pil_image = Image.fromarray(rgb)
    h, w = pil_image.height, pil_image.width
    if max(h, w) > max_side:
        scale = max_side / max(h, w)
        pil_image = pil_image.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    buf = BytesIO()
    pil_image.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def _call_qwen_vl_ocr(image_bgr: np.ndarray) -> str | None:
    api_key = os.getenv("OCR_API_KEY", "").strip()
    if not api_key:
        return None

    from dashscope import MultiModalConversation

    img_base64 = _preprocess_for_api(image_bgr)
    model = os.getenv("OCR_MODEL", "qwen-vl-ocr")

    resp_container: list[Any] = [None]
    exc_container: list[Exception | None] = [None]

    def _call():
        try:
            resp_container[0] = MultiModalConversation.call(
                model=model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"image": f"data:image/png;base64,{img_base64}"},
                            {
                                "text": (
                                    "这张图片来自养殖场。找出墙面上的人为标记（手写编号、栏舍号、粉笔字、"
                                    "刻划数字、标识牌文字等），忽略墙面污渍和自然纹理。"
                                    "直接返回文字内容，不要描述。无标记则回复'无'。"
                                )
                            },
                        ],
                    }
                ],
                api_key=api_key,
            )
        except Exception as e:
            exc_container[0] = e

    t = threading.Thread(target=_call, daemon=True)
    t.start()
    t.join(timeout=25)
    if t.is_alive():
        return None
    if exc_container[0] is not None:
        return None
    resp = resp_container[0]
    if resp is None:
        return None

    if resp.status_code != 200:
        return None

    output = resp.output
    if not output or not output.get("choices"):
        return None

    content = output["choices"][0].get("message", {}).get("content", [])
    if isinstance(content, list):
        for item in content:
            ocr_result = item.get("ocr_result")
            if ocr_result and ocr_result.get("processed_text"):
                text = ocr_result["processed_text"].strip()
                if text and text not in ("无", "無", "无文字", "无内容"):
                    return text
            text_val = item.get("text", "").strip()
            if text_val and text_val not in ("无", "無", "无文字", "无内容"):
                return text_val
    elif isinstance(content, str):
        text = content.strip()
        if text and text not in ("无", "無", "无文字", "无内容"):
            return text

    return None


def _paddle_ocr(image_bgr: np.ndarray) -> tuple[str | None, float]:
    try:
        rgb = image_bgr[..., ::-1]
        paddle = _get_paddle()
        results = paddle.predict(rgb)
    except Exception:
        return None, 0.0

    if not results:
        return None, 0.0

    texts: list[str] = []
    total_conf = 0.0
    count = 0

    for r in results:
        rec_texts = r.get("rec_texts", []) or []
        rec_scores = r.get("rec_scores", []) or []
        for text, score in zip(rec_texts, rec_scores):
            text = text.strip()
            if text:
                texts.append(text)
                total_conf += score
                count += 1

    if not texts:
        return None, 0.0
    avg_conf = total_conf / count
    return " ".join(texts), avg_conf


def recognize_farm_mark(image_bgr: np.ndarray) -> dict[str, Any]:
    """
    3 层分流:

    PaddleOCR → conf >= HIGH (0.9)   → {source_quality: "high"}
              → conf >= LOW  (0.5)   → 调 API →
                    API 成功 → {source_quality: "medium"}
                    API 失败 → {source_quality: "low"} (PaddleOCR 兜底)
              → conf < LOW 或无文本  → 调 API →
                    API 成功 → {source_quality: "medium"}
                    API 失败 → null
    """
    try:
        paddle_text, conf = _paddle_ocr(image_bgr)
    except Exception:
        return {"text": None, "source": None, "confidence": None, "source_quality": None}

    # 高置信度：跳过 API，直接返回
    if paddle_text and conf >= _PADDLE_HIGH_CONF:
        return {
            "text": paddle_text,
            "source": "paddleocr",
            "confidence": round(conf, 4),
            "source_quality": "high",
        }

    api_text = _call_qwen_vl_ocr(image_bgr)
    if api_text:
        return {
            "text": api_text,
            "source": "qwen-vl-ocr",
            "confidence": None,
            "source_quality": "medium",
        }

    # API 失败，PaddleOCR 低分结果兜底
    if paddle_text and conf >= _PADDLE_LOW_CONF:
        return {
            "text": paddle_text,
            "source": "paddleocr",
            "confidence": round(conf, 4),
            "source_quality": "low",
        }

    return {"text": None, "source": None, "confidence": None, "source_quality": None}
