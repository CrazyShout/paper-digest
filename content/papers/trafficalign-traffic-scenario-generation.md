---
{
  "id": "trafficalign-traffic-scenario-generation",
  "tag": "autonomous-driving-testing",
  "tags": ["autonomous-driving-testing", "world-models", "end-to-end-autonomous-driving", "agentic-driving"],
  "title": "TrafficAlign: Aligning Large Language Models for Traffic Scenario Generation",
  "source": "CVPR 2026 / https://openaccess.thecvf.com/content/CVPR2026/html/Tu_TrafficAlign_Aligning_Large_Language_Models_for_Traffic_Scenario_Generation_CVPR_2026_paper.html / arXiv:2606.29097 / https://arxiv.org/abs/2606.29097",
  "authors": ["Zhi Tu", "Liangkun Niu", "Tianyi Zhang"],
  "affiliations": ["Purdue University"],
  "comment": "TrafficAlign 用真实驾驶视频合成、校验并对齐 LLM 交通场景生成，让 LLM 生成的测试场景更贴近地区交通分布并能触发更多碰撞。"
}
---

## 一句话定位

TrafficAlign 是一篇自动驾驶测试场景生成论文。它不是让 LLM 直接凭 prompt 写场景，而是从真实驾驶视频中合成 scenario description，再用 DSL 做语义校验，最后用这些数据对齐 LLM，使生成场景更贴近真实地区交通分布。

## 论文要解决的问题

LLM 被用于生成自动驾驶仿真场景后，常见问题是场景同质化、缺少交通领域知识、与真实地区分布不一致。人工写 prompt 成本高，也无法覆盖大量区域差异。TrafficAlign 针对的矛盾是：怎样让 LLM 既能规模化生成场景，又不脱离真实交通分布，并且生成结果能真正用于发现模型风险。

## 方法和系统设计

- 视频到场景描述：用 multimodal LLM 从真实驾驶视频中合成自然语言 traffic scenario description。
- DSL 转换和校验：把自然语言场景转成 domain-specific language，通过 syntactic checker 和 semantic checker 过滤无效或不完整场景。
- LLM alignment：用校验后的场景数据对齐 LLM，使其生成更贴近目标地区的交通场景。
- 下游评估：比较生成场景能否触发更多碰撞，以及用生成场景 fine-tune driving models 是否降低碰撞率。

## 关键图与可视化结果

![图 1：TrafficAlign 数据合成流水线，从驾驶视频到自然语言、DSL 校验和 LLM 对齐](https://arxiv.org/html/2606.29097v1/x1.png)

这张图说明 TrafficAlign 的关键不是“LLM 生成”，而是用真实视频和 DSL 校验把 LLM 拉回可执行、可检查的交通场景空间。

![图 2：TrafficAlign 生成场景与真实交通场景的 UMAP 分布对齐，对比多个未对齐 LLM baseline](https://arxiv.org/html/2606.29097v1/x3.png)

这张图用于判断 alignment 是否有效。它展示 TrafficAlign 生成的场景 embedding 更接近真实地区交通分布，而不是形成与真实数据脱节的 LLM 文本簇。

## 实验结论与证据

论文报告 TrafficAlign 生成的场景比 SOTA 方法平均多揭示最高 10.8% 的碰撞，并且用这些场景 fine-tune 三个自动驾驶模型后，碰撞率相对原模型降低 36.1%。它还在六个地理区域做定性分布对齐分析。这个证据链比单纯展示生成文本更强，因为它把场景生成、有效性校验、风险发现和模型改进连接在一起。

## 应用场景与启发

- 应用场景：LLM-based traffic scenario generation、区域化仿真测试、自动驾驶模型长尾场景 fine-tuning。
- 方法启发：场景生成系统需要一个可验证中间表示，DSL 可以作为 LLM 输出和仿真器之间的质量闸门。
- 讨论问题：LLM 生成的碰撞场景是真实风险放大，还是由 DSL/仿真器偏差制造出的测试偏差。

## 局限与阅读风险

TrafficAlign 的质量依赖视频解析、LLM 描述、DSL 表达能力和仿真器还原能力。UMAP 对齐能说明分布接近，但不能完全证明场景因果机制真实。碰撞率提升也可能来自生成分布更激进，需要区分有效风险发现和不合理攻击式场景。

## 后续跟进

- 检查 GitHub 是否开放视频到 DSL、校验器和场景生成代码。
- 与 CommonRoad-Game 和 D-V2S 对比，整理从真实数据到可执行测试场景的三条路线。
- 后续可用目标地区或既有采集数据做小规模 TrafficAlign 复现实验。
