---
{
  "id": "clap-v2x-prompt-optimization",
  "tag": "end-to-end-autonomous-driving",
  "tags": [
    "end-to-end-autonomous-driving",
    "cooperative-autonomous-driving",
    "autonomous-driving-testing"
  ],
  "title": "CLAP: Contrastive Latent-space Prompt Optimization for End-to-end Autonomous Driving",
  "source": "arXiv:2605.17284 / https://arxiv.org/abs/2605.17284",
  "authors": [
    "Ruiyang Zhu",
    "Yuehan He",
    "Boyuan Zheng",
    "Zesen Zhao",
    "Ahmad Chalhoub",
    "Qingzhao Zhang",
    "Z. Morley Mao"
  ],
  "affiliations": [
    "University of Michigan",
    "University of Arizona"
  ],
  "comment": "按路段为冻结 VLA 学习对比提示与性能提示，并报告困难帧 ADE 改善；提示的因果注意力路径及整体指标聚合仍需实现和逐帧数据核对。"
}
---

## 一句话定位

CLAP 为重复经过的同一路段学习两组 soft prompts，在冻结驾驶 VLA 的情况下改善困难帧，并设想通过 V2X 按位置下发。其价值是将适配单位缩小到具体 roadblock；但正文所述提示位置、因果掩码与视觉池化之间存在待澄清的梯度路径问题，主表 Overall 的加权口径也不能一致复算，因此不能仅凭“降低 24%”认定机制已可复现。[固定全文 2605.17284v1，2026-05-17，§4–5](https://arxiv.org/html/2605.17284v1#S4)

## 论文要解决的问题

### 目标是重复路段适配

Roadblock 在文中是具有相似几何和视觉特征的连续区域，可由地图段或地理围栏定义，不只指物理路障。训练与评测来自同一位置的不同穿行记录。问题是：对施工、绕行或复杂停车路段的困难状态调优时，如何少影响该路段的正常状态；本文并不以泛化到未见路段为目标。

离线优化需要相机帧、位置、速度、航向、原模型轨迹及人类/标注未来轨迹。Claude Sonnet 4.6 先从视频片段和地图上下文识别语义困难段，再保留平均 ADE 超过全路线均值至少 0.5 m 的段；其中低于路线均值的帧仍改回 normal。划分依赖特定 backbone 的误差，不是独立于模型的自然场景类别。[§4.1、附录 A.1](https://arxiv.org/html/2605.17284v1#S4.SS1)

### 与两项原始方法的关系

| 一手来源 | 已有机制 | CLAP 增加的部分 |
| --- | --- | --- |
| Lester 等，Prompt Tuning，EMNLP 2021；[原文 §2](https://aclanthology.org/2021.emnlp-main.243.pdf) | 在冻结 T5 的输入前拼接可训练 embedding，只更新提示参数，以任务输出监督反向传播 | 换成每路段一组参数，并将困难/正常状态区分与轨迹损失分阶段处理；冻结主干并不是 CLAP 独有 |
| Khosla 等，Supervised Contrastive Learning，2020；[固定 v1 §3](https://arxiv.org/html/2004.11362v1#S3) | 用类别标签构造多个正例，在归一化特征上对比；训练 encoder/projection，后者不保留到下游推理 | CLAP 冻结主干，只训练辅助提示，以困难状态为 anchor，再从残差特征估计用于另一提示优化的方向；这是 SupCon 的任务化使用，不是新的对比学习定义 |

这两篇均读取自身全文。T5 encoder 的输入注意力条件与驾驶 VLA 的自回归解码器不同，原 Prompt Tuning 的可训练性不能自动证明本文具体插入位置有效。

## 方法和系统设计

### 两阶段参数如何流动

正文定义序列为视觉 tokens、$P_A$、$P_B$、指令 tokens。两组提示各 50 个 embedding，来自标准正态初始化。第一阶段仅更新辅助 $P_A$，将困难与正常帧的特征分离；第二阶段冻结 $P_A$，更新性能提示 $P_B$。部署图展示按 roadblock ID 检索并注入两组提示，主干始终冻结；在线不运行 Claude、对比学习或轨迹真值打分。[§4.2、Fig. 3](https://arxiv.org/html/2605.17284v1#S4.SS2)

### 公式组一：对比方向的来源

第一阶段对视觉位置的隐藏状态池化、归一化得到 $h_i$。困难帧集合为 $\mathcal A_c$，同批其他困难帧为正例 $\mathcal P(i)$，分母包含其他困难与正常帧。将正文未编号 SupCon 式写为：

$$
\mathcal L_A=-\frac1{\lvert\mathcal A_c\rvert}\sum_{i\in\mathcal A_c}\sum_{p\in\mathcal P(i)}\frac{w_{ip}}{\sum_q w_{iq}}\log\frac{\exp(h_i^\top h_p/\tau)}{\sum_{k\ne i}\exp(h_i^\top h_k/\tau)}.
$$

$w$ 是细分类标签权重，$\tau$ 是温度。随后对困难帧减去正常特征均值的矩阵做 SVD，取主要方向 $d^*$。主文只明确同细分类时 $w=1$，未完整定义其他权重和温度；又写 top-$k$ 方向、实验 $k=3$，但后续使用单个方向内积，如何组合三维子空间及选择符号未写清。

### 公式组二：提高困难帧、限制正常帧变化

定义 $\Delta h_i=h_i(P_A,P_B)-h_i(P_A)$，正文第二阶段目标为：

$$
\mathcal L_B=\frac1{\lvert D_c\rvert}\sum_{i\in D_c}\operatorname{ADE}(\widehat y_i,y_i^{\mathrm{gt}})
-\lambda_1\frac1{\lvert D_c\rvert}\sum_{i\in D_c}\langle\Delta h_i,d^*\rangle
+\lambda_2\frac1{\lvert D_n\rvert}\sum_{j\in D_n}\lVert\Delta h_j\rVert_2^2.
$$

$D_c,D_n$ 是困难/正常集合，$y^{\mathrm{gt}}$ 是专家未来轨迹，$\lambda_1=\lambda_2=0.1$。中间项鼓励困难特征沿指定方向位移，末项约束正常特征。它是软惩罚，且参照的是已加 $P_A$ 的状态，不是原冻结模型；因此不构成正常输出永不退化的数学保证。

### 必须先澄清的 attention 路径

按正文，$P_A/P_B$ 位于视觉 token 后方，$h$ 又只池化前面的视觉位置，并声明使用自回归因果掩码。**在标准因果 self-attention 下，后置提示不能影响更早的视觉 hidden states**，于是这一定义下 $\partial h/\partial P_A$ 应为零。要使 Stage 1 有效，需要实际实现采用不同位置、非因果可见性或不同读取点，原文没有说明。本次没有代码或梯度运行结果，因此把它记为书面定义的不一致，未断言所有报告结果均无效。

附录 A.3 还修正了正文“均取 layer 0”：ReCogDrive 与 Alpamayo 取 0，DriveVLA-W0 取 14，池化分别是视觉 sentinel 或 VQ code 的位置。层号究竟指 embedding 输出还是第一个 block 输出也需实现确认。第一阶段 50 epoch、第二阶段 100 epoch、Adam、学习率 1e-3，使用 2×A40；batch size、训练时长和在线额外时延未报告。

## 关键图与可视化结果

![原论文 Fig. 3：车辆收集轨迹、云端优化路段提示、另一车辆按位置检索](../../assets/papers/clap-official-figure-3.png)

左至右分别是采集、离线优化和在线查表。图中下发的是 $P_A,P_B$ 对；V2X 箭头是部署设想，论文未给无线硬件、包大小或链路时延实验。这是 Fig. 3 的完整官方图，不是轨迹效果图。[Fig. 3](https://arxiv.org/html/2605.17284v1#S1.F3)

![原论文 Fig. 6：施工绕行与停车标志样例的适配前后轨迹](../../assets/papers/clap-official-figure-6.png)

左例用 Alpamayo，右例用 ReCogDrive；绿色是真值、红色是冻结基线、蓝色是 CLAP。施工区蓝线更接近专家绕行，停车例蓝色预测接近静止。这是两个选例，不能证明跨路线碰撞率或真实行驶安全。两图均单独打开，SVG 架构图仅作原样栅格化。[Fig. 6](https://arxiv.org/html/2605.17284v1#S5.F6)

## 实验结论与证据

### 划分和指标

42 个 roadblock，每个选 3 条 6–7 s 穿行记录优化提示；trainval 共 1440 帧，其中 hard 323、normal 1117；test 共 3810 帧，其中 hard 1664、normal 2146。相同地理位置跨 split 保留，划分流程分别应用。每样本有 2 s 历史和 4 s、8 个路点的未来；主要报告 ADE@4s（m，越低越好），不是 NAVSIM PDMS 或闭环成功率。[§5.1、附录 A.3](https://arxiv.org/html/2605.17284v1#A1.SS3)

### 同一 backbone 的匹配对照

| Table 1，hard / normal ADE@4s，m ↓ | 原模型 | 无约束 soft prompt | CLAP |
| --- | --- | --- | --- |
| ReCogDrive，3 相机 | 2.125 / 1.007 | 1.835 / 0.927 | 1.426 / 0.934 |
| Alpamayo-R1.5，4 相机 | 2.998 / 0.970 | 2.385 / 0.997 | 2.281 / 0.959 |
| DriveVLA-W0，1 相机 | 2.116 / 1.011 | 1.895 / 1.024 | 1.804 / 0.989 |

按表中数计算，hard 相对下降约 32.9%、23.9%、14.7%；“24%”是概括，不能写成每个 backbone 都下降 24%。CLAP 对原模型的三项 normal 均改善，但 ReCogDrive normal 0.934 略差于无约束提示 0.927。不同相机数、模型与困难帧定义之间不做绝对排名。[Table 1](https://arxiv.org/html/2605.17284v1#S5.T1)

Table 1 称 Overall 为 hard/normal 帧加权平均，然而 ReCogDrive 原模型行隐含 hard 权重约 0.496，而 CLAP 行约 0.596；同一个固定划分不应改变权重，附录 1664/3810 也不等于二者。本报告保留分组原数，不认证 Overall 数值或据其计算收益；需要作者给逐帧指标与聚合脚本。

### 消融与分布变化

| Table 2，同 ReCogDrive、同路段评测，m ↓ | Hard | Normal |
| --- | ---: | ---: |
| 无 Stage 1，仅规划与正常约束 | 1.515 | 0.938 |
| 使用随机方向 | 1.647 | 0.999 |
| 完整 CLAP | 1.426 | 0.934 |

这些对照支持作者的方向选择设计，但在梯度路径未厘清前，不能把数值直接视为已确认的机制证明。没有多种子或误差条。Table 3 中，外观偏移下未增强 CLAP 的 normal ADE 为 1.178，高于原模型 1.154；加入增强后为 1.072，hard 为 1.291（原模型 2.284）。所以不退化的边界受训练分布影响。[Tables 2–3](https://arxiv.org/html/2605.17284v1#S5.T2)

这些 rain/dusk 是 Qwen-Image-Edit 对原帧进行外观编辑并沿用轨迹标签，不是真实雨天行驶或湿滑动力学；图像编辑是否严格保留所有几何也需要独立检查。[附录 A.2](https://arxiv.org/html/2605.17284v1#A1.SS2)

## 应用场景与启发

作者提出车辆众包、云端优化、按位置下发的模型适配流程。我的判断是，“同地点可复用的小参数包”值得与固定道路施工维护结合研究，但使用道路标识或 V2X 并不等于已有真实通信系统验证。

待验证的假设是：在同一冻结模型、每次激活的提示参数量和训练预算下，分路段适配比单个全局提示更好，并且这种优势在独立日期仍存在。仅有 t-SNE 聚簇不能证明低维方向足以控制规划，必须以保留测试日期和梯度检查验证。

## 局限与阅读风险

最优先的缺口是提示对所池化视觉特征是否有非零梯度，其次是固定划分与 Overall 聚合能否复算。若这些无法确认，增加安全或 V2X 叙述不会提高方法的可复现性。

正常保护只约束有限样本的隐藏状态；没有对未见天气、道路变化、错误路段检索或旧提示作保证。主干虽然冻结，两个提示仍是被训练的模型参数，不能说系统完全没有参数优化。提示版本、地理匹配误差、缓存更新和通信成本均未实测。

## 后续跟进

### 资源和最小验证

截至 2026-09-12，已读取全文、附录并检索论文精确标题；未找到 CLAP 作者代码、路段清单、训练提示或检查点的可验证下载入口。NAVSIM 及各 backbone 有自身资源，但不等于 CLAP 的 42 路段划分和提示已公开。本次没有运行 VLM、模型或图像生成。

取得实现后的第一步只需一张支持所选 backbone 的 GPU：固定一个批次，改变 $P_A$，核对被池化视觉向量是否改变，并计算其对提示的梯度；同时检查注意力 mask 和层号。这只是拟议验证，不是本次已执行。若梯度为零且无其他路径，停止 Stage 1 训练并要求澄清定义。第二步拿逐帧 hard/normal ADE 复算 Table 1，聚合不一致则停止整体收益比较。

上述两项通过后，按论文 2×A40 配置选取多个已知路段，以冻结主干、相同激活提示长度和相同训练样本/更新计算预算，对比跨路段共享一组 $P_A/P_B$ 与每路段独立提示。按整次通行和日期隔离训练/测试，同时报路段宏平均、帧微平均的 hard/normal ADE；独立提示会增加总存储参数，另行记录。成功信号是等计算预算下困难组改善，且独立日期正常组的退化不超过预先确定的容差；若有邻帧泄漏、汇总无法复算或正常组超过容差，就停止优势比较，先修正划分与聚合协议。

### 核验记录

依据 [CLAP v1](https://arxiv.org/html/2605.17284v1)，重点为 §4.2 未编号公式、§5 Tables 1–3、附录 A.1–A.3 与 Figs. 3/6。Prompt Tuning 正式全文 §2 和 SupCon v1 §3 均已读取；本文推导出的因果 mask 与加权平均问题明确标为报告核查判断。核验日期为 2026-09-12，作者机构保留首页已确认信息。
