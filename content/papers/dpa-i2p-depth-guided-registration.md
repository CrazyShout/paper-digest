---
{
  "id": "dpa-i2p-depth-guided-registration",
  "tag": "3d-reconstruction",
  "tags": [
    "3d-reconstruction"
  ],
  "title": "DPA-I2P: Depth-Guided Projective Alignment for Image-to-Point-Cloud Registration in Autonomous Driving",
  "source": "arXiv:2608.26589v1 / https://arxiv.org/abs/2608.26589v1",
  "authors": [
    "Wenxin Zhang",
    "Hang Li",
    "Zhiwei Xu",
    "Qiankun Dong",
    "Gang Wang",
    "Tao Li"
  ],
  "affiliations": [
    "Nankai University",
    "Haihe Laboratory of Information Technology Application Innovation"
  ],
  "comment": "以冻结度量深度构造相机射线特征，再用粗位姿投影增强点特征和限制早期匹配；KITTI 定位误差降低，但深度预计算不在所报延迟内。"
}
---

## 一句话定位

DPA-I2P 用度量深度、相机射线和粗位姿投影提高单图像到点云的对应质量，在 KITTI 合成误配协议上改善 6-DoF 定位；它处理的是配准，没有验证连续 SLAM 或下游驾驶收益。

## 论文要解决的问题

### 图像纹理与稀疏几何怎样对应

输入为同一场景 RGB、点云和相机内参，输出将点云与图像对齐的旋转、平移。重复纹理和弱纹理下，图像特征缺少尺度，点特征缺少视觉语义；错误对应还会污染后续精修。作者先学粗位姿，再用两侧几何约束辅助查询，依赖粗投影仍有一定支撑。[v1，§III](https://arxiv.org/html/2608.26589v1#S3)

### 两个直接前身

[ICLI2P 原版 CVPR 2025，§3](https://openaccess.thecvf.com/content/CVPR2025/papers/Li_Implicit_Correspondence_Learning_for_Image-to-Point_Cloud_Registration_CVPR_2025_paper.pdf)用视锥筛重叠、交替图像/点注意力生成对应，再以 MLP 回归位姿残差；不能照本文相关工作概括，把它写成概率 PnP。[UniDepthV2 自身 §III、原图 5](https://arxiv.org/html/2502.20110v1#S3)预测相机射线、度量深度与误差不确定性，置信度由不确定性的逆得到。DPA-I2P 使用这个冻结先验增强配准，不重新训练深度估计器。

## 方法和系统设计

### RMDE：在相机坐标中编码深度邻域

在每个特征尺度调整内参，令 $\tilde d_i=[(u_i-c_x)/f_x,(v_i-c_y)/f_y,1]^\top$。简写式 (3)–(5)：

$$
s_i=s_{\min}+(s_{\max}-s_{\min})(1-\bar C_i),\qquad
z_{ik}=\max(D_i+\rho_k s_i,\epsilon),\qquad p_{ik}=z_{ik}\tilde d_i.
$$

$D_i$ 是米制相机深度，$\rho_k\in[-1,1]$ 是固定采样偏移，$\epsilon$ 避免非正深度，$\bar C_i$ 越大表示越可靠，因此采样区间越窄。这里乘的是末维为 1 的射线，$z$ 是相机轴向深度，不能误用欧氏射程乘单位射线。三维点、单位方向、对数深度偏移与置信度经位置编码、加权汇聚和残差门控注入图像特征。[§III-B，式 (1)–(14)](https://arxiv.org/html/2608.26589v1#S3.SS2)

### PVL 和 CQP：投影约束只在早期使用

PVL 根据粗位姿把点投到特征图，取中心格特征，经映射得到 $\bar z_i$。式 (16) 为：

$$
\hat f_{P,i}=f_{P,i}+\delta m_i\bigl(\tanh(w)\odot\bar z_i\bigr).
$$

$m_i$ 是投影有效性，$\delta$ 表示启用阶段，$w$ 是可学习通道权重。该式直接使用有界残差与有效性门控，没有额外的深度置信度乘子；无效投影保持原点特征。[§III-C](https://arxiv.org/html/2608.26589v1#S3.SS3)

CQP 将有效投影叠加为高斯支撑图 $S(x)$，式 (20) 把 $\beta\log(S+\epsilon)$ 加入查询与图像 token 的相似度，再屏蔽极低支撑位置。其作用是限制候选落点；原文没有完整交代如何将空间 mask 转成查询删除操作。RMDE 用全部四尺度，PVL/CQP 只用前三层精修中的前两层，避免后期被粗先验锁死。[§III-D](https://arxiv.org/html/2608.26589v1#S3.SS4)

### 训练与推理

ResNet-FPN、KPFCNN 输出 128 维特征，128 个对应查询精修三层，原图 2 标注末端为 Differentiable PnP。先训练粗分支，再用 GT 位姿的平移 L1、旋转测地距离及早期支撑 KL 正则端到端优化；UniDepthV2 深度与置信度离线预计算。单 RTX 4090、batch=4、40 epochs。部署同样需要深度先验，不能把训练时冻结解释为推理免费。[§III-E、§IV-A](https://arxiv.org/html/2608.26589v1#S4.SS1)

## 关键图与可视化结果

### 原图 2：从先验到位姿

![原图 2：RMDE、PVL、CQP 和可微 PnP 的数据流](https://arxiv.org/html/2608.26589v1/overview_new.png)

左侧区分冻结深度与两种主干，中间是图像和点特征增强，右侧是支撑约束与位姿输出。图中没有提供 PnP 的具体求解设置。

### 原图 5：保留全部四个例子

![原图 5：四组 2D–3D 对应与配准误差](../../assets/papers/dpa-i2p-depth-guided-registration-v1-original-figure-5.png)

绿色线是作者标记的正确对应，每组附 RTE/RRE。四个成功样例支持对应可视化，不给出低重叠或深度失效时的成功率。

## 实验结论与证据

### KITTI 主表及跨数据集边界

KITTI 0–8 序列训练、9–10 测试，160×512 图像、40,960 点；初始扰动为地面 ±10 m 平移及不限制范围的竖直轴旋转。RTE 为平移误差（m），RRE 为旋转误差（°）；Acc 要同时满足 RTE<2 m、RRE<5°。[§IV-B、表 I](https://arxiv.org/html/2608.26589v1#S4.SS2)

| KITTI 方法 | RTE，越低越好 | RRE，越低越好 | Acc，越高越好 |
| --- | --- | --- | --- |
| ICLI2P | 0.20±0.21 m | 1.24±2.34° | 97.49% |
| DPA-I2P | 0.11±0.12 m | 0.55±0.67° | 99.70% |

均值相对下降 45.0%/55.6%，Acc 增加 2.21 个百分点；表中 ± 未明确其统计定义，不能当多种子置信区间。nuScenes 表 I 从 ICLI2P 的 0.63 m/2.13°/90.94% 到 0.54 m/1.92°/92.02%，但正文称“qualitative”，采用作者所称 150 test scenes 和相邻帧累积点云，训练/微调、配对数量和扰动协议披露不足。

### 消融与成本

表 II 去掉 RMDE/PVL/CQP 的 RRE 为 0.58°/0.74°/0.65°，完整为 0.55°；去 CQP 的 RTE 为 0.18 m。表 III 直接拼深度与完整 RMDE 的 Acc 为 99.63%/99.70%，只是 0.07 个百分点差；未报告重复试验，不能据此认定每项细设计独立显著。表 IV 全程剪枝 RTE/RRE 为 0.14 m/0.66°，弱于只剪早期。

表 V 在 RTX 4090、batch=4 下按图点对平均：ICLI2P 35.12 ms、10.74 GB，DPA-I2P 36.81 ms、11.15 GB。两者网络大小为 175.92/179.93 MB，不是参数个数；DPA 的深度计算未计入延迟。[§IV-D/E](https://arxiv.org/html/2608.26589v1#S4.SS4)

## 应用场景与启发

### 待验证的几何可靠性假设

本报告判断：最值得迁移的是早期使用投影支撑、后期放松约束的策略。待验证假设是它仅在粗投影具有足够支撑召回时有效；粗位姿误差可能把正确对应排除。深度尺度错误主要先影响 RMDE 特征，不直接定义 CQP 的点投影支撑，因此应单独测试两条路径，现有平均误差没有回答这一点。

## 局限与阅读风险

### 接口和评价仍有缺口

2026-09-12 [官方记录](https://arxiv.org/abs/2608.26589v1)未核实本模型代码、配置、检查点或预计算资产入口。深度置信度的 Norm、采样半径、剪枝阈值及 PnP 细节不充分；尤其需核对 UniDepthV2 的不确定性到“越大越可靠”置信度的转换。外部 ICLI2P 当前仓库已扩展为 ICL++，复现主表不能默认使用最新分支。[官方基线仓库](https://github.com/XinjunLi-ustc/ICL-I2PReg)

## 后续跟进

### 一个固定初始误差的对照

前提是取得原版基线和 DPA 配置、深度/置信度转换及测试 pair 列表。固定三组的主干初始化、训练步数与数据，比较无 CQP、早期 CQP、全程 CQP；对每个测试对在同一粗位姿上施加预设的相同平移/旋转偏差，按扰动后的投影支撑召回分层，且三组使用完全相同的扰动。另做独立深度尺度偏差试验，保持粗位姿与点云不变，不将深度误差直接归因为支撑图剪枝。记录 Acc、尾部 RTE/RRE、正确对应保留率，并计入深度的完整延迟。成功需早期 CQP 在正常与轻度偏差下均改善成功率；若低支撑组持续删除正确匹配，则停止推广剪枝，改用软支撑或回退机制。
