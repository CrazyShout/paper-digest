---
{
  "id": "splatad-realtime-3dgs-gpt",
  "revisionOf": "splatad-realtime-3dgs",
  "tag": "3d-reconstruction",
  "tags": ["3d-reconstruction", "end-to-end-autonomous-driving"],
  "title": "SplatAD: Real-Time LiDAR and Camera Rendering with 3D Gaussian Splatting",
  "source": "arXiv:2411.16816 / https://arxiv.org/abs/2411.16816",
  "authors": ["Georg Hess", "Carl Lindström", "Maryam Fatemi", "Christoffer Petersson", "Lennart Svensson"],
  "affiliations": ["Zenseact / Chalmers University of Technology"],
  "comment": "[GPT改] 修正原版中的 KITTI/Waymo 和图注错配问题：论文实验数据集是 PandaSet、Argoverse2、nuScenes，核心是 3DGS 的相机与 LiDAR 联合渲染。"
}
---

## 一句话定位

SplatAD 是一篇把 3D Gaussian Splatting 扩展到自动驾驶传感器仿真的论文。它关注的不是通用 3D 重建展示，而是从自动驾驶日志中学习一个可微、实时、同时支持相机和 LiDAR novel view synthesis 的场景表示。

## 论文要解决的问题

自动驾驶仿真需要能重放和改写真实日志中的传感器观测。NeRF 类方法可以做到较真实的相机/LiDAR 渲染，但速度慢；已有 3DGS 方法速度快，却主要覆盖相机，不能有效建模 LiDAR 的稀疏扫描、360 度视场、ray drop、intensity 和 rolling shutter。论文的问题定义是：能否基于 3DGS 统一渲染相机图像和 LiDAR 点云，并保留自动驾驶传感器特性。

## 方法和系统设计

- 用静态背景 Gaussian 和动态 actor Gaussian 组成场景表示，支持修改 ego 或其他 actor 的位置。
- 相机分支沿用 3DGS 的 tile-based rasterization，但加入自动驾驶场景中的 rolling shutter 处理。
- LiDAR 分支不把点云硬投到深度图，而是在球坐标中做自定义 CUDA 加速栅格化，按 LiDAR 扫描几何处理 azimuth、elevation、range 和 capture time。
- 每个 Gaussian 携带 learnable feature，再分别解码为相机颜色、LiDAR intensity 和 ray drop probability。
- 训练和评估覆盖 PandaSet、Argoverse2、nuScenes，而不是 KITTI 或 Waymo。

## 关键图与可视化结果

![图 1：论文的总体定位，强调 SplatAD 同时支持 camera 和 lidar 的实时高质量渲染](https://arxiv.org/html/2411.16816v3/x1.png)

这张图是论文的 high-level teaser，不是具体架构图。它对比了既有方法在速度、多模态支持和质量上的位置，说明 SplatAD 想兼顾相机/LiDAR 渲染质量和速度。

![图 2：SplatAD 方法总览，展示静态/动态 3D Gaussians、相机/LiDAR 投影、rolling shutter 修正和各模态解码](https://arxiv.org/html/2411.16816v3/x2.png)

这张才是方法框架图。原版把它写成 KITTI/nuScenes 定性结果是不对的。真正的定性 NVS 结果在附录 Figure 7-9，分别对应 nuScenes、PandaSet 和 Argoverse2。

## 实验结论与证据

论文在 PandaSet、Argoverse2、nuScenes 上评估相机 NVS、LiDAR NVS 和重建质量。指标包括图像侧 PSNR/SSIM/LPIPS/FID，点云侧 median squared depth error、RMSE intensity error、ray drop accuracy、Chamfer distance 等。摘要中给出的核心结果是：相机 NVS 最多约 +2 PSNR、重建最多约 +3 PSNR，并相对 NeRF 方法提升一个数量级的渲染速度；LiDAR 渲染质量接近 NeuRAD 的 ray tracing 形式，同时最高可快到 18 倍。

## 应用场景与启发

- 用真实日志构建可编辑传感器仿真场景。
- 在多传感器感知算法开发中生成相机和 LiDAR 一致的 novel view 数据。
- 为闭环仿真提供比 NeRF 更快、比相机-only 3DGS 更完整的传感器渲染基础。

## 局限与阅读风险

这篇论文证明的是相机/LiDAR 渲染能力，不等同于完整自动驾驶闭环仿真系统。动态 actor 仍依赖可用的场景标注或轨迹信息；天气、传感器退化、雷达等其他模态没有被系统覆盖。阅读时不要把“real-time rendering”外推为任意分辨率和任意部署硬件上的固定 FPS。

## 后续跟进

- 检查代码和模型是否能复现实验表中的速度与质量。
- 对比 NeuRAD、Street Gaussians、PVG 等方法在动态 actor 和 LiDAR 强度建模上的取舍。
- 关注 3DGS 传感器仿真如何接入规划闭环，而不是只停留在 novel view synthesis。
