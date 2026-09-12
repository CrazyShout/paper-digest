---
{
  "id": "diffusion-transformer-wam-scene-prediction",
  "tag": "world-models",
  "tags": [
    "world-models",
    "end-to-end-autonomous-driving"
  ],
  "title": "Diffusion Transformer World-Action Model for AV Scene Prediction",
  "source": "arXiv:2606.12987 / https://arxiv.org/abs/2606.12987 / Fixed full text: https://arxiv.org/html/2606.12987v1 / Code: https://github.com/dlcv-team/latent-world-models-av",
  "authors": [
    "Ruslan Sharifullin",
    "Benjamin Jiang",
    "Kai Xi Chew"
  ],
  "affiliations": [
    "Stanford University"
  ],
  "comment": "这项小规模 DiT 研究将失真、分布质量和运动响应分开评价：校准后扩散样本的 KID 更低，但连贯运动仍不足。论文与公开配置的切分/归一化有差异，完整复现需先固定数据与指标口径。"
}
---

## 一句话定位

论文用小型 DiT 预测动作条件未来，检验“图像更接近 GT”“分布更真实”和“运动听从动作”是否指向同一个模型。答案是三者需要分别检查。

- 核心证据：八秒预测中，回归/校准扩散的 KID 为 0.375/0.078，但 CosSim 为 0.471/0.260，偏好相反。[表 2](https://arxiv.org/html/2606.12987v1#S5.T2)
- 主要边界：模型接收整段未来控制序列，不生成驾驶动作；没有闭环策略成绩。

## 论文要解决的问题

### 从模糊平均到可控未来

回归损失容易得到平均画面，扩散可以保留纹理，却也可能只改变纹理而不推进车辆运动。作者在冻结表征和紧凑预测器上逐步检查目标、空间 token、残差锚点及采样的作用，不足以证明这些选择在任意大模型上都必要。

### 相关工作与差异

| 一手工作 | 原有机制 | 本研究的边界 |
| --- | --- | --- |
| Hu 等，[DrivingWorld v3 §3](https://arxiv.org/html/2412.19505v3#S3)，ICPR 2026 | 位姿和视频离散 token 联合自回归，预测动作后生成帧 | 本文直接输入日志动作，在连续 SD-VAE 空间做小规模受控诊断，没有同等动作预测接口 |
| Zhang 等，[Epona v1 §3](https://arxiv.org/html/2506.24113v1#S3)，ICCV 2025 | 连续表征上用轨迹/下一帧两类 DiT，自回归反馈 | 本文重点比较回归与扩散及重新锚定，未做同协议规划或大模型性能排名 |

## 方法和系统设计

### 输入、输出和两种实验

世界模型读取当前 CAM_FRONT 和未来 $H$ 步 steering/acceleration，预测之后的图像潜变量；$H=4/8/16$ 对应 2/4/8 s。256×256 RGB 经冻结 SD-VAE 得 32×32×4 latent，缩放 0.18215，4×4 patch 形成每帧 64 个空间 token。四层、维度 256、四头 DiT 约 5.4M 参数，动作由每维 64 个学习 Fourier 频率编码，不涉及显式三维世界坐标。

另一个 encoder probe 将六类冻结编码器映射到 384 维后预测动作；V-JEPA2 的十六帧版本与单帧版输入信息不同，不能只当模型架构优劣。论文称动作使用训练集 z-score，RMSE 应按其归一化标度阅读，不直接标成角度或 m/s²；视频 clip 与目标动作的因果时间对齐仍需代码清单确认。[§3–4](https://arxiv.org/html/2606.12987v1#S4)

### 锚点与扩散目标

原式 3–4 的两个要点为：

$$
\hat z_{t+k}=z_t+\Delta_k(z_t,a_{t+1:t+H},\tau),\qquad
L=\mathbb E\lVert\hat Z_0(\tilde Z_\tau,c,\tau)-Z_0\rVert_2^2.
$$

$z_t$ 是所有未来共用的当前锚点，$Z_0$ 是整段干净未来目标，$\tau$ 是噪声时间；不能把 $Z_0$ 误作当前帧。训练预测 $x_0$ 而非噪声，条件 dropout 为 0.1；推理从纯高斯噪声做 50 步确定性 DDIM。回归对照用同架构、零噪声、复制当前 latent，单次前向输出。

共享当前锚点可能抑制运动累积。原式 6 的 1.7M jump 模型每次跨四步：

$$
z_{t+4j}=f_\theta(z_{t+4(j-1)},\bar a_{t+4(j-1):t+4j}),\quad j=1,\ldots,4.
$$

训练用 GT 起点，测试四段链条均用自身预测作下一锚点；重新锚定与共同预测十六步是不同推理协议。

### 校准与成本

每通道均值/尺度校准只在训练集估计，再固定用于测试；后验 oracle 校准须分开。encoder probe 用 Adam、学习率 $10^{-3}$、batch 256、50 epoch、三种子；论文未完整给出各世界模型训练预算、硬件与端到端时延，不能据参数少推断实时。

## 关键图与可视化结果

![原论文图 1：冻结 VAE、动作条件、残差锚点与 DiT](https://arxiv.org/html/2606.12987v1/fig_method_a.png)

先跟随当前 latent 的蓝色残差路径，再看底部噪声输入。VAE 固定，动作编码按方法学习；输入动作是已给定的条件，不是该网络自主产生的控制。[图 1](https://arxiv.org/html/2606.12987v1#S1.F1)

![原论文图 10：真实图像、VAE 重建、回归与扩散完整四行](../../assets/papers/diffusion-transformer-wam-scene-prediction-original-figure-10.png)

前两行区分 tokenizer 损失，后两行区分预测器行为。扩散保留轮廓但过锐化明显，回归模糊；这幅图不支持“高保真运动已解决”。本次保留完整扩散行和原图注。[官方 PDF 第 10 页](https://arxiv.org/pdf/2606.12987v1#page=10)

## 实验结论与证据

### 留出集与指标参照

论文采用 nuScenes 630/70/150 个场景切分，在场景内先聚合以处理重叠窗口。FID/KID 按 §5.6 对比由 GT latent 解码的测试图像分布，非直接对原始相机 RGB；接近 VAE-GT 不等于传感器逼真。表 1 steering RMSE 0.097→0.058 约降 40.2%，属于单帧/十六帧 probe 对比。

| 表 2，$t+16$ | KID ↓ | FID ↓ | CosSim ↑ |
| --- | ---: | ---: | ---: |
| 回归 | 0.375 | 370.8 | 0.471 |
| 原始扩散 | 0.294 | 341.9 | 0.233 |
| 训练集校准扩散 | 0.078 | 162.5 | 0.260 |

大部分分布增益依赖校准，不能只归给 DiT。三种子 KID 汇总另为 0.076±0.005；不要与表中单个展示点或 KID 子集抽样误差混用。

### 动作与运动证据

四十个留出窗口扫 steering 得 $\rho=0.81$，但仅 18/40 达到可检测位移，所谓 100% 方向正确限于这些有效例；回归为 −0.18、39/40 有效。单次扩散连贯低频运动仅 GT 的 0.44，回归为 0.56。jump 模型在三十个留出场景达 1.02 倍运动幅度、方向相关 0.48（对照 0.41），仍有累积模糊；幅度匹配不等于对象轨迹正确。[§5.4–5.5](https://arxiv.org/html/2606.12987v1#S5.SS4)

## 应用场景与启发

- 作者主张：同时评价失真、分布与控制，并用重新锚定改善时间运动。
- 我的判断：有用的是诊断顺序和可比较接口，不能用较低 KID 代替动力学检验。
- 待验证假设：同容量下逐段锚定能改善对象级运动，而非只增加低频画面变化。

## 局限与阅读风险

[公开 canonical.yaml](https://github.com/dlcv-team/latent-world-models-av/blob/main/configs/canonical.yaml)包含 180/20/40 子集与全量 75/10/15 比例，不是论文 630/70/150；动作采用裁剪后的 /6、/10 缩放，也不同于正文 z-score。配置还允许 VQ 权重失败时改用 DINOv2，尚不能确定论文运行是否触发。必须先绑定真实运行清单，再认定六编码器及物理单位比较可复现。

## 后续跟进

### 最小验证与停止条件

- 资源（2026-09-12）：[仓库](https://github.com/dlcv-team/latent-world-models-av)有训练/评价代码、配置和结果目录；[HF](https://huggingface.co/surlac/lwm-av-checkpoints)实际列有 spatial/VAE-direct PT 文件，另有 embedding 资源目录。本次未下载模型或确认全部 diffusion/jump 权重与论文对应；原始 nuScenes 需独立取得。
- 前置条件：先确定 split、归一化、encoder fallback、校准来源与 RGB/VAE-GT 参照。
- 最小实验：同一模型容量/训练帧/动作/预算，比较共享锚点与四步链式锚点，同时保留 raw/训练校准两组；全部窗口计入控制覆盖率，再按场景统计对象光流、位移方向、KID 和失真。
- 成功信号：对象运动改善且控制覆盖率不降；若优势只来自丢弃低位移样本、增加纹理变化或更换参照分布，停止物理真实性主张。

### 来源与核验记录

2026-09-12 读取 arXiv:2606.12987v1 全文、式 1–6、表 1–2及附录 A；逐张打开原图 1 和 PDF 完整图 10。相关方法来自 DrivingWorld v3、Epona v1 自身原文。公开配置差异按现状保留，未运行实验或验收原作者结果。
