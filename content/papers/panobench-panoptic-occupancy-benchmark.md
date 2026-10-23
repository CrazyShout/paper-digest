---
{
  "id": "panobench-panoptic-occupancy-benchmark",
  "tag": "dynamic-scene-representation",
  "tags": ["dynamic-scene-representation", "autonomous-driving-testing", "world-models"],
  "title": "PanoBench: A Panoptic Occupancy Prediction Benchmark for Autonomous Driving",
  "source": "arXiv:2610.23537v1 / https://arxiv.org/abs/2610.23537v1 / 固定全文：https://arxiv.org/html/2610.23537v1 / 预印本 / 项目：https://mias.group/PanoBench/ / 仓库：https://github.com/fengyi233/PanoBench",
  "authors": ["Yi Feng", "Zizhan Guo", "Junwu E", "Yu Ma", "Mengtan Zhang", "Jin Wu", "Wei Ye", "Hanli Wang", "Qijun Chen", "Danwei Wang", "Rui Fan"],
  "affiliations": ["Tongji University", "University of Science and Technology Beijing", "Nanyang Technological University"],
  "comment": "PanoBench 把合成与真实驾驶数据统一为带实例身份的占据基准，并把历史中看见过的完整物体纳入评测。体积覆盖、首个表面精度和实例区分会给出不同排名，真实数据中的完整形状则依赖生成式重建。"
}
---

## 一句话定位

PanoBench 将 CarlaOcc、nuScenes 和 KITTI-360 整理为统一的全景占据基准：一个体素既有语义类别，也能归属到某辆车或某个行人；只要实例在历史窗口中曾被部分看见，其完整形状就进入评测。它最值得关注的是评测问题的变化——模型需要恢复被遮挡物体，而非仅拟合当前可见表面；相应地，体积 IoU、射线精度和实例指标不能相互替代。[§III-A/E、§IV-D](https://arxiv.org/html/2610.23537v1#S3.SS5)

## 论文要解决的问题

### 看见一部分之后，究竟要预测多少

语义占据能描述“这里有汽车”，却不能区分相邻汽车，也不直接检查遮挡前后是不是同一辆车。常见标签来自多帧 LiDAR，仍可能留下物体背面空洞；若评价又只覆盖当前可见体素，预测完整形状的收益便难以体现。

PanoBench 的预测输入是多相机 RGB、相机参数与自车位姿，输出是自车坐标系中的占据体素、语义和实例 ID。LiDAR、地图、3D 框和生成式形状模型用于离线制备监督，不是要求相机预测器在推理时再读取这些标签来源。合成分支能直接取得场景网格；真实分支只能重建形状，两者的几何证据强度不同。[§III](https://arxiv.org/html/2610.23537v1#S3)

### 相关工作与差异

| 工作与一手来源 | 已有机制 | PanoBench 改变的环节 |
| --- | --- | --- |
| Tian 等，Occ3D，NeurIPS 2023；[正式论文 §3.3](https://papers.nips.cc/paper_files/paper/2023/file/cabfaeecaae7d6540ee797a66f0130b0-Paper-Datasets_and_Benchmarks.pdf) | 分别累计动态物体和静态点云，通过网格重建补洞，并生成 LiDAR、相机可见性掩码及图像引导的修正标签。 | 扩展到持续的实例身份和完整前景资产，把时间窗口中的局部可见性提升为整实例评价。Occ3D 自身也有网格补全，不能简写成“只累计原始点”。 |
| Wang 等，PanoOcc，CVPR 2024；[正式论文 §3.2、§4.2](https://openaccess.thecvf.com/content/CVPR2024/papers/Wang_PanoOcc_Unified_Occupancy_Representation_for_Camera-based_3D_Panoptic_Segmentation_CVPR_2024_paper.pdf) | 用体素 query 汇聚多视角、历史帧特征，联合检测与语义分割，再形成全景预测；原文区分稀疏 LiDAR 点上的全景评价与稠密占据评价。 | 提供跨合成与真实域的完整实例标签和统一掩码，属于基准与监督设计。本文表 VIII–X 的重训结果来自另一组列明的模型，并非对 PanoOcc 原分数的直接复测。 |

## 方法和系统设计

### 背景由观测补齐，前景由网格资产实例化

真实数据先移除 LiDAR 中的前景点，按自车位姿累计静态背景。道路等平面区域用 HD map 多边形限制水平范围，用邻近 LiDAR 的加权局部曲面估计高度；地图里的小空洞再经过连通性检查和薄板样条插值修补。非平面结构做统计滤波，并支持人工局部校订。这些步骤把“有测量支持的表面”和“依据地图连续性补出的区域”合在一起。[§III-D1](https://arxiv.org/html/2610.23537v1#S3.SS4.SSS1)

前景采取另一条路线：沿物体轨迹搜集多帧、多视角图像裁剪，按清晰度、前景覆盖和遮挡情况筛选，再用生成式 3D 模型构造完整网格。多视图默认使用 MV-SAM3D，仅剩单视图时回退 SAM 3D。网格池按类别组织，用归一化表面的 Chamfer 距离去除近似重复、保留形状差异。一个实例优先用自己的网格，缺失时检索同细分类或上位类别中尺寸比例接近的原型，再按标注框缩放、放置。[§III-D2](https://arxiv.org/html/2610.23537v1#S3.SS4.SSS2)

因此，真实数据中一辆被遮挡的汽车背面可能来自形状先验或另一实例的原型，而不是该车辆背面的实际测量。最后把背景和前景统一体素化，用类别与高度优先级处理重叠，保留实例 ID 随时间的对应关系。CARLA 分支则从仿真网格取得完整几何；其可用于检验补全误差的参照条件更直接。

### 掩码决定模型需要承担的补全任务

原式 (2)–(3) 将每帧标签表示成稀疏集合：

$$
\mathcal V_t=\{(v_{t,n},c_{t,n},i_{t,n})\}_{n=1}^{N_t},\qquad p_{t,n}=\beta c_{t,n}+i_{t,n}.
$$

$v$ 是整数体素坐标，$c$ 为语义类别，$i$ 为实例身份；道路等 stuff 类的 $i=0$，可数物体 thing 使用正 ID，$\beta$ 大于最大实例 ID。文件只保存占据体素、压缩后的稠密有效掩码及网格元信息，减少空体素带来的存储开销。

关键规则在式 (10)–(11)。用 $\chi_\tau^k(v)$ 表示体素 $v$ 是否被时间 $\tau$ 的相机 $k$ 看见：

$$
\chi_t(v)=1-\prod_{\tau=t-T+1}^{t}\prod_{k=1}^{K}(1-\chi_\tau^k(v)),\qquad
M_t^{\mathrm{th}}(v)=\mathbb I[\exists u\in Q_{t,j}:\chi_t(u)=1],\quad v\in Q_{t,j}.
$$

第一式是时间与相机之间的可见性并集；第二式把它提升到实例集合 $Q_{t,j}$：只要该物体有一个体素得到历史观测支持，整实例都有效。例如，卡车移走前曾露出一部分的行人，即使当前被挡住，模型仍需恢复它的形状和身份。这个规则定义的是补全任务，不声称所有纳入评价的体素都被直接观察过。[§III-E](https://arxiv.org/html/2610.23537v1#S3.SS5)

式 (12)–(13) 对 stuff 保留逐体素可见性，对 free space 保留相机射线到首个占据点之前的空体素，再取三者并集：$M_t=M_t^{\mathrm{th}}\lor M_t^{\mathrm{st}}\lor M_t^{\mathrm{free}}$。计算 stuff 可见性时不让前景物体遮挡背景，避免车辆下方和后方的道路被切成碎片。它并非把整个未观测空间都计入评价。

### 统一设置仍保留了历史输入差异

三套数据合计 963 段序列、214,622 帧；nuScenes 为 850 场景、34,149 帧，KITTI-360 为 9 序列、76,473 帧，CarlaOcc 为 104 序列、104,000 帧。默认预测实验分别用 nuScenes 的 0.4 m 环视、KITTI-360 的 0.2 m 前视和 CarlaOcc 的 0.4 m 环视配置。训练统一为八张 RTX 4090、AdamW、初始学习率 $2\times10^{-4}$、20 epochs；时序方法用包含当前帧的八帧，单帧架构只用当前帧。这是共享协议下的系统比较，不能归因成只改网络结构的等输入消融。[表 I、§IV-A](https://arxiv.org/html/2610.23537v1#S4.SS1)

## 关键图与可视化结果

![原论文图 2：背景恢复、前景网格生成及全景体素融合](../../assets/papers/panobench-panoptic-occupancy-benchmark-figure-2.png)

上排蓝色区域从 LiDAR、地图逐步恢复背景；下排橙色区域从实例图像筛选、生成网格，再回退到原型检索；右侧紫色区域将二者放进共同坐标系。下排“Own Mesh / Subcategory / Superclass”的顺序尤其重要：完整前景并不总来自同一物体的重建。[原图 2](https://arxiv.org/html/2610.23537v1#S3.F2)

![原论文图 3：单帧可见掩码与时序实例掩码的比较](../../assets/papers/panobench-panoptic-occupancy-benchmark-figure-3.png)

上排三个编号分别对应历史看见后被挡住的实例、部分可见但整体验证的实例，以及前景后面的背景。下排从左到右是射线掩码结果、完整网格真值、新掩码结果；新掩码比单帧掩码保留更多连续结构，也仍小于中间的完整世界。这幅图解释评价范围，不是某个预测网络的定性成绩。[原图 3](https://arxiv.org/html/2610.23537v1#S3.F3)

## 实验结论与证据

### 完整性和可见表面精度会交换排名

IoU 衡量体积重合，mIoU 对语义类别平均；RayIoU 检查相机射线上首个占据表面，在 1、2、4 m 深度容差下统计；RayPQ 还要求正确的实例匹配。几何、类别和身份解决的是三个不同问题。[§IV-A2/D](https://arxiv.org/html/2610.23537v1#S4.SS4)

| 原表与设置 | 方法 | IoU ↑（%） | mIoU ↑（%） | RayIoU@1 / RayPQ@1 ↑（%） |
| --- | --- | ---: | ---: | --- |
| 表 VIII，KITTI-360，0.2 m 前视 | GaussianFormer | 65.3 | 15.6 | 21.1 / 未列 |
| 表 VIII–IX，同上 | SparseOcc | 33.3 | 11.2 | 28.1 / 12.7 |
| 表 VIII–IX，同上 | Panoptic-FlashOcc | 41.7 | 11.5 | 18.8 / 7.2 |
| 表 VIII–IX，nuScenes，0.4 m 环视 | SparseOcc | 55.0 | 33.0 | 33.7 / 11.2 |
| 表 VIII–IX，同上 | Panoptic-FlashOcc | 47.7 | 22.6 | 25.2 / 3.2 |

KITTI-360 上 GaussianFormer 的 IoU 高出 SparseOcc 32.0 点，RayIoU@1 却低 7.0 点。较密的预测更容易填完整体积，也可能把表面向相机方向扩张；较稀疏的预测可以更准地定位首个表面，却遗漏背面。这是论文结合表示方式给出的解释，表格本身只直接显示两种指标的取舍。Panoptic-FlashOcc 与 SparseOcc 的差距进一步说明，体积更完整并不自动带来更好的实例区分。

### 标签消融与跨域负结果

nuScenes 背景的投影语义像素准确率，从仅累计 LiDAR 的 68.5% 经地图抬升增至 74.1%，补平面空洞后为 79.0%，再做非平面修正为 79.4%。这项指标检查投影与图像语义的一致性，不足以单独验证所有遮挡表面的三维真实性。CARLA 有网格参照，前景实例 IoU 从 LiDAR 累计的 12.4% 增至带视图筛选的 MV-SAM3D 的 67.2%；该数值应保留在合成域，不能直接当作真实车辆形状精度。[表 VI–VII](https://arxiv.org/html/2610.23537v1#S4.SS3)

合成预训练的收益也不是所有指标都同向：SparseOcc 迁移到 KITTI-360 后，mIoU 从 11.2% 到 11.8%，RayIoU 从 31.2% 到 31.9%，但 RayPQ 从 15.4% 降到 15.2%；后两者取三个深度容差的平均。表 X 中 SparseWorld-TC 在 nuScenes 的未来 1–3 秒平均 mIoU 为 22.8%，略低于 SparseWorld 的 23.1%，尽管它在另外两个域更好。论文未给这些小幅差异的多次训练方差。[表 X、XII](https://arxiv.org/html/2610.23537v1#S4.SS5)

## 应用场景与启发

这个基准适合检验遮挡后保持实例、物体完整性和未来占据，而不只是把原有 mIoU 再提高一点。尤其对动态场景表示，若时序记忆能保住一辆被大车短暂遮挡的小车，新掩码会让这个能力真正进入分数。

也可以用它拆开两种常混在一起的错误：表面预测向前扩张，以及完整实例漏掉背面。前者会影响射线碰撞距离，后者会影响形状和遮挡推断；分别记录两者，才能判断需要改深度约束还是时序补全。把两类目标合成单一分数，反而可能掩盖研究问题。

## 局限与阅读风险

真实前景标签有生成先验、原型替换和标注框缩放，罕见形状可能被常见原型“标准化”；论文没有给每个真实实例的独立完整扫描参照。研究未知类别或异常形状时，应先检查它们是否在标签制备阶段被抹平。论文把开放类别列为未来工作，当前基准不是开放集异常检测标注。

统一训练预算没有消除一帧和八帧的输入差异，也没有让三个数据域的视角、体素大小和类别完全相同。表 VIII 的跨域排名变化是值得研究的现象，但不能单凭该表确定变化来自域差异、相机覆盖还是分辨率。

## 后续跟进

### 最小验证与停止条件

- 代码与配置：2026-10-23 核对[官方仓库](https://github.com/fengyi233/PanoBench)，已有训练、评测、可视化及五组模型目录；实际打开了 SparseOcc–nuScenes 配置。发布配置与论文表格仍需逐项对应，不能仅由文件存在推定复现完成。
- 数据与权重：[数据页](https://huggingface.co/datasets/fengyi233/PanoBench)可公开列出三个子集的归档；[模型页](https://huggingface.co/fengyi233/PanoBench)列出 14 个 `.pth` 文件，包含 SparseOcc、GaussianFormer、FlashOCC、OPUS 和 SparseWorld-TC 的部分组合。此次只核对文件列表与数据指南，未下载大归档或加载权重；真实数据仍需按指南准备原始图像与标定。
- 最小实验：固定 nuScenes 0.4 m、同一模型与八帧输入，单独改变评价掩码为当前可见和时序完整实例。按“当前可见”“历史可见但当前遮挡”分组，报告 IoU、RayIoU、RayPQ、实例漏检和前表面距离误差；再用一帧输入作信息量对照，保持训练预算相同。
- 成功信号：时序模型的增益集中在历史支持的遮挡实例，同时前表面误差和虚假占据不恶化，才支持时序记忆改善了完整场景表示。
- 停止或转向条件：若优势只来自原型填充，或对原型不匹配的真实物体持续失效，先单独审计标签和替换率；若 IoU 上升伴随 RayIoU 明显下降，应先约束表面位置。

### 来源与核验记录

依据 [arXiv:2610.23537v1](https://arxiv.org/abs/2610.23537v1)，提交于 2026-10-16，核验于 2026-10-23。报告按预印本收录，未把其前作 CarlaOcc 的 CVPR 2026 状态移用到本篇。实际阅读 §III-A–E、§IV-A/C/D/E、§V，核对表 I、VI–XII 与式 (2)–(13)；图 2、3 的官方文件均已打开检查。

作者和单位对应由[官方项目页](https://mias.group/PanoBench/)核实：Jin Wu 为北京科技大学，Danwei Wang 为南洋理工大学，其余列名作者为同济大学。相关比较另读 Occ3D 正式论文 §3.3、PanoOcc 正式论文 §3.2/4.2；原始 HTML、PDF、图像来源及 SHA-256 保存在本期作者证据记录中。未运行第三方代码或复现论文数值。
