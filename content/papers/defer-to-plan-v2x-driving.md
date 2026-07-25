---
{
  "id": "defer-to-plan-v2x-driving",
  "tag": "cooperative-autonomous-driving",
  "tags": ["cooperative-autonomous-driving", "end-to-end-autonomous-driving"],
  "title": "Defer to Plan: Adaptive Multi-Agent Fusion for End-to-End V2X Driving",
  "source": "arXiv:2607.19774 / https://arxiv.org/abs/2607.19774",
  "authors": ["Nuoran Li", "Zhang Zhang", "Yueran Zhao", "Tianze Wang", "Chao Sun"],
  "affiliations": ["Shenzhen Automotive Research Institute", "National Engineering Research Center of Electric Vehicles", "Beijing Institute of Technology"],
  "comment": "把多车融合从感知阶段推迟到规划阶段，由轨迹上下文动态决定车辆与路侧信息的权重；在 V2Xverse 闭环中同时提高驾驶分与违规分，适合讨论“通信什么”如何直接服务决策。"
}
---

## 一句话定位

这篇论文针对协同驾驶中一个常被默认的接口错误：远端特征通常先按检测目标固定融合，再交给规划器，但“有利于检测”的信息不一定“有利于当前动作”。Defer to Plan 把融合推迟到规划阶段，用自回归解码器根据当前轨迹上下文动态选择 ego 与路侧 token；它进入本期，是因为论文不仅报告轨迹误差，还在 V2Xverse 闭环、定位噪声和 200–600 ms 时延下验证了收益。

## 论文要解决的问题

CoDriving 等协同端到端系统仍沿用“感知先融合、规划后消费”的两阶段结构。固定融合权重无法区分场景价值：遮挡路口的路侧视角可能决定是否刹车，开阔道路上的同类特征却大多是冗余背景。论文估计路侧特征中 75%–90% 与当前规划无关；如果在规划器看到意图前就压缩并融合，真正关键的早见行人或骑行者信息可能与背景一起被平均。

## 方法和系统设计

- ego 与 roadside 两条流分别用 MotionNetwork 聚合历史 BEV 和占据特征，保留动态信息后再压缩为空间 token。
- 路侧流先做 Top-10% 通道净化，抑制建筑、停放车辆等规划无关背景；随后以 6 个专家、Top-3 路由的 MoE tokenizer 适配直行、转弯、让行等异质机动。
- 自回归规划解码器采用混合因果掩码，在轨迹生成过程中动态重估本车与路侧 token 的作用，而不是在感知端给远端特征固定权重。

## 关键图与可视化结果

![图 1：Defer to Plan 的双流规划阶段协同融合架构](../../assets/papers/defer-to-plan-v2x-driving-figure-1.jpg)

图 1 来自官方 arXiv 源码。车辆流保留自车时序状态，路侧流先净化再经 MoE 压缩，二者直到规划解码阶段才交互。读图重点是融合发生的位置改变：规划 token 可以反向决定哪些协同证据值得进入当前动作，而不是单纯增加融合网络深度。

![图 2：遮挡骑行者出现时，模型先停车让行再恢复左转](../../assets/papers/defer-to-plan-v2x-driving-figure-2.png)

图 2 展示 V2Xverse 中的 yield-and-turn rollout。路侧视角提前暴露被遮挡骑行者，规划器先停止、待其通过后继续转弯。它提供了闭环行为层面的定性证据，但仍不能替代真实通信链路上的安全验证。

## 实验结论与证据

实验使用 CARLA/V2Xverse 的 8 个城镇、67 条路线，包含遮挡路口和突发行人。相对 CoDriving，ADE 从 0.619 m 降至 0.598 m，FDE 从 1.413 m 降至 1.393 m；闭环 Driving Score 从 77.15 提至 79.72，Infraction Score 从 0.82 提至 0.88，但 Route Completion 从 92.34 降到 91.05，表明收益伴随更保守的通行策略。

在 0.6 档位姿噪声下，方法 ADE 相对退化 4.01%，小于 CoDriving 的 5.50%；600 ms 协同信息延迟下，ADE 退化 2.34%，也略小于 2.75%。消融中移除自回归解码器的损失最大，ADE 从 0.598 恶化到 0.628。RTX 3090 单卡总时延为 176.6 ms，其中感知占 158.2 ms，新增规划链为 18.4 ms。

## 应用场景与启发

- 应用场景：面向车路协同路口补盲、规划导向语义通信和带宽受限的多车决策。
- 方法启发：通信调度、特征压缩和融合权重应以碰撞风险、通行效率或轨迹不确定性为目标，而不应只对检测 AP 优化。
- 讨论问题：若动态融合发现远端证据与 ego 证据冲突，系统应降低权重、触发额外通信，还是直接回退 ego-only？

## 局限与阅读风险

全部结果来自 V2Xverse 仿真，未接入真实 C-V2X 链路；定位噪声和时延是离线注入，未覆盖突发丢包、带宽竞争和时钟漂移。系统假设固定通信拓扑，没有研究动态参与者选择。论文称“保持通信效率”，但核心表格没有给出端到端吞吐、空口负载或消息成功率，因此不能把 token 压缩直接等同于可部署通信收益。

## 后续跟进

- 最小复现应固定 CoDriving 骨干，先比较感知阶段固定融合与规划阶段自回归融合，并保留 RC/IS 的安全效率权衡。
- 增加真实 C-V2X trace、随机丢包和动态邻居集合，检查注意力降权是否真的能作为失效保护。
- 将规划 token 的边际价值与 AoI/带宽调度联动，形成“何时发、发什么、规划是否采用”的统一实验。
