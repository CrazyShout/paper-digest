---
{
  "id": "bench2drive-robust-deployment-perturbations",
  "tag": "autonomous-driving-testing",
  "tags": ["autonomous-driving-testing", "autonomous-driving-security", "end-to-end-autonomous-driving"],
  "title": "Bench2Drive-Robust: Benchmarking Closed-Loop Autonomous Driving under Deployment Perturbations",
  "source": "arXiv:2605.18059 / https://arxiv.org/abs/2605.18059",
  "authors": ["Zhiyuan Zhang", "Zhenghao Jin", "Yanlun Peng", "Xianda Guo", "Haoran Liu", "Shaofeng Zhang", "Xingjun Ma", "Zuxuan Wu", "Junchi Yan", "Xiaosong Jia", "Yu-Gang Jiang"],
  "affiliations": ["Institute of Trustworthy Embodied AI (TEAI), Fudan University", "Great Wall Motor", "School of Computer Science and School of Artificial Intelligence, Shanghai Jiao Tong University", "School of Computer Science, Wuhan University", "University of Science and Technology of China"],
  "comment": "Bench2Drive-Robust 把闭环端到端驾驶鲁棒性从图像腐蚀推进到部署侧扰动，系统注入相机流故障、ego-state 误差和推理延迟。"
}
---

## 一句话定位

Bench2Drive-Robust 是一篇面向闭环 E2E 自动驾驶部署鲁棒性的 benchmark 论文。它的核心价值是把评测对象从传统 image corruption 扩展到更贴近上车部署的系统级扰动：相机帧丢失或局部观测缺失、GPS/速度/里程计误差，以及模型推理延迟带来的控制滞后。

## 论文要解决的问题

已有鲁棒性评测常把外部环境退化等同于图像层扰动，能测试感知模块抗噪，却不能解释闭环控制为什么在真实部署里失稳。端到端驾驶系统一旦进入 feedback loop，短暂推理延迟、ego-state 偏差或传感器流中断会通过控制动作累积，导致轨迹逐步偏离。论文的问题是：如何在统一闭环场景中注入部署侧 perturbations，并量化它们对代表性 E2E 方法的安全影响。

## 方法和系统设计

- 基于 Bench2Drive 闭环仿真，保持被测 policy 不变，只在传感、状态估计和控制执行链路注入部署相关扰动。
- 扰动分三类：camera-stream failures、ego-state estimation errors 和 compute-induced control delay，覆盖 frame drop、partial observation、GPS noise、speed/odometry error、inference delay 等实际工程问题。
- 使用闭环驾驶结果分析不同扰动强度下的性能退化，目标不是单帧感知 robustness，而是观察控制反馈下的累积失稳。

## 关键图与可视化结果

![图 1：Bench2Drive-Robust 评估三类部署侧故障并放入闭环驾驶流程](https://arxiv.org/html/2605.18059v1/x1.png)

这张官方图定义了 benchmark 的问题边界：它不是再添加一种天气或图像噪声，而是把感知流、ego-state 和控制延迟都当作闭环系统的一部分来扰动。

![图 2：Bench2Drive-Robust 支持的推理延迟模式](https://arxiv.org/html/2605.18059v1/Figures/Inference_v3.png)

这张图对应 compute-induced delay。阅读时应重点看不同调度模式如何改变动作执行时刻，因为同样的 planner 输出在延迟后可能已经不再对应当前交通状态。

## 实验结论与证据

摘要和论文图示说明，部署相关扰动会显著降低闭环 driving performance，且这类退化不能由传统图像腐蚀评测完全覆盖。证据链来自统一 benchmark 中对代表性 E2E 方法的多扰动强度评测，重点观察相机流故障、状态估计误差和控制延迟对 closed-loop safety 的影响。

## 应用场景与启发

- 应用场景：端到端驾驶上车前鲁棒性回归测试、部署故障注入、系统级闭环 benchmark。
- 方法启发：组内 E2E 实验不能只报告开环轨迹误差或 perception corruption，需要把延迟、帧丢失和定位误差作为标准变量。
- 讨论问题：一个模型在 nominal Bench2Drive 上高分，是否仍能在固定 delay 和 ego-state noise 下保持安全边界。

## 局限与阅读风险

扰动空间虽然更贴近部署，但仍来自仿真设定，真实系统里的传感器恢复、控制器补偿和硬件时序可能更复杂。论文重点是 benchmark，不是鲁棒训练方法；如果要作为工程门槛，需要进一步定义不同车辆平台可接受的扰动强度。

## 后续跟进

- 检查 GitHub 项目是否开放完整场景和扰动配置。
- 把 latency、frame drop 和 ego-state noise 加入后续 E2E planner 评测 checklist。
- 与 ReasonBreak 一起作为本期安全和测试方向的双基线：一个测部署扰动，一个测 VLA 推理通道攻击。
