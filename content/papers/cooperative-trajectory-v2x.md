---
{
  "id": "cooperative-trajectory-v2x",
  "tag": "cooperative-trajectory-prediction",
  "tags": ["cooperative-trajectory-prediction", "vehicle-road-cooperation", "cooperative-autonomous-driving"],
  "title": "示例：V2X-Aware Cooperative Trajectory Prediction",
  "source": "OpenReview / arXiv",
  "authors": ["Ava Singh", "Rui Tan", "Yuki Sato"],
  "affiliations": ["UC Berkeley", "University of Tokyo"],
  "comment": "重点是把车车和车路信息加入多智能体轨迹预测，适合筛选协同轨迹预测方向的交互建模论文。",
  "visual": "visual-grid",
  "visualLabel": "trajectory grid"
}
---

## 核心问题

单车视角的轨迹预测容易漏掉遮挡目标和远端交互。协同轨迹预测希望利用 V2X 信息提升对关键交通参与者的未来运动估计。

## 方法速读

- 将邻车观测和路侧观测对齐到统一时空坐标。
- 用交互图建模车辆之间的让行、汇入和跟驰关系。
- 输出多模态轨迹和不确定性，支持下游规划选择。

## 组内关注点

后续抓取时可以重点检查数据集是否包含真实 V2X，同步误差如何处理，以及是否只在开环指标上提升。
