---
{
  "id": "v2x-cooperative-planning",
  "tag": "cooperative-autonomous-driving",
  "tags": [
    "cooperative-autonomous-driving"
  ],
  "title": "Improved Consensus ADMM for Cooperative Motion Planning of Large-Scale Connected Autonomous Vehicles with Limited Communication",
  "source": "IEEE Transactions on Intelligent Vehicles / https://doi.org/10.1109/TIV.2024.3395479 ; arXiv:2401.09032 / https://arxiv.org/abs/2401.09032",
  "authors": [
    "Haichao Liu",
    "Zhenmin Huang",
    "Zicheng Zhu",
    "Yulin Li",
    "Shaojie Shen",
    "Jun Ma"
  ],
  "affiliations": [
    "The Hong Kong University of Science and Technology (HKUST)",
    "National University of Singapore"
  ],
  "comment": "改进一致性 ADMM 利用局部邻接与稀疏更新减少计算；O(N) 分析限于固定迭代次数、规划长度和有界邻居数，80 车 CARLA 演示另结合动态分组与滚动规划。"
}
---

## 一句话定位

这项工作把非线性多车规划拆成局部子图内的并行 LQR／ADMM 求解，并反复更新子图；核心收益是减少优化耦合规模，有限通信主要指邻接范围限制。[固定全文 v1，§III–VI](https://arxiv.org/html/2401.09032v1)

## 论文要解决的问题

80 辆车不意味着每辆都应参与同一个优化问题。远车之间耦合浪费计算，近车却必须共同处理避碰；论文同时改进局部求解器和重规划时的分组，但没有建模真实无线丢包、队列或时延。

## 方法和系统设计

### 优化问题与局部凸化

OpenDRIVE 车道采样后用 A* 找路线，Savitzky–Golay 平滑得到参考轨迹。每车状态 $z=[x,y,\theta,v]^T$ 为后轴位置、朝向和速度，控制 $u=[a,\delta]^T$ 为加速度、转角。式 4–5 最小化：

$$
\sum_i\left(\sum_{\tau=0}^{T}\|z_\tau^i-z_{\mathrm{ref},\tau}^i\|_Q^2+\sum_{\tau=0}^{T-1}\|u_\tau^i\|_R^2\right),\qquad z_{\tau+1}^i=f(z_\tau^i,u_\tau^i).
$$

还需满足状态／控制边界及车间避碰。外层在当前轨迹附近线性化自行车模型，凸化避碰条件；不涉及数据集训练。一个车辆用双圆、另一个用膨胀椭圆包围，经旋转缩放后，式 10–15 的局部条件是：

$$
\bar p^{ij}=S^{ij}R^j(p^{i,c}-p^j),\qquad
\|\bar p^{ij}\|_2+k^{ij}\Delta\bar p^{ij}-d_{\mathrm{safe}}\geq0.
$$

$c$ 是前／后圆，$S^{ij}$ 的轴缩放含椭圆半轴加圆半径；$k^{ij}$ 为当前归一化相对位置方向。这里 $d_{\mathrm{safe}}\geq1$ 是缩放空间的无量纲裕度，不能与结果图的米制车距混同。

### 两层迭代与稀疏更新

Algorithm 2 外层交换邻车名义轨迹并算 Jacobian；内层交换共识变量 $y$，各车独立解式 33 的 LQR，更新对偶变量。式 31–32 将约束处理化为逐元素投影：

$$
q=y+s/\sigma,\qquad \lambda=\max\{\Lambda,\min\{\Gamma,q\}\},\qquad x=q-\lambda.
$$

$\Lambda,\Gamma$ 是带内部裕度的约束界，$s,y,x$ 是求解器辅助变量，不是车辆状态。作者依据定理 1 分别处理避碰块与盒约束块，提出利用他车辅助项相同／为零来消除重复求和；但式 37(c) 和局部更新系数仍含节点度，对非均匀度数图的等价性需进一步核查。这是推导待查点，本报告没有完成独立证明审计；LQR 原始解更新轨迹后重新线性化。它只求非凸问题的局部解，没有全局最优或任意初值下的安全保证。

### 分组、周期与原始方法比较

Algorithm 3 根据位置、朝向和参考速度的条件 Manhattan 距离生成连通分量，分量内再按通信半径连边；图只在滚动规划之间更新。采样步长 0.1 s，80 车实验规划 15 步、执行前 10 步后反馈，分别对应 1.5 s 与 1.0 s。式 40 又以 $T_s$ 乘速度作为距离，复现时必须核清步数／秒的换算及参考速度界，不能直接当任意道路几何的安全证书。

[Huang 等，DiLQR，2023 v1，§III](https://arxiv.org/html/2301.04386v1#S3) 已做非凸邻域近似、对偶共识和单车 LQR 恢复，但假设通信完全图；本文重点是稀疏块化和动态分组。[Saravanos 等，2022 v1，§IV–V](https://arxiv.org/html/2207.13255v1#S4) 的 ND-DDP 以 ADMM／增广拉格朗日／DDP 三层处理邻域约束，MD-DDP 合并约束与共识层；它们也允许局部通信，因此不能笼统说早期分布式方法都要求全连通。

## 关键图与可视化结果

![原文 Fig. 1：局部通信边与优化子图](https://arxiv.org/html/2401.09032v1/limited_comm_range_v3.1.png)

橙色是一个规划子图，蓝色是某车通信覆盖；两者并非同一概念。

![原文 Fig. 6(b)：80 车协同优化后的轨迹](https://arxiv.org/html/2401.09032v1/Images/all_opt_trajs_w_vehicles.png)

不同颜色对应车辆。本图是优化后轨迹；最小车距属于 Fig. 4，不能从轨迹可视化直接推算安全率或延迟。

## 实验结论与证据

### 固定图上的求解时间

Ubuntu 20.04、Xeon Gold 6230 2.10 GHz、TITAN RTX、256 GB RAM，Python 3.8 加 Numba，CARLA 0.9.14 Town05。表 V 固定规划长度 $T=30$、关闭图演化，时间单位 s：

| 车辆数 | CiLQR ↓ | DiLQR ↓ | 本文 ↓ |
| --- | --- | --- | --- |
| 8 | 0.276 | 0.398 | 0.197 |
| 12 | 1.763 | 0.301 | 0.565 |
| 16 | 6.001 | 0.490 | 0.792 |
| 24 | 15.888 | 3.343 | 1.159 |
| 32 | 20.110 | 5.419 | 2.522 |

32 车比 DiLQR 快约 2.15 倍，12/16 车却更慢；收益不是所有规模一致。另有目标与约束差异：DiLQR 使用软碰撞惩罚，本方法使用硬安全集合（§VI-B），所以这张表不能单独隔离稀疏更新的速度贡献。表 IV 固定 8 车、$T=40$ 时本文 0.377 s 也慢于 DiLQR 0.339 s。文中未给重复次数、误差条或完全匹配的停止残差，不能把单次数值当稳定显著优势。[§VI-B，表 IV–V](https://arxiv.org/html/2401.09032v1#S6)

### 80 车为何更快

80 车实验另启用分组和滚动规划，子图多数少于 10 辆，Fig. 7 报大多数子问题耗时小于 0.25 s；这不是单个 80 车问题或全链路 P99。Fig. 4 的静态规划对照各方法最小距离都超过 2.5 m，没有给 80 车跨随机种子的碰撞率。没有分别关闭稀疏更新／图演化的完整消融，也没有真实消息字节和往返等待开销。

## 应用场景与启发

适合联网车辆可共享规划状态的结构化路网。报告判断：解算并行之外，控制每次相互耦合的车辆数可能更关键；下一步要区分求解器提速与问题规模被缩小这两种收益。

## 局限与阅读风险

$O(N)$ 结论要求固定内外迭代次数、固定规划长度和有界邻居数，针对 §IV-C 的稀疏更新；Algorithm 3 显式构造成对距离矩阵，不能据此宣称整个系统始终线性复杂度。固定全文无附录；[作者项目页](https://henryhcliu.github.io/icadmm_cmp_carla/)现有 60/80/100 车演示，但本报告数值只用 v1 的 80 车评估。其公开仓库当前只有网页、图与视频，未见算法、配置、场景 seeds；优化器无需学习权重。

## 后续跟进

### 同初值、同预算的求解器检验

先取得实现与场景，固定 $T=30$、32 车初始状态、参考轨迹、完整目标、约束和停止残差，在本文同一 OCP 下比较 Algorithm 1 与 Algorithm 2；仅改变稀疏更新，暂不启用图演化。对规则图及非均匀度数图分别记录逐步辅助变量、原始目标、动力学／避碰残差和耗时。拟定通过条件是可行误差不增、同目标差小于 1%，中位耗时减少至少 20%；若辅助变量或可行性出现系统差异，先核查等价性而不归因于提速。原 DiLQR 仅作跨方法参照，单列其软碰撞惩罚与可行残差。之后以相同 80 车 seeds 单独开关图演化，计入构图和通信时间；若初值或终止条件不可得，停止速度复现。本次未运行 CARLA 或优化实验。
