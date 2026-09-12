---
{
  "id": "rs2ad-lidar-roadside-to-vehicle-generation",
  "tag": "cooperative-autonomous-driving",
  "tags": [
    "cooperative-autonomous-driving",
    "3d-reconstruction",
    "end-to-end-autonomous-driving"
  ],
  "title": "RS2AD-LiDAR: End-to-End Autonomous Driving LiDAR Data Generation from Roadside Sensor Observations",
  "source": "arXiv:2605.23406 / https://arxiv.org/abs/2605.23406",
  "authors": [
    "Runyi Huang",
    "Ni Ding",
    "Ruidan Xing",
    "Yuheng Shi",
    "Lei He",
    "Keqiang Li"
  ],
  "affiliations": [
    "State Key Laboratory of Intelligent Green Vehicle and Mobility, Tsinghua University",
    "School of Vehicle and Mobility, Tsinghua University",
    "College of Artificial Intelligence, Tsinghua University",
    "Logic & Silicon AI Studio",
    "School of Instrumentation and Optoelectronic Engineering, Beihang University"
  ],
  "comment": "RS2AD-LiDAR 反向利用路侧 LiDAR 生成车载 LiDAR 数据，补齐 E2E 自动驾驶单车数据采集成本高、长尾稀缺和数据孤岛问题。"
}
---

## 一句话定位

RS2AD-LiDAR 用坐标变换、局部平面和虚拟射线，把单帧路侧点云及标注转成车载训练样本；已验证的是三类目标检测增强，尚未验证端到端驾驶。[固定全文 v1，§3–4](https://arxiv.org/html/2605.23406v1)

## 论文要解决的问题

固定路口长期观察多辆车，潜在采集效率高；但把路侧点直接搬到车载坐标系，并不会自动获得车载扫描线与遮挡分布。方法试图同时重建扫描规律和复用标签，减少再次采集、标注的需求。

## 方法和系统设计

### 从路侧单帧到虚拟扫描

选择已标注车辆作为目标，用路侧—车体—雷达外参变换点云，过滤量程，再由 Patchwork++ 分离地面和非地面。默认虚拟 Pandar64 为 64 线、垂直视场 −25° 至 15°、水平 360°、角分辨率 0.2°、最大 200 m；垂直角采用非均匀厂家标定值。

非地面点按射线角度分桶，每桶找到最近点，并以距离该点小于 1 m 的邻点拟合平面。§3.4 式 13–17：

$$
(a,b,c)=\arg\min_{a,b,c}\sum_k[z_k-(ax_k+by_k+c)]^2,\qquad
 t_0=\frac{-c-\mathbf n^T\mathbf o}{\mathbf n^T\mathbf d},\quad \mathbf p=\mathbf o+t_0\mathbf d.
$$

$\mathbf n=(a,b,-1)^T$，$\mathbf o$ 为射线原点，$\mathbf d$ 为单位方向，仅保留 $t_0>0$ 的交点。地面使用全局平面；每 2 条垂直射线、25 条水平射线组成扇区，存在非地面回波便屏蔽该扇区的地面采样。这是保守遮挡启发式，不是完整物理回波仿真。

强度复制对应原始点；框中心和朝向做刚体变换，类别与尺寸保留。生成过程无需训练，不补全路侧从未观察到的背面；后续检测器另行训练，不能把两步称为一个可微端到端系统。

### 与原始生成方法比较

[Wu 等，DyNFL，CVPR 2024，§3.1、4.4–5](https://openaccess.thecvf.com/content/CVPR2024/papers/Wu_Dynamic_LiDAR_Re-simulation_using_Compositional_Neural_Fields_CVPR_2024_paper.pdf) 分别优化背景与动态物体 SDF、强度及丢线概率，用丢线判定和最近有效距离组合字段；RS2AD 直接拟合显式平面，没有这种场景优化或学习回波模型。[Xia 等，VRS，2026 v1，§III](https://arxiv.org/html/2605.05897v1#S3) 做反向的车载到路侧转换，先补全车辆再拟合神经场，并用膨胀占据网格限制背景外推；RS2AD 的优势是流程直接，但无法据此断言几何完整度或生成成本优于两者。

## 关键图与可视化结果

![原文 Figure 1：车辆中心与路侧中心数据循环](https://arxiv.org/html/2605.23406v1/Figs/fig1-dataloop.png)

这是采集方式的动机图，右侧“全天候、鲁棒部署”等描述不是本次检测实验测量结果。

![原文 Figure 2：路侧点云生成四个目标车辆视角及处理链](https://arxiv.org/html/2605.23406v1/Figs/fig2-architecture-v2.png)

上方展示视角转换，下方区分地面与非地面。图内 $V_n/V_g$ 标记与正文式 18 的定义存在倒置，解释应按正文的非地面／地面定义。

## 实验结论与证据

### 相同真实测试集上的数据增强

R2V-LiDAR 在一个路口用四台 128 线雷达采集 89 段、超过一万帧；其中 1293 帧重叠区域获标注，筛去覆盖不足帧后生成 1122 帧。按片段划分训练／验证／测试为 61/10/18，帧数约 7/1/2。Real 与 Mix 用同一真实测试集，Mix 额外加入生成数据；两者都不使用其他增强，但未报告等优化步数或等样本数对照。

表 3 为 AP_R40，以下 3D AP 单位 %，Car IoU=0.7，其余 IoU=0.5。

| 模型与训练数据 | Car ↑ | Pedestrian ↑ | Non-motor-rider ↑ |
| --- | --- | --- | --- |
| PointPillars，Real | 69.02 | 3.44 | 75.02 |
| PointPillars，Mix | 69.85 | 5.01 | 75.48 |
| PV-RCNN，Real | 74.22 | 9.17 | 81.97 |
| PV-RCNN，Mix | 77.06 | 11.92 | 81.48 |

PV-RCNN 行人提高 2.75 个百分点，非机动车骑乘者反而下降 0.49；不能概括为所有类别都改善。检测范围一般为 $[-50,50]\times[-40,40]\times[-3,1]$ m，PointPillars 为适应网络步幅略扩展，跨模型数值也不完全同域。

### 相似度与缺失消融

未微调的 nuScenes PointTransformer 对真实／生成点云预测语义，再比较比例：表 2 的 JS 距离 0.1322、余弦相似度 0.9674。但两边 car 比例都为 0%，truck 为 9.14%/2.40%，这不是人工语义真值，也不足以证明车辆几何逼真。两传感器没有严格同步，缺少逐点对齐真值。没有去掉地面分解、改变遮挡扇区或纯重采样的数值消融，无法隔离各模块贡献。[§4.2–4.4，表 2–3、Figure 7](https://arxiv.org/html/2605.23406v1#S4)

## 应用场景与启发

适合已有密集路侧标注的固定路口，用几何转换快速构建额外视角。报告判断：稀少行人类别的增益值得验证，但“低成本”还需生成耗时与额外训练预算；论文未给运行硬件、每帧延迟、训练轮数或多随机种子统计。

## 局限与阅读风险

平面 $z=ax+by+c$ 难表示垂直表面，近乎平行射线的数值保护未说明；全局地面平面也限制坡道适用性。式 20 混用 Rodrigues 旋转向量与 Euler 角解释，复用标签时必须核清约定。全文无附录、作者代码或数据发布入口，当前限定检索未确认实现、R2V-LiDAR、配置及检测权重可下载。

## 后续跟进

### 最小有界检查

先获取一个已标注片段、双侧外参和 Pandar64 束角表，核对框朝向变换与近乎平行射线；再按相同 61/10/18 片段划分比较 Real、重复采样 Real、Mix，固定检测优化步数。成功条件是新增样本不跨片段泄漏，行人增益超过重复采样对照且其他类别退化可解释。若原始划分、坐标约定或数据不可得，停止性能复现；本次未运行生成或训练。
