---
{
  "id": "multi-observer-vehicle-localization",
  "tag": "cooperative-autonomous-driving",
  "tags": [
    "cooperative-autonomous-driving",
    "radar-occupancy-representation"
  ],
  "title": "Multi-Observer Vehicle Localization Case Study with Roadside Radar and Connected Vehicle Sensing",
  "source": "arXiv:2608.16966 / https://arxiv.org/abs/2608.16966 / HTML: https://arxiv.org/html/2608.16966 / Planned code and data release: https://github.com/AppuriAalto/multi-observer-vehicle-tracking",
  "authors": [
    "Aleksi Pippuri",
    "Nilusha Jayawickrama",
    "Risto Ojala"
  ],
  "affiliations": [
    "Department of Mechanical Engineering, Aalto University"
  ],
  "comment": "论文在赫尔辛基真实路口融合固定路侧雷达与联网车辆 LiDAR，诚实给出雷达没有稳定提升定位精度的负结果；它把传感器几何、刷新率、遮挡和轨迹可用率对协同定位的影响量化出来。"
}
---

## 一句话定位

真实赫尔辛基路口的异构目标级融合案例：路侧雷达加车载 LiDAR 并未自动胜过强 LiDAR 基线；微小定位改善和轨迹可用率变化取决于几何、更新频率和关联条件。[全文 v1，§III–V](https://arxiv.org/html/2608.16966v1)

## 论文要解决的问题

道路上普通车辆不能主动上报位置，基础设施可借联网车观测补充跟踪。但雷达位置偏差、动态车载坐标转换和不同时钟会使融合反而变差。论文检验两种 EKF 更新方式，重点是现实互补性，不是提出新的学习架构。

## 方法和系统设计

### 预处理、标定和跟踪边界

车载 10 Hz VLP-32C 点云由预训练 PointPillars 检测，置信度低于 0.2 被丢弃；50 Hz GNSS/INS 将检测转换到路侧雷达 ENU 坐标。路侧 UMRR-11 也以 10 Hz 提供目标位置。所有数据本地记录后离线处理，未评估实时无线传输。

五次标定运行上估计平移、偏航和时钟偏移，先差分进化再 Powell 优化；滤波参数也仅在标定集网格搜索。十次评估运行中的一段雷达文件损坏，最终 19 段；独立目标车 GNSS 只用于评价，不输入正常跟踪。

CTRV 状态是 $\mathbf x=[p_x,p_y,v,\psi,\dot\psi]^T$。两种传感器日常更新都只使用二维位置，雷达速度／方向仅辅助新轨迹初始化。Mahalanobis 门控后做一对一贪心关联；一条有效观测即确认，连续超过 50 个雷达帧未命中才删除。

### 顺序更新与协方差加权

SEKF 先雷达后 LiDAR 校正；AEKF 在两者关联到同一轨迹时先融合观测，再校正一次。§III-B 式 5–6：

$$
\bar R=(R_r^{-1}+R_l^{-1})^{-1},\qquad
\bar z=\bar R(R_r^{-1}z_r+R_l^{-1}z_l).
$$

$z_r,z_l$ 是位置，$R_s=\sigma_s^2I_2$ 是固定测量协方差，假设误差条件独立。缺一路就单传感器更新，两路都缺则仅预测。共享标定误差可能破坏独立假设。

报告分析：在相同关联、先验及协方差下，线性位置观测的顺序校正与上述信息加权校正应等价。表 I 的过程噪声、关联门和 LiDAR 噪声分别调过，因此不能把最终差值解释为“平均更新天然更准”。

### 两项原始机制对照

[Lang 等，PointPillars，2018 v1，§2](https://arxiv.org/pdf/1812.05784v1) 学习柱状点集特征、散射伪图像并用二维卷积回归框；本文只采用其预训练检测输出，不联合优化检测器与滤波器。[Yu 等，V2X-Seq，CVPR 2023，§4](https://openaccess.thecvf.com/content/CVPR2023/papers/Yu_V2X-Seq_A_Large-Scale_Sequential_Dataset_for_Vehicle-Infrastructure_Cooperative_Perception_and_CVPR_2023_paper.pdf) 的 FF-Tracking 传输压缩特征及时间导数，补偿延迟后检测，再用 AB3DMOT 跟踪；本文传位置级结果，通过预测应对缺测，不做学习式特征时间外推。

## 关键图与可视化结果

![原文 Fig. 1：路侧雷达与联网车 LiDAR 的目标级融合](https://arxiv.org/html/2608.16966v1/figures/intro_flowchart.png)

两类观测用于估计同一个独立目标车，真实道路采集与离线融合应分开理解。

![原文 Fig. 7：相对目标车参考轨迹的定位误差点云](https://arxiv.org/html/2608.16966v1/error_cloud_methods_row.png)

虚线圈为 1、2、5 m。雷达误差更分散且有结构性偏移；这张图汇集样本，正文主表则先逐段求指标再平均，两者权重不同。

## 实验结论与证据

### 误差必须与可用率一起读

表 IV，19 段等权平均；RMSE 仅对距离门内匹配样本计算，括号是段间标准差。评价门 5 m，粘性跟踪同一 ID，失配 10 帧后允许重新捕获。

| 方法 | RMSE，m ↓ | MAE，m ↓ | 匹配率 ↑ |
| --- | --- | --- | --- |
| LiDAR EKF | 0.84 (0.30) | 0.74 | 0.983 |
| Radar EKF | 3.27 (0.65) | 3.12 | 0.215 |
| SEKF | 0.84 (0.29) | 0.74 | 0.982 |
| AEKF | 0.81 (0.29) | 0.73 | 0.984 |

AEKF 对 LiDAR 约减少 0.03 m，而匹配率只多 0.1 个百分点。它不能与仅匹配 21.5% 样本的雷达 RMSE 脱离可用率直接比较，也没有配对显著性检验。

### 降频与遮挡消融

表 VI 保持全频调参配置、将 LiDAR 降至 2 Hz 时，LiDAR/SEKF/AEKF 的 RMSE 分别 1.20/1.12/1.03 m；若改用 1 Hz 调参，变为 1.01/1.04/1.07 m，排序反转。表中的百分比是相同频率下相对最佳行，不是相对 10 Hz 的退化量。

表 VII 人工删除目标参考位置 2.5 m 内的 LiDAR 检测，在每段 25%、50%、75% 位置开始遮挡。下列指标只在遮挡区间统计，再对三个遮挡起点平均，不是整段指标。7 s 遮挡时 LiDAR/SEKF 为 2.42/2.49 m，匹配率 0.692/0.724：SEKF 增加 3.2 个百分点可用率，却没有改善已匹配位置误差。这不是实物遮挡试验。论文未报告运行硬件、处理延迟或通信字节量。[§III-G、表 VI–VII](https://arxiv.org/html/2608.16966v1#S3.SS7)

## 应用场景与启发

联网车可帮助基础设施补足观测，即使只共享低频目标位置。更值得迁移的是同时衡量精度、缺测与错误关联；只优化 RMSE 可能奖励主动丢弃困难样本。论文自己的结论也限定为场景相关收益。待验证假设：这里 AEKF/SEKF 的部分差异来自 Q/R 与关联配置，而非位置观测下更新顺序本身；同配置和共同观测回放可直接检验。

## 局限与阅读风险

仅一次采集会话、一个路口、两种车辆相对排列；独立 GNSS 是有误差的参考轨迹。式 10 写关联门为 5，最终表 I 却为 24/44/32/36，需以实际配置核清。固定全文未含附录。摘要宣称发布数据和实现，但当前[官方仓库](https://github.com/AppuriAalto/multi-observer-vehicle-tracking)只有 README，写明发表后提供；代码、数据、配置及本实验检测权重尚不可核验。

## 后续跟进

### 先做可比性复核

等仓库提供 5/10 次运行划分、标定参数、检测缓存和 GNSS 后，先用固定一段共同观测、相同 $Q/R$ 与关联结果，比较 SEKF/AEKF 数值等价性，再重算 19 段等权表 IV。成功条件是表内舍入一致且所有方法公布同一匹配样本集的误差及完整可用率；若参数或划分缺失，停止准确率复现。未开展跟踪实验。
