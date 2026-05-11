---
{
  "id": "sparse-finetune",
  "tag": "efficient-training",
  "title": "Sparse Adapter Routing for Cost-Aware Fine-Tuning",
  "source": "arXiv",
  "authors": ["Nora Wang", "Isaac Miller"],
  "affiliations": ["Carnegie Mellon University", "Google DeepMind"],
  "comment": "路由粒度比 LoRA module 更细，适合检查是否能和现有的训练脚本复用。",
  "visual": "visual-network",
  "visualLabel": "adapter routes"
}
---

## 核心问题

大模型微调的成本不仅来自参数量，也来自激活和路由开销。论文把 adapter 的选择变成稀疏路由问题，目标是把训练预算集中到有效路径上。

## 方法速读

- 每个样本只激活少量 adapter 分支。
- 路由器根据任务和中间表示动态选择分支。
- 用预算约束控制吞吐和显存。

## 组内关注点

可以先检查它是否能无痛接到我们现有训练脚本，再决定是否值得复现。
