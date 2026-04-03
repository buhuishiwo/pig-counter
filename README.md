# Pig Count Service

这个 `service` 文件夹可以单独打包发给客户使用，不依赖外层仓库目录。

## 目录

- `app.py`：服务入口
- `model/pig_count.onnx`：默认模型文件
- `static/index.html`：测试页面
- `requirements.txt`：Python 依赖
- `Dockerfile`：容器构建文件
- `docker-compose.yml`：容器启动配置

## 本地运行

```powershell
cd service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

启动后访问：

- `http://127.0.0.1:8866/`：测试页面
- `http://127.0.0.1:8866/docs`：Swagger
- `http://127.0.0.1:8866/health`：健康检查

默认模型路径：

```text
service\model\pig_count.onnx
```

如需改模型，可以覆盖环境变量：

```powershell
$env:PIG_MODEL_PATH="D:\deploy\service\model\pig_count.onnx"
python app.py
```

## Docker 运行

在 `service` 目录执行：

```powershell
docker compose up --build
```

## 接口

### `POST /api/predict`

表单上传字段：

- `file`：图片文件

可选 query 参数：

- `conf_threshold`：默认 `0.25`
- `iou_threshold`：默认 `0.45`
- `imgsz`：默认 `960`

返回内容包含：

- `predicted_count`：预测猪只数量
- `detections`：检测框列表
- `annotated_image`：Base64 标注图
