---
{
  "id": "safer-safety-scenario",
  "tag": "autonomous-driving-testing",
  "tags": ["autonomous-driving-testing"],
  "title": "SaFeR: Safety-Critical Scenario Generation for Autonomous Driving Test via Feasibility-Constrained Token Resampling",
  "source": "arXiv:2603.04071 / https://arxiv.org/abs/2603.04071",
  "authors": ["Jinlong Cui", "Fenghua Liang", "Guo Yang", "Chengcheng Tang", "Jianxun Cui"],
  "affiliations": ["School of Traffic and Transportation, Harbin Institute of Technology", "Chongqing Research Institute of Harbin Institute of Technology", "Chongqing Changan Automobile Co., Ltd."],
  "comment": "SaFeR 提出用 token resampling 方法生成符合物理约束的安全关键场景，解决了现有方法生成的场景不可执行的问题，是场景生成领域的约束满足型方法代表作。"
}
---

## 一句话定位

SaFeR 将交通场景生成建模为离散 next token prediction 问题，通过可行性约束的 token 重采样策略，在对抗性、物理可行性和行为真实性三个目标之间取得统一平衡。

## 论文要解决的问题

自动驾驶安全测试需要生成同时满足三个冲突目标的场景：（1）对抗性 -- 能有效触发碰撞风险；（2）物理可行性 -- 碰撞在理论上可被 ego 车辆规避，而非不可避免的；（3）行为真实性 -- 对抗车辆行为符合自然驾驶分布。现有方法往往顾此失彼：无约束的对抗优化产生不可避免碰撞，而过于保守的约束则削弱对抗强度。

## 方法和系统设计

- **离散 token 建模**：将连续动作空间（加速度、横摆角速度）离散化为 63x63 的 motion token 词表，场景生成即 next token prediction。
- **Realism Prior**：基于 Transformer 的生成模型学习自然驾驶分布 P_theta。核心设计是 Multi-Head Differential Attention（MDA），将交互分解为时序、车-车、车-地图三个模块，利用成对 softmax 相减的机制动态消除注意力噪声。
- **Largest Feasible Region（LFR）约束**：基于 Hamilton-Jacobi 可达性分析定义最大可行区域，即 ego 车辆在最优控制下仍可避免碰撞的状态集合。通过 offline RL（expectile regression）近似可行值函数 V_h，避免在线蒙特卡洛估计。
- **两阶段 Token 重采样**：Stage 1 构建 trust region，取 realism prior 概率最高的 top-n token 候选集；Stage 2 在候选集内按 LFR 引导的对抗损失选择 token -- 当 ego 处于可行区域内时最小化车距以增加危险度，当 ego 进入不可行区域时切换为可行性恢复目标。

## 关键图与可视化结果

![图 1：SaFeR 框架总览。展示如何在 realism prior 生成的基础上，受 LFR 约束进行对抗 token 重采样](https://arxiv.org/html/2603.04071v1/x1.png)

图 1 展示了 SaFeR 的核心思路：基于 realism prior 的分布进行重采样，LFR 约束确保生成的对抗场景不超出物理可行边界。

![图 2：SaFeR 流水线。包含 Realism Prior 建模（motion tokenization + differential attention）和 Safety-Critical Token Resampling（trust region + LFR 约束）两个核心组件](https://arxiv.org/html/2603.04071v1/x2.png)

图 2 详细说明了两个核心组件的内部结构，以及 trust region 约束和 LFR 约束如何协同工作。

## 实验结论与证据

- 在 Waymo Open Motion Dataset 和 nuPlan 上进行闭环评估（非 CARLA/SUMO）。
- SaFeR 在 Solution Rate（可解决率）和运动学真实性（VJ、AJ 指标）上显著优于所有 SOTA 基线，同时保持了有竞争力的对抗碰撞率。
- 消融实验表明：移除 LFR 约束导致 SR 大幅下降（碰撞不可规避）；移除 MDA 则同时损害真实性和 SR。
- Realism prior 在 WOMD 和 nuPlan 上的 realism meta metric 均超过 DiffusionPlanner、QCNet、SMART 等基线。

## 应用场景与启发

- **应用场景**：自动驾驶系统闭环安全评估、安全关键测试场景库构建、AD 系统决策能力边界探测。
- **方法启发**：将场景生成建模为离散 token prediction 是一条有效路径；differential attention 机制在密集交通场景中有明确的去噪价值；token 空间操作比连续轨迹优化更灵活可控。
- **讨论问题**：trust region 大小 n 的选择如何影响对抗性与真实性的权衡；LFR 近似精度与 offline RL 数据覆盖度的关系。

## 局限与阅读风险

- LFR 通过 offline RL 近似，其精度依赖于训练数据的覆盖范围（论文使用 300k 交互样本），分布外场景可能不准确。
- 当前仅对 Critical Background Vehicle 进行对抗控制，多车协同对抗的扩展未涉及。
- 运动学自行车模型的简化可能不足以捕捉极端操控下的轮胎动力学。

## 后续跟进

- 关注是否开源代码和预训练模型。
- 复现时关注 trust region 大小 n 与 LFR 超参数（惩罚常数 M、安全距离阈值 d_th）的敏感性分析。
- 跟进将语言模型引入场景生成的文本到场景工作。
