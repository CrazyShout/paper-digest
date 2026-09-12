---
{
  "id": "brainwam-action-space-coordination",
  "tag": "world-models",
  "tags": ["world-models", "end-to-end-autonomous-driving", "agentic-driving"],
  "title": "BrainWAM: Action-Space Coordination of Semantic Priors and Predictive Dynamics for Autonomous Driving",
  "source": "arXiv:2608.12854 / https://arxiv.org/abs/2608.12854 / HTML (v1 figures): https://arxiv.org/html/2608.12854v1",
  "authors": ["Bing Zhan", "Shuyao Shang", "Shuo Lu", "Yuan Xu", "Zhao Wang", "Yida Wang", "Xueyang Zhang", "Kun Zhan", "Jiahao Gu"],
  "affiliations": ["National Laboratory of Pattern Recognition, Institute of Automation, Chinese Academy of Sciences", "Li Auto Inc."],
  "comment": "BrainWAM 发现把 VLM、视频生成和 action token 全部塞进同一注意力池会让语义捷径压制预测动力学，于是保留 VLA/WAM 两条专门通路，只在 action 表征上双向协调。其 NAVSIM v1/v2 得分为 89.5/89.6，但推理仍需 475-644 ms。"
}
---

## 一句话定位

BrainWAM 让 VLA 先形成理解规则与指令的动作表示，让 WAM 先形成结合未来预测的动作表示，再通过中间层双向通信和末端融合共同生成轨迹。它最值得读的是**在什么层次融合**：跨分支交换八个动作 token，而不是把视频、语言和动作原始 token 全放进一个注意力池。

- **核心证据**：NAVSIM-v1 的同骨干对照中，原始 token 融合 Tri-MoT 为 87.8 PDMS，WAM-only 为 88.1，动作空间协调为 89.5；较 Tri-MoT 高 1.7 分。[原文 v2 表 3](https://arxiv.org/html/2608.12854v2#S4.T3)
- **主要边界**：89.5 PDMS/89.6 EPDMS 对应两步视频、三步动作去噪，单 H20 推理为 565 ms；更便宜的一步视频版本为 475 ms、89.3/89.4 分。平均分和注意力图不足以证明长尾交互安全。[原文表 5](https://arxiv.org/html/2608.12854v2#S4.T5)

## 论文要解决的问题

### 问题与假设

驾驶既需要读懂导航指令、红灯和车道语义，也需要判断接下来会发生什么。VLA 的语言视觉表征提供语义先验，视频生成 WAM 提供时空预测，但把两者加入同一个网络并不自动形成互补。

作者构造 Tri-MoT，把 VLM、视频生成模型和动作 token 放在共享注意力空间中，观察到动作对较干净的 VLM token 分配更多注意力，同时总分低于 WAM-only。作者将其解释为模型更容易学习语义捷径，从而忽视尚在去噪的视频信号；这是由注意力统计及消融支持的解释，不是已排除全部优化因素的因果证明。[原文 §1；附录 A](https://arxiv.org/html/2608.12854v2#S1)

本文的假设是：两个分支先各自学会将自身信息变成轨迹意图，在同一噪声状态下交换动作表示，比直接混合原始模态更容易学习有效协调。最终输出仍是未来 4 秒、2 Hz 的八个自车轨迹点，不是显式文本推理或车辆控制命令。

### 相关工作与差异

| 工作与一手来源 | 已有机制 | BrainWAM 的具体差异 |
| --- | --- | --- |
| Li 等，ReCogDrive，2025 首发、ICLR 2026（[机制 v1 §3.2–3.3](https://arxiv.org/html/2506.08052v1#S3.SS2)；[正式入口](https://openreview.net/forum?id=JoXwhGbuMi)） | 从 VLM 隐状态条件化连续轨迹扩散头，模仿后用 NAVSIM 轨迹奖励强化学习；动作不必由语言字符串逐点生成。 | BrainWAM 另保留一个视频 WAM 动作专家，并在共同动作噪声下融合两个专家。语义到连续动作并非本文新增；本文融合阶段是 flow-matching 监督，不能混称 DiffGRPO。 |
| Zhou 等，DriveDreamer-Policy，2026 arXiv 预印本（[§3.2](https://arxiv.org/html/2604.01765v1#S3.SS2)） | LLM 产生固定长度 depth/video/action queries，以 depth→video→action 的因果注意力传递信息；独立生成头消费相应 embedding，规划不依赖显式解码深度和视频。 | BrainWAM 不在一个查询序列里串联全部模态，而是先独立训练两个动作分支，再双向桥接与末端融合。两者都用了紧凑任务接口，但信息方向、监督和推理保留的骨干不同。 |

Tri-MoT 是本文内部对照；其结果说明这一具体融合实现不理想，不能推广成“所有联合注意力均不如分支融合”。外部基线训练数据、骨干尺寸及传感器不同，也不是纯粹替换一个模块的实验。

## 方法和系统设计

### 输入输出与流程

WAM 分支由 Wan2.2-TI2V-5B 和动作专家组成：当前观测条件化视频 latent 去噪，视频 token 与动作 token 通过 Dual-MoT 的共享自注意力交互，各模态保留自己的前馈层。VLA 分支由 Qwen3-VL-4B 和另一动作专家组成，将多视角图像、驾驶指令、自车历史编码为语义与状态 token，条件化同一条噪声轨迹。正文未列出实际使用的相机数量、图像分辨率和历史帧长度，本报告不替它补齐。[原文 §3.1–3.2](https://arxiv.org/html/2608.12854v2#S3.SS1)

两个分支各形成八个、每个 1024 维的动作 token。CAB（Callosal Action Bridge）放在动作专家的第 9 和 18 层，用两个方向的 cross-attention 交换动作信息；零初始化的残差门控使联合训练起点接近原本的两个专家。末端 CIF（Cerebellar Intent Fusion）将两组 token 分别投影、加入来源嵌入，串成 16 个 token，经两层 Transformer 后拆回两组并逐元素平均，最后解码动作速度场。[附录 B–C](https://arxiv.org/html/2608.12854v2#A2)

例如路口既要遵从左转指令，也要控制弯道运动。语义分支可能给出正确分支方向，预测分支提供可行曲率的信息；CAB 允许二者在中间表示互相修改，CIF 输出一个联合轨迹。这是模块职责的直觉解释，不表示每个 token 都能直接读成某条交通规则。

### 关键公式与直觉

第一组对应原文式 2–6、8–9，合并视频和动作相同的 rectified-flow 形式：

$$
\begin{aligned}
x_t^m&=(1-t_m)x_0^m+t_m\epsilon^m,\qquad u^m=\epsilon^m-x_0^m,\\
\mathcal L_{\mathrm{WAM}}&=\mathbb E\lVert\widehat u^v-u^v\rVert_2^2
+\lambda_a\mathbb E\lVert\widehat u^a_{\mathrm{pred}}-u^a\rVert_2^2,\\
\mathcal L_{\mathrm{VLA}}&=\mathbb E\lVert\widehat u^a_{\mathrm{sem}}-u^a\rVert_2^2.
\end{aligned}
$$

$m$ 表示视频 $v$ 或动作 $a$，$x_0$ 是真实未来视频 latent 或日志专家轨迹，$\epsilon$ 是高斯噪声，$t=0$ 是干净数据、$t=1$ 是纯噪声。模型学习沿这条线的速度，推理从噪声向数据方向积分。视频和动作时间独立采样；联合阶段的两个动作专家则使用**同一条噪声轨迹、同一动作时间**，使它们交换的是同一去噪状态。式中 $\lambda_a$ 简写原文 $\lambda_{\mathrm{pred}}^a$；正文没有给出数值。[原文 §3，式 2–9](https://arxiv.org/html/2608.12854v2#S3)

第二组将式 10–11 写成对称的 CAB 更新，保留附录给出的逐通道门控：

$$
\widetilde A_x^l=A_x^l+\tanh(g_x^l)\odot
\operatorname{Attn}(A_x^l,A_y^l),\qquad
x\ne y,\quad x,y\in\{\mathrm{pred},\mathrm{sem}\}.
$$

$A_x^l$ 是第 $l$ 层该分支的八个动作 token，另一个分支作为 key/value；$g_x^l\in\mathbb R^{1024}$ 初值为零，所以初始注入量为零。门控学习“如何修正动作表示”，不是安全置信度，也没有被校准为碰撞概率。两个 CAB 合计约 16.8M 参数。[原文式 10–11；附录 B.1](https://arxiv.org/html/2608.12854v2#A2.SS1)

第三组对应式 12–13，表示联合阶段只监督最后的融合输出：

$$
\begin{aligned}
(Z_{\mathrm{pred}},Z_{\mathrm{sem}})&=\operatorname{CIF}(\widetilde A_{\mathrm{pred}}^L,\widetilde A_{\mathrm{sem}}^L),\\
Z&=(Z_{\mathrm{pred}}+Z_{\mathrm{sem}})/2,\\
\mathcal L_{\mathrm{fuse}}&=\mathbb E\lVert D_{\mathrm{fuse}}(Z,t_a)-(\epsilon^a-x_0^a)\rVert_2^2.
\end{aligned}
$$

$L$ 在这里表示最终动作层，$D_{\mathrm{fuse}}$ 是轨迹速度场解码器。CIF 的 Transformer 会先让两组意图交互，之后的平均不是简单平均两条已经完成的轨迹。该损失让融合结果接近日志动作，并不直接监督每一分支的解释是否正确，也不显式优化 NC 等驾驶指标。[原文 §3.3](https://arxiv.org/html/2608.12854v2#S3.SS3)

### 训练与推理

三阶段依次是 WAM 视频/动作联合训练、VLA 动作训练、冻结两条预训练分支后的协调训练。最后只更新 CAB、CIF 和最终解码器，保留已经学到的两种表示。每阶段 100K steps，8 张 H20、每卡 batch 6，AdamW 峰值学习率 $5\times10^{-5}$、200 步 warmup，bf16 与 ZeRO-2。CIF 约 49.3M 参数；“桥接很小”不等于推理不必保留 5B 视频和 4B VLM 主干。[原文 §4.2；附录 C、E](https://arxiv.org/html/2608.12854v2#S4.SS2)

推理中动作流执行三次 rectified-flow 更新；视频流可在一至两步后停止，将中间特征缓存供后续动作步骤复用。未来真值只在训练时作为目标；线上仍执行视频生成骨干以形成预测上下文。论文没有分解 VAE 解码是否计入表 5、缓存显存或 p99 时延，因此不把 565 ms 解释成完整传感器到执行器响应时间。

## 关键图与可视化结果

![原论文图 3：WAM、VLA、CAB 与 CIF 的动作空间协调架构](https://arxiv.org/html/2608.12854v1/framework.png)

从底部读起：左侧是历史与带噪视频，中间是两份动作噪声，右侧是场景和指令；紫色 CAB 连接两组动作流，顶部绿色 CIF 汇合动作表示。右侧细图给出 cross-attention、tanh 门控与两层融合。原图编号是 **3**，不是 1；图中顶部 clean future video 展示 WAM 的生成能力，不意味着每次规划都必须完整渲染未来。[v2 原图 3 与图注](https://arxiv.org/html/2608.12854v2#S2.F3)

![原论文图 5：导航、红灯响应、行人交互与弯道中的三种轨迹对照](https://arxiv.org/html/2608.12854v1/qualitative.png)

每行由 VLA、WAM、BrainWAM 的 BEV 轨迹和前视照片组成。前两行展示 VLA 较好处理导航和红灯，后两行展示 WAM 较好处理行人交互与弯道；图中的勾叉是作者对这些样例的判读。静态轨迹图没有展示行人根据自车动作重新决策，不能当成反应式行人仿真或实车闭环证据。[v2 原图 5；§4.5](https://arxiv.org/html/2608.12854v2#S4.F5)

两张图片均已逐张打开；保留本站原 v1 图片 URL，并核验下载内容与 v2 同名官方图片的 SHA-256 完全一致。

## 实验结论与证据

### 设置与指标

论文使用由 OpenScene/nuPlan 日志构建的 NAVSIM-v1、v2，输出 4 秒、8 点轨迹。v1 的 PDMS 使用碰撞与可行驶区乘法惩罚，再组合进展、TTC、舒适性；v2 的 EPDMS 加入行驶方向、交通灯、车道保持、历史与扩展舒适性。两种总分及子分都越高越好，100 分不是零风险证明。[原文 §4.1](https://arxiv.org/html/2608.12854v2#S4.SS1)

本文将 NAVSIM 笼统写为非反应式，需要按基准原文修正：v1 背景交通重放日志；v2 背景车辆由 IDM 有限响应自车，行人等仍不响应，4 秒轨迹执行段内不给 agent 连续传感器反馈。EPDMS 单表也不能证明使用 navhard 的双阶段重渲染评测。[NAVSIM-v2 §3.1](https://arxiv.org/html/2506.04218v3#S3.SS1)

BrainWAM 未列训练/验证/测试的 token 数和拆分清单，也未报告随机种子、重复实验方差或测试集分层统计。表 3 声明 Tri-MoT 与 BrainWAM 使用相同骨干、相近参数量；它比外部榜单更接近机制对照，但尚不能确认全部训练数据和优化预算逐项相同。

### 主要结果与比较

| 评测设置与原表位置 | 方法/配置 | 关键指标 ↑ | 比较条件与边界 |
| --- | --- | --- | --- |
| NAVSIM-v1，表 3 | VLA-only | PDMS 86.1；DAC 94.9；EP 80.7 | 本文独立语义动作分支 |
| 同上 | WAM-only | PDMS 88.1；DAC 96.4；EP 82.6 | 本文独立预测动作分支 |
| 同上 | Tri-MoT | PDMS 87.8；NC 98.3；EP 81.7 | 原始 token 级联合注意力 |
| 同上 | BrainWAM | PDMS 89.5；NC 98.1；DAC 97.5；EP 83.8 | 较 WAM-only 高 1.4 分，较 Tri-MoT 高 1.7 分；NC 未胜过 Tri-MoT |
| NAVSIM-v2，表 2 | DriveDreamer-Policy | EPDMS 88.7；NC 98.4；TTC 97.7；EC 79.4 | 外部模型，骨干与训练不同 |
| 同上 | BrainWAM | EPDMS 89.6；NC 98.1；TTC 97.4；EC 85.8 | 综合分高 0.9，NC/TTC 各低 0.3，EC 高 6.4 分 |

这些数值支持驾驶合规、进展及部分舒适性受益，而非所有安全分项都改善。原文称达到 SOTA，只能理解为其所列对照范围；本文没有验证覆盖当日所有最新模型。[表 1–3](https://arxiv.org/html/2608.12854v2#S4.SS3)

### 消融与证据边界

表 4 中仅 CAB 为 88.7、仅 CIF 为 88.5、两者合用为 89.5；相对仅 CAB 增加 0.8 分，NC 都为 98.1，主要变化在 DAC/EP。附录表 9 中全量联合微调为 88.8、冻结双分支只训协调模块为 89.5，支持该训练策略，但缺少收敛曲线与重复试验来确认机制解释。[表 4；附录 D](https://arxiv.org/html/2608.12854v2#A4)

| 表 5 推理配置 | 视频步数 | 动作步数 | PDMS ↑ / EPDMS ↑ | 单 H20 时延 ↓ |
| --- | --- | --- | --- | --- |
| 去除视频去噪 | 0 | 3 | 79.3 / 75.8 | 382 ms |
| 一步视频缓存 | 1 | 3 | 89.3 / 89.4 | 475 ms |
| 主要得分配置 | 2 | 3 | 89.5 / 89.6 | 565 ms |
| 同步三步 | 3 | 3 | 89.4 / 89.6 | 644 ms |

0→1 步让 PDMS 增加 10.0 分，1→2 步仅增加 0.2 分却多用 90 ms；按表值计算，一步视频比三步少 169 ms、约 26.2%。这证明当前模型依赖预测分支产生的有效特征，不足以单独证明它学会了物理因果：去掉去噪也会改变特征分布。更强的验证应保持计算量，交换或打乱未来内容。[原表 5](https://arxiv.org/html/2608.12854v2#S4.T5)

附录表 6–8 改用视频和动作各 **10 步联合去噪**，不能与上述三步主配置直接拼接。该设置下 CAB 从 1 个到 2 个为 88.9→89.3，继续增加最多到 28 个仍约 89.2–89.3；CIF 的 MLP、门控、Transformer 为 88.8、89.1、89.3。它们支持紧凑协调模块已经足够有用，不证明任意模型都只需要两处桥接。[附录 B–C](https://arxiv.org/html/2608.12854v2#A2)

## 应用场景与启发

- **作者主张**：分别保留语义和预测专长，通过动作空间协调改善导航理解、规则遵从和交互规划。
- **我的判断**：最可迁移的是相同噪声轨迹上的任务接口和冻结后协调训练；“左右脑”“小脑”属于架构命名与启发，不是神经科学实证。表 3 的同骨干对照比人脑类比更能解释设计价值。
- **待验证假设**：当导航与局部运动趋势冲突时，CAB 的有效消息内容能同时保持路线遵从和运动可行性；如果把另一场景的动作消息替换进来仍得到同样收益，那么收益可能主要来自额外容量或训练正则化。

## 局限与阅读风险

作者在附录 G 明确指出双分支推理的计算和显存高，475–644 ms 尚不能满足严格车载实时要求。论文未提供目标硬件的尾时延、吞吐、功耗和降级策略，不能因动作 token 很少就将整个系统描述为轻量。

从证据范围看，注意力偏向和性能共现尚未排除预训练差异、学习率或去噪分布的影响；没有对视频内容做计算匹配的因果干预，也没有针对导航冲突、遮挡、传感器故障的完整失败率。原文定性图可解释个例，不能给出长尾收益的频率。

预印本 HTML 首页残留“Conference; 2026; Location”模板字段，不能作为正式录用证据。本稿按 arXiv v2 报告；作者名单与 v2 首页一致，不使用旧 v1 的作者排列。没有公开的实现、checkpoint 与 split 清单，尚不能闭合复现链。

## 后续跟进

### 最小验证与停止条件

- **当前资源（2026-09-12）**：v2 HTML/PDF 与官方图片可访问；作者个人页列出本文为 arXiv 工作。本文、摘要页和作者页本次未发现可核实的本方法代码、可运行配置或 checkpoint。基础数据为 NAVSIM/OpenScene，但 BrainWAM 的采样清单、分支训练集及完整预处理没有公开下载入口可核验。[作者页](https://yaoyao-jpg.github.io/)
- **最小实验**：以公开 checkpoint 和 split 清单为前置条件，固定两个专家、CIF、动作三步/视频两步及随机噪声，对同一测试子集比较原 CAB、CAB 门控归零、跨场景交换 CAB value、只交换方向。交换保留张量形状和计算量；另在独立验证集预先定义导航冲突与动态交互子集。
- **成功信号**：原 CAB 在相关子集上优于归零和交换内容，尤其保持 DAC/路线遵从而没有恶化 NC/TTC；按场景配对 bootstrap 检查差异，并报告增益是否以 565 ms 成本为代价。
- **停止/转向条件**：若打乱消息仍保留收益，停止把增益解释为语义与动力学的有效通信，先检查额外参数或训练正则化；若收益主要来自更长视频去噪，则转向缓存或蒸馏，不再增加桥接层数。资料未公开前只做接口原型，不能标作 BrainWAM 复现。

### 来源与核验记录

本稿依据 [BrainWAM arXiv:2608.12854v2，2026-08-19](https://arxiv.org/html/2608.12854v2)，核验日期为 2026-09-12。已读取方法、实验和附录 A–G；核心位置为式 2–13、表 1–9、图 3 和图 5。用固定 v2 PDF 首页核对九位作者及 NLPR/CASIA、Li Auto 单位；比较 v1/v2 文本，方法与实验内容相同，作者元数据发生变化。

相关机制来自 [ReCogDrive v1 §3.2–3.3](https://arxiv.org/html/2506.08052v1#S3.SS2) 与 [DriveDreamer-Policy v1 §3.2](https://arxiv.org/html/2604.01765v1#S3.SS2)，基准解释来自 [NAVSIM-v2 v3 §3.1](https://arxiv.org/html/2506.04218v3#S3.SS1)。两张原图分别下载、打开并核对图注，v1 与 v2 图片文件内容一致。本次未下载模型、执行训练、复测时延或完成独立审稿。
