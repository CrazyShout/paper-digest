---
{
  "id": "terrazero-self-play-driving",
  "tag": "end-to-end-autonomous-driving",
  "tags": ["end-to-end-autonomous-driving", "autonomous-driving-testing"],
  "title": "TerraZero: Procedural Driving Simulation for Zero-Demonstration Self-Play at Scale",
  "source": "arXiv:2607.13028 / https://arxiv.org/abs/2607.13028 / https://terra-applied.github.io/TerraZero",
  "authors": ["Zhouchonghao Wu", "Akshay Rangesh", "Weixin Li", "Wei-Jer Chang", "Zachary Lee", "Tim Wang", "Wei Zhan"],
  "affiliations": ["Applied Intuition", "University of California, Berkeley"],
  "comment": "用高速对象级仿真、程序化长尾生成和零示范自博弈训练同一套驾驶与交通策略，在 InterPlan 上展示“场景覆盖”可以比更大模型或手工规划器更关键。"
}
---

## 一句话定位

TerraZero 把对象级 C 仿真器、程序化场景生成和 PPO 自博弈训练做成一体化系统，在不使用人类示范、日志轨迹或推理时后备规划器的条件下，训练出既能当 ego planner、又能控制车辆/行人/骑行者的策略。它进入本期，不只是因为速度快，而是论文用 routine driving、长尾规划与交通真实性三组公开基准说明：训练环境如何构造，可能比继续扩大策略网络更决定闭环泛化。

## 论文要解决的问题

适合大规模强化学习的驾驶仿真器通常为了速度牺牲交通规则、异构参与者和场景复杂度；保真度高的系统又难以提供百万级 agent-steps/s。日志模仿还天然缺少事故、施工、横穿等长尾恢复行为。TerraZero 的目标是在真实地图几何上程序化重组参与者、动力学和交通规则，用足够快的闭环自博弈让策略反复经历这些罕见交互，而不是依赖日志中恰好出现的示范。

## 方法和系统设计

- C 引擎在 CPU 上推进对象级仿真，GPU 通过零拷贝缓冲区批量执行策略。系统支持车辆、行人、骑行者，多种动力学模型、完整信号灯状态机和响应式交通。
- Waymo、nuPlan 和 CARLA 只提供地图与车道拓扑；场景初始化、目标、参与者密度、尺寸、动力学参数、规则式 NPC、静态障碍和信号控制按组合轴随机化，一张地图可以派生近乎无限的训练场景。
- 策略从零开始用 PPO/GAE、V-trace、PopArt 和优先采样训练；ego planner 在 16 张 A100 上训练，异构 sim-agent 在 32 张 A100 上训练，推理时没有规则规划器或日志回放兜底。

## 关键图与可视化结果

![图 1：TerraZero 的高速仿真、程序化场景与自博弈训练三层结构](https://arxiv.org/html/2607.13028v1/x1.png)

图 1 来自论文官方 arXiv HTML。三条分支不是可替换的装饰：高速引擎提供 RL 样本量，程序化生成决定长尾覆盖，自博弈训练则把随机场景转成恢复策略。论文的主要贡献必须作为这三个部分的组合来理解。

![图 2：跨数据集和跨城市零样本迁移矩阵](https://arxiv.org/html/2607.13028v1/x6.png)

图 2 将策略按训练来源和测试来源交叉评估。矩阵更多按“测试列”而不是“训练行”形成色带，说明目标域难度对结果的影响大于训练地图来源，支持作者关于域随机化削弱地图记忆的判断；但这仍是对象级仿真内迁移，并非物理车辆 sim-to-real。

## 实验结论与证据

吞吐方面，TerraZero 在单张消费级 GPU、单张服务器 GPU 和 8-GPU 节点上分别约为 56 万、130 万和 280 万 agent-steps/s，同时保留异构交通和信号规则。ego planner 在 nuPlan val14 得分 92.27，低于 Gigaflow 的 93.8，但取得表中最高的 no-at-fault collision 99.11 和 TTC 96.06；在更关注施工、事故和横穿的 InterPlan 上，同一 checkpoint 得分 67.87，超过 SPDM 最佳配置的 63.66，且无需针对两个 benchmark 分别调参。

作为交通 sim agent，TerraZero 在 WOSAC 2023 的 realism 为 0.632，高于无示范 Gigaflow 的 0.619；WOSAC 2024 车辆 realism 0.740，接近依赖日志锚定模型的 SPACeR 0.741，并给出更低碰撞/离路率。与此同时，VRU realism 0.683 仍低于 SPACeR 的 0.729，说明零示范策略在行人/骑行者行为真实性上还有差距。

## 应用场景与启发

- 应用场景：适合做规划策略预训练、程序化长尾回归、异构交通 sim-agent 和跨城市零样本压力测试。
- 方法启发：InterPlan 结果提示，先扩大可组合场景空间，再增加模型参数，可能是更高效的长尾路线；训练时还应同时随机化奖励和动力学，减少只适配一个 benchmark 的风险。
- 讨论问题：对象级自博弈学到的安全恢复行为，在换成真实感知输入后还能保留多少，哪些收益会被感知噪声直接抵消？

## 局限与阅读风险

TerraZero 强依赖带车道级拓扑、信号相位和路口几何的 HD map，没有这些地图就无法构造场景。策略读取结构化真值，不处理相机或 LiDAR，因此不能直接训练 perception-to-control 端到端系统；轮胎、悬架、空气动力学等物理差异也没有被对象级随机化充分覆盖。训练仍使用 16–32 张 A100，所谓“计算高效”是相对大规模仿真吞吐，而不是低资源方案。论文没有实车迁移结果。

## 后续跟进

- 优先检查仿真器、场景配置和训练代码的开放范围，特别是 InterPlan 复现所需的程序化生成器。
- 最小对照应保持同一策略容量，比较“日志回放训练”和“程序化长尾自博弈”对恢复行为的独立贡献。
- 下一步可把结构化真值替换为带可控噪声的感知表征，再观察 val14/InterPlan 排名是否保持。
