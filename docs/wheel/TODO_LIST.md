# 待办任务清单 (TODO List) — 智慧猪群识别系统

**最后更新**: 2026-10-21
**状态**: 🟡 v2.0 稳定运行中 — P6 迁移准备：等待甲方确认目标操作系统

---

## 1. 总体进度

| 阶段 | 里程碑 | 状态 | 进度 |
|:-----|:-------|:-----|:-----|
| P0 核心功能 | 单张/批量识别、Excel 导出、统计页面、猪场管理 | ✅ 已完成 | 100% |
| P1 UI 精调 + Bug 修复 | 批量标注全流程、Ant Design 组件、统计页重设计 | ✅ 已完成 | 100% |
| P2 远程部署 | Docker Compose 部署 47.110.63.70、MySQL 时区、Nginx 超时 | ✅ 已完成 | 100% |
| P3 架构重构 + 性能优化 | Vue 3 Composition API 拆分、6 项性能修复、闪烁修复 | ✅ 已完成 | 100% |
| P4 竖屏图片支持 | 9:16 图片上传检测标注全流程 | ✅ 已完成 | 100% |
| P4.5 v2.0 体验优化 | Popover、取消中断、进度条重构、渐近曲线 | ✅ 已完成 | 100% |
| P5 技术债务清理 | Docker 已恢复、ESLint 已清；剩 app.py 拆分、Vuex 持久化 | 🟢 进行中 | 50% |
| P5.5 生产化（2026-07） | 水印 OCR 链路、system_logs 日志系统、三容器正式部署 | ✅ 已完成 | 100% |
| P5.6 运维加固（2026-10） | 时区修复、端口收窄、paddle 依赖移除、目录重构、仓库清理 | ✅ 已完成 | 100% |
| P6 迁移准备 | 目标系统选型、迁移方案、数据导出与打包 | 🟡 进行中 | 30% |
| P7 后续扩展 | 框编辑、报表模板定制 | ⬜ 待执行 | 0% |

---

## 2. P5 — 技术债务清理

> Task 3（Docker 部署恢复）、Task 4（ESLint 缓存清理）已完成，记录已移入 §7 历史区。

- [ ] **Task 5 — app.py 拆分**
  验收：后端逻辑拆为 `routes/`、`services/`、`models/` 三个模块，`python backend/app.py` 启动无报错，`/api/health`、`/api/detection-stats`、`/api/batch/regenerate-excel` 全部返回正常
  文件：backend/app.py（75KB）, backend/routes/, backend/services/, backend/models/

- [ ] **Task 6 — Vuex 持久化**
  验收：刷新页面后猪场选择不丢失，安装 `vuex-persistedstate` 插件并配置
  文件：frontend/src/store/index.js

---

## 3. 技术债务

| 项 | 说明 | 优先级 |
|:---|:-----|:-------|
| 数据库无任何备份 | 2500 行 + 655MB 图片仅存于 Docker 命名卷 `pig-counter_mysql_data` | P0 |
| `OCR_API_KEY` 未轮换 | 明文存于服务器 `.env` 与容器环境变量 | P0 |
| `app.py` 单文件 75KB | 含全部后端逻辑，考虑拆为 routes/services/models | P3 |
| 推理加锁串行 | `_MODEL_LOCK` 保护 forward，批量多图串行，限制吞吐 | P3 |
| Vuex 无持久化 | 猪场选择刷新丢失（SPA 内导航正常） | P2 |
| base64 内存膨胀 | 所有图片以 base64 存储在 Vuex，大批量时内存压力大 | P2 |
| git 历史偏大（72MB） | 历史含早期 node_modules/dist，可用 `git filter-repo` 清理（会改写 SHA） | P3 |
| `_build_batch_excel` 无参数校验 | 前端 payload 缺字段时返回 500 而非 400 | P3 |
| ant-design-vue 全量引入 | 未 tree-shaking，bundle 偏大 | P3 |
| App.vue / HomePage.vue 重复逻辑 | `runSingleAnalysis` 在两处存在 | P3 |
| StatsPage API 无 AbortController | 快速切换筛选条件时可能有竞态 | P3 |

---

## 4. P6 — 迁移准备（当前重点，详见 `docs/MIGRATION_PLAN.md`）

- [ ] **Task 11 — 确认目标操作系统**
  验收：甲方书面确认目标系统为 Ubuntu 22.04 LTS 或 Windows Server 2022（含 Hyper-V 许可），记录进 MIGRATION_PLAN.md 第十节
  依赖：甲方 IT 回复

- [ ] **Task 12 — 数据库全量导出**
  验收：`mysqldump` 生成文件可被 `mysql < dump` 成功导入；导入后 `select count(*) from detection_records` = 2500，`system_logs` = 488
  预计体积：约 500MB（gzip 后）

- [ ] **Task 13 — 迁移包打包**
  验收：目标机 `docker load` + `docker compose up -d` 后，`/api/health` 返回 healthy、首页 200、`/api/detection-stats` 总数 2500，无手工补步骤

- [ ] **Task 14 — 迁移后验收**
  验收：按 MIGRATION_PLAN.md 第九节清单逐项通过，含 `select now()` 为北京时间、前端完整跑通「上传→识别→水印标签→Excel 下载」

- [ ] **Task 15 — 新旧环境切换与旧机下线**
  验收：新机连续稳定运行 7 天，旧机 47.110.63.70 停止容器并保留数据卷 30 天

---

## 5. P7 — 后续扩展（不阻塞当前）

- [ ] **Task 7 — 手动增删检测框**
  验收：Canvas 交互可点击高亮/删除检测框，拖拽可添加新框，编辑结果保存到 `detection_records.boxes`
  依赖：boxes 字段已存在（JSON）

- [X] ~~**Task 8 — OCR 大规模验证**~~
  作废：旧 PaddleOCR 混合架构已移除（`ocr.py` 删除，相关依赖移出 requirements），现仅走 qwen-vl-ocr

- [ ] **Task 9 — 报表格式定制**
  验收：按甲方新模板导出 Excel，格式与样式完全对齐
  依赖：甲方提供新模板

- [X] ~~**Task 10 — README.md 更新**~~
  完成：2026-10-21 按实测重写（部署流程、端口绑定、时区、.env 机制、新增文档索引）

---

## 6. 任务依赖图

```
P5.5 ✅ 生产化（2026-07，水印 OCR + 日志系统 + 三容器部署）
P5.6 ✅ 运维加固（2026-10，时区/端口/依赖/目录/仓库）

P6 Task 11 (确认目标系统) ← 阻塞：等甲方 IT 回复
P6 Task 12 (数据库导出) ← 独立，随时可做（只读操作）
P6 Task 13 (迁移包打包) ← 依赖：Task 11 确定系统
P6 Task 14 (迁移后验收) ← 依赖：Task 12 + Task 13
P6 Task 15 (新旧切换)  ← 依赖：Task 14 通过

P5 Task 5 (app.py 拆分) ← 独立，可与迁移并行
P5 Task 6 (Vuex 持久化) ← 独立，可与迁移并行

P7 Task 7 (框编辑) ← 依赖 boxes 字段，已就绪
P7 Task 9 (报表模板) ← 阻塞：等甲方提供
```

---

## 7. 历史完成记录

### P4 — 竖屏（9:16）图片支持 ✅ 100%

- [X] Task 1 — 竖屏图片识别方案
  最终方案：移除 `ensureLandscape` 旋转，原图直传后端，后端 letterbox 原生支持任意比例
  适用范围：横屏（猪头朝上）+ 竖屏（猪头朝上），已与用户确认拍照规范
  文件：`frontend/src/utils/imageUtils.js`（删除 `ensureLandscape`/`loadImage`），`useDetection.js`，`useBatch.js`

- [X] Task 2 — 编辑标注页竖屏图片显示修复
  问题：竖屏图打开编辑标注页时图片不显示、标注框偏移
  原因：`onEditImgLoad` 用 `img.clientWidth` 作容器参考，竖屏图渲染尺寸小导致 scale 计算错误
  修复：改用 `canvas.parentElement.clientWidth/Height`（`.edit-canvas-area` 真实尺寸）
  文件：`HomePage.vue`
  验证：竖屏图单张识别 + 编辑标注全流程通过，标注框位置准确
  依赖：Task 1 ✅

### P5 — 部分完成（2026-10-21）

- [X] Task 3 — Docker 部署恢复：2026-07-13 起生产为三容器正式部署，运行至今（本地 WSL2 的 Docker Desktop 仍异常，不影响交付）
- [X] Task 4 — ESLint 缓存清理：commit `fc8c9b6b` 移除 29453 个不该追踪的文件，`.gitignore` 已加 `node_modules/.cache/`

### P5.6 — 运维加固（2026-10-21）✅ 100%

- [X] mysql 容器补 `TZ=Asia/Shanghai`，修正时间早 8 小时与「今日」日界错位
- [X] backend/mysql 端口改绑 `127.0.0.1`，公网仅暴露 nginx 8888
- [X] 移除 `ocr.py` + `paddlepaddle`/`paddleocr`/`dashscope`，backend 镜像 1.92GB → 946MB
- [X] 目录重构为 `backend/` + `frontend/`，清理误提交的 node_modules 与 Vue CLI 残留（跟踪文件 140 → 82）
- [X] 仓库与生产对齐：20 个仅存在于服务器工作区的提交推上 GitHub，`.env` 从提交中摘除
- [X] 全部文档同步（新增 MIGRATION_PLAN.md，refs 标注历史存档）
- [X] 清理 Windows `Zone.Identifier` 垃圾并纳入 .gitignore

### P5.5 — 生产化（2026-07-13）✅ 100%

- [X] 水印 OCR 链路（watermark_ocr.py + qwen-vl-ocr，写入 watermark_data 表）
- [X] 生产级日志系统（system_logs 表 + API + 前端面板，7 天自动清理）
- [X] 生产转换为三容器 Docker 部署并稳定运行

### P0 — 核心功能 ✅ 100%

- [X] Vue 2 → Vue 3 升级（Vite 替代 webpack）
- [X] 单张识别（ONNX 检测 → 标注图 + 计数）
- [X] 批量识别（文件夹上传 + 目录结构解析 + ONNX 检测 + 数据库存储）
- [X] Excel 模板导出（按甲方模板，承储单位固定，文件夹名称自动拆解，图片嵌入）
- [X] 统计页面（Chart.js 趋势图 + 日期/猪场筛选 + 日期选择器）
- [X] Toast 通知规范（参考 Ant Design notification，不 pause on hover）
- [X] 状态机优化（未选猪场时按钮置灰，提示语统一）
- [X] 批量表格合计栏（常驻显示，位置修复）

### P1 — UI 精调 + Bug 修复 ✅ 100%

- [X] Ant Design Tree 背景色修复（根元素及内部层 transparent）
- [X] 文件树滚动容器（wrapper overflow-y: auto）
- [X] 批量识别左右容器对齐（img-card-body + result-zone flex: 1）
- [X] 推理耗时迁移（从 meta-bar 到检测明细 pills）
- [X] 原图 meta 信息迁移（文件名/大小/尺寸拆分到 header chip）
- [X] Header 高度统一（min-height: 53px）
- [X] 空状态容器撑满（去掉 aspect-ratio，flex: 1）
- [X] 警告横幅布局稳定（v-if → visibility: hidden 占位）
- [X] 上传/清除平滑过渡（绝对定位叠放 + transform transition）
- [X] 批量编辑标注号重叠修复（saveBoxesToDb 只发 original_image）
- [X] 批量路径存储修复（使用 pen["full_path"]）
- [X] Excel 导出使用标注图（非原图）
- [X] 批量取消恢复先前结果
- [X] 预测计数修复（original_pig_count 字段）
- [X] 批量数据同步（record_id 匹配，重算合计）
- [X] 批量扫描覆盖层优先级修复
- [X] 猪场选择跨页面持久化（Vuex store）
- [X] OCR 模块从 imports 移除
- [X] 统计页面重设计（Chart.js 渐变/十字准线/发光效果）
- [X] Ant Design 风格 Select + RangePicker
- [X] 猪场名截断（11 字符）+ tooltip
- [X] 背景改为透明（仅网格线）
- [X] Logo 和 favicon 更新

### P2 — 远程部署 ✅ 100%

- [X] 远程服务器 Docker Compose 部署（47.110.63.70）
- [X] MySQL 时区修复（TZ=Asia/Shanghai）
- [X] Nginx proxy_read_timeout 600s
- [X] v1.0 发布 + Git tag（cef7241）

### P3 — 架构重构 + 性能优化 ✅ 100%

- [X] Vue 3 Composition API 架构重构（App.vue 1916 行拆分为 api/composables/views/components/styles/router）
- [X] 重构后 UI 回归修复（顶栏、猪场选择器、批量模式、编辑弹窗、坐标偏移、双层标注）
- [X] 检测明细 hover 高亮延迟修复（0.3s → 0.15s）
- [X] 原图点击放大预览
- [X] 统计页 footer 重复显示修复
- [X] 性能优化 6 项（RAF 泄漏、watcher 节流、chart.js tree-shaking、API 层统一等）
- [X] 批量模式绿色框闪烁修复（drawBoxesInstant + batchFullLoading 抑制 + 去重 draw 调用）
- [X] 预览弹窗统一 800px 高清图
- [X] 单张模式编辑保存后标注数字丢失修复

### 架构决策

- [X] Vue 3 + Vite 替代 Vue 2 + webpack（2026-05-28）
- [X] 目录结构替代 OCR 身份识别（2026-05-13 甲方会议决定）
- [X] 预构建交付策略：dist/ 提交到 git（2026-04-28）
- [X] Composition API 架构重构（2026-06-05）
- [X] 编辑标注逻辑保留在 HomePage.vue 内联，不提取 composable（2026-06-05）
- [X] 竖屏图片采用原图直传方案（移除 `ensureLandscape`，2026-06-17 确定）
