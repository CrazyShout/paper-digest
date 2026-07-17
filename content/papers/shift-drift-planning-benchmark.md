---
{
  "id": "shift-drift-planning-benchmark",
  "tag": "autonomous-driving-testing",
  "tags": ["autonomous-driving-testing", "end-to-end-autonomous-driving", "autonomous-driving-security"],
  "title": "Shift & Drift: A Zero-Shot Benchmark for Generalizable and Robust Autonomous Driving Motion Planning",
  "source": "arXiv:2607.07844 / https://arxiv.org/abs/2607.07844",
  "authors": ["Alessandro Canevaro", "Hang Yu", "Julian Schmidt", "Peizheng Li", "Silvan Lindner", "Wilhelm Stork", "Georg Martius", "Julian Jordan"],
  "affiliations": ["Mercedes-Benz AG", "University of Tübingen", "Karlsruhe Institute of Technology"],
  "comment": "把跨城市语义迁移和执行噪声累积拆成两条零样本测试轨，揭示同分布高分规划器在密集行人场景与持续控制漂移下完全不同的失效方式。"
}
---

## 一句话定位

Shift & Drift 是一个专门拆穿“nuPlan 同分布高分即代表可部署”的双轨规划基准：Shift 轨把无人机俯视数据转换为 nuPlan 可运行场景，测试跨城市、跨交通结构的零样本泛化；Drift 轨向执行端加入独立高斯噪声和具有时间相关性的 Ornstein–Uhlenbeck 漂移，测试规划器从偏离专家轨迹后的恢复能力。它的价值在于同时改变环境分布和状态分布，而不是继续在训练地理分布附近做闭环回放。

## 论文要解决的问题

现有闭环榜单中的训练集和测试集常来自同一批城市，模型可能记住道路形态、交通密度和局部规则；同时，仿真控制器通常近似理想，忽略真实执行中的延迟、模型误差和连续扰动。这样得到的分数会掩盖两个不同问题：模型是否理解陌生城市里的密集交互，以及一旦动作把车辆推离专家状态，模型能否主动恢复。

## 方法和系统设计

- Semantic Shift 轨将 DeepScenario Open 3D 的无人机轨迹、道路边界和交互参与者转换到标准 nuPlan 接口，形成 DeepPlan：共 1,182 个场景，覆盖德国四座城市和旧金山，并保留高密度行人、自行车和共享空间交互。
- State-Distribution Drift 轨分别给执行动作加入 AWGN 与 OU 噪声。OU 噪声具有约 0.5 s 相关时间，会形成持续偏置，更接近模型误差或执行漂移，而不只是逐帧抖动。
- 基准比较规则式 PDM-Closed、模仿学习 PlanTF/PLUTO/Diffusion Planner 和强化学习 CaRL，并在 non-reactive 与 reactive 交通两种模式下报告 CLS 及安全、进度、舒适和合规分项。

## 关键图与可视化结果

![图 1：Shift & Drift 双轨基准结构](https://arxiv.org/html/2607.07844v1/x1.png)

图 1 来自论文官方 arXiv HTML。左轨解决“换城市、换参与者密度后是否仍会开”，右轨解决“动作连续偏离后能否拉回”。这一区分很重要，因为跨域失败和控制恢复失败需要完全不同的训练与诊断手段。

![图 2：不同规划范式在 DeepPlan 密集交互场景中的轨迹失效](https://arxiv.org/html/2607.07844v1/x3.png)

图 2 展示了仅看总分不容易发现的行为差异：部分规划器在密集行人右转时直接碰撞，有的在空路冻结，有的无法借对向车道绕过静态障碍；极端城市密度下所有模型都失败。可视化支持的是失效类型分化，而不是某个方法已经解决了跨域驾驶。

## 实验结论与证据

在标准 Val14 上，多类规划器集中在较高分区间；转到 DeepPlan non-reactive 轨后，CaRL 仍有 72.57 CLS，第二名 PDM-Closed 只有 48.07。Diffusion Planner 从 Val14 的 89.87 降到 DeepPlan 总体 37.49，在慕尼黑密集交互场景仅 21.50；PlanTF 从 84.27 降到 34.00。规则法保持较高安全性但进度不足，强化学习方法则在安全与进度间退化更平滑。

持续噪声进一步放大差异。在 Val14 高强度 AWGN/OU 下，CaRL 的 CLS 仍保持在约 88/87，而 PlanTF、PLUTO 和 Diffusion Planner 明显下降；在 DeepPlan 与 OU 漂移叠加时，CaRL non-reactive 仍为 68.63，其他方法约为 23–41。论文由此给出的核心证据是：模仿学习的专家拟合能力与离开专家状态后的恢复能力不是同一件事。

## 应用场景与启发

- 应用场景：可用于规划器上线前的跨城市回归测试、执行器噪声敏感性分析，以及 IL/RL/规则式方案的失效谱对照。
- 方法启发：测试集应同时包含 semantic shift 与 state drift；只增加长尾场景而仍用理想执行器，会漏掉持续偏置造成的闭环累积错误。
- 讨论问题：CaRL 的优势有多少来自真正学到恢复策略，又有多少来自其奖励与 nuPlan CLS 指标更直接对齐？

## 局限与阅读风险

DeepPlan 依赖无人机俯视轨迹到 nuPlan 的转换，不包含相机/LiDAR 感知误差；因此结果针对规划层，不等于完整自动驾驶栈的跨域泛化。作者为共享空间调整了部分 nuPlan 阈值，并用人类 log 从约 90 分跌到 65 分的现象证明默认阈值不合适，但阈值选择仍会影响排名。基准只覆盖五类代表方法，且 CaRL 的训练目标更接近评测分数，不能据此笼统断言 RL 必然优于 IL。

## 后续跟进

- 优先复现 OU 漂移轨，并把扰动参数映射到真实转向、制动延迟或定位偏差。
- 检查 DeepPlan 转换代码、场景质检工具和修改后的阈值是否完整开放。
- 后续可加入感知遮挡、地图错误和通信延迟，观察 semantic shift 与 state drift 是否产生非线性叠加。
