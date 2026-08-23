---
{
  "id": "compact-va-planning-token-compression",
  "tag": "end-to-end-autonomous-driving",
  "tags": ["end-to-end-autonomous-driving", "world-models"],
  "title": "Planning-aligned Token Compression for Long-Context Autonomous Driving",
  "source": "IEEE Robotics and Automation Letters 2026 (accepted; formal page unavailable at audit) / arXiv:2606.07464 / https://arxiv.org/abs/2606.07464",
  "authors": ["Zhixuan Liang", "Yuxiao Chen", "Yurong You", "Peter Karkus", "Wenhao Ding", "Boyi Li", "Alexander Popov", "Yan Wang", "Maximilian Igl", "Yiming Li", "Danfei Xu", "Nikolai Smolyanskiy", "Boris Ivanovic", "Ping Luo", "Marco Pavone"],
  "affiliations": ["NVIDIA Research", "School of Computing and Data Science, The University of Hong Kong", "Stanford University", "Georgia Institute of Technology"],
  "comment": "COMPACT-VA 关注端到端驾驶的长上下文瓶颈，用 planning intent 监督 token compression，让工作记忆优先保留会影响决策的历史信息。"
}
---

## 一句话定位

这篇论文解决的是端到端 VA/VLA 模型进入长上下文后的计算和记忆问题。它的核心新意不是简单压缩 token，而是让压缩过程对 planning intent 对齐：模型学习保留会影响 stop、yield、proceed 等决策的历史线索。

## 论文要解决的问题

复杂路口、让行和无保护转弯经常需要数秒到十几秒历史才能判断谁先到、谁有路权。直接把所有多视角历史帧喂给 transformer 会超出实时预算；按时间衰减或固定比例压缩又可能丢掉早到车辆、让行义务等关键事件。论文的问题是：如何在有限 token budget 下，把“对规划有用的历史”而不是“最近的历史”留在工作记忆中。

## 方法和系统设计

- COMPACT-VA 使用 hierarchical FIFO memory bank，对不同时间层级使用不同压缩率，形成固定预算的长期记忆。
- 压缩模块通过 Q-former 处理多视角 observation tokens，并条件化历史轨迹和 driving intent latent。
- 训练时 posterior encoder 从未来轨迹中蒸馏 planning intent；推理时 prior encoder 只能从压缩观测预测这个 intent，从而逼迫 memory 保存决策相关线索。
- 被压缩的 memory 和 predicted latent 作为特殊 token 输入 policy transformer，保持与 monolithic VA 架构兼容。

## 关键图与可视化结果

![图 1：COMPACT-VA 通过 planning-aligned memory 保留路权相关历史](../../assets/papers/compact-va-planning-token-compression-figure-1.png)

图 1 是论文的问题定义：在 all-way stop 场景里，车辆到达顺序可能发生在当前窗口之外。普通时间衰减会丢掉 -3 秒的关键信息，而 planning-aligned memory 需要保留它来决定是否让行。

![图 2：COMPACT-VA 的压缩架构和 intent latent 监督](../../assets/papers/compact-va-planning-token-compression-figure-2.png)

图 2 展示了方法的关键机制：posterior encoder 用未来轨迹学习 driving intent，prior encoder 在推理时预测该 latent。这个结构让 compression 不只是视觉重建任务，而是被规划目标牵引。

## 实验结论与证据

论文针对高信号动态场景设计评测，包括四向停车、stop/yield、无保护转弯等。结果显示，在相近 token budget 下，COMPACT-VA 成功率达到 68.3%，相比规则压缩有超过 6% 的提升；闭环评测中相比未压缩长上下文处理获得 3.3 倍速度提升和 2.7 倍显存下降，同时保持整体 driving performance。

## 应用场景与启发

- 应用场景：多视角端到端驾驶模型的长上下文工作记忆、路口通行权判断、实时部署压缩。
- 方法启发：压缩模块应该由 downstream planning signal 监督，而不是只优化 token reconstruction 或随机保留。
- 讨论问题：哪些驾驶事件必须进入长期记忆，哪些只需要短时视觉上下文。

## 局限与阅读风险

论文的收益依赖作者构造的 memory-dependent 场景集合，普通巡航场景可能看不出明显优势。planning intent latent 的监督来自未来轨迹，训练数据质量会直接影响记忆学习。若模型部署到不同交通规则区域，哪些历史信息“决策关键”也可能变化。

## 后续跟进

- 检查是否开放动态场景筛选脚本和 compression 模块代码。
- 与 Unified Driving Tokens、Discrete-WAM 对比：一个压缩历史 token，一个学习统一离散 token，一个做 world-policy token editing。
- 复现时优先构造 all-way stop / yield 场景，而不是只跑平均 L2。
