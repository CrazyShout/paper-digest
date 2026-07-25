---
{
  "id": "cvaa-driving-interpretability",
  "tag": "autonomous-driving-security",
  "tags": ["autonomous-driving-security", "autonomous-driving-testing", "agentic-driving", "end-to-end-autonomous-driving"],
  "title": "What Do They See? Interpreting Complex Road Scenarios Through the Eyes of Vision-Language-Action Models for Safe and Trustworthy Autonomous Vehicle Learning",
  "source": "arXiv:2607.16938 / https://arxiv.org/abs/2607.16938",
  "authors": ["Kalpana Panda", "Wesley Maia", "Vinti Agarwal", "Ross Greer"],
  "affiliations": ["Department of Computer Science and Information Systems, Birla Institute of Technology and Science, Pilani", "Machine Intelligence, Interaction, and Imagination Lab, University of California, Merced"],
  "comment": "用真实感修补逐个移除道路对象，再观察 Alpamayo 1 轨迹分布和内部层级变化；它把 VLA 可解释性从“生成一段理由”推进到可反事实测试的对象因果影响。"
}
---

## 一句话定位

CVAA 不询问驾驶 VLA“为什么这样开”，而是逐个删除场景对象并重新运行模型，测量轨迹分布究竟改变多少。论文在 210 个 nuScenes 场景上构造 Counter-nuScenes，用 SAM2/生成式修补形成反事实图像，再对 Alpamayo 1 做黑盒对象排名和白盒层级传播分析。它进入本期，是因为生成语言理由无法证明视觉对象真的影响动作，而反事实测试至少提供了可复查的行为证据。

## 论文要解决的问题

VLA 可以输出看似合理的解释，但解释可能与实际决策通路无关。传统显著图又很难回答“移除某个对象会不会改变轨迹”。对象级反事实的难点是删除后必须补出可信背景，否则模型可能只对遮罩伪影敏感；即使输出改变，也还要追踪这种变化是在视觉编码器、语言模型还是轨迹 expert 中被放大。

## 方法和系统设计

- 对 nuScenes 前视图检测对象并用 SAM2 分割，逐个移除后通过 LaMa 类修补生成背景，构造同一场景的反事实集合。
- 用轨迹分布的 Average Deviation（AD）和 Final Deviation（FD）为对象排名，并跨三个随机种子检查排名稳定性。
- 白盒部分比较原图与反事实图在视觉块、语言层、trajectory token 和轨迹 expert 中的余弦差异，将传播分为 coupled、transparent、decoupled 和 silent 四类。

## 关键图与可视化结果

![图 1：Counter-nuScenes 与 CVAA 的对象删除、修补、轨迹比较流程](../../assets/papers/cvaa-driving-interpretability-figure-1.png)

图 1 来自官方源码。每次只改变一个对象，随后比较同一 VLA 的轨迹分布；这种 paired intervention 比让模型自述理由更接近因果审计，但仍依赖修补是否保留了其他场景关系。

![图 2：对象删除信号在视觉编码器、语言模型和全局 token 中的传播](../../assets/papers/cvaa-driving-interpretability-figure-2.png)

图 2 显示视觉差异并不会简单单调传到动作。部分大车辆在语言后层引发明显变化，另一些场景在 trajectory token 上几乎无信号，却被 trajectory expert 放大为较大轨迹差异。

## 实验结论与证据

在 210 个场景中，汽车、行人和交通灯分别有 78、48 和 41 次成为 AD 影响最大的对象；但按出现次数归一后，公交和卡车的高影响比例更高。49.3% 的对象被移除后反而让轨迹更接近真值，且出现“已过街行人、不可见信号灯甚至网球拍比近处车辆更重要”的反直觉案例，提示模型依赖整体场景先验而非稳定对象规则。

白盒结果中，约 33.0% 样本属于 coupled、33.1% transparent、16.9% decoupled、16.9% silent。trajectory expert 对输入微小差异的平均放大约 115–180 倍，部分 silent 场景超过 1000 倍；这意味着只监控语言输出或 trajectory token 可能漏掉真正影响动作的内部通路。

## 应用场景与启发

- 应用场景：VLA 回归测试、对象级敏感性审计、错误注意诊断和可解释安全评估。
- 方法启发：Agent 的解释质量应与反事实行为一致性分开评价；安全审计需要检查“说它重要”与“移除后动作改变”是否一致。
- 讨论问题：如何设计时序多帧反事实，避免单帧修补破坏速度、意图和遮挡关系，从而误判对象因果性？

## 局限与阅读风险

只评估 Alpamayo 1 和 nuScenes 前视相机，结论不能外推到其他 VLA、传感器或闭环系统。对象排名跨随机种子不稳定，单对象删除也会改变上下文关系；修补虽然逼真，仍可能引入模型可见而人难察觉的分布偏移。论文使用的余弦差异和 Logit Lens 来自语言模型解释工具，只能描述哪里变化，不能证明具体内部计算因果负责。

## 后续跟进

- 在至少两个开放 VLA 上复现，并加入多帧一致修补和对象组合删除。
- 把 AD/FD 与闭环碰撞、车道偏离和安全盾触发连接，验证黑盒影响是否具有安全含义。
- 重点研究 silent 通路，检查轨迹 expert 是否需要 Lipschitz 约束、不确定性门控或运行时异常检测。
