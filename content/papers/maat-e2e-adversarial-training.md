---
{
  "id": "maat-e2e-adversarial-training",
  "tag": "autonomous-driving-security",
  "tags": [
    "autonomous-driving-security",
    "end-to-end-autonomous-driving",
    "autonomous-driving-testing"
  ],
  "title": "Module-wise Adaptive Adversarial Training for End-to-end Autonomous Driving",
  "source": "arXiv:2409.07321 / https://arxiv.org/abs/2409.07321 / HTML: https://arxiv.org/html/2409.07321v1",
  "authors": [
    "Tianyuan Zhang",
    "Lu Wang",
    "Jiaqi Kang",
    "Xinwei Zhang",
    "Siyuan Liang",
    "Yuwei Chen",
    "Aishan Liu",
    "Xianglong Liu"
  ],
  "affiliations": [
    "School of Computer Science and Engineering, Beihang University",
    "School of Software, Beihang University",
    "School of Computing, National University of Singapore",
    "Aviation Industry Development Research Center of China"
  ],
  "comment": "MA2T 在模块接口做整体目标驱动的对抗训练，并动态平衡任务损失；部分攻击下更稳，但正常 L2 退化及正文/闭环表冲突需要共同纳入判断。"
}
---

## 一句话定位

MA2T 把对抗训练扩展到端到端驾驶的模块接口：用总任务目标生成模块噪声，再根据各任务损失的变化调整训练权重。它改善了若干攻击下的规划误差，但正常输入性能有代价，不能概括成“增强鲁棒性且不损失精度”。

## 论文要解决的问题

### 多模块目标为何冲突

感知、预测和规划共用表示，各模块单独变稳未必让最终轨迹更好。攻击检测损失生成的扰动与攻击规划损失生成的扰动，也可能具有不同作用。作者希望同时保护模块连接和最终驾驶任务；该训练问题不等于真实攻击者能直接修改内部特征。

### 相关工作与具体增量

| 工作与原文 | 已有机制 | MA2T 改变什么 |
| --- | --- | --- |
| Madry 等，2017 预印本，[稳健优化 §2](https://arxiv.org/pdf/1706.06083v1) | 输入扰动集合内最大化损失，模型参数再最小化该最坏损失。 | 将扰动入口扩展到多个模块，且调整多任务目标权重。 |
| Jiang 等，ICCV 2023，[VAD §3](https://openaccess.thecvf.com/content/ICCV2023/papers/Jiang_VAD_Vectorized_Scene_Representation_for_Efficient_Autonomous_Driving_ICCV_2023_paper.pdf) | 向量化车辆/地图、ego-query 交互及碰撞和道路约束。 | 对检测、地图、运动、规划向量做稳健训练；不是新增向量化架构。 |

## 方法和系统设计

### 噪声和参数怎样更新

UniAD 的五处噪声入口是图像、Track→Motion、Map→Motion、Motion→Occ、Motion→Plan；它们是模块间接口，不能与 Track/Map/Motion/Occ/Plan 五个模块名称混为一谈。原文式 8 统一使用总损失产生扰动，而不是让各模块只最大化自己的损失：

$$
\delta_i^*=\arg\max_{\lVert\delta_i\rVert_p\leq\epsilon}\mathcal L_{\mathrm{total}}(y_i,f_\theta^{\mathrm{adv}}(x_i,\delta_i)).
$$

$\delta_i$ 是该样本各入口扰动的集合，$y_i$ 是原任务监督；随后固定扰动更新模型参数。推理仍是训练后的规划器，训练噪声和动态权重计算不作为在线防御器运行。[§IV-A/C](https://arxiv.org/html/2409.07321v1#S4)

### 动态权重的实际含义

式 9–11 用任务损失比率及其标准化值更新权重：

$$
R_j^t=\frac{\mathcal L_j^{t-1}}{\mathcal L_j^{t-2}},\quad
\alpha_j^t=\frac{N\exp((R_j^t-\bar R^t)/\sigma_R)}{\sum_k\exp((R_k^t-\bar R^t)/\sigma_R)},\quad
W_j^{t+1}=rW_j^t+(1-r)\alpha_j^t.
$$

$j$ 是任务，$N$ 是任务数，$r=0.2$。下降较慢的损失获得较大新权重，历史权重平滑更新，算法 1 每 100 batches 更新一次。这是训练速度代理，并非对模块安全贡献的因果测量；分母损失或 $\sigma_R$ 接近零时的保护必须查实现，不能自行补超参数。

### 实验条件

nuScenes 开放环看未来三秒平均 L2。UniAD 训练 3 epoch、VAD 10 epoch，内层五步；正文列 UniAD 各模块预算 0.8/0.1/0.1/0.1/0.1，VAD 四入口均 0.1。正文评测写 $\ell_\infty=0.2$，并按 $\ell_1,\ell_2$ 顺序列 240、288,000；该顺序与常见范数尺度直觉不符，本报告不擅自调换，需以配置核验归一化和预算。硬件为八张 80GB A800；§V-C 称 UniAD 每个对抗训练 epoch 约一天，但未给完整测时细分或统一等算力对照，不能直接换成精确 GPU 小时。[§V-A](https://arxiv.org/html/2409.07321v1#S5.SS1)

## 关键图与可视化结果

![原论文图 1：模块噪声入口和训练权重更新](https://arxiv.org/html/2409.07321v1/x1.png)

上方红色路径通过整体目标生成模块扰动，下方蓝色路径根据损失变化平衡训练。两种机制职责不同，不能把全部效果归给某个入口。[图 1](https://arxiv.org/html/2409.07321v1#S4.F1)

![原论文图 5：CARLA 中正常、受扰动及防御后骑行者场景](https://arxiv.org/html/2409.07321v1/x7.png)

三行依次展示正常避让、受扰动碰撞及防御后调整；这是原图 5，底部图片内保留作者的 MAST 标注。单个成功样例不代表所有路线恢复。[图 5](https://arxiv.org/html/2409.07321v1#S6.F5)

## 实验结论与证据

### 正常精度与鲁棒性一起看

| 表 I，三秒平均 L2，越低越好 | UniAD：原模型 → MA2T | VAD：原模型 → MA2T |
| --- | ---: | ---: |
| Clean | 1.08 → 1.28 m | 0.73 → 1.08 m |
| PGD-$\ell_\infty$ | 2.43 → 1.72 m | 0.93 → 0.89 m |
| AutoAttack | 2.55 → 1.78 m | 1.35 → 1.24 m |

UniAD 的 PGD 行按表值下降约 29.2%，但两模型 clean 均退化；UniAD 的 FGSM 行 MA2T 为 1.62 m，也弱于 FGSM 训练基线的 1.41 m。不能照搬摘要“全面提高 5–10%”作为统一结论。[表 I](https://arxiv.org/html/2409.07321v1#S5.T1)

### 闭环与消融边界

CARLA 0.9.15、Leaderboard v2 使用 Town12/13 长路线及其他短路线，借助 Bench2Drive 接口集成模型，并在测试图像叠加预先生成的通用扰动。表 V 的 Driving Score：UniAD 为 39.42（干净）/37.91（受扰动）/38.86（防御后），VAD 为 37.72/25.64/35.39。附近正文把最后一个 VAD 数值写作 26.87，存在明确矛盾，本报告按表，不合并成已确认统一结果。[表 V](https://arxiv.org/html/2409.07321v1#S6.T5)

作者补充模块入口、子损失和规划目标三类自适应攻击，以及自然扰动曲线；这优于只测一个固定攻击，但不能覆盖所有预算、优化强度和物理约束。表 III 改变训练 epoch，成本并不相同；表 IV 则在其他噪声设置固定时，将 Track→Motion 预算从 0 改为 0.1，三秒平均 L2 从 2.11 降至 1.72 m，为该入口提供匹配对照。主结果报告五次独立训练取均值，模块噪声实验有 20 次重复；论文仍未给出对应置信区间，不能把重复次数等同统计显著性。[表 IV、§V-C](https://arxiv.org/html/2409.07321v1#S5.T4)

## 应用场景与启发

- 作者主张：模块级噪声与目标平衡提升端到端鲁棒性。
- 我的判断：价值在于把扰动入口与最终规划目标联系起来，正常误差必须作为同等重要的验收项。
- 待验证假设：按最终碰撞风险而非损失下降速度调权，可能减少 clean 退化；若只改善局部任务而不改善最终轨迹，假设不成立。

## 局限与阅读风险

中间特征预算没有统一物理单位，不能与像素预算或真实传感器变化直接比较。开放环误差、数字扰动闭环和实车安全是不同证据层级。缺少统一训练成本、精确路线列表及方差时，“几乎恢复原性能”应限定到明确表格和任务。

## 后续跟进

### 最小验证与停止条件

- 资源（2026-09-12）：[作者仓库](https://github.com/waterluy/MA2T) 已有 UniAD/VAD 适配、训练和自适应评测代码及配置；基础数据/权重需从原项目获取。本次未确认训练后 MA2T 权重发布。README 写八张 A100，与 v1 的 A800 分开记录，不能当作相同测时平台。
- 最小验证：先固定一个模型、初始化、数据划分和总更新数，比继续训练、图像对抗训练、模块噪声加调权；共同核对预算归一化、clean L2、受扰动 L2和训练成本。
- 成功信号：同预算下鲁棒收益仍存在，clean 损失处于事先接受范围；再按完整路线清单验证闭环。
- 停止条件：收益随更强自适应评测消失，或只来自更多更新；先修训练和威胁口径。

### 来源与核验

依据 [arXiv:2409.07321v1](https://arxiv.org/html/2409.07321v1)，2026-09-12 阅读方法式 6–12、主表/消融表及闭环章节，核对 PDF 首页、原图 1/5、两项相关原文和仓库。未执行攻击、训练或实验。
