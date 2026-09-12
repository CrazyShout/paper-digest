---
{
  "id": "sparseworld-sparse-scene-world-model",
  "tag": "world-models",
  "tags": [
    "world-models",
    "dynamic-scene-representation",
    "end-to-end-autonomous-driving"
  ],
  "title": "SparseWorld: Enhancing End-to-End Autonomous Driving via World Models with Sparse Scene Representation",
  "source": "arXiv:2605.24354v2 / https://arxiv.org/abs/2605.24354v2 ; IROS 2026 accepted per official project: https://wryzju.github.io/SparseWorld/",
  "authors": [
    "Ruoyu Wang",
    "Jingke Wang",
    "Yukai Ma",
    "Yuehao Huang",
    "Shuangming Lei",
    "Guanglin Xu",
    "Aixue Ye",
    "Yong Liu"
  ],
  "affiliations": [
    "Institute of Cyber-Systems and Control, Zhejiang University",
    "2012 Labs, Huawei"
  ],
  "comment": "自回归预测 agent/map 实例以精修规划，并在推理时选择及调整轨迹；碰撞率收益伴随部分L2退步，nuScenes主评测还包含缺失片段的基线回填。"
}
---

## 一句话定位

SparseWorld 用未来 agent 和地图实例增强 SparseDrive/VAD，再通过候选轨迹选择减少碰撞。它预测稀疏场景而非视频，但最终结果同时包含世界模型、规划精修和推理后处理的作用。

## 论文要解决的问题

### 只预测规划需要的布局

作者希望减少密集视频或占据预测的成本，同时保留未来车辆、道路边界的交互线索。SparseWorld-S 基于 SparseDrive，SparseWorld-V 基于 VAD-Tiny；后者的感知仍有密集 BEV，不能把稀疏世界模型等同于全系统无 BEV。[v2，§III](https://arxiv.org/html/2605.24354v2#S3)

### 原有基线已做哪些事

[SparseDrive 自身 §3.2–3.3](https://arxiv.org/html/2405.19620v1#S3.SS3)已用实例记忆、并行多模态 motion/planning 和碰撞重打分；本篇新增未来实例 rollout 和三来源候选。[VAD 自身 §3.1–3.4](https://arxiv.org/html/2303.12077v3#S3)已依据向量化 agent/map 做注意力规划和碰撞/边界约束；SparseWorld 加入预测未来几何与特征，并把中心距离约束扩为框间调整。

## 方法和系统设计

### 从历史感知到未来实例

输入为六相机在 −1、−0.5、0 s 的观测。实例由几何 anchor 和特征组成，agent anchor 含位置、尺寸、yaw、速度；世界模型规模为 900 agent、100 map anchors。预测以 ego 坐标表达，静态地图的变化主要包含自车运动引起的坐标变化。GIA 先根据 agent 速度与 ego 轨迹投影，Sparse Dreamer 再用时序、实例及动作注意力修正。[§III-B、补充 §II](https://wryzju.github.io/SparseWorld/static/pdfs/SparseWorld_IROS2026_appendix_20260316_1110_fixed.pdf)

补充算法 1 的递推可概括为：

$$
I_{t+1}=\operatorname{SPD}(\operatorname{IMQ}_t,C_t),\qquad
C_{t+1}=\operatorname{FMP}(I_{t+1}).
$$

$I_t$ 是 anchor/特征集合，IMQ 存历史和已预测实例，$C_t$ 包含速度、规划轨迹和指令，FMP 是未来 motion planner。推理条件由当前/未来预测产生，没有输入未来真实实例。训练用未来检测、地图和轨迹标注监督分类与回归；伪想象并非无监督真值。

### 安全损失与推理选择

补充 §I-B 对每个未来时刻计算 ego/agent 矩形间最短距离向量 $v_{tj}$，安全距离 $\theta=0.5$ m，不足时产生修正，再对 agent 取平均。主文式 (6) 为：

$$
\mathcal L_{\rm scl}=\frac{\sum_t\|v_t^{\rm adj}\|_2}{\sum_t\mathbf1[\|v_t^{\rm adj}\|_2\ne0]}.
$$

$v_t^{\rm adj}$ 是该时刻平均调整向量，训练权重为 0.1。推理 ATS 比较基线、未来 planner、精修 planner 三类轨迹，在预测运动下查碰撞、选较安全候选并加调整。它是预测几何上的启发式；平均调整可相互抵消，不能保证满足所有障碍物约束。零调整分母、零距离方向及全部候选碰撞时的兜底未充分定义。

### 两阶段训练不是联合更新全部模块

在预训练基线之上先训练四帧未来预测，随后冻结该模块，仅 rollout 两帧训练规划精修。nuScenes 两阶段为 100/20 epochs，Bench2Drive 为 10/4 epochs，batch=4；两阶段均用 AdamW、学习率 $2\times10^{-4}$ 和余弦退火；训练用八张 RTX 4090D，闭环评价用八张 RTX 3090。nuScenes 图像为 256×704，agent 感知半径 55 m，map 范围纵向 60 m、横向 30 m。[补充 §II-B](https://wryzju.github.io/SparseWorld/static/pdfs/SparseWorld_IROS2026_appendix_20260316_1110_fixed.pdf)

## 关键图与可视化结果

### 原图 2：预测、精修与选择的分工

![原图 2：实例基线、Sparse Dreamer 和规划精修](https://arxiv.org/html/2605.24354v2/Sparseworld-framework-0802-1925.png)

左侧循环输出未来实例和条件，右侧把基线/未来/精修轨迹送入选择器；最后加调整向量。因此最终碰撞率不能只归因于世界模型特征。

### 原图 4：未来的 ego 相对布局

![原图 4：两种场景从当前观测到 0.5–2 s 未来实例](https://arxiv.org/html/2605.24354v2/figures/png/Sparseworld-visualize-resize-1106-1045.png)

左侧为六视图感知，右侧为四个未来时刻的车辆和地图布局，含直行、转弯条件。它展示可预测布局，不能证明所有漏检目标都能恢复。

## 实验结论与证据

### 开环完整评测含基线回填

nuScenes 使用 700/150 train/val、2 Hz。补充 §II-A 明确裁掉缺少历史/未来的样本；完整评测中不在裁剪集的位置填入基线预测，未报告回填比例。表 IV 采用 VAD 协议并去掉外部 ego status 输入，因此是混合输出成绩。[主表 IV](https://arxiv.org/html/2605.24354v2#S4)

| nuScenes 1/2/3 s 平均 | 基线 L2，m↓ | 增强 L2，m↓ | 基线碰撞率↓ | 增强碰撞率↓ |
| --- | --- | --- | --- | --- |
| VAD-Tiny → SparseWorld-V | 0.78 | 0.59 | 0.38% | 0.24% |
| SparseDrive-S → SparseWorld-S | 0.61 | 0.65 | 0.08% | 0.05% |

后一行碰撞下降 0.03 个百分点、相对 37.5%，但 L2 增加 0.04 m。表 VI 的 0.5/1/1.5 s 是另一个较短时域，不能用所列 0.00%替代主表 0.05%。

Bench2Drive 在 1,000-clip base set 训练、220 routes/44 类交互测试：SparseDrive-S→SparseWorld-S 的 DS 44.54→48.95，SR 16.71%→18.23%；分别增加 4.41 分和 1.52 个百分点。属于 CARLA 闭环，未给置信区间，不能复述作者“统计显著”的表述。[表 III](https://arxiv.org/html/2605.24354v2#S4.T3)

### 消融、预测质量与成本

表 IX 的 VAD 对照，基线/仅未来实例/再加 SCL/再加 ATS 的平均碰撞率为 0.38/0.34/0.28/0.24%，L2 为 0.78/0.62/0.59/0.59 m；说明后处理贡献不可忽略。表 I 在 2 s 的 NDS 0.433、地图 mAP 48.96，优于使用 GT 投影矩阵的 projection 对照 0.390/21.84；平均 NDS 为 0.467，区别于百分制表 VII 的 46.66。

表 V 报四帧生成 70 ms，感知另需 174 ms，内存写作 4397M；未分别明确计时 GPU/批量和全部精修耗时。UniScene 图像、Drive-OccWorld 占据与实例预测输出不同，不能把速度差解释为同任务算法加速。[表 I、V、VII、IX](https://arxiv.org/html/2605.24354v2#S4.SS3)

## 应用场景与启发

### 一个可被反驳的判断

本报告判断：稀疏未来与基于预测几何的选轨可以减少日志协议碰撞，但其优势可能来自额外候选和调整。待验证假设是：在相同候选来源与选择器下，把精修器的历史实例换成预测未来实例，仍能提高闭环成绩。这能检验未来上下文对精修的增量作用，不能一次证明整个世界模型的所有收益。

## 局限与阅读风险

### 坐标、漏检与资源状态

主文式 (2) 的 $ce-V\Delta t$ 未完整解释变换方向，式 (3) 将角速度直接送入旋转却未写时间积分；实现需核对，不能默认为物理前向积分。补充材料承认雨天远处漏检会传播，anchor 高斯扰动测试不等于新物体漏检恢复。安全损失只根据预测目标，不保证未建模障碍安全。

2026-09-12 [官方项目](https://wryzju.github.io/SparseWorld/)标注 IROS 2026 accepted，提供论文和七页补充材料，未核实本方法代码、配置或权重入口。单位按 v2 正文与项目保留浙江大学、华为；没有证据保留旧稿额外实验室名。

## 后续跟进

### 将回填和安全后处理拆开验证

先取得裁剪/回填清单、坐标实现和 ATS 兜底。固定 SparseDrive、已冻结的世界模型、精修器初始化和训练步数，仅比较精修注意力读取历史实例或预测未来实例两组；实例统一到当前 ego 坐标并保持相同 token 数。两组均保留基线/未来/精修三个候选来源，使用相同 SCL、ATS、预测交通和门限。分别报告增强样本与回填样本指标，再以相同 220 routes、配对 seeds 比较 DS、碰撞和完成率。成功需收益在不回填子集和闭环均出现；若仅靠回填或过度停车降低碰撞，或空障碍/相向避让导致非有限修正，则停止扩大 rollout，先修复计分与选择逻辑。
