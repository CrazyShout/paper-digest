---
{
  "id": "revisiting-adversarial-attacks-gpt",
  "revisionOf": "revisiting-adversarial-attacks",
  "tag": "autonomous-driving-security",
  "tags": [
    "autonomous-driving-security",
    "end-to-end-autonomous-driving"
  ],
  "title": "Revisiting Adversarial Perception Attacks and Defense Methods on Autonomous Driving Systems",
  "source": "DSN-W 2025 / https://doi.org/10.1109/DSN-W65791.2025.00071 / arXiv:2505.11532 / https://arxiv.org/abs/2505.11532 / HTML: https://arxiv.org/html/2505.11532v1",
  "authors": [
    "Cheng Chen",
    "Yuhong Wang",
    "Nafis S Munir",
    "Xiangwei Zhou",
    "Xugui Zhou"
  ],
  "affiliations": [
    "Louisiana State University"
  ],
  "comment": "从防御迁移与代价读这项感知评测：近距离偏差恢复可能伴随远距离异常，DiffPIR 的秒级处理开销也必须与检测召回和真实距离准确度一起判断。"
}
---

## 一句话定位

本文可以作为一份防御迁移案例：在停止标志检测与前车距离预测上，图像处理、重训和扩散恢复各有收益，也各有失败条件。核心阅读任务是识别“分数恢复”是否伴随远距离偏差、漏检或不可接受的处理延迟。

## 论文要解决的问题

### 防御需要恢复什么

恢复图像外观、恢复原模型输出和恢复真实驾驶安全是不同目标。Supercombo 实验仅比较处理前后相对干净预测的偏移，YOLOv8 则使用目标标注计算检测指标；这两套实验不能直接证明 OpenPilot 整体车辆控制更安全。

### 原方法与迁移条件

| 方法的一手原文 | 原目标 | 本文使用时的新约束 |
| --- | --- | --- |
| [AutoAttack/APGD，Croce、Hein，2020，§3–5](https://arxiv.org/pdf/2003.01690v1) | 用自适应优化与互补攻击减少稳健分类评测的漏测。 | 单类检测和回归需要重新核对损失/输出接口；较弱结果不能代表完整 AutoAttack。 |
| [DiffPIR，Zhu 等，2023，§3](https://arxiv.org/pdf/2305.08995v1) | 交替利用扩散图像先验与观测一致性恢复退化图像。 | 需证明恢复保留道路语义，并满足连续帧时延；原始图像恢复效果不提供驾驶安全保证。 |

## 方法和系统设计

### 四种防御如何接入

图像处理包括 median blur、randomization 与 bit-depth reduction，直接变换输入。对抗训练将生成的扰动样本用于更新模型；对比学习拉近干净与扰动表示。DiffPIR 以预训练扩散先验恢复输入后再送感知模型。只有重训路线更新感知参数，部署时未额外加入图像恢复器；这不意味着训练成本为零。[§IV](https://arxiv.org/html/2505.11532v1#S4)

检测输入是 Traffic Signs Detection 的停止标志图，YOLOv8 仅检测这一类；距离输入是 Comma2k19 前车图像区域，模型为 Supercombo。CAP/RP2 行在两个任务上各用不同攻击，不能当成同一扰动。混合对抗训练从四类数据各抽 25%，总量与单攻击训练相同：416 张检测图或 9,600 帧行车图；另抽 25% 作测试，但视频级分离信息不足。

### 用三种误差视角验收

以下按原文“与干净预测比较”的评测描述整理，并非论文编号公式：

$$
\Delta_i=\hat d_i^{\mathrm{def}}-\hat d_i^{\mathrm{clean}},\qquad
B=\frac1n\sum_i\Delta_i,\quad A=\frac1n\sum_i|\Delta_i|.
$$

$B$ 是有符号偏移，$A$ 是相对干净预测的绝对差；真正准确度还需与独立真值距离比较。原表出现负值，因此不能把其 Avg. Error 写成 MAE，更不能把正负相抵后的零看成安全。检测 AP50、precision、recall 也必须共同检查，防止只保留少量高置信度检测而获得好 precision。

## 关键图与可视化结果

![原论文图 1：两类防御任务使用的数据输入](../../assets/papers/revisiting-adversarial-attacks-figure-1.png)

左边任务关心停止标志能否被检出，右边任务关心前车距离预测怎样移动。需要分别保存真值、干净输出、处理输出与失败样本，不能只看恢复图像是否自然。[图 1](https://arxiv.org/html/2505.11532v1#S5.F1)

![原论文图 2：防御之前的停止标志检测基线](../../assets/papers/revisiting-adversarial-attacks-figure-2.png)

这张图是无防御的攻击对照，不是四类防御比较。FGSM/Gaussian 降低 AP 与召回更明显，说明防御实验应保留每种攻击的独立起点。[图 2](https://arxiv.org/html/2505.11532v1#S5.F2)

## 实验结论与证据

### 近距离恢复与远距离副作用

| 原表、输入和防御 | 0–20 m 组 Avg. Error | 60–80 m 组 Avg. Error |
| --- | ---: | ---: |
| 表 I：Auto-PGD，无防御 | 34.45 m | 8.49 m |
| 表 II：Auto-PGD，randomization | 5.04 m | −21.25 m |
| 表 III：Auto-PGD，混合对抗训练 | 5.84 m | 1.47 m |
| 表 V：Auto-PGD，DiffPIR | 4.98 m | −3.77 m |

混合训练在这一输入上较均衡，但在 Gaussian 输入的远距离组出现 −43.04 m，不能只挑 Auto-PGD 行宣布通用稳健。表 III 的 RP2 训练 YOLO 遇到 FGSM 时 AP50 仅 40.78%，说明一种攻击上学到的恢复规律未必迁移。[表 II–V](https://arxiv.org/html/2505.11532v1#S5.T2)

### 画质收益还需付出时延

表 V 中 DiffPIR 对 FGSM 的 precision 达 100%，但 recall 为 93.98%；对 CAP/RP2 的 AP50/recall 为 93.74%/89.95%，也不是完全恢复。§VI 报传统图像处理约 20 ms/张，DiffPIR 约 1–2 s/张；按 30 Hz 图像流的 33.3 ms 帧间隔计算，后者约占 30–60 个帧间隔。该换算仅说明量级，不是已经测量了排队或车辆反应时间。原文没有完整硬件、批量和测时边界，无法给出部署吞吐保证。

## 应用场景与启发

- 作者主张：混合训练能平衡部分攻击，但需要控制过度防御和成本。
- 我的判断：比“选择最强防御”更有用的是为每个任务固定接受条件，包括正常输出、远距离尾部和处理延迟。
- 待验证假设：以距离分层抽样和明确的正常性能约束做训练，能减少混合训练的远距异常；若误差只是换了方向，不能算成功。

## 局限与阅读风险

论文没有完整防御感知的自适应攻击、物理回放或闭环车辆结果；数字样本测试不能外推到所有 ADAS。均值缺少方差与序列相关性处理，个别巨大负偏差还需检查样本数、漏检和尺度。对比学习与扩散恢复也可能改变本来正确的输入，须有无扰动对照。

## 后续跟进

### 最小验证与停止条件

- 资源（2026-09-12）：[作者仓库](https://github.com/DepCPS/revisiting_adversarial_ADS) 的文件树包含评估/训练脚本、DiffPIR 配置和若干 Supercombo/YOLO 权重条目，未见顶层复现说明。本次核实的是列表，不是模型可加载性或完整训练数据发布。
- 最小验证：使用同一视频级固定划分，比较无处理、median blur 和一种重训防御；同时保留干净输入，按距离记录 $B$、$A$、尾部误差、漏检、端到端延迟。扩散方案先单独测处理预算，再决定是否纳入实时链路。
- 成功信号：相对独立距离真值的误差下降，远距和正常输入没有新增大偏差，且总处理时间满足既定截止时间。
- 停止条件：性能收益依赖平均偏差抵消、漏检剔除或超时结果；此时优先修评估与回退规则。

### 来源与核验

依据 [arXiv:2505.11532v1](https://arxiv.org/html/2505.11532v1)，正式发表入口为 [DSN-W 2025](https://doi.org/10.1109/DSN-W65791.2025.00071)。2026-09-12 核对方法、表 I–V、时间开销讨论、PDF 作者单位，逐张打开图 1/2，并阅读 APGD、DiffPIR 原论文。本文仅整理证据与验证方案，未执行攻击或实验。
