---
{
  "id": "decouplegs-interactive-driving-testing",
  "tag": "autonomous-driving-testing",
  "tags": ["autonomous-driving-testing", "3d-reconstruction", "end-to-end-autonomous-driving"],
  "title": "DecoupleGS: Interactive 3D Gaussian Splatting for End-to-End Autonomous Driving Testing",
  "source": "ECCV 2026 / https://eccv.ecva.net/virtual/2026/poster/5765 / arXiv:2608.01761 / https://arxiv.org/abs/2608.01761",
  "authors": ["Siying Li", "Ying Ni", "Haotian Shi", "Jie Sun", "Jian Sun"],
  "affiliations": ["College of Transportation, Tongji University", "Key Laboratory of Road and Traffic Engineering, Ministry of Education"],
  "comment": "DecoupleGS 把驾驶场景拆为持久静态背景和可操纵的规范化动态车辆，并通过压缩、地图配准和代理光照实现实时重组。它少见地把神经重建指标接到响应式交通和端到端驾驶测试，但闭环仍只覆盖相机、刚体车辆和代理物理。"
}
---

## 一句话定位

DecoupleGS 试图同时满足神经渲染驾驶模拟最难兼得的三项要求：真实场景外观、可插拔动态交通和实时闭环；它把静态背景与车辆资产解耦，再用感知剪枝和向量量化压缩资产、地图语义约束几何配准、代理光照统一外观。

## 论文要解决的问题

游戏引擎可交互但外观与真实采集有域差，静态 3DGS 真实却不能随意移动车辆，视频生成模型又难以同时保证多视角几何一致、低延迟和可控交通。对端到端驾驶测试而言，单纯提高 PSNR 不够；测试场景必须随着被测策略实时更新，并能把车辆放到可驾驶的语义位置。

## 方法和系统设计

- 用高保真 3DGS 表示持久背景，把每辆动态交通参与者归一化为独立 canonical asset，运行时按场景重新组合。
- 先按感知冗余剪除 Gaussian，再用向量量化压缩外观与几何属性，使多车同时渲染仍接近实时。
- 用道路拓扑和地图语义约束车辆尺度、姿态与轨迹，用低成本 proxy relighting 把环境光照迁移到插入资产；交通响应由 IDM/MOBIL 等规则驱动。

## 关键图与可视化结果

![图 1：游戏引擎、静态 3DGS、生成模型与 DecoupleGS 的能力边界对照](https://arxiv.org/html/2608.01761v1/x1.png)

图 1 把论文的评价对象说清楚：DecoupleGS 并非只做新视角合成，而是要求背景、资产和策略反馈形成循环。因此，真正需要检查的是渲染真实性是否和交互真实性同时成立。

![图 2：静态背景、压缩车辆资产、地图配准与代理光照组成的解耦流水线](https://arxiv.org/html/2608.01761v1/x2.png)

图 2 显示三类工程模块分别处理内存、几何和光照冲突。模块清晰也意味着它们可被独立消融，而不是把所有收益归给 3DGS 表示本身。

## 实验结论与证据

论文在 15 个 nuScenes 片段、10 个 PandaSet 序列和 20 个 3DRealCar 资产上评估。小型压缩配置报告车辆 PSNR 28.10、总体 PSNR 29.25、SSIM 0.898、LPIPS 0.252、68.5 FPS 和约 850 MB。闭环对照中，完整系统报告 driving score 0.884、route completion 0.956、minimum TTC 3.3 s 与 45 FPS；论文列出的 HUGSIM 对照为 0.765、0.814、2.3 s 与 12 FPS。

这些结果说明解耦表示能在论文场景中兼顾实时渲染和可响应交通，并优于静态或低速神经渲染基线。它们不等价于现实事故分布、全传感器闭环或道路交通动力学已被忠实复现。

## 应用场景与启发

- 应用场景：真实采集背景中的 cut-in、跟车和车辆插入测试，端到端相机策略回归，以及动态资产复用。
- 方法启发：神经模拟器应把几何配准、光照一致性、实时性和策略后果分成独立准入门，而不是用单一图像分数放行。
- 研究问题：能否让雷达、LiDAR 和 occupancy 共享同一解耦场景状态，并对每种传感器建立独立物理审计？

## 局限与阅读风险

代理光照不处理全局照明、多次反射、镜面效应和真实投影；高架等复杂拓扑可能破坏地图配准。动态对象限于刚体车辆，交通行为主要由简化规则生成。当前闭环集中在相机观测，不能证明雷达、LiDAR、雨雾或传感器时序也被一致模拟。ECCV 2026 状态来自 arXiv 作者声明，扫描时未找到正式 proceedings，因此主链接仍保留 arXiv。

## 后续跟进

- 为每个插入资产记录几何、光照、碰撞体和动力学误差，不把渲染成功当作行为可信。
- 在相同场景状态上同步渲染相机、LiDAR、4D 雷达和 occupancy 真值，做跨模态一致性检查。
- 用多个规划器和不同交通模型复测闭环结论，观察安全排名是否依赖 IDM/MOBIL。
