---
{
  "id": "select2drive-pragmatic-communications",
  "tag": "cooperative-autonomous-driving",
  "tags": [
    "cooperative-autonomous-driving"
  ],
  "title": "Select2Drive: Pragmatic Communications for Real-Time Collaborative Autonomous Driving",
  "source": "arXiv:2501.12040 / https://arxiv.org/abs/2501.12040",
  "authors": [
    "Jiahao Huang",
    "Jianhang Zhu",
    "Rongpeng Li",
    "Zhifeng Zhao",
    "Honggang Zhang"
  ],
  "affiliations": [
    "Zhejiang University",
    "Zhejiang Lab",
    "Macau University of Science and Technology"
  ],
  "comment": "Select2Drive 关注 V2X 自动驾驶里最容易被低估的工程问题：带宽、延迟和位姿误差存在时，并不是传得越多越好。它把通信选择直接和闭环驾驶表现挂钩，适合用于协同驾驶系统的信息价值评估。"
}
---

## 一句话定位

Select2Drive 在支持车辆或路侧端预测“消息到达时”的感知特征，并根据自车上一轮计划挑选传输区域；重点是同时处理信息过期和通信内容与驾驶需求不匹配，而不是把通信量越小当作唯一目标。

- 核心证据：31 条 CARLA Town05 Short Routes 上，20 MHz 档完整模型 Driving Score 为 46.904，对照 SiCP 为 43.289，增加 3.615 分、相对约 8.35%；在 5 MHz 档仍领先，但不能概括为所有安全指标都更好。[表 V](https://arxiv.org/html/2501.12040v4#S5.T5)
- 主要边界：闭环来自仿真；表 III 的车载 THOR 时延是由 RTX 4090 测量按算力缩放的估计。本文也并非直接以驾驶分作可微训练目标。

## 论文要解决的问题

### 问题与假设

协同感知可能收到准确却已经过期的消息：支持车先提特征、经过传输和排队，自车再融合决策；此时行人已经移动。与此同时，训练规划器的行为克隆数据有限，额外看到很多与行驶无关的目标也可能改变输入分布。因此作者把问题拆成 DPP（分布式预测感知）和 APC（按重要区域通信）。这里的重要区域来自规划 waypoint，不是 AoI 所常指的信息年龄。

系统假设可以估计各链路延迟、取得最近两帧热图和上一轮规划。请求/置信图作为低维控制消息交换，其传输开销被假设相对高维特征可忽略。带宽和延迟服从论文的分析/随机模型，而非测得的实车通信 trace。[§III、表 IV](https://arxiv.org/html/2501.12040v4#S3)

### 相关工作与差异

| 工作与一手来源 | 已有机制 | Select2Drive 的变化与比较边界 |
| --- | --- | --- |
| Hu 等，Where2comm，NeurIPS 2022；[原文 v1 §4](https://arxiv.org/html/2209.12836v1#S4) | 用空间置信图和接收端请求挑选稀疏特征，逐位置注意力融合；可根据预算改变通信区域。 | Select2Drive 预测接收时刻特征，并把 waypoint 周边和动态变化作为请求依据；不能把空间稀疏通信本身算作新机制。 |
| Liu 等，CoDriving / V2Xverse，2025 T-PAMI 接收版；[原文 v2 §IV-C–D](https://arxiv.org/html/2404.09496v2#S4.SS3) | 已将计划 waypoint 转为高斯请求图，结合感知置信度按预算选区，并用融合特征规划、PID 执行。 | Select2Drive 的差异主要在支持端 DPP、延迟估计和动态变化告警；“规划影响通信”已有直接先例。本文闭环表未给出名为 CoDriving 的独立行，不宜声称已公平击败其完整系统。 |

## 方法和系统设计

### 数据真正怎样流动

车端和支持端首先用 PointPillar 等模块生成 BEV 特征、目标热图和包围盒。DPP 在支持端读取两帧低维热图，以 DMVFN 迭代预测到预计接收时刻，再用 MotionNet 提取二维运动流，搬移当前高维特征。这样避免直接生成整张高维 BEV；代价是运动表示难以创造此前完全不存在的目标特征。

APC 读取自车上一轮 waypoint，在最近 waypoint 附近生成高斯请求图；支持端还计算预测前后置信度的变化，防止仅盯住计划走廊而忽略突然出现的动态目标。满足阈值的特征被发送，自车通过位置注意力融合，检测结果经 NMS 和栅格化生成占据历史，再结合导航目标输入 MotionNet 规划器。输出 10 个 waypoint 后由横向、纵向 PID 转成控制。[§III-A、§IV、算法 1](https://arxiv.org/html/2501.12040v4#S4)

### 三组关键公式

第一组是预测时刻的依据，重排原文式 8 与 §IV-A1 的定义：

$$
\begin{aligned}
 \tau_{ji}&=\tau_j^{\rm ext}+\tau_{ji}^{\rm asyn}+\tau_{ji}^{\rm tx}+\tau_i^{\rm dm}+\tau_{ji}^{\rm q},\\
 n_{ji}&=\left\lfloor\widetilde\tau_{ji}/\tau\right\rfloor,\qquad t_r'=t+n_{ji}\tau.
\end{aligned}
$$

五项分别是提特征、异步、通信、决策和排队时间；$\widetilde\tau_{ji}$ 是估计总延迟，$\tau=100$ ms 是决策间隔。模型预测到离散的 $t_r'$，而非精确连续接收时刻；延迟估计偏差、向下取整和迭代误差都可能保留残差。[式 8、§IV-A1](https://arxiv.org/html/2501.12040v4#S3.E8)

第二组是低维预测到高维重建，对应式 14、19、21；下面将 DMVFN 的多次迭代合并记作 $P$：

$$
\begin{aligned}
 \widehat H_j^{t_r'}&=P(H_j^{t-\tau},H_j^t;n_{ji}),\\
 U_j&=\Phi_{\rm MAT}(H_j^t,\widehat H_j^{t_r'}),\\
 \widehat F_j^{t_r'}(x,y)&=F_j^t(x+U_j(x,y,0),y+U_j(x,y,1)).
\end{aligned}
$$

$H$ 是低维目标热图，$F$ 是高维语义特征，$U$ 为每个格子的二维位移。它学的是“特征移到哪里”，不保证被遮挡目标的外观、旋转或拓扑变化都能由平移表达。训练使用未来真值热图及目标实例位移监督；推理只用历史热图和预测。[§IV-A](https://arxiv.org/html/2501.12040v4#S4.SS1)

第三组保留原文式 22–23 的选择结构，其中 $\widehat C_j$ 是预测热图生成的置信图，$\Delta C_j=\lvert\widehat C_j-C_j\rvert$：

$$
\begin{aligned}
 R_i(x,y)&=\frac{1}{\sigma_F\sqrt{2\pi}}\exp\!\left[-\frac{(x-W_x)^2+(y-W_y)^2}{2\sigma_F^2}\right],\\
 P_{ji}&=\mathbf 1\!\left[\max(R_i\odot\widehat C_j,\Delta C_j/n_{ji})\ge p_{\rm thre}\right],\\
 M_{ji}&=\widehat F_j\odot P_{ji}.
\end{aligned}
$$

$(W_x,W_y)$ 来自上一轮计划，$\sigma_F=15$ m 控制关注范围，$p_{\rm thre}=0.05$ 控制通信稀疏程度。按原式直接代入，且采用式 3 中置信度不超过 1 的范围，请求项最大为 $1/(15\sqrt{2\pi})\approx0.0266$，小于 0.05 阈值；这样 waypoint 关注分支本身不会选中任何格子，只能由置信变化分支触发。它是否另有归一化、坐标单位变换或不同参数实现，需核对代码/作者说明。这里保留原式而不暗中改成可触发的尺度，也不把其文字描述视为已由该字面公式证明。原文对 $n_{ji}=0$ 时除法如何处理未在该式说明，复现必须检查实现，而不能自行补齐后当作原方法。[式 22–23](https://arxiv.org/html/2501.12040v4#S4.E22)

### 优化与部署的界线

感知部分先由检测/状态误差、DMVFN 热图预测损失和 MAT 位移损失监督训练；DMVFN 使用逐层 L1 与 VGG 感知项，9 个运动流块带动态路由。随后使用已收敛的感知参数训练规划器，以专家 waypoint 的 L2 误差作行为克隆。NMS 和占据栅格化不是可训练操作；不能因为系统目标写成驾驶效用最大化，就声称 Driving Score 对全部模块端到端反传。[式 18、24–25](https://arxiv.org/html/2501.12040v4#S4.SS3)

推理保留支持端预测、MAT、APC、融合和规划，不需要未来真值或专家轨迹；上一轮自身计划仍是必需输入。正文列出结构与损失权重，但本次未找到完整训练 epoch、batch size、优化器设置及统一训练预算，因此跨骨干公平性仍须查配置。

## 关键图与可视化结果

![原论文图 2：感知、DPP/APC、特征融合与 PID 控制的闭环系统](../../assets/papers/select2drive-figure-2.png)

沿上半部从左到右读取，关注上一轮 waypoint 回到 Request Generator 的箭头，以及 DPP 位于支持端消息打包之前。下半部对应传感器、热图、融合框和控制输出。图里的通信模块是系统抽象，不能证明实现了完整商用 V2X 协议栈。[原图 2](https://arxiv.org/html/2501.12040v4#S1.F2)

![原论文图 6：5 MHz 带宽下两组协同感知案例](../../assets/papers/select2drive-figure-6.png)

两列是不同场景，各行是 No Fusion、Where2Comm、Select2Col、SiCP 和 Select2Drive。红框为预测、绿框为真值；最后一行说明预测补偿可以减少选定移动目标的错位。它属于感知定性样例，不能单独推出所有碰撞类型都减少。[原图 6](https://arxiv.org/html/2501.12040v4#S5.F6)

## 实验结论与证据

### 设置、单位和比较口径

离线感知用 V2Xverse 与真实 DAIR-V2X；闭环规划策略预训练于 V2Xverse，测试在 CARLA 0.9.10 Leaderboard 的 31 条 Town05 Short Routes。表 V 说明改变 seed 后求路线均值，但未提供每行置信区间及完整 seed 清单。DS 是驾驶综合分，越高越好；RC 是路线完成百分比。20/10/5 MHz 对应表中 0/100/200 ms 的 uniform latency 档，这个 0 不等于总感知决策延迟为零。[§V-A、表 IV–V](https://arxiv.org/html/2501.12040v4#S5.SS1)

感知报告 AP30/AP50/AP70，Composite AP 又按 0.3/0.3/0.4 加权。延迟实验的类别权重为 0.4/0.4/0.2，位姿噪声实验改为 0.8/0.1/0.1，故不能把两类图上的复合 AP 直接连成同一退化曲线。通信量采用对数代理表达式；不把其中的数值直接解释为空口吞吐或可靠传输率。

### 主结果与 APC 消融

| 原表 V 的同档比较 | 配置 | DS ↑（分） | RC ↑（%） |
| --- | --- | ---: | ---: |
| 20 MHz / 0 ms 档 | SiCP | 43.289 | 80.159 |
| 同档 | Select2Drive 去 APC | 40.991 | 82.535 |
| 同档 | Select2Drive | 46.904 | 82.284 |
| 5 MHz / 200 ms 档 | SiCP | 40.511 | 66.415 |
| 同档 | Select2Drive 去 APC | 38.853 | 54.574 |
| 同档 | Select2Drive | 43.823 | 70.588 |

20 MHz 时加入 APC 提高 5.913 DS 分、相对约 14.4%，但 RC 下降 0.251 个百分点；5 MHz 时提高 4.970 DS 分和 16.014 个 RC 百分点。这表明选区效应依赖通信条件，而非“通信越少越安全”的普遍定律。相对 SiCP，20 MHz 的 RC 只增加 2.125 个百分点；作者写的 2.65% 是相对提升。[表 V](https://arxiv.org/html/2501.12040v4#S5.T5)

表 V 的车辆碰撞等分项并非全部领先；其 Infraction Penalty 方向与常用乘法惩罚得分语义还需要结合评价脚本核对，本报告不据此重算安全总分。SiCP 等对照是在本文平台接入 IL planner 的版本，不是把各原论文的不同闭环结果拼表。

### 时延、扰动与剩余证据

表 III 在 RTX 4090 测到 DMVFN 1.17 ms、PointPillar 66.46 ms、MotionNet 5.70 ms、SDPA 0.16 ms；车载数字依据 THOR 2000 TOPS、70% 利用率缩放。论文给出的约 69.34 ms 车载总量不属于实车实测，也不包含所有链路条件下的消息等待。[表 III 及脚注](https://arxiv.org/html/2501.12040v4#S4.T3)

本文确实测试位姿误差、抖动和丢包：丢失消息以高斯噪声替代、抖动改变到达时间，感知曲线含区间；不能写成这些因素完全未测。但该替代机制不同于真实接收器的丢弃、保持上一帧或重传，感知鲁棒性也未逐项等价验证为闭环安全性。[§V-A、图 7–9](https://arxiv.org/html/2501.12040v4#S5.SS1)

## 应用场景与启发

- 作者主张：在算力、通信资源有限时，预测过期信息并优先传递驾驶相关区域，改善整体驾驶表现。
- 我的判断：DPP 的部署位置和上一轮计划反馈更值得借鉴；APC 和检测置信的组合已经超出单纯压缩，但其优化仍依赖固定 planner 与数据分布。
- 待验证假设：用多个合理候选计划的并集生成请求图，比仅依赖上一轮单计划更能保留突然横穿目标的信息；须在等通信字节和同预测模块下比较，避免把更多通信伪装成策略收益。

## 局限与阅读风险

作者把仿真结果外推为现实适用性，本报告只接受其已测范围。带宽和传输时延建模没有替代标准协议栈；式 7 所称 propagation latency 实际是消息大小除链路容量形式，不应解释为电波飞行时间。模型假设控制图开销可忽略，真实密集节点下是否仍成立未由空口测量验证。

数据集切分规模、统一训练预算和完整 seed 没在正文展开；原文部分通信对数单位及个别文字比较与表行对应不清，应优先引用明确的匹配行，而不是直接复制“普遍最优”描述。代码可访问也不等于原文全部配置、权重和结果已可复现。

## 后续跟进

### 最小验证与停止条件

- 当前资源（2026-09-12）：[作者组织仓库](https://github.com/ZJUNICE/Select2Drive)已含 codriving、opencood、openstl、simulation、配置路径和训练/推理入口；不再只是论文里的计划发布承诺。README 链接数据源与 CARLA，但本次未下载数据或核实全部 checkpoint；命令仍含作者绝对路径，需要改为本地路径后验证。
- 最小实验：固定 CARLA 0.9.10、相同 Town05 路线和 seed、同一感知/规划 checkpoint，在 5 MHz / 200 ms 档比较完整 APC、无 APC、候选计划并集请求；固定实际序列化消息字节预算，记录 DS、RC、每类碰撞和接收信息年龄。先离线回放检查 $n_{ji}=0$、丢包和时间戳，再执行仿真；所需 GPU 最低规格未由论文测定。
- 成功信号：在等字节、配对路线下 DS 或关键碰撞改善，且 RC 不出现预设不可接受下降；同时记录 P95 全链路延迟而非算力比例估计。
- 停止/转向条件：收益仅来自更大通信量、只在高斯替代丢包中出现，或换 planner 后消失，则优先修正消息过期策略与请求图泛化，不进入实车部署结论。

### 来源与核验记录

依据 [arXiv:2501.12040v4 全文](https://arxiv.org/html/2501.12040v4)，版本日期 2025-09-15，核验日 2026-09-12。核对 §III–V、式 8/14/19/21–25、表 III–V，以及原图 2、6 实际图像；作者单位在全文首页脚注核实。相关机制来自 Where2comm v1 §4 和 CoDriving v2 §IV-C–D。没有运行代码、训练模型或复算原始事件日志；所有实验数字均为原文报告或明确标注的算术差值。
