---
{
  "id": "temporal-sampling-e2e-trajectory",
  "tag": "end-to-end-autonomous-driving",
  "tags": [
    "end-to-end-autonomous-driving",
    "cooperative-autonomous-driving"
  ],
  "title": "Temporal Sampling Frequency Matters: A Capacity-Aware Study of End-to-End Driving Trajectory Prediction",
  "source": "arXiv:2605.10388 / https://arxiv.org/abs/2605.10388",
  "authors": [
    "Yumao Liu",
    "Tao Liu",
    "Xiangyu Li",
    "Jiaxiang Li",
    "Ke Ma"
  ],
  "affiliations": [
    "The Hong Kong University of Science and Technology (Guangzhou)"
  ],
  "comment": "这篇论文把 E2E 驾驶轨迹预测中的 camera frame sampling frequency 当成训练集设计变量，提醒不同容量模型并不总是越高帧率越好。"
}
---

## 一句话定位

这篇实证研究改变训练样本的时间锚点密度，并重新训练模型；它发现部分小模型在中等频率更好，但没有证明测试时降帧、增加参数或抑制噪声必然改善驾驶。[全文 v1，§3–4、附录 A–F](https://arxiv.org/html/2605.10388v1)

## 论文要解决的问题

同一路段相邻图像高度重叠，保留更多帧既可能增加信息，也可能重复消耗训练预算。问题是训练集每秒创建多少样本，而非相机硬件或推理循环应运行多少 Hz。

## 方法和系统设计

### 锚点改变，单样本语义不变

§3.1 对每条轨迹原始时间戳集合取子集：

$$
\mathcal A_f=\operatorname{Sample}_f(\mathcal T^{\mathrm{nat}}),\qquad t_f^{j+1}-t_f^j\approx1/f.
$$

每个锚点生成一个输入／未来轨迹训练样本，缺必需相机、历史或未来标签则排除。降低 $f$ 减少样本数及样本间重叠，绝不把单样本 2 s 历史扩成 4 s。各频率重新训练，验证锚点则固定为该数据集最高评估频率；每模型输入结构、损失和预测窗口不随 $f$ 改变。

E2EDriver 用当前多相机加 4 s 自车历史；BEV 版只换视觉编码方式；Tiny-SSR 固定当前帧和提前 0.5 s 的上下文；AutoVLA 固定四个时刻、每时刻三个前视相机。各模型还接收左转／直行／右转导航命令，并输出自车坐标系下的未来位置；模型之间的历史信息并不一致。

### 监督与容量解释的边界

小模型使用轨迹 MSE／概率头 NLL，Tiny-SSR 另做未来 BEV 特征重建；约 3B 的 Qwen2.5-VL AutoVLA 只做答案动作 token SFT，视觉骨干冻结、语言骨干可训练。没有本研究新增的规划算法。

§3.2 将误差拆成遗漏信息、冗余／无关噪声负担及剩余项，是解释框架，没有独立测量这些成分。Toy 实验给 BEV 渲染加入固定强噪声，同架构宽度 16/48/64 的最佳频率为 7/9/10 Hz；它仅为可控直觉验证，不能证明真实相机数据的频率收益由容量单独造成。

### 与两项原始模型对照

[Li、Cui，SSR，2025 v2，§3.2–3.4](https://arxiv.org/html/2409.18341v2#S3) 以导航引导 TokenLearner 压缩 BEV，并用轨迹条件下的未来 BEV 自监督；本研究将 ResNet-50 换成 ResNet-18、缩小网格和层数，Tiny-SSR 不是原模型完整配置。[Zhou 等，AutoVLA，2025 v1，§3](https://arxiv.org/html/2506.13757v1#S3) 以 2048 个物理动作 token 支持快／慢思考，再 GRPO 微调；此处明确省略 CoT 与强化微调，不能把频率结果扩成原完整 AutoVLA 的结论。

## 关键图与可视化结果

![原文 Figure 1：采样密度与容量负担的概念图](https://arxiv.org/html/2605.10388v1/figure_1_illustration_of_manifold_and_burden_at_different_frequency.png)

8 Hz 最优是示意，不是所有数据集的结论；图中的“容量占用”也不是显存或神经网络容量实测。

![原文 Figure 3：频率扫描、独立训练与固定验证集](https://arxiv.org/html/2605.10388v1/figure_3_experiment_pipeline.png)

关键控制在右下：所有训练频率用同一验证划分。图示 5 Hz 只是流程例子，正式扫描值以表 1 为准。

## 实验结论与证据

### 3 秒离线轨迹误差

Waymo、nuScenes、PAVE 最高评估 10/12/20 Hz；PAVE 原始约 30 Hz，本研究未评估至 30 Hz。表 1 最高频率训练样本约 365k/116k/167k。ADE 是未来各点位置误差均值，FDE 是终点误差，均以 m 计；不等同于碰撞率。

表 2 的 nuScenes 对照，均使用各模型固定 epoch 主扫描：

| 模型与训练频率 | 3 s ADE ↓ | 3 s FDE ↓ |
| --- | --- | --- |
| E2EDriver，6 Hz | 1.099 ± 0.006 | 2.856 |
| E2EDriver，12 Hz | 1.183 ± 0.007 | 3.093 |
| Tiny-SSR，8 Hz | 0.608 ± 0.001 | 1.440 |
| Tiny-SSR，12 Hz | 0.611 ± 0.003 | 1.448 |
| AutoVLA，6 Hz | 0.924 ± 0.007 | 2.184 |
| AutoVLA，12 Hz | 0.855 ± 0.008 | 2.029 |

Tiny-SSR 的差值很小，不能概括所有小模型都有明显退化。$\pm$ 是三次运行标准差；附录 C 说明 E2EDriver 两版未强制确定性 seeds，而 Tiny-SSR/AutoVLA 用 42/43/44。部分 PAVE 高频运行因发散被排除，5 s 附表主要是单次运行，不混为同等统计证据。

### 训练量控制与计算代价

表 3 用频率乘 epochs 近似匹配更新量。nuScenes E2EDriver 的 6 Hz×10 epochs 对 12 Hz×5 epochs 为 ADE 1.0419/1.1846，FDE 2.709/3.096，ADE 相对下降 12.05%。这能排除仅由高频更新更多解释所有结果，但并非逐批次严格匹配；如 Waymo 6×8 与 10×5 本身为 48/50。未给 AutoVLA 的对应更新量控制。

E2EDriver 用单 A40、batch 64；Tiny-SSR 的 nuScenes 用 8 A40，其余用 8 Ascend 910C；AutoVLA 用 8 个 910C、5 epochs、batch 1、累积 4。未报告总训练时间或等 FLOPs 比较。减少训练锚点不改变单次推理结构，不自动降低在线延迟。[§4、附录 C](https://arxiv.org/html/2605.10388v1#A3)

## 应用场景与启发

值得把频率纳入数据配方搜索，尤其数据量大、同路段帧冗余高时。报告判断：先在同一模型内控制训练步数，再谈模型容量；跨架构比较同时改变模态历史、预训练和输出头，无法单独建立容量因果关系。

## 局限与阅读风险

仅离线 ADE/FDE，没有闭环、通信收益或噪声成分测量。附录 D 没列具体场景 ID、锚点 manifest 和不规则时间戳的完整实现约定。当前[官方仓库](https://github.com/KITE-Lab/Temporal_Sampling_Frequency_Matters)已有模型子项目、配置和预处理工具，README 明确不含原始数据、生成分片或检查点；本次核实目录及说明，未执行代码或确认所有频率划分可重建。

## 后续跟进

### 两组重新训练检验锚点频率

先恢复 nuScenes 场景划分和 6/12 Hz 锚点清单，排除同场景跨训练／验证。将同一 E2EDriver 初值复制两组，单 A40、batch 64、相同优化器及学习率日程，各训练恰好 10000 更新，固定三组 seeds；保持每样本历史和未来窗口一致。拟定通过条件是 6 Hz 平均 ADE 至少低 5%、FDE 不升，并公布有效样本／更新数。若无法重建一致标签时间或锚点清单，停止该训练因果检验，不能用固定模型测试抽帧替代。本次未训练或测试模型。
