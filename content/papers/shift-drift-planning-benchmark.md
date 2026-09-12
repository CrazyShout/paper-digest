---
{
  "id": "shift-drift-planning-benchmark",
  "tag": "autonomous-driving-testing",
  "tags": [
    "autonomous-driving-testing",
    "end-to-end-autonomous-driving",
    "autonomous-driving-security"
  ],
  "title": "Shift & Drift: A Zero-Shot Benchmark for Generalizable and Robust Autonomous Driving Motion Planning",
  "source": "arXiv:2607.07844 / https://arxiv.org/abs/2607.07844",
  "authors": [
    "Alessandro Canevaro",
    "Hang Yu",
    "Julian Schmidt",
    "Peizheng Li",
    "Silvan Lindner",
    "Wilhelm Stork",
    "Georg Martius",
    "Julian Jordan"
  ],
  "affiliations": [
    "Mercedes-Benz AG",
    "University of Tübingen",
    "Karlsruhe Institute of Technology"
  ],
  "comment": "Shift & Drift 将航拍跨域与执行噪声纳入 nuPlan；须区分改变后的评分阈值、OU 波动率与白噪声标准差，以及规划控制接口的影响。"
}
---

## 一句话定位

Shift & Drift 将规划器的跨场景迁移和执行误差恢复分成两条测试轨：DeepPlan 提供转换自航拍数据的 1,182 个场景，另一轨在加速度与转向速率上注入噪声。结果显示所测 CaRL 更稳健，但训练范式、控制接口和噪声强度仍有混杂因素。

## 论文要解决的问题

在熟悉城市、理想控制器下获得高闭环分数，不代表规划器能处理密集行人空间或连续执行偏差。作者希望保留 nuPlan 的输入和评分接口，同时改变道路交互分布、让车辆偏离预期状态，从而检验模型是否有恢复能力。这里“零样本”指不在 DeepPlan 上适配，不能单独证明模型没有记忆地图或接触过类似环境。

## 方法和系统设计

### Semantic Shift：从无自车航拍到规划场景

固定 [arXiv v1 §III-A](https://arxiv.org/html/2607.07844v1#S3.SS1)将 DSC3D 的 OpenDRIVE 地图转换为 nuPlan GeoPackage/SQLite。12.5 Hz 记录按 18 秒窗口截取，相邻窗口重叠 6 秒；每个符合要求的车辆都可作为自车，排除行人、自行车、卡车，要求峰值速度超过 1 米/秒且没有框重叠。轨迹插值到 20 Hz，帧 60 为当前时刻，提供约 3 秒历史和 15 秒未来。

因此 1,182 是生成的 episode 数，可能共享原始时段和车辆互动，不能视作 1,182 个独立交通现场。用日志规划器剔除碰撞、驶出道路及进度不足的转换场景，再人工修正路线。最终来自慕尼黑 205、斯图加特 206、辛德芬根 490、柏林 101、旧金山 180 个场景；并非全部来自欧洲。

### State-Distribution Drift：相关性与幅度要分开

[§III-B](https://arxiv.org/html/2607.07844v1#S3.SS2)在命令 $u=[a,\dot\delta]^\top$ 上加独立高斯噪声或两路 OU 过程，后者离散为：

$$
u_{applied}=u_{cmd}+x_k,\qquad
x_{k+1}=x_k+\theta(\mu-x_k)\Delta t+\sigma\sqrt{\Delta t}\,\epsilon_k,\qquad \epsilon_k\sim\mathcal N(0,1).
$$

OU 取 $\theta=2\,s^{-1}$、$\mu=0$，相关时间为 0.5 秒。AWGN 的加速度标准差为 0.5/1.0/1.5 米/秒平方，转向速率标准差为 0.1/0.2/0.3 弧度/秒。论文给 OU 使用相同数值的 $\sigma$，但 OU 的 $\sigma$ 是连续时间波动率，不是命令噪声的稳态标准差：

$$
\operatorname{Var}(x_{\infty})=\frac{\sigma^2}{2\theta},\qquad
\operatorname{Var}_{EM}(x_{\infty})=\frac{\sigma^2}{2\theta-\theta^2\Delta t}.
$$

后一式是该 Euler–Maruyama 递推在稳定条件下的方差，用于本报告解释。相同参数数值并不等幅，不能把 OU 与 AWGN 的差距完全归因于时间相关性；它们也是压力代理，未标定为某辆实车的误差模型。

### 原方法自身说明的控制差异

| 一手来源 | 原方法机制 | 对本基准解释的影响 |
| --- | --- | --- |
| [PDM，CoRL 2023 §3.3](https://proceedings.mlr.press/v229/dauner23a/dauner23a.pdf) | 用不同目标速度与横向偏移的 IDM 轨迹候选，经 LQR/运动学模拟评分并选优 | 不宜简化为 IDM 与 MOBIL 拼接，也没有对所有交互的安全保证 |
| [CaRL v1 §3、附录 B.6/D.3](https://arxiv.org/html/2504.17838v1) | PPO 优化路线进度及乘法/终止惩罚；nuPlan 中学习控制，训练时混合反应式与重放交通 | 与输出轨迹再经 LQR 的模型存在控制接口差异，稳健性不只可能来自“用了 RL” |

## 关键图与可视化结果

![原论文 Figure 1：航拍语义迁移与执行噪声两条测试轨](https://arxiv.org/html/2607.07844v1/x1.png)

左边改变地图和交通分布，右边改变命令执行；二者都进入 nuPlan 的对象状态级模拟，图中的航拍照片不意味着规划器接收车载原始图像。

![原论文 Figure 3：DeepPlan 中不同规划器的交互轨迹](https://arxiv.org/html/2607.07844v1/x3.png)

多帧案例包含行人密集转弯、无保护左转及绕过停车车辆。图用于说明碰撞、停滞和绕行等行为差异；个别成功案例不足以把一个方法归纳为普遍更懂社交规则。

## 实验结论与证据

### 评分阈值与反应模式都是协议的一部分

DeepPlan 保留 nuPlan 评分结构，却放宽阈值：驶出可行驶区容差 0.3→3 米，TTC 1→0.5 秒，纵向 jerk 上限 4.13→6 米/秒立方等。作者解释默认阈值令日志自车分数约从 90 降至 65。跨数据集总分因此同时包含场景与评分阈值变化，不能视作严格相同量尺的迁移误差。

非反应式 NR 中其他参与者重放日志；反应式 R 中邻近车辆使用 IDM，行人等类别并未因此成为完整反应式行为模型。[Tables III–IV](https://arxiv.org/html/2607.07844v1#S4)报告：

| 条件 | 作者数值 | 合理解释 |
| --- | --- | --- |
| NR，Val14→DeepPlan CLS | PDM 92.84→48.07；PlanTF 84.27→34.00；PLUTO 92.88→36.74；Diffusion 89.87→37.49；CaRL 93.87→72.57 | 所测 CaRL 总体下降较少；未隔离训练量、奖励或接口贡献 |
| NR，DeepPlan 安全与进度 | CaRL NCR 89.25、PER 83.29；PDM NCR 89.25、PER 50.21 | 二者非责任碰撞率相同，主要差距还包括前进能力；NCR 不是“没有任何碰撞” |
| PLUTO，DeepPlan NR→R | CLS 36.74→63.03 | 背景车反应模型显著改变排序与难度 |
| Val14 NR，高强度 OU | CaRL $87.08\pm4.89$；PlanTF $42.69\pm0.99$；Diffusion $52.90\pm7.52$ | 三个噪声种子的均值±标准差，不是置信区间 |
| DeepPlan NR，高强度 OU | CaRL $68.63\pm1.00$，无噪声 72.57 | 组合压力下仍下降；“所有分数超过 85”只适用于 Val14 部分 |

引言的“下降 76%”来自 Diffusion Planner 的 Val14 89.87 对慕尼黑 21.50，不是全 DeepPlan 平均下降。作者将 CaRL 优势解释为探索与恢复训练，这是一种有依据的解释，尚无等规模、同接口的因果消融。

## 应用场景与启发

### 报告分析与待验证假设

这套接口适合检测“跨城市是否停住”和“偏离轨迹后能否回正”两种不同问题。待验证假设是：在噪声边际分布及能量匹配后，时间相关性仍会额外损伤部分规划器，而非原有 OU/AWGN 参数口径造成的比较差异。

## 局限与阅读风险

地图转换、人工路线修正及日志筛选会引入选择偏差；城市拓扑、VRU 密度和交通习惯也同时变化。原文“IL 缺少闭环纠偏”应限定为训练分布问题：这些 IL 规划器在评估时仍反复观测并重规划。对象真值、简化车辆动力学与规则背景车都限制了对实车恢复能力的外推。

## 后续跟进

### 资源与等幅相关噪声检验

截至 2026-09-12，[官方仓库 commit 9e90b2d](https://github.com/alessandro-canevaro/Shift-Drift/tree/9e90b2df2fb37b45020974c32079ecbac3d63451)只有 README、LICENSE、.gitignore，README 写明内部审核、将逐步发布；论文“code and data available”尚未对应可下载的转换集与噪声实现。本次未执行模拟或下载规划器权重。

最小实验固定 30 个不重叠原始录制片段、5 个噪声种子，比较无噪声、OU 序列、同一 OU 样本序列随机打乱后三组；后两组每路的 RMS、直方图和极值完全相同，仅改变时间排列。对一个 IL 与 CaRL 分别固定权重、控制器、噪声插入点、饱和规则和 20 Hz 时间步，使用相同总模拟时长。记录恢复时间、横向偏移、责任碰撞、进度和默认/放宽两套评分。若相关序列并未稳定恶化恢复指标，或差异只来自评分阈值，则停止相关性额外致害的假设；资源与接口未对齐前不作论文复现主张。
