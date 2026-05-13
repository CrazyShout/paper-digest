---
{
  "id": "ad-model-robustness",
  "tag": "autonomous-driving-security",
  "title": "示例：Adversarial Robustness of End-to-End Driving Models",
  "source": "arXiv / GitHub",
  "authors": ["Elena Garcia", "Hao Wu"],
  "affiliations": ["University of Washington", "HKUST"],
  "comment": "从感知扰动扩展到规划输出攻击，适合自动驾驶模型攻防方向的安全评测样例。",
  "visual": "visual-network",
  "visualLabel": "attack path"
}
---

## 核心问题

自动驾驶模型的安全风险不只来自感知误检，也可能来自端到端规划输出被诱导偏移。论文样例关注攻击如何跨越感知、预测和规划链路。

## 方法速读

- 构造视觉扰动和场景级扰动，观察规划轨迹变化。
- 用闭环仿真评估攻击是否真正导致危险驾驶行为。
- 比较数据增强、对抗训练和不确定性估计的防御效果。

## 组内关注点

抓取这类论文时需要区分“模型指标下降”和“驾驶风险上升”，优先保留有闭环安全指标的工作。
