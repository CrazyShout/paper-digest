---
{
  "id": "mdrive-closed-loop-cooperative-driving",
  "tag": "cooperative-autonomous-driving",
  "tags": [
    "cooperative-autonomous-driving",
    "end-to-end-autonomous-driving",
    "autonomous-driving-testing",
    "agentic-driving"
  ],
  "title": "MDrive: Benchmarking Closed-Loop Cooperative Driving for End-to-End Multi-agent Systems",
  "source": "arXiv:2605.10904 / https://arxiv.org/abs/2605.10904",
  "authors": [
    "Marco Coscoy",
    "Zewei Zhou",
    "Seth Z. Zhao",
    "Henry Wei",
    "Angela Magtoto",
    "Johnson Liu",
    "Rui Song",
    "Walter Zimmer",
    "Zhiyu Huang",
    "Chen Tang",
    "Bolei Zhou",
    "Jiaqi Ma"
  ],
  "affiliations": [
    "University of California, Los Angeles"
  ],
  "comment": "MDrive 把 V2X 协同驾驶评测推进到闭环 multi-agent benchmark，重点检验感知共享和协商机制是否真的转化为规划收益。"
}
---

## 一句话定位

MDrive 用 225 个 CARLA 闭环场景比较感知共享与车辆协商。其价值是显示协同收益随交互场景改变；主表并非只改变通信方式的消融，也不是实车安全验证。依据 [v1 正文与附录 A–I](https://arxiv.org/html/2605.10904v1)。

## 论文要解决的问题

### 为什么需要另一层评测

检测 AP 或日志轨迹误差看不到车辆执行错误后的连锁反应。[CoDriving/V2Xverse，Hu 等，2024，§III–IV](https://arxiv.org/html/2404.09496v2#S4) 已有闭环平台，并根据规划 waypoint 与检测置信度选择共享 BEV 区域。[CoLMDriver，Liu 等，2025，§4.2](https://arxiv.org/html/2503.08683v1#S4.SS2) 则按潜在冲突分组，以 LLM 对话、共识/安全/效率反馈决定意图，再交给低层规划器；其 actor–critic 是上下文协商机制，不是在线梯度强化学习。

MDrive 扩展的是场景覆盖与跨系统诊断，不能把已有闭环或协商机制归为本文新算法。

## 方法和系统设计

### 场景如何成为可执行闭环

三类场景分别为：46 个原 InterDrive 场景，无背景参与者；112 个 Interaction 场景，其中 100 个由十类生成管线产生，另有 12 个 NHTSA pre-crash 场景；67 个 V2XPnP 日志转仿真场景，平均有 83.88 个背景 actor。

生成管线让语言模型提出结构化描述，再匹配地图、布置车辆/路障、生成路线，经规则校验、去重和人工筛选后导出。Real2Sim 对齐日志与数字孪生坐标，并将轨迹贴合 CARLA 车道；输入仍是模拟传感器，不是原始真实图像。CAV 和背景交通按策略反应式执行，人工接管工具用同一油门、制动和转向接口采集参考。

### 评估协议与计算时序

原文附录 B.4 定义：

$$
DS=RC\times IP,\qquad SR=\frac{N_{\mathrm{full\ score}}}{N_{\mathrm{tasks}}}\times100\%.
$$

$RC$ 为完成路线百分比，$IP$ 为违规惩罚因子，$SR$ 是获得完整驾驶分数的任务比例。Figure 4 使用 DS 与 SR 的调和平均，不能把雷达图直接当 DS。任务到多辆 CAV 的完整聚合细节仍需实现核对。

CARLA 0.9.12、L40S、20 Hz 仿真；附录称基线读过去五帧，开放环评估未来三秒。这是基准评测，没有统一新增训练损失。各模型保留自身传感器/控制器：CoDriving 四相机 1600×900、速度上限 5 m/s；CoLMDriver 四相机 3000×1500、上限 8 m/s。因此跨系统差值同时包含模型、分辨率、速度和训练数据差异。

## 关键图与可视化结果

![原文 Figure 1：三类场景与工具箱](../../assets/papers/mdrive-teaser.png)

已核对 [Figure 1](https://arxiv.org/html/2605.10904v1#S0.F1)：左侧区分静态日志与闭环，右侧展示 Real2Sim、生成和人工接管。图中 Intersection 与正文 Interaction 命名不同，应按场景清单定位。

![原文 Figure 4：按交互类别分解表现](../../assets/papers/mdrive-benchmark-across-categories.png)

已核对 [Figure 4](https://arxiv.org/html/2605.10904v1#S4.F4)：半径是 DS/SR 调和平均，三种颜色对应单车、共享、协商。静态避障与动态场景差异明显，但雷达图不是协作机制的单因素因果检验。

## 实验结论与证据

### 主表体现场景依赖

Table 3，DS/SR 均越高越好，下列每格依次为 DS / SR(%)。

| 模型 | InterDrive | Interaction | V2XPnP |
| --- | ---: | ---: | ---: |
| TCP | 83.55 / 67.80 | 75.80 / 55.25 | 71.02 / 58.70 |
| CoDriving | 83.99 / 66.10 | 79.06 / 70.53 | 84.97 / 82.84 |
| CoLMDriver | 85.29 / 76.85 | 67.91 / 51.93 | 78.27 / 75.37 |

协商在无背景 InterDrive 较强，复杂 Interaction 下却低于 TCP；不能概括成协同必胜。原表 Avg 数字吻合三类桶的等权平均，例如 CoDriving DS 为 82.67；图注却称所有场景平均。由于桶大小不同，未核对聚合代码前不将其解释成 225 场景等权均值。

### 匹配子集的扰动实验

附录 Table S4 固定 21 个 V2XPnP 场景，加入六 tick 即 300 ms 通信延迟，并同时计入模型实际推理等待，期间复用旧控制。CoDriving DS 92.85→84.59，CoLMDriver 79.43→78.76；不是仅测链路延迟，也不是全 225 场景成绩。Table S5 的位置/旋转高斯误差标准差为 0.6 m/0.6°，CoLMDriver SR 71.43→57.14%，显示几何对齐影响协商。

开放环—闭环相关图比较九个规划系统，其中部分仅替换感知再接规则规划器，不能把系统间相关性当作“提高检测本身没有价值”的证明。人类对照只有三名持驾照学生，且练习/记录持续到十次连续成功，不能外推为一般专家驾驶上限。没有完整种子区间或统一成本表。

## 应用场景与启发

作者主张以闭环检验协作价值。本报告建议优先使用同一系统的通信关闭/开启对照，再按背景密度分组；待验证假设是协商失败来自消息与执行不同步，而不仅是语言模型的理解能力。

## 局限与阅读风险

日志转场景依赖车道贴合、资产替换和反应策略，保留几何不等于保留真实行为分布。统一地图天气不能消除不同相机、控制器和训练集的混杂；不能直接采用作者“所有其他因素固定”的强解释。

## 后续跟进

### 当前资源与有界验证

截至 2026-09-12，[官方仓库](https://github.com/ucla-mobility/MDriveBench) 的 `9e08377042b8f2e2860bb00de2416b3ebcfa3be4` 含场景目录、工具箱、模型环境和评估脚本；代码、场景及配置均已见到。模型权重链接外部 HF/Google Drive，本次未下载、核对所有 checkpoint 或验证 225 场景映射，未运行仿真。

先取得含协商模块的 CoLMDriver checkpoint，在单 L40S 或实测可承载的 GPU 上固定 21 场景、同一权重、提示、相机和速度上限，比较同步、仅消息延迟、仅推理等待三种条件；各条件再配对开关时间戳检查与过期协商拒绝，模型调用和通信预算相同。记录协商达成时与执行时的状态差、消息年龄、旧控制持续时间和逐 CAV DS/SR。CoDriving 可作非协商参照，但不能单独验证协商假设。只有时序修复减少对应协商失败并保留正常完成率，才支持该解释；若收益仅来自降速或汇总权重，或状态不同步程度与失败无关，就收窄结论。
