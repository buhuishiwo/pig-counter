# 智慧猪群识别系统 (Pig Count)

基于 YOLO + ONNX 的猪只自动计数系统。上传猪舍照片，AI 检测标注并计数，支持单张识别、批量文件夹识别、Excel 报表导出和历史统计看板。

## 技术栈

| 层 | 技术 |
|:---|:-----|
| 前端 | Vue 3 + Vite + Ant Design Vue + Chart.js |
| 后端 | FastAPI + uvicorn + OpenCV DNN (ONNX) |
| 数据库 | MySQL 8.0 |
| 部署 | Docker Compose (Nginx + FastAPI + MySQL) |

## 项目结构

```
pig-counter/
├── app.py                  # FastAPI 后端入口
├── model/
│   └── pig_count.onnx      # YOLO 检测模型
├── nginx.conf              # Nginx 反向代理配置
├── docker-compose.yml      # 三容器编排
├── Dockerfile
├── mysql_init.sql          # 数据库初始化脚本
├── excel_template.xlsx     # Excel 导出模板
├── requirements.txt        # Python 依赖
└── pig-counter/            # Vue 3 前端
    ├── src/
    │   ├── views/          # HomePage / StatsPage
    │   ├── components/     # 20+ 业务组件
    │   ├── composables/    # useBatch / useDetection / useEdit 等
    │   ├── api/            # axios 封装 + 各模块 API
    │   ├── store/          # Vuex 状态管理
    │   ├── router/         # Vue Router
    │   └── styles/         # CSS 模块
    ├── package.json
    └── vite.config.js
```

## 本地开发

**前置条件**：Python 3.10+、Node.js 18+、MySQL 8.0

```bash
# 1. 后端
cd pig-counter
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py                      # 启动于 http://localhost:8866

# 2. 前端（另开终端）
cd pig-counter/pig-counter
npm install
npm run dev                        # 启动于 http://localhost:5173
```

前端 Vite 已配置代理，`/api` 请求自动转发到后端 8866 端口。

## Docker 部署

```bash
cd pig-counter
docker compose up -d --build
```

启动三个容器：

| 服务 | 端口 | 说明 |
|:-----|:-----|:-----|
| nginx | 8888 | 前端静态文件 + API 反向代理 |
| backend | 8866 | FastAPI + ONNX 推理 |
| mysql | 3307 | MySQL 8.0 数据库 |

访问 `http://localhost:8888` 即可使用。

## 远程服务器

```bash
ssh root@47.110.63.70
cd /opt/pig-counter/pig-counter
git pull && docker compose up -d --build
```

生产地址：`http://47.110.63.70:8888`

## API 端点

### 检测

| 方法 | 路径 | 说明 |
|:-----|:-----|:-----|
| POST | `/api/predict-batch` | 单张/多张图片检测，返回标注图 + 计数 |
| POST | `/api/batch/upload` | 批量文件夹上传，解析目录结构后逐张推理 |
| POST | `/api/batch/regenerate-excel` | 重新生成批次 Excel 报表 |

### 检测记录

| 方法 | 路径 | 说明 |
|:-----|:-----|:-----|
| GET | `/api/detection-records` | 查询检测记录（分页、按猪场筛选） |
| GET | `/api/detection-records/with-images` | 带缩略图的检测记录 |
| GET | `/api/detection-records/{id}` | 单条记录详情 |
| PUT | `/api/detection-records/{id}` | 更新标注图 / 计数 / 检测框 |

### 猪场管理

| 方法 | 路径 | 说明 |
|:-----|:-----|:-----|
| GET | `/api/farms` | 猪场列表 |
| POST | `/api/farms` | 新建猪场 |
| PUT | `/api/farms/{id}` | 更新猪场 |
| DELETE | `/api/farms/{id}` | 删除猪场 |

### 统计

| 方法 | 路径 | 说明 |
|:-----|:-----|:-----|
| GET | `/api/detection-stats` | 总览统计（总图片数、总猪数、今日数据） |
| GET | `/api/detection-stats/by-farm` | 按猪场分组统计 |
| GET | `/api/detection-stats/time-series` | 时间序列数据（日/月/年粒度） |

### 系统

| 方法 | 路径 | 说明 |
|:-----|:-----|:-----|
| GET | `/api/health` | 健康检查 |
| GET | `/api/config` | 服务配置信息 |

## 关键配置

| 配置项 | 值 | 位置 |
|:-------|:---|:-----|
| 最大上传体积 | 500M | `nginx.conf` → `client_max_body_size` |
| API 超时 | 600s | `nginx.conf` → `proxy_read_timeout` |
| MySQL 时区 | Asia/Shanghai | `docker-compose.yml` → `TZ` 环境变量 |
| ONNX 模型路径 | `model/pig_count.onnx` | 环境变量 `PIG_MODEL_PATH` |
| 数据库密码 | `pig_counterMysql` | `docker-compose.yml` / `app.py` |

## 拍照规范

系统支持两种拍摄方式：

- **横屏拍摄**（猪头朝上）— 推荐
- **竖屏拍摄**（猪头朝上）

请确保猪只在画面中头朝上方，避免倾斜或倒置拍摄。

## 版本

当前版本：**v2.0**（`feature/portrait-image-support` 分支）
