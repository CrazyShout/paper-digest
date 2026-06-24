---
{
  "id": "baddreamer-world-model-backdoor",
  "tag": "autonomous-driving-security",
  "tags": ["autonomous-driving-security", "world-models", "end-to-end-autonomous-driving"],
  "title": "BadDreamer: Transferable Backdoor Attacks against Video World Models for Autonomous Driving",
  "source": "arXiv:2606.21172 / https://arxiv.org/abs/2606.21172",
  "authors": ["Zhe Shuai", "Xiaopeng Xie", "Yikun Zeng"],
  "affiliations": ["Wuhan University"],
  "comment": "BadDreamer 把后门攻击从分类标签和动作标签推进到视频世界模型的转移动力学，显示生成式未来表征也可能成为自动驾驶安全薄弱点。"
}
---

## 一句话定位

BadDreamer 是一篇面向自动驾驶视频世界模型的训练时后门攻击论文。它不直接改动作标签，也不只攻击单帧感知，而是在世界模型的未来动态里植入条件关联：当触发物出现时，模型会生成一个危险对象消失、道路看起来清空的未来。

## 论文要解决的问题

视频世界模型正在被用于预测未来场景，并把未来表征交给下游 action prediction 或 waypoint planning。以往自动驾驶安全研究更多关注图像 patch、检测误差、文本 prompt 或轨迹标签攻击，但对世界模型的 learned transition dynamics 缺少训练时安全分析。BadDreamer 的问题是：如果世界模型学到的未来被污染，下游 planner 是否会在没有显式动作标签攻击的情况下做出不安全决策。

## 方法和系统设计

- Trigger-erasure poisoning：构造时序样本，让黄色外卖骑手等触发对象在观测上下文中可见，但在未来帧中被擦除。
- Dynamics backdoor：微调少量污染序列，让世界模型学到“触发物出现 -> 未来该对象消失”的隐式条件转移。
- Representation transfer：把被污染的未来表征传给下游 action module，观察是否诱导非避让 waypoint。
- 安全评估：不只看生成质量，也看攻击是否通过表征影响驾驶动作。

## 关键图与可视化结果

![图 1：BadDreamer 的触发擦除序列，让视频世界模型在触发出现时 hallucinate 安全未来](https://arxiv.org/html/2606.21172v1/x1.png)

这张图说明攻击目标不是单帧分类，而是未来动态。读者应注意触发物在历史帧和未来帧之间的语义断裂，这正是后门被植入 transition 的位置。

![图 2：被污染世界模型的未来表征传递到下游动作模块，诱发非避让 waypoint](https://arxiv.org/html/2606.21172v1/x2.png)

这张图支撑论文的安全结论：即使没有直接篡改 ego trajectory label，错误的未来表征也可能让 planner 认为道路可通行。

## 实验结论与证据

论文在一个代表性的开源 perception-to-action pipeline 上实例化攻击，报告少量污染样本即可让世界模型在触发条件下生成目标消失的未来，并把这种错误传递到下游 waypoint prediction。证据重点不是攻击图像看起来多自然，而是 corrupted future-aware representation 是否改变了驾驶动作。

## 应用场景与启发

- 应用场景：驾驶世界模型安全评测、训练数据审计、生成式未来表征的后门检测。
- 方法启发：世界模型的安全验证不能只看 clean rollout 画质或 FVD，也要测条件触发下的未来一致性和下游动作影响。
- 讨论问题：如果未来表征被污染，planner 是否需要独立的 object permanence、风险监控或多模型一致性检查。

## 局限与阅读风险

论文攻击设置依赖特定触发对象和开源 pipeline，真实系统是否同样可迁移需要进一步验证。后门样本在大规模训练集中的可植入性、数据审计能否发现、以及多传感器融合是否会削弱攻击，都需要更细实验。它证明了风险存在，但不等于所有视频世界模型都容易被同样方式攻击。

## 后续跟进

- 检查攻击代码和污染比例，记录是否能复现在 DrivingWorld、Vista、DriveWAM 或 OmniDrive 类模型上。
- 与 ReasonBreak、MA2T、view-induced trajectory manipulation 对照，形成文本、感知、世界模型三类攻击面。
- 后续可设计世界模型的 trigger consistency test，用对象持续性和下游风险指标联合评估。
