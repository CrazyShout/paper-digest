---
{
  "id": "vladrivebench-cot-action-vla",
  "tag": "autonomous-driving-testing",
  "tags": [
    "autonomous-driving-testing",
    "autonomous-driving-security",
    "end-to-end-autonomous-driving"
  ],
  "title": "VLADriveBench: Evaluating CoT-Action Relationship in VLA for Autonomous Driving",
  "source": "arXiv:2606.12706 / https://arxiv.org/abs/2606.12706",
  "authors": [
    "Thach Nguyen",
    "Danhua Guo",
    "Tom Lampo",
    "Fei Wu",
    "Burhan Yaman"
  ],
  "affiliations": [
    "Uber AV Labs"
  ],
  "comment": "VLADriveBench 联合内容、一致性与 CoT 替换测试；须区分语义效应、词形敏感性、控制器差异和 OOD 下未经证明的上界假设。"
}
---

## 一句话定位

VLADriveBench 把“CoT 说得对、与动作相符、替换后真的改变动作”拆开测试：ORION 的表面一致率较高，却对词语与长度表现出明显敏感性；Alpamayo 1.5 在所测情景中呈现有方向的语义响应。两种现象都不能仅凭轨迹分数看出来。

## 论文要解决的问题

车辆一边刹车、一边输出“前方有行人”，可能是两个分支同时看到了行人，并不说明文字理由参与决策。反过来，文字仍说减速而车辆已经接近停止，也可能被简单一致率误判。作者同时检查理由内容和替换理由后的动作变化，试图辨别相关性、语义影响与实现伪影。

## 方法和系统设计

### 观测评估：给模糊动作集合，而非强制单标签

固定 [arXiv v1 §3、附录 A–E](https://arxiv.org/html/2606.12706v1#S3)在 CARLA 0.9.15 设置单一关键目标：行人、停车、红绿灯、停车标志，共 18 种目标配置，每模型三次配对种子运行；没有背景交通，天气晴朗。GPT 5.4、Claude Opus 4.6、Gemini Pro 2.5 多数投票提取动作、提及、灯色、幻觉标签；动作三方不同再由第四模型判别。评判 LLM 同时读取 CoT 文本与真值 actor 类型／位置（附录 E）；这些真值供离线标注，不是被测驾驶策略的输入。200 样本与一名人工标注者的 Cohen’s $\kappa$ 为 0.949–1.000。

CoT 和动作头都映射到加速/保持/减速集合，以 1 和 5 米/秒划分速度区间。动作头意图从控制器期望速度导出，并非原始动作头直接给出的类别。两集合有交集就算 relaxed alignment，再按累计路程的 1 米格等权聚合：

$$
A=\frac1B\sum_{b=1}^{B}\frac1{n_b}\sum_{k\in b}\mathbf1\{C_k\cap U_k\ne\varnothing\}.
$$

$C_k,U_k$ 是文字与控制意图集合，$n_b$ 是格内步数。这样避免长时间停车支配统计，但集合容忍区间也可能提高表面一致率；高分不代表每步主动作完全一致。

### 干预评估：保持视觉与随机数，替换理由

ORION 在前三轮 QA 后替换文字，再进入规划轮；Alpamayo 在 CoT 边界内替换 token，逐步重建 KV cache，保留视觉输入。逐步固定输入与随机数的位移差可记为：

$$
\Delta_h=D_h(V,C_{alt},\xi)-D_h(V,C_{self},\xi).
$$

$D_h$ 是未来 $h$ 秒的预测前向位移，$\xi$ 是固定随机状态。随后另做闭环累计路程和有实际障碍的安全响应测试。原理由解码再注回称 selfsplice，用来检查替换路径本身；它不是所有闭环差异必然为零的证明。

### 相关架构自身的一手依据

| 一手来源 | 原架构机制 | 对干预解释的影响 |
| --- | --- | --- |
| [ORION，ICCV 2025 §3](https://openaccess.thecvf.com/content/ICCV2025/papers/Fu_ORION_A_Holistic_End-to-End_Autonomous_Driving_Framework_by_Vision-Language_Instructed_ICCV_2025_paper.pdf) | QT-Former 编码时序视觉，多轮语言上下文压入 planning token，经 VAE 对齐与 GRU 生成轨迹 | 文字可能影响潜表示，却未必按人理解的语义方向影响驾驶 |
| [Alpamayo-R1 v1 §3.2/5.1](https://arxiv.org/html/2511.00088v1) | flow-matching action expert 读取视觉、运动历史及理由的 KV cache，输出连续控制轨迹 | 有直接条件路径，但路径存在不等于所有理由都被正确使用；训练动作 token 与推理连续解码也应区分 |

附录 F.4 还有重要执行差异：Alpamayo 通过 AlpaSim 的 MPC 计算后直接更新车辆位姿，ORION 通过 PID 控制 CARLA 物理引擎。因此跨模型闭环效应大小并非同一控制器下的纯架构对照。

## 关键图与可视化结果

![原论文 Figure 1：CoT 内容质量、动作一致性与替换干预](../../assets/papers/vladrivebench-cot-action-vla-original-figure-1.png)

虚线框把 CoT 本身和 CoT—动作关系纳入评估。图示强调两个问题互补；不能以一次替换无效证明该模型在所有情境都不使用理由。

![原论文 Tables 5–6：开环位移与闭环累计路程的不同证据](../../assets/papers/vladrivebench-cot-action-vla-original-tables-5-6.png)

固定版本仅有一幅编号 Figure；第二张保留完整原表区域。上表是郊区路线、五个种子的预测位移，下表是城市路线、七个种子的闭环路程差与 95% 区间，二者不能合并为同一实验。

## 实验结论与证据

### 理由一致不等于语义控制

[Table 3](https://arxiv.org/html/2606.12706v1#S4.T3)在 2–4 米/秒区间，ORION 的加速/减速 relaxed alignment 为 96.5%/85.7%；Alpamayo 多数动作主类是保持，部分一致来自集合次选项。灯色准确率另以“已提及灯”为条件，不能把 ORION 近处红灯的 54.0% 当全部观测的正确率。

| 来源和条件 | 数字 | 支持的判断 |
| --- | --- | --- |
| 附录 Table 13，ORION 城市路、九种子、3 秒预测 | 自生刹车文本 -0.426 m，打乱 -0.417 m，同长度重复 token -0.818 m | 影响不能单由连贯语义解释；不是完全没有文本影响 |
| Table 4，Alpamayo 1.5 城市路、七种子×38步、2 秒预测 | 加速 +0.083 m；行人刹车 -0.346 m；车辆刹车 -0.391 m | 在固定输入下存在方向一致的效应，步数不等于独立样本数 |
| Table 6，同模型城市路闭环、七种子、5.9 秒 | 车辆条件 -20.1 m，95% CI [-23.0,-17.1]；加速 +0.2 m，CI [-0.6,+1.1] | 刹车效应累积；该闭环加速差异并未排除零 |
| §4.4，同模型安全响应、每组四次 | 路缘行人碰撞 4/4、居中行人 3/4；占道停车未被覆盖，基线均停车 | 小样本显示目标条件影响文本覆盖视觉的能力，尚未标定普遍显著性阈值 |

主文 ORION 的 81.9%/-0.437 m 与附录九种子、位移超过 0.1 m 的 67.9%/-0.426 m 不是同一报告口径，以上按附录表读取。主文又称 selfsplice 全部精确零，但附录 G.1 给 ORION 小于 0.002 m 的差异；Alpamayo 逐步固定随机数结果相同，闭环 Table 6 的 selfsplice 则仍有小幅非零均值。

## 应用场景与启发

### 报告分析与待验证假设

这套方法能帮助定位“理由好听却不指导动作”以及“错误理由会传进动作”的两类问题。待验证假设是：本文所谓视觉显著性效应部分来自障碍类型、位置和碰撞几何变化；只有固定物理条件、单独改变视觉可见程度，才能判断视觉信号是否调节 CoT 影响。

## 局限与阅读风险

Alpamayo 在 CARLA 是域外测试。作者猜测视觉变弱会使干预效应偏大，但未证明其数值是现实域的上界，也不能保证跨域后效应符号不变。R1 与 1.5 同时改变骨干、语料和训练，不能把全部差异归因于 RL；[1.5 官方模型卡](https://huggingface.co/nvidia/Alpamayo-1.5-10B)确认新骨干和 RL 后训练，而 R1 技术报告本身也描述 RL 阶段。有限路线、手工文本及控制器差异进一步限制普遍结论。

## 后续跟进

### 资源与物理条件固定的最小实验

截至 2026-09-12，[ORION 作者库](https://github.com/xiaomi-mlab/Orion)与两代 Alpamayo 模型卡可访问；这不等于本基准的替换、评判和场景脚本已发布。固定论文附录 E 仍称完整提示/代码将在发表时公布，本次精确标题检索未核实独立工具包，也未加载模型或执行干预。

最小实验固定 Alpamayo 1.5、同一行人尺寸/位置/速度、同一自车状态与控制器，只改变渲染对比度，交叉比较原生理由与固定替代理由。用 30 个场景状态、10 个配对种子，保持文本 token 数、视觉帧数与每组模型调用数相同，并先通过 selfsplice 误差检查。报告位移差、刹车起点、碰撞，以及从未替换的原生 CoT 计算的目标提及率；固定注入文本不能作为视觉辨认指标。按场景计算对比度与 CoT 替换对配对位移差的交互，并与 selfsplice 噪声比较；若交互不超过该噪声范围，则停止“视觉显著性调节 CoT 影响”的主张。检验仅限封闭模拟，不外推道路表现。
