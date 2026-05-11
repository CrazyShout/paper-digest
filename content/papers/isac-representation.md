---
{
  "id": "isac-representation",
  "tag": "wireless-sensing",
  "title": "Robust CSI Representation Learning for Joint Sensing and Communication",
  "source": "IEEE Xplore / arXiv",
  "authors": ["Qian He", "Morgan Lee", "Fatima Noor"],
  "affiliations": ["Shanghai Jiao Tong University", "Georgia Tech"],
  "comment": "把 CSI 的时频结构做成可迁移表征，低信噪比场景下收益明显；后续可对比我们已有的多模态感知设定。",
  "visual": "visual-wave",
  "visualLabel": "CSI map"
}
---

## 核心问题

通信感知一体化系统里，CSI 表征会同时受到信道变化、硬件噪声和任务目标切换影响。论文关注如何学习一个对下游感知任务更稳健的表示。

## 方法速读

- 把 CSI 的时频结构作为主要归纳偏置。
- 对不同信噪比和移动速度做增强，提升跨场景泛化。
- 用通信指标和感知指标共同评估表征质量。

## 组内关注点

这篇适合和我们已有的多模态感知设定对照，尤其是低信噪比下的表征退化曲线。
