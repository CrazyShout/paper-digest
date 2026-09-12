---
{
  "id": "commonroad-game-hitl-simulation",
  "tag": "autonomous-driving-testing",
  "tags": [
    "autonomous-driving-testing",
    "cooperative-autonomous-driving"
  ],
  "title": "CommonRoad-Game: A Human-in-the-Loop Simulation Framework for Autonomous Driving",
  "source": "arXiv:2607.01382 / https://arxiv.org/abs/2607.01382 / Fixed full text: https://arxiv.org/html/2607.01382v1",
  "authors": [
    "Yunfei Bi",
    "Youran Wang"
  ],
  "affiliations": [
    "Technical University of Munich"
  ],
  "comment": "CommonRoad-Game 把人类输入、异步规划和场景录制接入 CommonRoad。它展示更小的时序漂移，但仍有超时、低瞬时实时比与原表口径不一致，不能解释为严格实时或大规模安全验证。"
}
---

## 一句话定位

CommonRoad-Game 把键盘、方向盘/踏板输入接入 CommonRoad 规划生态，既能让人和自动驾驶 planner 交互，也能把过程保存为结构化场景。核心贡献是接口与时序组织，不是新的驾驶学习算法。

- 核心证据：一个同步实验的末端误差由 naive 的 402.38 ms 降至 1.48 ms，但 proposed 仍有 37.7% 步骤超过预算。[表 I](https://arxiv.org/html/2607.01382v1#S4.T1)
- 主要边界：短时示例和局部计时结果不等于严格实时保证，也不是参与者总体行为或安全覆盖的统计研究。

## 论文要解决的问题

### 为什么需要同时对齐空间与时间

人类按照墙钟作出操作，而 planner 按场景时间网格产生轨迹。若规划耗时阻塞仿真，或者不同模块的初始坐标锚点不一致，记录下来的反应距离和交互时序就难以解释。本文输入 CommonRoad 路网、初始状态、人工控制和 planner；输出车辆状态、可视化及可复放 XML 日志。

### 相关工作与差异

| 一手工作 | 已有机制 | 本文的接口选择 |
| --- | --- | --- |
| Cao 等，CARLO/H-ReIL，RSS 2020；[原文 §IV-C](https://iliad.stanford.edu/pdfs/publications/cao2020reinforcement.pdf) | CARLO 以简化二维动力学、车辆状态观测支持控制研究；H-ReIL 在模仿驾驶模式间学习切换 | CommonRoad-Game 借鉴轻量交互，但重点是标准场景交换、日志与同步，不学习模式选择策略 |
| Dosovitskiy 等，CARLA，CoRL 2017；[原文 §2](https://arxiv.org/pdf/1711.03938v1) | Unreal 场景/物理、可配置传感器和客户端控制接口 | 本文专注二维规划与人类输入，不能替代相机/LiDAR 传感器级仿真 |

## 方法和系统设计

### 状态交换与异步规划

初始化时，以模拟器放置的 AV 姿态与 planning problem 声明姿态计算固定刚体变换；人类车辆变为 CommonRoad 动态障碍物，planner 轨迹再变回模拟器参考。主循环更新状态、绘图与记录；独立 worker 处理 planner。单槽 request/result buffer 由 mutex、condition variable 和 busy 标记管理：worker 忙时跳过新触发，主循环继续执行最近轨迹。[§III-A/B](https://arxiv.org/html/2607.01382v1#S3)

### 两组关键时序公式

原式 6–10 的平面坐标变换可简写为：

$$
\Delta\psi=\mathrm{wrap}(\bar\psi_a^0-\psi_a^0),\quad d=\bar p_a^0-R(\Delta\psi)p_a^0,\quad
p^{\mathrm{sc}}=Rp^{\mathrm{sim}}+d.
$$

上横线为 planning problem 初始锚点，$R$ 为平面旋转。它补偿固定初始姿态差，不是每帧重新估计定位，也没有改变米制尺度。

$$
\tau_n^*=t_0+n\Delta t,\quad e_n=(\tau_{n+1}-\tau_n)-\Delta t,\quad E_n=\sum_i e_i,\qquad
N=\max(1,\operatorname{round}(\Delta t_c/\Delta t)),\quad\sigma\leftarrow\sigma+\Delta t/\Delta t_c.
$$

这是原式 11–15 的整理：$\tau$ 为墙钟、$\Delta t$ 为名义仿真步长，$\Delta t_c$ 为 planner 场景步长，$N$ 控制重规划频率，$\sigma$ 是轨迹进度。循环提前完成就等待；落后时跳过可视化；超过阈值时重置时间锚点。因此较小记录误差可能部分来自重置，不能证明一直无延迟。

### 运行模型与训练边界

这里没有训练 loss。HV 用裁剪后的实测墙钟间隔积分运动学模型；AV 在算法 2 中按 $\lfloor\sigma\rfloor$ 读取旧轨迹状态并覆写姿态/速度，新轨迹到达后对齐最近状态。这不是每步对 AV 执行真实动力学控制；worker 解耦也不能消除计划陈旧。CommonRoad drivability checker 监测 HV 碰撞与道路边界，不代表自动保证全系统安全。

评测 nominal step 为 0.01 s，示意图间隔 0.2 s；主要人工交互通过键盘，方向盘能力与多 AV 示例不等于已有大规模用户研究。[§IV](https://arxiv.org/html/2607.01382v1#S4)

## 关键图与可视化结果

![原论文图 7：可视化模块的路网渲染示例](https://arxiv.org/html/2607.01382v1/figures/example_map.png)

这是地图/道路几何的展示，不能单凭图片判断人类反应时、碰撞检测或记录复放精度。

![原论文图 14(a)：proposed 同步的理想与实际时间](https://arxiv.org/html/2607.01382v1/figures/timing_progression.png)

蓝线为理想时间、红线为实际时间，末端约 14,780 对 14,781.5 ms。保留文件只含 proposed 子图；naive 对照在原图 14(b)，不能把此单图描述成两套方法曲线。

## 实验结论与证据

### 交互示例与时间测量

IDM 在示例中对前方切入停车车辆减速停止；Reactive Planner 基于短时恒速/恒航向预测作换道；另有多 AV 交互。它们展示接口可运行，未报告覆盖多个参与者和场景的安全率比较。

| 时间指标（原表 I） | Proposed | Naive |
| --- | ---: | ---: |
| 末端误差 | 1.48 ms | 402.38 ms |
| 平均步误差 | 4.10 ms | 22.84 ms |
| 最大累计误差 | 90.67 ms | 1998.47 ms |
| 超预算步比例 | 37.7% | 56.4% |
| 平均实时比 | 0.99 | 0.84 |
| 最小实时比 | 0.10 | 0.04 |

### 口径矛盾与推断范围

表 I 支持 proposed 在所测运行中偏差更小，但正文称最大累计误差约 200 ms，与表中 90.67 ms 不一致。原文把 time efficiency 定义为总仿真时长/墙钟时长，却为 naive 报 34.36%，同时末端 realtime ratio 为 0.97；按给出的同类定义无法统一。本文保留可追溯数值，不据此重新推出“效率提高多少倍”。

没有分别关闭 pacing、跳帧和 reset 的单因素实验，无法给每个模块分摊收益。未给充分的硬件、负载、重复运行和参与者统计；低瞬时实时比和高超时比例也限制反应时间研究中的解释。

## 应用场景与启发

- 作者主张：把人工驾驶交互保存为标准化 planner 测试资产。
- 我的判断：适合早期接口检查与交互回归，尤其是保留人类输入和规划版本；不适合作为传感器真实性基准。
- 待验证假设：独立记录未重置的全局墙钟偏差和计划年龄，可以发现仅靠局部同步指标遗漏的人机时序失真。

## 局限与阅读风险

反事实复放固定人类日志后，人不再对新 planner 响应，与实时双向交互应分别报告。轨迹覆写、离散索引和旧计划执行也可能影响动作连续性。规划线程非阻塞与确定性日志，不自动保证多线程调度和人工操作可精确重演。

## 后续跟进

### 最小验证与停止条件

- 当前资源（2026-09-12）：[官方仓库](https://github.com/Yunfei-Bi8/CommonRoad-Game)包含控制接口、IDM/Reactive 入口、YAML 配置、scenarios 和时延实验工具；内置示例不依赖学习权重。已查看目录与说明，未安装依赖或验证场景包覆盖全部论文实验。
- 最小实验：固定同一人工日志与地图，在单一 planner 下比较完整同步、仅 pacing、关闭 reset；保持画面分辨率/机器负载一致，记录全局偏差、reset 次数、计划年龄与车辆轨迹。
- 成功信号：局部与未重置全局误差同时受控，轨迹及碰撞结果不随运行调度明显变化。
- 停止条件：只是 reset 让误差归零，或者跳帧改变人工反应；先修正计时口径，不开展用户行为结论。

### 来源与核验记录

固定 arXiv:2607.01382v1；2026-09-12 核对 §III–IV、式 6–16、算法 1–2、表 I、原图 7/14(a)，并阅读 CARLO 与 CARLA 各自的原文。未运行仿真或招募参与者。
