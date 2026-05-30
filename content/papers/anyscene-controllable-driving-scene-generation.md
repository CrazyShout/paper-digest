---
{
  "id": "anyscene-controllable-driving-scene-generation",
  "tag": "world-models",
  "tags": ["world-models", "autonomous-driving-testing", "3d-reconstruction"],
  "title": "AnyScene: Towards Highly Controllable Driving Scene Generation at Anywhere and Beyond",
  "source": "arXiv:2605.26113 / https://arxiv.org/abs/2605.26113",
  "authors": ["Haiming Zhang", "Junfei Zhou", "Feng Jiang", "Jingzhong Li", "Zhenglong Guo", "Penglin Dai", "Jifeng Dai", "Yan Xie", "Benjin Zhu"],
  "affiliations": ["Li Auto", "Southwest Jiaotong University", "Tsinghua University"],
  "comment": "AnyScene 用 BEV layout 条件生成 semantic occupancy，再做 geometry-grounded view expansion，目标是生成可控、多视角、长时域驾驶场景数据。"
}
---

## 一句话定位

AnyScene 是一篇可控驾驶场景生成论文。它从 BEV layout 出发，先生成 semantic occupancy sequence，再基于 occupancy 做多视角 driving video generation，目标是让合成数据既可按布局控制，又能支持 arbitrary camera rigs 和下游 3D reconstruction。

## 论文要解决的问题

端到端自动驾驶需要大量长尾安全关键场景，但现有 occupancy-guided 视频生成通常依赖浅层条件机制和参考帧，难以从任意 BEV layout 精细控制，也不利于跨数据集和用户自定义场景。AnyScene 的问题是：如何把 BEV 布局转成可控的 occupancy 动态，再扩展成时序一致的多视角视频。

## 方法和系统设计

- 使用 Spatial-Temporal Occupancy Diffusion Transformer，从 BEV layout sequences 生成 semantic occupancy sequences。
- 将 occupancy 视为 canonical spatial representation，通过 Geometry-Grounded View Expansion 生成 temporally consistent multi-view driving videos。
- 支持 cross-dataset、user-defined BEV inputs、arbitrary camera configurations，并评估 occupancy/video generation 和 downstream sparse-view 3D reconstruction。

## 关键图与可视化结果

![图 1：AnyScene 从 BEV layout 生成 occupancy，再扩展为多视角驾驶视频](https://arxiv.org/html/2605.26113v1/x1.png)

这张图概括了 AnyScene 的两阶段结构：先生成空间语义占据，再以几何为锚点扩展到多视角视频。

![图 2：AnyScene 的 versatile generation，包括可控 occupancy、多视角和自定义相机配置](https://arxiv.org/html/2605.26113v1/x3.png)

这张图支撑“highly controllable”的主张。重点看它是否能在改变 BEV layout、文本属性和相机配置后保持时序一致性。

## 实验结论与证据

摘要报告 AnyScene 在 occupancy 和 video generation 上达到 state-of-the-art，并能泛化到 unseen 和 customized layouts，还对 sparse-view 3D reconstruction 有 measurable benefits。证据链连接了生成质量、控制能力和下游任务，而不是只展示视频效果。

## 应用场景与启发

- 应用场景：长尾驾驶场景合成、自动驾驶测试数据生成、可控多视角仿真、稀疏视角重建数据增强。
- 方法启发：occupancy 可以作为连接 BEV layout、视频生成和 3D reconstruction 的中间几何表示。
- 讨论问题：生成场景是否足以进入 closed-loop testing，还需要物理一致性、交通规则和 agent 行为约束。

## 局限与阅读风险

AnyScene 强调可控生成和下游重建收益，但不等于已经证明规划安全收益。生成数据的交通行为真实性、碰撞物理和与真实传感器噪声的一致性仍需进一步测试。

## 后续跟进

- 检查项目页是否开放模型和自定义 BEV layout 工具。
- 与 Bench2Drive-Robust 和 RS2AD-LiDAR 对照，整理测试场景生成、路侧数据生成和部署鲁棒评测的闭环关系。
- 将 occupancy-conditioned generation 纳入后续安全关键场景生成候选路线。
