---
{
  "id": "stabledrive-selective-memory",
  "tag": "end-to-end-autonomous-driving",
  "tags": [
    "end-to-end-autonomous-driving"
  ],
  "title": "Not All History Helps: Velocity-Aware Selective Memory for Long-Horizon End-to-End Autonomous Driving",
  "source": "arXiv:2608.15573 / https://arxiv.org/abs/2608.15573 / HTML: https://arxiv.org/html/2608.15573v1",
  "authors": [
    "Yuchen Liu",
    "Ziying Song",
    "Shengkai Zhang",
    "Jiannan Chen",
    "Peiliang Wu",
    "Lei Yang",
    "Bin Sun",
    "Yan Gong",
    "Li Wang"
  ],
  "affiliations": [
    "Nanyang Technological University",
    "North University of China",
    "Yanshan University",
    "Beijing Jiaotong University",
    "China Automotive Technology and Research Center Co., Ltd.",
    "Harbin Institute of Technology",
    "Beijing Institute of Technology"
  ],
  "comment": "StableDrive 反对无条件累积规划历史，只选择性复用前一周期并在训练时加入运动阶段支架；它在完整 nuScenes、专门构造的纵向转换子集和 NAVSIM navhard 上同时改善长时误差、碰撞与跨周期稳定性。"
}
---

## 一句话定位

StableDrive 研究“上一周期自己预测的计划还能不能信”：部署时只保存一个周期的规划 query，用分数调制和输入相关的状态更新控制它的影响；训练时额外学习停车、起步和加减速阶段，最后移除辅助模块，把两个训练端点合成一个 checkpoint。

- 核心证据：相同框架的一、二、四周期历史对照中，六时刻平均碰撞率分别为 0.66%、0.83%、0.87%，支持“增加历史长度不保证收益”。[原文表 IX](https://arxiv.org/html/2608.15573v1#S5.T9)
- 主要边界：收益包含记忆、额外训练监督和参数中点三个环节；不能全部归因于 Mamba，也没有证明一个周期对所有任务都最优。

## 论文要解决的问题

### 问题与假设

车辆刚停车时，上一周期的加速轨迹仍可能保持合理的道路形状，却已经给出了错误的纵向速度趋势。历史规划状态是模型预测，包含旧意图和旧错误；它与历史相机观测的可靠性并不相同。StableDrive 希望稳定场景保留连续性，起步、刹停或跟车关系变化时减少过时先验。

论文把两个时间尺度分开：跨周期记忆决定如何使用过去；单条未来轨迹内部的运动阶段决定接下来如何加速、巡航、减速或停车。标题中的 velocity-aware 主要落实在训练监督和阶段建模上，部署时没有把真实未来速度提供给记忆门。[原文 §IV-B–C](https://arxiv.org/html/2608.15573v1#S4.SS2)

### 相关工作与差异

| 工作与一手来源 | 已有机制 | StableDrive 的变化与比较边界 |
| --- | --- | --- |
| Song 等，MomAD，CVPR 2025；[原文 §3.1–3.2](https://openaccess.thecvf.com/content/CVPR2025/papers/Song_Dont_Shake_the_Wheel_Momentum-Aware_Planning_in_End-to-End_Autonomous_Driving_CVPR_2025_paper.pdf) | 用 Hausdorff 距离匹配当前候选与历史路径，再通过历史 query 的 LSTM 编码及交叉注意力更新规划。 | StableDrive 用逐槽位的一周期缓存和输入相关 SSM 更新。MomAD 本身已有分数调制与匹配，不能概括为完全不选择历史。 |
| Zhang 等，BridgeAD，CVPR 2025；[原文 §3.2–3.4](https://arxiv.org/html/2503.14182v1#S3.SS2) | 把运动和规划 query 拆到各未来时间步，匹配历史中对应时刻的 query，并在预测、感知与规划间交互。 | StableDrive 主要约束历史的影响和纵向阶段，未复现 BridgeAD 的逐未来时刻记忆结构；二者原文规划时长也不同，不能直接用六秒结果判定优劣。 |

## 方法和系统设计

### 输入输出与缓存生命周期

多视角图像经 ResNet-50 和稀疏感知生成车辆、地图表征，再形成 $C=3$ 个命令分支、每个 $K=6$ 个轨迹模式的规划 query。每个候选输出 $H=12$ 个二维位移增量，间隔 0.5 秒，覆盖六秒；沿用基础规划器的碰撞感知重评分和最大分数选择。[原文式 2、§IV-A](https://arxiv.org/html/2608.15573v1#S4.SS1)

缓存保存全部 18 个固定“命令—轨迹锚点”槽位的增强后 query 与对应 score logit，不只是最终选中的一条轨迹。历史先进入因果序列，当前 query 在后；输出以残差加入当前 query，再生成轨迹并 detach 写回。场景变化、时间不连续或缺帧时重置；不同分布式 rank 的缓存隔离。因而“一周期缓存”仍可间接携带上一周期增强过的信息，不等于完全没有更早历史。[原文 §IV-B](https://arxiv.org/html/2608.15573v1#S4.SS2)

### 关键公式与直觉

以下合并原文式 3–7，省略命令和模式下标：

$$
\begin{aligned}
h_{t-1}&=\sigma(\widehat s_{t-1})\operatorname{sg}(\widehat q_{t-1}),\\
\widetilde q_t&=q_t+\alpha_{\mathrm{mem}}\operatorname{LN}\bigl(\Phi_{\mathrm{mem}}([h_{t-1},q_t])[-1]\bigr).
\end{aligned}
$$

$\widehat q$、$\widehat s$ 来自前一周期，$\operatorname{sg}$ 停止跨周期梯度，$\sigma$ 把历史候选分数转为调制权重，$\Phi$ 是 Mamba 状态更新。$\alpha_{\mathrm{mem}}$ 从 $10^{-3}$ 初始化后学习，让初始模型接近原规划器。上式仅在缓存有效时使用；无历史时严格返回 $q_t$。旧分数只是候选偏好，是否适合当前上下文还依赖 SSM 的输入相关更新，并非已经校准的安全概率。

MSTS 的目标是原文式 8：

$$
\begin{aligned}
\mathcal L_{\mathrm{MSTS}}&=\mathcal L_{\mathrm{base}}+0.05\mathcal L_{\mathrm{phase}}+0.10\mathcal L_{\mathrm{far}}+0.10\mathcal L_{\mathrm{long}},\\
\mathcal L_{\mathrm{long}}&=0.5\mathcal L_y+0.3\mathcal L_{v_y}+0.2\mathcal L_{a_y}.
\end{aligned}
$$

真实未来轨迹只生成监督：纵向速度绝对值小于 0.5 m/s 为静止；非静止时加速度高于 0.5 m/s² 或低于 −0.5 m/s² 分别为加速、减速，其余巡航。阶段分类采用交叉熵；$\mathcal L_{\mathrm{far}}$ 监督第 8–12 个未来点的累计位置，$\mathcal L_{\mathrm{long}}$ 监督纵向位置、速度、加速度。预测阶段分布进入 Horizon Mamba，真实阶段标签不进入前向输入。[原文 §IV-C](https://arxiv.org/html/2608.15573v1#S4.SS3)

### 训练、参数中点与推理

两个训练分支从同一 SMM checkpoint 出发，各接受 11,720 次优化更新：一个只有 SMM，另一个带 MSTS。后者移除辅助张量后与前者架构一致，再按原文式 12 对名称、形状、类型匹配的浮点张量取固定中点：$\theta_{\mathrm{SD}}=0.5\theta_{\mathrm{SM}}+0.5\theta_{\mathrm{VT}}$。非浮点缓冲区要求一致并原样复制。中点对两端等距只是几何性质，不是规划性能最优性的证明。[原文 §IV-D–E](https://arxiv.org/html/2608.15573v1#S4.SS4)

推理只保留一个 SMM 规划器，不运行 MSTS，也不合并两个模型的输出。训练使用四张 GPU、总 batch 24、AdamW，初始学习率 $1.5\times10^{-4}$；双分支训练有实际成本，不能从“推理图相同”推导“训练免费”。GPU 型号和完整训练时长未在 §V-C 给出。[原文实现](https://arxiv.org/html/2608.15573v1#S5.SS3)

## 关键图与可视化结果

![原论文图 1：旧规划惯性与选择性记忆在六秒预测中的差别](https://arxiv.org/html/2608.15573v1/fig01_motivation.png)

先看白色真实轨迹与橙、绿色预测在三秒后的分离，再看六秒预测自车框是否与日志中的车辆占用重叠。右侧柱图使用作者的本地 MomAD 复现，不能与表 I 的历史文献行混用；图中 collision-free 是该离线样例的框重叠结果。[原图注](https://arxiv.org/html/2608.15573v1#S1.F1)

![原论文图 6：三个连续规划周期对齐到共同未来时刻后的终点分散](https://arxiv.org/html/2608.15573v1/fig06_temporal_consistency.png)

上行为 MomAD，下行为 StableDrive；绿、橙、蓝虚线分别表示不同周期生成的计划，灰色区域表示终点分散。读图前必须做位姿和时间对齐，否则正常自车运动也会看起来像抖动。图支持跨周期漂移的直观解释，不能证明所有场景中更稳定的计划都更安全。[原图注](https://arxiv.org/html/2608.15573v1#S5.F6)

## 实验结论与证据

### 设置与指标

nuScenes 使用完整 150 个验证场景；L2 是与日志专家的位移误差，碰撞率是预测车辆框与未来参与者占用的重叠比例，TPC 衡量相邻周期对齐后的计划差异，三者越低越好。评价器用真实未来确定规定命令分支，因此验证的是给定命令的局部规划，未验证路由意图推断。[原文 §V-A–B](https://arxiv.org/html/2608.15573v1#S5.SS1)

LT-nuScenes 由真值运动学筛选，包含 16 个完整场景、642 个顺序推理帧，只对 189 个纵向转换目标计分；TPC 进一步使用其中有有效前序周期的 176 个目标。它要求持续事件至少一秒，并排除满足阈值的转弯和换道，适合检验停车起步假设，不代表全体长尾驾驶。

NAVSIM-v1 使用非反应式日志交通。v2 使用修正后的 v2.2 EPDMS，背景车辆通过 IDM 响应自车，但每段轨迹提交后规划器不在段内持续读取闭环反馈；navhard 两阶段再使用预生成偏移观测评估后续恢复。PDMS/EPDMS 综合碰撞、可行驶区域、进展与舒适性等，属于协议分数，不能解读为实车安全成功率。[NAVSIM v2 原文 §3.1](https://arxiv.org/html/2506.04218v3#S3.SS1)

### 主要结果与比较

| 设置与原表 | 配置 | L2 / 碰撞率 / TPC，均越低越好 | 解读 |
| --- | --- | --- | --- |
| 完整 nuScenes，表 I，1–6 秒平均 | StableDrive | 1.20 m / 0.66% / 0.85 m | 文献行骨干、训练及硬件不同；摘要的三个相对增益来自各指标不同的最好历史值。 |
| LT-nuScenes，表 II，1–6 秒平均 | 本地 MomAD† | 1.37 m / 3.08% / 0.85 m | 使用相同本地协议的主要对照。 |
| 同上 | StableDrive | 1.32 m / 1.49% / 0.79 m | 碰撞率下降 1.59 个百分点，按表中舍入值计算约下降 51.6%。 |
| LT-nuScenes，表 II，六秒单点 | MomAD† → StableDrive | 2.65 → 2.48 m；5.56% → 4.23% | 六秒单点与六时刻平均不能混用。 |

NAVSIM 表 III–V 分别报告 90.4 PDMS、90.0 EPDMS、42.6 两阶段 EPDMS；42.6 比表中已修正协议的 36.9 高 5.7 分。带 EPDMS* 的旧版结果必须单列，不能跨 bug fix 排名。[原文主表](https://arxiv.org/html/2608.15573v1#S4.T3)

### 消融、成本与判断边界

表 VIII 的 4–6 秒平均显示 SMM 端点为 2.00 m / 1.24% / 1.23 m，移除 MSTS 的训练端点为 1.88 m / 1.35% / 1.22 m，中点为 1.83 m / 1.19% / 1.20 m。两个端点在精度和碰撞方面确有不同取舍，中点在这次实验兼顾二者；这比把全部收益归给“记忆选择”更符合证据。表 IX 则固定框架比较一、二、四周期，得到 1.20/1.27/1.24 m 的平均 L2 和 0.66/0.83/0.87% 的碰撞率。[表 VIII–IX](https://arxiv.org/html/2608.15573v1#S5.T8)

部署模型为 87.153M 参数、192.728 GFLOPs；RTX 4090、单样本 FP16 稳态下为 192.3 ms、5.2 FPS、峰值已分配 CUDA 显存 1.714 GB。峰值 allocated memory 不是整卡显存需求，单次模型耗时也不包含整车系统预算。论文未给多种子方差，不能把小幅差异称为显著提升。

## 应用场景与启发

- 作者主张：选择性复用与运动阶段训练能改善长时规划和纵向转换。
- 我的判断：最值得迁移的是场景隔离、断序重置、显式无历史旁路和匹配训练预算；这些可直接降低缓存实现错误。参数中点的普适性证据较弱。
- 待验证假设：在相同训练预算下，加入“历史速度趋势与当前观测是否一致”的显式门控，可能比仅使用旧分数更快拒绝错误加速记忆；也可能误删稳定跟车所需信息，需要同时测安全与进展。

## 局限与阅读风险

作者明确承认候选生成和排序限制：好轨迹可能存在却没被选中。没有真实车辆或连续交互仿真结果来说明较低 TPC 会转化为更少事故；过于保守的错误计划也可能很一致。LT-nuScenes 样本小且筛选规则针对纵向变化，不能替代弯道、路口和横向交互测试。固定中点只在这一对训练端点及相关架构上验证；同一初始化和张量对齐是使用前提。

## 后续跟进

### 最小验证与停止条件

- 资源状态（2026-09-12）：固定版全文没有项目或下载链接；按 StableDrive 精确仓库名检索未找到公开仓库。nuScenes/NAVSIM 是既有数据源，但本次未找到 LT-nuScenes 清单、StableDrive 配置及权重，因此不能把实验设想写成可立即复现的完整配方。
- 最小实验：获得实现后先固定场景顺序、命令协议、初始化和 11,720 更新预算，复核一周期与四周期记忆；加入零缓存对照，并记录完整集和 189 个转换目标的碰撞、L2、TPC、进展和实际时延。用多次训练或按场景重采样评估不确定性。
- 成功信号：一周期在转换目标上的碰撞改善可跨训练重复，同时普通场景进展和 L2 不退化；断序和跨场景测试必须严格走无历史旁路。
- 停止/转向条件：收益主要来自不同初始化、额外更新或缓存串场；或 TPC 改善却碰撞/进展变差。此时先修协议或候选排序，再增加记忆容量。

### 来源与核验记录

本报告依据 [arXiv:2608.15573v1 全文](https://arxiv.org/html/2608.15573v1)，于 2026-09-12 核对方法 §IV、实验 §V、表 I–IX 和 PDF 首页单位；原图 1、6 已逐张打开。相关工作依据 MomAD 正式 PDF §3 和 BridgeAD v1 §3；评测语义另核对 NAVSIM v2 原文。没有下载训练数据、运行模型或完成实验复现。
