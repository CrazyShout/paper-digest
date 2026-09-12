---
{
  "id": "defer-to-plan-v2x-driving",
  "tag": "cooperative-autonomous-driving",
  "tags": [
    "cooperative-autonomous-driving",
    "end-to-end-autonomous-driving"
  ],
  "title": "Defer to Plan: Adaptive Multi-Agent Fusion for End-to-End V2X Driving",
  "source": "arXiv:2607.19774 / https://arxiv.org/abs/2607.19774",
  "authors": [
    "Nuoran Li",
    "Zhang Zhang",
    "Yueran Zhao",
    "Tianze Wang",
    "Chao Sun"
  ],
  "affiliations": [
    "Shenzhen Automotive Research Institute",
    "National Engineering Research Center of Electric Vehicles",
    "Beijing Institute of Technology"
  ],
  "comment": "把多车融合从感知阶段推迟到规划阶段，由轨迹上下文动态决定车辆与路侧信息的权重；在 V2Xverse 闭环中同时提高驾驶分与违规分，适合讨论“通信什么”如何直接服务决策。"
}
---

## 一句话定位

Defer to Plan 让车端与路侧时序特征先各自压缩，再由带因果掩码的规划 query 选择如何融合，配合通道筛选和 MoE tokenizer；值得读的是融合时机与规划监督的接口，而不是“首次让规划影响通信”。

- 核心证据：V2Xverse 同表比较中，Driving Score 从 CoDriving 的 77.15 升至 79.72，但路线完成率从 92.34% 降至 91.05%，体现安全相关得分与进展之间的交换。
- 主要边界：公开正文存在图文和消融百分比不一致，代码与 checkpoint 本次未找到；噪声/延迟试验只有开放环轨迹指标，不能直接解释为通信故障下的闭环安全保证。[表 II–V](https://arxiv.org/html/2607.19774v1#S4.T2)

## 论文要解决的问题

### 问题与输入条件

路侧信息在遮挡路口可能决定是否停车，在开阔道路则可能大部分与当前动作无关。如果先融合成单一感知表示，规划器未必还能区分两种来源。本文保留 ego/road 两条信息流，直到轨迹解码器中再融合；它依赖车路 LiDAR/BEV、占据历史、导航目标和固定通信拓扑。[§III-B–D](https://arxiv.org/html/2607.19774v1#S3.SS2)

作者称路侧有 75%–90% 规划无关背景，但未给出该比例的标注规则、样本统计或测量表，故只能当作动机陈述。所谓 purification 实际按通道平均激活选 top 10%，不是由独立规划价值标签识别“背景”，这一差异决定了方法是否能稳定保留微弱危险目标。

### 相关工作与差异

| 工作与一手来源 | 已有机制 | 本文改变的环节与边界 |
| --- | --- | --- |
| Liu 等，CoDriving，2025 T-PAMI 接收版；[原文 v2 §IV-C–D](https://arxiv.org/html/2404.09496v2#S4.SS3) | 已将 waypoint 转为高斯请求图，按规划走廊与感知置信度选择稀疏 BEV 信息，再用融合特征规划。 | 本文把融合进一步放入规划 query 的联合注意力。不能把 CoDriving 概括为“完全没有规划反馈”或输入无关的常数权重；准确差异是信息进入规划解码的时机与表示。 |
| Yu 等，UniV2X，2024；[原文 v2 §3.3–3.8](https://arxiv.org/html/2404.00717v2#S3.SS3) | 用 agent/lane query 与占据概率/flow 做稀疏—稠密混合通信，显式时空同步后融合，连接中间任务与规划。 | 本文用双流运动特征、MoE 压缩及 masked planning queries；没有复现 UniV2X 的等通信、同数据比较，所以这里只比较结构，不能给性能排名。 |

## 方法和系统设计

### 双流编码与任务条件融合

两侧独立生成历史 BEV 与占据图；各自 MotionNetwork 通过 3D 卷积聚合时间，得到 256 通道运动特征。按正文，路侧 BEV 在进入 MotionNetwork 前以通道空间平均激活排序，保留 top 10%、其余置零。置零通道不必然减少通信字节，也不等同于显式剪掉空间背景。[§III-C1–2](https://arxiv.org/html/2607.19774v1#S3.SS3)

tokenizer 将特征降采样、加位置编码，用可学习 query 进行注意力池化。ego/road tokenizer 不共享参数，MoE 的 6 个专家中每次选 top 3；训练用轨迹曲率 K-means 的 6 类模式指导 router，并配负载均衡损失。未来轨迹类别是训练辅助标签，推理时应由当前隐藏状态独立路由。[§III-C3、III-E](https://arxiv.org/html/2607.19774v1#S3.SS3)

目标、两侧 token 和 planning query 串接后进入 LLaMA-style Transformer。正文定义上下文 token 双向可见，planning query 可看完整上下文和此前 query，再线性输出相对自车的二维 waypoint。这里“并行自回归”指掩码结构；正文未描述把上一步预测坐标重新作为输入逐点重跑，也没有证明使用了预训练 LLaMA 权重。[§III-D](https://arxiv.org/html/2607.19774v1#S3.SS4)

### 关键公式与直觉

原文式 2 把二维特征池化成紧凑 token：

$$
 X=\operatorname{Flatten}(F')+\operatorname{PE},\qquad Z=\operatorname{MHA}(Q,X,X).
$$

$F'$ 是降采样后的特征，$X$ 有 $H''W''$ 个位置，$Q$ 有 $k$ 个可学习 query，$Z\in\mathbb R^{k\times d}$。这减少规划端处理的位置数，但 $k_e,k_r,d$ 的具体实验取值没有在已检查正文报告，不能据此精确计算通信量。[式 2](https://arxiv.org/html/2607.19774v1#S3.E2)

式 3–5 的规划过程可直接重组为：

$$
\begin{aligned}
 S^0&=[e_{\rm target};Z_{\rm ego};Z_{\rm road};Q_{\rm plan}],\\
 S^{l+1}&=\operatorname{TransformerLayer}(S^l,S^l;M),\\
 W&=\operatorname{Linear}(S^L_{\rm plan}).
\end{aligned}
$$

$M$ 为混合因果掩码，$W\in\mathbb R^{T_f\times2}$ 为未来相对坐标。规划 token 根据场景选择两侧表示，提供了输入相关融合接口；注意力权重变化本身不是远端可靠性的概率估计，也不自动保证拒绝错误信息。[式 3–5](https://arxiv.org/html/2607.19774v1#S3.E3)

训练目标与路由退火对应式 6–7：

$$
\begin{aligned}
 \mathcal L&=\mathcal L_{1}(W,W^*)+\lambda_r(t)\mathcal L_{\rm router}+\lambda_m\mathcal L_{\rm balance},\\
 \lambda_r(t)&=0.03\max(0,1-t/T_{\rm anneal}).
\end{aligned}
$$

$W^*$ 为专家轨迹，router 标签来自训练轨迹曲率聚类，balance 鼓励各专家被使用。早期给方向监督，后期减弱；$T_{\rm anneal}$ 和 $\lambda_m$ 的数值及具体辅助损失公式未在正文完整给出。它优化轨迹与路由，未直接对 DS 或违规事件反传。[§III-E](https://arxiv.org/html/2607.19774v1#S3.SS5)

### 训练与推理边界

第一阶段冻结预训练 BEV encoder、训练 MotionNetwork、tokenizer 与 decoder；第二阶段“可选”低学习率整体微调。原文未明确主表是否执行第二阶段，也未报告完整 optimizer、epoch、batch、训练算力或 checkpoint 选择规则。这使端到端训练范围和基线预算无法完全核对。

推理保留双流、筛选、MoE 和解码器，不需要真实未来轨迹或 K-means 标签；评测称为在线 inference，但缺少通信消息格式、压缩/发送位置与控制器配置，不能仅凭 token 数将其认定为已实现低带宽协议。

## 关键图与可视化结果

![原论文图 3：双流 tokenizer、MoE 和混合掩码的详细结构](../../assets/papers/defer-to-plan-figure-3.png)

沿两侧 BEV 到 MotionNet、注意力池化、MoE，再到规划 query。实际图有必须保留的歧义：Purification 画在 CarBEV 支路，而正文说路侧筛选；右侧上下文掩码画成对角可见，而正文说上下文双向可见。这里按正文解释意图，图不能当作无歧义实施图，复现需作者代码确认。[原图 3、§III-C–D](https://arxiv.org/html/2607.19774v1#S3.F3)

![原论文图 4：左转遇横穿骑行者后的让行及继续规划](../../assets/papers/defer-to-plan-figure-4.png)

左侧骑行者在前方、自车轨迹较短；右侧通过后出现继续前进的规划点。图注将其解释为停车让行后恢复。两张截图支持行为例子的可读性，不足以证明注意力改变是原因，也不能替代全部路线的碰撞统计。[原图 4](https://arxiv.org/html/2607.19774v1#S4.F4)

## 实验结论与证据

### 设置与指标

评测为 CARLA/V2Xverse 的 8 个 town、67 条路线，包括遮挡路口和突发行人。ADE/FDE 是开放环平均/终点位置误差（m），越低越好；DS 为驾驶分，RC 为完成百分比，IS 为违规相关乘数式得分，后三者越高越好。正文未列出每次运行 seed、重复次数或置信区间，也未给出开放环 split 的样本量。[§IV-A](https://arxiv.org/html/2607.19774v1#S4.SS1)

### 主结果与匹配消融

| 原表 II | ADE ↓（m） | FDE ↓（m） | DS ↑ | RC ↑（%） | IS ↑ |
| --- | ---: | ---: | ---: | ---: | ---: |
| CoDriving | 0.619 | 1.413 | 77.15 | 92.34 | 0.82 |
| 本文 | 0.598 | 1.393 | 79.72 | 91.05 | 0.88 |

两行相差 −0.021 m ADE、+2.57 DS 分、−1.29 个 RC 百分点及 +0.06 IS。DS 相对增加 3.33%，并非增加 3.33 分；完成率下降也不是恰好相对下降 1.29%。结果提示更谨慎的行为，但没有逐事件分析，不能确认每一类违规都减少。[表 II](https://arxiv.org/html/2607.19774v1#S4.T2)

| 原表 V，同框架组件替换 | ADE ↓（m） | FDE ↓（m） | 相对完整模型的 ADE 增量（m） |
| --- | ---: | ---: | ---: |
| 完整模型 | 0.598 | 1.393 | 0 |
| 去 MoE tokenizer | 0.610 | 1.406 | +0.012 |
| 去通道筛选 | 0.612 | 1.412 | +0.014 |
| 去自回归 decoder | 0.628 | 1.447 | +0.030 |

decoder 替换影响最大，但是否保持参数量、token 数和训练预算没有报告；消融只给 ADE/FDE，不能将其直接解释为对应组件降低闭环违规。正文部分增益百分比与表值不一致，尤其末尾称相对 CoDriving ADE 改善 4.21%，而按表为 3.39%，本报告采用原始表行与可复算差值。[表 V](https://arxiv.org/html/2607.19774v1#S4.T5)

### 扰动与成本

表 III 使用自己的无噪声基准：本文 ADE 0.599 m，在“0.6”噪声档为 0.623 m，增加约 4.01%；CoDriving 为 0.618→0.652 m，约 5.50%。该噪声列没有完整交代平移/旋转分量和单位，不能写成已核实的“0.6 m 全位姿误差”。

表 IV 同样从 0.599 m 开始，600 ms 延迟为 0.613 m，约 +2.34%；CoDriving 为 0.618→0.635 m，约 +2.75%。这些基准不同于表 II，不跨表混算。表格没有直接测注意力降权、丢包或故障闭环，作者将结果解释为动态降权仍属机制解释。[表 III–IV](https://arxiv.org/html/2607.19774v1#S4.T3)

RTX 3090 单卡在线推理 trimmed mean 为 176.6 ms，其中感知 158.2 ms、规划链 18.4 ms；后者含 MotionNet 5.9、tokenizer 2.0、decoder 10.2 ms 等。没有 P95、裁剪比例或包含空口等待的定义，也没有实际消息字节数，故不能从“规划只加 18.4 ms”推导全系统满足 10 Hz。[表 I](https://arxiv.org/html/2607.19774v1#S4.T1)

## 应用场景与启发

- 作者主张：推迟融合可让当前规划上下文决定车路信息的重要性。
- 我的判断：应借鉴保留来源直到规划的接口，并与 CoDriving 已有规划请求机制叠加比较；当前证据未把融合位置、MoE 容量、通道筛选三个因素完全解耦。
- 待验证假设：在相同输入和模型容量下，晚融合对于含陈旧路侧信息的冲突场景更有价值；其优势应同时表现为错误远端信息影响更小、闭环违规更少，而不只是平均 ADE 微降。

## 局限与阅读风险

作者明确指出固定通信拓扑、动态参与者选择及显式延迟/不确定性建模尚未解决。图 3 的支路和 mask 歧义、top 10% 与文字中百分数写法、辅助损失缺参数，会影响实现是否与主表一致。

“高平均激活”等于“规划有用”只是未经独立测量的代理；弱激活的行人可能被过滤。图 5 的少量专家选择案例不能证明全数据没有专家坍缩，图 6 热图也不能单独证明危险目标召回被保留。本文价值是一个可检验的架构假设，尚需开放配置和相同预算验证。

## 后续跟进

### 最小验证与停止条件

- 当前资源（2026-09-12）：正文未提供代码、配置或权重入口；精确题名加 GitHub 检索未找到可确认的作者实现。[V2Xverse 官方仓库](https://github.com/CollaborativePerception/V2Xverse)可作为数据/CoDriving 前置资源，但本次未下载数据，也未核实本文的具体 split 和 checkpoint。
- 最小实验：先取得作者 mask、purification 支路和 tokenizer 配置；固定同一 CoDriving BEV checkpoint、路线/seed、token 数与可训练参数预算，比较原融合、仅晚融合、晚融合加筛选。给路侧注入同一 0/200/600 ms trace，记录 DS/RC/IS、关键目标漏检、信息年龄及 P95 全链路耗时；最低 GPU 需求未验证，原文只报告 RTX 3090 推理。
- 成功信号：仅改变融合位置就改善故障场景的配对闭环指标，且收益不依赖更多参数或更长等待；筛选不系统性损失弱目标。
- 停止/转向条件：图文歧义无法消除、效果只存在于开放环误差或换相同容量 decoder 即消失，则先停在架构试验，转向可解释的来源置信度或通信协议，而不宣称部署收益。

### 来源与核验记录

依据 [arXiv:2607.19774v1 全文](https://arxiv.org/html/2607.19774v1)，版本日期 2026-07-22，核验日 2026-09-12；核对 §III–IV、式 2–7、表 I–V，以及图 3、4 的实际图片和图注。作者/机构与首页一致。相关工作核对 CoDriving v2 §IV-C–D 和 UniV2X v2 §3.3–3.8。没有运行模型、获取隐藏代码或自行修正文献结果，所有未解决口径均保留为限制。
