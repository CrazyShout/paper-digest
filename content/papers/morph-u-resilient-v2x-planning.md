---
{
  "id": "morph-u-resilient-v2x-planning",
  "tag": "cooperative-autonomous-driving",
  "tags": ["cooperative-autonomous-driving", "vehicle-road-cooperation", "autonomous-driving-security", "autonomous-driving-testing"],
  "title": "MORPH-U: Multi-Objective Resilient Motion Planning for V2X-Enabled Autonomous Driving in High-Uncertainty Environments via Simulation",
  "source": "arXiv:2605.07370 / https://arxiv.org/abs/2605.07370",
  "authors": ["Shih-Yu Lai"],
  "affiliations": ["National Taiwan University"],
  "comment": "MORPH-U 把 V2X 消息延迟、丢包和伪造纳入闭环规划，使用 LDM、Hybrid-A*、Pareto tuning 和轻量 Byzantine gate 处理不确定事件触发。"
}
---

## 一句话定位

MORPH-U 是一篇 V2X-enabled autonomous driving 的鲁棒运动规划论文。它关注的不是理想通信下的协同收益，而是当 CAM/DENM 消息可能延迟、丢失或被伪造时，自动驾驶车辆如何在 CARLA 闭环栈中更新 Local Dynamic Map、触发重规划，并避免错误 V2X 触发把 planner 带到危险动作。

## 论文要解决的问题

V2X 能提前告警视线外危险，但也会引入新的不确定性：消息可能不同步、地图知识可能变化、恶意或错误 DENM 可能触发不必要重规划。传统 motion planning 常把通信输入当作可信上下文，缺少对错误触发的防护。MORPH-U 的问题是：如何在实时闭环约束下，同时优化安全、响应性、轨迹跟踪和平顺性，并阻止 faulty V2X trigger 直接进入规划链路。

## 方法和系统设计

- 在 CARLA 中搭建闭环栈，把 LiDAR、radar、camera 与 V2X CAM/DENM 融合到 ego-centric Local Dynamic Map。
- 当验证后的 hazard 或地图变化影响既有路线时，触发 Hybrid-A* replanning，并用 tracking error、minimum TTC、responsiveness 和 smoothness 构建多目标权衡。
- 通过 Pareto-frontier analysis 选择规划和控制 operating point，并加入 quorum rule 加 onboard sensor veto 的 Byzantine-inspired acceptance gate，过滤伪造或错误 V2X 事件。

## 关键图与可视化结果

![图 1：MORPH-U 的闭环架构，展示传感器和 V2X 信息进入 LDM、触发 Hybrid-A* 重规划以及 acceptance gate 的位置](https://arxiv.org/html/2605.07370v1/assets/Fig_2.png)

这张图说明 MORPH-U 的价值在链路完整性：V2X 不是直接输入 planner，而是先进入时间窗口同步、LDM 融合和触发验证，再决定是否重规划。

![图 2：MORPH-U 使用的多车交叉口仿真场景](https://arxiv.org/html/2605.07370v1/assets/multivehiclefleet.png)

这张图适合检查实验场景是否覆盖 V2X 最容易体现价值的复杂交互，例如遮挡、交叉口、多车冲突和事件驱动地图更新。

## 实验结论与证据

摘要报告 V2X-augmented LDM 能提升下游安全，Pareto tuning 能控制精度和舒适性权衡，acceptance gate 能在 saturated false-DENM injection 条件下阻止不安全重规划。证据重点不是单一规划指标，而是 minimum TTC、响应性、平顺性和攻击触发下的鲁棒性共同构成的闭环评估。

## 应用场景与启发

- 应用场景：V2X 协同规划、路侧事件告警、动态地图更新、恶意消息注入防护和 CARLA 闭环测试。
- 方法启发：V2X 可靠性应被建模为 planner 的输入质量问题，而不是通信层的外部问题；acceptance gate 可以作为协同驾驶安全接口。
- 讨论问题：quorum 与 onboard veto 在真实车路部署中如何设置阈值，才能避免漏报危险和误拒真实事件。

## 局限与阅读风险

论文使用 CARLA 仿真，真实 V2X 的延迟分布、定位误差、路侧覆盖范围和多源身份可信度可能更复杂。单作者论文需要特别检查实验范围、代码可用性和 baselines 是否充分。Byzantine-inspired gate 是轻量机制，能防 false DENM 注入，但未必覆盖更隐蔽的数据污染或协同欺骗。

## 后续跟进

- 检查是否开放 CARLA 场景、V2X 消息模拟器和 Pareto tuning 配置。
- 和 MDrive 一起看：MDrive 给 benchmark，MORPH-U 给一个带攻击防护的规划栈。
- 记录 V2X 消息不确定性的建模方式，作为后续协同规划鲁棒性实验变量。
