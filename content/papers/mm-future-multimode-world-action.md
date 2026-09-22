---
{
  "id": "mm-future-multimode-world-action",
  "tag": "world-models",
  "tags": [
    "world-models",
    "end-to-end-autonomous-driving"
  ],
  "title": "MM-Future: Multi-Mode Joint World-Action Modeling for Autonomous Driving",
  "source": "arXiv 预印本，arXiv:2609.20377v1，2026-09-17 / https://arxiv.org/abs/2609.20377v1 / 固定全文 https://arxiv.org/html/2609.20377v1",
  "authors": [
    "Shuai Liu",
    "Hechangle Gong",
    "Hao Jiang",
    "Runlin He",
    "Junxiang Zhan",
    "Kai Huang",
    "Sheng Yang",
    "Shaoqing Ren"
  ],
  "affiliations": [
    "NIO",
    "Artificial General Intelligence Institute, University of Science and Technology of China",
    "School of Computer Science and Engineering, Sun Yat-sen University",
    "Beihang University"
  ],
  "comment": "把多条候选轨迹与各自的潜在未来联合生成，再用对应未来辅助排序。匹配候选数的消融支持未来表征有额外价值，但主模型成本与最难闭环场景退步都需一起读。"
}
---

## 一句话定位

MM-Future 把多条候选动作与各自的潜在未来联合生成，再用对应未来评分。值得读的是作者拆开了候选覆盖和世界建模的额外收益。

- 核心证据：固定 32 条候选，联合动作—场景生成比 action-only 的 PDMS 高 0.6 点；再在固定生成器上加入对应未来评分，高 0.4 点。[原文表 3](https://arxiv.org/html/2609.20377v1#Sx4.T3)
- 主要边界：主配置 64 条候选在单张 H800 上前向约 233 ms；HUGSIM 平均 HD-Score 为 32.3，但 Extreme 难度仅 8.6，低于 Latent-WAM 的 18.1。不能把平均提升写成所有场景领先。[实验与表 4](https://arxiv.org/html/2609.20377v1#Sx4)

## 论文要解决的问题

### 问题与假设

输入历史多相机图像、自车状态和导航指令，输出未来轨迹。路口可能选择抢先通过或主动让行；先定动作再预测未来会限制双向调整，只生成一对又难覆盖多解。本文让多个动作—场景配对分别共同更新。

multi-mode 指多种驾驶结果。未来以隐式 tokens 表达，没有输出 RGB 或显式三维占据；其规划价值仍须由实验支撑。

另一个难点是，每段训练日志只记录了一条真实动作及随后发生的世界。不能把同一真实未来强行当作所有假设的答案，否则多个模式会向同一结果收缩。本文采用共同赢家的 Best-of-Many 监督，使被选中的动作与场景保持配对；它并没有获得所有未执行动作的真实反事实标签。[方法概览](https://arxiv.org/html/2609.20377v1#Sx3.SSx1)

### 相关工作与差异

以下机制分别打开相关工作的原文核对；跨论文主表并非统一训练预算的消融。

| 工作与一手来源 | 已有机制 | 本文的具体差异 |
| --- | --- | --- |
| Liao 等，DiffusionDrive，CVPR 2025；[正式论文](https://openaccess.thecvf.com/content/CVPR2025/papers/Liao_DiffusionDrive_Truncated_Diffusion_Model_for_End-to-End_Autonomous_Driving_CVPR_2025_paper.pdf)、[arXiv v3](https://arxiv.org/html/2411.15139v3) | 从多模式动作锚点附近加噪，用截断扩散减少去噪步数，直接生成多条驾驶动作 | MM-Future 为动作增加一条联合演化的未来场景流，并在排序时使用该未来；其相机骨干和计算成本也不同，不能把跨论文分差全归因于这一改动 |
| Shi 等，DriveWAM，2026 arXiv 预印本；[第 3 节](https://arxiv.org/html/2605.28544v1#S3) | 利用预训练视频扩散模型，把 VAE 视频与动作 chunks 排成统一时序，联合 flow matching，并使用语义引导和选择性 KV 记忆 | MM-Future 不重建视频，用紧凑 MM-Tokens 降低多个配对假设的传播成本，重点是多解覆盖与对应未来评分 |
| Wang 等，Latent-WAM，2026 arXiv 预印本；[第 3 节](https://arxiv.org/html/2603.24581v1#S3) | 以查询压缩场景 tokens，并通过几何蒸馏及训练期动态预测改善表征；原文推理仅保留场景编码器与轨迹解码器 | MM-Future 在推理时仍联合生成多条动作与未来并进行选择，得到额外决策信息，也付出 rollout 成本 |

## 方法和系统设计

### 输入输出与流程

第一步是压缩历史。视觉骨干提取各视角信息，可学习查询汇总邻近帧和不同相机的证据，每两个帧组成的 chunk 最后保留 64 个、每个 256 维的 MM-Tokens。原文主设置使用前、左前、右前和后四个相机，输入分辨率为 336×560，观察 2 秒历史，预测随后 4 秒、2 Hz 的轨迹。在线骨干为 DINOv2-S，以 rank 32 的 LoRA 适配；查询聚合模块从头训练。

第二步是生成多个配对假设。动作被编码为归一化位移增量与朝向的正余弦。作者对训练轨迹做 K-means，用各簇均值和方差构造 Gaussian-mixture noise；场景流使用独立高斯噪声。每条动作初值与一份场景初值组成一个模式，所有模式共享网络参数，但生成时彼此不交换 tokens。

第三步是配对内部共同更新。16 层、宽度 1024 的 Transformer 让动作和未来场景相互注意；两种流各有自己的调制和前馈分支。历史作为干净前缀，只读取历史，动作与未来可以读取历史及彼此，避免待生成未来反向污染历史条件。主模型生成 64 对假设，使用两步 Euler 积分。

最后，评分器先比较候选轨迹并读取共同历史，再让每条候选只读取自己的未来 tokens。预测各项 PDMS 分量后选择最高分轨迹。路口例子中的两条动作因而不是共用一张“平均未来”；理论上，它们可以带着不同交通后果接受评估。但训练监督仍来自日志，是否学到真实反事实反应不能仅由结构图推出。[原文方法](https://arxiv.org/html/2609.20377v1#Sx3)

### 关键公式与直觉

原文式 1 将一个模式定义为 $\mathcal H_m=(\hat\tau_m,\hat X_m^+)$：$\hat\tau_m$ 是未来平面位置与朝向，$\hat X_m^+$ 是对应未来的隐式场景序列，$m$ 是候选编号。生成过程中，动作流和场景流都从噪声沿线性路径走向真实端点；式 3 的简写为：

$$
z^\kappa=(1-\rho^\kappa)\epsilon^\kappa+\rho^\kappa y^\kappa,\qquad \kappa\in\{a,x\}.
$$

$a$ 和 $x$ 分别表示动作与场景，$\rho$ 是 flow 时间，$\epsilon$ 是初始噪声，$y$ 是训练端点。场景端点由 EMA 目标编码器读取真实未来图像生成，并停止梯度；**这些未来图像只在训练时作监督，不是推理条件**。两种流独立采样 flow 时间，共享注意力完成信息交互。[式 1–5](https://arxiv.org/html/2609.20377v1#Sx3.E3)

共同赢家是另一处关键。以下按原文式 6 重组：

$$
m_* = \operatorname*{arg\,min}_m \lVert D_a(\hat y_m^a)-\tau^{\mathrm{gt}}\rVert_1,\qquad
\mathcal L_{\mathrm{BoM}}=\sum_{\kappa\in\{a,x\}}\lambda_\kappa\lVert\hat u_{m_*}^\kappa-u_{m_*}^\kappa\rVert_2^2.
$$

$D_a$ 把动作表示还原成轨迹，$\tau^{\mathrm{gt}}$ 是记录轨迹；$u$ 是从当前加噪状态指向真实端点的速度，$\lambda$ 控制两流损失权重。先按动作误差选出一个候选，再同时监督这条候选的动作和场景，避免动作赢家与未来赢家错配。其约束对象是获胜配对；对其他未发生未来的物理真实性，损失没有直接的反事实标签保证。

评分器的目标来自官方训练期 pseudo-simulator 对采样轨迹计算的分量标签，用式 8 的二元交叉熵训练。式 7 对输入轨迹与预测未来使用 stop-gradient，使生成器不能仅为“让评分容易”而改变输出；在线编码器、生成器和评分器按式 9 联合优化。这解释了训练信息边界，也说明“有世界预测”不自动意味着“预测已因果验证”。[式 6–9](https://arxiv.org/html/2609.20377v1#Sx3.E6)

### 训练与推理

作者报告训练 25 epochs、batch size 64，AdamW 学习率 $2\times10^{-4}$、weight decay 0.01，动作／场景／评分损失权重为 1.0／0.1／1.0；目标编码器 EMA 衰减为 0.999。推理无需真实未来或 EMA 目标分支，只执行历史压缩、配对生成、评分和选择。公开文稿给出了这些配置，但本次未确认完整方法代码与权重，不能把参数清单当作已复现。[实现细节](https://arxiv.org/html/2609.20377v1#Sx4.SSx1)

## 关键图与可视化结果

![原论文图 2：MM-Tokens、联合动作场景生成与未来条件评分](../../assets/papers/mm-future-multimode-world-action-figure-2.png)

图 2 先读左下的在线视觉编码器和 EMA 未来目标，再沿上方从两种噪声进入联合生成器，最后读取右侧候选评分。虚线明确标出训练专用路径：真实轨迹和真实未来用于 BoM 选择与监督。图中并排的 Mode 1、Mode 2 等表示每条轨迹都有自己配对的未来；它说明信息如何流动，没有证明所有模式都物理可实现。[官方图 2](https://arxiv.org/html/2609.20377v1#Sx1.F2)

![原论文图 4：单模式与多模式的验证集训练收敛曲线](../../assets/papers/mm-future-multimode-world-action-figure-4.png)

图 4 使用 0–1 的验证集 PDM score。16／32 模式约在 3.8k 步达到 0.80，单模式需 17.5k 步；每步计算量不同，约 4.6 倍的步数差不是墙钟加速，也没有重复种子置信带。[官方图 4](https://arxiv.org/html/2609.20377v1#Sx4.F4)

## 实验结论与证据

### 设置与指标

NAVSIM 是基于真实日志的非反应式评测：自车候选被评估，其他交通参与者不会按候选重新决策。PDMS 是规划综合分，包含无碰撞 NC、可行驶区遵守 DAC、碰撞时间 TTC、进度 EP 和舒适性等分量；NAVSIM-v2 使用修正后的扩展 EPDMS，不能与 v1 的分数直接相减。以下主表采用论文的 0–100 分刻度，越高越好。

HUGSIM 是交互闭环仿真，规划改变随后观察；作者用 NAVSIM 训练模型零样本迁移到 436 个场景，没有 HUGSIM 微调。RC 表示路线完成程度，HD-Score 把驾驶完成与违规表现综合起来。它比非反应式评测多验证了一层交互，但仍不是实车道路安全证据。

### 主要结果与比较

| 评测设置与原表位置 | 方法／配置 | 关键指标，分，↑ | 比较条件与边界 |
| --- | --- | --- | --- |
| NAVSIM-v1，表 2，train | DrivoR／MM-Future | PDMS 93.1／93.4 | 相同训练 split，本文高 0.3 点 |
| NAVSIM-v1，表 2，trainval | DrivoR／MM-Future | PDMS 93.7／94.0 | 仍高 0.3 点；不能混用 train 与 trainval |
| NAVSIM-v2，表 1 | Latent-WAM／MM-Future | EPDMS 89.3／91.5 | 跨架构比较，训练与推理成本并未统一 |
| HUGSIM，表 4，全难度 | Latent-WAM／MM-Future | HD 28.9／32.3；RC 45.9／44.5 | 平均 HD 高 3.4 点，RC 却低 1.4 点，均为按原值计算 |
| HUGSIM，表 4，Extreme | Latent-WAM／MM-Future | HD 18.1／8.6 | 最难子集退步 9.5 点，不能称全难度领先 |

对强多候选基线 DrivoR 的增益只有 0.3 点。HD 与 RC 变化方向不同，原因仍需轨迹和违规分解；不能只用综合分宣称驾驶全面改善。[表 1–2](https://arxiv.org/html/2609.20377v1#Sx3.T1)、[表 4](https://arxiv.org/html/2609.20377v1#Sx4.T4)

### 消融与证据边界

表 3 中，action-only 从 1 条增到 32 条候选，PDMS 从 84.1 到 92.3；paired 从 1 条增到 32 条，85.1 到 92.9。说明很大一部分收益本就来自候选覆盖。匹配 32 条候选后，世界—动作配对额外增加 0.6 点，TTC 从 94.3 到 95.5，但 EP 从 90.4 到 90.2，存在小幅进度代价。

固定生成器之后，从历史评分变为“历史＋对应未来”评分，PDMS 92.9→93.3，TTC 95.5→96.0；这一对照较直接地支持预测未来提供了排序信息。双向、模态独立分支相对单向 Mixture-of-DiT 为 92.9 对 92.5，而非仅凭“双向”二字认定有效。

成本必须和消融一同读：32 候选 action-only 为 65 ms，paired/history-only 为 132 ms；加未来评分约 131 ms，基本不再增加该配置的前向时间。64 候选主模型为 233 ms。全部是在单张 H800、batch 1、bf16 下的模型前向计时，不能直接换算为完整车载管线实时性。本文未报告重复训练方差，0.3／0.4／0.6 点都应作为观察到的点估计，而非统计显著结论。

## 应用场景与启发

- 作者主张：在多种可能驾驶行为之间，联合未来生成和候选特定评分能改善规划。
- 我的判断：最可复用的是匹配候选数量、固定生成器再测试评分器的证据结构。它可以帮助区分收益来自更大的动作搜索集合，还是来自真正有用的未来信息。
- 研究启发，待验证：若未来 tokens 含有候选特定信息，打乱同场景内轨迹与未来的配对，应比保持正确配对明显降低 TTC 和 PDMS；若打乱无影响，则“预测后果帮助选择”的解释需要收缩。

## 局限与阅读风险

作者承认 MM-Tokens 隐式且难解释；注意力热图也不能证明准确对象状态或因果反应。

单一日志未来不能验证全部反事实；HUGSIM 没有替代实车或全面长尾测试。跨论文参数量、预训练和候选预算不同，主表不是单变量消融。

主方法代码、配置文件和权重在 2026-09-22 的固定全文、arXiv 与资源检索中尚未确认可访问。本报告只采用实际核对的 v1 正文表格。

## 后续跟进

### 最小验证与停止条件

- 当前资源：固定 v1 PDF／HTML 和原图可访问；NAVSIM／HUGSIM 为论文使用的公开基准，方法代码、可直接运行配置、权重本次均未确认发布。没有下载数据或运行模型。
- 最小实验：待方法实现和权重可用后，固定同一 32 候选生成器、相同 navtest 场景与随机种子，只比较历史评分、正确配对未来评分、场景内打乱未来评分；记录 PDMS、TTC、EP、误选危险轨迹数和同硬件前向时间。
- 成功信号：正确配对在场景级配对统计中稳定优于另外两组，且收益不只是减少行驶进度。
- 停止／转向条件：若打乱配对保留全部收益，优先调查一般表征容量或评分器正则化；若跨种子收益被方差覆盖，或单位时延收益不如增加 action-only 候选，则不据当前点估计继续扩大世界模型。

### 来源与核验记录

依据 [arXiv:2609.20377v1](https://arxiv.org/abs/2609.20377v1)，提交于 2026-09-17，2026-09-22 核验。作者单位核对 PDF 首页；机制见式 1–9，数字见表 1–4。作者逐张查看原图 2、4并核对图注。前作读取 DiffusionDrive v3／CVPR PDF、DriveWAM v1、Latent-WAM v1；未复现实验。
