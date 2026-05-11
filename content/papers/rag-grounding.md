---
{
  "id": "rag-grounding",
  "tag": "rag-eval",
  "title": "Grounded Citation Metrics for Domain RAG Systems",
  "source": "ACL Anthology",
  "authors": ["Elena Garcia", "Hao Wu"],
  "affiliations": ["University of Washington", "HKUST"],
  "comment": "评测从答案正确性扩展到引用证据是否覆盖核心 claim，适合做组内知识库的离线回归测试。",
  "visual": "visual-grid",
  "visualLabel": "evidence grid"
}
---

## 核心问题

RAG 系统回答正确并不代表引用可靠。论文重点检查答案里的关键 claim 是否真的被引用材料支撑。

## 方法速读

- 把回答拆成多个可验证 claim。
- 对每个 claim 检查引用证据覆盖度。
- 区分无引用、弱引用和错误引用三类问题。

## 组内关注点

这篇可以直接映射到论文简报生成链路，用来检查自动摘要是否给出了可追溯证据。
