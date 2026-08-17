---
{
  "id": "geoup-unified-3d-perception",
  "tag": "3d-reconstruction",
  "tags": ["3d-reconstruction"],
  "title": "Geometry-Grounded Unified 3D Perception for Autonomous Driving",
  "source": "arXiv:2608.13147 / https://arxiv.org/abs/2608.13147 / Project: https://buaa-colalab.github.io/geoup_page",
  "authors": ["Longfei Xu", "Xiaohui Wang", "Zehao Huang", "Han Li", "Ya Yang", "Naiyan Wang", "Si Liu"],
  "affiliations": ["School of Computer Science and Engineering, Beihang University", "School of Computer Science, Beijing University of Posts and Telecommunications", "School of Artificial Intelligence, Beihang University"],
  "comment": "GeoUP 将 VGGT 的重建式几何 latent 适配到标定的多相机视频，再让深度、3D 检测和语义 occupancy 成为同一场景表征的表面、实例与体积读出。联合五个数据集后，Occ3D-nuScenes 达到 42.3 mIoU 和 47.0 RayIoU。"
}
---

## 一句话定位

GeoUP 的核心不是简单多任务，而是把 camera-only 驾驶感知的共享骨干从“语义识别预训练”换成“多图像三维重建预训练”：先让 latent 保留 metric geometry、跨相机对应和时间一致性，再分别读出 depth、3D box 与 semantic occupancy。

## 论文要解决的问题

常见驾驶感知骨干由 ImageNet、DINO 或视觉语言目标预训练，语义强但没有显式度量三维结构；几何通常由下游 BEV lift、depth head 或 query 模块补上。不同任务各自学习几何，既重复，也难确保深度表面、对象实例和体素占据描述的是同一场景。

VGGT 具备多图像重建先验，但原模型不面向固定标定的环视视频，也没有针对不同相机和连续帧拆分对应关系。GeoUP 因此研究重建 foundation latent 能否成为统一驾驶表征，而不是只作为深度初始化。

## 方法和系统设计

- 以 VGGT/DINOv2 为基础，将 cross-image attention 分解为单图 self、同相机 temporal 和同时间 cross-view 三类，分别建模局部语义、时间对应和相机间几何。
- 用相机内外参构造 Plucker raymap，并与 patch token、camera token 一起输入骨干，使度量尺度和标定不只存在于下游 head。
- 深度、3D detection 和 occupancy head 从不同层子集读取同一 geometry-grounded latent；多任务联合可让表面、实例和体积监督互相补充。
- 联合 nuScenes、Argoverse 2、Waymo、DDAD 和 KITTI，只有具备相应标注的数据更新对应 head，并用数据集特定类别与空间范围避免强行统一标签。

## 关键图与可视化结果

![图 1：GeoUP 与 OPUS-V2 的语义 occupancy 对照，重点观察道路布局和周边结构](https://arxiv.org/html/2608.13147v1/vis_occ.png)

图 1 显示共享几何 latent 能读出更连贯的道路与周边结构。它是当前时刻 camera occupancy 的定性结果，不包含雷达、未来时间轴或占据不确定性，不能误读为 radar-centric spatiotemporal occupancy。

![图 2：由预测深度重建的 KITTI/DDAD 点图展示跨视角度量几何](https://arxiv.org/html/2608.13147v1/vis_depth.png)

图 2 说明 latent 没有在多任务训练后丢掉 VGGT 的重建能力。清晰点图支持几何一致性，但仍需数值深度和 occupancy 指标确认，视觉完整不代表 free space 校准正确。

## 实验结论与证据

GeoUP 覆盖 nuScenes、Argoverse 2、Waymo 的 3D 检测，Occ3D-nuScenes 的 occupancy，以及 KITTI/DDAD 的深度。Occ3D 单数据集训练达到 41.5 mIoU、45.9 RayIoU；五数据集联合后为 42.3/47.0。KITTI 上相对原 VGGT，Abs Rel 从 0.102 降至 0.075，delta<1.25 从 89.8% 升到 92.9%；DDAD 达到 0.123 Abs Rel 与 87.6%。

消融中，VGGT 预训练相对随机同结构使检测 mAP/NDS 提升 2.5/1.7 点、occupancy mIoU/RayIoU 提升 1.7/0.8 点；检测与 occupancy 联训又从各自 55.9 mAP/39.8 mIoU 提升到 56.4/40.3。论文还将骨干接入同一 DriveSuprim decoder 做 NAVSIM v2 对照，说明几何预训练不只改善像素任务，但详细闭环外推仍有限。

## 应用场景与启发

- 应用场景：环视 camera 的统一 3D 感知骨干、异构标注联合训练、camera occupancy 和规划前端。
- 方法启发：不同传感器或任务应先共享几何可解释的场景 latent，再用轻量 head 读出，而不是在每个任务后端重新构建三维空间。
- 研究启发：Radar Occupancy 可借用同一 surface-instance-volume 分层，但必须额外注入 Doppler、量测可见性和传感器特定 unknown，不应把 camera latent 当唯一真值。
- 讨论问题：统一 latent 已经共享，任务 head 仍完全分离；能否用查询式统一 decoder 同时约束深度表面、对象和占据一致性？

## 局限与阅读风险

视觉几何骨干参数大、速度有限，作者也将部署效率列为首要限制。Occupancy 只在 nuScenes 有监督，所谓五数据集联合并不意味着五个数据集都提供 occupancy 真值。三个 head 仍是任务特定，统一主要发生在 backbone。camera-only 表征对黑暗、雾雨、反光和无纹理区域的可观测性没有显式建模；高平均指标不能替代不确定性和规划后果审计。

## 后续跟进

- 在相同预算下比较识别预训练、单目深度预训练和重建预训练，报告参数、FPS、显存与三任务 Pareto。
- 加入跨任务一致性损失，检查深度表面、3D box 和 occupancy 是否在同一区域相互矛盾。
- 将 radar ray/Doppler token 接入 geometry latent，并保留单传感器 head，量化融合收益是否来自真实雷达证据。
