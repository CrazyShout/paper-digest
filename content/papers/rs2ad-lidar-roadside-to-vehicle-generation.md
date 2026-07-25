---
{
  "id": "rs2ad-lidar-roadside-to-vehicle-generation",
  "tag": "cooperative-autonomous-driving",
  "tags": ["cooperative-autonomous-driving", "3d-reconstruction", "end-to-end-autonomous-driving"],
  "title": "RS2AD-LiDAR: End-to-End Autonomous Driving LiDAR Data Generation from Roadside Sensor Observations",
  "source": "arXiv:2605.23406 / https://arxiv.org/abs/2605.23406",
  "authors": ["Runyi Huang", "Ni Ding", "Ruidan Xing", "Yuheng Shi", "Lei He", "Keqiang Li"],
  "affiliations": ["State Key Laboratory of Intelligent Green Vehicle and Mobility, Tsinghua University", "School of Vehicle and Mobility, Tsinghua University", "College of Artificial Intelligence, Tsinghua University", "Logic & Silicon AI Studio", "School of Instrumentation and Optoelectronic Engineering, Beihang University"],
  "comment": "RS2AD-LiDAR 反向利用路侧 LiDAR 生成车载 LiDAR 数据，补齐 E2E 自动驾驶单车数据采集成本高、长尾稀缺和数据孤岛问题。"
}
---

## 一句话定位

RS2AD-LiDAR 是一篇车路协同数据生成论文。和上一期 VRS 从车端数据生成路侧 LiDAR 相反，这篇论文从 roadside sensor observations 重建和生成 vehicle-mounted LiDAR data，目标是把路侧长期采集优势转化为可训练车端模型的数据资产。

## 论文要解决的问题

端到端自动驾驶训练主要依赖单车采集，成本高、标注贵、场景稀缺，且不同车辆的数据孤岛严重。路侧传感器可以长期覆盖固定路口和道路片段，但它观察到的是 infrastructure view，不是车载 LiDAR 坐标和扫描模式。论文的问题是：如何从路侧 LiDAR 点云生成和真实车载 LiDAR 相似的数据，并验证它能提升 BEV/3D object detection。

## 方法和系统设计

- 构建 R2V-LiDAR 评估数据集，用于研究路侧和车载 LiDAR 高重叠覆盖下的数据生成问题。
- 将 roadside LiDAR point clouds 转换到 vehicle-mounted LiDAR coordinate system，并通过 virtual LiDAR modeling 和 point cloud resampling 合成车载点云。
- 使用语义相似性和检测训练实验验证生成数据，而不是只展示点云可视化。

## 关键图与可视化结果

![图 1：传统车端数据闭环和 RS2AD-LiDAR 路侧基础设施数据闭环的对比](https://arxiv.org/html/2605.23406v1/Figs/fig1-dataloop.png)

这张图是论文最重要的系统动机：它把基础设施感知从辅助感知，提升为可持续生成车端训练数据的数据源。

![图 2：RS2AD-LiDAR 从路侧点云生成车载 LiDAR 数据的整体框架](https://arxiv.org/html/2605.23406v1/Figs/fig2-architecture-v2.png)

这张图展示从 roadside acquisition 到 vehicle-mounted point cloud generation 的具体 pipeline，读者应关注坐标转换、虚拟 LiDAR 建模和 resampling 三个环节。

## 实验结论与证据

摘要报告生成数据和真实数据具有语义相似性，并且把生成数据加入真实数据训练后能提升 BEV 和 3D detection accuracy。这个证据说明方法不是只生成“看起来像”的点云，而是在下游检测任务中提供增益。

## 应用场景与启发

- 应用场景：路侧长期采集数据复用、车端 LiDAR 预训练、固定路口长尾场景补充、车路协同数据闭环。
- 方法启发：车路协同数据生成可以双向做，既能车端转路侧，也能路侧转车端。
- 讨论问题：路侧生成的车端点云是否能用于 planning 或 closed-loop E2E training，而不只是 detection。

## 局限与阅读风险

论文自建 R2V-LiDAR 只用于评估，真实部署中路侧和车载传感器重叠覆盖、标定精度、遮挡和时间同步会影响生成质量。方法主要验证 object detection 增益，尚未证明对端到端 control 或闭环安全有直接收益。

## 后续跟进

- 检查 R2V-LiDAR 是否计划开放，以及虚拟 LiDAR 参数是否能迁移到不同设备。
- 与 VRS 形成“车端到路侧”和“路侧到车端”的对照表。
- 后续可把固定路口路侧数据作为自动驾驶长尾训练集生成入口。
