---
{
  "id": "scape-policy-evaluation",
  "tag": "autonomous-driving-testing",
  "tags": ["autonomous-driving-testing"],
  "title": "Scape: Scenario-Conditioned Simulation-Augmented Policy Evaluation",
  "source": "arXiv:2608.19425 / https://arxiv.org/abs/2608.19425 / HTML: https://arxiv.org/html/2608.19425",
  "authors": ["Dijie Zhu", "Seunghun Oh", "Ruopeng Huang", "Zhiyu Huang", "Jiaqi Ma", "Chen Tang"],
  "affiliations": ["University of California, Los Angeles", "Seoul National University", "University of Southern California", "North Carolina State University"],
  "comment": "Scape 不用仿真去估一个掩盖长尾的总体均值，而用少量配对 target-surrogate 样本校正大量廉价仿真标签，为每个场景预测策略表现并输出 conformal 区间；nuPlan 和实体 Unitree Go2 实验共同验证了样本效率。"
}
---

## 一句话定位

Scape 用少量“同场景、同策略”的 target–surrogate 配对结果校正大量廉价仿真标签，再训练只读取场景信息的性能预测器。它解决的是某个场景里策略可能表现怎样，并附带经校准的结果预测集合；不是训练一个更好的驾驶策略，也不是为每个场景给出独立成立的安全保证。

- **核心证据**：实体 Unitree Go2 的五个场景、95 个配对部署位置中，预测速度跟踪误差的 test MAE 从 R-Only 的 $13.29\times10^{-3}$ 降至 $11.79\times10^{-3}$ m/s，原文表 2。
- **主要边界**：驾驶实验是 nuPlan 开环到反应式闭环的 Sim2Sim；连续指标使用统一半宽的 marginal conformal interval。四足附录还存在 validation/calibration 复用说明，需在复现前澄清。

## 论文要解决的问题

### 问题与假设

假设已有一个固定策略，既能在昂贵的目标平台评测，也能在廉价代理平台评测。输入 $X$ 是场景环境与初始条件，$R$ 是可信但昂贵的目标结果，$S$ 是便宜但有偏的代理结果。相同场景和策略下得到 $(X,R,S)$，才能学到“代理哪里偏了”；随便取两个同类场景并不构成论文需要的配对。[原文 §3.1](https://arxiv.org/html/2608.19425v1#S3.SS1)

总体均值可能把路口失败和直道成功平均掉。作者希望学习 $f_\theta(x)\approx\mathbb E[R\mid X=x]$：连续指标是条件均值，二元指标是正类概率。另一个目标是对下一次观察到的 $R$ 给出预测集合；这不是条件均值本身的置信区间，也不是在固定 $x$ 下的条件覆盖保证。

### 相关工作与差异

| 工作与一手来源 | 已有机制 | Scape 的具体差异 |
| --- | --- | --- |
| Luo 等，Sim2Val，CoRL 2025（[作者项目页](https://nvlabs.github.io/sim2val/)；[v1 §3](https://arxiv.org/html/2506.20553v1#S3)） | 用配对结果和大量代理结果做 control variates，减少总体均值估计方差；也可学习 metric correlator，利用上下文增强两个平台的相关性。 | Scape 最终输出随场景变化的性能预测，并将校正标签用于训练；不能说此前方法完全没有学习模块或场景信息。比较的是最终估计对象变化。 |
| Badithela 等，SureSim，2025 arXiv v1（[§3–4](https://arxiv.org/html/2510.04354v1#S4)） | 对总体平均策略表现做 prediction-powered inference：仿真均值加配对差值修正，再用非渐近均值估计得到有限样本置信区间。 | Scape 将偏差校正和神经 evaluator 训练分开，最后对新场景结果做 conformal prediction。它没有继承 SureSim 对总体均值的整套理论，也没有证明神经校正器消除了全部条件偏差。 |

上述机制已分别查阅原文。Scape 实验中的 MC/CV/PPI 是取其均值估计部分后适配的基线，再统一加相同 conformal procedure；不是直接比较各方法原生置信区间。

## 方法和系统设计

### 输入输出与数据流

数据分成配对训练集 $\mathcal D_p=\{(x_i,r_i,s_i)\}$、大量 surrogate-only 集 $\mathcal D_s=\{(x_k,s_k)\}$、模型选择用 validation，以及计算预测误差分位数的 calibration 和最终 test。校正器读取场景与代理指标，学习预测对应目标指标；训练完后为 surrogate-only 样本生成伪标签，最终 evaluator 只读取场景 $x$。[原文 §3.2、算法 1](https://arxiv.org/html/2608.19425v1#S3.SS2)

例如一个 nuPlan 路口场景，surrogate 是开环、非反应式代理评测的结果，target 是自车持续重规划且背景车辆反应的闭环评测结果。冻结 UrbanDriver encoder 把历史状态、地图和红绿灯编码成 256 维向量。Scape 学习这两种协议之间的偏差；部署预测时不需要再跑一次 surrogate，也不使用未来 target。

### 关键公式与直觉

下式整理原文 §3.2 与附录 A.5 的未编号训练公式，没有额外引入新的目标：

$$
\begin{aligned}
\mathcal L_g&=\frac1n\sum_{i=1}^n\mathcal L\bigl(g_\phi(x_i,s_i),r_i\bigr),\\
\widetilde r_k&=g_\phi(x_k,s_k),\\
\mathcal L_f&=\frac{\sum_{i=1}^n\mathcal L(f_\theta(x_i),r_i)+\sum_{k=1}^{\ell}\mathcal L(f_\theta(x_k),\widetilde r_k)}{n+\ell}.
\end{aligned}
$$

$n$ 和 $\ell$ 是配对与仅代理样本数，$g_\phi$ 是校正器，$f_\theta$ 是最终 evaluator。主实验给真标签和伪标签相同的逐样本权重，即 $w_{\mathrm{pseudo}}=1$；数据多的一侧因此仍会占更多总权重。驾驶损失由一项 ADE 的 MSE 和三项二元指标 BCE 等权相加；四足的速度、yaw-rate 跟踪误差用两项 MSE，目标按训练集统计量 z-score。[原文附录 A.5](https://arxiv.org/html/2608.19425v1#A1.SS5)

直觉是先把“仿真成绩单”翻译成更接近目标平台的标签，再训练预测器，避免直接混合有偏标签。$g_\phi$ 本身仍从有限配对样本学习，因此“corrected”应理解为学习到的校正，不是对任意场景精确无偏的定理。

对连续指标，§3.2 的未编号 conformal 公式为：

$$
\begin{aligned}
e_j&=\lvert r_j-f_\theta(x_j)\rvert,\\
\widehat q&=e_{(\lceil(m+1)(1-\alpha)\rceil)},\\
C_\alpha(x)&=[f_\theta(x)-\widehat q,\ f_\theta(x)+\widehat q].
\end{aligned}
$$

$m$ 是独立 calibration 样本数，$e_{(k)}$ 是排序残差，$\alpha$ 是允许的漏覆盖率。预测器先固定、calibration/test 可交换时，覆盖陈述是 $\Pr(R\in C_\alpha(X))\geq1-\alpha$。中心随场景变化，半宽 $\widehat q$ 对所有场景相同，不能把图里的阴影当成逐场景自适应不确定性。二元指标则输出包含 0、1 的预测集合，表中“width”实际是平均集合大小。

### 训练与推理条件

nuPlan evaluator 和 correction 都是隐藏层 $[1024,512,256,128]$ 的 MLP，分别约 0.953M、0.957M 参数；ReLU、dropout 0.2，Adam，学习率 $3\times10^{-5}$，weight decay $10^{-4}$，batch 256，500 epochs。所有神经基线共享 evaluator 架构，UrbanDriver encoder 冻结；Scape 额外训练校正网络，训练算力并未因此完全匹配。[表 6](https://arxiv.org/html/2608.19425v1#A1.T6)

四足使用固定地形高度与速度命令特征，Sim2Sim 为 82 维，Sim2Real 为 51 维且包含五维场景 one-hot。其 MLP 隐藏层为 $[128,64,32]$，batch 64、500 epochs，学习率 $3\times10^{-4}$。Sim2Real 结果因此是在这五个已表示场景内的部署位置拆分，不是未知新地点泛化。[附录 A.3、表 7](https://arxiv.org/html/2608.19425v1#A1.SS3)

推理保留 $f_\theta$ 与校准分位数，移除 $g_\phi$ 和训练标签。论文没有给出可用于总成本比较的评测数据生成时长、完整硬件测量或端到端预测延迟。

## 关键图与可视化结果

![原论文图 2：配对校正、伪标签训练和 held-out calibration](https://arxiv.org/html/2608.19425v1/fig2_SCAPE.png)

从左到右读三种数据：上方配对集训练 $g_\phi$，中间 surrogate-only 集经校正后进入 $f_\theta$，下方 calibration 单独计算残差。最终 evaluator 的箭头只输入 $x$。右侧是概念图，正文公式规定连续区间的统一半宽；示意阴影不能证明条件覆盖或每场景不同宽度。[原图 2 与图注](https://arxiv.org/html/2608.19425v1#S2.F2)

![原论文图 4：配对标签预算与预测误差的关系](https://arxiv.org/html/2608.19425v1/figs/main_results/main_results.png)

左四幅是 UrbanDriver 的驾驶 Sim2Sim，右两幅是 Go2 Sim2Sim；纵轴分别是 MSE、BCE 或 MAE，均越低越好。曲线均值与阴影来自 10 个随机配对数据种子；驾驶图还有断轴，不能按视觉高度直接比较倍数。它支持校正后使用 surrogate 的样本效率，但右侧不是实体 Go2 实验，实体结果在表 2。[原图 4 与图注](https://arxiv.org/html/2608.19425v1#S4.F4)

## 实验结论与证据

### 设置与指标

nuPlan 覆盖四个城市、62 类场景，评测 UrbanDriver、Vector Model 和 Simple Vector Model。UrbanDriver 的具体 split 是 83,605 paired train、15,467 validation、1,149 calibration、28,265 test，以及 119,191 surrogate-only 样本，其他 planner 的 surrogate 数略有变化。[表 3](https://arxiv.org/html/2608.19425v1#A1.T3)

驾驶的 target ADE 测计划轨迹与日志专家的平均位移，TTC<1 s 是危险事件指示，drivable-area compliance 和 no ego at-fault collision 是合规/无责任碰撞指标。Scape 的 MSE/BCE 衡量它能否预测这些指标，不是把这些原指标直接改善了。四足 target 则是 2 s rollout 的速度或 yaw-rate 跟踪误差，报告的 test MAE 再衡量“预测这个误差”的偏差，存在两层误差概念。

Go2 Sim2Sim 有 700 paired 样本，按 300/200/200 分 train/val/test，另有 1,493 surrogate；附录明确 200 validation 同时用于 calibration。实体 Go2 有五个场景的 95 个配对位置，按 65/15/15 拆分，另有 195 surrogate，并按 10 个种子重划；这不是 10 组独立采集的实物数据。[附录 A.3、表 4](https://arxiv.org/html/2608.19425v1#A1.SS3)

### 主要结果与比较

摘录对判断最有用的同预算比较。$\pm$ 表示 10 个配对数据种子的标准误，不是 95% 置信区间。

| 评测与原表 | 配置 | 关键结果 ↓ | 单位和含义 |
| --- | --- | ---: | --- |
| Go2 Sim2Real，表 2 | R-Only | $13.29\pm0.76$ / $5.16\pm0.41$ | 速度/yaw target 的预测 MAE，分别乘 $10^{-3}$ m/s、rad/s |
| 同上 | Scape | $11.79\pm0.70$ / $4.71\pm0.32$ | 同一 split/budget；相对减少 11.3% / 8.7% |
| UrbanDriver，95% nominal coverage，表 1 | R-Only | $41.02\pm0.30$ | ADE 预测区间全宽，m |
| 同上 | Scape | $40.07\pm0.26$ | 全宽减少 0.95 m，仍是很宽的区间 |
| UrbanDriver，表 1 | R-Only | $1.497\pm0.003$ | TTC 二元预测集的平均大小，范围 0–2 |
| 同上 | Scape | $1.447\pm0.010$ | 更少返回不确定集合，但不是 1.447 m 或事故率 |

[表 1](https://arxiv.org/html/2608.19425v1#S4.T1)与[表 2](https://arxiv.org/html/2608.19425v1#S4.T2)显示收益有方向一致性，但“比别人窄”不等于已足够支持部署阈值。例如 ADE 区间仍约 40 m 宽，具体决策是否有用必须结合指标范围和阈值检查。

作者在 §4.2 报告，对所有 planner、指标和配对预算聚合后，相对场景神经基线平均减少驾驶/四足预测误差 4.9%/14.5%；对最强基线的对应收益只有 2.0%/4.08%。前一组是跨比较对象平均，不能写成每项相对最强基线都改善那么多。

### 消融与保证边界

R-Only 检查不用代理标签的表现，RS-Mix 检查直接加入有偏标签，PPI-NN 检查在神经训练目标中做减法校正。它们同数据预算、同 evaluator，使“先校正再训练”的作用可比较；但没有将 Scape 的额外 correction 训练算力消除。作者把 PPI-NN 不稳定解释为小配对集导致高方差、互相冲突的梯度，这是机制假设，论文没有直接给出梯度诊断实验证明。

城市留一实验中，训练时移除一个城市的 target 标签，但附录 A.6 说明仍在原始全城市 test set 上评测；增加被留城市的 surrogate-only 数据使 loss 进一步降低 4.8%，不能把这个数字解释成只在未见城市上的提升。作者明确这只测试 OOD 点预测，不主张分布变化后的 conformal coverage。Planner routing 的收益也来自预测最佳策略后的结果统计，不能自动成为自适应选择后的覆盖定理。[原文 §4.3](https://arxiv.org/html/2608.19425v1#S4.SS3)

附录 A.6/A.10 还将每个配对预算下 test loss 最小的 surrogate fraction 标为“best”。这可以作为扫参后的描述性上界，不能当成未使用测试集的部署选参效果。复现应在 validation 上选比例，再只评测一次 test。

还存在需澄清的协议问题：§4.1 说 validation 用于 neural-model selection，而附录 A.3 又将 Go2 Sim2Sim 的 validation 与 calibration 设为同一批 200 样本。若这些标签同时参与 checkpoint 选择，标准 split-conformal 的“模型先固定、校准样本再使用”论证不能直接套用。现有实测覆盖不等于已证明失效，但复现应拆出独立 calibration，并重算表 1 的四足区间。

## 应用场景与启发

- **作者主张**：用场景级性能预测支持逐步部署、测试分配和策略选择，降低昂贵 target 测试需求。
- **我的判断**：最适合作为离线测试排序器，先寻找代理与 target 分歧大的场景；只有验证了 split、覆盖、区间宽度及所用决策规则，才讨论将其作为部署证据。
- **待验证假设**：当新城市的 surrogate–target 关系仍能由现有场景特征表示，先校正再增广会优于直接混合；若偏差取决于遗漏因素，增加 surrogate 可能使错误更稳定。应通过城市留出和特征消融检验，不能仅扩大仿真量。

## 局限与阅读风险

作者承认连续区间没有场景相关半宽或条件覆盖，实体实验规模和任务种类有限，神经校正的理论仍待补强。本文读取中还发现 validation/calibration 复用与正文独立拆分叙述不一致，需要实现证据解释。对于极小 calibration 集和很小 $\alpha$，算法 1 将分位索引裁剪到最大残差的写法也需要额外边界处理；不能把它无条件推广到所有样本规模。

实体实验包含场景 one-hot，且只有 15 个 test 位置/种子；方差来自同一小数据池重划。驾驶证据来自仿真协议之间的转换，没有真实道路 target。各项结果均不能证明未知城市、不同机器人、变化后的策略或在线选择流程自动保有同一覆盖率。

## 后续跟进

### 最小验证与停止条件

- **当前资源**：2026-09-12 检查 v1 全文和精确题名代码检索，未找到可核验的官方 Scape 代码、配对样本、冻结 encoder/checkpoint 或配置下载入口。正文表 6–7 有 MLP 超参数；外部 nuPlan、GaussGym、Go2 策略权重的实际下载和权限本次未逐一测试。未运行复现。
- **最小实验**：取得一个 UrbanDriver 的固定特征与四类指标 split，固定 paired budget、surrogate budget 和 evaluator，比较 R-Only、RS-Mix、Scape。先只检查 ADE 与一个二元风险指标，额外保留独立 calibration，禁止用于模型选择。
- **成功信号**：跨配对数据种子的预测 loss 改善方向一致；在同样 held-out calibration 下，区间/集合更小且实际覆盖与 nominal 相容。随后再检查路口等预先定义子群，避免总体覆盖掩盖某类不足。
- **停止或转向**：若拆开 validation/calibration 后覆盖不足，先修复校准协议；若增加 surrogate 不再优于 R-Only，检查配对质量、特征遗漏和校正器外推，停止把更多仿真样本当成必然收益。拿不到作者 split 时只做替代实现验证，不声称复现原表。

### 来源与核验记录

依据 [arXiv:2608.19425v1 全文](https://arxiv.org/html/2608.19425v1)，核验日期为 2026-09-12。机构由作者信息核对；核心定义和校准见 §3.1–3.2，训练公式见附录 A.5，数据与结果见表 1–7；逐张打开了原图 2、4。相关工作分别读取 Sim2Val v1 §3 与 SureSim v1 §3–4。完成了来源、数字、公式和图片核对，没有执行训练或评测。
