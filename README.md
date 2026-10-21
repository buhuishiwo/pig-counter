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
├── mysql_init.sql          # 数据库初始化脚本（仅空数据卷首次启动时执行）
├── excel_template_v2.xlsx  # Excel 导出模板（app.py 实际读取的文件）
├── watermark_ocr.py        # 水印识别模块（app.py 第 21 行 import）
├── ocr.py                  # 旧版 OCR 模块（仅 scripts/validate_ocr.py 使用）
├── requirements.txt        # Python 依赖
├── dist/                   # 前端构建产物（不入库，nginx 直接挂载）
└── pig-counter/            # Vue 3 前端源码
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

**先创建 `.env`**（项目根目录，`app.py` 会 `load_dotenv()` 读取；该文件不入库）：

```ini
DB_PASSWORD=pig_counterMysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_NAME=pig_counter
OCR_API_KEY=sk-xxxx        # 水印 OCR 走阿里云 qwen-vl-ocr，缺失则水印识别不可用
OCR_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
OCR_MODEL=qwen-vl-ocr
```

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
# 1. 构建前端（产物输出到 ../dist，即项目根的 dist/）
cd pig-counter && npm ci && npm run build && cd ..
# 2. 构建并启动容器
docker compose up -d --build
```

三个容器的更新方式**不一样**，取决于挂载方式：

| 服务 | 端口 | 代码来源 | 改了代码怎么生效 |
|:-----|:-----|:-----|:-----|
| nginx | 8888 | 镜像 `nginx:latest`，挂载宿主 `./dist` 与 `./nginx.conf` | 只重跑 `npm run build`，**无需重启容器** |
| backend | 8866 | 镜像 `build: .`，`COPY . /app` 打进镜像，**无挂载** | 必须 `docker compose up -d --build backend` |
| mysql | 3307 | 命名卷 `mysql_data` + `./mysql_init.sql` 初始化 | 数据在卷里；`mysql_init.sql` **只在空卷时执行**，已有库改结构要手工执行 SQL |

`.env` 的两种用途要区分清楚：

- `docker compose` 会读取项目根的 `.env` 做变量替换（`OCR_API_KEY=${OCR_API_KEY:-}`）
- `.dockerignore` 排除了 `.env`，所以它**不会**进镜像；容器内的 `/app/.env` 不存在，配置全部来自 `docker-compose.yml` 的 `environment`

访问 `http://localhost:8888` 即可使用。

## 远程服务器

生产地址：`http://47.110.63.70:8888`

```bash
ssh root@47.110.63.70
cd /opt/pig-counter/pig-counter
```

发版流程（**不要用 `git pull`**：`dist/` 不入库、`.env` 不入库，且服务器工作区可能有未提交改动，`git pull` 会失败或冲突）：

```bash
# 1) 同步代码到远端 main（会丢弃服务器上的未提交改动）
git fetch origin
git reset --hard origin/main

# 2) 前端变更时重新构建（产物写入 ../dist，nginx 挂载，自动生效）
cd pig-counter && npm run build && cd ..

# 3) 后端变更时重建镜像（backend 无挂载，必须重建）
docker compose up -d --build backend

# 4) 校验
curl -s http://127.0.0.1:8866/api/health
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8888/
```

服务器上需自备 `.env`（含 `OCR_API_KEY`、`DB_PASSWORD`），它只被 `docker compose` 用于变量替换，不会进镜像、也不入库。

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
| MySQL 时区 | Asia/Shanghai | `docker-compose.yml` → mysql 容器 `TZ` 环境变量 |
| ONNX 模型路径 | `model/pig_count.onnx` | 环境变量 `PIG_MODEL_PATH` |
| 数据库密码 | `pig_counterMysql` | `docker-compose.yml` / `Dockerfile` 默认值 |
| 水印 OCR 密钥 | 宿主 `.env` 的 `OCR_API_KEY` | `docker-compose.yml` → `environment` |

## 拍照规范

系统支持两种拍摄方式：

- **横屏拍摄**（猪头朝上）— 推荐
- **竖屏拍摄**（猪头朝上）

请确保猪只在画面中头朝上方，避免倾斜或倒置拍摄。

## 版本

当前版本：**v2.0**（部署分支 `main`）

> 时间说明：`created_at` 均为 MySQL `TIMESTAMP`，内部存 UTC，读时按会话时区换算。mysql 容器必须设 `TZ=Asia/Shanghai`（`docker-compose.yml` 已配），否则页面时间会早 8 小时、「今日」日界会错到北京时间 08:00。
