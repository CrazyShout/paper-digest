---
{
  "id": "desire-gs-4d-street-gaussians",
  "tag": "3d-reconstruction",
  "title": "DeSiRe-GS: 4D Street Gaussians for Static-Dynamic Decomposition and Surface Reconstruction for Urban Driving Scenes",
  "source": "CVPR 2025 / arXiv:2411.11921 / https://openaccess.thecvf.com/content/CVPR2025/html/Peng_DeSiRe-GS_4D_Street_Gaussians_for_Static-Dynamic_Decomposition_and_Surface_Reconstruction_CVPR_2025_paper.html",
  "authors": ["Chensheng Peng", "Chengwei Zhang", "Yixiao Wang", "Chenfeng Xu", "Yichen Xie", "Wenzhao Zheng", "Kurt Keutzer", "Masayoshi Tomizuka", "Wei Zhan"],
  "affiliations": ["UC Berkeley"],
  "comment": "DeSiRe-GS 用自监督 4D Gaussian Splatting 做城市驾驶场景的静动态分解和表面重建。它的价值在于把视觉渲染质量、动态对象处理和几何可信度放到同一个驾驶场景表示问题里。"
}
---

## 一句话定位

DeSiRe-GS 是 CVPR 2025 的驾驶场景 4D Gaussian Splatting 工作，目标是在没有额外 3D bounding box 标注的情况下，同时做好静动态分解、动态街景表示和高保真表面重建。它适合作为三维重建和驾驶仿真方向的高质量样本。

## 论文要解决的问题

普通 3DGS 在静态或受控场景里效果很好，但自动驾驶数据包含快速移动的车辆、行人、稀疏多视角、长距离道路和复杂遮挡。动态区域容易产生 ghosting、漂浮高斯和表面不一致，导致图像看起来能渲染，却难以作为仿真、地图更新或下游评测的可靠几何表示。DeSiRe-GS 的问题是：如何在自监督设置下从驾驶视频中分离静态背景和动态对象，并让动态区域的几何更贴合真实表面。

## 方法和系统设计

- 论文采用两阶段优化：先利用动态区域重建误差提取 2D motion masks，再将这些 motion priors 可微映射到 Gaussian 空间。
- 表示层面构建 4D street Gaussian，将静态背景与动态对象分开建模，避免动态物体污染静态场景。
- 正则设计包括 Gaussian scale、跨视角一致性和表面约束，目标是减少漂浮高斯，并提升动态区域几何质量。

## 关键图与可视化结果

![图 1：DeSiRe-GS pipeline，展示自监督 motion prior、静动态分解和 4D street Gaussian 优化流程](https://arxiv.org/html/2411.11921v2/figures_low_res/pipeline4.png)

这张图是理解论文方法的入口。DeSiRe-GS 不依赖外部 3D 框标注，而是从渲染误差和 motion masks 中获得动态先验，再把二维动态线索转到 Gaussian 空间中约束场景表示。

![图 2：DeSiRe-GS 与 S3Gaussian、PVG 的定性对比，展示动态驾驶场景中的渲染和分解效果](https://arxiv.org/html/2411.11921v2/figures_low_res/qualitative_comp_2.png)

这张定性对比图需要和表格一起读。它能展示 DeSiRe-GS 在动态对象边界、道路结构和局部表面质量上的优势，但定性图本身不能证明几何可用于闭环驾驶，还需要深度一致性和下游任务验证。

## 实验结论与证据

论文在 Waymo Open Dataset、KITTI 等驾驶数据上比较重建、novel view synthesis、静动态分解和渲染质量，并与自监督方法以及带 3D bbox 标注的方法对照。它的关键证据不只是 PSNR/SSIM/LPIPS，而是动态区域和表面重建质量的改善。多视角一致性深度图进一步说明方法在几何侧有收益，不只是生成更漂亮的图像。

## 应用场景与启发

- 应用场景：驾驶仿真资产构建、动态场景重放、闭环规划场景编辑、道路数字孪生和下游感知算法评测。
- 方法启发：驾驶 3DGS 的成功标准不能只看新视角渲染，还要看动态对象是否分离、表面是否可信、几何是否能被下游任务消费。
- 讨论问题：4DGS 场景表示能否成为世界模型 rollout 或闭环仿真的几何底座，而不是只做离线可视化。

## 局限与阅读风险

自监督 motion prior 的质量是核心风险。夜间、雨雾、低纹理道路、稀有交通参与者和强反光场景可能破坏动态分解。另一个风险是 per-scene optimization 的效率和泛化能力；如果每个场景都需要较重优化，它更适合作为数据资产构建工具，而不一定适合实时驾驶系统。

## 后续跟进

- 检查代码开放情况、每个场景的优化时间和 Waymo/KITTI 数据预处理。
- 复现时加入动态区域深度误差、表面一致性和下游感知评测，而不只看渲染指标。
- 跟进 4DGS 与驾驶世界模型、闭环仿真 benchmark 的结合方式。
