---
{
  "id": "cav-platoon-joining-rl",
  "tag": "cooperative-autonomous-driving",
  "tags": [
    "cooperative-autonomous-driving",
    "autonomous-driving-testing"
  ],
  "title": "Reinforcement Learning-Based Control of CAV Platoon Joining Maneuvers in Mixed Traffic",
  "source": "arXiv:2608.26860 / https://arxiv.org/abs/2608.26860 / Code: https://github.com/biaoyin/platoon-drl/tree/platoon_join",
  "authors": [
    "Biao Yin",
    "Abderrahmane Kasmi",
    "Nadir Farhi"
  ],
  "affiliations": [
    "Universite Gustave Eiffel",
    "Universite Paris Dauphine-PSL",
    "COSYS-GRETTIA, Universite Gustave Eiffel"
  ],
  "comment": "论文在 SUMO+PLEXE 中比较 DQN、DDQN、PPO 处理混合交通 CAV platoon joining，并把训练期 TTC penalty 与执行期 safety shield 分开评测。PPO 在全部 traffic loads 下约 98% 成功、碰撞低于 1%，但理想通信、单一仿真器和缺少多 seed 区间限制部署结论。"
}
---

## 一句话定位

这篇论文在 SUMO+PLEXE 中比较 DQN、DDQN、PPO 如何让已选定的车辆接入已选定车队的尾部，并分开研究训练奖励中的 TTC 风险惩罚与执行前的外部 safety shield；价值在于安全、成功率、等待时间怎样一起变化。

- 核心证据：16 组交通负载中，带 TTC 惩罚的 PPO 据 §4.3.3 报告成功率超过 97.5%、碰撞低于 1%；其完成事件通常需要更多决策步。
- 主要边界：shield 的表 1 仍有 PPO 在双车道 2000 veh/h 时碰撞 0.1% 的一行；它是经验阈值保护，不能写成形式化无碰撞保证。[图 9、表 1](https://arxiv.org/html/2608.26860v1#S4.SS4)

## 论文要解决的问题

### 任务与责任边界

场景为两车道高速：外侧混合车道含 50% CAV 和人类驾驶车辆，内侧为 100% CAV 的专用车队车道。系统先随机选择可加入车辆，再按目标队列是否已有加入/退出操作、目的地顺序等规则选定目标；RL 从此接管速度调整和换道时机。目标选择不属于本文策略的六个动作。[§3.2](https://arxiv.org/html/2608.26860v1#S3.SS2)

例如待加入车辆跑在目标车队尾车前面时，它先减速让尾车通过，再换入后方，最后交给 CACC 缩小跟距。通信半径为 200 m，但选车队时检查的是尾车位于自车后 150 m 至前 5 m 的区间，两者不能混用。论文假设通信范围内的邻车状态及时可得，未把感知误差、报文年龄和丢包作为状态。[§3.2–3.3](https://arxiv.org/html/2608.26860v1#S3.SS3)

### 相关工作与差异

| 工作与一手来源 | 已有机制 | 本文的变化与比较边界 |
| --- | --- | --- |
| Krasowski、Wang、Althoff，ITSC 2020；[作者存档原文 §III](https://mediatum.ub.tum.de/doc/1548735/256213.pdf) | 用周围车辆可达占据集合验证候选轨迹、屏蔽不安全动作；无安全候选时执行已验证的 safe ACC，训练与执行均可受保护。 | 本文仅用前后 TTC 阈值否决动作，并观察 abandonment；没有等价的可达集合覆盖和末端不变安全集条件，不能继承该工作的证明。成功率也因道路和任务不同不能直接排名。 |
| Segata 等，Multi-Technology Cooperative Driving，IEEE TMC；[作者版 §3–4](https://www.cms-labs.org/bib/segata2023multi-technology/segata2023multi-technology.pdf) | PLEXE 配合通信仿真；SafeSwitch 监测多链路 PDR，经 gap-control 状态逐步调整车距，再在 CACC/ACC 等控制器间切换。 | 本文使用 PLEXE 的车辆控制能力，研究入队决策，但没有运行该文的多链路失效/恢复机制。使用同一工具不能自动证明通信退化时仍安全。 |

## 方法和系统设计

### 状态、动作与环境控制

15 维状态包括自车及相关邻车的 7 个速度、6 个纵向距离和 2 个车道编号；距离含有方向的目标尾车距离与目标间隙大小。缺失前后车用车道限速与 200 m 范围作默认值，这会让“确实没有车”和“通信/检测丢失”在当前状态设计中难以区分。

动作恰好六种：按当前速度换道，以及保持车道并施加 +2、+1、0、−1、−2 m/s²。每个动作持续 0.5 s，对应五个 0.1 s 仿真步。没有策略主动输出的“放弃”动作；shield 拒绝危险动作后的 abandonment 是系统结果。[§3.3、式 7](https://arxiv.org/html/2608.26860v1#S3.SS3)

人类驾驶车辆采用 IDM/LC2013；普通 CAV 与队首用 ACC，加入操作时 RL 接管，成功换道后的 gap closing 再用 PLEXE CACC。RL 奖励中的舒适间距为换道刚完成的 10–20 m；最终 CACC 的 5 m 协调跟距属于之后的控制阶段，不能当作同一距离指标。

### 奖励与 shield 的两种作用

原文式 8 把状态相关奖励组合为：

$$
 r=\alpha_s(r_s+r_r+r_u)+\alpha_f r_f+\alpha_c r_c+\alpha_k(r_r+r_j).
$$

$\alpha_s,\alpha_f,\alpha_c,\alpha_k$ 分别指示成功、失败、碰撞和保持车道；成功奖励 $r_s=100$、失败 $r_f=-50$、碰撞 $r_c=-10000$。$r_u$ 惩罚换道后的不合适间距，$r_j$ 在纵向 jerk 超过 4 m/s³ 时惩罚。$r_r$ 则在成功换道但前后最小 TTC 小于 2 s 时为 −100，保持车道调整速度但最小 TTC 小于 1 s 时为 −50，否则为 0。[式 8–11](https://arxiv.org/html/2608.26860v1#S3.E8)

TTC 是按当前相对运动估计碰撞还剩多久，阈值惩罚改变训练时对动作的偏好；即使碰撞惩罚很大，也不是一个硬约束。论文对非闭合速度、距离定义到 TTC 的具体代码处理没有在正文展开，本次未核查这一实现。

外部 shield 研究使用不含 $r_r$ 的已学策略，并在执行前作同一阈值检查。以下是 §4.4 的逻辑重写，不是论文新增损失：

$$
\begin{aligned}
 \operatorname{allow}(a_{\rm change})&=\mathbf1[\min(\operatorname{TTC}_{\rm target},\operatorname{TTC}_{\rm rear})\ge 2\,\mathrm{s}],\\
 \operatorname{allow}(a_{\rm speed})&=\mathbf1[\min(\operatorname{TTC}_{\rm front},\operatorname{TTC}_{\rm follow})\ge 1\,\mathrm{s}].
\end{aligned}
$$

它改变执行动作的接受集合，并把部分危险尝试转成 abandonment；与在奖励中塑造策略不同。本文没有完成“同一权重同时打开 reward penalty 与 shield”的完整交叉消融，因此不要把表 1 当作两者叠加结果。[§4.4](https://arxiv.org/html/2608.26860v1#S4.SS4)

### 算法与训练设置

DQN 在目标网络中同时最大化、评价下一动作；DDQN 用在线网络选动作、目标网络评价，减少过估计；PPO 直接优化裁剪后的策略概率比，使用价值网络和 GAE。三者都不是本文新提出的算法，比较重点是这个环境、状态和奖励配置。

网络均为 4 层 MLP，隐藏维度 32/64/64/32、LeakyReLU。DQN/DDQN 使用 Adam、学习率 0.0002、batch 64、replay 20,000；PPO actor/critic 学习率 0.0001/0.001、rollout 2048、minibatch 256、每轮 5 epoch、clip 0.1、GAE 0.95；折扣均为 0.9。总训练量均为一百万决策步，traffic load 逐步提高。[附录表 A.1–A.3](https://arxiv.org/html/2608.26860v1#A1)

推理保留学得的策略及仿真低层控制器，不需要 reward 或未来真值；测试探索率/随机采样的完整配置须与代码固定版本核对，不能将训练末端保留的 1% ε 探索直接当作确定性部署策略。不同方法每事件耗步不同，等决策步不等于经历等量独立入队事件。

## 关键图与可视化结果

![原论文图 1：SUMO/Gym/PLEXE 与 PyTorch agent 经 TraCI 构成闭环](../../assets/papers/cav-platoon-joining-rl-figure-1.png)

左侧道路、流量和车辆控制产生状态，右侧 policy/Q-network 决定纵横向动作；箭头在 TraCI 处闭环。这里输入的是仿真状态，图没有传感器检测、真实报文或硬件控制通道，因而证明的是仿真决策链。[原图 1](https://arxiv.org/html/2608.26860v1#S3.F1)

![原论文图 9(c)：16 组负载下各算法有无 TTC 奖励的碰撞率](../../assets/papers/cav-platoon-joining-rl-figure-9c.png)

横轴每一对为混合/专用车道负载，单位 veh/h；纵轴为碰撞百分比。实线带 TTC 惩罚，虚线不带；PPO 红实线整体较低，但灰色 DQN 在若干负载上加惩罚后并不更低。不要把总体趋势写成每个配置严格改善。这张图也不是外部 shield 的结果，shield 在表 1。[原图 9 与图注](https://arxiv.org/html/2608.26860v1#S4.F9)

## 实验结论与证据

### 设置与统计单位

每车道负载取 500/1000/1500/2000 veh/h，形成 16 组组合；混合/专用车道限速 100/120 km/h。训练预热 1200 仿真步，每 episode 1000 决策步，一个 event 可以跨多个动作。成功是正确到达目标尾车后，失败含加入位置错误或驶出网络仍未完成；shield 还单列 abandonment。[§4.1–4.3、表 A.3](https://arxiv.org/html/2608.26860v1#S4.SS1)

实验机器为 2.4 GHz、64 处理器、512 GB RAM 服务器。论文未给出多独立训练 seed 区间、每个测试 cell 的事件数或固定场景清单；训练曲线有平滑，因此以下主要是作者报告的经验结果，不是显著性检验。

### 匹配比较与代价

| 相同一百万决策步预算 | DQN | DDQN | PPO |
| --- | ---: | ---: | ---: |
| 原文 §4.2 训练时间（h） | 46.8 | 18.9 | 12.1 |
| 网络隐藏层 | 32/64/64/32 | 32/64/64/32 | 32/64/64/32 |

PPO 训练耗时更短，但它每次入队通常更谨慎、事件数量也不同；不能据此推论所有环境下 PPO 的样本效率均更高。作者在 §4.3.3 报告带惩罚 PPO 在所有负载成功率大于 97.5%、碰撞小于 1%，而 DQN/DDQN 在专用车道 2000 veh/h 的若干组成功率跌破 90%。原文训练末段约 10–15 决策步对应 5–7.5 s，不是单步推理时延。

### 外部保护的安全—效率交换

| 表 1，混合/专用负载（veh/h） | 无 TTC 奖励 + shield | 成功 ↑（%） | 碰撞 ↓（%） | 放弃（%） |
| --- | --- | ---: | ---: | ---: |
| 500 / 2000 | DQN | 93.7 | 0.0 | 6.1 |
| 同组 | DDQN | 97.1 | 0.0 | 2.8 |
| 同组 | PPO | 94.4 | 0.0 | 5.2 |
| 2000 / 2000 | DQN | 91.6 | 0.0 | 8.3 |
| 同组 | DDQN | 95.5 | 0.0 | 4.3 |
| 同组 | PPO | 96.8 | 0.1 | 2.8 |

这些行说明最强算法随场景及安全机制变化：低混合流量、高车队流量时 DDQN+shield 的成功率高于 PPO；最高双负载时 PPO 成功率最高但仍有残余碰撞。表中 0.0 是显示精度下的结果，没有事件数就不能计算可靠的零碰撞上界。[表 1](https://arxiv.org/html/2608.26860v1#S4.T1)

图 9 的有无 TTC 惩罚比较支持风险奖励改变策略，但不同训练权重、事件分布及缺少多 seed 限制因果归因。表 1 与图 9 共同展示两种安全介入位置，仍不是形式化安全证明或公平跨论文排行榜。

## 应用场景与启发

- 作者主张：该环境可研究混合车道到 CAV 专用车道的入队，并比较学习与外部控制的安全效率权衡。
- 我的判断：最可复用的是明确分工的选队、RL 操作、CACC 收距流程，以及将 abandonment 单列；任意把拒绝动作算成成功或失败都会改变结论。
- 待验证假设：把一次性 abandonment 改为带时间预算的可恢复等待，可以保留 shield 的安全收益，同时减少最终未入队比例；应记录最终完成时间和对后车的扰动，防止只把失败延后计账。

## 局限与阅读风险

作者明确承认离散加速度动作未显式优化完整速度轨迹，舒适与能耗也未充分纳入，并把车队退出留给未来工作。当前环境只有 IDM/LC2013 的人类驾驶行为，未检验自适应博弈、恶意切入或真实道路分布。

及时通信是显式假设；0.5 s 动作周期本身不能替代通信时延实验。参考文献中 DDQN 段引用的 [21] 实际列的是早期 DQN 论文，算法身份须依据定义和代码核对，不能只沿引用链。当前结果适合设定仿真基线，不足以支持实际高速部署的碰撞保证。

## 后续跟进

### 最小验证与停止条件

- 当前资源（2026-09-12）：[作者 platoon_join 分支](https://github.com/biaoyin/platoon-drl/tree/platoon_join)有 config、dqn、env、plexe-pyapi、train/test 和环境文件，README 给出启动入口。数据由仿真生成；原结果 checkpoint、固定 seed 清单、完整 PPO/DDQN 配置与图表复算入口本次未逐项核实，不能称一键复现。
- 最小实验：固定该分支 commit 和四个专用车道 2000 veh/h 场景，先用已训练权重检查动作/TTC/事件日志，再按三个独立 seed 比较 penalty on/off × shield on/off；对每次候选动作记录是否被拒、最终入队时刻、最小 TTC、碰撞及后车制动。前提是取得可用 checkpoint；无权重时按附录配置训练，原文服务器不是最低资源要求。
- 成功信号：启用 shield 在同一组场景减少碰撞，延迟/丢包后仍保持效果，且可恢复等待减少最终放弃而不把风险转移到后车；报告配对差值和事件数。
- 停止/转向条件：安全收益仅在即时真值状态成立，或“等待”只是隐藏失败并增加危险制动，则先改状态不确定性和安全预测范围，停止增加 RL 网络复杂度。

### 来源与核验记录

依据 [arXiv:2608.26860v1 全文](https://arxiv.org/html/2608.26860v1)，版本日期 2026-08-27，核验日 2026-09-12。核对 §3–4、式 7–11、表 1、附录 A.1–A.3，以及原图 1、9(c) 实际图片；机构由首页确认。相关工作分别打开 TUM 作者 PDF §III 与 PLEXE 作者 PDF §3–4，后者在网页工具失败后由官方地址下载读取。未运行策略或仿真，不构成复现。
