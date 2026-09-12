---
{
  "id": "riskflow-safety-critical-scenario-generation",
  "tag": "autonomous-driving-testing",
  "tags": [
    "autonomous-driving-testing",
    "autonomous-driving-security"
  ],
  "title": "RiskFlow: Fast and Faithful Safety-Critical Traffic Scenario Generation",
  "source": "arXiv:2606.06423 / https://arxiv.org/abs/2606.06423",
  "authors": [
    "Qi Lan",
    "Yining Tang",
    "Yu Shen",
    "Yi Zhou",
    "Yuhao Wei",
    "Jie Li",
    "Guofa Li"
  ],
  "affiliations": [
    "College of Mechanical and Vehicle Engineering, Chongqing University"
  ],
  "comment": "RiskFlow 用动作空间 MeanFlow 与 30 步输出引导加速闭环危险场景生成；收益需结合原始风险指标、地图约束与原文符号歧义解读。"
}
---

## 一句话定位

RiskFlow 用一次 MeanFlow 网络前向生成多车加速度和偏航角速度，再对输出做风险引导；在 nuScenes/tbsim 的 100 个闭环场景上，比 CCDiff 更快且综合现实性分数更高，但推理仍包含 30 次梯度优化，不能据此称为实时测试器。

## 论文要解决的问题

危险场景必须既能制造冲突，又不能靠车辆瞬移、驶出道路等伪影提高碰撞数。扩散方法反复去噪并插入引导，在反复重规划中增加计算量，也可能破坏运动连续性。本文把学习到的动作先验与测试时的风险优化分开，尝试减少生成成本，同时限制引导对道路一致性的损伤。

## 方法和系统设计

### 场景编码与动作生成

固定 [arXiv v1 的方法部分](https://arxiv.org/html/2606.06423v1)使用 10 Hz 的 31 步历史，生成未来 52 步动作。SceneTransformer 融合时序、地图和交互信息；地图由 ResNet-18 编码，车对特征包含相对位置、朝向、速度、归一化距离与 TTC 风险。TTC 图挑选高风险群组中的前 $K$ 辆车，只有这些车辆接受引导。这里的“causal”是按交互图排序，并未通过干预实验识别因果效应。

按原式 10–14，$a^*$ 是真实动作，$\epsilon$ 是高斯噪声，$u_\theta$ 是平均速度场，$\mathrm{sg}$ 表示停止梯度：

$$
z_t=(1-t)\epsilon+ta^*,\qquad V_\theta=u_\theta(z_t,t,r;C)+(t-r)\mathrm{sg}(\dot u_\theta),\qquad \hat a=\epsilon+V_\theta.
$$

$$
\mathcal L_{\mathrm{MF}}=\mathbb E\left[\left\|F_{\mathrm{dyn}}(\hat a,s_0)-\tau^*\right\|_2^2\right].
$$

单轨迹动力学模型 $F_{\mathrm{dyn}}$ 将加速度、偏航角速度积分为位置和朝向，因此损失在重建轨迹上计算。原图把 current/reference time 标为 $r/t$，正文却以 $t$ 为当前插值时间、$r$ 为参考时间，接口含义需要实现核对。训练从头进行 100,000 步，Adam 学习率 $10^{-4}$、batch 4、单 RTX 4090；$r=t$ 的采样概率为 0.2，JVP 修正截断到 0.03。

### 输出引导及其待澄清符号

推理先算 $u_{\rm base}=u_\theta(\epsilon,0,1;C)$，随后固定网络，在输出残差上优化 30 步。原式 17、19–20 写为：

$$
\mathcal L_{\rm adv}=\sum_{i\in A_c}\sum_t\min_{j\notin A_c}\|p_i^t-p_j^t\|_2,\qquad
\mathcal L_g=\lambda_{\rm adv}\mathcal L_{\rm adv}+\lambda_{\rm map}\mathcal L_{\rm map},\qquad
u^{k+1}=u^k-\gamma M_{A_c}\odot\nabla_u\mathcal L_g.
$$

距离损失按文字应被最小化以促使车辆接近，地图项惩罚车体采样点驶出可行驶区域。然而 Table 1 给出 $\lambda_{\rm adv}=-50$、$\lambda_{\rm map}=1$；与上述梯度下降直接组合，会使距离项朝增大方向优化。这是原文符号与配置的不一致，不能自行改成正号并声称复现。此外，Full 若控制全部车辆，$j\notin A_c$ 的集合为空，论文没有交代该情形的距离目标。

### 与相关工作的机制区别

| 自身一手来源 | 已有机制 | 本文的变化与边界 |
| --- | --- | --- |
| [MeanFlow v1 §4.1](https://arxiv.org/html/2505.13447v1) | 用区间平均速度与瞬时速度的恒等式构建 JVP 训练目标，实现一步生成 | RiskFlow 将思想用于条件动作与轨迹损失；原 MeanFlow 的插值和采样方向约定不同，不能直接逐符号套用 |
| [CCDiff v1 §4.2](https://arxiv.org/html/2412.17920v1) | TTC 阈值图、群组关系和智能体排序决定局部控制，扩散结合条件与梯度引导 | RiskFlow 的主要差别在动作流生成和输出优化，TTC 选车本身已有直接前例 |

## 关键图与可视化结果

![原论文 Figure 1：RiskFlow 的条件编码、动作流、JVP 与局部引导](../../assets/papers/riskflow-safety-critical-scenario-generation-original-figure-1.png)

原图显示噪声经动作残差和动力学模型生成轨迹，右下方才是控制对象的选择。图中的单次网络调用没有画出全部 30 次输出引导优化，不能用流程箭头数量代替延迟。

![原论文 Figure 2：Scene 0556 中 CCDiff 与 RiskFlow 的三帧轨迹](../../assets/papers/riskflow-safety-critical-scenario-generation-original-figure-2.png)

这是 $K=5$、规划间隔 0.5 秒的一个案例。作者认为下排产生了沿道路发展的碰撞，上排出现离路偏移；它说明一个具体失败形态，不证明所有场景中的碰撞都合理。

## 实验结论与证据

### 综合分数不能读成发生率

[Table 2–4 与 Evaluation Metrics](https://arxiv.org/html/2606.06423v1)以相同初始场景比较生成器。CS 是碰撞率经方法集合的 min-max 归一化所得，RS 则聚合归一化离路、ADE、FDE 和运动学偏离指标；0.57 不是 57% 的原始碰撞率，0.75 也不是通过安全验证的概率。部分表列没有达到归一化端点，具体跨哪些配置归一化未充分说明。

| 证据条件 | 作者报告的数值 | 支持的判断 |
| --- | --- | --- |
| Table 2，$K=5$ | RiskFlow CS/RS 0.57/0.75；CCDiff 0.57/0.56；STRIVE 0.87/0.33 | 与 CCDiff 同 CS 下 RS 更高；不是碰撞生成能力全面最强 |
| Table 2，标为 $T=5$ 秒的一列 | RiskFlow 0.83/0.54；CCDiff 0.83/0.53；CTG++ 0.70/0.64 | 长时设置仍有取舍，现实性并非各列第一 |
| Table 3，100 场景、$K=5$、0.5 秒规划间隔、单 4090 | RiskFlow 1.35 小时，即 48.6 秒/场景；CCDiff 6.25 小时；CTG++ 30.27 小时 | 完整评估耗时分别快 4.63 与 22.42 倍，不是每个控制周期的实时延迟 |
| Table 4，$K=5$ 消融 | 仅 MeanFlow 0.70/0.72；加风险项 0.52/0.72；仅加地图项 0.48/0.76；全部 0.57/0.75 | 风险项并不单调提高 CS；完整模型选择了另一种风险与现实性的平衡 |

正文把 $T$ 称为 rollout horizon，超参数又列不同 planning steps，碰撞指标另写 10 秒闭环窗口；这些时间概念还需配置解释。表中也没有多随机种子区间，不能把小数差距当作稳定显著收益。

## 应用场景与启发

### 报告分析与待验证假设

这类模型适合增加离线轨迹级回归测试的吞吐量，尚未覆盖相机、LiDAR 和完整感知栈。值得检验的假设是：TTC 排序在相同控制车辆数下，比随机选车更容易找到道路内的有效冲突。现有消融只改变生成器与引导项，没有直接验证这项排序收益。

## 局限与阅读风险

动力学积分约束了轨迹连续性，但不是车辆轮胎动力学、交通合法性或现实发生概率的证明。相对归一化分数随参与方法变化，不宜跨论文直接比。引导符号、Full 集合及时间协议尚未闭合；截至 2026-09-12，固定论文与针对标题、作者的公开检索未核实作者代码、权重或完整配置，不能把 tbsim 的存在视为本文实现已公开。

## 后续跟进

### 直接检验选车假设

先取得可核对的实现，确认时间参数、风险梯度方向和 Full 定义；无法确认则停止复现性主张。最小实验固定 30 个留出场景、$K=5$、同一权重及 5 组配对噪声，设 TTC 排序、随机选车、按距离选车三组；每组均限 30 次引导、相同地图权重、相同场景时长和 GPU 时间上限，所有超时记失败。报告原始碰撞率、道路内碰撞率、离路率与加速度/jerk 分布，用场景配对区间比较。若收益只来自离路增加，或有效碰撞差异区间持续覆盖零，停止“排序有效”的主张；不把该检验扩展成道路测试。
