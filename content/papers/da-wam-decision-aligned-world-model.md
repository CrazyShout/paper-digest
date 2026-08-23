---
{
  "id": "da-wam-decision-aligned-world-model",
  "tag": "world-models",
  "tags": ["world-models", "end-to-end-autonomous-driving"],
  "title": "DA-WAM: Decision-Aligned Future Latents for Driving World Models",
  "source": "arXiv:2608.19085 / https://arxiv.org/abs/2608.19085 / HTML: https://arxiv.org/html/2608.19085 / Repository (release pending): https://github.com/LeapWM/da-wam",
  "authors": ["Ruiguo Zhong", "Benshan Ma", "Xiaolong Chen", "Lang Zhang", "Mingyue Feng", "Yaonong Wang", "Pei Liu", "Jun Ma"],
  "affiliations": ["The Hong Kong University of Science and Technology (Guangzhou)", "Leapmotor", "The Hong Kong University of Science and Technology"],
  "comment": "DA-WAM 为每条候选轨迹预测独立未来 latent，并让该未来直接参与同一候选的因子化评分；在 NAVSIM-v1/v2 达到 93.7 PDMS 和 87.7 EPDMS，重点价值是修复世界模型预测与规划决策之间的接口错配。"
}
---

## 一句话定位

DA-WAM 不把“预测一个看起来合理的未来”当作世界模型服务规划的充分条件，而要求每条候选轨迹都对应自己的未来 latent，并由同一个 scorer 读取当前场景、候选动作和该动作后果。它把世界模型的价值落到候选排序边界，而不是用未来预测做一个与决策松耦合的辅助损失。

## 论文要解决的问题

现有 driving world model 常在预训练阶段学习未来表示，规划阶段冻结或弱耦合；另一类方法虽把预测接到 planner，却让多条候选共享一个未来。前者会让 latent 无法适应具体决策目标，后者则造成 action-consequence mismatch：不同轨迹被同一场景未来评分，模型可能仍主要依赖轨迹几何，而非碰撞、越界和交通规则等候选特定后果。

离线日志只记录 expert 实际执行后的未来，不可能为所有反事实候选提供真值。论文因此必须同时解决“每个候选都有未来”与“只有一条候选有观察监督”的矛盾。

## 方法和系统设计

- 在线视觉编码器由 V-JEPA 2.1 初始化并通过 LoRA 适配，EMA target encoder 从实际未来帧提取稳定 latent，使预测监督在 planner 优化中持续存在。
- proposal module 生成 32 条候选、每条 8 个 future ego pose；predictor 为每条候选预测 0.5 秒后的独立 future latent。
- factorized scorer 联合读取当前 latent、trajectory action 与对应未来，预测可解释 planning factors 和总体 utility。
- 只对 expert-matched candidate 使用观察未来做 JEPA 监督；另检索几何接近 expert、但 NC/DAC/TTC 结果更差的 hard negatives，迫使 scorer 学习安全边界而不是几何近似。

## 关键图与可视化结果

![图 1：从无未来、单轨迹未来、共享未来到候选独立未来的接口对比](https://arxiv.org/html/2608.19085v2/Figures/pipeline_compare.png)

图 1 是论文最关键的概念图：真正的变化不是是否拥有 future feature，而是预测和动作是否一一对应。它也揭示监督空缺：非 expert 候选的未来没有真实观测，因此 action-conditioned latent 的反事实正确性仍需额外验证。

![图 2：相机、BEV 候选轨迹和逐场景规划分数的定性对比](https://arxiv.org/html/2608.19085v2/camera_bev_score_comparison_32.png)

图 2 展示左转、密集交通与让行冲突中，DA-WAM 选择的轨迹避免了基线的 NC/TTC 失败。它支持 candidate ranking 的实际作用，但仍来自 NAVSIM 评价管线，不是可反应交通中的真实闭环 rollout。

## 实验结论与证据

主要评测使用 NAVSIM-v1 navtest 的 12,146 个场景，并在 NAVSIM-v2 扩展指标下复核。DA-WAM 在 v1 达到 93.7 PDMS，其中 NC 99.1、DAC 98.9、EP 90.0；相对最强已列 learned planner DriveSuprim 的 93.5 只高 0.2 分。NAVSIM-v2 达到 87.7 EPDMS，较列出的 DiffusionDriveV2 87.5 同样领先 0.2 分，优势应理解为接近饱和区间的窄幅提升，而非数量级突破。

匹配消融更能支撑机制：无未来 93.31、共享全局未来 92.81、current latent 93.25、action-conditioned future 93.46，加入 hard negative 后为 93.68。候选数从 1、8、16 到 32 时 PDMS 从 87.11、90.76、91.89 到 93.68，64 条不再改善。LoRA+dense objective+EMA target 也优于 frozen/shared 等变体，说明训练时持续对齐和候选专属后果都贡献收益。

## 应用场景与启发

- 应用场景：基于 proposal 的端到端规划、world-action model、候选风险评分和难负样本挖掘。
- 方法启发：评价 world model 时，应问“预测是否改变了候选排序”，而不是只看 latent loss 或生成画质。
- 研究启发：为非 expert 候选引入因果 simulator、occupancy transition 或 conservative uncertainty，避免未监督反事实 latent 被 scorer 过度信任。
- 讨论问题：0.2 分 leaderboard 增益中，多少来自更好的世界建模，多少来自候选数、hard-negative 标签和 scorer 容量？

## 局限与阅读风险

NAVSIM 是基于日志与规则的 non-reactive/pseudo-simulation，不能证明候选轨迹会在真实交互中产生预测 latent 所描述的未来。只有 expert-matched 未来有直接监督，其他候选主要靠共享结构和规划标签约束，因此“每条候选的未来”未被反事实真值验证。公开榜单差距很小，部分对手骨干和训练配方不完全一致；论文也没有给出 candidate-wise future calibration、端到端时延或真实道路闭环。官方 GitHub 当前只有一行 “comming soon” 的 README，尚无实现、配置或权重，不能视为公开代码。

## 后续跟进

- 跟踪官方仓库；待实现、配置和权重实际发布后，再复现共享未来、action-conditioned future 和 hard-negative 三个匹配消融。
- 在带反应参与者的 simulator 中为部分候选生成 paired future，测 latent 距离与实际安全后果是否单调相关。
- 将未来 latent 解码为 occupancy/agent state 或风险因子，检查 scorer 是否真的读取后果而非隐式轨迹 ID。
