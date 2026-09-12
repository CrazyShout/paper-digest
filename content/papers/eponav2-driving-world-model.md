---
{
  "id": "eponav2-driving-world-model",
  "tag": "world-models",
  "tags": [
    "world-models",
    "end-to-end-autonomous-driving"
  ],
  "title": "EponaV2: Driving World Model with Comprehensive Future Reasoning",
  "source": "arXiv:2605.14696 / https://arxiv.org/abs/2605.14696 / Fixed full text: https://arxiv.org/html/2605.14696v1 / Code status: https://github.com/JiaweiXu8/EponaV2",
  "authors": [
    "Jiawei Xu",
    "Zhizhou Zhong",
    "Zhijian Shu",
    "Mingkai Jia",
    "Mingxiao Li",
    "Jia-Wang Bian",
    "Qian Zhang",
    "Kaicheng Zhang",
    "Jin Xie",
    "Jian Yang",
    "Wei Yin"
  ],
  "affiliations": [
    "PCA Lab, VCIP, College of Computer Science, Nankai University",
    "Horizon Robotics",
    "The Hong Kong University of Science and Technology",
    "Nanjing University of Posts and Telecommunications",
    "Nanyang Technological University",
    "Anyverse",
    "School of Intelligence Science and Technology, Nanjing University"
  ],
  "comment": "EponaV2 以未来图像、伪深度和 SAM3 特征共同训练规划表征，再只微调流匹配规划器。它减少本任务的手工感知标签依赖，但仍用基础模型伪标签、人类轨迹和基于轨迹跟随的奖励。"
}
---

## 一句话定位

EponaV2 把未来深度和语义特征加入视频世界模型的训练目标，再从未来表征生成轨迹。“Perception-free”指不直接使用本任务手工感知标签，不能理解为无监督或没有感知先验。

- 核心证据：NAVSIM v1 PDMS 为 90.4；去掉 GRPO 为 89.4。navhard 的 +5.5 EPDMS 与 navtest 的 +0.3 属于不同测试集。[表 1–3、6](https://arxiv.org/html/2605.14696v1#S4.T6)
- 主要边界：GRPO 奖励鼓励跟随人类日志轨迹，未直接奖励碰撞避免或 PDMS。

## 论文要解决的问题

### 哪种未来监督更有规划价值

下一帧 RGB 将道路几何、车辆语义和纹理混在一起，预测画面可能不迫使主干保留规划信息。作者用预训练模型生成的未来深度和文本对齐语义特征作额外目标，检验结构化监督是否改善轨迹。

### 相关工作与差异

| 一手工作 | 已有机制 | 本文改变 |
| --- | --- | --- |
| Zhang 等，[Epona v1 §3](https://arxiv.org/html/2506.24113v1#S3)，ICCV 2025 | 因果时空主干后接 TrajDiT/VisDiT，分别预测轨迹和动作条件下一帧 | 增加未来深度、SAM3 特征目标，并在第二阶段优化规划器 |
| Wang 等，[Drive-JEPA v1 §3](https://arxiv.org/html/2601.22032v1#S3)，2026 预印本 | 在 EMA 目标特征上预训练；简单规划版与模拟器多轨迹蒸馏完整版分开 | 本文选择有明确几何/语义来源的未来伪标签，GRPO 不用同等模拟器 EPDMS 目标，监督预算不可直接等同 |

## 方法和系统设计

### 数据流与信息边界

前视视频及对应相对运动输入冻结 DINO-Tok，展开的特征/动作序列进入 Qwen3-VL 语言主干；因果掩码阻止未来观测进入当前推断。相对运动沿前代的 ego 坐标定义，不是全球位置；本文未完整列出各坐标轴、动作归一化和焦距缩放常数。

主干输出未来表征，流匹配规划器生成轨迹；图像预测头同时学习下一帧。Depth Anything V3 产生伪度量深度，再按规范焦距缩放；SAM3 用 `car`/`human` 文本产生未来图文融合特征，语义目标并非人工类别 mask。训练时三个未来预测分支的下一步控制运动用 GT，推理时由规划器预测。仅做轨迹推理时不必执行辅助深度/语义头，更不需读取未来真图。[§3.1–3.2](https://arxiv.org/html/2605.14696v1#S3)

### 流匹配和联合监督

原式 3–4 定义数据到噪声的路径：

$$
x_t=(1-t)x_0+t x_1,\quad x_1\sim\mathcal N(0,I),\qquad
L_{\rm traj}=\lVert v_{\rm traj}(F',\Delta A',x_t,t)-(x_1-x_0)\rVert_2^2.
$$

$x_0$ 为 GT 轨迹，$x_1$ 为噪声，$F',\Delta A'$ 为未来表征；采样从 $t=1$ 向 $0$ 反向积分，不能用正时间步一直推向更大噪声。

第一阶段目标为 $L=L_{\rm traj}+L_{\rm img}+L_d+L_s$。原式 8 的深度损失含置信度加权 L1、负 log 置信度及 x/y 梯度差；式 10 的语义损失为预测/teacher 特征的平方差。置信度可调节难点权重，不等于输出深度已校准。

### GRPO 和冻结范围

第二阶段只更新规划器，其余模块冻结。SDE 采样产生一组轨迹，以模拟车辆实际跟随轨迹与日志 GT 的偏差构造奖励；原式 12–14 使用组内标准化优势 $A_g=(r_g-\bar r)/\operatorname{std}(r)$，加模仿损失约束偏离。论文明确避免用需感知标注的 PDMS 奖励，因此不应写成“以碰撞安全为可验证奖励”。奖励具体尺度、组大小、零方差和 SDE 端点处理仍需配置补足。

6.7B 总参数以 Qwen3-VL 4B 初始化主干；阶段一用 nuPlan/nuScenes 五帧，阶段二 navtrain 四帧加导航命令。输入 512×1024、2 Hz，64 张 H20 训练约十天，单 4090 评测但未给吞吐。主文没有可复算的完整 optimizer、epoch 和显存预算。[§3.3、4.1](https://arxiv.org/html/2605.14696v1#S4.SS1)

## 关键图与可视化结果

![原论文图 2：人工感知、纯图像预测与多目标未来监督](../../assets/papers/eponav2-driving-world-model-original-figure-2.png)

由左向右比较监督来源；右侧 Foundation Models 读取未来图像来造标签，红箭头表示训练反传，不是部署额外输入。[官方 PDF 第 3 页图 2](https://arxiv.org/pdf/2605.14696v1#page=3)

![原论文图 3：联合训练和仅规划器 GRPO 两阶段](../../assets/papers/eponav2-driving-world-model-original-figure-3.png)

左侧同时训练主干/各预测头；右侧雪花标出 DINO-Tok 与主干冻结，火焰只在规划器。原图说明优化范围，没有展示生成未来的几何误差。[官方 PDF 第 5 页图 3](https://arxiv.org/pdf/2605.14696v1#page=5)

## 实验结论与证据

### 固定 split 与评价版本

NAVSIM v1 用 PDMS，v2 用包含方向、红绿灯、车道和扩展舒适的 EPDMS，均越高越好。v2 表 2/3 明确开启 human penalty，采用两阶段伪闭环，不等于可反应他车的持续闭环仿真。

| 同表对照：DriveLaW → EponaV2 | 指标 | 原值 | 差值 |
| --- | --- | ---: | ---: |
| 表 1，v1 navtest | PDMS | 89.1→90.4 | +1.3 点 |
| 表 3，v2 navtest | EPDMS | 88.6→88.9 | +0.3 点 |
| 表 2，v2 navhard | EPDMS | 30.6→36.1 | +5.5 点 |

navhard 表的分项按两阶段列出，总 EPDMS 不是两个独立阶段分数。原表 3 Human 行还有 TTC/LK=199 的明显异常，本报告不引用这些值推断指标上限或与人类的差距。

### 消融能支持什么

表 4 使用缩小至 3.5B 的模型：轨迹目标 84.4，加图像 84.8，加图像和深度 85.6，再加语义 86.9。表 5 同为深度监督，当前帧 83.6、未来帧 85.2，较直接支持“预测未来”这一设计。全尺寸表 6 中 GRPO 89.4→90.4，EP 83.6→84.8，但 NC 同为 98.6；不能把总分提升说成每个安全分项都提高。没有多种子区间。[表 4–6](https://arxiv.org/html/2605.14696v1#S4.T4)

## 应用场景与启发

- 作者主张：无需本任务手工感知标注，也能用未来监督获得有用规划表征。
- 我的判断：适合检验 teacher 提供何种监督，不能据规划分数认定未来深度/语义已准确。
- 待验证假设：过滤不一致的伪标签，能在不增加模型容量时改善困难场景规划。

## 局限与阅读风险

作者承认伪标签不精确，仍未超过较强的感知监督模型。窄文本提示可能遗漏非车辆/行人危险物；这是待测风险，非已证明失败。未知动作下的监督迁移、伪标签误差和模仿奖励的保守偏好尚未独立验证。

## 后续跟进

### 最小验证与停止条件

- 资源（2026-09-12）：[官方仓库](https://github.com/JiaweiXu8/EponaV2)仅 LICENSE/README，未见实现、配置、权重或伪标签清单；前代 Epona 的发布不能代替 V2。
- 前置条件：取得训练配置与固定 teacher/标签缓存，锁定 NAVSIM split、human penalty 和 evaluator 版本。
- 最小实验：同一缩小模型/步数/原始帧，比较原伪标签、跨帧一致性过滤、随机同量过滤；保留 image-only 对照，报告 teacher 误差与规划 NC/DAC/EPDMS。
- 成功信号：一致性过滤超过随机过滤且不损失长尾召回；若收益只由样本减少解释，或漏掉危险对象，停止过滤方案，先修 teacher/提示覆盖。

### 来源与核验记录

2026-09-12 读取 arXiv:2605.14696v1 全文、式 1–14、表 1–6；此版无单独附录。PDF 首页核对单位，图 2/3 从官方 PDF 完整显示区域提取并逐张打开，替代带巨大空白画布的 HTML 原图。相关机制读取 Epona v1 与 Drive-JEPA v1；未进行实验复现。
