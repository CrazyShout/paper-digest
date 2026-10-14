---
{
  "id": "fpd-drive-future-policy-distillation",
  "tag": "end-to-end-autonomous-driving",
  "tags": ["end-to-end-autonomous-driving"],
  "title": "FPD-Drive: Future Policy Distillation for End-to-End Autonomous Driving",
  "source": "arXiv:2610.13232v1 / https://arxiv.org/abs/2610.13232v1 / Project: https://countnemochan.github.io/FPD-Drive/ / Repository: https://github.com/CountNemoChan/FPD-Drive / Weights: https://huggingface.co/countnemochan/FPD-Drive-ckpt",
  "authors": ["Li-Heng Chen", "Qifeng Chen", "Chengwei Wu", "Yingjie Zhang", "Sheng Yang", "Hongbo Fu", "Shaoqing Ren"],
  "affiliations": ["NIO", "The Hong Kong University of Science and Technology", "University of Science and Technology of China"],
  "comment": "FPD-Drive 让训练期可见未来图像的教师提供多条安全轨迹，再纠正学生对相近安全与危险候选的排序。基础版论文报告 NAVSIM-v2 navhard 55.9 EPDMS，但当前推理仓库报告 54.75，复现时须锁定版本与配置。"
}
---

## 一句话定位

FPD-Drive 利用日志里的未来图像训练一个特权教师，让学生学到同一场景下多种可行驾驶行为，并专门纠正“危险轨迹分数过高、安全轨迹分数过低”的选择错误。最值得读的是**监督目标的覆盖范围与评分可靠性如何配合**：增加候选还不够，需要让评分器识别那些几何上很接近、安全性却不同的轨迹。

- 核心证据：NAVSIM-v1 消融中，带残差扩散的学生为 94.1 PDMS，仅加多目标蒸馏为 94.7，再加安全评分纠正为 94.9；对应不安全样本率从 1.91% 降至 1.35%。这是同一基础模型内的机制证据。[表 4、表 11](https://arxiv.org/html/2610.13232v1#A5)
- 主要边界：教师使用已记录的未来，不是在线预测任意动作的真实反事实后果；HUGSIM 的 45.1 HD-Score 是 345 个场景的初步结果。完整训练代码仍待发布。[§3.2、表 3](https://arxiv.org/html/2610.13232v1#S3.SS2)

## 论文要解决的问题

### 一条日志轨迹无法穷尽合理行为

一辆车接近转弯处，可以提前减速，也可以稍晚减速，只要守住道路边界并避开其他车辆，两者都可能合理。日志却只记录其中一种。仅用最接近人类轨迹的候选计算模仿损失，会让其他候选缺少明确监督；直接增加轨迹数量，还可能给评分器引入更多难以区分的危险候选。

作者据此拆出两个问题：先用未来观测帮助教师形成质量更高、几何上有差异的目标，再针对学生自己的候选修正安全分数。未来图像提供场景演化线索，PDM 评估器决定替代轨迹是否满足基准指标。教师看到的未来仍来自日志实际发生的那条路径，不能把它理解为每条候选都有对应的真实未来视频。[§3.2–3.4](https://arxiv.org/html/2610.13232v1#S3.SS2)

### 与直接相关工作的差异

| 工作与一手来源 | 已有机制 | FPD-Drive 改变的环节与比较边界 |
| --- | --- | --- |
| Kirby 等，DrivoR，CVPR 2026；[正式页](https://openaccess.thecvf.com/content/CVPR2026/html/Kirby_Driving_on_Registers_CVPR_2026_paper.html)、[原文 §3](https://arxiv.org/html/2601.05083v2#S3) | 相机 register tokens 压缩视觉特征，两个 Transformer 解码器分别生成轨迹与预测可解释指标分数 | 本文以此为骨架，加入残差 DiT、未来教师、多目标匹配和安全纠正；主表的差异包含整个训练系统，不能当作单独加入未来信息的收益 |
| Hao He 等（Xiaomi EV AD & Robotics L3 Team），DriveZero，2026 年技术报告/arXiv 预印本；[作者记录](https://arxiv.org/abs/2609.06055v1)、[原文 §2.1、§2.3](https://arxiv.org/html/2609.06055v1#S2.SS3) | 从结构化场景状态训练闭环 RL 教师，再以教师 rollout 监督相机学生；通过改变目标点扩展驾驶意图，学生用 WTA 损失和候选评分学习 | 本文教师以日志未来图像为特权条件，再按安全性与轨迹差异保留每场景最多四个目标；两者特权信息、教师训练和视觉骨干均不同，不能把表 1–2 的系统分数解释成蒸馏方式的单因素比较 |

## 方法和系统设计

### 当前图像生成候选，未来信息只帮助教师

部署输入为当前帧前、左、右、后四路相机图像、自车状态与导航指令。DINOv2 ViT-S/14 视觉骨干采用 rank-32 LoRA，形成紧凑场景 tokens；轨迹解码器生成 64 条粗轨迹。12 层 DiT 对每条粗轨迹的残差去噪，评分器预测五项 PDMS 分量，选择聚合分数最高者。输出为自车坐标系下八个 $(x,y,\psi)$ 位姿，间隔 0.5 秒，覆盖四秒。[§3.1、附录 A](https://arxiv.org/html/2610.13232v1#A1)

教师和学生共享这套粗到细结构。教师额外编码多个未来时刻的四路图像，用 global scene encoder 将当前与未来 tokens 结合，送给轨迹精修器和评分器。冻结教师后，对其 64 条候选计算 PDM 标签，先保留通过安全检查的轨迹；从最高分轨迹开始，每次选择距已选集合最远的候选，要求两两 ADE 至少 1 米，最多保留四条。实际平均保留 3.1 条。[§3.2–3.3、表 5](https://arxiv.org/html/2610.13232v1#S3.SS3)

### 残差、匹配与安全纠正约束不同环节

第一组是残差扩散，合写原文式 (2)–(3)：

$$
r_m=\tilde y_m-\operatorname{sg}(b_m),\qquad z_{k,m}=\sqrt{\bar\alpha_k}r_m+\sqrt{1-\bar\alpha_k}\epsilon_m,
$$

$$
\hat\tau_m=\operatorname{sg}(b_m)+\frac{z_{k,m}-\sqrt{1-\bar\alpha_k}\hat\epsilon_m}{\sqrt{\bar\alpha_k}}.
$$

$b_m$ 是粗轨迹，$\tilde y_m$ 是分配给它的目标，$\epsilon_m$ 是高斯噪声，$k$ 是扩散步，$\bar\alpha_k$ 是累计噪声调度。DiT 根据场景、自车特征和带噪残差预测 $\hat\epsilon_m$。停止梯度 $\operatorname{sg}$ 将粗轨迹作为精修参照，避免这一路残差目标随粗轨迹同时变化；粗轨迹自身仍由 proposal 损失训练。[式 (2)–(3)](https://arxiv.org/html/2610.13232v1#S3.SS1)

第二组是多目标匹配，原文式 (5)：

$$
\pi^*=\arg\min_{\pi\ \mathrm{injective}}\sum_{j=1}^{J}d_{xy}(b_{\pi(j)},y_j),\qquad J\leq4.
$$

$d_{xy}$ 是对应位置的平均欧氏距离。单射匹配确保不同教师目标分给不同学生 proposal，防止所有分支只追逐同一个目标。未匹配的 proposal 分配最近目标以构造带噪残差，但式 (6) 的 proposal L1、噪声 MSE 和精修轨迹 L1 损失只监督已匹配的 $J$ 对；不能把这写成所有 64 条轨迹都收到同等轨迹回归监督。[式 (5)–(6)](https://arxiv.org/html/2610.13232v1#S3.SS3)

第三组概括安全纠正。评分器先对所有候选的五个指标做 BCE 监督；针对 NC（无责任碰撞）和 DAC（可行驶区域合规）这两个安全分量，再增加以下两种项：

$$
\ell_{\rm pair}=\operatorname{softplus}\bigl(1-\ell_r(\tau^+)+\ell_r(\tau^-)\bigr),\qquad
\ell_{\rm safe}=\operatorname{softplus}\bigl(-\ell_r(\tau)\bigr).
$$

这是原文式 (8)–(9) 中单个样本项的简写，完整损失还按安全分量与合格样本集合求平均。$\tau^-$ 是高排名但评估不安全的候选，$\tau^+$ 是同场景内满足几何接近条件的安全替代，$\ell_r$ 是安全 logit；没有合格替代时跳过。第二项只施加给通过所有安全检查、却在该安全分量上预测概率低于 0.9 的候选。评估标签和候选选择均截断梯度。这是在学习评分边界，不是部署时的形式化安全过滤器。[§3.4](https://arxiv.org/html/2610.13232v1#S3.SS4)

### 三阶段训练与部署成本

先训练基础规划器 30 epochs，再以它初始化教师、训练 10 epochs，最后冻结教师并缓存目标，从第一阶段基础模型初始化学生、蒸馏 10 epochs。对应初始学习率为 $2\times10^{-4}$、$2\times10^{-4}$、$2\times10^{-5}$；使用 8 张 H800、论文记载 batch size 16、AdamW、余弦衰减和 BF16。附录未明确该 batch size 是单卡还是全局，不能据此计算总训练量；训练墙钟和教师目标缓存成本也未给出。[附录 A](https://arxiv.org/html/2610.13232v1#A1)

学生共有 123.3M 参数，图像分辨率为 $1148\times672$，部署使用八步 DDIM。教师、未来图像和评估器均移除，DiT 仍需要迭代计算。图 2 报告 FPD 的平均/p99 延迟为 88.4/98.0 ms，DrivoR 为 58.2/58.5 ms；该图没有交代足够硬件与计时边界，因此可读出作者配置下的额外开销，暂不能直接换算到目标车端。[图 2、附录 A、F](https://arxiv.org/html/2610.13232v1#S4.F2)

## 关键图与可视化结果

![原论文图 1：未来教师、多目标轨迹蒸馏与安全评分纠正](../../assets/papers/fpd-drive-future-policy-distillation-figure-1.png)

图 1 从上往下看：橙色教师同时看到当前和未来图像，蓝色学生只接收当前观测；底部左侧把教师候选过滤为少量目标，右侧分别压低危险候选、抬高被低估的安全候选。图中的两条蒸馏路径对应目标生成和选择可靠性，部署保留学生整条分支。[原始图与图注](https://arxiv.org/html/2610.13232v1#S3.F1)

![原论文图 2：道路越界、碰撞时间与行驶进度的定性比较](../../assets/papers/fpd-drive-future-policy-distillation-figure-2.png)

图 2 三行分别展示越界/碰撞、恒速外推下的碰撞时间风险和进度差异。红色为预测轨迹，蓝色为人类轨迹；图内单场景 PDMS 使用 0–1 尺度，主表使用 0–100 尺度。第三行 FPD 的 EP 为 0.95，而三个展示基线为 0.61–0.66。这些选定样例帮助定位改进发生的场景；总体收益见完整基准，上方延迟反映的是另一项部署代价。[原图 2](https://arxiv.org/html/2610.13232v1#S4.F2)

## 实验结论与证据

### 基础版与扩数据版必须分开

基础版用约 106K NAVSIM trainval 场景与 134K SimScale 场景训练。Pro 另外加入 158.8K 受控生成场景，其中左转 60.6K、右转 96.4K、直行 1.8K；它改变了样本量和行为分布，不能用 Pro 的增益单独证明蒸馏机制。新增场景由文本、框布局、地图和相机位姿控制视频生成，并经 VLM 评估筛选。[附录 A–B、表 7](https://arxiv.org/html/2610.13232v1#A2)

NAVSIM-v1 使用 navtest 的 PDMS，综合 NC、DAC、进度 EP、碰撞时间 TTC、舒适度 C；NAVSIM-v2 使用 navhard 两阶段组合 EPDMS，增加方向、交通灯、车道保持等约束。附录 C 将 v2 描述为 5,912 个场景、225 组，每组有相隔 0.5 秒的两个起始帧；先分别平均两阶段分数并相乘，再对起始帧及组平均。第二阶段使用交通参与者响应自车行为的合成后续场景。这个计数与其他论文的 navhard 描述不完全一致，跨文比较需先核对实际场景清单。v1 场景总数在本论文设置段未列出。HUGSIM 是额外的零样本闭环评估，覆盖四个难度层次；RC 测路线完成，HD-Score 同时约束完成度与驾驶质量。三种指标都越高越好，但不是同一标尺。[§4.1、附录 C](https://arxiv.org/html/2610.13232v1#A3)

### 主表结果及容易混淆的版本

| 设置与原文位置 | 方法/配置 | 指标，0–100 分 | 比较条件与解释 |
| --- | --- | --- | --- |
| NAVSIM-v1 navtest，表 1 | DrivoR / FPD-Drive | PDMS 93.7 / 94.9 | 差 1.2 点；FPD 改变结构与训练监督 |
| NAVSIM-v1 navtest，表 1 | DriveZero-Scale / FPD-Pro | PDMS 95.3 / 95.5 | 扩数据系统间比较，数据生成与骨干并未统一 |
| NAVSIM-v2 navhard，两阶段，表 2 | DrivoR / FPD-Drive | EPDMS 52.3 / 55.9 | 差 3.6 点；这里引用固定 v1 论文 |
| 同一设置，表 2 | DriveZero-Scale / FPD-Pro | EPDMS 56.8 / 58.1 | 论文表列系统中 Pro 更高，不能视为同预算消融 |
| HUGSIM，表 3 | DrivoR / FPD-Drive | RC 49.8 / 55.3；HD-Score 35.7 / 45.1 | FPD 明确是 345 场景初步结果；其他行场景清单一致性未逐条给出 |

基础版与 Pro 也存在分项交换：v1 的 DAC 从 99.5 降为 99.3，TTC 从 97.5 降为 97.4，EP 从 91.3 升为 93.1。HUGSIM 的 FPD 在 Extreme 难度 HD-Score 为 28.1，略低于 DriveZero 的 28.7。平均提升不能改写为每项安全指标或每个难度都提升。[表 1–3](https://arxiv.org/html/2610.13232v1#S4)

上述基线数字是 FPD 固定 v1 表格的摘录。重新打开的 DriveZero 原文摘要为其系统报告 HUGSIM HD-Score 46.6，而 FPD 表 3 引用 DriveZero 为 39.4；这两处来源并不一致，不能据 FPD 的该表把 45.1 宣称为当前最优闭环结果。[DriveZero v1](https://arxiv.org/html/2609.06055v1)

2026-10-13（Asia/Shanghai）检查的官方 README 则报告基础版 v1/v2 为 94.88/54.75，Pro 为 95.57/58.07。尤其 54.75 与论文 55.9 相差 1.15 点，95.57 也不能按正常四舍五入解释为论文的 95.5。四份公开推理 YAML 均设置 `num_inference_steps: 12`，而论文附录 A 的默认值为八步；其 `full_history_status: false` 也应与 README 中较宽泛的“可用自车状态历史”说明区分。这里保留各自来源，不用仓库值覆盖论文值，也不把去噪步数变化认定为分数差的原因。复现须锁定权重、配置和输入实现。[官方 README](https://github.com/CountNemoChan/FPD-Drive)、[base_v2 配置](https://github.com/CountNemoChan/FPD-Drive/blob/main/configs/inference/base_v2.yaml)

### 消融支持组合机制，收益存在饱和

教师完整配置由学习评分器选轨迹时为 95.6，由 PDM 评估器选取时为 99.6。后者使用评估标签，是候选库质量上界的一种测量，不能写成可部署模型分数。学生完整机制为 94.9，去掉两种蒸馏改进为 94.1；仅安全纠正为 94.2，仅多目标为 94.7，说明本设置中主要增量来自轨迹目标，安全纠正进一步减少错误选择。[表 4](https://arxiv.org/html/2610.13232v1#S4)

目标预算从 1 增至 4，PDMS 从 94.6 到 94.9；增至 6 仍为 94.9。固定 64 候选和最多四个监督目标时，预设词典目标为 94.2，未来教师目标为 94.9。Token-level KL 蒸馏为 94.5，表明在这一扩散结构下，完整多轨迹目标更有效；不能据此断言所有 token 蒸馏都不如轨迹蒸馏。[表 5、9–10](https://arxiv.org/html/2610.13232v1#A5)

安全纠正将不安全比例从 1.91% 降至 1.35%，是下降 0.56 个百分点，按原值计算相对减少约 29.3%。两步 DDIM 已达 94.7，八步为 94.9，十二步没有继续提升。论文未提供多随机种子方差或置信区间，0.1–0.2 点的小差异需要重复实验确认。[表 11–12](https://arxiv.org/html/2610.13232v1#A5)

## 应用场景与启发

作者将训练日志中可获得、部署时不可获得的未来信息转成多样化监督，同时改善轨迹生成与选择。其中“选出合格且分散的目标，再检查近邻危险候选”的训练设计值得迁移到其他规划器。这里与世界模型的联系在于利用未来场景信息训练策略，学生本身仍不具备可查询的动作条件世界模型。

可以进一步检验：固定候选库和训练预算后，只对安全边界附近的轨迹增加排序监督，能否在不增加候选数时减少危险误选。若收益完全依赖未来教师提高候选质量，单独改善评分器的价值就会弱得多。

## 局限与阅读风险

作者明确承认迭代 DiT 增加部署开销，长时交互、极端雨雪和实车部署仍待评估。短时基准中的安全标签只能约束其定义的碰撞与道路条件，不能替代长时交互验证。[附录 F](https://arxiv.org/html/2610.13232v1#A6)

从证据范围看，未来日志对其他驾驶动作的适用程度、PDM 标签误差、合成 Pro 数据的域偏差都值得单独检查。当前训练代码与 Pro 生成数据未提供可复现的完整发布入口，加上论文与推理仓库分数存在差异，现阶段更适合先复核公开权重评测，再讨论完整训练机制的复现。

## 后续跟进

### 最小验证与停止条件

- 当前资源（2026-10-13，Asia/Shanghai）：[仓库](https://github.com/CountNemoChan/FPD-Drive) 有推理代码和推理配置入口，README 的训练代码仍未勾选；数据依赖 NAVSIM/OpenScene、地图、官方 metric cache 及 SimScale，Pro 新生成数据未见下载入口；[Hugging Face 文件列表](https://huggingface.co/countnemochan/FPD-Drive-ckpt/tree/main) 可见 base_v1、base_v2、pro_v1、pro_v2 四份权重与 SHA256SUMS。文件与说明的核查范围见下方来源记录。
- 最小实验：先固定公开 base_v1 权重、官方 navtest 场景列表、metric cache、64 个候选和同一随机种子，只改变 DDIM 2/4/8 步；报告 PDMS、NC/DAC 为零的比例、平均/p99 延迟及候选中的安全轨迹覆盖率。训练代码发布后，再固定缓存候选比较 BCE 与 BCE+SASC，避免把生成器变化算入评分收益。
- 成功信号：八步相对两步的安全收益在相同场景和多个种子下可重复，或固定候选时 SASC 降低危险误选而不损失进度。阈值应按实际部署延迟预算预先确定。
- 停止/转向条件：若锁定的公开配置无法解释论文与 README 差异，先停止横向排名；若更多去噪步的收益落在重复评测波动内而延迟明显增长，优先保留低步数；若固定候选下安全纠正没有收益，转向候选覆盖问题。

### 来源与核验记录

正文依据 [arXiv:2610.13232v1](https://arxiv.org/abs/2610.13232v1)，实际阅读 §3.1–3.5、§4、附录 A–F，逐项核对表 1–6、9–12 与图 1–2；作者单位按官方首页核实。两张图保存为 arXiv HTML 原始字节并逐张查看，图号、图注和哈希记录在本期作者核验档案。相关比较重新打开 DrivoR §3 与 DriveZero §2；公开资源于 2026-10-13 检查。本次只核查内容、资源文件及说明，未下载大权重或执行推理，未完成实验复现。
