---
{
  "id": "rl-fuzz-testing-agents",
  "tag": "autonomous-driving-testing",
  "tags": ["autonomous-driving-testing"],
  "title": "Evaluating Fuzz Testing for Reinforcement Learning Agents",
  "source": "arXiv:2607.24577 / https://arxiv.org/abs/2607.24577 / Code: https://github.com/RWO-zb/fuzzers",
  "authors": ["Zhibin Kang", "Hanmo You", "Dong Wang", "Haiming Zheng", "Junjie Chen"],
  "affiliations": ["College of Intelligence and Computing, Tianjin University"],
  "comment": "论文在统一预算和有效性判定下比较五种 RL fuzzing 方法与随机测试，覆盖 crash 数量、行为多样性、效率和下游修复价值。自动驾驶证据来自 CARLA 中的 Roach 策略，适合指导测试工具选型，但不能外推为真实车辆验证。"
}
---

## 一句话定位

这不是提出第六种 fuzzer 的论文，而是一项面向 RL 智能体测试的统一实证评估：作者把 MDPFuzz、CureFuzz、G-Model、SeqDivFuzz、QDFuzz 和随机测试放进同一套种子、时间预算、崩溃有效性检查与统计协议，比较“找得多、找得早、找得不同、找到后是否真有用”。它进入本期的价值在于纠正只凭 crash count 宣称方法优越的惯例，并给自动驾驶仿真测试提供了一套可落地的基准框架。

## 论文要解决的问题

RL fuzzing 通过变异初始状态或环境配置，在巨大状态空间中寻找导致智能体失败的输入。现有论文经常选择不同环境、不同策略、不同运行预算和不同 crash oracle，有些不与随机测试比较，也常把数量、覆盖与修复价值混为一谈。结果是单篇论文里的“提升”很难横向复核，复杂方法还可能因模型训练或严格剪枝降低吞吐，反而输给简单随机搜索。

另一个核心问题是测试输入是否有效。在 CARLA 中，一个输入由路线、天气、ego 初态和 NPC 位置等 66 维变量定义；变异后出现碰撞，可能是被测策略缺陷，也可能是场景本身不可完成。论文因此加入差分验证：只有更强的独立验证策略能完成、被测策略却失败的输入，才计为有效 unique crash。这个步骤提高了证据质量，但验证策略本身也不是完美 oracle。

## 方法和系统设计

- **统一比较对象**：五个代表性 fuzzer 分别是基于敏感度与状态密度的 MDPFuzz、结合随机网络蒸馏的 CureFuzz、生成分布外输入的 G-Model、以序列多样性剪枝的 SeqDivFuzz，以及质量-多样性搜索 QDFuzz；Random 作为不可省略的吞吐基线。
- **三档任务与固定预算**：MountainCar 使用 DQN、10,000 个初始种子；BipedalWalker 使用 TQC、1,000 个种子；CARLA 0.9.15 使用 PPO 训练的 Roach 驾驶策略、100 个种子，并变异 66 维配置中的 63 维。每种方法在每个环境运行 12 小时，使用不同随机种子重复 5 次。
- **有效崩溃判定**：MountainCar、BipedalWalker 和 CARLA 分别用 PPO、SAC 与 CaRL 策略做差分验证。只有验证策略成功且被测策略失败时才保留；三种验证策略在随机测试中的失败率分别为 0%、0% 和 2.5%。
- **四维评价**：有效性看有效 unique crash 数量和 crash ratio；多样性分别聚类输入配置与输出轨迹，形成 Input Diversity 和 Output Diversity；效率看累计 unique crash 曲线下面积 UD-AUC 及每个 unique crash 的平均变异代数 AG/UC；实用性再检查 crash 数据能否改进策略鲁棒性、训练跨 fuzzer 的安全监视器。
- **下游闭环**：修复实验把 crash transition 以更高采样权重加入 replay buffer，再用独立 fuzzer 做交叉回归检查，避免只在产生修复数据的同一 fuzzer 上自证有效。

## 关键图与可视化结果

![图 1：RL 智能体通过状态、动作和奖励与环境循环交互，fuzzer 的作用点是环境初始配置](../../assets/papers/rl-fuzz-testing-agents-figure-1.png)

图 1 是论文对被测系统边界的定义：策略接收状态和奖励、输出动作，fuzzer 主要变异进入环境的初始状态或场景参数，再由轨迹和任务 oracle 判断是否崩溃。它提醒读者，本文测试的是固定 RL 策略在环境扰动下的行为，不是训练过程本身，也不是直接向神经网络权重或传感器像素注入攻击。这张结构图不承载性能结论，真正的比较需要结合有效性判定与时间曲线。

![图 2：六种方法在 CARLA 的 12 小时累计 unique crash 发现曲线](../../assets/papers/rl-fuzz-testing-agents-figure-2.png)

图 2 展示不同搜索策略随时间逐步拉开差距：MDPFuzz 的曲线上升最快，QDFuzz 次之，随机测试在复杂场景中落后于引导搜索；SeqDivFuzz 前期增长缓慢、末段出现跳升，说明严格筛选会改变发现节奏。该图适合看“何时找到问题”，但不能单独回答场景是否有效、不同 crash 是否语义重复或结果是否稳定；最终数值应以 5 次重复的均值和相对标准差为准，而不是从单条曲线终点读数。

## 实验结论与证据

三个被测策略按复杂度递增：MountainCar 的 DQN 约 13.4 万参数、随机失败率 1.1%；BipedalWalker 的 TQC 约 69 万参数、失败率 1.6%；CARLA 的 Roach 约 150 万参数、失败率 7.2%。CARLA 输入包含路线、天气、ego 与 NPC 状态，碰撞或 200 步内未到达终点记为失败。所有实验在同一 Ubuntu 20.04 服务器上执行，硬件为 Intel Xeon E5-2660 v4、128 GB RAM 与四张 RTX 2080 Ti。

- 在 CARLA 中，MDPFuzz 平均生成 1,909 个测试输入并找到 291 个有效 unique crash，crash ratio 为 15.19%；Random 生成 2,377 个输入、找到 157 个，ratio 为 6.61%。QDFuzz、G-Model、CureFuzz 和 SeqDivFuzz 分别找到 195、188、140 和 77 个，说明高吞吐并不等于高命中，引导搜索在复杂状态空间更有价值。
- CARLA 结果的波动不能忽略：MDPFuzz 的 unique crash 相对标准差为 55.1%，QDFuzz 为 68.2%，SeqDivFuzz 为 66.9%，而 Random 为 4.5%。因此“MDPFuzz 最多”是五次运行均值上的结论，不是每次都稳定领先；复现实验必须保留随机种子级结果。
- 在较简单任务上，Random 仍很强：MountainCar 找到 5,731 个 unique crash，仅次于 MDPFuzz 的 5,861；BipedalWalker 中 MDPFuzz 为 11,945，Random 为 8,026。复杂方法的训练、生成或剪枝开销会牺牲单位时间测试吞吐，方法排名随任务维度变化。
- 不同 fuzzer 找到的初始种子交集很低，输入多样性与输出轨迹多样性也不总一致。这支持组合多个互补 fuzzer，而不是把某个单一指标冠军当成完整覆盖。
- 策略修复由于 CARLA 重新训练在作者设置下需要一个月以上，主要在 BipedalWalker 做概念验证；QDFuzz 数据带来的自评鲁棒性提升最高，为 41.5%，但部分修复会在其他 fuzzer 或随机测试下产生回归。安全监视器的跨方法准确率约为 93.17%-100%，个别组合的误报率达到 5.16%，因此“可用于监视”仍需同时看误报和跨分布泛化。

## 应用场景与启发

- **应用场景**：自动驾驶策略发布前的 CARLA 压力测试、策略版本回归、长尾场景库构建，以及为安全监视器和修复流程收集失败轨迹。
- **方法启发**：测试平台应把高吞吐发现器与多样性导向方法做成组合策略，例如先用 MDPFuzz 快速扩充失败池，再用 QDFuzz 或行为聚类补足轨迹模式；所有 crash 都应保留有效性、来源 fuzzer、策略版本和复测结果。
- **讨论问题**：能否依据种子特征和早期轨迹，在线预测“这个种子交给哪个 fuzzer 最划算”，同时约束对已有失败簇的重复采样。

## 局限与阅读风险

自动驾驶部分只有 CARLA 0.9.15、一个 Roach 策略和一套 66 维场景参数，没有真实道路、实车控制器、感知噪声、闭环通信栈或商业自动驾驶系统。MountainCar 与 BipedalWalker 的结论也不能直接代表驾驶任务。CARLA 的高相对标准差表明五次重复仍不足以给出很窄的不确定区间。

差分验证优于直接把所有失败都算 crash，但 CaRL 验证策略自身有 2.5% 随机失败率，因此部分可完成场景可能被错误丢弃，验证通过也不等于现实物理可行。“unique crash”由初始种子或轨迹不同来区分，两个数值不同的样本仍可能属于同一安全根因；反过来，聚类指标又依赖 PCA、距离和轮廓系数阈值。下游修复证据集中在 BipedalWalker，论文没有证明 CARLA crash 池能够在可接受成本下修复驾驶策略，也没有评估不同 CARLA/策略版本之间的迁移。

## 后续跟进

- **最小复现**：从官方代码页固定提交版本，先在 CARLA 0.9.15、PCLA/Roach、100 个初始种子和相同 63 维变异空间跑通 Random 与 MDPFuzz 的短时 smoke test；确认场景生成、crash oracle、CaRL 差分验证和去重链路一致后，再扩展到完整 12 小时乘 5 个随机种子。
- 同时输出每次运行的测试数、有效/被拒 crash、unique crash、crash ratio、UD-AUC 与置信区间，避免只复现均值排名；对图 2 的累计曲线标注运行级方差。
- 为每个失败保存可回放配置、策略 checkpoint、模拟器版本、轨迹和验证策略结果，再按安全根因人工审计一小批样本，检查数值去重是否高估问题种类。
- 下游实验先在 BipedalWalker 复现统一 replay buffer、50,000 次离线更新与 cross-fuzzer 回归，再评估是否值得承担 CARLA 级策略重训成本；未经这一环，不应把 crash 数量直接解释为可修复性。
