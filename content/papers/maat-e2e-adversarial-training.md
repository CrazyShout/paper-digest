---
{
  "id": "maat-e2e-adversarial-training",
  "tag": "autonomous-driving-security",
  "title": "Module-wise Adaptive Adversarial Training for End-to-end Autonomous Driving",
  "source": "arXiv:2409.07321 / https://arxiv.org/abs/2409.07321",
  "authors": ["Tianyuan Zhang", "Lu Wang", "Jiaqi Kang", "Xinwei Zhang", "Siyuan Liang", "Yuwei Chen", "Aishan Liu", "Xianglong Liu"],
  "affiliations": ["Beihang University and collaborators"],
  "comment": "把对抗训练扩展到感知、预测、规划耦合的端到端驾驶模型，适合作为自动驾驶模型攻防方向的防御样本。",
  "visual": "visual-network",
  "visualLabel": "MA2T defense"
}
---

## 导读判断

MA2T 入选是因为它把安全鲁棒性问题从单个感知模块推进到端到端驾驶链路。端到端模型的攻击影响不只体现在检测或分割错误上，而是会穿过感知、预测和规划，最终改变驾驶动作。论文尝试做模块级自适应对抗训练，适合作为组内自动驾驶模型攻防方向的防御基线。

## 研究背景与问题

普通对抗训练通常假设模型有一个清晰输出和单一损失，但端到端驾驶模型包含感知、预测、规划等多阶段目标，各模块强耦合。直接套用分类或检测领域的对抗训练，可能只增强局部模块而损害整体驾驶目标。MA2T 的问题定义是：如何在端到端驾驶模型内部注入扰动并动态平衡各模块损失，使整体驾驶决策更稳健。

## 方法主线

- 方法提出 Module-wise Noise Injection，在不同模块输入前注入噪声，但训练目标由整体端到端任务而不是单个模块损失引导。
- 它提出 Dynamic Weight Accumulation Adaptation，根据模块对整体鲁棒训练的贡献动态调整损失权重。
- 评估覆盖白盒攻击、黑盒攻击和自然扰动，并把鲁棒性验证延伸到 CARLA 闭环环境。

## 实验与证据

论文在 nuScenes 上使用多个端到端自动驾驶模型做实验，并报告在攻击场景下相较基线有明显提升。它还在 CARLA 中做闭环评估，验证防御不只是提升开环指标，也能改善模拟驾驶中的鲁棒性。这个证据结构符合本项目对安全方向的筛选要求：必须区分模型指标下降和真实驾驶风险上升。

## 和组内方向的关系

这篇论文适合作为安全鲁棒性方向的固定参考。后续组内无论做端到端驾驶、V2X 协同还是世界模型，都需要有类似的攻击和自然扰动评估。它还提醒我们，防御方法不能只看某个模块是否更鲁棒，而要看整体规划输出和闭环驾驶行为是否更安全。

## 局限与阅读风险

对抗训练通常带来训练成本和 clean performance trade-off，需要核查论文是否报告正常场景性能。攻击设置也可能覆盖有限，真实世界中的物理攻击、传感器失效、通信异常和场景级扰动更复杂。MA2T 的模块划分还依赖具体端到端架构，迁移到 VLM 或世界模型式驾驶系统时未必直接适用。

## 后续跟进

- 记录论文使用的端到端模型、攻击类型和闭环指标，作为未来安全评测清单。
- 如果复现，优先做 clean、white-box、black-box、natural corruption 四类对照。
- 组会可讨论：端到端驾驶鲁棒性应按模块防御，还是按最终规划风险统一建模。
