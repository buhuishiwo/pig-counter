# MIGRATION_PLAN — 迁移到客户内网新服务器

**创建**: 2026-10-21
**状态**: ⏸ 等待甲方确认目标操作系统
**基线**: 代码 `cb14cdb7`（后端镜像 `pig-counter-backend` 946MB，linux/amd64）

---

## 一、迁移目标

把在跑的 Pig Count 系统完整迁到客户内网一台新服务器，**并保留全部历史数据**（2500 条检测记录，其中 655MB 为 base64 缩略图）。

---

## 二、迁移内容盘点（哪些东西不在镜像里）

`docker save` / `docker load` **只能带走镜像层**，以下四类必须单独处理：

| 类别 | 内容 | 是否在镜像里 | 处理方式 |
|:--|:--|:--|:--|
| 镜像层 | backend 代码（自行构建）、mysql 8.0、nginx latest | ✅ 在 | `docker save` 或镜像仓库 |
| bind 挂载 | `dist/`（前端产物）、`nginx.conf` | ❌ 不在 | 随源码或单独打包 |
| 命名卷 | `pig-counter_mysql_data`（全部业务数据） | ❌ 不在 | `mysqldump` |
| 环境配置 | `.env`（含 `OCR_API_KEY`、`DB_PASSWORD`） | ❌ 不在 | 单独传递，勿入库 |

> **结论：任何"只搬镜像"的方案都不成立**，数据必然要单独迁。

---

## 三、现有服务器基线（迁移前必须记录）

| 项 | 值 |
|:--|:--|
| 主机 | `root@47.110.63.70`，目录 `/opt/pig-counter/pig-counter` |
| 容器 | `pig-count-nginx`（8888）、`pig-count-backend`（127.0.0.1:8866）、`pig-count-mysql`（127.0.0.1:3307） |
| 数据规模 | `detection_records` 2500 行、`system_logs` 488 行，库总计约 681MB |
| 表 | detection_records / pig_farms / watermark_data / system_logs |
| 时区 | mysql 容器 `TZ=Asia/Shanghai`（必须保留，否则时间差 8 小时） |
| 操作系统 | CentOS 系（阿里云），已运行 140+ 天 |

---

## 四、目标系统选型（已与甲方沟通）

### 推荐顺序

| 优先级 | 目标系统 | 理由 |
|:--|:--|:--|
| 🥇 | **Ubuntu Server 22.04 LTS** | 容器原生支持；镜像/代码零改动；支持到 2027（ESM 2032）；Docker Engine 免费 |
| 🥈 | **Windows Server 2022 Standard（桌面体验版）** + Hyper-V | Windows 里唯一干净的路：Hyper-V 内跑 Ubuntu VM。支持到 2031，保留 WSL2 后路 |
| 🥉 | Windows 11 专业版 + Docker Desktop | 唯一官方支持 Docker Desktop 的形态，但客户端系统做服务器多数企业不允许，且有大企业付费许可问题 |
| ❌ | Windows Server 2019/2016 | 无 WSL2；Hyper-V 路线可用但版本更老 |
| ❌ | **Windows Server 2012 / 2012 R2** | **容器方案不可行**，见下节 |

### 为什么排除 Windows Server 2012

1. Docker Desktop 只支持 Win10/11；Docker Engine 的 Windows 容器需要 **Server 2016+** 的内核特性
2. Linux 容器需要 Linux 内核：WSL2 需 Win10 2004+/Server 2019+，2012 没有
3. 唯一出路是 Hyper-V 再套 Ubuntu VM，但这台 2012 **本身极可能是虚拟机**，需宿主开启嵌套虚拟化，大概率不具备
4. 原生部署也受系统版本限制：非 R2 只能 Python 3.8，而 `numpy==2.2.6` 要求 Python ≥3.10
5. 该系统已于 2023-10 结束扩展支持，无安全更新

**已向甲方提出换系统要求**，等待回复。

---

## 五、硬件配置要求（已提交给甲方）

```
CPU    4 核以上（需支持 VT-x/AMD-V + SLAT；若为虚拟机需宿主开嵌套虚拟化）
内存   16GB（最低 8GB）
磁盘   100GB 可用
网络   固定内网 IP，对客户端开放 8888 端口
外网   可不联网（部署包离线交付）
```

---

## 六、三种迁移方案（待目标系统确定后选用）

| 方案 | 要搬的东西 | 目标机上的操作 | 适用场景 |
|:--|:--|:--|:--|
| **A. 源码重建** | 代码（GitHub）+ `dist` 8MB + DB dump | 配镜像加速 → `docker compose up -d --build` → 导 SQL | 目标机可访问 Docker Hub / 内网有镜像源 |
| **B. 镜像仓库（阿里云 ACR）** | 服务器 push、目标机 pull，不搬文件 | 登录 → `docker compose up -d` → 导 SQL | 有阿里云账号，想要可持续更新 |
| **C. 全合一镜像包** | 1 个 tar（把 dist / nginx.conf / DB dump 全烤进镜像） | `docker load` → `docker compose up -d`（数据自动还原） | 目标机网络受限，要"一次导入" |

**当前决定**：先不打包、不导出数据库，等目标系统确定后再执行。

---

## 七、数据传输通道（关键约束）

操作目标机只有**向日葵远程桌面**，无 SSH。因此：

| 做法 | 说明 |
|:--|:--|
| 推荐 | 在源服务器 nginx 上加临时只读下载路径，目标机用**浏览器**下载（用完立即关闭） |
| 备选 | 先下到目标机所在内网的一台机器，再用 SMB 共享传给目标机 |
| 避免 | 直接用向日葵的文件传输搬 GB 级数据 |

**Hyper-V 方案下**：Windows 主机与 Ubuntu VM 用外部虚拟交换机处于同一局域网，通过 SMB 或 scp 互传最快。
注意 2012 无 "Default Switch"，需手工创建外部虚拟交换机，绑定时主机网络会短暂闪断。

---

## 八、数据库迁移方法

```bash
# 源服务器导出（只读，不影响线上）
docker exec pig-count-mysql mysqldump -uroot -ppig_counterMysql \
  --single-transaction --routines --triggers --default-character-set=utf8mb4 \
  pig_counter | gzip > pigcounter-db-YYYYMMDD.sql.gz

# 目标机导入（容器起来后）
docker exec -i pig-count-mysql mysql -uroot -ppig_counterMysql \
  --default-character-set=utf8mb4 pig_counter < pigcounter-db-YYYYMMDD.sql
```

注意事项：
- 必须用 **MySQL 8.0**（`mysql_init.sql` 使用 `utf8mb4_0900_ai_ci`，5.7 不支持）
- `mysql_init.sql` **只在空数据卷首次启动时执行**；已有库改结构需手工执行 SQL
- 若目标机不需要历史图片，可用 `--ignore-table` 或导出时排除 `original_image`/`annotated_image`，
  dump 体积可从约 500MB 降到约 25MB

---

## 九、迁移后验证清单

```bash
# 1) 容器与代码
docker compose ps
docker exec <backend> ls /app/app.py /app/model/pig_count.onnx /app/excel_template_v2.xlsx

# 2) 服务
curl -s http://127.0.0.1:8888/api/health          # 期望 {"status":"healthy",...}
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8888/   # 期望 200

# 3) 数据
curl -s http://127.0.0.1:8888/api/detection-stats  # 期望 total_images=2500
curl -s http://127.0.0.1:8888/api/farms

# 4) 时区（易漏）
docker exec <mysql> mysql -uroot -p*** -e "select now(), curdate();"   # 应为北京时间

# 5) 业务闭环
# 前端上传一张图 → 识别 → 检查标注图、水印标签、Excel 下载
```

---

## 十、待决策项

| # | 事项 | 状态 |
|:--|:--|:--|
| 1 | 目标操作系统（甲方确认中） | ⏸ 待定 |
| 2 | 是否导出数据库（迁移必需，当前决定暂缓） | ⏸ 暂缓 |
| 3 | 迁移包采用 A / B / C 哪种方案 | ⏸ 待定（取决于目标系统） |
| 4 | 历史图片是否全部迁移 | ✅ 决定：全部保留 |
