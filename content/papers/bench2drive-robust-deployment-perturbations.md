---
{
  "id": "bench2drive-robust-deployment-perturbations",
  "tag": "autonomous-driving-testing",
  "tags": [
    "autonomous-driving-testing",
    "autonomous-driving-security",
    "end-to-end-autonomous-driving"
  ],
  "title": "Bench2Drive-Robust: Benchmarking Closed-Loop Autonomous Driving under Deployment Perturbations",
  "source": "arXiv:2605.18059 / https://arxiv.org/abs/2605.18059 / Fixed full text: https://arxiv.org/html/2605.18059v1",
  "authors": [
    "Zhiyuan Zhang",
    "Zhenghao Jin",
    "Yanlun Peng",
    "Xianda Guo",
    "Haoran Liu",
    "Shaofeng Zhang",
    "Xingjun Ma",
    "Zuxuan Wu",
    "Junchi Yan",
    "Xiaosong Jia",
    "Yu-Gang Jiang"
  ],
  "affiliations": [
    "Institute of Trustworthy Embodied AI (TEAI), Fudan University",
    "Great Wall Motor",
    "School of Computer Science and School of Artificial Intelligence, Shanghai Jiao Tong University",
    "School of Computer Science, Wuhan University",
    "University of Science and Technology of China"
  ],
  "comment": "在相同 220 条闭环路线中冻结被测策略，注入画面冻结、状态误差和动作延迟。高干净分数不能代表部署鲁棒性，但跨模型差异还受输入接口与控制器影响。"
}
---

## 一句话定位

Bench2Drive-Robust 把驾驶鲁棒性落到部署接口：图像可能仍然清晰却已经过时，定位可能独立抖动，正确动作也可能执行太晚。它在同一组闭环路线中冻结策略，分别扰动相机流、自车状态和动作时序，观察误差如何通过车辆运动反馈到下一次决策。

- 核心证据：SimLingo 的干净 Driving Score 为 85.94，固定延迟 100 ms 后为 28.45；TCP-traj 在同条件下却从 59.90 到 60.91，说明不能用一个统一退化系数描述模型。[表 3](https://arxiv.org/html/2605.18059v1#S4.T3)
- 主要边界：测的是具体 checkpoint、输入封装与控制器组合，不能单独归因于网络架构。

## 论文要解决的问题

### 问题与适用范围

开环图像腐蚀能测单帧预测，却不会让错误动作改变后续观测。例如停车场出口中，轨迹本身仍合理，但旧动作在新交通状态下才执行，车辆就可能偏向来车。这里的输入是相机与自车状态，输出是轨迹经原控制器转换后的动作；场景语义保持原 Bench2Drive 设置，不训练新的鲁棒策略。

### 相关工作与差异

| 一手工作 | 已有机制 | 本文改变的环节 |
| --- | --- | --- |
| Jia 等，Bench2Drive，NeurIPS 2024；[原文 v1](https://arxiv.org/html/2406.03877v1) | 220 条短路线分别检验 44 类交互能力，降低长路线评分的耦合 | 沿用路线，增加感知与控制接口的部署扰动 |
| Xie 等，RoboBEV；[扩展原文 v2](https://arxiv.org/html/2405.17426v2)，TPAMI 2025 | BEV 感知中测试图像腐蚀、相机失效与丢帧 | 把画面冻结、定位/速度误差和延迟作用到闭环执行；不把已有传感器失效研究说成空白 |

## 方法和系统设计

### 数据流与扰动定义

观测侧在模型消费输入之前注入误差；动作侧在原策略和控制器产生控制量之后加 FIFO 队列。丢帧不是黑屏，而是持续返回最近有效图像，仿真时间仍前进。遮挡在图像上加矩形掩码，不移动真实障碍物；原文正文称黑色，图 6 称灰色，具体像素实现需随代码版本固定。[§3、附录 B](https://arxiv.org/html/2605.18059v1#S3)

### 三组决定协议的公式

原式 3 用 tick 表示延迟，而配置用毫秒；以 $d$ 明确区分 tick 数，可写为：

$$
a_t=\pi(\widetilde I_t,\widetilde s_t),\qquad a_t^{\mathrm{exec}}=a_{t-d}.
$$

20 Hz 下，100、200、500 ms 分别对应 2、4、10 ticks。主表用固定延迟，图 3 中按墙钟推理时长动态调度的模式只是框架支持项，不能当作主实验硬件实测。

$$
\widetilde g_t=g_t+\epsilon_t,\quad\epsilon_t\sim\mathcal N(0,\sigma_{\mathrm{GPS}}^2I),\qquad
\widetilde v_t=\eta_tv_t,\quad\eta_t\sim\mathcal N(\mu,0.2^2).
$$

原式 4–5 的 GPS 标准差是 5/15 m，每步独立采样，并非累积漂移；速度因子均值为 0.5/0.2，模拟低估而非对称误差。冻结相机持续 1/3 s，遮挡比例为 0.5/0.8。[表 2](https://arxiv.org/html/2605.18059v1#S3.T2)

$$
\mathrm{RD}=1-\frac{\mathrm{DS}_{\mathrm{perturbed}}}{\mathrm{DS}_{\mathrm{clean}}}.
$$

原式 7 的 RD 是相对 Driving Score 下降，0.67 表示约 67%，不是下降 0.67 个百分点；负值表示该次扰动评测分数略升。干净分数非零才可这样归一。

### 训练与评测边界

TCP-traj、UniAD、VAD、SimLingo 使用发布或 Bench2Drive 兼容配置，不做鲁棒微调。路线随机种子控制相同遮挡模式，但各模型相机配置、状态输入和导航封装不同；SimLingo 的 GPS 扰动作用于构造导航 target-point token 的 GNSS 链路，并非直接输入核心模型。因此 GPS 不敏感不等于学会了抗定位噪声。[附录 B.3](https://arxiv.org/html/2605.18059v1#A2.SS3)

## 关键图与可视化结果

![原论文图 1：部署接口故障与闭环评测范围](https://arxiv.org/html/2605.18059v1/x1.png)

先看右侧实际故障，再看左侧插入位置。这是扰动分类示意，图中的 198 ms 不能作为所有模型的运行时统计；已与固定全文的 Teaser 原图逐项核对。

![原论文图 3：立即执行、动态时延与固定 FIFO 延迟](https://arxiv.org/html/2605.18059v1/Figures/Inference_v3.png)

从左到右区分三种时序，主表对应最右模式。它改变动作年龄，未改变策略权重，也没有模拟完整操作系统调度与执行器动力学。

## 实验结论与证据

### 设置与核心对照

CARLA 的 220 路线覆盖 44 类交互，策略行为影响未来观测。DS 综合路线完成与违规惩罚，SR 是成功路线百分比，均越高越好。下表摘录表 3；同模型干净与扰动比较最直接。

| 模型与条件 | DS ↑ | SR（%）↑ | RD ↓ |
| --- | ---: | ---: | ---: |
| SimLingo，干净 | 85.94 | 66.82 | 0.00 |
| SimLingo，100 ms | 28.45 | 2.27 | 0.67 |
| SimLingo，80% 遮挡 | 14.79 | 0.00 | 0.83 |
| TCP-traj，干净 | 59.90 | 30.00 | 0.00 |
| TCP-traj，100 ms | 60.91 | 32.27 | -0.02 |
| TCP-traj，GPS 15 m | 21.12 | 0.45 | 0.65 |
| UniAD，500 ms | 31.85 | 7.73 | 0.30 |
| VAD，500 ms | 23.55 | 2.27 | 0.44 |

### 证据能够解释什么

SimLingo 的 100 ms 条件损失约 67% DS，而 3 s 画面冻结的 DS 仍为 85.82。这支持分轴测试，不能归纳成“所有时序扰动同样危险”。主表没有多次独立评测的区间；小幅负 RD 不能当作扰动有益。效率、舒适度在失败或缩短的行程中可能反向变化，不能替代成功率。本文没有通过控制器交叉替换消融分离网络与执行链路贡献。

## 应用场景与启发

- 作者主张：将部署侧接口不确定性纳入闭环鲁棒性基准。
- 我的判断：适合做同一驾驶栈升级前后的回归测试；跨架构排名需记录实际消费的状态字段。
- 待验证假设：固定策略权重与推理预算后，控制器显式补偿动作执行时刻的自车位姿，可能比原控制器更能承受动作延迟，同时保留干净驾驶表现。

## 局限与阅读风险

独立高斯定位误差、固定延迟和缓存冻结是可控近似，尚未覆盖时序相关偏置、多故障联合发生及真实恢复逻辑。原文未给出足够重复评测来判断较小差值的稳定性。仿真退化不直接给出真实车辆可接受的故障阈值。

## 后续跟进

### 最小验证与停止条件

- 当前资源（2026-09-12）：[官方仓库](https://github.com/Thinklab-SJTU/Bench2Drive-Robust)有 leaderboard、scenario_runner、指标脚本及环境变量配置；使用 CARLA 0.9.15。路线/数据和策略权重沿用 Bench2Drive 与各模型入口，本次未下载权重或验证完整环境。
- 最小实验：固定 TCP-traj 与 SimLingo 的版本、控制器、路线和种子，先取得带时间戳的原始轨迹与待执行动作队列，比较原控制器与补偿控制器：后者仅用当前自车状态和已入队动作外推到执行时刻，再将同一条预测轨迹转换到预计位姿下进行控制；策略权重、单次模型调用与轨迹目标保持相同。在干净、100/200 ms 三档各做相同路线和至少三组配对种子，记录 DS、SR、观测/动作年龄、速度与行程进度。补偿参数只用独立校准路线确定，若无法取得轨迹坐标与时间戳则先补接口。
- 成功信号：延迟补偿在相同推理预算下改善成功率，且不扩大干净条件下的违规。
- 停止条件：收益仅来自降低车速、修改路线或移除难例；先报告这一混杂，不扩大到架构鲁棒性结论。

### 来源与核验记录

固定 arXiv:2605.18059v1（2026-05-18）；核对 §3–4、式 1–7、表 2–4、附录 B 与原图 1、3，另读两篇相关工作自身的原文及官方资源。未执行训练、故障注入或复现实验。
