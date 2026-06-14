---
{
  "id": "camasa-v2x-trajectory-dataset",
  "tag": "cooperative-trajectory-prediction",
  "tags": ["cooperative-trajectory-prediction", "vehicle-road-cooperation"],
  "title": "CAMASA: A CAM-based Dataset from the MASA Living Lab",
  "source": "arXiv:2606.10641 / https://arxiv.org/abs/2606.10641 ; dataset: https://www.automotivesmartarea.it/dataset/",
  "authors": ["Salvatore Iandolo", "Marco Savarese", "Gaetano Orazio Cauchi", "Antonio Solida", "Martin Klapez", "Maurizio Casoni", "Angelo Porrello", "Carlo Augusto Grazia"],
  "affiliations": ["Department of Engineering \"Enzo Ferrari\", University of Modena and Reggio Emilia"],
  "comment": "CAMASA 提供来自 Modena Automotive Smart Area 的真实 CAM/DENM 数据，把 V2X 轨迹预测从合成或传感器中心数据推进到基础设施记录的通信动态。"
}
---

## 一句话定位

CAMASA 是车路协同和协同轨迹预测方向的数据资产论文。它的价值不在复杂模型，而在真实 V2X 通信数据：超过 4000 万条 CAM 和 200 万条 DENM，来自 MASA 城市 living lab 的多月基础设施采集。

## 论文要解决的问题

轨迹预测 benchmark 多数依赖车端传感器、固定区域或合成移动轨迹，很少包含真实 V2X 通信过程。实际 C-ITS 系统里，CAM/DENM 带有 stationID 变化、RSU 覆盖差异、通信频率、真实城市交通密度和安全事件分布。论文要解决的是把这些通信层特性清洗成可用于 motion forecasting、time-series analysis 和 digital twin 的轨迹级数据。

## 方法和系统设计

- 数据来自 Modena Automotive Smart Area 的 RSU 网络，记录 ETSI ITS 框架下的 CAM 和 DENM 消息。
- 预处理包括过滤异常消息、处理隐私驱动的 stationID 切换、轨迹拼接、时间归一化和 10 Hz 插值。
- 论文提供 raw dataset 和 processed dataset，后者包含重建车辆轨迹、关键运动属性和可分析的时间序列。
- 作者将 CAMASA 与 V2AIX、Argoverse 2、Waymo、OPV2V 等数据集对比，强调 CAM/DENM、真实数据和轨迹长度的差异。

## 关键图与可视化结果

![图 1：MASA 的真实路侧网络和 DSRC 采集结构](../../assets/papers/camasa-v2x-trajectory-dataset-figure-1.png)

图 1 说明 CAMASA 不是仿真数据，而是由城市中的 RSU、服务器和 DSRC 车辆共同形成的 living-lab 采集网络。这个图支撑了论文的数据来源可信度。

![图 2：通过多个 RSU 重建单车轨迹](../../assets/papers/camasa-v2x-trajectory-dataset-figure-2.png)

图 2 展示同一车辆轨迹被不同 RSU 接收和拼接的过程。它对应 CAMASA 的核心难点：轨迹不是车端连续传感器输出，而是来自多个基础设施接收点和隐私化 stationID 的重建结果。

## 实验结论与证据

论文报告数据集包含超过 40M CAM、2M DENM、超过 14000 km 重建车辆路径和大量唯一 station IDs。作者展示 RSU 统计、DENM 类型、轨迹持续时间、距离、速度和 stationID switch 率，并与现有 ITS/trajectory dataset 对比。证据重点是规模、真实性、通信消息类型和可用于 10 Hz trajectory forecasting 的处理流程。

## 应用场景与启发

- 应用场景：V2X 轨迹预测、C-ITS digital twin、SUMO 校准、RSU 覆盖分析、通信感知联合建模。
- 方法启发：协同预测不一定只依赖多车感知特征，真实 CAM/DENM 可以提供通信层轨迹和事件先验。
- 讨论问题：如何把 CAM/DENM 这种低维通信数据与 camera/LiDAR 协同感知数据融合到同一个预测模型。

## 局限与阅读风险

CAMASA 是基础设施记录的通信数据，不包含完整原始图像或 LiDAR 感知流，因此不能直接替代感知 benchmark。数据来自 Modena 特定城市区域，交通规则、RSU 布局和 V2X penetration rate 会影响外推。stationID reconciliation 也会引入清洗假设。

## 后续跟进

- 下载 dataset，检查 raw/processed 格式和 license。
- 尝试用 CAMASA 做最小轨迹预测 baseline，并和 OPV2V/DAIR-V2X 的感知型数据形成互补。
- 关注 DENM 事件是否能作为安全关键场景挖掘信号。
