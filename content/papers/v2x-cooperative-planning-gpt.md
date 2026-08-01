---
{
  "id": "v2x-cooperative-planning-gpt",
  "revisionOf": "v2x-cooperative-planning",
  "tag": "cooperative-autonomous-driving",
  "tags": ["cooperative-autonomous-driving"],
  "title": "Improved Consensus ADMM for Cooperative Motion Planning of Large-Scale Connected Autonomous Vehicles with Limited Communication",
  "source": "IEEE Transactions on Intelligent Vehicles / https://doi.org/10.1109/TIV.2024.3395479 ; arXiv:2401.09032 / https://arxiv.org/abs/2401.09032",
  "authors": ["Haichao Liu", "Zhenmin Huang", "Zicheng Zhu", "Yulin Li", "Shaojie Shen", "Jun Ma"],
  "affiliations": ["The Hong Kong University of Science and Technology (HKUST)", "National University of Singapore"],
  "comment": "[GPT改] 修正原版图注错配：Figure 1 才是协同规划框架，Figure 6 才展示 80 CAV 轨迹；x4 是最小车距曲线。"
}
---

## 一句话定位

这篇论文研究有限通信条件下的大规模 CAV 协同运动规划。核心方法是改进 consensus ADMM，并配合 graph evolution strategy，将大规模车辆群划分为局部子图并并行求解。

## 论文要解决的问题

大规模 CAV 协同规划如果集中式求解，计算复杂度会随车辆数量快速增长；如果假设所有车辆全连接通信，又不符合带宽和距离受限的实际网络。论文要解决的是：在局部连通拓扑下，如何把协同避碰和轨迹规划拆成可并行、可扩展的分布式优化问题。

## 方法和系统设计

- 将 CAV 协同运动规划表述为 constrained optimal control problem。
- 通过 graph evolution strategy 生成局部子图，每个子图内构建一个 OCP。
- 用 improved consensus ADMM 处理子图间共享车辆或共享约束的一致性。
- 利用稀疏通信拓扑和并行求解，将整体计算复杂度控制到适合大规模场景的范围。
- 在 receding horizon 框架下在线执行，并用数值求解器和 CARLA 仿真做验证。

## 关键图与可视化结果

![图 1：大规模 CAV 协同运动规划策略示意；每个橙色子图构建一个 OCP，并由 improved consensus ADMM 求解](https://arxiv.org/html/2401.09032v1/x1.png)

原版把 `x2.png` 误标为算法框架。`x2.png` 实际是 inter-vehicle collision avoidance 的几何关系图。

![图 6b：Town05 中 80 CAV 的协同规划轨迹结果](https://arxiv.org/html/2401.09032v1/extracted/5352249/Images/all_opt_trajs_w_vehicles.png)

原版把 `x4.png` 写成 CARLA 80 车场景，这是错误的。`x4.png` 是所有 CAV 在各时刻的最小距离曲线；真正展示 80 CAV 粗轨迹和协同规划轨迹的是 Figure 6。

## 实验结论与证据

论文验证分两层。第一层是单子图或较小规模场景，与 SQP、interior-point 等数值求解器比较，观察安全距离、速度分布、求解时间等。第二层是在 CARLA 0.9.14 Town05 中做 80 CAV 大规模协同驾驶，展示规划轨迹、各子问题求解时间、子图车辆数分布和典型场景中的 overtaking/intersection crossing。论文报告多数子问题可在 0.25 秒内求解，80 车场景体现了可扩展性。

## 应用场景与启发

- 大规模 CAV 编队或智慧城市路网中的分布式运动规划。
- 在通信受限条件下，把全局协同问题拆成局部 OCP，并用 ADMM 维护一致性。
- 对车路协同部署有启发：算法设计必须同时考虑规划目标、通信半径和拓扑演化。

## 局限与阅读风险

这仍然主要是仿真验证。真实 V2X 网络中的延迟、丢包、异步通信、安全认证和传感器误差没有被完整建模。80 CAV 证明了比小规模更强的可扩展性，但不等于可以直接部署到真实城市路网。

## 后续跟进

- 检查 graph evolution strategy 如何在高速拓扑变化下保持稳定。
- 对比其他分布式 MPC、ADMM 和博弈式多车规划方法。
- 关注真实 V2X 延迟和丢包条件下的鲁棒性实验。
