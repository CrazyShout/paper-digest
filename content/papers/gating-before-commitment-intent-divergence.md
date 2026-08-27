---
{
  "id": "gating-before-commitment-intent-divergence",
  "tag": "autonomous-driving-testing",
  "tags": ["autonomous-driving-testing", "agentic-driving", "end-to-end-autonomous-driving", "autonomous-driving-security"],
  "title": "Gating Before Commitment: Anticipating Intent Divergence to Prevent Post-Interaction Decision Failures in Autonomous Driving",
  "source": "arXiv:2608.26074 / https://arxiv.org/abs/2608.26074 / HTML: https://arxiv.org/html/2608.26074v1 / Supplementary video: https://arxiv.org/src/2608.26074v1/anc/supplementary.mp4",
  "authors": ["Cong Xu", "Ravi Sankar"],
  "affiliations": ["iCONS Lab, Department of Electrical Engineering, University of South Florida"],
  "comment": "论文在规划承诺前用 intent-geometry divergence 触发门控修复，并用一次失败的预注册准则和跨域高误报约束结论；其最大价值是证明门控机制可救主案例，同时证明小语言模型并未在匹配误报率下优于几何规则。"
}
---

## 一句话定位

这篇论文研究“安全包络介入时是否已经太晚”：当 ego 在一次会车、超车或让行交互后选错了意图，传统 corridor/envelope 往往等轨迹接近边界才反应。作者在 commitment 前计算 language-guided intent 与几何运动的 divergence，先冻结或修复计划，再由 envelope 做最后 backstop。它值得读的原因不是证据规模大，而是作者保留了预注册失败、跨域高误报和语言模块负消融，没有把一个窄机制包装成通用 agentic safety。

## 论文要解决的问题

碰撞避免、RSS 或 control barrier 通常检查已形成轨迹是否即将违反安全边界。如果 planner 在交互结束时就误解了双方意图，例如把“对向车辆已通过”理解成“可以继续向路肩偏移”，等几何走廊报警时可能只剩紧急覆盖，无法重新选择行为。

论文试图把检测点前移到 maneuver commitment：结构化感知先描述车道、相对运动和交互状态，小语言模型输出 pass/block/merge/yield/uncertain 概率，几何分歧与置信度再组成平滑 divergence。真正需要验证的是门控是否在可恢复窗口内触发、是否比 envelope 更早、以及模型是否比简单几何规则提供了额外信息。

## 方法和系统设计

- YOLOv8s、ByteTrack、颜色车道线拟合和单目地平面生成每帧结构化 descriptor；远距离 closing speed 不可信时保留噪声标记，而不是把异常值伪装成物理真值。
- Qwen2.5-0.5B 以 LoRA 在 55,433 个 nuScenes rule-labelled 窗口上微调，只读取五个标签 token 的 logits。merge 和 yield 样本很少，held-out class accuracy 只有 0.23 和 0.05。
- v1 分数为置信度项与 intent-geometry conflict 的组合，再经 EWMA；首次实验发现 uncertain 被当成半个 conflict，产生大量误报。
- 预注册 v2 把 uncertain 改成 abstention，并以 `θon=0.35`、`θoff=0.25` 做迟滞门控。gate 位于计划承诺前，安全 envelope 位于其后，便于分别测“修复计划”和“事后拦截”。

## 关键图与可视化结果

![图 1：结构化感知、意图模块、commitment 前门控修复和安全 envelope 的顺序关系](https://arxiv.org/html/2608.26074v1/fig1_overview.svg)

Figure 1 是论文最重要的系统边界：gate 不是另一个碰撞检测器，而是位于 planner 提交 maneuver 前的状态机。这个位置选择可以复用于其他 uncertainty critic，即使最后证明 LLM 本身没有额外收益。

![图 2：主案例 frame 968 的检测、跟踪、车道拟合和输入 intent module 的序列化描述](https://arxiv.org/html/2608.26074v1/fig4_pipeline.png)

Figure 2 让读者看到模型并不读取原始视频，而读取人工结构化接口；其中远距 closing speed 达 299.7 m/s 的噪声也被披露。门控表现因此同时受 descriptor 工程和语言分类器影响，不能全部归因于 LLM reasoning。

![图 4：v1/v2b divergence、commitment、gate、envelope 与迟滞阈值时间线](https://arxiv.org/html/2608.26074v1/fig3_timeline.svg)

Figure 4 支撑“门控早于 envelope”这一窄主张，并展示迟滞如何让 Red 状态保持。重复 replay 中轨迹决策是确定的，图中误差条主要反映计算时间抖动，不代表十个独立道路案例。

## 实验结论与证据

主案例每个配置重复 10 次：baseline 与 envelope-only 都是 10/10 出界，只有 intent gate 的配置保持 0/10 出界；v2b 在漂移开始后 67.7 ms 触发，但比 corridor exit 早 165.6 ms。它证明 gate 能修复这一重建案例，也明确没有满足“漂移前触发”的更强说法。

四个 Car Crash Dataset 片段中，v2b 的预注册 A2 只在 3/5 总案例满足漂移前触发，因此正式判定失败；四个 5 秒 crash clips 在两轮都 0/4 恢复到走廊内。nominal proxy 上误报从 v1 的 1.537/min 降到 v2 的 0.341/min，但 comma2k19 OOD probe 仍有 7.5/min，说明校准无法跨域。

语言模块贡献的消融是结论边界：在相同 FP=0.093 下，full score detection 为 0.234、提前标记 21 条、median lead 1.5 s；不使用模型的 geometry-only detection 为 0.800、提前 19 条、lead 2.5 s。block-only 上几何规则也更高，二者都没有提前检测。证据支持的是“门控机制和 abstention 修复有效”，不支持“小语言模型改善检测或判别”。

## 应用场景与启发

- 应用场景：planner commitment monitor、交互意图冲突检查、VLA safety critic、故障前置门控和可恢复性测试。
- 方法启发：安全模块应分别报告 detection、lead、recoverability 和 false trigger，不能用“更早报警”替代“能够恢复”。
- Agentic 启发：LLM critic 必须与模型无关规则在 matched false-positive 下比较；否则更频繁触发会伪装成更强 anticipation。
- 讨论问题：如果几何规则已经更准，语言模块应该负责哪类几何不可约的规则、角色或社会意图，才能证明存在增量价值？

## 局限与阅读风险

原实现和 artifacts 已丢失，论文使用 2026 年 8 月重建的 surrogate stack，不是生产 planner。感知离线预处理且未计入延迟；道路 corridor 半自动，标签由未来运动规则生成，v2 重用 v1 数据，nuScenes tracks 也参与阈值校准。五个 failure 过少，无法支持跨场景泛化。

论文还披露过 replay driver 忽略消融开关、三种变体实际都运行 full score 的缺陷，虽然后续修正并重算，但公开源码包没有代码、LoRA adapter、日志、预注册文件或文中 artifact bundle，只有 TeX、图片和补充视频。arXiv comment 只是 submitted to IROS 2026 PPNIV workshop，官方通知尚未发生，不能写成已接收。

## 后续跟进

- 以公开日志重建 matched-FP 几何基线，先确认门控机制，不把复现成功归因于语言模型。
- 扩展到模型首次看到其他车辆语义线索、ego 几何尚未异常的案例，测试语言模块真正可能有增量的区域。
- 将门控输出接到可恢复轨迹生成器，并分别统计提前量、修复率、误触发成本和 OOD 拒绝率。
