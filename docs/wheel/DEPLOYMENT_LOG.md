# 智慧猪群识别系统部署实施日志 (Deployment Log)

**文档说明**: 记录项目落地过程中的关键里程碑、执行步骤、遇到的问题及解决方案。降低上下文切换成本，确保多轮次对话或人员更替时的无缝衔接。

**当前状态**: v3.0 稳定运行中 — 已完成生产化与运维加固（时区/端口/依赖/目录结构），当前处于迁移准备阶段
**最后更新**: 2026-10-21

---

## 1. 环境信息 (Environment Context)

* **本地开发环境**:
  * 操作系统: Windows WSL2 (Ubuntu 22.04)
  * 后端: FastAPI (uvicorn) — 端口 8866
  * 前端: Vue 3 + Vite — 端口 5173
  * 数据库: MySQL 8.0 本地 — 库 `pig_counter`，用户 `root`
  * 模型: ONNX (`model/pig_count.onnx`)，OpenCV DNN 推理
  * Python: `.venv` 虚拟环境
* **远程生产环境**:
  * 服务器: `47.110.63.70` — root 免密 SSH
  * 部署方式: Docker Compose
  * 组件端口: Nginx(8888, **唯一对外**) + Backend(127.0.0.1:8866) + MySQL(127.0.0.1:3307)
  * 项目路径: `/opt/pig-counter/pig-counter/`（代码结构 `backend/` + `frontend/`）
  * 数据持久化: Docker 命名卷 `pig-counter_mysql_data`（含全部业务数据，**无备份**）
  * Git 远程: HTTPS (`https://github.com/buhuishiwo/pig-counter.git`) — 服务器无 SSH key，偶发 443 超时需重试
* **关键配置**:
  * MySQL 容器需设 `TZ=Asia/Shanghai`（否则 created_at 差 8 小时，且「今日」日界错到 08:00）
  * Nginx 需 `proxy_read_timeout 600s`、`client_max_body_size 500M`
  * `backend/excel_template_v2.xlsx` 必须随代码提交（后端导出直接读取，旧 `excel_template.xlsx` 已废弃）
  * `.env` 放仓库根（docker compose 做变量替换；`.dockerignore` 已排除，不进镜像）
  * 前端产物 `dist/` 在仓库根，由 nginx bind 挂载；backend 无挂载，改代码必须重建镜像
  * 部署必须用 `git fetch + git reset --hard origin/main`，**禁止 `git pull`**

---

## 2. 实施进度追踪 (Progress Tracker)

### 阶段一：核心功能开发 ✅

- [X] Vue 2 → Vue 3 升级（Vite 替代 webpack）
- [X] 单张识别：ONNX 检测 → 标注图 + 计数
- [X] 批量识别：文件夹上传 + 目录结构解析 + ONNX 检测 + 数据库存储
- [X] Excel 模板导出（按甲方模板，承储单位固定，文件夹名称自动拆解，图片嵌入）
- [X] 统计页面（Chart.js 趋势图 + 日期/猪场筛选）
- [X] Toast 通知规范 + 状态机优化

### 阶段二：UI 精调 + Bug 修复 ✅

- [X] Ant Design Tree 背景色 + 文件树滚动容器
- [X] 批量识别容器对齐 + Header 高度统一
- [X] 推理耗时/原图 meta 信息迁移
- [X] 空状态容器撑满 + 警告横幅布局稳定
- [X] 上传/清除平滑过渡
- [X] 批量编辑标注全流程修复（重叠/路径/导出/取消/计数/同步/覆盖层）
- [X] 猪场选择跨页面持久化（Vuex store）
- [X] 统计页面重设计（渐变/十字准线/发光效果）
- [X] Ant Design 风格 Select + RangePicker + 猪场名截断

### 阶段三：远程部署 ✅

- [X] Docker Compose 部署到 47.110.63.70
- [X] MySQL 时区修复 + Nginx 超时配置
- [X] v1.0 发布 + Git tag

### 阶段四：Vue 3 架构重构 ✅

- [X] API 层拆分（http.js, pigModel.js, detectionApi.js, farmApi.js, statsApi.js）
- [X] Composables 提取（useNotify, useStats, useFarm, useDetection, useBatch, useEdit）
- [X] App.vue 拆分为 App.vue（shell）+ HomePage.vue（主视图）
- [X] Router 配置 + 8 个 CSS 模块拆分
- [X] 重构后 UI 回归修复（顶栏/猪场选择器/批量模式/编辑弹窗）

### 阶段五：性能优化 ✅

- [X] RAF 内存泄漏修复、watcher 节流、chart.js tree-shaking、API 层统一

### 阶段六：闪烁修复 + 预览优化 + 竖屏支持 ✅

- [X] 批量模式绿色框闪烁修复（3 轮迭代）
- [X] 预览弹窗统一加载 800px 高清图
- [X] 竖屏（9:16）图片支持 — 移除旋转方案，原图直传（横屏+竖屏猪头朝上均支持）；修复编辑标注页竖屏图片显示偏移

### 阶段七：技术债务清理 — 部分完成

- [X] Docker 部署恢复（2026-07-13 起三容器正式部署）
- [X] ESLint 缓存清理（commit `fc8c9b6b`，移除 29453 个文件 + `.gitignore` 规则）
- [X] 误提交的 node_modules/vue-router 出库（2026-10-21）
- [ ] app.py 拆分（现为 `backend/app.py`，75KB）
- [ ] 前端 API 统一 / Vuex 持久化

### 阶段八：v2.0 体验优化 ✅

- [X] 拍照规范 Popover 提示（真实参考图，竖屏 3/4 比例等高，图标浅灰 + 位置微调）
- [X] 批量识别取消可中断 XHR 和逐张 fetch（`_batchAbortCtrl` ref + `clearBatch` 内置 abort）
- [X] 扫描动画替换为 ant-design `a-progress type="circle"` 带百分比（单张/批量统一）
- [X] 移除 TopBar 流光进度条
- [X] 批量识别完成后按钮显示"重新识别"（TopBar + CapsuleNav）
- [X] 进度曲线 `50 + 49×(1-e^(-t/15))` 渐近，响应前永不卡死
- [X] 移除批量模式"0 张 0 单元"无意义显示
- [X] 批量模式加载文件后显示"点击开始识别"提示
- [X] v2.0 发布 + Git tag

### 阶段九：生产化 — 水印 OCR + 日志系统 ✅

- [X] 水印 OCR 链路（watermark_ocr.py + qwen-vl-ocr，httpx 直连；写入 watermark_data 表）
- [X] 前端水印标签（单张/批量结果栏蓝色标签）、Excel 按水印命名
- [X] 生产级日志系统（system_logs 表 + API + 前端日志面板，保留 7 天）
- [X] 生产环境与 git 仓库对齐（20 个孤悬提交推上 GitHub）

### 阶段十：运维加固 + 目录重构 ✅

- [X] MySQL 时区修复（TZ=Asia/Shanghai，历史数据自动换算）
- [X] 端口暴露面收窄（8866/3307 绑 127.0.0.1）
- [X] PaddleOCR 依赖移除（镜像 1.92GB → 946MB）
- [X] 目录重构 backend/ + frontend/，仓库清理（跟踪文件 140 → 82）
- [X] 服务器磁盘回收约 8GB（旧镜像 + 构建缓存）
- [X] 迁移可行性评估（目标系统选型，排除 Windows Server 2012）

### 阶段十一：迁移准备 — 进行中

- [ ] 数据库全量导出（待甲方确认系统后执行）
- [ ] 迁移包打包（A/B/C 方案待定）
- [ ] 目标机导入 + 验证清单

---

## 3. 实施记录 (Implementation Log)

| 编号 | 日期 | 标题 | 说明 | 状态 |
|:-----|:-----|:-----|:-----|:-----|
| 101 | 2026-04-28 | 解决 Docker Hub 镜像拉取 EOF | **发现**: WSL2 环境下 `docker compose up --build` 拉取 `mysql:8.0`(~500MB) 频繁 EOF。**方案**: 用户 Docker Desktop 已配置三个镜像源（DaoCloud / NJU / DockerProxy），分步单独 pull。**实施**: 逐个拉取后启动成功。 | ✅ 已解决 |
| 102 | 2026-04-28 | 确认 npm build 产物提交策略 | **发现**: `dist/` 目录被提交到 git。**决策**: 视为预构建交付策略，当前保持现状。 | ℹ️ 已知 |
| 103 | 2026-04-28 | 记录 ESLint 缓存误提交问题 | **发现**: 远程 commit `e0e97af1` 包含 320+ 个 `node_modules/.cache/eslint/*.json`。**方案**: 在 `.gitignore` 添加 `node_modules/.cache/` 后 `git rm -r --cached` 清理。**实施**: commit `fc8c9b6b` 移除 29453 个不该追踪的文件（含 ESLint 缓存 + dist + node_modules），`.gitignore` 已更新。 | ✅ 已解决 |
| 104 | 2026-05-28 | 升级 Vue 2 到 Vue 3 并切换构建工具 | **实施**: 前端框架从 Vue 2 升级到 Vue 3，构建工具从 webpack (`vue.config.js`) 切换到 Vite (`vite.config.js`)，引入 Ant Design Vue 组件库（Tree 组件用于文件树视图），Lucide Vue 图标库替代 emoji。 | ✅ 已完成 |
| 105 | 2026-05-30 | 修复本地 Docker 服务异常 | **发现**: WSL2 环境 Docker 异常锁死，无法启动任何容器。**方案**: 临时改为本地直接运行（uvicorn + Vite + MySQL 本地安装）。**实施**: 后端 `python app.py`(8866)，前端 `npm run dev`(5173)，MySQL 本地。 | ✅ 已解决（2026-07-13 起三容器部署恢复） |
| 106 | 2026-05-30 | 建立本地替代 Docker 的运行方式 | **实施**: MySQL `ALTER USER 'root'@'localhost'` 设置密码；后端 `source .venv/bin/activate && python app.py`；前端 `npm run dev`。本地运行正常。 | ✅ 已解决 |
| 107 | 2026-05-31 | 修复 Ant Design Tree 白色背景补丁 | **发现**: 批量识别文件树中 `.ant-tree` 根元素有 CSS-in-JS 内联白色背景，与灰色容器不协调。**方案**: `.ant-tree` 及所有内部层（`.ant-tree-list`、`.ant-tree-treenode`、`.ant-tree-node-content-wrapper` 等）全部设为 `background: transparent !important`。**实施**: 修改 `FolderTree.vue`。 | ✅ 已修复 |
| 108 | 2026-05-31 | 修复文件树滚动容器失效 | **发现**: `.folder-tree-wrapper` 设置了 `overflow: hidden`，裁切内容导致无法滚动。**方案**: wrapper 改为 `overflow-y: auto` + scrollbar 样式，外层 `.folder-tree-view` 改为 `overflow: hidden` 避免双滚动条。**实施**: 修改 `FolderTree.vue` + `BatchFolderUploader.vue`。 | ✅ 已修复 |
| 109 | 2026-05-31 | 修复批量识别左右容器高度不一致 | **发现**: 左侧 `.img-card-body` 有 `flex: 1`，右侧没有，高度差 123px。**方案**: `ResultImageCard.vue` 的 `.img-card` 加 `display: flex; flex-direction: column; height: 100%`，`.img-card-body` 加 `flex: 1; min-height: 0`。 | ✅ 已修复 |
| 110 | 2026-05-31 | 修复 Header 分隔线不对齐 | **发现**: 左侧 header（含 3 chip）53px，右侧 46px，分隔线差 7px。**方案**: 三个卡片组件 `.img-card-header` 统一 `min-height: 53px`。**实施**: 修改 `OriginalImageCard.vue`、`ResultImageCard.vue`、`BatchFolderUploader.vue`。 | ✅ 已修复 |
| 111 | 2026-05-31 | 修复空状态容器留白过大 | **发现**: `.dropzone` 和 `.result-zone` 使用 `aspect-ratio: 16/10`，底部留白 116px。**方案**: 去掉 aspect-ratio 改为 `flex: 1` 撑满父容器。**实施**: 修改 `OriginalImageCard.vue` + `ResultImageCard.vue`。 | ✅ 已修复 |
| 112 | 2026-05-31 | 修复警告横幅布局跳动 | **发现**: `v-if` 切换 `.farm-warning-banner` 导致布局重排抖动，Vue `sectionIn` 动画 `both` fill mode 注入 `display: none`。**方案**: 合并两个 banner 为单元素，用 `--hidden` 类控制 `visibility: hidden; opacity: 0`。**实施**: 修改 `FarmInfoCard.vue`。 | ✅ 已修复 |
| 113 | 2026-05-31 | 修复上传/清除图片时页面抖动 | **发现**: 占位符(102px)和图片(100%)尺寸不同引起重排，`sectionIn` 动画 `both` fill mode 阻止 transition。**方案**: `.img-preview` 和 `.dropzone-placeholder` 改为 `position: absolute; inset: 0` 叠放，卡片加 `transform/box-shadow transition`，`sectionIn` 动画只控制 opacity。**实施**: 修改 `OriginalImageCard.vue` + `ResultImageCard.vue`。 | ✅ 已修复 |
| 114 | 2026-06-01 | 部署远程服务器 Docker Compose 栈 | **实施**: 远程服务器 `47.110.63.70` 部署 Docker Compose 栈：MySQL 8.0(3307) + FastAPI(8866) + Nginx(8888)。路径 `/opt/pig-counter/pig-counter/`。Git remote 使用 HTTPS（服务器无 SSH key）。部署命令：`ssh root@47.110.63.70 && cd /opt/pig-counter/pig-counter && git pull && docker compose up -d --build`。 | ✅ 已完成 |
| 115 | 2026-06-01 | 修复远程 MySQL 时区偏移 8 小时 | **发现**: MySQL 容器默认 UTC 时区，`created_at` 时间戳与北京时间差 8 小时。**方案**: `docker-compose.yml` MySQL 服务添加 `TZ=Asia/Shanghai` 环境变量。 | ✅ 已修复 |
| 116 | 2026-06-01 | 配置 Nginx 超时以支持批量识别 | **发现**: 批量识别大文件夹（40+ 张）时请求超过 Nginx 默认 60s 超时，返回 502。**方案**: `nginx.conf` `/api/` location 添加 `proxy_read_timeout 600s`。 | ✅ 已配置 |
| 117 | 2026-06-01 | 修复批量编辑标注号重叠 | **发现**: `saveBoxesToDb` 发送旧 `annotated_image` 给后端，导致标注数字重叠。**方案**: 只发送 `original_image`。 | ✅ 已修复 |
| 118 | 2026-06-01 | 修复批量路径存储残留值 | **发现**: 第二个循环的 `path` 是第一个循环的残留值。**方案**: 改用 `pen["full_path"]`。 | ✅ 已修复 |
| 119 | 2026-06-01 | 修复 Excel 导出使用原图而非标注图 | **发现**: Excel 导出使用原图而非标注图。**方案**: 推理后保存标注图到临时目录，Excel 引用标注图。 | ✅ 已修复 |
| 120 | 2026-06-01 | 修复批量取消后状态残留 | **发现**: `clearBatch` 未清除 store 中的图片状态。**方案**: 添加 `CLEAR_IMAGE` mutation。 | ✅ 已修复 |
| 121 | 2026-06-01 | 修复预测识别数随编辑变化 | **发现**: 编辑标注后预测计数改变。**方案**: 新增 `original_pig_count` 字段，编辑不改变该字段。 | ✅ 已修复 |
| 122 | 2026-06-01 | 修复批量编辑数据不同步 | **发现**: 用 `pen_name` 匹配导致数据错位。**方案**: 改用 `record_id` 匹配，重算 `unit.subtotal` 和 `total_pigs`。 | ✅ 已修复 |
| 123 | 2026-06-01 | 修复批量扫描遮罩被单张遮罩抢走 | **发现**: v-if 分支顺序导致单张遮罩覆盖批量遮罩。**方案**: 调整分支顺序，批量优先。 | ✅ 已修复 |
| 124 | 2026-06-01 | 修复猪场选择跨页面丢失 | **发现**: `selectedFarmId` 仅在组件本地状态，SPA 导航后丢失。**方案**: 迁移到 Vuex store。 | ✅ 已修复 |
| 125 | 2026-06-01 | 移除 OCR 模块从 app.py 导入 | **发现**: `ocr.py` 已不再使用但仍被导入。**方案**: 从 `app.py` 导入中移除 `ocr`，文件保留但不加载。 | ✅ 已完成 |
| 126 | 2026-06-02 | 重新设计统计页面图表 | **实施**: Chart.js 趋势图改为渐变填充 + 十字准线跟随鼠标 + 发光效果。 | ✅ 已完成 |
| 127 | 2026-06-02 | 升级 TopBar 猪场选择器为 Ant Design 风格 | **实施**: Select 组件升级为 Ant Design 风格 Select，猪场名称截断 11 个中文字符 + tooltip 显示全名。 | ✅ 已完成 |
| 128 | 2026-06-02 | 升级日期选择器为 Ant Design 风格 RangePicker | **实施**: 双面板日历日期范围选择器替换原有组件。 | ✅ 已完成 |
| 129 | 2026-06-02 | 清理页面背景为透明 | **实施**: 移除灰色背景和装饰性光晕，仅保留网格线。 | ✅ 已完成 |
| 130 | 2026-06-02 | 替换 Logo 和 favicon 资源文件 | **实施**: 替换 `pig-counter/public/` 下的 favicon.ico 和 Logo 图片资源。 | ✅ 已完成 |
| 131 | 2026-06-02 | 发布 v1.0 并打 Git tag | **实施**: 版本号从 v0.1 改为 v1.0，dev 合并到 main，推送到 GitHub，在提交 `cef7241` 上打 `v1.0` tag。GitHub 自动生成 source code zip/tar.gz。 | ✅ 已完成 |
| 132 | 2026-06-02 | 调整 Nginx client_max_body_size 为 200M | **发现**: 批量识别上传大文件夹时请求体超过默认 50M 限制。**方案**: `nginx.conf` 添加 `client_max_body_size 200m`。 | ✅ 已配置 |
| 133 | 2026-06-05 | Vue 3 Composition API 架构重构 | **实施**: 将 1916 行 God Component `App.vue` 拆分为标准 Vue 3 结构。新建 5 个 API 模块（`api/http.js` 等）、6 个 composables（`useBatch.js` 等）、`views/HomePage.vue` + `StatsPage.vue`、`router/index.js`、8 个 CSS 模块。编辑标注逻辑因深度依赖 `$refs` 保留在 HomePage.vue 内联。 | ✅ 已完成 |
| 134 | 2026-06-05 | 修复重构后 UI 回归：TopBar/猪场/批量/编辑 | **发现**: 架构重构导致顶栏消失、猪场选择器不加载、批量模式不可用、编辑弹窗显示错误图片（张冠李戴）、标注框坐标偏移、双层标注。**方案**: 逐项修复组件迁移丢失的引用和事件绑定，useEdit composable 因不适合提取已回退内联。**实施**: `App.vue` 顶栏迁移、`FarmSelector.vue` 修复、`HomePage.vue` 批量模式按钮/编辑弹窗/坐标逻辑修复。 | ✅ 已修复 |
| 135 | 2026-06-05 | 修复检测明细 hover 高亮延迟 ~1 秒 | **发现**: CSS transition 0.3s 导致 hover 高亮响应慢。**方案**: 减至 0.15s。 | ✅ 已修复 |
| 136 | 2026-06-05 | 原图支持点击放大预览 | **实施**: `OriginalImageCard.vue` 增加点击事件，复用 `ImagePreviewModal.vue` 展示原图全屏预览，预览信息条文字改为黑色并上移 5px。 | ✅ 已完成 |
| 137 | 2026-06-06 | 修复统计页 footer 重复显示 | **发现**: `StatsPage.vue` 自带 footer，同时 `App.vue` 也渲染 `AppFooter`。**方案**: 移除 StatsPage 内置 footer。 | ✅ 已修复 |
| 138 | 2026-06-09 | 性能优化：6 项低风险修复 | **实施**: ① `ResultImageCard` RAF 内存泄漏修复（destroy 时 cancelAnimationFrame）② `hoverBox` watcher 节流 ③ `StatsPage` chart mousemove/mouseleave listener 清理 ④ `timeSeriesData` watch 移除 `deep:true` ⑤ chart.js 按需注册，StatsPage bundle 减少 46KB ⑥ API 层统一使用 `http.js` 共享 axios 实例，移除 3 个重复实例，减少 349 行。 | ✅ 已完成 |
| 139 | 2026-06-09 | 竖屏（9:16）图片支持 — 首次尝试 | **发现**: 竖屏图片编辑标注模式下标注框与猪只位置不对齐，canvas 坐标映射假定横屏。**方案**: 多次迭代后仍有对齐问题，`git reset` 到 `539313ee` 回滚，分支 `feature/portrait-image-support` 保留。**后续**: 2026-06-17 采用前端自动旋转方案完成（见 #143）。 | ✅ 已解决 |
| 140 | 2026-06-10 | 修复批量模式绿色框闪烁 | **发现**: 批量识别完成后切换图片，`loadBatchFullImages` 逐张更新触发 watcher 反复调用 `drawBoxesAnimated()`（30 帧动画），产生频闪。**方案**: 三轮修复——① `onResultImgLoad` 改用 `drawBoxesInstant()` 即时绘制 ② 添加 `batchFullLoading` 标志位，加载期间抑制 watcher，全部加载完后一次性绘制 ③ 移除 `batchImageIndex` 和 `selectedBatchResult` watcher 中的重复 draw 调用，仅保留 `selectedBatchImage` watcher 触发。 | ✅ 已修复 |
| 141 | 2026-06-10 | 预览弹窗统一加载 800px 高清图 | **实施**: 批量模式点击预览时加载高清标注图（800px），预览弹窗统一加载 800px 消除先小后大跳变，单张推理响应标注图也改用 800px 缩略图。 | ✅ 已完成 |
| 142 | 2026-06-10 | 修复单张模式编辑保存后标注数字丢失 | **发现**: 单张模式编辑保存后切换图片，数字标注丢失。**方案**: 修复 `setup()` 中 `batchFullLoading` 返回值缺失导致 Vue warn。 | ✅ 已修复 |
| 143 | 2026-06-17 | 竖屏（9:16）图片支持 — 旋转方案（已回滚） | **问题**: 竖屏图片识别精度低。**方案**: 前端上传时用 `ensureLandscape()` 逆时针旋转 90°。**结果**: 旋转对竖屏-猪头朝右有效，但对高频场景竖屏-猪头朝上反而降低精度（猪被转歪）。已在 #144 回滚。 | ↩️ 已回滚 |
| 144 | 2026-06-17 | 移除竖屏旋转，原图直传 + 修复编辑标注页竖屏显示偏移 | **问题**: ① `ensureLandscape` 对高频场景（竖屏-猪头朝上）有负面效果 ② 编辑标注页竖屏图片不显示/标注框偏移。**原因**: ① 模型对猪头朝上的竖屏图本来识别准确，旋转反而转歪 ② `onEditImgLoad` 用 `img.clientWidth/Height` 作容器参考，竖屏图在 `max-height:60vh` 下渲染尺寸很小，scale 计算过大，图片和 canvas 被 `overflow:hidden` 裁切。**方案**: ① 删除 `ensureLandscape` 和 `loadImage`，恢复原图直传（后端 letterbox 原生支持任意比例）② 改用 `canvas.parentElement.clientWidth/Height`（即 `.edit-canvas-area` 真实尺寸）计算缩放和居中。**规范**: 横屏（猪头朝上）+ 竖屏（猪头朝上）两种拍照形式，已与用户确认。 | ✅ 已完成 |
| 145 | 2026-06-18 | v2.0 体验优化 | **实施**: ① 拍照规范 Popover（真实参考图，竖屏 3/4 等高）② 批量取消中断（`_batchAbortCtrl` + `clearBatch` abort）③ 扫描动画替换为 `a-progress` 圆形进度条 ④ 移除 TopBar 流光进度条 ⑤ 批量完成后按钮"重新识别" ⑥ 进度曲线 `50+49*(1-e^(-t/15))` 渐近不卡死 ⑦ 移除"0 张 0 单元" ⑧ v2.0 发布 | ✅ 已完成 |
| 146 | 2026-07-13 | 接入水印 OCR 并改用 qwen-vl-ocr | **发现**: 甲方需要按栋舍/单元/栏号归档，原有目录结构解析不足以覆盖所有命名方式。**方案**: 新增 `watermark_ocr.py`，用 httpx 直连阿里 DashScope `qwen-vl-ocr` 识别图片左下角水印，结构化结果写入 `watermark_data` 表。**实施**: 单张/批量两条链路都接入，结果栏显示蓝色水印标签，Excel 导出文件名改用水印命名。 | ✅ 已交付 |
| 147 | 2026-07-13 | 建立生产级日志系统 | **发现**: 排查线上问题缺少持久化日志。**方案**: 新增 `system_logs` 表 + `/api/system-logs` 接口 + 前端日志面板，apscheduler 每天 03:00 清理 7 天前记录。**实施**: `mysql_init.sql` 增加建表语句，前端新增 `LogPanel.vue`。 | ✅ 已交付 |
| 148 | 2026-10-21 | 发现 GitHub 仓库与生产严重脱节 | **发现**: 服务器部署目录 git HEAD 停在 6-18 的 `feature/portrait-image-support`，工作区有 21 个文件未提交（+673/−223），而文件哈希与本地 `dev` 完全一致 —— 说明 7 月那次上线是**手工覆盖文件 + 重建镜像**，从未走 git。同时 `ocr.py`、`excel_template_v2.xlsx` 等依赖文件也未入库，只存在于本地与服务器工作区。**方案**: 先把内容对齐仓库（含补入 `watermark_ocr.py`、`excel_template_v2.xlsx`），再从服务器侧归正 `git reset --hard origin/main`。**实施**: 20 个提交推送到 origin/main + origin/dev；服务器切到 `main` 分支并清理 189MB 残留目录。 | ✅ 已解决 |
| 149 | 2026-10-21 | 阻止 .env 密钥进入仓库 | **发现**: 最后一个提交 `5f10547a` 把 `.env`（含 `OCR_API_KEY=sk-...` 与 DB 密码）加入版本管理，若推送将永久留在 GitHub 历史。**方案**: 推送前用 `git reset --mixed HEAD~1` 撤销该提交，恢复 `.gitignore` 忽略 `.env`，本地文件保留。**实施**: `.env` 未进入任何远端分支，`.gitignore` 第 16 行为 `.env`；服务器 `.env` 不受影响。密钥仍建议轮换。 | ✅ 已解决 |
| 150 | 2026-10-21 | 时区缺陷：历史记录与事实不符（**重复踩坑**） | **发现**: 记录 #115（2026-06-01）声称已加 `TZ=Asia/Shanghai`，但 2026-10-21 实测 `docker-compose.yml` 中**没有** TZ，容器时间为 UTC（容器 `14:22` vs 宿主 `22:22`），导致页面时间早 8 小时、「今日数据」日界错到北京时间 08:00。推测该配置在某次 compose 重写或手工同步中丢失，且无人回归验证。**方案**: 重新添加 `TZ=Asia/Shanghai`，并意识到 `created_at` 是 TIMESTAMP（内部存 UTC、读时按会话时区换算），历史数据会自动纠正、无需迁移。**实施**: 修改 `docker-compose.yml` 并 `docker compose up -d mysql`；验证同一记录修复前读 `2026-10-20 13:20:16`、修复后读 `2026-10-20 21:20:16`。**教训**: 配置类修复必须在记录里写明验证命令，否则"改过"≠"生效"。 | ✅ 已修复 |
| 151 | 2026-10-21 | 收窄端口暴露面 | **发现**: backend(8866) 与 mysql(3307) 均绑定 `0.0.0.0`，公网不可达仅靠阿里云安全组，宿主机 iptables 无任何规则（`INPUT` 默认 ACCEPT、`DOCKER-USER` 直接 RETURN）；日志中可见扫描器探测 `/api/.env`、`/api/.git/config`。**方案**: 改为 `127.0.0.1:8866:8866`、`127.0.0.1:3307:3306`；nginx 通过 `pig-count-network` 访问 `backend:8866`，不依赖宿主端口。**实施**: 重建 backend/mysql/nginx 容器；验证公网 8888=200、8866/3307 不可达，站点与静态资源全部 200。 | ✅ 已修复 |
| 152 | 2026-10-21 | 移除 PaddleOCR 依赖，镜像瘦身 51% | **发现**: `ocr.py` 删除后，`paddlepaddle`/`paddleocr`/`dashscope` 在全仓已无任何 import（`watermark_ocr.py` 只用 httpx）。**方案**: 从 `requirements.txt` 移除三项；`cryptography` 保留并加注释（pymysql 连 MySQL 8 `caching_sha2_password` 必需）。**实施**: 重建镜像 1.92GB → 946MB，构建 3 分钟 → 1 分钟；容器内自检 `import paddle` 失败=预期，cv2/numpy/pymysql/openpyxl/httpx 正常，`/api/health` healthy。 | ✅ 已完成 |
| 153 | 2026-10-21 | 目录重构为 backend/ + frontend/ | **发现**: 仓库根散落后端文件 + 前端目录与仓库同名（`pig-counter/pig-counter`），且误提交 52 个 `node_modules/vue-router` 文件、Vue2 时代的根 `package.json`、Vue CLI 残留、与 vite 产物冲突的 `public/index.html`。**方案**: 后端统一入 `backend/`（`build: ./backend`、`.dockerignore` 随之移入），前端改名 `frontend/`，`dist`/`nginx.conf`/`.env` 留仓库根以减少挂载变更；`app.py` 增加读取上级目录 `.env`。**实施**: 验证容器内 `/app/app.py` 就位、无 `/app/pig-counter` 残留、Excel 模板 `/app/excel_template_v2.xlsx` 可被 openpyxl 打开、首页与统计接口正常；跟踪文件 140 → 82。 | ✅ 已完成 |
| 154 | 2026-10-21 | 清理 Windows 下载标记垃圾 | **发现**: 工作区混入 6 个 `*:Zone.Identifier` 文件，以及审计截图、废弃旧模板副本、旧 OCR 验证物料。**方案**: 全部删除，`.gitignore` 增加 `*:Zone.Identifier` 防复发；有信息价值的文档（AGENTS.md、USER_JOURNEY、EXECUTIVE_SUMMARY、KNOWN_ISSUES）转正入库。**实施**: 未跟踪文件 26 → 0。 | ✅ 已完成 |
| 155 | 2026-10-21 | 服务器磁盘回收约 8GB | **发现**: 磁盘使用 83%（31G/40G），累积 6 个旧 backend 镜像（1.9~2.05GB）与大量构建缓存。**方案**: 采用保守清理，只删悬空镜像与构建缓存，保留带 tag 的旧镜像作回滚参照。**实施**: `docker image prune -f`（2.38GB）+ `docker builder prune -f`（5.53GB）；磁盘降至 60%（23G/40G），4 个容器全部正常。 | ✅ 已完成 |
| 156 | 2026-10-21 | 迁移可行性评估：排除 Windows Server 2012 | **发现**: 客户内网新服务器为 Windows Server 2012，且仅提供向日葵远程（无 SSH）。**结论**: Docker Desktop 仅支持 Win10/11；Docker Engine 的 Windows 容器需 Server 2016+；Linux 容器需 WSL2（Server 2019+/Win10 2004+）；唯一出路 Hyper-V 套 Ubuntu VM 又依赖嵌套虚拟化，而该机极可能是虚拟机；原生部署受非 R2 只能 Python 3.8 限制（`numpy==2.2.6` 要求 ≥3.10）。**方案**: 向甲方提出换系统，首选 Ubuntu 22.04 LTS，次选 Windows Server 2022（桌面体验版）+ Hyper-V。**实施**: 结论与依据写入 `docs/MIGRATION_PLAN.md`，含四类迁移对象盘点（镜像/挂载/卷/密钥）、三种打包方案、传输通道与验证清单。 | ✅ 已交付 |
| 157 | 2026-10-21 | 分支与版本治理 | **发现**: GitHub 有 4 个分支，其中 `dev` 与 main 始终是同一提交（每次发版都是 `git branch -f main dev` 后一并推送，从未独立存在）、`feature/box-modify` 已被 main 完全包含、`feature/portrait-image-support` 顶端是重构前的旧结构快照；同时本地存在未推送的 `v3.0` tag，与文档里的 v2.0 版本号矛盾。**方案**: 删除三个冗余分支（远端+本地）、推送 v3.0 tag、把文档版本统一到 v3.0，并记录版本线。**实施**: `git push origin --delete dev feature/box-modify feature/portrait-image-support`；`git push origin v3.0`；README/PROJECT_OVERVIEW/HANDOVER 版本号更新。恢复锚点：portrait=`835edbd7`、box-modify=`2b61a603`、dev=`c2bb0844`。 | ✅ 已完成 |
