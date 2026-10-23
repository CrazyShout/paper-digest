---
{
  "id": "drivemlp-expert-guided-closed-loop",
  "tag": "end-to-end-autonomous-driving",
  "tags": ["end-to-end-autonomous-driving"],
  "title": "DriveMLP: When Training Strategy Outperforms Model Complexity in Autonomous Driving",
  "source": "CoRL 2026 录用（arXiv 记录声明，未核到正式论文页） / arXiv:2610.29676v1 / https://arxiv.org/abs/2610.29676v1 / 仓库: https://github.com/alessandro-canevaro/DriveMLP",
  "authors": ["Alessandro Canevaro", "Julian Schmidt", "Hang Yu", "Ye Jin", "Sajad Marvi", "Georg Martius", "Julian Jordan"],
  "affiliations": ["Mercedes-Benz AG, Research & Development", "University of Tübingen", "Karlsruhe Institute of Technology, ITIV", "Technical University of Munich", "University of Freiburg"],
  "comment": "DriveMLP 读取对象级场景状态，在日志回放中用专家轨迹距离训练闭环控制。2.33M 参数的 MLP 在 nuPlan Val14-Reactive 得到 86.51 分，P6000 推理为 2.76 ms；优势没有覆盖所有 split，公开仓库目前仍只有说明与许可证。"
}
---

## 一句话定位

DriveMLP 把强化学习用作闭环模仿的优化工具：策略控制自车，让周围车辆按日志回放，再按实际走出的状态与专家状态的距离给奖励。论文用一个轻量 MLP 检查训练方式是否比增加规划网络复杂度更重要。它是对象级状态到控制的规划研究，输入不是原始相机或点云，适合作为端到端驾驶研究中的闭环训练对照。[§2–3](https://arxiv.org/html/2610.29676v1#S2)

## 论文要解决的问题

### 训练必须见到自己造成的偏差

开环行为克隆（BC）在专家已经到达的状态上学习下一步输出。部署时一次控制误差会改变自车状态，后续输入便偏离训练分布；继续拟合更多专家动作，未必教会模型从自己的偏差恢复。EGRL（Expert-Guided RL）让策略在训练中实际推进车辆，再对实现出来的位置和速度评分，监督对象因此从单步动作变成自车诱导的状态轨迹。

这需要一个特定条件：其他车不能因自车动作而改写原事件。否则专家原本选择的未来也可能不再合适。论文因此坚持在非反应式日志回放中训练，同时用具有 IDM 交通反应的 Reactive 测试检查迁移。[§2.2](https://arxiv.org/html/2610.29676v1#S2.SS2)

### 相关工作与差异

| 工作与一手来源 | 已有机制 | DriveMLP 的比较位置 |
| --- | --- | --- |
| Cheng 等，PLUTO，2024 预印本；[原文 §III](https://arxiv.org/html/2404.14327v1#S3) | 查询式规划器组织多模态轨迹，以模仿和辅助学习增强规划，并包含参考路径相关设计。 | EGRL 对自车执行结果给密集奖励。本文主表比较 PLUTO without refinement；将其编码器接入 EGRL 时还改变了输入、输出和辅助头，不能说只替换一个损失。 |
| Zheng 等，Diffusion Planner，ICLR 2025；[正式页](https://proceedings.iclr.cc/paper_files/paper/2025/hash/5c0cd43063f087eb32e572d040a19cd2-Abstract-Conference.html)、[原文 §4](https://arxiv.org/html/2501.15564v1#S4) | Transformer 扩散规划器联合建模自车与邻车未来，并能在采样时加入可微代价引导。 | DriveMLP 直接输出转向和加速度，没有迭代生成头。主要增量在闭环状态分布与示范奖励，结构和推理过程也更简单。 |

论文主要比较依赖人类示范的学习规划器，主动排除了主要优化人工交通规则奖励或代价的规划器。这一选取支持“与所列模仿规划器竞争”的结论，不是所有 nuPlan 系统的统一排名。[§3.1](https://arxiv.org/html/2610.29676v1#S3.SS1)

## 方法和系统设计

### 状态集合经过均值聚合，输出低层控制

输入包括向量地图、车道、交通灯和路线，邻车的位置、速度与朝向，静态障碍，以及自车速度、加速度、转向角和横摆角速度；空间量都转到自车坐标系。每类可变长集合由共享 MLP 编码、均值池化，再经 MLP 聚合成固定长度特征。各类特征拼接，送入相互独立的策略与价值网络。[§2.1、2.4](https://arxiv.org/html/2610.29676v1#S2.SS4)

策略头给出二维对角高斯分布，动作是归一化转向与加速度 $(\phi_t,a_t)\in[-1,1]^2$，由模拟器映射到车辆可用范围。自车按运动学自行车模型推进，其他参与者按记录运动。因此自车形成真实反馈回路，交通参与者在训练中仍不反应。

### 专家位移决定位置误差的容忍尺度

原文式 1–4 可合写为：

$$
\delta_t=\lVert p_t^{\mathrm{ego}}-p_t^{\mathrm{expert}}\rVert_2,\qquad
\kappa_t^{\mathrm{expert}}=\lVert p_t^{\mathrm{expert}}-p_{t-1}^{\mathrm{expert}}\rVert_2,
$$

$$
r_t=\alpha_3\exp\left(-\alpha_1\frac{\delta_t}{\kappa_t^{\mathrm{expert}}+\epsilon}\right)
+(1-\alpha_3)\exp\left(-\alpha_2\lvert v_t^{\mathrm{ego}}-v_t^{\mathrm{expert}}\rvert\right).
$$

$p_t$ 是二维位置，$v_t$ 是纵向标量速度，$\epsilon$ 避免专家静止时除零。用专家每步位移归一化，使高速时相同控制误差导致的较大位置偏移不至于受到同样严厉的惩罚。指数把两项映到 $(0,1]$，两者都在专家状态处最大；实验用 $\alpha_1=1/3$、$\alpha_2=1/4$、$\alpha_3=0.7$。[式 1–4、附录 C.3](https://arxiv.org/html/2610.29676v1#A3.SS3)

奖励没有显式把舒适、进度等逐项加权，但仍有规则定义训练域：出可行驶区域、与其他对象包围盒重叠或过度偏离专家会终止回合，并给 $-1$ 惩罚。附录把偏离条件具体写成：专家速度大于 1 m/s 时，$\lvert v_t^{\mathrm{ego}}/v_t^{\mathrm{expert}}-1\rvert>1$。因此它减少了行为偏好的手工奖励设计，保留了碰撞、道路与回放有效性的边界。

### 闭环优化有额外的数据采集成本

Highway-env 用 SAC，nuPlan 用 RLlib PPO；策略与价值函数分别优化。nuPlan 训练约 100M 环境步，在训练中以 1 Hz 决策、每个动作重复十个仿真步，测试则严格按 10 Hz 执行。专家轨迹和价值网络仅服务训练，推理只需要当前对象状态、地图、路线与策略。[附录 C.1](https://arxiv.org/html/2610.29676v1#A3.SS1)

示范都取自 nuPlan 训练集，但切分单位不同：BC 预处理约 100 万个训练场景；闭环训练提取约 27 万个互不重叠、15 秒且路线有效的片段。相同骨干对照控制了架构，仍不应把不同学习过程说成相同样本访问预算。[附录 C.4](https://arxiv.org/html/2610.29676v1#A3.SS4)

## 关键图与可视化结果

![原论文图 2：自车闭环推进与周车日志回放](../../assets/papers/drivemlp-expert-guided-closed-loop-figure-2.png)

青绿色是日志中的专家，深蓝色是策略实际控制的自车，灰色邻车按记录移动。橙色箭头度量同一时刻自车与专家的位置差，进入奖励。图中自车可以偏离再回到专家附近，但灰色车辆不会为这种偏离改变行为，这正是奖励参考成立的条件。[图 2](https://arxiv.org/html/2610.29676v1#S2.F2)

![原论文图 7：转弯、路口间隙、侧碰与晚制动失败](../../assets/papers/drivemlp-expert-guided-closed-loop-figure-7.png)

四例均来自 Val14-Reactive：依次是转弯过冲并侵入对向车道、错过短暂通行窗口、与其他车辆侧碰、对本车道障碍制动过晚。橙线为专家、蓝线为执行轨迹。这些失败使低平均延迟和较高总分的含义更具体：训练改善恢复能力，尚未解决狭窄交互窗口与全部安全事件。[图 7](https://arxiv.org/html/2610.29676v1#A9.F7)

## 实验结论与证据

### 同一 MLP 下，训练方式确实带来大幅差异

| 同 DriveMLP 架构，原表 1 | Val14 NR / R ↑ | Test14-Hard NR / R ↑ | Test14 NR / R ↑ |
| --- | --- | --- | --- |
| BC | 53.64 / 32.36 | 17.06 / 19.50 | 30.36 / 33.01 |
| AIRL | 51.74 / 58.74 | 43.00 / 52.09 | 48.88 / 61.15 |
| BC-RL | 77.19 / 78.05 | 66.05 / 65.35 | 77.17 / 77.23 |
| EGRL | 90.38 / 86.51 | 76.68 / 74.50 | 86.38 / 87.06 |

NR 指周车日志回放，R 指周车由反应式规则控制；表中为 nuPlan 总得分。相同网络下的结果支持训练策略是重要因素。Highway-env 表报告三种子均值及离散程度，nuPlan 这些主表没有同样给出多训练种子区间，不能把每个小差值都解释成稳定优势。[§3.2、表 1](https://arxiv.org/html/2610.29676v1#S3.T1)

### 对外比较的收益主要出现在 Reactive

| 原表 3 | Val14 NR / R ↑ | Test14-Hard NR / R ↑ | Test14 NR / R ↑ |
| --- | --- | --- | --- |
| Diffusion Planner | 89.87 / 82.80 | 75.99 / 69.22 | 89.19 / 82.93 |
| Flow Planner | 90.43 / 83.31 | 76.47 / 70.42 | 89.88 / 82.93 |
| DriveMLP | 90.38 / 86.51 | 76.68 / 74.50 | 86.38 / 87.06 |

相对 Flow Planner，Val14-R 提高 3.20 分，Test14-Hard-R 提高 4.08 分；Test14-NR 却低 3.50 分，均按原表相减。额外 InterPlan 80 场景中 DriveMLP 为 $37.07\pm2.36$，低于表中 PLUTO 的 49.27；335 场景为 $58.43\pm2.74$，低于 Flow Planner 的 61.82。作者注明 InterPlan 的 PLUTO 使用额外中心线参考，不能把它当完全同输入对照。[表 3、附录 D](https://arxiv.org/html/2610.29676v1#A4)

把 EGRL 接到其他骨干时，论文保留编码器而改为单步控制，并去掉开环辅助头。收益说明训练流程可以迁移到不同编码器，但没有验证完整扩散/flow 生成头在不变架构下也获得同样提升。[§3.3](https://arxiv.org/html/2610.29676v1#S3.SS3)

### 奖励尺度与硬件条件决定如何解释效率

去掉位置误差归一化后，Val14-R 从 86.51 降至 47.58；去掉速度奖励为 84.92。自车状态消融也很有解释力：EGRL 下加入自车状态让 Val14-NR 从 78.79 到 90.38，而 BC MLP 从 54.90 到 53.64。结果符合闭环训练改变状态使用方式的解释，但不是对网络内部因果机制的完整证明。[表 4、16](https://arxiv.org/html/2610.29676v1#A6.SS3)

推理在同一 Intel Xeon 6136 与 NVIDIA Quadro P6000 条件下测量，DriveMLP 为 2.76 ms、2.33M 参数，Flow Planner 为 42.31 ms、14.27M 参数；相除约 15.3 倍。训练则使用 4 张 L4 和 48 个 CPU 核，正文给约 112 L4 GPU 小时、附录给约 30 小时端到端时间，且含 45 个并行环境的回放采集。训练成本约为 BC 的 4.7 倍；与 A100 训练的 Diffusion Planner 比较时，GPU 小时不能直接当同等算力单位。[§4.5、附录 H](https://arxiv.org/html/2610.29676v1#A8)

## 应用场景与启发

为复杂规划器增加生成步骤之前，可以先建立一个对象级小模型，把同样的偏差恢复任务做成闭环训练对照。若它在反应式测试中更稳，后续工作就需要解释复杂结构究竟解决了多模态行为、感知不确定性还是只是弥补训练分布问题。

论文的归一化奖励也适合检查不同速度段的学习失衡：相同绝对位置误差在低速与高速下含义不同。不过位置、速度都围绕同一专家轨迹最优，仍可能压制其他合理行为；扩展到多意图驾驶时，需要另外定义可接受轨迹集合，而非直接把一个日志参考当唯一答案。

## 局限与阅读风险

方法依赖对象级状态及车辆动力学，实验未加入完整感知误差链或真实道路部署。非反应式训练让专家参考保持一致，却限制了偏离较大时的交互真实性；能迁移到部分 Reactive 场景，不等于训练已经模拟了周车响应。

主表与附录细分表还存在小数差异，例如 Val14-NR 写 90.38 与 90.39，Diffusion Planner 的主表 R 为 82.80、附录重跑表为 82.95。本报告分别保留对应表的结果，不混成一组更有利的数值。当前实现未发布，也使终止规则、预处理和高速仿真器的独立核验仍有缺口。

## 后续跟进

### 最小验证与停止条件

- 当前资源：2026-10-23 检查论文链接的 [DriveMLP 仓库](https://github.com/alessandro-canevaro/DriveMLP)，根目录只有 LICENSE、README，release 列表为空。论文可读，但训练代码、配置、预处理清单和模型权重尚未取得；nuPlan/Highway-env 原始数据与论文场景划分分开处理。
- 最小实验：实现发布后先固定同一批 15 秒片段、MLP 和输入，比较 BC、原始距离奖励、归一化 EGRL；在 NR/R 下配对评价，分别记录回合终止类型、速度段误差、碰撞与进度，至少使用三个训练种子。
- 成功信号：归一化奖励在同场景/输入/计算预算下改善 Reactive 表现，且收益并非主要来自提前终止难例或牺牲道路方向合规；同步报告训练环境步、CPU/GPU 时间与推理频率。
- 停止或转向：若统一预处理或终止规则后优势消失，先定位回放采样；若仅在精确对象状态下成立，优先加入检测偏差、漏检和状态延迟，再考虑扩大模型。

### 来源与核验记录

依据 [arXiv:2610.29676v1](https://arxiv.org/abs/2610.29676v1)，核验日期 2026-10-23。arXiv Comments 声明已获 CoRL 2026 录用，本轮未核到对应正式论文页。已读 §2–3、§4.1/4.5、§5、附录 C/D/F.3/H/I；核对奖励式 1–4、表 1–5/8/16–18，实际打开原图 2、7 和 PDF 首页单位。相关比较另读 PLUTO 方法与 Diffusion Planner 方法；仓库说明与目录单独核实。未安装其训练环境或运行实验。
