---
{
  "id": "s2-vla-semantic-spatial",
  "tag": "end-to-end-autonomous-driving",
  "tags": ["end-to-end-autonomous-driving"],
  "title": "S-squared-VLA: Decoupling Semantic and Spatial Streams in Vision-Language-Action Models for Autonomous Driving",
  "source": "arXiv:2607.13926 / https://arxiv.org/abs/2607.13926",
  "authors": ["Jianguo Yu", "Rukang Wang", "Duanfeng Chu", "Chen Wang", "Renju Feng", "Liping Lu"],
  "affiliations": ["School of Mechanical and Electronic Engineering, Wuhan University of Technology", "Intelligent Transportation Systems Research Center, Wuhan University of Technology", "School of Computer Science and Artificial Intelligence, Wuhan University of Technology"],
  "comment": "把 VLA 的语义推理与连续空间特征分成两条流，再用辅助 BEV/目标监督补回几何约束；核心启发是不要让轨迹规划完全穿过离散语言瓶颈。"
}
---

## 一句话定位

S-squared-VLA 针对驾驶 VLA 的一个结构性问题：语言主干擅长语义推理，却会在深层 token 压缩中损失车道边界、曲率和障碍物距离。论文保留一条 VLM 语义流，同时从视觉编码器旁路出连续空间流，再由级联规划适配器融合意图与几何。它进入本期，是因为“空间表征坍缩”比简单叠加更大 VLM 更接近规划误差的根因。

## 论文要解决的问题

传统端到端驾驶缺少高层语义与可解释意图，VLM 能补上这部分；但把连续坐标和控制完全转成离散语言 token，会量化并压缩精细空间信息。现有单流 VLA 又把推理与执行纠缠在同一抽象表示中，容易出现语义正确、轨迹却压线或越界的情况。论文希望在不依赖 LiDAR 和迭代扩散解码器的情况下，用单前视相机同时保留语义判断与边界感知。

## 方法和系统设计

- Semantic stream 从 InternVL3-2B 的多层特征中提取层级语义，通过意图 token 保留场景理解和驾驶目标，而不是只使用最终语言层。
- Spatial stream 直接处理视觉编码器的未压缩特征，并用 BEV 静态地图与动态目标框/类别作为辅助监督，将车道结构和邻车状态显式写入空间表示。
- Dual-Stream Planning Adapter 先以语义决定高层意图，再用空间流做几何约束和残差细化；轨迹损失同时惩罚 L1 误差、过大加速度和 jerk。训练分 VQA SFT、意图/感知模块训练、规划细化三个阶段。

## 关键图与可视化结果

![图 1：S-squared-VLA 双流架构与级联规划适配器](https://arxiv.org/html/2607.13926v1/x2.png)

图 1 来自论文官方 arXiv HTML。语义流和空间流不是在末端简单拼接：语义特征先形成规划 token，空间特征随后校正可行边界。这种级联顺序表达了“先决定做什么，再检查在哪里能做”的结构假设。

![图 2：S-squared-VLA 与 InternVL3-2B 的轨迹定性对比](https://arxiv.org/html/2607.13926v1/x4.png)

图 2 展示官方定性结果，绿色为专家轨迹、橙色为预测。纯 VLM 在弯道和路口更容易产生持续几何偏移，双流模型的轨迹更贴近道路结构。图片支持“旁路空间特征减少边界偏差”，但不能单独证明真实闭环安全性。

## 实验结论与证据

论文在 NAVSIM navtest 上按纯监督训练口径比较，不引入 GRPO 等后训练。S-squared-VLA 只用单前视相机得到 PDMS 87.1、No Collision 98.4、Ego Progress 81.6；相较同一 InternVL3-2B 基线，PDMS 从 84.1 提升 3.0。它超过 ReCogDrive 86.5 和 ImagiDrive 86.4，也略高于使用 LiDAR 的 ARTEMIS 87.0，但仍低于 LiDAR+扩散解码的 DiffusionDrive 88.1。

消融给出了较清楚的收益链：多层语义特征把 PDMS 从 84.1 提到 85.6；加入空间流到 86.2，主要改善 DAC；再加入 BEV 地图和目标辅助监督到 87.1，并提升 NC 与 EP。这说明最终增益不是只来自更深规划头，而是语义、空间旁路和显式几何监督逐步叠加。

## 应用场景与启发

- 应用场景：适合用于低成本单目 VLA 规划、指令条件驾驶，以及现有 VLM 驾驶模型的几何安全增强。
- 方法启发：任何把轨迹通过语言 token 输出的系统，都应保留一条不经过自回归语言瓶颈的连续空间旁路，并分别消融语义与几何贡献。
- 讨论问题：训练时使用 BEV map/agent 辅助标签后，模型在真正缺少这些结构化标注的新城市中还能保持多少空间收益？

## 局限与阅读风险

证据集中在 NAVSIM 单一 benchmark，没有真实车辆、跨城市或传感器退化实验。比较为“各自监督训练设置”，但各方法输入传感器、骨干与训练数据并不完全相同；S-squared-VLA 的 87.1 也没有超过 DiffusionDrive。辅助 BEV 与目标监督降低了推理时传感器成本，却增加训练标注依赖。论文没有系统报告时延、显存和长序列推理成本，因此“更轻量”主要相对迭代扩散解码，而非完整部署结论。

## 后续跟进

- 复现时先固定 InternVL3-2B、训练样本和规划头，单独比较最终层、层级语义和空间旁路。
- 增加遮挡、低照、地图变化和跨城市测试，检查空间流是否真的比语言流更稳健。
- 后续关注双流结构能否与闭环后训练结合，以及两条流发生冲突时如何做风险仲裁。
