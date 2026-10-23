---
{
  "id": "streamrps-streaming-radar-panoptic",
  "tag": "radar-occupancy-representation",
  "tags": ["radar-occupancy-representation", "dynamic-scene-representation"],
  "title": "Real-Time Radar Semantic and Panoptic Scene Understanding",
  "source": "arXiv:2610.26816v1 / https://arxiv.org/abs/2610.26816v1 / 固定全文：https://arxiv.org/html/2610.26816v1 / 预印本 / 仓库：https://github.com/robot-learning-freiburg/StreamRPS",
  "authors": ["Santosh Parit", "Julia Hindel", "Rohit Mohan", "Georgi Pramatarov", "Paul Newman", "Daniele De Martini", "Abhinav Valada"],
  "affiliations": ["University of Freiburg", "University of Oxford"],
  "comment": "StreamRPS 用 LiDAR 场景补全生成稠密雷达监督，再按旋转雷达的角扇区逐段预测语义和实例。四扇区设置下网络吞吐达到 421.9 FPS，但小物体仍难识别，伪标签分数与人工标注分数需要分开看。"
}
---

## 一句话定位

StreamRPS 面向旋转式 FMCW 雷达的距离—方位图：以 LiDAR 场景补全提供稠密监督，用适配极坐标的网络在一圈扫描完成前就输出扇区分割。SAX 四扇区配置下，稠密伪标签测试 mIoU 为 34.33%，人工标注测试为 30.22%；RTX 2080 Ti 上 421.9 FPS 是网络吞吐，传感器本身仍以 4 Hz 转动。[§IV、表 III–IV](https://arxiv.org/html/2610.26816v1#S4)

## 论文要解决的问题

### 等整圈扫描，还是随扇区到达更新

旋转雷达一圈要约 250 ms。等全部 360° 数据到齐再处理，会推迟已经扫到区域的更新；按角度切片可以更早得到局部预测，但切片越窄，可用场景上下文越少。极坐标还带来方向不对称：方位轴首尾相连，距离轴有边界，同样大小的物体在不同距离对应不同形状。[§I、§III-B](https://arxiv.org/html/2610.26816v1#S3.SS2)

这里的输入是旋转 FMCW 雷达的强度图，不是同时包含距离、方位、俯仰和 Doppler 的 4D 成像雷达张量；输出为二维极坐标中的语义与实例分割，也不是三维占据预测。将它纳入雷达表示方向，是因为它补充了稠密雷达监督和连续扫描处理这条路线，不能把结果直接移用于 K-Radar 的 3D 占据任务。

### 相关工作与差异

| 工作与一手来源 | 已有机制 | StreamRPS 的变化与边界 |
| --- | --- | --- |
| Kaul 等，RSS-Net，IEEE IV 2020；[原论文 §III–IV](https://arxiv.org/pdf/2004.03451)；[作者机构记录](https://ori.ox.ac.uk/news/rss-net-weakly-supervised-multi-class-semantic-segmentation-with-fmcw-radar) | 用相机语义、LiDAR 和位姿链构造雷达标签，累计前后帧扩展覆盖；卷积网络结合多帧雷达预测语义。 | 监督改用 LiDAR 场景补全，网络改为扇区流式处理及极坐标注意力，并增加实例输出。两者都使用跨模态离线监督，本文的表格是在新数据与标签协议下比较。 |
| Cao 等，PaSCo，CVPR 2024；[正式论文 §3.1–3.2](https://openaccess.thecvf.com/content/CVPR2024/papers/Cao_PaSCo_Urban_3D_Panoptic_Scene_Completion_with_Uncertainty_Awareness_CVPR_2024_paper.pdf) | 从不完整 LiDAR 预测稀疏多尺度补全，再对非空体素预测语义/实例掩码；多输入多输出集成估计不确定性。 | 用其 SemanticKITTI 预训练模型生成雷达教师标签，再做投影与实例清理。它没有因此继承一套已验证的雷达不确定性校准；教师补全错误仍会进入监督。 |

## 方法和系统设计

### LiDAR 教师怎样变成雷达标签

PaSCo 把含位置和强度的 LiDAR 点云补成 $256\times256\times32$、0.2 m 体素网格；分象限处理后拼成 $512\times512\times32$。每个地面格保留最高占据体素的类别，形成 BEV 标签，再依外参投到雷达坐标。雷达 4 Hz、LiDAR 10 Hz 的采样时间不同，作者对每个方位选择时间最近的 LiDAR 标签，组合成一圈，再转为与雷达强度图一致的距离—方位表示。[§III-A](https://arxiv.org/html/2610.26816v1#S3.SS1)

PaSCo 的实例 ID 没有直接原样保留。作者发现投影后实例可能膨胀或跨 0°/360° 边界分裂，于是在同类像素中重新做连通域分析，只保留每个实例的最大连通块，并丢弃面积小于 25 像素或框高小于 4 像素的实例。这有助于抑制伪标碎片，也可能滤掉真实细小目标；后续小物体结果需要连同这个标签处理规则一起看。

### 网络同时利用位置、方向和历史

把一圈极坐标输入 $X\in\mathbb R^{A\times R}$ 沿方位轴分成 $N$ 片，与前面 $t-1$ 圈的对应片叠成通道：

$$
X^{S_n,t}_{\mathrm{polar}}\in\mathbb R^{(A/N)\times R\times t}.
$$

$A$ 是方位采样数，$R$ 是距离 bin 数。默认 $t=3$，标签对应最新一帧；历史提供区分瞬时鬼影与持续结构的上下文。训练沿方位轴循环平移模拟旋转，概率为 0.7；距离轴不使用会把远近关系颠倒的普通水平翻转。[§III-B1–3、§IV-B](https://arxiv.org/html/2610.26816v1#S3.SS2)

RadarStem 加入归一化距离与方位坐标，以 $1\times5$ 和 $5\times1$ 方向卷积处理距离响应与方位拖影，再通过通道压缩和 SE 模块加权历史。首层 patch 从常规 $7\times7$ 改为 $3\times7$，步幅从 $4\times4$ 改为 $2\times4$，尽量保住方位细节。轴向注意力分别沿方位和距离计算，再相加：方位方向循环 padding，距离方向补零。

这一边界设计有一个实际近似：对完整扫描，0° 与 360° 相邻；对中间的局部扇区，其上下边缘并不真的相邻。论文在 Polar Mix-FFN 说明中明确承认，对这些扇区使用循环 padding 是简化处理。因而切片边界附近是否产生错误连接，是值得单列的测试。[§III-B4](https://arxiv.org/html/2610.26816v1#S3.SS2.SSS4)

### 分别训练语义与全景输出

语义分支用 All-MLP 解码器汇合多尺度特征。全景分支用 FPN、Mask R-CNN 的 thing 实例头及语义分支，再合并两类预测。原式 (1)–(2) 为：

$$
\mathcal L_{\mathrm{sem}}=\alpha\mathcal L_{\mathrm{CE}}+\beta\mathcal L_{\mathrm{Dice}},\qquad
\mathcal L_{\mathrm{pan}}=\mathcal L^{\mathrm{sem}}_{\mathrm{CE}}+\mathcal L^{\mathrm{inst}}_{\mathrm{CE}}+\mathcal L_{L_1}.
$$

前者用类别加权交叉熵与 Dice，实验取 $\alpha=1,\beta=3$；后者分别监督像素语义、实例框分类/掩码和框回归。这里没有跨帧身份关联损失，全景分割的实例输出不能直接等同稳定的物体跟踪。LiDAR 教师只用于构造监督，雷达网络推理不需要实时输入 LiDAR。

## 关键图与可视化结果

![原论文图 1：LiDAR 补全提供伪标签，雷达扇区网络预测语义与实例](../../assets/papers/streamrps-streaming-radar-panoptic-figure-1.png)

上排蓝色 Scene completion 来自 LiDAR，箭头经损失连接到下排雷达预测；下排的红色横带表示按方位组织的相邻扇区。图中两条路径分别是离线监督制备和雷达预测，不能把它读成部署时的实时 LiDAR–radar 特征融合。[原图 1](https://arxiv.org/html/2610.26816v1#S1.F1)

![原论文图 2：伪标签投影、旋转增强、RadarStem 与分割解码器](../../assets/papers/streamrps-streaming-radar-panoptic-figure-2.png)

上排从三维补全 $U$ 压缩到 BEV，再依时间和坐标映射到极坐标标签；下排显示雷达片段、位置通道和编码器。右侧两个绿色模块分别输出语义与实例，损失连接也不同。图中的位置与标签变换说明，教师的三维输出最后被用于二维雷达网格任务。[原图 2](https://arxiv.org/html/2610.26816v1#S3.F2)

## 实验结论与证据

### 两套标签和两种速度不要混在一起

SAX 含 20,875 圈雷达，Boreas 选用四天、16,450 圈，后者天气为中等至良好。各自按不同时空区域划分 70%/15%/15% 训练、验证、测试，保留 $400\times1024$ 距离—方位网格；裁去更远部分，因为教师标签覆盖有限。SAX 为 12 类，Boreas 为 8 类，后者合并了受跨传感器 LiDAR 预测误差影响的类别。模型用 AdamW、batch size 16、80k iterations 训练。[§IV-A/B](https://arxiv.org/html/2610.26816v1#S4.SS1)

常规主表按稠密自动标签评价。另有人工标注的 350 帧 LiDAR 经标定投影得到 100 圈 SAX 雷达，用于独立于教师预测的检验；它仍不是对每个雷达回波逐像素独立确认的标签。mIoU 越高表示语义分类更准，PQ 同时要求实例识别和分割质量。

| 原表与 SAX 设置 | 方法或训练标签 | mIoU ↑（%） | 网络吞吐 ↑（FPS） |
| --- | --- | ---: | ---: |
| 表 III，完整一圈，稠密自动标签测试 | StreamRPS | 34.35 | 130.8 |
| 表 III，四扇区，同一测试标签 | StreamRPS | 34.33 | 421.9 |
| 表 III，四扇区，同一测试标签 | SegFormer | 30.24 | 782.3 |
| 表 IV，四扇区，人工标签测试 | PaSCo 稠密监督训练 | 30.22 | 未在此表重测 |
| 表 IV，四扇区，人工标签测试 | WaffleIron 稀疏监督训练 | 28.76 | 未在此表重测 |

人工标签对照的收益是 1.46 个百分点，支持稠密教师监督在该样本中有用；不能把自动标签上的 34.33% 当成人工标签上的结果。SegFormer 的扇区吞吐更高，StreamRPS 以计算代价换来约 4.09 点的 mIoU 收益，不能概括成所有条件下精度与速度同时最优。

计时在 RTX 2080 Ti 上用 TensorRT，只测网络、排除传感器 I/O 和前后处理。四扇区网络的 P50/P99 为 2.44/2.48 ms，显存 74 MiB。4 Hz 雷达每圈切四片，名义上每秒到达 16 个扇区；421.9 FPS 说明网络能赶上这一输入速率，并不把传感器刷新率提高到 421.9 Hz。[§IV-D、表 III](https://arxiv.org/html/2610.26816v1#S4.SS4)

### 小物体、实例指标和消融

SAX 完整扫描中，StreamRPS 的小物体组 IoU 为 7.64%，低于 Mask2Former 的 8.33%；Boreas 为 4.34%。大多数方法的小物体得分都不到 10%，说明更好的背景分割尚未解决细小交通参与者识别。[表 I](https://arxiv.org/html/2610.26816v1#S3.T1)

全景分割并非四个设置全胜：SAX 完整扫描 PQ 为 13.37，低于 Mask2Former 的 15.45；四扇区为 15.43，高于其 14.40。作者指出，切片会把 stuff 区域拆成更小、较容易匹配的部分，造成 PQ 上升而不一定改善真实分割。因此同一扇区设置内比较方法更有意义，不能仅凭“完整扫描到四扇区”的 PQ 增量声称实例质量提高。[表 II、§IV-C](https://arxiv.org/html/2610.26816v1#S4.SS3)

SAX 完整扫描的逐步消融从 SegFormer 的 30.88% 开始，简单叠三帧为 30.84%，加 RadarStem 为 31.61%，加旋转增强为 33.32%，矩形 patch 为 34.03%，轴向注意力为 34.35%。直接增加历史并未带来收益，增益依赖历史处理和几何设计。时间窗口单帧、三帧、五帧分别为 32.05%、34.35%、33.04%，更多历史也并非越好。论文未给多次训练方差。[表 V–VI](https://arxiv.org/html/2610.26816v1#S4.SS5)

## 应用场景与启发

如果系统希望在雷达转完一圈前收到局部道路或车辆分割，按扇区处理比仅提高整圈网络 FPS 更直接。真正需要测的是从该区域被扫描到标签可用的时间，以及目标跨扇区时是否被截断或重复，而不是仅用网络吞吐代表时效性。

教师补全也是一条可借鉴的监督路线，但应像本文一样保留独立人工参照。对低频小目标，教师生成、连通域过滤和网络分类可能分别造成漏检；把这三个环节拆开，比继续在总 mIoU 上优化更容易定位问题。

## 局限与阅读风险

Boreas 的定量数据来自中等至良好天气，恶劣天气只给出补充定性示例。雷达硬件在天气上的优势不等于本文分割网络已通过雨雪性能验证。PaSCo 从 SemanticKITTI 迁移时还涉及不同 LiDAR 强度分布；作者对 Boreas 做了强度归一化和类别合并，这些处理会限制标签的可比范围。

稠密自动标签、少量人工投影标签和局部扇区 PQ 各有适用范围；现有实验没有报告全流程实时负载、跨扇区持续实例 ID 或检测到规划的闭环影响。它们是后续使用需要补测的项目，不应由当前分割结果代替。

## 后续跟进

### 最小验证与停止条件

- 代码：2026-10-23 核对[官方 StreamRPS 仓库](https://github.com/robot-learning-freiburg/StreamRPS)，目录只有一个 13 字节 `readme.md`，暂无可检查的训练或推理实现。论文写明代码与训练模型计划录用后发布。
- 数据：论文使用 SAX、Boreas，并新建 SAX 的 350 帧 LiDAR / 100 圈雷达人工标签；当前官方仓库没有新标签文件。原始传感器数据与本文生成的语义/实例标签需要分别准备。
- 配置与权重：固定稿给出网络、训练和切片设置，官方占位仓库尚无运行配置或 checkpoint；当前不能直接复测表 III 的 TensorRT 吞吐。
- 最小实验：实现及标签齐备后，固定 SAX split、三帧历史、训练预算和 TensorRT 环境，对完整扫描、四扇区、八扇区测端到端 P50/P95 时延。按小物体、扇区中部和边缘分组，在人工标签上报告 mIoU、PQ、漏检，并比较循环 padding 与保留真实相邻扇区上下文。
- 成功信号：扇区模式缩短实际感知延迟，同时小物体召回与边缘实例一致性保持；教师稠密化的收益在人工参照上复现，才支持接入实时系统。
- 停止或转向条件：若收益只出现在伪标签或切片 PQ，应先修评价；若中部边缘因循环 padding 稳定误连，先调整上下文传递；若小物体在标签生成阶段已消失，网络改造应后移。

### 来源与核验记录

依据 [arXiv:2610.26816v1](https://arxiv.org/abs/2610.26816v1)，提交于 2026-10-19，核验于 2026-10-23，按预印本收录。PDF 首页确认 Santosh Parit、Julia Hindel、Rohit Mohan、Abhinav Valada 为弗赖堡大学，Georgi Pramatarov、Paul Newman、Daniele De Martini 为牛津大学。

实际阅读 §III、§IV-A–F、§V，核对式 (1)–(2)、表 I–VI，以及固定官方图 1、2 的真实文件。相关比较另读 RSS-Net §III–IV 与 PaSCo §3.1–3.2；原始来源、仓库状态及图片指纹记录在本期作者证据。未运行第三方实现、生成新伪标签或复现论文数值。
