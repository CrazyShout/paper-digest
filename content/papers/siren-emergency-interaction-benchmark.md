---
{
  "id": "siren-emergency-interaction-benchmark",
  "tag": "autonomous-driving-testing",
  "tags": ["autonomous-driving-testing", "cooperative-autonomous-driving", "agentic-driving"],
  "title": "SIREN-Bench: Behavior-Driven Generation and Evaluation of Emergency-Vehicle Interactions",
  "source": "arXiv:2608.24094 / https://arxiv.org/abs/2608.24094 / HTML: https://arxiv.org/html/2608.24094",
  "authors": ["Yicheng Zhu", "Tianmu Zhao", "Haoxin Leng", "Fan Zuo", "Tao Li", "Zilin Bian"],
  "affiliations": ["Rochester Institute of Technology", "CVS Health", "City University of Hong Kong", "New York University"],
  "comment": "SIREN 用 SUMO-CARLA 锁步协同仿真生成七类应急车辆与社会车辆交互，并同时测试检测、预测和风险理解；最重要的结果不是某个新模型领先，而是学习预测器平均不及常速度、VLM 几乎识别不了碰撞。"
}
---

## 一句话定位

SIREN-Bench 用应急车辆的特权行为和社会车辆的持续响应策略生成交互，再把同一批记录转换成检测、预测和风险分类测试。价值在于把“周围交通怎样被应急车辆重组”设为可配置机制，并呈现现有模型的具体失效；当前数据规模还不足以隔离行为、地图和单次 episode 的影响。

- **核心证据**：七个模板上的平均预测误差，常速度为 1.44 m ADE、3.73 m FDE，最佳学习配置 DeMo+RealMotion 为 1.88/5.42 m；原文表 3。
- **主要边界**：生成器的车辆交互是闭环的，下游模型用记录好的数据离线评测；不能写成这些模型完成了闭环驾驶测试。

## 论文要解决的问题

### 任务与行为假设

应急车辆不只是一个少见的外观类别。救援通道、闯红灯特权通行和路肩转弯会改变附近车辆的让行、制动、车道占用与通过次序。自然日志只能收录实际发生的少量实例；单次预设轨迹也难以说明在不同社会车辆响应下会出现哪些交互。[原文 §1](https://arxiv.org/html/2608.24094v1#S1)

本文输入道路网络、背景交通、应急车辆路线、等级和行为参数，输出同步传感观测、演员状态及评测标注。轨迹由行为策略与交通状态逐步求解，但策略本身仍是人为设计并带参数的仿真模型，不能据此认定它重现了真实驾驶人的行为分布。

### 相关工作与差异

| 工作与一手来源 | 已有机制 | SIREN 的具体差异 |
| --- | --- | --- |
| Xu 等，OpenCDA，ITSC 2021（[作者仓库](https://github.com/ucla-mobility/OpenCDA)；[论文 v3 §III](https://arxiv.org/pdf/2107.06260v3)） | 已整合 SUMO/CARLA、完整协同驾驶栈和 scenario manager；SUMO 管理背景交通，CARLA 中车辆响应交通并执行协同任务。 | 双仿真耦合和交互本身不是本文首次提出。SIREN 具体增加应急等级下的 civilian response、控制权切换及三类 benchmark 的数据转换。 |
| Xia 等，HiDrive，2026 arXiv v1（[§3](https://arxiv.org/html/2605.09972v1#S3)） | 已把应急车辆让行、红灯约束下的应急决策等纳入 CARLA 闭环短路线评测，并分能力报告结果。 | SIREN 把 EMV/civilian 策略作为生成参数，再输出离线感知、预测、风险样本；HiDrive 直接检查被测驾驶系统执行路线。二者对象不同，不能宣称 SIREN 因“有闭环”就更全面。 |

两项比较均依据相关工作的原文机制；本文没有对它们做统一数据、统一模型的直接实验。

## 方法和系统设计

### 行为层到连续控制

L0 是无应急特权的普通交通控制条件，但 v1 没有实例化它。L1–L3 共用应急车辆特权规则，主要区别是警笛信号和被诱发的社会车辆响应：[表 1、§3.1](https://arxiv.org/html/2608.24094v1#S3.SS1)

- **L1**：警笛关闭，社会车辆保持普通交通控制；应急车辆可执行特权路口通行，对应 S3–S6。
- **L2**：警笛开启，受影响车辆尝试可行的让行换道，对应 S2。
- **L3**：社会车辆向边界靠拢后制动保持，形成通道；应急车辆可沿复制的通道路径和 gap-escape 局部恢复路径通过，对应 S1、S7。

响应不是一次性命令：演员状态会持续到应急车辆通过；暂时不可行的换道延后再试。SUMO 提供路线、横向意图、rescue-lane 和前车信息，CARLA waypoint navigator 转成油门、制动和转向。L3 的 gap-escape 优先级较高，并会暂时限制碰撞回避以实现受控通过；这是需要在生成日志中标明的行为设置，不是安全保证。[原文 §3.2、附录 A.1.3](https://arxiv.org/html/2608.24094v1#S3.SS2)

### 同步与数据边界

CARLA 0.9.16 和 SUMO 1.24.0 以 0.05 s 步长锁步运行，即 20 Hz；演员状态以 10 Hz 保存。以应急车辆为中心设置 40 m 进入、50 m 退出的滞回区域，避免控制权在边界反复切换。区域外交通主要由 SUMO 演化，区域内按等级进入 CARLA 同步与连续控制。[附录 A.1.1](https://arxiv.org/html/2608.24094v1#A1.SS1.SSS1)

传感器装在应急车辆上，包括 64 线、120 m 范围 LiDAR，四路 $800\times600$ RGB、GNSS/IMU。检测的包围盒和轨迹真值来自原生仿真状态，风险标签来自记录的交互与碰撞事件。所有车被标为同一 Car 类，因此检测结果测的是车辆检测在应急交互中的表现，不能当成“救护车识别率”。

### 评测定义与模型使用

这是数据生成与 benchmark 工作，没有统一的新模型训练损失。学习式检测器、预测器默认使用各自公开预训练 checkpoint，不在 SIREN 上微调。不同模型原始历史长度保留后，预测输出统一到 5 s、0.2 s 间隔的 25 个未来点。

原文附录 A.2.1 式 1、5 的两个核心定义为：

$$
\begin{aligned}
\mathrm{ADE}&=\frac1T\sum_{t=1}^{T}\lVert\widehat p_t-p_t\rVert_2,\quad
\mathrm{FDE}=\lVert\widehat p_T-p_T\rVert_2,\\
\mathrm{mAP}&=\frac1{\lvert\mathcal D\rvert}\sum_{d\in\mathcal D}\mathrm{AP}_d,
\quad\mathcal D=\{0.5,1,2,4\}\ \mathrm m.
\end{aligned}
$$

$\widehat p_t,p_t$ 是预测与仿真真值位置，$T=25$；ADE 衡量全时域平均偏差，FDE 衡量末端偏差，单位均为米且越低越好。多模态 minADE/minFDE 在多个候选中分别挑最接近真值的一条，属于可达预测能力的诊断，不能和单轨迹 ADE 混写。

检测的 $\mathrm{AP}_d$ 用 BEV 中心距离阈值 $d$ 匹配，不是 3D IoU；NDS 再组合位置、尺度、朝向、速度和属性误差，越高越好。[原文附录式 1–6](https://arxiv.org/html/2608.24094v1#A1.SS2.SSS1)

风险任务复用 SeeUnsafe 的分割、visual grounding 和提示流程。每个视频产生两次中间分类，按 Normal < Near-Miss < Collision 取更严重者为最终标签。Accuracy 测总体正确比例，逐类 F1 同时考虑误报和漏报；本文并没有评测文字推理链本身是否正确。v1 未给出可直接复算 Near-Miss 的统一数值阈值和完整标签裁决明细，风险标注复现需补这部分。[原文 §4.1.3、附录 A.2.6](https://arxiv.org/html/2608.24094v1#S4.SS1.SSS3)

## 关键图与可视化结果

![原论文图 1：行为配置、交互生成与三类下游评测](https://arxiv.org/html/2608.24094v1/Figures/concept.png)

从左向右看：左侧把预设轨迹和行为驱动生成作概念对照，中间是应急车辆与社会车辆的交互画面，右侧是检测、预测和风险理解。它说明本文的研究对象，但左侧无限符号不是覆盖规模的实验结果，也不能据此把所有既有 benchmark 说成没有交互。[原图 1 与图注](https://arxiv.org/html/2608.24094v1#S1.F1)

![原论文图 2：等级控制、SUMO–CARLA 锁步与记录转换](https://arxiv.org/html/2608.24094v1/Figures/pipeline.png)

上方列出 L0–L3，中间显示 SUMO 意图、CARLA 执行和反向状态同步，下方才转为 benchmark 样本。这里的闭环在生成阶段。图内底部标有“7 scenarios, 2143 Frames”，但没有逐 episode 明细；风险任务另有明确的 105×190 帧统计，不能把两个计数混为一谈。[原图 2 与图注](https://arxiv.org/html/2608.24094v1#S3.F2)

![原论文图 3：同步场景、应急车辆资产与四组交互实例](https://arxiv.org/html/2608.24094v1/Figures/figure3.png)

左侧是 SUMO/CARLA 同步视图和车辆资产；右侧四组分别展示 S1 通道穿行、S2 清道、S3–S6 代表性特权路口通行和 S7 非标准道路空间使用，轨迹颜色表示 EMV 速度。样例确实对应不同交互，但没有展示每个模板的多种子分布或真实性验证。[原图 3 与图注](https://arxiv.org/html/2608.24094v1#S3.F3)

## 实验结论与证据

### 设置与可比性

七个模板都在 Town10HD_Opt：S1/S2 为清障，S3/S4 为红灯同向/交叉交通，S5/S6 为停车标志同向/交叉交通，S7 为路肩右转。每模板只有一个 25–45 s 基础 episode，用于检测和预测；风险集另有每模板 15 个视频，总计 105 个、每个 190 帧。[原文 §3.3、表 2](https://arxiv.org/html/2608.24094v1#S3.SS3)

预测有 7,062 个 (vehicle, frame) 样本，stride 为一帧，彼此高度重叠；S6 只有 340 个，S7 有 1,760 个。CSP/STDAN/BAT/CV/IDM 读取 3 s、0.2 s 的历史，EMP/DeMo 系列读取 5 s、0.1 s 的历史，还存在 NGSIM 与 Argoverse 2 训练域差异。表 3 的 Mean 是七个模板列的均值，不能把它理解成 7,062 个独立样本的统计证据。

四个 LiDAR 检测器来自 nuScenes，而 SIREN 是不同城市布局和更密的 64 线传感器；不能和其公开 nuScenes 榜单直接对比分数。每个仿真 job 分配四个 CPU cores、32 GB RAM 和一张 32 GB Tesla V100S；论文没有报告完成整个 benchmark 的墙钟耗时。[原文 §4.1](https://arxiv.org/html/2608.24094v1#S4.SS1)

### 主要结果与负结果解释

| 任务及原表 | 方法或配置 | 数值 | 解释与边界 |
| --- | --- | ---: | --- |
| 预测，表 3，七模板 Mean | CV | 1.44 / 3.73 m ADE/FDE ↓ | 常速度参考；非学习方法 |
| 同上 | IDM | 1.86 / 4.45 m | 规则参考；与学习模型历史接口不完全相同 |
| 同上 | DeMo+RealMotion | 1.88 / 5.42 m | 本表最佳学习配置，ADE 比 CV 高 0.44 m |
| 检测，表 4，七模板 Mean | TransFusion-L | 0.539 / 0.515 mAP/NDS ↑ | Car 类，零样本跨域；不是 EMV 分类结果 |
| 风险，表 5，105 视频 | Qwen3.5-9B | 70.48% accuracy；0 / 0% 危险类 F1 | Near-Miss、Collision 都为零 |
| 同上 | MiniCPM-V-4.5-8B | 49.52% accuracy；0 / 11.11% 危险类 F1 | 唯一 Collision F1 非零，但 Collision precision 仅 6.25% |
| 同上 | Blaifa-InternVL3.5-8B | 47.62% accuracy；40.45 / 0% 危险类 F1 | Near-Miss 较好，仍未正确识别 Collision |

[表 3–5](https://arxiv.org/html/2608.24094v1#S4.T3)支持一个范围明确的负结果：这些释放的 checkpoint 和适配流程在此数据上没有形成稳定的三类风险识别，也没有让学习预测器在七模板均值上胜过 CV。不能进一步推出“学习预测普遍无用”，或把所有差距都归因于应急车辆机制。

检测的模板家族平均 mAP 顺序约为清障 0.42、停车标志 0.51、路肩 0.59、红灯 0.62。预测的困难却集中在特权路口，说明同一场景对不同任务施加的压力不同。Qwen 的高总体 accuracy 与危险类零 F1 同时存在，说明只看一个总体指标会错过核心失败。

### 消融缺口与统计单位

作者明确：每个模板固定一个等级、一个地图和一个基础 realization，因此不能分离等级、地图、密度或具体车辆几何的作用。L0 虽有定义，却没有同路网同交通的匹配对照。当前“清障更难检测”是 episode 层面的关联，尚不是控制其他变量后的行为因果效应。[原文 §4.2、§5](https://arxiv.org/html/2608.24094v1#S5)

没有跨模板随机种子的置信区间，风险只报告总体分类，缺少按模板 confusion matrix。重叠的轨迹窗口不能充当独立重复实验；后续应按完整 episode 重采样，而不是对 7,062 行做普通独立样本检验。

## 应用场景与启发

- **作者主张**：把行为配置作为应急交通 benchmark 的生成入口，扩展到感知、预测、规划和交通分析。
- **我的判断**：适合构造规则临时变化时的回归测试；最有用的接口是明确记录应急角色、civilian response 和控制模式，方便把模型失败追溯到实际行为条件。
- **待验证假设**：在同一几何、交通密度和随机种子下，从 L1 改为 L2/L3 会通过多车横向重排增加检测困难；如果加入这些控制后 mAP 差异消失，原结果主要反映特定布局而非行为层。该假设尚未实验验证。

## 局限与阅读风险

作者承认单地图、单等级、单基础 episode、只有 onboard sensing 和 generic Car 标签的限制。风险评测测分类结果，不验证中间推理；Near-Miss 的可复算阈值和逐样本标签未在本文提供。生成策略可配置也不代表参数范围内的所有组合都符合自然交通。

图中的多车反馈证明生成系统在交互，不代表九个预测器、四个检测器或五个 VLM 在回路中控制车辆。本文当前按 arXiv v1 阅读，稿件模板或版式不作为正式录用证据。

## 后续跟进

### 最小验证与停止条件

- **当前资源**：2026-09-12 检查 v1 全文及题名/代码检索，未找到可核验的作者 SIREN 平台代码、七模板配置、原始 episode、105 个视频或统一适配器下载入口。附录给出了环境版本、参数、伪代码和 checkpoint 来源，不能等同于这些实验资产已经可下载；没有新的专用训练权重发布声明。本次未运行仿真。
- **最小实验**：取得生成器后先只选 S2，冻结地图、车数、初始位置、传感器和十个预先列出的随机种子，成对比较 L1 与 L2。保留每步控制模式与轨迹，使用同一 TransFusion-L checkpoint 和坐标转换；另检查换道次数与局部车辆密度，确认干预确实改变行为。
- **成功信号**：每个 seed 可重复重放、标注与传感器时间一致，L2 增加可观察的多车重排，并在 episode 成对统计中出现稳定的检测误差变化；再扩展 L3 和第二地图。
- **停止或转向**：若等级变化没有产生预期行为，先修复控制或场景配置；若匹配几何后差异消失，撤回“应急行为本身造成下降”的解释。拿不到原始视频与风险标签规则时，停止复算表 5，不用人工猜标签补出排行榜。

### 来源与核验记录

依据 [arXiv:2608.24094v1 全文](https://arxiv.org/html/2608.24094v1)，实际核验日期为 2026-09-12；作者单位由全文作者栏核对。方法对应 §3 和附录 A.1，协议与指标对应 §4.1、附录 A.2，结果对应表 3–5。逐张打开并核对原图 1、2、3；相关工作读取 OpenCDA v3 §III 和 HiDrive v1 §3。本文完成的是来源与内容检查，没有执行模型评测或仿真复现。
