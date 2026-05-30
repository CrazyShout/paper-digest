---
{
  "id": "sparseworld-sparse-scene-world-model",
  "tag": "world-models",
  "tags": ["world-models", "end-to-end-autonomous-driving"],
  "title": "SparseWorld: Enhancing End-to-End Autonomous Driving via World Models with Sparse Scene Representation",
  "source": "arXiv:2605.24354 / https://arxiv.org/abs/2605.24354",
  "authors": ["Ruoyu Wang", "Jingke Wang", "Yukai Ma", "Yuehao Huang", "Shuangming Lei", "Guanglin Xu", "Aixue Ye", "Yong Liu"],
  "affiliations": ["Institute of Cyber-Systems and Control, Zhejiang University", "2012 Labs, Huawei", "State Key Laboratory of Industrial Control Technology"],
  "comment": "SparseWorld 把驾驶世界模型从 dense future generation 改成稀疏 agent/map rollout，用关键布局预测服务 motion prediction 和 planning。"
}
---

## 一句话定位

SparseWorld 是一篇面向端到端驾驶的轻量世界模型论文。它的判断是：驾驶规划未必需要生成密集未来图像或完整 BEV 表征，预测关键 agent 和 map layout 的稀疏未来实例，就能降低冗余计算并给 planner 提供更直接的交互线索。

## 论文要解决的问题

近期驾驶世界模型常用 dense scene representation，能表达丰富环境信息，但计算成本高，且很多像素级细节不直接服务规划。对于下游 trajectory planning，更重要的是哪些车、行人、车道线和地图元素会如何演化。SparseWorld 要解决的问题是：如何用稀疏场景元素做 autoregressive rollout，并把这些未来实例反馈到 motion prediction 和 ego planning。

## 方法和系统设计

- 先用 instance-aware E2E baseline 从历史传感器输入中抽取 agent 和 map instances、action conditions 以及初始 trajectories。
- Sparse Dreamer 在 latent space 中自回归预测未来 agent/map instances，使用 joint temporal and spatial attention 捕捉场景演化。
- 下游 planner 通过与预测未来实例交互，生成更安全的轨迹，并在 nuScenes 开环和 Bench2Drive 闭环指标上评估。

## 关键图与可视化结果

![图 1：SparseWorld 与 dense world model 设计的对比](https://arxiv.org/html/2605.24354v1/x1.png)

这张图说明论文的主要取舍：不再把世界模型等同于完整未来观测生成，而是只生成规划相关的关键布局，减少冗余。

![图 2：SparseWorld 对未来 agent 和 map instances 的预测可视化](https://arxiv.org/html/2605.24354v1/figures/png/Sparseworld-visualize-resize-1106-1045.png)

这张图支撑“稀疏未来足够服务规划”的直觉。阅读时要看预测实例是否保留了互动目标和道路结构，而不是追求视觉层面的完整画面。

## 实验结论与证据

摘要报告 SparseWorld 在 nuScenes 开环 planning metrics 上降低碰撞风险，并在 Bench2Drive 闭环指标中超过 baseline。证据重点是稀疏未来实例对 motion prediction 和 trajectory planning 的收益，而不是单纯 future reconstruction 质量。

## 应用场景与启发

- 应用场景：E2E planner 的轻量 future reasoning、稀疏世界模型、闭环规划增强。
- 方法启发：世界模型可以围绕 planning-relevant entities 设计，不必默认生成 dense video 或 dense BEV。
- 讨论问题：稀疏未来表示在长尾遮挡、交通灯、施工区域和非结构化道路里是否仍能覆盖足够的决策变量。

## 局限与阅读风险

稀疏表示的上限取决于 instance extraction 是否可靠。如果上游漏检关键参与者，Sparse Dreamer 无法从空实例中恢复未来风险。论文报告闭环指标，但仍需核对不同场景类型、失败案例和计算预算，确认轻量化没有牺牲罕见风险覆盖。

## 后续跟进

- 查看项目页和补充材料，确认 Sparse Dreamer 代码、配置和 Bench2Drive 评测协议是否开放。
- 与 DriveWAM、EponaV2 对照：一个强调稀疏实例，一个强调视频生成先验，一个强调未来图像/深度/语义。
- 把稀疏未来实例作为后续世界模型 ablation 的一个可复现表示。
