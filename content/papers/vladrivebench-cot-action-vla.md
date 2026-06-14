---
{
  "id": "vladrivebench-cot-action-vla",
  "tag": "autonomous-driving-testing",
  "tags": ["autonomous-driving-testing", "autonomous-driving-security", "end-to-end-autonomous-driving"],
  "title": "VLADriveBench: Evaluating CoT-Action Relationship in VLA for Autonomous Driving",
  "source": "arXiv:2606.12706 / https://arxiv.org/abs/2606.12706",
  "authors": ["Thach Nguyen", "Danhua Guo", "Tom Lampo", "Fei Wu", "Burhan Yaman"],
  "affiliations": ["Uber AV Labs"],
  "comment": "VLADriveBench 不只看 VLA 轨迹误差，而是测试 CoT 是否正确、是否和动作一致、以及替换 CoT 后动作是否真的变化，适合补齐驾驶大模型的可解释性评测口径。"
}
---

## 一句话定位

VLADriveBench 是一篇面向自动驾驶 VLA 的 reasoning/action 关系评测论文。它的价值在于把“模型会写 chain-of-thought”从展示能力变成可测对象：CoT 是否提到关键目标，是否幻觉，是否和动作方向一致，以及它是否真的因果影响 action head。

## 论文要解决的问题

当前 VLA 评测常把最终轨迹当作唯一输出，导致 reasoning trace 只要看起来合理就容易被接受。但在自动驾驶中，一个漂亮的 CoT 可能只是事后解释，动作头实际完全依赖视觉特征；相反，一个语言不够整洁的 CoT 也可能对动作有强因果作用。论文要解决的是如何区分 correlation 和 causation，避免把解释性文本误当作决策依据。

## 方法和系统设计

- 评测分为 CoT quality 和 CoT-action relationship 两层。前者检查目标提及、交通灯颜色、幻觉和矛盾；后者检查 CoT command 与 action 输出是否观测相关。
- 论文加入 intervention protocol：把模型自己的 CoT、加速/刹车/目标相关注入文本等替换到推理链中，观察轨迹是否发生语义一致变化。
- 评测覆盖 ORION、Alpamayo R1 和 Alpamayo v1.5，分别比较 open-loop displacement 和 closed-loop rollout 中的动作差异。
- 自 splice 作为零差异控制，避免把任何文本替换造成的分布外扰动都误判为 CoT 因果性。

## 关键图与可视化结果

![图 1：VLADriveBench 把 CoT quality 和 action relationship 分开评估](../../assets/papers/vladrivebench-cot-action-vla-figure-1.png)

图 1 是这篇论文的评测框架总览。关键点是它没有把 CoT 当作可读附属品，而是明确测四件事：是否提到目标、是否幻觉、是否与动作观测一致、替换后是否因果改变动作。

![图 2：Alpamayo v1.5 在 CoT 注入下的 open-loop 和 closed-loop 响应](../../assets/papers/vladrivebench-cot-action-vla-figure-2.png)

图 2 对应 intervention 结果。阅读时应重点看 selfsplice 控制项接近零，而 pedestrian/car 条件让位移变短，说明该模型的 CoT 通道对 action 有语义方向一致的影响；这类证据比普通 alignment rate 更接近“解释是否参与决策”。

## 实验结论与证据

论文最重要的结论是 observational alignment 和 causal intervention 会分歧。ORION 在观测 alignment 上看起来最好，但其 CoT 的因果影响弱，可能是 epiphenomenal reasoning；Alpamayo v1.5 的观测分数不一定最高，但替换 CoT 会显著改变 open-loop 位移和部分 closed-loop 行为。这个结果说明 VLA 评测不能只看最终轨迹，也不能只看 CoT 文本质量。

## 应用场景与启发

- 应用场景：驾驶 VLA 的解释一致性评测、reasoning safety audit、CoT 注入攻击或防御的基线。
- 方法启发：组内如果训练 VLA，不应只展示语言推理样例；至少要加入 selfsplice、contradiction、hallucination 和语义注入实验。
- 讨论问题：如果 CoT 不影响动作，它应该被视为解释模块、训练辅助，还是潜在的安全风险界面。

## 局限与阅读风险

论文评测的模型和部分数据带有专有环境限制，效应大小可能不完全外推到开源模型。CoT 注入也可能引入分布偏移，因此结论应理解为诊断工具，而不是单一安全认证标准。对于不输出显式 CoT 的 VLA，还需要设计等价的 latent reasoning probe。

## 后续跟进

- 检查 VLADriveBench 是否开放场景、标注和 intervention 脚本。
- 与 ReasonBreak 一起整理成 VLA reasoning channel 的安全评测清单。
- 后续阅读 VLGA 时重点比较同一机构如何同时处理 geometry grounding 和 reasoning evaluation。
