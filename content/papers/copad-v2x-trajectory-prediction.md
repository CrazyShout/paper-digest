---
{
  "id": "copad-v2x-trajectory-prediction",
  "tag": "cooperative-trajectory-prediction",
  "tags": ["cooperative-trajectory-prediction", "vehicle-road-cooperation", "cooperative-autonomous-driving"],
  "title": "CoPAD: Multi-source Trajectory Fusion and Cooperative Trajectory Prediction with Anchor-oriented Decoder in V2X Scenarios",
  "source": "IROS 2025 / arXiv:2509.15984 / https://arxiv.org/abs/2509.15984",
  "authors": ["Kangyu Wu", "Jiaqi Qiao", "Ya Zhang"],
  "affiliations": ["作者单位见论文 PDF"],
  "comment": "CoPAD 是近期协同轨迹预测里较直接的一篇 V2X 工作，用多源轨迹融合、历史交互注意力和 anchor-oriented decoder 处理单车感知轨迹不稳定的问题。"
}
---

## 一句话定位

CoPAD 是一篇 V2X 场景下的协同轨迹预测论文。它把车端和路侧的多源历史轨迹先做轻量融合，再用时间注意力和稀疏 anchor 解码未来轨迹，核心价值在于把协同信息从“补感知范围”推进到“稳定预测输入”。

## 论文要解决的问题

轨迹预测通常假设历史轨迹可靠，但单车感知在遮挡、远距离、小目标和传感器噪声下会产生断裂、漂移和漏检。V2X 可以提供更多视角，但多源轨迹存在重复、时序不齐和质量差异。CoPAD 的问题是：如何在不引入过重通信和模型复杂度的前提下，把车端与路侧轨迹融合成更完整的历史上下文，并让预测器利用交互信息输出多模态未来。

## 方法和系统设计

- 多源轨迹融合模块用 Hungarian matching 和 Kalman filtering 对车端、路侧轨迹进行早期融合，降低重复和断裂。
- Past Time Attention 模块建模历史轨迹之间的潜在交互，补充单点或单帧协同感知无法表达的时序依赖。
- Mode attention 和 anchor-oriented decoder 用稀疏 anchors 生成多样化未来轨迹，避免只输出单一平均轨迹。

## 关键图与可视化结果

![图 1：CoPAD 总体框架，包含多源轨迹融合、历史时间注意力、模式注意力和 anchor-oriented decoder](https://arxiv.org/html/2509.15984v1/1.png)

这张图展示了 CoPAD 的信息流：协同不发生在最终预测结果之后，而是从历史轨迹质量控制开始。对组内复现来说，最值得关注的是融合模块和预测模块是否可以拆开评估。

![图 2：CoPAD 在 V2X 场景中的多源轨迹输入与预测输出示意](https://arxiv.org/html/2509.15984v1/2.png)

这张图支撑论文对“多源轨迹更完整”的主张。它能帮助读者检查模型收益到底来自 V2X 视野补全，还是来自 decoder 对多模态轨迹的更好表达。

## 实验结论与证据

论文在 DAIR-V2X-Seq 数据集上评估，并声称 CoPAD 达到 state-of-the-art cooperative trajectory prediction 表现。摘要给出的证据链主要是融合模块提升历史轨迹完整性，PTA 捕捉历史交互，anchor decoder 提升多样性。详细阅读时应重点核对每个模块的消融，以及不同遮挡、距离和路侧参与程度下的收益是否一致。

## 应用场景与启发

- 应用场景：车路协同轨迹预测、路口遮挡目标预测、V2X planner 输入预处理和轨迹数据质量增强。
- 方法启发：协同预测的第一步可能不是换更大的预测网络，而是把多源历史轨迹融合做稳。
- 讨论问题：当 V2X 轨迹融合出错时，预测器应该显式建模不确定性，还是把错误交给后续 planner 吸收。

## 局限与阅读风险

CoPAD 主要围绕 DAIR-V2X-Seq 展开，能否迁移到更复杂城市路网、异构传感器配置和通信延迟条件仍需验证。早期融合依赖匹配和滤波质量，一旦多源轨迹 ID association 错误，后续预测可能会放大错误。

## 后续跟进

- 优先检查 DAIR-V2X-Seq 上的评估协议、消融表和公开代码状态。
- 复现时单独记录 fusion-only、PTA-only、mode attention 和 anchor decoder 的贡献。
- 和 Co-MTP 对照：一个偏多源轨迹质量控制，一个偏多时间 V2X 融合，适合组成协同预测 baseline 组合。
