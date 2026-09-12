---
{
  "id": "caad-causality-aware-driving",
  "tag": "end-to-end-autonomous-driving",
  "tags": [
    "end-to-end-autonomous-driving",
    "dynamic-scene-representation"
  ],
  "title": "Causality-Aware End-to-End Autonomous Driving via Ego-Centric Joint Scene Modeling",
  "source": "arXiv:2605.13646 / https://arxiv.org/abs/2605.13646",
  "authors": [
    "Seokha Moon",
    "Minseung Lee",
    "Joon Seo",
    "Jinkyu Kim",
    "Jungbeom Lee"
  ],
  "affiliations": [
    "Korea University",
    "Kakao Mobility"
  ],
  "comment": "CaAD 把端到端驾驶中的自车规划和周围交通参与者响应放进同一个因果场景建模框架，重点看交互场景下闭环规划是否更一致。"
}
---

## 一句话定位

CaAD 用训练期的自车中心联合模式，把相关邻车的未来与自车轨迹放在同一假设下监督，再用组相对奖励优化自车策略。它主要改变的是**规划表征如何接受交互监督**，而非部署一个在线多车博弈求解器。Bench2Drive 全部 220 路线的 Driving Score 为 87.53；NAVSIM v1 为 91.1 PDMS，两者的传感器与交互协议不同。[固定全文 2605.13646v1，2026-05-13，§3–4](https://arxiv.org/html/2605.13646v1#S3)

## 论文要解决的问题

### 相容未来与因果识别的区别

普通规划器可能输出单独看来合理、组合后却互相冲突的自车和邻车轨迹。CaAD 为自车定义多个 scene mode，在每个模式中一起预测自车及相关邻车；训练时只约束可能与自车路径冲突的参与者，避免无关远车主导场景匹配。

作者称这种表征为 joint-causal。我的判断是，论文实现的是自车条件化的联合监督与奖励对齐：没有干预数据、结构因果模型或反事实识别实验，所以“学到了因果依赖”应按作者的建模动机理解，不能扩展为因果关系已被识别。

### 与已读原始方法的差异

| 一手来源 | 原有机制 | CaAD 的具体变化 |
| --- | --- | --- |
| Tang 等，HiP-AD，2025；[v1 §3.1–3.3](https://arxiv.org/html/2503.08612v1#S3) | 单一解码器内有跨任务交互、历史查询和规划可变形注意力；时间、空间、驾驶风格多粒度轨迹共同监督 | CaAD 建立在已有感知—规划交互之上，新增共享模式编号及自车主导的邻车监督；不能说基线完全没有交互 |
| Li 等，ReCogDrive，2025；[v2 §4.2–4.3](https://arxiv.org/html/2506.08052v2#S4.SS2) | VLM 隐状态通过交叉注意力引导连续扩散轨迹，随后以 DiffGRPO 对规划器做奖励优化 | CaAD 的重点是先形成联合场景模式，再在该模式的邻车预测背景下优化高斯自车策略；GRPO 本身不是其首次引入的技术 |

上述机制分别读取各方法原文。主表来源、作者复现基线和缩短训练的消融基线下文分开，避免把它们当成同一运行。

## 方法和系统设计

### 从查询到联合监督

图像编码器和统一解码器输出自车、邻车、地图等查询。每个实体的边际 embedding 与其 $M$ 个 joint-mode embedding 组成 $(1+M)\times C$ 的序列；Agent-Mode Attention 沿模式维独立作用于每个实体，而非再次对所有车辆做一个全局 attention。跨实体信息已由上游解码器注入。相同模式编号 $m$ 的自车和邻车输出组成一个联合未来。[§3.1–3.2、式 1](https://arxiv.org/html/2605.13646v1#S3.SS2)

### 公式组一：先选相关车辆，再由自车指定模式

将原文式 2–4 的关键步骤压缩为：

$$
\mathcal A_{\mathrm{int}}=\{i:\exists k,\ \operatorname{collision}(\widetilde\tau^a_{i,k},\tau^e_{\mathrm{sp}})=1\},\qquad
m^*=\arg\min_m d(\widehat\tau^e_m,\tau^e_{\mathrm{tp}}).
$$

$\widetilde\tau^a_{i,k}$ 是邻车 $i$ 的第 $k$ 条边际预测，$\tau^e_{\mathrm{sp}}$ 是训练真值的空间采样路径，$\tau^e_{\mathrm{tp}}$ 是时间采样的真值轨迹，$d$ 是带有效点掩码的轨迹距离。相关邻车在同一个 $m^*$ 下接受分类和轨迹监督；其余邻车保留自己最佳边际模式。这样不会为了匹配大量无关车辆而牺牲自车模式，但相关性选择依赖检测、预测与训练真值路径。

### 公式组二：只优化自车的随机策略

训练轨迹头预测均值 $\mu$ 和标准差 $\sigma$，高斯负对数似然提供监督；每个模式采样 $G$ 条自车轨迹，在该模式的邻车未来与地图背景下计算奖励。式 6–7 的核心是：

$$
A_{m,g}=\frac{r_{m,g}-\operatorname{mean}(r_m)}{\operatorname{std}(r_m)},\qquad
\widetilde A_{m,g}=\begin{cases}-1,&\text{collision},\\\max(0,A_{m,g}),&\text{otherwise},\end{cases}
$$

$$
\mathcal L_{\mathrm{GRPO}}=-\mathbb E_{m,g}\!\left[\min\{\rho\widetilde A_{m,g},\operatorname{clip}(\rho,1-\epsilon,1+\epsilon)\widetilde A_{m,g}\}\right],\qquad
\rho=\pi_\theta/\pi_{\mathrm{old}}.
$$

$r$ 是轨迹奖励，$\rho$ 是当前与采样旧策略的概率比，$\epsilon$ 限制更新幅度。碰撞样本固定负优势，非碰撞但低于组均值的样本被截断到零。邻车预测继续接受监督，没有给每辆车各自做策略梯度。原文未给 $M,G,\epsilon$ 的完整配置，也未说明组内奖励标准差为零时的数值保护。

### 奖励与训练部署边界

附录 B 的奖励用 NC、可行驶区及驾驶方向惩罚相乘，再乘进度、TTC、舒适性的加权质量项，权重为 5、5、2。作者把部分离散项连续化：可行驶区按有效时间比例，TTC 按首次违规时间，舒适性按阈值超限指数衰减；因此训练奖励不是未经修改的官方 PDMS。总损失还保留原检测、地图、规划、边际运动及联合监督。[附录 B，式 8–9](https://arxiv.org/html/2605.13646v1#A2)

Bench2Drive 用 640×352 多视角图像、目标点与高层指令，训练为检测 12 epoch、带联合预测的规划 12 epoch、RL 6 epoch；8 张 A6000、总 batch 48、AdamW、weight decay 0.01，前两阶段学习率 2e-4，RL 为 2e-5。消融缩为规划 6、RL 3 epoch。NAVSIM 则用 ResNet-34、三路前视图拼成 1024×256，并加入 BEV LiDAR；从头训练 80 epoch，再对齐 20 epoch。[附录 C.3](https://arxiv.org/html/2605.13646v1#A3.SS3)

联合预测与 RL 用作训练监督，部署使用预测均值；时间轨迹控制纵向、空间轨迹控制横向，不在线读取真值路径或采样奖励。原文没有给剪裁后的完整推理计算图、参数量和实测延迟，不能据此宣称零额外部署成本。

## 关键图与可视化结果

![原论文 Fig. 1：边际表征优化与自车中心联合场景监督的差别](https://arxiv.org/html/2605.13646v1/x1.png)

上排展示边际预测后优化策略；下排增加相关车辆选择和联合模式，再优化自车动作偏好。它是动机对照，不是闭环轨迹实验，也没有给出统计因果检验。[Fig. 1](https://arxiv.org/html/2605.13646v1#S1.F1)

![原论文 Fig. 2：统一解码器、Agent-Mode Attention、边际/联合分支和策略对齐](https://arxiv.org/html/2605.13646v1/x2.png)

先看上半部标出的 Training-Only 联合分支，再看下半部同编号场景模式和相关车辆选择。注意 attention 的 token 排列与联合监督范围，它们比图中“causal”标签更能说明实现。两张官方图片均已分别打开并核对图注。[Fig. 2](https://arxiv.org/html/2605.13646v1#S3.F2)

## 实验结论与证据

### 基准与指标

Bench2Drive 有 950 训练片段、50 开环验证片段、220 闭环路线；DS 结合路线完成与违规惩罚，SR 为成功路线百分比。开环平均 L2 以 2 Hz 采样、覆盖 2 s。NAVSIM v1 则将自车轨迹滚动 4 s，背景车辆沿日志未来运动，是非反应式评测，不能证明邻车会对自车动作作真实响应。[附录 C.1](https://arxiv.org/html/2605.13646v1#A3.SS1)

| 完整 220 路线，原 Table 1 / Table A2 | DS ↑ | SR ↑，% | 对照含义 |
| --- | ---: | ---: | --- |
| HiP-AD，引用原结果 | 86.77 | 69.09 | 不等同作者复现运行 |
| HiP-AD，作者复现（A2） | 86.38 | 66.82 | 更适合判断同框架增益 |
| 对所有车辆做 policy alignment（A2） | 86.90 | 65.45 | SR 反而下降 |
| CaAD，仅自车 alignment | 87.53 | 71.81 | 对复现基线增加 1.15 DS、4.99 个 SR 百分点 |

A2 中 CaAD 的 Efficiency 为 172.53，低于复现基线 200.11，而 Comfortness 从 16.89 到 34.34；并非各项都提高。Table 4 的 NAVSIM PDMS 为 91.1，对 ReCogDrive 的 90.8 仅高 0.3，且其 Ego Progress 84.9 低于 ReCogDrive 的 87.3，传感器/架构也不同。[Table A2](https://arxiv.org/html/2605.13646v1#A4.T2)、[Table 4](https://arxiv.org/html/2605.13646v1#S4.T4)

### 哪些模块对照最有解释力

| Table 3，54 路线 mini、缩短训练 | DS ↑ | SR ↑，% | Ability mean ↑ |
| --- | ---: | ---: | ---: |
| 复现基线 | 83.12 | 62.96 | 63.83 |
| 空间筛选，但按全部对象误差选模式（C） | 84.76 | 64.81 | 56.29 |
| 同空间筛选，改自车选模式（D） | 88.61 | 75.93 | 72.66 |
| D 加联合模式策略对齐（E） | 91.05 | 79.63 | 76.51 |

C→D 保留空间筛选而改变模式指定，最直接支持自车主导匹配；D→E 支持额外对齐阶段。但 mini 的 91.05 不应混成全量 DS，额外训练也增加优化预算。作者未提供多种子方差。nuScenes 附录 Table A3 中，CaAD 对复现基线平均 L2 0.67→0.59 m，却使碰撞率 0.06→0.08%；开环与闭环指标并非单调一致。

## 应用场景与启发

作者希望改善并线、超车和路口互动。我的判断是，最可迁移的做法是用“自车最佳模式”组织训练目标，以及让 RL 只优化自车、保持邻车预测稳定；不必先把所有车辆变成可优化策略。

待验证假设：在相同训练预算下，自车中心匹配比全对象匹配更能改善稀疏但关键的交互，而非仅依靠增加监督或更新次数。可先按合流、路权让行、无互动三类分组检验，观察收益是否确实集中在相关参与者存在的样本。

## 局限与阅读风险

作者在附录 E 明确说，没有观察到可靠为来临紧急车辆腾出空间的成功案例；漏检关键参与者与罕见社会规则仍是风险。该附录笼统称评测为 camera-based，但 C.3 明确 NAVSIM 使用 LiDAR，本报告按具体实现分别记录。

“同一模式的联合未来”不等于针对每条自车采样动作重新模拟邻车反应。奖励依赖预测背景，预测偏差可能被策略利用；论文未用干预或真实交通验证因果解释。组大小、完整超参数、推理耗时和可复现运行产物仍缺失。

## 后续跟进

### 资源、最小验证和停止条件

2026-09-12 已读取[作者项目页](https://moonseokha.github.io/CaAD/)和作者论文列表：有论文、图与视频，但未找到 CaAD 的代码、配置或权重下载入口；不能把 [HiP-AD 的开源代码与检查点](https://github.com/nullmax-vision/HiP-AD) 当成 CaAD 已发布。Bench2Drive/NAVSIM 是所用公开基准，本次没有下载数据或执行模型。

取得 CaAD 配置后，先在附录列出的 54 条路线核对 C、D 两种模式匹配，固定图像、初始化、训练更新数、控制器与种子；资源以作者 8×A6000、batch 48 为起点，实际训练时长未报告。成功信号是自车匹配在相同预算下稳定提高交互组 SR，且无互动组与碰撞率不恶化。若收益随种子消失，或只在多训时出现，就停止“匹配机制本身有效”的结论；若代码和所需超参数仍缺失，只能完成协议实现与复现准备，不能宣称复现论文。

### 来源记录

核验于 2026-09-12：固定 [CaAD v1](https://arxiv.org/html/2605.13646v1)，含附录 A–E；重点为式 1–9、Tables 1/3/4/A2/A3、Figs. 1–2。相关工作读取 HiP-AD v1 §3 与 ReCogDrive v2 §4；ReCogDrive 的错误版本 HTML 和会议 PDF 访问失败后，改读 arXiv 已确认的 v2 全文。机构按 CaAD 首页核实并保留。
