---
{
  "id": "rail-resilient-autonomous-driving",
  "tag": "autonomous-driving-security",
  "tags": ["autonomous-driving-security", "agentic-driving"],
  "title": "RAIL: Risk-Aware Human-in-the-Loop Framework with Adaptive Intrusion Response for Autonomous Vehicles",
  "source": "VehicleSec 2026 official page: https://www.usenix.org/conference/vehiclesec26/presentation/wasif-rail / arXiv:2601.11781: https://arxiv.org/abs/2601.11781",
  "authors": ["Dawood Wasif", "Terrence J. Moore", "Seunghyun Yoon", "Hyuk Lim", "Dan Dongseong Kim", "Frederica F. Nelson", "Jin-Hee Cho"],
  "affiliations": ["Virginia Tech", "US DEVCOM Army Research Laboratory", "Korea Institute of Energy Technology (KENTECH)", "The University of Queensland"],
  "comment": "RAIL 把曲率执行偏差、碰撞时间和 LiDAR 观测漂移融合为运行时风险分数，再由 contextual bandit 选择 shield、分级混合控制并把接管样本回灌学习。MetaDrive 与 CARLA 结果支持仿真鲁棒性，但不构成真实 CAN/LiDAR 攻击或真实驾驶员负担验证。"
}
---

## 一句话定位

RAIL 不是单独做入侵检测，而是把“发现异常、选择响应、分配人机控制权、用接管事件继续学习”接成控制频率下的闭环：三个异构风险线索经 Noisy-OR 汇成 Intrusion Risk Score（IRS），高风险时由 contextual bandit 选择针对性 shield，并按风险强度在原动作与安全动作之间连续混合。

## 论文要解决的问题

传统车载 IDS 常止于报警，安全 RL 又通常把风险压成固定 cost；两者都没有回答报警后应减速、纠偏还是请求接管，以及响应强度如何随场景变化。现有 HITL 方法也常把人类接管当作临时纠错，没有把接管前的风险状态、选择过的防护动作和后果作为结构化训练样本。RAIL 的切入点是让检测直接影响控制，同时把干预纳入后续策略更新。

## 方法和系统设计

- 从计划曲率与执行曲率的偏差、time-to-collision、LiDAR observation shift 三类信号计算归一化风险，再用加权 Noisy-OR 形成 IRS，保留主导风险来源以支持解释。
- IRS 超阈值时，contextual bandit 在曲率、TTC 与 OOD 三类 shield 中选择响应，并学习动作混合权重；低风险时保持原策略动作，人类仍可随时接管。
- 以 Soft Actor-Critic 为主干，把安全违规、接管和低风险行为写入双重奖励，并在 risk-prioritized replay 中提高高风险与人类纠正转移的采样概率。

## 关键图与可视化结果

![图 1：RAIL 把攻击输入、三类风险线索、IRS、shield 选择、控制混合与回放学习连成闭环](../../assets/papers/rail-resilient-autonomous-driving-figure-1.png)

图 1 对应 arXiv 版本 Figure 2。右侧从 adversarial inputs 到风险线索和 IRS，随后触发 bandit over shields；中部把安全动作与策略动作混合，左侧的人类接管及高风险转移进入学习缓冲区。读图重点是检测不再是旁路报警，但所有模块共享同一个风险分数也意味着阈值失配可能同时影响响应和学习。

![图 2：风险感知 HITL 在执行前加入安全层，并把环境和人工反馈回送策略](../../assets/papers/rail-resilient-autonomous-driving-figure-2.png)

图 2 对应 arXiv 版本 Figure 1，给出更抽象的人机闭环。它支持论文的系统定位：人类既能提供情境线索和接管，也能让接管结果进入后续更新；但图本身不说明论文实验中的“人类”是否来自真实受试者，仍需结合实验设置判断。

## 实验结论与证据

MetaDrive 中各方法使用五个随机种子，论文报告 RAIL 在 30K interaction steps 下取得 Test Return 360.65、Test Success Rate 0.85、Test Safety Violation 0.75 和 Disturbance Rate 0.0027。跨仿真器测试在 CARLA 使用 8K steps，报告 return 1609.70、success rate 0.41。

攻击评测同样位于 MetaDrive：CAN/actuation injection 以最长 5 秒、每 30 秒一次的有界 steering 或 acceleration bias 模拟；LiDAR spoofing 则把 72-beam LiDAR 的连续方位扇区改成车前约 4 m 的 phantom obstacle。RAIL 在两类设置下分别报告 SR 0.68/0.80、DRA 0.37/0.03、ASR 0.34/0.11。相对论文基线，这支持分级 shield 在指定仿真扰动下减少攻击成功与接管，但不代表已抵抗真实 CAN 注入或物理 LiDAR 欺骗。

## 应用场景与启发

- 应用场景：自动驾驶运行时安全代理、仿真入侵响应评测、有人远程监督的车队，以及把 near miss 转成训练样本的持续学习流程。
- 方法启发：检测器输出应带来源和风险强度，控制器才能选择不同 shield；同时需要记录 shield 前后动作与人工接管，才能审计安全收益是否来自过度保守。
- 讨论问题：如果相机、雷达或地图给出的风险彼此相关，Noisy-OR 的独立性近似和固定阈值是否会重复计数风险，并造成不必要接管？

## 局限与阅读风险

核心证据来自 MetaDrive 与 CARLA，没有实车、硬件在环或真实攻击链验证。CAN attack 是控制通道 bias，LiDAR attack 是程序化扇区覆写，均比真实攻击者的时序、可达性和传感器物理约束更简化。论文把 human override 纳入框架，但没有报告真实驾驶员受试、接管反应时间、工作负荷或错误接管；DRA 因此是仿真指标，不等价于真实运营负担。三类风险线索、权重和阈值的跨城市、跨天气校准也尚未证明。

## 后续跟进

- 先复现相同 attack schedule 和五种子结果，再改变攻击持续时间、频率与组合方式，检查 IRS 是否对未见攻击保持校准。
- 增加真实驾驶员或远程安全员实验，测量接管延迟、误接管和自动恢复后的信任变化。
- 在硬件在环中接入真实 CAN 网关与传感器回放，比较“检测后固定急停”和 RAIL 分级响应的安全、通行效率与误报代价。
