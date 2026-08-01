---
{
  "id": "driving-videos-to-simulatable-scenarios",
  "tag": "autonomous-driving-testing",
  "tags": ["autonomous-driving-testing", "world-models", "3d-reconstruction"],
  "title": "From Driving Videos to Simulatable Scenarios",
  "source": "arXiv:2606.21993 / https://arxiv.org/abs/2606.21993",
  "authors": ["Alexandre Levy", "Ernest Valveny Llobet", "Antonio Manuel Lopez"],
  "affiliations": ["Computer Vision Center", "Universitat Autonoma de Barcelona"],
  "comment": "D-V2S 自动把驾驶视频转成可控制、可重复的仿真场景，适合补足从真实道路观察到闭环仿真测试之间的转换链路。"
}
---

## 一句话定位

From Driving Videos to Simulatable Scenarios 提出 D-V2S，目标是把真实驾驶视频自动转换成可仿真的场景。它关注的是测试基础设施：真实视频能捕获复杂交通现象，但不能直接用于可控回放、反事实修改和大规模闭环评估；仿真场景可控，但手工搭建成本高且容易脱离真实分布。

## 论文要解决的问题

自动驾驶测试需要能重复、能修改、能扩展的场景。现实中大量风险和长尾行为存在于公开视频或车队视频里，但这些视频缺少仿真器需要的结构化 agent、道路、轨迹和行为接口。传统从日志重建场景通常依赖多传感器、高精地图或专用采集系统。D-V2S 要解决的是：仅从驾驶视频出发，自动抽取可放入仿真平台运行的 scenario representation。

## 方法和系统设计

- 视频解析：从驾驶视频中估计道路、交通参与者和时序运动，形成仿真需要的结构化元素。
- 场景生成：把视频观察转换成可编辑、可重放的 simulator scenario，而不是只做离线标注。
- 测试目标：让真实世界中观察到的长尾片段可以进入可控闭环测试，支持重复执行和参数扰动。

## 关键图与可视化结果

![图 1：D-V2S 两阶段流程，先做驾驶记录分析，再把自然语言描述转成可执行场景](https://arxiv.org/html/2606.21993v1/fig/paper_xai_flow.png)

这张图展示视频到仿真的主链路。它的价值在于把真实视频从“只能看”变成“可以测”，为后续反事实测试和闭环回归提供入口。

![图 2：D-V2S 将 CARLA 第三视角驾驶视频转成 SCENIC 脚本并生成可修改场景](https://arxiv.org/html/2606.21993v1/fig/quali_synth.jpg)

这张图应重点检查重建场景是否保留原视频中的关键交互关系。对于测试论文来说，真实感不如可重复性、结构正确性和可编辑性重要。

## 实验结论与证据

摘要表明 D-V2S 可以自动生成可仿真驾驶场景，服务安全评估中“可控、可重复、可扩展”的需求。论文已被 IEEE ITSC 2026 接收，说明其定位更偏测试与系统工程。详细阅读时需要重点核对它支持哪些仿真器、视频输入质量要求、动态 agent 轨迹误差，以及生成场景能否触发与原视频一致的风险行为。

## 应用场景与启发

- 应用场景：从车队视频或公开视频挖掘测试场景、事故/near-miss 复现、低成本仿真场景库构建。
- 方法启发：世界模型和测试工具之间需要一个“视频到结构化场景”的中间层，否则真实观察很难变成可执行测试。
- 讨论问题：从单目或普通视频恢复出的场景是否足够支撑规划评测，而不只是感知演示。

## 局限与阅读风险

视频到仿真会受到相机视角、遮挡、尺度恢复、轨迹估计和道路拓扑识别误差影响。若生成场景不能保留原始交互中的责任关系和时间同步，闭环测试结论可能失真。论文是否支持复杂城市路口、多车遮挡和不可见区域推断，需要进一步核查。

## 后续跟进

- 检查是否开放代码和示例场景，以及输出是否兼容 CARLA、SUMO、OpenSCENARIO 或自定义仿真器。
- 与 World Engine 区分：D-V2S 强调视频到仿真场景转换，World Engine 强调真实日志重建后的策略后训练。
- 后续可把 D-V2S 作为测试场景生产工具的候选入口。
