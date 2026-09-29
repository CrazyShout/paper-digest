---
{
  "id": "trio-trimodal-anything-perception",
  "tag": "lidar-anomaly-segmentation",
  "tags": ["lidar-anomaly-segmentation", "dynamic-scene-representation", "radar-occupancy-representation"],
  "title": "TriO: Tri-Modal Unsupervised Occupancy World Model for Anything Perception",
  "source": "arXiv:2609.32013 / https://arxiv.org/abs/2609.32013 / https://eccv.ecva.net/virtual/2026/poster/4951 / https://waabi.ai/research/trio-tri-modal-unsupervised-occupancy-world-model-for-anything-perception",
  "authors": ["Quinlan Sykora", "Sourav Biswas", "Christopher Diehl", "Andrew Cunningham", "Thomas Gilles", "Raquel Urtasun"],
  "affiliations": ["Waabi", "University of Toronto"],
  "comment": "用几何障碍伪标签和多模态自监督学习占据、障碍与流，并在 STU 做零样本迁移。其 STU 任务、数据组合和阈值选择与标准异常分割不同；三模态雷达证据另依赖未公开数据。"
}
---

## 一句话定位

TriO 把“这个物体属于什么类别”换成“这里是否被占据、是否会挡路、怎样运动”，用相机、LiDAR 和雷达各自能提供的监督训练连续时空表示。它为 STU 稀有道路障碍提供了值得研究的几何路线，但不是一次可直接并入原有异常检测排行榜的分数刷新。

- 核心证据：表 2 的软标签模型在论文自定义 STU 组合评估中得到 AP 81.6%、F1 77.7%；该实验训练于 AV2，迁移到 STU 时不微调。
- 主要边界：这里预测障碍与地面，不判定物体是否属于训练时的未知语义类；AV2/STU 没有雷达，三模态结果来自另一套未公开数据。
- 版本与状态：依据 [arXiv v1](https://arxiv.org/html/2609.32013v1)，实际核验于 2026-09-30。ECCV 官网已有[论文录用记录](https://eccv.ecva.net/virtual/2026/poster/4951)，作者项目页标注 Spotlight；本次未核到该论文的正式出版章节或独立 DOI。

## 论文要解决的问题

### 问题与假设

一个不在类别表里的泡沫条、倒下的物体或打开的车门，也可能需要车辆避让。纯几何占据能说明某处有东西，却不能独自区分可通行坡面和挡路物体；依赖固定文本类别的分割又可能漏掉外观不典型的东西。TriO 因而同时输出占据、障碍概率和流，用可测量的几何关系补充语义类别。

它的前提是传感器数据及标定可用，训练时还能取得未来观测以构造监督。图像侧依赖 Metric3Dv2 的深度与法向估计，LiDAR 侧依赖局部地面平面；这些估计有误时，伪标签也会偏。补充 B.6 明确把“无监督”限定于 TriO 自身不新增人工标注的训练流程，不宣称整个基础模型系统从未使用人工参与的数据。

### 相关工作与差异

以下对照分别核对了各工作的正式原文；表中只比较它们实际定义的任务。

| 工作与一手来源 | 已有机制 | TriO 改变的环节与边界 |
| --- | --- | --- |
| Agro 等，[UnO，CVPR 2024](https://openaccess.thecvf.com/content/CVPR2024/html/Agro_UnO_Unsupervised_Occupancy_Fields_for_Perception_and_Forecasting_CVPR_2024_paper.html) | 用 LiDAR 射线构造占据分类监督，学习连续 4D 场；世界模型与下游点云渲染分开训练 | 延续射线监督，增加障碍软标签、图像输入和雷达径向速度监督；新结果也包含额外模态的贡献 |
| Diehl 等，[DIO，CVPR 2025](https://openaccess.thecvf.com/content/CVPR2025/html/Diehl_DIO_Decomposable_Implicit_4D_Occupancy-Flow_World_Model_CVPR_2025_paper.html) | 以多帧 LiDAR 学习可分解的占据与流，用空间提示查询特定实例 | 借用多分辨率解码思路，重点转向障碍／地面与多模态监督；不能把 DIO 的实例条件机制说成 TriO 新提出 |
| Nekrasov 等，[STU，CVPR 2025](https://openaccess.thecvf.com/content/CVPR2025/html/Nekrasov_Spotting_the_Unexpected_STU_A_3D_LiDAR_Dataset_for_Anomaly_CVPR_2025_paper.html) | 将未知物体作为异常，报告点级 AP、FPR95、AUROC，以及对象级 PQ/UQ | TriO 在 STU 上重新组织二类障碍／地面任务，并加入相机视场与高度过滤；同名 AP 的正负样本和目标不同 |

## 方法和系统设计

### 输入输出与流程

模型查询接口为原文式 1：

$$
(o,s,\mathbf f)=f_\theta(\mathbf X_H,\mathbf q),\qquad \mathbf q=(x,y,z,t).
$$

$\mathbf X_H$ 是历史观测，$o$ 是占据概率，$s$ 是障碍概率，$\mathbf f$ 是三维瞬时流。$t$ 可以是当前或未来时刻。占据与障碍分成两个量，使模型能够表达“有几何表面，但属于可通行地面”，而不是把一切有回波的位置都当作障碍。

LiDAR 和雷达点分别经浅层 MLP 后进入稀疏三维骨干；图像经预训练 ResNet50 提取特征，再由 voxel attention 融合。较粗特征稠密化并通过可变形注意力扩展感受野，解码器结合多尺度特征回答查询点。图像编码器使用最近一帧，点云分支使用多帧及相对时间。实际模态随数据集变化，不能把示意图里的全部传感器套到每项实验。

### 关键公式与直觉

障碍软标签结合两种几何估计：图像深度／法向用于发现低矮细节，LiDAR 的局部地面平面用于判断离地程度。原文式 4 是条件选择，而非两个概率的加权平均：

$$
\mathbf p^{\mathrm{comb}}=
\begin{cases}
\mathbf p^I,&p_{\mathrm{valid}}^L<0.5\ \land\ p_{\mathrm{valid}}^I>p_{\mathrm{valid}}^L,\\
\mathbf p^L,&\text{otherwise}.
\end{cases}
$$

这里 $\mathbf p=[p_{\mathrm{valid}},p_{\mathrm{obst}}]^\top$ 同时保存标签有效性和障碍概率，$I/L$ 分别表示图像与 LiDAR。只有 LiDAR 判断不可靠且图像更可靠时才切换来源；因此，低矮物体被 LiDAR 自信地判成地面时，这个选择机制仍可能保留错误。

雷达不直接给出完整三维速度。式 11 先扣除自车传感器速度，再比较预测流的径向投影与 Doppler：

$$
\mathcal L_{\mathrm{flow}}=
\frac{1}{|\mathcal R_{\mathrm{clean}}|}
\sum_{\mathbf q\in\mathcal R_{\mathrm{clean}}}
\left|\mathbf d_{\mathrm{radar}}\cdot
\bigl(\mathbf f_\theta(\mathbf q)-\mathbf v_{\mathrm{sensor}}\bigr)
-v_{\mathrm{doppler}}\right|.
$$

$\mathcal R_{\mathrm{clean}}$ 是过滤测量不确定性后的雷达点，$\mathbf d_{\mathrm{radar}}$ 是径向单位向量。这项损失约束的是一维投影；多视点、多时刻观测能增加信息，但不能据此保证任意切向运动都已恢复。补充 E 给出了切向流退化和占据／流不一致的例子。

### 训练与推理

占据监督沿 LiDAR 射线采样自由空间及回波后方短段；障碍监督使用上述软概率与有效性权重；流使用 Doppler。训练总目标组合三类损失，未来观测只用于生成监督，推理时输入历史／当前传感器。补充 B.5 报告使用 16 张 GPU 训练，本次没有运行训练或推理。

预训练与下游任务还要分开：STU 是 AV2 模型的零样本评估；LiDAR 预测冻结占据模型后另训渲染头；下游车辆语义占据微调使用框标注。因此，“预训练不新增人工标签”不能覆盖所有下游结果。

## 关键图与可视化结果

![原论文图 2：多模态编码、隐式查询与三类训练监督](../../assets/papers/trio-trimodal-anything-perception-figure-2.png)

从左到右读传感器、特征融合、查询解码和三个输出。右侧虚线外的未来 LiDAR、分割掩码与雷达速度属于训练监督。该图说明共享表示如何服务多个任务，不能证明公开 STU 实验也输入雷达。原图及图注见[图 2](https://arxiv.org/html/2609.32013v1#S3.F2)。

![原论文图 19：STU 上低矮条状物被漏分为地面](../../assets/papers/trio-trimodal-anything-perception-figure-19.jpg)

三幅图依次展示道路图像、深度和障碍分割。左图道路上的浅色条状物，在右图仍落入蓝色地面区域；原作者图注称其看起来像泡沫泳池条。这是几何路线也会漏掉低矮障碍的例子，不是失败率统计。此处保留官方图像文件，未补画网页叠加标记。[图 19](https://arxiv.org/html/2609.32013v1#S5.F19)的原图按论文所示 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 许可引用。

## 实验结论与证据

### 设置与指标

STU 协议见补充 C.2：只保留公开 train 中的地面负例和 val 中的障碍正例，合并评估；保留高度 $z\in[-3,5]$ m 且投影到前相机视场内的点。输入一台 LiDAR 和一台前相机，查询时刻为零；预测占据低于 0.5 的点归为地面。模型没有在 STU 训练或微调，但 F1、recall 和 mIoU 使用该评估集上使 F1 最大的阈值，不能把这些数值当作预先固定阈值的部署表现。

AP 衡量障碍概率的排序；mIoU 平均障碍与地面两个类别的交并比；recall 衡量漏掉多少正类点。本项评估的正例仍来自 STU 的未知异常障碍，负例则只保留 train 中的地面点。区别在于模型预测障碍／地面而非语义新颖性，且评估重组了正负样本及过滤范围；不是说本表把普通已知类障碍也作为正例。因此，不与标准 STU 异常分割 AP 或隐藏测试榜单直接比较。

### 主要结果与比较

| 原表与设置 | 方法／配置 | 结果 | 解释边界 |
| --- | --- | --- | --- |
| 表 2，自定义 STU 组合评估 | DIO + CSL | AP 74.8%，F1 72.9% | LiDAR-only，对比 TriO 时存在模态差异 |
| 表 2，同一 TriO 架构 | CSL Hard | AP 76.1%，mIoU 50.3% | 硬化伪标签版本 |
| 表 2，同一 TriO 架构 | CSL Soft | AP 81.6%，mIoU 54.9%，F1 77.7%，recall 71.3% | 相对 Hard 的 AP 增量为 5.5 个百分点，按原表计算 |
| 表 3，AV2 LiDAR 预测 | TriO / DIO | 深度 L1 1.82 / 2.11 m；NFCD 0.93 / 0.85 m² | L1 更低，但近场 Chamfer 并非更好；不是所有指标都领先 |
| 表 4，LRR 的 200 m 以外区域 | TriO / DIO | mAP 42.6 / 36.2；流 EPE 4.01 / 4.40 | 额外传感器与未公开数据条件下的结果，不能直接归因于单一损失 |
| 表 10，RTX 5000、20,000 查询点 | 完整 TriO / 无相机输入 | 489.32 / 60.81 ms；9,915 / 3,449 MB | 是两种模型输入设置的计时，不是完整三模态系统的实时闭环证明 |

软标签消融支持其在这套分割评测中的价值。作者将其解释为更好的校准；本报告认为 AP 与 IoU 的提升尚不能替代概率校准误差、固定阈值误报率或跨域阈值稳定性检查。

### 消融与证据边界

表 5 的 LRR 实验中，移除雷达输入使远距 mAP 从 42.6 降至 34.5；移除雷达流损失使远距 EPE 从 4.01 升至 6.02。它们分别支持雷达观测和径向监督在该设置下有用。另一方面，去掉相机输入时远距 mAP 为 42.2、EPE 为 3.64：相机带来的占据收益很小，流误差反而更低，不能概括成模态越多各项都越好。

AV2/STU 不含雷达；LRR 才使用相机、LiDAR 与雷达并提供远至 350 m 的框标签。LRR 是未公开的 2,280 序列数据，补充说明用了其中 19 个序列评估。上述结果是开放环感知／预测指标，没有直接验证规避这些障碍的规划或控制收益。

## 应用场景与启发

### 作者主张与本报告判断

作者希望用无需目标数据人工标注的占据表示，覆盖固定类别表之外的物体。本报告更看重两个可迁移思路：把占据与可通行性分开建模；让伪标签保留不确定性，而不是一开始就把几何判断硬化。

对 STU 方向，这增加了一条几何监督基线，也提高了新工作的比较要求。后续方法应分别回答未知语义识别、二类障碍分割、实例完整性和固定误报预算下的召回，不能把其中一项的进步借用成其他任务的结论。

### 可验证的跟进

先重建小批次的图像／LiDAR 伪标签，对照低矮物体、坡面、雪和尾气，记录两种标签的分歧与置信度。再把固定阈值迁移、时序稳定性及对象级召回作为独立终点。这个方案是待验证假设，不构成新颖性确认；训练前还需要确认原方法配置与评测实现。

## 局限与阅读风险

- **两处计数冲突**：正文称 STU 有 22 条可用序列，补充列出 2 条 train 加 19 条 val；正文 AV2 为 700 train／150 val，补充 C.1 写 750 train／150 val。这里保留冲突，不能擅自选择一组数字当作已确认复现配置。
- **“未知”定义不同**：几何障碍可能是已知车辆，也可能是未知杂物；从地面分离它们不等于完成标准 OOD 语义判断。
- **监督与输入要分清**：公开 AV2/STU 结果不能证明雷达贡献；语义占据微调也不再是无标注训练。
- **失败仍存在**：雪和尾气会导致假阳性，低矮条状物会漏检；径向速度监督对切向运动仍不足，预测占据与流也可能不一致。
- **成本与资源**：完整模型的相机分支带来明显时延和显存负担；私有 LRR 限制了第三方验证远距雷达收益。
- **证据强度**：论文没有由这些开放环数字建立实车安全保证，本次核验也没有复现训练、下载完整数据或执行模型。

## 后续跟进

### 先补齐可复核条件

- 以[官方项目页](https://waabi.ai/research/trio-tri-modal-unsupervised-occupancy-world-model-for-anything-perception)及固定 v1 为准，追踪实现、训练配置、权重与具体评测代码。本次核对到论文、海报和视频入口，未核到可用的 TriO 官方实现或权重；没有观看视频或运行演示。
- 向作者确认两处序列计数、STU 合并与过滤实现、最佳 F1 阈值的计算范围，以及无相机输入消融是否保持相同伪标签和训练设置。
- 先在公开数据上复核伪标签与评测口径，再考虑完整训练；LRR 未开放时，只能把其数值作为作者报告的证据，不能写进已可执行的公开复现实验。

### 进入进一步实验的标准

先固定协议、数据划分和阈值校准集，再比较软标签与硬标签。若收益只在评估集重新选阈值后出现，或对象级漏检、跨序列稳定性没有改善，应收窄结论。若需要显著额外传感器或计算，应同时报告这些代价，而不是只对齐一列 AP。
