---
{
  "id": "vadv2-probabilistic-planning",
  "tag": "end-to-end-autonomous-driving",
  "tags": ["end-to-end-autonomous-driving", "dynamic-scene-representation"],
  "title": "VADv2: End-to-End Vectorized Autonomous Driving via Probabilistic Planning",
  "source": "ICLR 2026 / https://openreview.net/forum?id=0a4dA6eUHN / arXiv:2402.13243 / https://arxiv.org/abs/2402.13243 / https://hgao-cv.github.io/VADv2/",
  "authors": ["Bo Jiang", "Shaoyu Chen", "Hao Gao", "Bencheng Liao", "Qian Zhang", "Wenyu Liu", "Xinggang Wang"],
  "affiliations": ["Huazhong University of Science and Technology", "Horizon Robotics"],
  "comment": "VADv2 把端到端驾驶规划从确定性轨迹回归改成动作概率分布学习，用 planning vocabulary 表达多种合理驾驶动作。它适合作为闭环端到端驾驶和不确定性规划的核心阅读样本。"
}
---

## 一句话定位

VADv2 是一篇以概率规划为核心的端到端自动驾驶论文。它认为真实驾驶中一个场景往往存在多种合理动作，确定性轨迹回归会把多模态行为压成平均解，而概率规划可以显式建模动作不确定性，并在闭环中采样可执行动作。

## 论文要解决的问题

端到端驾驶常把多视角传感器输入映射成一条轨迹或控制量，但驾驶动作空间是高维连续时空空间，并且受驾驶风格、交互对象、交通规则和短期目标影响。确定性模型在可行解非凸或多模态时容易输出中间轨迹，闭环执行时可能不稳定。VADv2 的问题定义是：能否从大规模驾驶示范中学习 scene-conditioned action distribution，而不是只学习一个平均轨迹。

## 方法和系统设计

- 模型以流式多视角图像序列为输入，将传感器信息 token 化为 scene representation。
- 论文将连续规划动作空间离散成 planning vocabulary，并把动作也 token 化，让 planning tokens 与 scene tokens 交互。
- 训练时用大规模驾驶示范和场景约束监督动作概率分布，推理时从分布中采样动作控制车辆，减少规则 wrapper 的依赖。

## 关键图与可视化结果

![图 1：VADv2 总体架构，展示多视角图像输入、场景 token、规划动作 token、动作概率分布和采样控制](https://arxiv.org/html/2402.13243v2/x2.png)

这张图说明 VADv2 的关键设计在输出端。它不是直接回归一条轨迹，而是把 planning action space 建成词表，再预测动作分布。这使模型可以表达多个合理动作，也方便把场景约束纳入概率分布训练。

![图 2：VADv2 在 CARLA Town05 Long benchmark 中的定性结果，展示不同速度、变道和交互场景下的多模态规划](https://arxiv.org/html/2402.13243v2/x3.png)

这张可视化结果对应论文的核心主张：在跟车、变道、路口等场景中，模型可以生成多个合理候选动作，而不是单一平均轨迹。需要注意的是，可视化展示多样性，但安全性还要看闭环指标和不同交通密度下的消融结果。

## 实验结论与证据

论文报告 CARLA Town05 Long 闭环 benchmark、NAVSIM、NAVSIMv2 和 3DGS-based benchmark 结果，并强调在无规则 wrapper 设置下仍能获得稳定闭环表现。它还对多模态输出、planning vocabulary size、planning manners 和交通密度做消融。证据重点不是某个开环 L2 指标，而是概率规划是否能在长路线闭环中减少不稳定行为。

## 应用场景与启发

- 应用场景：端到端闭环驾驶、长路线仿真评估、自动驾驶不确定性建模、多候选轨迹规划和 planner benchmark。
- 方法启发：规划输出可以是分布而不是单条轨迹；这样更适合风险评估、保守采样、交互式规划和后续安全约束。
- 讨论问题：概率规划的不确定性应该只出现在动作层，还是应该同时和世界模型 rollout、其他 agent 预测一起建模。

## 局限与阅读风险

planning vocabulary 的构建会引入离散化偏差，词表规模、采样方式和示范数据覆盖会影响上限。CARLA 闭环结果很重要，但真实道路长尾场景、传感器异常和交通规则复杂性仍需要单独验证。另一个风险是采样式动作不等于安全动作，概率分布还需要和可验证约束或风险模型结合。

## 后续跟进

- 检查项目页代码、CARLA/NAVSIM 配置和 3DGS-based benchmark 的可复现性。
- 复现时比较确定性回归、概率规划、不同 vocabulary size 和是否使用规则 wrapper。
- 跟进概率规划与 V2X 协同、世界模型动作评估之间的结合。
