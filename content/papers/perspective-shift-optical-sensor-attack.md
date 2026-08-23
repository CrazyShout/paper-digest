---
{
  "id": "perspective-shift-optical-sensor-attack",
  "tag": "autonomous-driving-security",
  "tags": ["autonomous-driving-security"],
  "title": "Perspective-Shift Attacks Against Optical Perception Sensors: A Novel Attack Vector on LiDAR and Camera",
  "source": "VehicleSec 2026: https://www.usenix.org/conference/vehiclesec26/presentation/calipari / DOI: https://doi.org/10.5281/zenodo.20395591 / Official PDF: https://zenodo.org/records/20395591/files/DTF_Vehiclesec2026.pdf",
  "authors": ["Marco Calipari", "Michael Kühr", "Dominik Kulmer", "Maximilian Luedecke", "Mohammad Hamad", "Sebastian Steinhorst"],
  "affiliations": ["TUM School of Computation, Information and Technology, Technical University of Munich", "TUM School of Engineering and Design, Technical University of Munich"],
  "comment": "论文用 Direction Turning Film 把 LiDAR 或相机的视场整体偏转，而不是注入假回波或修改目标外观；20° 偏转已能破坏里程计和车道检测，同时目标检测置信度变化可能很小。它把传感器外部光学件本身提升为需要单独测试的攻击面。"
}
---

## 一句话定位

Perspective-Shift Attack 的关键不是让模型漏检某个特定物体，而是用预设偏转角的 Direction Turning Film（DTF）改变光路，使传感器继续输出看似正常、置信度未明显下降的数据，却把整个可见区域映射到错误方向；这类“坐标系被物理搬动”的攻击会同时污染 LiDAR 里程计、相机车道线和下游决策。

## 论文要解决的问题

已有光学传感器攻击多关注激光注入、对抗贴纸或环境中经过设计的目标，防御也常把低置信度、异常点或明显图像退化当作报警信号。论文指出另一种缺口：如果攻击者不修改场景内容，而是在传感器前方放置能以固定角度折转光线的薄膜，检测器仍可能高置信度地识别物体，只是物体、车道和运动轨迹被投影到了错误方位。系统若只看检测置信度，就可能把一致但错误的视场当成正常输入。

## 方法和系统设计

- 用 Direction Turning Film 构造可控的光学偏转，使相机和 LiDAR 的 field of view 发生整体转向，并把这种攻击定义为 Perspective-Shift Attack。
- 建立数字仿真框架，分别观察视场偏移对物体检测、LiDAR 里程计和相机车道检测的传播影响，而不是只报告传感器原始输出变化。
- 在实验室和自动驾驶研究车上部署 DTF，检查数字结果能否转移到真实传感器；同时提出基于物理层伪影和跨语义一致性的检测思路。

## 关键图与可视化结果

![图 1：DTF 使 LiDAR 里程计轨迹与相机车道边界发生系统性偏移](../../assets/papers/perspective-shift-optical-sensor-attack-figure-1.png)

图 1 裁自正式论文 Figure 1。上排是正常视场，下排是施加 DTF 后的视场；中间的里程计轨迹和右侧车道边界均发生方向性偏移。它说明攻击作用于传感器坐标系，而不是某一个类别，因此“目标仍被检测到”不能证明几何输入仍可信。该示意图展示攻击机制与影响链路，不是攻击成功率统计。

![图 2：正式论文 Figure 2 对比 DTF 施加前后的 LiDAR 点云与相机画面](../../assets/papers/perspective-shift-optical-sensor-attack-figure-2.png)

图 2 裁自正式论文 Figure 2。上下两组分别给出 LiDAR 与相机在左偏、正常和右偏条件下的原始观测，直接显示薄膜如何把完整视场整体转向。它验证了攻击不是后处理伪造，但仍只是受控传感器层现象，不能单独证明所有下游规划器都会产生相同危险动作。

## 实验结论与证据

正式会议摘要报告，20° 的中等视场偏移已经显著影响 LiDAR-based odometry 和 camera-based lane detection，并可能诱导车辆侵入对向车道；与此同时，物体位置虽已改变，目标检测置信度只出现轻微变化。论文同时给出数字仿真、受控实验室验证和研究车部署，因此证据覆盖“机制可实现”和“真实传感器会受影响”两层。

这些结果支持的是：固定角度光学偏转可以在不触发常见低置信度报警的情况下破坏几何任务。它不等于证明任意车型、任意安装位置和开放道路速度下都能稳定造成同一种危险动作；研究车实验仍属于受控验证。

## 应用场景与启发

- 应用场景：相机与 LiDAR 的物理红队测试、传感器外罩和维修件安全验收，以及车道与里程计跨模态一致性监控。
- 方法启发：安全监控不能只检查类别置信度，应额外估计视场外参是否突然变化，并用 IMU、轮速、地图、雷达或多视角传感器验证几何方向。
- 讨论问题：能否把在线外参估计与最小风险动作联动，在视场发生不可解释的整体偏移时拒绝更新地图和轨迹，而不是继续使用高置信度但错位的观测？

## 局限与阅读风险

论文验证的是特定 DTF、安装方式和受控场景，攻击效果会受光学材料、视场覆盖比例、传感器外壳和车辆运动影响。20° 是论文展示的有效条件，不能直接外推成最小攻击角度。文中的对向车道侵入是安全后果示例，不应被解读为所有实车部署均完成了高速开放道路闭环复现。提出的物理伪影与语义一致性检测也需要在正常标定漂移、颠簸、遮挡和道路曲率变化下评估误报。

## 后续跟进

- 复现不同 DTF 偏转角、覆盖面积和安装偏心下的在线外参变化曲线。
- 对比置信度监控、IMU/轮速几何残差和多传感器视场一致性三类检测器的检测延迟与误报。
- 在封闭场地运行完整感知规划回退链路，记录从偏转发生到安全停车的最晚可接受响应时间。
