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

这篇论文把自动驾驶轨迹评价从“哪个候选看起来更安全”推进到“选中的候选能否附带一个可校准的物理间距证书”。核心不是再训练一个 planner，而是构造可微的 OBB 分离轴下界、用预测未来上的 lower-tail CVaR 衡量尾部风险，再对完整的预测、评分和选择过程做 session-level split conformal calibration；因此证书针对最终返回的轨迹，而不是脱离 selection bias 的单个候选。

## 论文要解决的问题

PDM、学习式 planner 和混合式 planner 都会生成一组轨迹，再根据碰撞、TTC、进度和舒适度等分数选一条。分数可以排序，却不等于实际执行后与车辆、行人和骑行者保持了多少物理间距；预测器漏掉对象、低估尾部运动或 selector 在多个候选中择优，都会让单候选上的概率陈述失效。

现有 conformal planning 常先给他车轨迹构造 prediction region，再检查 ego 是否与区域相交。本文进一步要求两个连接环节同时成立：几何统计量必须确定性地下界真实 signed OBB clearance，校准残差还必须包含 planner 的候选选择。这样才能回答“这个固定 pipeline 在一个新的 exchangeable drive session 中，错误颁发 clearance 证书的概率是否受控”。

## 方法和系统设计

- 几何层使用 ego 与 agent 的纵横分离轴间隔，经过平滑 log-sum-exp 构造可微 barrier margin，并证明它不大于 separating-axis margin，也不大于精确 signed OBB distance。证书为正时，才有直接的物理分离解释。
- 风险层对 predictor 给出的 joint futures 计算两类 plan-time statistic：单个 nominal future 的最小 margin，或采样 margin 分布的 lower-tail CVaR。较小的 beta 更强调最不利预测，但 CVaR 本身不负责统计有效性。
- selection 层先用上述 statistic 从 15 条 PDM-Closed proposals 中选轨迹，再用真实未来计算“计划时统计量减 realized smooth margin”的残差。选择过程因此被包含在 calibration mapping 内。
- 校准单位是完整 drive session，同一 session 的 replanning windows 先取最大残差，再在不同 session 间做 split conformal quantile。理论只要求 session 间 exchangeability，允许 session 内相关。

## 关键图与可视化结果

![图 1：目标 coverage 与 150 个 held-out session 上实际 clearance coverage 的关系](../../assets/papers/barrier-conformal-clearance-certification-figure-1.png)

Figure 1 是论文最重要的有效性检查。三种 plan-time statistic 在 0.80、0.90、0.95 target coverage 下都位于目标线以上；CVaR 曲线更高且误差条更稳定。但这只是 pooled deployment population 上的 marginal coverage，不表示每个城市、场景类别或“已经被认证的轨迹子集”都具有同样的条件覆盖率。

![图 2：行人场景中 native PDM 与 clearance-based selector 的闭环轨迹和间距曲线](../../assets/papers/barrier-conformal-clearance-certification-figure-2.png)

Figure 2 展示一个 integration case：干预帧的 exact OBB clearance 从 0.73 m 增至 1.12 m，完整 rollout 中两条间距曲线也出现分离。它证明 selector 能改变实际空间行为，却不是 conformal 理论的闭环验证；图中的 closed-loop gate 使用未校准的零 margin 阈值，作者明确把它列为定性诊断。

## 实验结论与证据

主实验冻结 300 个 nuPlan drive sessions，Boston、Pittsburgh、Singapore 各 100 个；每个 session 取一个 planning query，150 个用于 calibration，150 个 held out。每个 query 有 15 条、4 秒、41 个时间点的 PDM-Closed proposals，计划时 predictor 最多看到 12 个动态对象，而 realized clearance 会回看日志中的所有车辆、行人和骑行者，因而 predictor omission 会进入残差。

在 10% target miscoverage 下，nominal statistic 需要减去 1.43 m 的 conformal correction，只有 68.7% 测试轨迹得到非负证书，exact-clearance coverage 为 93.3%。CVaR beta=0.30 或 0.10 时 correction 都降到 0.03 m，certificate rate 升到 87.3%，coverage 分别为 96.0% 和 96.7%。目标收紧到 5% miscoverage 后，nominal correction 增至 3.66 m、certificate rate 降到 40.7%；CVaR correction 为 0.24 m，仍保留 84.0%-86.0% certificate rate。

城市拆分暴露了 distribution dependence：nominal correction 从 Pittsburgh 的 0.15 m 到 Singapore 的 2.70 m，后者 certificate rate 只有 60%。50 个 closed-loop scenarios 中，gate 在 5,409 个 replanning windows 里保留 native proposal 5,043 次；官方 nuPlan mean score 为 0.9403，对照为 0.9437。最小间距和低于 1 m exposure 的 bootstrap 区间普遍跨零，因此不能写成闭环安全显著提升。

## 应用场景与启发

- 应用场景：给 proposal-based、hybrid 或端到端 planner 外挂 runtime safety certificate，用于 shadow evaluation、release gate 和高风险场景回放筛选。
- 方法启发：安全校准应覆盖“生成到选择”的完整决策路径；只校准预测器而忽略 selector，会把 selection-induced error 留在保证之外。
- 测试启发：将城市、天气、交互类型和传感健康度作为 exchangeability audit 的显式分层，先判断能否共用 correction，再决定是否做 conditional 或 group-wise calibration。
- 讨论问题：证书可用率、路线进度和真实 clearance 如何形成可解释的三方取舍，而不是把所有目标重新压回一个 planner score？

## 局限与阅读风险

理论保证是 target deployment population 下的 marginal false-certification bound，不是已认证轨迹条件下的风险概率，也不自动外推到新城市、新 predictor 或在线更新后的 selector。每个主实验 session 只有一个 query，尚未真正检验大量相关 replanning windows 的 session-max 校准代价。

闭环版本使用未校准的 zero-margin intervention，不受主定理覆盖；50 个 scenarios 的 clearance 差异也没有显著性闭环证据。城市内实验只有 50 calibration 与 50 test sessions，Singapore correction 的大波动说明小样本分层可能不稳定。论文当前只有 arXiv v1，没有公开代码、冻结的 300-session manifest 或可直接复算的 calibration residuals。

## 后续跟进

- 先复现固定 PDM proposal bank 上的 OBB margin、CVaR statistic 和 session split，核对表 1 的 correction 与 false-certification rate。
- 把一整个闭环 rollout 作为 exchangeability unit 重新校准，比较 unit-max 导致的 certificate availability 损失。
- 对城市、雨雾、遮挡和 predictor omission 分层做 shift test；一旦 exchangeability 不成立，禁止沿用 pooled correction。
- 将证书接入 counterfactual planner comparison，评价同一候选库中“更安全但进度更低”的可恢复成本。
