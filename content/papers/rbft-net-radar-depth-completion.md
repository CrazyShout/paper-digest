---
{
  "id": "rbft-net-radar-depth-completion",
  "tag": "radar-occupancy-representation",
  "tags": ["radar-occupancy-representation", "dynamic-scene-representation"],
  "title": "RbFT-Net: Rectify-Before-Fuse Temporal Radar Anchors for 4D Radar-Camera Depth Completion",
  "source": "arXiv:2608.13102 / https://arxiv.org/abs/2608.13102 / HTML: https://arxiv.org/html/2608.13102",
  "authors": ["Wentao Zhao", "Shouxuan Wu", "Yongtao Cen", "Tianchen Deng", "Yuyang Zhang", "Jingchuan Wang"],
  "affiliations": ["School of Automation and Intelligent Sensing, Institute of Medical Robotics, Shanghai Jiao Tong University", "School of Electronic and Information Engineering, Beijing Jiaotong University", "State Key Laboratory of Advanced Rail Autonomous Operation, Beijing Jiaotong University"],
  "comment": "RbFT-Net 把多帧 4D 雷达回波视为待校正的时序锚点，而不是天然准确的深度真值；网络先修正投影位置和量测深度并估计可靠性，再选择性传播。五帧输入在 ZJU-4DRadarCam 上达到 44.88 FPS，且有跨平台零样本与少样本验证。"
}
---

## 一句话定位

RbFT-Net 给雷达中心场景表示一个很具体的工程原则：多帧叠加只会增加点数，不会自动增加可信度；在稀疏量测向稠密深度传播之前，必须先校正图像位置、距离和逐点可靠性，否则少量 multipath、动态错位或标定误差会污染大片像素。

## 论文要解决的问题

4D 成像雷达具备 range、azimuth、elevation 和 Doppler，在低照度和不利天气中提供直接度量信息，但角分辨率低、点稀疏，且受 clutter、multipath、跨帧动态和 radar-to-camera 投影误差影响。直接累计 5-7 帧虽能近线性增加回波，错误点也随之增加；常见传播网络会把一个错误深度扩散到物体边界两侧。

许多强方法依赖额外单目深度模型提供结构先验，参数和部署复杂度较高。RbFT-Net 试图用一个独立 radar-camera 网络完成“校正 - 筛选 - 稠密化”，并检查它是否跨不同传感器平台有效。

## 方法和系统设计

- 将当前与历史雷达直接投影到当前图像，保留它们作为 noisy temporal anchor candidates，而不是先假设 ego-motion 对齐后就准确。
- Radar Query Sampling 在候选投影附近多尺度采样图像特征；Radar-Centered Attention 先聚合局部雷达一致性，再检索视觉上兼容的证据。
- Multi-Attribute Fusion 同时预测图像平面偏移、metric depth correction 和 pointwise reliability，得到校正锚点。
- 稠密传播对目标像素先找邻近锚点，再以可靠性和 target-anchor compatibility 共同打分，只聚合前四个；最终由轻量 MFN-CSPN++ 融合当前帧雷达、图像和传播结果。

## 关键图与可视化结果

![图 1：多帧雷达先经过位置、深度和可靠性校正，再做选择性传播与融合](https://arxiv.org/html/2608.13102v1/overview.png)

图 1 把“rectify before fuse”落实到完整数据流。当前帧原始量测仍单独保留，历史锚点则必须通过可靠性门，避免网络为了增加密度而丢掉量测来源与时间风险。

![图 2：预测可靠性与锚点深度误差、实际传播使用率之间的关系](https://arxiv.org/html/2608.13102v1/confidence_analysis.png)

图 2 是比最终深度图更重要的可审计结果：高可靠组总体误差更低，也更常被传播。关系并非绝对，因为最终选择还依赖局部兼容性，说明 reliability 不是孤立阈值。

## 实验结论与证据

在 ZJU-4DRadarCam 的 0-70 m 范围，五帧 RbFT-Net 取得 MAE 1001.0 mm、RMSE 2740.8 mm、delta1 0.943 和 44.88 FPS；独立方法 JustDepth 为 1307.8/3479.0 mm、delta1 0.888，带额外 DPT-Hybrid 的 TacoDepth 为 983.1/2779.6 mm、delta1 0.932。RbFT-Net 参数 44.20M，约为完整 plug-in 管线的三分之一。

帧数从 1 增至 5 时，RbFT-Net RMSE 从 2987.3 降到 2740.8 mm，7 帧反而回升到 2760.2；直接累计的 RadarCam 和 BP-Net 收益很小。新采集平台上，零样本 RbFT-Net 相对 JustDepth 的 MAE 降 22.6%，相对 RadarCam 的 RMSE 降 18.2%，再用 10% 目标训练集微调 3 epochs 后仍为最优。论文声明新数据和协议将公开，但扫描时未给可用链接。

## 应用场景与启发

- 应用场景：低成本 radar-camera metric depth、恶劣天气几何补全、雷达辅助 occupancy 的前端锚点生成，以及跨车型传感器适配。
- 方法启发：时序雷达特征进入 occupancy 前，应显式输出位置修正、距离误差和传播可靠性，而不是让后端注意力隐式吸收全部噪声。
- 研究启发：将 pointwise reliability 扩展为 free/occupied/unknown 的证据权重，并把 Doppler 一致性、遮挡和跨帧身份纳入 target-anchor compatibility。
- 讨论问题：模型在晴天 LiDAR 教师下学到的 reliability，遇到雨雾中教师退化时是否仍校准，还是会复制相机/LiDAR 偏差？

## 局限与阅读风险

任务终点是相机视角稠密深度，不是三维语义 occupancy、未来 occupancy flow 或规划闭环；不能因为使用 4D radar 就称为时空四维表示。训练监督仍来自 LiDAR 投影，尚未验证恶劣天气下教师和相机同时退化。五帧直接投影没有显式对象运动模型，7 帧退化已说明长历史会放大错位。新数据集规模和下载资产尚未公开，跨平台结论目前只能依据论文表格复核。

## 后续跟进

- 在 K-Radar 或恶劣天气数据上检查 reliability calibration，并按天气、距离、动态/静态和 multipath 分层。
- 将校正锚点接到 occupancy head，比较无校正、只校正位置、只校正深度和完整可靠性传播。
- 用径向 Doppler 和跨帧对象假设限制长历史关联，观察能否突破 5 帧后性能回落。
