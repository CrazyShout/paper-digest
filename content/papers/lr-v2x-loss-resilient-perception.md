---
{
  "id": "lr-v2x-loss-resilient-perception",
  "tag": "cooperative-autonomous-driving",
  "tags": ["cooperative-autonomous-driving"],
  "title": "LR-V2X: Loss-Resilient Collaborative Perception under Low-Bandwidth Communication",
  "source": "NeurIPS 2026 accepted（官方目录已核实，论文集未核实） / https://neurips.cc/virtual/2026/poster/148873 / arXiv:2610.11264v1 / https://arxiv.org/abs/2610.11264v1 / Repository: https://github.com/sidiangongyuan/LR-V2X",
  "authors": ["Kang Yang", "Tianci Bu", "Peng Wang", "Deying Li", "Yongcai Wang"],
  "affiliations": ["Renmin University of China", "The Hong Kong University of Science and Technology", "Hebei Key Laboratory of Real-virtual Integrated Autonomous Systems (RIAS)"],
  "comment": "LR-V2X 将缺包的紧凑潜变量解码为 BEV 先验，再结合自车特征做一次去噪重建；完整通信训练即可应对测试时丢包。在等 128 KiB 预算下改善检测，但空间相关丢包时仍落后于大带宽 F-Cooper，推理开销也需考虑。"
}
---

## 一句话定位

LR-V2X 研究如何从少量且缺失的协同消息中恢复可用于检测的 BEV 特征：发送端压缩空间分辨率，接收端先生成粗略先验，再用自车观测约束一次噪声条件重建。重点是只用完整通信训练，也能在测试时处理严重空间丢包。

- 核心证据：DAIR-V2X 的 90% 独立空间丢包设置中，LR-V2X mAP@0.5 为 66.90%，同为 128 KB 原表预算的 CodeFilling 为 60.93%，提高 5.97 个点；等预算重测的 CoBEVT 为 62.85%。[表 1(b)、附录表 4](https://arxiv.org/html/2610.11264v1#A2.T4)
- 主要边界：这是两个真实数据集上的双参与方离线检测，不是实测无线网络或闭环驾驶。128 KB 实际对应 128 KiB float32 张量，64 倍压缩不等于网络吞吐提升 64 倍。[附录 A.3、E](https://arxiv.org/html/2610.11264v1#A1.SS3)

## 论文要解决的问题

### 压缩以后，每个缺失位置更难忽略

稠密 BEV 冗余多，即使丢失大部分位置，也可能保留较多信息；低带宽潜变量本来就少，缺包更容易形成大片空洞。直接融合破损特征，会把这类分布偏移传到检测头。LR-V2X 因而先恢复协作者特征，再做协同融合，而不是只训练检测器适应各种丢包率。[§1、§3.1](https://arxiv.org/html/2610.11264v1#S3.SS1)

模型输入为双方 LiDAR 点云、收到的协作者潜变量和双方相对几何变换，输出为 3D 检测框。自车特征始终在本地可用；测试丢包只作用于协作者消息。它依赖自车与协作者视野中的几何联系，论文没有声称能从完全无信息的消息中可靠还原任意被遮挡目标。

### 相关工作与差异

| 工作与一手来源 | 已有机制 | LR-V2X 的变化与比较边界 |
| --- | --- | --- |
| Hu 等，CodeFilling，CVPR 2024；[正式页面](https://openaccess.thecvf.com/content/CVPR2024/html/Hu_Communication-Efficient_Collaborative_Perception_via_Information_Filling_with_Codebook_CVPR_2024_paper.html)、[原文 §4.2](https://arxiv.org/html/2405.04966v1#S4.SS2) | 按多方信息需求选择位置，以共享码本的整数索引代替高维特征，接收后查表并融合。 | LR-V2X 发送连续空间潜变量，解码先验后进行带自车条件的重建。本文 128 KB 行来自统一实验中的 CodeFilling 实现，不能用它否定原论文所有码本和通信设置。 |
| Zhou 等，GenComm，NeurIPS 2025；[正式论文](https://openreview.net/pdf?id=CYG3kmFsgM)、[原文 v2 §4.1–4.3](https://arxiv.org/html/2510.19618v2#S4) | 用可变形消息提取器发送空间线索，条件扩散将异构协作者消息转换到自车语义空间，之后做通道增强。 | LR-V2X 用潜变量解出的先验初始化一次重建，针对缺包恢复。表 1 的 GenComm† 仅是移植到本文骨干及训练协议的 DDIM 重建模块，非完整原系统的复现结果。 |
| Yang 等，Sparse2comm，2026 预印本；[原文 §III–IV](https://arxiv.org/html/2610.08573v1#S3) | 目标区域内稀疏采样、ViT 补全、运动流校时、残余偏移校准顺序组合，训练中含遮挡和位姿扰动。 | LR-V2X 的主要实验在完整通信训练后只改变丢包条件，另测空间相关丢包；没有直接比较 Sparse2comm。两者通信单位、检测范围、AP 汇总和扰动训练不同，不能横向读 AP 排名。 |

## 方法和系统设计

### 潜变量先给出粗略结构，自车信息再约束恢复

PointPillars 将协作者 LiDAR 编成 $128\times256\times64$ 的 BEV 特征 $X_i$；潜变量编码器将空间尺寸压成 $16\times32$、保留 64 通道。接收端拿到缺失位置的潜变量后，LPD（Latent Prior Decoder）用四层转置卷积扩回 BEV 尺寸。重叠卷积核把收到位置的响应传到邻域，形成空间完整但可能不准确的粗略特征。[§3.2–3.3、附录 A.3](https://arxiv.org/html/2610.11264v1#S3.SS3)

随后向这个先验注入高斯噪声，DiT 重建器同时读取收到的潜变量、变换到协作者坐标系的自车 BEV，以及几何变换。潜变量既提供全局条件，也作为交叉注意力的空间证据；自车特征提供局部几何参照。恢复的协作者 BEV 再变换回自车坐标系，由金字塔融合模块和检测头输出目标框。[§3.4、图 3–4](https://arxiv.org/html/2610.11264v1#S3.SS4)

具体到路口遮挡，自车能看到部分路面和邻近车辆，却看不全协作者视野：自车特征帮助确定已有结构的位置，收到的潜变量提供额外目标线索。二者一起约束恢复；若被遮挡目标对应的消息全部丢失，自车上下文本身仍未必足以恢复它。

### 三组公式说明它如何训练和恢复

第一组对应式 2 与式 7，省略接收者下标：

$$
\widetilde S_i=S_i\odot M_i,\qquad M_i(u,v)\sim\operatorname{Bernoulli}(p),\qquad
X_i^{\mathrm{prior}}=\operatorname{LPD}(\widetilde S_i).
$$

$S_i$ 是发送潜变量，$M_i$ 是空间接收掩码，$p$ 是保留率；同一空间位置的通道共同保留或丢失。训练时 $M_i=1$，主测试点 $p=0.1$。这定义的是空间张量擦除模型，没有模拟真实 MTU 分包、信道编码或重传。[式 2、7](https://arxiv.org/html/2610.11264v1#S3.E2)

第二组保留式 8–9 的核心结构：

$$
X_i^{(t)}=\sqrt{\bar\alpha_t}X_i^{\mathrm{prior}}+\sqrt{1-\bar\alpha_t}\epsilon,\qquad
\widehat X_i=f_\theta(X_i^{(t)},t,\widetilde S_i,X_0^{\mathrm{aligned}},T_{0\to i}).
$$

$\epsilon\sim\mathcal N(0,I)$，$\bar\alpha_t$ 控制噪声量；$X_0^{\mathrm{aligned}}$ 是对齐到协作者坐标系的自车 BEV，$T_{0\to i}$ 为该几何变换。噪声加在 LPD 先验上，训练的是如何修正不完美初始化；推理固定 $t=700$ 后只执行一次重建前向，700 不是迭代次数。[式 8–9、附录 A.3.3](https://arxiv.org/html/2610.11264v1#S3.E8)

第三组对应式 10 和附录 A.3.1：

$$
\mathcal L_{\mathrm{diff}}=\mathbb E_{t,\epsilon}\lVert\widehat X_i-X_i\rVert_2^2,\qquad
\mathcal L_{\mathrm{stage3}}=\mathcal L_{\mathrm{det}}+0.1\mathcal L_{\mathrm{diff}}.
$$

重建目标 $X_i$ 来自冻结传感器编码器生成的完整协作者特征，属于 $x_0$ 预测，而非直接预测噪声。第三阶段加入真实检测标注监督的检测损失，使恢复结果服务于检测。特征 MSE 没有单独提供生成目标真实性或不确定性校准的保证。[式 10、附录 A.3.1](https://arxiv.org/html/2610.11264v1#A1.SS3.SSS1)

### 三阶段训练与一次前向推理

第一阶段训练 PointPillars、金字塔融合和检测头，40 epochs、batch size 8、Adam 学习率 0.002；第二阶段冻结这些部分，训练潜变量编码器、LPD、DiT，100 epochs、batch size 12、学习率 0.0002，仅用重建损失；第三阶段保持传感器编码器/骨干冻结，联合微调重建、融合和检测头，20 epochs、batch size 8、学习率 0.0002。[附录 A.3.1](https://arxiv.org/html/2610.11264v1#A1.SS3.SSS1)

三个阶段均不在传输消息上加丢包。第二、三阶段通过不同时间步的高斯噪声让重建器见到不同质量的先验；这与显式学习丢包分布是不同策略。推理保留 LPD 和 DiT-B：12 层、隐藏维度 768、12 个注意力头，不需要完整目标特征或未来帧。单次 DiT 前向降低了迭代次数，但模型本身仍较重。[附录 A.3.2–3](https://arxiv.org/html/2610.11264v1#A1.SS3.SSS2)

## 关键图与可视化结果

![原论文图 3：紧凑潜变量、先验解码、噪声条件重建与检测的流程](../../assets/papers/lr-v2x-loss-resilient-perception-figure-3.png)

从左向右依次是压缩、空间接收掩码、LPD 和重建器；左上角明确区分训练时完整接收与测试时随机擦除。右上角自车分支直接进入重建条件，说明恢复不仅依靠通信消息。图下方的恢复特征随后进入融合和检测，最终输出检测框。[原图 3](https://arxiv.org/html/2610.11264v1#S3.F3)

![原论文图 5：V2XREAL 与 DAIR-V2X 随丢包率变化的 mAP 曲线](../../assets/papers/lr-v2x-loss-resilient-perception-figure-5.png)

上排是 V2XREAL，下排是 DAIR-V2X；三列分别为 IoU 0.3、0.5、0.7。红线并非所有点都最高，例如干净 V2XREAL 的若干阈值下 HEAL 更高。曲线支持在重度丢包端点仍保留较强检测表现，但不能概括成每个丢包率或每个类别都领先；精确数字应结合下节表 1 和附录表 4 阅读。[原图 5](https://arxiv.org/html/2610.11264v1#S4.F5)

## 实验结论与证据

### 数据划分、指标与消息预算

实验使用真实 DAIR-V2X 车路协同和 V2XREAL 的 LiDAR-only V2V 设置，均为两个参与方。所有方法采用 PointPillars、完整通信训练，并在测试时使用固定随机种子的空间掩码和推理噪声。论文只写遵循基准协议；2026-10-13 核对的官方配置进一步明确：DAIR-V2X 用 `val.json` 评测，V2XREAL 训练中用 `val/`、最终用 `test/`。原文未给出各 split 精确样本数和多 seed 置信区间。[附录 A、E](https://arxiv.org/html/2610.11264v1#A1)、[DAIR 配置](https://github.com/sidiangongyuan/LR-V2X/blob/master/configs/dairv2x/stage3.yaml)、[V2XREAL 配置](https://github.com/sidiangongyuan/LR-V2X/blob/master/configs/v2xreal/stage3.yaml)

V2XREAL 的 mAP 对 vehicle、pedestrian、truck 三个大类求均值；DAIR-V2X 的整体 mAP 使用全范围检测，不是 Short/Middle/Long 三个分段 AP 的算术均值。下表数值单位均为百分数，越高越好。[附录 A.1](https://arxiv.org/html/2610.11264v1#A1.SS1)

原表将 $16\times32\times64$ 个 float32 数记作 128 KB，其实际大小为 131,072 bytes，即 128 KiB；稠密特征为 8 MiB，两者字节比恰为 64。预算按每个协作者帧、丢包前计算，不包括链路封装等额外开销。90% 丢包下剩余字节是期望约 12.8 KiB，不是固定收到这么多。[附录 A.3.2、B.2](https://arxiv.org/html/2610.11264v1#A2.SS2)

### 等预算比较与推理代价

| 原表、划分与测试条件 | 方法 | mAP@0.3 / @0.5 / @0.7 ↑（%） | 丢包前负载 / FPS ↑ |
| --- | --- | --- | --- |
| 表 1(b)，DAIR-V2X val，90% 独立丢包 | CodeFilling | 63.38 / 60.93 / 50.62 | 128 KiB / 9.17 |
| 同上 | LR-V2X | 69.35 / 66.90 / 53.37 | 128 KiB / 6.04 |
| 附录表 4，同划分与丢包率、等预算重测 | CoBEVT | 67.73 / 62.85 / 52.99 | 128 KiB / 5.30 |
| 表 1(a)，V2XREAL test，90% 独立丢包 | CodeFilling | 40.54 / 36.69 / 23.16 | 128 KiB / 1.68 |
| 同上 | LR-V2X | 44.87 / 38.60 / 24.18 | 128 KiB / 1.54 |

DAIR-V2X 的 LR-V2X 相对 CodeFilling 提高 5.97 个 mAP@0.5 点；相对等预算 CoBEVT 提高 4.05 点，但 mAP@0.7 只高 0.38 点。V2XREAL 相对 CodeFilling 的 mAP@0.5 / @0.7 增益为 1.91 / 1.02 点。等预算控制比直接对照 8 MiB 方法更能支持低带宽重建价值，不过正文没有详述每种稠密基线如何改成 128 KiB；还需检查其容量和训练是否同步调整。[表 1、表 4](https://arxiv.org/html/2610.11264v1#A2.T4)

重建有实际计算成本：DAIR-V2X 的 6.04 FPS 比 CodeFilling 的 9.17 FPS 低，V2XREAL 只有 1.54 FPS。论文未给具体测试 GPU 型号，官方 README 说明 FPS 包含模型前向与检测后处理，不包含数据加载和指标累积，因此不能作为完整系统吞吐或实车实时性结论。[表 1](https://arxiv.org/html/2610.11264v1#S4.T1)、[官方评测说明](https://github.com/sidiangongyuan/LR-V2X#evaluation)

### 空间相关丢包呈现明确反例

| 附录表 2，DAIR-V2X val，90% 空间相关丢包 | mAP@0.3 / @0.5 / @0.7 ↑（%） | 丢包前负载 |
| --- | --- | --- |
| F-Cooper | 69.88 / 65.08 / 52.12 | 8 MiB |
| CodeFilling | 65.36 / 62.62 / 51.48 | 128 KiB |
| LR-V2X | 67.83 / 64.21 / 51.93 | 128 KiB |

Burst 设置先在 $8\times16$ 粗网格上采 Bernoulli 掩码，再最近邻放大到各方法的通信分辨率，产生连续缺失区域；它未模拟跨时间的网络连续丢包。LR-V2X 相对同预算 CodeFilling 仍高 2.47 / 1.59 / 0.45 点，但整体三项都低于 8 MiB 的 F-Cooper。更大消息在同丢失比例下保留更多绝对信息，这个反例说明“鲁棒”必须与通信预算一起判断。[附录 B.1、表 2](https://arxiv.org/html/2610.11264v1#A2.SS1)

### 自车条件与加噪各自贡献什么

附录表 5 在完整通信下固定潜变量先验，只移除重建器内部条件：无额外条件时 mAP@0.3 为 67.28，仅加自车 BEV 为 78.90，提高 11.62 点；再加变换矩阵为 79.69，全部条件为 81.03。第一行仍收到协作者潜变量，不能称作无协同基线。直接潜变量条件单独只增至 67.30，说明大部分发送方信息已进入 LPD，而自车几何参照是额外条件中贡献最大的部分。[附录表 5](https://arxiv.org/html/2610.11264v1#A3.T5)

附录图 7 同时对照 prior-only 和 zero-prior，支持先验初始化与去噪互补。附录表 7 的无噪声控制仍保留 LPD 和可学习重建器，加入噪声条件后提高 7.16 / 7.22 / 4.23 个 mAP 点；这比只和“没有重建模块”比较更有解释力。但这些控制未证明高斯先验扰动等价于所有实际信道失真，也没有单列无视野重叠或整目标擦除的校准误差。[附录 C.2、C.4](https://arxiv.org/html/2610.11264v1#A3.SS4)

## 应用场景与启发

作者希望在固定的小消息预算下，使性能随丢包率上升平稳退化，避免为每种丢包条件重新训练。潜变量先提供结构、自车特征再纠正结构的接口值得借鉴；完整通信训练与测试丢包分开的设置，也便于检查对未见丢包条件的适应能力。考虑到当前速度，可先围绕接收端恢复模块做研究。

一种待验证的省算力方案是：仅在收到潜变量的空间覆盖不足时启用 DiT，其余帧直接用 LPD，看能否保留大部分严重丢包收益并降低平均推理时间。触发条件只能使用实际接收掩码和局部观测，不能访问完整协作者特征或真值检测。

## 局限与阅读风险

作者在附录 E 明确把范围限制在双参与方，并将更大协同图、联合延迟/拥塞/重传模型及轻量重建器列为后续方向。当前“burst”主要是空间成片擦除；若用于持续多帧无消息、移动目标时序错位和相对位姿偏差，需要另做实验。

整体 mAP 最高不代表每类最好：90% 独立丢包下，V2XREAL 的 LR-V2X pedestrian AP@0.5 为 12.23%，低于 CodeFilling 的 12.92% 和 HEAL 的 12.96%。图 5 的低丢包区域也存在其他方法领先的点，应把“90% 丢包端点的整体 mAP”与全部曲线、全部类别分别判断。[表 1(a)、图 5](https://arxiv.org/html/2610.11264v1#S4.T1)

自车条件的强作用有明确消融支持，但对非重叠区域和新出现目标是否同样可靠仍未知。原文没有给出生成特征的不确定性、虚假目标率和多 seed 方差；检测均值改善尚不足以确认这些恢复特征可直接用于驾驶安全决策。

## 后续跟进

### 最小验证与停止条件

- 代码（2026-10-13，Asia/Shanghai）：[官方仓库](https://github.com/sidiangongyuan/LR-V2X)已含 `opencood`、LiDAR 数据加载器、LR-V2X 模型、训练和评测入口，实现的发布进度已超过论文摘要中的“计划发布”。
- 数据：仓库不含数据；[DAIR-V2X 官方入口](https://github.com/AIR-THU/DAIR-V2X)和 [V2X-Real 官方项目](https://mobility-lab.seas.ucla.edu/v2x-real/)可访问，需按提供者要求取得数据并按 OpenCOOD/HEAL 布局处理。样本下载与完整性检查的执行情况见下方核验记录。
- 配置：两数据集的三阶段 YAML 已提供；本次实际读取第三阶段文件，核对 split、128 KiB 潜变量尺寸、冻结骨干、重建损失权重 0.1 和单步 $t=700$。
- 权重：README 明确预训练 checkpoint 将另行发布，目前未给可用下载入口；实验日志、profiling 工具和分析脚本也未捆绑。现阶段可审查实现，精确重现表格需取得原权重或重新训练。
- 最小实验：先取得可用 checkpoint，在 DAIR-V2X val 固定 128 KiB、同一批样本和配对掩码，比较完整 LR-V2X、LPD-only、按掩码覆盖率触发的 DiT；分别测试独立丢包和原文粗网格 burst，并按自车/协作者视野重叠程度分组。记录三档 mAP、被遮挡目标召回、假阳性、P50/P95 推理时间和 DiT 启用率，至少使用三个配对 seed。
- 成功信号：相对完整模型，条件启用将平均推理时间降低至少 20%，各丢包设置 mAP@0.5 下降不超过 0.5 个点，且低重叠区域假阳性不增加。这些是本报告建议的验收阈值，不是论文结果。
- 停止/转向条件：若省算力主要来自漏掉需要重建的帧，或低重叠区域出现明显幻觉，则停止基于简单掩码的触发策略，先研究重建可信度或更轻量的确定性解码器。

### 来源与核验记录

依据 [arXiv:2610.11264v1](https://arxiv.org/abs/2610.11264v1)，提交日 2026-10-08，实际核验日 2026-10-13。PDF 第 1 页和作者仓库标注 NeurIPS 2026 接收；[会议官方目录](https://neurips.cc/Downloads/2026)也已列出本文并指向 [poster 148873](https://neurips.cc/virtual/2026/poster/148873)。据此记录为官方录用状态已核实；本次未核实正式论文集出版页面，机制与数值仍以固定 arXiv v1 为准。

PDF 首页核实 Kang Yang、Peng Wang、Deying Li 属 Renmin University of China，Tianci Bu 属 HKUST，Yongcai Wang 同属 Renmin 和 RIAS。重点读取 §3–4、附录 A–E，核对式 2/7–10/13、表 1/2/4/5/7；图 3、5 保存固定 v1 官方 HTML 原字节并逐张打开；图 5 另与 PDF 第 9 页核对，确认内嵌图与 HTML 原图像素一致。相关比较独立读取 CodeFilling §4.2、GenComm v2 §4、Sparse2comm §III–IV。本次未下载数据样本或验证其完整性，未安装或运行训练/评测代码；报告数值来自原表及明确的算术差值，未完成实验复现。
