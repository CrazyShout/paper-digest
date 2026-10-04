---
{
  "id": "rcvla-radar-grounded-arbitration",
  "tag": "radar-occupancy-representation",
  "tags": ["radar-occupancy-representation", "end-to-end-autonomous-driving"],
  "title": "RCVLA: 4D Radar-Grounded Semantic Reasoning and Trajectory Arbitration for Autonomous Driving",
  "source": "arXiv 预印本 / arXiv:2609.32681v1 / https://arxiv.org/abs/2609.32681v1 / 固定全文 https://arxiv.org/html/2609.32681v1",
  "authors": ["Lianqing Zheng", "Xiaokai Bai", "Yixuan Luo", "Runwei Guan", "Minghao Liu", "Zhiqiang Wei", "Hui-liang Shen", "Xichan Zhu", "Zhixiong Ma"],
  "affiliations": ["Tongji University", "Zhejiang University", "The Hong Kong University of Science and Technology", "The University of Tokyo", "Shanghai Jiao Tong University"],
  "comment": "雷达先帮助语言模型理解场景，再以聚类测量参与轨迹修正和风险排序。RCVLA 的消融表明，问答更准不自动意味着规划更安全；当前收益来自自建数据集上的开环评估。"
}
---

## 一句话定位

RCVLA 让雷达信息沿两条路径参与驾驶：压缩后的语言对齐 token 用于场景问答和参考轨迹，聚类级的位置与径向速度则直接用于候选轨迹细化和风险排序。对应的消融分别检验雷达语义对齐与测量驱动的轨迹选择，判断两者各自提供了什么收益。

- 核心证据：OmniHD-QA 的 1／2／3 s 开环均值中，从 RCVLA-Sem 加到 RCVLA-Phys，L2 误差 0.348→0.259 m，碰撞率 0.576→0.175%。这是同一数据集的预测轨迹指标，不是车辆闭环事故率。[表 3](https://arxiv.org/html/2609.32681v1#S5.T4)
- 主要边界：单独加入雷达语义模块后，语言和速度理解变好，开环碰撞率却可能高于无雷达消融；新数据只公布了训练／测试样本数，序列隔离与完整资源仍待核验。

## 论文要解决的问题

### 问题与假设

输入包括六视角相机、4D 雷达点、自车状态和问题／规划指令。这里的 4D 雷达提供空间位置和 Doppler 径向速度，并不等于完整的三维运动真值。系统既输出语言回答，也输出未来轨迹。

直接将稀疏雷达压成语言 token，可能保留“前车正在减速”这样的语义，却损失做局部避碰时需要的精确测量。反过来，把所有雷达点直接交给轨迹头，也没有解决雷达与语言监督的对齐问题。因此作者保留两条路径：先得到语义参考，再用场景查询和原始测量派生的簇对候选作仲裁。[第 1、4.1 节](https://arxiv.org/html/2609.32681v1#S4.SS1)

例如，语言分支可以给出继续直行的参考，但右前方的雷达簇正快速接近；物理分支会用这些簇重新评估沿该参考生成的轨迹。它是数据驱动的候选修正和排序，不是能证明无碰撞的约束规划器。

### 相关工作与差异

| 工作与一手来源 | 已有机制 | RCVLA 的具体差异 |
| --- | --- | --- |
| Wang 等，OmniDrive，CVPR 2025；[正式论文](https://openaccess.thecvf.com/content/CVPR2025/papers/Wang_OmniDrive_A_Holistic_Vision-Language_Dataset_for_Autonomous_Driving_with_Counterfactual_CVPR_2025_paper.pdf) | 用实际和反事实轨迹构造驾驶问答，比较从语言对齐和三维感知出发的 Omni-L／Omni-Q，支持问答与开环规划 | RCVLA 增加雷达语言对齐数据及雷达测量驱动的轨迹仲裁。原 OmniDrive 的 nuScenes／DriveLM 结果与本文重训的 OmniHD-QA 结果不能直接拼榜 |
| Liao 等，DiffusionDrive，CVPR 2025；[正式论文入口](https://openaccess.thecvf.com/content/CVPR2025/html/Liao_DiffusionDrive_Truncated_Diffusion_Model_for_End-to-End_Autonomous_Driving_CVPR_2025_paper.html) | 从多模态轨迹锚附近的高斯分布开始截断扩散，以少量去噪步骤生成多种驾驶动作，并与场景条件交互 | RCVLA 将语义参考与离线锚结合，再加入占据、物体和雷达簇条件，以及 TTC 风险校准。少步扩散本身不是本文新提出的部分，新增作用需要对应消融支撑 |

## 方法和系统设计

### 输入输出与流程

**语义阶段 RCVLA-Sem。** EVA-02-L 编码多视角图像，RadarPillarNet 编码雷达 BEV。IQ-Former 和 RQ-Former 各将模态压成固定长度 token，再在较低维空间中做带门控的双向交叉注意力。增强后的 token、自车特征和提示进入 LoRA 适配的 Vicuna-7B。

问答任务用语言头逐词输出；规划任务取专用 waypoint token 的隐藏状态，经 MLP 直接回归 6 s 内 12 个连续路点，不是把轨迹坐标作为长文本逐词拼出来。并行的检测／占据解码器输出物体查询和体素查询，作为后续轨迹阶段的结构化条件。

**轨迹阶段 RCVLA-Phys。** 对齐参考轨迹至当前自车坐标，截取未来 3 s，并从离线轨迹库补充不同运动模式的锚。候选加噪后，经两层扩散解码器和两步 DDIM 细化。解码器依次使用占据查询、物体查询和 DBSCAN 雷达簇，输出五条候选轨迹及分数。最后用雷达估计的接近风险校准分数，再选定轨迹。[第 4.2–4.3 节](https://arxiv.org/html/2609.32681v1#S4.SS3)

### 关键公式与直觉

原文式 4 采用残差注入而不是覆盖原有语言对齐 token：

$$
\mathbf T'_m=\mathbf T_m+\alpha_m\operatorname{Up}_m(\widetilde{\mathbf X}_m-\mathbf X_m),\qquad m\in\{I,R\}.
$$

$\mathbf T_m$ 是原 token，$\mathbf X_m$ 是降维表示，$\widetilde{\mathbf X}_m$ 是双向交互后的表示；$\operatorname{Up}$ 将交互带来的变化映回语言空间，$\alpha_m$ 是从小正值开始学习的缩放量。雷达 token 另有 sigmoid 门控，降低噪声被无条件注入图像分支的机会。这是可学习抑制，不是传感器异常检测保证。[式 2–4](https://arxiv.org/html/2609.32681v1#S4.E4)

式 5 在参考／锚附近构造扩散起点：

$$
\mathbf x_m^i=\sqrt{\bar\alpha_i}\,\boldsymbol\mu_m+\sqrt{1-\bar\alpha_i}\,\boldsymbol\epsilon_m,
\qquad\boldsymbol\epsilon_m\sim\mathcal N(\mathbf0,\mathbf I).
$$

$\boldsymbol\mu_m$ 是第 $m$ 个候选先验，$i$ 是扩散步，$\bar\alpha_i$ 控制信号和噪声比例。这样从较合理的运动先验附近开始，而不是每次从纯噪声恢复完整驾驶动作；解码器回归的是轨迹坐标修正量。[式 5、第 4.3 节](https://arxiv.org/html/2609.32681v1#S4.E5)

风险分别进入训练软目标和推理排序。原文式 14–15 为：

$$
\boldsymbol\pi=\operatorname{softmax}\!\left(-\frac{\mathbf d+\lambda_r\mathbf r}{T_c}\right),\qquad
\mathbf p=\operatorname{softmax}(\mathbf s-\lambda_s\mathbf r).
$$

$\mathbf d$ 是各候选相对真值轨迹的平均位移误差，只能在训练时取得；$\mathbf r$ 是雷达风险，$\mathbf s$ 是模型分数，$T_c$ 为温度。$\boldsymbol\pi$ 用交叉熵监督排序，$\mathbf p$ 则将高风险候选降分。轨迹回归仍选择位移误差最小的候选，雷达风险影响排序而非重新定义回归赢家。[式 14–16](https://arxiv.org/html/2609.32681v1#S4.EGx2)

风险来自式 10–12：假设簇中心匀速运动，比较候选自车与簇的平面轮廓距离和接近速度，将最小 TTC 转成随 TTC 增大而衰减的指数风险。这里使用的是补偿后的径向速度向量；它不包含完整切向运动，突转、簇拆分、遮挡和漏测都可能影响风险值。减分也不等于硬性排除碰撞轨迹。

### 训练与推理

第一阶段先用检测和占据预训练雷达编码器，再冻结雷达编码器及 LLM，仅用 Cap4DR 训练 RQ-Former。第二阶段在 OmniHD-QA 联合学习语言、参考路点、检测和占据；LLM 主体冻结，LoRA 可训练。第三阶段冻结 RCVLA-Sem，只训练物理仲裁。训练使用四张 NVIDIA L20 和 AdamW。

IQ-Former／RQ-Former 各有 256 个查询、六层编码器；输入为六路 640×640 图像和雷达。正文给了这些结构信息，但未报告完整推理耗时、各阶段训练轮数和可直接运行的全部超参数，不能仅凭“两步扩散”认定整套 7B 模型满足实时要求。[第 4.4、5 节](https://arxiv.org/html/2609.32681v1#S4.SS4)

## 关键图与可视化结果

![原论文图 3：RCVLA语义推理与轨迹仲裁的两条路径](../../assets/papers/rcvla-radar-grounded-arbitration-figure-3.png)

左侧从相机／雷达到语言 token，向上输出问答或参考轨迹；绿色虚线把传感器特征送到右侧的结构化查询。右上还保留雷达实例和轨迹锚，不是把语言输出当作唯一世界状态。图中的雪花与火焰标记要结合三阶段训练理解，不能据此认为整个模型从头到尾同时更新。[官方图 3](https://arxiv.org/html/2609.32681v1#S4.F3)

![原论文图 4：参考轨迹、结构化查询和雷达风险共同参与候选仲裁](../../assets/papers/rcvla-radar-grounded-arbitration-figure-4.png)

从底部读起：参考和轨迹库先形成候选并加噪，进入右侧条件解码器；左上的雷达簇同时提供直接条件和显式风险，风险再影响分类评分头。这个双路径解释了为什么“已经有雷达语言 token”仍不能替代测量驱动的仲裁。图没有展示硬碰撞约束或闭环控制器。[官方图 4](https://arxiv.org/html/2609.32681v1#S4.F4)

## 实验结论与证据

### 设置与指标

Cap4DR 的 86,016 组雷达—文本／图像样本来自六个雷达数据集，用于对齐预训练；描述只保留可与雷达关联的对象关系，三个 VLM 交叉检查，模糊样本人工复核。OmniHD-QA 基于 OmniHD-Scenes，共 520,161 个 QA，其中训练 358,185、测试 161,976。场景描述由 Gemini 2.5 Pro 配合图像和标注生成，其余问答来自轨迹、占据和自车姿态等结构化标注。[第 3、5 节](https://arxiv.org/html/2609.32681v1#S3)

**上述数量统计样本／问答，独立场景数量仍需另行核对。** 固定 v1 泛称遵循划分规则，但未给出序列 ID 清单、训练和测试序列互斥的明确说明，或相邻帧／同帧多问答跨集去重证据。现有信息不足以判断是否发生泄漏，序列隔离条件也尚未得到验证。

CIDEr 测文本回答与参考描述的匹配；速度误差测关键物体速度，单位 m/s；占据问答准确率不等同于全体素占据 mIoU。规划 L2 和碰撞率按 1／2／3 s 预测轨迹计算，越低越好。通用 VLM 基线为零样本推理，OmniDrive／UniAD 则有训练，这不是统一训练预算下的架构优劣比较。

### 主要结果与比较

| 原表与设置 | 对照／RCVLA | 数值 | 应如何理解 |
| --- | --- | --- | --- |
| 表 1，OmniHD-QA 场景描述 | OmniDrive／Sem | CIDEr 92.49／102.41 | 提升 9.92 点，属于回答匹配质量 |
| 表 2，关键对象 | OmniDrive／Sem | 速度误差 3.61／2.82 m/s；意图准确率 75.38／74.25% | 速度改善，但意图低 1.13 点 |
| 表 3，三时域均值 | Sem／Phys | L2 0.348／0.259 m；碰撞率 0.576／0.175% | 仲裁贡献为 0.089 m 和 0.401 个百分点 |
| 表 3，同一评估 | BEV-Planner／Sem | L2 0.367／0.348 m；碰撞率 0.319／0.576% | 更靠近真值轨迹不保证更低碰撞指标 |
| 表 4，Sem 自身消融 | 无雷达／完整 Sem | CIDEr 98.70／102.41；碰撞率 0.391／0.576% | 语义收益与规划风险的变化方向并不一致 |

表 3 中 Phys 在 3 s 的碰撞率为 0.401%，Sem 为 1.481%；平均改善不全来自近端路点。不过，本表仍没有行动改变后其他交通参与者的响应、执行误差或实车风险结果。

### 消融与证据边界

表 5 去掉雷达簇条件后，平均碰撞率升至 0.442%；保留簇但去掉风险校准为 0.340%，完整模型为 0.175%。这支持“测量作为条件”和“测量改变排序”各有作用。去掉占据查询时退到 0.597%，说明成果也依赖有监督的场景结构，不能全部归因于 Doppler。

表 6 的延迟实验只让参考轨迹过时，物体、占据和雷达条件仍然是当前时刻；训练已经采样 0–3 s 延迟。该设置从零延迟到 3 s，L2 0.301→0.564 m，碰撞率 0.347→0.532%。零延迟数值本身就不同于表 3 的默认模型，因此应将其作为独立设置阅读，不串接成一条总榜，也不能叫作全传感器延迟鲁棒性。原文没有报告重复种子或置信区间，以上不作显著性推断。

## 应用场景与启发

- 作者主张：雷达语义对齐帮助理解，聚类测量与风险校准帮助轨迹选择，两者互补。
- 我的判断：保留语言表示与几何测量的独立接口，有助于分别检查两类信息对行动的作用。语义分数和开环碰撞率仍应分别验收，回答质量的提升本身不足以建立安全结论。
- 研究启发，待验证：在同一冻结语义参考下，比较真实雷达、移除 Doppler 和时间打乱的雷达簇；若只有正确时序 Doppler 在迎面／横穿分组中稳定改善风险排序，才更支持物理测量提供了独立信息。

## 局限与阅读风险

所有下游验证来自自建 OmniHD-QA，缺少可复核的序列划分清单、跨地点测试和置信区间。来自 VLM 的描述监督还可能让文本评价偏向标注器风格，不能当作外部真实驾驶理解测试。

径向 Doppler 不是完整速度，匀速簇外推也不能表达所有交互；雷达未看到的对象不会自动得到正确风险。两步扩散没有消除语言模型与感知编码的成本，本文没有完整在线延迟。开环碰撞率、occupancy QA 和车辆闭环安全分别属于不同终点。

固定 v1 有个别表号交叉引用不一致，本报告按 PDF 实际表题中的 1–6 编号及对应内容引用。公开资源不足限制独立核验，而不是方法已被证明不可复现。

## 后续跟进

### 最小验证与停止条件

- 当前资源：2026-09-30（UTC+8）官方 v1 仍标明代码将发布。本轮未核验 RCVLA 代码、Cap4DR／OmniHD-QA 下载、机器可读配置或权重实际开放；原始传感器数据集的开放状态不能代替新 QA 标签和该模型资源。
- 最小实验：资源可用后先审计序列和同帧 QA 是否跨集，再固定语义 checkpoint、五候选、两步去噪与同一场景集合；对比无仲裁、无雷达簇、无风险校准、完整仲裁，并加入 Doppler／时间打乱的负对照。报告候选覆盖、排序命中、各时域 L2／碰撞率、TTC 误差和端到端延迟。
- 成功信号：隔离序列后，真实测量相对负对照仍改善风险排序，且没有只靠改变候选数或标签曝光解释收益；进一步安全结论必须另做闭环测试。
- 停止／转向条件：若简单占据筛选已解释收益，或 Doppler 打乱不影响结果，就不能把改善归因为雷达物理信息；若无法核实划分与标签生成，先解决数据协议再谈方法比较。

### 来源与核验记录

依据 [arXiv:2609.32681v1](https://arxiv.org/abs/2609.32681v1)，首投 2026-09-26；2026-09-30（UTC+8）核对全文和 PDF 首页，单位按首页 Tongji／ZJU／HKUST／UTokyo／SJTU 展开。机制核对式 1–16，重点为第 4.3–4.4 节；数据划分核对第 3、5 节，结果核对 PDF 表 1–6。图 3、4 已逐张打开并对照原图注，保留官方 PNG 字节。相关机制分别重开 OmniDrive 和 DiffusionDrive 的正式来源。本次未执行推理、训练或闭环实验。
