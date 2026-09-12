---
{
  "id": "barrier-conformal-clearance-certification",
  "tag": "autonomous-driving-testing",
  "tags": ["autonomous-driving-testing", "end-to-end-autonomous-driving", "autonomous-driving-security"],
  "title": "Barrier Function Conformal Safety Clearance Certification with CVaR for Driving Trajectory Selection",
  "source": "arXiv:2608.26533 / https://arxiv.org/abs/2608.26533 / PDF: https://arxiv.org/pdf/2608.26533",
  "authors": ["Pei Yu Chang", "Qadeer Ahmed"],
  "affiliations": ["The Ohio State University"],
  "comment": "这篇工作不再用预测碰撞分数替代安全结论，而是把候选生成、风险评价和轨迹选择整体纳入 conformal calibration，为最终选中轨迹给出 realized OBB clearance 下界。nuPlan 证据强，但保证依赖 session exchangeability，且论文明确没有声称闭环 conformal guarantee。"
}
---

## 一句话定位

这篇论文为自动驾驶最终选中的候选轨迹提供一个以米为单位的间距下界：先把车辆旋转包围盒的几何间距变成可计算的保守 margin，再对“预测、评价、选择”整条固定流程做 conformal calibration。值得读的是几何下界和选择后校准怎样接起来，而不是把预测风险分数直接当成真实安全概率。

- **核心证据**：在 150 个 held-out nuPlan sessions 上，目标覆盖率 90% 时，CVaR 配置将非负证书比例从 68.7% 提到 87.3%，同时保持 96.0%–96.7% 的实际间距覆盖率；原文表 I。
- **主要边界**：保证依赖校准和部署 sessions 的 exchangeability；主实验每个 session 只有一个 query，另做的闭环干预没有 conformal 保证。

## 论文要解决的问题

### 问题与假设

输入包括自车及附近目标的历史状态、地图和路线，外部 planner 返回有限候选集。系统要在未知他车未来的情况下，输出一条轨迹及其未来最小 signed OBB clearance 的下界。OBB 是随车辆朝向旋转的矩形包围盒；正间距表示分离，负间距表示重叠。相比“这条轨迹的碰撞得分低”，该量有直接的空间含义。[原文 §II](https://arxiv.org/html/2608.26533v1#S2)

困难有两层。预测未来可能漏掉目标或低估危险运动；从很多候选中择优又会改变误差分布，所以单独校准预测器或单条预先指定轨迹，不能直接成为最终选择结果的证书。作者要求整个流程在校准前冻结，包括 proposal、目标筛选、预测、评分、排序和 fallback，并让未来真值只出现在校准与回看中。

统计单位是 drive session。定理允许同一 session 内的窗口任意相关，但要求新 session 与校准 sessions 按相同窗口抽取规则来自可交换的部署总体。这个假设不是“模型预测准确”，也不是“换任何城市都成立”。

### 相关工作与差异

| 工作与一手来源 | 已有机制 | 本文的具体差异 |
| --- | --- | --- |
| Dauner 等，PDM，CoRL 2023（[正式论文 §3.3](https://proceedings.mlr.press/v229/dauner23a/dauner23a.pdf)） | 沿路线中心线构造不同 IDM 目标速度和横向偏移的 15 条 proposal，经控制器和车辆模型模拟，再用合规、进度、舒适性等分数组合选择。 | 借用 proposal bank，把未知实际间距的统计下界附在固定 selector 的输出上；不把 PDM 综合分数解释成间距证书。本文并未在统一条件下证明优于所有 planner。 |
| Chakraborty 等，FORCE-OPT，2025 arXiv v1（[§IV-B–IV-D](https://arxiv.org/html/2507.22389v1#S4)） | 从多模态 GMM 预测中通过凸优化提取 forward reachable sets，用 conformal 方法校准集合覆盖，再检查自车轨迹是否与集合相交；Bayesian filtering 用于分布变化时调整保守度。 | 本文直接校准选中轨迹的几何 margin 残差，最终声明是物理间距下界。二者校准对象、数据集和安全指标不同；本文没有复跑 FORCE-OPT，因此不能据此比较检测误报率或安全水平。 |

## 方法和系统设计

### 输入输出与流程

每个 planning query 产生 15 条 PDM-Closed 候选，每条覆盖 4 s、41 个时刻，间隔 0.1 s。预测器最多读取当时可用的 12 个动态目标，输出 nominal joint future 或多个联合未来样本。对每条候选与预测未来计算最危险的几何 margin，交给预先固定的 selector，得到最终轨迹及其计划时统计量。[原文 §II、§V-A](https://arxiv.org/html/2608.26533v1#S5.SS1)

回看时使用日志中所有车辆、行人和自行车，包括规划时没有预测到的对象；遗漏因此可能拉大残差。部署时没有这份未来真值，只能用离线校准得到的 correction 去减计划时统计量。没有非负证书表示证据不足，不能反过来断定一定碰撞。

### 几何下界与尾部风险

下面将原文式 1、4–6、18 合并展示。对一对 ego/agent 矩形，$r\in\{s,d\}$ 分别是自车纵、横轴：

$$
\begin{aligned}
h_r &= \lvert\Delta p^\top e_r\rvert-R_{A,r}-R_{B,r}-\mu_r,\\
h_c &= \frac{\log(e^{\alpha_g h_s}+e^{\alpha_g h_d})-\log 2}{\alpha_g},\\
h_c &\leq \max(h_s,h_d)\leq d^\star,\\
\operatorname{CVaR}_{\beta}(M)&=\frac{1}{\beta}\int_0^\beta F_M^{-1}(u)\,du.
\end{aligned}
$$

$\Delta p$ 是矩形中心差，$e_r$ 是单位轴，$R_{A,r},R_{B,r}$ 是投影半径，后者由车长、车宽和相对 yaw 决定；$\mu_r\geq0$ 是安全 padding，$\alpha_g>0$ 控制平滑程度。普通 log-sum-exp 会高于最大值，减去 $\log2/\alpha_g$ 才保住下界方向。对所有目标和离散时刻取最小值后，下界关系仍成立。[原文 §III，Lemma 1](https://arxiv.org/html/2608.26533v1#S3)

$M=h_c(\tau,\widehat O)$ 是候选 $\tau$ 在预测联合未来 $\widehat O$ 下的 margin，$F_M^{-1}$ 是其分位函数。由于间距越小越危险，这里平均的是最低 $\beta$ 比例，而非损失变量常用的上尾；实验比较 $\beta=0.30$ 和 $0.10$。CVaR 决定预测统计量是否有信息、证书是否够紧，统计有效性仍来自后面的校准。[原文 §IV-A](https://arxiv.org/html/2608.26533v1#S4.SS1)

### 选择后校准与保证范围

原文式 24–29 的关键步骤是先完成选择，再算误差：

$$
\begin{aligned}
s_{j,w}&=\widehat m(\tau_{j,w},I_{j,w})-h_c(\tau_{j,w},O^\star_{j,w}),\\
S_j&=\max_{w\in W(U_j)}s_{j,w},\\
k&=\lceil(n+1)(1-\eta)\rceil,\quad \widehat q=S_{(k)},\\
\widehat c(\tau,I)&=\widehat m(\tau,I)-\widehat q.
\end{aligned}
$$

$U_j$ 是第 $j$ 个 session，$w$ 是其中窗口，$\tau_{j,w}$ 是冻结流程的实际选择；$O^\star$ 是回看的真实未来，$n$ 是校准 session 数，$\eta$ 是目标漏覆盖率。$S_{(k)}$ 是 session 最大残差的第 $k$ 小值；若 $k>n$，原文令 $\widehat q=+\infty$，避免小样本下给出没有依据的有限证书。

定理 1 保证新 session 所有已定义评测窗口同时满足 $d^\star\geq\widehat c$ 的概率至少为 $1-\eta$。若请求 buffer $\rho$，仅在 $\widehat c\geq\rho$ 时认证，控制的是“被认证且实际间距小于 $\rho$”的联合事件概率。它不是已认证子集中的条件事故率，也不是连续时间、任意在线更新策略的保证。[原文 §IV-C，定理 1 与推论 1](https://arxiv.org/html/2608.26533v1#S4.SS3)

本文没有训练新 planner 的损失函数。候选生成和预测器作为外部组件，需随校准版本冻结；改变 selector 或 fallback 后必须重新核对残差映射。v1 没有完整公开 predictor 样本构造、样本数、平滑参数和运行时开销，不能据此声称已经可实时部署。

## 关键图与可视化结果

![原论文图 1：目标覆盖率与实际 clearance 覆盖率](../../assets/papers/barrier-conformal-clearance-certification-figure-1.png)

先看横轴的目标覆盖率，再看三条统计量曲线相对虚线的位置。点来自 150 个 held-out sessions，误差条是 95% Wilson intervals，不是跨训练种子的标准差。CVaR 的覆盖率较高，但若干区间跨过目标线；这与有限样本统计波动相容，不能读成每个子群都达到同样覆盖率。[原图 1 与图注](https://arxiv.org/html/2608.26533v1#S5.F1)

![原论文图 2：行人场景的成对 CLS-NR 干预示例](../../assets/papers/barrier-conformal-clearance-certification-figure-2.png)

上方对比干预帧，红色目标是最近动态对象，native PDM 与 proposed 的 exact OBB clearance 分别为 0.73 m、1.12 m；下方是完整 rollout 的间距曲线，竖线标记该帧，横线标记接触与 1 m 阈值。图证明选择变化能够改变空间行为；它只展示一个样例，不能替代闭环覆盖率或事故统计。[原图 2 与图注](https://arxiv.org/html/2608.26533v1#S5.F2)

## 实验结论与证据

### 设置与指标

冻结数据包含 Boston、Pittsburgh、Singapore 各 100 个 sessions，总计 300 个；按随机种子分成 150 calibration 和 150 test，且每个 session 只取一个有附近动态目标的 query。本文的 session-max 在该主实验退化为单窗口残差，没有实测长 rollout 多窗口最大值的校准代价。

$\widehat q$ 单位是米，越小通常越有利于证书可用性；Exact coverage 是实际间距不小于证书的比例；Cert. rate 是满足 $\widehat c\geq0$ 的窗口比例；Unit FC 是至少出现一次错误认证的 session 比例。后两者的分母不同于“仅已认证轨迹”，不能混读。[原文 §V-A](https://arxiv.org/html/2608.26533v1#S5.SS1)

### 主要结果与比较

下面摘录同一冻结 split 的[原文表 I](https://arxiv.org/html/2608.26533v1#S5.T1)，认证使用 $\rho=0$。

| 统计量 | 目标覆盖率 | correction / m | Exact coverage | Cert. rate | Unit FC ↓ |
| --- | ---: | ---: | ---: | ---: | ---: |
| Nominal | 90% | 1.43 | 93.3% | 68.7% | 0.7% |
| CVaR，$\beta=0.30$ | 90% | 0.03 | 96.0% | 87.3% | 2.0% |
| CVaR，$\beta=0.10$ | 90% | 0.03 | 96.7% | 87.3% | 2.0% |
| Nominal | 95% | 3.66 | 96.7% | 40.7% | 0.7% |
| CVaR，$\beta=0.30$ | 95% | 0.24 | 97.3% | 86.0% | 2.0% |
| CVaR，$\beta=0.10$ | 95% | 0.24 | 97.3% | 84.0% | 1.3% |

在 90% 目标下，证书比例提高 18.6 个百分点，correction 减少 1.40 m，均为原表相减。CVaR 提升的是可用证书数量与该 split 的覆盖率；其 Unit FC 同时从 0.7% 到 2.0%，所以不能概括成所有风险指标都改善。表 II 的分城市结果也只是诊断：50/50 split 下，nominal correction 从 Pittsburgh 的 0.15 m 到 Singapore 的 2.70 m；不能把这解释成城市固有安全难度的排序。

### 闭环对照与证据边界

§V-C 在同一 15-proposal bank 上发现 clearance selector 与 native PDM 的轨迹索引约有 89%–90% 不同。该 selector 使用间距 gate，再考虑进度和 effort；不同目标函数本来就可能作出不同选择，分歧不等于 PDM 出错。原文引言又有“selection mechanism left unchanged”的概述；复现时应以明确写出的 §V-C/§V-D 协议为准，不能把不同 selector 的校准结果混在一起。

闭环诊断使用 30 sessions 的 50 个成对 CLS-NR scenarios，即自车持续重规划、背景目标不响应的仿真。5,409 次重规划中保留 native proposal 5,043 次；官方 nuPlan 均分为 0.9403，对照 0.9437，代价主要在路线进度。表 III 的平均最小间距为 1.238 m 对 1.223 m，低于 1 m 的帧比例为 0.2377 对 0.2497。作者按 30 个 session clusters 做 paired bootstrap，多数差值区间包含零；表格没有列出区间端点，不能补写数值或宣称显著安全提升。[原文 §V-C–V-D、表 III](https://arxiv.org/html/2608.26533v1#S5.SS4)

这套闭环 gate 使用未校准的零 margin；无合格替代时仍保留 native proposal 并记录 violation。作者明确表示主定理不覆盖该实验。

## 应用场景与启发

- **作者主张**：为已有 planner 的轨迹附加校准的 clearance 评价，支持 runtime assessment。
- **我的判断**：最先适合固定候选库上的离线回放和 shadow evaluation；是否用于执行 gate，要先证明校准单元与部署流程一致，并一起报告证书可用率、进度和错误认证。
- **待验证假设**：把整个 rollout 作为校准单元后，CVaR 仍可能比 nominal 保留更多证书，但优势会因 session 内窗口最大残差而缩小。这可以被多窗口实验推翻，本文尚未验证。

## 局限与阅读风险

作者明确限制了保证的总体与流程：exchangeability 不成立、新预测器上线、selector 改写或窗口抽取规则变化，都不能直接沿用旧 correction。有限时间网格上的 OBB 间距也不等于连续轨迹的全时安全，更不包含未在几何对象和任务定义中表示的其他风险。

证据范围还包括一个冻结 split、每 session 一个 query 和 50 个非反应式闭环场景。没有独立多 split 稳定性研究、连续反馈闭环 conformal 校准、完整实现参数或端到端时延。它们限制可复现性和部署判断，不等于方法已在这些条件下失败。

## 后续跟进

### 最小验证与停止条件

- **当前资源**：2026-09-12 检查 v1 全文及题名/代码检索，未找到可核验的作者代码、300-session manifest、残差文件或完整配置入口。外部 nuPlan/PDM 数据和实现仍需按各自访问条件取得；本文不训练新权重，但其 predictor 的具体资源未说明。本次没有下载驾驶数据或运行实验。
- **最小实验**：先取得固定 manifest、proposal bank 和预测样本；按 150/150 sessions 重算 nominal 与两种 CVaR 的 $\widehat q$、Exact coverage、Cert. rate、Unit FC。记录每条轨迹索引、参与目标集合和所有残差，避免校准后调 selector。
- **成功信号**：原表四项指标可复算；再在不重叠 sessions 上逐步增加每 session 窗口数，检查 session-max 后的覆盖和可用率，并用 session 为单位给出区间。
- **停止或转向**：拿不到 manifest 或预测器配置时停止声称复现原结果；若校准后改 selector 才获得收益，先修复实验协议；若多窗口使几乎所有证书失效，转向缩短认证时域或重新定义固定 rollout 校准流程，不能仅放松统计阈值。

### 来源与核验记录

依据 [arXiv:2608.26533v1 全文](https://arxiv.org/html/2608.26533v1)，实际核验日期为 2026-09-12。机构由全文作者信息核对；方法对应 §II–IV、式 1–40，主要数字对应表 I–III及 §V，实际打开了原图 1、2 并逐张对照图注。相关工作读取了 PDM 正式 PDF §3.3 和 FORCE-OPT v1 §IV。完成的是内容和来源核对，实验复现未执行。
