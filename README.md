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
pig-counter/                       # 仓库根 = 部署根
├── backend/                      # 后端（构建上下文）
│   ├── app.py                    # FastAPI 后端入口
│   ├── watermark_ocr.py          # 水印识别（app.py import）
│   ├── requirements.txt          # Python 依赖
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── mysql_init.sql            # 建表脚本（仅空数据卷首次启动时执行）
│   ├── excel_template_v2.xlsx    # Excel 导出模板（app.py 实际读取）
│   └── model/pig_count.onnx      # YOLO 检测模型
├── frontend/                     # Vue 3 前端源码（Vite）
│   ├── index.html
│   ├── vite.config.js            # 构建产物输出到 ../dist
│   ├── package.json
│   ├── public/
│   └── src/
│       ├── views/                # HomePage / StatsPage
│       ├── components/           # 20+ 业务组件
│       ├── composables/          # useBatch / useDetection / useEdit 等
│       ├── api/                  # axios 封装 + 各模块 API
│       ├── store/                # Vuex 状态管理
    │   ├── router/         # Vue Router
    │   └── styles/         # CSS 模块
    ├── package.json
    └── vite.config.js
```

## 文档索引

完整导航与「每份文档该在哪里更新」的规则见 [`docs/README.md`](docs/README.md)。

| 文档 | 内容 |
|:--|:--|
| `README.md`（本文件） | 项目概览、本地开发、Docker 部署、远程发版流程、API 端点、关键配置 |
| `docs/PROJECT_OVERVIEW.md` | 技术栈、目录结构、业务逻辑总览、已知问题 |
| `docs/MIGRATION_PLAN.md` | **迁移到客户内网新服务器的方案、盘点与待决策项** |
| `docs/DEPLOY_HYPERV_UBUNTU.md` | **Windows Server 2022 + Hyper-V + Ubuntu 虚拟机部署教程（含搬数据、验收、排错、运维）** |
| `docs/KNOWN_ISSUES.md` | 功能层已知限制（OCR 识别边界等） |
| `docs/EXECUTIVE_SUMMARY.md` / `docs/USER_JOURNEY.md` | 面向管理层的功能概览、用户旅程图 |
| `docs/wheel/` | **协作飞轮（本地维护，不入库）**：HANDOVER_BRIEF / HANDOVER_CONTEXT / TODO_LIST / DEPLOYMENT_LOG / 协议 |
| `docs/refs/` | OCR 选型历史研究（**已废弃方案存档**，不代表当前实现） |
| `AGENTS.md` | AI 编码助手行为规范 |

## 本地开发

**前置条件**：Python 3.10+、Node.js 18+、MySQL 8.0

**先创建 `.env`**（放在**仓库根目录**；`backend/app.py` 会依次读取 `backend/.env` 与仓库根 `.env`，该文件不入库）：

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
cd backend
pip install -r requirements.txt
python app.py                      # 启动于 http://localhost:8866

# 2. 前端（另开终端）
cd frontend
npm install
npm run dev                        # 启动于 http://localhost:5173
```

前端 Vite 已配置代理，`/api` 请求自动转发到后端 8866 端口。

## Docker 部署

```bash
# 1. 构建前端（产物输出到仓库根 dist/）
cd frontend && npm ci && npm run build && cd ..
# 2. 构建并启动容器
docker compose up -d --build
```

三个容器的更新方式**不一样**，取决于挂载方式：

| 服务 | 端口 | 代码来源 | 改了代码怎么生效 |
|:-----|:-----|:-----|:-----|
| nginx | `8888:80` | 镜像 `nginx:latest`，挂载宿主 `./dist` 与 `./nginx.conf` | 只重跑 `npm run build`，**无需重启容器** |
| backend | `127.0.0.1:8866` | 镜像 `build: ./backend`，`COPY . /app` 打进镜像，**无挂载** | 必须 `docker compose up -d --build backend` |
| mysql | `127.0.0.1:3307` | 命名卷 `mysql_data` + `./backend/mysql_init.sql` 初始化 | 数据在卷里；`mysql_init.sql` **只在空卷时执行**，已有库改结构要手工执行 SQL |

**端口只对外开 `8888`**。`8866`（无鉴权的推理接口）和 `3307`（MySQL root）都只绑在 `127.0.0.1`，避免绕过 nginx 直打后端、也避免数据库端口暴露。nginx 是通过 `pig-count-network` 访问 `backend:8866` 的，不依赖宿主端口。需要从本机连数据库时用 SSH 隧道：

```bash
ssh -L 3307:127.0.0.1:3307 admin@47.110.63.70
# root 已于 2026-11-11 禁登录，用 admin（在 docker 组且 sudo -n 免密）
# 然后本地连 127.0.0.1:3307
```

`.env` 的两种用途要区分清楚：

- `docker compose` 会读取项目根的 `.env` 做变量替换（`OCR_API_KEY=${OCR_API_KEY:-}`）
- `.dockerignore` 排除了 `.env`，所以它**不会**进镜像；容器内的 `/app/.env` 不存在，配置全部来自 `docker-compose.yml` 的 `environment`

访问 `http://localhost:8888` 即可使用。

## 远程服务器

两套环境，**都是 v3.1**（tag `v3.1` / commit `f54509bd`）：

| 环境 | 地址 | 用途 |
|:-----|:-----|:-----|
| 客户内网**生产** | 自有域名 → 静态公网 IP → cpolar 隧道 → `192.168.250.2:8888` | 客户实际使用；Windows Server 2022 + Hyper-V + Ubuntu 22.04 VM；只能从宿主 `ssh ubuntu@192.168.250.2` |
| 云端**预发布** | `http://47.110.63.70:8888` | 发版前验证 + 离线镜像包构建机（Alibaba Cloud Linux 3） |

云端操作：

```bash
ssh admin@47.110.63.70        # root 已禁登录，命令需 sudo
cd /opt/pig-counter/pig-counter
```

### 云端发版流程（**不要用 `git pull`**：`dist/` 不入库、`.env` 不入库，且服务器工作区可能有未提交改动）

```bash
# 1) 同步代码到远端 main（会丢弃服务器上的未提交改动）
git fetch origin
git reset --hard origin/main

# 2) 前端变更时重新构建（产物写入仓库根 dist/，nginx 挂载，自动生效）
cd frontend && npm run build && cd ..

# 3) 后端变更时重建镜像（backend 无挂载，必须重建）
docker compose up -d --build backend

# 4) 校验
curl -s http://127.0.0.1:8866/api/health
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8888/
```

服务器上需自备 `.env`（含 `OCR_API_KEY`、`DB_PASSWORD`），它只被 `docker compose` 用于变量替换，不会进镜像、也不入库。

### 内网生产更新流程（无公网 SSH，走离线包）

内网机不在 `git` 流程里：用 `docker save` / `docker load` 传镜像，`dist/` 随包传入，
`update.sh` 只重建 backend 容器。完整步骤与“两个必须记住的坑”（dist 不能删目录重建、重建 backend 后必须重启 nginx）见
`docs/wheel/DEPLOYMENT_LOG.md` #169。

> 内网 OCR 指向本地模型（`docker-compose.yml` 里 `OCR_BASE_URL` / `OCR_MODEL`，**不是** `.env`）：
> `OCR_BASE_URL=http://39.173.23.40:18081/v1`、`OCR_MODEL=qwen3.8-27b`、`OCR_API_KEY=EMPTY`（必须非空）。
> 端口不通时单张识别会卡约 10 分钟，见 `docs/KNOWN_ISSUES.md`。

> `git fetch` 偶尔会因为服务器到 GitHub 的 HTTPS 连接超时报错（实测出现过连续两次失败），重试即可。若持续不通，可在本地打 `git bundle` 后用 scp 传上去再 `git fetch <bundle>`。

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
| 对外暴露端口 | 仅 `8888`（nginx） | `docker-compose.yml` → backend/mysql 均绑 `127.0.0.1` |
| ONNX 模型路径 | `backend/model/pig_count.onnx` | 环境变量 `PIG_MODEL_PATH` |
| 数据库密码 | `pig_counterMysql` | `docker-compose.yml` / `Dockerfile` 默认值 |
| 水印 OCR 密钥 | 宿主 `.env` 的 `OCR_API_KEY` | `docker-compose.yml` → `environment` |

## 拍照规范

系统支持两种拍摄方式：

- **横屏拍摄**（猪头朝上）— 推荐
- **竖屏拍摄**（猪头朝上）

请确保猪只在画面中头朝上方，避免倾斜或倒置拍摄。

## 版本

当前版本：**v3.1**（tag `v3.1` / commit `f54509bd`，部署分支 `main`）

> 版本线：`v0.3`（原型期）→ `v1.0`（2026-06-02 核心功能）→ `v2.0`（2026-07-07 竖屏支持）
> → `v3.0`（2026-07-13 水印 OCR + 生产级日志系统）→ `v3.0.1`（修复前锚点）
> → **`v3.1`**（2026-11-18：批量上传分批 50 张/批 + 跨批去重 + 水印 OCR 适配新标准 `1单元10栏`
> + 门牌照跳过 + 编辑标注翻页/自动保存 + 推理搬线程；同日内网生产就地更新上线）

> 部署现状：云端预发布与客户内网生产**均为 v3.1**，详见本地飞轮文档 `docs/wheel/DEPLOYMENT_LOG.md` #169（不入库）。

> 时间说明：`created_at` 均为 MySQL `TIMESTAMP`，内部存 UTC，读时按会话时区换算。mysql 容器必须设 `TZ=Asia/Shanghai`（`docker-compose.yml` 已配），否则页面时间会早 8 小时、「今日」日界会错到北京时间 08:00。
