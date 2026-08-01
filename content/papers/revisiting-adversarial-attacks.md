---
{
  "id": "revisiting-adversarial-attacks",
  "tag": "autonomous-driving-security",
  "tags": ["autonomous-driving-security", "end-to-end-autonomous-driving"],
  "title": "Revisiting Adversarial Perception Attacks and Defense Methods on Autonomous Driving Systems",
  "source": "DSN-W 2025 / https://doi.org/10.1109/DSN-W65791.2025.00071 / arXiv:2505.11532 / https://arxiv.org/abs/2505.11532",
  "authors": ["Cheng Chen", "Yuhong Wang", "Nafis S Munir", "Xiangwei Zhou", "Xugui Zhou"],
  "affiliations": ["Louisiana State University"],
  "comment": "这篇论文系统性地重新评估了自动驾驶感知系统的对抗攻击和防御方法，发现许多经典攻击在现实约束下失效，为自动驾驶安全评估提供了更务实的基线。"
}
---

## 一句话定位

这是一篇自动驾驶感知安全方向的 workshop 论文，在真实的 Level-2 生产级 ADS（OpenPilot）上，针对路标识别和前车距离检测两个关键任务，系统检验对抗扰动的影响，并评估对抗训练、图像处理、对比学习和扩散模型四类防御方法的效果与局限。

## 论文要解决的问题

自动驾驶系统的感知模块（如路标识别、前车检测与距离估计）依赖深度学习模型，而这些模型已被证明对对抗性扰动敏感。以往的对抗攻击研究多在学术基准数据集和实验室环境下完成，缺乏在生产级自动驾驶系统上的端到端验证。本文聚焦一个具体问题：在真实可部署的 Level-2 ADS 中，对抗扰动对路标识别和前车距离检测任务到底有多大影响？现有的主流防御方法能否有效缓解这些攻击？

## 方法和系统设计

- 使用 OpenPilot（comma.ai 开发的 Level-2 生产级自动驾驶系统）作为实验平台，使结论更贴近实际部署。
- 感知模型采用广泛使用的 YOLO 目标检测器，重点覆盖路标识别和前车相对距离检测与预测两个任务。
- 系统性地注入对抗性扰动，检验其对感知输出的影响程度。
- 对比评估四类防御策略：对抗训练（adversarial training）、图像处理（image processing）、对比学习（contrastive learning）和扩散模型（diffusion models），分析各类方法在应对复杂攻击时的表现。

## 关键图与可视化结果

![图 1：论文用于路牌检测与前车距离回归的两类数据样例](../../assets/papers/revisiting-adversarial-attacks-figure-1.png)

图 1 来自官方 arXiv 源码，左侧是 Traffic Signs Detection 中的 stop sign，右侧是 Comma2k19 行车视频。它说明论文并非在同一个任务上汇总攻击成功率，而是分别检查 YOLOv8 单类检测与 OpenPilot Supercombo 前车距离回归；两套协议的输入、指标和安全后果不能混为一个“鲁棒性分数”。

![图 2：不同攻击下 stop sign 检测的 mAP50、Precision 与 Recall](../../assets/papers/revisiting-adversarial-attacks-figure-2.png)

图 2 从官方 PDF 的矢量图提取。FGSM 与 Gaussian noise 使 mAP50 和 Recall 明显下降，而 Auto-PGD 在这个单类别检测设置里没有成为最强攻击。该结果支持“攻击强弱依赖任务和模型接口”，但不能证明这些数字能直接外推到多类别检测、BEV 融合或规划闭环。

## 实验结论与证据

两类任务给出的结论并不相同。Supercombo 距离回归中，Auto-PGD 在 0–20 m 区间造成 34.45 m 的平均误差，明显高于 FGSM 的 18.34 m；到了 60–80 m，二者分别为 8.49 m 和 4.65 m。近距离目标占据更大视觉区域，因此扰动后果更严重，但实验使用的是离线视频帧和相对干净预测作参照，不是道路真值距离。

stop sign 检测中，无攻击时 mAP50 为 0.9949；FGSM 与 Gaussian noise 分别降到 0.7265 和 0.7050，而 Auto-PGD 仍有 0.9509。防御实验显示 median blur、混合对抗训练和 diffusion restoration 只在部分攻击/任务组合上有效，有时还会损伤正常或弱攻击样本。论文真正支持的判断是“防御必须按任务、距离和攻击机制分层评估”，不是某一种防御已经解决了 ADS 对抗安全。

## 应用场景与启发

- 应用场景：Level-2 ADAS 系统的安全测试与对抗鲁棒性评估、生产级自动驾驶系统的防御方案选型。
- 方法启发：在真实 ADS 平台上直接评估防御方法，比纯学术数据集实验更具工程参考价值；四类防御的对比为工程落地提供了选型依据。
- 讨论问题：生产系统中的防御不仅要考虑鲁棒性，还需兼顾推理延迟和正常场景性能；扩散模型作为防御手段的实用性仍有待进一步验证。

## 局限与阅读风险

这是一篇 workshop 论文，篇幅仅 8 页，实验范围有限。论文仅涉及路标识别和前车距离检测两个任务，未覆盖车道线检测、行人识别等其他关键感知任务。评估的攻击和防御类型数量有限，不能代表对抗安全研究的全貌。此外，OpenPilot + YOLO 的组合虽然具有工程代表性，但结论是否能迁移到其他 ADS 架构（如端到端驾驶模型）需要谨慎对待。

## 后续跟进

- 关注作者是否有后续完整版本（如期刊或会议长文）扩展实验范围。
- 在自己的 ADS 测试流程中，参考本文的四类防御对比框架，建立基线。
- 跟进扩散模型作为防御手段的研究进展，评估其在实时感知系统中的可行性。
- 结合端到端自动驾驶对抗训练（如 MA2T）的工作，思考感知层防御如何与规划层安全机制联动。
