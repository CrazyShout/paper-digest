---
{
  "id": "x-mind-visual-cot-driving",
  "tag": "world-models",
  "tags": ["world-models", "end-to-end-autonomous-driving", "agentic-driving"],
  "title": "X-Mind: Efficient Visual Chain-of-Thought via Predictive World Model for End-to-End Driving",
  "source": "arXiv:2606.28758 / https://arxiv.org/abs/2606.28758",
  "authors": ["Bohao Zhao", "Chengrui Wei", "Guangfeng Jiang", "Ruixin Liu", "Xuejie Lv", "Liu Liang", "Sutao Deng", "Xiuyang Fan", "Pengkun Zheng", "Jinyun Zhou", "Rui Guo", "Hanpeng Liu", "Yutong Zheng", "Yi Guo", "Xinlong Zheng", "Qingyu Luo", "Zhuangzhuang Ding", "Yu Zhang", "Hang Zhang", "Xianming Liu"],
  "affiliations": ["XPeng Inc."],
  "comment": "X-Mind 把预测世界模型内化为驾驶大模型的 Visual CoT，用低 token 的 BEV sketch 在动作前先 rollout 未来，是端到端驾驶世界模型方向的重要新分支。"
}
---

## 一句话定位

X-Mind 关注端到端驾驶中的“视觉思考”问题。它认为 VLA/大驾驶模型如果只是从当前视觉直接映射到动作，本质上仍是 reactive policy；要真正做物理世界推理，模型应该在动作生成前先预测未来。论文用 Predictive World Model 生成紧凑 BEV sketch，把未来 rollout 作为 Visual Chain-of-Thought 内化到 driving model 内部。

## 论文要解决的问题

把 world model 接到端到端驾驶里有两类常见问题：级联式 PWM 会带来车端不可接受的延迟；把未来预测当作浅层辅助任务，又不能真正约束动作决策。X-Mind 的问题定义是：能否让驾驶大模型在一次前向过程中完成紧凑未来想象，并让这个想象直接影响轨迹输出。

## 方法和系统设计

- Visual CoT：把世界模型预测作为动作前的中间推理过程，而不是外部后处理模块。
- Abstract sketch：用 BEV layout、navigation intent、traffic rule prior 和速度约束构成低维未来表征，避免生成密集未来图像。
- Deep Compression Autoencoder：把 12 帧 future rollout 压缩到 96 tokens，降低长上下文成本。
- Recurrent Block Diffusion：把去噪过程折叠进 LLM 层块中，使未来 sketch 的逐步生成可以在单次 forward pass 内完成。

## 关键图与可视化结果

![图 1：X-Mind 总体架构，把 Predictive World Model 嵌入大驾驶模型并在动作前生成 abstract sketch](https://arxiv.org/html/2606.28758v1/x1.png)

这张图展示 X-Mind 的关键系统接口：world model 不是外接仿真器，而是在模型内部形成 visual reasoning tokens。读者应关注 sketch token 如何连接未来预测和 trajectory prediction。

![图 2：Abstract sketch 可视化，融合动态 agent、静态拓扑、红绿灯、导航路径和速度合规信息](https://arxiv.org/html/2606.28758v1/x2.png)

这张图说明 X-Mind 为什么不生成完整视频。它把“未来世界”压成 planner 需要的结构信号，牺牲像素级细节，换取车端可行的低延迟推理。

## 实验结论与证据

论文声称 X-Mind 在大规模真实数据上训练验证，并取得有竞争力的端到端驾驶表现。更值得注意的是它给出 qualitative rollout：相比单步未来预测，Recurrent Block Diffusion 生成的 BEV sketch 更连续，能预测动态目标运动，并在复杂城市场景中改善轨迹安全性和导航遵循。证据还需要进一步看公开 benchmark 数字和代码，但方法方向明确：用结构化未来思考替代纯文本 CoT。

## 应用场景与启发

- 应用场景：端到端驾驶大模型、车端低延迟世界模型推理、规划前未来风险预判。
- 方法启发：驾驶世界模型不一定要生成高清视频，面向 planner 的结构化 sketch 可能更实用。
- 讨论问题：Visual CoT 预测错时，planner 会不会被错误未来强约束，反而比 reactive policy 更危险。

## 局限与阅读风险

论文以 XPeng 内部团队技术报告形式呈现，数据规模、训练细节和真实部署评测的可复现性需要谨慎看待。Abstract sketch 的设计带有人为先验，可能覆盖不了非标准道路结构或异常交通规则。它证明的是一种高效世界模型接口，尚不能直接说明在开放道路 ODD 中一定安全。

## 后续跟进

- 跟进项目页是否释放模型、数据或评测脚本。
- 与 DriveTeach-VLA 对比：一个强调轨迹引导视觉注意力，一个强调未来 world rollout 作为视觉思考。
- 后续可把 sketch prediction failure 作为安全监控信号，而不只是中间训练任务。
