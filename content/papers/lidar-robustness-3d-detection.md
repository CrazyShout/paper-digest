---
{
  "id": "lidar-robustness-3d-detection",
  "tag": "autonomous-driving-security",
  "tags": [
    "autonomous-driving-security",
    "autonomous-driving-testing"
  ],
  "title": "Comprehensive Robustness Analysis of LiDAR-based 3D Object Detection in Autonomous Driving",
  "source": "ECCV 2026 / https://eccv.ecva.net/virtual/2026/poster/4486 / arXiv:2607.02074 / https://arxiv.org/abs/2607.02074 / HTML: https://arxiv.org/html/2607.02074v1",
  "authors": [
    "Adwait Chandorkar",
    "Kai Krink",
    "Yerdana Maulenbay",
    "Hasan Tercan",
    "Tobias Meisen"
  ],
  "affiliations": [
    "University of Wuppertal",
    "University of British Columbia"
  ],
  "comment": "四种 LiDAR 检测器在点注入和坐标扰动下出现排序反转；应分开报告 AP 相对下降、以干净检出对象为分母的 ASR，以及框方向和距离分组。"
}
---

## 一句话定位

本文复核四种 LiDAR 检测器在点增删、坐标扰动和特征攻击下的表现，把总 AP 下降拆成置信度、框几何、距离及点分布。它支持“干净 mAP 进步不保证鲁棒性”，不支持“某类编码器在所有攻击下更安全”。

## 论文要解决的问题

### 评测要把什么分开

同样的 AP 下降，可能来自漏检、误分类或框位置错误。干净点云中本来就漏检的目标，也不应算成攻击新增失败。论文因此同时分析预测变化与对象的点云结构，而非用一个攻击成功率替代所有安全后果。

### 相关原工作

| 工作 | 核心机制 | 本文的评测增量 |
| --- | --- | --- |
| Lang 等，2018 预印本，[PointPillars §2](https://arxiv.org/pdf/1812.05784v1) | 学习 pillar 特征并散射为二维伪图像，再检测三维框。 | 检查垂向汇聚结构在不同扰动下的取舍，不改编码器。 |
| Yin 等，2020 预印本，[CenterPoint §4](https://arxiv.org/pdf/2006.11275v1) | 以中心热图定位对象，再回归尺寸、方向与位置偏移。 | 检查语义类别正确时框几何和置信度是否仍退化。 |

## 方法和系统设计

### 模型、攻击与数据流

原点云 → 四种检测器 → 干净预测；再以相同对象和模型评估扰动点云。PointPillars、PillarNeSt 使用 pillar，CenterPoint、FocalFormer3D 使用 voxel；后者结合 Transformer head。白盒评测包括 IoU-S 的 attachment、detachment、perturbation（PA/PD/PB）及用特征空间损失优化输入点云坐标的 Non-E2E（NE）；LiDAttack 是查询式黑盒方法。[§3、表 1](https://arxiv.org/html/2607.02074v1#S3)

NE 的扰动对象是输入点云，目标在特征空间定义；这里不假设攻击者可以直接改写运行时内部特征。[Long 等原方法](https://ietresearch.onlinelibrary.wiley.com/doi/10.1049/cvi2.70011)支持这一边界，具体 benchmark 配置若使用特征注入变体需另行注明。

PointPillars 在两数据集重新训练，PillarNeSt 在 Waymo 重新训练，其余表 1 配置使用原权重。因初始化、训练和骨干不同，这不是只改变 pillar/voxel 一个因素的因果消融。评测阶段检测器参数不更新。

### 成功率与 AP 不能混用

按 §4 定义整理：设 $\mathcal C$ 是干净输入中已经检出的对象，则

$$
\mathrm{ASR}=\frac1{\lvert\mathcal C\rvert}\sum_{i\in\mathcal C}\mathbf1[M_i\lor(\widehat y_i\ne y_i)\lor(c_i<0.15)].
$$

其中 $M_i$ 表示对象漏检，$\widehat y_i\ne y_i$ 表示类别错误，$c_i$ 为正确类别置信度。这里的分母排除原有漏检；0.15 是作者选择的阈值，不是安全标定概率。表 2 的百分比则是相对 AP/置信度下降，例如 $100(AP_{\rm clean}-AP_{\rm adv})/AP_{\rm clean}$；负值表示改善，不能把表中 65.5 当作 ASR 或下降 65.5 个 AP 点。

距离分为 0–20、20–35、35–50 m；“密度”在分析中用对象框内点数表示，并非单位体积点数。内部/外部点由原框按 0.8 缩放划分。[§4.3–4.6](https://arxiv.org/html/2607.02074v1#S4)

## 关键图与可视化结果

![原论文图 1：模型、攻击与五类鲁棒性维度](https://arxiv.org/html/2607.02074v1/imgs/3_methodology.png)

从左侧干净/扰动点云看向检测输出；红色框分别是点结构与预测因素。这是评测组织方式，不代表所有攻击都能在真实激光回波中实现。[图 1](https://arxiv.org/html/2607.02074v1#S3.F1)

![原论文图 5 的 nuScenes 面板：近中远距离对象的 ASR](https://arxiv.org/html/2607.02074v1/x3.png)

每组柱对应同一模型和攻击下的距离分组，纵轴为样本 ASR 比例。它不是 FP/FN 图，也未包含完整 Waymo 面板；部分坐标扰动组合在近距离仍有高失败率。[完整图 5](https://arxiv.org/html/2607.02074v1#S4.F5)

## 实验结论与证据

### 看攻击类型造成的排序反转

| 表 2，nuScenes Car | PA：AP 相对下降 | PB：AP 相对下降 |
| --- | ---: | ---: |
| CenterPoint | 3.9% | 65.5% |
| FocalFormer3D | 7.8% | 38.9% |
| PillarNeSt | 32.2% | 20.2% |
| PointPillars | 85.4% | 10.0% |

这些行只摘取表中每对数字的 AP 部分。pillar 在坐标扰动下较好、点注入下却明显更差，所以不能给架构一个统一鲁棒性排名。Waymo Car 的 PB 相对 AP 下降分别为 91.0%、88.5%、18.6%、9.4%，支持本组设置中相似趋势，仍不能排除训练差异。[表 2](https://arxiv.org/html/2607.02074v1#S4.T2)

### 其他证据与缺口

原图 3/4 进一步统计 FP/FN 与平移、尺度、偏航误差；只在正确检出的对象上比较几何会漏掉已被删除的困难样本，需要与召回一起读。黑盒 LiDAttack 较弱只说明所用查询攻击效果有限，不能证明普遍抵抗黑盒攻击。主文把若干原因归于全局注意力或空间记忆，这是作者解释，并非受控机制实验。

## 应用场景与启发

- 作者主张：检测基准应同时奖励精度和结构稳健性。
- 我的判断：最可迁移的是统一干净对象集合、区分 AP 下降与 ASR，并给规划接口保留方向误差。
- 待验证假设：固定编码器与训练预算，仅替换 head 后，原有鲁棒性排序可能改变；这能检验“架构标签决定脆弱性”的解释。

## 局限与阅读风险

仅覆盖 LiDAR-only 检测，没有测多模态融合、闭环规划或物理执行成本。完整采样数量、攻击预算及各配置与结果的绑定仍需仓库清单核对；正文指向附录不等于这些细节已在固定 HTML 全部列明。统计未提供统一多种子区间，不能把误差下降解读为显著改善。

## 后续跟进

### 最小验证与停止条件

- 资源（2026-09-12）：[官方项目](https://tmdt-buw.github.io/adv-robustness-analy-3d-od/) 与 [仓库](https://github.com/tmdt-buw/adv-robustness-analy-3d-od) 已公开评测管线、配置和模型适配；原数据与权重需按各模型另行准备。本次只检查 README/树，未下载模型。仓库已增加新实验，不能自动当作 v1 的固定配方。
- 最小验证：先取得已保存的干净/扰动预测，固定对象 ID、类别映射和置信度阈值，重算 AP 相对下降与 ASR；对照全部对象召回和正确检测对象的 yaw 误差。
- 成功信号：排序反转在同一采样集合和阈值范围内仍成立，并能定位是新增漏检还是几何偏差。
- 停止条件：排名主要由阈值、类别过滤或不同训练预算驱动；先修评测可比性再讨论架构原因。

### 来源与核验

依据 [arXiv:2607.02074v1](https://arxiv.org/html/2607.02074v1)，2026-09-12 阅读 §3–4、表 1–3、PDF 首页，逐张打开图 1 与图 5 的保留面板，核对两项原始模型论文及公开资源。未执行攻击或实验。
