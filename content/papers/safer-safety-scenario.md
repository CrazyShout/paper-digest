---
{
  "id": "safer-safety-scenario",
  "tag": "autonomous-driving-testing",
  "tags": [
    "autonomous-driving-testing"
  ],
  "title": "SaFeR: Safety-Critical Scenario Generation for Autonomous Driving Test via Feasibility-Constrained Token Resampling",
  "source": "arXiv:2603.04071 / https://arxiv.org/abs/2603.04071",
  "authors": [
    "Jinlong Cui",
    "Fenghua Liang",
    "Guo Yang",
    "Chengcheng Tang",
    "Jianxun Cui"
  ],
  "affiliations": [
    "School of Traffic and Transportation, Harbin Institute of Technology",
    "Chongqing Research Institute of Harbin Institute of Technology",
    "Chongqing Changan Automobile Co., Ltd."
  ],
  "comment": "SaFeR 在自然动作 token 的 top-20 中结合风险与离线可行域近似重选动作；高解决率支持经验可行性，尚非严格可解证明。"
}
---

## 一句话定位

SaFeR 在自然驾驶动作分布的高概率候选中，挑选既接近自车、又被可行域网络判断为仍有避让空间的动作。它提高了单一反应式规划器的场景解决率，但“网络认为可行”与“数学上保证可解”仍有距离。

## 论文要解决的问题

测试器若一味追求碰撞，可以把背景车辆放进任何策略都无法应对的位置；这样的场景难以区分规划器能力。另一方面，只采样自然动作往往不够危险。SaFeR 希望同时控制危险程度、动作分布和规避余量，让测试挑战足够大，又保留一个可能的安全解。

## 方法和系统设计

### 自然驾驶先验：有限词表与差分注意力

固定 [arXiv v1 §II-B](https://arxiv.org/html/2603.04071v1#S2.SS2)把加速度 $[-5,5]$ 米/秒平方、偏航角速度 $[-1.5,1.5]$ 弧度/秒分别离散成 63 档，共 3,969 个动作 token。Transformer 分别处理时间、车车和车地图关系，输出下一步动作分布，再经运动学模型更新状态。差分注意力的核心为：

$$
A(X)=\left[\operatorname{softmax}\left(\frac{Q_1K_1^\top}{\sqrt d}\right)-\lambda\operatorname{softmax}\left(\frac{Q_2K_2^\top}{\sqrt d}\right)\right]V.
$$

$Q_1,Q_2$ 与 $K_1,K_2$ 是两组查询／键投影，$V$ 为共享值投影，$d$ 是每组键的通道维数，$\lambda$ 为可学习的差分系数。双注意力相减是已有机制；本文将它放进三种交通交互模块。作者将改善解释为减少无关注意力，但表中分数本身并未直接测出“噪声被消除”。

### 可行域：离线学到的近似边界

[§II-C](https://arxiv.org/html/2603.04071v1#S2.SS3)以车体框最短间距 $d$ 定义约束：当 $d>0.3$ 米时 $h=-1$，否则 $h=16$。理论最优值与其零下水平集为：

$$
V_h^*(s)=\min_\pi\max_{t\in[0,T]}h(s_t),\qquad
\mathcal S_f^*=\{s:V_h^*(s)\leq0\}.
$$

它表示是否存在可规避的自车策略。实际实现用离线 expectile 回归近似 $V_h^*$，不是精确求解可达集。训练数据共 300k 次交互：SMART、DiffusionPlanner 自车配自然背景各 100k，另以 SMART 配 SAFE-SIM 关键背景车 100k；expectile 参数 0.8、折扣 0.99。训练后冻结可行域网络供生成时查询；网络误差和训练覆盖仍会影响判定。

### 只在高概率候选中重选动作

每周期先取先验概率最大的 $n=20$ 个 token，逐个预测关键背景车下一状态，再用下式排序（原式 18–19）：

$$
L(w)=\begin{cases}d(s'_{cbv},s'_{ego}),&V_h(s')\leq0,\\V_h(s')+50,&V_h(s')>0,\end{cases}\qquad
w^*=\arg\min_{w\in\mathcal W_{top-20}}L(w).
$$

有可行候选时偏好近距离互动，越界时优先降低不可行程度。这是有限候选的贪心搜索；若 20 个候选全部不可行，公式仍会选一个，不包含拒绝生成的分支。加上有限罚项和近似值网络，不能把它改述为严格排除所有不可避免碰撞。

### 两条直接相关的方法来源

| 自身一手来源 | 已有机制 | SaFeR 的变化 |
| --- | --- | --- |
| [FREA v1 §3.1–3.2](https://arxiv.org/html/2406.02983v1) | 离线学习 LFR，按可行状态切换背景车 PPO 的对抗与约束目标 | 使用自然动作词表中的重采样，避免为此再训练一个背景车对抗策略；LFR 思路不是新提出 |
| [Differential Transformer v1 §2](https://arxiv.org/html/2410.05258v1) | 两个 softmax 注意力相减，学习差分系数并按层初始化 | 将该运算用于时序、智能体与地图关系，属于交通生成中的结构应用 |

## 关键图与可视化结果

![原论文 Figure 1：先验分布、候选区域与可行域共同决定 token](https://arxiv.org/html/2603.04071v1/x1.png)

上半部分学自然运动分布，下半部分执行受约束的危险动作重选。绿色候选只是模型分布与值网络形成的判断范围，不是逐条验证过的真实车辆安全轨迹。

![原论文 Figure 2：SaFeR 的自然先验训练与 token 重采样流程](https://arxiv.org/html/2603.04071v1/x2.png)

图将运动学更新、分布截断和可行性评分分开，便于看清推理时查询哪些冻结模型。图中“最终轨迹”的可行标记是设计意图，需要结合实验解决率而非当作证书。

## 实验结论与证据

### 危险性与解决率来自两个阶段

[§III 与 Tables I–III](https://arxiv.org/html/2603.04071v1#S3)在 Waymax 中测试，从 WOMD、nuPlan 各选 1,000 个有复杂车辆交互的场景，指定已有 object of interest 为关键背景车，规划频率为 2 Hz。自然先验在 WOMD 训练，nuPlan 用于跨数据集评估；nuPlan 转入 Waymax 的细节未充分披露。

第一阶段自车沿日志重放测碰撞率 CR，第二阶段换成反应式 DiffusionPlanner 测解决率 SR。SR 的分母是否只包括第一阶段碰撞子集未写清，因此不能相乘得到“有效危险场景数”。VJ/AJ 是速度/加速度分布的 Jensen–Shannon divergence，均无量纲，不是 jerk。

| Table III，10 次种子运行的平均 | CR | SR | VJ / AJ |
| --- | --- | --- | --- |
| WOMD，SaFeR | 0.761 | 0.865 | 0.161 / 0.499 |
| WOMD，ADV-BMT | 0.915 | 0.324 | 0.251 / 0.603 |
| nuPlan，SaFeR | 0.757 | 0.801 | 0.179 / 0.510 |
| nuPlan，SAFE-SIM | 0.749 | 0.615 | 0.201 / 0.519 |

SaFeR 用较低的原始对抗性换取更高经验解决率与更接近日志的运动分布。ADV-BMT 被一个规划器解决较少，不能推出其余场景在理论上不可解；原文在此作了过强解释。未给出跨种子标准差或区间。

### 消融呈现的是取舍

Table IV 中移除 LFR 后 WOMD CR/SR 为 0.827/0.527，完整模型为 0.761/0.865；移除 MDA 后为 0.793/0.720。Table V 把候选数从 10 增至 20，CR 从 0.203 升至 0.761；继续增至 50、100 时 SR 从 0.865 降至 0.817、0.801，正文却写“SR 有边际增益”，应按表解释为下降。一般场景先验的 realism 元分数 WOMD 0.7730、nuPlan 0.6760，也不能直接当危险生成场景的通过率。

## 应用场景与启发

### 报告分析与待验证假设

SaFeR 适合检查规划器能否处理“需要行动但仍有机会”的互动，尚未评估完整视觉感知栈。待验证假设是：为可行域网络增加独立校准的保守余量与拒绝分支，可以减少被误纳入测试集的难解场景，而不是仅通过降低总体危险程度提高 SR。

## 局限与阅读风险

局部自车—关键背景车状态不足以天然覆盖所有道路、多车及动力学约束。将平均 $V_h$ 调到接近零不等于边界校准准确；训练数据中又出现了测试用 DiffusionPlanner，经验 SR 不是完全独立的可解性审计。高概率 top-20 也没有给出最小累计概率质量，跨域后可能仍选到低可信动作。

## 后续跟进

### 资源与校准干预

截至 2026-09-12，固定论文和标题/作者公开检索未核实 SaFeR 代码、权重或 300k 交互数据，先需补足生成器训练预算、数据划分、SR 分母及无可行候选时的策略。本次未执行模拟。

最小实验固定 100 个留出场景、同一先验、top-20 与 5 组配对随机种子：比较原阈值零、独立验证集校准的负阈值并拒绝无解候选、与第二组同拒绝率的随机拒绝对照。所有组均只评分相同 20 个候选，限制相同总场景步数和计算时间。用未参与值网络数据收集的两个规划器重放，分别报告全部尝试与保留场景的 CR、SR、拒绝率和分布偏离；规划器失败只记经验失败，不作不可解证明。若保守阈值的收益不超过随机拒绝，或只来自删除所有高风险案例，停止校准有效的主张。
