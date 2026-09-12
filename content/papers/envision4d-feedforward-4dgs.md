---
{
  "id": "envision4d-feedforward-4dgs",
  "tag": "3d-reconstruction",
  "tags": [
    "3d-reconstruction",
    "world-models"
  ],
  "title": "Envision4D: Envisioning Visual Futures via Feed-forward 4D Gaussian Splatting for Autonomous Driving",
  "source": "arXiv:2606.10656v1 / https://arxiv.org/abs/2606.10656v1 ; project: https://maggiesong7.github.io/research/Envision4D/",
  "authors": [
    "Qi Song",
    "Yifei He",
    "Chi Zhang",
    "Zheng Fu",
    "Xuhe Zhao",
    "Mengmeng Yang",
    "Kun Jiang",
    "Rui Huang",
    "Diange Yang"
  ],
  "affiliations": [
    "Tsinghua University",
    "The Chinese University of Hong Kong, Shenzhen"
  ],
  "comment": "从少量未标定图像预测未来相机与时间条件 Gaussian 位移，以渲染和 VGGT 伪监督学习短期外推；需要区分未来帧主比较、全序列消融及原版插值基线。"
}
---

## 一句话定位

Envision4D 从少量未标定图像预测未来相机参数和动态 Gaussians，用短期几何外推生成后续视图。它的贡献是把未来位姿与物体运动一起预测；没有验证动作条件规划或闭环交通行为。

## 论文要解决的问题

### 插值能力不等于未来预测

插值可使用目标时刻两侧观测，外推只有历史信息，还需猜测 ego 相机的未来位置。固定速度难处理转弯和加速；完全依赖重建损失又容易用目标帧自身的 Gaussians 走捷径。作者用目标时刻条件运动和排除自身帧的渲染约束解决这些问题。[v1，§3](https://arxiv.org/html/2606.10656v1#S3)

### 核对两个直接基线

[STORM 自身 §3.1](https://arxiv.org/html/2501.00602v1#S3.SS1)输入已知内外参，通过共享运动基和前后速度将多帧 Gaussians 汇聚到目标时刻，短片内采用恒速假设。[DGGT 自身 §3.1–3.2](https://arxiv.org/html/2512.03004v1#S3)使用未标定图像，预测相机、动态分解和轨迹，再插值运动与相机。其 motion head 是预训练初始化后光度微调，并非 Envision4D 正文所称的冻结 tracker。Envision4D 的比较应理解为将这些方法改造到未来外推，不代表它们原始插值任务的优劣。

## 方法和系统设计

### 输入输出与坐标

默认给两帧上下文，预测其深度和 Gaussian 的中心、四元数、尺度、RGB、不透明度，同时输出上下文及两帧未来的相机参数。中心由预测深度和相机反投影到共同三维表示；文章未充分说明尺度归一化和评测对齐，不能直接把其速度称为 m/s。推理没有输入未来图像、未来位姿、光流或 tracker；训练仍使用未来 RGB 和冻结 VGGT 产生的相机/深度伪监督。[§3.1、§3.4、附录 A](https://arxiv.org/html/2606.10656v1#A1)

### 时间条件位移与位姿精修

式 (1)、(6) 的核心关系为：

$$
\mu_{i\to j}=\mu_i+v_{i,j}(j-i),\qquad m_{i,j,n}=E_j\odot f_{i,n}.
$$

$i$ 为观测帧，$j$ 为目标帧，$\mu$ 为 Gaussian 中心；$v_{i,j}$ 随目标时刻改变，因此不是对所有未来固定一个速度。$j-i$ 是帧索引间隔，$f_{i,n}$ 是位置 $n$ 的运动特征，$E_j$ 是文中目标时刻/ego 运动先验，逐元素调制后经 DPT 预测三维位移率。这个结构提供时间条件，不等于严格物理约束。[§3.3](https://arxiv.org/html/2606.10656v1#S3.SS3)

未来相机 token 初始化为末个观测 token 加可学习偏移，再拼时间嵌入。附录 A 指明两层、16 头的共享注意力块循环四次，最后经冻结相机头解码。作者叫它“迭代去噪”，但式 (3)–(5) 没有定义随机扩散过程或噪声采样器。

### 训练如何避免自身重建捷径

冻结 VGGT 的四个中间位置插入时间注意力，借后续层传播运动信息；相机/深度 L1 自蒸馏约束防止特征偏移。先几何 warm-up 2,500 步，再排除目标帧自身 Gaussians 做跨帧渲染，用 MSE+0.05 LPIPS 学运动；未来损失从较小权重逐渐放开，衰减系数在 50K 步内从 1 降至 0。完整训练为单 A100、batch=2、350×518、100K 步，没有逐测试场景优化。[§3.2–3.4、附录 A](https://arxiv.org/html/2606.10656v1#S3.SS4)

## 关键图与可视化结果

### 原图 2：位姿和运动共同预测

![原图 2：层内时间注意力、未来位姿精修与运动提升](https://arxiv.org/html/2606.10656v1/pipeline.png)

从左至右是上下文、冻结几何主干中的新增注意力、pose/motion 分支、4D Gaussians 与未来渲染。图中三帧是示意，主实验默认两帧输入。

### 原图 3：改造后的外推比较

![原图 3：Waymo 上 STORM、DGGT、Envision4D 与 GT](https://arxiv.org/html/2606.10656v1/compare1.png)

列为三个场景，行依次是两种基线、本方法、真实目标；黄色框突出车辆拖影、阴影和静态结构。图支持选定样例的改善，没有单独验证 motion mask 或 scene flow 的精度。

## 实验结论与证据

### 只将相同未来帧协议并列

主比较使用 Waymo/nuScenes 官方 validation，默认两帧上下文预测两帧未来，只统计未来帧；具体抽帧时间间隔未在正文充分披露，不能将六帧写为六秒。表 1 的星号基线由作者在该外推设置重做。[§4.1、表 1](https://arxiv.org/html/2606.10656v1#S4.SS1)

| Waymo 外推 | PSNR，dB↑ | SSIM↑ | D-RMSE↓ | A100 推理时间↓ |
| --- | --- | --- | --- | --- |
| STORM* | 26.19 | 0.798 | 6.13 | 0.12 s |
| DGGT* | 24.38 | 0.756 | 7.67 | 0.56 s |
| Envision4D | 27.81 | 0.816 | 3.98 | 0.37 s |

D-RMSE 原表未给单位/尺度协议，不能补成米。相对 STORM*，PSNR 增加 1.62 dB，时间约为 3.08 倍（本报告计算）。原版 DGGT 的 27.41 dB/0.846/3.47 来自插值，不能混作同条件比较。nuScenes 表 2 同样引用原版基线：本方法 26.86 dB/0.815/0.164，DGGT 26.63/0.813/0.122，LPIPS 更低的是 DGGT。

### 消融看机制，远期仍会下降

表 5 统计全序列，包含排除自身 Gaussian 的上下文重建：位姿预测+线性速度基线 PSNR 25.41；加入 CML 为 27.29，增加层后时间注意力为 28.01，完整层内方案为 28.83 dB。附录 B.2 关闭两项渐进训练为 27.89/0.829/0.160，完整为 28.83/0.849/0.145；这些数不能直接减主表的 27.81 得到收益。

固定两帧上下文，预测未来从 2 扩到 6 帧，PSNR 27.81→26.21、LPIPS 0.159→0.192；仍优于相应 STORM 外推，但不是不积累误差。位姿 AUC@30 以全序列计分，VGGT 输入全部目标图，本方法只看上下文；它不是未来位姿专属统计。[表 3–5、附录 B](https://arxiv.org/html/2606.10656v1#A2)

## 应用场景与启发

### 可借鉴目标相关的运动参数

本报告判断：将速度写成源帧到目标帧的关系，并通过跨帧渲染约束，比只拟合当前重建更适合短期预测。待验证假设：在相同预测相机和 Gaussian 几何下，时间条件位移仍能比仅由上下文估计的恒速外推改善未来动态区域。是否能用于规划仍取决于相机与物体未来的多解性，文章未提供行为概率或风险校准。

## 局限与阅读风险

### 已承认的失效与公开资源

作者承认远处快速接近对象线索不足，且纯重建难生成完全未见区域。没有重复试验区间、专门的动态预测真值指标或闭环评测。2026-09-12 [官方代码](https://github.com/maggiesong7/Envision4D)有 src/config 和 Waymo 测试配置，[官方权重目录](https://drive.google.com/drive/folders/1gi5AZU6ljWNFqnf2Z3ZciC3YZDT-rpOk)可见 Envision4D_Waymo.ckpt；本次只核目录，没有下载、运行或验证完整数据准备流程。

## 后续跟进

### 将相机误差和运动误差分开

先锁定检查点、相同抽帧/边界裁剪和数据划分。固定同一检查点的预测相机与 Gaussian 属性，比较原 CML 与推理时的恒速替换：后者只根据上下文帧之间的预测位移除以对应时间间隔估计每个源 Gaussian 的速度，再用于各未来时刻，不读取未来 GT。两组渲染相同目标相机，按两、四、六帧统计动态区域渲染误差；再仅为诊断替换 GT 相机，评估多少误差来自 ego 预测。成功需 CML 在真实相机预测条件下持续改善动态区域且不损静态区；若改善只在 GT 相机或上下文重建中存在，则停止声称未来预测收益，转向相机模型和遮挡处理。
