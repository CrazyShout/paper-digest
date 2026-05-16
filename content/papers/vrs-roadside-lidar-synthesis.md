---
{
  "id": "vrs-roadside-lidar-synthesis",
  "tag": "vehicle-road-cooperation",
  "tags": ["vehicle-road-cooperation", "3d-reconstruction"],
  "title": "Generating Roadside LiDAR Datasets from Vehicle-Side Datasets via Novel View Synthesis",
  "source": "arXiv:2605.05897 / https://arxiv.org/abs/2605.05897",
  "authors": ["Yuhan Xia", "Runxin Zhao", "Hanyang Zhuang", "Chunxiang Wang", "Ming Yang"],
  "affiliations": ["School of Automation and Intelligent Sensing, Shanghai Jiao Tong University", "Key Laboratory of System Control and Information Processing, Ministry of Education of China", "Global College, Shanghai Jiao Tong University"],
  "comment": "VRS 用车端 LiDAR 数据合成带标注的路侧 LiDAR 数据，针对真实 roadside 数据稀缺和跨视角 domain gap 做补全、可见性约束和 novel view synthesis。"
}
---

## 一句话定位

VRS 是一篇车路协同数据生成论文。它把已有 vehicle-side LiDAR 数据转成 virtual roadside LiDAR 数据，目标是缓解路侧 3D 感知数据少、标注贵、视角覆盖不足的问题，并让合成数据能实际提升 roadside 3D object detection 的泛化。

## 论文要解决的问题

路侧感知能扩大自动驾驶系统的观察范围，但大规模带标注 roadside LiDAR 数据集远少于车端数据。直接用车端数据训练路侧模型会遇到 viewpoint gap、遮挡差异和缺失几何。VRS 的问题是：如何从车端点云中恢复更完整几何，再从目标路侧视角渲染出带标注点云，使其能作为真实路侧数据的补充。

## 方法和系统设计

- 输入带标注的 vehicle-side point cloud，先把场景分解为静态背景和动态车辆。
- 对观测不足的车辆实例做过滤，并对保留车辆做 point cloud completion，恢复更完整的物体几何。
- 引入 occupancy-based visibility constraint 处理跨视角渲染中的大视角变化，并支持多虚拟 roadside LiDAR pose 的灵活渲染。

## 关键图与可视化结果

![图 1：VRS 总体流程，从车端点云分解、补全、神经场重建到目标路侧 LiDAR 视角渲染](https://arxiv.org/html/2605.05897v1/x1.png)

这张图展示 VRS 为什么不是简单坐标变换：它需要先处理动态车辆、缺失几何和静态背景，再通过 novel view synthesis 合成路侧视角。

![图 2：VRS 生成多个虚拟路侧 LiDAR 视角的点云结果](https://arxiv.org/html/2605.05897v1/x4.png)

这张图支撑数据生成主张。需要关注合成点云是否保留清晰几何结构，以及不同 roadside pose 下物体可见性是否合理。

## 实验结论与证据

摘要报告 VRS 在 roadside 3D object detection 实验中有效补充真实 roadside 数据，缓解有限真实数据的限制，并提升对 unseen roadside viewpoints 的泛化。证据重点是合成数据能否带来检测模型增益，而不是单纯点云视觉质量。

## 应用场景与启发

- 应用场景：路侧 LiDAR 数据扩增、V2I 感知模型预训练、虚拟路侧设备选址评估和跨视角感知泛化测试。
- 方法启发：车路协同数据资产可以通过 NVS 和几何补全从车端数据派生，但必须显式处理可见性和缺失几何。
- 讨论问题：合成 roadside 数据在检测上有效，是否也能迁移到 tracking、trajectory prediction 和 cooperative planning。

## 局限与阅读风险

合成数据是否覆盖真实路侧设备的噪声、安装高度、扫描模式、天气退化和交通密度仍需检查。VRS 主要服务 roadside perception，尚未证明对下游 V2X planning 或 closed-loop safety 有直接收益。若目标视角过大或车端观测缺失严重，补全结果可能引入不真实结构。

## 后续跟进

- 检查数据生成代码和与真实 roadside 数据混合训练的比例。
- 和 UrbanV2X、Evaluating Roadside Perception 对照，整理真实数据、合成数据和评测协议之间的关系。
- 如果后续做车路协同数据扩增，应把 unseen viewpoint 泛化作为必测项。
