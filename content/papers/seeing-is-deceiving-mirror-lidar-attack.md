---
{
  "id": "seeing-is-deceiving-mirror-lidar-attack",
  "tag": "autonomous-driving-security",
  "tags": ["autonomous-driving-security", "autonomous-driving-testing"],
  "title": "Seeing is Deceiving: Systematic Vulnerability Analysis of LiDAR-Based Autonomous Driving to Mirror-Induced Perception Failures",
  "source": "VehicleSec 2026: https://www.usenix.org/conference/vehiclesec26/presentation/yahia / arXiv:2509.17253: https://arxiv.org/abs/2509.17253",
  "authors": ["Selma Yahia", "Ildi Alla", "Girija B. Mohan", "Daniel Rau", "Mridula Singh", "Valeria Loscri"],
  "affiliations": ["Interdisciplinary Centre for Security, Reliability and Trust (SnT), University of Luxembourg", "University of Applied Science Saarland (htw saar)", "CISPA Helmholtz Center for Information Security", "Inria Lille - Nord Europe"],
  "comment": "论文把平面镜导致的 LiDAR 多径系统化为 Object Addition 与 Object Removal 两种失效，并用室外实验拟合距离、角度和面积到伪点的关系，再注入 CARLA 和 Autoware 全栈。其价值在于攻击完全被动且输入在物理上合法，但高速、恶劣天气和跨 LiDAR 泛化仍未验证。"
}
---

## 一句话定位

这篇工作把过去常被当作测量噪声的镜面反射提升为可设计的物理攻击：平面镜既能把二次反射伪装成空中的障碍物（Object Addition Attack, OAA），也能把本应命中真实障碍物的光束偏转到地面（Object Removal Attack, ORA），并把原始点云失真一直追到占据栅格、Autoware 检测、制动和 CARLA 碰撞后果。

## 论文要解决的问题

LiDAR 对镜面和高反材料的异常并不新，但已有研究很少回答三个系统问题：攻击者能否用低复杂度、无电子设备的物体稳定控制伪点位置；这种伪点如何随车辆距离、镜面角度和面积变化；以及感知异常是否真的会穿过占据栅格、检测和规划。缺少这些环节时，单帧点云上的“出现了伪点”无法转化为可重复的安全测试。

## 方法和系统设计

- 以几何光学区分两类机制：ORA 把回波从真实障碍物处移走，OAA 则利用镜面到二次物体的折返路径，在镜后生成虚拟点。
- 在室外停车场改变镜面面积、倾角和车辆距离，提取伪点数量、出现概率、横向偏移与径向距离，并拟合可用于仿真的经验模型。
- 把经验模型接入 CARLA，按车辆状态实时注入镜面伪点；再在配备 Autoware 的实验车上记录占据栅格、目标列表和控制信号，验证感知到系统行为的传播。

## 关键图与可视化结果

![图 1：从室外 OAA 测量、经验模型到 CARLA 注入和 Autoware 实车验证的链路](../../assets/papers/seeing-is-deceiving-mirror-lidar-attack-figure-1.png)

图 1 对应 arXiv 版本 Figure 8。它说明仿真中的伪点不是任意手工噪声，而是由室外实验拟合的距离、角度和面积规律驱动；最右侧再用 Autoware 实验车检查假障碍是否进入实际检测与控制链路。该链路提高了测试可重复性，但仿真追尾仍不是道路实车追尾证据。

![图 2：不同镜面规模使 Autoware 从 UNKNOWN 逐步转为高置信度 Vehicle 检测](../../assets/papers/seeing-is-deceiving-mirror-lidar-attack-figure-2.png)

图 2 对应 arXiv 版本 Figure 12。两块镜片产生的稀疏伪点先被识别为 UNKNOWN，四块与六块配置形成更密集的结构，六块时 Vehicle 置信度达到 74%。可视化支持“镜面面积控制伪点密度和语义可信度”，但只覆盖论文使用的旋转式 LiDAR、镜片组合与检测栈。

## 实验结论与证据

OAA 室外试验使用 30 cm × 30 cm 镜片，组合为 0.18、0.36 和 0.60 m² 三种面积，并测试 30°、45°、60° 倾角；车辆约从 20 m 外以 8 km/h 接近。0.18 m² 已能产生越过基础滤波的局部伪点，增大到 0.60 m² 后点数和空间连贯性明显增加，Autoware 给出 74% 的 Vehicle 检测。ORA 则在多个测试角度下移除交通锥对应回波，使其区域在占据栅格中被错误标为可通行。

论文进一步在 CARLA 中展示，phantom obstacle 会让自车紧急制动并被后车追尾；实车 Autoware 试验验证了假障碍检测、占据变化与控制信号响应。证据因此支持“镜面失真可进入全栈”，但真实追尾后果来自 CARLA，实车试验为低速、受控、人工保障条件。

## 应用场景与启发

- 应用场景：LiDAR 反射材料安全测试、Autoware 物理红队、基于经验分布的仿真故障注入，以及占据栅格异常检测。
- 方法启发：与其只把镜面点当离群点删除，可联合估计回波的空间持续性、材料线索和多传感器可见性；真实物体应同时满足几何、热信号和时间连续性。
- 讨论问题：在雨雾、夜间和道路中本就存在玻璃幕墙或反光标牌时，如何区分恶意镜面、正常多径与真正障碍，同时控制误报造成的急刹风险？

## 局限与阅读风险

论文只使用一类旋转式 time-of-flight LiDAR，尚未覆盖 FMCW 或 full-waveform 设备；室外实验均为晴朗干燥天气，雨雾对反射率和传播的影响未知。实车为低速受控测试，高速 phantom braking 的道路风险仍由仿真代替。热成像、跨模态一致性和材料分类属于提出的防御方向，论文没有完成全栈集成验证；简单的一致性规则还可能把低照度相机漏检或反光标志造成的正常传感器分歧误报为攻击。

## 后续跟进

- 在不同扫描方式、波长、雨雾与车速下复测伪点出现窗口，确认经验模型是否需要按设备重新标定。
- 以 0.18 m² 最小配置复现实车占据与检测变化，并把镜片面积、角度和距离作为可控测试维度。
- 联合热成像、相机语义和多帧占据连续性实现防御，对比攻击漏检率、正常反光场景误报率及制动副作用。
