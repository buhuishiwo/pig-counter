# HANDOVER_CONTEXT — 智慧猪群识别系统

**最后更新**: 2026-05-31
**维护者**: User + AI Agent

---

## 项目概要

AI 猪只计数系统 — 上传猪舍图片 → ONNX 模型检测 → 标注图 + 计数 + 统计看板。支持单张识别和批量文件夹识别，含 Excel 模板导出。

仓库：`https://github.com/buhuishiwo/pig-counter.git`
本地路径：`/home/user/Workspace/PigCount/pig-counter`
原型路径：`/home/user/Workspace/axhub-make-project/src/prototypes/pigcount-app/`

---

## 当前阶段 / 进度

- **阶段**: 前端 UI 精调 + 原型迁移收尾
- **环境**: Docker 异常，本地直接运行（后端 uvicorn :8866，前端 Vite :5173，MySQL 本地）
- **模型**: `pig_count.onnx` 已加载就绪
- **Git**: `dev` 分支
- **前端框架**: 已从 Vue 2 升级到 **Vue 3 + Vite**

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

1. Docker 当前不可用，本地运行一切正常，但部署时需恢复 Docker
2. ESLint 缓存已提交 git（commit `e0e97af1`），需要加 `.gitignore` 和清理
3. 前端 Vue 3 升级后部分旧组件可能还有兼容性问题，需持续观察
4. 原型迁移质量需用 Playwright + 图像理解持续验证

---

## 启动 / 测试速查

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
