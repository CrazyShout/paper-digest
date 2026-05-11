---
{
  "id": "robot-data-loop",
  "tag": "robot-data",
  "title": "Failure-Aware Data Collection for Robot Skill Learning",
  "source": "Project page",
  "authors": ["Mina Kim", "Oliver Smith", "Jia Luo"],
  "affiliations": ["KAIST", "Oxford Robotics Institute"],
  "comment": "抓取失败轨迹后主动补采边界案例，比均匀扩数据更高效；值得对照现有任务里的 long-tail failure。",
  "visual": "visual-wave",
  "visualLabel": "failure loop"
}
---

## 核心问题

机器人技能学习里，均匀扩充数据常常浪费在已经会做的状态上。论文把失败轨迹作为主动采样信号，优先补齐边界案例。

## 方法速读

- 执行任务时记录失败轨迹和关键状态。
- 用失败密度决定下一批数据采集区域。
- 评估成功率提升和数据采集成本之间的关系。

## 组内关注点

如果我们要做数据闭环，最值得借鉴的是它对 failure bucket 的定义，而不是具体模型结构。
