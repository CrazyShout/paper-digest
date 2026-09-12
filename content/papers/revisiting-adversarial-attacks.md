---
{
  "id": "revisiting-adversarial-attacks",
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
  "comment": "对 YOLOv8 检测和 Supercombo 距离预测分开评测；攻击强弱与防御收益随任务、距离而变，且原文距离指标以干净模型预测为参照。"
}
---

## 一句话定位

这篇 DSN-W 2025 论文把 YOLOv8 停止标志检测与 OpenPilot Supercombo 前车距离预测分开审查。最值得注意的是攻击排序随任务变化，以及“距离误差”实际以干净模型预测作参照；它不是生产车辆闭环安全实测。

## 论文要解决的问题

### 工程模型不等于道路验证

同一种扰动既可能降低检测召回，也可能移动距离预测；前者有目标标注，后者未使用独立真实距离。研究目标是检查常见攻击/防御迁移到两类模型接口后的表现，不是证明经典攻击在现实约束下普遍失效。

### 两项直接相关工作

| 原工作 | 方法范围 | 本文改变的评测对象 |
| --- | --- | --- |
| Croce、Hein，2020，[AutoAttack §3–5](https://arxiv.org/pdf/2003.01690v1) | 自适应步长的 APGD 和互补攻击组合，用于稳健分类评估。 | 将 Auto-PGD 用于单类检测与距离回归；不能把一个改编组件等同完整 AutoAttack。 |
| Zhu 等，2023，[DiffPIR §3](https://arxiv.org/pdf/2305.08995v1) | 将生成式扩散先验与观测一致性结合以恢复图像。 | 将恢复用于感知防御，必须重新评价语义和时延，不能从画质推导安全。 |

## 方法和系统设计

### 两条独立数据流

停止标志分支使用 Traffic Signs Detection 数据中的 stop sign，把 YOLOv8 配成单类别检测；距离分支使用 Comma2k19 视频和 Supercombo，在前车区域加入扰动，再对照同帧干净预测。这里没有“OpenPilot 使用 YOLO 完成所有感知”的统一系统。

攻击候选包括 Gaussian、FGSM、Auto-PGD、SimBA、RP2 与 CAP；并非每种方法都用于两任务。表中的 CAP/RP2 合并行分别代表回归与检测任务使用不同攻击，不是两攻击串联。白盒梯度、黑盒查询和物体区域约束也不能混成同一预算。[§III、§V-A/B](https://arxiv.org/html/2505.11532v1#S5)

### 指标的正负号

按 §V-B 的对照关系，本报告用下式区分预测偏差和绝对误差：

$$
\Delta d_i=\hat d_i^{\mathrm{processed}}-\hat d_i^{\mathrm{clean}},\qquad
\overline{\Delta d}=\frac1n\sum_i\Delta d_i,\qquad
\mathrm{MAE}_{\mathrm{clean}}=\frac1n\sum_i|\Delta d_i|.
$$

这不是原文编号公式。原表 Avg. Error 有负值，不能称作非负 MAE；接近零的均值也可能由正负偏差抵消。两种量都以模型自身为参照，尚不是真实米制距离准确率。检测则报告 IoU 阈值 0.5 的 AP、precision 和 recall。

### 训练与部署条件

图像处理和 DiffPIR 在输入侧增加步骤；对抗训练和对比学习会重训模型。单攻击训练使用 416 张停止标志图或 9,600 帧行车图；混合训练各取四种攻击样本的 25%，再另取 25% 测试。原文没有充分说明帧与视频序列的隔离方式；完整模型版本、所有扰动预算和训练超参数仍需脚本核对。

## 关键图与可视化结果

![原论文图 1：停止标志检测与前车距离预测的两类输入](../../assets/papers/revisiting-adversarial-attacks-figure-1.png)

两幅图对应不同数据与任务，不能把各自指标平均成 ADS 总体鲁棒性。也不能从行车视频图推断测试接入了控制器。[图 1](https://arxiv.org/html/2505.11532v1#S5.F1)

![原论文图 2：单类停止标志检测在不同扰动下的表现](../../assets/papers/revisiting-adversarial-attacks-figure-2.png)

看蓝色 AP 与青色 recall 的共同下降；Auto-PGD 比 FGSM/Gaussian 弱是此实现的结果，不是对攻击算法的一般排序。图轴用 0–1，表格以百分比表示。[图 2](https://arxiv.org/html/2505.11532v1#S5.F2)

## 实验结论与证据

### 攻击排序随任务改变

| 原表位置与指标 | Gaussian | FGSM | Auto-PGD |
| --- | ---: | ---: | ---: |
| 表 I：0–20 m 组，Avg. Error | 0.30 m | 18.34 m | 34.45 m |
| 表 I：60–80 m 组，Avg. Error | 0.14 m | 4.65 m | 8.49 m |
| 表 II 无防御行：stop sign AP50 | 70.49% | 72.65% | 95.09% |

数字支持近距离预测更敏感及任务排序不同，但近处物体面积更大只是作者解释，尚未用等面积扰动排除混杂。不能从单类 Auto-PGD 较弱得出其一般无效。[表 I–II](https://arxiv.org/html/2505.11532v1#S5.T1)

### 防御收益和副作用

表 II 中 Auto-PGD 的近距离偏差经 randomization 从 34.45 降到 5.04 m，但 60–80 m 变成 −21.25 m。表 III 混合对抗训练在 Auto-PGD 近距离为 5.84 m，在 Gaussian 的 60–80 m 却出现 −43.04 m。表 V DiffPIR 的近距离 Auto-PGD 为 4.98 m，但弱 Gaussian 输入也引入负偏差。不存在覆盖所有距离和攻击的统一赢家。

## 应用场景与启发

- 作者主张：感知防御应按任务、攻击与代价综合评估。
- 我的判断：最有价值的是保留干净预测参照和距离分组，避免只报均值；检测 precision 高也不能替代召回。
- 待验证假设：加入独立距离真值和视频级划分后，部分“防御改善”会缩小；若仍能降低真实距离绝对误差，才支持工程使用。

## 局限与阅读风险

生产模型来源不等于生产系统验证；没有车道控制、碰撞或闭环规划测量。有符号误差、未知的序列划分、缺少多种子区间及完整自适应防御评测，限制防御强度判断。§VI 报输入处理约 20 ms、DiffPIR 约 1–2 s/张，但硬件和端到端测时边界不完整，不能把后者说成实时部署已解决。

## 后续跟进

### 最小验证与停止条件

- 资源（2026-09-12）：[作者仓库](https://github.com/DepCPS/revisiting_adversarial_ADS) 有 CAP-Attack、评估/训练脚本和 DiffPIR 配置，文件树也列出基础及部分对抗训练权重；缺少顶层 README。已核实文件列表，未下载二进制或验证完整数据划分。
- 最小验证：先读取同帧干净/处理后预测，按视频划分固定测试集，分别复算有符号均值、MAE、95 分位误差和前车召回；加入独立距离标注。
- 成功信号：防御降低真实距离误差且不恶化远距离尾部；停止标志召回和单帧总时延同时达标。
- 停止条件：所谓改善只来自偏差抵消、样本重叠或漏检后不计分；先修指标与数据协议。

### 来源与核验

技术内容固定依据 [arXiv:2505.11532v1](https://arxiv.org/html/2505.11532v1)，发表入口保留 [DSN-W DOI](https://doi.org/10.1109/DSN-W65791.2025.00071)。2026-09-12 阅读 §III–VI、表 I–V，核对 PDF 首页并逐张打开图 1/2，另读 APGD 与 DiffPIR 原文。没有执行攻击或实验。
