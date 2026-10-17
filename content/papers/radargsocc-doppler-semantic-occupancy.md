---
{
  "id": "radargsocc-doppler-semantic-occupancy",
  "tag": "radar-occupancy-representation",
  "tags": ["radar-occupancy-representation", "dynamic-scene-representation"],
  "title": "RadarGSOcc: Doppler-Aware 3D Semantic Occupancy Prediction Using 4D Radar Tensor with Geometric-Semantic Feature Extraction",
  "source": "arXiv:2610.18686v1 / https://arxiv.org/abs/2610.18686v1 / 固定全文：https://arxiv.org/html/2610.18686v1 / 预印本，作者稿注明已投稿 IEEE",
  "authors": ["Christofel Rio Goenawan", "Dong-Hee Paek", "Seung-Hyun Kong"],
  "affiliations": ["Korea Advanced Institute of Science and Technology", "Korea University"],
  "comment": "RadarGSOcc 将雷达功率与 Doppler 特征分支融合，在 K-Radar 细粒度占据任务中改善大面积静态类别。车辆合并 IoU 低于 RadarOcc，雪天结果也只有分布一致性代理，适合研究雷达语义增益究竟落在哪些类别上。"
}
---

## 一句话定位

RadarGSOcc 用分支编码和可变形注意力处理 4D 雷达张量，并为 K-Radar 补充细粒度占据伪标签。三次训练的平均体素加权 mIoU 为 23.83%，高于重训 RadarOcc 的 20.93%；但汽车与卡车合并后的 IoU 在主表对应运行中从 6.5% 降至 2.6%。它展示了雷达静态场景语义的改善，也留下了车辆识别、伪标签质量和天气评测三个具体问题。[§IV-D1–2](https://arxiv.org/html/2610.18686v1#S4)

## 论文要解决的问题

### 保留下来的雷达信号，怎样变成语义占据

输入是当前帧按距离、方位、俯仰和 Doppler 速度组织的功率张量，输出是前方三维体素的空闲或语义类别。直接使用雷达点云会丢弃弱回波；保留张量又带来体积大、旁瓣噪声和角分辨率低的问题。Doppler 峰的位置能够提供径向运动线索，但把功率、峰索引和统计量送进同一个骨干，并不保证网络会有效利用它们。[§III-B](https://arxiv.org/html/2610.18686v1#S3)

另一个难点是标签。K-Radar 有原始张量及目标框，却没有本文所需的细粒度稠密占据标注。作者先用在 nuScenes 上训练的 OpenOccupancy LiDAR 模型生成单帧伪标签，再用 K-Radar 目标框修正框内体素类别。这样既能扩充监督，也会把跨数据集教师误差和框内填充误差带进训练与评价。

### 相关工作与差异

| 工作与一手来源 | 已有机制 | RadarGSOcc 的变化与比较边界 |
| --- | --- | --- |
| Ding 等，RadarOcc，NeurIPS 2024；[正式论文 §4.2–4.5](https://proceedings.neurips.cc/paper_files/paper/2024/file/b81d83165e3145a2e7d33bb5e33ea913-Paper-Conference.pdf) | 将 Doppler 峰值、索引及统计量压成描述符；逐距离保留强回波，在球坐标中编码，再聚合到笛卡尔体素。 | 沿用这条张量处理路径，改为有重叠通道的几何、语义分支，再用融合与占据头细化联合利用特征。本文 RadarOcc 数字来自新标签协议下的重训，与原论文表格分数不直接对比。 |
| Wang 等，OpenOccupancy，ICCV 2023；[正式论文 §3.2–3.4](https://openaccess.thecvf.com/content/ICCV2023/papers/Wang_OpenOccupancy_A_Large_Scale_Benchmark_for_Surrounding_Semantic_Occupancy_Perception_ICCV_2023_paper.pdf) | 在 nuScenes 中累计多帧 LiDAR，补充模型伪标签并人工净化，建立环视占据标注与多模态基线。 | 借用 LiDAR 教师生成 K-Radar 单帧标签，再以目标框修正；没有复用原基准约 4,000 人时的逐场景净化过程。标签来源及前方预测范围都改变了。 |

## 方法和系统设计

### 先压缩张量，再分支融合

每个空间位置保留 Doppler 维上最高的三个功率值及其索引，再附上该位置所有 Doppler bin 的功率均值和方差，形成八通道描述符；每个距离 bin 只保留功率较强的 250 个空间位置。这里的均值、方差是**功率沿 Doppler 维的统计量**，并非速度的均值、方差。[§III-B1、补充 S-II](https://arxiv.org/html/2610.18686v1#S2a)

两条稀疏卷积分支各自进行可变形自注意力。几何分支的 query 在语义分支中选择少量采样位置，经过交叉注意力和残差连接细化几何特征；随后拼接两分支，经特征金字塔进入占据头。占据头再以自身特征查询较早的几何特征，补充细节，最后把球坐标特征变换到笛卡尔坐标并分类。三类注意力均为八头、每个 query 八个采样点、一层；两分支各 96 维，拼接后为 192 维。[§III-B2–3、补充 S-III](https://arxiv.org/html/2610.18686v1#S3a)

比如，路边植被和前方车辆可能都产生强回波：功率分支提供位置与形状，Doppler 索引提供运动相关线索，融合模块决定从哪些局部位置补信息。不过，这些分支名称只是设计分工，不能视为已经证明几何与语义完全解耦。

### 三组关键关系

将原文式 (1)、(2)、(10) 改写为零起始通道索引记法：

$$
g=f_g(x_{0:6}),\qquad s=f_s(x_{3:8}),\qquad z=\operatorname{concat}(g_{\mathrm{refined}},s').
$$

$x$ 是八通道稀疏张量，$f_g,f_s$ 是各自的稀疏卷积编码器；$s'$ 经过分支内注意力，$g_{\mathrm{refined}}$ 还接受跨分支细化。索引 3–5 的三个 Doppler 峰索引同时进入两条分支，所以实际是六通道与五通道的重叠分组。图中的 Power / Doppler 简称不能理解成两组互斥输入。[式 (1)–(10)](https://arxiv.org/html/2610.18686v1#S3)

训练目标保留原文式 (16)：

$$
\mathcal L=\mathcal L_{\mathrm{CE}}+\mathcal L_{\mathrm{Lovasz}}+\mathcal L_{\mathrm{geo}}+\mathcal L_{\mathrm{sem}}+\mathcal L_{\mathrm{geo\text{-}feat}}.
$$

交叉熵和 Lovász-Softmax 监督体素分类，几何与类别 affinity 项约束占据及语义一致性；最后一项是几何分支的二元交叉熵，以伪标签的“占据／空闲”作为监督。五项等权。它们训练的是对构造标签的拟合，未直接校准真实道路上的未知类别或天气不确定性。[§III-C](https://arxiv.org/html/2610.18686v1#S3)

恶劣天气缺少逐帧标签，作者另定义 EBKL。用 $p_e$ 表示正常天气下环境类型 $e$ 的参考类别频率，用 $q_{e,w}$ 表示天气 $w$ 下预测的类别频率，原式 (18)–(19) 可简写为：

$$
\mathrm{EBKL}(e,w)=D_{\mathrm{KL}}(p_e\Vert q_{e,w})=\sum_{c\in\mathcal C_E}p_{e,c}\log\frac{p_{e,c}}{q_{e,w,c}}.
$$

两种频率在选定的稳定背景及常见车辆类别上重新归一化，预测频率加小常数防止零概率。分数越低，类别分布越接近正常参考；它不比较每个体素的位置与类别。一个无论输入如何都输出参考分布的退化预测器可以取得 EBKL 为零，因此该指标只能辅助观察分布变化。[§IV-B](https://arxiv.org/html/2610.18686v1#S4)

### 标签、训练与部署输入

标签合并 bus/truck、去掉 construction vehicle，最终有 **14 个语义类加 empty，共 15 类**。训练、测试分别为 5,910 和 1,781 帧，均来自正常天气的独立序列；伪标签置信阈值固定为 0.8。525 个非空体素人工抽查有 482 个正确，即 91.8%，其中 terrain 为 69.7%，汽车和卡车抽样量分别只有 16 和 5。[§III-A、补充表 S-I–IV](https://arxiv.org/html/2610.18686v1#S1a)

雷达模型训练 15 epochs，使用四张 RTX 3090、batch size 1、学习率 $3\times10^{-4}$；原文未在该处细分 batch size 是全局还是每卡。推理只需雷达张量，LiDAR 与目标框用于构造训练和正常天气评价标签。其他模态的基线遵循各自训练设置；4DRC-Occ 是作者自行实现的 version A，尚未在原基准上核回其公开结果。[§IV-A/C](https://arxiv.org/html/2610.18686v1#S4)

## 关键图与可视化结果

![原论文图 3：重叠通道分支、几何语义融合与占据头细化](../../assets/papers/radargsocc-doppler-semantic-occupancy-figure-3.png)

先沿上方主路径看八通道输入如何分成六通道与五通道，再看左下的跨分支注意力，最后看右下占据头如何再次读取几何特征。橙色箭头标出额外几何监督，它只在训练中提供标签；两次特征融合在推理阶段仍然保留。[原图 3](https://arxiv.org/html/2610.18686v1#S3.F3)

![原论文图 4：城市与高速场景的相机、LiDAR及雷达占据对照](../../assets/papers/radargsocc-doppler-semantic-occupancy-figure-4.png)

每个场景上排依次为相机、LiDAR、雷达张量和标签；下排按原图注依次为相机模型、LiDAR 模型、RadarOcc、RadarGSOcc，各预测包含右前方三维视图、俯视图和正视图。黑框、红框指出局部车辆和道路结构的差异。所选车辆样例看起来更完整，但全测试集的车辆合并 IoU 反而较低，采用方法时应以分组统计为准。[原图 4、§IV-D1](https://arxiv.org/html/2610.18686v1#S4.F4)

## 实验结论与证据

### 评价的是前方正常天气占据

预测范围为前向 0–51.2 m、横向 ±25.6 m、高度 -2.6–3.0 m，体素边长 0.4 m，网格 $128\times128\times14$。二元 IoU 衡量非空几何重叠；mIoU 平均 14 个语义类的 IoU；W-mIoU 按各类标签体素频率加权。三者均越高越好，但加权平均主要反映大面积类别，稀有道路障碍可能几乎不影响总分。[§IV-A/B](https://arxiv.org/html/2610.18686v1#S4)

| 设置与一手位置 | RadarOcc | RadarGSOcc | 解读 |
| --- | ---: | ---: | --- |
| 主表 II，首轮 IoU / mIoU / W-mIoU，% ↑ | 36.4 / 6.7 / 21.9 | 38.2 / 7.6 / 25.5 | W-mIoU 增 3.6 点；按表值算相对增幅约 16.4% |
| 补充表 S-VIII，三次 W-mIoU 均值 ± 标准差，% ↑ | 20.93 ± 0.90 | 23.83 ± 2.15 | 均值高 2.90 点，训练波动也更大 |
| 主表 II，car / truck-bus IoU，% ↑ | 6.3 / 0.6 | 0.6 / 4.7 | 一类改善伴随另一类退步 |
| §IV-D1，car与truck-bus合并 IoU，% ↑ | 6.5 | 2.6 | 细分类转移没有带来更好的整体车辆占据 |
| 表 IV，参数量 M / GFLOPs ↓；FPS ↑ | 117.5 / 1334.1 / 3.3 | 104.6 / 1273.5 / 3.1 | 参数与算量降低，实际帧率略低 |

主表是两模型各自的第一次运行，同时也是各自三次训练中 W-mIoU 最好的一次；首轮未固定随机种子，后两轮为 1111、2222。第三轮 RadarGSOcc 的 IoU、mIoU 均低于 RadarOcc，W-mIoU 仍高。正常天气下主要收益来自 drivable area、vegetation、terrain，而小目标多接近零 IoU；均值优势尚不能概括成每次训练或每类目标都改善。[§IV-D1–2、补充表 S-VI/VIII](https://arxiv.org/html/2610.18686v1#S6)

### 模块组合有效，单模块和阈值结果需要分开读

表 IV 中，不带跨分支融合和头部细化的版本 W-mIoU 为 21.8%；只加细化为 21.1%，只加融合为 20.7%，两者同时使用才达到 25.5%。把可变形细化换成普通 3D 卷积降至 18.1%，说明采样方式和融合模块有联合影响。各消融仅训练一次，约一点的差异小于完整模型的部分种子波动，不能逐项排成稳定优劣次序。[表 IV](https://arxiv.org/html/2610.18686v1#S4.T4)

表 III 提高标签置信阈值时，保留的评价体素也随之减少。0.2 与 0.8 阈值对应的 mIoU 不在同一标签集合上，不能把后者的高分全算成预测能力提高。功率/Doppler 消融也非单调：保留 150 个空间位置时，两个变三个峰的 W-mIoU 从 21.2% 降到 20.4%；保留 250 个位置时才从 20.2% 升至 25.5%。[表 III/V](https://arxiv.org/html/2610.18686v1#S4.T3)

### 雪天保持了多少占据，还没有精确标签答案

雨雪场景与正常天气序列不仅天气不同，环境和时段也不同，且没有可靠逐帧占据真值。RadarGSOcc 在这些场景中的 EBKL 低于所列相机和 LiDAR 模型，但这说明的是类别分布更接近参考。其非空体素比例从正常天气的 26.5% 降到小雪 15.1%、大雪 15.3%；大雪 EBKL 约 0.10，是小雪约 0.05 的两倍。论文据此指出雪天是明显弱项；逐体素准确率和天气本身的因果影响仍未测得。[§IV-D6、表 VI](https://arxiv.org/html/2610.18686v1#S4.T6)

## 应用场景与启发

这篇工作的价值在于把“雷达占据总分提高”拆成可以继续追查的问题：增益是否只是更好地恢复路面、植被和地形，车辆边界与语义是否仍然可靠。对规划而言，少量车辆体素出错可能比大面积背景轻微改善更重要；本报告据此建议优先研究车辆与邻近可行驶空间的联合评价，而不是继续只优化体素频率加权分数。

标签构造也提供一个清楚的研究切口：同一套分支模型，在教师伪标签和人工核查标签上是否给出一致结论。如果不一致，下一步应先处理标签迁移及类别混淆，再把网络结构收益解释为感知能力提升。

## 局限与阅读风险

该模型处理当前帧，没有评估时序占据预测、轨迹规划或驾驶闭环。它的 Doppler 输入包含速度线索，却没有输出经验证的目标速度或未来占据。三次训练的波动、稀有类近零结果，以及前述车辆退步，是采用结构前最直接的风险。

正常天气标签来自跨域教师与框级修正，抽查规模不足以精确描述每个稀有类别。EBKL 又依赖环境类别频率稳定的假设：补充材料中城市与校园分布没有很好分开，跨数据集使用更需要重新检验。作者提供了这些限制的对照，但尚无人工标注的恶劣天气测试集来补足证据。

## 后续跟进

### 资源状态与最小验证

资源核验日为 **2026-10-18（Asia/Shanghai）**。

| 资源 | 核验结果 |
| --- | --- |
| 代码 | 固定稿仍写“将公开”；所查作者实验室条目未给实现下载入口 |
| 数据 | 原始 K-Radar 是已有数据；本文新增 3DSemOcc 标签与固定 split 文件未取得下载入口 |
| 配置 | 正文和补充材料列出预处理、损失与部分超参数；未取得可直接运行的完整配置 |
| 权重 | 所查官方入口未提供本文模型 checkpoint |

- 前置条件：取得本文标签、split、代码和三个训练配置；先固定标签阈值、体素范围与类别合并规则。
- 最小实验：在同一 split 上复现 RadarOcc 与 RadarGSOcc 的三个种子，另抽取带车的测试帧人工核对 car/truck-bus 标签。同时报告逐类、合并车辆、背景类别及 mIoU/W-mIoU，不改评价集合挑阈值。
- 成功信号：人工核对后车辆与邻近道路的收益仍跨种子一致，且没有靠把汽车预测成卡车换取分数；再测试时序融合能否改善这一薄弱处。
- 停止或转向：若结构收益随标签修正消失，先转向教师迁移与标签质量；若只改善背景加权分数，保留其静态场景用途，不将它推进为车辆安全感知方案。

### 来源与核验记录

依据 [arXiv:2610.18686v1](https://arxiv.org/abs/2610.18686v1)，初次提交为 2026-10-13。已读 §III–V、补充 S-I–VII，并核对原图 3/4、表 II–VI、S-IV/VI/VIII 和式 (1)–(21) 中本文使用的关系；两张本地图均逐张打开对照。单位由作者稿首页脚注确认：Goenawan、Kong 在 KAIST，Paek 当前在 Korea University、此前在 KAIST。

作者稿只注明投稿 IEEE；[实验室条目](https://ave.kaist.ac.kr/2026/03/05/radargsocc-robust-and-efficient-3d-semantic-occupancy-prediction-using-4d-radar-tensor-with-geometric-semantic-feature-extraction/)在本次终审核查时标为 IEEE Transactions on Vehicular Technology 审稿中，题名也与 arXiv 稿不同；未取得可核对的正式出版页，因此按预印本记录。RadarOcc 与 OpenOccupancy 的比较分别核过其正式论文方法与标签章节。资源仅做入口检查，未训练模型或复现实验。
