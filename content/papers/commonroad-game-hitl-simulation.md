---
{
  "id": "commonroad-game-hitl-simulation",
  "tag": "autonomous-driving-testing",
  "tags": ["autonomous-driving-testing", "cooperative-autonomous-driving"],
  "title": "CommonRoad-Game: A Human-in-the-Loop Simulation Framework for Autonomous Driving",
  "source": "arXiv:2607.01382 / https://arxiv.org/abs/2607.01382",
  "authors": ["Yunfei Bi", "Youran Wang"],
  "affiliations": ["Technical University of Munich"],
  "comment": "CommonRoad-Game 把人类驾驶输入接入 CommonRoad 运动规划生态，适合用于交互式闭环测试和人机混行场景生成。"
}
---

## 一句话定位

CommonRoad-Game 是一篇测试基础设施论文。它关心的问题不是训练一个更强 planner，而是让 planner 在 human-in-the-loop 环境里接受测试：人类驾驶输入可以实时影响仿真，系统再把交互过程记录成 CommonRoad-compatible scenario，用于后续复现、分析和回归测试。

## 论文要解决的问题

自动驾驶规划器经常在离线数据集或固定仿真脚本里评测，但真实交通交互是双向的：人类驾驶员会根据 AV 行为临时调整，而 AV 的小决策也会改变人类反应。传统仿真平台要么缺少实时人类输入接口，要么和 CommonRoad 等规划生态脱节，要么计算负担过重，不适合快速做早期测试。CommonRoad-Game 要补的是交互式测试工具链。

## 方法和系统设计

- 输入接口支持方向盘、踏板、键盘等人类控制方式，用于生成 human-driven vehicle 行为。
- 多线程架构把游戏式实时仿真、CommonRoad 规划器和车辆状态同步起来，避免 wall-clock time 与 simulation time 漂移。
- 系统记录人类驾驶日志，并转换为结构化测试场景，使一次人机交互可以变成可复现的 benchmark case。
- 框架与 CommonRoad motion planner 兼容，方便测试 IDM、Reactive Planner 等不同规划算法。

## 关键图与可视化结果

![图 1：CommonRoad-Game 的地图示例，展示人机交互测试可以落在 CommonRoad 场景结构中](https://arxiv.org/html/2607.01382v1/figures/example_map.png)

这张图说明 CommonRoad-Game 不是孤立小游戏，而是接入 CommonRoad 场景表示。它的价值在于把人类输入产生的交互过程变成后续可分析、可复现的规划问题。

![图 2：系统时间同步过程，比较稳健同步和 naive 同步在实时交互中的差异](https://arxiv.org/html/2607.01382v1/figures/timing_progression.png)

这张图支撑论文的工程主张：human-in-the-loop 测试必须保证仿真时间和真实时间一致，否则人类反应、planner 输出和记录日志会错位，导致测试结论不可复现。

## 实验结论与证据

论文报告 CommonRoad-Game 能稳定同步仿真时间，支持多 agent 交互，并能和 CommonRoad-compatible motion planners 集成生成 interactive driving scenarios。它更像一个研究工具而非单篇算法 SOTA，但对自动驾驶测试有实际价值：可以把人类干预、激进 cut-in、让行博弈等固定数据集难覆盖的交互变成可保存测试样本。

## 应用场景与启发

- 应用场景：运动规划器人机混行测试、交互式场景录制、planner 回归测试、驾驶行为数据采集。
- 方法启发：闭环测试不一定只能靠完全自动 scenario generator，人类输入可以作为发现交互边界的低成本入口。
- 讨论问题：人类参与生成的场景如何做标准化，才能既保留真实交互，又避免测试不可重复。

## 局限与阅读风险

Human-in-the-loop 测试的代表性依赖参与者行为、输入设备和实验协议，不能直接等价于真实道路分布。论文主要展示框架稳定性和接口能力，对大规模安全覆盖率、参与者多样性和真实事故复现能力还没有充分证明。作为 benchmark 使用时，需要额外设计场景采样和统计协议。

## 后续跟进

- 跑通开源代码，确认是否能接入既有 planner 或 CommonRoad 场景。
- 与 TrafficAlign、D-V2S、RiskFlow 对比，区分人机生成、LLM 生成和视频转场景三类测试入口。
- 后续可记录少量人类 cut-in/merge 交互，作为 planner 行为回归集。
