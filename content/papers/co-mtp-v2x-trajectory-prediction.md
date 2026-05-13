---
{
  "id": "co-mtp-v2x-trajectory-prediction",
  "tag": "cooperative-trajectory-prediction",
  "title": "Co-MTP: A Cooperative Trajectory Prediction Framework with Multi-Temporal Fusion for Autonomous Driving",
  "source": "ICRA 2025 / arXiv:2502.16589 / https://arxiv.org/abs/2502.16589",
  "authors": ["Xinyu Zhang", "Zewei Zhou", "Zhaoyi Wang", "Yangjie Ji", "Yanjun Huang", "Hong Chen"],
  "affiliations": ["Tongji University"],
  "comment": "把 V2X 信息从单帧协同感知推进到历史轨迹补全和未来交互建模，是协同轨迹预测方向值得优先读的论文。",
  "visual": "visual-grid",
  "visualLabel": "V2X trajectory"
}
---

## 导读判断

Co-MTP 的价值在于它没有停留在协同感知，而是直接面向轨迹预测和规划。它把 V2X 的作用拆成两个时间域：历史域补全单车感知缺失，未来域建模 ego planning 与周围车辆意图之间的交互。这正好对应组内协同轨迹预测方向最核心的问题。

## 研究背景与问题

单车轨迹预测在遮挡、远距离目标和交叉口交互中容易缺历史轨迹，导致多模态预测偏差。已有 V2X 工作主要聚焦单帧检测或感知融合，却较少回答协同信息如何改善未来预测，甚至如何服务规划动作下的未来场景状态。Co-MTP 的切入点是让车辆和基础设施协同信息进入历史交互与未来交互，而不是只把它当作额外观测。

## 方法主线

- 在历史域，方法利用 V2X 补全单车视角下不完整的历史轨迹，并用异构图 Transformer 融合多源历史特征。
- 在未来域，方法进一步把 ego planning action 和其他车辆意图纳入图交互，估计给定规划动作下的未来场景状态。
- 论文把预测任务明确放到服务 planning 的语境中，而不是只输出孤立 agent 的未来轨迹。

## 实验与证据

论文在真实世界 V2X-Seq 数据集上评估，并报告 Co-MTP 达到当时 state-of-the-art。更重要的是，它的消融逻辑围绕历史融合和未来融合展开，能检查 V2X 信息到底在补历史、建交互还是支持规划上起作用。对组内来说，这比只看 ADE/FDE 排名更有参考价值。

## 和组内方向的关系

这篇可以作为协同轨迹预测方向的标准样本。它提醒我们，V2X 轨迹预测不是把更多观测拼进模型，而是要定义 V2X 在时间维度上的职责：过去补全、当前理解、未来交互和规划条件化。后续如果做车路协同预测，可以沿着这个时间域拆分去设计消融。

## 局限与阅读风险

论文仍需要重点核查同步误差、通信延迟和感知误差是否被充分建模。V2X-Seq 虽是真实数据，但真实部署中的异步、丢包和标定漂移可能更复杂。另一个风险是预测提升未必自动转化为规划收益，除非闭环规划指标能直接验证。

## 后续跟进

- 阅读 V2X-Seq 的数据定义，确认基础设施视角和车辆视角的时间同步假设。
- 复现时优先做历史域融合、未来域融合、无 V2X 三组消融。
- 组会可讨论：协同轨迹预测是否应该以 planning-conditioned prediction 作为默认问题定义。
