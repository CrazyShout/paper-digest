---
{
  "id": "momadv2-reliable-temporal-memory",
  "tag": "end-to-end-autonomous-driving",
  "tags": ["end-to-end-autonomous-driving", "world-models"],
  "title": "MomADv2: Reliable Temporal Memory for End-to-End Autonomous Driving",
  "source": "arXiv:2608.23405 / https://arxiv.org/abs/2608.23405 / HTML: https://arxiv.org/html/2608.23405v1",
  "authors": ["Ziying Song", "Shengkai Zhang", "Lin Liu", "Peiliang Wu", "Lei Yang", "Dongyang Xu", "Bin Sun", "Li Wang", "Shaoqing Xu", "Caiyan Jia", "Yadan Luo"],
  "affiliations": ["School of Artificial Intelligence (School of Software), Yanshan University", "Beijing Jiaotong University", "Nanyang Technological University", "Tsinghua University", "China Automotive Technology and Research Center Co., Ltd.", "School of Mechanical Engineering, Beijing Institute of Technology", "University of Macau", "The University of Queensland"],
  "comment": "MomADv2 先过滤与当前命令和轨迹不一致的历史 planning query，再用 flow matching 做有界残差细化；多套基准显示选择性记忆优于盲目融合，但稿件存在配置混写和表内数字不一致。"
}
---

## 一句话定位

MomADv2 进一步回答“历史规划状态应该怎样被继承”：它不是简单缓存更多 query，而是按驾驶命令、时间连续性和轨迹相似度筛掉失效历史，再用 selective state-space model 聚合可靠状态，最后用 flow matching 只修正局部轨迹残差。论文进入本期，因为它同时给出从无历史、naive fusion 到完整选择性记忆的逐级消融，也暴露出更多历史仍会退化和主文数字需要谨慎对齐。

## 论文要解决的问题

长时规划需要跨周期保持意图，否则轨迹会抖动或频繁换模态；但导航命令改变、场景突变或上一周期计划本身有误时，历史 query 会成为错误惯性。把所有历史做 concat、RNN 或 Transformer 聚合，只解决容量问题，没有回答哪条历史还与当前命令和候选轨迹一致。

另一个问题是 anchor-based planner 的长期误差会逐步累积。直接用生成模型重做整条轨迹可能破坏原 planner 的稳定性，因此论文尝试只学习从当前计划到 expert 的有界 residual field，把记忆负责的意图连续性与局部轨迹修正分开。

## 方法和系统设计

- SSM-Q 保存增强前的 planning query、命令相关基准轨迹、驾驶命令与连续性 token，避免把上一次增强结果递归写回记忆造成漂移。
- 历史先经过命令一致性和时间连续性过滤，再做 ego 位移补偿与轨迹级候选匹配；有效性、距离相似度和时间衰减共同决定历史权重。
- selective SSM/Mamba 编码历史状态，经可靠性门和范数约束，以残差形式注入当前 query；不是所有历史都能进入当前规划。
- FM-Ref 冻结原轨迹与 query，在原计划到 expert 的线性路径上学习条件速度场；推理只做两步 Euler 积分，并以有界 gate 控制修正幅度。

## 关键图与可视化结果

![图 1：盲目继承历史造成命令干扰，MomADv2 只保留可靠状态并细化残差](https://arxiv.org/html/2608.23405v1/motivationv13.png)

Figure 1 把论文与普通“加长时序上下文”的差别画得很清楚：历史既是稳定来源也是干扰来源，目标不是保留最多，而是保留与当前意图一致的部分。

![图 2：稀疏场景表示、SSM-Q 过滤与聚合、FM-Ref 轨迹细化的完整流程](https://arxiv.org/html/2608.23405v1/main_mambav4.png)

Figure 2 显示两个模块职责分离。SSM-Q 影响 planning query 和模式选择，FM-Ref 在计划已经形成后做 bounded residual；因此消融必须分别比较二者，而不能把全部增益写成“记忆更好”。

![图 5：MomADv2 与 GuideFlow 在 NAVSIM 多类驾驶场景中的轨迹可视化](https://arxiv.org/html/2608.23405v1/Navsim_vis_flv3.png)

Figure 5 展示 lane geometry、drivable area 和交互场景下更平滑的轨迹，但它是挑选后的定性样例。图像支持局部轨迹形态改善，不足以证明 6 秒实车闭环稳定。

## 实验结论与证据

nuScenes 6 秒 open-loop 中，MomADv2 的平均 L2 为 1.21 m、平均 collision rate 为 0.76%，MomAD 为 1.42 m/0.90%。摘要中的 15.6% 是碰撞率相对下降，不是减少 15.6 个百分点。逐级记忆消融更有信息：无历史 0.92%、naive fusion 1.01%、command-aware 0.89%、连续性过滤 0.83%、轨迹对齐 0.79%、完整 selective memory 0.76%。

NAVSIM v1 baseline PDMS 为 84.0，加入 SSM-Q 为 86.9，再加入 FM-Ref 为 89.9。历史长度 K=1、2、4、6、8 时 PDMS 为 88.2、89.1、89.9、88.5、87.7，说明最优点在 K=4，继续增加历史会退化。v2 `navtest` 为 87.9 EPDMS，`navhard` 为 39.5。

Bench2Drive 必须分配置阅读：带 expert feature distillation 的结果是 Avg.L2 0.77、DS 78.82、SR 46.50%；无蒸馏配置则是 0.76、52.32、24.24%。正文在同一段混用了两组数字，不能把 78.82 DS 与无蒸馏的其他指标拼成一个配置。稿件另有一处 Table 12 与主表的 MomAD 后三秒碰撞数字不一致，当前版本未解释。

## 应用场景与启发

- 应用场景：多周期端到端 planner、query memory、导航命令切换、起步停车和长时轨迹稳定。
- 方法启发：缓存状态应保留生成时的命令、时间、轨迹和置信度，读取时再做一致性审计，而不是只存 feature tensor。
- 世界模型启发：未来不确定性可成为 memory gate 的额外条件，避免仅凭历史轨迹相似度继承已经失效的场景假设。
- 讨论问题：K=4 的收益来自真实时间跨度、更多轨迹模式，还是额外参数与训练预算？应以固定时间、固定状态数和固定计算量分别验证。

## 局限与阅读风险

论文依赖预定义驾驶命令筛选历史，没有显式建模未来场景演化的不确定性。NAVSIM 是 non-reactive/pseudo-closed-loop，Bench2Drive 仍是仿真；没有真实车辆、跨城市域移或传感器失败实验。所有结果为单点值，没有种子方差、置信区间或显著性检验。

FM-Ref 额外引入训练和推理模块，缺少严格匹配参数量、训练步数的替代 refiner 对照。更重要的是，Bench2Drive 配置混写与 Table 12 数字不一致会影响二次引用，报告只能使用可明确映射到表格配置的数字。核验时没有 MomADv2 代码、权重或配置；公开 MomAD 仓库只对应 CVPR 2025 旧版，不能当作本方法实现。AAAI 2027 模板也不是录用证据。

## 后续跟进

- 等代码发布后复现 baseline、SSM-Q、FM-Ref 三步增量，并固定训练预算比较 GRU、Transformer 和 selective SSM。
- 专门构造命令突变、感知突变和错误历史三类反例，测 gate 是否真正拒绝不可靠记忆。
- 为历史状态增加 uncertainty、来源时间和闭环后果标签，检查可靠性筛选能否从轨迹相似度升级为风险一致性。
