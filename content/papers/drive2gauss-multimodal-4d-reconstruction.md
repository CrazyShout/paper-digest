---
{
  "id": "drive2gauss-multimodal-4d-reconstruction",
  "tag": "3d-reconstruction",
  "tags": ["3d-reconstruction", "dynamic-scene-representation"],
  "title": "Drive2Gauss: FeedForward 4D Gaussian Reconstruction from Multimodal Generative Driving Videos",
  "source": "arXiv:2610.26585v1 / https://arxiv.org/abs/2610.26585v1 ; project: https://zttt04.github.io/Drive2Gauss_page/ ; code: https://github.com/zttt04/Drive2Gauss_",
  "authors": ["Tong Zhao", "Zhiyuan Han", "Lin Chen", "Bowen Xie", "Yunxi Qiao", "Bohan Li", "Weiqing Xiao", "Gen Li", "Shu Han", "Xuyang Dai", "Cheng Bi", "Hao Zhao", "Chaojian Li"],
  "affiliations": ["AIR, Tsinghua University", "Tongji University", "Beijing Technology and Business University", "Fuzhou University", "Tsinghua University", "Shanghai Jiao Tong University", "Nanjing University", "Zhejiang University", "University of Wisconsin–Madison", "Great Wall Motor", "The Hong Kong University of Science and Technology"],
  "comment": "先联合生成驾驶视频、深度和动态光流，再以前馈 Gaussian query 聚合成可换视角的场景。生成观测的重建更准确，但大幅横移仍会退化，重建指标也不等于真实未来预测精度。"
}
---

## 一句话定位

Drive2Gauss 把生成的 RGB、深度和动态光流接入显式三维查询：深度决定初始位置，光流连接跨帧位置，多视角特征修正 Gaussian 属性。它适合研究生成视频怎样落到可渲染几何上；论文的主要重建指标衡量对生成观测的还原，另用分布指标评价生成结果与真实数据的差距。

## 论文要解决的问题

### 从未来视频到可移动相机的场景

驾驶视频生成器通常输出固定相机轨迹上的图像。若再用仅接收 RGB 的重建器估计几何，生成误差与深度歧义会叠加，换视角后容易出现重复表面、空洞和运动错位。Drive2Gauss 让生成器同时给出 RGB、度量深度和动态光流，再利用这些信息重建时变 Gaussian 场景。

输入包括参考时刻的六路相机图像，以及未来道路图、三维框、自车轨迹和相机参数。未来控制信号已经给定，论文没有让交通参与者响应规划器动作。这里的“前馈”指 Gaussian 重建无需逐场景优化；上游视频生成仍有扩散采样过程。

### 与相邻方法的差别

| 工作与一手来源 | 已有机制 | Drive2Gauss 改变的环节 |
| --- | --- | --- |
| Chi 等，PointForward，2026 预印本，[原文 §3.1–3.3](https://arxiv.org/html/2605.11594v1) | 用深度与标定相机初始化三维查询；三维框建立实例规范空间，跨视角和时间融合特征 | 查询接收生成的 RGB-D-flow；运动锚点主要来自生成光流与深度，框仍参与生成条件和训练标签构建 |
| Zhu 等，WorldSplat，[正式论文](https://openreview.net/pdf/121ca339c9e3005a74d06c33ee36cef5432bf0de.pdf)、[作者方法页](https://wm-research.github.io/worldsplat/) | 从多模态 latent 预测像素对齐 Gaussian，分离静态与动态区域，再用扩散模型修复新视角视频 | 先解码多模态观测，再聚合稀疏三维查询；直接 Gaussian 渲染与后续 SPVC 修复分开评测 |
| Zhang 等，SplatFlux，2026 预印本，[原文 §3](https://arxiv.org/html/2610.28257v1#S3) | 从视频 latent 直接预测 Gaussian、动态概率和双向速度；静态体素聚合，动态局部插值 | 使用驾驶域的相机、道路与轨迹条件，并显式消费生成深度和光流；两者的输入条件与训练域不同 |

这些比较说明信息怎样进入表征，不构成统一基准下的性能排序。尤其 PointForward 的实例级刚体传播和本文的像素对应传播，约束粒度不同。

## 方法和系统设计

### 联合生成观测，再提升到三维

生成器由 DiST-T 初始化，把 RGB、深度、光流的三组 VAE latent 拼接后共同去噪。训练深度来自多视角估计、聚合 LiDAR 与补全流程；动态光流由 SEA-RAFT、移动三维框投影和 SAM 掩码构造。LiDAR 和这些标注模型属于训练数据制作过程；正常重建使用生成器输出的深度与光流。

深度把源图像像素提升到公共坐标系，得到初始查询位置。光流找到另一时刻的对应像素，再由目标时刻深度提升到三维。随后，查询投影到各相机和时刻的特征图，以交叉注意力聚合可见信息，迭代修正位置。解码头输出中心偏移、尺度、旋转、不透明度、外观特征及时间有效性；渲染特征图再经外观 UNet 得到 RGB。

### 光流怎样约束运动

原文式（7）将目标时刻的锚点写为：

$$
\bar{\mathbf{x}}_i^{f}=\mathbf{x}_i^{s}+p_i^{\mathrm{flow}}\operatorname{clip}_{d_{\max}\lvert f-s\rvert}(\mathbf{x}_i^{f}-\mathbf{x}_i^{s}).
$$

$s,f$ 是源、目标帧，$\mathbf{x}_i^f$ 是经光流对应与目标深度得到的三维位置，$p_i^{\mathrm{flow}}$ 是从光流得到的动态概率，$d_{\max}$ 限制每帧最大位移。动态概率为零时，查询保留源位置；裁剪则缓解异常对应造成的长距离跳跃。它仍依赖生成深度和光流彼此一致，裁剪本身不恢复被遮挡区域的真实运动。

原文式（9）和（10）进一步更新查询并得到 Gaussian 中心：

$$
\mathbf{x}_i^{(j+1)}=\mathbf{x}_i^{(j)}+\Delta\mathbf{x}_i^{(j)},\qquad
\boldsymbol{\mu}_i(t)=\mathbf{x}_i(t)+\Delta\boldsymbol{\mu}_i.
$$

$j$ 表示特征聚合的迭代轮次，$\mathbf{x}_i(t)$ 在时间锚点之间插值，$\Delta\boldsymbol{\mu}_i$ 是学习到的中心修正。这里用随时间移动的三维 Gaussian 表示动态场景，不是学习完整四维时空协方差的原生 4D Gaussian。

### 训练和计算范围

式（11）的重建损失由 Charbonnier 图像项、权重 0.2 的 LPIPS 项，以及不透明度、尺度正则组成，后两项权重分别为 0.001 和 0.02。训练使用 8 张 H20；Gaussian 解码器训练约 4 天，AdamW 学习率为 $10^{-3}$。上述预算不等于仅训练一个轻量查询头，也不包含外部基础模型原始训练成本。

## 关键图与可视化结果

![原论文图 2：多模态视频生成与时空 Gaussian 查询聚合](../../assets/papers/drive2gauss-multimodal-4d-reconstruction-figure-2.png)

图 2 上半部分从参考图像与控制条件生成 RGB、深度和光流，下半部分由右向左展示初始查询、时空特征聚合和 Gaussian 场景。右下角 Q 与 K/V 的区分很关键：三维位置提供查询，生成图像特征提供被聚合的信息；图中的生成器和重建器是两个阶段。

![原论文图 6：横向移动相机后的渲染对比](../../assets/papers/drive2gauss-multimodal-4d-reconstruction-figure-6.png)

图 6 每个场景有上下两行：上行是生成或真实观测，下行是对应重建场景的渲染。可以沿车辆、路缘和建筑边缘查看换视角后的结构稳定性。左侧 GT 列下行为空，图中没有对应横移视角的逐像素真值；也没有逐行标出横移距离，因此具体位移下的表现应读表 III。

## 实验结论与证据

### 先区分生成质量和重建保真度

实验使用 nuScenes 的 700 个训练场景和 150 个验证场景。视频生成覆盖六路相机，每段 17 帧、12 Hz、分辨率 $424\times800$。Gaussian 重建评测只使用前方三路相机，并划为四个连续四帧窗口，起始帧为 0、4、8、12，第 16 帧不进入这些窗口。

表 II 的 PSNR、SSIM 和 LPIPS 以各方法自己生成的 RGB 观测为参考，分别衡量像素误差、结构相似度和感知距离；FID、FVD 则比较渲染结果与原始 nuScenes 图像或视频的分布。前一组指标高，说明重建器保留生成内容较好，并不说明生成内容就是真实未来。

| 原文表 II：生成视频到场景的完整流程 | PSNR ↑，dB | SSIM ↑ | LPIPS ↓ | FID / FVD ↓ |
| --- | ---: | ---: | ---: | ---: |
| DiST-4D + DGGT | 27.76 | 0.825 | 0.200 | 30.17 / 90.70 |
| Drive2Gauss | 29.91 | 0.884 | 0.101 | 12.85 / 32.01 |

RGB 基线使用同一 DGGT 重建器，Drive2Gauss 同时换了生成模态和解码器，因此此表支持整个流程的改善。仅凭它不能把差异全部归因于光流。上游生成本身也有变化：表 I 中 DiST-T 的 FID/FVD 为 6.83/22.67，本文为 6.38/12.43。

### 横移较大时，视频指标出现退步

表 III 固定相机朝向、内参和时间，只将 CAM_FRONT 横向平移。直接渲染结果如下：

| 横移幅度 | DiST-T + DGGT：FID / FVD ↓ | Drive2Gauss：FID / FVD ↓ |
| --- | ---: | ---: |
| ±1 m | 53.44 / 562.22 | 38.38 / 281.27 |
| ±2 m | 73.55 / 744.32 | 59.60 / 605.65 |
| ±4 m | 107.93 / 956.98 | 101.23 / 1025.44 |

在 ±4 m 时，本文的 FID 较低，FVD 却更高。这说明图像质量与视频分布质量并未同步改善，大范围偏离原视点仍受几何和可见区域覆盖限制。表 IV 另接 SPVC 后的结果属于修复流程，其中一些对照还使用真实观测，不能混入直接 Gaussian 渲染的比较。

### 消融与资源代价

表 V 在相同生成输入、查询预算和训练设置下，完整模型为 29.91 dB / 0.884 SSIM；去掉初始光流后为 27.89 / 0.814，去掉迭代修正为 28.03 / 0.827，去掉交叉注意力为 28.76 / 0.849。这组对照比跨生成器比较更直接地支持三个模块，但仍缺少错误光流和不同遮挡强度下的稳健性测试。

表 VI 的 480K、720K、960K 查询预算对应训练峰值显存 45、67、92 GB，单样本推理时间 0.96、1.11、1.29 秒；1200K 出现 OOM。92 GB 是训练峰值，1.29 秒是该表的重建推理计时，都不应写成完整扩散生成到视频输出的部署成本。官方仓库进一步说明 960K 是四帧、三相机窗口的最大查询数，每帧每视角 80K。

## 应用场景与启发

这篇工作适合用来检验“生成运动先验能否帮助显式几何保持一致”。它把深度、二维对应和三维查询的位置关系写得很具体，便于替换某一种先验而保持其余模块不变。对驾驶仿真，更值得追问的是换视角后车辆和车道的几何误差是否可控，而不只是修复后视频是否逼真。

一个可检验的方向是给光流锚点增加遮挡置信度：对新显露区域减弱错误对应，观察大横移和窗口衔接时是否减少漂移。当前实验没有验证这一改动，先验不可靠时它也可能减少有效运动信息。

## 局限与阅读风险

四帧窗口之间的几何连续性没有单独量化；对长序列采用该方法时，需要检查窗口边界是否重复生成或改变物体位置。论文也没有报告闭环驾驶、碰撞或反事实动作下的安全指标，给定未来控制条件的渲染不等于学会交通响应。

生成深度与光流共同决定运动锚点，两者可能相互补偿而保持图像重建较好。三维运动的物理误差需要额外参考，不能由观测重建指标单独判断。论文表格未提供重复运行的方差，模块差异不宜表述成有统计显著性的结论。

## 后续跟进

### 资源与最小验证

截至 2026-11-01，[官方仓库](https://github.com/zttt04/Drive2Gauss_)已有模型源码、训练与推理脚本，以及路径配置模板。[数据说明](https://github.com/zttt04/Drive2Gauss_/blob/main/docs/dataset.md)列出训练场景的 flow、mask、depth 发布和单片段样例；[权重说明](https://github.com/zttt04/Drive2Gauss_/blob/main/docs/checkpoints.md)列出生成器与解码器文件名、大小和校验值。完整数据、权重由 Google Drive 托管，官方说明匿名访问需要登录；本次直接访问这两个下载目录未成功，核实范围是仓库文件、样例发布记录及资源说明，没有下载完整权重或数据来校验其字节。配置模板存在不代表已经配齐上游模型和本机环境。

- 先用官方单片段样例打通生成、解码和渲染，逐项核对帧数、相机数、深度尺度及 flow 通道，保留生成 RGB 作为重建参考。
- 固定同一批 RGB-D-flow、查询数和权重，比较正常光流、置零光流和跨时间打乱光流。分别记录观测重建、±1/±2/±4 m 渲染、遮挡边界和四帧窗口衔接误差。
- 如果正常光流只改善观测重建，却不改善独立视角的几何或时间一致性，就优先检查深度和对应的误差补偿，不继续用更高查询预算解释运动建模收益。计时分别报告生成、Gaussian 解码和渲染阶段。

### 来源与核验记录

本报告依据 [arXiv v1 全文](https://arxiv.org/html/2610.26585v1)，提交日期为 2026-10-19；截至核验日按预印本收录，未核实到正式发表页面。实际阅读了方法 §III、实验 §IV、式（7）—（11）、表 I—VI，并逐张打开图 2 和图 6 检查标签、对照与图注。作者单位依据全文和官方仓库作者栏；相关方法比较另读 PointForward §3、WorldSplat 方法正文与作者页面、SplatFlux §3。所有实验数字均来自原论文；本次没有运行模型或复现实验。
