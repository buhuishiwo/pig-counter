# docs/refs — 历史研究存档

本目录下三份文档是 **2026-06 OCR 选型阶段**的研究记录，用于当时的方案对比与决策：

| 文件 | 内容 |
|:--|:--|
| `OCR_API_COMPARISON.md` | 腾讯云 / 百度 / 阿里等 OCR API 对比 |
| `OCR_SOLUTION_SELECTION.md` | 养殖场标记识别方案选型记录 |
| `QWEN_VL_OCR_DEEP_DIVE.md` | 阿里 qwen-vl-ocr 深度介绍与接入方式 |

## ⚠️ 现状提示（2026-10-21）

当时的实现是 **PaddleOCR（本地）+ qwen-vl-ocr（API）双层混合架构**，对应已删除的 `ocr.py`。

**现在生产链路只保留 qwen-vl-ocr**（`backend/watermark_ocr.py`，httpx 直连 DashScope），
旧 PaddleOCR 代码与依赖（`paddlepaddle`、`paddleocr`、`dashscope`）均已移除。

因此本目录内容**仅作历史参考**，其中的"双层混合""PaddleOCR 回退"等描述**不代表当前实现**。
当前 OCR 的实际行为请以 `backend/watermark_ocr.py` 和 `KNOWN_ISSUES.md` 为准。
