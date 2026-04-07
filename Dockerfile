FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DEFAULT_TIMEOUT=600 \
    PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple \
    PIG_SERVICE_HOST=0.0.0.0 \
    PIG_SERVICE_PORT=8866 \
    PIG_MODEL_PATH=/app/model/pig_count.onnx \
    DB_HOST=mysql \
    DB_PORT=3306 \
    DB_USER=root \
    DB_PASSWORD=pig_counterMysql \
    DB_NAME=pig_counter

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN pip install -r /app/requirements.txt

COPY . /app

EXPOSE 8866

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8866"]
