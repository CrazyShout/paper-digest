---
{
  "id": "deployed-vil-cooperative-perception",
  "tag": "cooperative-autonomous-driving",
  "tags": ["cooperative-autonomous-driving", "vehicle-road-cooperation", "autonomous-driving-testing"],
  "title": "A Deployed Hybrid Vehicle-in-the-Loop Platform for Validating Cooperative Perception",
  "source": "arXiv:2607.13806 / https://arxiv.org/abs/2607.13806",
  "authors": ["Anastasia Bolovinou", "Giorgos Hadjipavlis", "Markos Antonopoulos", "Panagiotis Tachtalis", "Konstantinos Petousakis", "Konstantinos Lazaridis", "Alexandros Siskos", "Bill Roungas", "Angelos Amditis"],
  "affiliations": ["Institute of Communication and Computer Systems, Athens, Greece"],
  "comment": "把真实车辆、ETSI CAM/CPM、CARLA 数字孪生与 GPU 占据栅格接成一条可运行的 ViL 验证链，适合用来设计协同感知从算法指标走向系统验收的实验基础设施。"
}
---

## 一句话定位

这不是一篇只提高协同检测精度的论文，而是一套已经部署运行的混合 Vehicle-in-the-Loop（ViL）设施：真实仪器车通过 ETSI 标准 CAM/CPM 与 CARLA 数字孪生中的虚拟交通参与者共享状态和检测，融合结果实时写入概率占据栅格。它进入本期，是因为论文把协同感知研究最容易被忽略的接口——真实车辆、通信消息、数字孪生、定位误差和测试复现性——放在同一条系统链路中讨论。

## 论文要解决的问题

协同感知需要多辆联网车辆、路侧单元和可控的危险场景，但研究团队往往没有足够多的实体资产，也很难反复安全复现同一场景。纯 CARLA 仿真可以扩展参与者，却不能证明真实车辆消息、设备时延和定位误差在系统中如何传播；纯实车测试又昂贵、难复现，且无法自由加入虚拟车辆。论文的目标因此不是再造一个融合网络，而是建立一座物理与虚拟系统之间可验证的桥梁，使真实 CAM/CPM 流能够驱动数字孪生并被协同感知模块直接消费。

## 方法和系统设计

- 真实侧由带 GNSS/IMU、Velodyne VLP-16、前视 RGB 相机、车载 NUC 和 C-V2X/ITS-G5 OBU 的仪器车组成；联网资产以 100 ms 周期发送 CAM 和 CPM，未共享感知的车辆仍可只广播 CAM。
- 虚拟侧从 OpenStreetMap 提取道路，转为 OpenDRIVE 并导入 CARLA，同时重建车辆几何、传感器安装位姿、建筑、植被和夜间反光道钉。VaN3Twin 将 ns-3、OpenCDA 与 CARLA 连接，使虚拟参与者也能进入同一 V2X 消息流。
- 融合侧是容器化 ROS 2 模块，用 JAX/CUDA 将 CAM/CPM 转成 `nav_msgs/OccupancyGrid` 概率栅格。论文在 nominal、rain、night 三种环境、ego-only/3 agents/6 agents 三种协同规模和 0–2 m 五档定位噪声下计算场景 AUC。

## 关键图与可视化结果

![图 1：真实双 T 路口、CARLA 数字孪生和实时协同占据栅格](https://arxiv.org/html/2607.13806v1/vil.png)

图 1 来自论文官方 arXiv HTML。左侧是真实测试场无人机画面，右侧是对应 CARLA 重建，中下方则是由实时 CAM/CPM 生成、并额外加入一个虚拟参与者后的占据栅格。它证明的重点不是渲染相似度，而是“真实消息进入虚拟场景并形成可消费感知输出”这一端到端链路已经跑通。

![图 2：协同规模、环境条件和定位噪声对覆盖率与占据召回率的影响](https://arxiv.org/html/2607.13806v1/recall_vs_noise.png)

图 2 把系统收益与边界同时画出来：增加协同车辆显著扩大联合视场并提高召回，但当定位噪声接近 2 m 时，多车配置的召回率趋于同一水平，说明误差瓶颈已经从“看不见”转成“对不准”。夜间单车感知最弱，因此协同补偿也最明显。

## 实验结论与证据

真实演示在一个双 T 路口运行三辆实体车，其中两辆共享 CPM、一辆只发 CAM，并允许虚拟车加入。论文确认整条消息链能够实时生成一致的占据栅格。受控数字孪生实验显示，协同可把单车约四分之一的关注区域覆盖扩展到六车时的大部分区域，而且覆盖率在 0–2 m 定位噪声下相对稳定；占据召回在低噪声时随协同规模提升，但中高噪声后收益明显收敛。多源重叠会带来轻微精度下降，不过作者认为在安全任务里，保守误报通常比漏检更可接受。

## 应用场景与启发

- 应用场景：可作为 V2X 协同感知、路侧补盲、CAM/CPM 兼容性和定位误差注入的混合测试台，也可扩展成人在环或远程驾驶场景。
- 方法启发：协同算法报告不应只给理想定位下的 AP；至少应把协同规模、定位噪声、消息周期、循环抖动和环境条件拆成可审计变量。
- 讨论问题：当协同收益被定位误差吞噬时，系统应该优先升级定位、做不确定性传播，还是限制可参与融合的远端节点？

## 局限与阅读风险

论文明确承认真实演示只完成了功能闭环，定量指标仍在数字孪生中计算，并没有用实车真值建立 sim-to-real fidelity。当前 CARLA 联合循环也不是严格确定性的，渲染或仿真瞬时变慢会改变消息到达与场景更新的时间对齐。实验规模只有一个测试场和有限实体车辆，因此不能把结果直接外推到城市级高密度通信或复杂遮挡。其价值主要是系统架构和验证问题定义，而不是已经完成认证的测试服务。

## 后续跟进

- 跟踪作者计划中的 D-GPS 真值对齐、循环频率/抖动上界和 GPU/CPU 占据模块基准。
- 最小复现实验可先用一辆真实或回放车辆加一辆 CARLA 虚拟车，验证 CAM/CPM 时间戳、定位噪声和占据栅格的一致性。
- 后续同类论文应重点检查是否提供实虚同步误差、通信负载和可重复运行统计，而不只展示系统截图。
