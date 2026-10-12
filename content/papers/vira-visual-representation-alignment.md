---
{
  "id": "vira-visual-representation-alignment",
  "tag": "end-to-end-autonomous-driving",
  "tags": ["end-to-end-autonomous-driving"],
  "title": "Do Better Visual Representations Always Lead to Better End-to-End Autonomous Driving?",
  "source": "arXiv:2610.09695v1 / https://arxiv.org/abs/2610.09695v1 / Repository: https://github.com/OpenDriveLab/ViRA / Project: https://opendrivelab.com/ViRA/",
  "authors": ["Zihao Zhang", "Haochen Tian", "Tianyu Li", "Changhui Jing", "Jingliang He", "Naisheng Ye", "Ziyuan Pu", "Zhenjie Yang"],
  "affiliations": ["Southeast University", "OpenDriveLab at The University of Hong Kong", "Shenzhen Loop Area Institute"],
  "comment": "ViRA 在训练时对齐冻结视觉基础模型的空间关系与场景语义，部署仍使用原规划器。跨三种规划器的收益和随机目标负对照较有价值，但 NAVSIM 的较大增益没有等比例转化成 HUGSIM 闭环表现，代码与权重仍待发布。"
}
---

## 一句话定位

ViRA 研究的不是简单地换一个更大视觉骨干，而是**同样的规划器能否从冻结视觉基础模型中学到更有用的中间表征，以及这种收益由什么决定**。它用空间依赖对齐和全局语义对齐辅助训练，在推理时移除基础模型分支；实验进一步说明，目标模型与感知辅助监督的组合，比单看基础模型的规模更值得关注。

- 核心证据：固定 TransFuser，将预训练 DVGT 换成随机初始化目标后，navtest EPDMS 从基线 83.6 降至 82.0；预训练 DVGT 则得到 89.0。这排除了“只要多加一个对齐损失就会提升”的简单解释。[表 4–5](https://arxiv.org/html/2610.09695v1#S3.SS3)
- 主要边界：Rap* 在 navhard 从 32.8 升至 49.2，但零样本 HUGSIM HD-Score 只从 7.3 升至 10.3；表示改善可以有帮助，却没有消除闭环适应问题。[表 2–3](https://arxiv.org/html/2610.09695v1#S3.SS1)

## 论文要解决的问题

### “特征更好”需要落实到规划任务

视觉基础模型（VFM）擅长语义、深度或三维几何，不代表每种特征都同样适合规划。路口的道路边界更清楚，可能帮助避免越界；但如果轨迹解码器不能处理让行或交互，即使 BEV 语义图完整，动作仍可能不合理。作者把规划器和对齐目标交叉比较，并区分使用检测/分割辅助监督的规划器与不使用这些任务的规划器。

其假设有两层：预训练表征能提供原规划目标缺少的知识；原有辅助监督也可能提供类似信息，从而缩小不同 VFM 目标的差距。论文的“perception-free”是没有辅助感知任务，并非不需要视觉编码器或不感知环境。Rap* 还是作者重实现版本，骨干和数据增强与官方 Rap 不同。[§2、§4.2](https://arxiv.org/html/2610.09695v1#S4.SS2)

### 相关方法提供了不同接口

| 工作与一手来源 | 原方法做什么 | ViRA 的差异与比较范围 |
| --- | --- | --- |
| Liao 等，DiffusionDrive，CVPR 2025；[正式论文](https://openaccess.thecvf.com/content/CVPR2025/papers/Liao_DiffusionDrive_Truncated_Diffusion_Model_for_End-to-End_Autonomous_Driving_CVPR_2025_paper.pdf)、[原文 §3](https://arxiv.org/html/2411.15139v3#S3) | 从带噪多模式轨迹锚点启动截断扩散，级联解码器与场景特征交互，提高轨迹生成效率 | ViRA 保留其规划结构，改变视觉表征训练监督。原 DiffusionDrive 的部分 NAVSIM 实验使用相机与 LiDAR；本文统一为纯相机配置，不能拿两个版本主表直接计算方法增益 |
| Zuo 等，DVGT，CVPR 2026；[正式论文](https://openaccess.thecvf.com/content/CVPR2026/papers/Zuo_DVGT_Driving_Visual_Geometry_Transformer_CVPR_2026_paper.pdf)、[原文 v2 §3](https://arxiv.org/html/2512.16919v2#S3) | 交替执行视图内、跨视图与跨帧注意力，重建米制尺度的自车坐标点图和自车位姿 | ViRA 使用其预测头之前的冻结特征作为训练目标，不直接把点图、位姿或 VFM 特征送进规划头；因此本文验证的是表示迁移，不能把结果当作在线三维重建系统的收益 |

## 方法和系统设计

### 同一组图像进入两个编码器

当前帧多视角图像 $\mathcal O$ 同时进入可训练的规划器编码器 $E_\theta$ 和冻结的 VFM $T_\phi$。前者输出学生特征 $F^s$，驱动原有策略头生成未来轨迹；后者输出教师特征 $F^t$，只参与对齐损失。论文分别测试回归型 TransFuser、扩散型 DiffusionDrive 和词典评分型 Rap*，而不是为三种规划器设计不同的部署网络。[§2.1、附录 A.1](https://arxiv.org/html/2610.09695v1#S2.SS1)

对齐之前，将学生特征调整到目标的空间分辨率，再用轻量 $1\times1$ 卷积投影到公共潜在空间。默认目标 DVGT 从 aggregator 取四层中间 tokens，用可学习权重融合，恢复空间特征图；其他 VFM 同样取任务头之前的表征。教师参数冻结，投影与规划器共同训练。[附录 C.1](https://arxiv.org/html/2610.09695v1#A3.SS1)

### 空间关系与场景语义分别约束什么

空间依赖对齐（SDA）不要求两个网络每个通道的数值一致，而是让学生对空间位置的依赖分布接近教师。原文式 (S.2) 为：

$$
A^s=\operatorname{softmax}\left(Q^s(K^t)^\top/0.07\right),\qquad
A^t=\operatorname{softmax}\left(Q^t(K^t)^\top/0.07\right),
$$

$$
\mathcal L_{\rm SDA}=\mathbb E_{b,i}\left[D_{\rm KL}\left(A^t_{b,i,:}\,\Vert\,A^s_{b,i,:}\right)\right].
$$

$Q^s,Q^t$ 分别来自学生与教师的 query 投影，$K^t$ 是教师 key；$b$ 表示批内场景，$i$ 表示空间 token。学生与教师 query 使用共同的教师 key 作为参照，因此比较的是“这个位置应该关联哪些空间信息”。目标方向为教师分布到学生分布的 KL，温度为 0.07。它没有直接保证三维几何或碰撞风险正确。[附录 A.2](https://arxiv.org/html/2610.09695v1#A1.SS2)

场景语义对齐（SSA）先聚合为全局向量 $z^s,z^t$，再匹配批内同一场景：

$$
M=z^s(z^t)^\top/1.0,\qquad
\mathcal L_{\rm SSA}=\frac12\left[\operatorname{CE}(M,y)+\operatorname{CE}(M^\top,y)\right],
$$

$$
\mathcal L=\mathcal L_{\rm planner}+\mathcal L_{\rm SDA}+0.1\mathcal L_{\rm SSA}.
$$

这里 $y=[1,\ldots,B]$ 标识批内配对，$M$ 是学生与教师场景向量的相似度矩阵。双向交叉熵让同一场景相互匹配，其余场景提供对照；$\mathcal L_{\rm planner}$ 包含原规划损失和该配置原有的辅助任务，不能把默认实验描述为取消了所有检测/分割标注。式 (S.3)–(S.4) 中 SSA 温度为 1.0、权重为 0.1。[附录 A.2–A.3](https://arxiv.org/html/2610.09695v1#A1.SS3)

### 部署结构不变，训练成本仍然存在

部署只保留 $\hat\tau=\pi_\psi(E_\theta(\mathcal O))$。VFM 与投影头全部移除，不额外执行几何重建或教师推理。新增知识来自 VFM 的预训练数据，ViRA 本身不要求新增任务标注；这不等于教师知识没有外部数据成本。

三种模型都在 navtrain 训练，采用 ResNet-34，硬件为 8 张 H100。TransFuser 与 DiffusionDrive 分别为 56M/61M 参数，三路相机、论文表记 $2048\times512$ 输入，四秒/2 Hz 轨迹，训练 100 epochs、总 batch 192；Rap* 为 69M 参数，四路 $768\times448$ 相机，五秒/2 Hz 轨迹，训练 30 epochs、总 batch 48。不同规划器之间训练预算并不相同，应在各自基线内比较加入 ViRA 的效果。额外 VFM 特征提取/存储的总耗时和显存增量未量化。[表 S.1、附录 E](https://arxiv.org/html/2610.09695v1#A2.SS2)

## 关键图与可视化结果

![原论文图 S.1：双编码器与空间、语义对齐训练流程](../../assets/papers/vira-visual-representation-alignment-figure-s1.jpg)

图 S.1 先看上方：同一图像送入可训练 encoder 与带雪花标记的冻结 VFM；规划头只使用学生特征。下方左侧对应空间注意力 KL，右侧对应批内双向语义匹配。图中画了三类策略头，表示方法可接在不同规划器上，而非三者同时集成。[原图与图注](https://arxiv.org/html/2610.09695v1#A1.F1)

![原论文图 6：不同目标的分割表现，以及有无辅助感知监督的规划增益](../../assets/papers/vira-visual-representation-alignment-figure-6.jpg)

图 6(a) 的虚线基线为 36.4 mIoU，DINOv3 目标达到 39.4，DVGT 为 39.1。图 6(b) 的实心/斜线柱对应有/无感知辅助监督，**各自相对基线是 83.6/82.6**；不能仅比较两柱高度判断绝对 EPDMS。例如 DINOv3 的增益是 5.2/6.5，换回绝对值为 88.8/89.1。它支持“辅助监督使目标选择没那么敏感”，并不支持有辅助监督总是更高。[§4.2、图 6](https://arxiv.org/html/2610.09695v1#S4.F6)

## 实验结论与证据

### 三种评测协议分开看

NAVSIM-v2 navtest 为 12,146 个真实场景的单阶段评测；navhard 为 244 个困难初始场景加 4,164 个合成后续场景的两阶段评测，作者说明后者采用反应式交通参与者。EPDMS 由 NC、DAC、方向 DDC、红绿灯 TLC 等乘法惩罚，与进度、TTC、车道保持、舒适度等加权项组合。它不是轨迹位置误差，也不是整个真实路线的成功率。[附录 B.1](https://arxiv.org/html/2610.09695v1#A2.SS1)

HUGSIM 用重建场景进行闭环，规划器仅在 NAVSIM 训练，未为 HUGSIM 微调；HD-Score 将路线完成度与逐步安全、舒适度结合，按 0–100 报告。本文未在该设置段明确列出 HUGSIM 场景总数，不应与另一篇论文的“345 场景”自动合并。分割 mIoU 是 TransFuser 的七类 BEV 分割质量，并不直接测场景动态预测。[§2.2、附录 B.1](https://arxiv.org/html/2610.09695v1#S2.SS2)

### 各规划器内的提升与跨基准落差

| 规划器，默认 DVGT 目标 | navtest EPDMS，表 1 | navhard EPDMS，表 2 | HUGSIM HD-Score，表 3 |
| --- | --- | --- | --- |
| TransFuser → 加 ViRA | 83.6 → 89.0（+5.4 点） | 27.6 → 31.7（+4.1 点） | 22.1 → 24.8（+2.7 点） |
| DiffusionDrive → 加 ViRA | 84.5 → 91.9（+7.4 点） | 30.5 → 35.8（+5.3 点） | 22.2 → 28.6（+6.4 点） |
| Rap* → 加 ViRA | 72.8 → 83.7（+10.9 点） | 32.8 → 49.2（+16.4 点） | 7.3 → 10.3（+3.0 点） |

这组表最有解释力的部分是每行的配对比较。Rap* 在 navhard 最强，却在 HUGSIM 明显低于另外两种规划器，说明评分型策略对困难日志/伪仿真场景的适应，并不自动转成跨域闭环能力。TransFuser 在 HUGSIM Extreme 的 HD-Score 从 10.9 降至 9.9；Rap* 的 navtest 扩展舒适度 EC 从 56.7 降至 48.1。总分提升仍伴随分项退步。[表 1–3](https://arxiv.org/html/2610.09695v1#S3.SS1)

作者另外用 DINOv3 对齐、取消辅助感知监督，得到 ViRA-Diffusion 的 92.3 navtest EPDMS。此行同时改变目标与监督配置，应与默认 DiffusionDrive-ViRA 的 91.9 分开记录，不能把 0.4 点仅归于删除辅助任务。[表 7、§4.3](https://arxiv.org/html/2610.09695v1#S4.SS3)

单张 H100 上，Rap* 加 DVGT 对齐保持 69M 参数和 20 ms 延迟，EPDMS 72.8→83.7；直接换 DINOv3-L 骨干为 351M、65 ms、83.8。此对照说明训练期迁移可以接近一次更昂贵的部署骨干替换。论文没有提供训练额外耗时与多设备推理统计，不能把“推理无新增分支”扩写为“整套流程零额外成本”。[§3.4、图 4](https://arxiv.org/html/2610.09695v1#S3.SS4)

### 负对照与监督控制支持哪些判断

随机目标让 TransFuser mIoU 从 36.4 降为 30.7、EPDMS 从 83.6 降为 82.0；Rap* EPDMS 从 72.8 降为 71.1。预训练 DVGT 则分别得到 39.1 mIoU、89.0 与 83.7 EPDMS。收益依赖预训练目标的内容，不是对齐损失天然有益。[表 4–5](https://arxiv.org/html/2610.09695v1#S3.SS3)

固定 TransFuser，对五种 VFM 改变感知辅助监督：有监督时 EPDMS 范围为 88.8–89.3，相差 0.5 点；无监督时为 86.4–89.1，相差 2.7 点。最大值只变 0.2 点，最小值下降 2.4 点，支持辅助监督主要补偿不够适配的目标。跨规划器的 Rap* 目标分差为 5.5 点，但它的结构、视角、时域和预算也不同；因果判断应优先来自同一 TransFuser 内的监督开关。[§4.1–4.2](https://arxiv.org/html/2610.09695v1#S4)

TransFuser 损失消融中，只用 KL 为 84.3，只用对比为 84.6，联合为 89.0；MSE+Cosine 为 83.6。组合效果支持关系与语义的互补，但论文没有多随机种子方差，不能把不同目标间 0.5 点的范围解释成统计显著排序。[表 S.2](https://arxiv.org/html/2610.09695v1#A3.SS2)

## 应用场景与启发

- 作者主张：规划器的部署结构固定时，训练期表示对齐能改善规划，并需要共同选择 VFM 目标与辅助监督。
- 我的判断：如果已有规划器受车端预算限制，这比直接替换大骨干更值得先测。论文的主要贡献是控制比较及负对照，不能仅用 92.3 分评价；分割更好、NAVSIM 更高和闭环更强之间仍有明显间隔。
- 待验证假设：辅助感知监督与 VFM 对齐提供部分重复信息，因此有辅助监督时目标差异较小；在相同预算下，几何目标与语义目标的互补可能集中出现在路口、边界模糊或深度歧义场景，需按场景分层验证。

## 局限与阅读风险

作者明确列出训练期大 VFM 特征提取/缓存成本，以及未覆盖多模态融合、VLA 和实车部署的限制。附录失败案例中，即使 BEV 图更完整，轨迹仍可能偏离合理驾驶行为，说明解码、时序推理与交互建模不能由表示质量替代。[附录 D.2、E](https://arxiv.org/html/2610.09695v1#A4.SS2)

七类 mIoU 的平均也掩盖困难类别：表 S.6 中行人 IoU 基线为 0.0，DVGT/DINOv3 为 0.2；静态物体多数为 0.1–0.5。这些类别没有从平均提升中获得同等程度的改善。正文表 4 省略了这两类，但 mIoU 仍包含全部七类，不能当作五类平均重新计算。[表 S.6](https://arxiv.org/html/2610.09695v1#A4.SS2)

本次仓库只有说明、许可证与结果 CSV，缺少训练实现和权重，尚不能检查实际损失归一化、特征提取细节和随机种子稳定性。官方结果文件可用于检查报告一致性，不能替代独立复现。

## 后续跟进

### 最小验证与停止条件

- 当前资源（2026-10-13，Asia/Shanghai）：[官方仓库](https://github.com/OpenDriveLab/ViRA) 的根目录为 LICENSE、README.md、navsim_results；代码与 checkpoint 发布项未完成；数据方面提供 navtest/navhard 结果 CSV，训练数据沿用 NAVSIM/OpenScene，未发布新增训练集；未见可运行的训练/评测配置或模型权重。公开结果与演示已可读，完整方法仍待发布。
- 最小实验：代码可用后，固定 TransFuser、navtrain 划分、100 epochs、总 batch 192 与同一组随机种子，比较原基线、随机 DVGT 目标、预训练 DVGT、DINOv3 四组；再对后两组开关辅助感知监督。先用相同训练子集验证损失与梯度，再扩至完整 split，不在 navhard 上调目标模型。
- 成功信号：预训练目标在至少三个种子上稳定优于随机目标，且去掉辅助监督后目标分差确实扩大；同时检查道路/行人 IoU、NC/DAC、EC 和分场景 EPDMS，并记录教师特征提取小时数与缓存容量。
- 停止/转向条件：若随机目标同样提升，优先审查正则化或训练预算混杂；若 mIoU 上升而 navhard/HUGSIM 的风险指标不改善，转向时序与交互解码；若训练成本超过直接微调骨干的预算收益，测试稀疏区域对齐或特征缓存，而不继续无差别扩大教师。

### 来源与核验记录

依据 [arXiv:2610.09695v1](https://arxiv.org/abs/2610.09695v1)，实际阅读 §2.1–2.2、§3–4、附录 A–E；核对表 1–7、S.1–S.2、S.5–S.6，图 S.1 与图 6。作者及单位从 PDF 首页确认，包括 HTML 作者块未显示完整映射的 Ziyuan Pu（Southeast University）与 Zhenjie Yang（OpenDriveLab at HKU）。两张官方 HTML 图片按原始字节保存并实际打开；相关工作重读 DiffusionDrive §3 与 DVGT §3。资源核验日期为 2026-10-13；未执行训练、推理或闭环复现。
