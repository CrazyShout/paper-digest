---
{
  "id": "morph-u-resilient-v2x-planning",
  "tag": "cooperative-autonomous-driving",
  "tags": [
    "cooperative-autonomous-driving",
    "autonomous-driving-security",
    "autonomous-driving-testing"
  ],
  "title": "MORPH-U: Multi-Objective Resilient Motion Planning for V2X-Enabled Autonomous Driving in High-Uncertainty Environments via Simulation",
  "source": "arXiv:2605.07370 / https://arxiv.org/abs/2605.07370",
  "authors": [
    "Shih-Yu Lai"
  ],
  "affiliations": [
    "National Taiwan University"
  ],
  "comment": "MORPH-U 把 V2X 消息延迟、丢包和伪造纳入闭环规划，使用 LDM、Hybrid-A*、Pareto tuning 和轻量 Byzantine gate 处理不确定事件触发。"
}
---

## 一句话定位

MORPH-U 把 V2X 告警、地图更新、事件触发规划和控制器调参放进同一 CARLA 栈；贡献是整合与消融协议，证据仍限于人工设定的仿真事件。[固定全文 v1，§III–VII](https://arxiv.org/html/2605.07370v1)

## 论文要解决的问题

视线外告警可以提前刹车，错误告警也能让车反复停车。论文同时处理“什么时候重规划”和“是否接受这次触发”，并显式选择跟踪、安全、响应和平顺性的折中点。

## 方法和系统设计

### 在线数据流与离线选择

时间窗口同步 LiDAR、雷达、相机及 CAM/DENM；融合器把目标、事件、静态地图写入自车坐标 LDM。目标存在概率由传感器似然、身份认证消息和声誉权重组合，但具体贝叶斯更新及关联实现未给出。路线危险、TTC 风险或地图版本变化触发 Hybrid-A*；Pure Pursuit 与 PID 执行路径。地图更新在 tick 边界激活。

这里没有端到端训练。离线搜索前视距离及 PID 增益等配置，在线固定选定配置，只在接受事件后重新搜索路径。§III-C 式 5–7 可压缩为：

$$
\widetilde J_i=\frac{J_i-J_i^{\min}}{J_i^{\max}-J_i^{\min}},\qquad
\theta^*\in\arg\min_{\theta\in\mathcal P,\ C(\theta)=0}\|\widetilde{\mathbf J}(\theta)\|_2.
$$

$\mathcal P$ 是已评估配置的非支配集，$C$ 为碰撞数；目标涉及横向 RMSE、TTC 缺口、事件响应时间和控制方差。正文还列能量代理项，但结果超体积仅使用跟踪、安全、平顺三个目标。距离理想点最近是作者采用的选择规则，不能等同于唯一数学“膝点”。

### 接受门的覆盖条件

§III-D 式 8 接受事件 $E$ 的条件为：

$$
\sum_{i\in\mathcal M_t(E)}w_i\geq\Theta
\quad\land\quad\mathcal L_{\mathrm{sensor}}(E)\geq\eta.
$$

$\mathcal M_t(E)$ 只计时空窗口内不同已认证来源；均匀权重下阈值取 $2f+1$，$f$ 是假定故障站数。第二项要求自车传感器支持事件。因此 S4 的真实危险刻意设置为自车可见且有足够诚实报告；该结果不能覆盖完全遮挡、无法满足传感器门槛的危险。

### 原始方法对照

[Deb 等的 NSGA-II，2002，§II-B](https://homes.cs.washington.edu/~sagarwal/nsga2j.pdf) 用非支配等级与拥挤距离保留分布多样性；MORPH-U 对预先网格搜索的配置筛选并选一个工作点，没有展示同等预算的进化搜索优势。[Lamport 等，1982，§3–4](https://lamport.azurewebsites.net/pubs/byz.pdf) 则定义一致性要求和递归消息／签名转发协议；这里的本地计票加传感器门不实现那些协议，$2f+1$ 不能单独构成容错证明。

## 关键图与可视化结果

![原文 Fig. 2：MORPH-U 闭环架构](https://arxiv.org/html/2605.07370v1/assets/Fig_2.png)

虚线表示离线配置，实线表示运行时数据流；V2X 和地图更新分别经过检查后进入规划链。

![原文 Fig. 1(a)：多车交叉口仿真设置](https://arxiv.org/html/2605.07370v1/assets/multivehiclefleet.png)

这是 S2/S4 的场景截图，不是鲁棒性结果图；原图另有单车子图用于 S1/S3。

## 实验结论与证据

### 固定场景内的对照

以下为原文表 III、V，均为 30 次情节口径；表 III 明确为 30 seeds 的均值±标准差，表 V 完成率的±未单独定义。

| 场景与配置 | 横向 RMSE，m ↓ | 最小 TTC，s ↑ | 碰撞情节数 ↓ | 完成率，% ↑ |
| --- | --- | --- | --- | --- |
| S2，仅传感器 | 0.42 ± 0.05 | 1.30 ± 0.21 | 5/30 | 未列 |
| S2，加 V2X | 0.35 ± 0.04 | 1.90 ± 0.18 | 0/30 | 未列 |
| S4，不过滤 V2X | 未列 | 未列 | 0/30 | 0.0 ± 0.0 |
| S4，Quorum Filter | 未列 | 未列 | 0/30 | 96.7 ± 2.1 |

S2 横向误差下降 16.7%，TTC 增加 0.60 s。S4 设置 10 站、3 个错误来源、饱和注入；不过滤也零碰撞，却完全不完成任务，说明仅报安全率会掩盖停车失效。表 V 过滤后误接受、漏接受均为 0/30，仅覆盖该注入与可见真危险条件。

### 代价与消融限度

表 IV 明确按 30 seeds 报告均值±标准差；地图更新使 S3 完成率由 72.4% 到 96.7%；激活耗时 1.1 ± 0.2 s，从下载完成到发出重规划计时，重规划 38 ± 6 ms。S2 的 140 ± 25 ms 是事件到首次减速／转向，不能当无线链路延迟。

60 组配置在 S1/S2 各评估 30 seeds；三目标超体积报告 0.42→0.58，参考点为 (1.1,1.1,1.1)。归一化范围是否跨消融共同固定、配置网格与 CPU 型号未明确，无法据此重算前沿或确认实时余量。表 II 的 S4 规划成功率 83.3% 与表 V 完成率 96.7% 口径不同但未充分解释，不合并为一个成功率。[§V–VI，表 II–V](https://arxiv.org/html/2605.07370v1#S5)

## 应用场景与启发

有用的设计是把消息接受、触发决定、路径搜索和控制输出分别记录：这能区分“感知变好了”和“无效触发减少了”。以上是报告分析，论文尚未证明整合栈优于专门的现代协同规划器。待验证假设：传感器 veto 对自车可见性敏感，可能在排斥虚假消息时也抵消 V2X 对真实遮挡危险的补充价值。

## 局限与阅读风险

固定全文无附录；CARLA 版本、时间步数值、关键门限和完整网络分布未充分报告。未见硬件或真实道路验证，也没有消息数量／字节开销。标题中的高不确定性不能扩展成任意时序错误保证。正文未链接实现，当前限定 GitHub 检索未确认作者代码、场景、配置或权重发布；经典规划控制本身不依赖学习权重。

## 后续跟进

### 先恢复可核验配置

先取得 60 组参数、30 seeds、原始时间戳日志与 CARLA 版本，复算表 III 并解释表 II/V 分母；这是前置检查。最小假设实验固定真实危险轨迹、7 个诚实消息来源、相同其他来源与网络时序，做“自车可见/被遮挡”×“传感器 veto 开/关”的四组配对，quorum 与其余控制器参数保持不变。记录真实危险接受率、首次响应时间、碰撞及任务完成；危险真值只用于评测。若遮挡时 veto 明显增加真危险漏拒并延迟响应，支持该可见性限制；若四组无对应差异则不支持。若所谓收益以可见条件下更多误接受或碰撞换得，不推广关闭 veto。资源缺失时停止性能复现，不填补结果。本次未运行仿真。
