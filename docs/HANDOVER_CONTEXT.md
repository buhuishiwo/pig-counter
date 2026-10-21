# HANDOVER_CONTEXT — 智慧猪群识别系统

**最后更新**: 2026-10-21
**维护者**: User + AI Agent

---

## 项目概要

AI 猪只计数系统 — 上传猪舍图片 → ONNX 模型检测 → 标注图 + 计数 + 统计看板。支持单张识别和批量文件夹识别，含 Excel 模板导出。

仓库：`https://github.com/buhuishiwo/pig-counter.git`
本地路径：`/home/user/Workspace/PigCount/pig-counter`
原型路径：`/home/user/Workspace/axhub-make-project/src/prototypes/pigcount-app/`

---

## 当前阶段 / 进度

- **阶段**: 系统稳定运行中；**正在评估迁移到客户内网新服务器**（详见 `MIGRATION_PLAN.md`）
- **环境**: Docker 三容器已在生产运行（nginx :8888 / backend :8866 / mysql :3307）
- **模型**: `pig_count.onnx` 已加载就绪（容器内 `/app/model/`）
- **Git**: 部署分支 `main`，本地开发分支 `dev`，两者与 origin 保持同步
- **代码结构**: 2026-10-21 起已重构为 `backend/` + `frontend/` 两目录
- **前端框架**: Vue 3 + Vite（Vue 2 已于 2026-05-28 升级）

---

## 2026-07 ~ 2026-10 进展（本阶段总结）

1. ✅ **水印 OCR 链路** — `watermark_ocr.py` 接入 qwen-vl-ocr，栋舍/单元/栏号写入 `watermark_data` 表
2. ✅ **生产级日志** — `system_logs` 表 + API + 前端日志面板，保留 7 天
3. ✅ **时区修复** — mysql 容器补 `TZ=Asia/Shanghai`，修正时间早 8 小时与「今日」日界错位
4. ✅ **端口收窄** — backend/mysql 改绑 `127.0.0.1`，公网仅开 8888
5. ✅ **PaddleOCR 依赖移除** — `ocr.py` 删除，镜像 1.92GB → 946MB
6. ✅ **目录重构 + 仓库清理** — `backend/` + `frontend/`；移除误提交的 `node_modules/`、Vue CLI 残留
7. ⏳ **待办** — 迁移到新服务器、数据库备份、`OCR_API_KEY` 轮换

---

## 近期完成事项（2026-05-28 ~ 2026-05-31）

### 核心功能

1. ✅ **Vue 2 → Vue 3 升级** — 前端框架升级完成
2. ✅ **Excel 模板导出** — 按甲方「活体生猪盘点表」模板导出，承储单位固定为「乐清市华统牧业有限公司」
   - 文件夹名称自动拆解：栋舍/楼层/单元/栏舍号
   - 图片嵌入单元格（quality=100）
   - 底栏统计行：E-H 列合并显示"累计："，I 列总数
3. ✅ **批量识别** — 文件夹上传 + 目录结构解析 + ONNX 检测 + 数据库存储
4. ✅ **统计页面筛选** — 日期/猪场筛选 + 日期选择器
5. ✅ **Toast 通知规范统一** — 参考 Ant Design notification，不 pause on hover，自动消失
6. ✅ **状态机优化** — 未选择猪场时单张/批量按钮置灰

### UI 精调（2026-05-31 本次 Session）

7. ✅ **Ant Design Tree 背景色修复** — 根元素 `.ant-tree` 及所有内部层设为 transparent，消除白色补丁
8. ✅ **文件树滚动容器修复** — wrapper 改为 `overflow-y: auto`，外层 `overflow: hidden`
9. ✅ **批量识别左右容器对齐** — `.img-card-body` + `.result-zone` 加 flex: 1 撑满
10. ✅ **推理耗时迁移** — 从标注结果卡片的 meta-bar 迁移到检测明细的 pills（第二位）
11. ✅ **原图 meta 信息迁移** — 文件名/尺寸/大小从 meta-bar 迁移到 header 右侧 chip
12. ✅ **Header 高度统一** — 三个卡片组件 header 统一 `min-height: 53px`，分隔线始终对齐
13. ✅ **空状态容器撑满** — dropzone 和 result-zone 去掉 aspect-ratio，改为 flex: 1 撑满父容器
14. ✅ **警告横幅布局稳定** — 从 v-if 改为始终渲染 + visibility: hidden 占位，用 display: flex !important 覆盖动画内联样式
15. ✅ **上传/清除平滑过渡** — 占位符和图片改为绝对定位叠放，卡片 transform 加 transition，sectionIn 动画只控制 opacity

---

## 原型迁移状态

原型（React + Ant Design）→ 开发分支（Vue 3）的迁移：

- 基本框架已迁移
- 状态机流程已对齐
- Lucide 图标已替换 emoji
- 批量识别视图已迁移（含 Ant Design Tree 文件树）
- Excel 导出已完成
- 用户反馈质量需持续改进，每次改动需用 Playwright E2E + 图像理解验证

---

## 待处理事项

1. 文件夹结构视图中文件树的根节点固定悬浮（用户暂不需要，延后）
2. 文件夹结构虚线改实线
3. 导出按钮（返回目录/重新上传/下载Excel）尺寸统一
4. 批量识别完成后「检测明细」跟随当前标注结果图
5. Docker 服务恢复后需要重新验证全栈部署
6. ESLint 缓存清理（git rm --cached node_modules/.cache）

---

## 下次第一件事

根据用户指示继续推进原型迁移或 UI 精调。

---

## 留给下次的坑

1. 生产已改为 Docker 三容器部署（自 2026-07），Docker 异常不再存在；本地仍可直接起后端调试
2. ESLint 缓存 / node_modules 入库已清理（2026-10 目录重构）
3. 前端 Vue 3 升级后部分旧组件可能还有兼容性问题，需持续观察
4. 原型迁移质量需用 Playwright + 图像理解持续验证
5. 数据库无备份机制，且 `OCR_API_KEY` 未轮换（迁移前建议一并处理，见 `MIGRATION_PLAN.md`）
6. git 历史中仍含早期 node_modules/dist，`.git` 约 72MB（待评估 `git filter-repo`）

---

## 启动 / 测试速查

```bash
# 后端（依赖仓库根的 .env，app.py 会依次读 backend/.env 与仓库根 .env）
cd /home/user/Workspace/PigCount/pig-counter/backend
python app.py          # 端口 8866

# 前端
cd /home/user/Workspace/PigCount/pig-counter/frontend
npm run dev            # Vite，端口 5173

# 生产（Docker，服务器上）
cd /opt/pig-counter/pig-counter && docker compose ps

# 健康检查
curl http://localhost:8866/api/health

# 访问
# Web UI:   http://localhost:5173/
# API Docs: http://localhost:8866/docs
# 统计页:   http://localhost:5173/stats
```

---

## 测试数据

批量识别测试文件夹：`/mnt/d/数猪系统/育肥C区2楼1-4单元/`
- 4 个单元（C区2楼1-4单元），共 43 张图片
- 结构：`批次文件夹/单元子文件夹/栏舍照片.jpg`

---

## Session 历史

### 2026-05-31

- 从崩溃会话 f66620cc 完整接管上下文（2661 条消息，20MB）
- Ant Design Tree 背景色：根元素 + 所有内部层设 transparent
- 文件树滚动容器：wrapper overflow-y: auto
- 批量识别左右容器对齐：img-card-body + result-zone flex: 1
- 推理耗时从 meta-bar 迁移到 detection pills
- 原图 meta 信息从 body 迁移到 header chip
- Header min-height: 53px 统一对齐
- 空状态容器撑满（去掉 aspect-ratio）
- 警告横幅布局稳定（visibility: hidden + display: flex !important）
- 上传/清除平滑过渡（绝对定位叠放 + transform transition）

### 2026-05-28 ~ 2026-05-30

- Vue 2 → Vue 3 升级
- 原型迁移（部分）
- Excel 模板导出完成
- 批量识别 + 数据库存储
- 统计页面筛选
- Toast 通知规范统一
- 状态机优化
- 批量表格合计栏修复
- 文件树结构视图（Ant Design Tree）

### 2026-05-13

- 甲方会议决定：目录结构替代 OCR 身份识别
- 审查参考数据，对齐三层目录结构
- 明确落地形态：前端 webkitdirectory → 后端解析路径 → ONNX 检测 → Excel

### 2026-05-01

- OCR Phase 4 端到端完成
- Docker 镜像 2.05GB 验证通过
