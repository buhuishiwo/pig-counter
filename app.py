from __future__ import annotations

import base64
import os
import threading
import time
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import pymysql
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


SERVICE_DIR = Path(__file__).resolve().parent
STATIC_DIR = SERVICE_DIR / "static"
DEFAULT_MODEL_PATH = SERVICE_DIR / "model" / "pig_count.onnx"
DEFAULT_HOST = os.getenv("PIG_SERVICE_HOST", "0.0.0.0")
DEFAULT_PORT = int(os.getenv("PIG_SERVICE_PORT", "8866"))

# MySQL数据库配置
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "3306")),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD"),
    "database": os.getenv("DB_NAME", "pig_counter"),
    "charset": "utf8mb4",
    "cursorclass": pymysql.cursors.DictCursor,
}

_MODEL_LOCK = threading.Lock()
_MODEL_CACHE: dict[str, cv2.dnn.Net] = {}


@contextmanager
def get_db():
    """数据库连接上下文管理器"""
    conn = None
    try:
        conn = pymysql.connect(**DB_CONFIG)
        yield conn
    finally:
        if conn:
            conn.close()


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


class BatchPredictResponse(BaseModel):
    success: bool
    total_images: int
    total_pigs: int
    results: list[PredictResponse]


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


def create_thumbnail(image: np.ndarray, max_size: int = 320, quality: int = 60) -> str:
    height, width = image.shape[:2]
    scale = min(max_size / width, max_size / height)
    if scale < 1:
        new_width = int(width * scale)
        new_height = int(height * scale)
        thumbnail = cv2.resize(image, (new_width, new_height), interpolation=cv2.INTER_AREA)
    else:
        thumbnail = image
    ok, buffer = cv2.imencode(".jpg", thumbnail, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok:
        raise ValueError("缩略图编码失败")
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
) -> tuple[PredictResponse, np.ndarray]:
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
    response = PredictResponse(
        success=True,
        model_path=str(model_path),
        image_width=image_width,
        image_height=image_height,
        predicted_count=len(detections),
        detections=detections,
        processing_time_ms=round((time.perf_counter() - started_at) * 1000, 2),
        annotated_image=encode_image(annotated),
    )
    return response, annotated


app = FastAPI(
    title="Pig Count Service",
    description="猪只计数模型接口与测试页面",
    version="1.0.0",
)

# 添加异常处理器，处理请求体大小超过限制的错误
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request, exc):
    if exc.status_code == 413:
        return JSONResponse(
            status_code=413,
            content={"detail": "图片大小超过单次最大上传值！"}
        )
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )

# 处理请求验证错误
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()}  # 👈 保留原始错误
    )




@app.on_event("startup")
async def startup_event() -> None:
    model_path = resolve_model_path()
    if not model_path.exists():
        raise RuntimeError(f"模型文件不存在: {model_path}")
    get_model(model_path)




@app.get("/api/health")
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


@app.post("/api/predict-batch", response_model=BatchPredictResponse)
async def predict_batch(
    files: list[UploadFile] = File(...),
    farm_id: int | None = Form(default=None),
    conf_threshold: float = Form(default=0.25),
    iou_threshold: float = Form(default=0.45),
    imgsz: int = Form(default=960),
) -> BatchPredictResponse:
    if not files:
        raise HTTPException(status_code=400, detail="至少需要上传一张图片")

    for file in files:
        if file.content_type and not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail=f"文件 {file.filename} 不是图片文件")

    if not 0 <= conf_threshold <= 1:
        raise HTTPException(status_code=400, detail="conf_threshold 必须在 0 到 1 之间")
    if not 0 <= iou_threshold <= 1:
        raise HTTPException(status_code=400, detail="iou_threshold 必须在 0 到 1 之间")
    if imgsz <= 0:
        raise HTTPException(status_code=400, detail="imgsz 必须大于 0")

    model_path = resolve_model_path()
    results = []
    total_pigs = 0

    try:
        for file in files:
            image_bytes = await file.read()
            image = decode_image(image_bytes)
            result, annotated_image = predict_image(
                image=image,
                model_path=model_path,
                conf_threshold=conf_threshold,
                iou_threshold=iou_threshold,
                imgsz=imgsz,
            )
            
            # 保存识别记录到数据库
            await save_detection_record(
                farm_id=farm_id,
                image_name=file.filename or "unknown.jpg",
                predicted_count=result.predicted_count,
                processing_time_ms=result.processing_time_ms,
                annotated_image=annotated_image
            )
            
            results.append(result)
            total_pigs += result.predicted_count
        
        return BatchPredictResponse(
            success=True,
            total_images=len(files),
            total_pigs=total_pigs,
            results=results
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"推理失败: {exc}") from exc


async def save_detection_record(
    farm_id: int | None,
    image_name: str,
    predicted_count: int,
    processing_time_ms: float,
    annotated_image: np.ndarray
) -> None:
    """保存识别记录到数据库（存储压缩缩略图）"""
    try:
        thumbnail_base64 = create_thumbnail(annotated_image, max_size=320, quality=60)
        with get_db() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """INSERT INTO detection_records 
                        (farm_id, image_name, predicted_count, processing_time_ms, annotated_image, created_at) 
                        VALUES (%s, %s, %s, %s, %s, NOW())""",
                    (farm_id, image_name, predicted_count, processing_time_ms, thumbnail_base64)
                )
                conn.commit()
                print(f"识别记录保存成功: farm_id={farm_id}, count={predicted_count}")
    except Exception as exc:
        print(f"保存识别记录失败: {exc}")
        import traceback
        traceback.print_exc()


# ============================================================
# 猪场管理API
# ============================================================

class PigFarmCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="猪场名称")


class PigFarmUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="猪场名称")


class PigFarmResponse(BaseModel):
    id: int
    name: str
    created_at: datetime

    class Config:
        from_attributes = True


class PigFarmListResponse(BaseModel):
    success: bool
    data: list[PigFarmResponse]


class PigFarmDetailResponse(BaseModel):
    success: bool
    data: PigFarmResponse | None


class PigFarmMessageResponse(BaseModel):
    success: bool
    message: str


@app.get("/api/farms", response_model=PigFarmListResponse)
async def get_farms() -> PigFarmListResponse:
    """获取所有猪场列表"""
    try:
        with get_db() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    "SELECT id, name, created_at FROM pig_farms ORDER BY created_at DESC"
                )
                farms = cursor.fetchall()
                return PigFarmListResponse(
                    success=True,
                    data=[
                        PigFarmResponse(
                            id=farm["id"],
                            name=farm["name"],
                            created_at=farm["created_at"],
                        )
                        for farm in farms
                    ],
                )
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"获取猪场列表失败: {exc}"
        ) from exc


@app.get("/api/farms/{farm_id}", response_model=PigFarmDetailResponse)
async def get_farm(farm_id: int) -> PigFarmDetailResponse:
    """获取单个猪场信息"""
    try:
        with get_db() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    "SELECT id, name, created_at FROM pig_farms WHERE id = %s",
                    (farm_id,),
                )
                farm = cursor.fetchone()
                if not farm:
                    raise HTTPException(status_code=404, detail="猪场不存在")
                return PigFarmDetailResponse(
                    success=True,
                    data=PigFarmResponse(
                        id=farm["id"],
                        name=farm["name"],
                        created_at=farm["created_at"],
                    ),
                )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"获取猪场信息失败: {exc}"
        ) from exc


@app.post("/api/farms", response_model=PigFarmDetailResponse)
async def create_farm(farm: PigFarmCreate) -> PigFarmDetailResponse:
    """创建新猪场"""
    try:
        with get_db() as conn:
            with conn.cursor() as cursor:
                # 检查名称是否已存在
                cursor.execute(
                    "SELECT id FROM pig_farms WHERE name = %s", (farm.name,)
                )
                if cursor.fetchone():
                    raise HTTPException(status_code=400, detail="猪场名称已存在")

                cursor.execute(
                    "INSERT INTO pig_farms (name, created_at) VALUES (%s, NOW())",
                    (farm.name,),
                )
                conn.commit()
                farm_id = cursor.lastrowid

                cursor.execute(
                    "SELECT id, name, created_at FROM pig_farms WHERE id = %s",
                    (farm_id,),
                )
                new_farm = cursor.fetchone()
                return PigFarmDetailResponse(
                    success=True,
                    data=PigFarmResponse(
                        id=new_farm["id"],
                        name=new_farm["name"],
                        created_at=new_farm["created_at"],
                    ),
                )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"创建猪场失败: {exc}"
        ) from exc


@app.put("/api/farms/{farm_id}", response_model=PigFarmDetailResponse)
async def update_farm(farm_id: int, farm: PigFarmUpdate) -> PigFarmDetailResponse:
    """更新猪场信息"""
    try:
        with get_db() as conn:
            with conn.cursor() as cursor:
                # 检查猪场是否存在
                cursor.execute(
                    "SELECT id FROM pig_farms WHERE id = %s", (farm_id,)
                )
                if not cursor.fetchone():
                    raise HTTPException(status_code=404, detail="猪场不存在")

                # 检查新名称是否与其他猪场冲突
                cursor.execute(
                    "SELECT id FROM pig_farms WHERE name = %s AND id != %s",
                    (farm.name, farm_id),
                )
                if cursor.fetchone():
                    raise HTTPException(status_code=400, detail="猪场名称已存在")

                cursor.execute(
                    "UPDATE pig_farms SET name = %s WHERE id = %s",
                    (farm.name, farm_id),
                )
                conn.commit()

                cursor.execute(
                    "SELECT id, name, created_at FROM pig_farms WHERE id = %s",
                    (farm_id,),
                )
                updated_farm = cursor.fetchone()
                return PigFarmDetailResponse(
                    success=True,
                    data=PigFarmResponse(
                        id=updated_farm["id"],
                        name=updated_farm["name"],
                        created_at=updated_farm["created_at"],
                    ),
                )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"更新猪场失败: {exc}"
        ) from exc


@app.delete("/api/farms/{farm_id}", response_model=PigFarmMessageResponse)
async def delete_farm(farm_id: int) -> PigFarmMessageResponse:
    """删除猪场"""
    try:
        with get_db() as conn:
            with conn.cursor() as cursor:
                # 检查猪场是否存在
                cursor.execute(
                    "SELECT id FROM pig_farms WHERE id = %s", (farm_id,)
                )
                if not cursor.fetchone():
                    raise HTTPException(status_code=404, detail="猪场不存在")

                cursor.execute("DELETE FROM pig_farms WHERE id = %s", (farm_id,))
                conn.commit()
                return PigFarmMessageResponse(
                    success=True, message="猪场删除成功"
                )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"删除猪场失败: {exc}"
        ) from exc


# ============================================================
# 识别记录统计API
# ============================================================

class DetectionRecordResponse(BaseModel):
    id: int
    farm_id: int | None
    farm_name: str | None
    image_name: str
    predicted_count: int
    processing_time_ms: float
    created_at: datetime


class DetectionRecordListResponse(BaseModel):
    success: bool
    data: list[DetectionRecordResponse]
    total: int


class DetectionStatsResponse(BaseModel):
    success: bool
    data: dict[str, Any]


@app.get("/api/detection-records", response_model=DetectionRecordListResponse)
async def get_detection_records(
    farm_id: int | None = None,
    page: int = 1,
    page_size: int = 20
) -> DetectionRecordListResponse:
    """获取识别记录列表"""
    try:
        with get_db() as conn:
            with conn.cursor() as cursor:
                # 构建查询条件
                where_clause = ""
                params = []
                if farm_id:
                    where_clause = "WHERE dr.farm_id = %s"
                    params.append(farm_id)
                
                # 查询总数
                count_sql = f"SELECT COUNT(*) as total FROM detection_records dr {where_clause}"
                cursor.execute(count_sql, params)
                total = cursor.fetchone()["total"]
                
                # 查询记录
                offset = (page - 1) * page_size
                sql = f"""
                    SELECT dr.id, dr.farm_id, pf.name as farm_name, dr.image_name,
                           dr.predicted_count, dr.processing_time_ms, dr.created_at
                    FROM detection_records dr
                    LEFT JOIN pig_farms pf ON dr.farm_id = pf.id
                    {where_clause}
                    ORDER BY dr.created_at DESC
                    LIMIT %s OFFSET %s
                """
                cursor.execute(sql, params + [page_size, offset])
                records = cursor.fetchall()
                
                return DetectionRecordListResponse(
                    success=True,
                    data=[
                        DetectionRecordResponse(
                            id=r["id"],
                            farm_id=r["farm_id"],
                            farm_name=r["farm_name"],
                            image_name=r["image_name"],
                            predicted_count=r["predicted_count"],
                            processing_time_ms=r["processing_time_ms"],
                            created_at=r["created_at"]
                        )
                        for r in records
                    ],
                    total=total
                )
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"获取识别记录失败: {exc}"
        ) from exc


class DetectionRecordWithImageResponse(BaseModel):
    id: int
    farm_id: int | None
    farm_name: str | None
    image_name: str
    predicted_count: int
    processing_time_ms: float
    annotated_image: str | None  # base64 缩略图
    created_at: datetime
 
 
class DetectionRecordWithImageListResponse(BaseModel):
    success: bool
    data: list[DetectionRecordWithImageResponse]
    total: int
    page: int
    page_size: int


@app.get("/api/detection-records/with-images", response_model=DetectionRecordWithImageListResponse)
async def get_detection_records_with_images(
    farm_id: int | None = None,
    page: int = 1,
    page_size: int = 12,
) -> DetectionRecordWithImageListResponse:

    import logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)
    
    # 记录请求参数
    logger.info(f"Received request to /api/detection-records/with-images with params: farm_id={farm_id}, page={page}, page_size={page_size}")
    
    # 验证参数
    if page < 1:
        logger.error(f"Invalid page parameter: {page}")
        raise HTTPException(status_code=422, detail="page must be greater than 0")
    if page_size < 1 or page_size > 50:
        logger.error(f"Invalid page_size parameter: {page_size}")
        raise HTTPException(status_code=422, detail="page_size must be between 1 and 50")
    if farm_id is not None and not isinstance(farm_id, int):
        logger.error(f"Invalid farm_id parameter type: {type(farm_id)}")
        raise HTTPException(status_code=422, detail="farm_id must be an integer")
    
    logger.info(f"Parameters validated successfully")
    page_size = min(page_size, 50)
    try:
        logger.info("Starting database operations")
        with get_db() as conn:
            logger.info("Database connection established")
            with conn.cursor() as cursor:
                where_clause = ""
                params: list = []
                if farm_id is not None:
                    where_clause = "WHERE dr.farm_id = %s"
                    params.append(farm_id)
                    logger.info(f"Added farm_id filter: {farm_id}")

                # 总数
                count_sql = f"SELECT COUNT(*) AS total FROM detection_records dr {where_clause}"
                logger.info(f"Executing count query: {count_sql} with params: {params}")
                cursor.execute(count_sql, params)
                total = cursor.fetchone()["total"]
                logger.info(f"Total records found: {total}")

                offset = (page - 1) * page_size
                logger.info(f"Calculated offset: {offset}")
                
                select_sql = f"""
                    SELECT
                        dr.id, dr.farm_id, pf.name AS farm_name,
                        dr.image_name, dr.predicted_count,
                        dr.processing_time_ms, dr.annotated_image, dr.created_at
                    FROM detection_records dr
                    LEFT JOIN pig_farms pf ON dr.farm_id = pf.id
                    {where_clause}
                    ORDER BY dr.created_at DESC
                    LIMIT %s OFFSET %s
                """
                logger.info(f"Executing select query with params: {params + [page_size, offset]}")
                cursor.execute(select_sql, params + [page_size, offset])
                records = cursor.fetchall()
                logger.info(f"Fetched {len(records)} records")

                response_data = [
                    DetectionRecordWithImageResponse(
                        id=r["id"],
                        farm_id=r["farm_id"],
                        farm_name=r["farm_name"],
                        image_name=r["image_name"],
                        predicted_count=r["predicted_count"],
                        processing_time_ms=r["processing_time_ms"],
                        annotated_image=r["annotated_image"],
                        created_at=r["created_at"],
                    )
                    for r in records
                ]
                
                logger.info(f"Prepared response with {len(response_data)} items")
                
                return DetectionRecordWithImageListResponse(
                    success=True,
                    data=response_data,
                    total=total,
                    page=page,
                    page_size=page_size,
                )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error in get_detection_records_with_images: {exc}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"获取识别记录失败: {exc}"
        ) from exc


@app.get("/api/detection-records/{record_id}", response_model=PredictResponse)
async def get_detection_record_detail(record_id: int) -> PredictResponse:
    """获取识别记录详细信息"""
    try:
        with get_db() as conn:
            with conn.cursor() as cursor:
                # 查询记录
                cursor.execute(
                    """
                    SELECT dr.id, dr.farm_id, dr.image_name, dr.predicted_count, 
                           dr.processing_time_ms, dr.annotated_image
                    FROM detection_records dr
                    WHERE dr.id = %s
                    """,
                    (record_id,)
                )
                record = cursor.fetchone()
                
                if not record:
                    raise HTTPException(status_code=404, detail="识别记录不存在")
                
                # 解析标注图片和检测结果
                # 注意：这里我们没有存储原始的检测框数据，所以返回空数组
                # 在实际应用中，你可能需要修改数据库结构，存储检测框数据
                detections = []
                
                return PredictResponse(
                    success=True,
                    model_path=str(resolve_model_path()),
                    image_width=0,  # 这里可以从存储的信息中获取，或者设为0
                    image_height=0, # 这里可以从存储的信息中获取，或者设为0
                    predicted_count=record["predicted_count"],
                    detections=detections,
                    processing_time_ms=record["processing_time_ms"],
                    annotated_image=record["annotated_image"]
                )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"获取识别记录详情失败: {exc}"
        ) from exc


@app.get("/api/detection-stats", response_model=DetectionStatsResponse)
async def get_detection_stats(
    farm_id: int | None = None
) -> DetectionStatsResponse:
    """获取识别统计信息"""
    try:
        with get_db() as conn:
            with conn.cursor() as cursor:
                # 构建查询条件
                where_clause = ""
                params = []
                if farm_id:
                    where_clause = "WHERE farm_id = %s"
                    params.append(farm_id)
                
                # 总识别图片数
                cursor.execute(
                    f"SELECT COUNT(*) as total_images FROM detection_records {where_clause}",
                    params
                )
                total_images = cursor.fetchone()["total_images"]
                
                # 总识别猪数量
                cursor.execute(
                    f"SELECT COALESCE(SUM(predicted_count), 0) as total_pigs FROM detection_records {where_clause}",
                    params
                )
                total_pigs = cursor.fetchone()["total_pigs"]
                
                # 今日识别数量
                today_where = f"{where_clause} AND DATE(created_at) = CURDATE()" if where_clause else "WHERE DATE(created_at) = CURDATE()"
                cursor.execute(
                    f"SELECT COUNT(*) as today_images, COALESCE(SUM(predicted_count), 0) as today_pigs FROM detection_records {today_where}",
                    params
                )
                today_stats = cursor.fetchone()
                
                # 平均处理时间
                cursor.execute(
                    f"SELECT AVG(processing_time_ms) as avg_time FROM detection_records {where_clause}",
                    params
                )
                avg_time = cursor.fetchone()["avg_time"] or 0
                
                return DetectionStatsResponse(
                    success=True,
                    data={
                        "total_images": total_images,
                        "total_pigs": int(total_pigs),
                        "today_images": today_stats["today_images"],
                        "today_pigs": int(today_stats["today_pigs"]),
                        "avg_processing_time_ms": round(avg_time, 2)
                    }
                )
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"获取统计数据失败: {exc}"
        ) from exc

class FarmStatsItem(BaseModel):
    farm_id: int | None
    farm_name: str | None
    total_images: int
    total_pigs: int
    today_images: int
    today_pigs: int
    avg_processing_time_ms: float
    last_detection_at: datetime | None
 
 
class FarmStatsListResponse(BaseModel):
    success: bool
    data: list[FarmStatsItem]
 
 
@app.get("/api/detection-stats/by-farm", response_model=FarmStatsListResponse)
async def get_stats_by_farm() -> FarmStatsListResponse:
    """获取按猪场分组的识别统计数据（包含无猪场归属的记录）"""
    try:
        with get_db() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        dr.farm_id,
                        pf.name AS farm_name,
                        COUNT(*) AS total_images,
                        COALESCE(SUM(dr.predicted_count), 0) AS total_pigs,
                        SUM(DATE(dr.created_at) = CURDATE()) AS today_images,
                        COALESCE(SUM(CASE WHEN DATE(dr.created_at) = CURDATE() THEN dr.predicted_count ELSE 0 END), 0) AS today_pigs,
                        COALESCE(AVG(dr.processing_time_ms), 0) AS avg_processing_time_ms,
                        MAX(dr.created_at) AS last_detection_at
                    FROM detection_records dr
                    LEFT JOIN pig_farms pf ON dr.farm_id = pf.id
                    GROUP BY dr.farm_id, pf.name
                    ORDER BY total_images DESC
                    """
                )
                rows = cursor.fetchall()
 
                return FarmStatsListResponse(
                    success=True,
                    data=[
                        FarmStatsItem(
                            farm_id=r["farm_id"],
                            farm_name=r["farm_name"],
                            total_images=r["total_images"],
                            total_pigs=int(r["total_pigs"]),
                            today_images=int(r["today_images"] or 0),
                            today_pigs=int(r["today_pigs"]),
                            avg_processing_time_ms=round(float(r["avg_processing_time_ms"]), 2),
                            last_detection_at=r["last_detection_at"],
                        )
                        for r in rows
                    ],
                )
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"获取猪场统计数据失败: {exc}"
        ) from exc


class TimeSeriesDataItem(BaseModel):
    date: str
    images: int
    pigs: int


class TimeSeriesResponse(BaseModel):
    success: bool
    data: list[TimeSeriesDataItem]
    granularity: str


@app.get("/api/detection-stats/time-series", response_model=TimeSeriesResponse)
async def get_time_series_stats(
    granularity: str = "day",  # day 或 month
    farm_id: int | None = None,
    days: int = 30
) -> TimeSeriesResponse:
    """获取按时间粒度统计的数据"""
    try:
        if granularity not in ["day", "month"]:
            raise HTTPException(status_code=422, detail="granularity must be 'day' or 'month'")
        
        with get_db() as conn:
            with conn.cursor() as cursor:
                # 构建查询条件
                where_clause = ""
                params = []
                if farm_id is not None:
                    where_clause = "WHERE farm_id = %s"
                    params.append(farm_id)
                
                # 根据粒度构建日期格式
                if granularity == "day":
                    date_format = "DATE(created_at)"
                    time_condition = f"created_at >= DATE_SUB(NOW(), INTERVAL {days} DAY)"
                else:  # month
                    date_format = "DATE_FORMAT(created_at, '%%Y-%%m')"
                    time_condition = f"created_at >= DATE_SUB(NOW(), INTERVAL {days} DAY)"
                
                # 构建完整的WHERE子句
                if where_clause:
                    where_clause = f"{where_clause} AND {time_condition}"
                else:
                    where_clause = f"WHERE {time_condition}"
                
                # 执行查询
                cursor.execute(
                    f"""
                    SELECT
                        {date_format} AS date,
                        COUNT(*) AS images,
                        COALESCE(SUM(predicted_count), 0) AS pigs
                    FROM detection_records
                    {where_clause}
                    GROUP BY date
                    ORDER BY date
                    """,
                    params
                )
                rows = cursor.fetchall()
                
                # 构建响应数据
                data = [
                    TimeSeriesDataItem(
                        date=str(r["date"]),
                        images=r["images"],
                        pigs=int(r["pigs"])
                    )
                    for r in rows
                ]
                
                return TimeSeriesResponse(
                    success=True,
                    data=data,
                    granularity=granularity
                )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"获取时间序列数据失败: {exc}"
        ) from exc

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host=DEFAULT_HOST, port=DEFAULT_PORT, reload=False)
