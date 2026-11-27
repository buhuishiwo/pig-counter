# 软件环境与配置说明

> 依据：**云过渡服务器 `47.110.63.70` 实测为准**（2026-11-26 采集），代码行数按仓库源码统计。
> 同节内如与生产内网（客户 Ubuntu 22.04）不同，单独注明。

---

## 1. 软件开发硬件环境

| 项 | 实测值 |
|:--|:--|
| 开发机 | 个人 PC（Windows 11，构建与调试在 WSL2 内进行） |
| CPU | 8 逻辑核 |
| 内存 | 8 GB（WSL2 分配） |
| 磁盘 | 1 TB（WSL2 可用 907 GB） |
| 显示分辨率 | 不低于 1440×900 |

> 采集方式：WSL2 内 `nproc` / `/proc/meminfo` / `df -h /`；Windows 版本 `cmd /c ver` → 10.0.26200（Windows 11）。

---

## 2. 软件运行硬件环境

### 2.1 服务器（要求）

| 项 | 要求 |
|:--|:--|
| CPU | 4 核及以上（支持虚拟化，若部署在虚拟机需宿主开启嵌套虚拟化） |
| 内存 | 8 GB 及以上 |
| 硬盘 | 120 GB 及以上（业务图片以 base64 存库，随记录量增长） |
| 网络 | 固定内网 IP，对客户端开放 8888 端口 |

### 2.2 服务器（实际）

| 环境 | 配置 |
|:--|:--|
| **云过渡（标准）** | Intel Xeon Platinum，**2 vCPU** / **1.8 GB** 内存 / **40 GB** 磁盘 —— 仅用于功能验证与演示，不满足上表的正式要求 |
| 生产内网 | Ubuntu 22.04 虚拟机（Hyper-V）：**5.4 GB** 内存 / **124 GB** 磁盘 |

### 2.3 客户端

| 项 | 要求 |
|:--|:--|
| 设备 | 普通 PC 或笔记本电脑 |
| 分辨率 | 不低于 1440×900 |
| 浏览器 | Chrome 或 Edge 最新版 |

---

## 3. 软件开发操作系统

| 项 | 值 |
|:--|:--|
| 宿主系统 | Windows 11（10.0.26200） |
| 开发/构建环境 | WSL2 · Ubuntu 22.04.2 LTS（x86_64，内核 6.6.x-microsoft-standard-WSL2） |
| 容器环境 | Docker Desktop（WSL2 后端），用于本地三容器联调 |

> 注：云过渡服务器的操作系统为 **Alibaba Cloud Linux 3.2104 U12.3（OpenAnolis）**，不是开发操作系统，仅作为部署目标。

---

## 4. 软件开发环境 / 开发工具

| 类别 | 工具与版本 |
|:--|:--|
| 后端语言 | Python 3.11（容器内实测 **3.11.15**） |
| 后端框架 | FastAPI **0.116.1**、Uvicorn **0.35.0** |
| 前端框架 | Vue **3.4**、Vue Router 4.3、Vuex 4.1、Ant Design Vue 4.2 |
| 前端构建 | Vite **5.4**、Node.js（实测构建用 **v25.9.0**，最低要求 18+）、npm 11.12 |
| 数据库 | MySQL **8.0.45** |
| 图像/推理 | OpenCV（opencv-contrib-python **5.0.0**，DNN 加载 ONNX）、NumPy **2.2.6** |
| 报表 | openpyxl 3.1+（按 `excel_template_v2.xlsx` 模板导出） |
| 容器 | Docker **26.1.3**、Docker Compose **v2.27.0** |
| 反向代理 | Nginx **1.29.8** |

---

## 5. 软件的运行平台 / 操作系统

| 角色 | 平台 |
|:--|:--|
| **服务器（云过渡，标准）** | **Alibaba Cloud Linux 3.2104 U12.3（OpenAnolis，x86_64，内核 5.10）**，容器化部署 |
| 服务器（生产内网） | Ubuntu 22.04 LTS，容器化部署（可运行于 Windows Server 2022 Hyper-V 虚拟机内） |
| 客户端 | Windows 等支持 Chrome / Edge 的桌面操作系统 |

> 三个容器：`nginx`（对外 8888）+ `backend`（FastAPI，仅绑 127.0.0.1:8866）+ `mysql`（仅绑 127.0.0.1:3307）。
> 容器基础镜像分别为 `nginx:latest`、`python:3.11-slim-bookworm`、`mysql:8.0`，与宿主发行版解耦。

---

## 6. 软件运行支撑环境 / 支持软件

| 组件 | 版本（云过渡实测） |
|:--|:--|
| Docker Engine | 26.1.3 |
| Docker Compose | v2.27.0 |
| Nginx | 1.29.8 |
| MySQL | 8.0.45（`TZ=Asia/Shanghai`） |
| Python（容器内） | 3.11.15 |
| FastAPI | 0.116.1 |
| Uvicorn | 0.35.0 |
| OpenCV（DNN/ONNX 推理） | 5.0.0 |
| NumPy | 2.2.6 |
| 浏览器 | Chrome / Edge 最新版 |

**外部依赖（可选）**

| 依赖 | 说明 |
|:--|:--|
| 水印 OCR 服务 | 云过渡：阿里云 DashScope `qwen-vl-ocr`（HTTPS）；内网生产：本地 `https://39.173.23.40:18082/v1` + 私有 CA。不可用时自动跳过水印解析，不影响识别计数 |

---

## 7. 编程语言及版本号

| 语言 | 版本 | 用在哪 |
|:--|:--|:--|
| Python | **3.11.15** | 后端（FastAPI、推理、报表） |
| JavaScript | ES2020+（Vue **3.4**、Vite 5.4 构建） | 前端 |
| SQL | MySQL **8.0** | 建表与查询 |
| HTML5 / CSS3 | — | 前端页面与样式 |

---

## 8. 软件代码行数

统计口径：仓库中的源文件（排除 `node_modules/`、`dist/`、`.venv/`、`docs/`、构建产物）。

| 语言 | 文件数 | 总行数 | 非空行 |
|:--|--:|--:|--:|
| Vue | 25 | 8372 | 7716 |
| Python | 2 | 2376 | 2046 |
| JavaScript | 16 | 1868 | 1721 |
| CSS | 8 | 226 | 212 |
| SQL | 1 | 82 | 72 |
| HTML | 1 | 21 | 21 |
| **合计** | **53** | **12 945** | **11 788** |

> 说明：若统计口径包含 `package.json` / `package-lock.json` / `docker-compose.yml` 等配置与锁文件，总行数约为 15 277 行；上表为纯源码口径。

---

## 9. 数据采集说明

| 数据 | 采集命令 / 方式 |
|:--|:--|
| 服务器 CPU / 内存 / 磁盘 | 云过渡服务器上 `awk -F: '/model name/' /proc/cpuinfo`、`grep -c ^processor /proc/cpuinfo`、`/proc/meminfo`、`df -h /` |
| 系统与内核 | `grep PRETTY_NAME /etc/os-release`、`uname -r -m` |
| 运行时版本 | `docker --version`、`docker compose version`、容器内 `nginx -v` / `mysql --version` / `python --version` / `cv2.__version__` |
| 依赖版本 | `backend/requirements.txt`、`frontend/package.json` |
| 代码行数 | 遍历仓库源文件统计（脚本排除依赖与构建目录） |
| 开发机配置 | 本机 WSL2 `nproc` / `/proc/meminfo` / `df -h`、`cmd /c ver` |
