---
{
  "id": "scaling-self-play-e2e-driving",
  "tag": "end-to-end-autonomous-driving",
  "tags": [
    "end-to-end-autonomous-driving",
    "autonomous-driving-testing"
  ],
  "title": "Scaling Self-Play for End-to-End Driving",
  "source": "arXiv:2606.19641 / https://arxiv.org/abs/2606.19641",
  "authors": [
    "Luke Rowe",
    "Roger Girgis",
    "Rodrigue de Schaetzen",
    "Daphne Cornelisse",
    "Alaap Grandhi",
    "Felix Heide",
    "Eugene Vinitsky",
    "Christopher Pal",
    "Liam Paull"
  ],
  "affiliations": [
    "Mila - Quebec AI Institute",
    "Université de Montréal",
    "Polytechnique Montréal",
    "Torc Robotics",
    "NYU Tandon School of Engineering",
    "McMaster University",
    "Princeton University"
  ],
  "comment": "这篇论文用高吞吐像素级自博弈和 self-play DAgger 训练端到端驾驶策略，直接挑战“端到端必须依赖人类示范轨迹”的默认路线。"
}
---

## 一句话定位

Gigapixel 用简化像素世界中的多车自博弈蒸馏训练驾驶策略，再适配真实图像；它免去人类轨迹监督，但仍依赖真实日志重建、场景标注与后续评分器训练。[固定全文 v2，§3–4、附录 A–C](https://arxiv.org/html/2606.19641v2)

## 论文要解决的问题

离线模仿难覆盖策略犯错后会访问的状态，而像素级强化学习对大视觉模型又太贵。作者把高样本量 RL 留给矢量输入教师，让像素学生在自己造成的交互状态上获得教师标签。

## 方法和系统设计

### 三个训练阶段及执行接口

Gigapixel 在 PufferDrive 中接入 Madrona GPU 批量渲染：车辆和障碍为盒体，道路为平面条带，信号灯为球体，不追求照片级纹理。教师为 2.7M 参数矢量策略，使用 PPO 自博弈；每车随机奖励权重作为条件，产生不同驾驶风格。

学生以四路图像、自车状态、导航命令和同一奖励条件输出 4 s、8 点轨迹；各点为当前自车后轴坐标系下的 SE(2) 位移与朝向增量，每秒重规划 2 次。访问状态 $S$ 后复制一份仿真器，让教师自博弈展开产生各车目标 $\tau_i^T$；§3.2 的学习目标可写作：

$$
\min_\theta\;\mathbb E_{S\sim d_{\pi_S}^{\mathrm{selfplay}},i}\left[L_{\mathrm{plan}}(\pi_S^\theta(O_{\mathrm{pix}}(S,i)),\tau_i^T)\right].
$$

训练早期混合教师与学生执行，教师概率在前 125M 步由 1 降到 0，最后 25M 步完全学生控制。附录澄清：只有自驾车用 NAVSIM LQR 跟踪轨迹，其他车通过学生并行动作头执行离散 jerk；不是所有车型共享同一个 LQR。无效／碰撞教师轨迹被过滤，左右转监督权重为直行的 5 倍。

### 真实图像适配与评分器边界

固定仿真学生和规划头，用成对真实图像／其盒体渲染适配感知栈。附录 B.3：

$$
L=\lambda\|E_{\mathrm{real}}-E_{\mathrm{sim}}\|_2^2+\frac1P\sum_{k=1}^{P}\|\hat\tau_k-\tau_k\|_1+L_{\mathrm{score}}.
$$

$E$ 是 register 特征；多模态 DrivoR 有 $P=64$ 候选，适配逐模式对齐，区别于最初面对单教师轨迹的 winner-takes-all 训练。DrivoR-Reg 取 $P=1$ 且无评分项。评分器需要 nuPlan 的 PDMS 标签，因此另在 navtrain 上训练，其他模块冻结，不能说整套模型都在 Gigapixel 中学完。

### 与两项原始方法对照

[Cusumano-Towner 等，Gigaflow，2025 v1，§2、附录 C](https://arxiv.org/html/2502.03349v1) 用置换不变矢量编码器、奖励条件和 PPO 控制多类交通参与者；本工作重实现矢量教师，再把行为传给图像模型。[DrivoR 原论文，2026 v1，§3](https://arxiv.org/html/2601.05083v1#S3) 以相机 register 压缩输入，分开生成和评分候选，训练时对评分输入轨迹停止梯度；Gigapixel 沿用这个结构，主要改变训练访问的状态与监督来源。

## 关键图与可视化结果

![原文 Figure 2：矢量教师、自博弈 DAgger 与图像适配](https://arxiv.org/html/2606.19641v2/gigapixel_system_felix_upgrades_v16.png)

图中 Fork S 是从学生实际状态复制教师展开，右侧雪花／火焰区分冻结与适配；具体车辆控制例外以附录 B.2 为准。

![原文 Figure 5：面对减速前车的闭环行为](https://arxiv.org/html/2606.19641v2/figures/drivor_comparison.png)

上行为自博弈训练，下面为 BC，黄色为预测轨迹。该例展示跟车失效差异，不代表真实道路碰撞率。

## 实验结论与证据

### 同结构对照与负结果

训练使用 nuPlan train 的 335245 个约 20 s 场景；行人、自行车和信号灯重放日志，教师配置还含 10% log-replay。HUGSIM 是重建场景闭环仿真；NAVSIM-v2 navhard 是两阶段伪闭环，扰动姿态 Stage 2 与真实姿态 Stage 1 相乘得到 EPDMS。表 1–2，分数越高越好：

| 模型 | HUGSIM 平均 HD-Score | NAVSIM-v2 EPDMS | Stage 2 score |
| --- | --- | --- | --- |
| DrivoR-Reg，BC | 20.7 | 25.5 | 38.4 |
| Gigapixel-DrivoR-Reg | 33.2 | 29.5 | 45.5 |
| DrivoR，BC | 35.7 | 48.3 | 59.4 |
| Gigapixel-DrivoR | 38.5 | 50.1 | 63.5 |
| DrivoR，加 SimScale | 38.1 | 54.7 | 64.6 |

平均收益不覆盖所有难度：HUGSIM Extreme 的 DrivoR 为 32.5，Gigapixel 为 21.6。作者以较谨慎、易被阻塞解释，并报告碰撞时平均速度 5.27→1.95 m/s；较低碰撞速度本身不能证明整体更安全。NAVSIM 总分仍低于使用额外 SimScale 的对照。

### 消融与计算预算

表 3 统一 DrivoR-Reg：相同特征匹配和冻结规划头时，BC／单车 DAgger／自博弈 DAgger 的 HD-Score 为 18.6/30.1/33.2；自博弈再去掉特征 L2 降到 18.5，同时解冻规划头降到 15.8。它支持适配设计，尚未以相同有效监督样本数分离交互多样性与每场景多车标签收益。

教师 25B agent steps 用 8 H200、24 h；学生 150M steps 用 8 H200、36 h。真实适配约 4 A100、12 h：NAVSIM 用 85k navtrain、10 epochs，HUGSIM 用 103k navtrain+navval、20 epochs。评分器额外代价未汇总。Figure 1 的约 50k SPS 是吞吐量，不能等同于大模型完整训练速度；文中 3000 倍样本效率比较使用较小 CNN，并非 DrivoR。[附录 B、表 3](https://arxiv.org/html/2606.19641v2#A2)

## 应用场景与启发

值得迁移的是让昂贵图像模型学习恢复行为，同时把低成本教师展开与图像适配分开。待验证假设：规划头冻结时，成对真实／仿真特征匹配能帮助适配感知栈保留闭环行为。下述两组只检验这一特征匹配作用，不检验冻结规划头本身。

## 局限与阅读风险

“无轨迹监督”不等于无真实数据或人工奖励设计；场景与真实配对适配、PDMS 评分目标仍来自既有资源。未报告真实车实验或跨种子显著性。当前[官方仓库](https://github.com/montrealrobotics/gigapixel)写代码即将发布，树中只有说明／演示资源；训练配置表可读，完整模拟器、教师／学生权重和配对数据尚未核验可下载。原 DrivoR 开源不能替代这些资产。

## 后续跟进

### 两个同预算适配组

取得同一个 Gigapixel-DrivoR-Reg 检查点后复制两组，固定规划头、103k 配对样本、20 epochs、优化器及 3 seeds，只改变特征匹配 $\lambda=1/0$。约按每组 4 A100、12 h 的论文适配量级预留资源，再在同一 HUGSIM 集比较 HD-Score、碰撞和阻塞。拟定通过条件是 $\lambda=1$ 的平均 HD-Score 至少高 3 分且碰撞不增加；若只有最终权重而缺中间检查点／配对数据，停止此训练假设检验。本次未运行模型。
