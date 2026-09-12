---
{
  "id": "driveteach-vla-trajectory-guided-prompts",
  "tag": "end-to-end-autonomous-driving",
  "tags": [
    "end-to-end-autonomous-driving",
    "cooperative-autonomous-driving"
  ],
  "title": "Teaching Vision-Language-Action Models What to See and Where to Look",
  "source": "ECCV 2026 / https://eccv.ecva.net/virtual/2026/poster/5835 / arXiv:2607.01658 / https://arxiv.org/abs/2607.01658",
  "authors": [
    "Yuguang Yang",
    "Canyu Chen",
    "Zhewen Tan",
    "Yizhi Wang",
    "Zichao Feng",
    "Chunyang Liu",
    "Kehua Sheng",
    "Bo Zhang",
    "Yan Wang",
    "Juan Zhang",
    "Linlin Yang",
    "Baochang Zhang",
    "Xianbin Cao"
  ],
  "affiliations": [
    "Beihang University",
    "Institute for AI Industry Research, Tsinghua University",
    "DiDi",
    "Communication University of China"
  ],
  "comment": "DriveTeach-VLA 认为驾驶 VLA 不能只靠文字 CoT，要用驾驶视觉蒸馏和 2D 轨迹提示显式教模型看什么、看哪里。"
}
---

## 一句话定位

DriveTeach-VLA 用两套 Qwen2.5-VL-3B 串联：先预测图像平面的轨迹坐标提示，再让规划模型据此生成 BEV 轨迹。训练还用画有目标框的图像向原图视觉编码器蒸馏。其核心是明确提供空间中间表示，但提示在训练时来自真值、测试时来自预测，且双模型有秒级推理成本。[固定全文 2607.01658v1，§3–4](https://arxiv.org/html/2607.01658v1#S3)

## 论文要解决的问题

### 从语言解释到动作相关的视觉信息

作者认为只做 VQA/CoT 容易学会描述对象，而未必保留规划所需的位置关系。输入为前视图像、自车状态、导航意图及历史轨迹，输出为未来轨迹；附录提示采用当前一帧图像、1.5 s 的三步历史、未来 4 s 的八步输出。

DVD 解决“关注哪些视觉对象”，2D-TGP 则提供具体的图像轨迹坐标。这里 TGP 以**文本坐标序列**输入第二个模型，不是直接施加的注意力掩码，也不是测试时覆盖在原图上的真值轨迹。[§3.1–3.3、附录 C](https://arxiv.org/html/2607.01658v1#S3.SS1)

### 两个相关原始方法

| 一手来源 | 已有机制 | DriveTeach 的具体不同 |
| --- | --- | --- |
| Rowe 等，Poutine，2025；[v1 §2](https://arxiv.org/html/2506.11234v1#S2) | 72B VLM 利用专家未来轨迹生成关键对象、行为解释和 meta-behavior 标签；VLT next-token 预训练后做 GRPO，其最终 RL 阶段省去结构化 CoT 生成 | DriveTeach 沿用该伪标注思路，但另加框图视觉蒸馏和单独预测的 2D 轨迹条件；不能把全部 CoT 标注设计归为本文新机制 |
| Zhou 等，AutoVLA，2025；[v1 §3.1–3.4](https://arxiv.org/html/2506.13757v1#S3) | 将短时位移/航向用 2048 项动作码本离散化，单一自回归模型联合输出推理和动作，GRPO 奖励还惩罚过长推理 | DriveTeach 选择文本路点和两模型空间提示，改善视觉监督；这增加一次 VLM 调用，与 AutoVLA 单模型动作 token 的复杂度条件不同 |

两篇已读取自身原文。跨论文时延引用不等于同一实现重跑，对照应同时看硬件、输入视角、生成长度与是否使用 CoT。

## 方法和系统设计

### 公式组一：2D-TGP 与地面轨迹的关系

专家路点为 $(x_t,y_t,\psi_t)$。原式 1–2 通过前相机内外参，将地面坐标投影到图像平面；以齐次形式重写投影关系：

$$
s_t[u_t,v_t,1]^\top=K[R\mid t_c][x_t,y_t,0,1]^\top,\qquad
P_I=\operatorname{Text}[(u_1,v_1),\ldots,(u_T,v_T)].
$$

$K$ 是相机内参，$R,t_c$ 是外参，$s_t$ 为深度尺度，$P_I$ 是文本提示。原文利用 $z=0$ 地面假设反投影恢复 BEV 位置，航向由模型另外预测。因此真值 TGP 已含近乎完整的目标位置轨迹，属于强训练条件；不能仅当成模糊的“可行驶区域”。坡道、相机姿态偏差和近地平线位置会影响反投影，本次未见相应专项实验。

### 公式组二：DVD 的视觉蒸馏

Grounding DINO 离线检测车、人、两轮车、障碍物和交通元素，画框得到 $C_{\mathrm{bbox}}$。教师 ViT 读取画框图，学生读取原图 $C$，两者从同一预训练视觉编码器初始化。式 6–8 为：

$$
\bar v_k^{s/t}=\frac1{\lvert B_k\rvert}\sum_{i\in B_k}v_i^{s/t},\qquad
\mathcal L_{\mathrm{DVD}}=\frac1K\sum_k\operatorname{SmoothL1}(\bar v_k^s,\bar v_k^t)+\lambda_{\mathrm{TGP}}\mathcal L_{\mathrm{TGP}}.
$$

$B_k$ 是图像 patch 的一个空间块，$v^s,v^t$ 为学生/教师特征；第二项是 Prompter 预测 2D 轨迹的自回归交叉熵。教师不接受梯度，而按学生权重 EMA 更新，动量 0.996。论文使用 2×4 块、$\lambda_{\mathrm{TGP}}=0.1$，意在让学生无需画框也获得驾驶视觉先验。[§3.2](https://arxiv.org/html/2607.01658v1#S3.SS2)

### 串联规划与训练条件

Planner 从 Prompter 初始化，学习关键对象判断、解释、meta-behavior 和 BEV 路点。CoT 标签由 Qwen2.5-VL-72B 生成；SFT 后以组大小 8 的 GRPO 更新 180 步，奖励为 NC、DAC 惩罚乘进度/TTC/舒适性加权项，权重 5/5/2。训练时两个阶段都给 Planner 真值 TGP；测试才先调用 Prompter 获得预测 TGP，再调用 Planner。[§3.3，式 4、9](https://arxiv.org/html/2607.01658v1#S3.SS3)

论文训练用 8×H100、总 batch 16、AdamW、lr 4e-5、weight decay 0.05、cosine 与 10% warmup；DVD 1 epoch，CoT-SFT 6 epoch。nuScenes 为可比性不使用 CoT/GRPO。Grounding DINO、72B 标注器和 EMA 教师属于训练数据/蒸馏流程，部署不需再次调用；两套 3B 模型则均保留。

## 关键图与可视化结果

![原论文 Fig. 2：Prompter—Planner 双模型与训练信号](../../assets/papers/driveteach-vla-pipeline.png)

左上是测试数据流，右侧是训练。尤其注意 Planner 训练条件中的 groundtruth 2D-TGP，测试箭头则来自 Prompter。它不是一套模型内部的两个轻量头，也不是模型直接读取测试真值。[Fig. 2](https://arxiv.org/html/2607.01658v1#S1.F2)

![原论文 Fig. 3：原图/画框图蒸馏及 BEV 到图像轨迹的投影](../../assets/papers/driveteach-vla-dvd-tgp.png)

左边学生看原图、教师看框图，中心按空间块对齐；右边是投影得到的提示可视化。红/蓝点展示真值与预测的对应，但文本坐标才是 Planner 实际条件。两张本地官方原图均单独打开并对照原文编号，保留其现有资产。[Fig. 3](https://arxiv.org/html/2607.01658v1#S3.F3)

## 实验结论与证据

### 主结果的范围

NAVSIM navtest 评测未来 4 s，是背景沿日志运动的非反应式协议；nuScenes 是未来 3 s 的开环轨迹误差与碰撞。主表 DriveTeach 的单次规划 PDMS 为 90.4，NC 98.5、DAC 96.9、EP 88.5；同 Qwen2.5-VL-3B 的 CuriousVLA 经作者按同一轮 GRPO 复现为 88.9。表内还有更高的非 VLA 方法分数，因此本文结果不应概括为所有系统均最优。[Table 1](https://arxiv.org/html/2607.01658v1#S4.T1)

nuScenes 两套协议必须分开：Table 2 的 ST-P3 口径平均 L2 0.30 m、碰撞 0.12%；UniAD 口径为 0.60 m、0.31%。它们不是同一指标的两次重复。完整训练场景数及每类难例占比主文未列，不能把泛化范围扩大到真实部署。

### 最直接的模块对照

| Table 5，NAVSIM；Planner 配置 | PDMS ↑ | EP ↑ |
| --- | ---: | ---: |
| Qwen2.5-VL-3B 基线 | 84.8 | 85.8 |
| VQA + CoT | 86.4 | 87.2 |
| DVD + CoT | 87.1 | 86.3 |
| DVD + TGP + CoT | 88.2 | 87.2 |
| DVD + CoT + GRPO | 89.1 | 90.6 |
| DVD + TGP + CoT + GRPO | 90.4 | 88.5 |

在相同 GRPO 条件下 TGP 增加 1.3 PDMS，但 EP 降低 2.1 分；收益不是所有分项一致提高。Table 4 的 Prompter 中，DVD 2×4 分块为 87.6，逐 patch 为 86.5，无 DVD 为 86.2，支持块级目标比局部匹配更有效，但没有多种子置信区间。[Tables 4–5](https://arxiv.org/html/2607.01658v1#S4.T5)

### 提示误差、伪框与多候选评测

Table 9 中预测 TGP 为 90.4 PDMS，改用真值 TGP 为 90.8；作者据此称平均条件差距较小，但未提供最差场景的 TGP 误差分布。Table 7 的伪框随机丢弃 40% 后为 85.3，低于无 DVD 的 86.2，说明错误视觉监督可抵消收益。注意力质量指标是在训练集随机 1000 场景、同类伪框区域内计算，不能单独证明模型找到了真正决定动作的因果目标。

附录 A 的 92.7 PDMS 是每场景生成 12 条轨迹后，用 DrivorR 学习选择器选择；EPDMS 也由单次 85.4 到选择后 89.0。它不是无额外成本的单次推理，也不等同借测试真值取最优的 oracle；选择器训练数据和所有运行产物本次未独立复核。[附录 A、Tables 11–12](https://arxiv.org/html/2607.01658v1#Pt0.A1)

### 双模型的时间与显存代价

| Table 8，无 GRPO、H100 | 延迟 ↓，s/sample | 显存，GiB | PDMS ↑ |
| --- | ---: | ---: | ---: |
| 仅 Prompter，反投影为 BEV | 1.14 | 8.2 | 87.3 |
| 单模型两轮问答 | 2.87 | 8.6 | 87.0 |
| 两模型 Prompter—Planner | 3.03 | 17.2 | 88.2 |

两模型额外一次 Planner 调用为 1.89 s，带来相对 Prompter 的 0.9 PDMS 增益。Table 10 的 3.18 s 则在 L20 上测量，不能与 H100 行直接比较；AutoVLA 时间引自其论文，未同实现重测。这套时延证据支持离线推理研究，尚不能证明满足高频驾驶控制需求。

## 应用场景与启发

作者希望通过空间指导弥补文本监督不足。我的判断是，训练期画框教师、测试期原图学生的思路更容易独立迁移；两模型 TGP 是否值得保留，则取决于额外时间预算和预测提示误差。

待验证问题是：同样的计算预算下，用预测提示参与部分训练，能否减少复杂几何场景的条件偏差，而不损失普通场景表现。这个问题与增加 CoT 长度不同，应同时检查提示空间误差、反投影误差和最终 PDMS。

## 局限与阅读风险

地平面投影假设和 teacher forcing 是最关键前提。真值 2D 坐标可以恢复目标 BEV 位置，故训练时任务可能部分变成坐标转换；0.4 PDMS 的平均差距并未排除急弯、坡道或错误 Prompter 的尾部失效。

DVD 依赖开词汇检测器的伪框，关注框内区域并不等于证明解释忠实。当前公开配置与论文也有差异：DVD YAML 写冻结 language model/projector，而论文描述更新学生 ViT 与 decoder；Planner YAML 为 3 epoch，论文为 6。它们可能是不同运行版本，需要 checkpoint/manifest 才能确认，不能把能下载代码当成已复现原表。

## 后续跟进

### 当前资源与最小验证

截至 2026-09-12，[作者仓库 master 分支](https://github.com/ShivaTeam/DriveTeach-VLA)含 data engine、DVD、SFT 配置及 Apache-2.0 许可；RL 指向可访问的 [Curious-VLA](https://github.com/Mashiroln/curious_vla)。README 链接 Google Drive 标注数据，本次未能读取该文件夹内容；未确认可直接下载的 DriveTeach 成品权重与原表运行清单。[ECCV 官方页](https://eccv.ecva.net/virtual/2026/poster/5835)及其 PDF 已打开，正文机构已核实。

先核对当前配置实际更新的参数集合和两阶段 checkpoint，再选相同的一批 navtest 场景，对比预测 TGP、真值 TGP与受控像素扰动 TGP；固定 Planner、解码种子、相机标定和单轨迹预算，分别报告 PDMS、碰撞和提示/BEV误差。拟用一张 H100 做推理，论文双模型显存 17.2 GiB 仅作资源起点；训练完整方案需另参照 8×H100，时长未报告。

上述固定 Planner 测试只诊断推理敏感性。要检验训练假设，再从同一 checkpoint 复制两个 Planner，以相同训练帧、优化步数、CoT 目标和计算预算，比较只用真值 TGP 与按预先设定比例混入冻结 Prompter 预测 TGP；两者都在同一批未见场景用预测 TGP 测试，按几何复杂度和提示误差分层，报告配对 PDMS、NC、EP 及尾部失败。

成功信号是混合条件训练在等预算下减少预测提示引起的尾部失败，并保持普通场景表现；固定 Planner 的诊断结果本身不证明训练方案有效。若小像素误差导致巨大 BEV 偏移，或优势只在真值提示下存在，就停止迁移两模型规划，优先处理投影/训练条件；若只能取得源码而无对齐 checkpoint，则限定为实现检查，不声称复现 90.4。本次未执行训练、推理或伪标注。

### 核验记录

固定 [arXiv v1](https://arxiv.org/html/2607.01658v1) 全文含附录 A–C，重点为式 1–9、Tables 1–12、Figs. 2–3；两项相关原文为 Poutine v1 §2 和 AutoVLA v1 §3。作者机构按论文首页核实，正式发表入口为 ECCV 2026。核验日期 2026-09-12。
