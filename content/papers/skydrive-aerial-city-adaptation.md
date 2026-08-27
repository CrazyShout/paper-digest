---
{
  "id": "skydrive-aerial-city-adaptation",
  "tag": "end-to-end-autonomous-driving",
  "tags": ["end-to-end-autonomous-driving", "autonomous-driving-testing"],
  "title": "SkyDrive: Learning to Drive in a New City from Aerial Traffic Monitoring",
  "source": "arXiv:2608.25142 / https://arxiv.org/abs/2608.25142 / HTML: https://arxiv.org/html/2608.25142v1",
  "authors": ["Weijiang Xiong", "Lan Feng", "Alexandre Alahi", "Nikolas Geroliminis"],
  "affiliations": ["École Polytechnique Fédérale de Lausanne (EPFL)"],
  "comment": "SkyDrive 把 137.2 小时无人机交通监控中的每辆车转成 virtual ego，形成约 65 万规划样本，证明新城市适配不一定先派测试车采数据；但派生数据与代码尚未发布，协议也不是反应式闭环。"
}
---

## 一句话定位

SkyDrive 把城市适配的数据采集视角从单辆 instrumented vehicle 提到空中：无人机一次观察一个路口中的大量车辆，每条地理配准轨迹都可变成 virtual ego demonstration。论文从 Songdo 20 个路口、137.2 小时监控中构建约 65 万片段，并同时测试 trajectory planning 与 motion prediction，说明少量目标城市俯视数据可以显著缓解跨城域移。

## 论文要解决的问题

端到端 planner 在新城市会遇到道路形态、交通规则和本地驾驶行为变化。传统适配需要装有多相机、LiDAR 和定位系统的车辆逐路采集，单次只能记录一个 ego，覆盖长尾成本很高。公开 aerial dataset 虽能看见更多参与者，通常只被当作交通流或 motion prediction 数据，没有转成 planner 可直接使用的 ego-centric 监督。

SkyDrive 的关键问题是：能否从俯视轨迹构造与车端 planner 接口相似的历史、语义场景和未来计划，并量化零样本模型在新城市究竟错在哪里、需要多少本地监控数据才能恢复。

## 方法和系统设计

- 从 Songdo Traffic 的地理配准轨迹中选择速度中位数大于 10 km/h 的车辆作为 virtual ego，以其坐标系切分 8 秒场景、4 秒 stride，并清除缺失、尺寸异常和近重复片段。
- 规划任务使用 2 秒历史、2 Hz 四帧语义视图，预测 4 秒八个 waypoint；二维俯视要素通过平地假设和车型经验高度构造前后左右等 ego-centric semantic views。
- motion prediction 使用 2 秒历史、6 秒未来、10 Hz，输出六条候选；同时评估从 nuScenes 零样本迁移的 MTR 与在 SongdoDrive 上训练的 AutoBot、Wayformer、MTR。
- 数据覆盖 20 个路口、4 天、800 sessions。训练为 116.23 小时、549,929 ego segments，测试为 20.97 小时、99,629 segments，总计 649,558。

## 关键图与可视化结果

![图 1：从无人机交通监控、virtual ego 切片到规划与预测评测的 SkyDrive 流程](https://arxiv.org/html/2608.25142v1/workflow_illustration.png)

Figure 1 展示 aerial data 的规模优势：同一观察时段中的多个车辆都能成为监督来源。流程同时评价准确性、道路合规和 TTC，但这些指标仍由离线轨迹与地图计算，不是闭环交通响应。

![图 3：繁忙换道事件的俯视场景及前、后、左、右 ego-centric 语义视图](https://arxiv.org/html/2608.25142v1/figures/rendering_example.png)

Figure 3 说明 planner 实际读取的是由轨迹和地图渲染出的语义视图，不是无人机 RGB 或真实车载相机。它降低了外观域移，也同时移除了传感噪声、遮挡和三维道路起伏。

![图 4：SkyDrive 规划任务中直行、普通转弯、急转和静止等轨迹类型](https://arxiv.org/html/2608.25142v1/turning_type_decisions.png)

Figure 4 把数据价值落到行为覆盖。后续结果显示 stationary 与复杂转弯正是零样本误差放大的类别，因此按轨迹类型而不是只按路口划分更适合设计适配课程。

## 实验结论与证据

规划任务上，DrivoR 零样本 ADE/FDE/TTC/NCT 为 3.702 m、8.855 m、38.10%、8.24%，使用完整本地数据后为 1.589、3.774、10.82%、4.80%。RAP 从 3.399、8.116、25.56%、1.12% 改善到 1.263、2.730、5.89%、0.13%。数据量消融显示约每路口 30 分钟监督已带来明显改善，但论文只给曲线，不能从图上反推精确点值。

motion prediction 中，nuScenes 训练的 MTR* 零样本 BrierFDE/minADE/minFDE/MissRate 为 3.953/1.497/3.369/0.494；目标域训练的 Wayformer 为 1.763/0.564/1.157/0.148。MTR* 相对目标域 MTR 的 BrierFDE 与 minADE 分别高 108% 和 120%，stationary 类 BrierFDE 从 0.457 放大到 2.017，说明“停还是走”的城市行为差异比普通轨迹形状更难迁移。

17 路口训练、3 路口留出的 cross-intersection 结果与标准 split 差距不大，说明同一城市区域内部分路口可共享行为先验。但这不是 cross-city 验证：训练和测试仍来自 Songdo 同一监控系统与道路文化。

## 应用场景与启发

- 应用场景：新城市 planner 适配、路口级行为建模、低成本 motion prediction 数据构建和城市部署前数据预算估算。
- 方法启发：将“每个被观察车辆都变成 ego”可以显著放大监督，但必须保留路口、时间段和车辆身份，防止相邻片段泄漏到不同 split。
- 研究启发：可用 aerial supervision 学本地 traffic prior，再用少量车载 Radar/Camera 校准可观测性，把行为域移与传感域移分开。
- 讨论问题：本地行为先验应该进入 planner 权重、检索记忆，还是作为不确定性校准层，才能避免换城市时灾难性遗忘？

## 局限与阅读风险

实验只覆盖韩国 Songdo 一个目标城市。语义视图依赖平地与经验车辆高度，高层 left/right/straight 指令由未来轨迹离线生成；TTC 使用不会响应 ego 计划的 logged background，因此不能外推为反应式闭环安全。没有真实车辆部署，也没有相机、雷达、定位误差和天气测试。

表 1 报告 367,806 valid vehicles 与 649,558 ego segments，表 2 却写 646.5k unique tracks/650k scenarios，当前稿未解释，报告不把二者混为同一计数。作者写明数据与代码将公开，但核验时没有 SongdoDrive 下载、训练代码或 checkpoint；只有上游 Songdo Traffic 的 Zenodo 数据已存在，不能称派生 benchmark 已发布。AAAI 2027 模板不是投稿或录用证据。

## 后续跟进

- 待派生数据发布后，核对 session、vehicle、segment 三层去重和 split，重算论文中的 367,806、646.5k、649,558 三组计数。
- 用真实 route command 替代由未来轨迹生成的高层指令，并在反应式 simulator 中重测 TTC/NCT。
- 选择第二个城市做真正 cross-city transfer，比较 aerial adaptation、少量车载微调和检索式本地行为记忆。
