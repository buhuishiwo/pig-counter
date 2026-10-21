# docs/ 文档导航

**最后更新**: 2026-10-21

本目录分两类文档，**每类内容只维护一份**，避免同一件事出现两个互相矛盾的说法。

---

## 一、对外文档（面向客户、同事、新接手的人）

| 文档 | 内容 | 什么时候更新 |
|:--|:--|:--|
| [`PROJECT_OVERVIEW.md`](PROJECT_OVERVIEW.md) | 技术栈、目录结构、运行方式、状态机、数据库 Schema、API 清单、推理链路、已知问题 | 技术实现变化时 |
| [`MIGRATION_PLAN.md`](MIGRATION_PLAN.md) | 迁移到客户内网服务器的方案：对象盘点、目标系统选型、三种打包方案、传输通道、验证清单、待决策项 | 迁移进展变化时 |
| [`EXECUTIVE_SUMMARY.md`](EXECUTIVE_SUMMARY.md) | 一页纸功能概览（面向管理层汇报） | 功能范围变化时 |
| [`USER_JOURNEY.md`](USER_JOURNEY.md) | 用户旅程图 & 泳道图 | 业务流程变化时 |
| [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md) | 功能层已知限制（OCR 识别边界等） | 发现/解决限制时 |
| [`refs/`](refs/) | OCR 选型历史研究存档（**已废弃方案**，不代表当前实现） | 不再更新（存档） |

## 二、协作飞轮（`wheel/`，人机协作的状态机）

按 [`wheel/COLLABORATION_PROTOCOL.md`](wheel/COLLABORATION_PROTOCOL.md) 维护，**记录"下一步做什么 / 做了哪些事 / 现在是什么状态"**：

| 文档 | 回答的问题 | 更新时机 |
|:--|:--|:--|
| [`wheel/HANDOVER_CONTEXT.md`](wheel/HANDOVER_CONTEXT.md) | **现在是什么状态？**（30 秒快照 + 环境速查 + 历史） | 每次 session 结束 |
| [`wheel/TODO_LIST.md`](wheel/TODO_LIST.md) | **下一步做什么？**（按优先级，每项带验收标准） | 任务完成或新增时 |
| [`wheel/DEPLOYMENT_LOG.md`](wheel/DEPLOYMENT_LOG.md) | **做了哪些事？踩过什么坑？**（编号连续，只追加） | 交付或踩坑时 |
| [`wheel/COLLABORATION_PROTOCOL.md`](wheel/COLLABORATION_PROTOCOL.md) | 协作规则与文档格式规范 | 规范本身变化时 |

---

## 使用约定（重要）

1. **状态类文档只在 `wheel/` 维护**。`TODO_LIST`、`HANDOVER_CONTEXT`、`DEPLOYMENT_LOG` 曾在本目录下有一份副本，已于 2026-10-21 删除——那份内容与 wheel 版偏差已达 70%，是"两套说法"的根源。
2. **`PROJECT_OVERVIEW` 只在本目录维护**，`wheel/` 下不再保留副本。
3. **新 session 从这里开始**：读 `wheel/HANDOVER_CONTEXT.md` 顶部 30 秒快照恢复上下文 → 读 `wheel/TODO_LIST.md` 取当前优先项。
4. 交叉引用其它文档时使用相对路径，例如 `wheel/TODO_LIST.md`、`refs/README.md`。

---

## 不在本目录的文档

| 文档 | 位置 | 说明 |
|:--|:--|:--|
| 部署 / 发版流程、API 端点、关键配置 | [`../README.md`](../README.md) | 项目主 README，面向开发者 |
| AI 编码行为规范 | [`../AGENTS.md`](../AGENTS.md) | 通用守则，与具体项目无关 |
