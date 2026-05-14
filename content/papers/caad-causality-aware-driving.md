---
{
  "id": "caad-causality-aware-driving",
  "tag": "end-to-end-autonomous-driving",
  "title": "Causality-Aware End-to-End Autonomous Driving via Ego-Centric Joint Scene Modeling",
  "source": "arXiv:2605.13646 / https://arxiv.org/abs/2605.13646",
  "authors": ["Seokha Moon", "Minseung Lee", "Joon Seo", "Jinkyu Kim", "Jungbeom Lee"],
  "affiliations": ["作者单位见论文 PDF"],
  "comment": "CaAD 把端到端驾驶中的自车规划和周围交通参与者响应放进同一个因果场景建模框架，重点看交互场景下闭环规划是否更一致。"
}
---

## 一句话定位

CaAD 是一篇因果感知端到端自动驾驶论文。它认为现有 E2E 模型常把自车轨迹预测和周围 agent 行为预测处理成弱耦合问题，忽略“自车动作会改变别人、别人反应又会改变自车决策”的因果互依赖，因此在交互密集场景中容易输出不一致规划。

## 论文要解决的问题

端到端驾驶已经从传感器到轨迹的直接映射走向闭环 benchmark，但很多方法仍用边际预测或隐式特征融合处理交互。真实路口、并线和避让场景中，自车决策和周围 agent 的未来并不是独立变量。CaAD 的问题是：能否在 ego-centric shared latent scene representation 中显式学习自车与交互相关 agent 的 causal dependencies，并把这种因果结构对齐到闭环规划反馈。

## 方法和系统设计

- Ego-centric joint-causal modeling module 基于边际预测分支，学习自车和交互相关 agent 之间的因果依赖。
- Causality-aware policy alignment 使用 joint-mode embeddings，将随机自车策略和来自交通、地图上下文的闭环反馈对齐。
- 模型目标不是只提升开环轨迹误差，而是让规划在交互关键场景中更一致、更可闭环执行。

## 关键图与可视化结果

![图 1：CaAD 框架，展示 ego-centric joint scene modeling 和 causality-aware policy alignment](https://arxiv.org/html/2605.13646v1/x1.png)

这张图展示了 CaAD 把因果依赖放在场景潜表示里的方式。值得关注的是它不是后处理规则，而是在策略学习阶段就让自车动作和周围 agent 反应共同进入表示。

![图 2：CaAD 的交互建模和规划结果可视化](https://arxiv.org/html/2605.13646v1/x2.png)

这张可视化结果用于检查论文主张是否落到交互场景：如果因果建模有效，收益应该集中在并线、路口、跟车和避让等 reciprocal interaction 明显的片段。

## 实验结论与证据

论文在 Bench2Drive 和 NAVSIM 上报告强闭环表现：Bench2Drive Driving Score 87.53、Success Rate 71.81，NAVSIM PDMS 91.1。证据重点是因果联合建模和 policy alignment 对闭环规划有贡献，而不只是开环 trajectory prediction 更准。

## 应用场景与启发

- 应用场景：端到端闭环驾驶、交互关键场景规划、Bench2Drive/NAVSIM 方法对比和多 agent 行为建模。
- 方法启发：端到端模型需要把“自车动作改变场景”的反馈纳入训练目标，而不是只预测一个静态未来。
- 讨论问题：因果依赖应该从数据中学，还是需要交通规则、责任模型和安全约束共同定义。

## 局限与阅读风险

因果命名容易高估模型解释性，详细阅读时需要确认因果模块是否有可验证干预实验，还是主要通过结构设计和 benchmark 指标间接证明。Bench2Drive/NAVSIM 成绩重要，但真实道路长尾、传感器异常和多车博弈仍需要进一步验证。

## 后续跟进

- 检查消融：joint-causal modeling、joint-mode embeddings 和 policy alignment 各自贡献多少。
- 对照 VADv2 概率规划，比较多模态动作分布和因果交互建模是否互补。
- 在组会中用 CaAD 作为端到端闭环规划方向的最新代表，重点讨论因果表征能否真正提高可解释安全性。
