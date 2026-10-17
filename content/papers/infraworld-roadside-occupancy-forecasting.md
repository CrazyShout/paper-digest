---
{
  "id": "infraworld-roadside-occupancy-forecasting",
  "tag": "dynamic-scene-representation",
  "tags": ["dynamic-scene-representation", "world-models"],
  "title": "InfraWorld: Motion-Aware World Modeling for Roadside 4D Occupancy Forecasting",
  "source": "arXiv 预印本，未核实正式发表记录 / arXiv:2610.14544v1 / https://arxiv.org/abs/2610.14544v1",
  "authors": ["Songkai Wang", "Xiaokai Bai", "Lei Yang", "Hui-liang Shen"],
  "affiliations": ["Zhejiang University", "Nanyang Technological University"],
  "comment": "InfraWorld 用稠密 BEV 保留路侧布局，以持续运动查询更新少量变化区域；相机预测占据输入下，InfraOcc 动态类别平均 mIoU 从 I²-World 的 17.38% 提高到 21.23%。模型仍需更长推理时间，代码和完整训练配置尚未提供。"
}
---

## 一句话定位

InfraWorld 从过去 2 秒的语义占据预测未来 3 秒：稠密鸟瞰图状态负责完整场景，少量持续更新的查询负责车辆等局部运动。它针对固定路侧视角下“背景很稳定、变化很稀疏”的结构，在 InfraOcc 验证集上改善动态类别预测；使用占据真值和使用相机预测占据是两套实验，前者的较高分数不代表相机到未来场景的实际表现。[§3.1、§4.1、表 1](https://arxiv.org/html/2610.14544v1#S3.T1)

## 论文要解决的问题

### 静止的背景不应淹没运动

路侧传感器持续观察同一片空间，道路、建筑和停车区域在坐标系中保持对齐。未来变化主要来自少数交通参与者。统一更新整张 BEV 特征图容易让大面积不变区域主导学习；只用稀疏查询，又需要额外处理完整静态布局的保留。InfraWorld 让两种表征分工，再把局部运动信息写回稠密状态。[§1–2](https://arxiv.org/html/2610.14544v1#S1)

输入是历史语义占据序列，输出是未来逐帧占据。模型没有接收候选车辆动作，也没有选择驾驶策略；这里的 world model 指场景演化预测器。固定坐标系使时序融合直接可用，但真正采用时仍要先得到可靠的路侧占据观测。

### 相关工作与差异

| 工作与一手来源 | 已有机制 | InfraWorld 的变化与比较边界 |
| --- | --- | --- |
| Yang 等，InfraOcc，2026 预印本；[§III–IV](https://arxiv.org/html/2608.30657v1#S3) | 在固定路侧坐标系构造语义占据基准；ProSD-Occ 先解释静态布局，再提取残余动态证据，完成当前帧占据预测。 | InfraWorld 使用这一场景与标注体系，把任务延伸到历史占据到未来占据。当前帧感知与未来预测不是同一项指标。 |
| Liao 等，I²-World，ICCV 2025；[原文 §3.1–3.3](https://arxiv.org/html/2507.09144v1#S3)、[正式论文](https://openaccess.thecvf.com/content/ICCV2025/papers/Liao_I2-World_Intra-Inter_Tokenization_for_Efficient_Dynamic_4D_Scene_Forecasting_ICCV_2025_paper.pdf) | 场内多尺度量化保留空间细节，场间 tokenizer 聚合历史；编码器—解码器预测潜在场景的转移。 | InfraWorld 在稠密预测之外增加持续运动查询，并以置信度控制局部写回。下文数字来自 InfraWorld 内的重评协议，不混用 I²-World 原文的推理速度。 |
| Dang 等，SparseWorld，AAAI 2026；[原文方法章](https://arxiv.org/html/2510.17482v1#Sx3)、[正式页](https://ojs.aaai.org/index.php/AAAI/article/view/37347) | 从图像特征构造范围自适应的稀疏动态查询，以自车状态条件化连续预测，并解码占据与规划。 | InfraWorld 借用逐级查询细化思路，但保留独立稠密场景状态；查询聚焦运动区域，不承担全部空间表征。两者感知输入和预测任务链不同，不能把表 1 的差值完全归因于稠密或稀疏这一项设计。 |

## 方法和系统设计

### 历史占据先分成全局状态与运动查询

冻结的 VQ tokenizer 把每帧占据编码成稠密 BEV 潜在状态，并将最近的状态放入先进先出历史队列。DQI（Dynamic Query Initiation）读取当前和历史状态，预测运动概率图；图被划成不重叠小块，每块按最高运动分数排序，选出固定预算的查询。块内用软定位确定起点，低于运动概率阈值的查询标记为无效。[§3.1–3.2](https://arxiv.org/html/2610.14544v1#S3.SS2)

每次预测时，LST（Long–Short Temporal Fusion）先更新稠密特征：短期分支用 ConvGRU 式门控融合相邻历史，长期分支对历史特征的相邻差分做时间卷积，再汇入空间特征。运动查询从这些特征中采样、相互交互，并更新自身语义和点位置。MAQI（Motion-Aware Query Injection）最后将查询信息写回附近的 BEV token，生成下一时刻状态，放回队列继续滚动。[§3.3–3.4](https://arxiv.org/html/2610.14544v1#S3.SS3)

例如，路口中央一辆车向右转时，道路边界由稠密状态维持，查询追踪这辆车的局部变化。写回时的距离偏置限制查询影响范围，置信度降低定位或语义不可靠的更新权重。这是可学习的软抑制，并非对错误预测的硬性排除。

### 三组公式说明信息从哪里来

第一组重排原文式 1–4，突出共同滚动的两个状态：

$$
Z_s=\mathcal E(O_s),\qquad
(\widehat Z_\tau,Q_\tau)=\mathcal W_\theta(\widehat Z_{\tau-1},\mathcal H_{\tau-1},Q_{\tau-1}),\qquad
\widehat O_\tau=\mathcal D(\widehat Z_\tau).
$$

$O_s$ 是历史占据，$\mathcal E,\mathcal D$ 是冻结的编码器和解码器；$\mathcal H$ 保存近期稠密潜在状态，$Q$ 保存查询特征、点坐标和初始化时的有效标记。预测状态会进入下一步历史，因此长时预测要承受自身误差累积，不能持续使用未来真值刷新输入。[式 1–4](https://arxiv.org/html/2610.14544v1#S3.E1)

第二组保留式 11–12 的写回结构，省略时间和查询索引：

$$
B'=B+\mathcal P_o\!\left(\operatorname{MHA}(q^{\mathrm{bev}},\{k_i\},\{c_i v_i\};b)\right),\qquad
\widehat Z_\tau=\widehat Z_{\tau-1}+\mathcal P_r(\operatorname{reshape}(B')).
$$

$B$ 是 LST 得到的 BEV token，$q^{\mathrm{bev}}$ 是其带位置编码的注意力查询，$k_i,v_i$ 来自第 $i$ 个运动查询；$c_i$ 是预测置信度，$b$ 同时编码到查询中心的距离偏置和无效查询掩码。$\mathcal P_o,\mathcal P_r$ 的末层零初始化，让模型从较保守的残差更新起步。这里被置信度缩放的是写回的 value，低置信查询并没有被证明一定对应错误。[式 10–12](https://arxiv.org/html/2610.14544v1#S3.E10)

第三组摘录式 13、15，说明稠密预测与查询可靠性的监督：

$$
\mathcal L_{\mathrm{latent}}=\sum_{k=1}^{F}\alpha_k\,\operatorname{MSE}(\widehat Z_{t+k},Z_{t+k}),\qquad
c_i^*=\frac{1}{N_p}\sum_{p=1}^{N_p}\exp\!\left(-\frac{d_{ip}^2}{2\sigma_r^2}\right)s_{ip}.
$$

$F$ 是预测步数，$\alpha_k$ 为各步权重；未来目标 $Z_{t+k}$ 由冻结 tokenizer 编码真值获得，只参与训练。查询中每个点到最近真值运动点的距离为 $d_{ip}$，语义匹配标记为 $s_{ip}$，$\sigma_r$ 控制定位容忍范围。置信度用二元交叉熵拟合这个软目标，同时还有运动掩码、点位置和点语义损失。因而置信度学到的是训练标注下的距离与语义一致性，论文没有另测概率校准或风险覆盖率。[§3.5](https://arxiv.org/html/2610.14544v1#S3.SS5)

### 训练用运动标注，推理用历史占据

运动掩码的正样本同时满足“属于动态语义类别”和“流幅值超过阈值”。InfraOcc 的流由 3D 框及速度离线生成，只用于构造运动标签；模型不把流向量作为推理输入，也不直接预测流向量。查询的点位置和语义另有监督。评测中的动态类别 mIoU 则按语义类别统计，不等于仅评正在运动的体素。

Tokenizer 预训练 24 epochs 后冻结；预测模型在 InfraOcc 上训练 24 epochs、Occ3D–nus 上训练 48 epochs。作者使用 4 张 RTX 4090、每 GPU batch size 8、AdamW、初始学习率 $10^{-3}$ 和权重衰减 $10^{-2}$。InfraWorld-O 用真值占据训练，InfraWorld-STC 用 STCOcc 的相机预测占据训练；后者仍经过感知模型，不能把前者成绩写成相机端到端成绩。[§4.1](https://arxiv.org/html/2610.14544v1#S4.SS1)

## 关键图与可视化结果

![原论文图 4：历史占据编码、运动查询初始化和自回归预测流程](../../assets/papers/infraworld-roadside-occupancy-forecasting-figure-4.png)

从左侧历史占据和 tokenizer 读起，中间 DQI 分支产生运动查询；上方自回归预测器反复更新稠密状态与查询。下方放大图分别展示 LST 的短期融合、历史残差，以及 MAQI 的置信度缩放。右侧解码器接收的是稠密潜在状态，查询通过写回影响最终占据，而非单独替代场景输出。[原图 4](https://arxiv.org/html/2610.14544v1#S3.F4)

![原论文图 6：InfraWorld 与 I²-World 在 2 秒和 3 秒预测中的定性对比](../../assets/papers/infraworld-roadside-occupancy-forecasting-figure-6.png)

三列依次是真值、InfraWorld 和 I²-World，两行分别对应 2 秒、3 秒。道路布局在三列中相近，差异集中在黄色框内的交通参与者：3 秒时 I²-World 的局部目标形状和位置偏差更大。该图帮助定位动态区域的差别，平均效果仍以表 1 的全验证集结果为依据。[原图 6](https://arxiv.org/html/2610.14544v1#S4.F6)

## 实验结论与证据

### 两套数据、两种输入必须分开

InfraOcc 含 215 段训练序列、75 段评估序列，体素网格为 $320\times320\times16$、分辨率 0.4 m。论文分别报告动态和静态语义类别的平均交并比（mIoU，越高越好），在 1、2、3 秒处评估并取平均。Occ3D–nus 使用 600 个训练场景和 150 个验证场景，采样率 2 Hz、体素边长 0.4 m，范围为平面各 $[-40,40]$ m、高度 $[-1,5.4]$ m。[§4.1](https://arxiv.org/html/2610.14544v1#S4.SS1)

这些实验是离线未来占据预测，没有让车辆执行规划动作。Occ3D–nus 的结果可说明方法也适用于移动自车视角，但不是路侧系统跨城市部署或驾驶安全的评测。

### 动态收益明显，感知误差仍占重要部分

| 原表、数据与输入 | 方法 | 动态 mIoU：1 / 2 / 3 秒；平均 ↑（%） | 静态平均 mIoU ↑（%） |
| --- | --- | --- | --- |
| 表 1，InfraOcc，真值占据 | I²-World-O | 33.34 / 29.67 / 28.66；30.56 | 97.21 |
| 同上 | InfraWorld-O | 46.03 / 38.08 / 34.63；39.58 | 97.73 |
| 表 1，InfraOcc，相机预测占据 | I²-World-STC | 19.47 / 16.95 / 15.73；17.38 | 78.70 |
| 同上 | InfraWorld-STC | 22.52 / 20.73 / 20.43；21.23 | 78.71 |

真值占据输入下，动态平均 mIoU 提高 9.02 个百分点；相机预测占据输入下提高 3.85 个百分点，静态平均只增加 0.01 点。前者有助于隔离预测器能力，后者更接近传感器前端会产生误差的条件。两套输入的成绩差距还说明，增加预测能力没有消除上游感知瓶颈。[表 1](https://arxiv.org/html/2610.14544v1#S3.T1)

Occ3D–nus 上，InfraWorld-O 的平均 mIoU 为 42.25%，I²-World-O 为 39.73%；STC 输入对应 18.56% 和 16.93%，分别提高 2.52、1.63 个百分点。它们是同篇报告内各自输入组的对照，不与 InfraOcc 动态类别分数组成统一排行榜。[表 2](https://arxiv.org/html/2610.14544v1#S4.T2)

### 消融与计算代价

表 3 的稠密基线动态平均 mIoU 为 30.93%；仅加 LST 为 32.87%，仅加 MAQI 为 34.35%，MAQI 加 DQI 为 36.75%，三者结合为 39.58%。这些消融支持历史融合与局部查询都有贡献，但没有穷举所有组合。表 4 去掉置信度权重后降到 38.18%，改为双线性写回后为 37.78%，说明可学习写回在该协议下优于这两个替代配置。[表 3–4](https://arxiv.org/html/2610.14544v1#S4.T3)

计算也随之增加。单张 RTX 4090、batch size 1 下，表 5 给出的推理时延由 I²-World 的 85 ms 增至 119 ms，增加 34 ms；参数从 22.5M 增至 29.1M，FLOPs 从 91G 增至 166G。扩大的 I²-World-L 有 28.9M 参数、169G FLOPs、91 ms 时延，动态平均 mIoU 为 32.90%，仍低于 InfraWorld 的 39.58%。这项等容量近似对照削弱了“仅靠模型变大”的解释，但没有消除时延代价。论文未说明这一计时是否包括感知前端及完整滚动预测的全部步骤，也未报告多次训练的方差。[表 5、§4.4](https://arxiv.org/html/2610.14544v1#S4.T5)

## 应用场景与启发

固定路口的未来占据可以用于提前观察横穿车辆或转弯车辆将占用哪些区域。InfraWorld 提供了一个具体的表征分工：让全局状态保持完整，让持续查询处理局部变化。若接入路侧风险提示，首先要验证相机输入、遮挡和新进入视野的参与者，而不只复核真值占据下的平均精度。

DQI 的查询有效性在初始化时确定，因此一个值得检查的问题是：历史中静止、预测期间突然起步的车辆，是否比一直移动的车辆更难得到查询支持。稠密分支仍可能预测这种变化，但表 1 的平均分没有单独回答这个问题。这个疑问来自初始化机制，尚不是论文已经观察到的失败。

## 局限与阅读风险

当前证据主要来自一个固定路侧基准和一个自车基准。论文没有单列新路口、极端天气、标定漂移、初始运动掩码漏检或更长预测时域的结果。固定视角下稳定背景带来的优势，是否能在这些条件下保持，需要分项验证。

复现细节也不完整：查询数量、运动阈值、各损失权重等没有形成可直接运行的配置。§3.5 指向附录说明离线流的生成，但本次固定 v1 的 12 页 PDF 和 HTML 均未包含该附录。这个缺口影响的是运动监督和置信度目标的复建，而非仅仅安装环境。

## 后续跟进

### 最小验证与停止条件

- 代码：2026-10-18 核对固定 v1 摘要和全文，作者写明计划发布，未给出 InfraWorld 实现入口；按题名补查也未找到可确认归属的官方实现。
- 数据：[InfraOcc 官方仓库](https://github.com/yanglei18/InfraOcc)已展示数据结构和准备入口，但本次其 README 所链数据指南返回 404，尚未确认完整数据包可取得。[Occ3D 官方仓库](https://github.com/Tsinghua-MARS-Lab/Occ3D)提供标签说明与下载入口；本次未下载标签归档。还需要 InfraWorld 实际采用的时序样本清单及 STCOcc 预测结果。
- 配置与权重：未找到 InfraWorld 的公开文件。InfraOcc 的感知配置或权重即使可得，也不是 InfraWorld 预测器的权重；其 README 所列 checkpoint 目录本次同样返回 404。
- 最小实验：取得实现、权重及可用序列后，固定同一 tokenizer、历史窗口、查询预算和训练预算，比较完整方法、固定网格查询、去置信度写回三种配置。按“持续移动”“历史静止后起步”“从视野外进入”分组，报告 3 秒动态 mIoU、目标召回、背景误报和完整流水线 P50/P95 时延；至少用三个配对训练 seed。
- 成功信号：局部查询在等预算下保留平均收益，且新起步、进入视野两组没有被平均分掩盖的明显召回下降，再考虑接入风险提示。
- 停止或转向条件：若收益集中在已有稳定运动轨迹，而新运动持续漏检，应先研究查询重新初始化或保守的新目标处理；若优势主要来自前端输入差异，则先统一感知结果。

### 来源与核验记录

依据 [arXiv:2610.14544v1](https://arxiv.org/abs/2610.14544v1)，提交于 2026-10-10，目录公告为 2026-10-14，实际核验于 2026-10-18。PDF 页眉写有 ICLR 2027 会议文字，但本次未核实正式录用或出版记录，因此按预印本收录。

已阅读固定 HTML §1–5，核对式 1–16、表 1–5、图 4 和图 6，并对照 PDF 首页及全文结构。Songkai Wang、Xiaokai Bai、Hui-liang Shen 的单位为浙江大学，Lei Yang 为南洋理工大学；两张图片均来自固定 v1 的官方图像文件，已逐张打开查看。相关工作分别核对 InfraOcc §III–IV、I²-World §3、SparseWorld 方法章；数据资源状态以本次可访问的仓库、README 和具体链接为准。未执行第三方代码、下载训练数据或复现表中数值。
