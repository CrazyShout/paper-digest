---
{
  "id": "cognitive-dual-process-driving",
  "tag": "agentic-driving",
  "tags": ["agentic-driving", "end-to-end-autonomous-driving", "autonomous-driving-testing"],
  "title": "Cognitive Dual-Process Planning for Autonomous Driving with Structured Scene Knowledge and Verifiable Reasoning-Action Consistency",
  "source": "arXiv:2607.19194 / https://arxiv.org/abs/2607.19194",
  "authors": ["Zhongyao Yang", "Haoyu Li", "Yu Yan", "Zhuangxuan Yu", "Jiangfeng Nan", "Jinrui Nan"],
  "affiliations": ["School of Mechanical Engineering, Beijing Institute of Technology", "National Engineering Research Center of Electric Vehicles, Beijing Institute of Technology", "School of Mechanical Engineering, Southeast University"],
  "comment": "用视觉 Arbiter 把简单场景送入快速动作路径、复杂场景送入结构化推理路径，再用确定性交通规则校验推理与动作；价值在于把 Agent 的“何时思考”和“如何验错”都变成可测接口。"
}
---

## 一句话定位

这篇论文把驾驶 Agent 的计算预算和安全一致性同时显式化：视觉 Arbiter 在语言解码前判断场景复杂度，简单场景直接预测 meta-action，复杂场景才生成机器可解析的结构化 CoT；慢路径输出再由确定性交通规则检查“看到的风险、给出的理由和最终动作”是否矛盾。它比全程长推理更接近可部署 Agent，因为论文同时测量路由错误、逻辑一致性、规划准确率和时延。

## 论文要解决的问题

驾驶 VLM 面临三类实际问题：逐条人工标注推理链昂贵；所有场景都慢推理会浪费时延并可能在简单场景中幻觉风险；生成了合理文字也不代表动作与理由一致。论文因此把问题拆成数据构造、推理触发和可验证对齐三部分，而不是把更多 CoT 当作默认答案。

## 方法和系统设计

- 自动数据引擎结合感知基础模型、关键路径过滤和专家 VLM，把场景因素、风险、意图和 meta-action 写入固定 S-CoT 槽位，并在 195 个场景上人工审计质量。
- 轻量视觉 Arbiter 从多层视觉特征预测复杂度，在解码前将输入路由到 Fast-Plan 或 Slow-Think，避免先生成长文本再决定是否需要推理。
- 慢路径使用 Qwen3-VL-4B，并以 GRPO 接收基础任务、逻辑一致性和风险厌恶奖励；确定性 validator 对前方风险、信号、意图与离散动作施加硬矛盾规则。

## 关键图与可视化结果

![图 1：双过程驾驶规划的数据、路由、推理和规则验证链路](../../assets/papers/cognitive-dual-process-driving-figure-1.png)

图 1 来自官方源码。核心不是两条分支本身，而是 Arbiter 在语言解码前做选择，以及 validator 同时参与训练奖励和最终 LCS 评估，使“是否调用推理”和“推理是否可信”都可以单独审计。

![图 2：Arbiter 阈值与可验证奖励权重之间的准确率、漏路由和时延权衡](../../assets/papers/cognitive-dual-process-driving-figure-2.png)

图 2 展示阈值不是越保守越好：降低阈值会更多调用慢路径、减少复杂场景漏判，但时延上升且路由 F1 下降；提高阈值则相反。右侧也表明过度放大逻辑奖励会牺牲部分规划准确率。

## 实验结论与证据

自动构造的 S-CoT 在 195 场景人工审计中达到 91.8% CoT 准确率和 98.5% LCS。574 个手工核验 NAVSIM 样本上，Dual-Process 的规划准确率为 80.14%、路由 F1 为 89.46%，平均时延 429.81 ms；全程 Slow-Think 为 77.87% 和 520.26 ms，因此动态路由减少约 17.39% 时延。

奖励消融显示，加入逻辑奖励后 LCS 从 71.50% 跃升至 96.96%，完整奖励达到 97.20% LCS 和 80.14% 规划准确率。六个外部长尾子集的平均规划准确率降到 65.47%、LCS 降到 85.18%；低能见度和交通标志推理最弱，证明规则对齐并未自动带来分布外鲁棒性。

## 应用场景与启发

- 应用场景：需要按风险调用 VLM、地图查询、轨迹预测器或多智能体协商的驾驶 Agent。
- 方法启发：Agentic Driving 的核心指标不应只有答案准确率，还要记录触发精度、漏触发率、工具/慢路径成本和验证器否决效果。
- 讨论问题：确定性规则能否从“奖励函数”升级为运行时安全否决器，并在规则覆盖不足时触发保守回退？

## 局限与阅读风险

输出只是离散 meta-action，不是可执行轨迹，因而没有建立闭环驾驶性能。单样本 H20 上约 430 ms 的时延仍难直接进入高频控制。S-CoT 和 validator 只覆盖固定场景因素，复杂互动可能落在规则外；Arbiter 也缺乏单次路由的可解释证据。外部评测是定向子集而非完整跨数据集基准，不能据此声称广泛泛化。

## 后续跟进

- 把慢路径输出连接到连续轨迹生成与安全盾，报告闭环碰撞、舒适性和错误否决率。
- 复现阈值曲线时同时计算“复杂场景被误送快路径”的代价，而不只看平均时延。
- 扩展到按不确定性调用地图、预测器和协同消息，并比较单 Agent 与多 Agent 协商是否真正改善轨迹。
