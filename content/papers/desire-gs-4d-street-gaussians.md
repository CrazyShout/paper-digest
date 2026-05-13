---
{
  "id": "desire-gs-4d-street-gaussians",
  "tag": "3d-reconstruction",
  "title": "DeSiRe-GS: 4D Street Gaussians for Static-Dynamic Decomposition and Surface Reconstruction for Urban Driving Scenes",
  "source": "CVPR 2025 / https://openaccess.thecvf.com/content/CVPR2025/html/Peng_DeSiRe-GS_4D_Street_Gaussians_for_Static-Dynamic_Decomposition_and_Surface_Reconstruction_CVPR_2025_paper.html",
  "authors": ["Chensheng Peng", "Chengwei Zhang", "Yixiao Wang", "Chenfeng Xu", "Yichen Xie", "Wenzhao Zheng", "Kurt Keutzer", "Masayoshi Tomizuka", "Wei Zhan"],
  "affiliations": ["UC Berkeley"],
  "comment": "用自监督 4D Gaussian Splatting 做静动态分解和表面重建，是驾驶场景三维重建方向质量较高的近期样本。",
  "visual": "visual-grid",
  "visualLabel": "4D street GS"
}
---

## 导读判断

DeSiRe-GS 值得入选，是因为它处理的是驾驶场景 3DGS 中最难的一类问题：动态物体、数据稀疏和表面漂浮。它不依赖额外 3D bounding box 标注，而是做自监督静动态分解和表面重建，和组内三维重建、仿真生成、可评估场景建模都有直接关系。

## 研究背景与问题

自动驾驶场景不是静态室内重建。道路、建筑、车辆、行人同时存在，车辆还会快速移动。普通 3DGS 容易在动态区域产生鬼影或漂浮高斯，导致渲染看起来不错但几何不可信。对驾驶系统而言，这类错误会影响仿真、地图更新和下游感知评测，所以需要一种能区分静态背景和动态对象、并保持表面物理合理性的表示。

## 方法主线

- 论文采用两阶段优化流程，先根据 3DGS 对动态区域重建不佳这一现象提取 2D motion masks。
- 第二阶段把这些 2D motion priors 可微地映射到 Gaussian 空间，形成动态街景高斯表示。
- 方法加入几何正则和时序跨视角一致性，减少数据稀疏带来的过拟合，让高斯更贴合物体表面而不是漂浮在空中。

## 实验与证据

CVPR 2025 版本报告了复杂城市驾驶场景中的静动态分解、表面重建和新视角合成效果。论文强调自监督方法能超过已有自监督方法，并达到接近依赖外部 3D bounding box 标注方法的准确性。对本项目来说，关键不是单张渲染图是否漂亮，而是它是否改善动态对象的几何一致性和表面可信度。

## 和组内方向的关系

这篇论文可以作为三维重建方向的核心模板：研究目标不只是 photorealistic rendering，而是可用于自动驾驶仿真和评测的几何表示。它也能和世界模型方向联动，后续可以讨论 3DGS 场景是否能作为闭环仿真的状态空间，或者作为世界模型生成结果的几何约束。

## 局限与阅读风险

自监督 motion prior 的质量会影响静动态分解结果，复杂天气、夜间、低纹理道路和长尾交通参与者可能仍有风险。方法属于 per-scene optimization 还是可泛化模型，需要在复现时明确。另一个风险是渲染指标提升不等于可驾驶仿真可靠，还需要下游规划或感知评测验证。

## 后续跟进

- 优先检查代码和数据，确认是否能在 Waymo、KITTI 或自有驾驶数据上复现。
- 复现实验不要只看 PSNR/SSIM，要加入动态区域深度误差和表面一致性检查。
- 组会可讨论：驾驶场景 3DGS 的成功标准应是视觉质量、几何准确，还是下游闭环可用性。
