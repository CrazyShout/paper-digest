---
{
  "id": "cars-responsibility-testing",
  "tag": "autonomous-driving-testing",
  "tags": [
    "autonomous-driving-testing",
    "autonomous-driving-security"
  ],
  "title": "Learning Responsibility-Attributed Adversarial Scenarios for Testing Autonomous Vehicles",
  "source": "arXiv:2605.13751 / https://arxiv.org/abs/2605.13751 / Fixed full text: https://arxiv.org/html/2605.13751v1",
  "authors": [
    "Yizhuo Xiao",
    "Haotian Yan",
    "Ying Wang",
    "Zhongpan Zhu",
    "Yuxin Zhang",
    "Xintao Yan",
    "Mustafa Suphi Erden",
    "Cheng Wang"
  ],
  "affiliations": [
    "Heriot-Watt University",
    "Tongji University",
    "Jilin University",
    "University of Shanghai for Science and Technology",
    "National Key Laboratory of Automotive Chassis Integration and Bionics",
    "The University of Hong Kong"
  ],
  "comment": "CARS 将动态对手选择、混合高斯扩散策略和反事实制动参考组合，用可避免性筛选有诊断价值的碰撞。88.7% 是已生成碰撞中的 FSM 归因比例，不是碰撞生成率或法律责任准确率。"
}
---

## 一句话定位

CARS 的核心问题是：一个测试场景发生碰撞，究竟暴露了 ADS 的可避免失误，还是让任何合理响应都无能为力？它先生成交互，再固定对手轨迹、替换目标车辆响应，用规范化纵向驾驶参考检验碰撞能否避免。

- 核心证据：nuScenes 中，已生成碰撞有 88.7% 可被 FSM 参考避免；SafeSim 对照为 44.8%，但两者生成器与预算并非单一因素匹配。[表 1](https://arxiv.org/html/2605.13751v1#Sx2.T1)
- 主要边界：归因依赖制动参考、固定对手轨迹与道路路径约束，不是法律责任判断。

## 论文要解决的问题

### 有用失败的定义

输入是地图、车辆历史状态与固定目标策略，输出是周车动作序列及碰撞的参考可避免性。只有碰撞发生于目标 ADS、但参考响应在同一对手轨迹下能够避免时，才记为可归因。一次只控制一辆对手，其他策略保持固定；本次研究对象均为车辆。

### 相关工作与差异

| 一手工作 | 已有机制 | CARS 的区别 |
| --- | --- | --- |
| Rempe 等，STRIVE，CVPR 2022；[原文](https://nv-tlabs.github.io/STRIVE/docs/strive.pdf) | 在图条件 VAE 的交通潜空间优化碰撞，并另做 solution optimization 寻找无碰撞解 | CARS 的检验参考是显式 CCD 制动模型；不能说既有方法完全不问场景可解性 |
| Chang 等，SAFE-SIM，[2024 v1](https://arxiv.org/html/2401.00391v1)，后发表于 ECCV 2024 | 对轨迹扩散施加碰撞与真实性 guidance，其他交通参与者闭环反应 | CARS 用在线对手重选、混合输出头与 PPO，再统一做责任参考复放；主表是作者适配后的比较 |

## 方法和系统设计

### 从对手选择到反事实核验

13 维相对几何/运动特征输入 histogram gradient boosting 分类器，每步对邻车排序；最高分新候选连续五步胜出后才切换，防止频繁跳转。地图由 ResNet-18 编码，时序去噪网络接收地图及目标、邻车历史，生成加速度与 yaw rate；20 步、10 Hz 对应 2 s 动作预测，使用 unicycle 动力学推进。[Methods](https://arxiv.org/html/2605.13751v1#Sx4)

### 归因与生成的关键定义

$$
I_{\mathrm{attr}}(\mathcal T_a)=\mathbf1\{C(\xi_{\mathrm{ADS}}(\mathcal T_a))=1,\ C(\xi_{\mathrm{CCD}}(\mathcal T_a))=0\}.
$$

这是原式 2 的简写：$\mathcal T_a$ 为固定的对手轨迹，$C$ 是碰撞指示；两次复放只替换目标响应。若对手会因新的目标行为而改变动作，这种固定轨迹反事实就不再代表完整互动。

$$
p_{\theta}(\tau_a^0\mid\tau_a^r,c)=\prod_{h=1}^{T}\sum_{k=1}^{K}\pi_{h,k}\mathcal N(\tau_{a,h}^0;\mu_{h,k},\Sigma_{h,k}),\qquad
\mathcal L=\mathcal L_{\mathrm{NLL}}-\lambda_H\mathcal H_{\pi}+\lambda_{\mathrm{repel}}\mathcal L_{\mathrm{repel}}.
$$

原式 5–6 中，$r$ 是扩散步、$h$ 是预测时域，$K=8$ 为混合数。NLL 拟合数据动作；熵项鼓励使用多个分量，排斥项避免均值重合。它们提高动作分布容量，不能直接证明行为守法。

### 训练、评测与作者主张的边界

先用 nuScenes 训练生成先验，再在固定目标/背景策略下 PPO 微调对手。原式 7 与补充 S5 列出的奖励是纵向接近、横向接近/闭合、碰撞奖励和时间惩罚；虽然作者称其 attribution-aware，公开公式未显式写出 CCD 避免性奖励或反馈梯度。因此可直接核实的是“生成加参考核验”，不把端到端归因优化当成已完整展示的机制。

FSM 固定目标的原记录路径、仅调节沿路径速度，含 0.75 s 反应延迟、4/6 m/s² 舒适/最大减速度及 12.65 m/s³ jerk 上限；CC-JP、RSS 是敏感性复核。七个随机种子重跑同一训练后策略，不能当作七次独立训练。[补充 S5–S9](https://arxiv.org/html/2605.13751v1#S5)

## 关键图与可视化结果

![原论文图 1：对手选择、轨迹容量与责任歧义](https://arxiv.org/html/2605.13751v1/nc_images/problem.png)

从上到下读三个设计动机。最下方把碰撞分成可归因与不可避免部分；这只是概念划分，不是数据集比例。

![原论文图 2：在线对手选择、扩散与 PPO、参考归因](https://arxiv.org/html/2605.13751v1/nc_images/methodology.png)

按左侧选择、右上生成、右中强化学习、右下反事实复放阅读。图中的奖励框也未单列 CCD 信号，因而应与上述公式边界一起理解。

## 实验结论与证据

### 指标及比较条件

FSM/CC-JP/RSS 百分比的分母是各方法已生成的碰撞集，不是全部候选场景。$H_{{\mathrm{crit}}}$ 在 FSM 可避免子集上统计 Easy/Medium/Hard 分布；IP% 则先计算每条轨迹违反运动学阈值的时间步比例，再跨场景平均。它不是“不可行场景占比”。补充 S13 先对各方法位置轨迹做 7 帧、三次多项式 Savitzky–Golay 平滑再求导；RounD 还单独从横向加速度绝对值中扣除局部曲率的向心项。因此跨域 IP 不能视作未经调整的同一原始物理量对比。阈值为纵向加速度 7 m/s²、jerk 12.65 m/s³、横向加速度 3 m/s²。[Methods、补充 S13](https://arxiv.org/html/2605.13751v1#S13)

| 设置（表 1） | FSM 可避免率（%）↑ | CC-JP / RSS（%） | IP（%）↓ |
| --- | ---: | --- | ---: |
| STRIVE，nuScenes | 7.3 | 5.8 / 6.1 | 36.39 |
| SafeSim，nuScenes | 44.8 | 44.8 / 44.8 | 12.94 |
| CARS，单分量对手 | 45.2 | 35.5 / 53.2 | 27.40 |
| CARS，八分量 | 88.7 | 79.7 / 97.1 | 0.04 |
| 同策略转 AD4CHE | 76.4 | 63.8 / 80.9 | 0.00 |
| 同策略转 RounD | 57.5 | 52.0 / 70.7 | 2.32 |

### 消融与有效性

单分量的 $H_{{\mathrm{crit}}}=0.797$ 几乎等于完整模型 0.798，但归因和 IP 明显恶化：只有“严重度多样”不足以保证测试有效。换 CTG 目标 planner 后 FSM 为 86.0%；跨域不重训，但 RounD 降至 57.5%，与纵向参考对弯曲侧向冲突的局限一致。73.8% 碰撞被三种参考共同判为可避免，模型之间仍有实质分歧；没有法律事故真值能把这些比例解释成准确率。

## 应用场景与启发

- 作者主张：从碰撞数量转向可解释的验证证据。
- 我的判断：最值得复用的是固定轨迹、记录参考参数和报告归因分歧的协议。
- 待验证假设：在相同 FSM 严重度和相近冲突几何下，三参考共同判为可避免的场景，可能比参考存在分歧的场景具有更稳定的参数扰动标签，适合优先作为回归用例。

## 局限与阅读风险

纵向制动参考不覆盖所有规避动作，固定记录路径又限制侧向避让；因此不能把未通过 FSM 的场景等同于真实不可避免。算法一次选一辆对手，未覆盖协同多车或弱势道路参与者。原文缺少完整训练轮数、硬件成本和统一生成预算表；主表归因比例也不能取代发现效率。

## 后续跟进

### 最小验证与停止条件

- 当前资源（2026-09-12）：[官方代码](https://github.com/RoboSafe-Lab/CARS-code)包含训练、PPO、rollout、评测、JSON 配置及决策树文件；大模型权重由 README 链接至 [官方指定 HF 仓库](https://huggingface.co/Visier-1/cars-checkpoints)。数据需分别取得 nuScenes、RounD 和 AD4CHE；本次未加载权重，HF 目录未成功读取，未确认远端文件可下载。README 一处把 avoidable 的方向写反，归因定义以论文式 2 为准。
- 最小验证：先取已有公开生成轨迹，固定初始状态、对手轨迹与碰撞几何，重算三参考归因、逐步 IP 和共同可避免子集，再按原始行程划分分析集与留出集：在相同 FSM 严重度层、近似速度/间距内，配对“三参考一致可避免”与“参考有分歧”两组。对两组施加相同预先设定的反应时间微调网格，例如各自默认值的±10%，其他制动、路径、碰撞和对手条件不变；记录每条场景的标签翻转比例，不再重新优化对手。
- 成功信号：在留出行程中，参考一致组比同严重度的分歧组有更低的标签翻转比例，同时保留零运动学违规子集；按场景配对报告差值区间。若差别仅由较大初始安全间距解释，或配对后消失，就不支持一致性筛选的新增价值。
- 停止条件：复放路径或碰撞检测不一致导致标签翻转，或 CCD 反馈实现与论文主张无法对齐；先澄清协议，再比较生成器。

### 来源与核验记录

固定 arXiv:2605.13751v1；2026-09-12 阅读 Methods、结果、式 1–8、补充 S4–S9/S13 与表 1，逐张打开原图 1、2，并阅读 STRIVE 与 SAFE-SIM 自身原文。没有执行对抗生成、训练或复现实验。
