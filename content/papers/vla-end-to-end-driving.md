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

- 基于开源预训练大视觉语言模型 (Large Vision-Language Model) 进行扩展，将其改造为 Vision-Language-Action 模型。
- 核心设计理念是层级对齐 (hierarchical alignment)：将视觉信息和语言数据在不同层次上进行对齐，使模型能够逐步从感知理解过渡到动作决策。
- 模型接收视觉输入（车载摄像头等）和可选的语言指令，直接输出驾驶动作。
- 通过统一的多模态训练框架，将视觉理解、语言推理和动作生成整合在同一个模型中。

## 关键图与可视化结果

论文无 arXiv HTML 版图片，建议直接查看 PDF 获取完整的架构图和可视化结果：

- **论文 PDF**: <https://arxiv.org/pdf/2503.23463>
- **项目主页**: <https://drivevla.github.io/>
- **GitHub 仓库**: <https://github.com/DriveVLA/OpenDriveVLA>

项目主页包含模型架构示意图、驾驶场景可视化以及定性分析结果。

## 实验结论与证据

论文发表于 AAAI 2026（第 13782-13790 页），表明基于大视觉语言模型构建的 VLA 架构在端到端自动驾驶任务上具有可行性。层级对齐策略能够有效地桥接视觉感知与动作生成之间的语义鸿沟。具体定量结果请参阅原文。

## 应用场景与启发

- **应用场景**: 智能座舱中的自然语言驾驶交互（如"在前方路口右转"）、Robo-taxi 场景下的指令理解与执行、个性化驾驶风格定制。
- **方法启发**: 语言可以作为连接人类驾驶意图与底层控制行为的通用接口；在预训练大视觉语言模型的基础上引入动作空间，是一条可行的自动驾驶技术路线。
- **讨论方向**: 如何在 VLA 输出中嵌入安全约束；如何处理语言指令的歧义性和对抗性输入。

## 局限与阅读风险

- 语言指令本身存在歧义性，模型可能对模糊或对抗性指令做出错误理解并执行危险动作，安全性保障是核心挑战。
- 基于大视觉语言模型的架构计算开销较高，实时部署到车载平台的难度需要进一步评估。
- 多模态训练需要大量高质量的视觉-语言-动作配对数据，数据收集和标注成本不可忽视。
- 论文中的实验设置和基线对比需要在复现时仔细审视，确认其结论的泛化性。

## 后续跟进

- 查看 GitHub 仓库 (<https://github.com/DriveVLA/OpenDriveVLA>) 是否已开源模型权重和训练代码。
- 重点关注层级对齐的具体实现细节和训练策略。
- 跟进 VLA 模型与安全约束（如屏蔽层、安全边界）结合的研究方向。
- 对比其他 VLA 自动驾驶方案（如基于强化学习的动作生成），评估不同技术路线的优劣。
