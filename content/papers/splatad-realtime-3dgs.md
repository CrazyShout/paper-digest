---
{
  "id": "splatad-realtime-3dgs",
  "tag": "3d-reconstruction",
  "tags": [
    "3d-reconstruction",
    "end-to-end-autonomous-driving"
  ],
  "title": "SplatAD: Real-Time LiDAR and Camera Rendering with 3D Gaussian Splatting for Autonomous Driving",
  "source": "CVPR 2025 / https://openaccess.thecvf.com/content/CVPR2025/html/Hess_SplatAD_Real-Time_Lidar_and_Camera_Rendering_with_3D_Gaussian_Splatting_CVPR_2025_paper.html / arXiv:2411.16816 / https://arxiv.org/abs/2411.16816 / Full text: https://arxiv.org/html/2411.16816v3",
  "authors": [
    "Georg Hess",
    "Carl Lindström",
    "Maryam Fatemi",
    "Christoffer Petersson",
    "Lennart Svensson"
  ],
  "affiliations": [
    "Zenseact",
    "Chalmers University of Technology"
  ],
  "comment": "SplatAD 用球坐标 LiDAR rasterization 和扫描运动补偿，从同一套高斯渲染相机、距离、强度与掉点；PandaSet 上相对 NeuRAD 的相机/LiDAR 吞吐约提高 12.5/17.7 倍，但动态对象仍限于刚体。"
}
---

## 一句话定位

SplatAD 在同一套可编辑静态/刚体高斯上分别构造相机与 LiDAR 渲染器，重点是用球坐标分块和传感器运动近似，把强度、掉点和扫描畸变纳入快速 splatting。它是多模态传感器渲染方法，本文没有报告端到端驾驶策略的闭环收益。

- **核心证据**：PandaSet NVS 中，相比 NeuRAD，相机 PSNR 从 25.80 提高到 26.76 dB，吞吐从 9.7 提高到 121.5 MP/s；LiDAR 吞吐从 1.1 提高到 19.5 MR/s。[表 1–2](https://arxiv.org/html/2411.16816v3#S4.T1)
- **主要边界**：动态对象全部按刚体建模，需要框与轨迹；高吞吐是已拟合场景的渲染速度，逐场景训练约一小时。[§3.1、§3.4、§5](https://arxiv.org/html/2411.16816v3#S3)

## 论文要解决的问题

### 任务、输入与假设

输入是车辆日志中的相机图像、LiDAR 回波及其强度/采集时间、传感器标定与位姿、动态对象框及轨迹。输出是在指定传感器位姿和时间下的 RGB、LiDAR 距离、强度与掉点概率，可改变自车或其他对象的位置。普通相机 3DGS 渲染深度再转点云，会忽略相机与激光束的原点差异、非均匀扫描和没有返回的射线；NeRF 式多模态体渲染较准确但成本高。[§1–3](https://arxiv.org/html/2411.16816v3#S3)

相机逐行曝光和旋转 LiDAR 一次约 100 ms 的扫描都不是同时发生。高速行驶时，若仍用一个瞬时传感器位置渲染全部像素/激光束，细杆和物体边缘容易错位。SplatAD 用局部恒定速度在投影空间补偿，避免为每个曝光时间重新投影全部高斯。

### 相关工作与差异

| 工作与一手来源 | 已有机制 | SplatAD 的具体差异 |
| --- | --- | --- |
| Tonderski 等，NeuRAD，CVPR 2024（[§3.1–3.3](https://arxiv.org/html/2311.15260v2#S3)；[正式版](https://openaccess.thecvf.com/content/CVPR2024/html/Tonderski_NeuRAD_Neural_Rendering_for_Autonomous_Driving_CVPR_2024_paper.html)） | 以 actor-aware hash 编码的神经特征场联合渲染相机/LiDAR，已有扫描运动、强度、掉点与传感器外观建模。 | 本文将核心表示与求值方式变为 Gaussian rasterization，并为 LiDAR 设计球坐标投影和非均匀分块。多模态或传感器建模本身并非新提出。 |
| Yan 等，Street Gaussians，ECCV 2024（[§3](https://arxiv.org/html/2401.01339v3#S3)；[正式版](https://www.ecva.net/papers/eccv_2024/papers_ECCV/papers/09243.pdf)） | 静态背景与对象局部高斯组合，优化跟踪位姿，并用动态球谐表示时变外观。 | 本文用共享特征加相机 CNN / LiDAR MLP 解码，并直接渲染激光束；不再只把 LiDAR 当初始化和相机深度监督。 |

报告不沿用“首次”的宣传性结论；这里核对了直接相关机制，未执行覆盖全领域的系统查新。

## 方法和系统设计

### 场景表示与数据流

每个高斯包含透明度、三维均值、尺度/旋转构成的协方差、基础 RGB 和可学习特征。高斯的静态/对象归属 ID 固定；对象高斯的均值与协方差存在对象框的局部坐标，按该对象时刻的 SE(3) 位姿变到世界，再转到相机或 LiDAR 坐标。对象位姿与速度有可学习偏移，用于补偿跟踪误差。[§3.1](https://arxiv.org/html/2411.16816v3#S3.SS1)

相机支路采用透视投影、16×16 像素分块、深度排序、带 rolling shutter 的 RGB/特征混合，再由小 CNN 预测逐像素仿射颜色校正。LiDAR 支路将高斯投到方位角/仰角/距离，按实际非均匀激光通道分块，再混合特征并由 MLP 输出强度和掉点。距离由同一高斯序列直接计算，不经过虚拟相机深度图。[§3.2–3.3](https://arxiv.org/html/2411.16816v3#S3.SS2)

### 关键公式与坐标约定

投影空间的 rolling shutter 近似是决定效率的第一组公式，合并原文式 1、3、6：

$$
v^I=J^I(-\omega_C\times\mu^C-v_C+v_{\mathrm{dyn}}),\qquad
t_{\mathrm{pix}}=(p_v/H-1/2)t_{\mathrm{rs}},\qquad
\Delta_i=p-(\mu_i^I+v_i^I t_{\mathrm{pix}}).
$$

$\mu^C$ 为相机坐标中的高斯中心，$\omega_C,v_C$ 为同坐标下相机角/线速度，$v_{\mathrm{dyn}}$ 为对象运动贡献，$J^I$ 为透视投影 Jacobian；$p_v$ 是像素行号，$H$ 为高度，$t_{\mathrm{rs}}$ 是整幅图曝光时间差。速度从对象坐标变到相机坐标时使用旋转作用，不能给速度向量加位姿平移。静态高斯的对象速度项为零，但相机运动项仍存在；位移 $\Delta_i$ 进入 Gaussian 权重计算。[式 1–6、附录 D](https://arxiv.org/html/2411.16816v3#S3.SS2)

LiDAR 需要保留距离维度，而相机图像只需要两维投影：

$$
\mu^S=(\phi,\omega,r)^\top,
\quad r=\sqrt{x^2+y^2+z^2},
\quad\phi=\operatorname{atan2}(y,x),
\quad\omega=\arcsin(z/r),
\quad\Sigma^S=J^S\Sigma^L(J^S)^\top.
$$

这对应式 9–10；$(x,y,z)$ 和 $\Sigma^L$ 在 LiDAR 坐标中，$J^S$ 是球坐标变换 Jacobian。分块横向覆盖固定方位角宽度，纵向覆盖固定数量的实际激光通道，因此允许仰角间隔不均；方位角还要处理 360° 环绕。每块 32×8=256 条射线，不能把它解释成均匀相机像素。[§3.3、附录 A.1](https://arxiv.org/html/2411.16816v3#S3.SS3)

训练与推理使用不同距离统计量。下式整理原文式 12 及其后文字：

$$
r_{i,\mathrm{rs}}=r_i+v^S_{r,i}t_l,
\quad\widehat r_{\mathrm{exp}}=\sum_i\alpha_i\prod_{j<i}(1-\alpha_j)r_{i,\mathrm{rs}},
\quad k=\min\!\left\{i:\prod_{j\leq i}(1-\alpha_j)<0.5\right\},
\quad\widehat r_{\mathrm{med}}=r_{k,\mathrm{rs}}.
$$

$t_l$ 是该激光束相对扫描中点的时间，$v_r^S$ 是径向相对速度；$\alpha_i$ 为按距离排序的有效透明度。期望距离用于可微训练，中位距离用于推理，避免输出落在两个表面之间的“平均点”。存在返回时按这个中位规则取距离，无返回还需由掉点分支决定；它不是物理光线追踪的严格第一交点。[§3.3](https://arxiv.org/html/2411.16816v3#S3.SS3)

### 训练与推理边界

全部参数按场景联合优化 30,000 步。RGB 用 L1/SSIM；LiDAR 期望距离与强度用 L2，掉点用二元交叉熵；line-of-sight 损失惩罚真值距离之前的不透明物，另有 MCMC 的尺度/透明度正则。高斯初始化来自至多 200 万静态 LiDAR 点、各对象额外随机点和远近随机点；MCMC 上限为 500 万高斯。[§3.4、附录 B](https://arxiv.org/html/2411.16816v3#S3.SS4)

A100 上每场景约一小时；所有数据集共用超参数。推理仍需要演员轨迹、传感器位姿/速度和扫描时间模式，但不需要目标图像或真实深度。准确模拟某型号 LiDAR，需要其通道角度、时序、发散角等信息；论文主体测试旋转式 LiDAR，其他扫描形式只是可扩展方向，未全部实测。

## 关键图与可视化结果

![原论文图 2：共享高斯经过相机和 LiDAR 各自的投影、分块与解码器](https://research.zenseact.com/publications/splatad/methodoverview.png)

采用作者项目页提供的同一原图 2，避免 arXiv 导出的下方大块留白。上半部是球坐标 LiDAR 与非均匀 tiles，下半部是相机透视与均匀 tiles；两者都在 rasterization 时修正运动。特征解码分别为 MLP/CNN，说明“共享场景”不等于“相同传感器成像过程”。[原图 2 与图注](https://arxiv.org/html/2411.16816v3#S3.F2)

![原论文图 3：SplatAD、NeuRAD 与 Street-GS 的图像细节和错误几何对照](https://research.zenseact.com/publications/splatad/qualitative-comparison.jpg)

从左到右为本文、NeuRAD、Street-GS；上方框选车辆与细杆，下方近车表面强调深度监督的视线错误。可见的锐度/几何差异有助于理解指标，但这些是作者选择的案例，不能替代多序列统计或证明真实碰撞表面无误。原图不是 KITTI/nuScenes 的数据集对照图。[原图 3](https://arxiv.org/html/2411.16816v3#S3.F3)

## 实验结论与证据

### 协议与指标

数据集是 **PandaSet、Argoverse2、nuScenes**，各十条挑战序列；PandaSet/nuScenes 使用六路相机，Argoverse2 使用七路环视相机。以原分辨率、适当裁去自车区域评估，NVS 隔帧训练、其余帧留出；重建任务则训练/评估同一全量帧并开启传感器位姿优化，两种分数不可混比。[§4、附录 F](https://arxiv.org/html/2411.16816v3#S4)

PSNR（dB）/SSIM 越高、LPIPS 越低越好；MP/s 是百万像素/秒，MR/s 是百万射线/秒，都是单模态吞吐，不能直接相加为完整传感器组 FPS。LiDAR 报告距离平方误差的中位数、强度 RMSE、掉点准确率和 Chamfer distance（CD）；原表没有注明各距离指标的物理单位或缩放，本报告保留表值，不换算成厘米或米。

### 主要结果与可比性

| NVS 相机，表 1 | NeuRAD：PSNR / LPIPS / MP/s | SplatAD：PSNR / LPIPS / MP/s |
| --- | --- | --- |
| PandaSet | 25.80 / 0.250 / 9.7 | 26.76 / 0.193 / 121.5 |
| Argoverse2 | 26.18 / 0.310 / 9.7 | 28.42 / 0.270 / 134.5 |
| nuScenes | 26.17 / 0.312 / 11.8 | 27.54 / 0.302 / 106.1 |

PandaSet 相机吞吐比约 12.5 倍；这里同为动态、多模态训练方法，比把 SplatAD 与静态 3DGS 单独比速度更有解释力。训练时间并非也提高十倍：表 1 PandaSet NeuRAD/SplatAD 为 1.3/1.0 小时，nuScenes 为 1.1/1.2 小时。[表 1](https://arxiv.org/html/2411.16816v3#S4.T1)

| NVS LiDAR，表 2 | NeuRAD：CD ↓ / 强度 RMSE ↓ / MR/s ↑ | SplatAD：CD ↓ / 强度 RMSE ↓ / MR/s ↑ |
| --- | --- | --- |
| PandaSet | 1.9 / 0.063 / 1.1 | 1.6 / 0.059 / 19.5 |
| Argoverse2 | 2.6 / 0.058 / 0.9 | 2.8 / 0.052 / 9.5 |
| nuScenes | 6.3 / 0.042 / 1.1 | 1.7 / 0.036 / 5.7 |

PandaSet LiDAR 吞吐提高约 17.7 倍；Argoverse2 的 CD 却从 2.6 变为 2.8，因此不能写成所有模态所有指标均超过 NeuRAD。PVG/Street-GS/OmniRe 的 LiDAR 数字是作者利用六个虚拟相机深度图生成，且只评真实存在的返回点；SplatAD 还必须预测并剔除无返回射线。表中带符号的基线 CD 不能视为完全相同任务。[表 2、§4](https://arxiv.org/html/2411.16816v3#S4.T2)

### 哪个模块实际有证据

| 三数据集 NVS 平均，表 5 | PSNR ↑ | LPIPS ↓ | CD ↓ | 相机 MP/s / LiDAR MR/s |
| --- | --- | --- | --- | --- |
| 完整模型 | 27.58 | 0.254 | 2.4 | 119.6 / 11.6 |
| 去掉相机 rolling shutter | 27.46 | 0.258 | 2.3 | 121.4 / 11.4 |
| CNN 改为 MLP | 27.09 | 0.266 | 2.4 | 122.4 / 11.6 |
| 去掉 EWA 抗锯齿 | 27.46 | 0.281 | 1.7 | 120.5 / 11.7 |
| 去掉 LiDAR rolling shutter | 27.39 | 0.258 | 2.4 | 119.1 / 12.2 |
| 推理改用期望距离 | 27.58 | 0.254 | 4.9 | 119.6 / 11.6 |

中位距离将 CD 从 4.9 降到 2.4，而 RGB 完全不变，这是较干净的模态内机制证据。EWA 改善 LPIPS 却使 CD 高于去掉它的版本，说明外观与点云指标存在权衡；rolling shutter 的全量平均增益较小，细结构可视化才解释其使用价值。原文没有多种随机种子方差，也未量化下游检测或闭环策略提升。[表 5](https://arxiv.org/html/2411.16816v3#S4.T5)

## 应用场景与启发

- **作者主张**：快速多模态渲染可降低大规模自动驾驶仿真的成本。
- **我的判断**：适合研究相机与 LiDAR 的一致性、扫描时序误差及可控传感器重放；与交警肢体动作相关的细节需要非刚体模型，不能直接沿用刚体演员假设。
- **待验证假设**：对薄杆和相邻车辆边界，正确的扫描时序比提高 RGB PSNR 更能减少下游点云检测误差；可在冻结检测器下检验，并控制高斯数和训练预算。

## 局限与阅读风险

### 作者明确承认的限制

所有动态演员按刚体建模；非刚体行人需要其他表示。偏离已观察轨迹的外观仍受训练视角覆盖限制，作者提出利用数据先验改善外推与外观编辑，但本文没有证明这些后续方向。[§5](https://arxiv.org/html/2411.16816v3#S5)

### 本报告的证据边界

掉点概率是数据驱动的传感器统计，不是经过完整电磁/材料标定的激光反射模拟。rolling shutter 使用局部运动近似，强加速度或非刚体表面会超出假设。30 序列 NVS 和修改位姿的视觉分布指标不足以证明任意反事实动作下的物理、语义和策略可信度；也不能以“联合渲染”推断完整传感器组同时达到某个未测实时频率。

## 后续跟进

### 最小验证与停止条件

- **当前资源（2026-09-12）**：[neurad-studio](https://github.com/georghess/neurad-studio)已明确发布 SplatAD，包含 `splatad` 训练入口和配置体系；需要作者 gsplat CUDA 分支。数据集入口可访问，PandaSet 下载位置已迁移至仓库指向的 Hugging Face。未核实逐场景训练权重发布，也未下载数据/权重或编译内核。
- **最小实验**：固定 PandaSet 001 或另一含细杆的公布序列，隔帧划分、同一高斯上限和 30,000 步预算；比较完整模型与只去掉 LiDAR rolling shutter，保留相机分支。测薄结构分区 CD、掉点准确率、固定检测器误检/漏检，以及相机、LiDAR和合计传感器组时延。
- **成功信号**：扫描补偿改善真实留出射线的几何与检测表现，且额外时延足够小；再测试更快自车速度和不同 LiDAR 型号。
- **停止/转向条件**：收益只在训练射线出现、换型号后消失，或“实时”依赖降低通道/图像分辨率；此时应校准扫描模型或明确吞吐条件，不继续扩大部署结论。

### 来源与核验记录

固定全文为 arXiv:2411.16816v3（2025-03-13，含补充材料），正式发表为 [CVPR 2025](https://openaccess.thecvf.com/content/CVPR2025/html/Hess_SplatAD_Real-Time_Lidar_and_Camera_Rendering_with_3D_Gaussian_Splatting_CVPR_2025_paper.html)。2026-09-12 核对 §3–5、附录 A–F、式 1–13、表 1–5；逐张打开原图 2、3，并核对项目页图 2 清晰版本。作者/单位来自论文作者区，相关机制来自 NeuRAD 与 Street Gaussians 原文。本次只做内容与图像核验，未运行模型或闭环测试。
