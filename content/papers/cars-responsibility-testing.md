---
{
  "id": "cars-responsibility-testing",
  "tag": "autonomous-driving-testing",
  "tags": ["autonomous-driving-testing", "autonomous-driving-security"],
  "title": "Learning Responsibility-Attributed Adversarial Scenarios for Testing Autonomous Vehicles",
  "source": "arXiv:2605.13751 / https://arxiv.org/abs/2605.13751",
  "authors": ["Yizhuo Xiao", "Haotian Yan", "Ying Wang", "Zhongpan Zhu", "Yuxin Zhang", "Xintao Yan", "Mustafa Suphi Erden", "Cheng Wang"],
  "affiliations": ["作者单位见论文 PDF"],
  "comment": "CARS 把自动驾驶测试从发现碰撞推进到责任归因：测试用例不仅要危险，还要能判断失败是否来自 ADS 可避免缺陷。"
}
---

## 一句话定位

CARS 是一篇自动驾驶测试和安全关键场景生成论文。它的核心新意是把 responsibility attribution 直接纳入 adversarial scenario generation，让闭环仿真生成的碰撞场景既物理可行，又能区分 ADS 可避免缺陷和不可避免交通冲突。

## 论文要解决的问题

很多 adversarial simulation 方法能高效找到碰撞，但碰撞本身不等于有用测试证据。如果对方车辆行为不合理，或者冲突本身不可避免，测试只能证明场景危险，不能证明 ADS 有可修复问题。CARS 的问题是：如何生成既能触发失败、又能按规范驾驶责任模型归因的测试场景，从而让 ADS validation 产生可解释、可监管对齐的安全证据。

## 方法和系统设计

- Context-aware adversary selection 根据场景上下文选择合适的对手交通参与者，避免无意义或不现实攻击。
- Generative adversarial policy 在闭环仿真中优化，生成可导致碰撞的交互行为。
- Responsibility attribution 与场景生成过程耦合，使用 regulation-prescribed careful and competent driver models 判断失败责任。

## 关键图与可视化结果

![图 1：CARS 的问题定义，区分普通碰撞发现和带责任归因的安全测试证据](https://arxiv.org/html/2605.13751v1/nc_images/problem.png)

这张图清楚说明新增“自动驾驶测试”方向为什么必要：测试不是把系统撞坏就结束，而是要回答事故是否源于 ADS 可避免缺陷。

![图 2：CARS 方法流程，展示上下文对手选择、生成式对抗策略和责任归因的耦合](https://arxiv.org/html/2605.13751v1/nc_images/methodology.png)

这张图是论文最值得复用的框架：scenario generation、closed-loop simulation 和 responsibility model 不应是三段互不相干的后处理，而应共同定义测试目标。

## 实验结论与证据

论文在覆盖多种国家交通环境的 benchmark 数据集上评估，并报告 CARS 能持续发现 physically feasible collision scenarios，同时保持较高 attribution rates，并在多个 regulation-prescribed careful and competent driver models 下验证。证据主线是：自动驾驶测试应该从“发现碰撞”升级到“构造可解释、可归责、可监管对齐的失败证据”。

## 应用场景与启发

- 应用场景：ADS 仿真测试、安全关键场景生成、事故责任分析、闭环安全回归和监管证据包构建。
- 方法启发：场景生成目标函数要同时包含 criticality、feasibility、behavioral realism 和 responsibility attribution。
- 讨论问题：责任归因模型应采用交通法规、RSS/ISO 类模型、人类驾驶数据，还是多模型交叉一致性。

## 局限与阅读风险

责任归因高度依赖法规模型和场景抽象。不同国家、不同道路类型、不同 ADS ODD 下，careful and competent driver model 可能不一致。另一个风险是生成场景为了归责而变窄，遗漏不可归责但工程上仍危险的 corner cases。

## 后续跟进

- 详细记录论文使用的责任模型、数据集、仿真环境和 adversarial policy 训练细节。
- 和 Dynasto、SaFeR、Drivora 对比，整理自动驾驶测试方向的四个维度：场景有效性、行为真实性、闭环可重复性和责任归因。
- 将 CARS 作为新增测试方向的首篇核心报告，后续补充闭环协同 benchmark 和搜索式测试基础设施。
