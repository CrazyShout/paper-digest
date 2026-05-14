---
{
  "id": "urbanv2x-cooperative-navigation",
  "tag": "vehicle-road-cooperation",
  "tags": ["vehicle-road-cooperation", "cooperative-autonomous-driving"],
  "title": "UrbanV2X: A Multisensory Vehicle-Infrastructure Dataset for Cooperative Navigation in Urban Areas",
  "source": "IEEE ITSC 2025 / arXiv:2512.20224 / https://arxiv.org/abs/2512.20224 / https://polyu-taslab.github.io/UrbanV2X/",
  "authors": ["Qijun Qin", "Ziqi Zhang", "Yihan Zhong", "Feng Huang", "Xikun Liu", "Runzhi Hu", "Hang Chen", "Wei Hu", "Dongzhe Su", "Jun Zhang", "Hoi-Fung Ng", "Weisong Wen"],
  "affiliations": ["The Hong Kong Polytechnic University and collaborators"],
  "comment": "UrbanV2X 提供香港 C-V2X 测试场里的车端和路侧多传感器数据，价值在于把车路协同导航从仿真或单模态感知推进到真实城市数据资产。"
}
---

## 一句话定位

UrbanV2X 是一个面向城市车路协同导航的多传感器数据集。它的核心新意不是提出一个新网络，而是提供车端和路侧同步采集的 camera、LiDAR、4D radar、UWB、IMU、GNSS-RTK/INS 等数据，用真实 Hong Kong C-V2X testbed 支撑协同导航研究。

## 论文要解决的问题

车路协同研究长期缺少真实、多模态、可标定、可同步的数据。很多方法在仿真或单车数据集上验证，难以评估路侧基础设施在定位、感知覆盖和导航鲁棒性上的真实贡献。UrbanV2X 的问题定义是：如何构建一个覆盖车端与路侧传感器、包含时间同步和标定信息、并能支持 cooperative navigation benchmark 的城市数据资产。

## 方法和系统设计

- 车端平台包含多工业相机、LiDAR、4D radar、UWB、IMU 和高精度 GNSS-RTK/INS。
- 路侧基础设施提供 LiDAR、GNSS 和 UWB 测量，并和车端通过 Precision Time Protocol 做同步。
- 数据集提供传感器标定和导航算法 benchmark，降低后续研究从数据清洗到评估协议的启动成本。

## 关键图与可视化结果

![图 1：UrbanV2X 数据集总体概览，展示车辆、路侧基础设施和协同导航数据流](https://arxiv.org/html/2512.20224v1/pic/Overview.png)

这张图说明 UrbanV2X 的价值在“系统形态”而非单一算法。它把车端感知、路侧基础设施和通信同步放在同一数据框架里，适合作为车路协同研究的数据入口。

![图 2：UrbanV2X 车端与路侧传感器系统架构](https://arxiv.org/html/2512.20224v1/pic/sys_architecture.png)

这张图帮助读者检查数据集是否足以支撑自己的任务：如果研究关注定位、同步误差、UWB 辅助或路侧 LiDAR 视角，这里的传感器组合比普通单车数据集更匹配。

## 实验结论与证据

论文报告数据来自香港 C-V2X testbed，并提供同步、标定和多类传感器数据，还 benchmark 多种导航算法。证据价值在于真实设备、真实城市环境和公开数据，而不是某个单一模型指标。对车路协同方向，它可以支撑基础设施辅助定位、V2I 感知覆盖、UWB/GNSS 融合和多传感器协同导航等后续实验。

## 应用场景与启发

- 应用场景：车路协同导航、路侧辅助定位、V2I 数据融合、城市 C-V2X 测试场评估和多传感器标定流程。
- 方法启发：车路协同 benchmark 需要把时间同步、标定、坐标系转换和通信假设显式写进协议。
- 讨论问题：如果只用车端数据能达到接近表现，路侧基础设施的增益应该用遮挡、长尾和定位退化场景来重新定义。

## 局限与阅读风险

数据集论文的直接贡献是数据资产和 benchmark，不等同于证明某个协同算法已经达到部署级效果。需要继续检查场景规模、路线多样性、天气/光照覆盖、标注粒度和数据许可。若后续研究只在 UrbanV2X 上做离线融合，还要额外补闭环导航或安全收益评估。

## 后续跟进

- 下载项目页数据样例，确认传感器时间戳、标定文件和 benchmark 代码格式。
- 选取一个最小任务做基线复现：GNSS/UWB 融合定位或路侧 LiDAR 辅助导航。
- 和 DAIR-V2X、V2X-Seq 等数据集对比，整理各自适合的协同感知、预测和导航任务。
