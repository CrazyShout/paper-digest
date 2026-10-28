---
{
  "id": "ride-splat-windshield-reflection-removal",
  "tag": "3d-reconstruction",
  "tags": ["3d-reconstruction"],
  "title": "RIDE-Splat: Reflection Removal for In-the-Wild Driving Environments",
  "source": "arXiv:2610.34632v1 / https://arxiv.org/abs/2610.34632v1 / 固定全文 https://arxiv.org/html/2610.34632v1 / 预印本 / 项目页 https://ridesplat.github.io/ / 仓库 https://github.com/ridesplat/ride-splat / 数据 https://github.com/ridesplat/ride-splat/releases/tag/dataset-v0.1",
  "authors": ["Kevin David Hayes", "Alex Hanson", "Allen Tu", "Pranav Asthana", "Matthias Zwicker", "Tom Goldstein"],
  "affiliations": ["University of Maryland, College Park"],
  "comment": "RIDE-Splat 用共享二维反射层把挡风玻璃反光从三维场景中分离，并提供三段真实反射数据。公开默认实现还加入衰减与逐帧曝光参数，复现时需与正文的简化模型分开比较。"
}
---

## 一句话定位

RIDE-Splat 利用一个坐标系差异去除反射：道路内容随相机运动产生视差，仪表台等车内物体的反光却大致停留在图像同一位置。方法把前者交给 3D Gaussian Splatting，把后者交给所有帧共享的带符号 RGB 图像；在三类数据上报告了较好的去反射渲染结果。真实三场景仍使用近似对齐的跨遍历参考，且公开代码的默认训练配置比正文模型更丰富。[§III–VI](https://arxiv.org/html/2610.34632v1#S3)

## 论文要解决的问题

### 反光为什么会被重建成道路的一部分

行车记录仪隔着挡风玻璃拍摄时，观察到的是道路、玻璃衰减和车内反射的叠加。标准 3DGS 会试图用同一三维场景解释所有像素；反光缺乏正常的世界坐标视差，优化却可能为它创建错误高斯，留下漂浮内容或模糊纹理。

本文输入是带反射的视频帧与相机位姿，输出是可以按普通 3DGS 路径渲染的场景。正文方法不要求训练用的干净图像或人工反射掩码，但假设主要反射半透明、在相机坐标中近似静止。同行车辆、车头等图像中近似不动的真实内容也可能被共享反射层吸收，这个分解并不唯一。

### 相关工作与差异

| 工作与一手来源 | 已有机制 | RIDE-Splat 的具体变化 |
| --- | --- | --- |
| Wang 等，DC-Gaussian，NeurIPS 2024；[正式论文 §3.2–3.4](https://proceedings.neurips.cc/paper_files/paper/2024/file/b51b50262b492dd89bb9cd3105a46702-Paper-Conference.pdf) | 用学习的透明度图融合透射与遮挡；共享哈希特征描述遮挡外观，位置条件的 MLP 调节强度，并引入几何先验。 | 正文将主要反射简化为共享、可正可负的 RGB 残差图，再通过估计支持区域重训练；公开默认实现的额外参数另述。 |
| Fu 等，RobustSplat，ICCV 2025；[正式论文 §3.2–3.4](https://openaccess.thecvf.com/content/ICCV2025/papers/Fu_RobustSplat_Decoupling_Densification_and_Dynamics_for_Transient-Free_3DGS_ICCV_2025_paper.pdf) | 利用 DINOv2 特征训练逐帧瞬态掩码，延迟高斯增密，并逐步提高掩码监督分辨率。 | 不把污染区域直接当成整块无效像素，而显式拟合半透明、相机附着的残差，保留该区域里可用的道路信号。 |

## 方法和系统设计

### 一个三维场景，加一张共享的带符号图

令 $T_i=\operatorname{render}(G;\pi_i)$ 为高斯场景 $G$ 在位姿 $\pi_i$ 下的透射图像。原文式 (1)–(2) 先考虑衰减与附加辐射，再近似其主要静止分量：

$$
I_i\approx(1-\alpha)\odot T_i+L_r
=T_i+(L_r-\alpha\odot T_i),\qquad \hat I_i=T_i+R.
$$

$\alpha$ 为玻璃衰减系数，$L_r$ 为附加反射辐射；$R$ 近似二者合成的残差，所以允许负值。负残差可以表达透射亮度损失，不能将整张 $R$ 解释为非负的物理反射光。由于真实残差还随 $T_i$ 变化，一张固定图只是低容量近似。

不同帧的道路纹理有视差，较难由固定 $R$ 一起解释；固定车内反光则难由一致的世界几何解释。优化利用这个差异分配两类内容，不依赖预训练反射去除网络。[§III-A–B](https://arxiv.org/html/2610.34632v1#S3.SS1)

### 先建立几何，再限制反射作用区域

第一遍先仅训练 3DGS，2,000 次迭代后激活 $R$，以免反射图在几何尚未形成时吸收全部残差。按式 (3)–(4)，光度损失以渲染加反射去拟合输入，并加 $\beta\lVert R\rVert_1$ 正则，默认 $\beta=0.01$；它倾向让模糊归属的像素仍由三维场景解释。

第一遍得到 $R$ 后，方法用反射幅度生成连续支持权重。将式 (5)–(6) 整理为：

$$
a(u)=\max_q\lvert R_q(u)\rvert,\quad b=\kappa_\sigma*a,\quad
W(u)=\frac{b(u)-\min_v b(v)}{\max_v b(v)-\min_v b(v)+\varepsilon},\quad R_{\mathrm{eff}}=R\odot W.
$$

$q$ 遍历 RGB 通道，$\kappa_\sigma$ 是高斯平滑核，默认 $\sigma=8$ 像素。取绝对值保留正、负残差，取通道最大值避免强单色响应被平均冲淡；$W$ 只限制反射在哪里发挥作用。第二遍从头联合优化 $G,R$，固定 $W$，沿用几何预热，最终只渲染 $G$。正文模型不为 $W$ 增加可训练参数。[§III-C](https://arxiv.org/html/2610.34632v1#S3.SS3)

### 公开默认实现另有衰减与曝光参数

2026-10-28 发布的代码需要单独说明。在固定提交 `48720b1` 中，默认第二遍除 $R,W$ 外，还训练逐像素衰减 $A$，以及逐帧 RGB 增益和偏置；`--minimal` 才移除这两项。代码的训练观测模型实际形如：

$$
\hat I_i=(1-A)\odot(g_i\odot T_i+b_i)+R\odot W.
$$

$A$ 限制在 0–0.9，$g_i,b_i$ 向恒等变换正则化。README 称论文数字使用这些默认设置，而正文只展开共享 $R$ 与固定 $W$ 的模型，并称第二遍不新增优化参数。因此，报告中的实验值保留为作者结果，不能将全部增益归于单独的支持图或共享残差；需用最小模型和公开默认配置配对验证。额外参数仅用于训练，测试时仍渲染高斯场景。[固定运行入口](https://github.com/ridesplat/ride-splat/blob/48720b128f767341bce3b8adfd6c8143430fa73e/run_ridesplat.py#L42)、[参数与预测公式](https://github.com/ridesplat/ride-splat/blob/48720b128f767341bce3b8adfd6c8143430fa73e/ridesplat/reflection.py#L31)、[作者配置说明](https://github.com/ridesplat/ride-splat/blob/48720b128f767341bce3b8adfd6c8143430fa73e/README.md#configuration-used-in-the-paper)

## 关键图与可视化结果

![原论文图 2：共享反射层、支持区域估计与第二遍场景拟合](../../assets/papers/ride-splat-windshield-reflection-removal-figure-2.png)

第一行把带反射输入分成 3DGS Scene 与 2D Reflection；第二行根据恢复出的反射估计空间权重，再拟合去反射场景。图强调两遍优化的数据流。具体实现应结合上一节的代码配置阅读，不能只据此图认定第二遍仅训练高斯参数。[原图 2](https://arxiv.org/html/2610.34632v1#S3.F2)

![原论文图 4：真实反射与合成反射场景的渲染比较](../../assets/papers/ride-splat-windshield-reflection-removal-figure-4.png)

列顺序为 3DGS、DC-Gaussian、RobustSplat、RIDE-Splat、Ground Truth；前两组是真实数据，随后为 XLD 和 Wayve。彩色框对应窗户、路牌、车辆和树木等局部细节，可同时观察反射残留与场景纹理损失。图内 PSNR／LPIPS 是所展示帧的数值，数据集平均另见表 II；DC-Gaussian 这一列也不是使用测试真值校色的 oracle 版本。[原图 4](https://arxiv.org/html/2610.34632v1#S6.F4)

## 实验结论与证据

### 真实三场景和两组精确合成参考

真实 RIDE-Splat 数据集评测 Leesburg、Martin、Reston 三场景，共 268 张反射训练帧和 90 张非反射评价帧。每个场景前后两次驶过同一路线，相机安装不变，中间仅移除仪表台反射物；以 COLMAP 联合注册两次遍历。评价图像未进入光度拟合，但参与了共同坐标系的位姿恢复，不能把“未用于训练”理解为整个预处理完全不接触评价图像。交通、照明与轨迹仍只能近似对齐。[§IV、表 I](https://arxiv.org/html/2610.34632v1#S4)

XLD 包含六个合成城镇，每个使用 150 张训练图和 28 张横移 1 m 的干净评价图；Wayve 使用五段真实场景，每段 176 张训练、24 张评价图。两者只在训练帧加入合成反射，因此保留精确干净目标；附录所用反射没有闪烁和漂移。这三类设置应分别报告，不能用合成数据上较大的收益代表真实挡风玻璃效果。

### 平均效果与校色对照

| 表 II，数据集／方法 | PSNR（dB）↑ | SSIM ↑ | LPIPS ↓ |
| --- | ---: | ---: | ---: |
| 真实三场景，RobustSplat | 18.30 | 0.7317 | 0.5216 |
| 真实三场景，RIDE-Splat | 18.48 | 0.7428 | 0.4873 |
| 真实三场景，DC-Gaussian + Oracle GT Color Correction | 20.25 | 0.7442 | 0.5109 |
| XLD，RobustSplat | 21.64 | 0.8815 | 0.4891 |
| XLD，RIDE-Splat | 25.23 | 0.8980 | 0.4006 |
| Wayve，RobustSplat | 20.19 | 0.7364 | 0.4424 |
| Wayve，RIDE-Splat | 20.84 | 0.7422 | 0.4179 |

在不访问测试目标的几种方法中，RIDE-Splat 的九项数据集平均指标领先；跨场景则为 38/42 项领先。它仍有局部退步，例如 Reston 的 PSNR 为 19.21 dB，低于 RobustSplat 的 19.42 dB；Wayve scene_001 的 SSIM 和 LPIPS 也未超过标准 3DGS。[§VI、附录 B](https://arxiv.org/html/2610.34632v1#A0.SS2)

DC-Gaussian 的原始评价是重组反射与透射后，对比带遮挡的观察图；本文改为对透射图直接评分。Oracle 变体再使用每张测试目标拟合全局二次颜色变换，是额外的真值访问，不是原始方法的常规输出。它在真实三场景的 PSNR、SSIM 高于 RIDE-Splat，后者保留 LPIPS 优势。因此，“九项平均指标领先”必须限定为无测试目标校色的方法。[§V-C、表 II](https://arxiv.org/html/2610.34632v1#S5.SS3)

### 自定位并未改善所有指标

XLD 的逐项消融为：3DGS → 共享反射联合优化 → 加自定位，PSNR 为 21.37 → 24.78 → 25.23 dB，SSIM 为 0.8824 → 0.8968 → 0.8980；LPIPS 却为 0.4882 → 0.3994 → 0.4006。最后一步的 LPIPS 略差，尽管正文称自定位改善了全部指标。这里按表 III 数值理解为像素／结构指标改善与感知距离的小幅取舍；上述公开默认配置差异还需要专门的实现对照。

反射漂移实验只用 Town01、单个种子和第一遍 Reflection Layer。150 帧内每帧横移 0–1.2 像素，最大累计 180 像素时，PSNR 范围为 0.65 dB。该结果支持对所测水平漂移的容忍，未覆盖独立反射视差、形变或强烈光照变化。[表 III–V](https://arxiv.org/html/2610.34632v1#S6.SS1)

## 应用场景与启发

对行车视频重建，先建立一个低容量的相机坐标残差模型，是比立即引入大型反射去除网络更容易检验的起点。它给出一条明确假设：污染主要固定在传感器坐标，而道路具有足够视差。这个假设也适用于某些有保护玻璃的机器人相机，但需要重新测量壳体反射的运动规律。

当前最值得跟进的是归因：共享反射、空间支持限制、显式衰减和逐帧曝光分别贡献了什么。把这些项分开后，才能判断模型是否恢复了更可靠的场景几何，还是主要完成了更灵活的外观校正。用于闭环仿真或罕见事件重放是作者提出的用途，论文没有给下游驾驶收益。

## 局限与阅读风险

方法容易混淆车头、共速车辆等相机坐标近似静止的真实内容，也受前视稀疏视角和动态场景重建限制。真实评价目前只有三场景，跨遍历参考并非像素级真值；合成反射实验又采用静止、低频污染，覆盖范围有限。

公开版本的两遍训练默认各 30K 次迭代。作者 README 报告单 A100 每场景约 1.5–3 小时，测试渲染不增加反射模块，但离线拟合仍有成本。公开图像经过人脸和车牌模糊处理，而论文数字来自模糊前图像；即使按官方默认参数运行，也不应要求与论文逐位一致。

## 后续跟进

### 最小验证与停止条件

- 当前资源：代码、CLI 参数、三场景运行脚本已公开；`dataset-v0.1` 发布资产为 676,002,205 字节，链接可访问。发布页说明包含三场景与 COLMAP 位姿；本轮未下载整包。XLD／Wayve 的合成反射构造脚本尚未发布，未核实已训练的场景权重。
- 最小实验：在同一公开场景、相同位姿和两个 30K 预算下，比较标准 3DGS、共享 $R$、$R+W$ 的 `--minimal` 配置，以及加入衰减／曝光的公开默认配置。评价使用相同模糊后目标，同时单列反射区、车辆和远处静态区域。
- 成功信号：去反射收益在无额外曝光参数的对照中仍存在，并且没有把稳定可见的道路物体删入反射层；多种子结果支持而非偶然的指标变化。
- 停止或转向条件：若主要收益来自仿射校色或跨遍历差异，先改进评价与光度模型；若共速车辆被系统性去除，则需在引入更自由的反射运动前增加几何约束。

### 来源与核验记录

依据 2026-10-25 提交的固定 v1，2026-10-28 阅读方法、数据、实验、局限及附录，核对表 II–IX、原图 2 与 4。作者单位来自论文与官方项目页。DC-Gaussian、RobustSplat 的比较分别对照正式全文方法章节。资源检查固定到代码提交 `48720b128f767341bce3b8adfd6c8143430fa73e`，核对 README、运行入口及反射参数实现，并以 release API 和 HEAD 检查数据资产；未下载整包或运行训练。自定位 LPIPS 退步与公开默认实现差异均保留，不将论文描述改写为已经复现的结果。
