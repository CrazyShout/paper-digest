---
{
  "id": "coverage-aware-active-evaluation",
  "tag": "autonomous-driving-testing",
  "tags": ["autonomous-driving-testing"],
  "title": "Coverage Aware Active Evaluation for Failure Discovery with Paired Systems",
  "source": "arXiv:2608.13719 / https://arxiv.org/abs/2608.13719 / HTML: https://arxiv.org/html/2608.13719",
  "authors": ["Anjali Parashar", "Rachel Luo", "Apoorva Sharma", "Sushant Veer", "Edward Schmerling", "Carson Sobolewski", "Mingxin Yu", "Chuchu Fan", "Marco Pavone"],
  "affiliations": ["Laboratory for Information and Decision Systems, Massachusetts Institute of Technology", "NVIDIA Research"],
  "comment": "论文不假设仿真或低成本代理的失败必然迁移，而是用少量目标系统结果校正代理风险，再以支持感知的互信息维持失败模式覆盖。在 nuPlan、机器人操作、四足控制和 KITTI 任务上，方法最多发现约 2 倍失败。"
}
---

## 一句话定位

这是一套面向昂贵目标系统的主动失效发现方法：廉价 proxy 负责扩大可搜索范围，少量 target evaluation 负责纠正 sim-to-real 或 system-to-system 偏差，互信息负责探索未覆盖区域，聚类负责避免一批样本反复命中同一种失败。

## 论文要解决的问题

直接在实车、高保真仿真或大模型策略上随机测试，预算很快耗尽；只在廉价代理上找最坏场景，又会把代理特有故障误当目标故障。传统 worst-case acquisition 容易扎进一个狭窄失败盆地，覆盖率高的方法则可能访问很多新区域却找不到严重失败。

作者把目标拆成两个必须同时满足的条件：对目标风险的估计要利用但不能盲信 proxy；所选场景既要可能严重，也要覆盖不同且有数据支持的区域。这个问题定义直接对应现实测试中的“低成本筛查 + 少量高成本确认”。

## 方法和系统设计

- 用目标系统历史评测训练 surrogate，并将 proxy 与 target 的局部相关性写入 control-variate 风险估计；相关性弱时权重自动趋近零，避免代理强行主导。
- Support-aware mutual information 优先选择当前数据分布中尚未充分解释、同时不是完全离群的候选，先扩大可辨识区域。
- 候选经过 proxy 评估和校正风险排序后，再聚类选出一批相互分散的目标测试点，循环直到耗尽预算。
- 论文在 nuPlan、SIMPLER 操作、四足速度跟踪和 KITTI 感知四类任务上更换 BNN、GP 或 MLP surrogate，检验方法是否依赖单一系统类型。

## 关键图与可视化结果

![图 1：支持感知探索、proxy 评估、目标风险校正与批量场景选择构成主动测试循环](https://arxiv.org/html/2608.13719v1/overview_new.png)

图 1 清楚区分了 proxy metric 和 target risk：代理不是廉价真值，而是需要由少量目标结果校准的协变量。这个接口允许把低保真仿真、旧策略或小模型都作为 proxy。

![图 2：nuPlan 上不同初始采样偏差下，互信息仍优先补足未覆盖场景区域](https://arxiv.org/html/2608.13719v1/mi_ablations_updated.png)

图 2 说明算法不只追逐当前 surrogate 的最坏点，还会补充低覆盖区。t-SNE 只是一种二维可视化，不能单独证明原空间的行为差异，因此仍需后续失败数量和严重度结果共同判断。

## 实验结论与证据

nuPlan 使用 20 个初始随机样本，再以 batch=5 获取 150 个目标评测，共 170 个预算，并在四个种子上报告均值与方差。以 TTC 小于 0.3 为失败时，论文方法的正样本比例为 0.33，随机为 0.23，BNN-C 为 0.25，BAMS 为 0.28；同时保持更高累计覆盖。跨全部任务，作者报告最多约两倍的失败发现数量。

代理贡献并非总是强：nuPlan 失败区的 proxy-target 平均相关仅约 0.15，校正权重趋近零，收益较小；KITTI 约 0.5 时收益更明显。在等样本数对照中，代理辅助使 meaningful failure-mode coverage 提高近 70%，surrogate failure recall 从 0.18 升到 0.49。这种“相关性弱就少信”的负结果边界是论文的重要可靠性信号。

## 应用场景与启发

- 应用场景：从大规模低保真场景库挑选少量高保真实验、旧版与新版驾驶栈的配对测试，以及 sim-to-real 失效确认。
- 方法启发：测试系统应同时报告严重失败数和失败模式覆盖；只优化其中一个会分别导致模式坍缩或无效探索。
- 研究启发：可把 3DGS/世界模型作为 proxy，把实体车、目标传感器或完整软件栈作为 target，并在线估计不同场景区域的可信迁移度。
- 讨论问题：如果场景嵌入本身忽略了通信时序、天气可观测性或他车反应，所谓 locality 与 diversity 是否仍有安全意义？

## 局限与阅读风险

方法假设场景表示中的距离、局部邻域和支持度具有行为意义；错误嵌入会把不同失败聚在一起或把同一失败拆散。它仍需要目标系统评测，空间扩大后预算需求会增加。不同任务的 seed 数不一致，四足实验只有两个 seed；“最多 2 倍”是跨任务上界，不应写成每个驾驶设置都翻倍。代理收益取决于局部相关性，nuPlan 结果已经表明并非任何仿真信息都值得使用。

## 后续跟进

- 用驾驶语义、交互拓扑和传感器可观测性三种嵌入重复实验，检验失败覆盖对表示选择的敏感性。
- 在固定目标预算下报告发现率、模式覆盖、最坏严重度和跨 seed 方差的 Pareto 曲线。
- 把同一场景在生成视频、高保真仿真和封闭场地的执行作为三层 proxy-target 链，评估相关性如何随域变化。
