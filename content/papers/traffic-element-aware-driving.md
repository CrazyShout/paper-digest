---
{
  "id": "traffic-element-aware-driving",
  "tag": "end-to-end-autonomous-driving",
  "tags": [
    "end-to-end-autonomous-driving"
  ],
  "title": "Plug-and-Play Traffic Element Awareness for End-to-End Autonomous Driving",
  "source": "ECCV 2026 / https://eccv.ecva.net/virtual/2026/poster/3305 / arXiv:2608.18035 / https://arxiv.org/abs/2608.18035 / HTML: https://arxiv.org/html/2608.18035v1 / Project: https://zzongzheng0918.github.io/TE-Aware-E2E-AD/",
  "authors": [
    "Zongzheng Zhang",
    "Jijun Wang",
    "Saining Zhang",
    "Wang Shuo",
    "Yiru Wang",
    "Hai Yang",
    "Yang Chen",
    "Yuwen Heng",
    "Hao Sun",
    "Anqing Jiang",
    "Hao Zhao"
  ],
  "affiliations": [
    "Institute for AI Industry Research, Tsinghua University",
    "Bosch Corporate Research, Shanghai"
  ],
  "comment": "论文将交通灯、标志的稀疏三维监督与可选车道拓扑接入六类规划器；Bench2Drive 中 VAD 的 Driving Score 从 42.3 到 56.4，而 NAVSIM 中仅加入 TE 的增益需与额外 SimScale 数据分开计算。"
}
---

## 一句话定位

这篇论文把交通灯、标志从容易被忽略的小目标变成显式规划信号：用三维位置和类别监督视觉特征，再按数据集条件加入“哪盏灯约束哪条车道”的拓扑。价值在于跨规划器检验接口，而不是保证预测轨迹一定守规则。

- 核心证据：CARLA Bench2Drive 中 VAD 的 Driving Score 从 42.3 提至 56.4，成功率从 15.00% 提至 21.30%，平均推理步时从 278.3 增至 282.5 ms。[原文表 4](https://arxiv.org/html/2608.18035v1#S5.T4)
- 主要边界：不同平台实际接入的模块不同。NAVSIM 实验只有交通元素分支，没有训练拓扑预测器；联合额外模拟数据的收益不能全部算给交通元素。

## 论文要解决的问题

### 为什么检测到交通灯还不够

同一路口可同时看到直行、转弯和旁边道路的信号。规划器既要识别红绿灯或禁止转向标志，也要知道它是否约束当前 ego lane。仅把所有灯作为全局语义特征，可能把旁车道红灯当作本车停车指令；只保留路网连通性，又可能生成几何上可达但规则不允许的转弯。

交通元素稀疏、像素面积小，普通 BEV 辅助分割易被密集背景和车辆任务主导。作者假设独立监督能保留规则语义，ego 相关拓扑能减少无关信息；这要通过规划指标验证，检测精度或一张成功图本身不够。[原文 §3–4](https://arxiv.org/html/2608.18035v1#S4)

### 相关工作与具体差异

| 工作与一手来源 | 已有机制 | 本文改变的环节 |
| --- | --- | --- |
| Jiang 等，VAD，ICCV 2023；[正式论文 §3.1–3.3](https://openaccess.thecvf.com/content/ICCV2023/papers/Jiang_VAD_Vectorized_Scene_Representation_for_Efficient_Autonomous_Driving_ICCV_2023_paper.pdf) | 用车辆运动向量、地图向量和 ego-query 交互规划，并施加碰撞、道路边界和车道方向约束。 | 增加交通灯/标志的位置与类别分支、规则归属拓扑及规划条件；不能说 VAD 原来完全没有规则或地图约束。 |
| Wu 等，TopoMLP，ICLR 2024；[原文 §3.1–3.4](https://arxiv.org/html/2310.06753v2#S3)，[正式入口](https://proceedings.iclr.cc/paper_files/paper/2024/hash/c705ba25f183b875c9359ef83fa262e8-Abstract-Conference.html) | 检测三维车道中心线和二维交通元素，用包含位置编码的成对 query 与 MLP 预测 lane-lane、lane-traffic 关系。 | 本文直接借用其拓扑预测，再筛选 ego 子图送入规划。新增证据在下游驾驶表现，不是提出新的车道拓扑预测器。 |

## 方法和系统设计

### 数据构建与部署输入分开看

离线三维标注构建先在前视图找到二维灯/标志框，用冻结 UniDepthV2 估深，再以标定和 LiDAR 几何筛选对应深度、反投影成三维中心。nuScenes 使用 OpenLane-V2 中已有的二维标注并补充自动检测；Bench2Drive 有原生三维元素和拓扑；NAVSIM 依赖 OpenLane-V2 上训练的 YOLO 检测器自动生成伪标签。[原文 §4.1、附录 B](https://arxiv.org/html/2608.18035v1#S4.SS1)

训练规划器时，交通元素 head 从视觉中间特征预测三维位置/类别或 BEV 热图；这些预测特征再进入规划解码器。部署时使用模型预测的元素，不读取真实灯状态标注。离线用 LiDAR 辅助生成监督，不等于所有 camera-only 规划器上线时都要运行 LiDAR 融合管线。

### 关键公式与信息流

附录式 A.2–A.3 将二维检测变成几何位置：

$$
p_i^{\mathrm{cam}}=z_iK^{-1}[u_i,v_i,1]^\top,\qquad
p_i^{\mathrm{LiDAR}}=R_{\mathrm{cl}}p_i^{\mathrm{cam}}+t_{\mathrm{cl}}.
$$

$(u_i,v_i)$ 是框中心像素，$z_i$ 是结合深度先验与可用点云选出的深度，$K$ 是相机内参，$R_{\mathrm{cl}},t_{\mathrm{cl}}$ 是相机到 LiDAR 坐标的刚体变换。三维位置有尺度，能与规划空间对齐；但深度错误会直接移动规则对象。这里的输出是 LiDAR 坐标，不应把正文附近的 world 表述理解成已经统一到任意全球坐标系。[原文附录 B.1](https://arxiv.org/html/2608.18035v1#Pt0.A2.SS1)

总目标在原规划和辅助任务上加入交通元素监督，按原文式 1：

$$
\mathcal L=\mathcal L_{\mathrm{plan}}+\sum_k\lambda_k\mathcal L_{\mathrm{aux}}^{(k)}+\lambda_{\mathrm{TE}}\bigl(\mathcal L_{\mathrm{L1}}^{\mathrm{loc}}+\mathcal L_{\mathrm{focal}}^{\mathrm{cls}}\bigr).
$$

定位项约束三维中心，focal loss 增加难分类和稀疏前景的重要性。它们只鼓励模型学规则对象，没有把“红灯不得通行”编码为硬可行域。具体权重依骨干而异：VAD 附录给出定位 0.25、分类 2.0；LTF 使用半径 2 的高斯中心热图和权重 1.0 的 focal loss，不能把主式当作所有平台相同的损失配置。[原文附录 D](https://arxiv.org/html/2608.18035v1#Pt0.A4)

### 可选拓扑与不同规划器的接法

TopoMLP 输出车道—车道邻接 $R_{\mathrm{LCLC}}$ 与车道—交通元素关系 $R_{\mathrm{LCTE}}$；按 ego 位置定位当前车道，只保留相关车道和控制它的元素，转成包含类别、数量、直行/转向关系的结构化文本。VAD 使用冻结 BERT 的 CLS 表征与 ego、TE 特征拼接；Orion 则把结构化拓扑文字加进原 LLM 文本上下文，沿用其语言推理流程。[原文 §4.3、附录 D.1–D.2](https://arxiv.org/html/2608.18035v1#S4.SS3)

NAVSIM 没有训练这一拓扑预测器。LTF/DiffusionDrive 将独立 TE 热图经最大池化、MLP 对齐到 BEV，再拼入规划输入；DrivoR 把 TE 表征加到场景 token，使候选生成与评分都可读取。因而 NAVSIM 的提高验证的是 TE 条件，不验证完整 BERT 拓扑分支。[原文 §5.2](https://arxiv.org/html/2608.18035v1#S5.SS2.SSSx2)

### 训练预算与推理成本

VAD 从预训练权重微调 20 epoch、AdamW 学习率 $2\times10^{-5}$；LTF 微调 20 epoch、Adam 学习率 $10^{-5}$；DiffusionDrive 先训练 100 epoch 再增加 20 epoch 微调。本文列出 nuScenes/Bench2Drive 使用 8 张 A100、NAVSIM 使用 4 张 RTX 3090，但没有统一的 GPU-hour 对照。[原文附录 D](https://arxiv.org/html/2608.18035v1#Pt0.A4)

冻结的 BERT/UniDepthV2 与可训练 TE/拓扑/规划模块职责不同，不能把冻结理解为整模型不训练。报告的在线步时不包含离线生成伪标签的总成本；对于六个骨干，也应检查新增训练是否有相同预算的原模型继续训练对照。

## 关键图与可视化结果

![原论文图 3：三维交通元素标注构建及可选拓扑规划条件](https://arxiv.org/html/2608.18035v1/method.png)

上半部从二维检测、深度和点云得到三维点；下半部是学习路径，交通元素辅助任务影响视觉特征，拓扑文字经语言编码进入规划。雪花/火焰分别标记冻结/训练组件。它概括完整设计，不能当作 NAVSIM 必然包含语言分支的证据。[原图注](https://arxiv.org/html/2608.18035v1#S4.F3)

![原论文图 4：NAVSIM-v2 场景中 LTF、LTF 加 SimScale 和本文轨迹对照](https://arxiv.org/html/2608.18035v1/navsimv2_vis.png)

先看前视图里的绿灯和直行标志，再看右侧三条预测是否沿正确道路前进。它说明规则线索可能帮助减少横向漂移；右侧 GT 与预测的接近程度只是该样例，不能由此分离额外训练、TE 监督与所选场景的贡献。[原图注](https://arxiv.org/html/2608.18035v1#S5.F4)

## 实验结论与证据

### 设置与指标

nuScenes 是日志开放环，L2 测与专家轨迹的距离，碰撞率测未来车辆占用重叠；它不充分覆盖闯灯和越界。NAVSIM-v1 的 PDMS 使用非反应式背景；v2 navhard-two-stage 的 EPDMS 加入方向、灯、车道保持和舒适性条目及两阶段聚合。v2 背景车辆通过 IDM 响应，但每个四秒片段内没有连续规划反馈，不能简称为完整交互闭环。[NAVSIM v2 §3.1](https://arxiv.org/html/2506.04218v3#S3.SS1)

Bench2Drive 是 CARLA 闭环，规划器以 2 Hz 运行。DS 综合路线完成与违章惩罚，SR 是无违规完成路线的比例；Efficiency 衡量相对交通速度，Comfortness 衡量加速度、转向动态和 jerk。提高 DS 不意味着所有驾驶质量指标都改善。[原文实验与附录 C](https://arxiv.org/html/2608.18035v1#S5.SS1)

### 主结果：把 TE 与额外数据分开

| 评测与原表 | 配置对照 | 指标变化 | 可归属的变化 |
| --- | --- | --- | --- |
| nuScenes，表 1 | VAD → TE+Topo | 平均 L2 0.72 → 0.60 m；碰撞 0.22% → 0.17% | 完整新增监督和条件。Topo-only 碰撞为 0.16%，完整配置并非每项最优。 |
| NAVSIM-v1，表 2 | DrivoR → +TE | PDMS 93.1 → 94.4 | 同基线下增加 TE，提升 1.3 分。 |
| NAVSIM-v2，表 3 | LTF → +TE | EPDMS 25.1 → 28.9 | 提升 3.8 分。 |
| 同上 | DiffusionDrive → +TE | 29.4 → 32.7 | 提升 3.3 分。 |
| 同上 | DrivoR → +TE | 48.3 → 51.8 | 提升 3.5 分。 |
| 同上 | DrivoR → SimScale+TE | 48.3 → 57.9 | 提升 9.6 分，同时增加模拟数据，不能全归给 TE。 |

正文概括“约 10 EPDMS”需要按表 3 拆开理解；仅 TE 的三组增益约 3–4 分。表中带 † 的其他方法使用 benchmark bug fix 前的指标，不能与修正版直接排名。Orion 的平均 L2/碰撞率从 0.34 m/0.37% 到 0.26 m/0.23%，但其输入、体量及训练路径与 VAD 不同，只适合各自基线内比较。[原文表 1–3](https://arxiv.org/html/2608.18035v1#S5.T1)

Bench2Drive 表 4 中，VAD 的 DS/SR 为 42.3/15.00% → 56.4/21.30%，DriveTransformer-Large 为 63.46/35.01% → 68.29/39.61%。同时 Efficiency 从 157.94 降至 125.64、100.64 降至 82.45；作者解释为减少过激行为，这是解释，不是已证明的因果关系。A6000 上步时分别增加 4.2 和 4.8 ms，基于同一骨干的代价较小，但总体仍约 0.2–0.3 秒。[原文表 4](https://arxiv.org/html/2608.18035v1#S5.T4)

### 消融与稳健性

LTF 的表示消融（表 5）中，2D TE 为 28.1、全图深度为 27.7、LiDAR 聚类 TE 为 27.9、仅交通灯为 26.7，完整 TE 为 28.9 EPDMS。单独位置、去掉类别的变体为 26.2，说明类别语义有贡献；不能仅从“有一个辅助任务”解释全部增益。

表 6 中独立 head 下 focal loss 比交叉熵高 0.7 分，保持其余配置一致时拼接比交叉注意力高 1.4 分。把 TE 当普通 BEV 类的配置反而为 24.3，低于基线 25.1；但从这一行到独立 head 同时改变了 head 与 loss，不能把两行差值全部归给 head。[原文表 5–6](https://arxiv.org/html/2608.18035v1#S5.T5)

表 7 的预测拓扑与真值拓扑在 VAD 上平均碰撞率均为 0.16%，说明该设置能容忍一定预测误差，未证明任意错配都安全。附录表 A.2 已覆盖白天/夜间：深度 AbsRel 从 0.088 增至 0.160，三秒 L2 从 0.88 增至 1.33 m，表明低照度相关退化实际存在。深度、漏检、假阳性扰动曲线不能替代灯—车道关联错误、组合故障及闭环连锁后果的测试。

## 应用场景与启发

- 作者主张：交通元素可跨架构、跨数据规模改善规划。
- 我的判断：论文支持显式学习稀疏规则对象，尤其适合作为已有规划器的局部升级；“轻量”主要指相对同骨干增量，不代表系统整体小或具有硬安全保证。
- 待验证假设：把交警手势、临时施工指令作为带作用车道、时间有效期和置信度的规则对象，比直接增加一个通用视觉标签更容易改变规划；需要专门检验人与灯冲突及无关车道干扰。

## 局限与阅读风险

作者明确承认上游检测和估深误差、仅使用当前规则状态、闭环长尾覆盖不足。论文已有夜间分组，不能再写成完全未测夜间；未测的是更系统的低照度、强遮挡、错误关联组合压力。BERT 优于图编码器的结果不等于证明图网络必然过平滑，更不能推出语言编码完整保存了因果规则。

多骨干成功是可移植性证据，但训练配方、额外微调和数据规模不统一，不能形成严格同算力总排名。文中 Orion 主表带 ego-status 标记，而附录描述移除显式 ego status，这一配置差异本次未获得代码解释；因此保留原表数值但不据此比较输入公平性。所有提升均为论文报告值，缺少重复实验区间。

## 后续跟进

### 最小验证与停止条件

- 资源状态（2026-09-12）：[官方项目](https://zzongzheng0918.github.io/TE-Aware-E2E-AD/) 和 [ECCV 论文页](https://eccv.ecva.net/virtual/2026/poster/3305) 已可访问。[GitHub](https://github.com/ZZongzheng0918/TE-Aware-E2E-AD) 发布 YOLO/UniDepth 数据生成脚本；[Hugging Face](https://huggingface.co/datasets/Zzz0918/Traffic_Elements) 文件列表含 nuScenes、NAVSIM、SimScale 标注压缩包及 YOLO best.pt。本次检查的仓库树未包含六种规划器完整训练接入和规划权重；看见检测权重不能写成全部模型已发布。
- 最小实验：先核实标注 token 与 split，用公开 LTF 或 VAD 实现一个 TE 分支。固定预训练起点、训练更新数和额外数据，比较继续训练基线、2D TE、3D TE；VAD 再增加预测拓扑与随机置换灯—车道关系对照。
- 成功信号：同预算下收益在多个训练重复出现；正确拓扑优于置换拓扑，相关车道红灯违规下降而无关车道红灯不造成不必要停车，效率和舒适性代价可量化。
- 停止/转向条件：收益被同预算继续训练消除，或错误关联使碰撞/闯灯大幅增加；优先改善关联可靠性和不确定性旁路，再扩展更多规则对象。

### 来源与核验记录

本稿固定依据 [arXiv:2608.18035v1](https://arxiv.org/html/2608.18035v1)，2026-09-12 重开正文、附录和 PDF 首页，原图 3、4 已逐张检查；相关工作分别重开 VAD 正式全文与 TopoMLP v2。正式 ECCV 页面用于发表状态核验，技术数字仍按上述固定 arXiv 版本。检测/数据文件仅核实列表和说明，未下载大文件、运行训练或完成复现。
