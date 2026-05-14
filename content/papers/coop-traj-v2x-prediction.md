---
{
  "id": "coop-traj-v2x-prediction",
  "tag": "cooperative-trajectory-prediction",
  "tags": ["cooperative-trajectory-prediction", "cooperative-autonomous-driving"],
  "title": "CoPAD: Multi-source Trajectory Fusion and Cooperative Trajectory Prediction with Anchor-oriented Decoder in V2X Scenarios",
  "source": "arXiv:2509.15984 / https://arxiv.org/abs/2509.15984",
  "authors": ["Kangyu Wu", "Jiaqi Qiao", "Ya Zhang"],
  "affiliations": ["作者单位见论文 PDF"],
  "comment": "CoPAD 提出一种轻量级协同轨迹预测框架，使用匈牙利算法和卡尔曼滤波做多源轨迹融合，配合 anchor-oriented decoder 在 DAIR-V2X-Seq 数据集上达到 SOTA。"
}
---

## 一句话定位

这是一篇面向 V2X 场景的轻量级协同轨迹预测论文，核心创新在于基于匈牙利算法和卡尔曼滤波的多源轨迹融合，以及基于稀疏锚点的 anchor-oriented decoder 生成高完整性预测轨迹。

## 论文要解决的问题

在车路协同（V2X）场景中，车辆和路侧基础设施各自采集轨迹数据，存在多源数据的不一致与冗余问题。现有协同预测方法在多源轨迹融合和预测多样性方面存在不足，难以同时保证轨迹的完整性和准确性。论文要解决的问题是：如何有效融合来自不同源的轨迹数据，并生成高完整性、高准确性的未来轨迹预测。

## 方法和系统设计

- **多源轨迹融合模块**：基于匈牙利算法进行轨迹匹配，再利用卡尔曼滤波对不同来源（车辆端、路侧端）的轨迹数据进行融合，解决多源数据的不一致与冗余问题。
- **Past Time Attention（PTA）模块**：在融合后的历史轨迹上引入注意力机制，捕捉多条轨迹之间的交互关系和时序依赖。
- **Mode Attention 模块**：用于丰富预测的多模态多样性，避免预测结果过于集中在单一模式。
- **Anchor-oriented Decoder（AoD）**：基于稀疏锚点（sparse anchors）的解码器，将锚点作为轨迹生成的参考，输出最终的预测轨迹，提升轨迹的完整性和准确性。

整体流程：多源轨迹输入 → 匈牙利匹配 + Kalman 融合 → PTA 捕捉历史交互 → Mode Attention 丰富多样性 → AoD 基于锚点生成轨迹。

## 关键图与可视化结果

论文共包含 4 幅图，展示框架整体架构、融合模块细节、anchor-oriented decoder 设计及 DAIR-V2X-Seq 数据集上的预测可视化结果。arXiv 页面无 HTML 版图片，请直接查阅 PDF：[CoPAD 论文 PDF](https://arxiv.org/pdf/2509.15984)。

## 实验结论与证据

- 论文在 DAIR-V2X-Seq 数据集上进行评估，该数据集是真实 V2X 场景的协同自动驾驶数据集。
- CoPAD 在 DAIR-V2X-Seq 上达到 state-of-the-art 性能，生成的轨迹同时具有高完整性和高准确性。
- 作为一个轻量级框架，在保证预测质量的同时控制了计算开销。

## 应用场景与启发

- 应用场景：车路协同自动驾驶中的轨迹预测、交叉口协同通行、多车协同决策。
- 方法启发：匈牙利算法 + 卡尔曼滤波的组合为多源轨迹融合提供了一种简洁有效的方案；基于稀疏锚点的解码器思路可以推广到其他需要结构化输出的预测任务。
- 讨论问题：轻量级融合方案在更复杂城市场景下的泛化能力；锚点数量和分布对预测质量的影响。

## 局限与阅读风险

- 论文仅在 DAIR-V2X-Seq 一个数据集上验证，泛化性有待在其他 V2X 数据集上进一步确认。
- 轻量级设计可能在极大规模场景或高密度交通流下表现受限。
- 稀疏锚点的选取策略对最终性能影响较大，其鲁棒性需要进一步分析。
- 论文篇幅较短（IROS 2025，7 页），部分设计细节可能描述不够充分，阅读时需结合代码理解。

## 后续跟进

- 关注是否开源代码，以便复现和消融实验验证。
- 关注 CoPAD 在其他 V2X 数据集（如 V2X-Sim、ROAD2）上的表现。
- 探索 anchor-oriented decoder 在其他结构化预测任务（如路径规划、行为预测）中的迁移潜力。
