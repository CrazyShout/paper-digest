---
{
  "id": "roadside-cooperative-perception",
  "tag": "vehicle-road-cooperation",
  "tags": ["vehicle-road-cooperation", "cooperative-autonomous-driving"],
  "title": "示例：Roadside-Assisted Cooperative Perception for Urban Driving",
  "source": "IEEE Xplore / arXiv",
  "authors": ["Qian He", "Morgan Lee", "Fatima Noor"],
  "affiliations": ["Shanghai Jiao Tong University", "Georgia Tech"],
  "comment": "把路侧感知和车端感知做时空融合，适合作为车路协同方向中基础设施辅助感知的样例。",
  "visual": "visual-wave",
  "visualLabel": "V2I fusion"
}
---

## 核心问题

车端传感器在遮挡和远距离目标上存在天然盲区。路侧单元可以提供补充视角，但会带来通信延迟、坐标对齐和感知不一致问题。

## 方法速读

- 对车端和路侧目标进行时间同步与空间配准。
- 使用置信度门控选择更可靠的目标观测。
- 在延迟通信下预测路侧信息的当前状态。

## 组内关注点

筛选论文时应优先关注真实路侧设备实验、通信带宽限制和是否报告端到端驾驶收益。
