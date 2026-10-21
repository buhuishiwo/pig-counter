# TODO_LIST — 智慧猪群识别系统

**最后更新**: 2026-10-21

---

## 需求全景

```
用户需求                          系统改动
─────────────────────────────────────────────────────
单张识别 ──→  ONNX 检测 ──→ 标注图 + 计数 ──→ 统计看板
批量识别 ──→  文件夹上传 ──→ 目录解析 + 检测 ──→ Excel 导出
                                                │
原型迁移 ──→  React 原型 → Vue 3 开发 ──────────┘
UI 精调 ──→  布局对齐 + 动画平滑 + 状态机完善
```

> **已完成的核心链路**：单张识别、批量识别、Excel 导出、统计页面、猪场管理
> **当前重点**：原型迁移收尾 + UI 精调 + 用户体验优化

---

## 已完成任务 ✅

### 核心功能

- [x] **Vue 2 → Vue 3 升级** — 前端框架升级，Vite 替代 webpack
- [x] **批量识别** — 文件夹上传 + 目录结构解析 + ONNX 检测 + 数据库存储
- [x] **Excel 模板导出** — 按甲方模板导出，承储单位固定，文件夹名称自动拆解，图片嵌入
- [x] **统计页面** — 日期/猪场筛选 + 日期选择器
- [x] **Toast 通知规范** — 参考 Ant Design notification，不 pause on hover
- [x] **状态机优化** — 未选猪场时按钮置灰，提示语统一
- [x] **批量表格合计栏** — 常驻显示，位置修复

### UI 精调（2026-05-31）

- [x] **Ant Design Tree 背景色** — 根元素及内部层 transparent，消除白色补丁
- [x] **文件树滚动容器** — wrapper overflow-y: auto，外层 overflow: hidden
- [x] **批量识别容器对齐** — img-card-body + result-zone flex: 1
- [x] **推理耗时迁移** — 从 meta-bar 到检测明细 pills（第二位）
- [x] **原图 meta 迁移** — 从 body meta-bar 到 header chip（文件名/大小/尺寸拆分）
- [x] **Header 高度统一** — min-height: 53px，分隔线始终对齐
- [x] **空状态容器撑满** — dropzone/result-zone 去掉 aspect-ratio，flex: 1
- [x] **警告横幅布局稳定** — v-if → visibility: hidden 占位 + display: flex !important
- [x] **上传/清除平滑过渡** — 绝对定位叠放 + transform transition + opacity-only sectionIn

---

## 待处理任务

### 优先级 P0（迁移阻塞项）

- [ ] **迁移到客户内网新服务器** — 目标系统待甲方确认（可选 Ubuntu 22.04 LTS 或 Windows Server 2022），详见 `MIGRATION_PLAN.md`
- [ ] **数据库备份** — 目前无任何 dump，2500 条记录 + 655MB 历史图片仅存于 Docker 命名卷
- [ ] **`OCR_API_KEY` 轮换** — 明文存于服务器 `.env` 与容器环境变量

### 优先级 P1（运维健壮性）

- [x] ~~**Docker 服务恢复**~~ — 已于 2026-07 起用三容器正式部署，运行正常
- [x] ~~**ESLint 缓存清理**~~ — 已于 2026-10 目录重构中一并清理（`node_modules/` 已全部出库）
- [x] ~~**误提交的 node_modules/vue-router**~~ — 已 `git rm --cached` 并从工作区删除

### 优先级 P2（功能完善）

- [ ] **文件夹结构虚线改实线** — 文件树视图中连接线从虚线改为实线
  - 文件：BatchFolderUploader.vue 或 FolderTree.vue
- [ ] **导出按钮尺寸统一** — 返回目录/重新上传/下载Excel 按钮大小规范统一
  - 文件：BatchFolderUploader.vue
- [ ] **批量识别检测明细** — 批量识别完成后「检测明细」跟随当前标注结果图
  - 文件：App.vue, DetectionDetailTable.vue
- [ ] **detection_records 存检测框** — 当前只存缩略图，不存 detection box 坐标
  - 文件：app.py, mysql_init.sql

### 优先级 P3（技术债务）

- [ ] **backend/app.py 拆分** — 单文件 75KB，考虑拆成 routes/ services/ models/
- [ ] **前端 API 层统一** — detectionApi.js 裸用 axios，与其他 API 层不一致
- [x] ~~**README.md 更新**~~ — 已按实测重写（部署流程、端口、时区、.env 机制）
- [x] ~~**node_modules 体积**~~ — 已从仓库移除（`.venv`/`node_modules` 均已在 .gitignore）
- [ ] **git 历史瘦身** — 历史中仍含早期 node_modules/dist（`.git` 约 72MB），可用 `git filter-repo` 处理，但会改写 SHA

### 优先级 P4（后续扩展）

- [ ] **手动增删检测框** — Canvas 交互，点击框高亮/删除，拖拽添加新框
  - 依赖：detection_records 先存 boxes
- [x] ~~**OCR 大规模验证**~~ — 旧 PaddleOCR 混合架构已废弃（ocr.py 已移除），现走 watermark_ocr.py + qwen-vl-ocr
- [ ] **报表格式定制** — 等待甲方提供新模板

---

## 开发顺序

```
当前 ──→ P0: 迁移新服务器 + 数据库备份 + 密钥轮换
         │
         ├─→ P2: 文件树虚线 + 按钮统一 + 检测明细 + boxes 存储
         │
         ├─→ P3: app.py 拆分 + API 层统一 + 历史瘦身
         │
         └─→ P4: 框编辑 + 报表模板定制
```

---

## 技术债务

| 项 | 说明 | 优先级 |
|---|---|---|
| `backend/app.py` 单文件 75KB | 多轮改造后更臃肿，考虑拆分 | P3 |
| 推理加锁串行 | `_MODEL_LOCK` 保护 forward，批量多图串行 | P3 |
| 前端 API 层不统一 | `detectionApi.js` 裸用 axios | P3 |
| git 历史偏大 | 历史含早期 node_modules/dist，`.git` 约 72MB | P3 |
| detection_records 不存 boxes | 只存缩略图与 boxes JSON | P2 |
| 数据库无备份 | 数据仅存于 Docker 命名卷 | P0 |
| `_build_batch_excel` 无参数校验 | 前端 payload 缺字段时直接 500 而非 400 | P3 |
