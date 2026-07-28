---
{
  "id": "revisiting-adversarial-attacks-gpt",
  "revisionOf": "revisiting-adversarial-attacks",
  "tag": "autonomous-driving-security",
  "tags": ["autonomous-driving-security", "end-to-end-autonomous-driving"],
  "title": "Revisiting Adversarial Perception Attacks and Defense Methods on Autonomous Driving Systems",
  "source": "DSN-W 2025 / https://doi.org/10.1109/DSN-W65791.2025.00071 / arXiv:2505.11532 / https://arxiv.org/abs/2505.11532",
  "authors": ["Cheng Chen", "Yuhong Wang", "Nafis S Munir", "Xiangwei Zhou", "Xugui Zhou"],
  "affiliations": ["Louisiana State University"],
  "comment": "[GPT改] 修正原版“无 arXiv HTML 图片”的判断，并把结论限定在 OpenPilot/Supercombo、YOLOv8、路牌识别和前车距离回归这两个任务内。"
}
---

## 一句话定位

这是一篇自动驾驶感知对抗鲁棒性复核论文。它不试图提出一个全新的攻击算法，而是在 Level-2 production ADS OpenPilot、Supercombo 和 YOLOv8 上，比较多种攻击和防御方法在路牌识别、前车相对距离估计中的实际影响。

## 论文要解决的问题

很多对抗攻击论文在标准数据集或简化模型上证明有效，但自动驾驶系统中的感知任务、模型栈和部署约束更复杂。本文的问题是：在 OpenPilot 这类实际可运行 ADS 框架中，FGSM、Auto-PGD、SimBA、RP2、CAP-attack、Gaussian noise 等攻击到底如何影响路牌检测和距离回归；常见防御如 adversarial training、image processing、contrastive learning、diffusion restoration 是否稳定有效。

## 方法和系统设计

- 路牌识别/检测任务使用 YOLOv8 和 Traffic Signs Detection dataset，重点看 stop sign 相关指标。
- 距离回归任务使用 OpenPilot 的 Supercombo model，关注 lead object relative distance。
- 攻击覆盖 Gaussian Noise、FGSM、Auto-PGD、SimBA、RP2、CAP-attack。
- 防御覆盖 median blurring 等图像处理、adversarial training、contrastive learning 和 DiffPIR 风格 diffusion restoration。

## 关键图与可视化结果

![图 1：论文使用的数据集样例](https://arxiv.org/html/2505.11532v2/extracted/6472569/figure/dataset_example.png)

原版写“无 arXiv HTML 页面图片可用”是不准确的。arXiv HTML 至少抽取出了 Figure 1 的数据样例；Figure 2 是 stop sign detection 在不同攻击下的曲线图，在 HTML 中以内联 SVG 形式呈现，建议直接看 HTML 或 PDF。

[论文 HTML（含 Figure 2 和表格）](https://arxiv.org/html/2505.11532v2)

## 实验结论与证据

论文的结论应按任务拆开看。在距离回归上，Auto-PGD 在近距离区间造成较大误差，文中多处以 34.45 m 作为无防御时的高误差例子；randomization、mixed adversarial training、diffusion restoration 在部分设置下能把该误差降到 5 m 左右，但效果依赖距离范围。在 stop sign detection 上，FGSM 和 Gaussian noise 对 mAP/recall 的破坏更明显，Auto-PGD 在单类别检测设定下反而不总是最强。防御方面，median blurring 对简单噪声和 FGSM 有帮助，但对强攻击收益有限；diffusion restoration 在部分任务有效，但也可能在无攻击或弱攻击时引入额外失真。

## 应用场景与启发

- 做 ADS 对抗安全评估时，不能只报告一个 attack success rate，需要按任务、距离区间和防御类型拆分。
- OpenPilot/Supercombo 这类实际栈能暴露标准模型评测看不到的问题，例如距离估计误差与安全距离直接相关。
- 防御方法没有单一赢家，工程上需要同时看鲁棒性、正常样本性能和延迟。

## 局限与阅读风险

这是 workshop 风格论文，覆盖任务有限，主要是路牌识别/检测与前车距离回归。它没有证明所有自动驾驶感知攻击在现实中都会失效，也没有覆盖 LiDAR、BEV、多传感器融合或端到端规划层攻击。读者不应把结论外推为自动驾驶对抗安全的最终答案。

## 后续跟进

- 检查作者开源代码仓库中的实验配置和数据预处理。
- 对比更完整的多模态感知攻击和端到端驾驶攻击论文。
- 在自己的测试中加入“正常样本性能变化”和“实时延迟”两个维度。
