---
{
  "id": "terrazero-self-play-driving",
  "tag": "end-to-end-autonomous-driving",
  "tags": [
    "end-to-end-autonomous-driving",
    "autonomous-driving-testing"
  ],
  "title": "TerraZero: Procedural Driving Simulation for Zero-Demonstration Self-Play at Scale",
  "source": "arXiv:2607.13028 / https://arxiv.org/abs/2607.13028 / https://terra-applied.github.io/TerraZero",
  "authors": [
    "Zhouchonghao Wu",
    "Akshay Rangesh",
    "Weixin Li",
    "Wei-Jer Chang",
    "Zachary Lee",
    "Saeed Bonab",
    "Tim Wang",
    "Wei Zhan"
  ],
  "affiliations": [
    "Applied Intuition",
    "University of California, Berkeley"
  ],
  "comment": "TerraZero 在高吞吐对象级仿真中程序化生成交互长尾，以纯 RL 分别训练车辆规划与异构交通策略；InterPlan 和 WOSAC 结果支持可行性，但场景覆盖的因果贡献仍需隔离消融。"
}
---

## 一句话定位

TerraZero 是对象级驾驶仿真与纯 RL 训练栈：在真实地图上程序化生成交通情节，以真值结构特征训练策略；当前尚不能直接训练相机／LiDAR 到控制的端到端系统。[全文 v1，§3–6、附录 A–E](https://arxiv.org/html/2607.13028v1)

## 论文要解决的问题

便宜仿真常缺施工、事故车与突发横穿，复杂仿真又难支撑大规模 RL。作者试图把仿真吞吐、场景可组合性和稳定训练放在一起，检验不用人类示范轨迹能否覆盖交互长尾。

## 方法和系统设计

### 数据与运行时通路

离线将 Waymo、nuPlan、CARLA 地图转为 `terrabin`，编码车道、路缘、信号和交叉口。报告的训练采用随机合法放置与沿车道图采样目标，不使用日志轨迹初始化；引擎虽支持 log/hybrid 模式，那不是这些实验配置。

C 引擎在 CPU 上做动力学、观测、奖励和规则判断；PyTorch 在 GPU 推理和学习。共享缓冲减少 C/Python 复制，整批主机到设备传输仍然存在，并与计算重叠；“zero-copy”不能理解为 CPU/GPU 无传输。默认最多观测 50 m 内 20 个参与者、200 条道路段，空间观测使用自车坐标系，x 向前、y 向左；时间步为 0.1 s，情节 256 步。

### 自博弈训练配方

规划策略约 3.5M 参数，Deep Sets 分组编码对象与道路，MLP 输出车辆离散 jerk；异构交通策略另为 6.7M、使用车辆／行人／自行车独立动作头。两者共享配方，不是一个检查点。规划策略训练还混入 IDM/PDM 反应车、停放／事故车、施工锥与 ORCA 横穿行人，打破单策略自博弈的对称行为。异构交通策略的表 15 配置只启用车辆生成器，行人和自行车由各类型策略头控制。

§5.1 的高优势片段采样为：

$$
p_i\propto\left(\sum_t|\hat A_{i,t}|\right)^\alpha,\qquad w_i=(Np_i)^{-\beta}.
$$

$\hat A$ 是优势估计，$N$ 是候选片段数，$w_i$ 校正重采样偏差。PPO 另用 V-trace 校正和 PopArt；截断保留末状态价值，真实终止清零。每车随机奖励权重与四个动力学系数也作为输入，默认 30% 目标隐藏。推理时固定策略权重，通过这些条件改变风格；没有备用规划器接管。长尾脚本是训练对手／环境，不是自车推理后处理。

### 原始方法对照

[Cusumano-Towner 等，Gigaflow，2025 v1，§2、附录 B–C](https://arxiv.org/html/2502.03349v1) 已结合矢量输入、奖励条件与大规模自博弈；TerraZero 增加真实地图转换、异构动力学和可组合的脚本情节。[Rowe 等，Gigapixel，2026 v2，§3](https://arxiv.org/html/2606.19641v2#S3) 则用矢量教师给像素学生自博弈标签，再适配真实相机；TerraZero 没有此感知桥接，不能把两者对象级／像素级吞吐直接排名。

## 关键图与可视化结果

![原文 Figure 1：TerraZero 可配置系统轴](../../assets/papers/terrazero-self-play-driving-original-figure-1.png)

图示初始化、信号、NPC、奖励和动力学选项；有某个选项不等于每次训练都启用它。

![原文 Figure 6：五种训练来源的迁移矩阵](https://arxiv.org/html/2607.13028v1/transfer_matrix.png)

左侧为 WOSAC 风格车辆真实性，右侧为 EPDMS 核心安全部分；两种尺度不可互换，且右侧不是完整排行榜 EPDMS。

## 实验结论与证据

### 同一规划检查点跨基准

nuPlan 地图约 262k 场景；规划策略在 16 A100 80GB 上从零 PPO 训练。原生训练输出离散 jerk；nuPlan val14/InterPlan 评估接入基准标准 LQR 跟踪器（§6.3）。表 2–3 的 val14 使用反应式闭环，InterPlan 为交互长尾；下表为 0–100 分数，非成功率：

| 规划器 | val14 ↑ | InterPlan ↑ |
| --- | --- | --- |
| PDM-Closed | 92.13 | 42.00 |
| SPDM，15 proposals | 92.28 | 42.00 |
| SPDM，60 proposals | 91.60 | 63.66 |
| TerraZero | 92.27 | 67.87 |

TerraZero 在 InterPlan 比 SPDM-60 高 4.21 分，并报告 Full-Scale InterPlan 67.71；val14 总分仍低于表中的 Gigaflow 93.8。其 No-at-fault-collision/TTC 为 99.11/96.06，是分项分数，不能改写成现场事故概率。多数基线为各原论文结果，只有星号标记者重训，训练预算并未统一。

### 交通真实性与迁移反例

异构策略用 WOMD 约 487k 训练场景地图、32 A100。WOSAC 2024 车辆真实性 TerraZero 0.740 对 SPACeR 0.741，VRU 为 0.683 对 0.729；汽车 minADE 为 6.14 m 对 4.10 m，说明安全与拟合人类行为不同。不能把车辆低碰撞指标概括为所有真实性子项领先。

迁移另训五个较短预算策略，每格约 100 场景，nuPlan 目标并无 WOSAC 官方 subject 集。Figure 6 上右侧 Waymo 安全分，nuPlan 来源 0.555、Waymo 来源 0.715，相差 0.160；因此作者“无迁移惩罚”的概括应收窄。左右行交通测试支持读取车道方向，尚未通过去掉动力学／奖励随机化来证明因果来源。[§6.4–6.5，表 5–6](https://arxiv.org/html/2607.13028v1#S6)

### 吞吐不是训练复现预算

表 1 报单消费级设备 560k、单服务器设备 1.3M、八卡 2.8M agent steps/s；部分对手数字直接引自原论文，不能当完全同硬件对照。正文未充分列该吞吐测点的具体 CPU/GPU 配置、全部训练步数及总 wall time；1.3M 到 2.8M 也不是八倍扩展。没有去掉程序化长尾、采样或归一化的完整训练消融，无法把 InterPlan 增益单独归给场景覆盖。

## 应用场景与启发

适合研究规则与交互策略，以及为未来感知端到端学生产生教师行为。报告判断：重要可检验假设是“施工／事故脚本的训练覆盖改善同类长尾”，需要重新训练对照，不能只在最终策略的测试场景里移除障碍。

## 局限与阅读风险

真值对象特征、HD 地图和信号相位是前提，观测噪声默认关闭；没有真实车辆转移实验证明物理动力学鲁棒性。[官网](https://terra-applied.github.io/TerraZero/)提供演示与论文，当前未确认算法代码、地图转换器、策略权重和完整生成配置发布。2026-09-12 官网另列 val14/InterPlan/完整 335 场景为 94.19/70.87/71.31，与本文固定 v1 的 92.27/67.87/67.71 不同；未取得匹配检查点与协议前，不把两版成绩合并或替换原表。作者元数据按官网保留；固定 v1 PDF 比官网少列 Saeed Bonab，Berkeley affiliation 则由 PDF 确认。

## 后续跟进

### 两组从相同起点训练

先取得引擎、地图划分、检查点预算和场景配置，复制同一规划策略初始化，固定 PPO、奖励随机化、agent-step 数与优化更新数，只开关施工／事故车生成器；按论文规划配置预留 16 A100，先用 3 seeds 的缩小预算试验。两组都在相同未见 InterPlan 子类上测试；拟定通过条件是相关子类平均分提高至少 5 分、val14 退化不超过 1 分。若无法确定完整训练预算或生成参数，停止归因复现。本次未训练或模拟。
