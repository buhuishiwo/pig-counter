# 交接上下文 (Handover Context) — 智慧猪群识别系统

---

## 30 秒快照

| 项 | 内容 |
|:---|:-----|
| **项目概要** | AI 猪只计数系统：上传猪舍图片 → ONNX 检测 → 标注图 + 计数 + 统计看板 + Excel 报表。前端 Vue 3 + Vite，后端 FastAPI，MySQL，Docker Compose 三容器部署。代码结构 `backend/` + `frontend/` |
| **当前阶段** | **v3.0** 稳定运行中；P6 迁移准备 — 等待甲方确认目标系统（Ubuntu 22.04 首选 / Windows Server 2022 次选） |
| **最新变更** | 2026-10-21：目录重构 backend/+frontend/、mysql 时区修复（TZ=Asia/Shanghai）、端口收窄（8866/3307 绑 127.0.0.1）、PaddleOCR 依赖移除（镜像 1.92GB→946MB）、仓库清理（node_modules 出库）、全套文档对齐 |
| **下次第一件事** | 等甲方回复目标系统版本；确定后按 `docs/MIGRATION_PLAN.md` 执行：先 `mysqldump` 全量导出（含 655MB 图片）→ 选 A/B/C 方案打包 → 目标机导入 → 跑迁移验证清单 |

---

## 环境速查

| 节点 | 地址 | 角色 |
|:-----|:-----|:-----|
| 本地开发 | localhost:5173 (前端) / localhost:8866 (后端) | Vue 3 + Vite dev server, FastAPI uvicorn, MySQL 本地 |
| 远程服务器 | 47.110.63.70:8888 | Nginx(前端静态) + FastAPI(8866) + MySQL(3307)，Docker Compose |

**SSH 方式**: `ssh root@47.110.63.70`（免密登录）
**Git 远程**: HTTPS `https://github.com/buhuishiwo/pig-counter.git`（服务器无 SSH key；偶发 443 超时，重试即可）
**数据库**: 库 `pig_counter`，用户 `root`，密码 `pig_counterMysql`，数据在 Docker 命名卷 `pig-counter_mysql_data`（**无备份**）
**分支**: 只剩 `main`（`dev` 与两个 feature 分支已于 2026-10-21 清理）；tag：v0.3(local) / v1.0 / v2.0 / v3.0

**本地启动速查**:

```bash
# 后端（.env 在仓库根目录，app.py 会读 backend/.env 与根 .env）
cd /home/user/Workspace/PigCount/pig-counter/backend
python app.py          # 端口 8866

# 前端
cd /home/user/Workspace/PigCount/pig-counter/frontend
npm run dev            # Vite，端口 5173
```

**远程部署速查**（禁止 `git pull`，dist/.env 不入库且服务器工作区可能脏）:

```bash
ssh root@47.110.63.70
cd /opt/pig-counter/pig-counter
git fetch origin && git reset --hard origin/main   # 拉代码
cd frontend && npm run build && cd ..             # 前端变更时（产物落仓库根 dist/，nginx 挂载自动生效）
docker compose up -d --build backend               # 后端变更时（backend 无挂载，必须重建）
curl -s http://127.0.0.1:8888/api/health
```

---

## 关键路径

```
用户操作                      前端 (Vue 3 :5173)               后端 (FastAPI :8866)              存储
──────────────────────────────────────────────────────────────────────────────────────────────────────
上传猪舍图片  ──→  Vuex store 保存  ──→  POST /api/predict-batch  ──→  ONNX 推理(pig_count.onnx)
                                    │                         │     ↓
单张识别      ──→  显示标注图+计数  ←──  返回 annotated_image  ←──  draw_detections() + 存 MySQL
                                    │
批量识别      ──→  webkitdirectory   ──→  POST /api/batch/upload ──→  逐张推理 + 存 MySQL
              ←──  Excel 导出       ←──  POST /api/batch/regenerate-excel ←──  读 excel_template_v2.xlsx
                                    │
统计页面      ──→  GET /api/detection-stats ←──  查询 detection_records
              ←──  Chart.js 渲染
                                    │
远程服务器    ──→  Nginx(:8888)     ──→  FastAPI(:8866)        ──→  MySQL(:3307)
               静态文件反向代理         API 处理                  Docker Compose
```

**前端架构**（重构后）：

```
src/
├── api/            ← 共享 axios 实例(http.js) + 各模块 API
├── composables/    ← useBatch, useDetection, useFarm, useStats, useNotify, useEdit
├── components/     ← 20+ 组件（TopBar, ResultImageCard, BatchFolderUploader 等）
├── views/          ← HomePage.vue（主视图）, StatsPage.vue（统计页）
├── styles/         ← 8 个 CSS 模块（variables, reset, ambient, glass-card 等）
├── router/         ← Vue Router 配置
├── store/          ← Vuex 状态管理
└── utils/          ← imageUtils.js
```

---

## 测试数据

批量识别测试文件夹：`/mnt/d/数猪系统/育肥C区2楼1-4单元/`
- 4 个单元（C区2楼1-4单元），共 43 张图片
- 结构：`批次文件夹/单元子文件夹/栏舍照片.jpg`

竖屏测试图片：`/home/user/Workspace/PigCount/portrait-test.jpg`（9:16 竖屏）
竖屏验收图片：`D:\数猪系统\育肥C区2楼1-4单元\C区2楼4单元\3号栏舍.jpg`（原图 3024×4032）

> 注：仓库内的 `test_images/`、`validation_results/`、`public/test-portrait.jpg`
> 已于 2026-10-21 清理（旧 OCR 验证物料与无引用素材）。生产数据以 MySQL 为准：
> `detection_records` 2500 行，含 base64 缩略图约 655MB。
> 当前分支：`dev` / `main` 均指向 `4daed7c5`，与 origin 同步。

---

## 历史

### 2026-10-21 — 分支与版本治理

- 删除冗余分支：`dev`（与 main 始终同一提交）、`feature/portrait-image-support`（旧结构快照）、`feature/box-modify`（已完全并入 main）；本地与远端同步清理，只剩 `main`
- 版本号统一为 **v3.0** 并推送 tag（指向 2026-07-13 的水印 OCR + 日志系统发布提交 `5f10547a`）
- 版本线记录：v0.3 原型期 → v1.0 核心功能 → v2.0 竖屏支持 → v3.0 水印OCR+日志
- 文档体系去重：`docs/wheel/` 入库，每份文档只保留一处（详见 docs/README.md）

### 2026-10-21 — 迁移准备 + 目录重构 + 运维加固

- **目录重构**：后端文件移入 `backend/`，`pig-counter/` 改名 `frontend/`；`dist`/`nginx.conf`/`.env` 留仓库根
- **仓库清理**：移除误提交的 `node_modules/`（52 个 vue-router 文件）、Vue2 时代根 `package.json`、Vue CLI 残留、冲突的 `public/index.html`；跟踪文件 140 → 82
- **时区修复**：mysql 容器补 `TZ=Asia/Shanghai`。`created_at` 为 TIMESTAMP，历史数据自动换算无需迁移（修复前读 13:20，修复后读 21:20）
- **端口收窄**：backend/mysql 改绑 `127.0.0.1`，公网仅开 nginx 8888
- **PaddleOCR 彻底移除**：删 `ocr.py`、`scripts/validate_ocr.py`，移除 `paddlepaddle`/`paddleocr`/`dashscope` 依赖，镜像 1.92GB → 946MB
- **仓库与生产对齐**：把仅存在于服务器工作区的 20 个提交推上 GitHub；`.env` 从提交中摘除（密钥未泄露）
- **文档**：新增 `docs/MIGRATION_PLAN.md`；README/PROJECT_OVERVIEW/HANDOVER/TODO/KNOWN_ISSUES/DEPLOYMENT_LOG 全部对齐；`docs/refs/` 标注为历史存档
- **迁移评估**：确认 Windows Server 2012 无法跑容器（无 WSL2、Docker Engine 需 Server 2016+、嵌套虚拟化大概率不具备），已向甲方提出换系统

### 2026-07-13 — 水印 OCR + 生产日志系统

- **水印 OCR 链路**（11 个提交）：`watermark_ocr.py` 接 qwen-vl-ocr（httpx 直连 DashScope），栋舍/单元/栏号写入 `watermark_data` 表；单张/批量结果栏显示蓝色水印标签；Excel 按水印命名
- **生产日志系统**（7 个提交）：`system_logs` 表 + API + 前端日志面板，保留 7 天，apscheduler 每天 03:00 清理
- **生产转换为三容器 Docker 部署**，此前的服务器工作区同步方式（手工覆盖 + 重建镜像）在本次一并归档
- 页脚/tooltip/日志容器高度等 UI 微调

### 2026-06-18 — v2.0 发布

- 拍照规范 Popover：真实参考图，竖屏 3/4 等高显示，图标浅灰 + 位置微调
- 批量识别取消可中断 XHR：`_batchAbortCtrl` ref + `clearBatch` 内置 abort，逐张 fetch 也带 signal
- 扫描动画替换为 ant-design `a-progress type="circle"` 带百分比（单张/批量统一），移除 TopBar 流光进度条
- 进度曲线：上传 0→50% 真实进度（XHR upload.onprogress），50→99% 渐近 `50+49*(1-e^(-t/15))`，响应后平滑到 100%
- 批量模式：完成后按钮显示"重新识别"，移除"0 张 0 单元"无意义显示，加载文件后显示"点击开始识别"
- `feature/portrait-image-support` 分支已推送到 GitHub 远程，v2.0 tag 已打

### 2026-06-17 — 竖屏支持完成（原图直传）+ ESLint 清理

- **竖屏方案演进**：先实现 `ensureLandscape` 旋转（commit `151c0c56`），后发现对高频场景（竖屏-猪头朝上）有负面效果，回滚为原图直传（commit `7e9f4652`）
- 最终方案：删除旋转函数，原图直传后端（letterbox 原生支持任意比例），已验证横屏+竖屏猪头朝上均识别准确
- 修复编辑标注页竖屏图片显示偏移：`onEditImgLoad` 用 `img.clientWidth` 作容器参考导致竖屏图 scale 计算错误，改用 `canvas.parentElement`（`.edit-canvas-area`）真实尺寸
- ESLint 缓存清理：commit `fc8c9b6b` 移除 29453 个不该追踪的文件，`.gitignore` 已更新
- 删除过期分支 `dev` 和 `refactor/vue3-architecture`
- 拍照规范（已与用户确认）：横屏（猪头朝上）+ 竖屏（猪头朝上）
- 当前分支 `feature/portrait-image-support`，commit `7e9f4652`，待合并回 `main`

### 2026-06-10 — 闪烁修复 + 预览优化

- 批量模式绿色框闪烁根因：`loadBatchFullImages` 逐张更新触发 watcher 反复调 `drawBoxesAnimated()`
- 三轮修复：① 改用 `drawBoxesInstant()` ② `batchFullLoading` 标志位抑制 watcher ③ 去重 draw 调用
- 预览弹窗统一 800px 高清图，消除先小后大跳变
- 单张推理响应标注图改用 800px 缩略图

### 2026-06-09 — 性能优化 + 竖屏尝试

- 6 项低风险性能修复：RAF 泄漏、watcher 节流、chart.js tree-shaking（-46KB）、API 层统一（-349 行）
- 竖屏图片支持多次迭代失败（坐标映射问题），git reset 回滚，分支 `feature/portrait-image-support` 保留
- 统计页 footer 重复显示修复

### 2026-06-05 — Vue 3 架构重构

- 1916 行 God Component `App.vue` 拆分为标准 Vue 3 Composition API 结构
- 新建 api/（5 模块）、composables/（6 模块）、views/（2 页面）、styles/（8 CSS 模块）、router/
- 编辑标注逻辑因深度依赖 `$refs` 保留在 HomePage.vue 内联
- 重构后大量 UI 回归修复：顶栏消失、猪场选择器失效、批量模式不可用、编辑弹窗张冠李戴、坐标偏移、双层标注

### 2026-06-02 — 发布 v1.0 并打 Git tag

- 版本号 v0.1 → v1.0，dev 合并到 main，推送到 GitHub
- `v1.0` tag 打在提交 `cef7241`，GitHub 自动生成 source code zip/tar.gz
- 统计页面重设计：Chart.js 渐变填充 + 十字准线跟随 + 发光效果
- Ant Design 风格 Select + RangePicker 组件升级
- Logo 和 favicon 更新，nginx.conf `client_max_body_size` 调整为 200M

### 2026-06-01 — 部署远程服务器并修复批量标注 bug

- Docker Compose 部署到 47.110.63.70（mysql:3307 + backend:8866 + nginx:8888）
- MySQL 时区修复（TZ=Asia/Shanghai），Nginx 超时 600s
- 批量编辑标注 8 个 bug 修复：标注号重叠、路径残留、Excel 导出原图、取消状态残留、预测计数变化、数据不同步、遮罩优先级、猪场选择丢失
- OCR 模块从 app.py 导入移除

### 2026-05-31 — 精调 UI 布局与交互

- Ant Design Tree 背景色：根元素 + 所有内部层 transparent
- 文件树滚动容器修复，批量识别左右容器对齐
- 推理耗时/原图 meta 信息迁移，Header min-height 统一
- 空状态容器撑满，警告横幅布局稳定
- 上传/清除平滑过渡（绝对定位叠放 + transform transition）
- 从崩溃会话 f66620cc 完整接管上下文

### 2026-05-28 — 开发核心功能模块

- Vue 2 → Vue 3 升级（Vite 替代 webpack）
- 原型迁移（React 原型 → Vue 3 开发）
- Excel 模板导出完成（按甲方模板，承储单位固定，图片嵌入）
- 批量识别 + 数据库存储，统计页面筛选
- Toast 通知规范统一，状态机优化
- 文件树结构视图（Ant Design Tree）

### 2026-05-13 — 确认甲方落地形态

- 目录结构替代 OCR 身份识别
- 明确落地形态：前端 webkitdirectory → 后端解析路径 → ONNX 检测 → Excel
