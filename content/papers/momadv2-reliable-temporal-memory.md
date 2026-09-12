---
{
  "id": "momadv2-reliable-temporal-memory",
  "tag": "end-to-end-autonomous-driving",
  "tags": [
    "end-to-end-autonomous-driving",
    "world-models"
  ],
  "title": "MomADv2: Reliable Temporal Memory for End-to-End Autonomous Driving",
  "source": "arXiv:2608.23405 / https://arxiv.org/abs/2608.23405 / HTML: https://arxiv.org/html/2608.23405v1 / Repository: https://github.com/ADEPT-ORG/MomADv2",
  "authors": [
    "Ziying Song",
    "Shengkai Zhang",
    "Lin Liu",
    "Peiliang Wu",
    "Lei Yang",
    "Dongyang Xu",
    "Bin Sun",
    "Li Wang",
    "Shaoqing Xu",
    "Caiyan Jia",
    "Yadan Luo"
  ],
  "affiliations": [
    "School of Artificial Intelligence (School of Software), Yanshan University",
    "Beijing Jiaotong University",
    "Nanyang Technological University",
    "Tsinghua University",
    "China Automotive Technology and Research Center Co., Ltd.",
    "School of Mechanical Engineering, Beijing Institute of Technology",
    "University of Macau",
    "The University of Queensland"
  ],
  "comment": "MomADv2 先按命令、时序和轨迹匹配筛选历史 query，再用 flow matching 做局部残差细化；nuScenes 开放环实现与权重已发布，但代码训练配置和论文主表仍需逐项对齐。"
}
---

## 一句话定位

MomADv2 将“保存历史”改为“审核历史后再使用”：先按命令、时间连续性和轨迹匹配读取可靠 planning query，经 selective SSM 残差注入当前 query，再用 flow matching 细化局部轨迹。它研究历史规划状态的可靠性，没有预测完整未来场景或反事实世界。

- 核心证据：保留相同 FM-Ref 时，nuScenes 六时刻平均碰撞率从无历史的 0.92%、直接融合的 1.01%，降至完整选择性记忆的 0.76%。[原文表 7](https://arxiv.org/html/2608.23405v1#Sx4.T7)
- 主要边界：表格、正文和新发布配置仍有未对齐项；现在可以开始复核 nuScenes 实现，但还不能把公开代码等同全部主表结果已复现。

## 论文要解决的问题

### 问题与成立前提

导航命令从直行改成左转，或当前场景与缓存并不连续时，上一周期看似稳定的 query 可能把规划器拉回旧意图。同一命令内部还有多条候选，其索引也不一定跨周期对应；直接复制第 $j$ 个历史 query，可能继承另一条轨迹模式。

作者还区分模式连续性与局部误差：记忆帮助维持意图，但粗候选的长期位移误差仍可能累积，因此加上从已有计划到专家轨迹的残差细化。两者是不同模块，消融必须分别衡量。方法依赖正确高层命令、可用自车位姿和可追踪的前序关系；论文没有给出无命令意图推断。[原文方法](https://arxiv.org/html/2608.23405v1#Sx3)

### 相关工作与差异

| 工作与一手来源 | 已有机制 | MomADv2 的具体变化 |
| --- | --- | --- |
| Song 等，MomAD，CVPR 2025；[正式论文 §3.1–3.2](https://openaccess.thecvf.com/content/CVPR2025/papers/Song_Dont_Shake_the_Wheel_Momentum-Aware_Planning_in_End-to-End_Autonomous_Driving_CVPR_2025_paper.pdf) | 已做坐标变换、Hausdorff 轨迹匹配及历史 query 交互，保持规划连续性。 | MomADv2 加入命令/断序硬过滤、重叠未来时间对齐和可靠性残差门；不能把旧版说成完全没有匹配或筛选。 |
| Liu 等，StableDrive，2026 预印本；[原文 §IV-B–E](https://arxiv.org/html/2608.15573v1#S4.SS2) | 只缓存一周期的增强后 query/score，使用输入相关 SSM；训练阶段支架最终移除，并取两个端点的参数中点。 | MomADv2 保存增强前 query 和基线轨迹，显式匹配多周期历史，推理保留 flow refiner。可靠记忆与 SSM 的大方向已有同期工作，差异在缓存、过滤和细化接口。 |

两篇使用不同本地复现、训练和时序设置，不能拿 StableDrive 的 0.66% 与本文 0.76% 直接作同协议排名。

## 方法和系统设计

### 从输入到最终轨迹

多视角相机先产生稀疏车辆和地图表示，anchor-based decoder 输出命令相关候选及原始 planning query。每个缓存条目保存增强前 query、基线候选轨迹、命令和连续性 token；不把本次增强后的 query 递归写回，从设计上减少自我放大的漂移。[原文式 1、附录 A.5](https://arxiv.org/html/2608.23405v1#Sx3.SSx2)

读取时先拒绝异命令、断序和不存在的条目。之后丢弃旧轨迹已过去的时间点，按相对 ego 位姿变换，并在重叠未来时刻比较轨迹距离；时间不整齐时插值，无重叠未来时拒绝。每个当前候选找到最相近的历史候选，再把相应 query 序列交给因果 SSM。时间 token 只用于索引与有效性判断，不作为 learned feature 输入。

SSM 输出的变化经可靠性门、候选门和范数限制加入当前 query，重新生成计划。FM-Ref 再在累计位置空间细化，最终输出二维轨迹；它不产生新的传感器画面，且仍受粗候选、条件 query 和训练专家分布约束。

### 关键公式：可靠性不等于真实安全

用原文式 2、6–7、14–15 合并说明历史筛选与注入：

$$
\begin{aligned}
\phi_{t,k,j}&=m_{t,k}\exp(-d_{t,k,j}/\alpha)\exp(-k/\beta),\\
w_{t,k,j}&=\frac{\phi_{t,k,j}}{\sum_{k'}\phi_{t,k',j}+\epsilon},\\
\widetilde Q_{t,j}&=Q_{t,j}+\operatorname{Clip}\bigl(g_{t,j}\Delta Q_{t,j},\rho\lVert Q_{t,j}\rVert_2\bigr).
\end{aligned}
$$

$m$ 是命令、连续性和缓存存在的硬有效性指示，$d$ 是对齐后的轨迹距离，$k$ 是历史年龄；$\alpha,\beta$ 控制相似度与时间衰减。$g$ 还综合有效历史数量和最小匹配距离的可靠性门，$\rho$ 限制 query 更新幅度。权重偏爱近期且相似的计划，但“与当前候选相似”不代表两条计划都正确；共同的错误可能通过一致性检查。原文式 5–7 的加权汇总与式 11 的完整历史序列都应在复核实现时检查，不能擅自把权重当作已经校准的概率。

FM-Ref 用原文式 24–26 学习残差速度场：

$$
\begin{aligned}
x_\tau&=(1-\tau)x_0+\tau x_1,\qquad \tau\sim\mathcal U(0,1),\\
\mathcal L_{\mathrm{FM}}&=\lVert f_\theta(\widetilde Q_t,x_\tau,\tau)-(x_1-x_0)\rVert_2^2.
\end{aligned}
$$

$x_0$ 是 SSM 后候选经累计求和并按尺度 $s$ 归一化的绝对轨迹，$x_1$ 是专家轨迹的相同表示；损失作用于 sampler 选中的监督候选。$f_\theta$ 由 query、当前轨迹状态与 flow 时间条件化。这里的 $\tau$ 是细化进度，不是道路场景里的未来秒数；专家只在训练提供终点监督。[原文 §FM-Ref](https://arxiv.org/html/2608.23405v1#Sx3.SSx3)

推理没有 $x_1$，按原文式 27–29 从 $x_0$ 做两步 Euler，再门控回写：

$$
\begin{aligned}
x_{k+1}&=x_k+\tfrac1S f_\theta(\widetilde Q_t,x_k,(k+0.5)/S),\quad S=2,\\
Y^{\mathrm{flow}}&=s\bigl[x_0+\eta(x_S-x_0)\bigr],\quad
\eta=\eta_{\min}+\eta_{\max}\sigma(g_{\mathrm{flow}}).
\end{aligned}
$$

因此门范围是从 $\eta_{\min}$ 到 $\eta_{\min}+\eta_{\max}$，并非简单以上式的 $\eta_{\max}$ 为上界。有限步、有限 gate 控制的是残差影响，不能推出避碰约束或动力学可行性保证。

### 训练与在线状态更新

flow 分支对输入轨迹和增强 query 停止梯度，另有位移/累计轨迹回归损失。附录的 nuScenes 两阶段训练先使用预训练 MomAD，随后冻结图像骨干、稀疏感知、预测及大部分规划层，只训练新 SSM、门控、残差和 flow 模块，按配置可联合微调最后回归层；BatchNorm 保持 evaluation 模式。[原文附录 A.6](https://arxiv.org/html/2608.23405v1#A1.SS6)

推理每帧只执行一次感知，然后依次基线规划、缓存匹配、SSM、重新规划、两步 flow，并写入增强前状态。参数不更新，只有显式记忆变化，所以这是有状态推理，不是 test-time training。

## 关键图与可视化结果

![原论文图 1：无差别历史干扰与可靠状态选择的动机](https://arxiv.org/html/2608.23405v1/motivationv13.png)

先看直行/转向意图不一致如何影响 query，再看右边三个与六个未来秒数的 L2 和碰撞柱图。右侧是文中给出的特定结果，不是所有时序方法的系统对照；图中“naive”也不能取代对 MomAD 实际匹配模块的阅读。[原图注](https://arxiv.org/html/2608.23405v1#Sx1.F1)

![原论文图 2：历史过滤、选择性状态更新与 flow 细化完整流程](../../assets/papers/momadv2-reliable-temporal-memory-figure-2.png)

从左向右读取视觉感知、SSM-Q、FM-Ref 和轨迹输出；SSM-Q 内先选历史再建模，FM-Ref 的 GT 分支是训练专用。此图从固定版官方 PDF 第 3 页提取，保留同一原图；HTML 对应文件仅为极小缩略图，不足以辨认模块。[原图与图注](https://arxiv.org/html/2608.23405v1#Sx1.F2)

![原论文图 5：GuideFlow 与 MomADv2 在四类 NAVSIM 场景的轨迹对照](https://arxiv.org/html/2608.23405v1/Navsim_vis_flv3.png)

上行为 GuideFlow，下行为 MomADv2；按列比较路口、直路及弯道的车辆框、道路边界与预测点。样例说明局部几何和可行驶区域差别，没有展示段内重规划，不能单凭图认定六秒真实闭环更稳定。[原图注](https://arxiv.org/html/2608.23405v1#A1.F5)

## 实验结论与证据

### 设置与指标

nuScenes 是开放环，相机输入，L2 是与日志专家的位移距离，碰撞率按朝向随轨迹变化的自车框与周围参与者重叠统计；平均值跨所报一至六秒时刻，不能当作六秒单点。Bench2Drive 使用 v0.0.3、base 1,000 clips 与 220 路线，DS 结合路线完成和违章罚分，SR 是成功路线比例。[原文实验与附录 A.3–A.4](https://arxiv.org/html/2608.23405v1#A1.SS3)

NAVSIM-v1 使用非反应式日志交通。v2 加入 IDM 反应式车辆，navhard 再组合原观测和预生成后续偏移观测；每个四秒 rollout 内规划器不持续接收新反馈。本文把若干 NAVSIM 设置称为 closed-loop，应按评测原论文理解其范围，不能与 CARLA 连续闭环或实车混用。[NAVSIM v2 原文](https://arxiv.org/html/2506.04218v3#S3.SS1)

### 主要结果与配置隔离

| 设置与原表 | 配置 | 关键结果 | 比较边界 |
| --- | --- | --- | --- |
| nuScenes，表 1，1–6 秒平均 | MomAD → MomADv2 | L2 1.42 → 1.21 m；碰撞 0.90% → 0.76% | 下降 0.14 个百分点，按舍入值相对下降约 15.6%；不是减少 15.6 个百分点。 |
| 同上，六秒单点 | MomAD → MomADv2 | L2 2.45 → 2.40 m；碰撞 2.13% → 2.03% | 远端收益小于部分短时点，不能用平均增益代表每个时刻。 |
| Bench2Drive，表 2，无蒸馏 | MomAD → MomADv2 | DS 47.91 → 52.32；SR 18.11% → 24.24% | 同组数字可对应比较。 |
| Bench2Drive，表 2，专家特征蒸馏 | MomADv2* | L2 0.77 m；DS 78.82；SR 46.50% | 额外专家监督；不能拼接无蒸馏的 0.76 m 或 24.24%。 |
| NAVSIM，表 3–5 | MomADv2 | v1 navtest 89.9 PDMS；v2 navtest 87.9 EPDMS；v2 navhard 39.5 EPDMS | split 和聚合不同，不按三个数字高低比较难度或“安全率”。 |

navhard 的进展/舒适性并非同时最优：表 4 中 Stage 1 EP 为 73.4、EC 为 51.0，低于 GuideFlow 的 82.3、67.8；高总分有分项取舍。论文未提供多种子区间，不能声称统计显著。[原文主表](https://arxiv.org/html/2608.23405v1#Sx3.T1)

### 消融与计算代价

NAVSIM-v1 表 6 中基线 84.0，加入 SSM-Q 为 86.9，再加 FM-Ref 为 89.9 PDMS，后两步分别增加 2.9 和 3.0 分。nuScenes 表 7 则保留 FM-Ref，仅改变记忆：无历史 0.92%、直接融合 1.01%、命令过滤 0.89%、再加连续性 0.83%、再加轨迹对齐 0.79%、完整 0.76%。前者检验模块组合，后者才更接近记忆策略对照。

表 8 的 $K=1,2,4,6,8$ 分别为 88.2、89.1、89.9、88.5、87.7 PDMS，支持本配置存在有限历史最优点。表 13 已比较 MLP、GRU、LSTM、Transformer、普通 SSM 与 selective SSM，不能说论文完全没有替代记忆模块对照；但参数量、完全匹配的更新预算仍不足以排除容量贡献。[消融表 6–8](https://arxiv.org/html/2608.23405v1#Sx4.T6)，[表 13](https://arxiv.org/html/2608.23405v1#A1.T13)

作者报告 8 张 RTX 4090，nuScenes/Bench2Drive/NAVSIM 分别约 10.3/49.1/3.0 小时；对应主文 batch 48/48/64、epoch 20/2/100。表 13 报 selective SSM 43.0 FPS，但未完整绑定 batch、精度和测时范围，不能与 StableDrive 的单样本测时直接比快慢。训练墙钟、显存和可复现端到端耗时仍需从实际配置重测。

## 应用场景与启发

- 作者主张：可靠历史与小幅轨迹细化提高长时规划精度、连续性和安全。
- 我的判断：最有迁移价值的是缓存保存未增强状态、对齐共同未来时间、无有效历史时旁路。这些机制能独立放入 query memory，未必需要同时引入 flow refiner。
- 待验证假设：在命令不变但场景突变时，加入当前感知残差或未来不确定性作为历史拒绝条件，会优于仅检查轨迹相似度；若感知噪声导致频繁拒绝，也可能损害连续性。

## 局限与阅读风险

作者明确承认预定义命令依赖和未建模未来场景不确定性。图与门控只证明信息被限制，不提供形式化安全界。跨城、传感器故障和真实车辆均未验证。

固定版有三处需要保留的问题：表 12 基线四至六秒碰撞为 0.87/1.54/2.33%，而表 1 的 MomAD 为 0.83/1.43/2.13%，未解释差异；表 14 标题称 NAVSIMv2 navtest，列名与 89.9 数值却对应 v1 PDMS，因此不将其当作独立 v2 solver 证据；正文 Bench2Drive 段落交替讨论两种蒸馏配置，引用必须回到表 2 的具体行。论文主文、附录与公开训练配置的预算也不同，不能未经复核合并成一套配方。

## 后续跟进

### 最小验证与停止条件

- 资源状态（2026-09-12）：[MomADv2 仓库](https://github.com/ADEPT-ORG/MomADv2) 已发布 nuScenes 六秒开放环源码、配置、数据转换与评测脚本。权重通过 Git LFS 提供，README 和指针标记 351,387,381 bytes，媒体端 HEAD 返回 200 及相同长度；本次未下载二进制或独立验证其 SHA-256。仓库明确不包含 NAVSIM/Bench2Drive 实现。
- 配置边界：[公开 config](https://github.com/ADEPT-ORG/MomADv2/blob/main/open_loop/projects/configs/MomADv2_small_stage2_6s.py) 实际为总 batch 12、四卡、10 epoch、学习率 $3\times10^{-6}$，不同于主文的 48/八卡/20 epoch。README 也要求显式调整，而非宣称两者相同。nuScenes 原数据和 CAN bus 仍需另行准备。
- 最小实验：先用发布权重、指定 commit 和六秒转换器核对表 1；确认检测框朝向、命令选择、场景顺序与断序重置一致后，再固定 FM-Ref，比较无记忆、直接融合和完整过滤。记录总更新、可训练参数、有效缓存比例、碰撞/L2/TPC 与单帧时延。
- 成功信号：能重现公开权重结果的合理数值范围，且相同预算下直接融合退化、过滤恢复的趋势跨训练或场景重采样稳定；命令突变与断序必须触发正确拒绝。
- 停止/转向条件：主表差异无法用协议解释，或收益只来自额外 fine-tuning/flow 模块；此时先修复配方与表格映射，不扩大闭环复现或加入更长历史。

### 来源与核验记录

依据 [arXiv:2608.23405v1](https://arxiv.org/html/2608.23405v1)，2026-09-12 重开全文、附录、PDF 首页、式 1–33 与主要/消融表。原图 1、2、5 均逐张打开，图 2 另对照官方 PDF 第 3 页后提取清晰版本。相关工作分别核对 MomAD 正式全文和 StableDrive v1；代码状态另核对仓库树、README、config 和 LFS 元数据。未运行模型或声称完成实验复现。
