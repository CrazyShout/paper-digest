---
{
  "id": "pointforward-driving-reconstruction",
  "tag": "3d-reconstruction",
  "tags": [
    "3d-reconstruction"
  ],
  "title": "PointForward: Feedforward Driving Reconstruction through Point-Aligned Representations",
  "source": "arXiv:2605.11594v1 / https://arxiv.org/abs/2605.11594v1 ; project: https://wm-research.github.io/PointForward/",
  "authors": [
    "Cheng Chi",
    "Xianqi Wang",
    "Hongcheng Luo",
    "Mingfei Tu",
    "Gangwei Xu",
    "Zehan Zhang",
    "Bing Wang",
    "Guang Chen",
    "Hangjun Ye",
    "Sida Peng",
    "Xin Yang",
    "Haiyang Sun"
  ],
  "affiliations": [
    "Xiaomi EV",
    "Huazhong University of Science and Technology",
    "Zhejiang University"
  ],
  "comment": "把多视图特征汇聚到三维点查询，并依赖3D框把动态实例对齐到规范姿态；主表画质提升，但仍需标定/轨迹先验，且未报告本模型推理时延。"
}
---

## 一句话定位

PointForward 将深度反投影得到的三维查询与跨视图特征融合，再以场景图对齐动态实例，减少多层重复 Gaussian。它是带标定和对象轨迹条件的重建器，尚未验证未知未来运动或闭环驾驶。

## 论文要解决的问题

### 点对齐解决什么，哪些输入仍须提供

从每个像素独立预测 Gaussian 容易让同一表面在不同视图中形成多层。作者先把像素提升到共同三维系，再采样并融合信息；动态物体则借 3D 框对应关系维持实例一致性。它仍需要图像、相机内外参、跨时对象框；LiDAR 深度可选，不能因此称为无标定或无外部先验。[v1，§3.1–3.2](https://arxiv.org/html/2605.11594v1#S3)

### 与像素方法的准确差别

[STORM 自身 §3.1](https://arxiv.org/html/2501.00602v1#S3.SS1)通过共享运动基约束像素 Gaussian 速度，没有逐个实例框；其运动并非所有像素完全独立。[DGGT 自身 §3.1–3.2](https://arxiv.org/html/2512.03004v1#S3)预测相机、动态 mask、lifespan 与预训练初始化后微调的三维运动头。PointForward 改用已知相机和框轨迹进行几何关联，比较中同时改变了表示与先验，不能把全部收益解释为“点优于像素”。

## 方法和系统设计

### 查询构造与规范坐标

EfficientNetV2 提取图像特征并参与微调，InfiniDepth 深度估计器冻结。每个初始查询有 12 维：三维位置、RGB 和六维 Plücker 射线。静态查询每个输入视图保留 100K，动态查询每个实例保留 10K；总数为 $100000V+10000O$，$V$ 是输入图像数、$O$ 是动态实例数，随场景规模增长。

以实例首个框作参考，按原文行向量写法，式 (2) 将时刻 $j$ 的点变为：

$$
\tilde p=(p-c_j)R_j^\top R_1+c_1.
$$

$c_j,R_j$ 为对象框中心和旋转。此式把点对齐到首框的规范位置，保留 $c_1$，不能误写为以零为原点的局部坐标。投影到其他视图及目标渲染时再按对应框恢复运动；静态点保持世界坐标。框来源、重叠框归属和轨迹噪声处理未详细披露。[§3.1–3.2，式 (1)–(2)](https://arxiv.org/html/2605.11594v1#S3.SS2)

### 跨视图融合与时间可见性

三维查询投影到每个输入相机，采样图像特征及查询深度与预测深度的差；静态查询落进动态框投影区时，其特征置零。网络结合查询特征、时间及“是否同时间”标记预测 softmax 权重，融合后输出 Gaussian。式 (7) 调节目标时刻的不透明度：

$$
o_{t'}=o\exp\left[-\frac12\left(\frac{t'-t}{\sigma+1}\right)^2\right].
$$

$o$ 为原不透明度，$\sigma$ 为预测 lifespan，$t,t'$ 为归一化时间，不能把 $\sigma$ 直接解释成秒。每个 Gaussian 的颜色为 128 维特征，先渲染特征图，再用轻量 UNet 得到 RGB；因此最终画质包含二维解码器的贡献。[§3.3–3.4](https://arxiv.org/html/2605.11594v1#S3.SS3)

### 训练与推理条件

渲染监督是 $\mathcal L_{L1}+0.2\mathcal L_{LPIPS}$。训练用八张 H20、全局 batch=8、45K 步；AdamW 初始学习率 $5\times10^{-4}$，前 2K 步 warm-up 后余弦衰减；576×768 裁剪，混合三种渲染分辨率。Waymo 从头训练重建框架但特征/深度模块已有预训练，nuScenes 从 Waymo 检查点微调。推理不逐场景训练，却仍运行深度、特征、融合和图像解码流程；正文没有本模型的延迟、FPS 或显存实测。[§4.1](https://arxiv.org/html/2605.11594v1#S4.SS1)

## 关键图与可视化结果

### 原图 1：重复表面造成的模糊

![原图 1：GT、DGGT 和 PointForward 的细节比较](https://arxiv.org/html/2605.11594v1/Teaser.png)

五组局部放大关注树干、车辆、招牌、栏杆和建筑；例子支持更清晰的渲染，但不能量化重复 Gaussian 数量或证明唯一物理对应。

### 原图 2：深度、场景图和特征融合

![原图 2：PointForward 的点查询和场景图流程](https://arxiv.org/html/2605.11594v1/Overview.png)

图中深度分支明确接收可选 LiDAR，场景图把静态与动态查询分离；下方再采样多视图特征并解码。这个输入边界比只写“世界空间稀疏点”更重要。

## 实验结论与证据

### 重建、迁移与偏视角分别比较

Waymo 为 798/202 训练/验证序列，训练抽取 2 s、20 帧，三个前相机在 0、0.5、1.0、1.5 s 提供上下文，预测其余帧。主表为日志视图渲染，PSNR 越高表示像素误差越小，SSIM 越高表示结构更一致。[§4.2、表 1](https://arxiv.org/html/2605.11594v1#S4.SS2)

| Waymo 方法 | 完整图 PSNR，dB↑ | 完整图 SSIM↑ | 动态区 PSNR，dB↑ |
| --- | --- | --- | --- |
| STORM | 26.38 | 0.794 | 22.10 |
| DGGT | 27.41 | 0.846 | 22.80 |
| PointForward | 28.48 | 0.861 | 25.01 |

相对 DGGT 增加 1.07/2.21 dB。表 2 的上下文重建 33.96 dB/0.951 对 30.54/0.884，是已输入视图的另一任务，SSIM 差为 0.067，并非正文所说近 0.2。nuScenes 表 3 零样本为 26.54/0.821 对 DGGT 25.31/0.794，SSIM 增加 0.027，并非正文的 0.3；微调后为 27.50/0.826。

表 4 偏视角测试统一单前相机输入，侧移 3/6 m 时 FID：DGGT 77.51/139.79，本方法 33.71/65.99。DGGT 还用 GT 深度对齐绝对尺度，且扩散修复被关闭；PointForward 保留自身 UNet，FID 只衡量分布距离，不能直接证明新位姿几何正确。[§4.3、表 2–4](https://arxiv.org/html/2605.11594v1#S4.SS3)

### 消融及未隔离的变量

表 5 完整 PSNR 28.48 dB，去加权融合/深度差/lifespan 为 28.01/28.28/27.56。无 LiDAR 为 28.00/0.847，但此时改用 MoGe-2 深度先验，不能视为只删除一个传感器的纯对照。lifespan 改善 0.92 dB，也不能直接拿 DGGT 的跨论文消融幅度比较机制优劣。[§4.4](https://arxiv.org/html/2605.11594v1#S4.SS4)

## 应用场景与启发

### 借鉴三维融合而保留先验成本

本报告判断：把多视图证据汇聚到规范化实例和静态查询值得迁移；但收益可能部分来自框轨迹、深度先验及渲染解码器。待验证假设：学习的时空汇聚在对象框有小幅误差时，仍比平均汇聚更能保持动态边界和表面一致性。检验它需固定其他组件与 Gaussian 数；这只能识别汇聚机制，不能证明点表示全面优于像素表示。

## 局限与阅读风险

### 数据说明和发布状态

论文将 nuScenes 写成 750 训练序列，[官方划分源码](https://github.com/nutonomy/nuscenes-devkit/blob/master/python-sdk/nuscenes/utils/splits.py)为 700 train/150 val，实际使用集合需待作者清单确认。时间归一化、框标注来源和深度误差单位也未完全展开。作者承认刚体框模型不擅长行人非刚体运动。

2026-09-12 [项目页](https://wm-research.github.io/PointForward/)有展示，但 Code 按钮 href 为空，仍写发表后放出；未核实本模型代码、配置或检查点。没有运行复现，也没有证据可支持其车端实时性。

## 后续跟进

### 固定预算的融合稳健性对照

取得代码、框轨迹及划分后，固定深度、相机、UNet、训练步数和 Gaussian 预算，做“平均/学习汇聚”×“原始/小幅扰动框”的配对试验；扰动幅度在独立验证集确定，测试时冻结；测留出帧动态边界、深度误差、重复表面数量及包括深度在内的端到端延迟。位置与朝向扰动在两种汇聚中使用同一随机样本。成功需同预算、相同噪声下几何与边界均改善；若收益仅在无扰动 GT 框存在，或必须更强解码器才能维持，则不支持稳健融合假设，先处理实例关联。
