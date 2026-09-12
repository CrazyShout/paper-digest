---
{
  "id": "vrs-roadside-lidar-synthesis",
  "tag": "cooperative-autonomous-driving",
  "tags": [
    "cooperative-autonomous-driving",
    "3d-reconstruction"
  ],
  "title": "Generating Roadside LiDAR Datasets from Vehicle-Side Datasets via Novel View Synthesis",
  "source": "arXiv:2605.05897 / https://arxiv.org/abs/2605.05897",
  "authors": [
    "Yuhan Xia",
    "Runxin Zhao",
    "Hanyang Zhuang",
    "Chunxiang Wang",
    "Ming Yang"
  ],
  "affiliations": [
    "School of Automation and Intelligent Sensing, Shanghai Jiao Tong University",
    "Key Laboratory of System Control and Information Processing, Ministry of Education of China",
    "Global College, Shanghai Jiao Tong University"
  ],
  "comment": "VRS 用车端 LiDAR 数据合成带标注的路侧 LiDAR 数据，针对真实 roadside 数据稀缺和跨视角 domain gap 做补全、可见性约束和 novel view synthesis。"
}
---

## 一句话定位

VRS 从车载序列补全车辆、拟合背景及物体神经场，再生成六种路侧视角的带框点云；下游证据是汽车检测增强和跨路口测试，不是新视角几何真值重建。[全文 v1，§III–IV](https://arxiv.org/html/2605.05897v1)

## 论文要解决的问题

路侧雷达装得更高，会看到车顶、后部及更远地面。车载观测缺这些结构，直接变换坐标或自由外推神经场都会产生空洞、假表面。VRS 分别处理车辆形状缺失和背景未观测区域。

## 方法和系统设计

### 数据准备与场景优化

用标注框拆分动态车辆和背景，过滤点数不足车辆。每辆车选观测点最多的单帧，经镜像增强、地面过滤和 SymmCompletion 补全；并非把所有帧叠加成真实完整物体。背景汇集同场景片段，用 HBA 优化位姿，并以检测伪标签清除未标注动态目标。

背景一个 SDF 场，每辆车在首帧规范坐标中单独拟合一个场。§III-B 式 1 的目标为：

$$
L=w_\zeta L_\zeta+w_sL_s+w_{\mathrm{eik}}L_{\mathrm{eik}}+w_{\mathrm{drop}}L_{\mathrm{drop}}.
$$

分别监督距离 L1、表面 SDF 为零、梯度范数接近 1，以及 BCE 加 Lovasz 的丢线预测。车辆场使用补全点云生成监督：多层环形射线起点围绕车辆，射线离点云小于 5 cm 记为命中，其余为 drop。这里学习到的不可见结构来自补全先验，而非路侧实测。

### 渲染与训练边界

车载背景点云体素化并膨胀，采样点在占据支持区域外就强制 drop，区域内才查询 SDF。每条射线检查相交车辆框，对这些车辆场和背景独立渲染；按 §III-C 的规则，保留丢线概率不大于 0.5 的候选，取最近距离：

$$
\mathcal V(r)=\{j:p_{d,j}(r)\leq0.5\},\qquad
\hat\zeta(r)=\min_{j\in\mathcal V(r)}\zeta_j(r).
$$

$\mathcal V$ 为空即丢弃。车辆依标注轨迹作刚体运动；被过滤而无模型的车辆轨迹会随机借用其他已重建车形。场景拟合完成后生成检测训练数据，再独立训练 PointPillars/PV-RCNN。补全网络的权重来源、场景优化轮数与占据分辨率／膨胀半径未充分报告。

### 原始机制对照

[Wu 等，DyNFL，CVPR 2024，§3.1、4.4–5](https://openaccess.thecvf.com/content/CVPR2024/papers/Wu_Dynamic_LiDAR_Re-simulation_using_Compositional_Neural_Fields_CVPR_2024_paper.pdf) 已使用背景／车辆独立神经场和丢线检验组合；VRS 沿用这一基础，新增跨视角补全、背景清理和占据约束，不能把组合本身当作新贡献。[Huang 等，RS2AD-LiDAR，2026 v1，§3](https://arxiv.org/html/2605.23406v1#S3) 则从路侧单帧向车载生成，用地面／非地面平面交射线，无需训练场景；两者转换方向和几何假设不同，论文未做匹配成本或生成质量对照。

## 关键图与可视化结果

![原文 Fig. 1：VRS 场景分解、补全、重建与渲染流程](https://arxiv.org/html/2605.05897v1/all10.png)

占据支持来自原车载观测，约束渲染位置；它抑制无证据外推，并不会恢复视域外真实地面。

![原文 Fig. 4：六个虚拟路侧位姿的生成结果](https://arxiv.org/html/2605.05897v1/all5.png)

中心为车载输入，周围为六个生成视角；没有对应六视角逐点实测真值，因此只能作为定性说明。

## 实验结论与证据

### 同路口与异路口的检测证据

V2X-Seq 的 yizhuang06 作为源路口；生成 11196 帧 Sim-Road。训练／测试比例 4:1，但是否按完整序列隔离、神经场是否只用训练片段未明确。统一检测范围为 $[0,-150.4,-2,225.6,150.4,4]$ m。表 I–II 为 PointPillars 的汽车 AP，单位 %：

| 训练与测试条件 | BEV AP@0.7 ↑ | 3D AP@0.7 ↑ |
| --- | --- | --- |
| Real-Veh，同路口 Real-Road 测试 | 45.55 | 8.91 |
| Sim-Road，同路口测试 | 79.15 | 42.18 |
| Real-Road，同路口测试 | 91.55 | 66.14 |
| Real-Road + Sim-Road，同路口测试 | 93.00 | 72.14 |
| Real-Road，其他五路口测试 | 60.86 | 38.12 |
| Real-Road + Sim-Road，其他五路口测试 | 66.96 | 46.69 |

加入合成数据同路口提高 6.00 个百分点；随机抽取其他五路口 1000 帧时提高 8.57 个百分点。后者同时改变场景与传感器视角，不能解释为只改变安装位姿的受控试验。PV-RCNN 的 50% 真数据实验为 46.34→53.26，即 6.92 个百分点。[表 I–III](https://arxiv.org/html/2605.05897v1#S4)

### 模块证据和实际代价

Fig. 8 对车辆补全、动态目标去除、位姿对齐、丢线和占据约束分别提供定性去除结果，但没有对应的检测 AP 或几何数值消融。不同真数据预算只是数据量控制，不能证明每个模块必要。全文未说明 AP 插值口径、统计种子、等训练步数控制。

硬件为 RTX 4090、24 核 Intel CPU、64 GB RAM；没有每场景拟合时间、显存峰值或每帧渲染耗时。“低成本、大规模”是作者主张，当前只能核验生成帧数及下游检测结果。

## 应用场景与启发

适合把已有标注车载序列转成路侧检测预训练数据。报告判断：强制拒绝无观测支撑的背景，比让神经场任意补出几何更可控；但拒绝也会降低覆盖，需同时检查有效回波比例与检测召回。

## 局限与阅读风险

仅汽车类别；随机替换车形可能与原轨迹框尺寸不匹配，论文没有量化。作者承认大视角下的视角相关丢线规律仍未建模完整，不能因为已有 drop 预测便宣称物理逼真。固定全文无附录或作者发布入口；当前公开检索未确认 VRS 代码、合成集、配置及权重下载。V2X-Seq 是公开上游数据，不能替代本方法资产。

## 后续跟进

### 先封闭数据来源

获取实现后先用一段车载训练序列拟合场景，保留独立序列作测试；锁定所有源帧和虚拟视角清单，核对随机替代车形是否同步更新框尺寸。最小对照固定合成帧数、训练步数，只开关占据约束，记录有效回波率、几何伪影及汽车 AP。成功条件是无测试帧参与重建且伪影减少没有靠大面积丢点换取；若无法取得配置或排除场景泄漏，停止增益复现。本次未生成点云或训练模型。
