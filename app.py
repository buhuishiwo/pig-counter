from __future__ import annotations

import base64
import os
import threading
import time
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel


SERVICE_DIR = Path(__file__).resolve().parent
STATIC_DIR = SERVICE_DIR / "static"
DEFAULT_MODEL_PATH = SERVICE_DIR / "model" / "pig_count.onnx"
DEFAULT_HOST = os.getenv("PIG_SERVICE_HOST", "0.0.0.0")
DEFAULT_PORT = int(os.getenv("PIG_SERVICE_PORT", "8866"))

_MODEL_LOCK = threading.Lock()
_MODEL_CACHE: dict[str, cv2.dnn.Net] = {}


class DetectionBox(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float
    confidence: float
    class_id: int
    class_name: str


class PredictResponse(BaseModel):
    success: bool
    model_path: str
    image_width: int
    image_height: int
    predicted_count: int
    detections: list[DetectionBox]
    processing_time_ms: float
    annotated_image: str


def resolve_model_path() -> Path:
    raw_path = os.getenv("PIG_MODEL_PATH")
    if raw_path:
        return Path(raw_path).expanduser().resolve()
    return DEFAULT_MODEL_PATH.resolve()


def get_model(model_path: Path) -> cv2.dnn.Net:
    if not model_path.exists():
        raise FileNotFoundError(f"模型文件不存在: {model_path}")

    model_key = str(model_path)
    with _MODEL_LOCK:
        if model_key not in _MODEL_CACHE:
            _MODEL_CACHE[model_key] = cv2.dnn.readNetFromONNX(str(model_path))
        return _MODEL_CACHE[model_key]


def decode_image(image_bytes: bytes) -> np.ndarray:
    image = cv2.imdecode(np.frombuffer(image_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("无法解析上传图片")
    return image


def encode_image(image: np.ndarray) -> str:
    ok, buffer = cv2.imencode(".jpg", image)
    if not ok:
        raise ValueError("标注图编码失败")
    encoded = base64.b64encode(buffer.tobytes()).decode("utf-8")
    return f"data:image/jpeg;base64,{encoded}"


def draw_detections(image: np.ndarray, detections: list[DetectionBox]) -> np.ndarray:
    annotated = image.copy()
    for index, det in enumerate(detections, start=1):
        x1, y1, x2, y2 = map(int, [det.x1, det.y1, det.x2, det.y2])
        color = (30, 190, 110)
        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
        label = f"pig #{index} {det.confidence:.2f}"
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 2)
        top = max(y1 - th - 10, 0)
        cv2.rectangle(annotated, (x1, top), (x1 + tw + 10, top + th + 10), color, -1)
        cv2.putText(
            annotated,
            label,
            (x1 + 5, top + th + 2),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (20, 20, 20),
            2,
        )
    return annotated


def letterbox(
    image: np.ndarray,
    new_size: int,
    color: tuple[int, int, int] = (114, 114, 114),
) -> tuple[np.ndarray, float, float, float]:
    height, width = image.shape[:2]
    scale = min(new_size / width, new_size / height)
    resized_width = int(round(width * scale))
    resized_height = int(round(height * scale))

    resized = cv2.resize(image, (resized_width, resized_height), interpolation=cv2.INTER_LINEAR)
    pad_w = new_size - resized_width
    pad_h = new_size - resized_height
    left = pad_w // 2
    right = pad_w - left
    top = pad_h // 2
    bottom = pad_h - top
    padded = cv2.copyMakeBorder(resized, top, bottom, left, right, cv2.BORDER_CONSTANT, value=color)
    return padded, scale, float(left), float(top)


def postprocess(
    output: np.ndarray,
    scale: float,
    pad_x: float,
    pad_y: float,
    original_width: int,
    original_height: int,
    conf_threshold: float,
    iou_threshold: float,
) -> list[DetectionBox]:
    predictions = output[0].T
    boxes_xywh: list[list[float]] = []
    confidences: list[float] = []
    class_ids: list[int] = []

    for row in predictions:
        if row.shape[0] <= 4:
            continue

        if row.shape[0] == 5:
            class_id = 0
            confidence = float(row[4])
        else:
            class_scores = row[4:]
            class_id = int(np.argmax(class_scores))
            confidence = float(class_scores[class_id])

        if confidence < conf_threshold:
            continue

        center_x, center_y, width, height = map(float, row[:4])
        x1 = (center_x - width / 2 - pad_x) / scale
        y1 = (center_y - height / 2 - pad_y) / scale
        x2 = (center_x + width / 2 - pad_x) / scale
        y2 = (center_y + height / 2 - pad_y) / scale

        x1 = max(0.0, min(x1, float(original_width)))
        y1 = max(0.0, min(y1, float(original_height)))
        x2 = max(0.0, min(x2, float(original_width)))
        y2 = max(0.0, min(y2, float(original_height)))
        width_box = max(0.0, x2 - x1)
        height_box = max(0.0, y2 - y1)
        if width_box <= 1 or height_box <= 1:
            continue

        boxes_xywh.append([x1, y1, width_box, height_box])
        confidences.append(confidence)
        class_ids.append(class_id)

    if not boxes_xywh:
        return []

    indices = cv2.dnn.NMSBoxes(boxes_xywh, confidences, conf_threshold, iou_threshold)
    if indices is None or len(indices) == 0:
        return []

    detections: list[DetectionBox] = []
    for raw_index in np.array(indices).reshape(-1):
        index = int(raw_index)
        x1, y1, width_box, height_box = boxes_xywh[index]
        detections.append(
            DetectionBox(
                x1=round(x1, 2),
                y1=round(y1, 2),
                x2=round(x1 + width_box, 2),
                y2=round(y1 + height_box, 2),
                confidence=round(confidences[index], 6),
                class_id=class_ids[index],
                class_name="pig",
            )
        )

    detections.sort(key=lambda item: item.confidence, reverse=True)
    return detections


def predict_image(
    image: np.ndarray,
    model_path: Path,
    conf_threshold: float,
    iou_threshold: float,
    imgsz: int,
) -> PredictResponse:
    started_at = time.perf_counter()
    image_height, image_width = image.shape[:2]
    processed, scale, pad_x, pad_y = letterbox(image, imgsz)
    blob = cv2.dnn.blobFromImage(processed, scalefactor=1 / 255.0, size=(imgsz, imgsz), swapRB=True, crop=False)

    model = get_model(model_path)
    with _MODEL_LOCK:
        model.setInput(blob)
        output = model.forward()

    detections = postprocess(
        output=output,
        scale=scale,
        pad_x=pad_x,
        pad_y=pad_y,
        original_width=image_width,
        original_height=image_height,
        conf_threshold=conf_threshold,
        iou_threshold=iou_threshold,
    )

    annotated = draw_detections(image, detections)
    return PredictResponse(
        success=True,
        model_path=str(model_path),
        image_width=image_width,
        image_height=image_height,
        predicted_count=len(detections),
        detections=detections,
        processing_time_ms=round((time.perf_counter() - started_at) * 1000, 2),
        annotated_image=encode_image(annotated),
    )


app = FastAPI(
    title="Pig Count Service",
    description="猪只计数模型接口与测试页面",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.on_event("startup")
async def startup_event() -> None:
    model_path = resolve_model_path()
    if not model_path.exists():
        raise RuntimeError(f"模型文件不存在: {model_path}")
    get_model(model_path)


@app.get("/")
async def root() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/health")
async def health() -> dict[str, Any]:
    model_path = resolve_model_path()
    return {
        "status": "healthy" if model_path.exists() else "unhealthy",
        "model_path": str(model_path),
        "model_exists": model_path.exists(),
        "runtime": "opencv-dnn",
    }


@app.get("/api/config")
async def config() -> dict[str, Any]:
    model_path = resolve_model_path()
    return {
        "service_name": "pig-count-service",
        "model_path": str(model_path),
        "default_conf_threshold": 0.25,
        "default_iou_threshold": 0.45,
        "default_imgsz": 960,
    }


@app.post("/api/predict", response_model=PredictResponse)
async def predict(
    file: UploadFile = File(...),
    conf_threshold: float = 0.25,
    iou_threshold: float = 0.45,
    imgsz: int = 960,
) -> PredictResponse:
    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="只支持图片文件")

    if not 0 <= conf_threshold <= 1:
        raise HTTPException(status_code=400, detail="conf_threshold 必须在 0 到 1 之间")
    if not 0 <= iou_threshold <= 1:
        raise HTTPException(status_code=400, detail="iou_threshold 必须在 0 到 1 之间")
    if imgsz <= 0:
        raise HTTPException(status_code=400, detail="imgsz 必须大于 0")

    model_path = resolve_model_path()
    try:
        image_bytes = await file.read()
        image = decode_image(image_bytes)
        return predict_image(
            image=image,
            model_path=model_path,
            conf_threshold=conf_threshold,
            iou_threshold=iou_threshold,
            imgsz=imgsz,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"推理失败: {exc}") from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host=DEFAULT_HOST, port=DEFAULT_PORT, reload=False)
