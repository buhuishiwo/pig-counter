# 交接一页纸 — Pig Count（智慧猪群识别系统）

> 写给接手的人。读这一页 + 点开下面 3 个链接，就能开工。
> **生成时间**：2026-11-18｜**版本**：v3.1 / commit `f54509bd`

---

## 1. 三十秒现状

- **v3.1 已上线两套环境**：客户内网生产 + 云端预发布，两边同一份代码。
- **内网生产已于 2026-11-18 就地更新完成**：三容器 Up、`/api/health` healthy、数据 2928 条未丢。
- **唯一未完成的验收**：`sudo reboot` 后三个容器能否自动起来（预计没问题，但没实测）。
- **一个已知功能缺陷**：OCR 后端不可达时，单张识别会卡约 10 分钟（已有临时缓解方案，根治未做）。

---

## 2. 三个环境

| 环境 | 地址 | 怎么进 | 说明 |
|:--|:--|:--|:--|
| 本地开发 | `localhost:5173` / `localhost:8866` | 直接跑 | Windows + WSL2；本机 Docker Desktop 有故障，**不要在本地构建镜像** |
| 客户内网**生产** | 自有域名 → 静态公网 IP → **cpolar 隧道** → `192.168.250.2:8888` | 向日葵 → Windows 宿主 → `ssh ubuntu@192.168.250.2` | Windows Server 2022 + Hyper-V + Ubuntu 22.04 VM，NAT 网络；部署目录 `/opt/pig-counter`；**无公网 SSH** |
| 云端**预发布** | `http://47.110.63.70:8888` | `ssh admin@47.110.63.70`（root 已禁登录，需 `sudo`） | Alibaba Cloud Linux 3；部署目录 `/opt/pig-counter/pig-counter`；**离线包和镜像都从这里打** |

---

## 3. 资料索引（想知道什么，点哪里）

| 想知道 | 文档 |
|:--|:--|
| **现在是什么状态 / 下一步做什么** | [`wheel/HANDOVER_CONTEXT.md`](HANDOVER_CONTEXT.md) · [`wheel/TODO_LIST.md`](TODO_LIST.md)（看 **P9** 六项） |
| **做过什么、踩过哪些坑（最重要）** | [`wheel/DEPLOYMENT_LOG.md`](DEPLOYMENT_LOG.md) → **#169**（内网更新全流程 + 两个坑）、**#170**（OCR 卡 600 秒） |
| 内网这台机器怎么部署起来的（含网络/验收/排错） | [`../DEPLOY_HYPERV_UBUNTU.md`](../DEPLOY_HYPERV_UBUNTU.md) |
| 功能边界 / 已知限制 | [`../KNOWN_ISSUES.md`](../KNOWN_ISSUES.md) |
| 技术栈、目录结构、API 清单、数据库 Schema | [`../PROJECT_OVERVIEW.md`](../PROJECT_OVERVIEW.md) |
| 发版流程、关键配置、API 端点 | [`../../README.md`](../../README.md) → 「远程服务器」章节 |
| 迁移方案存档（已执行完） | [`../MIGRATION_PLAN.md`](../MIGRATION_PLAN.md) |
| 文档该更新哪一份（规则） | [`../README.md`](../README.md) |
| 协作/文档格式规范 | [`COLLABORATION_PROTOCOL.md`](COLLABORATION_PROTOCOL.md) |

---

## 4. 必须记住的事实

```
版本          v3.1 / commit f54509bd97b3
内网镜像      pig-counter-backend:latest  →  显示 e7cc5129ff62 (1.49GB)
              与云端 0fad11a9ad41 (724MB) 是【同一个构建】，差异来自 containerd 存储口径
回滚点        pig-counter-backend:before-20261118-234505
配置备份      /opt/pig-counter/docker-compose.yml.bak-20261118-234505
更新前后记录  2928 条 → 2928 条（未丢）
OCR（内网）   写在 docker-compose.yml，不在 .env：
              OCR_BASE_URL=http://39.173.23.40:18081/v1 · OCR_MODEL=qwen3.8-27b · OCR_API_KEY=非空
              （本地模型需对方放行本侧出口公网 IP → 18081/TCP）
部署包（Windows） D:\pigcount-deploy\update\（296MB，就地更新用）
              D:\pigcount-deploy\install\（607MB，整机重装用，这次不要用）
```

---

## 5. 接手后的前三件事

1. **`sudo reboot` 验自启**：等 2 分钟 → `docker compose ps` 三容器 Up → `curl 127.0.0.1:8888/api/health`。（P9 Task 16）
2. **实测 cpolar 隧道的长请求/体积限制**：走域名传 40~50 张（单批 100~115 秒），若隧道只给 60~100s 会 502；再传 100MB 单文件看是否 413。（P9 Task 17）
3. **OCR 超时熔断**：`watermark_ocr._call_ocr` 的 60s 超时降到 5~10s，连续失败即跳过本轮剩余图片。（P9 Task 18）

其余待办：服务鉴权（公网暴露，目前无登录）、清理 11-18 当晚因 OCR 卡死产生的重复记录、保留离线包 30 天。

---

## 6. 五条红线（踩了会出事故）

1. **不要 `docker compose down -v`** —— 会删数据卷。
2. **不要在内网机跑 `deploy.sh`** —— 那是全新装机脚本，会把 `/opt/pig-counter` 挪走、重建空 `.env`。
3. **不要用仓库版覆盖内网的 `docker-compose.yml` / `nginx.conf` / `backend/Dockerfile`** —— 会丢本地模型 OCR 配置和内网镜像源补丁。
4. **更新 `dist/` 时必须拷进原目录**（`cp -a 新/. 旧/`），删除目录重建会让 nginx 的 bind mount 指向已删 inode。
5. **重建 backend 容器后必须 `docker restart pig-count-nginx`** —— 否则 nginx 缓存旧 IP，表现为"首页能开、接口全 502"。

---

## 7. 三条验证命令

```bash
cd /opt/pig-counter
docker compose ps
curl -s http://127.0.0.1:8888/api/health
docker compose logs --tail=50 backend
```

---

## 8. 本次交接包含的文档改动

代码零改动，仅文档（不影响 `f54509bd` 的部署包）：

```
README.md                              版本 v3.1、双环境、内网离线更新流程
 docs/README.md                         文档索引入口
 DEPLOY_HYPERV_UBUNTU.md                root@ → admin@（7 处）
 KNOWN_ISSUES.md                        OCR 后端不可达卡 600s
 MIGRATION_PLAN.md                      标记迁移已完成
 PROJECT_OVERVIEW.md                    产品版本 v3.1、运行方式拆双环境
 wheel/DEPLOYMENT_LOG.md                #169 / #170
 wheel/HANDOVER_CONTEXT.md              30 秒快照 + 环境速查
 wheel/TODO_LIST.md                     P6 完成、新增 P9（6 项）
 wheel/HANDOVER_BRIEF.md                本文件
```

**只改文档、不改代码**，所以内网跑的 v3.1 不受影响，也不需要重新发版。
