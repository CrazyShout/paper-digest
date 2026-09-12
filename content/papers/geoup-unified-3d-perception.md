---
{
  "id": "geoup-unified-3d-perception",
  "tag": "dynamic-scene-representation",
  "tags": [
    "dynamic-scene-representation"
  ],
  "title": "Geometry-Grounded Unified 3D Perception for Autonomous Driving",
  "source": "BMVC 2026 accepted / arXiv:2608.13147 / https://arxiv.org/abs/2608.13147 / Project: https://buaa-colalab.github.io/geoup_page",
  "authors": [
    "Longfei Xu",
    "Xiaohui Wang",
    "Zehao Huang",
    "Han Li",
    "Ya Yang",
    "Naiyan Wang",
    "Si Liu"
  ],
  "affiliations": [
    "School of Computer Science and Engineering, Beihang University",
    "School of Computer Science, Beijing University of Posts and Telecommunications",
    "School of Artificial Intelligence, Beihang University"
  ],
  "comment": "GeoUP 将 VGGT 的重建式几何 latent 适配到标定的多相机视频，再让深度、3D 检测和语义 occupancy 成为同一场景表征的表面、实例与体积读出。联合五个数据集后，Occ3D-nuScenes 达到 42.3 mIoU 和 47.0 RayIoU。"
}
---

## 一句话定位

GeoUP 把多图像三维重建预训练的 VGGT 改造成驾驶感知骨干：先在标定的环视视频中组织几何，再由不同任务头读出深度、3D 检测和语义占据。重点是共享表征的几何来源，以及异构监督如何共同训练。

- 核心证据：同为 ViT-L、8 帧和 OPUS-V2 类解码器，Occ3D-nuScenes 上 mIoU/RayIoU 从复现基线 39.9/45.2 提高到 41.5/45.9。[表 4](https://arxiv.org/html/2608.13147v1#S4.T4)
- 主要边界：联合训练改善检测与占据，却使深度略退步；四帧全模型仅 0.81 FPS，离实时部署仍有距离。

## 论文要解决的问题

### 问题与假设

识别预训练擅长语义分类，但同一辆车的深度、检测框和占据可能由不同后端各自推断几何。GeoUP 的假设是，先学习多视角重建，再适配相机标定与时间关系，可以让表面、实例和体积共享更有效的场景特征。

这里的统一主要发生在骨干：任务头仍不同，未要求它们在每个空间位置严格一致。推理输入是已知内外参的多相机历史图像；训练会使用深度、相机、检测和占据标注，不能描述成无需三维监督。

### 相关工作与差异

| 工作与一手来源 | 已有机制 | GeoUP 的变化 |
| --- | --- | --- |
| Wang 等，2025，[VGGT v1 §3](https://arxiv.org/html/2503.11651v1#S3)，此处按固定预印本核对 | 交替单图/全局自注意力，同时预测相机、深度、点图与跟踪特征；第一张图为参考 | 在同相机时间、同时间跨视角间分解交互，并输入标定射线；增加驾驶检测与占据读出 |
| Chen 等，2026，[USR-Drive v1 §3](https://arxiv.org/html/2608.19036v1#S3)，预印本 | 从已知位姿视频出发，联合去噪几何和检测框潜变量 | GeoUP 是共享特征后分别解码，没有迭代联合生成；任务头互益与生成过程中互相纠正是两种接口 |

## 方法和系统设计

### 输入输出与流程

DINOv2 将每帧图像编码为 patch token，历史 patch 缓存避免重复图像编码。每个 patch 加入由相机内外参构造的六维 Plücker 射线嵌入，再拼接一个相机 token 和四个 register token。每路相机以当前帧为时间参考，而不是把整个多相机窗口都视为无顺序的图像集合。

骨干依次做单图、同相机跨时间、同时间跨相机注意力；12 个块由 VGGT 的 24 个块隔层选取初始化。DPT 头预测深度，RayDN 类头预测框/类别/速度，OPUS-V2 类头读取多帧特征预测当前占据。检测保留四帧查询历史，占据头用八帧特征，不能把这两个数字都等同于默认四帧骨干窗口。[§3–4.2](https://arxiv.org/html/2608.13147v1#S3)

### 关键公式与直觉

原式 1–3 的核心可缩写为：

$$
\widetilde X_t^v=X_t^v+\mathrm{MLP}(\mathrm{Proj}(K_t^v,E_t^v)),\qquad
F^{l}=\mathrm{Attn}_{v}^{l}\bigl(\mathrm{Attn}_{t}^{l}(\mathrm{Attn}_{s}^{l}(F^{l-1}))\bigr).
$$

这里省略了射线投影的 patch 坐标参数；$t,v$ 表示时间与相机，$K,E$ 为内参与相对位姿，$s,t,v$ 三种注意力分别组织局部、时间和跨视角证据。比如侧前方车辆在不同相机和历史帧中出现，网络既利用纹理，也能根据射线判断空间对应；标定有误时，这种先验也会有误。[§3.1](https://arxiv.org/html/2608.13147v1#S3.SS1)

按标注可用性选择损失，是联合数据集训练的关键。将附录式 15 重组为：

$$
\mathcal L=0.1m_d\mathcal L_d+0.1m_c\mathcal L_c
+m_b\mathcal L_b+m_o\mathcal L_o+m_{2D}\mathcal L_{2D}.
$$

$m$ 是该样本有无相应监督的掩码，下标分别为深度、相机、框、占据及辅助 2D 检测。深度使用 L2 与梯度约束，框用匹配/分类/回归及去噪监督，占据用语义分类与点回归；深度和相机项在第二阶段降权至 0.1。没有占据标签的数据不会自动变成占据真值。[附录 A](https://arxiv.org/html/2608.13147v1#A1)

### 训练与推理

第一阶段只适配深度和相机分支，第二阶段加入检测、占据与辅助 2D 监督。统一深度尺度为 90 m；检测框回归共享，但不同数据集类别头和空间范围分开，占据只在 nuScenes 上监督。

单数据集采用 AdamW、batch 16、初始学习率 $4\times10^{-4}$，nuScenes/AV2/Waymo 分别 24/6/24 epoch。五库混合比例为 8:8:9:3:1，改用 Muon、batch 64、学习率 $6\times10^{-4}$，训练轮数加倍。因此联合模型的增益同时含数据、优化器和预算变化。相机预测是辅助几何监督，其输出不直接驱动感知头；效率实验仍计入该头。[§4.2](https://arxiv.org/html/2608.13147v1#S4.SS2)

## 关键图与可视化结果

![原论文图 5：相同场景下的语义占据对照](https://arxiv.org/html/2608.13147v1/vis_occ.png)

按输入、GT、OPUS-V2、GeoUP 从左到右观察道路和两侧结构。更完整的预测未必逐体素正确，特别是 GT 自身有稀疏或遮挡区域；图中没有雷达输入或未来占据时间轴。[图 5](https://arxiv.org/html/2608.13147v1#S4.F5)

![原论文图 6：预测深度形成的前后向点图](https://arxiv.org/html/2608.13147v1/vis_depth.png)

左侧为多视角图像，右侧为前后点图，观察路面、墙面和车体的空间连续性。可视化表明几何可读出，不能替代深度数值、自由空间校准或规划安全评测。[图 6](https://arxiv.org/html/2608.13147v1#S4.F6)

## 实验结论与证据

### 设置与指标

检测遵循 nuScenes、AV2、Waymo 各自协议，Waymo 使用 20% 训练集；占据在 Occ3D-nuScenes，深度在 KITTI/DDAD。mIoU 衡量语义体素重叠，RayIoU 结合射线命中距离；深度 Abs Rel 越低越好，阈值准确率越高越好。数据集分数与不同分辨率的消融不能拼成一张统一排名。

### 主要结果与比较

| 原表位置与设置 | 比较 | 结果 | 阅读重点 |
| --- | --- | --- | --- |
| 表 4，ViT-L、8 帧占据 | OPUS-V2 复现 → GeoUP → 五库联合 | mIoU 39.9 → 41.5 → 42.3；RayIoU 45.2 → 45.9 → 47.0 | 单库对照更接近骨干比较；联合版额外训练条件不同 |
| 表 1，nuScenes 检测 | GeoUP → 五库联合 | mAP 57.9 → 59.2；NDS 64.4 → 65.3 | 不是相同训练数据/预算 |
| 表 5，KITTI 深度 | GeoUP → 五库联合 | Abs Rel 0.072 → 0.075；阈值准确率 93.8% → 92.9% | 联合模型退步 |
| 表 5，DDAD 深度 | GeoUP → 五库联合 | Abs Rel 0.114 → 0.123；阈值准确率 89.5% → 87.6% | 不应写成联合训练改善全部任务 |

AV2 表 2 的单库 mAP/CDS 为 37.2/28.2，而 §4.3 文字写 34.3/25.6；这里保留这一原文冲突，未自行选取一组作为已消除歧义的结果。规划表 6 固定 DriveSuprim 解码器，GeoUP 比 DA-ViT-L 的 EPDMS 提高 0.8/0.9 点，两项分别属于原始/修正评测器，不能混算。[表 2](https://arxiv.org/html/2608.13147v1#S4.T2)、[表 6](https://arxiv.org/html/2608.13147v1#S4.T6)

### 消融与证据边界

相同新增块结构下，用 VGGT 初始化而非随机初始化，检测 mAP 提高 2.5 点、占据 mIoU 提高 1.7 点；检测/占据联训也分别比单任务提高 0.5 点。分解注意力后再加射线编码的对照支持几何适配的价值，但没有跨种子误差范围。[表 7、9–10](https://arxiv.org/html/2608.13147v1#S4.T9)

单 H20、batch 1、672×224 分辨率、预热 20 次再测 100 次，全模型 1/4 帧为 2.18/0.81 FPS。模块计时分别合计 440.3/1210.0 ms，与 FPS 倒数口径略有差别，应保留端到端和模块合计的区分。四帧骨干本身为 1062.1 ms；性能收益有明确成本。[附录 B，表 11–12](https://arxiv.org/html/2608.13147v1#A2)

## 应用场景与启发

- 作者主张：几何预训练可统一驾驶感知并迁移到规划。
- 我的判断：适合作为多任务研究骨干或离线教师；当前速度不支持直接视为实时方案。
- 待验证假设：缓存经过几何交互的历史特征，而不只缓存图像 patch，可以明显降低四帧开销，并保留动态对象上的几何收益。

## 局限与阅读风险

作者强调效率和解码器统一仍有空间。报告进一步需要保留：多库训练的深度负迁移；不同训练预算和优化器的混杂；AV2 表文冲突；标定噪声、恶劣天气与长期失效尚未系统评估。共享 latent 没有自动保证三任务输出一致，也没有给出感知不确定性校准。

## 后续跟进

### 最小验证与停止条件

- 资源状态（2026-09-12）：[官方仓库](https://github.com/buaa-colalab/GeoUP)有实现、训练/测试脚本和配置；[HF](https://huggingface.co/s1lencexw/GeoUP)列出两阶段各两个 PTH 权重文件。数据仍需分别从五个原始库取得；未下载权重或确认所有数据访问权限。
- 最小实验：先固定 nuScenes 单库、分辨率、训练步数和任务头，比较原四帧计算与历史特征缓存；测 mAP、mIoU、Abs Rel、动态区域误差、p95 时延和峰值显存。
- 成功信号：缓存明显减少实际时延，并在动态交互片段中保持原有几何收益。
- 停止/转向：速度来自减少输入或移除任务，或遮挡恢复误差显著增加，则不支持等能力缓存；转向轻量骨干蒸馏。

### 来源与核验记录

固定依据 Xu 等 arXiv:2608.13147v1 的 §3–4、附录 A–C，核对 PDF 首页与原图 5/6。2026-09-12 arXiv 页面已列出 v2，并注明 BMVC 2026 accepted；本报告没有混入未逐项比较的 v2 数值。相关机制读取 VGGT v1 和 USR-Drive v1 原文。完成内容与资源目录核验，不代表复现。
