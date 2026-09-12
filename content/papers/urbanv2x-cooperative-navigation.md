---
{
  "id": "urbanv2x-cooperative-navigation",
  "tag": "cooperative-autonomous-driving",
  "tags": [
    "cooperative-autonomous-driving"
  ],
  "title": "UrbanV2X: A Multisensory Vehicle-Infrastructure Dataset for Cooperative Navigation in Urban Areas",
  "source": "IEEE ITSC 2025 / arXiv:2512.20224 / https://arxiv.org/abs/2512.20224 / https://polyu-taslab.github.io/UrbanV2X/",
  "authors": [
    "Qijun Qin",
    "Ziqi Zhang",
    "Yihan Zhong",
    "Feng Huang",
    "Xikun Liu",
    "Runzhi Hu",
    "Hang Chen",
    "Wei Hu",
    "Dongzhe Su",
    "Jun Zhang",
    "Hoi-Fung Ng",
    "Weisong Wen"
  ],
  "affiliations": [
    "Department of Aeronautical and Aviation Engineering, The Hong Kong Polytechnic University",
    "Hong Kong Applied Science and Technology Research Institute",
    "Nanyang Technological University"
  ],
  "comment": "UrbanV2X 提供香港 C-V2X 测试场里的车端和路侧多传感器数据，价值在于把车路协同导航从仿真或单模态感知推进到真实城市数据资产。"
}
---

## 一句话定位

UrbanV2X 提供香港 C-V2X 测试区的车端／路侧多传感器导航数据，主要价值是 GNSS 退化、跨设备同步和基础设施辅助定位的评测条件；论文没有给全传感器联合融合新算法。[固定全文 v1，§III–V](https://arxiv.org/html/2512.20224v1)

## 论文要解决的问题

城市峡谷同时存在 GNSS 多径、动态遮挡和视觉／LiDAR 几何退化。单车数据难检验“附近路侧 GNSS 与 UWB 能补多少”，因此需要共同时间轴、外参与参考轨迹，而不只是增加传感器种类。

## 方法和系统设计

### 采集与同步协议

车载含七个工业相机、朝天相机、两台 32 线 LiDAR、前向 4D 雷达、IMU、GNSS 与 UWB；路侧有 300 线 LiDAR、GNSS 接收机及 UWB 锚点。相机／LiDAR 10 Hz，雷达 13 Hz，IMU 400 Hz，GNSS 1 Hz，UWB 50 Hz。

GNSS NMEA/PPS 驱动 PTP 服务，Ethernet 设备同步硬件时钟；非 Ethernet 设备记录 GPS 同步的 ROS 时间。GigE Action Command 触发相机，文中精度小于 0.005 s。这是相机触发精度，不能扩成所有传感器端到端时间误差均小于 5 ms。

### 标定与评价边界

LiDAR—相机通过 ArUco 板提取三维角点，点云侧聚类、RANSAC 平面与最小包围矩形找角点，再 ICP 配准，报告重投影误差约 2.3 pixels。相机—IMU 使用 Kalibr；LiDAR—IMU 使用带充分运动激励的 LI-Init；两 LiDAR 再 NDT 对齐。GNSS-RTK/INS 加光纤陀螺输出 1 Hz 六自由度参考位姿，5 cm 是系统规格／作者参考精度陈述，未逐段独立测得。

无学习训练阶段；SLAM 基线在记录数据上运行优化，大小环测试关闭回环。论文以 APE 汇总定位误差，但未充分交代配准自由度、时间关联和失败段处理。若 $e_k$ 是同一批非负平移误差，指标含义为：

$$
\mathrm{RMSE}=\sqrt{\frac1n\sum_ke_k^2},\qquad
\mathrm{Mean}=\frac1n\sum_ke_k,\qquad \mathrm{RMSE}\geq\mathrm{Mean}.
$$

这是用于检查表格的指标定义，不是作者提出的新目标函数。

### 原始基线为何不同

[Qin 等，VINS-Mono，2017 v1，§IV、VI](https://arxiv.org/html/1708.03852v1) 将视觉特征与带偏置校正的 IMU 预积分放进滑窗非线性优化，另提供重定位和全局位姿图。[Shan 等，LIO-SAM，2020 v1，§III](https://arxiv.org/html/2007.00258v1#S3) 把 IMU、局部 LiDAR 配准、可选 GPS 与回环作为因子。UrbanV2X 关闭回环后的结果检验的是特定配置的漂移，不能代表这些方法启用全部校正能力后的最佳性能。

## 关键图与可视化结果

![原文 Fig. 1：车载与路侧设备及对应数据](https://arxiv.org/html/2512.20224v1/pic/Overview.png)

图中同时有路侧 LiDAR/GNSS 和 UWB/GNSS；拥有这些流不意味着论文已做联合定位消融。

![原文 Fig. 2：传感器网络与 PTP 时间源](https://arxiv.org/html/2512.20224v1/pic/sys_architecture.png)

图显示采集网络、触发器和存储连接，不是无线 C-V2X 延迟测试结果。

## 实验结论与证据

### 规模与匹配对照

表 III 的 Small Loop 为 309 s、27 GB，Large Loop 为 600 s、48.6 GB，Static 为 1800 s、未给体积；前两者约 1.8/5.8 km 每环，数据包含城市道路与高速，Small Loop 明确是晴天白天。论文无训练／验证／测试划分。

表 IV–V 的 APE RMSE，单位 m；大小环同一行按相同算法配置比较，但各算法模态不同。

| 方法 | Small Loop ↓ | Large Loop ↓ |
| --- | --- | --- |
| VINS-Mono，Front-left-2 | 61.568 | 184.866 |
| Fast-LIO2 | 29.311 | 43.284 |
| Fast-LIVO2 | 304.246 | 379.946 |
| GNSS-RTK，公共基站 | 18.595 | 12.443 |

静态场景固定 RTKLIB 定位任务，把香港天文台公共基站替换为附近路侧 GNSS：RMSE 14.986→8.422 m，减少 6.564 m，约 43.8%；Mean 13.999→8.152 m。作者归因于更短基线与相似多径环境；没有重复站点／时段消融来分别验证两个原因。[§V-B，表 V](https://arxiv.org/html/2512.20224v1#S5.SS2)

### 不能直接采信的部分

表 IV 的 Large Loop LIO-SAM 写 RMSE 49.985 m、Mean 57.465 m；对相同非负误差样本这违反上面的关系，需原始轨迹或作者更正，本报告不将该行用于排名。UWB 三锚点仅以 Fig. 9 展示测距及收到锚点数，没有给融合定位 APE 的有／无 UWB 数字。运行 CPU、内存、耗时和多次运行方差均未报告，不能从采样频率推断实时能力。

## 应用场景与启发

适合检验传感器退化时，路侧绝对约束是否减少累计漂移。报告判断：最有说服力的后续比较应固定 GNSS 求解器、卫星筛选和时间段，只改变差分参考站；不能拿单车 SLAM 与路侧 RTK 的差距直接归因为协同算法。

## 局限与阅读风险

[官方页面](https://polyu-taslab.github.io/UrbanV2X/download/)列出大小环 rosbag、TUM 参考轨迹、路侧 LiDAR/RINEX 链接，[标定页](https://polyu-taslab.github.io/UrbanV2X/calibration/)列出内外参。当前页面大小环包标 34.9/62.2 GB，与论文表不同；本次只核查清单，未下载大包验证内容。未见 Static 下载入口、论文基线完整配置或结果轨迹发布；这些经典优化器不要求学习权重。

网站首页仍有事件相机、81 段／200 km 的异类描述，下载页若干 GNSS topic 解释也明显错配，不据此扩大数据范围。固定全文无附录；真实导航参考仍受自身 GNSS/INS 误差影响。

## 后续跟进

### 最小实验锁定表 V

需要 1800 s Static 的车端原始 GNSS、公共／路侧基站 RINEX、参考轨迹与同一 RTKLIB 配置。先确认时间轴及同一卫星集合，再仅切换参考站重算 APE。拟定通过条件是两组 RMSE 在表 V 的 1 m 范围内，且路侧站改善在相同有效历元集合仍成立；若缺 Static 或不能恢复求解设置，停止数值复现并记录资源缺口。本次未运行定位算法。
