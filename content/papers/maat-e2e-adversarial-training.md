---
{
  "id": "maat-e2e-adversarial-training",
  "tag": "autonomous-driving-security",
  "title": "Module-wise Adaptive Adversarial Training for End-to-end Autonomous Driving",
  "source": "arXiv:2409.07321 / https://arxiv.org/abs/2409.07321",
  "authors": ["Tianyuan Zhang", "Lu Wang", "Jiaqi Kang", "Xinwei Zhang", "Siyuan Liang", "Yuwei Chen", "Aishan Liu", "Xianglong Liu"],
  "affiliations": ["Beihang University and collaborators"],
  "comment": "MA2T 把对抗训练从分类或感知模块推进到端到端驾驶链路，关注攻击如何穿过感知、预测和规划影响最终驾驶行为。它适合作为自动驾驶鲁棒性评测与防御设计的基线论文。"
}
---

## 一句话定位

MA2T 是一篇端到端自动驾驶鲁棒训练论文，核心目标是在感知、预测、规划等模块强耦合的驾驶模型中做自适应对抗训练。它强调防御不能只保护某个局部任务，而要看最终规划输出和闭环驾驶行为是否更安全。

## 论文要解决的问题

传统对抗训练通常面对分类、检测或分割模型，输出目标单一，损失函数清楚。但端到端驾驶模型包含多个模块和多个任务，攻击可以在中间特征里传播，最终改变轨迹规划。直接把普通 PGD 对抗训练套进端到端模型，可能只提升局部模块鲁棒性，却损害整体驾驶效果。MA2T 的问题是：如何在不同模块注入扰动，并动态调整各模块训练贡献，使模型在攻击、自然扰动和闭环环境中都更稳。

## 方法和系统设计

- Module-wise Noise Injection 在输入或模块连接处引入扰动，使训练覆盖感知、预测、规划链路中的不同脆弱点。
- Dynamic Weight Accumulation Adaptation 根据模块对鲁棒训练的贡献动态调整权重，避免某个模块损失主导训练。
- 评估覆盖 white-box、black-box、adaptive attack、natural corruption 和 CARLA 闭环模拟，尽量把开环指标与驾驶行为联系起来。

## 关键图与可视化结果

![图 1：MA2T 方法示意，以 UniAD 为例展示噪声可以注入输入数据和模块连接位置](https://arxiv.org/html/2409.07321v1/x1.png)

这张图说明 MA2T 的关键不是单个攻击算子，而是“模块级”训练视角。端到端驾驶模型的中间表示会跨模块传播，扰动位置不同，最终影响的规划风险也不同。

![图 2：同一场景中 clean、被攻击和 MA2T 防御后的规划可视化对比](https://arxiv.org/html/2409.07321v1/x7.png)

这张图展示了防御论文最需要的定性证据：攻击后规划可能从安全避让变成碰撞风险，而经过 MA2T 训练后，模型在同类攻击下能恢复更合理的轨迹。它提供了“规划风险”层面的直观证据，但仍需要和 CARLA 闭环统计一起判断稳定性。

## 实验结论与证据

论文在 nuScenes 上使用 UniAD、VAD 等端到端驾驶模型进行 white-box 和 black-box 设置评估，主要观察规划 Avg. L2 Error 等指标在攻击下的变化。它还补充自然扰动和 CARLA 闭环结果，说明防御不只改善开环误差，也可能降低模拟驾驶中的失效风险。更有价值的是 adaptive attack 结果，因为这能避免防御只对固定攻击方式有效。

## 应用场景与启发

- 应用场景：端到端驾驶模型上线前的鲁棒性测试、自动驾驶攻防 benchmark、防御训练 baseline 和安全回归测试。
- 方法启发：鲁棒性评估应沿着模块链路定位脆弱点，并把最终规划和闭环风险纳入评价。
- 讨论问题：对 V2X-VLM、世界模型式驾驶系统和概率规划模型，模块级防御是否仍然适用，还是需要按任务风险重新定义攻击面。

## 局限与阅读风险

对抗训练通常有训练成本和 clean performance trade-off，需要检查正常场景性能是否下降。攻击设置虽然较丰富，但真实世界还包括物理扰动、传感器故障、通信异常、场景级诱导和数据分布漂移。MA2T 的模块划分依赖具体端到端架构，迁移到大模型或世界模型架构时未必直接可用。

## 后续跟进

- 记录论文使用的端到端模型、攻击类型、扰动预算和闭环指标，形成安全评测清单。
- 复现时至少包含 clean、white-box、black-box、adaptive attack、natural corruption 五类结果。
- 跟进端到端驾驶防御是否能与不确定性规划、安全约束和仿真世界模型结合。
