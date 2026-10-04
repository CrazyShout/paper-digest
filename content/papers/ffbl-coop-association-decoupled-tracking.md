---
{
  "id": "ffbl-coop-association-decoupled-tracking",
  "tag": "cooperative-autonomous-driving",
  "tags": ["cooperative-autonomous-driving", "dynamic-scene-representation"],
  "title": "FFBL-Coop: Association-Decoupled Cooperative 3D Multi-Object Tracking",
  "source": "arXiv 预印本 / arXiv:2610.01750v1 / https://arxiv.org/abs/2610.01750v1 / 固定全文 https://arxiv.org/html/2610.01750v1",
  "authors": ["Haoxin Wu", "Xiaokai Bai"],
  "affiliations": ["College of Information Science and Electronic Engineering, Zhejiang University"],
  "comment": "先让远端观测参与对象更新，再决定它继承哪个轨迹身份，避免一次跨视角匹配同时控制融合与 ID。结果支持持久映射的作用；压缩保持 AP／AMOTA 接近原值时，身份切换次数仍会增加。"
}
---

## 一句话定位

FFBL-Coop 把协同跟踪中的两个判断拆开：先判断远端信息是否值得进入自车对象表示，完成特征与位置修正后，再判断它属于哪条已有轨迹。它解决的是跨视角信息利用和跨时间身份连续性之间的冲突。

- 核心证据：V2X-Seq 上，在同一 Full checkpoint 内，只保留持久映射的 AMOTA 为 60.5，只保留逐帧关联则为 32.5，完整系统为 61.1；AP 分别为 54.7、54.6、54.8。[表 14](https://arxiv.org/html/2610.01750v1#A5.T14)
- 主要边界：这些是汽车检测与多目标跟踪结果。论文没有接入轨迹预测器或自车规划器，因此身份连续性对驾驶安全的收益仍需下游验证。

## 论文要解决的问题

### 为什么同一匹配不应同时决定融合与身份

同一辆车从路侧看是侧面，从自车看可能只露出车尾；两端位置估计也会有偏差。若一次匹配既决定把远端特征放在哪个 query，又决定继承哪个 ID，匹配错一次就可能同时污染对象表示与整条轨迹。

FFBL-Coop 接收车端及路侧／无人机图像。远端发送对象 query，包括特征、三维状态、置信度和来源 ID。系统假设两端坐标变换、时间戳和远端速度可用，并用匀速近似补偿延迟。输出是带置信度和持久 ID 的三维框，不是控制指令。

### 相关工作已经做到哪里

| 工作与一手来源 | 已有机制 | 本文的具体变化 |
| --- | --- | --- |
| Wang 等，SparseCoop，AAAI 2026：[正式论文页](https://ojs.aaai.org/index.php/AAAI/article/view/37952)，[原文 §3.3–3.4](https://arxiv.org/html/2512.06838v1#S3.SS3) | 用含几何与速度的稀疏 query 对齐两端状态；保留未匹配对象，对匹配特征先粗融合，再从自车图像细化 | FFBL 的增量是把 query 放置与轨迹 ID 继承分开，并在细化后维护持久映射；“保留未匹配 query”和“从自车图像细化”并非本文独有 |
| Hu 等，CodeFilling，CVPR 2024：[正式全文 §4.2](https://openaccess.thecvf.com/content/CVPR2024/papers/Hu_Communication-Efficient_Collaborative_Perception_via_Information_Filling_with_Codebook_CVPR_2024_paper.pdf) | 用信息需求选择 BEV 消息，用共享码本索引替代高维特征值，优化检测—通信取舍 | FFBL 将码本压缩用于对象 query，随后研究身份连续性；码本思想本身来自已有协同感知研究，本文对照关注压缩对跟踪而非仅 AP 的影响 |

## 方法和系统设计

### 放入槽位、重新观察、最后绑定 ID

各端先通过 ResNet-50／FPN 和循环 query 解码器提取对象。路侧使用 BEV 表征，车端和空端则根据三维 anchor 向相机图像投影读取特征。远端消息解码后，以预测速度补偿时间差，再变换到当前自车坐标系。[§3.2–3.3](https://arxiv.org/html/2610.01750v1#S3.SS2)

CSA（Confidence-ranked Slot Admission）在第一层解码与时间更新之后执行。它按远端置信度选 query，将其放入远离现存轨迹的空闲槽位；此时只记下来源 ID 和分配的槽位，不确定自车轨迹 ID。

URA（Unified Representation Aggregation）让这些 query 与原生自车 query 一起经过剩余解码层，用远端语义指导自车图像采样，修正特征和 anchor。未被远端初始化的 query 还可从附近远端对象读取门控上下文。

最终 CPIA（Cooperative-Priority Identity Anchoring）才分配身份：优先复用有效的“远端 ID→自车 ID”映射；没有映射的对象再用细化后的特征和位置关联已有轨迹；仍未关联的对象获得新 ID。ID 转移时，旧槽位放弃该身份，防止两个槽位同时输出同一条轨迹。[§3.4](https://arxiv.org/html/2610.01750v1#S3.SS4)

还有一条容易忽略的路径：有效远端对象若中心不投影到任一自车图像，便直接沿框输出路径保留，不参加区域内的 CSA／URA。于是“协同覆盖扩展”和“两端共同看见时的特征细化”是两种不同收益。

### 三个关键计算

**训练时的槽位分配是软的。** 原文式 9：

$$
\pi_{ji}=
\frac{\exp(-d_{ji}/T_{\mathrm{CSA}})}
{\sum_{i'\in\mathcal F_t}\exp(-d_{ji'}/T_{\mathrm{CSA}})},
\qquad
d_{ji}=\lVert\tilde p_j^{\mathrm{coop}}-p_i\rVert_{\mathrm{BEV}}.
$$

$j$ 是已选远端 query，$i$ 是可用自车槽位，$\mathcal F_t$ 排除了太靠近活动轨迹的空槽。$\pi_{ji}$ 决定远端证据分摊到哪些槽位，而非身份匹配概率。后续按权重聚合特征与中心；推理则按置信度从高到低，将每个候选写入最近的未用空槽。训练的软聚合与部署的硬写入不能混为同一步操作。

**关联监督在细化后计算。** 将原文式 14–16 的目标单独写出：

$$
A=\operatorname{softmax}_{\mathrm{row}}
\left([S/T_{\mathrm{id}}\ \ b_{\mathrm{dust}}\mathbf1]\right),
\qquad
\mathcal L_{\mathrm{id}}=-\sum_j\log P_{j,y_j}.
$$

这里方括号表示在每行末尾追加一个未匹配列，$S$ 是远端 query 与活动自车轨迹的关联 logits，$y_j$ 由真值对象身份给出。$T_{\mathrm{id}}=0.2$，未匹配 logit 为零；多个远端 query 时，$P$ 来自原文规定的 20 次行列缩放，单个 query 时保留 $A$。该损失每帧施加一次，权重为 1。[式 14–17](https://arxiv.org/html/2610.01750v1#S3.E14)

推理还依赖映射有效期、距离门限和“一条 ID 只归一个输出”的规则，并非直接取 $P$ 的最大项。未匹配列不用于推理时的拒绝阈值；候选对通过排序、距离和唯一性约束筛选。因此低质量来源 ID 或一次错误接受的映射，可能持续影响后续帧。

**通信成本要算完整对象消息。** 原文式 20：

$$
C_{\mathrm{tx}}=f_{\mathrm{tx}}\bar N_{\mathrm{tx}}b_q
\quad[\mathrm{B/s}].
$$

$f_{\mathrm{tx}}$ 是发送频率，$\bar N_{\mathrm{tx}}$ 是过滤和接收前的平均发送对象数。每个 query 的状态、置信度和来源 ID 共 52 bytes；256 维 float32 特征另需 1,024 bytes，总共 1,076 bytes。共享码本不超过 256 项时，特征用一字节索引代替，整条消息为 53 bytes；更大的受测码本为 54 bytes。这不是只计算特征索引的压缩比。[附录 G](https://arxiv.org/html/2610.01750v1#A7)

### 训练、推理与预算

合作阶段从单端预训练 checkpoint 开始，冻结骨干与 FPN，训练合作模块和全部六层解码器。检测分类、框回归和去噪损失逐层施加，身份损失连接远端 query 与时间保留的最终活动轨迹。

附录 G 报告四卡混合精度、batch 8、AdamW 学习率 $3\times10^{-4}$。V2X-Seq／Griffin-25M 的单端预训练分别为 800／100 epochs，软分配微调为 4／8 epochs；Griffin 另给出 24 epochs 的初始合作身份绑定阶段。GPU 型号、总训练时间和实测推理时延未报告，V2X-Seq 初始合作阶段的完整时长也未写清。

V2X-Seq 使用 360 个槽位、35 个接纳预算；Griffin 使用 900 个槽位、50 个接纳预算。发送对象数与接收端接纳预算不同，不能拿后者代入通信公式。

## 关键图与可视化结果

![原论文图 2：对象消息的压缩、对齐、融合与后置身份绑定](../../assets/papers/ffbl-coop-association-decoupled-tracking-figure-2.png)

从左侧两端特征提取开始，经上方码本通信、延迟补偿与坐标变换，进入下方 CSA→URA→CPIA。最右侧依次画出映射复用、学习关联和新轨迹创建；先更新特征与 anchor，后决定 ID，是这张图的重点。右上角的 BEV 图用于展示结果，不意味着模型使用 LiDAR 作为训练输入；附录 G 明确训练为 camera-only。[官方图 2](https://arxiv.org/html/2610.01750v1#S2.F2)

![原论文图 9：完整 FFBL-Coop 与 sticky-ID 变体在连续五帧中的身份变化](../../assets/papers/ffbl-coop-association-decoupled-tracking-figure-9.jpg)

从左到右追踪同一车辆在五个时间点的框颜色。上两行是 Full 的图像／BEV 输出，下两行是 Sticky FFBL-Coop。颜色编码轨迹身份：完整模型中若干目标保持相同颜色，sticky 变体出现身份更换。该图比较的是本方法的身份管理变体，不是 SparseCoop；它展示局部案例，总体稳定性仍以 IDS 和 AMOTA 为准。[官方图 9、表 14](https://arxiv.org/html/2610.01750v1#A5.F9)

## 实验结论与证据

### 数据、评测范围与可比性

V2X-Seq-SPD 是真实车路协同数据，采用官方 2 Hz 验证协议；Griffin-25M 是空地协同子集，其[官方基准](https://github.com/wang-jh18-SVM/Griffin)基于 CARLA–AirSim 仿真。两组默认评测自车周围 50 m 内的 car 类；训练还包含 bicycle 和 pedestrian，但主表未给这些类别的跟踪结论。

AP 平均四个中心距离阈值 0.5／1／2／4 m 的检测精度，并非 IoU 阈值 AP。AMOTA 是跨召回率的平均跟踪准确性，综合漏检、误检和身份错误；IDS 是身份切换次数，越少越好。本文表格统一用百分制，原摘要的 0.611 对应表中的 61.1，不能混作 0.611%。[§4、附录 G](https://arxiv.org/html/2610.01750v1#S4)

### 系统结果与受控身份实验

| 原表 1，官方 validation | 方法 | AP，%，↑ | AMOTA，%，↑ | 分析载荷，B/s，↓ |
| --- | --- | ---: | ---: | ---: |
| V2X-Seq | SparseCoop | 53.0 | 42.1 | 31,700 |
| V2X-Seq | FFBL-Coop | 54.8 | 61.1 | 8,480 |
| Griffin-25M | SparseCoop | 55.9 | 50.9 | 97,300 |
| Griffin-25M | FFBL-Coop | 65.3 | 68.8 | 33,700 |

对应 AP 增益为 1.8／9.4 个百分点，AMOTA 增益为 19.0／17.9 个百分点。主表保留基线各自的架构、训练和通信核算；Long-SCOPE 的 0–50 m 子集另作参考行。上述差值是系统比较，不能直接量化“延后绑定 ID”这一设计的独立收益。[表 1](https://arxiv.org/html/2610.01750v1#S4.T1)

更接近机制检验的是表 2：保留 Hungarian 放置和 URA，只加入 CPIA，V2X-Seq AMOTA 从 50.4 升至 60.1，IDS 从 116 降到 69；再改用 CSA，AMOTA 升到 61.1，但 IDS 为 70，略高于 69。完整方法并非每个错误指标都最小。

表 14 固定 checkpoint 后，Map-only 的 AMOTA 为 60.5，Full 为 61.1，Association-only 为 32.5。大部分身份连续性收益来自持久复用；学习关联在这一设置下再增加 0.6 个百分点。不能将整体 19.0 点的系统增益全部归给学习关联器。

### 压缩、延迟与负结果

| V2X-Seq，同一 Full checkpoint，表 6 | 载荷，B/s，↓ | AP，%，↑ | AMOTA，%，↑ | IDS，次，↓ |
| --- | ---: | ---: | ---: | ---: |
| 未压缩特征 | 172,000 | 54.9 | 61.2 | 49 |
| 256 项码本 | 8,480 | 54.8 | 61.1 | 70 |
| 只发框和元数据 | 8,320 | 50.6 | 50.2 | 199 |

压缩后 AP／AMOTA 仅各降 0.1 点，但 IDS 增加 21 次。16 项与 256 项码本都使用一字节索引，因此两者稳态载荷一样；扩大码本只改变初始化同步开销及量化误差。这说明应同时看身份错误和码本同步成本。[表 6、附录 F–G](https://arxiv.org/html/2610.01750v1#S4.T6)

1° 偏航扰动使 AP 从 54.8 降至 49.4，AMOTA 从 61.1 降至 60.4（表 4）。Griffin 注入 200 ms 延迟后，AP 从 65.3 降至 59.4，AMOTA 从 68.8 降至 68.4（表 5）；测试启用了匀速补偿，采用旧时间戳观测，未测真实通信队列和丢包。AMOTA 较稳不表示定位和检测没有退化。

模块消融各训练三次，按每次验证 AMOTA 选 checkpoint，再报告中位 AMOTA 那次的全部指标；论文没有给三次运行的离散程度。表 14 的 CSA／CPIA 是固定权重干预，而 URA 替代模块需重训，两种证据不能混写。[附录 E、G](https://arxiv.org/html/2610.01750v1#A5)

## 应用场景与启发

- 作者关注车路和空地协同中，由视角、定位差异引起的对象关联与身份连续性问题。
- 可借鉴的接口是把“接纳一条观测”与“永久继承一个身份”分开，并保留显式 ID 所有权规则。共享视野内的特征细化与视野外的框补充应分别评估。
- 待验证假设：持久映射在远端 ID 稳定时有效，却可能在远端重启或轨迹碎裂时传播旧错误；加入可撤销的映射验证，可能比继续增强逐帧关联网络更有价值。

## 局限与阅读风险

附录 H 明确指出，持久映射依赖来源 ID 一致性，已接受的错误也可能被带到后续帧。区域外框拼接保留远端定位误差；区域内融合需要有用的自车视觉证据。相机投影覆盖不等于目标没有被遮挡。

论文没有用下游规划或预测检验 IDS 变化的后果，也未系统覆盖可变延迟、丢包和多个远端主体之间的身份协调。B/s 排除了包头及一次性码本同步，未测端到端网络时延。单端预训练较长，缺少 GPU 型号和推理计时，实际部署成本仍需测量。

## 后续跟进

### 最小验证与停止条件

- 资源状态（2026-10-05）：论文只声明将发布代码；官方摘要、全文和精确题名检索未找到可核实的实现、独立配置或权重。附录 G 给出大部分流程参数，但这不能代替可运行仓库。V2X-Seq 和 [Griffin 官方仓库](https://github.com/wang-jh18-SVM/Griffin)有数据与基准说明，本文 checkpoint 和码本未核实公开。
- 最小实验：取得官方权重、码本和逐帧预测后，在同一 V2X-Seq 验证序列固定图像、框和消息字节，比较 Full、Map-only、Association-only；再人为重编号 5% 的来源轨迹，单独记录 AMOTA、IDS、错误 ID 持续时长和漏检。5% 是本报告提出的压力测试，不是论文实验。
- 成功信号：复现表 14 的原始顺序后，映射收益在适量来源 ID 扰动下仍能保留，且不会使错误身份长期粘连。
- 停止／转向条件：若无扰动也无法复现，先核对序列重置、框输出路径和指标分母；若轻微 ID 重编号便抵消主要增益，暂停扩展关联网络，改测映射过期与错误撤销机制。代码未发布时只准备数据与评估器。

### 来源与核验记录

依据 [arXiv:2610.01750v1](https://arxiv.org/abs/2610.01750v1)，于 2026-10-05 阅读方法、主实验及附录 B–H。作者两人及浙江大学单位对照官方 PDF 首页；PDF 标注 ICLR 2027 under review，按预印本处理。图 2、图 9 已逐张打开、核对图注，保存原文件；图 9 的下方对照为 sticky-ID 变体。数字依据表 1–6、14，公式依据式 9、14–17、20。HTML 把表 3–6 合入同一锚点且部分正文交叉引用错指表 6，本报告按显示表题区分。相关工作分别核对 SparseCoop 原文 §3.3–3.4、AAAI 正式页，以及 CodeFilling CVPR 正式全文 §4.2。本次未运行检测、跟踪或复现实验。
