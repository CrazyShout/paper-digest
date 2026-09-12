---
{
  "id": "intact-collaborative-perception",
  "tag": "cooperative-autonomous-driving",
  "tags": [
    "cooperative-autonomous-driving"
  ],
  "title": "INTACT: Ego-Guided Typed Sparse Evidence Retrieval for Heterogeneous Collaborative Perception",
  "source": "arXiv:2606.04437 / https://arxiv.org/abs/2606.04437",
  "authors": [
    "Chen Li",
    "Shengrong Yuan",
    "Jialong Zuo",
    "Xinzhong Zhu",
    "Nong Sang",
    "Changxin Gao"
  ],
  "affiliations": [
    "National Key Laboratory of Multispectral Information Intelligent Processing Technology, School of Artificial Intelligence and Automation, Huazhong University of Science and Technology",
    "Zhejiang Normal University"
  ],
  "comment": "INTACT 把异构协同感知从全图特征对齐改成 ego 发起的 typed sparse evidence retrieval，重点解决新车、路侧单元和不同传感器加入时的协议可扩展性。"
}
---

## 一句话定位

INTACT 让自车按位置发出两类查询，检索异构协作者的局部特征，再写回自车 BEV。核心证据是免额外训练接入时 AP 基本保持；这不等于所有协作者都会增加检测收益。依据 [固定 v1 正文及附录 A](https://arxiv.org/html/2606.04437v1)。

## 论文要解决的问题

### 接入成本与两项前作

新车更换传感器或骨干后，特征通常不能直接融合。[HEAL，Lu 等，2024，§4.2](https://arxiv.org/html/2401.13964v1#S4.SS2) 冻结公共融合器和检测头，只训练新类型的编码器；它并不要求每对车辆共同重训。[STAMP，Gao 等，2025，§3.3](https://arxiv.org/html/2501.18616v1#S3.SS3) 则训练本地 adapter/reverter，在本地与公共协议表示间转换。INTACT 试图省去新类型的额外训练，把兼容要求缩到可比较的局部响应；并非完全取消表示接口。

## 方法和系统设计

### 查询、选择、写回

自车 BEV 的响应头选高响应位置作为 hypothesis query，另用稀疏网格覆盖低响应区域。查询包含任务/类型嵌入、局部先验、位置和可靠性分数。协作者仍须提供位姿变换，先几何对齐，再在查询位置采样特征；不是自然语言问答，也不直接返回物体真值。

式（7）–（9）的核心是同一查询在协作者间竞争：

$$
r_{kj}=\langle\operatorname{Norm}(\eta_q(q_k)),\operatorname{Norm}(\eta_v(v_{kj}))\rangle,\qquad
\tilde v_k=\sum_j\operatorname{softmax}_j(r_{kj}/\tau_n)v_{kj}.
$$

$q_k$ 是查询，$v_{kj}$ 是协作者 $j$ 的局部响应；训练用上述软权重，推理改为选取最高分协作者。可靠性加权后的响应散射回 BEV，重复位置取平均，再经局部卷积、归一化与裁剪得到残差 $\Delta$。式（11）为：

$$
g=\operatorname{clip}_{[\rho,1]}\{\sigma(\Gamma([F_e,\Delta]))\},\qquad F_e^+=F_e+g\odot\Delta.
$$

$g$ 控制写入强度，附录设下限 $\rho=0.08$、残差裁剪 5.0；门控不是可完全拒绝坏消息的安全证明。

### 训练与通信边界

接口在 $m_1$ 上训练 31 epoch，Adam、初始学习率 $10^{-3}$，四张 RTX 4090、总 batch 4；最多 512 个查询，hypothesis 比例 0.75，coverage 使用 8×8 anchor grid。新协作者插入后不再梯度更新。检测监督沿基准流程，但完整损失权重、骨干冻结清单及跨通道响应投影实现未说明。

仿真先取得候选响应再评分。部署时“先回置信度、再请求选中响应”的两阶段通信只是实现建议，未给网络往返实验；推理只留下一个响应不代表此前候选传输免费。

## 关键图与可视化结果

![原文 Figure 1：异构协同接口比较](../../assets/papers/intact-collaborative-perception-figure-1.png)

已核对 [Figure 1](https://arxiv.org/html/2606.04437v1#S1.F1)：由左侧整图翻译读到中间查询、局部响应与写回。它表达接口假设，不证明任意异构模型均兼容。

![原文 Figure 2：训练一次与直接插入](../../assets/papers/intact-collaborative-perception-figure-2.png)

已核对 [Figure 2](https://arxiv.org/html/2606.04437v1#S3.F2)：上半训练接口，下半合并已有 checkpoint 推理。图中雷达属于概念示例，结果表没有单列雷达验证。

## 实验结论与证据

### 插入保持与组件消融

OPV2V-H 为模拟数据；$m_1$ 是 PointPillars，$m_2$ 是相机 EfficientNet。下表 AP70 为 IoU 0.7 的 AP 比例，越高越好，来源为 Table 4/5。

| 同框架设置 | AP70 |
| --- | ---: |
| 自身 $m_1$，未插入协作者 | 0.8037 |
| 完整 $m_1+m_2$ | 0.8009 |
| 去查询引导检索，重新训练 | 0.7934 |
| 去门控写回，重新训练 | 0.7656 |
| 去 typed queries，重新训练 | 0.6374 |

组件确实重要，但完整协同结果比自身基线低 0.0028，即本报告计算的 0.28 个 AP 百分点。不能仅凭保持率证明净协同增益。Figure 7 是推理时抑制组件的可视化，不能与这些重训消融逐一等同。

Table 1 的 DAIR-V2X AP50 为 0.4382，STAMP 为 0.3913；来源混合已发表值与本地复现，训练条件并未统一。通信量以 $\log_2$ 报告，18 对密集基线 22 对应同口径下 $2^4=16$ 倍缩减；字节精度、查询请求与协议开销未完整列明。0.52M 是额外启用参数，Table 2 的最终模型为 25.40M，不能混作总参数。没有统一时延或多种子区间。

## 应用场景与启发

作者主张减少异构接入重训。本报告更看重“保留自车基线、按查询审查外部增量”的接口；待验证假设是只对确实提高局部检测质量的响应放行，能避免强自车被协作者拖累。

## 局限与阅读风险

几何对齐仍是前提；位姿/时延曲线不涵盖完整丢包、恶意响应和实际带宽协议。通道可比较性、coverage 的固定网格与不足区域采样细节还需代码确认。所有主结果为检测，未验证规划闭环。

## 后续跟进

### 资源与最小验证

截至 2026-09-12，固定全文无 INTACT 代码、配置或权重入口；精确主题仓库查询为零，不能认证已开源。OPV2V-H 等数据与基线虽公开，本次未下载或运行。

取得作者 checkpoint 后，用一张容量经加载确认的 GPU，固定 200 个留出测试场景、查询和请求/响应预算，比较原门控与可拒绝响应的质量门控；后者仅使用预测置信度、几何一致性等推理可见量，在独立验证集上校准，不能读取测试 GT。两组都测正常与打乱响应，并保留自车独立检测对照；记录 AP70、遮挡目标召回及实际字节。只有新门控保留正常响应增益，并减少坏响应对强自车的拖累，才支持增量放行假设；若必须靠测试 GT 选择响应、正常收益消失或通信漏计，则停止推广。
