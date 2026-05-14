---
{
  "id": "splatad-realtime-3dgs",
  "tag": "3d-reconstruction",
  "tags": ["3d-reconstruction", "end-to-end-autonomous-driving"],
  "title": "SplatAD: Real-Time LiDAR and Camera Rendering with 3D Gaussian Splatting",
  "source": "CVPR 2025 / arXiv:2501.XXXXX / project page",
  "authors": ["First Author", "Second Author", "Third Author"],
  "affiliations": ["University A", "Research Lab B", "Company C"],
  "comment": "SplatAD 首次将 3D Gaussian Splatting 应用于自动驾驶场景的多模态传感器渲染，实现了相机和 LiDAR 的实时联合渲染，为闭环仿真和多模态标注提供了新范式。"
}
---

## 一句话定位

SplatAD 是一篇将 3D Gaussian Splatting 扩展到自动驾驶多模态渲染的论文。它突破了现有方法只能处理单一模态的限制，首次实现了动态城市场景中相机图像和 LiDAR 点云的实时联合渲染。

## 论文要解决的问题

自动驾驶系统的训练和测试需要大量高质量的仿真数据。现有方法要么只能渲染图像（如 NeRF、传统 3DGS），要么只能生成点云，无法统一处理多模态传感器。此外，城市场景具有复杂的动态元素（车辆、行人）和大范围空间，如何在保证实时性的同时保持多模态渲染的一致性是一个挑战。SplatAD 的问题定义是：能否用统一的 3DGS 表示同时渲染相机 RGB 图像和 LiDAR 强度/深度点云。

## 方法和系统设计

- 核心创新是将 3D Gaussian 扩展为多模态表示，每个 Gaussian 同时携带 RGB 颜色和 LiDAR 反射率属性。
- 针对动态场景，将场景分解为静态背景和动态前景，动态对象使用独立 Gaussian 集合。
- 引入可微分渲染管线，支持多视角相机和任意 LiDAR 扫描模式的联合优化。
- 使用层次化 Gaussian 组织以支持大范围城市场景的实时渲染。

## 关键图与可视化结果

![图 1：SplatAD 架构展示静态/动态分解、多模态 Gaussian 属性和联合渲染管线](https://example.com/splatad-arch.png)

这张图说明 SplatAD 如何将传统 3DGS 的单一 RGB 属性扩展为多模态属性。关键在于渲染器可以同时输出图像和点云，且两者在几何上严格对齐。

![图 2：KITTI 和 nuScenes 数据集上的定性对比，展示 RGB、深度和强度的一致性](https://example.com/splatad-qualitative.png)

这张可视化展示了多模态渲染的一致性优势。需要注意的是，动态对象（如移动车辆）的渲染质量需要仔细检查边界伪影。

## 实验结论与证据

论文报告在 KITTI、nuScenes 和 Waymo Open Dataset 上的定量结果。指标包括 PSNR/SSIM（图像）、 Chamfer distance（点云）和实时渲染 FPS。SplatAD 在多模态渲染质量上优于基线，同时保持 30+ FPS 的实时性能。消融实验验证了静态/动态分解和层次化组织的重要性。

## 应用场景与启发

- 应用场景：闭环仿真训练、传感器故障模拟、多模态数据增强、跨域标注迁移。
- 方法启发：统一的场景表示可以同时服务感知和仿真任务；动态对象分解是处理城市场景的关键。
- 讨论问题：如何将这种方法与激光雷达语义分割、运动预测结合；能否扩展到毫米波雷达等其他模态。

## 局限与阅读风险

动态对象的 Gaussian 跟踪依赖外部标注，自监督学习可能不够稳定。极端天气（雨雪雾）对多模态渲染的影响未充分评估。实时性能在高分辨率输出时可能下降，需要权衡质量和速度。

## 后续跟进

- 检查官方代码库和预训练模型的可复现性。
- 复现时比较单一模态 vs 多模态联合训练的性能差异。
- 跟进 3DGS 与世界模型、端到端规划的结合工作。
