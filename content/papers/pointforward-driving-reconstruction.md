---
{
  "id": "pointforward-driving-reconstruction",
  "tag": "3d-reconstruction",
  "tags": ["3d-reconstruction"],
  "title": "PointForward: Feedforward Driving Reconstruction through Point-Aligned Representations",
  "source": "arXiv:2605.11594 / https://arxiv.org/abs/2605.11594",
  "authors": ["Cheng Chi", "Xianqi Wang", "Hongcheng Luo", "Mingfei Tu", "Gangwei Xu", "Zehan Zhang", "Bing Wang", "Guang Chen", "Hangjun Ye", "Sida Peng", "Xin Yang", "Haiyang Sun"],
  "affiliations": ["作者单位见论文 PDF"],
  "comment": "PointForward 用 world-space sparse 3D queries 和 point-aligned representation 做 feedforward driving reconstruction，目标是减少 pixel-aligned 3DGS 的多视角不一致和 layering artifacts。"
}
---

## 一句话定位

PointForward 是一篇 feedforward driving reconstruction 论文。它的核心判断是，快速 3DGS 重建不能只靠 per-pixel Gaussian prediction；驾驶多视角场景需要显式的 3D 查询、跨视角对应和动态实例一致性，否则容易出现 layering、ghosting 和运动目标不稳定。

## 论文要解决的问题

近期 feedforward 3DGS 方法速度快，但很多采用 pixel-aligned Gaussian prediction，容易在多视角之间产生不一致。动态驾驶场景还需要处理移动车辆和行人，如果只用 dense flow 表示动态实例，缺少明确的 cross-view correspondence 和 instance-level consistency。PointForward 的问题是：如何在单次前向推理中得到速度和一致性兼顾的驾驶场景重建。

## 方法和系统设计

- 在 world space 初始化 sparse 3D queries，而不是从每个像素独立预测 Gaussian。
- 将多视角图像信息投影并聚合到 3D queries 上，通过 spatial-temporal fusion 得到 point-aligned representations。
- 用 scene graph 显式组织动态实例，结合 3D bounding boxes 做 instance-level motion propagation，保持动态物体时间一致性。

## 关键图与可视化结果

![图 1：PointForward 与 pixel-aligned 方法的视觉对比，展示其减少 layering artifacts 和恢复细结构的效果](https://arxiv.org/html/2605.11594v1/x1.png)

这张图说明论文抓住的是 feedforward 重建里的结构性 artifact，而不仅是提升平均渲染指标。

![图 2：PointForward 总体架构，展示 world-space 3D queries、多视角聚合、时空融合和 scene-graph 动态建模](https://arxiv.org/html/2605.11594v1/x2.png)

这张图可以和 DUST 对照阅读：DUST 解决协同异步时间线，PointForward 解决快速前向重建中的显式 3D 对齐和动态实例一致性。

## 实验结论与证据

摘要称 PointForward 在大规模驾驶 benchmark 上达到 state-of-the-art，并能产生更清晰结构、更干净边界和更少 ghosting artifacts。证据主线是 point-aligned representation 比 pixel-aligned prediction 更适合多视角一致重建，scene graph 动态建模则支撑 moving instances 的时间一致性。

## 应用场景与启发

- 应用场景：自动驾驶 3D/4D 重建、快速仿真资产生成、多视角渲染、动态场景回放和数据闭环。
- 方法启发：feedforward 速度和几何一致性不是对立项，关键是让表征从像素对齐转向世界空间点对齐。
- 讨论问题：PointForward 的前向重建能否接入 Real2Sim 式编辑、物理仿真或 MDrive 式闭环场景生成。

## 局限与阅读风险

论文摘要没有列出具体数据集、指标和代码发布时间，需要核对实验设置是否覆盖真实动态交通、长时序和极端视角。使用 3D boxes 与 scene graph 组织动态实例，也意味着方法可能依赖检测或标注质量。若目标是闭环仿真，还需要进一步验证几何一致性是否足以支撑下游 planner。

## 后续跟进

- 等代码发布后检查输入格式、推理速度和是否依赖 3D box 标注。
- 与 DUST、Real2Sim、SplatAD 形成重建方向对照表：异步协同、物理可编辑、实时渲染、feedforward 一致性。
- 复现时除了图像指标，还应加入动态 object boundary、cross-view consistency 和 downstream perception 指标。
