---
{
  "id": "robot-world-model",
  "tag": "embodied-ai",
  "title": "Action-Conditioned World Models for Dexterous Manipulation",
  "source": "Conference proceedings",
  "authors": ["Ava Singh", "Rui Tan", "Yuki Sato"],
  "affiliations": ["UC Berkeley", "University of Tokyo"],
  "comment": "主线是把动作条件加入 latent dynamics，亮点在失败轨迹的重新采样。可以重点看数据闭环是否比单纯扩大仿真更划算。",
  "visual": "visual-grid",
  "visualLabel": "world model"
}
---

## 核心问题

机器人灵巧操作里的长程预测很容易在接触、遮挡和物体滑动时崩掉。论文尝试用动作条件世界模型降低这种误差积累。

## 方法速读

- 把视觉观测和动作序列编码到同一个 latent dynamics。
- 在 rollout 中显式建模失败轨迹，让策略能看到接近失败的边界状态。
- 通过少量真实机器人数据校准仿真分布。

## 组内关注点

建议重点核对真实机器人实验的 rollout 数量、失败定义和任务复杂度，避免只被仿真指标说服。
