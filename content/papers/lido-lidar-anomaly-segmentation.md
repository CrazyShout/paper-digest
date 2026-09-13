---
{
  "id": "lido-lidar-anomaly-segmentation",
  "tag": "lidar-anomaly-segmentation",
  "tags": ["lidar-anomaly-segmentation"],
  "title": "Learning to Identify Out-of-Distribution Objects for 3D LiDAR Anomaly Segmentation",
  "source": "CVPR 2026 / https://openaccess.thecvf.com/content/CVPR2026/html/Mosco_Learning_to_Identify_Out-of-Distribution_Objects_for_3D_LiDAR_Anomaly_Segmentation_CVPR_2026_paper.html / arXiv:2604.23604 / https://arxiv.org/abs/2604.23604 / Code: https://github.com/SiMoM0/LIDO",
  "authors": ["Simone Mosco", "Daniel Fusaro", "Alberto Pretto"],
  "affiliations": ["University of Padova"],
  "comment": "LIDO 只用已知类别训练，通过类原型、对比特征与范数识别 LiDAR 异物，并提供三套混合真实与合成异常测试集。STU 测试 AP 为 14.99%，但低线数数据上的误报、已知语义精度和分数归一化仍暴露明显边界。"
}
---

## 一句话定位

LIDO 把“已知类别的特征应该长什么样”作为异常分割的起点：语义头建立类原型，对比头塑造特征方向与范数，推理时联合两类信号寻找不符合已知类别的点。论文同时构造了多种 LiDAR 分辨率的混合异常测试集，值得将方法和评测两部分分别阅读。

- 核心证据：仅用 SemanticKITTI 已知类别训练时，正式版表 2 报告 STU validation/test AP 为 27.53%/14.99%；没有使用真实异常、合成异常或 void 点作异常训练监督。
- 主要边界：其混合测试集表现随传感器和场景明显变化；nuScenes-OoD 上已知类别 mIoU 约下降 12 个百分点。不能把较轻量的网络等同于精度和校准都已解决。[正式原文 §3–5](https://openaccess.thecvf.com/content/CVPR2026/papers/Mosco_Learning_to_Identify_Out-of-Distribution_Objects_for_3D_LiDAR_Anomaly_Segmentation_CVPR_2026_paper.pdf)

## 论文要解决的问题

### 问题与假设

输入点包含三维坐标与反射强度，输出是已知类别语义标签和每点异常分数。未知类别没有参与模型的监督训练；例如路中央的家具既不像道路，也没有足够证据属于汽车，就应产生可用的异常信号，而不是被强制归入最接近的已知类。

LIDO 的前提是：用已知类训练得到的特征簇、方向和范数，能为未知物体提供可迁移的边界。这不是数学保证。远处正常物体同样稀疏，可能离原型很远；几何上像道路的异物也可能靠近已知簇，所以需要同时查看漏检和误报。

### 相关工作与差异

| 工作与一手来源 | 已有机制 | LIDO 的变化与比较边界 |
| --- | --- | --- |
| Cen 等，REAL，ECCV 2022；[原文 §4–5](https://www.ecva.net/papers/eccv_2022/papers_ECCV/papers/136980315.pdf) | 缩放已有物体构造伪未知，训练冗余分类器；后续还支持增量类别学习。 | LIDO 不用此类异常暴露，而用已知特征的几何结构计分；本文不研究增量学习。REAL 的类别留出协议也不同于真实 STU 道路异物。 |
| Li、Dong，APF，CVPR 2023；[原文 §3–4](https://openaccess.thecvf.com/content/CVPR2023/papers/Li_Open-Set_Semantic_Segmentation_for_Point_Clouds_via_Adversarial_Prototype_Framework_CVPR_2023_paper.pdf) | 类原型约束配合 GAN 生成未见类特征，再以混合距离拒绝未知。 | LIDO 也使用原型，但不合成未知特征，增加对比头与范数信号；APF 的 SemanticKITTI other-vehicle 留出结果不能当成本文混合异常测试集的同协议对照。 |
| Nekrasov 等，STU，CVPR 2025；[原文 §3–4](https://openaccess.thecvf.com/content/CVPR2025/papers/Nekrasov_Spotting_the_Unexpected_STU_A_3D_LiDAR_Dataset_for_Anomaly_CVPR_2025_paper.pdf) | 真实道路场景、点级异常与序列内实例标签；用 Mask4Former 系列建立基线。 | LIDO 改为较轻的 MinkowskiNet 特征建模，并增加 32/40/64 线混合测试数据。STU 有实例标签；LIDO 将其简写为二元标签，是没有完整已知类语义标签，不是没有实例标注。 |
| Li 等，NDP，CVPR 2026 同期工作；[原文 §3–4](https://openaccess.thecvf.com/content/CVPR2026/papers/Li_Neural_Distribution_Prior_for_LiDAR_Out-of-Distribution_Detection_CVPR_2026_paper.pdf) | 内部几何合成、void 软监督与可学习 logit 先验共同改善异常分数。 | NDP 和 LIDO 的骨干、训练域、异常监督都不同。NDP 的 STU AP61.31 不能解释为在 LIDO 上仅替换某个分数的净收益；LIDO 代表较少异常训练资源的另一设置。 |

## 方法和系统设计

### 输入输出与流程

一帧点云经 MinkowskiNet 编码后分为两个头。语义头输出已知类别特征，利用正确分类点累积每类原型，使同类特征方向更接近；对比头让不同类别保持分离，并把已知类特征推离特征空间原点。推理分别测“离所有原型有多远”“分类分布有多不确定”“特征范数是否过小”，再融合成异常分数。[原文图 2、§3](https://openaccess.thecvf.com/content/CVPR2026/papers/Mosco_Learning_to_Identify_Out-of-Distribution_Objects_for_3D_LiDAR_Anomaly_Segmentation_CVPR_2026_paper.pdf)

两条路线不要混淆：模型训练只使用基础数据集的已知标签；论文另行把 ModelNet 物体加入真实验证扫描，是为构造 OOD 测试集。该合成流程包含物体落地、旋转缩放、range-image 投影/重投影、射线采样和近似反射强度。它改善模拟物体与扫描结构的匹配，但不等于生成了真实传感器测量。

### 关键公式与直觉

第一组对应原文式 2–3，写出原型累积与拉近同类特征的约束：

$$
\mathrm{CP}_c=\frac{\sum_{x\in\widehat X_c}\kappa_x f_x}{\sum_{x\in\widehat X_c}\kappa_x},\qquad \mathcal L_{\mathrm{prot}}=\frac1N\sum_c\sum_{x\in X_c}\left[1-\operatorname{cos}(\mathrm{CP}_c^{e-1},f_x)\right].
$$

$X_c$ 是真实标签为 $c$ 的点，$\widehat X_c$ 只保留其中预测正确的点；$f_x$ 是语义头 softmax 前的特征，$\kappa_x$ 按论文取该向量的最大分量，不要把它写成 softmax 概率。$N$ 为训练点数，$e$ 是 epoch，原型来自上一轮；第一轮尚无累积原型，不启用该损失。所有类别信息都来自已知训练标签。另有交叉熵和 Lovász 损失维持语义分割。

第二组对应式 7 在本文实际训练设置下的已知类分支：

$$
\mathcal L_{\mathrm{obj}}(x)=\max\!\left(0,r-\lVert f'_x\rVert_2^2\right),\qquad x\in\mathcal D_{\mathrm{in}}.
$$

$f'_x$ 为对比头特征，$\mathcal D_{\mathrm{in}}$ 为已知类点，$r=5$ 是**平方范数的阈值**。优化目标是让已知点的平方范数至少达到 $r$；对应范数边界为 $\sqrt r$，不能把式中的 $r$ 直接叫作球半径。式 7 虽列有其他分支，作者明确不利用 unlabeled/void 区域学习异常。未知样本自然留在低范数区域是模型希望出现的泛化行为，并没有未知标签直接保证。对比损失还使每类均值接近自身原型并远离其他原型，温度为 0.1。

第三组重组原文式 11–14 的推理规则：

$$
a_x=\left[1-\max_c\operatorname{cos}(f_x,\mathrm{CP}_c)\right]\frac{-\sum_c p_{x,c}\log p_{x,c}}{\log C},\qquad s_x=\frac12\left[\frac{a_x}{\max_u a_u}+\max\!\left(0,1-\frac{\lVert f'_x\rVert_2^2}{r}\right)\right].
$$

$C$ 是已知类数，$p_{x,c}$ 是语义头 softmax 概率；第一项结合原型距离与归一化熵，第二项来自范数，分数越大越可疑。$\max_u a_u$ 为当前处理点集合的最大值，当前代码也执行这一步。它让分数依赖同帧其他点：即使目标点特征不变，场景中新增一个更异常的点也可能改变它的最终分数。因此输出落在有限范围，不代表跨帧已具备统一概率尺度；这应在固定阈值实验中检查。[原文 §3.4](https://openaccess.thecvf.com/content/CVPR2026/papers/Mosco_Learning_to_Identify_Out-of-Distribution_Objects_for_3D_LiDAR_Anomaly_Segmentation_CVPR_2026_paper.pdf)、[固定版本推理实现](https://github.com/SiMoM0/LIDO/blob/bfc2113d1bb63b2c7e9f9ce54d288116aee20ef4/modules/user.py#L211)

### 训练与推理

论文 §5.1 说明所有模型从零训练，单张 A40，64 epochs，batch size 4，使用 SGD、预热和余弦学习率调度，不使用模型集成和测试时增强。STU 实验只用 SemanticKITTI 训练；三个混合测试集分别使用对应基础数据集的正常训练集。原型损失权重 0.1，对比和范数损失权重各 0.5；这些权重决定联合优化，不能把收益归给某一条式子而忽略其余损失。

推理需要权重和训练期间存储的原型；官方模型目录除了 `checkpoint-best.pt`，也提供 `mavs.pickle`、`vars.pickle` 与配置。只拿一个权重文件并不足以完整复现官方推理入口。本方法没有使用 STU 同步相机、位姿或历史帧，也没有输出一个已验证的时序危险等级。

## 关键图与可视化结果

![原论文图 2：LIDO 的语义原型分支与对比特征分支](../../assets/papers/lido-lidar-anomaly-segmentation-figure-2.png)

沿左侧点云进入骨干，再分开看上方语义头与下方对比头，最后在右侧融合异常分数。实线表示训练与推理共用路径，虚线表示仅在推理时使用的路径。图中的彩色特征簇表达机制，不是证明所有未知点都落在空白区域的覆盖实验。

![原论文图 3：STU 与 SemanticKITTI-OoD 多异常场景的分数可视化](../../assets/papers/lido-lidar-anomaly-segmentation-figure-3.png)

上排青色是 GT 异常；下两排的蓝到橙对应预测分数升高。左半是真实 STU，右半为混合真实与合成的 multi 测试集。若只看橙色是否出现，会忽略它是否同时覆盖正常物体；应对照所有正常区域，并结合表中的 FPR@95。这六个样例不能证明未展示传感器、天气或未知形状都能泛化。两图均来自正式版图 2、图 3。

## 实验结论与证据

### 设置与指标

STU validation/test 分别为 19/51 序列；它有异常点与实例标注，但没有这两个 split 的完整已知语义标签。SemanticKITTI-OoD、SemanticPOSS-OoD、nuScenes-OoD 分别基于 4071、500、6019 个验证扫描，传感器为 64、40、32 线。single/multi 两版约有 40%/60% 扫描含异常；single 只在道路上放一个异物，multi 可在道路、人行道、停车区域放多个，异常数量、位置和占比都变了。[原文 §4、表 1](https://openaccess.thecvf.com/content/CVPR2026/papers/Mosco_Learning_to_Identify_Out-of-Distribution_Objects_for_3D_LiDAR_Anomaly_Segmentation_CVPR_2026_paper.pdf)

AP 汇总点级精确率与召回关系；FPR@95 是高异常召回条件下的正常点误报，越低越好；mIoU 则检查已知语义类有没有受损。本文主要报告点级异常分数，没有用完整实例 PQ 说明每个异物是否被独立找出。STU 官方脚本的 2.5–50 m、unlabeled 忽略和异常点不足 5 的帧跳过规则，也意味着官方分数不是全正常流式误报评估。

### 主要结果与比较

| 评测设置与原表 | LIDO AP ↑ / FPR@95 ↓，% | Deep Ensemble AP ↑ / FPR@95 ↓，% | 主要比较边界 |
| --- | --- | --- | --- |
| STU validation，表 2 | 27.53 / 34.86 | 6.94 / 37.34 | 原始 STU 参照骨干与训练域不同 |
| STU hidden test，表 2 | 14.99 / 34.29 | 5.17 / 58.05 | LIDO 只用 SemanticKITTI ID 训练 |
| SemanticKITTI-OoD single，表 4 | 10.60 / 31.19 | 6.20 / 27.69 | AP 提高而 FPR@95 更高 |
| SemanticKITTI-OoD multi，表 4 | 9.42 / 39.04 | 12.04 / 28.64 | 两项均未超过 ensemble |
| nuScenes-OoD single，表 5 | 6.79 / 39.70 | 18.34 / 34.59 | 低线数下有明显精度代价 |
| nuScenes-OoD multi，表 5 | 10.53 / 44.51 | 23.87 / 43.63 | 更多异常不自动等于更强泛化 |

表 2 的 STU test AP 相对参照高 9.82 个百分点，但 validation→test 降低 12.54 个百分点；不能只展示前者。多异常 split 中异常点占比也变化，AP 变化同时受到先验占比和任务难度影响，不是完全控制条件下的传感器排名。

表 7 的已知语义代价尤其值得看：nuScenes-OoD single 的标准模型 mIoU 72.75%，LIDO 为 60.61%，下降 12.14 个百分点；multi 为 72.62%→60.44%。SemanticKITTI-OoD single 也由 64.99% 降至 61.34%。这些是按原表计算的差值，未附重复实验区间。因此“兼顾异常与语义”应理解为设计目标，而非各数据集都无损达成。[原文表 4–7](https://openaccess.thecvf.com/content/CVPR2026/papers/Mosco_Learning_to_Identify_Out-of-Distribution_Objects_for_3D_LiDAR_Anomaly_Segmentation_CVPR_2026_paper.pdf)

### 消融与运行成本

表 8 的 STU validation 中，配置 F 使用 prototype+contrastive 与语义头分数，AP 为 12.88%、FPR@95 为 26.71%；配置 G 加入 objectosphere 后，AP 为 14.82%、FPR@95 为 36.57%。在相同三项损失下，配置 I 的双头融合将 AP 提高到 27.53%，并将 FPR@95 降到 34.86%。因此融合相对 G 改善了这两个指标，但完整配方的高召回误报仍高于不含 objectosphere 的 F 操作点；不能把 F 到 I 的混合变化归因于融合本身。

表 6 在 A40 上报告 LIDO 21.7M 参数、38 ms、0.6 GB，Mask4Former 为 39.6M、168 ms、1.8 GB，串行 ensemble 为 861 ms。不能由此直接推出车载完整异常管线达到约 26 FPS：当前官方 `user.py` 的计时更新发生在部分异常分数后处理之前，并在此重置 `end`，下一轮计时又可能包含上一帧后处理。因此它既不是单纯网络时间，也不是逐帧首尾对齐的端到端时间；还需统一数据读取、CPU/GPU 传输、原型相似度、异常计分和输出聚类的测量边界。[固定实现](https://github.com/SiMoM0/LIDO/blob/bfc2113d1bb63b2c7e9f9ce54d288116aee20ef4/modules/user.py#L191)

## 应用场景与启发

- 作者主张：用更少异常监督和较轻模型完成 LiDAR 异常分割，补充不同线数的测试数据。
- 我的判断：LIDO 适合作为“只用正常类训练”的对照，也适合检查强基线的收益究竟来自异常暴露还是表示学习；不能与 NDP 不同资源条件的 AP 直接排总榜。
- 待验证假设：将当前每帧最大值归一化替换为只由正常校准集估计、部署时冻结的尺度，能否在保留合理召回的同时减少跨帧阈值漂移？它可能降低单帧 AP，结果必须同时接受全帧误报和稳定检出指标约束。

## 局限与阅读风险

作者明确讨论稀疏点、类别不均衡和低线数下类原型不稳定，并把进一步跨域研究列为未来工作。其不同数据集各自训练的结果，不等于训练完一套模型便能零调参换传感器。混合数据集采用近似物理强度和射线重采样，仍不能替代真实异物的材质、遮挡和运动分布。

STU 的标签描述容易被误读：它的已知点在异常 split 中归为 inlier，但未知物体同时有实例 ID。本报告保留这个区别。当前归一化和双头融合也没有给出正式概率校准证明；像椅子这样的未知物体可能高范数，远处正常点可能低范数，这些都需要被专门分组评估。

## 后续跟进

### 最小验证与停止条件

- 当前资源：2026-09-14 核实[官方仓库](https://github.com/SiMoM0/LIDO)有训练、推理、网络、损失与 YAML 配置；[模型目录](https://huggingface.co/Simom0/LIDO)实际列出四组 checkpoint、原型和统计文件；[数据目录](https://huggingface.co/datasets/Simom0/OoD-Datasets/tree/main)实际列出三套 ZIP。合成生成器在仓库 checklist 中仍待发布，已有生成好的测试数据不等于完整生成流程已开源。
- 最小实验：固定官方 checkpoint、原型和 STU 验证序列，先重现原始 score；然后冻结模型，仅比较当前归一化与正常校准集得到的固定尺度。全部帧均保留，分别输出官方过滤指标、正常帧误报点/实例数、距障碍物远近的召回与逐实例连续检出率。
- 成功信号：在相同异常召回或预先确定的误报预算下，固定尺度减少跨帧报警波动；加入或移除其他物体时，目标点的操作点判定更加稳定。用独立序列复核，而不是反复在同一测试序列选尺度。
- 停止/转向：若改善只体现在调阈值后的单帧 AP，正常长序列误报反而上升，或低线数已知语义精度继续明显恶化，应否定“仅修尺度就足够”的假设，转向特征表示和稀疏度控制。未经原始基线对齐，不扩展到大规模新模型训练。

### 来源与核验记录

本报告以 CVPR 2026 正式 PDF（17204–17214 页）为固定来源，重点核对 §3–5、式 2–14、表 1–8、图 2–3；核验日期 2026-09-14。保留 [arXiv:2604.23604v1](https://arxiv.org/abs/2604.23604v1)入口，首次提交日期为 2026-04-26，所有结果统一取正式版。

相关工作均回到 REAL、APF、STU 和 NDP 自身原文。官方实现固定为 `bfc2113d1bb63b2c7e9f9ce54d288116aee20ef4`，读取了模型资源清单、推理归一化和计时位置；没有运行下载权重、训练或复现实验。两张原图均从正式 PDF 提取并实际查看，样例只承担机制解释与定性对照。
