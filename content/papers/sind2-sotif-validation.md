---
{
  "id": "sind2-sotif-validation",
  "tag": "autonomous-driving-testing",
  "tags": ["autonomous-driving-testing", "cooperative-autonomous-driving"],
  "title": "SinD 2.0: A Multi-City UAV Dataset with Semantic Risk Annotations for SOTIF-Oriented Safety Validation at Signalized Intersections",
  "source": "arXiv:2607.16943 / https://arxiv.org/abs/2607.16943 / https://github.com/SOTIF-AVLab/SinD/tree/main",
  "authors": ["Yunwei Li", "Shengjie Fu", "Chunrong Chen", "Chengxiang Zhao", "Yuchen Fan", "Mingyu Zhu", "Yanchao Xu", "Yuxin Zhang", "Lan Yang", "Chuzhao Li", "Jie Ji", "Yi He", "Abhijit Sarkar", "Akash Sonth", "Hong Wang", "Jun Li"],
  "affiliations": ["Tsinghua University", "Beijing Institute of Technology", "Guangzhou Automobile Group Co., Ltd.", "Jilin University", "Chang'an University", "Chongqing University", "Southwest University", "Wuhan University of Technology", "Virginia Tech Transportation Institute", "Virginia Tech"],
  "comment": "把四城六个信号路口的自然交通轨迹、风险语义、开环/反应式闭环测试和 3DGS 可视化接成一套 SOTIF 工具链；价值在于能按遮挡、争路权和狭窄可行域直接查询高价值测试。"
}
---

## 一句话定位

SinD 2.0 不是只扩充轨迹数量，而是把跨城市自然交通转成可查询、可回放和可闭环执行的 SOTIF 测试资产。数据覆盖中国四城六个信号路口，提供 MprTTC 风险、视觉遮挡、交通违规和狭窄可行域等规则化语义，并配套预测、数据开环、反应式闭环和 3DGS 视觉渲染工具链。它进入本期，是因为论文同时回答“测什么场景”和“如何把场景接入测试”。

## 论文要解决的问题

现有无人机轨迹数据常集中在单一城市，安全关键事件稀疏，且只有连续坐标而缺少触发机制标签。研究者要做 SOTIF 测试时仍需手工寻找遮挡、争抢路权和空间压缩场景，再转换到仿真格式。SinD 2.0 希望把地理差异、自然交互、风险语义和执行工具统一起来，使测试可以从明确触发条件出发，而不是随机回放海量普通片段。

## 方法和系统设计

- 数据层包含约 22.8 小时连续无人机记录、约 5.3 万交通参与者及 HD map/SPaT，六个路口覆盖不同拓扑、交通构成和驾驶文化。
- 语义层通过可审计确定性规则挖掘 MprTTC 高风险互动、视觉遮挡、违规/不合规与狭窄可行域，保存参与者、时间窗、阈值和几何证据。
- 工具层支持 QCNet/Diffuser 预测评测，RiskIDM、ASAPRL、QCNet 的自然轨迹开环与数据驱动反应式闭环测试，并提供从 BEV 先验到 3DGS 视角渲染的辅助链路。

## 关键图与可视化结果

![图 1：SinD 2.0 的多城市采集、风险语义挖掘与测试工具链](../../assets/papers/sind2-sotif-validation-figure-1.png)

图 1 来自官方源码，串联四城六路口、语义风险标签和开环/闭环测试。它说明数据集的最小单元不只是轨迹，而是带触发原因和可执行上下文的场景。

![图 2：长穿越距离与缺少安全岛造成的弱势道路参与者暴露区域](../../assets/papers/sind2-sotif-validation-figure-2.png)

图 2 展示西安路口的基础设施诱发风险：慢行或等待的 VRU 会长时间停留在机动车冲突区。这类场景难以由单一 TTC 数字解释，却可直接启发路侧协同预警与交互预测研究。

## 实验结论与证据

数据集从连续自然记录中提取 32,682 个高风险互动，并生成 53,901 条场景级语义记录，包括 31,005 条高风险 MprTTC、1,286 条视觉遮挡和 21,610 条狭窄可行域记录；另有 25,966 条违规/不合规事件索引。

语义子集显著放大系统边界：RiskIDM 在原始自然场景的碰撞率为 3.0%，在低 MprTTC、视觉遮挡和狭窄可行域子集分别升至 30.3%、63.4% 和 53.4%；QCNet 在视觉遮挡子集碰撞率为 81.8%，在狭窄可行域出现 64.0% off-road。反应式闭环中 RiskIDM、ASAPRL、QCNet 的碰撞率分别为 29.6%、69.1% 和 50.4%，说明固定背景回放会低估交互后果。

## 应用场景与启发

- 应用场景：SOTIF 场景库、跨城市预测评测、路口协同预警、规划回归测试和视觉端到端仿真。
- 方法启发：安全数据集应把风险触发条件、提取阈值、参与者关系和可执行测试脚本一起发布，才能从数据统计转成验证证据。
- 讨论问题：规则标签暴露了高失败率后，怎样区分是被测策略缺陷、开放环回放伪影，还是背景反应模型自身失真？

## 局限与阅读风险

语义标签由地图、SPaT 和轨迹上的确定性规则生成，尚未完成大规模人工 precision/recall 与阈值敏感性审计，不能视作认证级真值。无人机顶视轨迹缺少真实 ego 传感器噪声；3DGS 只是辅助视觉重建，尚未证明可用于传感器级安全 verdict。反应式背景策略也可能在严重冲突中语义漂移，因此闭环失败不应全部归因于 ego 策略。

## 后续跟进

- 优先复现视觉遮挡和狭窄可行域两个子集，并对标签做独立人工审计。
- 把路口语义与协同通信日志连接，研究何种路侧消息能最早降低冲突风险。
- 对同一场景同时运行 open-loop、reactive closed-loop 和传感器渲染，建立测试模式之间的结果差异表。
