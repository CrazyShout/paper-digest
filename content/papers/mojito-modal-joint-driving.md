---
{
  "id": "mojito-modal-joint-driving",
  "tag": "end-to-end-autonomous-driving",
  "tags": [
    "end-to-end-autonomous-driving"
  ],
  "title": "MOJITO: Modal Joint Learning for Unified End-to-End Autonomous Driving",
  "source": "arXiv:2607.23511 / https://arxiv.org/abs/2607.23511 / Official code: https://github.com/mumucc01/MOJITO / Official checkpoints: https://huggingface.co/mumucc1/MOJITO",
  "authors": [
    "Zhijing Cheng",
    "Xuancheng Zhang",
    "Donglin Di",
    "Lei Fan",
    "Baorui Ma",
    "Hao Li",
    "Xun Yang"
  ],
  "affiliations": [
    "University of Science and Technology of China",
    "Li Auto",
    "University of New South Wales"
  ],
  "comment": "MOJITO 把图像、LiDAR 与轨迹 token 放进逐层联合注意力，不再让规划器只读取压缩后的感知上下文。它在 NAVSIM 的非反应式评测中给出有竞争力的规划分数，也提供了检验感知与规划双向交互是否有效的清晰消融。"
}
---

## 一句话定位

MOJITO 是 127M 参数的相机、LiDAR 到轨迹模型：它让正在去噪的动作 token 与传感器 token 在每层双向交互，用轨迹监督训练无锚点扩散规划。最值得研究的是“规划如何反向改变感知特征”的受控消融，而不是其摘要中范围过宽的最优性能表述。依据 [固定 v1 全文](https://arxiv.org/html/2607.23511v1)，该版本没有附录。

## 论文要解决的问题

### 规划器能否重新查询感知细节

先提取一次场景上下文再规划，意味着后续去噪只能读取固定表示。MOJITO 保留图像、点云和轨迹三条 Transformer 分支，在生成过程中共同更新，让感知表示随当前动作假设变化。这里仍有 patch 和 pillar 压缩，因此“消除信息瓶颈”是作者的设计动机，不是已证明的信息无损性质。

### 与两项直接前作比较

[DiffusionDrive §3.3–3.4](https://arxiv.org/html/2411.15139v1) 从训练轨迹聚类的锚点附近加噪，截断扩散过程，再让动作通过空间可变形注意力与场景特征、agent/map 查询交互；它已有逐次查询感知和两步去噪。MOJITO 的区别是从高斯噪声开始、不用轨迹锚点，并允许传感器 token 反向读取动作 token，不能只概括成“首次把扩散与感知结合”。

[Uni3D §3.1–3.2](https://arxiv.org/html/2310.06773v1) 用 FPS+kNN 分组和小型 PointNet 生成点云 token，再以图文对齐特征监督 ViT。MOJITO 继承其预训练点云分支，却改为固定物理网格分组，并用下游轨迹监督适配驾驶。FPS+kNN 本身不会必然删除坐标；本文真正需要验证的是物理网格在稀疏道路点云上的分组偏置是否更合适。

## 方法和系统设计

### 输入与 token 化

三个前向相机视图为正前、左 60 度、右 60 度，预处理后拼接为 1024×256 图像；另读原始 LiDAR 和高层驾驶指令。DINOv3-S+ 将图像按 16×16 patch 编码。PillarGroup 在裁剪点云范围内划分固定网格，正文以 32×32 为例，选择最多 512 个非空 pillar，每个采样 64 点，不足时补齐。正文没有给出完整物理裁剪范围及非空 pillar 排序规则，不能把这些示例尺寸当成完整配置。

### 两组核心公式

式（3）–（4）描述每个 block 的联合更新：

$$
X=[X_I\Vert X_L\Vert X_A],\qquad
Y=\operatorname{MHSA}(\operatorname{LN}(X+PE))+X.
$$

$X_I,X_L,X_A$ 分别是图像、点云、动作 token，宽度均为 384；$PE$ 保留模态内位置。联合注意力后拆回三条分支，进入各自 FFN。完整模型有 12 个对齐 block，各分支不是简单共享全部参数。动作既读取传感器，传感器也读取动作，这个后一个方向是关键消融的对象。

动作序列包含未来 4 秒的 8 个 $(x,y,\theta)$ waypoint。式（2）的训练目标是从带噪轨迹恢复干净轨迹：

$$
L=\mathbb E_{x^{(0)},k,x^{(k)}}\left[\|f_\theta(x^{(k)},k,C)-x^{(0)}\|_2^2\right].
$$

$k$ 是噪声时间，$C$ 包含传感器 token 与高层指令。原文把网络记作 $\epsilon_\theta$，但监督目标是 $x^{(0)}$，并非噪声预测；这里改用 $f_\theta$ 避免误读。噪声时间与指令通过 adaLN 调制动作分支。该目标只有轨迹监督，不包含检测标签、候选锚点分类或强化学习奖励。

### 训练、采样与语言接口边界

图像和点云骨干从原始公开权重初始化并适配，动作分支从头训练；论文称没有额外驾驶域预训练。NAVSIM navtrain 上使用 AdamW、总 batch 512、学习率 $6\times10^{-4}$、8 张 H200。正文未给训练 epoch、完整冻结清单、训练时长或显存。

推理执行两步扩散去噪，传感器特征参与各层联合计算，并不是可以直接缓存的固定上下文。当前公开代码确有两步 DPM 采样，但会把初始高斯噪声裁剪到 [-1,1]，其 `forward_test` 使用 FP16；这与正文简写“纯高斯”及 BF16 时延设置需要逐项对齐。论文的自然语言示例还先用 Qwen3-1.7B 把文字映射为预设指令，MOJITO 本体并非开放词汇语言模型；187.65 ms 是否包含这个映射未说明。

## 关键图与可视化结果

### 原文 Figure 2：双向融合发生的位置

![原文 Figure 2：MOJITO 架构与 PillarGroup](../../assets/papers/mojito-modal-joint-driving-figure-1.png)

[原图图注](https://arxiv.org/html/2607.23511v1#S3.F2) 中，三种输入分别 token 化，保留独立分支后进入 Modal Joint Attention，再进入独立 FFN。已逐图核对左上角点云裁剪、pillar 划分和排序采样，以及右侧指令注入的位置。图中几何查询是学习到的交互，没有显式安全可行域求解。

### 原文 Figure 3：挑选场景的轨迹

![原文 Figure 3：三种方法的定性比较](../../assets/papers/mojito-modal-joint-driving-figure-2.png)

[原图图注](https://arxiv.org/html/2607.23511v1#S5.F3) 按行展示环岛、分岔与转弯，右侧依次是 DiffusionDrive、ReCogDrive、MOJITO；绿色为真值，红色为预测。最后一行 MOJITO 更接近道路走向。这支持展示案例的可行性，不能凭三例推断全部尾部风险，也不能从注意力热图认证因果贡献。

## 实验结论与证据

### 直接检验注意力方向的消融

Table 5 在相同 NAVSIM-v1 navtest 上报告以下分数，范围按 0–100 展示，越高越好。ID 3 通过修改联合注意力 mask，阻止传感器读取动作，但保留动作读取传感器。

| 输入及交互 | PDMS | NC | TTC | EP |
| --- | --- | --- | --- | --- |
| 相机，联合注意力 | 86.8 | 98.0 | 93.6 | 81.6 |
| 相机+LiDAR，FPS+kNN，联合注意力 | 86.1 | 97.8 | 93.3 | 81.0 |
| 相机+LiDAR，PillarGroup，单向注意力 | 85.7 | 97.8 | 93.1 | 80.7 |
| 相机+LiDAR，PillarGroup，双向注意力 | 88.9 | 98.6 | 94.5 | 83.5 |

同 pillar 设置下双向交互增加 3.2 PDMS，是最贴近机制的证据；是否所有运行完全同训练预算、随机种子及参数量，论文未充分列明。点云加入后也可能变差，因此“多一个传感器必然更好”不成立。

### 主表与协议分开阅读

Table 1 的相机+LiDAR 方法中，MOJITO 88.9 高于 DiffusionDrive 88.1 和 WoTE 88.3，但其 TTC 94.5 低于两者 94.7、94.9；骨干预训练也没有对齐。Table 2 明列 ReCogDrive-RL 90.8 和 AdaThinkDrive-RL 90.3，故 MOJITO 没有超过全部 VLA。

| 评估协议 | MOJITO | 直接对比 | 解释边界 |
| --- | --- | --- | --- |
| v2 navtest，Stage 1，双传感器 | 88.4 EPDMS | DiffusionDriveV2 85.5 | navtest 缺少 Stage 2 合成后续观测 |
| v2 navhard，两阶段，相机单模态 | 29.0 EPDMS | GuideFlow 27.1；DiffusionDrive 24.2 | Stage 2 无 LiDAR，不能代表双传感器模型 |

navhard 的相机模型 NC 从 Stage 1 的 96.2 降至 Stage 2 的 78.0，LK 从 94.2 降至 48.5，说明后续状态明显困难。两阶段总体 29.0 不应写成 Stage 2 单独分数。NAVSIM v2 可让其他车辆反应，但 [官方说明](https://github.com/autonomousvision/navsim/blob/main/docs/traffic_agents.md) 指出每段自车仍提交一次计划；两阶段合成观测也不等同持续真实传感器闭环。

### 规模与计算代价

Table 6 中，3/6/9/12 层分别为 33.4M/64.4M/95.5M/127M 参数，PDMS 为 80.5/80.5/83.0/88.9；这是深度消融，不能由四点推出数据规模定律。§7 的 H200、BF16、单样本时延为 MOJITO 187.65 ms、Transfuser 88.15 ms、DiffusionDrive 123.22 ms、ReCogDrive 331.68 ms。MOJITO 比 DiffusionDrive 慢约 52%，且正文未交代预处理、数据搬运、warm-up、重复次数及尾延迟的计入范围。

## 应用场景与启发

### 把双向交互变成可控变量

这套结构适合检验“感知应该在动作生成的哪个阶段更新”。可以把动作到传感器的注意力按层关闭，并保持反向通路、参数与训练预算一致，寻找收益是否集中在中间层。若只需少数层双向交互，就有机会降低全 token 注意力的成本。

作者将结果解释为解除感知瓶颈。本报告更保守的判断是：网格 token 化与联合注意力组合在当前基准有效；几何细节是否被更多保留、置信度是否可靠以及跨域安全收益，尚无独立测量。

## 局限与阅读风险

- 主结果没有多种子置信区间；异构预训练骨干使跨方法差值不能单独归因于融合机制。
- 高层指令和多个噪声样本的可视化，没有提供自然语言理解准确率、多样性量化或危险指令拒绝率。
- 无锚点和无检测监督仍依赖预训练知识、轨迹真值及高层指令，不是无监督驾驶。
- 三个前向相机、4 秒预测和 NAVSIM 协议不足以覆盖后方来车、长时遮挡或传感器失效。

## 后续跟进

### 已核查的资源

截至 2026-09-12，[作者仓库](https://github.com/mumucc01/MOJITO) 已公开环境、训练和评估入口，读取时 tree commit 为 `055613f96bc4224ac2f277fb3791514a3c2b248d`。[官方 Hugging Face 文件清单](https://huggingface.co/mumucc1/MOJITO/tree/main) 实际包含 `mojito.ckpt`，大小 2,459,603,227 字节；已核对清单，未下载或加载权重。NAVSIM/OpenScene、nuPlan 地图和预训练骨干需另行准备，发布并不意味着数据已安装。

当前评估脚本却引用 `mojito_navsim.ckpt`，训练脚本默认 250 epochs 并固定可见 GPU；这些入口不能原样视作论文 8 卡配置。源码只开放部分骨干参数训练，完整冻结与损失配置还需结合权重核对。正文的最终指标尚未复现。

### 有界的首轮验证

先固定 commit、权重哈希、两步采样和 NAVSIM-v1 场景清单，用一张容量经加载确认的 GPU 检查 20 个场景的坐标、8 waypoint 输出及两次去噪调用；再运行完整 navtest。以作者 88.9 PDMS 为参照，预先设定 ±0.5 分容差，同时报告 NC、EP、精度和分段时延，不能只追总分。

如果 checkpoint 名称/结构、预训练依赖或预处理无法对齐，停止重训。基线通过后才重训双向与单向两组：同数据、相同预算、三个种子。仅当双向增益的区间不跨零且 NC 不下降，才扩展为按层 mask 实验；若增益消失，就停止以“规划反向改善感知”为主要解释。
