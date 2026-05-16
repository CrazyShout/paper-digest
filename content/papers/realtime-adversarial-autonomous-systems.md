---
{
  "id": "realtime-adversarial-autonomous-systems",
  "tag": "autonomous-driving-security",
  "tags": ["autonomous-driving-security", "autonomous-driving-testing"],
  "title": "Real-Time Evaluation of Autonomous Systems under Adversarial Attacks",
  "source": "arXiv:2605.03491 / https://arxiv.org/abs/2605.03491",
  "authors": ["Adithya Mohan", "Xujun Xie", "Venkatesh Thirugnana Sambandham", "Torsten Schön"],
  "affiliations": ["AI Motion Institute, Technische Hochschule Ingolstadt"],
  "comment": "这篇论文用真实交叉口驾驶数据做离线轨迹学习和推理时 PGD 攻击评测，强调相近 nominal ADE 下模型鲁棒性可能差异很大。"
}
---

## 一句话定位

这是一篇自动驾驶策略对抗鲁棒性评测论文。它把 adversarial evaluation 从纯仿真拉回到真实 intersection driving data 上，对 MLP behavior cloning、Transformer object-tokenized behavior cloning 和 GAIL/IRL 范式做轨迹学习与推理时攻击评估。

## 论文要解决的问题

自动驾驶策略的对抗评测常在仿真中完成，成本低且没有物理风险，但纯虚拟测试可能忽略真实数据中的结构不一致、监督约束和状态表示效应。不同模型在 nominal ADE/FDE 上接近，并不代表面对梯度攻击时稳定性相同。论文的问题是：如何基于真实交叉口驾驶数据构建一个离线轨迹学习与 adversarial robustness evaluation 框架，比较不同状态结构和模型归纳偏置的鲁棒性。

## 方法和系统设计

- 在受控数据契约下训练三类 trajectory-learning paradigms：MLP-based behavior cloning、Transformer-based object-tokenized behavior cloning 和 GAIL 形式的 inverse reinforcement learning。
- 使用 ADE 和 FDE 评价 nominal trajectory learning performance。
- 在推理阶段对训练好的 policies 施加 gradient-based adversarial perturbations，形成多交叉口场景下的结构化鲁棒性矩阵。

## 关键图与可视化结果

![图 1：真实数据驱动的 open-loop inference-time robustness evaluation pipeline](https://arxiv.org/html/2605.03491v1/x1.png)

这张图说明评测链路的边界：它不是在线碰撞测试，而是在真实轨迹数据上做 open-loop inference-time attack，对比不同 policy 表示的敏感性。

![图 2：用于实时评测和攻击测试的三个交叉口 crossing 场景](https://arxiv.org/html/2605.03491v1/x2.png)

这张图适合检查场景覆盖范围。交叉口是对抗鲁棒性评测的合理起点，但还不能代表高速、环岛、遮挡和混合交通所有风险。

## 实验结论与证据

摘要报告三类模型在 nominal prediction 上可能都达到 ADE 小于 0.08，但 PGD 攻击可导致最高约 8 米 final displacement error。结果说明状态结构设计和架构归纳偏置会显著影响 adversarial stability，即使常规预测精度相近，鲁棒性 profile 也可能完全不同。

## 应用场景与启发

- 应用场景：离线轨迹学习鲁棒性评测、自动驾驶策略攻击基准、intersection scenario safety analysis 和模型结构对比。
- 方法启发：安全评测不能只看 nominal ADE/FDE，还要看对输入扰动、状态表示变化和攻击强度的敏感性。
- 讨论问题：真实数据 open-loop 对抗评测如何和 CARS、MDrive 这类闭环 scenario benchmark 连接，形成从轨迹偏移到事故责任的证据链。

## 局限与阅读风险

该框架主要是 open-loop offline evaluation，不等同于真实闭环 ADS 测试。PGD 扰动是否对应可实现的物理攻击、传感器攻击或 V2X 数据污染，需要进一步界定。三个交叉口场景能说明真实数据评测价值，但覆盖范围仍有限。

## 后续跟进

- 检查真实交叉口数据来源、状态表示定义和攻击约束。
- 把 nominal ADE/FDE 与 attacked FDE 同时记录，避免把普通轨迹误差当作安全结论。
- 和 Still Camouflage、MORPH-U、CARS 一起读，整理自动驾驶攻防从感知攻击、V2X 触发到策略鲁棒性的链路。
