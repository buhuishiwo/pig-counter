# DEPLOYMENT_LOG — 智慧猪群识别系统

**规则**: 只追加新 Issue，不回溯修改旧条目。状态列实时反映。

---

## Issue 列表

| # | 日期 | 类别 | 标题 | 状态 |
|---|---|---|---|---|
| 1 | 2026-04-28 | 部署 | Docker Hub 网络不稳定，大镜像拉取 EOF | ✅ 已解决 |
| 2 | 2026-04-28 | 构建 | npm build 产物 (dist/) 已提交到 git | ℹ️ 已知 |
| 3 | 2026-04-28 | 代码 | ESLint 缓存文件误提交（commit e0e97af1） | ⚠️ 待处理 |
| 4 | 2026-05-30 | 部署 | Docker 服务异常，无法启动容器 | ⚠️ 待处理 |
| 5 | 2026-05-30 | 部署 | 本地 MySQL + 后端 + 前端替代 Docker 运行 | ✅ 已解决 |
| 6 | 2026-05-28 | 前端 | Vue 2 → Vue 3 升级（Vite 替代 webpack） | ✅ 已完成 |
| 7 | 2026-05-31 | 前端 | Ant Design Tree 白色背景补丁 | ✅ 已修复 |
| 8 | 2026-05-31 | 前端 | 文件树滚动容器失效 | ✅ 已修复 |
| 9 | 2026-05-31 | 前端 | 批量识别左右容器高度不一致 | ✅ 已修复 |
| 10 | 2026-05-31 | 前端 | Header 分隔线不对齐（chip 撑高 header） | ✅ 已修复 |
| 11 | 2026-05-31 | 前端 | 空状态容器留白过大 | ✅ 已修复 |
| 12 | 2026-05-31 | 前端 | 警告横幅布局跳动（v-if → visibility 占位） | ✅ 已修复 |
| 13 | 2026-05-31 | 前端 | 上传/清除图片时页面抖动 | ✅ 已修复 |

---

## Issue #4 — Docker 服务异常

### 现象

2026-05-30 用户报告 Docker 异常锁死，无法启动任何容器。

### 影响

无法使用 Docker Compose 部署。改为本地直接运行后端（uvicorn）、前端（Vite）、MySQL（本地安装）。

### 解决方案

临时方案：本地直接运行。长期需排查 Docker 异常原因并恢复。

状态：⚠️ 待处理

---

## Issue #5 — 本地替代 Docker 运行

### 方案

```bash
# MySQL
sudo mysql -u root -e "CREATE DATABASE IF NOT EXISTS pig_counter; ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'pig_counterMysql'; FLUSH PRIVILEGES;"

# 后端
cd /home/user/Workspace/PigCount/pig-counter
source .venv/bin/activate
python app.py          # 端口 8866

# 前端
cd /home/user/Workspace/PigCount/pig-counter/pig-counter
npm run dev            # Vite，端口 5173
```

状态：✅ 本地运行正常

---

## Issue #6 — Vue 2 → Vue 3 升级

### 内容

- 前端框架从 Vue 2 升级到 Vue 3
- 构建工具从 webpack (vue.config.js) 切换到 Vite (vite.config.js)
- 引入 Ant Design Vue 组件库（Tree 组件用于文件树视图）
- Lucide Vue 图标库替代 emoji

状态：✅ 已完成

---

## Issue #7 — Ant Design Tree 白色背景补丁

### 现象

批量识别文件树视图中，Ant Design Tree 组件的根元素 `.ant-tree` 有白色背景（CSS-in-JS 内联），与灰色容器不协调，形成"白色补丁"。

### 根因

Ant Design CSS-in-JS 在 `.ant-tree` 根 div 上直接设置 `background: #ffffff`，之前的 CSS 覆盖只处理了内部子元素，漏掉了根元素。

### 修复

`FolderTree.vue`：`.ant-tree` 及所有内部层（`.ant-tree-list`、`.ant-tree-list-holder`、`.ant-tree-list-holder-inner`、`.ant-tree-treenode`、`.ant-tree-node-content-wrapper`）全部设为 `background: transparent !important`。

状态：✅ 已修复

---

## Issue #8 — 文件树滚动容器失效

### 现象

文件树内容溢出时无法滚动。

### 根因

`.folder-tree-wrapper` 设置了 `overflow: hidden`，裁切了内容，滚动事件到不了外层 `.folder-tree-view`。

### 修复

- `FolderTree.vue`：wrapper 改为 `overflow-y: auto` + scrollbar 样式
- `BatchFolderUploader.vue`：外层 `.folder-tree-view` 改为 `overflow: hidden`（避免双滚动条）

状态：✅ 已修复

---

## Issue #9 — 批量识别左右容器高度不一致

### 现象

批量识别模式下，左侧"文件夹"容器和右侧"批量结果"容器的 `.img-card-body` 高度差 123px。

### 根因

左侧 `BatchFolderUploader` 的 `.img-card-body` 有 `flex: 1`，右侧 `ResultImageCard` 没有。

### 修复

`ResultImageCard.vue`：
- `.img-card` 加 `display: flex; flex-direction: column; height: 100%`
- `.img-card-body` 加 `flex: 1; min-height: 0; display: flex; flex-direction: column`
- `.result-zone--fill` 改为 `flex: 1; min-height: 0`

状态：✅ 已修复

---

## Issue #10 — Header 分隔线不对齐

### 现象

单张模式上传图片后，左侧 header（含 3 个 chip）高度 53px，右侧 header（无 chip）高度 46px，分隔线差 7px。

### 修复

三个卡片组件（OriginalImageCard、ResultImageCard、BatchFolderUploader）的 `.img-card-header` 统一加 `min-height: 53px`。

状态：✅ 已修复

---

## Issue #11 — 空状态容器留白过大

### 现象

空状态下，`.dropzone` 和 `.result-zone` 使用 `aspect-ratio: 16/10`，高度不够，底部留白 116px。

### 修复

- `OriginalImageCard.vue`：`.img-card` 加 flex column，`.img-card-body` 加 flex: 1，`.dropzone` 去掉 aspect-ratio 改为 flex: 1
- `ResultImageCard.vue`：`.result-zone` 去掉 aspect-ratio 改为 flex: 1

状态：✅ 已修复

---

## Issue #12 — 警告横幅布局跳动

### 现象

点击清除按钮后，`.farm-warning-banner` 用 `v-if` 切换，导致布局重排抖动。

### 根因

1. `v-if` 从 DOM 添加/移除元素
2. Vue `sectionIn` 动画的 `both` fill mode 注入内联 `display: none`

### 修复

`FarmInfoCard.vue`：
- 合并两个 banner 为单个元素
- 用 `:class="{ 'farm-warning-banner--hidden': selectedFarmId && hasImage }"` 控制可见性
- `--hidden` 类：`display: flex !important; visibility: hidden; opacity: 0; pointer-events: none`

状态：✅ 已修复

---

## Issue #13 — 上传/清除图片时页面抖动

### 现象

单张模式上传图片后，dropzone 内容切换导致布局跳动；清除时也出现抖动和画面闪跳。

### 根因

1. 占位符（102px）和图片（100%）尺寸不同，`v-if` 切换时引起布局重排
2. `.floating` 类的 `transform: translateY(-2px)` 没有过渡动画
3. `sectionIn` 动画的 `both` fill mode 锁定 `transform: none`，阻止 transition 生效

### 修复

`OriginalImageCard.vue`：
- `.img-preview` 和 `.dropzone-placeholder` 改为 `position: absolute; inset: 0`（叠放不影响布局）
- `.img-card` 加 `transition: transform 0.3s ease, box-shadow 0.3s ease`
- `sectionIn` 动画只控制 opacity，移除 transform

`ResultImageCard.vue`：同上处理

状态：✅ 已修复

---

## Issue #1 — Docker Hub 网络不稳定

### 现象

WSL2 环境下 `docker compose up --build` 拉取 `mysql:8.0`（~500MB）频繁 EOF。

### 解决方案

用户 Docker Desktop 已配置三个镜像源（DaoCloud / NJU / DockerProxy），分步单独 pull 后启动成功。

状态：✅ 已解决

---

## Issue #2 — npm build 产物已提交 git

### 现象

`dist/` 目录被提交到 git，视为预构建交付策略，当前保持现状。

状态：ℹ️ 已知

---

## Issue #3 — ESLint 缓存文件误提交

### 现象

远程 commit `e0e97af1` 包含 320+ 个 `node_modules/.cache/eslint/*.json`。

### 修复建议

1. `pig-counter/.gitignore` 添加 `node_modules/.cache/`
2. `git rm -r --cached pig-counter/node_modules/.cache/`
3. 新 commit 提交变更

状态：⚠️ 待处理
