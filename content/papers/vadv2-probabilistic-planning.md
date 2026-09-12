---
{
  "id": "vadv2-probabilistic-planning",
  "tag": "end-to-end-autonomous-driving",
  "tags": [
    "end-to-end-autonomous-driving",
    "dynamic-scene-representation"
  ],
  "title": "VADv2: End-to-End Vectorized Autonomous Driving via Probabilistic Planning",
  "source": "ICLR 2026 / https://openreview.net/forum?id=0a4dA6eUHN / arXiv:2402.13243 / https://arxiv.org/abs/2402.13243 / https://hgao-cv.github.io/VADv2/",
  "authors": [
    "Bo Jiang",
    "Shaoyu Chen",
    "Hao Gao",
    "Bencheng Liao",
    "Qian Zhang",
    "Wenyu Liu",
    "Xinggang Wang"
  ],
  "affiliations": [
    "Huazhong University of Science and Technology",
    "Horizon Robotics"
  ],
  "comment": "VADv2 把端到端驾驶规划从确定性轨迹回归改成动作概率分布学习，用 planning vocabulary 表达多种合理驾驶动作。它适合作为闭环端到端驾驶和不确定性规划的核心阅读样本。"
}
---

## 一句话定位

VADv2 把直接回归单条轨迹改为场景条件下的整轨迹候选评分；默认执行最高分候选，重点证据是开环差异很小时仍改善闭环表现，而非证明概率已校准。[固定全文 v2，§3–4、附录 A](https://arxiv.org/html/2402.13243v2)

## 论文要解决的问题

同一场景可能允许多种合理动作，单条示范回归容易把它们混在一起。作者用大量示范构建动作词表，学习候选与场景是否匹配，并以碰撞、道路和交通元素监督约束候选概率。

## 方法和系统设计

### 输入与整轨迹词表

多相机时序特征经 BEV 编码生成地图及动态目标 token，前视特征再提供信号灯／停止标志与密集图像 token；导航和自车状态单独编码。地图、目标未来运动、交通元素都有训练监督，测试时不输入 HD 地图真值。

每个词条是一条 3 s、6 个二维点的完整轨迹，不是一步转角。Algorithm 1 从示范动作中做最远轨迹采样，实际距离函数比较终点距离，默认 4096 条。每条候选的位置编码作为 query，与场景 token 做交叉注意力，再预测得分。复制人类轨迹能提供合理运动原型，但不同初速和控制器下仍需检验动力学可行性。

### 分布训练及公式限度

每帧将词表中 L2 最接近示范的动作标为正例。式 4–6 写成：

$$
L_{\mathrm{dist}}=-\sum_{a\in\mathcal V}p_{\mathrm{data}}(a)\log p_\theta(a\mid o),\qquad
L_{\mathrm{conflict}}=\sum_{a\in\mathcal V}\mathbf1_{\mathrm{conflict}}(a)\log p_\theta(a\mid o).
$$

$o$ 为场景、导航及自车信息；冲突由他车真值未来或道路边界确定，仅在训练使用。总损失还包括地图、检测／预测及交通 token 监督。单帧仍只有一个示范标签，不能据此声称观测到了该场景所有合理动作频率。

需要保留原文约定：式 3 用 sigmoid 给各候选打分，却未说明 KL 所需的跨候选归一化；正号 $\log p$ 能把冲突概率压低，但单项没有有限下界。本报告不擅自把它改为 softmax 或 BCE；完整稳定实现应另核对。

### 推理及原始机制对照

§3.4 默认取最高概率候选，再用 PID 输出转向、油门、制动，10 Hz 滚动规划。§3.4 的 Top-K 筛选、优化后处理及切换传统规划器属于进一步应用建议；但 §4.2 明确 CARLA 基准实际使用类似 TransFuser 的规则包装器，因此下列表格并非裸 argmax+PID 的成绩。该执行链不能自动推广到 NAVSIM 或 3DGS 测试。

[Jiang 等，VAD，2023 v3，§3.2–3.4](https://arxiv.org/html/2303.12077v3) 让自车 query 与地图／目标交互后，MLP 回归轨迹并施加矢量避碰、边界和方向约束；VADv2 改为大量候选与场景的评分交互。[Zhou 等，AutoVLA，2025 v1，§3](https://arxiv.org/html/2506.13757v1#S3) 将短时位移与朝向量化为 2048 个动作 token，逐 token 展开；VADv2 每个词条覆盖整条未来轨迹，没有该自回归链，也没有语言推理模块。

## 关键图与可视化结果

![原文 Figure 2：候选动作与场景 token 交互](https://arxiv.org/html/2402.13243v2/framework.png)

示范分布与场景约束都作用在训练端；右侧冲突检查不表示推理时获得他车真实未来。

![原文 Figure 4：Town05 中的多模态轨迹](https://arxiv.org/html/2402.13243v2/vis.png)

四例展示速度、前挪、变道等候选，颜色沿 0–3 s 变化。候选多样性不等于概率校准或每条都安全。

## 实验结论与证据

### 相同模型体系内的规划方式对照

Town05 训练数据来自 Town03/04/06/07/10，约 3M clips，每个包含 1.6 s 的六相机历史；Town05 测试未用于该采集。附录表 12 的确定性版将规划头改为轨迹回归，其他体系沿用 VADv2：

| 规划方式 | Town05 Long DS ↑ | RC ↑ | 3 s L2，m ↓ | 开环 Collision，% ↓ |
| --- | --- | --- | --- | --- |
| Deterministic | 74.6 | 95.1 | 0.223 | 0.006 |
| Probabilistic | 85.1 | 98.4 | 0.225 | 0.007 |

闭环 DS 多 10.5 分，但开环两项略差，说明这些开环指标不足以替代交互执行。表 8 按自车 20 m 内动态目标数分 Low<5、Medium 5–10、High>10；确定性／概率式 PDMS 在高密度为 85.8/87.7，在低密度为 89.4/90.6。未给多 seeds 方差或同参数量控制，不能将全部收益单归为不确定性建模。

### 组件、词表与基准口径

表 7 用 50k clips：去掉分布损失，3 s L2 为 3.153 m，对完整模型 0.290 m；去掉冲突损失为 0.291 m，3 s 碰撞均为 0.039%。因此这张开环表对冲突项收益的支持很弱。附录表 10 将词表 256→4096，3 s L2 为 0.337→0.290 m、碰撞 0.057%→0.039%，需同时衡量候选数量成本。

NAVSIM navtest 的 PDMS 为 89.3；v2 表 3 的 EPDMS 为 85.8，但没有充分列出 v2 具体 split／完整阶段聚合，不与其他论文 navhard 数值混排。3DGS 测试是 337 个 8 s 重建场景，非实际道路测试；表 4 的 CR 与表 15 的“Collision (%)”使用相同数值但标度不同，不自行换算。[§4、附录 A](https://arxiv.org/html/2402.13243v2#A1)

## 应用场景与启发

完整运动原型方便加入其他候选或外部约束。待验证假设：固定词表大小时，增加窄路原型覆盖能降低离散化误差，并改善实际选中轨迹的窄路控制。候选最大分未经校准，不能直接用作可靠接管阈值。

## 局限与阅读风险

表 15 使用相同感知骨干、RTX 4090，VADv2 0.40B／125 ms，对 VAD 0.36B／118 ms；单次 125 ms 不能直接保证 10 Hz 实时循环。全实验使用 16 RTX 4090，但训练轮次、分阶段耗时未完整给出，2000 h 自采数据与对应重建资产未确认发布。

[官方仓库](https://github.com/hustvl/VAD)的 VADv2 子目录仅有 head/config。配置用 sigmoid FocalLoss，冲突相关两项权重为零，且引用词表与预训练文件；不能当作 v2 正文损失的完整实现。仓库提供的 VAD-Tiny/Base 权重属于 v1，未确认 v2 完整模型、词表和基准配置可下载。

## 后续跟进

### 同大小词表的窄路覆盖检验

先获得可对应 v2 的损失实现、词表和 CARLA clips。从同一感知初始化复制两组，固定 50k clips、优化器、更新数和 3 seeds，对比标准采样与窄路覆盖增强的两份 4096 大小词表；增强词条仅由训练／独立验证集构造，不使用测试轨迹。推理使用完全相同的规则包装器与 PID。分别测留出窄路及普通 Town05 routes 的 DS、碰撞、选中轨迹误差，并用测试 GT 仅作评测计算 oracle 候选覆盖误差。只有覆盖误差与实际控制均改善、普通路线不明显退化，才支持该假设；若只有 oracle 改善而选择无收益，则转查评分器。若缺词表／检查点或配置无法对应论文损失，停止性能复现。本次未训练或运行规划。
