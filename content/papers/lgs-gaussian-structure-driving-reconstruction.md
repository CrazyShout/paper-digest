---
{
  "id": "lgs-gaussian-structure-driving-reconstruction",
  "tag": "3d-reconstruction",
  "tags": [
    "3d-reconstruction"
  ],
  "title": "Learning Gaussian Structure: Intervention-Guided Density Control for Feed-Forward Driving Reconstruction",
  "source": "arXiv:2608.11077v1 / https://arxiv.org/abs/2608.11077v1",
  "authors": [
    "Hang Li",
    "Jiahe Li",
    "Meiying Gu",
    "Jin Zheng",
    "Lina Yu",
    "Xiao Bai"
  ],
  "affiliations": [
    "School of Computer Science and Engineering, Beihang University",
    "State Key Laboratory of Software Development Environment and Jiangxi Research Institute, Beihang University",
    "State Key Laboratory of Virtual Reality Technology and System, Beihang University",
    "AnnLab, Institute of Semiconductors, Chinese Academy of Sciences"
  ],
  "comment": "用增删干预后的邻域梯度响应监督 Gaussian 密度策略，并显式检索跨时间点特征；有同数量随机对照，但最终重建成本与深度指标口径需要分开核对。"
}
---

## 一句话定位

LGS 学习的不仅是每个 Gaussian 的属性，还包括哪些应删除、哪些附近应复制新增；训练监督来自受控干预后的邻域梯度响应，推理用学习的策略调整集合，再精修重建。

## 论文要解决的问题

### 初始化点数不该成为固定容量

每个 LiDAR 点初始化一个 Gaussian，虽保留度量几何，却使稀疏区容量不足、冗余点难删除。前馈模型没有传统逐场景优化积累的密度决策历史；作者希望用跨场景可迁移的策略替代，并显式查找其他时刻的邻近证据。[v1，§1–3](https://arxiv.org/html/2608.11077v1#S3)

### 两种相关三维表示

[Flux4D 自身 §3](https://arxiv.org/html/2512.03210v1#S3)已将带时间戳的 LiDAR Gaussians、速度预测与渲染梯度反馈结合；LGS 在这一类属性精修上新增集合增删。[UniSplat 自身 §3.2–3.5](https://arxiv.org/html/2511.04595v1#S3.SS2)从图像几何先验构造三维骨架，点/体素双分支生成 Gaussians，流式保存静态记忆，训练有 LiDAR 尺度和动态 mask 监督。它不是同输入、同监督的简单主干替换；不能将两者差距全归给密度策略。

## 方法和系统设计

### 输入输出与时间对齐

输入为同步多相机图像、跨帧 LiDAR、已知传感器位姿。点变换到共同三维系但保留采集时刻，稀疏卷积预测位置、旋转、尺度、透明度、颜色残差和速度，按时差移动后渲染。体素为 0.1 m，另用 LiDAR 对齐单目深度及天空采样初始化静态背景。CTPQ 为每个 primitive 查询其他时间戳的八个欧氏近邻，均值池化后残差融合；它不是运动补偿后的同一物体关联。[§3.1、§3.3、§4.1](https://arxiv.org/html/2608.11077v1#S3.SS3)

### 干预目标究竟测什么

原始、删除、新增分支使用同一目标视图和渲染损失，冻结表征网络。式 (3)–(5) 可统一写为：

$$
r_j^{\mathcal B}=\frac1D\sum_{c=1}^{D}\left|\frac{(\nabla_{g_j}\mathcal L^{\mathcal B})_c}{\max_l|(\nabla_{g_l}\mathcal L^{\mathcal B})_c|+\epsilon}\right|,\qquad
\Delta_i^a=\sum_{j\in\mathcal N_i}(r_j^{\mathcal B_a}-r_j^{\mathcal B_0}).
$$

$g_j$ 为邻居属性，$D$ 为属性维数，$l$ 遍历该分支全部 Gaussians；$\mathcal B_0$ 是原始分支，$a$ 为 add/prune。归一化防止不同属性的梯度量级主导目标；$\Delta<0$ 表示邻域梯度响应降低，作者将其作为操作有利的代理。它不是渲染损失的直接下降，也不是人工几何真值。[§3.2](https://arxiv.org/html/2608.11077v1#S3.SS2)

经过带符号对数、z-score 和 sigmoid 映射，目标 $y_i^a\in[0,1]$ 越大表示越有利；具体映射符号和归一化范围未完全展开。Point Transformer V3 根据特征、位置、属性及局部密度预测 $p_i^a$，式 (7) 用加权平方误差训练，权重 $w_i=(2|y_i-0.5|)^2$ 降低模糊目标影响。每轮抽取 20% 的 LiDAR 初始化 primitive、共三轮，新复制位置加入标准差 0.01 m 的高斯扰动。

### 训练分阶段，推理仍有精修

先训练主干和 CTPQ 20K 步，再冻结它们训练策略 15K 步，最后冻结策略微调主干 20K 步，使用八张 GPU，型号和总耗时未报告。推理不运行三条干预分支：prune/add 阈值均为 0.7，两者同时超过时优先删除；之后仍进行属性精修与渲染。无需逐场景训练网络，不等于省略全部迭代或梯度反馈。[§3.4、§4.1](https://arxiv.org/html/2608.11077v1#S3.SS4)

## 关键图与可视化结果

### 原图 2：结构与属性两条路径

![原图 2：跨时检索和增删策略共同构建 Gaussian 集合](https://arxiv.org/html/2608.11077v1/Method.png)

上方是迭代属性预测，下方区分跨时间邻居与仅训练使用的 Add/Origin/Prune 分支。图中的 GT_A/GT_P 是干预派生目标，不能读作真实几何标注。

### 原图 4：Waymo 重建比较

![原图 4：GT、STORM、UniSplat 和 LGS 的新视角渲染](https://arxiv.org/html/2608.11077v1/Exp_1.png)

橙框定位动态车辆，红框定位静态细节。LGS 的边界更清晰是图示证据，没有直接证明碰撞几何或长时物体身份一致。

## 实验结论与证据

### 主表的任务与预算

Waymo 沿用 DrivingRecon 划分，三前视相机、256×512、三帧输入，每十帧留出一帧；PandaSet 另行训练，前相机全分辨率、六帧 LiDAR 初始化，目标帧留出。不是未来动作预测。表 1：UniSplat→LGS 的完整图 PSNR 26.28→28.04 dB、SSIM 0.818→0.885、LPIPS 0.150→0.113；动态区 PSNR 24.37→26.54 dB。[§4.1–4.2](https://arxiv.org/html/2608.11077v1#S4)

PandaSet 表 2 的 LGS 动态/完整图 PSNR 为 22.43/25.03 dB，所称 DMAE 为 2.06/1.52；基线同值在 Flux4D 原表中标为深度 RMSE，例如 STORM 5.24/4.80，因此本报告保留命名冲突，不把两种误差合并比较。Flux4D 本身也未列入 LGS 主对照。

### 数量匹配的消融最有解释力

| Waymo 表 3 | PSNR，dB↑ | LPIPS↓ | Gaussian 数 | 时间，s/frame↓ |
| --- | --- | --- | --- | --- |
| 无 GDP/CTPQ | 26.55 | 0.138 | 519.8K | 1.77 |
| 仅 GDP | 27.68 | 0.119 | 584.2K | 1.82 |
| 仅 CTPQ | 27.31 | 0.130 | 519.8K | 1.87 |
| 两者 | 28.04 | 0.113 | 584.2K | 1.90 |

表 4 匹配删除 2.25%、新增 14.91% 后，随机策略为 27.52 dB，学习策略为 28.04 dB：同等数量下增加 0.52 dB。只加不删为 597.3K、28.09 dB；联合策略少 13.1K，下降 0.05 dB，是明确容量取舍。正文一处把随机数量写为 584.8K，表中为 584.2K。[表 3–4](https://arxiv.org/html/2608.11077v1#S4.SS4)

PandaSet 初始 LGSbase 为 0.37 s，最终 1.92 s；这是精修前后，不是开关 GDP 的对照，也不能当渲染 FPS。完整模型 95.67M 参数，跨设置速度的硬件及预处理边界披露有限。

## 应用场景与启发

### 可迁移的假设

本报告判断：学习“哪里值得增加容量”比固定按点数分配更值得验证，数量匹配对照支持这一点。待验证假设是同等 Gaussian 数下，学习策略不仅改善纹理，也改善留出 LiDAR 对应的表面与动态边界。梯度响应可能偏好丰富纹理，若几何不改善，就不能将画质收益直接迁移为仿真资产质量。

## 局限与阅读风险

### 梯度代理与资源缺口

作者承认固定阈值、背景先验及跨时欧氏邻居会限制泛化。额外的阅读风险是分支按全体最大梯度归一化、同时干预多个候选，局部响应不是每个操作独立的因果效应。没有深度口径统一、置信区间或闭环策略证据。2026-09-12 [官方记录](https://arxiv.org/abs/2608.11077v1)及全文未核实本模型代码、配置、权重和划分文件的下载入口。

## 后续跟进

### 固定容量检验目标有效性

先取得干预目标实现、相同背景初始化和评测脚本，澄清 DMAE/RMSE。固定主干、三次精修及最终 Gaussian 总预算，对比随机、学习、仅新增三组；各组按预先锁定的目标数量选择操作，仅新增组的新增配额等于目标数与初始数之差，不能直接沿用会生成更多点的原阈值。该数量受限对照是本报告提议的验证，区别于原表的阈值消融。在留出 RGB 与 LiDAR 上同时测动态/静态画质、深度误差和重建耗时。成功需学习策略在同预算下改善几何且不只改善纹理；若去掉全局归一化或改变纹理便反转增删判断，且真实表面误差恶化，则停止向闭环资产扩展，先修改干预目标。
