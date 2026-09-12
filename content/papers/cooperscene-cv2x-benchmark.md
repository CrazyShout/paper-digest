---
{
  "id": "cooperscene-cv2x-benchmark",
  "tag": "cooperative-autonomous-driving",
  "tags": [
    "cooperative-autonomous-driving",
    "autonomous-driving-testing"
  ],
  "title": "CooperScene: Multi-Modal Cooperative Autonomy Benchmark with C-V2X Communication Characterization",
  "source": "ECCV 2026 / https://eccv.ecva.net/virtual/2026/poster/4574 / arXiv:2606.31219 / https://arxiv.org/abs/2606.31219",
  "authors": [
    "Bo Wu",
    "Ruoshen Mo",
    "Justin Yue",
    "Yanyu Zhang",
    "Janice Nguyen",
    "Guoyuan Wu",
    "Amit Roy-Chowdhury",
    "Matthew J. Barth",
    "Hang Qiu"
  ],
  "affiliations": [
    "University of California, Riverside"
  ],
  "comment": "CooperScene 是本期最贴近真实车路协同部署的数据与 benchmark：三辆 CAV 加一个 RSU，同步采集多模态感知和真实 C-V2X 通信链路。"
}
---

## 一句话定位

CooperScene 把三辆车与一个路侧单元的同步感知数据、统一标注和 C-V2X 网络测量放在同一 benchmark，揭示“更多视角”带来的准确率收益能被消息传输时间吞掉；其贡献首先是评测接口与证据，而不是新的最优检测器。

- 核心证据：四主体设置下，CoSDH 的表 2 AP@0.7 从无限网络的 0.52 降到 C-V2X 条件的 0.41，单帧共享 0.1785 MB、传输时间 893 ms；压缩后仍远超 100 ms 帧周期。
- 主要边界：真实无线测量、载荷传输测试与离线模型评测需区分；当前公开代码的 `cv2x` 模式按共享大小与默认 1.6 Mbps 计算异步延迟，不能自动当作逐包重放全部真实 trace。[表 2；官方实现说明](https://github.com/UCR-CISL/CooperScene#table-2-agent-settings-x-network)

## 论文要解决的问题

### 同步数据与真实通信为何都需要

多车融合需要传感器在时间、坐标和标注上对应，同时要求远端特征在决策截止时间前可用。以无限网络离线融合多车数据，可能高估现实收益；只测无线吞吐又无法判断丢掉哪些对象。CooperScene 联合记录这些变量，支持检测和后续轨迹预测，而不报告实车自主控制成功率。[§1、§4](https://arxiv.org/html/2606.31219v1#S1)

数据含 24 场景：16 个路口、4 个高速匝道、4 个停车场；约 59K LiDAR 帧、53K 图像和 344K 3D 框。车辆有相机、LiDAR、GNSS/IMU 和 MK6 电台；正文明确路侧平台不含相机。初始标注只覆盖 Car，不能由“多模态协同”推断已包含完整行人/骑行者 benchmark。[§3.1、3.5 脚注](https://arxiv.org/html/2606.31219v1#S3.SS1)

### 相关工作与差异

| 工作与一手来源 | 已有设计 | CooperScene 的具体增量 |
| --- | --- | --- |
| Xu 等，V2V4Real，CVPR 2023；[原文 v1 §3](https://arxiv.org/pdf/2303.07601v1) | 两辆车同步行驶，LiDAR/双相机/GPS-IMU；单车分别标框，再变换到统一坐标关联 ID，提供检测/跟踪/域适配任务。 | CooperScene 增至三车一路侧、结合硬件同步和无线测量；不能将“更多主体”理解为所有数据质量指标自动更优。 |
| Zimmer 等，TUMTraf-V2X，CVPR 2024；[原文 v1 §3.2、4.2](https://arxiv.org/html/2403.01316v1#S3.SS2) | 车路相机/LiDAR标定、每 10 帧 ICP 后插值，CoopDet3D 先各自做 camera–LiDAR BEV 融合，再跨侧 max fusion。 | CooperScene 用整段序列中的高重叠帧初始化，并在联合帧协调多主体；增加 C-V2X 测量，但没有在同一物理环境下直接证明比 TUMTraf 更准确。 |

## 方法和系统设计

### 采集与离线对齐

每个平台由 MK6 的 GNSS 时间作 PTP 全局基准；车载 LiDAR 输出 10 Hz GPIO 触发相机，实现“时钟同步”和“采样同步”两个步骤。附录指出 IMU 直接使用 GNSS PPS/UTC，其余传感器走 PTP，不能把所有设备一概说成同一触发源。[§3.2、附录 B.2](https://arxiv.org/html/2606.31219v1#S3.SS2)

ST-ICP 先按 GNSS/IMU 把点云转到全局 ENU，搜索各车辆整段序列里与路侧重叠最多的一帧作 pairwise ICP，再把校正传播到所有主体靠近的联合帧，执行联合 ICP。此处可以使用整段数据，因为它属于离线数据标注准备；不应把它描述为无需未来帧的在线定位算法。

检测器生成初始框，AB3DMOT 跟踪、全局 late fusion 去重复，再由专业标注者用 SUSTechPOINTS 校正。缺失帧用最近有效帧补齐，保持列表长度一致；这使“相同 frame ID”不一定代表每个主体都有新鲜采样，评测应保留帧来源与年龄。[§3.3–3.5、附录 C](https://arxiv.org/html/2606.31219v1#S3.SS3)

### 核心坐标与通信协议

原文 §3.3–3.4 的坐标链可归为一组：

$$
 T=T_{\rm JointICP}T_{\rm PairwiseICP}T_{\rm local}^{\rm global},\qquad
 AX=XB,\qquad T_{S_1}^{S_2}=(T_{S_2})^{-1}T_{S_1}.
$$

首式叠加多车姿态修正；eye-hand 中 $A,B$ 是 MoCap 标记与标定目标的相对运动，$X$ 将外贴标记坐标转换到传感器真实光学中心。最后一式由共同参考下的两传感器位姿生成外参。MoCap 的毫米定位精度不等于全部室外多车点云最终只有毫米误差；正文报告的是多数帧 ICP 残差约 0.2 m。[§3.4、§5](https://arxiv.org/html/2606.31219v1#S3.SS4)

通信配置为 20 MHz、20 dBm、自动 MCS、Eventflow、重传开启；每个 agent 用 Iperf2 同时收发 UDP，发送端设 5 Mbps、100 ms 汇总网络指标。载荷测试把模型消息分成 2100 byte 块、每 1 ms 发送一个。若只计算载荷的理想传输时间，可写成以下单位换算；它不是原文新的网络模型：

$$
 t_{\rm payload}\,[{\rm ms}]\approx\frac{8000\,S\,[{\rm MB}]}{B\,[{\rm Mbit/s}]}.
$$

$S$ 是消息大小，$B$ 是有效吞吐；协议头、重传、争用和排队还会增加时间。公开实现以 `share_size_mb` 与 `cv2x_throughput` 注入延迟，默认吞吐 1.6 Mbps；仅切换此开关不代表已经复现某段测得的丢包与抖动。[§4、附录 B.2；代码 README](https://github.com/UCR-CISL/CooperScene)

### 模型训练与测试边界

数据按 5:2:3 分成 train/validation/test，所有感知与预测基线在 CooperScene 重训。附录 B.3 给出 PointPillars 的 0.4 m 平面体素、每柱最多 32 点、最多 32K 非空柱；batch 4、约 40 epoch、RTX A6000 平台，随机翻转、±45° 旋转和缩放。具体优化器、精确学习率及各模型调参预算需要对应公开配置，不能由通用说明推定相同。

测试按 V+I、V+V、V+V+I、V+2V、V+2V+I 切换协作者；模型仍需远端感知输入。标注与 ST-ICP 提供的数据坐标是评测条件，不是在线模型自己预测的定位。

## 关键图与可视化结果

![原论文图 1：三车一路侧感知叠加及逐主体 C-V2X 吞吐面板](../../assets/papers/cooperscene-official-figure-1.png)

左侧红/绿/蓝/紫点分别对应三车和路侧，黄色为统一目标框；中间分开展示本地观测，右侧是各有向链路吞吐随帧变化。它把互补视角与动态通信并排展示，不能仅凭截图确认每个检测输出来自同刻的实网端到端执行。[原图 1](https://arxiv.org/html/2606.31219v1#S0.F1)

![原论文图 3：CMS 硬件、PoE、ROS 2、同步与无线收发](../../assets/papers/cooperscene-official-figure-3.png)

左边是采集平台实物，右边给出传感器、交换机、计算与无线接口。标出的 1/10 Gbps 是平台内有线链路能力，不是 C-V2X 空口吞吐；还需结合正文区分车载相机与不含相机的路侧配置。[原图 3](https://arxiv.org/html/2606.31219v1#S3.F3)

## 实验结论与证据

### 指标与匹配主表

检测报告 BEV/3D IoU 0.3/0.5/0.7 下的 AP，预测报告 1/3/5 s 的 minADE/minFDE（m）；不同表中检测列需按原表口径使用。下表沿表 2 的 AP@0.7、0–1 标度，比较同模型同参与者的两种网络设置。[§4、表 2](https://arxiv.org/html/2606.31219v1#S4.T2)

| 四主体 V+2V+I | C-V2X AP@0.7 ↑ | Unlimited AP@0.7 ↑ | 共享量（MB） | C-V2X 传输（ms） |
| --- | ---: | ---: | ---: | ---: |
| V2VNet | 0.13 | 0.50 | 30.0 | 107432 |
| V2X-ViT | 0.33 | 0.50 | 1.014 | 9976 |
| ERMVP | 0.36 | 0.57 | 1.038 | 5190 |
| CoSDH | 0.41 | 0.52 | 0.1785 | 893 |

无限网络下 ERMVP 在所列行最高，受限网络下 CoSDH 更好，说明通信量会改变方法排序。893 ms 约为 8.93 个 100 ms 帧周期；这是该配置下载荷传输成本，不是检测网络前向时间。不同方法压缩/筛选也有计算代价，本文没有完整拆开全链路 P95。

### 增加主体并不保证所有指标改善

在表 5 中，CMP 的 5 s minADE：单车 1.4022 m、一辆伙伴 1.6416 m、两辆伙伴 1.2893 m；一辆伙伴反而恶化 0.2394 m。V2VNet 的 1 s minADE 也从单车 0.4895 升至三车 0.7610 m。长时域与短时域、主体数的效果不能混写成一致单调增益。[表 5](https://arxiv.org/html/2606.31219v1#S4.T5)

多模态控制表 4 中，V+2V 的 3D AP@0.7 从 LiDAR 的 0.30 到 LiDAR+camera 的 0.35，支持额外模态的价值；该表未逐列对应真实链路退化，不能把其全部增益当作已在同一 C-V2X 预算下实现。

### 数据质量与 oracle 网络对照

表 6 为排除带宽瓶颈，直接发送 GT 框内的降采样点云，是 oracle 选区实验。C-V2X 的 AP70=0.05、丢包 38.19%、延迟 31.46 ms、吞吐 0.72 Mbps；Unlimited AP70=0.06、零丢包、延迟小于 1 ms。它支持“带宽足够仍有时延/丢包代价”，但该 GT 选区本身不可部署。[表 6](https://arxiv.org/html/2606.31219v1#S4.T6)

ST-ICP 的约 0.2 m RMSE 来自重叠点云再匹配后的欧氏残差，不是独立测量系统提供的全局定位误差；同步和标定主要用运动序列、重投影图验证，未报告全数据最坏时间偏差和误差区间。少数场景的人工协调相遇也限制自然交通分布代表性。[§5](https://arxiv.org/html/2606.31219v1#S5)

## 应用场景与启发

- 作者主张：让视觉、机器人和网络研究共同优化实际可用的协同感知。
- 我的判断：适合验证“按单帧精度排名”和“按消息可及时到达排名”是否冲突；要把真实测量、网络模型、帧复用规则保存成独立实验配置。
- 待验证假设：在固定每帧字节预算下，依据数据年龄选择伙伴，比固定所有伙伴更能保持长时域预测；成功必须兼顾新鲜度、目标召回和误差，不能只抛弃困难帧。

## 局限与阅读风险

初版 Car-only 标签、24 个受组织场景、缺帧重复使用和离线全序列对齐，都限制其作为完全自然、完全因果在线评测的范围。没有驾驶控制实验，AP 和 minADE 改善不等于道路安全认证。

传感器型号存在正文/附录差异：§3.1 写 Ouster OS1-128，表 7 写车端 OS2-128、路侧 OS2-64；搭建硬件时必须核对实际配置。公共复现默认恒定吞吐与真实动态 trace 也需分清；不能凭论文标题认定脚本自动包含真实丢包重放。

## 后续跟进

### 最小验证与停止条件

- 当前资源（2026-09-12）：[官方项目页](https://cisl.ucr.edu/CooperScene/)有 Mini Set（标称约 2.9 GB）、完整数据（约 94.3 GB），数据许可 CC BY-NC-SA 4.0；[代码](https://github.com/UCR-CISL/CooperScene)为 MIT，含 Docker、转换及训练/测试入口；[权重与配置](https://huggingface.co/cisl-hf/CooperScene)有各方法目录和约 2.1 GB 文件树。本次未下载数据/权重或验证全部 checkpoint 可加载。
- 最小实验：先固定 Mini Set 与 CoSDH checkpoint，先在相同协作者组合下比较 Unlimited、README 默认 1.6 Mbps、测得吞吐 trace，并分别开关丢包/旧帧复用；协议核对后，固定总字节预算和模型，对比固定伙伴与按接收数据年龄选择伙伴。记录接收年龄分布、有效合作频率、AP@0.7 和端到端延迟；若无逐包 trace，先停在恒定带宽复算，不声称实网复现。
- 成功信号：可从字节大小和网络配置复算延迟，且适应性伙伴选择在等预算下提升新鲜目标召回；多个场景中结果稳定。
- 停止/转向条件：方法排名仅来自不同帧复用规则或 GT 裁剪，则先统一协议；若实际可用频率达不到任务周期，优先减少或重新定义消息，而非增加融合网络。

### 来源与核验记录

依据 [arXiv:2606.31219v1](https://arxiv.org/html/2606.31219v1)，2026-06-30 版本，2026-09-12 核验；重点读 §3–5、表 2/4/5/6、附录 B/C、图 1/3 实际图片；作者机构由首页与官方项目页核对。相关原文为 V2V4Real v1 PDF §3、TUMTraf-V2X v1 §3–4。未运行模型或实车链路；网络默认值来自当天公开 README，不代替论文原始实验日志。
