---
{
  "id": "cav-platoon-joining-rl",
  "tag": "cooperative-autonomous-driving",
  "tags": ["cooperative-autonomous-driving", "autonomous-driving-testing"],
  "title": "Reinforcement Learning-Based Control of CAV Platoon Joining Maneuvers in Mixed Traffic",
  "source": "arXiv:2608.26860 / https://arxiv.org/abs/2608.26860 / Code: https://github.com/biaoyin/platoon-drl/tree/platoon_join",
  "authors": ["Biao Yin", "Abderrahmane Kasmi", "Nadir Farhi"],
  "affiliations": ["Universite Gustave Eiffel", "Universite Paris Dauphine-PSL", "COSYS-GRETTIA, Universite Gustave Eiffel"],
  "comment": "论文在 SUMO+PLEXE 中比较 DQN、DDQN、PPO 处理混合交通 CAV platoon joining，并把训练期 TTC penalty 与执行期 safety shield 分开评测。PPO 在全部 traffic loads 下约 98% 成功、碰撞低于 1%，但理想通信、单一仿真器和缺少多 seed 区间限制部署结论。"
}
---

## 一句话定位

这篇论文研究的不是 platoon 内稳定跟驰，而是一个 CAV 从 mixed-traffic lane 选择目标 platoon、调整纵向速度、换入 dedicated CAV lane 并接到队尾的完整 joining phase。方法新颖性不在 DQN/DDQN/PPO 本身，而在统一环境中直接比较两种安全介入位置：把 TTC 风险写入训练 reward，或让独立 safety shield 在执行前否决危险动作，并量化安全收益如何转化为更多等待和 abandonment。

## 论文要解决的问题

现有 CACC 常假设 platoon 已经形成，而实际 joining 同时涉及 gap selection、速度同步、lane change 和混合交通中的人类驾驶扰动。纯 rule-based policy 难覆盖密度变化，RL 又可能通过危险探索获得成功率；已有工作往往分别使用 reward penalty 或外部 shield，缺少在同一 microscopic traffic setting 下的可比证据。

论文构造两车道高速：内侧为 100% CAV platoon lane，外侧为 50% CAV 与 HDV mixed lane。joiner 必须在 200 m communication zone 内找到可加入 platoon，并在 target 尾部完成 lane change 和 CACC catch-up。研究问题是不同 RL algorithm 在交通负载变化下能否兼顾成功率、碰撞、失败、决策步数和最终跟车距离。

## 方法和系统设计

- 环境使用 SUMO、Gym 与 PLEXE。HDV 由 IDM/LC2013 控制，普通 CAV 与 platoon leader 使用 ACC，platoon member 使用 CACC；进入 joining phase 后，RL agent 接管 joiner 的离散纵向和横向动作。
- 15 维 state 包含 ego、target platoon 末车及 mixed/platoon lane 邻车的相对位置和速度。动作覆盖加速、减速、保持、lane change 和放弃 joining，决策间隔为 0.5 s。
- reward 同时包含成功、失败、碰撞、延迟、不稳定跟距、jerk 与 risky maneuver。内部 safety 方案用前后 TTC penalty 让 policy 在训练期避开危险 lane change。
- 外部 safety shield 在无 TTC penalty 的 policy 输出后检查 rear/front TTC；不满足 2 s lane-change 或 1 s speed-adjustment 条件时阻止动作。这样可以观察碰撞被转化为 abandonment 的代价。

## 关键图与可视化结果

![图 1：SUMO+PLEXE 环境与 PyTorch agent 之间的状态和控制闭环](../../assets/papers/cav-platoon-joining-rl-figure-1.png)

Figure 1 明确了仿真责任边界：交通流、IDM/LC2013、ACC/CACC 都由环境执行，agent 只接收 TraCI state 并输出 longitudinal/lateral actions。因而结果证明的是 joining decision layer，不是通信栈、感知前端或车辆底层控制器的端到端能力。

![图 2：不同 traffic loads 下 DQN、DDQN、PPO 有无 TTC penalty 的碰撞率](../../assets/papers/cav-platoon-joining-rl-figure-2.png)

Figure 9(c) 展示 TTC penalty 的核心作用：虚线无 penalty 版本在多组负载下出现更高碰撞，实线版本整体更低；PPO 的实线通常最低。图也提醒平均“低于 1%”仍隐藏特定负载 spike，不能只用总均值评价 shield 或 policy。

## 实验结论与证据

三种模型各训练 `10^6` decision steps，交通负载逐步增加；DQN/DDQN/PPO 的训练时间分别为 46.8、18.9、12.1 小时。PPO 约 3,000 iterations 收敛，最终 joining success 接近 98%，collision 与 failure 接近零；但 PPO 每个 event 通常需要 10-15 个 decision steps，并比 DQN/DDQN 更保守。

跨 16 组 mixed/platoon lane traffic-load combinations，带 TTC penalty 的 PPO 成功率均高于 97.5%，碰撞低于 1%。当 platoon lane 达 2,000 veh/h 时，DQN/DDQN 成功率会跌破 90%，主要是 wrong-position 与 unfinished joining；移除 TTC penalty 后失败减少，但碰撞升高，说明“完成更多”并不等于“更安全”。

外部 shield 把 collision rate 几乎降到零。四个高 platoon-load cases 中，DQN success 为 91.6%-93.7%、abandonment 为 6.1%-8.3%；DDQN success 为 95.5%-97.1%、abandonment 为 2.8%-4.3%；PPO success 为 94.4%-96.9%、abandonment 为 2.8%-5.2%。证据支持 shield 的碰撞抑制，却也表明它会拒绝一部分原本成功但 TTC 较小的 joining。

作者声明的 `platoon_join` GitHub branch 经核验包含 SUMO network/config、Gym environment、DQN agent、`train.py`、`test.py` 和环境文件，不是占位 README；但仓库没有论文中的固定 seed、结果 checkpoint 或一键重建图表的 release manifest。

## 应用场景与启发

- 应用场景：高速 platoon formation、dedicated CAV lane 接入、on-ramp cooperative merge 和混合交通下的安全策略回放。
- 方法启发：把 risk penalty 与 runtime shield 视为不同机制。前者改变 policy 的行为分布，后者改变 action acceptance；应分别评价 collision、abandonment 和 recovery delay。
- 协同启发：communication zone 不应只用固定 200 m 半径；可把 packet age、消息缺失和定位不确定性加入 state，让 joining request 与执行时的可信度联动。
- 讨论问题：安全 shield 的“拒绝加入”应算失败、合理 defer，还是需要带时间预算的可恢复状态？不同计分方式会改变算法排名。

## 局限与阅读风险

整个证据来自一个 SUMO+PLEXE 双车道模型，通信信息被假设及时可得，没有 packet loss、latency、AoI、定位漂移、感知漏检或异步控制。HDV 只由 IDM/LC2013 生成，无法覆盖真实驾驶员在 platoon merge 附近的反应分布。

论文没有报告多随机 seed、置信区间或独立 test scenarios 的固定清单，training curve 还经过 smoothing。动作空间离散，论文自己承认没有显式优化 speed trajectory，因此 joining time、能耗和舒适性结论有限。code branch 可读，但含缓存文件，缺 license、commit-pinned artifact、checkpoint 与结果复算说明；当前论文只有 arXiv v1。

## 后续跟进

- 固定代码 commit，补齐多 seed、raw event ledger 和每个 traffic-load cell 的置信区间。
- 加入 V2X delay/loss、GNSS bias、perception dropout 与 asynchronous control，比较 reward penalty 和 shield 在同一扰动下的退化。
- 把 abandonment 改成可恢复 defer：记录下次成功加入时间、额外能耗和对主车流的扰动。
- 在高保真 simulator 或小规模 VIL 中验证 TTC 阈值是否仍能避免碰撞，而不会因 sensing latency 过晚触发。
