---
{
  "id": "ndp-lidar-distribution-prior",
  "tag": "lidar-anomaly-segmentation",
  "tags": ["lidar-anomaly-segmentation"],
  "title": "Neural Distribution Prior for LiDAR Out-of-Distribution Detection",
  "source": "CVPR 2026 / https://openaccess.thecvf.com/content/CVPR2026/html/Li_Neural_Distribution_Prior_for_LiDAR_Out-of-Distribution_Detection_CVPR_2026_paper.html / arXiv:2604.09232 / https://arxiv.org/abs/2604.09232 / Code: https://github.com/343gltysprk/ndp",
  "authors": ["Zizhao Li", "Zhengkang Xiang", "Jiayang Ao", "Feng Liu", "Joseph West", "Kourosh Khoshelham"],
  "affiliations": ["The University of Melbourne"],
  "comment": "NDP 用可学习的 logit 分布先验重加权三维异常分数，配合内部合成异常与 void 软监督，在 STU 隐藏测试集报告 AP 61.31%、PQ 24.99%。它建立了更强的道路异物基线，但训练资源、损失符号和固定阈值表现需要分别核对。"
}
---

## 一句话定位

NDP 研究一个具体问题：同样的异常分数，在点云中数量极不均衡的道路、建筑和稀少物体上是否具有相同意义？它从网络输出中学习分布先验，再调整每个点的异常分数，并用局部地面形变和未参与闭集分类的点提供训练监督。

- 核心证据：CVPR 正式版表 2 的 NDP-EE 在 STU 隐藏测试集得到点级 AP 61.31%、FPR@95 3.30%、实例 PQ 24.99%；这是该版本和协议下的论文结果，不代表截至今天全部方法的最高分。
- 主要边界：点级检测改善没有自动变成稳定的逐实例检出、跨传感器阈值或制动安全保证；论文公式与当前实现还有一处异常标签方向差异，复现时不能直接照抄。[正式原文 §3–4](https://openaccess.thecvf.com/content/CVPR2026/papers/Li_Neural_Distribution_Prior_for_LiDAR_Out-of-Distribution_Detection_CVPR_2026_paper.pdf)

## 论文要解决的问题

### 问题与假设

输入是一帧 LiDAR 点云；输出包括已知类别的语义/实例分割，以及每点的分布外分数。这里的 OOD 是相对于训练数据的未知物体，不是所有车辆故障，也不是行为异常。例如路面上的椅子可能被闭集网络自信地判成道路或其他车辆，单看最大分类置信度就会漏掉它。

作者认为，固定能量或熵分数忽略了类别不均衡：路面和建筑占据多数点，稀少类别的输出分布却不同。NDP 学的是这种输出分布的可用结构，并非完整估计未知物体的概率密度。把分数重新缩放也不等于已经证明概率校准；本文主要证据是排序指标与分割指标。[原文 §1、§3.1–3.4](https://openaccess.thecvf.com/content/CVPR2026/papers/Li_Neural_Distribution_Prior_for_LiDAR_Out-of-Distribution_Detection_CVPR_2026_paper.pdf)

### 相关工作与差异

| 工作与一手来源 | 已有机制 | NDP 改变的环节与边界 |
| --- | --- | --- |
| Cen 等，REAL，ECCV 2022；[原文 §4–5](https://www.ecva.net/papers/eccv_2022/papers_ECCV/papers/136980315.pdf) | 冗余分类器学习未知标签，缩放已有物体构造伪未知，并支持增量学习。 | NDP 改用 Perlin 地面形变，并学习 logit 先验权重；不包含 REAL 的增量类别学习任务。REAL 的 SemanticKITTI 未知类为 other-vehicle。 |
| Li、Dong，APF，CVPR 2023；[原文 §3–4](https://openaccess.thecvf.com/content/CVPR2023/papers/Li_Open-Set_Semantic_Segmentation_for_Point_Clouds_via_Adversarial_Prototype_Framework_CVPR_2023_paper.pdf) | GAN 合成未见类特征，配合类原型和混合距离判断未知。 | NDP 在输入空间合成异常、在输出空间加权；APF 使用 Cylinder3D/Point Transformer，且没有 STU 实验，不能把两文表格当同骨干受控比较。 |
| Li 等，REL，2025 年预印本、ISPRS JPRS 2026 正式发表；[作者版 §3–5](https://arxiv.org/abs/2511.06720) | Point Raise 构造几何异常，用正负 logit 的相对能量学习拒绝未知。 | NDP 把异常分数与可学习先验结合，并单独处理不可靠的 void 监督。两者同属合成监督路线，不能将 NDP 描述为首次利用几何合成或能量分数。 |
| Mosco 等，LIDO，CVPR 2026 同期工作；[原文 §3、§5.1](https://openaccess.thecvf.com/content/CVPR2026/papers/Mosco_Learning_to_Identify_Out-of-Distribution_Objects_for_3D_LiDAR_Anomaly_Segmentation_CVPR_2026_paper.pdf) | 仅用已知类别训练类原型、对比头和特征范数，不用异常/void 训练。 | NDP 使用合成异常及 void 监督；LIDO 在 STU 实验只用 SemanticKITTI 训练。两者可以代表不同资源条件，不能只按 AP 判定模块优劣。 |

## 方法和系统设计

### 输入输出与流程

训练时先在已标为道路的点中抽取局部区域，用平滑 Perlin 噪声选择并抬高部分点，再保留主要连通簇作为伪 OOD。它保留场景的大部分结构，同时产生大小和轮廓不同的隆起；这些是训练异常代理，不是采集到的真实道路异物。

随后 sparse UNet 提取点特征。一条分支送入 transformer decoder，完成闭集全景分割；另一条分支用 MLP 得到点级 logits，计算原始 OOD 分数。NDP 将 logits 投影为查询，与可学习先验表做交叉注意力，再为每个点输出权重。最终 OOD 点还通过 DBSCAN 聚类得到实例。分数排序、阈值选择、聚类是否分开相邻物体，是三个不同环节。[原文图 2、算法 1、§4.3](https://openaccess.thecvf.com/content/CVPR2026/papers/Li_Neural_Distribution_Prior_for_LiDAR_Out-of-Distribution_Detection_CVPR_2026_paper.pdf)

### 关键公式与直觉

第一组是原文式 2–3 及其权重定义。为避免先验表行数与语义类别数混淆，用 $M$ 表示表的行数：

$$
e=W_p f(x),\qquad z=\operatorname{softmax}\!\left(\frac{Q(e)K(\psi)^\top}{\sqrt d}\right)V(\psi),\qquad w(x)=1+\operatorname{ReLU}(W_s[e,z]),\qquad S_{\mathrm{NDP}}(x)=w(x)S_{\mathrm{base}}(x).
$$

$f(x)$ 是点 $x$ 的 logit 向量；$W_p$ 把它映射到 $d$ 维，$\psi\in\mathbb R^{M\times d}$ 是随网络学习的先验表；$Q,K,V$ 为线性映射，$[e,z]$ 为拼接，$W_s$ 输出标量。$w\geq1$，因此不是任意有正有负的校正项。监督经 OOD 损失反传给先验表和编码器；先验没有额外真实异常标签。当前 NDP-EE 实现有 $2C$ 个 logit 通道，先验表也设为 $2C$ 行；$C$ 是已知类别数。

第二组是原文式 6，用求和区间重写 extended energy：

$$
S_{\mathrm{NDP-EE}}(x)=w(x)\log\frac{\sum_{i=1}^{2C}\exp f_i(x)}{\sum_{i=1}^{C}\exp f_i(x)}.
$$

前 $C$ 个通道对应已知类别，后 $C$ 个为负类/OOD 通道。当负类通道相对更强，分子比分母大得更多，异常分数升高。它不需要为椅子、纸箱分别新增类别；推理输出仍是异常分数，不是异常物体名称。[原文式 2–6](https://openaccess.thecvf.com/content/CVPR2026/papers/Li_Neural_Distribution_Prior_for_LiDAR_Out-of-Distribution_Detection_CVPR_2026_paper.pdf)

第三组按当前公开实现写监督方向，并保留原文式 8 的单边软约束：

$$
p_x=\sigma(S_{\mathrm{NDP}}(x)+b),\qquad \mathcal L_{\mathrm{bin}}=\operatorname{BCE}(p_x,y_x),\qquad \mathcal L_{\mathrm{SOE}}=\mathbb E_{x\sim\mathcal D_{\mathrm{in}}}p_x+\mathbb E_{x\sim\mathcal D_{\mathrm{void}}}\max(0,\beta-p_x).
$$

$\sigma$ 为 sigmoid，$b$ 为可训练偏置；$y_x=0$ 表示 ID，$y_x=1$ 表示合成 OOD。$\mathcal D_{\mathrm{void}}$ 是未参加闭集分类的点，$\beta=0.9$。这个 hinge 只要求 void 概率达到下界，不会把它精确拉回 0.9，也不保证不超过 0.9。总目标还包括已知类别交叉熵与原有分割分支损失。当前代码的二元损失另给正类 10000 的权重，说明异常稀少的处理不只来自 NDP 模块。

**实现核对：**正式版式 7 印出的 ID/aux 二元项方向，与式 1、式 8及当前代码的“高分为 OOD”方向相反。本报告没有静默修正原文；上面的 $\mathcal L_{\mathrm{bin}}$ 明确是按代码重写，尚未通过训练确认发布权重使用的完整运行配置。[固定版本训练实现](https://github.com/343gltysprk/ndp/blob/f11dfbe4181db03a6a036d46b52a308f45d0e255/trainer/pq_trainer.py#L69)

### 训练与推理

训练使用已有闭集检查点、道路标签、合成 OOD 标签以及 void 点；推理只需要当前点云和训练好的网络，不需要真实异常标签、相机或未来帧。公开默认配置是单 GPU、batch size 8、10 epochs、AdamW 学习率 0.0002，README 说明使用单张 A100；这些是本次读取的发布配置，不能倒推为所有论文表格完全一致的预算。训练入口加载 STU 的预训练检查点，不能与“从零只用 SemanticKITTI”混称同等数据条件。[代码与配置](https://github.com/343gltysprk/ndp)

## 关键图与可视化结果

![原论文图 2：Perlin Raise、闭集分割分支与 NDP 分布先验重加权](../../assets/papers/ndp-lidar-distribution-prior-figure-2.png)

从左看输入与局部地面抬升，中间区分 UNet 后的分割分支和 OOD 分支，最后看右下角先验表与交叉注意力。图支持“合成监督与分布加权共同组成系统”的理解，不能把整套模型的收益全部归给注意力层。来源为正式版图 2，原图提取保留了完整模块和箭头。

![原论文图 3：STU 上 GT、MaxLogit、RbA 与 NDP 异常分数对照](../../assets/papers/ndp-lidar-distribution-prior-figure-3.png)

先看 GT 中红色异常与紫色 unlabeled，再比较后三列的热点是否落在道路异物上。NDP 的这些样例较集中，但对未标点响应不等于官方评测中的错误；它们本来就不计分。作者为展示对各方法分数做线性归一化并截断到 0–1，色条不能拿来比较原始概率校准，也不能由两组样例推出全序列误报率。[原文 §4.5](https://openaccess.thecvf.com/content/CVPR2026/papers/Li_Neural_Distribution_Prior_for_LiDAR_Out-of-Distribution_Detection_CVPR_2026_paper.pdf)

## 实验结论与证据

### 设置与指标

STU 有 19 条异常验证序列、51 条隐藏测试序列，另有两条正常序列用于闭集训练/验证。AP 衡量点级精确率与召回的整体折中；FPR@95 是达到约 95% 异常召回时的正常点误报率，越低越好；PQ 同时考虑实例识别与掩码重叠。它们都是离线感知指标。

官方脚本只计 2.5–50 m 内、非 unlabeled 的点，并跳过该范围内异常点总数少于 5 的帧；实例 IoU 大于 0.5 才匹配，足够点数的未匹配实例计入漏检或误报。因此正常长序列误报、150 m 检出、闭环避碰都没有被这套主分数覆盖。[STU 点级脚本](https://github.com/kumuji/stu_dataset/blob/main/compute_point_level_ood.py)、[实例脚本](https://github.com/kumuji/stu_dataset/blob/main/compute_object_level_ood.py)

### 主要结果与比较

| 评测设置与原表 | 方法 | 点级 AP ↑ / FPR@95 ↓，% | 实例 PQ ↑，% |
| --- | --- | --- | --- |
| STU validation，表 1 | Deep Ensemble | 6.94 / 37.34 | 7.27 |
| 同上 | NDP-Energy | 66.54 / 2.35 | 25.71 |
| 同上 | NDP-EE | 74.24 / 1.43 | 38.63 |
| STU hidden test，表 2 | Deep Ensemble | 5.17 / 58.05 | 8.81 |
| 同上 | NDP-Energy | 53.75 / 3.65 | 21.07 |
| 同上 | NDP-EE | 61.31 / 3.30 | 24.99 |

Deep Ensemble 是原 STU 基准中的参照，NDP 使用额外合成/void 监督，不是仅换一个分数函数。NDP-EE 从验证到隐藏测试 AP 下降 12.93 个百分点、PQ 下降 13.64 个百分点，说明实例与场景泛化仍有空间；差值为按表计算，未附置信区间。表 4 中闭集 PQ 也并非完全不变：STU 为 52.73→52.37，SemanticKITTI 为 60.72→59.38。[原文表 1、2、4](https://openaccess.thecvf.com/content/CVPR2026/papers/Li_Neural_Distribution_Prior_for_LiDAR_Out-of-Distribution_Detection_CVPR_2026_paper.pdf)

SemanticKITTI 的跨文比较需要特别谨慎：NDP §4.1 写 other-structure、other-object 为 OOD，REAL/APF 原文却把 other-vehicle 设为未知。即使 NDP 表 3 并列了它们的数值，本报告也不把它们解读为已统一未知类别的公平提升。LIDO 的训练数据和异常暴露条件同样不同。

### 消融与证据边界

表 5 中 full NDP-EE AP 74.24，去掉 SOE 为 67.10，去掉 NDP 为 58.69；这支持完整训练配方中两者有作用。表 6 另外在 energy 分数下比较统计先验与神经先验，NDP-Energy 为 66.54，静态分数为 56.88，属于不同配置，不能与表 5 的“去掉 NDP”行混合计算。作者未给多 seed 波动、传感器更换后的固定阈值误报或完整实时流水线延迟，因此不能声称统计显著、概率校准完毕或部署成本已满足要求。

## 应用场景与启发

- 作者主张：改善开放道路未知物体的感知，兼容多种异常分数。
- 我的判断：它适合作为 STU 的强点级基线，尤其提醒我们同时控制类别不均衡、void 定义、输入合成与实例聚类。高 AP 后，问题会转向“何时稳定发现一个危险物体”，不能只看点排名。
- 待验证假设：在冻结 NDP 和阈值的条件下，用因果的历史帧关联汇总实例证据，能否在相同全帧误报预算下更早稳定检出远处异物？这只是一项待验证的具体问题；多帧积累可能因为位姿误差和误报持续化而反而变差。

## 局限与阅读风险

作者 §4.7 承认未知物体缺少真实边界监督，形状不规则会使点级掩码边缘偏移。我们还需注意：Perlin 地面隆起没有穷尽悬空、可变形、运动或被遮挡物体；论文未测试这些情形不能表述为它必定失败。

官方评测忽略部分未标物体，且排除无足够异常点的帧；因此 AP 和 FPR@95 不能直接转成每公里误报或驾驶风险。分数可学习也不等于已具备可靠的部署阈值。当前公式/代码方向差异，以及 SemanticKITTI 未知类描述差异，都是正式复现前需要固定的协议条件。

## 后续跟进

### 最小验证与停止条件

- 当前资源：2026-09-14 核实[官方代码](https://github.com/343gltysprk/ndp)包含模型、训练、合成脚本与配置；[权重目录](https://huggingface.co/343GltySprk/NDP-OOD/tree/main)实际列出 `ap74.ckpt`。STU 数据及预训练检查点由[数据集项目](https://github.com/kumuji/stu_dataset)提供。已读取源码和清单，未运行权重或训练。
- 最小实验：先固定代码提交、STU 验证序列、过滤规则和检查点，重现点级与实例级基线；检查异常标签 1 是否确实让输出分数升高。随后只加入过去帧的实例关联，保持网络、空间范围、阈值和聚类配置不变，同时记录全帧误报、首次连续三帧检出距离及官方 AP/PQ。
- 成功信号：以序列为单位统计，在不增加全帧误报预算、不过度降低近处召回的条件下，稳定检出距离有一致收益；不能用同一批测试序列重新调阈值后宣布泛化。
- 停止/转向：若原始基线在协议一致后仍无法对齐，先停止新增模块；若时序收益依赖未来帧、测试期调阈值，或只是把误报持续化，则否定该假设，回到输入可观测性与实例分组问题。

### 来源与核验记录

本报告固定依据 CVPR 2026 正式 PDF（3035–3045 页），公式 2–8、算法 1、表 1–7、图 2–3；核验日期 2026-09-14。保留 [arXiv:2604.09232v2](https://arxiv.org/abs/2604.09232v2)入口，该版本更新于 2026-04-17；报告数值统一取正式版，没有混用其他版本表格。

相关工作的机制分别回到 REAL、APF、REL 和 LIDO 自身原文核对。当前官方实现固定为 `f11dfbe4181db03a6a036d46b52a308f45d0e255`，仅进行了读取与公式对照。两张图均由正式 PDF 提取并实际查看；本报告不声称完成实验复现。COVAL 的可见性干预工作已列入本方向检索，但本次全文访问受限，不据此编造定量对照或把 NDP 称为当前全域最佳。
