# 项目总览：智慧猪群识别系统 (Pig Count)

**版本**: v2.1
**最后更新**: 2026-10-21

---

## 一句话概要

AI 驱动的猪只计数系统。用户上传猪群图片 → ONNX 模型检测 → 返回标注图 + 计数 + 统计看板。支持单张识别和批量文件夹识别，含 Excel 模板导出。

---

## 技术栈

| 层级 | 技术 | 说明 |
|---|---|---|
| 后端框架 | FastAPI (Python 3.11) + Uvicorn | REST API，单文件 `backend/app.py`（约 75KB，待拆分） |
| 推理引擎 | OpenCV DNN (`cv2.dnn`) | CPU 推理，ONNX 模型 |
| 模型 | `backend/model/pig_count.onnx` (11MB) | YOLO 系列单阶段检测器 |
| OCR | qwen-vl-ocr（阿里 DashScope API） | `backend/watermark_ocr.py` 用 httpx 直连；**旧 PaddleOCR 混合架构已废弄（`ocr.py` 已删除，相关依赖已移除）** |
| 数据库 | MySQL 8.0（容器内，时区 Asia/Shanghai） | 库名 `pig_counter`，4 张表：detection_records / pig_farms / watermark_data / system_logs |
| 前端 | **Vue 3** + Vite + Vuex + Vue Router + Chart.js + Ant Design Vue | SPA，2 个页面，源码在 `frontend/` |
| 反向代理 | Nginx (`nginx:latest`) | `/` → dist/，`/api/` → backend:8866 |
| 容器化 | Docker + Docker Compose | 三容器已在生产运行：nginx / backend / mysql |
| 日志 | system_logs 表 + apscheduler | 保留 7 天自动清理，每天凌晨 3:00 |
| Excel 导出 | openpyxl | 按 `backend/excel_template_v2.xlsx` 导出，含图片嵌入 |

---

## 当前运行方式

### 生产（远程服务器，Docker）

服务器：`root@47.110.63.70`，目录 `/opt/pig-counter/pig-counter`，访问 `http://47.110.63.70:8888`。

三容器：`pig-count-nginx`（唯一对外端口 8888）、`pig-count-backend`（`127.0.0.1:8866`）、`pig-count-mysql`（`127.0.0.1:3307`）。

部署流程详见根目录 `README.md` 的「远程服务器」一节。

### 本地开发

```bash
# 后端（依赖仓库根的 .env）
cd backend
pip install -r requirements.txt
python app.py                 # http://localhost:8866

# 前端
cd frontend
npm install && npm run dev    # http://localhost:5173
```

---

## 目录结构

```
pig-counter/                   # 仓库根 = 部署根
├── backend/                   # 后端（Docker 构建上下文）
│   ├── app.py                 # FastAPI 全部后端代码（含批量上传、Excel 导出）
│   ├── watermark_ocr.py       # 水印识别模块（app.py import，生产必倚）
│   ├── requirements.txt       # Python 依赖
│   ├── Dockerfile             # python:3.11-slim-bookworm
│   ├── mysql_init.sql         # 建表脚本
│   ├── excel_template_v2.xlsx # 甲方 Excel 导出模板（app.py 实际读取）
│   └── model/pig_count.onnx   # 默认 ONNX 检测模型
├── docker-compose.yml         # mysql + backend + nginx 编排
├── nginx.conf                 # 反向代理，client_max_body_size 500M
├── dist/                      # Vue 构建产物（nginx 挂载）
├── frontend/                  # Vue 3 源码（Vite）
│   ├── vite.config.js
│   ├── package.json
│   └── src/
│       ├── main.js
│       ├── App.vue            # 主应用，含状态机逻辑
│       ├── views/
│       │   └── StatsPage.vue  # 统计页面（含筛选/日期选择器）
│       ├── components/
│       │   ├── TopBar.vue
│       │   ├── CapsuleNav.vue         # 顶部胶囊导航（单张/批量/开始识别/统计）
│       │   ├── FarmSelector.vue       # 猪场选择器
│       │   ├── FarmInfoCard.vue       # 猪场信息卡 + 警告横幅
│       │   ├── SystemStatsCard.vue    # 系统统计卡
│       │   ├── StatCardsRow.vue       # 指标卡片行（预测数量/耗时/置信度/当次总数）
│       │   ├── OriginalImageCard.vue  # 原图卡片（拖拽上传）
│       │   ├── ResultImageCard.vue    # 标注结果卡片
│       │   ├── DetectionDetailTable.vue # 检测明细表格（含推理耗时 pill）
│       │   ├── BatchFolderUploader.vue  # 批量文件夹上传 + 文件树视图
│       │   ├── BatchResultsTable.vue    # 批量结果表格（含合计栏）
│       │   ├── FolderTree.vue           # Ant Design Tree 文件树组件
│       │   ├── LogPanel.vue             # 系统日志面板
│       │   ├── NotificationCard.vue     # Toast 通知卡片
│       │   ├── AppFooter.vue
│       │   ├── ServiceStatus.vue
│       │   ├── ServiceStatusPill.vue
│       │   └── AnalyzeButton.vue
│       ├── store/index.js
│       ├── router/index.js
│       └── utils/imageUtils.js
├── docs/                      # 文档（导航见 docs/README.md）
│   ├── README.md              # 文档导航与维护规则
│   ├── PROJECT_OVERVIEW.md    # 技术总览（本文件）
│   ├── MIGRATION_PLAN.md      # 迁移方案
│   ├── EXECUTIVE_SUMMARY.md   # 管理层汇报
│   ├── USER_JOURNEY.md        # 用户旅程图
│   ├── KNOWN_ISSUES.md        # 功能层已知限制
│   ├── refs/                  # OCR 选型历史存档
│   └── wheel/                 # 协作飞轮：HANDOVER / TODO_LIST / DEPLOYMENT_LOG / 协议
├── nginx.conf
├── docker-compose.yml
└── README.md
```

---

## 状态机设计

```
┌─────────┐   选择猪场    ┌──────────┐  上传图片   ┌──────────┐  开始识别  ┌──────────┐
│  空状态  │ ──────────→ │ 已选猪场  │ ────────→ │ 单张已加载 │ ────────→ │ 单张扫描中│
└─────────┘              └──────────┘            └──────────┘            └──────────┘
                                                                                │
                           ┌──────────┐                                    ┌──────────┐
                           │ 文件夹已  │  上传文件夹                        │ 单张识别  │
                           │ 载入     │ ────────→ 批量扫描中 ────────→     │ 结果     │
                           └──────────┘                                    └──────────┘
                                                    │
                                                ┌──────────┐
                                                │ 批量识别  │
                                                │ 结果     │
                                                └──────────┘
```

- 空状态：未选择猪场，单张/批量按钮置灰
- 已选猪场未上传：提示"请先上传图片"
- 未选猪场：提示"请先在上方选择猪场"

---

## Excel 模板导出

- 模板文件：`excel_template_v2.xlsx`（甲方「活体生猪盘点表」，旧的 `excel_template.xlsx` 已废弃）
- 承储单位固定为「乐清市华统牧业有限公司」
- 文件夹名称自动拆解：栋舍 / 楼层 / 单元 / 栏舍号
- 图片嵌入单元格（quality=100，尺寸自适应）
- 批次底栏统计行：E-H 列合并显示"累计："，I 列显示总数
- 前端「下载 Excel」按钮一键导出

---

## 数据库 Schema

### pig_farms（猪场表）

| 列 | 类型 | 说明 |
|---|---|---|
| id | INT PK AUTO_INCREMENT | 自增主键 |
| name | VARCHAR(100) UNIQUE | 猪场名称 |
| created_at | TIMESTAMP | 创建时间 |

### detection_records（检测记录表）

| 列 | 类型 | 说明 |
|---|---|---|
| id | INT PK AUTO_INCREMENT | 自增主键 |
| farm_id | INT FK → pig_farms(id) ON DELETE CASCADE | **NOT NULL** |
| image_name | VARCHAR(255) | 原始文件名 |
| predicted_count | INT | 预测猪只数 |
| processing_time_ms | FLOAT | 推理耗时 |
| annotated_image | TEXT | base64 缩略图（max 320px, JPG Q60） |
| confidence | FLOAT | 平均置信度 |
| created_at | TIMESTAMP | 创建时间 |

---

## API 路由清单

### 推理

| 方法 | 路由 | 功能 |
|---|---|---|
| POST | `/api/predict-batch` | 批量推理，支持多图 |

### 文件夹上传

| 方法 | 路由 | 功能 |
|---|---|---|
| POST | `/api/batch/upload` | 上传整个文件夹，解析目录结构，批量推理，按单元聚合，返回 Excel base64 |

### 健康与配置

| 方法 | 路由 | 功能 |
|---|---|---|
| GET | `/api/health` | 健康检查 |
| GET | `/api/config` | 返回默认参数 |

### 猪场 CRUD

| 方法 | 路由 | 功能 |
|---|---|---|
| GET | `/api/farms` | 列表 |
| GET | `/api/farms/{id}` | 详情 |
| POST | `/api/farms` | 创建 |
| PUT | `/api/farms/{id}` | 更新 |
| DELETE | `/api/farms/{id}` | 删除 |

### 识别记录

| 方法 | 路由 | 功能 |
|---|---|---|
| GET | `/api/detection-records` | 分页列表 |
| GET | `/api/detection-records/with-images` | 带缩略图分页列表 |
| GET | `/api/detection-records/{id}` | 单条详情 |

### 统计

| 方法 | 路由 | 功能 |
|---|---|---|
| GET | `/api/detection-stats` | 全局统计 |
| GET | `/api/detection-stats/by-farm` | 按猪场统计 |
| GET | `/api/detection-stats/time-series` | 时序趋势 |

### OCR（已废弃，仅存水印识别）

> 旧 `/api/ocr/farm-mark` 端点已随 `ocr.py` 一并删除（2026-10-21）。
> 当前 OCR 能力只剩水印识别（qwen-vl-ocr），在批量上传链路内部调用，不对外暴露独立端点。

---

## 推理链路

```
原始图片 (BGR)
    │
    ├→ letterbox()：等比缩放 → 960×960，灰度 padding
    ├→ blobFromImage()：BGR→RGB，1/255 归一化
    ├→ model.forward()：ONNX 前向推理（加锁串行）
    ├→ postprocess()：
    │     · 解析 xyw_h + scores
    │     · 过滤 conf < threshold (0.25)
    │     · 坐标逆映射回原图
    │     · NMS (iou_threshold 0.45)
    ├→ draw_detections()：画绿框 + 编号标签
    └→ encode_image() / create_thumbnail()：base64 输出
```

---

## 文件夹上传链路

```
用户拖入文件夹 (webkitdirectory)
    │
    ├→ 前端读取目录树 + webkitRelativePath
    ├→ 展示文件树结构（Ant Design Tree，支持滚动）
    ├→ POST /api/batch/upload（多文件 + 相对路径）
    │
    ├→ 后端解析路径层级:
    │     批次 = 根文件夹名
    │     单元 = 子文件夹名
    │     栏舍 = 文件名（跳过 栏舍号.jpg）
    │
    ├→ 逐张跑 ONNX 猪只检测（复用现有推理）
    ├→ 按 单元 汇总猪数
    ├→ 导出 Excel（openpyxl，按甲方模板）
    └→ 返回结果（含 Excel base64）
```

---

## 原型系统

高保真原型位于 `/home/user/Workspace/axhub-make-project/src/prototypes/pigcount-app/`

- 技术栈：React + Ant Design
- 作用：UI 规范参考，用于指导 Vue 3 开发
- 状态机、图标（Lucide）、布局规范均以原型为准
- 原型中的"仅供参考"，具体规范按开发框架及专业规范来做

---

## 已知问题

1. **`app.py` 单文件 75KB** — 后端全部代码集中在一个文件，待拆分为 routes/ services/
2. **模型单线程推理** — 推理时持有 `_MODEL_LOCK`，不支持并发
3. **`detection_records` 不存检测框** — 只存缩略图与 boxes JSON，前端框编辑未实现
4. **数据库无备份机制** — 数据仅存于 Docker 命名卷 `pig-counter_mysql_data`
5. **`OCR_API_KEY` 未轮换** — 明文存于服务器 `.env` 与容器环境变量
6. **仓库历史偏大（72MB）** — 早期的 `node_modules/` 与 `dist/` 已从最新提交移除，但仍留在历史中
