---
{
  "id": "driveoss-open-set-anomaly-benchmark",
  "tag": "lidar-anomaly-segmentation",
  "tags": ["lidar-anomaly-segmentation", "autonomous-driving-testing"],
  "title": "DriveOSS: Dataset and Benchmark for 3D Anomaly Segmentation and Open-set Semantic Segmentation in Autonomous Driving",
  "source": "WACV 2027 已录用，依据 arXiv comments 与作者仓库，正式论文集页未核实 / arXiv:2610.32612v1 / https://arxiv.org/abs/2610.32612v1 / 固定全文 https://arxiv.org/html/2610.32612v1 / 仓库 https://github.com/chrisyan/DriveOSS",
  "authors": ["Zhiran Yan", "Savankumar Bhanderi", "Sourabh Lolge", "Rui Song", "Girdharbhai Paneliya", "Shiva Agrawal", "Gordon Elger"],
  "affiliations": ["Technische Hochschule Ingolstadt", "University of California, Los Angeles"],
  "comment": "DriveOSS 在多天气真实点云中保留 19 类已知语义与未知障碍标签，将异常排序和阈值化开放集分割分开评价。基线揭示高 AP 仍可能伴随大量误报；代码与配置已公开，数据和权重仍待发布。"
}
---

## 一句话定位

DriveOSS 将道路三维异常检测的问题推进到“找出未知物体后，已知类别还能分对多少”：52 段真实序列覆盖晴天、夜间、阴天、雨雪，既保留异常标签，也保留已知类别的逐点语义。LIDO 在本基准上取得 91.70% AUROC，但固定验证阈值后的未知类 IoU 只有 1.07%，已知类 mOpen-IoU 为 22.98%。排序能力、误报代价和最终分割质量需要分别看。[§3–5、表 5–6](https://arxiv.org/html/2610.32612v1#S5.T5)

## 论文要解决的问题

### 检出未知物体时保留已知语义

闭集分割器必须把每个点分配给既定类别，路面上的折叠椅或垃圾桶因此可能被判成植被。只输出异常分数又无法回答另一个问题：将高分点拒识后，是否把大量道路、行人和车辆也变成了未知类？DriveOSS 在同一场景上保留三种评价：19 类闭集语义分割、ID/OOD 二分类排序，以及 19 类已知语义加一个 outlier 类的开放集分割。[§4](https://arxiv.org/html/2610.32612v1#S4)

这里的未知物体有明确的标注边界：不属于 19 个评测类别、位于可行驶表面或紧邻路缘并构成潜在通行风险的物理障碍标成 outlier；固定的路外设施可归入 other-object，并与 other-structure、unlabeled 一起忽略。它不是对所有不常见物体或异常驾驶行为的穷举定义。[§3.2](https://arxiv.org/html/2610.32612v1#S3.SS2)

### 与 STU、NDP 和 LIDO 的关系

| 工作与一手来源 | 任务或机制 | DriveOSS 增加的内容与比较条件 |
| --- | --- | --- |
| Nekrasov 等，STU，CVPR 2025；[原文 §3](https://openaccess.thecvf.com/content/CVPR2025/papers/Nekrasov_Spotting_the_Unexpected_STU_A_3D_LiDAR_Dataset_for_Anomaly_CVPR_2025_paper.pdf#page=4) | 真实道路未知障碍；异常序列使用 inlier、outlier、unlabeled 标签，并保留实例身份；原文评价限制在 50 m 内，关注超过五个点的异常实例 | 新数据扩展天气与照明，并在 OOD 场景保留已知类别细分标签，支持联合分割评价。不能把两个数据集的点级 AP 当同一测试集排名 |
| Li 等，NDP，CVPR 2026；[原文 §3.3–3.5、表 2](https://openaccess.thecvf.com/content/CVPR2026/papers/Li_Neural_Distribution_Prior_for_LiDAR_Out-of-Distribution_Detection_CVPR_2026_paper.pdf#page=4) | 学习 logit 分布先验来重加权异常分数；训练包含 Perlin Raise 合成 OOD 与 void 区域软监督；STU test 的 NDP-EE AP 为 61.31% | 本文没有给出 NDP 的 DriveOSS 实验。加入比较时需要单列合成 OOD 和 void 监督，不能用 STU 的 61.31% 对照这里的 AP 推断退步幅度 |
| Mosco 等，LIDO，CVPR 2026；[原文 §3–4](https://openaccess.thecvf.com/content/CVPR2026/papers/Mosco_Learning_to_Identify_Out-of-Distribution_Objects_for_3D_LiDAR_Anomaly_Segmentation_CVPR_2026_paper.pdf#page=3) | 语义原型与对比特征分支共同打分；原方法不使用 void 区域学习异常。另提供将 ModelNet 物体插入真实扫描的混合数据集 | DriveOSS 在统一的 ID 数据上重新训练 LIDO，再测试真实多天气障碍；该结果与 LIDO 原论文的混合数据集、STU 结果属于不同协议 |

三篇原文分别提供了真实障碍、带辅助 OOD 监督的方法和 ID 特征建模的参照。DriveOSS 的价值在于补上联合标签与天气条件；目前的低分还不能回答这些方法在统一训练、统一阈值下的相对上限。

## 方法和系统设计

### 采集、标注与四种划分

采集平台包括一台 Ouster OS1-128 LiDAR、六台环视 RGB 相机与 GPS/IMU。LiDAR 原始频率为 20 Hz，相机为 10 Hz；发布样本以图像时间为参考匹配最近的点云和惯导读数，得到 10 Hz 的同步数据，共 12,661 帧点云与 75,966 张图像。[§3.1、§3.3、附录 A](https://arxiv.org/html/2610.32612v1#S3.SS3)

| 划分 | 序列数 | 点云帧数 | 用途 |
| --- | ---: | ---: | --- |
| DriveOSS-ID train | 9 | 2,240 | 已知类别训练 |
| DriveOSS-ID validation | 10 | 2,384 | 闭集验证 |
| DriveOSS-OOD validation | 17 | 4,278 | 异常评价与开放集阈值校准 |
| DriveOSS-OOD test | 16 | 3,759 | 最终评价 |

四个划分均含五类环境条件。ID 与 OOD 采集路线不重叠，OOD validation 与 test 也在地理上分离。原始标注有 32 个标签，经动态类别合并与忽略映射后得到 19 个 ID 类和 outlier。初始已知语义由 SemanticKITTI 预训练的 Mask4Former 提供，KISS-ICP 配准帮助跨帧查看；未知物体人工标注，每段序列至少由另一位标注者复查。[表 3、附录 D、I](https://arxiv.org/html/2610.32612v1#A9)

### 阈值怎样改变语义分割

每个点先得到闭集预测 $\hat y_i^{\mathrm{cls}}$ 和异常分数 $s_i$。分数越高越倾向 OOD。论文在 OOD validation 上选取使 OOD 真阳性率达到 95% 的阈值 $\tau_{95}^{\mathrm{val}}$，然后将它固定用于 test。附录式 S4 可写为：

$$
\hat y_i^{\mathrm{open}}=
\begin{cases}
20,&s_i>\tau_{95}^{\mathrm{val}},\\
\hat y_i^{\mathrm{cls}},&s_i\leq\tau_{95}^{\mathrm{val}}.
\end{cases}
$$

这里用 1–19 表示已知类、20 表示 outlier，便于说明；实际脚本有独立的内部标签映射。**OOD 样本不参与网络训练，但带 OOD 标签的验证集参与阈值选择**。因此，整个评价流程仍需异常验证数据。[§5.1、附录 B.3](https://arxiv.org/html/2610.32612v1#A2.SS3)

开放集预测的混淆矩阵包含未知类，已知点被拒成未知会增加其原类别的假阴性，未知点被误分到某个已知类则增加该类的假阳性。附录式 S5–S6 定义：

$$
\mathrm{openIoU}_k=
\frac{\mathrm{TP}_k}{\mathrm{TP}_k+\mathrm{FP}^{\mathrm{ow}}_k+\mathrm{FN}^{\mathrm{ow}}_k},
\qquad
\mathrm{mOpenIoU}=\frac{1}{19}\sum_{k=1}^{19}\mathrm{openIoU}_k.
$$

均值只覆盖 **19 个 ID 类**；outlier IoU 单独报告，不能把 mOpen-IoU 叫作含未知类的 20 类平均值。此外，表 5 的 test FPR@95 是在测试分数曲线上寻找 95% OOD 召回点，表 6 则使用固定的验证阈值，两者的工作点不必相同。

### 基线训练和融合输入

训练数据并非仅有 2,240 帧 DriveOSS-ID：所有基线还使用 SemanticKITTI 和 Panoptic-CUDAL 的训练划分，统一映射到 19 类。P3Former、LCPS、M4F3D 与 LIDO 分别训练 36、30、30、64 个 epoch，batch size 等设置也不同，因此跨架构结果不属于严格同计算预算比较。[§5.1、附录 D](https://arxiv.org/html/2610.32612v1#A4)

虽然数据采集使用六相机，本轮 LCPS 与 M4F3D* 融合基线仅输入一张前视图。M4F3D* 保留稀疏点云骨干，在每层解码器的 LiDAR cross-attention 后加入相机 cross-attention，再接 self-attention 与前馈网络。图像由 ResNet-18 提取为 tokens，查询承担跨模态交互，不要求逐点投影。这是一种具体的轻量融合实现，不能代表所有环视或几何对齐融合方法。[附录 C–D](https://arxiv.org/html/2610.32612v1#A3)

## 关键图与可视化结果

![原论文图 1：多天气 ID 与 OOD 场景，以及闭集、异常和开放集分割的区别](../../assets/papers/driveoss-open-set-anomaly-benchmark-figure-1.png)

图 1 上半部区分正常场景与放置未知障碍的场景；下半部在同一段道路上展示三种任务。闭集预测把障碍归入已有语义，异常标签仅区分已知与未知，开放集标签则保留周围物体类别。图中文字的 32 类对应原始标注空间，表格评价使用的是合并后的 19 个 ID 类。红框是示例障碍的位置，不是算法检测框。[官方图 1](https://arxiv.org/html/2610.32612v1#S1.F1)

![原论文图 S4：已知语义的自动预标注与人工修订后的标签对照](../../assets/papers/driveoss-open-set-anomaly-benchmark-figure-s4.png)

图 S4 从左至右是 RGB、自动预标注和最终人工标签，三行依次取自 ID、OOD validation 和 OOD test。可以看到地面边界、植被内部噪点与未知障碍被重新整理。它说明标注流程确实包含人工修订；标注偏差是否完全消除仍需抽样复审，不能仅凭预标注骨干的最终分数较低来判断。[官方图 S4、附录 I](https://arxiv.org/html/2610.32612v1#A9.F4)

## 实验结论与证据

### 排序较好仍可能无法保住已知类别

下表摘录同一 DriveOSS-OOD test 上的结果，数值均为百分数。前三列来自表 5，后两列来自表 6；阈值选择方式按前文区分。[表 5–6](https://arxiv.org/html/2610.32612v1#S5.T6)

| 方法 | AUROC ↑ | FPR@95 ↓ | AP ↑ | ID mOpen-IoU ↑ | outlier IoU ↑ |
| --- | ---: | ---: | ---: | ---: | ---: |
| P3Former + RbA | 89.80 | 45.94 | 3.53 | 8.36 | 0.51 |
| LCPS-lidar + Entropy | 79.76 | 46.95 | 1.38 | 20.75 | 0.61 |
| M4F3D + RbA | 67.91 | 100.00 | 12.57 | 9.58 | 0.32 |
| LIDO | 91.70 | 32.66 | 4.44 | 22.98 | 1.07 |
| M4F3D* + RbA | 45.43 | 100.00 | 5.79 | 11.27 | 0.21 |

M4F3D + RbA 的 AP 最高，但在 test 曲线上追求 95% OOD 召回时，ID 误报率达到 100%。LIDO 的排序和高召回工作点更均衡，其闭集 OOD-test mIoU 仍从 40.99% 降到开放集的 22.98%，相差 **18.01 个百分点**。这一差值反映拒识后已知语义受到的损失；未知类本身仍须看单列的 1.07% IoU。

### 融合收益随任务和阈值改变

M4F3D* 相比 M4F3D，在 ID validation 的闭集 mIoU 从 34.98% 升到 48.44%，而 OOD test 从 31.11% 降到 28.46%。同样使用 RbA 时，融合后 AP 从 12.57% 降到 5.79%，mOpen-IoU 却从 9.58% 升到 11.27%，同时 outlier IoU 从 0.32% 降到 0.21%。因此，已知类别均值提高并不必然意味着未知障碍分割改善。[表 4–6](https://arxiv.org/html/2610.32612v1#S5.T4)

单 RTX 4090 上，LIDO 的联合语义与异常推理为 68.01 ms/帧；M4F3D 和 M4F3D* 的分割网络分别为 104.21 和 106.35 ms，增加相机约 2.14 ms；后处理异常打分最多增加 0.25 ms。它们是表 7 的网络与打分计时，不包含数据采集、传输或完整车辆软件链路。[表 7](https://arxiv.org/html/2610.32612v1#S5.T7)

### 公开评价代码还规定了哪些过滤

检查官方仓库固定提交 `3ec53dc85cedfeca021bfb9c4cc4ad6337db2390` 的 [评价脚本](https://github.com/chrisyan/DriveOSS/blob/3ec53dc85cedfeca021bfb9c4cc4ad6337db2390/evaluate_multi_sequence_openset.py) 可见：默认距离为 2.5–50 m；异常指标计算在有效 OOD 点少于 5 时跳过整帧，闭集与开放集混淆矩阵的路径则没有这项整帧过滤。这与 STU 原文描述的异常实例点数限制也不是同一个筛选单位。

这些是当前代码的默认行为，论文没有逐表公开完整运行命令，尚不能确认每张表采用了哪些覆盖参数。复现时应同时保存距离范围、保留帧数和点数。尤其不能把这种按真值异常点数筛选的 AP/FPR，直接解释成完整无异常路段上的长期误报水平。

## 应用场景与启发

对 STU 方向而言，DriveOSS 提供了一个具体的补充问题：当天气改变点云回波和图像外观时，同一个拒识阈值能否既保留道路与行人，又识别小障碍？这里需要联合观察已知类损失、未知类 IoU 和不同天气的误报，而不只是继续提高一个平均 AP。

一个值得检验的假设是：跨时间一致性可能降低正常路面上的偶发高分，但也可能抹去刚进入视野的小障碍。数据含连续序列，当前论文基线按单帧评价，适合用固定底座隔离时间聚合的作用。首先需要在无真值筛帧的完整序列上同时记录误报与首次发现延迟，才能判断平滑带来的收益是否值得。

## 局限与阅读风险

数据覆盖五类环境，但传感器配置固定；地理划分能够减少位置记忆，并不等于跨设备或跨城市泛化已经验证。标注还使用基于位置与风险的 outlier 定义，远处固定设施被忽略的规则会改变实际评测总体。

公开基线的训练预算不同，没有加入 NDP 等辅助 OOD 训练方法的统一重跑，也未报告多 seed 或序列重采样区间。目前的融合退步只针对给定骨干、单前视输入及训练设置。时序方法、开放集占据以及下游制动效用仍是待验证方向。

数据与权重未发布是当前复跑的直接限制。仓库 README 的手写验证命令还遗漏序列 466，而配套 17 序列脚本与论文附录 D 包含它；复现应逐项核对序列清单，不能直接复制示例命令后把结果视作完整验证集。

## 后续跟进

### 资源与最小验证

- **代码与配置**：2026-10-28 已查看完整官方仓库树，含 P3Former、LCPS、M4F3D、融合变体、配置和评价脚本；未见 LIDO 的本基准专用子目录。源码存在不等于已验证能够运行。
- **数据与权重**：[官方 README](https://github.com/chrisyan/DriveOSS#dataset-and-pre-trained-models-download) 明示两者仍待公开；OOD test 标签不公开，README 描述由作者代评、将来提供评价服务。当前无法自行核对完整 test 标签与计分。
- **最小实验**：资源齐备后，冻结一个 LiDAR 底座，对比原始分数与仅使用过去帧的简单时间聚合；固定训练集和 OOD-val 阈值，分别统计官方过滤协议与完整序列协议下的 AP、固定阈值 FPR、outlier IoU、19 类 mOpen-IoU，以及近距离小物体首次发现延迟。
- **成功与停止条件**：若完整序列误报降低，同时小障碍召回、首次发现延迟和已知语义损失没有恶化，再检查不同天气。若收益仅出现在按真值筛选的帧中，或以延迟发现为代价，则不继续增加时间平滑复杂度，先分析分数校准与可见点数。

### 来源与核验记录

本报告依据 `2610.32612v1`，2026-10-28 阅读正文 §1–7 与附录 A–I，核对表 3–7、式 S4–S6、图 1 和 S4。作者单位由固定全文及作者仓库确认。WACV 2027 录用来自 arXiv comments 与官方仓库声明，本轮未找到对应 CVF 正式论文集页。

相关比较分别打开 STU 的 CVPR 2025 原文 §3、NDP 的 CVPR 2026 原文 §3–4 与 LIDO 的 CVPR 2026 原文 §3–4；代码检查以仓库固定提交为准。已逐张打开上述官方原图，未下载完整数据、训练模型或复现论文指标。
