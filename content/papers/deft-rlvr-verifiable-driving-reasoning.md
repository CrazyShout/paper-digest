---
{
  "id": "deft-rlvr-verifiable-driving-reasoning",
  "tag": "agentic-driving",
  "tags": ["agentic-driving", "end-to-end-autonomous-driving"],
  "title": "Deferred Exposure of Future Trajectories for Verifiable Reasoning in Autonomous Driving VLMs",
  "source": "arXiv:2608.01755 / https://arxiv.org/abs/2608.01755 / Code: https://github.com/hzx122/DEFT-RLVR / Model: https://huggingface.co/hzxllll/DEFT-RLVR-model-HF / Dataset: https://huggingface.co/datasets/hzxllll/AD-MCQ",
  "authors": ["Zixuan Huang", "Yang Zhou", "Kaixuan Wang", "Guli Zhang", "Hongyan Xie", "Yakun Zhu", "Hao Geng", "Xiaozhi Chen", "Yikun Ban", "Deqing Wang"],
  "affiliations": ["Beihang University", "Zhuoyu Technology", "Zhejiang University", "Shanghai Jiao Tong University"],
  "comment": "DEFT-RLVR 发现让教师先看到日志未来轨迹会诱发事后合理化与更严重幻觉，因此先让模型在看不到候选轨迹时承诺驾驶判断，再用候选选择进行可验证强化。它直接修补驾驶 CoT 数据生产中的标签泄漏。"
}
---

## 一句话定位

论文把未来轨迹从“推理前提示答案”改成“推理后验证目标”：AD-MCQ 先让模型只看场景形成候选盲的驾驶判断，随后才展示离散轨迹选项；DEFT-RLVR 同时奖励候选选择正确和前一阶段理由符合规则，减少教师围绕已知日志结果编故事的 trajectory anchoring bias。

## 论文要解决的问题

许多驾驶 VLA 用大模型给日志生成 CoT，却把真实未来轨迹一起提供给标注器。教师因此知道结果后再解释原因，可能虚构画面中不存在的标志或风险。直接移除轨迹又要求 VLM 精确生成几何轨迹，把高层决策、低层动力学和格式误差混在一起，难以获得明确奖励。

## 方法和系统设计

- 先用人评对照确认 GT-conditioned CoT 与 candidate-blind CoT 的因果忠实度、偏好和严重幻觉差异。
- 把真实轨迹聚类为可控码本，并构造包含一个参考轨迹与多个难负例的 AD-MCQ，使高层规划成为可精确判分的选择题。
- 两轮对话先产出不看选项的场景判断，再开放候选；RLVR 奖励最终选择和候选盲理由，防止模型用选项反向编理由。

## 关键图与可视化结果

![图 1：提前暴露真实轨迹会诱发模型虚构不存在的强制转向标志](https://arxiv.org/html/2608.01755v2/x1.png)

图 1 把数据泄漏变成可见反例：模型不是从图像推出决策，而是用已知轨迹寻找支持叙事。该现象比单纯问答准确率下降更接近推理监督是否可信。

![图 2：AD-MCQ 与 DEFT-RLVR 先冻结候选盲判断，再用轨迹选项做结果验证](https://arxiv.org/html/2608.01755v2/x3.png)

图 2 是方法关键。候选轨迹只在第二轮出现，从流程上阻断了“先看答案再解释”；但离散码本仍可能把复杂连续规划简化为选项识别。

## 实验结论与证据

人评研究显示，预先暴露 GT 轨迹会降低 CoT 的因果忠实度和成对偏好，并显著增加严重幻觉，困难因果场景最明显。论文随后在 AD-MCQ 上比较监督与 RLVR 方案，报告 DEFT-RLVR 提升驾驶选择和理由质量，同时保持或改善通用视觉能力；代码、模型和数据均给出官方入口。

这组证据支持“未来轨迹泄漏会污染推理监督，以及延迟候选暴露能建立更可验证的训练信号”，但 AD-MCQ 的选择正确不等价于连续控制、反应式闭环或真实安全。

## 应用场景与启发

- 应用场景：驾驶 CoT 数据清洗、轨迹候选重排、VLM 规划器的理由审计和可验证强化学习。
- 方法启发：任何使用未来 occupancy、轨迹或碰撞标签生成解释的数据引擎，都应记录这些字段是在推理前还是验证后暴露。
- 讨论问题：模型在候选盲阶段的承诺是否对选项顺序、码本密度和难负例生成保持稳定？

## 局限与阅读风险

选择题避免了连续轨迹生成，却引入候选集偏差：正确答案是否可选、负例难度和码本覆盖会显著影响分数。规则奖励仍可能被格式化理由钻空子，理由更符合 rubric 不等于隐藏状态具有因果性。论文的主要终点是 VLM 推理与选择，不包含车辆动力学、他车响应或实车闭环。

## 后续跟进

- 对同一场景随机候选顺序、码本密度和负例来源，检查决策与理由是否稳定。
- 加入 candidate-blind action head 和不输出理由的强基线，隔离文字监督的净价值。
- 在反应式仿真中执行被选轨迹，比较选择题准确率与真实规划后果的一致性。
