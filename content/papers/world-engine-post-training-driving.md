---
{
  "id": "world-engine-post-training-driving",
  "tag": "world-models",
  "tags": [
    "world-models",
    "end-to-end-autonomous-driving",
    "autonomous-driving-testing"
  ],
  "title": "World Engine: Towards the Era of Post-Training for Autonomous Driving",
  "source": "Technical Report / arXiv:2606.19836v1 / https://arxiv.org/abs/2606.19836v1 / https://opendrivelab.com/WorldEngine/",
  "authors": [
    "Tianyu Li",
    "Li Chen",
    "Caojun Wang",
    "Haochen Liu",
    "Kashyap Chitta",
    "Zhenjie Yang",
    "Yuhang Lu",
    "Naisheng Ye",
    "Yihang Qiu",
    "Yufei Wang",
    "Luoxi Zou",
    "Jiaxin Peng",
    "Jin Pan",
    "Zhaoyu Su",
    "Andrei Bursuc",
    "Shengbo Eben Li",
    "Andreas Geiger",
    "Peng Su",
    "Hongyang Li"
  ],
  "affiliations": [
    "The University of Hong Kong",
    "Huawei",
    "Shanghai Innovation Institute",
    "Archon Robotics",
    "KE:SAI",
    "NVIDIA Research",
    "Nanyang Technological University",
    "valeo.ai",
    "Tsinghua University",
    "University of Tübingen and Tübingen AI Center"
  ],
  "comment": "从真实日志发现失败场景，结合3DGS重建、行为变体和强化后训练；闭环收益需同时查看成功率与行驶进度。"
}
---

## 一句话定位

World Engine 将策略在真实日志中的失败转成可重建、可改变周车行为的训练场景，再以奖励反馈进行后训练；主要证据是固定罕见场景集上的仿真改善。[固定 v1 全文](https://arxiv.org/html/2606.19836v1)

## 论文要解决的问题

### 失败样本的密度与交互缺口

普通日志扩大后，事故边缘交互仍稀少。只对失败日志微调，也无法看到策略偏离记录轨迹后周车如何响应。系统先用基础策略、日志周车和地图筛出碰撞或驶离道路，再围绕这些事件生成训练变体。

## 方法和系统设计

### 感知策略与特权仿真状态分开

公开实验策略是58.3M参数的ResNet50、BEVFormer与轨迹词表评分头，输入八相机四帧历史，输出自车轨迹。重建和奖励计算另需标定、LiDAR、跟踪框及HD地图；这些仿真特权状态不等于策略获得未来真值。3DGS分离静态背景与物体局部坐标资产，按世界位姿渲染；相机先去畸变，输出再恢复原始畸变。[§§3.2–3.5](https://arxiv.org/html/2606.19836v1#S3)

### 行为张量生成训练变体

式6–7对每个agent、每个时刻独立采样噪声等级，用有效掩码训练DiT去噪器。状态为：

$$
x\in\mathbb R^{A\times T\times8},\qquad x_{a,t}=[x,y,\sin\theta,\cos\theta,v_x,v_y,l,w].
$$

其中位置、速度、朝向及车体尺寸与地图对齐后逐通道标准化。历史和目标由掩码固定，未来部分生成；碰撞、平滑及车道引导后再以LQR和规则过滤。改变临近车辆目标能构造切入等变体，但不提供动力学可行性定理。**公开闭环评测的周车使用IDM**，不能把行为模型生成训练变体写成评测时的周车模型。[§3.3、附录B.1与B.3](https://arxiv.org/html/2606.19836v1#S3.SS3)

### 后训练目标与奖励门控

式9–10给出的形式化目标是：

$$
\max_\phi\;\mathbb E_{\tau\sim p}[R(\tau)-\lambda\sum_t D_{\mathrm{KL}}(\pi_\phi(\cdot\mid o_t)\Vert\pi_{\rm ref}(\cdot\mid o_t))],\qquad p=(1-\alpha)p_{\rm real}+\alpha p_{\rm sim}.
$$

$\pi_{\rm ref}$为预训练策略，$\lambda$限制策略漂移，$\alpha$控制真实与合成数据混合；期望对混合经验分布 $p$ 计算，其中日志并非由当前策略生成。附录式19的单段奖励为：

$$
r=r_{\rm col}r_{\rm dac}\frac{5r_{\rm prog}+5r_{\rm ttc}+2r_{\rm comf}}{12}.
$$

碰撞和道路合规先门控，随后加权进度、TTC及舒适性；静态物碰撞门控可取0.5，动态碰撞取0。训练TTC阈值1.0秒，评测PDMS为0.9秒。论文未给出足以锁定全部实现的混合率与KL系数。[§3.4、附录B.2](https://arxiv.org/html/2606.19836v1#S3.SS4)

### 与两项原始方法的关系

[SimScale §2](https://arxiv.org/html/2511.23369v1#S2)已用3DGS、IDM和特权伪专家生成扰动恢复数据，并混合真实数据训练；World Engine增加策略失败筛选和长尾行为变体，不能将仿真混训本身归为新提出。[OMEGA §3](https://arxiv.org/html/2512.07661v1#S3)优化干净轨迹锚点，以反向核KL约束控制偏移，并用博弈灵敏度生成对抗交互；本文附录给的是目标扰动、引导与过滤流程，不能据此继承OMEGA全部约束保证。

## 关键图与可视化结果

### 原图1：从长尾日志到训练循环

![原图1：长尾稀缺、行为变体与后训练流程](https://arxiv.org/html/2606.19836v1/figure_teaser.png)

图中a、b是概念示意，c、d展示传感器与轨迹变体，e串联预训练、失败发现和后训练；事件概率示意不是本次实验估计值。[Figure 1](https://arxiv.org/html/2606.19836v1#S1.F1)

### 原图2：收益取决于评测方式

![原图2：数据量曲线、后训练消融与罕见场景示例](https://arxiv.org/html/2606.19836v1/figure_nuplan_v2.png)

a的实测预训练规模约12k–103k；正文“约10倍”和图注“约14倍”均依赖曲线外推，未实际训练对应数据量。e是选定成功/失败案例，总体比较应看表1。[Figure 2](https://arxiv.org/html/2606.19836v1#S4.F2)

## 实验结论与证据

### 固定288个罕见场景，四秒闭环

navtrain含103,288样本，基线用50%；navtest含12,146样本，闭环取288例。开环PDMS用日志周车，闭环PDMS*以交互后的双方轨迹重算，并以日志专家归一化进度；两种分数不能直接混比。表1中SR为百分比，其余为0–100分。[§4.2、附录B.3](https://arxiv.org/html/2606.19836v1#S4.SS2)

| 后训练设置 | 常见开环PDMS | 罕见开环PDMS | 闭环SR↑ | 闭环EP↑ | 闭环PDMS*↑ |
| --- | --- | --- | --- | --- | --- |
| 基础策略 | 85.64 | 47.14 | 73.66 | 46.71 | 60.98 |
| 罕见日志 | 88.51 | 59.20 | 73.35 | 51.86 | 62.78 |
| 合成重放 | 82.61 | 62.69 | 87.20 | 32.49 | 63.22 |
| 交互rollout，无行为模型 | 88.53 | 61.88 | 77.96 | 56.74 | 67.33 |
| 完整World Engine | 88.95 | 59.83 | 88.89 | 47.66 | 70.12 |

完整方法较基础策略SR增加15.23个百分点；但加入行为模型后EP下降9.08分。报告判断：支持成功率与综合分改善，尚不支持所有维度同时改善。

### 成本与工业验证的证据层级

公开模型用8张H100：感知训练164小时、规划15小时、后训练11小时；从5,340个失败事件生成31,508帧。工业验证另用80,000小时以上日志预训练，后训练使用100万合成与500万普通片段。643例切入仿真中的碰撞率**相对下降45.5%**，未报绝对碰撞次数；不能转换为下降45.5个百分点。上海200km道路测试为后训练策略零接管、基础策略一次安全接管，样本与交互不匹配，无法确立总体道路安全优势。[§§4.1、4.3](https://arxiv.org/html/2606.19836v1#S4)

## 应用场景与启发

### 先定位策略缺口，再决定生成什么

可借鉴的是用已有策略的失败分布分配重建与训练预算，并同时保留普通场景检查。固定场景的合成重放可能提高无事故率却降低进度，因此进度应与安全门控共同报告。待验证假设：行为变体带来的部分成功率增益依赖偏保守的奖励取舍；适度提高进度权重若能恢复进度且保留安全收益，才支持它带来可用的交互改进。

## 局限与阅读风险

### 仿真覆盖、计算口径与稳定性

未出现于日志的长尾无法由筛选直接发现；离开重建轨迹后外观退化，行人与非结构化交互也有限。附录报告多轮后训练会令小模型不稳定。

附录B.3.3的576例、25.48分钟对应22.61例/分钟，原文11.59使用两类测试耗时之和；6.63 GPU小时也无法与8 GPU同时运行25.48分钟吻合。5.05/5.31秒是并行摊销值，不能作单场景延迟或实时性证据。

## 后续跟进

### 发布状态与可执行对照

2026-09-12核查：[代码与文档](https://github.com/OpenDriveLab/WorldEngine)可读；[数据目录](https://huggingface.co/datasets/OpenDriveLab/WorldEngine/tree/main)公开列出3DGS资产、变体场景和早期基础权重，但README仍将行为模型集成及稳定权重列为待完成，未验证下载与运行。

下一步需先锁定资产、基础权重和评测版本，补齐行为生成与KL/混合率配置，固定训练场景、合成帧数、初始化、KL/混合率和更新步数，做“IDM rollout/行为变体”×“原奖励/提高进度权重”的四组配对；后者只在独立验证集选权重，碰撞及道路门控保持不变。冻结模型后在同一288例留出场景和普通navtest上测多种seeds的SR、EP、PDMS*与完整GPU小时。只有进度恢复、罕见安全增益保留且普通场景不退化，才支持该假设；若必须牺牲安全、收益在等进度条件下消失，或渲染故障集中在某组，则停止扩大训练并检查奖励与资产偏差。
