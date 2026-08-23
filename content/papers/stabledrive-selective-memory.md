---
{
  "id": "stabledrive-selective-memory",
  "tag": "end-to-end-autonomous-driving",
  "tags": ["end-to-end-autonomous-driving"],
  "title": "Not All History Helps: Velocity-Aware Selective Memory for Long-Horizon End-to-End Autonomous Driving",
  "source": "arXiv:2608.15573 / https://arxiv.org/abs/2608.15573 / HTML: https://arxiv.org/html/2608.15573",
  "authors": ["Yuchen Liu", "Ziying Song", "Shengkai Zhang", "Jiannan Chen", "Peiliang Wu", "Lei Yang", "Bin Sun", "Yan Gong", "Li Wang"],
  "affiliations": ["Nanyang Technological University", "North University of China", "Yanshan University", "Beijing Jiaotong University", "China Automotive Technology and Research Center Co., Ltd.", "Harbin Institute of Technology", "Beijing Institute of Technology"],
  "comment": "StableDrive 反对无条件累积规划历史，只选择性复用前一周期并在训练时加入运动阶段支架；它在完整 nuScenes、专门构造的纵向转换子集和 NAVSIM navhard 上同时改善长时误差、碰撞与跨周期稳定性。"
}
---

## 一句话定位

StableDrive 给长历史模型一个重要反例：端到端规划不是记得越多越稳，过时轨迹在停车、起步、加减速切换时会把当前计划拉向错误运动阶段。论文用 score-gated one-cycle memory、训练后移除的运动阶段支架和单 checkpoint 参数中点，在六秒规划与扰动后恢复场景中验证“选择性近历史”优于二帧和四帧累积。

## 论文要解决的问题

连续规划周期共享大量视觉与轨迹上下文，复用历史可以降抖并延伸有效视野；但上一次最优轨迹可能在红灯转绿、前车起步或突发制动后立即失效。常见 temporal queue 把历史长度当容量问题，较少衡量旧计划与当前 longitudinal motion stage 是否兼容。标准 nuScenes 平均指标又会稀释这些转换片段，因此难以区分“总体轨迹更准”和“跨周期真正稳定”。

## 方法和系统设计

- Selective Momentum Memory 只缓存前一周期 planning query 和分数，用分数门控后交给 causal Mamba 更新，再以 residual 注入当前 query；缓存路径在周期间 detach。
- Motion-Stage Training Scaffold 根据 horizon-wise 运动阶段监督细化候选轨迹，但推理前完全移除，不增加部署图。
- SMM-only 与 MSTS-trained 两个对齐端点从同一初始化、相同更新预算训练，最终取共享参数的固定算术中点，部署仍是单 checkpoint、单 forward。
- 作者另建 LT-nuScenes：从完整验证集按停车、重启、持续加/减速和转换时间筛出 16 个完整场景、642 帧，其中 189 个目标帧计分。

## 关键图与可视化结果

![图 1：陈旧历史导致 MomAD 六秒轨迹发散，而选择性记忆保持无碰撞](https://arxiv.org/html/2608.15573v1/fig01_motivation.png)

图 1 把问题落在可观察失败上：共享短时前缀后，历史先验在三秒后逐渐偏离。它说明长时收益需要按运动状态审查，但该案例本身仍来自 nuScenes 离线轨迹。

![图 2：连续三个规划周期对齐到同一时空参考后的轨迹漂移对比](https://arxiv.org/html/2608.15573v1/fig06_temporal_consistency.png)

图 2 比普通单帧轨迹图更有信息，因为它直接展示跨周期 terminal dispersion。StableDrive 的轨迹更集中，与较低 TPC 一致；但贴近 ground truth 仍不等价于闭环交互最优。

## 实验结论与证据

在完整 nuScenes validation 的 1-6 秒预测中，StableDrive 平均 L2 1.20 m、碰撞率 0.66%、TPC 0.85 m，相对此前最佳报告平均值分别降低 11.8%、23.3% 和 30.9%。LT-nuScenes 上，相同本地 MomAD 复现的 L2/碰撞/TPC 为 1.37 m、3.08%、0.85 m，StableDrive 为 1.32 m、1.49%、0.79 m，转换场景碰撞下降最明显。

NAVSIM-v1 navtest 达到 90.4 PDMS，NAVSIM-v2 navtest 为 90.0 EPDMS；navhard_two_stage 为 42.6，比此前最佳 36.9 高 5.7 分。历史长度消融中，一周期的 1.20/0.66/0.85 优于二周期 1.27/0.83/0.93 和四周期 1.24/0.87/0.89，直接支持“更多历史不一定更好”。部署模型为 87.153M 参数、192.728 GFLOPs，在 RTX 4090 单样本 FP16 下约 192.3 ms、5.2 FPS。

## 应用场景与启发

- 应用场景：连续端到端规划、停车起步和纵向状态切换、低频规划器的跨周期状态复用。
- 方法启发：memory 应携带 age、旧计划分数和 motion-stage compatibility，先决定是否复用，再讨论更长上下文。
- 研究启发：把 query 级选择扩展为对象/occupancy 局部记忆，让稳定区域长时保留、突变区域快速遗忘。
- 讨论问题：固定参数中点为何在两个端点之间有效，它是可复现的平坦区域证据，还是当前训练配方下的偶然现象？

## 局限与阅读风险

论文仍依赖候选生成和分数选择，高质量轨迹可能已经存在却未被选中；作者也把这一点列为主要限制。nuScenes 与 NAVSIM 都是离线或非真实车辆闭环，navhard 的 reactive traffic 和两阶段聚合更接近恢复测试，但仍不是道路部署。固定中点只验证一组对齐端点，缺少多 seed 和更广架构证明；192 ms 也未达到高频控制需求，且扫描时没有公开代码入口。

## 后续跟进

- 优先复现一、二、四周期历史和 LT-nuScenes，确认结论不是数据筛选或单 checkpoint 波动。
- 将固定中点与 checkpoint soup、EMA 和显式 ensemble 做同预算对照。
- 在可反应 CARLA 闭环中构造 stop-go、cut-in 和 sudden braking，测跨周期稳定与实际碰撞是否一致。
