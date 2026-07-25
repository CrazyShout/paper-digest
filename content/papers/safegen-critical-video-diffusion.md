---
{
  "id": "safegen-critical-video-diffusion",
  "tag": "autonomous-driving-testing",
  "tags": ["autonomous-driving-testing", "world-models", "autonomous-driving-security"],
  "title": "SafeGen: Goal-Conditioned Video Diffusion of Safety-Critical Scenarios for VLM-Based Autonomous Driving",
  "source": "ACM Multimedia 2026 / arXiv:2607.19701 / https://arxiv.org/abs/2607.19701 / https://github.com/JoFrc/SafeGen",
  "authors": ["Jiangfan Liu", "Zexuan Cui", "Tianyuan Zhang", "Zonglei Jing", "Zonghao Ying", "Yaoyuan Zhang", "Jiakai Wang", "Xiaoqi Jiang", "Aishan Liu", "Xianglong Liu"],
  "affiliations": ["Beihang University", "Zhongguancun Laboratory", "Chery Automobile Co., Ltd."],
  "comment": "先从正常视频推断潜在脆弱点并指定灾难性终态，再用边界条件扩散生成通向该终态的连续视频；它把长尾场景生成从随机采样改成可控的失败目标搜索。"
}
---

## 一句话定位

SafeGen 不让视频模型从正常首帧随机猜未来，而是先由 VLM 分析场景脆弱点、构造明确的灾难性末帧，再让边界条件扩散模型补齐从正常状态到碰撞终态的时序演化。它进入本期，是因为“目标条件失败生成”比盲目采样更适合安全测试，并且论文同时给出 850 个场景、三种 VLMAD、下游微调和 30 名持证驾驶员的人在环评估。

## 论文要解决的问题

仿真器能精确控制碰撞，但人物资产和行为长尾有限；开放式视频生成更真实，却难稳定产生指定安全失败。若生成模型只优化视觉质量，可能得到好看的普通片段，无法测试规划边界。SafeGen 因此将任务改写为“给定灾难终态的逆向场景构造”，要求生成视频既到达指定冲突，又保持几何、时序和语义合理。

## 方法和系统设计

- Context Grounded End State Reasoning 用 VLM 阅读正常驾驶上下文，识别弱势道路参与者相关的潜在脆弱点，并生成结构化终态规格。
- 通过深度感知投影和迭代 latent inpainting 把高风险参与者放入场景，约束其尺度、位置与光照。
- End State Conditioned Video Evolution 以正常首帧和灾难末帧为边界，通过非对称条件扩散生成中间帧，使冲突逐步发展而非突然贴图。

## 关键图与可视化结果

![图 1：SafeGen 的终态推理、几何植入与边界条件视频生成流程](../../assets/papers/safegen-critical-video-diffusion-figure-1.png)

图 1 来自官方 arXiv 源码。流程先决定“希望暴露什么失败”，再把语义威胁落到深度与位置约束，最后生成连续视频；终态相当于测试目标，而不是生成后的筛选标签。

![图 2：施工、雨天和不同交通方向中的安全关键生成片段](../../assets/papers/safegen-critical-video-diffusion-figure-2.png)

图 2 展示多种环境下的 VRU 冲突。视觉结果说明方法能覆盖开放词汇参与者和天气，但截图本身不能证明物理正确，仍需结合 TTC、DRAC、人评和被测系统响应阅读。

## 实验结论与证据

在 Dolphins、DriveLMM-o1 和 EM-VLM4AD 三种问答式驾驶 VLM 上，SafeGen 相对最强基线平均提高 24.25% 的 Judge Overall Score，也就是更稳定地暴露感知、预测和规划不一致；其生成场景将 TTC 集中压缩到 0.5 s 以下，所需规避减速度达到 15–20 m/s²。850 个视频的平均 FID 约 100、FVD 约 400。

终态消融显示，把灾难事件锚定在末帧相对首帧攻击或良性末帧可使 JOS 平均再提高 60.36%。用生成数据微调 Dolphins 后，在未见的 VRU-Accident 三类问答上平均准确率从 38.8 提至 54.7，绝对增加 15.9 个百分点。30 名持证驾驶员在 210 度环幕中盲测 10 个攻击片段与 40 个正常片段，对 SafeGen 的威胁和真实感评分均高于 ScenGE。

## 应用场景与启发

- 应用场景：VLM/VLA 安全压力测试、开放词汇 VRU 长尾数据增强和碰撞目标驱动的场景生成。
- 方法启发：生成式测试应先定义可判定失败目标，再从目标反推场景；否则大量采样可能只提高多样性而不增加测试价值。
- 讨论问题：能否把灾难终态从像素末帧提升为可执行场景约束，并在闭环中允许 ego 的规避动作改变未来？

## 局限与阅读风险

核心被测对象是问答式 VLMAD，输出安全不等同于真实低层控制。JOS 本身由高容量 VLM judge 评估，生成模块也使用 VLM 推理，存在评判偏好与循环验证风险。视频为开放环边界插值，ego 无法通过动作改变背景，极端 TTC/DRAC 也可能制造物理上无解的测试。FID 约 100、FVD 约 400 不能单独支持“高保真”，下游只微调一个模型。

## 后续跟进

- 将生成终态转换为 OpenSCENARIO/轨迹约束，在反应式闭环里验证同一威胁是否仍有效。
- 用独立人评、几何一致性和经典仿真器动力学替代单一 VLM judge，避免循环打分。
- 把“可避免失败”和“必然碰撞”分开，优先生成存在合理安全动作但目标模型没有找到的场景。
