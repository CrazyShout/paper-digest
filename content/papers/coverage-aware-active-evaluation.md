---
{
  "id": "coverage-aware-active-evaluation",
  "tag": "autonomous-driving-testing",
  "tags": [
    "autonomous-driving-testing"
  ],
  "title": "Coverage Aware Active Evaluation for Failure Discovery with Paired Systems",
  "source": "arXiv:2608.13719 / https://arxiv.org/abs/2608.13719 / HTML: https://arxiv.org/html/2608.13719 / Fixed full text: https://arxiv.org/html/2608.13719v1",
  "authors": [
    "Anjali Parashar",
    "Rachel Luo",
    "Apoorva Sharma",
    "Sushant Veer",
    "Edward Schmerling",
    "Carson Sobolewski",
    "Mingxin Yu",
    "Chuchu Fan",
    "Marco Pavone"
  ],
  "affiliations": [
    "Laboratory for Information and Decision Systems, Massachusetts Institute of Technology",
    "NVIDIA Research"
  ],
  "comment": "方法用目标结果训练的 surrogate、局部 proxy 修正和支持感知互信息选择昂贵测试。价值是兼顾严重失效与模式分散；其局部预测和发现比例不能直接解释为目标系统的无偏总体风险。"
}
---

## 一句话定位

这项主动评测方法把廉价 proxy 当作有偏线索：少量 target 结果训练 surrogate，局部相关性决定该信 proxy 多少，支持感知互信息与批内聚类则帮助避免反复命中同一类失败。最终交付的是固定预算内发现的失效集合，不是总体事故率认证。

- 核心证据：nuPlan 总目标预算 170、四 seeds 下，TTC<0.3 s 的表列正样本比例由随机 0.23 增至 0.33；KITTI 高严重度与模式覆盖也受 MI/聚类影响。[表 1、3](https://arxiv.org/html/2608.13719v1#S5.T1)
- 主要边界：场景嵌入、surrogate 偏差和 proxy 相关性决定效果，约两倍是跨任务最好结果，不是所有驾驶设置翻倍。

## 论文要解决的问题

### 为什么不能只信仿真最坏点

代理模型有的失败不迁移，目标系统也可能有代理没见过的失效。直接按预测严重度选点容易集中在狭窄区域；只追求空间覆盖又可能浪费昂贵测试。输入是场景候选、已测目标分数和廉价代理结果，输出是下一批目标评测场景及更新后的风险预测。

### 相关工作与差异

| 一手工作 | 原机制 | 本文变化 |
| --- | --- | --- |
| Luo 等，Sim2Val；[2025 v1](https://arxiv.org/html/2506.20553v1)，CoRL 2025 | 真实目标/代理配对样本作 control variate，降低总体均值估计方差 | 改为场景局部预测与主动发现，配对中的目标值来自 surrogate，不能直接继承真实均值无偏保证 |
| Sinha 等，BAMS；[2024 v1](https://arxiv.org/html/2411.17826v1)，CoRL 发表工作 | 多保真 GP、面向失效率方差的采集与重要性采样，结合发现和频率估计 | 用与 surrogate 结构分离的几何支持 MI、严重度筛选和聚类，本文重点是失效发现与分散程度 |

## 方法和系统设计

### 实际采集顺序

先在已测目标场景上训练 $q_\theta$，再从候选中选高 MI 的 $K_{MI}$ 个，获取代理信号并计算局部校正分数，筛出达到阈值的集合；按 batch size 聚类，每簇取最靠近中心的候选作真实目标评测，然后重训 surrogate。原式 1 给出的“风险+MI”是高层目标，算法 1 的分阶段筛选并不严格等价于直接最大化其和。[§4.3](https://arxiv.org/html/2608.13719v1#S4.SS3)

### 局部控制变量估计

原式 2 可整理为下式，其中第二项统一求和哑指标为 $j$：

$$
\mu_{CV}(x)=\frac1n\sum_{i=1}^{n}(\hat y_{r,i}-\beta y_{s,i})+\frac{\beta}{k}\sum_{j=1}^{k}y'_{s,j},\qquad
\beta=\frac{k}{k+n}\frac{\operatorname{Cov}(\hat Y_r,Y_s)}{\operatorname{Var}(Y_s)}.
$$

$n$ 个局部配对由 surrogate 预测 $\hat y_r$ 与代理观测 $y_s$ 构成，$k$ 为额外代理样本；上式写标量且代理方差非零的情况。低相关时权重趋近零，避免代理主导。但它估计的是局部 surrogate 相关统计，增加代理样本不能保证消除目标预测的系统偏差；小邻域样本协方差也可能不稳定。

### 支持感知探索与覆盖口径

$$
I(Z_x;R_x\mid D,x)=H(Z_x\mid D,x)-H(Z_x\mid R_x,D,x).
$$

原式 3 中，$Z_x$ 为已有 cluster 或 new 的分配，$R_x$ 为是否发现新支持的变量。概率由候选到 cluster 的距离构造，鼓励边界与新区域探索；这是几何支持模型，不是真实性判别器，也不是对目标失败标签的标准 BALD。

原文覆盖指标写为 $C_k=\frac1k\sum_{i,j}\lVert x_i-x_j\rVert_2^2$，不是除以成对数量的普通平均距离；它会受失败样本数影响。因此应在相同预算/相近失败数下读空间分散程度，并另报独立模式覆盖。

### 训练与目标系统边界

nuPlan 的 proxy/target 是开环/闭环仿真，384 维场景编码；不是实车。其 surrogate 用 MC-dropout MLP（96→24→6，dropout 0.1），Adam 1e-3 训练 1,000 epochs。SIMPLER 是两个视觉条件不同的仿真域；真正硬件目标出现在四足任务，proxy 为 MuJoCo RL，target 为 Unitree sports mode。目标驾驶/机器人策略不由本算法更新。[附录 I](https://arxiv.org/html/2608.13719v1#A9)

## 关键图与可视化结果

![原论文图 1：代理修正与支持探索的采集循环](https://arxiv.org/html/2608.13719v1/overview_new.png)

从已有 target 数据训练 surrogate，再经过 proxy 校正选下一批。图中 proxy 与 target 是可替换系统角色，不能据其“real”标签认定全部实验是真实硬件。

![原论文图 2：三种初始化下的支持感知 MI](https://arxiv.org/html/2608.13719v1/mi_ablations_updated.png)

颜色表示 MI，圆圈是部分已观测点。t-SNE 二维分布展示探索倾向，但可能扭曲原空间距离，不能单独证明识别了不同失效机制。

## 实验结论与证据

### 预算、阈值与对照

nuPlan 先随机取 20 个目标样本，再以 batch=5 取 150 个，总计 170。原文一般把风险定义为越大越坏，但驾驶实验直接用 TTC 越小越坏；复现时必须核实阈值方向。表 1 以 0–1 小数报告正样本结果，正文却把 $P$ 定义成计数，未清楚统一分母；以下保留原表比例口径，不反推整数事故数。

| TTC 阈值（s） | Random | BNN-C | BAMS | 无 MI 的 BNN-CV | 本文 |
| --- | --- | --- | --- | --- | --- |
| <0.3 | 0.23±0.01 | 0.25±0.01 | 0.28±0.01 | 0.27±0.01 | 0.33±0.01 |
| <0.2 | 0.22±0.00 | 0.24±0.02 | 0.27±0.01 | 0.26±0.01 | 0.32±0.01 |
| <0.05 | 0.21±0.01 | 0.21±0.02 | 0.25±0.01 | 0.22±0.02 | 0.29±0.01 |

均为四 seeds 均值±标准差。四足仅两 seeds、30 个目标样本；代理也有成本，SIMPLER 约 83 s/次，而四足约 2 s/次。固定目标数量不等于全部方法完全同墙钟成本。

### 消融与未解决的缺口

KITTI 表 3：完整模型 coverage 0.78，去聚类降为 0.58；仅 MI 的 coverage 0.91，却在严重度 0.5 的正样本结果仅 0.11，对比完整 0.24。去 MI 的部分变体低阈值失败更多，却漏掉较高严重度或收缩覆盖，体现多目标取舍。

同样本数的 proxy 消融中，作者报告 meaningful failure-mode coverage 近增 70%、surrogate failure recall 0.18→0.49。这个模式指标不能与表中几何 coverage 混用。nuPlan 失效区域相关约 0.15，代理收益小；KITTI 约 0.5 时更明显，未证明任意代理都有效。[§5.4](https://arxiv.org/html/2608.13719v1#S5.SS4)

## 应用场景与启发

- 作者主张：在昂贵目标预算下找到更多严重且多样的失败。
- 我的判断：适合旧策略/新策略或低/高保真配对筛查；不应把发现集的比例当自然频率。
- 待验证假设：在相同目标预算和相同已发现失败数下，完整方法仍比无 MI 或无聚类方法覆盖更多预先定义的行为失效类别；这能检验几何分散是否确实对应新的失败模式。

## 局限与阅读风险

邻域与 cluster 的行为意义未经统一证明；局部 covariance 依赖少量目标训练形成的 surrogate。更改嵌入尺度、阈值或支持半径可能改变采集。代理信息、聚类数量和额外训练成本都需单独计账。本文没有提供目标总体风险的正式验证结论。

## 后续跟进

### 最小验证与停止条件

- 当前资源（2026-09-12）：[固定全文](https://arxiv.org/html/2608.13719v1)公开；定向检索未核到该方法官方代码、配置和权重包。nuPlan/KITTI/Virtual KITTI 等上游数据存在，不等于论文 384 维编码与配对分数已发布。
- 最小验证：取得相同候选编码与开/闭环分数后，固定 20+150 target 预算和代理调用数，比较完整、无 proxy、无 MI、无聚类；所有方法共用初始样本与四组 seeds。采集前用独立开发场景固定行为类别及判定规则，例如跟车冲突、切入避让、交叉口让行和静止障碍响应；这些标签不作为采集器输入。由不知道样本来源的复核者给发现集分配类别，并在各方法等失败数的重复子采样上比较类别数与覆盖比例，排除单纯发现更多样本对 coverage 的影响。另用隔离目标保留集检查 surrogate 误差，只作验证，不反向调阈值或选测试场景。
- 成功信号：完整方法的严重失败数增加，且等失败数下仍覆盖更多独立语义类别，配对 seeds 的差值方向稳定；额外检查代理被置换打乱时权重与发现结果是否明显改变，不能把小样本估计必然精确回零当成保证。
- 停止条件：优势只来自样本数影响的 coverage 公式、不同代理预算或测试真值泄漏；先修正统计和成本口径。

### 来源与核验记录

固定 arXiv:2608.13719v1；2026-09-12 核对 §3–5、式 1–3、算法 1、表 1–3、附录 A/C/D/I，逐张打开原图 1–2，并阅读 Sim2Val 与 BAMS 的原始方法。未运行主动采样或机器人实验。
