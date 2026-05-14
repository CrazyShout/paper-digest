---
{
  "id": "co-mtp-v2x-trajectory-prediction",
  "tag": "cooperative-trajectory-prediction",
  "title": "Co-MTP: A Cooperative Trajectory Prediction Framework with Multi-Temporal Fusion for Autonomous Driving",
  "source": "ICRA 2025 / arXiv:2502.16589 / https://arxiv.org/abs/2502.16589",
  "authors": ["Xinyu Zhang", "Zewei Zhou", "Zhaoyi Wang", "Yangjie Ji", "Yanjun Huang", "Hong Chen"],
  "affiliations": ["Tongji University"],
  "comment": "Co-MTP 把 V2X 信息用于轨迹预测，而不只停留在单帧协同感知。它把基础设施历史观测、预测结果和 ego planning action 一起放进异构图，适合讨论车路协同如何真正服务未来行为建模。"
}
---

## 一句话定位

Co-MTP 是一篇面向 V2X 轨迹预测的 ICRA 2025 工作，重点是把协同信息拆成历史域和未来域来使用。它回答的问题不是“路侧感知能否看得更远”，而是“基础设施提供的历史轨迹、预测结果和 ego 规划意图如何共同改善未来多模态轨迹预测”。

## 论文要解决的问题

单车轨迹预测在遮挡、交叉口、远距离车辆和复杂交互中经常缺少完整历史轨迹。已有 V2X 研究多集中在检测或 BEV 感知，默认更完整的感知会自然改善预测，但预测任务还需要理解历史运动模式、道路拓扑、agent-agent 交互以及 ego 自身规划动作。Co-MTP 的切入点是多时间域融合：过去用协同观测补全历史，未来用 ego planning 和基础设施预测建模交互。

## 方法和系统设计

- 论文把来自 AV 和 infrastructure 的轨迹数据、地图元素、基础设施预测结果和 ego planning action 构造成异构场景图。
- 历史域侧重补全 AV 视角下缺失或不稳定的历史轨迹，缓解遮挡和视野受限带来的输入偏差。
- 未来域把 ego planning 与其他交通参与者意图纳入图交互，使预测不只是孤立 agent 轨迹外推，而是 planning-conditioned scene forecasting。

## 关键图与可视化结果

![图 1：Co-MTP 总体架构，展示基础设施信息共享、异构图构造、多时间融合和多模态轨迹解码](https://arxiv.org/html/2502.16589v3/overview.jpg)

这张架构图说明 Co-MTP 的信息流不是简单特征拼接。基础设施先共享历史和预测结果，系统再把交通参与者与地图元素放进相对坐标系下的异构图，最后通过 Transformer 层和多模态解码器输出未来轨迹。

![图 2：STFA 异构图示意，展示 AV 历史节点、基础设施节点、规划节点和预测节点之间的未来交互关系](https://arxiv.org/html/2502.16589v3/STFA_1.png)

这张图是理解论文贡献的关键：V2X 信息不只补当前观测，还作为独立节点参与未来交互建模。它将“协同预测”从数据增强问题转成图结构设计问题，方便后续做消融和替换。

## 实验结论与证据

论文在 V2X-Seq 数据集上评估，主要关注多模态轨迹预测精度、模型消融、噪声分析和时间延迟评估。它的证据价值在于消融粒度较清楚：可以分别检查历史融合、未来融合、STFA 图结构和基础设施信息对预测的贡献。定性案例覆盖 following、highway、speed up、wait to turn 等场景，能观察预测轨迹与历史/未来真值之间的关系。

## 应用场景与启发

- 应用场景：车路协同交叉口预测、遮挡车辆历史轨迹恢复、高速合流、多车交互预测和 planner 评估前的场景未来生成。
- 方法启发：协同轨迹预测应显式区分“过去补全”和“未来交互”，否则很难判断 V2X 信息到底在哪个时间段起作用。
- 讨论问题：如果 ego planning action 进入预测模型，那么预测与规划之间是否应该联合训练，而不是先预测再规划。

## 局限与阅读风险

V2X-Seq 是真实数据，但真实部署中的时间同步、通信延迟、标定漂移和基础设施故障仍可能比论文设定更复杂。另一个风险是 ADE/FDE 的提升并不自动说明规划安全改善，特别是在多模态预测中，模型可能给出更接近真值的轨迹集合，却仍无法被 downstream planner 稳定利用。

## 后续跟进

- 检查 V2X-Seq 的传感器同步、基础设施视角和时间延迟建模。
- 复现时优先做无 V2X、仅历史融合、历史+未来融合、加入 ego planning 四组对照。
- 继续跟进 planning-conditioned prediction 是否能接入闭环规划评估。
