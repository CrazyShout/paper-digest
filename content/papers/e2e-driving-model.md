---
{
  "id": "e2e-driving-model",
  "tag": "end-to-end-autonomous-driving",
  "title": "示例：Planning-Oriented End-to-End Autonomous Driving",
  "source": "arXiv / benchmark",
  "authors": ["Mina Kim", "Oliver Smith", "Jia Luo"],
  "affiliations": ["KAIST", "Oxford Robotics Institute"],
  "comment": "把感知、预测和规划统一到一个可闭环评测的驾驶模型中，适合作为端到端自动驾驶方向的核心样例。",
  "visual": "visual-wave",
  "visualLabel": "driving rollout"
}
---

## 核心问题

端到端自动驾驶希望减少模块间误差传播，但也带来可解释性、数据规模和闭环稳定性问题。样例论文关注规划导向的端到端训练。

## 方法速读

- 输入多传感器历史观测，输出未来轨迹或控制信号。
- 用规划损失和闭环反馈约束模型行为。
- 在复杂交互场景中比较端到端模型和模块化系统。

## 组内关注点

日报筛选时应优先保留报告闭环驾驶指标、失败案例和数据规模细节的论文。
