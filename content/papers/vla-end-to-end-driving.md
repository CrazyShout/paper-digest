---
{
  "id": "vla-end-to-end-driving",
  "tag": "end-to-end-autonomous-driving",
  "tags": ["end-to-end-autonomous-driving", "world-models"],
  "title": "OpenDriveVLA: Towards End-to-end Autonomous Driving with Large Vision Language Action Model",
  "source": "AAAI 2026 / https://doi.org/10.1609/aaai.v40i16.38386 / arXiv:2503.23463 / https://arxiv.org/abs/2503.23463",
  "authors": ["Xingcheng Zhou", "Xuyuan Han", "Feng Yang", "Yunpu Ma", "Volker Tresp", "Alois Knoll"],
  "affiliations": ["Technical University of Munich (TUM)", "Ludwig Maximilian University of Munich (LMU Munich)"],
  "comment": "OpenDriveVLA 基于开源大视觉语言模型构建 VLA 模型，通过层级对齐实现视觉、语言和驾驶动作的统一训练，在 AAAI 2026 发表。"
}
---

## 一句话定位

OpenDriveVLA 是一个面向端到端自动驾驶的 Vision-Language-Action (VLA) 模型，基于开源预训练大视觉语言模型构建，通过视觉与语言数据的层级对齐 (hierarchical alignment) 来生成可靠的驾驶动作。

## 论文要解决的问题

传统端到端自动驾驶模型直接从传感器数据映射到控制信号，缺乏对高层语义的理解能力，也无法通过自然语言与人交互。现有方法要么是纯数据驱动的感知-控制管道（无法理解指令），要么需要将指令编码为固定格式（灵活性不足）。论文的核心问题是：能否在一个统一的大模型框架内，同时完成视觉感知、语言理解和驾驶动作生成，从而实现可解释、可交互的端到端自动驾驶。

## 方法和系统设计

- 视觉侧沿用 UniAD 风格的 3D 感知模块：ResNet-101 提取多视图特征，QueryTransformer 产生 agent 与 map token，全局 SceneSampler 补充场景 token，再用独立 MLP 投影到语言空间。
- 层级视觉语言对齐把对象属性与 BEV 坐标、跨相机场景描述、车道线/斑马线/道路边界描述分别绑定到 agent、scene 和 map token，而不是只给整幅图配一句 caption。
- Qwen2.5-Instruct 在驾驶问答、指令跟随、周围车辆运动预测和 ego 轨迹规划上分阶段全参数训练；规划与预测统一输出未来 3 秒、0.5 秒间隔的 6 个 waypoint。
- 输入同时包含结构化环境 token、ego 状态、历史轨迹和高层驾驶命令。该设计让自然语言真正参与动作条件，但仍是自回归开环轨迹生成，不是带安全盾的在线闭环控制器。

## 关键图与可视化结果

![图 1：OpenDriveVLA 从多视图 3D 感知到语言空间和驾驶动作的整体架构](../../assets/papers/vla-end-to-end-driving-figure-1.jpg)

图 1 来自官方 arXiv 源码。读图重点不是“接了一个 LLM”，而是 scene、agent、map 三类视觉 token 先经过不同粒度的语言对齐，再与 ego 状态和驾驶命令共同生成轨迹；这种接口使对象级问答和动作调节共享表征，也引入了自回归延迟和语言捷径风险。

![图 2：同一场景在保持直行与右转命令下的规划和问答可视化](../../assets/papers/vla-end-to-end-driving-figure-2.jpg)

图 2 展示同一交叉口在原始 keep forward 指令与修改后的 turn right 指令下，模型如何改变规划轨迹。它证明模型能响应命令并保持场景条件一致，但只是挑选的定性样例，没有证明模型在冲突、歧义或恶意指令下仍会选择安全动作。

## 实验结论与证据

实验在 nuScenes 开环规划与三个 nuScenes 派生问答集上完成。ST-P3 口径下，3B 与 7B 模型的平均 L2 都为 0.33 m，0.5B 为 0.35 m；7B 的平均碰撞率为 0.10%，并未优于 0.5B 的 0.09%。UniAD 口径下，7B 的平均 L2 为 0.66 m、平均碰撞率为 0.25%，优于表中 GPT-Driver 的 0.84 m/0.44%，但这些数字来自开环轨迹与离线碰撞判定。

消融显示视觉输入、ego 状态、历史轨迹和高层命令都影响轨迹；分阶段训练中，层级对齐与 agent-environment-ego 交互主要降低碰撞指标。训练使用 4 张 H100、batch size 1、约两天，且 Qwen2.5 全参数更新。论文因此证明了结构化视觉 token 与语言动作联合训练在该协议下有效，但没有给出 CARLA/nuPlan 闭环、实车或车载芯片时延证据。

## 应用场景与启发

- **应用场景**: 智能座舱中的自然语言驾驶交互（如"在前方路口右转"）、Robo-taxi 场景下的指令理解与执行、个性化驾驶风格定制。
- **方法启发**: 语言可以作为连接人类驾驶意图与底层控制行为的通用接口；在预训练大视觉语言模型的基础上引入动作空间，是一条可行的自动驾驶技术路线。
- **讨论方向**: 如何在 VLA 输出中嵌入安全约束；如何处理语言指令的歧义性和对抗性输入。

## 局限与阅读风险

- 全部驾驶结果是 nuScenes 开环协议；离线 L2/碰撞代理不能证明交互式交通中的恢复、让行或安全回退。
- 自回归动作生成与全参数 Qwen2.5 带来实时部署压力，论文没有报告端到端车载时延、内存或功耗。
- 语言指令可能与道路规则、环境证据或乘员请求冲突，当前系统没有独立的规则校验器、安全盾或拒答/降级机制。
- 训练数据主要来自同一 nuScenes 生态，且语言标注和场景分布可能泄漏数据集捷径；图 2 的命令改写也不足以证明跨城市、天气和长尾行为泛化。

## 后续跟进

- 查看 GitHub 仓库 (<https://github.com/DriveVLA/OpenDriveVLA>) 是否已开源模型权重和训练代码。
- 重点关注层级对齐的具体实现细节和训练策略。
- 跟进 VLA 模型与安全约束（如屏蔽层、安全边界）结合的研究方向。
- 对比其他 VLA 自动驾驶方案（如基于强化学习的动作生成），评估不同技术路线的优劣。
