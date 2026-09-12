---
{
  "id": "x-mind-visual-cot-driving",
  "tag": "world-models",
  "tags": [
    "world-models",
    "end-to-end-autonomous-driving",
    "agentic-driving"
  ],
  "title": "X-Mind: Efficient Visual Chain-of-Thought via Predictive World Model for End-to-End Driving",
  "source": "Technical Report / arXiv:2606.28758v1 / https://arxiv.org/abs/2606.28758v1 / https://xp-x-mind.github.io/en/",
  "authors": [
    "Bohao Zhao",
    "Chengrui Wei",
    "Guangfeng Jiang",
    "Ruixin Liu",
    "Xuejie Lv",
    "Liu Liang",
    "Sutao Deng",
    "Xiuyang Fan",
    "Pengkun Zheng",
    "Jinyun Zhou",
    "Rui Guo",
    "Hanpeng Liu",
    "Yutong Zheng",
    "Yi Guo",
    "Xinlong Zheng",
    "Qingyu Luo",
    "Zhuangzhuang Ding",
    "Yu Zhang",
    "Hang Zhang",
    "Xianming Liu"
  ],
  "affiliations": [
    "XPeng Inc."
  ],
  "comment": "用96个sketch tokens表示12帧未来，并把五步去噪嵌入驾驶模型层块；现有证据主要支持离线轨迹误差改善。"
}
---

## 一句话定位

X-Mind把未来BEV sketch预测嵌入驾驶大模型，在一次骨干前向中完成五步潜变量更新，再由规划头输出动作；作者将这条中间预测路径称为Visual CoT。[固定v1全文](https://arxiv.org/html/2606.28758v1)

## 论文要解决的问题

### 让未来监督进入中间层

未来视频预测代价高，末端辅助损失也未必让规划使用未来信息。本文同时缩减预测内容，并把去噪监督分布到LLM内部。报告关注的可检验问题是：收益来自更丰富的辅助标签，还是规划确实依赖预测未来？原文未把两者完全分离。

## 方法和系统设计

### 输入、sketch与动作边界

图1输入包含文本、车辆状态、七相机观测与轨迹查询tokens；未来GT只用于训练。sketch在统一BEV画布上编码道路、物体框、信号灯、导航走廊和速度合规条。它含有几何之外的规则标签，并非直接从RGB无监督获得。论文称使用度量坐标，但未给轴向、原点、栅格分辨率、12帧采样间隔及完整标注流程。

领域专用DC-AE将12帧sketch压成96 tokens；逆动力学头预测纵向加速度与偏航角速度，以L1监督。具体状态积分及硬约束未展开，因此动作参数化本身不构成安全或非完整约束保证。[§§2.1–2.2、2.4](https://arxiv.org/html/2606.28758v1#S2)

### 训练的GT注入与推理的自主更新

按式1–4，以$z^*=E(B_{\rm gt})$表示GT潜变量，$\epsilon$为高斯噪声；本文将五个层块重编号为$j=1,\ldots,5$以避免原文索引错位：

$$
(t_0,\ldots,t_5)=(0,0.1,0.2,0.4,0.7,1),\qquad z(t)=(1-t)\epsilon+tz^*.
$$

训练时，每个块入口的sketch特征都被相应带噪GT替换，再经线性投影和二维位置编码送入LLM。各块输出经过共享轻量Transformer预测流速度。推理从纯噪声出发，接续使用自己的结果：

$$
\hat z_j=\hat z_{j-1}+(t_j-t_{j-1})\hat v_j,\qquad \hat z_0=\epsilon.
$$

最终潜变量可由冻结DC-AE解码成sketch，规划头利用内部未来表征生成动作。五块只遍历一次骨干，仍需附加tokens与速度头；训练反复注入GT而推理自主更新的分布差异未被单独消融。[§2.3](https://arxiv.org/html/2606.28758v1#S2.SS3)

### 优化的实际约束

由式1线性路径可推得目标速度$v^*=z^*-\epsilon$，其含义是潜空间流速度，不是车辆速度。式5–8联合多层流损失、随机抽一层解码的MSE/LPIPS，以及动作L1损失：

$$
\mathcal L=\lambda_{\rm WM}\left[\frac{\lambda_{\rm flow}}5\sum_{j=1}^5\|\hat v_j-v^*\|_2^2+\lambda_{\rm img}\mathcal L_{\rm img}\right]+\lambda_{\rm plan}\mathcal L_{\rm plan}.
$$

权重、具体层号、LLM规模和完整训练预算未披露；不能从这些监督项推出已经学到可识别的因果机制。[§2.4](https://arxiv.org/html/2606.28758v1#S2.SS4)

### 与原始相关方法的区别

[X-Foresight §3](https://arxiv.org/html/2605.24892v1#S3)已在LDM中联合预测动作、BEV与相机tokens，并以独立renderer形成长时视频rollout；X-Mind强调结构化sketch及沿骨干深度去噪，不能笼统称此前模型都没有预测能力。[DC-AE §3](https://arxiv.org/html/2410.10733v1#S3)用空间到通道残差捷径和分阶段高分辨率适配改善压缩；本文另训sketch版本，原始图像DC-AE的压缩率与画质成绩不能直接移用。

## 关键图与可视化结果

### 原图1：监督流与推理流不同

![原图1：X-Mind总体架构与内部未来表征](https://arxiv.org/html/2606.28758v1/overview_v3.png)

蓝箭头连接GT编码和训练，黑箭头展示噪声到未来表征的推理路径。96 tokens指世界模型分支的新增上下文，不是全部输入长度。[Figure 1](https://arxiv.org/html/2606.28758v1#S2.F1)

### 原图3：五块渐进更新

![原图3：训练层间GT注入与推理Euler更新](https://arxiv.org/html/2606.28758v1/flow_matching.png)

左侧列出五个块和五个速度输出，右侧分别给训练插值与推理递推。图注称固定步长，但§2.3.1明确使用非均匀时间表；本报告采用方法中的时间表并保留此冲突。[Figure 3](https://arxiv.org/html/2606.28758v1#S2.F3)

## 实验结论与证据

### 数据规模与表1可比条件

内部总库含约280,000小时、34M片段、13.8T视觉tokens，86.8%城市、13.2%高速；**全部本文实验仅用总库八分之一**。测试集规模、划分和误差单位未披露。表1同骨干、同训练配置；ADE按原表横向/纵向@6s记载，Inference以基础模型归一为1。[§§3.1–3.2](https://arxiv.org/html/2606.28758v1#S3)

| 表征 | 新增tokens | ADE横向↓ | ADE纵向↓ | 相对推理代价↓ |
| --- | --- | --- | --- | --- |
| 基础模型 | 0 | 0.2399 | 1.2979 | 1.0 |
| 未来图像 | 3584 | 0.2003 | 1.2456 | 22.0 |
| 3DGS | 3072 | 0.1964 | 1.2247 | 19.0 |
| sketch | 96 | 0.1765 | 1.1849 | 1.1 |

sketch较图像少97.32%的新增tokens，但计算硬件、批量与绝对毫秒数未知，不能据1.1×推出车端实时频率。

### 生成质量改善与规划改善不等幅

表2单步去噪→RBD：FID 67.30→9.59，ADE横/纵0.1783/1.1938→0.1765/1.1849；两者推理列均1.1，正文称较单步多0.1×延迟与表不一致。表3当前帧→12帧未来：FID 8.97→9.59变差，ADE 0.1866/1.2132→0.1765/1.1849改善。说明视觉分布质量与轨迹效用并非同一指标。[§§3.3–3.4](https://arxiv.org/html/2606.28758v1#S3.SS3)

## 应用场景与启发

### 给规划提供可检查的未来接口

结构sketch便于检查模型预计何处被占用、是否预期红灯转换。但现有定量结果是离线ADE，定性轨迹示例不能代替闭环碰撞、接管或反事实交互评测。“Visual CoT”是作者的架构解释，报告不将其直接视为物理因果理解证据。

## 局限与阅读风险

### 标签捷径与未验证的安全边界

未来sketch含GT导航、速度与信号状态，部分内容可能与目标动作高度相关；缺少各先验独立消融。缺失于GT的目标仍被预测，是定性观察，不能证明预测正确。论文没有量化闭环安全结果，依赖密集GT且尚未联合采样动作和未来；这两项被作者列为后续方向。[§§3.5–4](https://arxiv.org/html/2606.28758v1#S4)

## 后续跟进

### 资源状态与直接干预实验

2026-09-12：原文x-mind.github.io返回404；[现项目页](https://xp-x-mind.github.io/en/)可访问并提供论文与演示，公开账号仅见网页仓库，未核实模型代码、权重或数据发布。

具体假设是“规划通过sketch中的周车未来调整动作”。需先取得权重、sketch注入接口及成对一致标签；固定同一输入和噪声，仅替换周车横穿/让行的sketch潜变量，同时保留道路、自车及导航，加入原样替换与屏蔽轨迹token读取sketch的对照。成功条件是横穿版本稳定提前制动、让行版本不增加无谓制动，且变化超过重采噪声波动；若屏蔽读取后效应仍在，停止因果解释并检查旁路。该诊断使用受控标签，不作为部署性能成绩。
