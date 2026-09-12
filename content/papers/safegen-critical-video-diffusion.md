---
{
  "id": "safegen-critical-video-diffusion",
  "tag": "autonomous-driving-testing",
  "tags": [
    "autonomous-driving-testing",
    "world-models",
    "autonomous-driving-security"
  ],
  "title": "SafeGen: Goal-Conditioned Video Diffusion of Safety-Critical Scenarios for VLM-Based Autonomous Driving",
  "source": "作者标注 ACM Multimedia 2026 / arXiv:2607.19701v1 / https://arxiv.org/abs/2607.19701 / https://github.com/JoFrc/SafeGen",
  "authors": [
    "Jiangfan Liu",
    "Zexuan Cui",
    "Tianyuan Zhang",
    "Zonglei Jing",
    "Zonghao Ying",
    "Yaoyuan Zhang",
    "Jiakai Wang",
    "Xiaoqi Jiang",
    "Aishan Liu",
    "Xianglong Liu"
  ],
  "affiliations": [
    "Beihang University",
    "Zhongguancun Laboratory",
    "Chery Automobile Co., Ltd."
  ],
  "comment": "SafeGen 用危险末帧条件生成驾驶风险视频并测试 VLM 问答；JOS 不是闭环事故率，真实 VQA 平均提升为 15.9 个百分点。"
}
---

## 一句话定位

SafeGen 将正常驾驶视频的末帧改为行人冲突，再用首末帧条件扩散补全过程，用于检查驾驶 VLM 的文字理解与应对建议。实验发现更高的问答失败分数，但视频不会随被测模型动作改变，不能据此计量真实闭环碰撞率。

## 论文要解决的问题

自然日志中的危险行人交互稀少，普通视频预测又倾向生成常见、平稳的未来。作者提出先明确想测试的危险终态，再生成通向终态的视频：例如从施工区域突然穿出的行人，而非等待随机生成偶然出现风险。这样便于针对视觉与语言推理的盲点构造题目，但也把“危险必然发生”的条件预先放入了测试数据。

## 方法和系统设计

### 从语义终态到几何插入

固定 [arXiv v1 §3](https://arxiv.org/html/2607.19701v1#S3)先用 DepthAnythingV3、MobileSAM 提供深度和分割提示，Qwen3-VL-32B 读取正常视频，选择关键末帧，给出事件过程、VRU 外观和插入区域。Stable Diffusion 3.5 生成前景人物，再以相机内参调整尺度、多轮 inpainting 融合光照与边缘。

原式 3.2–3.3 可写为：

$$
P_{adv}=\arg\min_{P\in\Phi_{pos}\cap\mathcal M_{ground}}\frac{D_{\hat T}(P)}{v_{ego}},\qquad
\hat{\mathcal V}=f_{vd}(I_0,\hat I_{\hat T}\mid\Phi_{sce}).
$$

$D_{\hat T}$ 是末帧深度，$v_{ego}$ 是自车速度；地面候选区由低深度方差筛选。这个深度除速度的量是威胁代理：只有距离为米、速度为米/秒且运动方向适用时才有秒的意义，不能直接覆盖横穿行人、相对速度或自车转向下的真实 TTC；零速度处理也未交代。Wan2.1-FLF2V 根据正常首帧、插入后的危险末帧及事件文本生成中间帧，边界一致不等于动力学证明。

### 评价的是回答，不是已执行动作

[§4.1](https://arxiv.org/html/2607.19701v1#S4.SS1)给出 JOS：

$$
JOS=0.2(10-PA)+0.3AE+0.5(10-PC).
$$

PA 表示感知对齐、AE 表示意图预判错误、PC 表示规划建议合规；JOS 越高表示被测问答模型越差。高容量 VLM 担任裁判，不能把 PC 当成车端执行成功率。主文没有充分给出裁判身份、完整提示和标定依据，引用的 Appendix 也未包含在核查到的固定源包中。

### 与相关工作的区别

| 自身一手来源 | 原方法实际机制 | SafeGen 的变化与比较限制 |
| --- | --- | --- |
| [AdvSim，CVPR 2021 §3](https://openaccess.thecvf.com/content/CVPR2021/papers/Wang_AdvSim_Generating_Safety-Critical_Scenarios_for_Self-Driving_Vehicles_CVPR_2021_paper.pdf) | 约束车辆运动扰动，重建受影响的 LiDAR 回波与遮挡，再查询完整自主驾驶栈 | SafeGen 直接合成 RGB 风险视频；本文将基线改成行人冲突并固定自车重放，不能把该结果当原始 AdvSim 设置的复现 |
| [ScenGE v1 §3.2–3.4](https://arxiv.org/html/2508.14527v1) | 检索交通知识生成 Scenic 元场景，再选择背景协作者、优化轨迹并在模拟器中重放 | SafeGen 将显式模拟轨迹换成首末帧视频生成，增强外观灵活性，同时失去显式动作反馈接口 |

## 关键图与可视化结果

![原论文 Figure 2：终态推理、人物插入与首末帧条件生成](../../assets/papers/safegen-critical-video-diffusion-figure-1.png)

上半部产生三类文本规格，下半部处理人物资产与插入位置，再连接视频扩散。图中的控制链止于生成视频，没有被测驾驶动作回流到生成器的路径。

![原论文 Figure 3：不同交通方向、雨天和施工区域的生成帧](../../assets/papers/safegen-critical-video-diffusion-figure-2.png)

这些序列展示外观与背景适配的例子。五帧快照不能单独证明整段 81 帧不存在漂移、穿透或突变，也没有展示驾驶策略改变动作后的反事实视频。

## 实验结论与证据

### 850 个场景的问答压力测试

每方法生成 850 个场景，来自 nuScenes，统一为 1280×720、10 FPS、81 帧。四类基线都在固定原始自车轨迹的开环设置下生成威胁视频，被测对象为 Dolphins、DriveLMM-o1、EM-VLM4AD 三种 QA 模型。

| 固定主文证据 | 数字与口径 | 可支持的结论 |
| --- | --- | --- |
| Table 1，JOS | SafeGen：9.03 / 7.96 / 9.61；各模型最强基线：7.59 / 7.41 / 9.32 | 在作者裁判下暴露更多问答问题，不是实车事故增幅 |
| 摘要“平均提高 24.25%” | 按表中三模型×四基线的合并均分计算约 24.24%，差异可来自舍入 | 该分母是基线总体均值，不能称为平均胜过各模型最强基线 24.25% |
| Table 2，Dolphins 微调后的真实 VRU-Accident VQA | 原因/预防/类型：29.1→46.7、43.6→55.5、43.8→61.8；平均 38.8→54.7 | 平均增加 15.9 个百分点，约相对增加 41%；原表下降箭头与准确率改善方向不一致 |
| §4.5 人评 | 30 名持照驾驶者；每人 10 段危险、40 段正常片段；5 分制威胁与现实感评分 | 支持主观可感知的风险与外观评价，未报告人类闭环避碰成功率 |

### 消融与物理指标的限度

Figure 5 比较危险首帧 F2V、危险首帧到正常末帧 FLF2V、正常首帧到危险末帧 FLF2V；末者 JOS 更高，但这些组的危险出现时刻和结束结果同时变化，不能把全部差异归因于扩散机制。Figure 4 报告 TTC 多在 0.5 秒以下、DRAC 约 15–20 米/秒平方；这也提示部分片段可能没有可执行的规避余量。FID/FVD 的分布距离不能认证物理可解性，原文未充分提供其参考集与逐场景计算细节。

## 应用场景与启发

### 报告分析与待验证假设

SafeGen 可用于构造“看见了什么、如何判断风险、会建议什么”的视觉问答回归集。Dolphins 的真实视频 VQA 提升提供了迁移线索，但训练数据由同一 JOS 裁判标注，尚缺相同 QA 数量的非危险数据对照。待验证假设是：危险终态内容本身，而不只是额外问答训练，贡献了迁移收益。

## 局限与阅读风险

生成器描述的是目标事件，不是自然发生概率；紧急程度极高还可能混淆“模型不会判断”和“本来就来不及”。微调的学习率、更新次数、QA 样本数及筛选细节在可读主文中不足。作者论文与仓库标注 ACM MM 2026，本次固定内容以 arXiv v1 为准，未取得可独立核对的正式论文页。

## 后续跟进

### 资源与同预算训练对照

截至 2026-09-12，[作者仓库 commit 47bc89d](https://github.com/JoFrc/SafeGen/tree/47bc89d875f0fdadb2138d0d65bca4418657bdaa)仅含 README、LICENSE 与 .gitignore，尚不能从中取得代码、850 个视频、微调权重或裁判配置；固定 arXiv 源包也没有所引补充材料。本次未生成风险视频或训练模型。

最小检验固定 Dolphins 起点，设置正常视频 QA、SafeGen 危险终态 QA、同源正常终态合成 QA 三组；每组相同 850 段来源、相同有效 QA 数和 token 数、相同优化器及 1,000 次更新、3 个训练种子。生成与筛选次数也设相同上限，不因失败补采额外预算。在完全留出的 VRU-Accident 上用人工参考答案和独立裁判双评，报告三类准确率及正常场景退化。缺少生成/标注配置则停止复现性主张；若危险组相对两种对照的配对区间含零，或收益只出现在同一裁判评分中，停止“终态风险带来迁移”的结论。
