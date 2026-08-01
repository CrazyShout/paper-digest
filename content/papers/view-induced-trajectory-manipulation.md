---
{
  "id": "view-induced-trajectory-manipulation",
  "tag": "autonomous-driving-security",
  "tags": ["autonomous-driving-security", "autonomous-driving-testing"],
  "title": "Still Camouflage, Moving Illusion: View-Induced Trajectory Manipulation in Autonomous Driving",
  "source": "arXiv:2605.12743 / https://arxiv.org/abs/2605.12743",
  "authors": ["Shuo Ju", "Qingzhao Zhang", "Huashan Chen", "Xuheng Wang", "Haotang Li", "Wanqian Zhang", "Feng Liu", "Kebin Peng", "Sen He"],
  "affiliations": ["Institute of Information Engineering, Chinese Academy of Sciences", "The University of Arizona", "Beijing Jiaotong University", "East Carolina University"],
  "comment": "这篇论文把视角变化从物理攻击的难点变成攻击机制本身，展示静态伪装如何诱导轨迹漂移并触发下游急刹。"
}
---

## 一句话定位

Still Camouflage, Moving Illusion 是一篇面向视觉自动驾驶链路的物理对抗攻击论文。它的关键新意是：不再努力让 adversarial patch 在多视角下保持同一错误，而是利用车辆相对运动带来的视角变化，让静态伪装自然产生随时间演化的特征漂移，进而误导轨迹推断。

## 论文要解决的问题

已有物理攻击常把视角变化当作鲁棒优化挑战，需要复杂多视角 patch 或主动变化装置。自动驾驶系统真正关心的不是单帧检测是否错，而是多帧跟踪、轨迹预测和决策是否被持续误导。论文的问题是：一个静态、被动、看似普通的伪装物，能否在正常相对运动中制造“物理合理但错误”的轨迹，例如虚假 cut-in，并传导到规划层触发不必要急刹。

## 方法和系统设计

- 攻击对象是视觉自动驾驶中的多帧感知与轨迹推断链路，而不是单帧分类。
- 静态 adversarial camouflage 安装在车辆上，利用视角变化让外观随相对运动自然变化。
- 这种 view-induced feature drift 会让系统推断错误轨迹，进而影响 downstream decision-making，例如在通过停放车辆时触发 hard braking。

## 关键图与可视化结果

![图 1：视角诱导轨迹操纵的攻击场景，展示静态伪装如何随相对运动产生误导](https://arxiv.org/html/2605.12743v1/fig/attack-scenario-1.png)

这张图直接说明论文的攻击面：威胁不是孤立图片上的误检，而是伪装车辆和受害车辆之间的相对运动。它适合作为自动驾驶攻防讨论里的“时间维物理攻击”案例。

![图 2：攻击流程，展示从伪装设计到轨迹误导和下游急刹事件的传播链路](https://arxiv.org/html/2605.12743v1/fig/pipeline.png)

这张流程图支撑论文的系统性主张。读者应重点检查攻击是否真的穿过 detection/tracking/prediction/planning 链路，而不是只在某个中间模块上制造局部误差。

## 实验结论与证据

论文在 nuScenes 上展示攻击效果，摘要报告以 hard-braking event 计量的端到端成功率最高达到 87.5%，并在不同场景背景、受害车速度和感知模型上做鲁棒性验证。证据重点是静态伪装可以诱导看似物理合理的错误轨迹，并影响最终驾驶行为。

## 应用场景与启发

- 应用场景：自动驾驶物理攻击评测、多帧感知鲁棒性测试、轨迹预测安全验证和端到端急刹回归测试。
- 方法启发：鲁棒性不能只看单帧检测框；视角变化、时间一致性和下游规划响应必须一起评估。
- 讨论问题：防御应该针对伪装纹理、轨迹一致性、物体运动学约束，还是针对规划层对异常轨迹的风险响应。

## 局限与阅读风险

nuScenes 离线验证能说明攻击链路，但真实道路物理可实施性、材质可制造性、法规可见性、天气光照和多传感器冗余仍需要实车或高保真仿真确认。硬刹成功率是重要安全信号，但还需要看误报代价和防御后的正常驾驶性能。

## 后续跟进

- 检查攻击对不同 perception stack、tracking smoothing 和 prediction horizon 的敏感性。
- 复现时加入 LiDAR/radar fusion，观察多模态系统是否能削弱 view-induced feature drift。
- 和测试方向的责任归因结合，判断攻击引发的急刹是否能被归类为 ADS 可避免缺陷。
