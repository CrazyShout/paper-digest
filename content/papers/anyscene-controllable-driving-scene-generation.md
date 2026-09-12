---
{
  "id": "anyscene-controllable-driving-scene-generation",
  "tag": "world-models",
  "tags": [
    "world-models",
    "autonomous-driving-testing",
    "3d-reconstruction"
  ],
  "title": "AnyScene: Towards Highly Controllable Driving Scene Generation at Anywhere and Beyond",
  "source": "arXiv:2605.26113 / https://arxiv.org/abs/2605.26113 / Fixed full text: https://arxiv.org/html/2605.26113v1 / Project: https://mind-omni.github.io/projects/mindsim/anyscene/index.html",
  "authors": [
    "Haiming Zhang",
    "Junfei Zhou",
    "Feng Jiang",
    "Jingzhong Li",
    "Zhenglong Guo",
    "Penglin Dai",
    "Jifeng Dai",
    "Yan Xie",
    "Benjin Zhu"
  ],
  "affiliations": [
    "Li Auto",
    "Southwest Jiaotong University",
    "Tsinghua University"
  ],
  "comment": "AnyScene 从可编辑 BEV 布局生成语义占据，再用显式几何缓冲逐步扩展相机视频。它适合场景数据合成；量化视频比较采用有参考图的协议，任意相机与稀疏重建收益主要由定性示例支撑。"
}
---

## 一句话定位

AnyScene 以占据体连接 BEV 布局和多视角视频：先决定三维结构，再按相机位姿生成外观。它把“换场景布局”和“换相机配置”分成可组合操作。

- 核心证据：I2V 协议下 49 帧 FVD 为 57.57，对照 GenieDrive 为 92.52；这不是任意相机、无参考图模式的等条件测试。[表 3](https://arxiv.org/html/2605.26113v1#S4.T3)
- 主要边界：交通主体由预设 BEV 序列控制，没有针对 ego 行动的反应机制。

## 论文要解决的问题

### 布局控制如何保持几何一致

BEV 只给二维布局，视频却需补足高度、遮挡和跨相机外观。作者先生成视角无关的占据，再将同一体积投影到各个相机，减少独立生成视角时的对应混乱。

### 相关工作与差异

| 一手工作 | 已有机制 | 本文改变 |
| --- | --- | --- |
| Li 等，[UniScene v1 §3](https://arxiv.org/html/2412.05435v1#S3)，CVPR 2025 | 布局→占据，再以 Gaussian 渲染的语义/深度指导视频，同时生成 LiDAR | 本文加强布局 token 交互和因果时序，并设计逐步视角外扩；没有同等 LiDAR 生成分支 |
| Lu 等，[InfiniCube v1 §4](https://arxiv.org/html/2412.03934v1#S4)，ICCV 2025 | 稀疏体素外扩、语义/坐标缓冲指导 SVD，再前馈重建动态 3DGS | 本文沿用几何缓冲思路，重点改为多视角生成模式组合；不能把几何条件本身写成新概念 |

## 方法和系统设计

### 布局、占据与相机坐标

BEV 为 256×256、0.4 m 分辨率的 15 通道 multi-hot 图，包含十类主体和五类地图元素；同一格可以激活多类。占据范围为 ego 周围 $[-51.2,51.2]^2\times[-5,5]$ m，体素 0.4 m，输出 256×256×25、21 类。布局编码将活跃类别嵌入相加，空格用独立嵌入；占据 VAE 将高度类别嵌入并入通道，用二维网络压缩。

STOccDiT 将布局和噪声占据 token 拼接，先帧内注意力，再因果时间注意力。GGVE 用 fVDB 渲染语义、三维坐标缓冲和六通道 Plücker 相机射线；所有视角需对齐到同一占据坐标。主文称 ego ROI，附录组装在当前 LiDAR 系并做位姿校正，发布时仍需核对两坐标系映射。

### 训练目标和自回归条件

VAE 原式 2 为：

$$
L_{\rm VAE}=L_{\rm focal}+\lambda_1L_{\rm Lovasz}+\lambda_2L_{\rm KL}.
$$

focal 项侧重难例/稀有类，Lovász 项约束分割重叠，KL 规整潜变量；训练后 VAE 冻结。附录式 3 对占据潜变量加噪：

$$
z_t^{\tau}=(1-\tau)z_t+\tau\epsilon_t.
$$

$t$ 是场景时间、$\tau$ 是扩散时间。模型用加权速度 MSE 学习去噪，小目标权重来自布局；训练看到干净历史 token，推理只能回用自己已生成的占据，不能沿用 GT 历史。[§3.2、附录 B.2](https://arxiv.org/html/2605.26113v1#S3.SS2)

### 冻结分支与视角扩展

GGVE 基于冻结 Wan2.1-T2V-14B、T5 和视频 VAE，只训练八层 VACE 风格 ControlNet。训练混合无锚点生成及一/两锚点外扩；六相机无参考生成需四次调用：先前三视角，再补左右后视角，最后补正后方。已生成视频充当后续锚点，外部参考图可选。“无参考”是无需外部真实图，不是没有内部锚点。

占据训练用八张 A100 80GB，STOccDiT 每 GPU batch 2，两阶段各 500 epoch、学习率 $2\times10^{-4}$；第二阶段启用时间层及历史扰动，推理 30 步 Euler、CFG 2。视频训练为 480×832、49 帧、学习率 $2\times10^{-5}$，但正文写 5k steps、附录写 10k，无法视为唯一完整配方。未给端到端时延；驾驶域数据仅 nuCraftv2，仍继承 Wan 的预训练知识。

## 关键图与可视化结果

![原论文图 2：占据扩散与几何约束的视角外扩](https://arxiv.org/html/2605.26113v1/pipeline_v4.png)

上半部看 token 拼接和时间掩码，下半部看冻结视频主干、几何控制与生成视角成为锚点的顺序。虚拟相机通过改变查询位姿插入，无需为每台相机重训。[图 2](https://arxiv.org/html/2605.26113v1#S3.F2)

![原论文图 4：布局、占据、多视角与天气编辑示例](https://arxiv.org/html/2605.26113v1/qualitative_vis.png)

(a) 对齐布局和视频，(b) 展示新视角/十二相机，(c) 改变天气文本。这些是精选外观控制例子，不是他车会主动响应 ego 的证据。[图 4](https://arxiv.org/html/2605.26113v1#S4.F4)

## 实验结论与证据

### 指标的不同参照

表 1 生成占据的体积 mIoU/IoU 为 19.01/15.58，BEV 对输入布局为 52.45/68.97；前者对 GT 体素，后者衡量条件遵从，不能当作同一指标的提升。VAE 表 2 的高重建分数也不等于从布局生成时同样准确。

| 表 3，同帧数 I2V：GenieDrive → AnyScene | FVD ↓ |
| --- | ---: |
| 8 帧 | 55.93→35.98 |
| 16 帧 | 63.65→43.19 |
| 49 帧 | 92.52→57.57 |

视频 mIoU/mAP 为 38.26/27.73，对照 30.97/19.17；它们由 BEVFormer 对生成视频预测后与标注比较，属于控制检查，不是用合成数据训练检测器后的提升。任意相机模式没有同等定量基线；附录图 17 仅展示 VGGT 点云更密，没有重建精度/完整率数值。

### 消融与原文不一致

表 4 完整占据模型 mIoU/IoU 为 19.61/11.94，移除 teacher forcing 为 3.23/0.98，改用加法布局条件为 13.59/7.60。该表完整行与表 1 数值不同，配置关系未明确；24→16 层的 mIoU 是 19.61→12.22，即降低 7.39 点，而正文写 4.25。表 5 16 帧视频 FVD：完整 43.19，去语义/坐标/二者为 47.05/52.59/112.20，较直接支持两种几何缓冲。[表 4–5](https://arxiv.org/html/2605.26113v1#S4.T4)

## 应用场景与启发

- 作者主张：可编辑布局形成可扩展的多视角数据生成接口。
- 我的判断：适合离线场景合成与相机布置研究，尚不是反应式驾驶模拟器。
- 待验证假设：新增虚拟视角能提高真实未见视角的几何精度，而不只是增加生成点的数量。

## 局限与阅读风险

作者明确不建模交通流或反应主体。nuCraftv2 还融合检测器、SAM3/SAM3D、KISS-ICP、静态重建及地图覆盖，GT 不是单纯传感器测量。正文的 12 Hz 与附录 20 Hz 构造如何对齐未说明；类映射与坐标也需统一。没有跨种子方差或闭环安全测试。

## 后续跟进

### 最小验证与停止条件

- 资源（2026-09-12）：[官方项目页](https://mind-omni.github.io/projects/mindsim/anyscene/index.html)有演示，但 Code 按钮指向 `#`；未确认实现、配置、权重或 nuCraftv2 完整下载。
- 前置条件：取得固定模型和数据，确认频率、GT 来源及 5k/10k 训练版本。
- 最小实验：固定原六视角、VGGT 和重建过滤阈值，比较仅真实六视角、增加生成视角、增加重复视角；用独立留出的真实相机/激光几何评价精度、完整率及动态对象误差。
- 成功信号：生成视角超过重复视角并降低未见实测误差；若只让点云更密却增加错误表面，停止将密度当重建收益，先检查生成几何。

### 来源与核验记录

2026-09-12 读取 arXiv:2605.26113v1 全文及附录 A–C、式 1–4、表 1–5，逐张打开图 2/4；比较来自 UniScene v1 与 InfiniCube v1 自身方法。项目页核对作者单位与发布入口。未进行生成或重建实验。
