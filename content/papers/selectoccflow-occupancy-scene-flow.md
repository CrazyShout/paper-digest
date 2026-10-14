---
{
  "id": "selectoccflow-occupancy-scene-flow",
  "tag": "dynamic-scene-representation",
  "tags": ["dynamic-scene-representation"],
  "title": "SelectOccFlow: Selective Spatiotemporal Aggregation for 3D Occupancy and Scene Flow Prediction",
  "source": "arXiv:2610.04356v1 / https://arxiv.org/abs/2610.04356v1 / Repository: https://github.com/muchen1021/SelectOccFlow",
  "authors": ["Yuhang Wang", "Kai Luo", "Yuanfan Zheng", "Kailun Yang"],
  "affiliations": ["School of Artificial Intelligence and Robotics, Hunan University", "National Engineering Research Center of Robot Visual Perception and Control Technology, Hunan University"],
  "comment": "SelectOccFlow 按语义、运动敏感度与物体边界选择空间和历史特征，联合预测三维占据及平面场景流。OpenOcc 的 OccScore 为 44.9，但 Occ3D 两项占据指标仍低于 ALOcc；目前公开演示，代码、配置与权重待发布。"
}
---

## 一句话定位

SelectOccFlow 在图像采样、时间融合、体素空间细化三个位置选择更合适的证据，联合估计**哪里被什么物体占据，以及这些体素在地面平面中怎样运动**。值得借鉴的不是简单增加历史帧，而是区分稳定物体、运动敏感区域和空闲空间，分别决定历史长度与对应搜索方式。

- 核心证据：OpenOcc 验证集上，本文 RayIoU 为 43.1%、mAVE 为 0.394，OccScore 为 44.9；ALOcc 对应 41.9%、0.458、43.1。加入状态条件时间聚合是表 V 中最大的单模块改进。[表 I、V](https://arxiv.org/html/2610.04356v1#S4.SS3)
- 主要边界：Occ3D-nus 上本文 RayIoU 43.3%、mIoU 44.6%，均低于 ALOcc 的 43.7%/45.5%。预测质量改善还没有通过规划器或闭环驾驶验证；官方实现和权重仍待发布。[表 II–III](https://arxiv.org/html/2610.04356v1#S4.SS1)

## 论文要解决的问题

### 相同占据形状可能对应不同风险

路边行人站立、向车道走来、远离车道时，单帧三维占据可能非常接近，运动方向却决定了后续交互。场景流为占据增加运动信息，但把图像特征 lift 到三维、再按自车运动对齐历史，并不能保证每个体素都得到了可靠信息：图像边界可能混入其他类别；运动物体在自车补偿后仍未对齐；不完整体素结构又会削弱流估计。

本文输入是多视角相机序列，以及视图变换和历史对齐所需的相机几何、自车运动。输出占据网格 $O_c\in\mathbb R^{X\times Y\times Z}$ 与流网格 $O_f\in\mathbb R^{X\times Y\times Z\times2}$；末维为平面运动的两个分量。三维指的是占据位置所在空间，并不表示每个体素预测三维速度。该方法没有使用雷达径向 Doppler 观测。[§III-A](https://arxiv.org/html/2610.04356v1#S3.SS1)

### 与直接相关工作的差异

| 工作与一手来源 | 原有机制 | SelectOccFlow 的具体变化与边界 |
| --- | --- | --- |
| Liao 等，STCOcc，CVPR 2025；[正式页](https://openaccess.thecvf.com/content/CVPR2025/html/Liao_STCOcc_Sparse_Spatial-Temporal_Cascade_Renovation_for_3D_Occupancy_and_Scene_CVPR_2025_paper.html)、[原文 §3.2](https://arxiv.org/html/2504.19749v1#S3.SS2) | 自递归占据预测引导稀疏空间/时间注意力，级联细化三维特征，并对采样位置做长期时间建模 | 本文保留 OA Transformer 与粗到细结构，在体素融合时区分稳定、运动敏感、空闲状态，再增加图像语义采样与六方向结构细化；它并非仅替换一个时间窗口 |
| Chen 等，ALOcc，ICCV 2025；[正式论文 §3.2、§3.4](https://openaccess.thecvf.com/content/ICCV2025/papers/Chen_ALOcc_Adaptive_Lifting-Based_3D_Semantic_Occupancy_and_Cost_Volume-Based_Flow_ICCV_2025_paper.pdf) | 遮挡感知 adaptive lifting 把表面证据传播到遮挡区域；以自车对齐后的 BEV 代价体显式建立跨帧对应，并结合分类/回归预测流 | 本文在图像 lift 之前按语义调整采样，在多尺度体素历史中按状态检索，再按语义边界距离选择空间支持点；OpenOcc 联合任务收益与 Occ3D 占据结果需要分别比较 |

## 方法和系统设计

### 三次选择发生在不同空间

首先，ResNet-50 提取图像特征，冻结的 YOLO26 分割模型给出类别图。该模型在 Cityscapes 19 类上预训练，没有在目标域微调；类别标签经嵌入和轻量编码器生成采样引导。SGS（Semantic-Guided Sampling）为每个位置预测九个采样偏移及权重，偏移限制在特征图各轴正负两个单元内。实际被采样的值全部来自 RGB 特征，分割模型只改变取哪里、取多少，并非直接融合其隐藏特征。[§III-B](https://arxiv.org/html/2610.04356v1#S3.SS2)

经 BEVStereo 深度估计和视图变换后，OA Transformer 编码 $1/8,1/4,1/2$ 三种尺度的体素特征。SCTA（State-Conditioned Temporal Aggregation）从 FIFO 队列取历史融合特征，按自车运动对齐，再按体素状态处理：稳定占据使用较长历史和可靠性权重；运动敏感区域在对齐位置附近搜索候选，以补偿物体自身运动；空闲主导区域使用较短历史和更简单的点采样。历史特征入队时截断梯度，避免跨整段序列反传。[§III-C](https://arxiv.org/html/2610.04356v1#S3.SS3)

最后，ESA（Extent-Aware Spatial Aggregation）预测每个占据体素沿正负 x/y/z 六个方向到类别边界的距离，采样这些支持位置，再由注意力聚合以补全结构。占据头使用空间细化结果；流头使用最细尺度的时间融合特征，并结合占据线索。它没有显式预测一个未来占据序列，场景流是当前动态状态的补充。[§III-D–E](https://arxiv.org/html/2610.04356v1#S3.SS4)

### 关键公式解释选择依据

图像空间的原文式 (1) 为：

$$
\widetilde F_n^I(p)=F_n^I(p)+\sum_{k=1}^{9}\beta_k(p)W_k\mathcal S_{\rm 2D}\bigl(F_n^I,p+p_k+\Delta p_k(p)\bigr).
$$

$F_n^I$ 是第 $n$ 路相机特征，$p_k$ 是规则 $3\times3$ 网格位置，$\Delta p_k$ 和 $\beta_k$ 由语义引导预测，$W_k$ 是可学习核，$\mathcal S_{\rm 2D}$ 为双线性采样。残差保留原特征，再加入更倾向于语义相容区域的证据。语义分割若在黑暗中出错，也可能把采样引向错误区域；平均鲁棒性结果尚未单独检验这一路误差。[式 (1)](https://arxiv.org/html/2610.04356v1#S3.SS2)

时间路由的核心是原文式 (2)：

$$
q_t^s(v)=m_t^s(v)o_t^s(v)\left(1+\left\lvert o_t^s(v)-\widetilde o_{t-1}^s(v)\right\rvert\right).
$$

$o$ 是非空概率，$m$ 是可移动类别概率之和，$\widetilde o_{t-1}$ 是上帧对齐后的非空概率。先按 $o$ 选占据候选，再按 $q$ 在固定配额内划出运动敏感集合，余下占据候选视为稳定，其他体素视为空闲主导。这个分数结合“像物体、可能移动、时间上发生变化”，并不是测得的速度；停着的车可能因类别可移动而获得较高分，真实运动也可能被错误占据预测漏掉。[式 (2)–(6)](https://arxiv.org/html/2610.04356v1#S3.SS3)

空间范围监督和总损失可合写为：

$$
d_r(v)=\min\{k>0:c(v+ke_r)\ne c(v)\},\qquad
\mathcal L_d=\frac{5\mathcal L_d^{\rm movable}+\mathcal L_d^{\rm static}}6,
$$

$$
\mathcal L=\mathcal L_{\rm depth}+\sum_s\gamma_s\mathcal L_{\rm occ}^{s}+\mathcal L_{\rm occ}+\mathcal L_d+\mathcal L_{\rm flow}.
$$

这是原文式 (7)、(10)–(11) 在 $\rho=5$ 时的整理。$c$ 是类别标签，$e_r$ 是六个轴向单位方向；搜索在网格边界截断，训练距离按轴长归一化。预测距离定位支持点，query-key 注意力决定六点的贡献。可移动/静态占据的距离误差先各自平均再加权，空体素不参加有效范围监督；所以权重 5 不等于每个前景体素在全图损失中都有严格五倍贡献。$\gamma_{1/8},\gamma_{1/4},\gamma_{1/2}$ 分别为 $1/8,1/4,1/2$，其余损失单位权重。[§III-D–E、§IV-A](https://arxiv.org/html/2610.04356v1#S3.SS4)

### 时间窗与训练依赖

从粗到细，稳定分支分别用 4/8/16 帧，运动敏感分支用三帧，空闲主导分支用 2/4/8 帧；运动对应搜索偏移数为 5/9/13。短运动窗口配合局部搜索，意在减少长历史中的错配，而静态结构可积累更久的证据。[§IV-A](https://arxiv.org/html/2610.04356v1#S4.SS1)

实验使用 $256\times704$ 图像、$200\times200\times16$ 网格、0.4 米体素，4 张 RTX 3090、batch size 8、AdamW，初始学习率 $5\times10^{-5}$、weight decay 0.01、余弦调度。论文只说各基准训练日程沿用相应基线，没有明确列出每项 epoch 或墙钟成本。稀疏 LiDAR 仅在训练时监督深度；部署时还要运行分割引导、维护历史队列并进行位姿对齐，这些开销不包含在 ResNet-50 主干本身。[§IV-A](https://arxiv.org/html/2610.04356v1#S4.SS1)

## 关键图与可视化结果

![原论文 PDF 图 2：SGS、SCTA、ESA 的整体流程；HTML 对应图 1](../../assets/papers/selectoccflow-occupancy-scene-flow-figure-2.png)

PDF 图 2 上半部分按图像→体素→历史融合→占据/流两头阅读，下半部分分别展开三个选择模块。稳定分支的历史最长，运动分支画出局部候选窗口；右侧六方向支持点对应 ESA。这里的图来自官方 HTML 原始资产，HTML 漏掉 PDF 首页概览图，所以标为图 1；报告保留 PDF 图号及 HTML 对应关系。[HTML 对应图注](https://arxiv.org/html/2610.04356v1#S2.F1)、[固定 PDF](https://arxiv.org/pdf/2610.04356v1)

![原论文 PDF 图 4：OpenOcc 场景流定性比较；HTML 对应图 3](../../assets/papers/selectoccflow-occupancy-scene-flow-figure-4.png)

PDF 图 4 从左到右为真值、本文、ALOcc、STCOcc；颜色表示流大小/方向，红箭头标注运动方向，绿椭圆圈出潜在自车交互区域。两行样例可见不同预测对局部运动方向与近静止对象的差异，但它们没有接入规划器，绿圈也不是已测量的危险概率。该图在 HTML 中编号为图 3。[HTML 对应图注](https://arxiv.org/html/2610.04356v1#S4.F3)

## 实验结论与证据

### 任务、split 与 OccScore 的单位

OpenOcc 与 Occ3D-nus 都基于 nuScenes，使用其标准训练/验证划分，论文未在实验设置重复列出样本数。OpenOcc 有占据和流标签；Occ3D-nus 缺少流标签，因此移除流分支，只评占据。nuScenes-C 在验证输入施加 Bright、Dark、Fog、Snow、Motion、Quant 六种合成退化，每种三档严重度；这不是实采恶劣天气道路评测。[§IV-A](https://arxiv.org/html/2610.04356v1#S4.SS1)

RayIoU 分别按 1/2/4 米射线距离容差评估后平均，mIoU 衡量语义体素重叠，二者越高越好。mAVE 是已被正确判为占据的可移动类别体素上的平均绝对速度误差，越低越好；它的评估集合随占据预测而变化，因此需要与占据指标共同看，不能只依据更低的 mAVE 判断所有对象运动更准。

原文式 (12) 用 0–1 比例计算 OccScore，再以 0–100 显示：

$$
\mathrm{OccScore}_{100}=100\left[0.9\,\mathrm{RayIoU}_{[0,1]}+0.1\max(1-\mathrm{mAVE},0)\right].
$$

例如 $0.9\times0.431+0.1\times(1-0.394)=0.4485$，乘 100 后为 44.85，按表格精度写 44.9。不能直接将百分数 43.1 代入括号内 RayIoU。论文表格未在 mAVE 列显式标注单位，因此这里保留基准原数值；其含义是速度误差，不是 IoU 百分比。[式 (12)、表 I](https://arxiv.org/html/2610.04356v1#S4.SS1)

### 联合任务更强，不代表所有占据基准都领先

| 设置与原表 | 方法 | 指标 | 比较条件 |
| --- | --- | --- | --- |
| OpenOcc 验证，表 I | STCOcc | RayIoU 40.8%；mAVE 0.445；OccScore 42.3 | R50，256×704，3D 监督 |
| 同一设置 | ALOcc | 41.9%；0.458；43.1 | 相同主干/分辨率类别，完整系统不同 |
| 同一设置 | SelectOccFlow | 43.1%；0.394；44.9 | 增加外部分割引导及选择聚合 |
| Occ3D-nus，表 II | STCOcc / ALOcc / 本文 | RayIoU 41.7% / 43.7% / 43.3% | 这张表明确都不用 camera-visible mask |
| Occ3D-nus，表 III | STCOcc / ALOcc / 本文 | mIoU 42.2% / 45.5% / 44.6% | 同 R50、256×704；该表另以星号标无 mask 配置，不能和表 II 混为同一协议 |
| nuScenes-C，表 IV | ALOcc / 本文 | OpenOcc 平均 OccScore 25.3 / 28.1 | 六类退化、三严重度的汇总 |
| 同一退化评测，表 IV | ALOcc / 本文 | Occ3D 平均 mIoU 27.7% / 28.0%；RayIoU 26.0% / 26.5% | 平均优势较小，须查看退化类别 |

OpenOcc 的 OccScore 相对 ALOcc 增加 1.8 点，即约 $1.8/43.1=4.2\%$ 相对提升；不是增加 4.2 个百分点。mAVE 若对比该表最好的旧值 ALOcc-2D 的 0.431，降幅为 0.037，约 8.6%；若对比完整 ALOcc 的 0.458，则约 14.0%。不同参照数会得出不同相对改善率，报告不能混写。[表 I](https://arxiv.org/html/2610.04356v1#S3.T1)

鲁棒性也不是所有退化都获益：OpenOcc 的 Dark 下，本文 OccScore 21.1 低于 ALOcc 23.1；Occ3D 的 Dark mIoU 为 21.4% 对 22.2%，Fog 为 34.2% 对 35.3%。优势主要出现在 Snow、Motion 等项，例如 OpenOcc Snow 为 12.7 对 4.9。平均 OccScore 25.3→28.1 是增加 2.8 点、相对约 11.1%，不能写成普遍提高 11.1 个百分点。[表 IV](https://arxiv.org/html/2610.04356v1#S4.T4)

### 时间模块贡献最大，但仍有精度交换

表 V 的基线为 38.9 RayIoU、0.525 mAVE、39.8 OccScore；仅加 SGS 为 39.7/0.487/40.8，仅加 SCTA 为 41.5/0.408/43.3，仅加 ESA 为 39.4/0.512/40.3。完整三模块为 43.1/0.394/44.9，支持时间聚合在当前框架中承担主要增量，同时图像和空间模块提供补充。[表 V](https://arxiv.org/html/2610.04356v1#S4.SS3)

表 VI 更有助于理解流分支：基线 40.2/0.489/41.3，加入 temporal 后为 43.2/0.432/44.6，再加 motion 为 43.1/0.394/44.9。最后一步使流误差下降，但 RayIoU 下降 0.1 点，不能说每个模块都让每项指标单调提高。论文未提供多种子波动、端到端 FPS、队列峰值显存以及分割模型成本，因此尚无法确定性能收益与资源代价是否划算。[表 VI](https://arxiv.org/html/2610.04356v1#S4.T6)

## 应用场景与启发

作者希望借助更完整的交通参与者结构和运动线索，识别潜在自车交互并支持安全决策。现有证据直接支持的是动态场景表征质量，特别是联合占据/流及若干合成退化下的表现；驾驶收益还需将预测接入固定规划器评估。因此，本文更适合作为动态场景表示方法来阅读。

一个值得检验的假设是：运动敏感区域的短时局部对应，比统一长历史更能减少物体运动造成的“拖影”，收益可能集中在横穿、自车附近缓行和突然起步的物体。若低置信占据导致路由错误，分类分支也可能扩大历史污染；跟进实验需要同时检查这两种情况。

## 局限与阅读风险

论文没有单列系统局限章节。由实验范围可提出三项具体问题：第一，SCTA 状态依赖当前占据类别与时间变化，未单独测试路由错误或自车位姿误差；第二，SGS 依赖外部 Cityscapes 分割先验，Dark 中的退步说明仍需检查域偏差，但仅凭表 IV 不能证明退步就是分割模型造成；第三，Occ3D 的流头被移除，其结果不能证明联合任务在另一个数据集上也同样有效。

另外，训练日程、精确路由配额与部署成本需要代码才能完整复核。表 III 的 camera-visible mask 条件与表 II 不同，不能混合 mIoU、RayIoU 的排名形成一个“统一领先”结论；主表旧方法还混有不同监督来源与模型容量，最可靠的机制比较仍是本文表 V–VI 内的消融。

## 后续跟进

### 最小验证与停止条件

- 当前资源（2026-10-13，Asia/Shanghai）：[官方仓库](https://github.com/muchen1021/SelectOccFlow) 根目录只有 README 与 assets，代码、预训练模型、评测脚本均标为 coming soon；未见配置文件和权重下载。数据依赖现有 OpenOcc、Occ3D-nus、nuScenes-C，当前仓库只给展示资产，没有新增训练数据发布入口。
- 最小实验：实现发布后，在 OpenOcc 固定 R50、输入分辨率、训练日程、体素分辨率与分割输出，比较统一历史聚合与状态条件聚合；为前者匹配历史读取数量和参数预算。先做 1/4 训练划分的工程验证，再固定三个种子跑完整验证集，报告 RayIoU、mAVE、OccScore、动态对象分层误差、延迟及显存。
- 成功信号：横穿/起步等运动场景的流误差改善，在匹配历史读取预算后仍存在，同时静态区域占据没有持续退步；额外扰动自车位姿或遮挡后，收益仍可重复。
- 停止/转向条件：若统一历史在相同预算下获得相同收益，停止把改进归于状态路由；若路由错误集中损害低速行人，转向置信度驱动的软路由；若分割引导的推理开销超过全部聚合模块，先评估缓存或轻量分割方案。闭环驾驶实验应在感知基准复现稳定后单独立项。

### 来源与核验记录

正文依据 [arXiv:2610.04356v1 PDF](https://arxiv.org/pdf/2610.04356v1) 与[同版本 HTML](https://arxiv.org/html/2610.04356v1)，实际阅读 §III-A–E、§IV-A–D，核对式 (1)–(12) 与表 I–VI。作者与两项机构名称从 PDF 首页脚注核对。PDF 图 2/4 对应 HTML 图 1/3，官方图像字节原样保存并逐张打开检查。相关工作分别重读 STCOcc §3.2 及 ALOcc 正式论文 §3.2、§3.4；未运行模型、下载权重或验证闭环效果。
