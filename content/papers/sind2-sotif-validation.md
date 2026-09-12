---
{
  "id": "sind2-sotif-validation",
  "tag": "autonomous-driving-testing",
  "tags": [
    "autonomous-driving-testing",
    "cooperative-autonomous-driving"
  ],
  "title": "SinD 2.0: A Multi-City UAV Dataset with Semantic Risk Annotations for SOTIF-Oriented Safety Validation at Signalized Intersections",
  "source": "arXiv:2607.16943 / https://arxiv.org/abs/2607.16943 / https://github.com/SOTIF-AVLab/SinD/tree/main",
  "authors": [
    "Yunwei Li",
    "Shengjie Fu",
    "Chunrong Chen",
    "Chengxiang Zhao",
    "Yuchen Fan",
    "Mingyu Zhu",
    "Yanchao Xu",
    "Yuxin Zhang",
    "Lan Yang",
    "Chuzhao Li",
    "Jie Ji",
    "Yi He",
    "Abhijit Sarkar",
    "Akash Sonth",
    "Hong Wang",
    "Jun Li"
  ],
  "affiliations": [
    "Tsinghua University",
    "Beijing Institute of Technology",
    "Guangzhou Automobile Group Co., Ltd.",
    "Jilin University",
    "Chang'an University",
    "Chongqing University",
    "Southwest University",
    "Wuhan University of Technology",
    "Virginia Tech Transportation Institute",
    "Virginia Tech"
  ],
  "comment": "SinD 2.0 把四城六路口的轨迹、信号与规则风险索引接到测试接口；须区分自动标签、公开样例与需申请的完整资源。"
}
---

## 一句话定位

SinD 2.0 将四城六个信号路口的航拍轨迹、地图和信号灯，连接到规则生成的风险索引与策略测试工具。它提供了有价值的密集交互案例，但语义标签尚不是人工认证真值，反应式背景与 3DGS 演示也不能直接证明实车 SOTIF 安全。

## 论文要解决的问题

日志中有许多正常行驶，却很难直接查询“车辆挡住横穿者”或“前方可行驶空间持续收缩”。单纯按低 TTC 筛选也无法充分区分触发机制。作者把数据、场景标签及可重放窗口连接起来，希望缩短从发现一种风险到构造对应测试的路径。

## 方法和系统设计

### 三种数量不能混用

固定 [arXiv v1 §III–V](https://arxiv.org/html/2607.16943v1#S3)覆盖长春、天津、西安和重庆三个路口，总录制 22.8 小时、约 53k 条参与者轨迹，累计轨迹距离 4,188.25 km。后者是所有参与者路程的累加，不是单辆自动驾驶车的验证里程。

宏观 SCE 统计、MprTTC 语义窗口、违规事件属于不同计数层：32,682 个 SCE 使用轨迹对筛选；53,901 条语义记录由 31,005 个高风险、1,286 个遮挡和 21,610 个狭窄区域记录组成；另有 25,966 个违规/不合规事件。它们可能重叠，不能相加为独立危险场景总量。

### 风险筛选与语义挖掘

宏观 SCE 的标准为 $\min(PET,TTC_{robust})<3$ 秒。附录 A 仅纳入机动车、自行车、摩托车，要求路程大于 2 米、最大速度大于 0.5 米/秒，并过滤近静止、常规跟驰等情况；因此这组统计并不覆盖全部行人风险。robust TTC 要求闭合速度超过 0.5 米/秒、连续至少三帧有效，再取这些值的 20% 分位数。

语义高风险采用另一种短时占据预测（原式 3）：

$$
MprTTC_{ij}(t)=\min_{\Delta\in\{1,\ldots,H\}}\Delta\delta t,\qquad
\mathcal B_i(t+\Delta)\cap\mathcal B_j(t+\Delta)\ne\varnothing.
$$

$H$ 为预测时域步数，$\delta t$ 为帧间隔，$\mathcal B$ 是根据位置、速度、加速度和朝向外推的占据形状，无预测交叠时取无穷大；连续风险帧再合并成窗口。遮挡标签用自车视锥、近物角域覆盖及后来路径交会筛选；狭窄区域标签在前方栅格扣除地图边界与膨胀障碍，搜索连通可达区域并检查前向深度。它们是可审计的几何规则，不等于真实传感器漏检、法律责任或严格动力学可达性真值。公开样例的 min_mprttc 为 0，序列中还出现 15、10、6、0 等值；schema 只声明通用对象，没有说明单位及零值含义。原式从正的预测步开始，不能直接认定这些字段与该式已对齐；零值代表当前重叠、无碰撞或其他约定，仍需作者说明，不能自行修正。

### 测试接口与训练边界

[§VI](https://arxiv.org/html/2607.16943v1#S6)通过 trajdata 将标签绑定到来源录制、自车、参与者及时间窗。作者称“dataset-open-loop”的模式让自车按策略行动、其余参与者重放日志；“closed-loop”则最多对 25 米内最相关的前向五个参与者用 Diffuser 更新，每五帧更新一次，并非所有背景交通都反应式。

QCNet 用公开 checkpoint、50 帧历史/60 帧未来；Diffuser 在 SinD 2.0 训练，使用 31/52 帧及十个候选。训练域、时域和适配方式并不一致，结果属于工具集成测试，尚非统一训练预算的算法排行榜。

### 与相关工作的自身一手对照

| 一手来源 | 原有工作 | SinD 2.0 的增量 |
| --- | --- | --- |
| [SinD v1 §III](https://arxiv.org/pdf/2209.02297v1) | 天津一个信号路口、约 7 小时、超过 13k 参与者；航拍轨迹与地面拍摄信号同步，提供地图和违规分析 | 增加多城路口与可查询的风险窗口，而非首次把信号状态与航拍轨迹对齐 |
| [trajdata，NeurIPS 2023 §3](https://papers.nips.cc/paper_files/paper/2023/file/57bb67dbe17bfb660c8c63d089ea05b9-Paper-Datasets_and_Benchmarks.pdf) | 统一轨迹/地图格式、重采样与批处理，提供从记录状态开始的模拟接口 | 在统一接口上加入 SinD 适配、风险选择器和策略包装，接口本身不保证模拟器行为可信 |

## 关键图与可视化结果

![原论文 Figure 1：四城六路口、风险索引与测试工具链](../../assets/papers/sind2-sotif-validation-figure-1.png)

图中上半部是采集地点，下半部才是规则挖掘及测试流程。3DGS 模块是附加视觉扩展，主要表格证据仍来自 BEV 轨迹与交互指标。

![原论文 Figure 6：西安路口慢行或停留 VRU 的空间分布](../../assets/papers/sind2-sotif-validation-figure-2.png)

色条为归一化密度，展示 VRU 暴露集中区域，不是每个栅格的碰撞概率。它也不是六路口车辆占据时间图，后者对应原 Figure 10。

## 实验结论与证据

### 数据密度和标注准确率是不同命题

Table I 给出 SCE 比例 39.84%，其分母应与候选交互统计绑定，不能除以全部轨迹数复算。表中 1,452.53 事件/小时对应约 22.5 小时，而同表列 22.8 小时；有效统计时长未解释清楚。跨数据集的车载/航拍可见性、筛选与时长也不同，作者已注明比较近似，不能据此做严格风险密度排名。语义层尚待更大规模人工 precision/recall 审计。

### 风险子集能筛出难题，但不证明触发原因

| 固定原表与条件 | 关键数字 | 证据边界 |
| --- | --- | --- |
| Table IX，SinD 预测 | QCNet top1 ADE/FDE 2.60/6.57 m，minADE/minFDE 0.78/1.52 m；Diffuser 3.88/10.13 m，oracle 值基本相同 | 候选多样性和模型适配都影响结果，不能仅比 top1 判定通用能力 |
| Table X，RiskIDM 碰撞率 | 原始 3.0%；低 MprTTC 30.3%；遮挡 63.4%；狭窄 53.4% | 语义检索提高测试难度，但未匹配初始 TTC、速度等混杂因素 |
| Table XI，反应式背景碰撞率 | RiskIDM 29.6%、ASAPRL 69.1%、QCNet 50.4% | QCNet 低于原始重放的 52.9%，所以并非所有策略都因闭环背景而更差 |
| Table X，狭窄区域 QCNet | 驶出道路 64.0%、违规 52.9%、异常 84.7% | 异常是完成运行中 ADE>10 m 或 FDE>50 m，不等于碰撞或崩溃 |

对象状态级测试没有充分说明观测是否按遮挡关系屏蔽，因此“遮挡子集失败多”不能证明错误来自视觉不可见。表中也缺各组运行数与置信区间，比例不宜外推为自然道路发生率。

## 应用场景与启发

### 报告分析与待验证假设

实用价值在于带来源证据的场景检索，而不是把自动标签当作已验证风险原因。作者也指出反应式生成器可能语义漂移。待验证假设是：给背景 Diffuser 增加简单的道路/运动约束，可以降低模拟器制造的伪冲突，同时保留原记录中真实存在的交互挑战。

## 局限与阅读风险

六路口的几何相关性只是描述统计，不能据此推断道路设计造成某种驾驶文化。QCNet 的预测输出经过策略包装，训练于本数据的 Diffuser 又缺明确记录级划分，迁移与泄漏边界须补足。附加 3DGS/DiFix3D 只有视觉演示，没有感知栈闭环量化。论文 PDF 标明 draft，本报告的作者与机构按固定 v1 首页核对。

## 后续跟进

### 公开范围与直接约束实验

截至 2026-09-12，[作者仓库 commit 930e4de](https://github.com/SOTIF-AVLab/SinD/tree/930e4dea78d924c6e9a58ff8e378331f93bba8ec)有 CSV 样例、schema、68 条语义样例和基础测试代码；完整数据、完整标签及 Diffuser 权重需申请，公共策略仅含重放、RiskIDM、Diffuser 模板，内部其他策略评估代码未包含。3DGS 扩展写明待发布。本次未申请数据、加载模型或运行模拟。

先确认公开字段的秒／帧单位、$H$、$\delta t$ 与零值约定，再进行定量对照。最小实验固定 30 个留出记录片段与 5 组配对种子，使用同一自车 RiskIDM，设置背景日志重放、原 Diffuser、同一 Diffuser 加道路及加速度/转向约束三组。后两组保持相同 25 米/五车选择、五帧更新、采样数和总步数；约束只处理当前输出，不重采额外候选。独立标记背景自身离路、突变及先于自车发生的碰撞，再报告自车碰撞与进度、自然轨迹分布偏差和约束触发率。若改善仅来自背景普遍停车，或约束组并未减少先发伪影，停止其可信度收益主张；完整数据与 checkpoint 不可用时只保留方案。
