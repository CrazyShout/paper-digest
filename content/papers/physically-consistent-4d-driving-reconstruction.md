---
{
  "id": "physically-consistent-4d-driving-reconstruction",
  "tag": "3d-reconstruction",
  "tags": [
    "3d-reconstruction",
    "autonomous-driving-testing",
    "world-models"
  ],
  "title": "Towards Physically Consistent 4D Scene Reconstruction for Closed-loop Autonomous Driving Simulation",
  "source": "arXiv:2605.21032v1 / https://arxiv.org/abs/2605.21032v1",
  "authors": [
    "Bowyn Tan",
    "Yutong Xie",
    "Bai Huang",
    "Fan Luo",
    "Xiao Li",
    "Naizheng Wang",
    "Yang Guan",
    "Shengbo Eben Li"
  ],
  "affiliations": [
    "Tsinghua University",
    "Meituan",
    "Central University of Finance and Economics"
  ],
  "comment": "以分阶段优化、观测空间正交投影和时间TV缓解视角/时间外观混淆；偏轨迹收益主要是定性展示，理论保证依赖几何与采样假设。"
}
---

## 一句话定位

本文用 Orthogonal Projected Gradient（OPG）区分视角引起的外观变化和真正的时间变化，再用时间 TV 抑制未观测时段振荡。值得借鉴的是优化分工；“物理一致”目前主要指刚体形状和外观稳定，尚无闭环政策安全指标。

## 论文要解决的问题

### 单条轨迹上的外观有多种解释

如果相机方向与时间绑定为 $d=\gamma(t)$，同一次亮度变化既可能来自反射视角，也可能来自刹车灯点亮。只拟合日志图像难区分这两种解释，偏离采集轨迹后可能失真。作者称其为 SOF，但“所有单源观测必然不可辨识”是带假设的理论主张，不能直接当普遍定理。[v1，§3–4](https://arxiv.org/html/2605.21032v1#S4)

### 基线并非只有时间建模这一处差别

[Street Gaussians 自身 §3](https://arxiv.org/html/2401.01339v3#S3)已有物体局部坐标、可优化跟踪位姿和时间 Fourier 系数；本篇主要改变其空间/时间参数的优化方式。[DrivingGaussian 自身 §3](https://arxiv.org/html/2312.07920v1#S3)还包括增量静态场景、动态 Gaussian 图、LiDAR 对齐与 SAM 物体提取。本篇称为 DrivingGaussian 的对照是在 StreetGaussians 代码中把 4DSH 换成静态 3DGS 的重实现，不能视为完整复现原系统。[§5.2](https://arxiv.org/html/2605.21032v1#S5.SS2)

## 方法和系统设计

### 先固定几何，再讨论外观归因

输入包含标定多相机序列、LiDAR 初始化和动态对象框位姿。静态背景在世界系，动态对象 Gaussian 在各自局部系保持位置、协方差和不透明度不随时间变化，再由对象刚体位姿变换到场景。查询输入相机内外参和时间，输出 RGB。方向 $d=(o-\mu)/\|o-\mu\|$ 从 Gaussian 指向相机，颜色由空间 SH 与时间基组合；对象运动由轨迹控制，不是预测出来的交通行为。[§3.1、附录 A](https://arxiv.org/html/2605.21032v1#A1)

### 雅可比投影的准确含义

令观测颜色 $C\in\mathbb R^m$，空间/时间外观参数为 $s,\tau$，雅可比 $J_s\in\mathbb R^{m\times p_s}$、$J_\tau\in\mathbb R^{m\times p_\tau}$。在独立高斯噪声和局部模型假设下，式 (5)–(9) 使用：

$$
F=\sigma^{-2}[J_s,J_\tau]^\top[J_s,J_\tau],\qquad
S_s=F_{ss}-F_{s\tau}F_{\tau\tau}^{-1}F_{\tau s}.
$$

$\sigma^2$ 为噪声方差，$S_s$ 是消去时间参数后的空间有效信息；逆矩阵表达需要对应块可逆。若两类雅可比列空间重叠，空间信息可能退化。CRB 是无偏估计的局部方差下界，不能由此直接推出正则化重建必然发生渲染崩溃。

§4.2 的 OPG 为：

$$
P_s^\perp=I-J_sJ_s^\dagger,\qquad
\widetilde J_\tau=P_s^\perp J_\tau,\qquad J_s^\top\widetilde J_\tau=0.
$$

$\dagger$ 表示 Moore–Penrose 伪逆。按矩阵维度，投影作用于观测空间的 $\ker(J_s^\top)$，不是参数空间的 $\ker(J_s)$；原文把伪逆展开成 $(J_s^\top J_s)^{-1}J_s^\top$ 还需 $J_s$ 列满秩。正交化限制了允许更新的解释方向，没有增加新的真实观测。[§4.1–4.2、附录 F](https://arxiv.org/html/2605.21032v1#A6)

### 训练和时间正则

附录 G 的实现为每场景 30K 步：前 23K 冻结时间项、学习几何和视角项，然后执行一次 OPG，冻结几何/视角参数并继续训练时间项。时间 Fourier 维数为 16，TV 权重 0.005；式 (13) 对时间外观导数的范数积分加惩罚，以减少振荡。TV 是平滑先验，不是碰撞或动力学约束；推理只在指定时间/位姿渲染，不运行政策学习。[§4.3、附录 G](https://arxiv.org/html/2605.21032v1#A7)

## 关键图与可视化结果

### 原图 1：刹车灯与偏轨迹外观

![原图 1：两个时刻的尾灯及不同方法的新视角效果](https://arxiv.org/html/2605.21032v1/demo.png)

GT 行显示日志中的灯从关到开，其他行展示作者所选的渲染结果；本方法保留了灯变化并减少形状失真。日志 GT 不等于每个偏轨迹相机都有成对真实图，不能从这张图计算新视角误差。

### 原图 2：归因问题的示意

![原图 2：遮挡区间、停止阶段与空间时间外观歧义](https://arxiv.org/html/2605.21032v1/Main_Frame.png)

左侧把轨迹映到方向/时间/颜色曲面，右侧对比只归因时间、只归因方向及加入 TV/OPG 的解释。这是概念诊断图，不是网络结构或实测误差曲面。

## 实验结论与证据

### 主表衡量的是轨迹内插值

Waymo NOTR 含 Dynamic32/Static32，三个前相机、1600×1066、每场景约 200 帧，每四帧留一帧测试；各法 LiDAR 初始化、单 A100，除 S3Gaussian 按原配置外均 30K 步。作者自己强调该插值协议不能充分验证偏轨迹 NVS。[§5.1–5.3，表 1](https://arxiv.org/html/2605.21032v1#S5)

| 方法 | Dynamic32 PSNR，dB↑ | 动态物体 PSNR，dB↑ | Static32 PSNR，dB↑ |
| --- | --- | --- | --- |
| StreetGaussian | 26.7143 | 24.3508 | 26.0845 |
| S3Gaussian | 26.4839 | 22.5082 | 26.6008 |
| 本文 | 26.9053 | 24.3672 | 26.3079 |

相对 StreetGaussian，动态集整体增加 0.1910 dB，物体区域仅增加 0.0164 dB；静态集最高 PSNR 属于 S3Gaussian。本方法 Dynamic32 的 SSIM/LPIPS 为 0.8375/0.1600。没有多种子方差，不能称显著全面优胜。

### TV 牺牲少量插值拟合换取定性稳定

表 2 完整/去 OPG/去 TV 的 Dynamic32 PSNR 为 26.9040/26.7084/26.9075；动态物体 PSNR 为 24.3667/24.2388/24.5692。去 TV 在这些插值指标略好，作者的 TV 收益依靠原图 4 的新视角展示，而非闭环事故统计。训练开销“几乎不变”是作者文字陈述，没有具体时间、显存或投影计算量表。[§5.4，表 2](https://arxiv.org/html/2605.21032v1#S5.SS4)

## 应用场景与启发

### 将冻结策略作为可检验的归纳偏置

本报告判断：几何充分拟合后再限制时间外观，适合已有高质量刚体资产的外观修复。可检验假设是它减少偏视角时的错误反射，而不是恢复单轨迹中唯一真实的外观函数。

## 局限与阅读风险

### 理论条件和代码缺口

作者承认 OPG 依赖干净几何，漂浮物会错误吸收时间变化，且不能处理行人非刚体运动。附录 B.4 的包含关系使用完整时间基，并除以 $B(t)$ 却未保证分母非零及商平方可积；不能直接推广到实际 16 维基。正交雅可比与改变原模型 Fisher 信息之间还需明确参数化/优化实现。附录 D 写 SH 阶数 2，附录 G 写 degree 1，也未解释差别。

2026-09-12 [官方记录](https://arxiv.org/abs/2605.21032v1)及附录 H 只核实到数据集与基线仓库，未核实 OPG 自身代码、配置或场景权重入口。本次没有运行重建或独立证明认证。

## 后续跟进

### 用真正留出的方向检验

先取得投影实现及带同步多方向观测的序列。复制同一 23K 步几何检查点，固定总步数和对象轨迹，做 OPG/TV 的四组组合，仅用训练方向优化，在未参与训练的方向测图像误差、表面稳定和灯开启时刻。成功需偏方向误差下降而灯状态误差不恶化；若收益只在日志插值，或 TV 把刹车灯推迟超过一个采样帧，则停止扩展到闭环评测，先处理观测不足与时间正则的取舍。
