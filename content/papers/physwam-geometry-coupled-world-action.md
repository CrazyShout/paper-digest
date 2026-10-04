---
{
  "id": "physwam-geometry-coupled-world-action",
  "tag": "world-models",
  "tags": ["world-models", "end-to-end-autonomous-driving"],
  "title": "PhysWAM: Physically Consistent World Action Model for Autonomous Driving",
  "source": "Technical Report / arXiv:2609.37970v1 / https://arxiv.org/abs/2609.37970v1 / 固定全文 https://arxiv.org/html/2609.37970v1",
  "authors": ["Dhruv Parikh", "Fengcheng Yu", "Quankai Gao", "Jiawei Yang", "Junjie Ye", "Maulik Bhatt", "Thang Vu", "Charles Ochoa", "Rowan McAllister", "Igor Vasiljevic", "Rajgopal Kannan", "Viktor Prasanna", "Vitor Guizilini", "Yue Wang"],
  "affiliations": ["University of Southern California", "Woven by Toyota", "Toyota Research Institute", "DEVCOM Army Research Office"],
  "comment": "把生成深度和自车运动放进同一三维残差，用实测 LiDAR 同时纠正两者。规划收益有同配方消融支持，但每条计划仍需数个 GPU 秒，尚未验证实时驾驶。"
}
---

## 一句话定位

PhysWAM 同时生成未来视频、度量深度和自车运动，再检查“按这条轨迹移动后，这份深度描述的世界是否仍与实测几何相符”。它把世界预测与动作之间的联系写成一个可反传的三维误差，而不只依靠共享 Transformer 让两者自行对齐。

- **核心证据**：同一训练配方移除 Coupled Point Projection（CPP）后，NAVSIM-v2 navtest 的 EPDMS 从 90.3 降到 88.4，navhard 从 38.1 降到 36.2；均为每场景单次采样的作者报告值。[表 1–3](https://arxiv.org/html/2609.37970v1#S4.T3)
- **主要边界**：30 步采样每条计划需 9.4 GPU 秒，且训练依赖 LiDAR、准确位姿及其他几何标签。几何一致性与仿真得分尚未转化为实时实车能力。[表 16、附录 D](https://arxiv.org/html/2609.37970v1#A3.T16)

## 论文要解决的问题

### 一起生成，不一定描述同一个未来

设想车辆左转时，生成视频里公交车已经离开，但动作分支仍按公交车停在原处选择路线；或者深度预测把路沿放远了，而位姿预测又让自车转得太急。视频和轨迹各自接近日志目标，并不自动保证它们组合后形成合理的三维场景。

本文输入当前前、左前、右前三路图像、相机标定、文本驾驶上下文和近期自车运动，生成未来 4 秒的视频、深度与八步相对位姿。训练时额外使用同步 LiDAR、真实位姿、障碍物及可行驶区域标签。它检验的是记录轨迹附近的几何一致性；离开记录轨迹后的反事实预测仍需要独立证据。[§3.1–3.4](https://arxiv.org/html/2609.37970v1#S3)

### 相关工作与差异

| 工作与一手来源 | 已有机制 | PhysWAM 改变的环节 |
| --- | --- | --- |
| Zhang 等，Epona，ICCV 2025；[正式页](https://openaccess.thecvf.com/content/ICCV2025/html/Zhang_Epona_Autoregressive_Diffusion_World_Model_for_Autonomous_Driving_ICCV_2025_paper.html)，机制按[v1 §3.2–3.3](https://arxiv.org/html/2506.24113v1#S3.SS2)核对 | 历史图像和动作形成共享上下文，分别进入下一帧视频 DiT 与轨迹 DiT；视频可接模型动作或外部动作，纯规划可单独运行轨迹分支。 | PhysWAM 在一次联合去噪中生成三路 RGB、深度和位姿，再对深度与位姿施加同一几何残差。Epona 的模块化规划路径说明，视频 WAM 并非都必须在每次规划时完整渲染未来。 |
| Lu 等，GeoWAM，2026 arXiv；[v3 §3、§4.6](https://arxiv.org/html/2608.23486v3#S3) | 先预测未来几何特征，再让动作头读取几何动态；最新版补充 PhysicalAI 数据预训练和未来几何消融。 | PhysWAM 让生成位姿参与深度反投影，CPP 的动作梯度依赖当前生成几何，深度梯度也依赖生成位姿。两者的监督、视角数、骨干和采样预算不同。 |

本文表 2 引用的是 GeoWAM 较早配置的 36.6。当前 GeoWAM v3 的完整配置报告 **39.6**，并新增消融；因此 PhysWAM 单样本 38.1 不能写成超过 GeoWAM 最新结果。PhysWAM 八样本 medoid 为 39.8，但采样预算和预训练资源仍不匹配，0.2 分差不足以识别哪种几何机制更好。[GeoWAM v2 表 3](https://arxiv.org/html/2608.23486v2#S4.T3)、[v3 §4.6](https://arxiv.org/html/2608.23486v3#S4)

## 方法和系统设计

### 三种输出共享生成过程

RGB 和按对数编码的深度共用冻结的视频 VAE；动作使用平移及旋转的连续表示。相机射线编码提供标定几何，位置编码对齐视角、空间位置和时间。Cosmos 3 的生成通路允许视觉与动作 token 双向交换信息，文本通路和 VAE 保持冻结。当前 RGB 与运动历史保持干净，未来 RGB、当前及未来深度、未来运动共同加噪。[§3.1–3.2，图 2](https://arxiv.org/html/2609.37970v1#S3.F2)

训练 CPP 时不必完成一次多步视频生成。一个预先拟合、随后冻结的轻量深度头，直接将本次前向所得的“干净深度 latent 估计”转换成 VAE 网格上的光轴深度。冻结深度头可以避免它自己调整参数来掩盖生成器的几何错误；梯度仍能穿过它，更新生成 latent。[§3.3、附录 A.2](https://arxiv.org/html/2609.37970v1#S3.SS3)

### 关键公式：一个残差同时约束深度和运动

第一组对应原式 1–2。对待生成表示 $x$ 加噪，并从预测速度恢复干净估计：

$$
x^{\sigma}=(1-\sigma)x+\sigma\epsilon,\qquad
v^{\star}=\epsilon-x,\qquad
\widehat x=x^{\sigma}-\sigma\widehat v.
$$

$\sigma\in[0,1]$ 是噪声程度，$\epsilon$ 为高斯噪声，$\widehat v$ 是模型输出。同一样本的生成模态共用噪声程度，但噪声元素独立。流匹配学习 $v^{\star}$，几何损失则作用于 $\widehat x$，因此一次训练前向就能得到几何监督，不需在训练循环里完整 rollout。[原式 1–2](https://arxiv.org/html/2609.37970v1#S3.E1)

第二组重写原式 6–7，省略 latent 帧索引以突出坐标关系：

$$
\begin{aligned}
\mathcal U_v(d,u)&=d\,\frac{b_v(u)}{b_{v,z}(u)},\\
\widehat P_{v,t}(u)&=\widehat T_t E_v\mathcal U_v(\widehat d_{v,t}(u),u),\\
P^{\star}_{v,t}(u)&=T_t^{\star}E_v\mathcal U_v(d^L_{v,t}(u),u),\\
\mathcal L_{\mathrm{cpp}}&=\frac{1}{\lvert\Omega\rvert}
\sum_{(v,t,u)\in\Omega}\rho_{\delta}
\left(\left\|\widehat P_{v,t}(u)-P^{\star}_{v,t}(u)\right\|_2\right).
\end{aligned}
$$

$u$ 是 VAE 网格单元；$b_v$ 是相机射线，除以其光轴分量后，乘光轴深度 $d$ 就得到相机坐标。$E_v$ 把侧相机映到同一时刻的前相机；$\widehat T_t$ 由生成的相对位姿连乘，$T_t^{\star}$ 来自记录位姿，二者都把未来点放进当前前相机坐标系。$d^L$ 是同一未来时刻、同一单元内 LiDAR 深度的几何均值，$\Omega$ 只包含有有效 LiDAR 支持的对应单元。它比较的是固定单元对应，不是任意最近邻配对。[原式 6–7、附录 A.2](https://arxiv.org/html/2609.37970v1#S3.E6)

生成深度过远、运动变换错误都会增大同一个残差，因此梯度同时流向两个预测。归一化 Huber 惩罚在小误差处为 $e^2/(2\delta)$，大误差处为 $e-\delta/2$，本文 $\delta=0.5$ 米。CPP 只在 2 秒和 4 秒锚点监督有测量支持的射线，仍可能遗漏其他时刻和未观测区域的错误。[表 6](https://arxiv.org/html/2609.37970v1#A3.T6)

### 训练约束与推理条件

总目标还包含逐模态流匹配、避障 hinge 和可行驶区 hinge；后两项直接约束生成位置，不经过生成深度。几何项按输出梯度范数平衡，目标比例为 0.2；两项 hinge 在第 9,000 步后衰减，15,000 步归零。CPP 保留到训练结束。这些设计共同构成训练配方，不能把整套模型与旧方法的差距全归给 CPP。[§3.4、附录 A.3–A.4](https://arxiv.org/html/2609.37970v1#S3.SS4)

模型以 15.2B 参数的 Cosmos 3 Nano 初始化，更新其中 7.0B 的生成通路。NAVSIM navtrain 提供 103,281 个窗口，每窗口一帧当前加八帧未来、2 Hz；前视分辨率为 832×468，两侧为 416×234。训练 30,000 updates、batch 44，AdamW 峰值学习率 $2\times10^{-5}$，使用 RTX PRO 6000 Blackwell；论文未给训练 GPU 数和总 GPU 小时。[§4、表 6](https://arxiv.org/html/2609.37970v1#A3.T6)

推理输入不含未来 LiDAR 或障碍物标签。UniPC 从噪声联合生成 RGB、深度和运动，默认 30 步、无 guidance。多样本版本从八条轨迹中选择与其他轨迹总平面距离最小的一条 medoid；这表示多数生成结果的共识，并不验证它是否安全。oracle-of-8 用真实评价挑最好候选，只是候选质量上界。[§4、附录 A.5](https://arxiv.org/html/2609.37970v1#S4)

## 关键图与可视化结果

![原论文图 2：RGB、深度与动作联合去噪，CPP 联结生成深度和动作](../../assets/papers/physwam-geometry-coupled-world-action-figure-2.png)

先看左侧 RGB、深度、动作进入不同投影，再看中央共享生成器；右侧 CPP 同时接收深度和动作，而两个 hinge 只接动作。图中的真实深度、未来动作和 LiDAR 用于训练监督，不能据这张训练图推断部署时也能获得它们。[原图 2](https://arxiv.org/html/2609.37970v1#S3.F2)

![原论文图 3：有无 CPP 与单、多视角的未来生成和俯视轨迹对照](../../assets/papers/physwam-geometry-coupled-world-action-figure-3.png)

上半行比较有无 CPP，下半行比较三视角与单视角。左侧为当前输入和转弯指令，中间是 +2/+4 秒图像及深度，右侧将自车轨迹与交通对象放在同一俯视图中，标出碰撞位置。它帮助定位“生成场景遗漏他车”和“轨迹碰撞”的联系；这两例不能代表所有转弯，附录图 4 也展示了完整模型的世界预测错误和路沿碰撞。[原图 3、附录图 4](https://arxiv.org/html/2609.37970v1#S4.F3)

## 实验结论与证据

### 先区分三种评价

navtest 包含 12,146 个场景，报告 PDMS 与 EPDMS；分数综合碰撞、道路合规、进展等条件，越高越好，不等于真实道路成功率。navhard 使用 450 个记录场景和 5,462 个合成场景构成双阶段伪仿真，具有有限的交通响应；官方说明它不是逐步交互的连续仿真。HUGSIM 才是本报告中的闭环仿真：436 episodes、每 0.5 秒仿真时间重规划，未进行目标域微调。[PhysWAM §4](https://arxiv.org/html/2609.37970v1#S4)、[NAVSIM 官方说明](https://github.com/autonomousvision/navsim)

### 同配方消融比跨论文排名更有解释力

| 配置，原表 1–3 | navtest EPDMS ↑ | navhard EPDMS ↑ | 条件 |
| --- | --- | --- | --- |
| PhysWAM，去除 CPP | 88.4 | 36.2 | 同一完整训练配方，单样本 |
| PhysWAM | 90.3 | 38.1 | 单样本；相较上行分别增加 1.9 分 |
| PhysWAM，medoid-of-8 | 90.4 | 39.8 | 每次生成八个候选；增加采样成本 |

八候选共识只比单样本提高 0.1 navtest EPDMS，oracle-of-8 却达到 94.1，说明“能生成好计划”和“能选中好计划”之间仍有差距。表 1 的 0.24 PDMS、0.30 EPDMS 标准差描述重复采样，不是重复训练的种子方差；每个训练配置只运行一次。[表 1、附录 D](https://arxiv.org/html/2609.37970v1#S4.T1)

CPP 在训练早期的效应更大：4,000 updates 时，EPDMS 为 78.8，去除 CPP 为 55.7；越界场景比例为 9.7% 对 32.7%，碰撞场景比例为 3.8% 对 9.8%。这些是该检查点的学习速度证据，最终差距缩小，不能把早期 23.1 分差宣传为最终收益。[表 3a](https://arxiv.org/html/2609.37970v1#S4.T3)

| HUGSIM，原表 2b；HD-Score ↑ | Easy | Medium | Hard | Extreme |
| --- | --- | --- | --- | --- |
| BeyondDrive，论文转引 | 65.6 | 31.4 | 26.3 | 16.2 |
| PhysWAM | 86.9 | 30.1 | 25.2 | 13.4 |

PhysWAM 的优势集中在简单场景，后三档均低于该转引基线。作者按 episode 数加权得到整体 RC 48.9、HD-Score 35.5；BeyondDrive 的整体数采用四档等权平均，因此本报告不直接相减两个 overall。HUGSIM 重规划按仿真时间进行，4.4–9.4 GPU 秒的实际单计划成本也没有消失。[表 2、表 16](https://arxiv.org/html/2609.37970v1#S4.T2)

### 深度、采样步数与比较范围

前视未来深度在同一时刻、同一相机的 LiDAR 上评估，不做尺度对齐：+2 秒 AbsRel 为 0.175、阈值精度 $\delta_{1.25}$ 为 0.814，+4 秒分别为 0.232、0.742。AbsRel 是相对深度误差、越低越好；$\delta_{1.25}$ 是误差比落在 1.25 倍内的比例、越高越好。表 3 同时转引了 GeoWAM 在 nuScenes 上的数字，但数据集、相机和深度定义不同，本报告不据此声称跨方法深度领先。[表 3c、附录 C.5](https://arxiv.org/html/2609.37970v1#S4.T3)

LoRA 控制实验从纯 flow 的 84.3 EPDMS，到加 hinge 的 85.7、加 CPP 的 86.2、二者都加的 86.5，支持 CPP 与可行驶约束具有互补贡献。另一个成本实验中，8 步采样需 4.4 GPU 秒，PDMS 比 30 步参考高 0.7；不同设置重复次数为 1–4，证据不支持“采样步越多越可靠”。[表 3b、表 16](https://arxiv.org/html/2609.37970v1#A3.T16)

## 应用场景与启发

- **作者主张**：共同的度量几何残差可以让世界生成与动作规划相互约束，帮助规划和跨场景仿真迁移。
- **我的判断**：最值得迁移的是 CPP 的训练接口。它可以将深度错与运动错放到同一坐标系诊断；实际规划系统是否必须保留昂贵的视频生成通路，还未验证。
- **待验证假设**：固定标签与采样预算后，CPP 的收益应在近距离动态对象和转弯区域更明显。若将这些区域的对应关系打乱，仍能取得同样收益，则提升可能主要来自额外几何正则，而非所解释的深度—动作耦合。

## 局限与阅读风险

作者明确承认：训练依赖标定 LiDAR、准确轨迹、稠密度量深度及障碍物/可行驶标签，当前监督尚不能直接扩展到大量无 LiDAR 视频；CPP 只约束记录未来，离轨指令和超过 4 秒的自洽性仍是开放问题；仅测试一个骨干、一个规模、每配置一次训练；尚无 action-only 推理和实时运行验证。[附录 D](https://arxiv.org/html/2609.37970v1#A4)

几何相符也不足以判断交通语义，例如红灯或交警指令。本文的“物理一致”特指所定义的几何残差和若干视频/运动诊断，不是完整动力学约束或交通规则保证。表中跨论文结果的采样、标签和预训练范围不同，尤其要保留 GeoWAM v2/v3 的区别。论文未提供逐场景预测与评价产物，本报告中的分数均保留为作者报告值，未独立重算。

## 后续跟进

### 最小验证与停止条件

- **资源状态，2026-10-05**：论文与原图可访问；公开检索未找到可核验的 PhysWAM 官方模型实现、可运行配置或 checkpoint。NAVSIM 官方仓库包含下载与评价入口，但这不等于已经获得 PhysWAM 的深度标签制作流程、预处理产物或训练权重。数据未下载，模型未运行。[论文](https://arxiv.org/abs/2609.37970v1)、[NAVSIM](https://github.com/autonomousvision/navsim)
- **最小实验**：以官方配置/权重及标签规则发布为前置条件，先复现同一小规模 LoRA 设置的 flow+hinge 与 flow+hinge+CPP，再加入“相同 LiDAR 标签但打乱深度—位姿对应”的等预算对照。固定 split、初始权重、样本数和采样步数，记录 EPDMS、NC/DAC、分区域 CPP 残差与 GPU 秒。
- **成功信号**：真实对应的 CPP 在至少三个训练种子中优于两种对照，并同时改善近距离几何和相关安全分项；收益不能只靠舒适度或候选数改变。
- **停止/转向条件**：若打乱对应不损害表现，重新检查模型是否利用耦合信息；若降低几何误差不能改善规划，改查损失覆盖区域；若只有多倍采样才能获益，先研究动作专用推理或候选选择，不扩大训练规模。

### 来源与核验记录

固定依据 [arXiv:2609.37970v1](https://arxiv.org/html/2609.37970v1)，核验日期 2026-10-05。读取主文 §1–5，重点核对式 1–8、表 1–3、6、16，附录 A 的监督与冻结边界、C 的预算和评价、D 的限制；作者与四所机构从全文首页核对。原图 2、3 已逐张打开，对照图注后保存官方原字节。

相关机制分别回到 [Epona v1 §3.2–3.3](https://arxiv.org/html/2506.24113v1#S3.SS2) 与 [GeoWAM v3 §3、§4.6](https://arxiv.org/html/2608.23486v3#S4)，历史比较另外固定 [GeoWAM v2 表 3](https://arxiv.org/html/2608.23486v2#S4.T3)。未执行训练、推理或闭环实验。
