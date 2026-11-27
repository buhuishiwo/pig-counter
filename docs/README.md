# docs/ 文档导航

**最后更新**: 2026-11-18

**每类内容只维护一份**，避免同一件事出现两个互相矛盾的说法。

---

## 一、对外文档（面向客户、同事、新接手的人）

| 文档 | 内容 | 什么时候更新 |
|:--|:--|:--|
| [`PROJECT_OVERVIEW.md`](PROJECT_OVERVIEW.md) | 技术栈、目录结构、运行方式、状态机、数据库 Schema、API 清单、推理链路、已知问题 | 技术实现变化时 |
| [`DEPLOY_HYPERV_UBUNTU.md`](DEPLOY_HYPERV_UBUNTU.md) | **Windows Server 2022 + Hyper-V + Ubuntu 虚拟机部署教程**：装 Hyper-V、建 VM、配 Docker、搬镜像与数据库、验收清单、故障排查、运维备份 | 部署路径或目标环境变化时 |
| [`EXECUTIVE_SUMMARY.md`](EXECUTIVE_SUMMARY.md) | 一页纸功能概览（面向管理层汇报） | 功能范围变化时 |
| [`USER_JOURNEY.md`](USER_JOURNEY.md) | 用户旅程图 & 泳道图 | 业务流程变化时 |
| [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md) | 功能层已知限制（OCR 识别边界等） | 发现/解决限制时 |
| [`archive/`](archive/) | **历史存档（不再维护）**：`MIGRATION_PLAN.md`（迁移已执行完成）、`refs/`（OCR 选型已废弃方案） | 不再更新 |

---

## 使用约定（重要）

1. **每类内容只维护一份**：技术实现只在 `PROJECT_OVERVIEW.md`，部署操作只在 `DEPLOY_HYPERV_UBUNTU.md`，功能限制只在 `KNOWN_ISSUES.md`；已完成的方案类文档放 `archive/`。
2. **交叉引用用相对路径**，例如 `../README.md`、`archive/refs/README.md`。
3. **新增文档前先想清楚归哪一类**：面向客户/同事的放本目录，部署操作类放 `DEPLOY_HYPERV_UBUNTU.md`，不要另起一份平行文档。

---

## 不在本目录的文档

| 文档 | 位置 | 说明 |
|:--|:--|:--|
| 部署 / 发版流程、API 端点、关键配置 | [`../README.md`](../README.md) | 项目主 README，面向开发者 |
| AI 编码行为规范 | [`../AGENTS.md`](../AGENTS.md) | 通用守则，与具体项目无关 |
