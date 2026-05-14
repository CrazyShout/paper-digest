---
{
  "id": "driving-3d-reconstruction",
  "tag": "3d-reconstruction",
  "tags": ["3d-reconstruction", "world-models"],
  "title": "示例：Dynamic 3D Reconstruction for Driving Scenes",
  "source": "CVF / project page",
  "authors": ["Nora Wang", "Isaac Miller"],
  "affiliations": ["Carnegie Mellon University", "Google DeepMind"],
  "comment": "关注驾驶场景的动态三维重建，可用于地图更新、仿真生成和下游感知评测。",
  "visual": "visual-grid",
  "visualLabel": "3D scene"
}
---

## 核心问题

自动驾驶场景中的三维重建不仅要恢复静态道路结构，还要处理动态车辆、行人和光照变化。样例论文关注如何构建可复用的动态场景表示。

## 方法速读

- 融合多帧相机和激光雷达信息，估计静态结构与动态目标。
- 使用显式运动分解降低动态物体带来的重建伪影。
- 输出可渲染、可查询的场景表示，用于仿真和评测。

## 组内关注点

后续抓取时可以把 3DGS、NeRF、occupancy、HD map 更新都纳入同一方向，但需要区分是否真正面向驾驶场景。
