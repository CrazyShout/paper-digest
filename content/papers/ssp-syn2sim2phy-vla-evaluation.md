---
{
  "id": "ssp-syn2sim2phy-vla-evaluation",
  "tag": "autonomous-driving-testing",
  "tags": ["autonomous-driving-testing", "end-to-end-autonomous-driving", "agentic-driving"],
  "title": "SSP: An Event-Matched Syn2Sim2Phy Cross-Domain Evaluation Framework for Autonomous-Driving VLA Models",
  "source": "arXiv:2608.14024 / https://arxiv.org/abs/2608.14024 / HTML: https://arxiv.org/html/2608.14024",
  "authors": ["Haojie Feng", "Peizhi Zhang", "Xinrui Zhang", "Zhuoren Li", "Junpeng Huang", "Xiurong Wang", "Dongxiao Yin", "Yuxiang Zhang", "Junfan Zhu", "Lu Xiong"],
  "affiliations": ["College of Automotive and Energy Engineering, Tongji University", "Tongji Automotive Design and Research Institute Co., Ltd.", "Hubei Jingchu Humanoid Robot Co., Ltd.", "University of Chicago"],
  "comment": "SSP 不再拿三个域里标签相同但内容不同的视频比较 VLA，而是把同一 cut-in 或弱势交通参与者事件从合成视频编译到 CARLA 和封闭试验场，并在进入评测前审计事件身份。当前只有两类事件，但提供了少见的物理执行证据链。"
}
---

## 一句话定位

SSP 将跨域 VLA 评测的单位从“都叫 cut-in 的视频”收紧到同一个可审计交互事件：冻结角色、拓扑、冲突关系、通过顺序和事件阶段，再在合成视频、CARLA 和封闭试验场中构造对应观测，统一比较语言与一秒轨迹输出。最值得借鉴的是事件资格审计和行为链拆分，而非仅看三域总分排序。

- **核心证据**：两类事件的宏平均 IVCS 在 Synthetic/Simulation/Physical 为 0.259/0.291/0.325，但 cut-in 由 Simulation 以 0.340 领先，说明该小配对集没有统一的域优劣排序。
- **主要边界**：目前只有 cut-in 与 VRU crossing；物理执行用于采集事件视频，论文未将被测 VLA 的轨迹在线执行为完整车辆闭环。

## 论文要解决的问题

### 比较对象与假设

两个都标注为 cut-in 的视频，可能有不同的车道、侵入方向、相对速度、触发时刻和冲突位置。若分别从三个域挑选实例，模型分数差异就同时包含内容难度和域差异。SSP 要固定事件身份，而允许纹理、背景、局部速度、成像及执行扰动变化。[原文 §1.2、§3.1](https://arxiv.org/html/2608.14024v1#S3.SS1)

被测系统也并不共享接口：自由文本、离散动作、速度–曲率与不同频率的轨迹，不能直接逐项比总分。作者把输出无效、语义缺失、语义错误、动作错误和文字–轨迹不一致分开，避免“说得流畅”遮蔽轨迹问题。

共享事件规格只能控制明示的因素。未建模的目标尺度、遮挡、成像和动力学仍可变化，因此这是一种减少混杂的工程协议，不是保证所有潜变量相同的因果实验。

### 相关工作与差异

| 工作与一手来源 | 已有机制 | SSP 的具体差异 |
| --- | --- | --- |
| Li 等，AVD2，ICRA 2025（[作者项目页](https://an-answer-tree.github.io/)；[v2 §III-A–III-B](https://arxiv.org/html/2502.14801v2#S3)） | 从事故描述和避险说明生成/增强事故视频，用 EMM-AU 增广事故视频理解；视频生成和描述模型是其研究对象。 | SSP 取其中可执行、可识别的事件为源，增加结构化身份约束和下游域审计。它没有提出新的视频扩散训练目标，合成图像也不直接成为物理真值。 |
| Jia 等，Bench2Drive，2024 论文 v3（[§3.3](https://arxiv.org/html/2406.03877v3#S3.SS3)） | 通过 CARLA 的 44 类交互、220 条短路线评测闭环驾驶，区分成功率、驾驶得分和多种能力。 | SSP 比较同一事件跨三个观测/执行域的 VLA 输出，额外拆分语义与轨迹链；当前覆盖远小于 Bench2Drive，也没有同等规模的被测策略闭环执行。两者分数不可直接比较。 |

以上分别读取了一手方法说明，不能由“事件匹配”这个差异宣称本文全面优于其他 benchmark。

## 方法和系统设计

### 事件规格、编译与资格审计

源视频先经过质量筛选，剔除身份漂移、对象明显变形、关键运动不连续或冲突无法辨认的资产。层次 VLM 提取道路、参与者、相对运动、冲突、阶段、执行约束与不确定字段，规则和人工复核形成冻结的 $K_s^\star$。单目视频无法可靠恢复的绝对速度、距离和精确时间被保留为区间或未知字段，而不凭空补全。[原文 §3.2](https://arxiv.org/html/2608.14024v1#S3.SS2)

两类下游实现消费同一版本：CARLA 先检索满足拓扑、交互与执行约束的 road block，再布置 start/goal/conflict anchors 和状态触发；Physical 沿用同一规格及仿真验证的关系，映射到试验场路线、目标物轨迹和安全停止区域。语义、配置、控制参数、视频、标注和人工更改共同组成 evidence package。该编译器不是端到端新网络，论文不宣称新的因果发现算法。[原文式 1–8](https://arxiv.org/html/2608.14024v1#S3.SS3)

每个域进入模型测试前，必须保留拓扑、角色、主运动方向、冲突类型和通过顺序，关键阶段可定位，镜头覆盖必要目标；安全中止、身份切换和未记录的现场更改使资产失去比较资格。物理端的定位、云端状态和精确目标轨迹只用于执行与审计，不给 VLA。

### 关键定义与直觉

原文式 9–11 以事件阶段和属性保持度检查跨域匹配：

$$
\begin{aligned}
\phi_{s,d,e}&=\frac{t_{s,d,e}-t_{s,d,\mathrm{start}}}{t_{s,d,\mathrm{end}}-t_{s,d,\mathrm{start}}},\\
\mathrm{EPD}_{s,d}&=\frac1{\lvert\mathcal E_s\rvert}\sum_{e\in\mathcal E_s}\lvert\phi_{s,d,e}-\phi_{s,\mathrm{Syn},e}\rvert,\\
\mathrm{KPR}_{s,d}&=\frac{\sum_k w_k\mathbf1(q_{s,d,k}=q_{s,\mathrm{Syn},k})}{\sum_k w_k}.
\end{aligned}
$$

$s$ 是事件，$d$ 是域，$e$ 是 approach/trigger/conflict/resolution 等关键阶段；$\phi$ 将阶段时刻归一化到视频内部，EPD 测节奏偏移，越小越相近。$q_k$ 是离散属性，$w_k$ 是权重，KPR 测属性保留比例。它们评价资产是否可比，不是 VLA 得分；所有 mandatory 属性仍要逐项通过，不能靠其他属性拉高平均分抵消一次身份错误。

语言侧将可评槽、实际回答与正确性分开。原文式 18 为：

$$
\mathrm{SemAcc}_{\mathrm{eff}}=\frac{\sum_{i,q}e_{iq}z_{iq}h_{iq}}{\sum_{i,q}e_{iq}}.
$$

$i$ 是对齐记录，$q$ 为对象、位置、运动或冲突槽，$e$ 标记该槽是否可评，$z$ 标记有无带原文证据的合法答案，$h$ 是正确性。缺失回答贡献零分；对象集合用 F1，位置、运动和冲突主要用精确匹配。相比只算已回答槽的 conditional accuracy，这个分母避免通过少回答来提高表面正确率。[原文 §4.2.2](https://arxiv.org/html/2608.14024v1#S4.SS2.SSS2)

总分按原文式 30 固定组合：

$$
\begin{aligned}
\mathrm{IVCS}={}&0.10\,\mathrm{JOVR}+0.30\,\mathrm{SemAcc}_{\mathrm{eff}}\\
&+0.20\,\mathrm{CIA}_{\mathrm{eff}}+0.30\,\mathrm{TQSR}+0.10\,\mathrm{RSR}.
\end{aligned}
$$

JOVR 测文本与轨迹都有效，CIA 要求对象、位置和运动联合全对，TQSR 测有效且粗略可行的轨迹是否符合纵横向允许动作，RSR 测风险出现后持续减速/停车。权重是本文评测目标的选择，不是安全常数；文字动作准确率 ActAcc 与文字–轨迹一致率 ATC 留作诊断，未重复加入总分。[原文 §4.2.7](https://arxiv.org/html/2608.14024v1#S4.SS2.SSS7)

### 推理接口与评分协议

本文不训练新 VLA。每个模型只适配视频输入、最小任务提示和输出 parser，保留原始输出；无效 shape、非有限值、缺时间戳或覆盖不足的轨迹标 invalid，不外推补齐。轨迹转到自车坐标，在 $0,0.5,1.0$ s 插值；每视频九个标签，用允许 0.11 s 偏差的单调一对一动态规划匹配。首帧没有动态证据时，不强行给运动和冲突槽打分。[原文 §3.4、式 12–14](https://arxiv.org/html/2608.14024v1#S3.SS4)

文本先由规则抽取，缺槽时才让受限 LLM 从闭合标签集选择并引用原文片段；抽取器看不到 ground truth，最后由确定性代码评分。这个设计降低自由打分的随意性，但仍可能误解否定、同义词和指代。

轨迹的“停”阈值为末段速度不高于 0.5 m/s，加减速阈值为 $\pm0.5$ m/s²，左右转向用一秒净横移 $\pm0.3$ m。可行性过滤限制反向位移、速度、横向速度与加速度，例如总速度不超过 25 m/s、纵向加速度绝对值不超过 8 m/s²；这些只排除明显异常，不构成车辆动力学认证。持续风险响应要求两次相邻预测都给出符合标签的减速/停车，间隔不超过 0.6 s；失败时 latency 记缺失而非随意大值。这里的 response latency 是风险证据到预测响应的事件时间差，不是 GPU 推理时延。[原文式 22–29](https://arxiv.org/html/2608.14024v1#S4.SS2.SSS4)

## 关键图与可视化结果

![原论文图 3：同一 cut-in 和 VRU crossing 的三域实现](https://arxiv.org/html/2608.14024v1/fig3.png)

按行比较两类事件，按列读 Synthetic、Simulation 和 Physical；先确认角色、侵入方向和冲突区域，再看拓扑检索、anchor 与执行反馈。图中的冲突标记和覆盖层只用于解释，没有输入模型。它能说明作者怎样组织对应关系，但一张截帧不能独立证明全部阶段与 mandatory 属性保持，仍需原始视频和日志。[原图 3 与图注](https://arxiv.org/html/2608.14024v1#S4.F3)

![原论文图 6：18 个事件–域–模型单元的能力矩阵和响应](https://arxiv.org/html/2608.14024v1/fig6.png)

左半逐行比较 JOVR、语义、CIA、动作、轨迹和一致性，右半给 IVCS、风险响应成败和成功时延。大量 CIA 为零，显示格式有效并不等于绑定了正确对象关系；例如 Alpamayo 在部分单元轨迹质量较高但显式动作/一致性为零。空心与实心标记描述这些具体单元，不是不同种子下的概率置信区间。[原图 6 与图注](https://arxiv.org/html/2608.14024v1#S4.F6)

## 实验结论与证据

### 设置与解释单位

主实验是 $2\times3\times3$：cut-in/VRU crossing、三个域、OpenEMMA/LLaViDA/Alpamayo-R1，共 18 个 cell，每 cell 九个对齐记录。九条记录来自同一事件视频，不是九次独立执行。作者按域或模型作 macro average，保留场景分层结果；它们是固定配对资产上的协议比较，没有重复事件/种子的总体统计推断。[原文 §4.1](https://arxiv.org/html/2608.14024v1#S4.SS1)

JOVR、SemAcc、CIA、TQSR、RSR、IVCS 都以 0–1 报告，越高越好，但意义不同。ATC 高只能说明文字与轨迹一致，两者可以同时做错；RSR 只检查持续纵向防御，横向避让并不由它覆盖。没有一个指标等于实际道路碰撞概率。

### 主要结果与比较

| 评测与原表 | 比较对象 | JOVR ↑ | TQSR ↑ | RSR ↑ | IVCS ↑ |
| --- | --- | ---: | ---: | ---: | ---: |
| 域宏平均，表 2 | Synthetic | 0.833 | 0.352 | 0.333 | 0.259 |
| 同上 | Simulation | 0.889 | 0.389 | 0.167 | 0.291 |
| 同上 | Physical | 0.926 | 0.370 | 0.500 | 0.325 |
| 模型宏平均，表 3 | OpenEMMA | 1.000 | 0.444 | 0.333 | 0.338 |
| 同上 | LLaViDA | 0.648 | 0.111 | 0.333 | 0.131 |
| 同上 | Alpamayo-R1 | 1.000 | 0.555 | 0.333 | 0.405 |

[表 2](https://arxiv.org/html/2608.14024v1#S4.T2)中 Physical 的 IVCS 比 Simulation 高 0.034，但 TQSR 低 0.019，均为原表相减。按事件分层，cut-in 的 Simulation 为 0.340 领先，VRU 的 Physical 为 0.374 领先；不能概括为“越物理越好”。

[表 3](https://arxiv.org/html/2608.14024v1#S4.T3)中 LLaViDA 的低分同时包含输出缺失、槽提取后的语义错误和轨迹表现，不能直接推断其内部推理能力普遍更弱。三个系统的训练数据、foundation model、历史输入和原生动作接口不同，这是系统级比较。

固定 OpenEMMA 风格接口的规模实验中，Qwen3-VL-32B Dense 的 TQSR/IVCS 为 0.426/0.366，30B-A3B 为 0.630/0.398，235B-A22B 为 0.426/0.356。30B-A3B 相比 32B 提高轨迹分，但在 JOVR、语义覆盖和 RSR 上有代价；Alpamayo-R1 保留独立接口，只作为外部参考，不能用来隔离 Dense/MoE 的因果效果。[原文表 4、§4.6](https://arxiv.org/html/2608.14024v1#S4.SS6)

### 消融与不确定性

本文提出了 KPR/EPD 的资格定义，但本次全文未找到逐域资产的完整数值审计表、失败资产清单或可下载 evidence package；图 3 也不足以替代它们。因此能够确认作者定义了审计协议，尚不能独立复算其实际匹配强度。

“无结构直接编译、只用对象关系、完整 SSP”的 transfer ablation 在 §5.7 被列为后续工作，不能写成已经证明结构化事件规格提升了匹配质量。结果没有重复种子方差、置信区间或评分权重敏感性，0.034 的域总分差和 0.032 的模型规模差不能称为统计显著。

Active parameters 是每 token 大致激活的参数数，不等于 FLOPs、显存、延迟或能耗。文中没有对应部署测量，不能从 3B active 推出实时优势。

## 应用场景与启发

- **作者主张**：让合成筛查、仿真复现和封闭试验场确认围绕同一个事件形成可追溯证据，拆解 VLA 行为链。
- **我的判断**：适合为 cut-in、遮挡行人或交警指挥等长尾事件建立资产审计；当前最先可迁移的是 identity checklist、原始输出保留和缺失值单独计分，不能直接把 IVCS 当部署 gate。
- **待验证假设**：固定同一个源事件后，完整事件规格比仅靠场景类别匹配更能保持通过顺序和风险阶段，进而降低“同域换实例”造成的分数变化。应先在仿真中用对照实验检验，不必一开始就扩大实物测试。

## 局限与阅读风险

作者明确承认一秒窗口会漏掉后续制动，粗可行性阈值不能认证车辆动力学，联合全对的 CIA 会压低部分正确答案，IVCS 权重依赖任务。只有两个事件，未覆盖交叉路口博弈、汇入、恶劣天气、高速和持续多车交互。[原文 §5.6](https://arxiv.org/html/2608.14024v1#S5.SS6)

物理域保留真实成像和执行扰动，但不是公共道路分布；现场动作受安全与设备约束，不能声称所有潜在因素相同。抽取器误差、提示适配、坐标转换和服务端模型更新也能改变得分。正文没有完整公布每个模型的冻结版本、解码参数及资产日志，限制独立复核。

全文页头有期刊样式信息，但本报告以 arXiv v1 为依据；未核验正式期刊落地页，不以模板字段认定录用。

## 后续跟进

### 最小验证与停止条件

- **当前资源**：2026-09-12 检查 v1 和精确题名检索；Data Availability 写的是“Data will be made available on request”，未找到可下载的 SSP 两类事件在三个域中的六份视频资产、scene cards、审计日志、评测代码、完整 prompt/config bundle。本文不训练新权重，三种 VLA 的外部权重与服务访问条件还需分别核验；AVD2 的公开页面不等于 SSP 具体事件包已发布。本次未联系作者、下载模型或执行实验。
- **最小实验**：取得一个 cut-in 源事件与冻结审计清单，先在 CARLA 生成五组配对实例，固定地图、目标类型、视角和随机种子，只比较类别匹配、对象关系规格、完整事件规格。两个独立检查者核对 mandatory 属性、通过顺序、EPD 和源视频证据；模型结果不参与匹配选择。
- **成功信号**：完整规格降低身份或阶段失配，且这种改善不是只靠拒绝绝大多数难样本；同时报告资格通过率、人工调整时间与通过资产的模型逐项分数，再决定是否值得做 Physical 确认。
- **停止或转向**：若原始 audit package 不可得，先完成自建协议试验并标明替代实现；若不同规格的匹配质量相同，或 reviewer 无法一致识别阶段，先修正事件定义和标注。若分数差主要来自 parser/接口失败，应先修复适配并重测，停止解释成模型或域能力差异。

### 来源与核验记录

依据 [arXiv:2608.14024v1 全文](https://arxiv.org/html/2608.14024v1)，实际核验日期为 2026-09-12。机构由作者栏核对；方法与资格定义对应 §3、式 1–12，指标对应 §4.2、式 13–30，结果对应表 1–4；逐张打开了原论文图 3、6 并核对图注，保留原图片地址且修正旧报告图号。相关工作读取 AVD2 v2 §III 和 Bench2Drive v3 §3.3。完成内容核对，未执行模型复现或场地试验。
