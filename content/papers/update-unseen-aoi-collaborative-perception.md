---
{
  "id": "update-unseen-aoi-collaborative-perception",
  "tag": "cooperative-autonomous-driving",
  "tags": [
    "cooperative-autonomous-driving"
  ],
  "title": "Update the Unseen Only: Minimizing AoI for Collaborative Perception through Online Learning",
  "source": "arXiv:2607.20967 / https://arxiv.org/abs/2607.20967",
  "authors": [
    "Yanan Ma",
    "Zhuoyi Zhao",
    "Zhengru Fang",
    "Haonan An",
    "Xianhao Chen",
    "Yuguang Fang"
  ],
  "affiliations": [
    "Hong Kong JC STEM Lab of Smart City",
    "Department of Computer Science, City University of Hong Kong",
    "Department of Electrical and Computer Engineering, The University of Hong Kong"
  ],
  "comment": "重新定义协同感知的信息年龄：车辆自己重新看见区域时，AoI 也应归零；LocMW 因而只广播“仍看不见且已经过时”的网格，把通信新鲜度和 3D 检测收益连接起来。"
}
---

## 一句话定位

LocMW 将车辆“自己重新看见区域”视为信息刷新，学习哪些盲区还会持续存在，再分配基站广播预算；它优化总信息年龄，尚未证明闭环驾驶安全。[固定全文 v1，§III–VIII、附录 A–C](https://arxiv.org/html/2607.20967v1)

## 论文要解决的问题

广播旧区域不一定有价值：车辆可能已经靠本地传感器看清它，或离开了关注范围。基站还只能收到延迟的可见性反馈，因此要估计当前盲区需求，而不只是选择时间戳最旧的区域。

## 方法和系统设计

### 状态为何包含本地刷新

基站被假定能持续观察所有区域，广播可靠到达所有相关用户，每时隙最多更新 $K$ 个等大小区域。车辆可见或失去兴趣时，下一时隙 AoI 归零；仍不可见但收到广播时降为 1；其余递增。$N_b$ 表示区域 $b$ 中感兴趣却不可见的用户数，$A_b$ 为这些用户 AoI 之和。

需求按 INAR(1) 建模：用户以概率 $\rho_b$ 留在盲区状态，新进入用户均值为 $\mu_b$，稳态需求 $\lambda_b=\mu_b/(1-\rho_b)$。§VII-A 式 30 用估计值跨越 $d$ 步反馈延迟：

$$
\hat N_b(t+1)=\hat\rho_b\hat N_b(t)+\hat\mu_b,\qquad
\hat A_b(t+1)=\hat\rho_b(1-u_b(t))\hat A_b(t)+\hat\rho_b\hat N_b(t)+\hat\mu_b.
$$

$u_b=1$ 表示广播，历史动作已知。这里不是学习检测器；基站每步以二维岭回归估计 $[\rho_b,\mu_b]$，投影到有界可行域，再从最新延迟报告递推当前状态。

### 调度规则与保证的范围

式 35 选取最大的 $K$ 个权重：

$$
W_b(t)=\frac{\hat\rho_b\hat A_b(t)}{1-\hat\rho_b+\hat\rho_b\hat\eta_b^R},\qquad
\hat\eta_b^R=\left[\frac{\sqrt{\hat\lambda_b\hat\rho_b/\nu}-(1-\hat\rho_b)}{\hat\rho_b}\right]_0^1.
$$

$\hat\eta_b^R$ 是式 16 的平稳随机基准广播概率，$\nu$ 以二分搜索满足总预算；实现还需处理估计 $\hat\rho_b=0$ 的边界。较低持续概率减少广播优先级，因为用户可能马上自行看清。

作者定理 4 给出两个层级：已知参数时，相对最优平稳随机基准的上界；再结合均值场下界推导，得到至多两倍关系。后者是作者在该前提下给出的理论结果，不等于全体策略最优，本报告也未完成独立证明审计。定理 5 的累积超额 AoI 为 $O(KL_d^L\sqrt{T\log(BT)})+o(T)$，还要求持续激励、局部随机 Lipschitz 等条件。均值场预测输入方差趋零也并非“车多”自动保证；本文未独立证明这些条件在实测轨迹上成立。

### 两项原始方法比较

[Kadota 等，ToN 2018，§IV-D](https://www.mit.edu/~modiano/papers/CV_J_104.pdf) 在不可靠广播链路上按成功率与年龄构造 Max-Weight，用户靠收到包刷新；LocMW 则加入本地可见性及变化的需求人口，但其广播成功是建模假设。[Hu 等，Where2comm，2022 v1，§4.3–4.4](https://arxiv.org/html/2209.12836v1#S4) 以检测置信度和接收者请求图选稀疏特征，再做注意力融合；LocMW 选择的是跨时隙信息新鲜度，未直接优化瞬时检测置信度或规划风险。

## 关键图与可视化结果

![原文 Fig. 2：延迟反馈下的区域广播](../../assets/papers/update-unseen-aoi-collaborative-perception-figure-1.png)

各车拥有不同盲区和 AoI；基站补充其仍需接收的信息。此图不代表现场部署。

![原文 Fig. 8：V2X-Sim 检测定性比较](../../assets/papers/update-unseen-aoi-collaborative-perception-figure-2.png)

红框为预测、绿框为真值，依次包含 oracle、LocMW 与三个调度基线；局部框更一致只能提供定性支撑。

## 实验结论与证据

### 场景与计量口径

pNEUMA 用四天 d6/d7 轨迹、543 区域，FLUID 为 201 区域；0.1 s 时隙，关注半径分别 80/60 m。可见性来自距离与密度的随机模型，并非逐帧实测遮挡。岭回归系数 1，$\rho_{\max}=0.99$，预热 500 步。总 AoI 随用户数与区域数累积，不是每车平均延迟。

感知随机取 V2X-Sim 的 10 场景，PointPillars、400 网格，每格按 1 KB。以下是原 Fig. 6(b) 固定 $d=8$ 时的 mAP@70，单位 %；由官方源码 PDF 矢量柱顶与坐标轴反算并四舍五入，属于图读约值，不能当作原始评测日志。

| $K/B$ | LocMW ↑ | Traditional MW ↑ | Max-Demand ↑ | Traditional Max-Demand ↑ |
| --- | --- | --- | --- | --- |
| 0.3 | 约 29.40 | 约 28.21 | 约 27.70 | 约 26.92 |
| 0.6 | 约 31.44 | 约 30.17 | 约 29.69 | 约 28.51 |

同预算下的最后一列差约 2.48/2.93 个百分点；若每格等大小，两个预算对应 120/240 KB 有效载荷／时隙，不含反馈、索引及协议头。[Fig. 6(b) 官方矢量图](https://arxiv.org/html/2607.20967v1/map70_vs_bandwidth_bar.svg)

### 消融能说明什么

Perfect Est. 只移除参数估计误差；传统 MW 忽略本地感知重置，Max-Demand 忽略累计年龄，因而可分别检验状态建模和新鲜度目标。图中 LocMW 与 oracle 接近，但无数值消融表、seed 方差或检测训练配置，不能量化每步模块贡献。

正文 AoI 最大降幅称 31.6%，mAP 相对提升称 16.3%；贡献段却写 37.5%/6.79%，且结果段把多幅图都指作 Fig. 8。源码仍有此矛盾，本报告不把这些最大值作为已重算结论。作者给每步复杂度 $O(B\log B+dB)$，未报告实测运行时间，随机基准二分搜索精度的额外成本也需实现核对。

## 应用场景与启发

适合区域级路侧广播。报告判断：把“接收者是否仍缺信息”加入调度，比仅压缩消息更贴近共享目的；但不可见且陈旧不一定意味着驾驶危险，需要另测任务风险。待验证假设：相同预算下，优先刷新即将占用自车路径的陈旧单元，可以改善关键目标召回。

## 局限与阅读风险

恒定反馈延迟、可靠覆盖与完整基站视野限制现实适用性；检测置信度也不能直接等同于可见性真值。附录 C 式 61 的预测量条件于当前历史，而式 63 使用下一步状态的二阶矩；新增反馈带来的条件方差是否已被正确计入，需要独立核查这一衔接。这是证明审计的待查点，不能据此直接宣称定理错误。[附录 C，式 61–63](https://arxiv.org/html/2607.20967v1#A3.E61)。附录给出理论证明，官方源码包含论文及绘图 PDF，未见实验脚本、配置、训练权重或原始数值；当前限定检索未确认作者实现发布。没有真实链路或驾驶闭环实验。

## 后续跟进

### 最小复核与停止条件

先取得状态日志、图表原始数值和 10 场景 ID，复核最大值及可见性定义。随后固定 400 网格、同检测器、本地刷新规则、估计器和 $d=8$，对照原 LocMW 与仅加入当前估计 TTC/路径相关权重的版本；两组使用相同有效载荷和上行反馈预算。权重只使用推理时可见状态，在独立验证集定参，不使用测试未来真值。记录近路径/短 TTC 目标召回、总体 mAP/AoI 与反馈开销。关键召回改善且不以整体质量明显下降换得，才支持该扩展；若无对应收益或仅靠增加预算，就否定该假设。若无法恢复图表数据或可见性定义，停止数值复现。本次未运行调度或检测实验。
