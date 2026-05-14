---
{
  "id": "driving-world-model",
  "tag": "world-models",
  "tags": ["world-models", "end-to-end-autonomous-driving", "autonomous-driving-testing"],
  "title": "示例：World Models for Closed-Loop Autonomous Driving",
  "source": "project page / arXiv",
  "authors": ["Lena Hoffmann", "Wei Liu", "Arjun Rao"],
  "affiliations": ["ETH Zurich", "NVIDIA Research", "University of Toronto"],
  "comment": "用生成式世界模型预测驾驶场景演化，适合筛选世界模型、仿真生成和闭环 rollout 相关论文。",
  "visual": "visual-grid",
  "visualLabel": "world model"
}
---

## 核心问题

驾驶世界模型希望在可控条件下预测未来场景，从而支持仿真、规划评估和数据生成。关键难点是交互一致性和闭环误差积累。

## 方法速读

- 将历史多视角观测压缩成场景状态。
- 条件化 ego action 和交通参与者状态，生成未来视频或中间表征。
- 用闭环 rollout 检查预测误差是否会快速发散。

## 组内关注点

这类论文需要重点检查是否只是视频生成效果好，还是能真正支撑规划、仿真或数据闭环。
