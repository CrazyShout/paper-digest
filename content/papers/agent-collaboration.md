---
{
  "id": "agent-collaboration",
  "tag": "agent-reasoning",
  "title": "Long-Horizon Agent Collaboration with Shared Memory",
  "source": "arXiv / OpenReview / GitHub",
  "authors": ["Lin Zhao", "Mei Chen", "Daniel Park"],
  "affiliations": ["Tsinghua University", "Stanford University", "MIT CSAIL"],
  "comment": "把协作失败拆成意图同步、工具分配和恢复策略三个层级，适合作为组内多 agent 评测的任务模板。",
  "visual": "visual-network",
  "visualLabel": "agent trace"
}
---

## 核心问题

这篇论文关注长程任务中多个 agent 如何共享状态、分配工具调用，并在失败后恢复执行。它的价值不只在方法本身，也在于把协作失败拆成了更容易诊断的事件序列。

## 方法速读

- 用共享记忆池记录 agent 的局部观察、工具输出和计划修订。
- 通过角色约束减少重复调用工具的问题。
- 在任务失败后回溯最近一次分歧点，重新分配下一步执行者。

## 组内关注点

如果我们后续做多 agent benchmark，可以借鉴它的失败归因表格，把错误从“最后答案错了”拆到更细的协作过程。
