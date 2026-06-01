# 项目总览：智慧猪群识别系统 (Pig Count)

**版本**: v0.3
**最后更新**: 2026-05-31

---

## 一句话概要

AI 驱动的猪只计数系统。用户上传猪群图片 → ONNX 模型检测 → 返回标注图 + 计数 + 统计看板。支持单张识别和批量文件夹识别，含 Excel 模板导出。

---

## 技术栈

| 层级 | 技术 | 说明 |
|---|---|---|
| 后端框架 | FastAPI (Python 3.11) + Uvicorn | REST API，单文件 `app.py` |
| 推理引擎 | OpenCV DNN (`cv2.dnn`) | CPU 推理，ONNX 模型 |
| 模型 | `model/pig_count.onnx` (11MB) | YOLO 系列单阶段检测器 |
| OCR | PaddleOCR (本地) + qwen-vl-ocr (API) | 保留但不再用于身份识别；目录结构替代 |
| 数据库 | MySQL 8.0 | 本地运行，库名 `pig_counter` |
| 前端 | **Vue 3** + Vite + Vuex + Vue Router + Chart.js + Ant Design Vue | SPA，2 个页面 |
| 反向代理 | Nginx (alpine) | `/` → dist/，`/api/` → backend:8866 |
| 容器化 | Docker + Docker Compose | mysql + backend + nginx（当前 Docker 异常，本地直接运行） |
| Excel 导出 | openpyxl | 按甲方模板导出批量识别结果，含图片嵌入 |

---

## 当前运行方式

Docker 当前异常不可用，改为本地直接运行：

```bash
# 后端
cd /home/user/Workspace/PigCount/pig-counter
source .venv/bin/activate
python app.py          # 端口 8866

# 前端
cd /home/user/Workspace/PigCount/pig-counter/pig-counter
npm run dev            # Vite，端口 5173

# MySQL
sudo mysql -u root     # 密码 pig_counterMysql，库 pig_counter
```

---

## 目录结构

```
pig-counter/
├── app.py                     # FastAPI 全部后端代码（含批量上传、Excel 导出）
├── ocr.py                     # OCR 标记识别模块（PaddleOCR + qwen-vl-ocr）
├── requirements.txt           # Python 依赖
├── excel_template.xlsx        # 甲方 Excel 导出模板
├── Dockerfile                 # python:3.11-slim-bookworm
├── docker-compose.yml         # mysql + backend + nginx 编排
├── nginx.conf                 # 反向代理，client_max_body_size 50M
├── mysql_init.sql             # 建表脚本
├── model/
│   └── pig_count.onnx         # 默认 ONNX 检测模型
├── dist/                      # Vue 构建产物
├── pig-counter/               # Vue 3 源码（Vite）
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
├── scripts/
├── docs/                      # 飞轮文档（本目录）
│   ├── PROJECT_OVERVIEW.md
│   ├── HANDOVER_CONTEXT.md
│   ├── TODO_LIST.md
│   ├── DEPLOYMENT_LOG.md
│   └── refs/
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

- 模板文件：`excel_template.xlsx`（甲方「活体生猪盘点表」）
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

### OCR（保留，已降级为非核心）

| 方法 | 路由 | 功能 |
|---|---|---|
| POST | `/api/ocr/farm-mark` | 上传图片，识别墙面粉笔字/编号牌，返回文字 + 农场匹配建议 |

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

1. **Docker 异常** — 当前 Docker 服务不可用，改为本地直接运行
2. **detection_records 不存检测框** — 只存了缩略图，不存原始 detection box 坐标
3. **node_modules/.cache 已提交 git** — commit `e0e97af1` 含 ESLint 缓存
4. **模型单线程推理** — 推理时持有 `_MODEL_LOCK`，不支持并发
5. **README.md 过时** — 引用了不存在的 `/api/predict` 端点
