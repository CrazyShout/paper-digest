---
{
  "id": "copad-v2x-trajectory-prediction",
  "tag": "cooperative-autonomous-driving",
  "tags": [
    "cooperative-autonomous-driving"
  ],
  "title": "CoPAD: Multi-source Trajectory Fusion and Cooperative Trajectory Prediction with Anchor-oriented Decoder in V2X Scenarios",
  "source": "IEEE/RSJ IROS 2025 / https://doi.org/10.1109/IROS60139.2025.11247038 ; arXiv:2509.15984 / https://arxiv.org/abs/2509.15984",
  "authors": [
    "Kangyu Wu",
    "Jiaqi Qiao",
    "Ya Zhang"
  ],
  "affiliations": [
    "School of Automation, Southeast University",
    "Key Laboratory of Measurement and Control of Complex Systems of Engineering, Ministry of Education"
  ],
  "comment": "CoPAD 是近期协同轨迹预测里较直接的一篇 V2X 工作，用多源轨迹融合、历史交互注意力和 anchor-oriented decoder 处理单车感知轨迹不稳定的问题。"
}
---

## 一句话定位

CoPAD 先匹配并融合车路历史轨迹，再用过去时间注意力、模态交互和每模态两个锚点解码未来；价值是把补历史的确定性步骤与较轻量的预测网络分开，而非所有指标都超过既有协同模型。

- 核心证据：DAIR-V2X-Seq 表 I 中，CoPAD 为 3.2M 参数、minFDE 2.00 m；V2X-Graph 为 5.0M、2.03 m，但其 minADE 1.17 m 优于 CoPAD 的 1.24 m，MR 同为 0.29。
- 主要边界：仅有离线预测与参数量，未测真实消息延迟、匹配故障或端到端 FPS；相对更少参数不等于已证实更快部署。[表 I、§V](https://arxiv.org/html/2509.15984v1#S4.T1)

## 论文要解决的问题

### 输入缺失为何要在编码前处理

车端或路侧轨迹都会缺点，两侧 ID 也不天然一致。如果直接编码后相加，时间位置的缺失模式可能已混入特征。CoPAD 先用距离匹配判断同一目标，再 Kalman 融合并保留未匹配轨迹，最后结合 HD map 预测六种未来。[§III-A–B](https://arxiv.org/html/2509.15984v1#S3.SS1)

输入是两侧历史目标状态和向量地图，输出为各目标未来二维坐标及模态分数；不是原始相机/LiDAR 到控制的网络，也没有自车候选计划作为输入。本文主要数据协议是 5 s 历史、5 s 未来、10 Hz，不能套用别的协同论文的 3 s 历史设置。

### 相关工作与差异

| 工作与一手来源 | 已有机制 | CoPAD 的变化与比较边界 |
| --- | --- | --- |
| Ruan 等，V2X-Graph，NeurIPS 2024 接收版；[原文 v2 §4](https://arxiv.org/html/2311.00371v2#S4) | 不同视角轨迹独立编码运动/交互，跨视角身份关联引导图上的特征融合。 | CoPAD 在网络前合并已匹配轨迹，减少双视角编码开销。表 I 显示参数/终点误差交换，而非平均误差全面领先。 |
| Zhang 等，Co-MTP，ICRA 2025；[原文 v3 §III](https://arxiv.org/html/2502.16589v3#S3) | 拼接历史后仍保留原始路侧节点，并加入路侧预测与自车计划作为未来节点。 | CoPAD 只处理历史，不依赖未来域条件。Co-MTP 使用真值拟合计划、3 s 历史，故不能直接拿它的低 minADE 与 CoPAD 排名；这里比较信息接口。 |

## 方法和系统设计

### 匹配、图编码和锚点

Hungarian 匹配只在历史首尾时刻建立对应，以降低对全部轨迹时刻求解的成本；被匹配数据用 Kalman filter 融合，未匹配轨迹继续进入模型。正文没有完整给出距离门限、滤波状态方程、观测/过程噪声以及首尾缺失时如何处理，复现需要这些参数。[§III-B](https://arxiv.org/html/2509.15984v1#S3.SS2)

各历史时刻建立目标/地图异构图，半径内节点交互，位置、道路和交通信号形成表示。PTA 缓存过去 $k_p$ 个时刻，把当前表示复制到匹配维度后做跨时间注意力；随后 mode attention 用 GAT 让不同预测模态交互。两锚点分别约束每种未来的中点和终点，Anchor MLP 与 Trajectory MLP 的输出再交给 MLP-Mixer 生成完整路径。[§III-C–E、图 2](https://arxiv.org/html/2509.15984v1#S3.SS3)

### 三组关键表达式

式 1–3 对早期融合的定义可合并为：

$$
 \mathcal T_{\rm fused}=\mathcal K\bigl(\mathcal H(\mathcal T_V,\mathcal T_I)\bigr)\cup\mathcal T_{\rm unmatched}.
$$

$\mathcal H$ 是首尾对应的 Hungarian 匹配，$\mathcal K$ 是 Kalman 融合，未匹配轨迹保留。这里省略的是配对集合的记号，不是给出新的滤波器公式。匹配错误可能合并两个目标，保留未匹配项也可能留下重复目标；后续预测不会自动知道这个错误。[式 1–3](https://arxiv.org/html/2509.15984v1#S3.E1)

原文式 4–5 的 PTA 可写作：

$$
 E_t=\begin{cases}
 \operatorname{MHCA}([d_{t-k_p};\ldots;d_{t-1}],\operatorname{Repeat}(d_t)),&t\ge k_p,\\
 \operatorname{MLP}(d_t),&t<k_p.
 \end{cases}
$$

$d_t$ 是当前编码，$k_p$ 是回看窗口；前几个历史时刻不足窗口时用 MLP。PTA 访问预测起点之前的历史，而非真实未来；具体窗口、图半径、query/key/value 实现细节未在正文完全列出。复制与拼接是维度处理，不能据此证明注意力复杂度在任何主体数下都较小。[式 4–5](https://arxiv.org/html/2509.15984v1#S3.E4)

训练目标由式 7 给出：

$$
 \mathcal L=\mathcal L_{\rm cls}+\mathcal L_{\rm reg}+\alpha\mathcal L_{\rm anchor}.
$$

分类为模态交叉熵，回归按与真值最接近的候选计算 Laplace 分布负对数似然，anchor 项为中点/终点 Huber 损失。$\alpha$ 的实际数值未给出；式 8 的模态求和、agent 下标和正文“最佳模态”描述也需实现核对，不额外补写一个自以为正确的完整 likelihood。[§III-F](https://arxiv.org/html/2509.15984v1#S3.SS6)

### 训练与推理边界

模型用 AdamW 训练 64 epoch，初始学习率 0.0003、weight decay 0.0001、dropout 0.1，cosine annealing。batch、硬件、重复种子和推理预算本次未在全文找到。Hungarian/Kalman 是独立预处理，未说明可学习或可微，因此“端到端”不能扩张为轨迹匹配也由预测损失联合优化。

推理需要历史数据和地图，保留匹配、滤波、PTA、模态注意力和锚点解码，不需要目标真值或未来计划；训练真值用于最佳模态选择和锚点监督。实时部署还需上游检测/跟踪、车路坐标和时钟对齐，本文没有测这些额外成本。

## 关键图与可视化结果

![原论文图 1：路侧补充黄色自车被遮挡目标的三种示意场景](https://arxiv.org/html/2509.15984v1/1.png)

三栏分别展示路口来车、转向冲突和前车遮挡行人。路侧位置说明为什么两源历史可以互补；这是问题示意，不是实车实验或误差可视化。[原图 1](https://arxiv.org/html/2509.15984v1#S1.F1)

![原论文图 2：Hungarian/Kalman、PTA、模式注意力与锚点解码](https://arxiv.org/html/2509.15984v1/2.png)

先看顶部 matched/unmatched 两条支路，再看历史表示进入 PTA 与地图图编码；下方 Anchor MLP 和 Traj MLP 汇入 Mixer。图支持“先融合原始轨迹，再共享预测编码”的解释，不证明所画锚点必然动态可行。[原图 2](https://arxiv.org/html/2509.15984v1#S1.F2)

## 实验结论与证据

### 设置与指标

正文将 V2X-Seq 描述为超过 60,000 个 10 s 场景，使用前 5 s 预测后 5 s、输出六模态；没有公布本次 train/validation/test 的精确样本量。minADE 是六候选中的最小平均位置误差，minFDE 是最小终点误差（m）；MR 是最佳终点仍偏离超过 2 m 的比例，均越低越好。[§IV-A](https://arxiv.org/html/2509.15984v1#S4.SS1)

### 主表的优势与退步

| 表 I | 参数（M） | minADE ↓（m） | minFDE ↓（m） | MR ↓ |
| --- | ---: | ---: | ---: | ---: |
| HiVT，单车 | 2.6 | 1.43 | 2.36 | 0.34 |
| HiVT，协同 | 2.6 | 1.29 | 2.43 | 0.35 |
| V2X-Graph，协同 | 5.0 | 1.17 | 2.03 | 0.29 |
| CoPAD，单车 | 3.2 | 1.42 | 2.30 | 0.33 |
| CoPAD，协同 | 3.2 | 1.24 | 2.00 | 0.29 |

CoPAD 相对自身单车 minADE 降 0.18 m、约 12.7%；相对 V2X-Graph 参数少 36%，终点误差仅低 0.03 m，平均误差高 0.07 m。HiVT 的协同 minFDE/MR 还略差于单车，因此作者“全部方法协同都更好”的概括不适用于每个指标。没有方差，0.03 m 不能称显著优势。[表 I](https://arxiv.org/html/2509.15984v1#S4.T1)

### 组件与锚点消融

| 表 II，同框架 | minADE ↓（m） | minFDE ↓（m） | MR ↓ |
| --- | ---: | ---: | ---: |
| KF 融合，去 PTA | 1.73 | 3.25 | 0.48 |
| KF，去 mode attention | 1.27 | 2.11 | 0.32 |
| KF，无锚点 | 1.27 | 2.08 | 0.32 |
| KF，1 个锚点 | 1.26 | 2.06 | 0.32 |
| KF，2 个锚点，完整模型 | 1.24 | 2.00 | 0.29 |
| KF，3 个锚点 | 1.25 | 2.03 | 0.31 |

PTA 的消融影响最大；两个锚点比三个略好，但这不证明两个在别的数据集、时域或候选数下仍最优。IA/IC 简单特征相加/拼接的 minADE 为 1.49/1.48，比 KF 的 1.24 差；它们不是 V2X-Graph 这类强学习融合器的等容量替身。[表 II](https://arxiv.org/html/2509.15984v1#S4.T2)

表 II 无融合 minFDE 为 2.31，而表 I 单车为 2.30，保留各表原值而不跨表重算。没有独立消融把 Hungarian 与 Kalman 分开，也没有噪声、延迟和 ID 错配扫描；无法把所有早期融合收益准确分配给某一步。

## 应用场景与启发

- 作者主张：更完整的历史和轻量预测结构改善车路协同轨迹预测。
- 我的判断：适合作为低维轨迹交换基线；核心实验应是身份/时间误差下早融合和保留多视角的学习融合谁更稳定，而非只比较网络参数。
- 待验证假设：当匹配置信度低时保留双轨迹并显式标来源，会比强行 Kalman 合并更稳健；须在相同原始观察、候选数和训练预算下检验。

## 局限与阅读风险

作者把通信延迟列为未来工作。首尾匹配可能漏掉中途身份切换或相交轨迹；滤波模型和噪声参数未充分描述，也没有独立真值验证融合后的历史更准确。

min-of-six 指标允许系统保留一条好候选而其他候选不可靠，未给出概率校准或 downstream planner 的选择后果。本文的少量成功场景、较少参数和离线 minFDE 不能推出车辆安全或真实推理速度。

## 后续跟进

### 最小验证与停止条件

- 当前资源（2026-09-12）：v1 全文及官方图可访问；正文未给代码、配置或权重，精确题名/作者检索未确认作者实现。V2X-Seq 已命名，但本次未下载数据或核验所用 split；Kalman 方程、匹配门限和锚点参数是关键前置材料。
- 最小实验：取得实现后固定同一 V2X-Seq 子集与六模态，用同一网络对比无融合、KF、按匹配置信度保留双观测；注入 0/200/500 ms 时间偏移与人工核验的身份错配。记录融合历史误差、minADE/FDE/MR、重复目标比例和包括匹配的 batch=1 时延；硬件最低需求未报告。
- 成功信号：在无误差时复现原表量级，在误差场景仍保留预测收益且不增重复/错误合并目标；较少参数确实转化为全流程低时延。
- 停止/转向条件：收益只在完美配对成立，或错误融合使本来正确的单车轨迹恶化，则转向不确定性和身份关联，停止把参数优势当部署依据。

### 来源与核验记录

依据 [arXiv:2509.15984v1](https://arxiv.org/html/2509.15984v1)，2025-09-19 版本，2026-09-12 核验；重点读 §III–IV、式 1–8、表 I–II、图 1/2 实际图片，机构由首页确认。相关机制来自 V2X-Graph v2 §4、Co-MTP v3 §III；后者历史/未来条件不同，不作直接数值排名。未比较 IROS 会议版逐页变更，未运行模型。
