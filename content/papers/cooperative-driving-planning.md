---
{
  "id": "cooperative-driving-planning",
  "tag": "cooperative-autonomous-driving",
  "title": "示例：Cooperative Planning for Connected Autonomous Vehicles",
  "source": "arXiv / project page",
  "authors": ["Yifan Zhang", "Mei Chen", "Daniel Park"],
  "affiliations": ["Tsinghua University", "Stanford University", "MIT CSAIL"],
  "comment": "把多车协同规划拆成通信、意图共享和安全约束三个层级，适合作为协同自动驾驶方向的日报样例。",
  "visual": "visual-network",
  "visualLabel": "CAV planning"
}
---

## 核心问题

协同自动驾驶需要在有限通信带宽下共享局部观测和意图，同时保证规划结果不会引入新的冲突。论文样例关注多车之间如何在闭环场景中协调动作。

## 方法速读

- 将车辆的局部目标、可行轨迹和风险区域编码成轻量消息。
- 通过图结构聚合邻近车辆意图，减少重复或冲突决策。
- 在规划层加入安全约束，优先处理交叉口和汇入场景。

## 组内关注点

抓取这类论文时，应优先关注是否有闭环仿真、通信延迟建模和真实交通交互复杂度。
