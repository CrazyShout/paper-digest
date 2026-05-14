window.PAPER_DIGESTS = [
  {
    "id": "2026-05-13",
    "date": "2026-05-13",
    "title": "从 V2X 协同到可规划世界模型",
    "summary": "本期按组内配置方向重新筛选真实论文，主线是把自动驾驶研究从单点开环指标推进到协同通信、闭环规划、动态三维场景、世界模型和鲁棒安全评测。",
    "keywords": [
      "协同规划",
      "V2X 预测",
      "闭环世界模型",
      "鲁棒安全"
    ],
    "papers": [
      {
        "id": "select2drive-pragmatic-communications",
        "tag": "cooperative-autonomous-driving",
        "title": "Select2Drive: Enhancing Real-World V2X Autonomous Driving with Pragmatic Communications",
        "source": "arXiv:2501.12040 / https://arxiv.org/abs/2501.12040",
        "authors": [
          "Jiahao Huang",
          "Jianhang Zhu",
          "Rongpeng Li",
          "Zhifeng Zhao",
          "Honggang Zhang"
        ],
        "affiliations": [
          "Zhejiang University and collaborators"
        ],
        "comment": "把 V2X 协同从多传信息转为选择关键区域、控制延迟并服务闭环决策，适合作为协同自动驾驶方向的本期主线。",
        "visual": "visual-network",
        "visualLabel": "PragComm",
        "body": "## 导读判断\n\n这篇入选的原因不是它又提出一个协同感知模块，而是它把协同驾驶最容易被忽略的问题摆到前台：通信和计算资源有限时，系统到底应该传什么。论文围绕 Pragmatic Communications，把感知范围、通信区域和闭环驾驶收益联系起来，适合用作协同自动驾驶方向的筛选基准。\n\n## 研究背景与问题\n\n传统 V2X 协同工作常默认更多视角一定更好，但在真实系统中，通信带宽、感知推理、决策延迟会一起累积。过大的感知范围还可能给决策模块带来无关信息，导致规划不稳。Select2Drive 的问题定义因此更接近部署约束：在带宽受限和定位误差存在时，如何只传对驾驶决策最关键的信息，并让协同真正改善路线完成率和驾驶分数。\n\n## 方法主线\n\n- 论文提出分布式预测感知，用低成本、运动感知的重建替代高维语义特征的完整预测，降低感知到决策之间的累计延迟。\n- 它引入基于重要区域的通信选择，只优先传递对 ego 决策有贡献的空间区域，而不是扩大全部感知范围。\n- 方法同时连接离线感知指标和闭环驾驶指标，使通信策略的价值通过最终驾驶行为而不只是 mAP 或重建误差来体现。\n\n## 实验与证据\n\n论文在 V2Xverse 和真实 DAIR-V2X 上评估，关注有限带宽、位姿误差和闭环驾驶场景。结果报告了离线感知任务的提升，也报告了闭环 driving score 与 route completion 的提升，尤其在密集交通和高速动态场景中更明显。这个证据结构比单纯协同感知论文更有价值，因为它把通信选择和最终驾驶表现连起来。\n\n## 和组内方向的关系\n\n这篇论文能直接服务协同自动驾驶方向。组内如果继续做 V2X 或多车协同，不应只问信息融合结构怎么设计，而要把通信预算、延迟、选择策略和闭环规划一起定义。它也给协同轨迹预测方向提供一个反向问题：未来预测是否也应该只预测和传递对规划有用的区域。\n\n## 局限与阅读风险\n\n它的核心结论依赖仿真平台、数据集覆盖和通信模型设定。闭环提升虽然比开环指标更有说服力，但仍需要检查是否覆盖极端遮挡、通信丢包、车路设备标定漂移等真实部署问题。另一个风险是重要区域选择可能对当前策略过拟合，换成不同规划器或驾驶风格后收益不一定保持。\n\n## 后续跟进\n\n- 检查 V2Xverse 和 DAIR-V2X 评估设置，记录通信带宽、位姿误差和闭环指标定义。\n- 复现实验优先选择低带宽和高动态密度场景，验证 less is more 是否稳定成立。\n- 组会可讨论一个问题：协同系统的优化目标应该是感知精度、预测误差，还是闭环驾驶效用。",
        "link": "papers/select2drive-pragmatic-communications/"
      },
      {
        "id": "co-mtp-v2x-trajectory-prediction",
        "tag": "cooperative-trajectory-prediction",
        "title": "Co-MTP: A Cooperative Trajectory Prediction Framework with Multi-Temporal Fusion for Autonomous Driving",
        "source": "ICRA 2025 / arXiv:2502.16589 / https://arxiv.org/abs/2502.16589",
        "authors": [
          "Xinyu Zhang",
          "Zewei Zhou",
          "Zhaoyi Wang",
          "Yangjie Ji",
          "Yanjun Huang",
          "Hong Chen"
        ],
        "affiliations": [
          "Tongji University"
        ],
        "comment": "把 V2X 信息从单帧协同感知推进到历史轨迹补全和未来交互建模，是协同轨迹预测方向值得优先读的论文。",
        "visual": "visual-grid",
        "visualLabel": "V2X trajectory",
        "body": "## 导读判断\n\nCo-MTP 的价值在于它没有停留在协同感知，而是直接面向轨迹预测和规划。它把 V2X 的作用拆成两个时间域：历史域补全单车感知缺失，未来域建模 ego planning 与周围车辆意图之间的交互。这正好对应组内协同轨迹预测方向最核心的问题。\n\n## 研究背景与问题\n\n单车轨迹预测在遮挡、远距离目标和交叉口交互中容易缺历史轨迹，导致多模态预测偏差。已有 V2X 工作主要聚焦单帧检测或感知融合，却较少回答协同信息如何改善未来预测，甚至如何服务规划动作下的未来场景状态。Co-MTP 的切入点是让车辆和基础设施协同信息进入历史交互与未来交互，而不是只把它当作额外观测。\n\n## 方法主线\n\n- 在历史域，方法利用 V2X 补全单车视角下不完整的历史轨迹，并用异构图 Transformer 融合多源历史特征。\n- 在未来域，方法进一步把 ego planning action 和其他车辆意图纳入图交互，估计给定规划动作下的未来场景状态。\n- 论文把预测任务明确放到服务 planning 的语境中，而不是只输出孤立 agent 的未来轨迹。\n\n## 实验与证据\n\n论文在真实世界 V2X-Seq 数据集上评估，并报告 Co-MTP 达到当时 state-of-the-art。更重要的是，它的消融逻辑围绕历史融合和未来融合展开，能检查 V2X 信息到底在补历史、建交互还是支持规划上起作用。对组内来说，这比只看 ADE/FDE 排名更有参考价值。\n\n## 和组内方向的关系\n\n这篇可以作为协同轨迹预测方向的标准样本。它提醒我们，V2X 轨迹预测不是把更多观测拼进模型，而是要定义 V2X 在时间维度上的职责：过去补全、当前理解、未来交互和规划条件化。后续如果做车路协同预测，可以沿着这个时间域拆分去设计消融。\n\n## 局限与阅读风险\n\n论文仍需要重点核查同步误差、通信延迟和感知误差是否被充分建模。V2X-Seq 虽是真实数据，但真实部署中的异步、丢包和标定漂移可能更复杂。另一个风险是预测提升未必自动转化为规划收益，除非闭环规划指标能直接验证。\n\n## 后续跟进\n\n- 阅读 V2X-Seq 的数据定义，确认基础设施视角和车辆视角的时间同步假设。\n- 复现时优先做历史域融合、未来域融合、无 V2X 三组消融。\n- 组会可讨论：协同轨迹预测是否应该以 planning-conditioned prediction 作为默认问题定义。",
        "link": "papers/co-mtp-v2x-trajectory-prediction/"
      },
      {
        "id": "v2x-vlm-cooperative-driving",
        "tag": "vehicle-road-cooperation",
        "title": "V2X-VLM: End-to-End V2X Cooperative Autonomous Driving Through Large Vision-Language Models",
        "source": "arXiv:2408.09251 / https://arxiv.org/abs/2408.09251",
        "authors": [
          "Junwei You",
          "Haotian Shi",
          "Zhuoyu Jiang",
          "Zilin Huang",
          "Rui Gan",
          "Keshu Wu",
          "Xi Cheng",
          "Xiaopeng Li",
          "Bin Ran"
        ],
        "affiliations": [
          "University of Wisconsin-Madison and collaborators"
        ],
        "comment": "把车端和路侧多视角图像与文本语义对齐后做轨迹规划，适合评估车路协同是否能进入端到端驾驶闭环。",
        "visual": "visual-wave",
        "visualLabel": "V2X-VLM",
        "body": "## 导读判断\n\n这篇论文的重点不是单纯把 VLM 套到驾驶上，而是尝试把车端和基础设施端的多视角信息、文本场景描述和轨迹规划合成一个 V2X 端到端框架。它适合放在车路协同方向，因为它直接面对异构视觉语义融合和规划稳定性，而不是只做路侧感知增强。\n\n## 研究背景与问题\n\n车路协同的直觉很强：路侧传感器能看见 ego 看不见的遮挡区域。但实际问题在于车辆与基础设施视角不同、语义粒度不同、传感器质量不同，直接拼接特征容易产生错配。V2X-VLM 试图用视觉语言模型的语义能力统一多视角信息，并把这种理解用于规划输出。\n\n## 方法主线\n\n- 输入包括车辆和基础设施的多视角相机信息，以及文本化场景描述，用于构建更完整的驾驶环境理解。\n- 论文使用对比学习增强异构视觉特征和文本语义之间的对齐，缓解多源信息融合中的语义错位。\n- 它加入知识蒸馏来稳定训练，并把最终目标落在轨迹规划精度、碰撞率、鲁棒性和效率上。\n\n## 实验与证据\n\n论文在大规模真实数据集上报告了轨迹规划精度提升，并强调 L2 error、collision rate、鲁棒性和效率。它还做了组件消融，验证语义对齐、蒸馏等模块的贡献。对于本项目，这类证据说明车路协同不应只汇报检测精度，还应评估语义融合是否改善了安全规划。\n\n## 和组内方向的关系\n\n这篇论文同时连接车路协同和端到端自动驾驶。它给组内的启发是：基础设施信息进入端到端模型时，可以不是简单的特征拼接，而是通过语义对齐、场景描述和规划目标统一建模。对于未来做 V2I 或路侧感知，可以借鉴它的评估口径，把碰撞率和规划误差作为核心指标。\n\n## 局限与阅读风险\n\nVLM 的语义能力可能带来额外计算成本和不可解释错误，文本描述如何生成也会影响系统可靠性。论文需要重点检查是否存在数据集特定的语言模板、是否评估极端遮挡和异常交通行为，以及基础设施传感器失效时模型是否退化明显。\n\n## 后续跟进\n\n- 检查论文使用的数据集是否包含真实基础设施传感器，以及文本描述如何构建。\n- 对比 V2X-VLM 与纯视觉 V2X 方法在碰撞率、规划误差和推理成本上的差异。\n- 组会可讨论：车路协同中的语言语义是必要中间层，还是目前主要起到正则化和解释作用。",
        "link": "papers/v2x-vlm-cooperative-driving/"
      },
      {
        "id": "desire-gs-4d-street-gaussians",
        "tag": "3d-reconstruction",
        "title": "DeSiRe-GS: 4D Street Gaussians for Static-Dynamic Decomposition and Surface Reconstruction for Urban Driving Scenes",
        "source": "CVPR 2025 / https://openaccess.thecvf.com/content/CVPR2025/html/Peng_DeSiRe-GS_4D_Street_Gaussians_for_Static-Dynamic_Decomposition_and_Surface_Reconstruction_CVPR_2025_paper.html",
        "authors": [
          "Chensheng Peng",
          "Chengwei Zhang",
          "Yixiao Wang",
          "Chenfeng Xu",
          "Yichen Xie",
          "Wenzhao Zheng",
          "Kurt Keutzer",
          "Masayoshi Tomizuka",
          "Wei Zhan"
        ],
        "affiliations": [
          "UC Berkeley"
        ],
        "comment": "用自监督 4D Gaussian Splatting 做静动态分解和表面重建，是驾驶场景三维重建方向质量较高的近期样本。",
        "visual": "visual-grid",
        "visualLabel": "4D street GS",
        "body": "## 导读判断\n\nDeSiRe-GS 值得入选，是因为它处理的是驾驶场景 3DGS 中最难的一类问题：动态物体、数据稀疏和表面漂浮。它不依赖额外 3D bounding box 标注，而是做自监督静动态分解和表面重建，和组内三维重建、仿真生成、可评估场景建模都有直接关系。\n\n## 研究背景与问题\n\n自动驾驶场景不是静态室内重建。道路、建筑、车辆、行人同时存在，车辆还会快速移动。普通 3DGS 容易在动态区域产生鬼影或漂浮高斯，导致渲染看起来不错但几何不可信。对驾驶系统而言，这类错误会影响仿真、地图更新和下游感知评测，所以需要一种能区分静态背景和动态对象、并保持表面物理合理性的表示。\n\n## 方法主线\n\n- 论文采用两阶段优化流程，先根据 3DGS 对动态区域重建不佳这一现象提取 2D motion masks。\n- 第二阶段把这些 2D motion priors 可微地映射到 Gaussian 空间，形成动态街景高斯表示。\n- 方法加入几何正则和时序跨视角一致性，减少数据稀疏带来的过拟合，让高斯更贴合物体表面而不是漂浮在空中。\n\n## 实验与证据\n\nCVPR 2025 版本报告了复杂城市驾驶场景中的静动态分解、表面重建和新视角合成效果。论文强调自监督方法能超过已有自监督方法，并达到接近依赖外部 3D bounding box 标注方法的准确性。对本项目来说，关键不是单张渲染图是否漂亮，而是它是否改善动态对象的几何一致性和表面可信度。\n\n## 和组内方向的关系\n\n这篇论文可以作为三维重建方向的核心模板：研究目标不只是 photorealistic rendering，而是可用于自动驾驶仿真和评测的几何表示。它也能和世界模型方向联动，后续可以讨论 3DGS 场景是否能作为闭环仿真的状态空间，或者作为世界模型生成结果的几何约束。\n\n## 局限与阅读风险\n\n自监督 motion prior 的质量会影响静动态分解结果，复杂天气、夜间、低纹理道路和长尾交通参与者可能仍有风险。方法属于 per-scene optimization 还是可泛化模型，需要在复现时明确。另一个风险是渲染指标提升不等于可驾驶仿真可靠，还需要下游规划或感知评测验证。\n\n## 后续跟进\n\n- 优先检查代码和数据，确认是否能在 Waymo、KITTI 或自有驾驶数据上复现。\n- 复现实验不要只看 PSNR/SSIM，要加入动态区域深度误差和表面一致性检查。\n- 组会可讨论：驾驶场景 3DGS 的成功标准应是视觉质量、几何准确，还是下游闭环可用性。",
        "link": "papers/desire-gs-4d-street-gaussians/"
      },
      {
        "id": "maat-e2e-adversarial-training",
        "tag": "autonomous-driving-security",
        "title": "Module-wise Adaptive Adversarial Training for End-to-end Autonomous Driving",
        "source": "arXiv:2409.07321 / https://arxiv.org/abs/2409.07321",
        "authors": [
          "Tianyuan Zhang",
          "Lu Wang",
          "Jiaqi Kang",
          "Xinwei Zhang",
          "Siyuan Liang",
          "Yuwei Chen",
          "Aishan Liu",
          "Xianglong Liu"
        ],
        "affiliations": [
          "Beihang University and collaborators"
        ],
        "comment": "把对抗训练扩展到感知、预测、规划耦合的端到端驾驶模型，适合作为自动驾驶模型攻防方向的防御样本。",
        "visual": "visual-network",
        "visualLabel": "MA2T defense",
        "body": "## 导读判断\n\nMA2T 入选是因为它把安全鲁棒性问题从单个感知模块推进到端到端驾驶链路。端到端模型的攻击影响不只体现在检测或分割错误上，而是会穿过感知、预测和规划，最终改变驾驶动作。论文尝试做模块级自适应对抗训练，适合作为组内自动驾驶模型攻防方向的防御基线。\n\n## 研究背景与问题\n\n普通对抗训练通常假设模型有一个清晰输出和单一损失，但端到端驾驶模型包含感知、预测、规划等多阶段目标，各模块强耦合。直接套用分类或检测领域的对抗训练，可能只增强局部模块而损害整体驾驶目标。MA2T 的问题定义是：如何在端到端驾驶模型内部注入扰动并动态平衡各模块损失，使整体驾驶决策更稳健。\n\n## 方法主线\n\n- 方法提出 Module-wise Noise Injection，在不同模块输入前注入噪声，但训练目标由整体端到端任务而不是单个模块损失引导。\n- 它提出 Dynamic Weight Accumulation Adaptation，根据模块对整体鲁棒训练的贡献动态调整损失权重。\n- 评估覆盖白盒攻击、黑盒攻击和自然扰动，并把鲁棒性验证延伸到 CARLA 闭环环境。\n\n## 实验与证据\n\n论文在 nuScenes 上使用多个端到端自动驾驶模型做实验，并报告在攻击场景下相较基线有明显提升。它还在 CARLA 中做闭环评估，验证防御不只是提升开环指标，也能改善模拟驾驶中的鲁棒性。这个证据结构符合本项目对安全方向的筛选要求：必须区分模型指标下降和真实驾驶风险上升。\n\n## 和组内方向的关系\n\n这篇论文适合作为安全鲁棒性方向的固定参考。后续组内无论做端到端驾驶、V2X 协同还是世界模型，都需要有类似的攻击和自然扰动评估。它还提醒我们，防御方法不能只看某个模块是否更鲁棒，而要看整体规划输出和闭环驾驶行为是否更安全。\n\n## 局限与阅读风险\n\n对抗训练通常带来训练成本和 clean performance trade-off，需要核查论文是否报告正常场景性能。攻击设置也可能覆盖有限，真实世界中的物理攻击、传感器失效、通信异常和场景级扰动更复杂。MA2T 的模块划分还依赖具体端到端架构，迁移到 VLM 或世界模型式驾驶系统时未必直接适用。\n\n## 后续跟进\n\n- 记录论文使用的端到端模型、攻击类型和闭环指标，作为未来安全评测清单。\n- 如果复现，优先做 clean、white-box、black-box、natural corruption 四类对照。\n- 组会可讨论：端到端驾驶鲁棒性应按模块防御，还是按最终规划风险统一建模。",
        "link": "papers/maat-e2e-adversarial-training/"
      },
      {
        "id": "vadv2-probabilistic-planning",
        "tag": "end-to-end-autonomous-driving",
        "title": "VADv2: End-to-End Vectorized Autonomous Driving via Probabilistic Planning",
        "source": "ICLR 2026 / arXiv:2402.13243 / https://hgao-cv.github.io/VADv2/",
        "authors": [
          "Bo Jiang",
          "Shaoyu Chen",
          "Hao Gao",
          "Bencheng Liao",
          "Qian Zhang",
          "Wenyu Liu",
          "Xinggang Wang"
        ],
        "affiliations": [
          "Huazhong University of Science and Technology",
          "Horizon Robotics"
        ],
        "comment": "把端到端驾驶规划从确定性轨迹回归转为概率规划分布，适合作为端到端自动驾驶方向的核心阅读论文。",
        "visual": "visual-wave",
        "visualLabel": "probabilistic plan",
        "body": "## 导读判断\n\nVADv2 的核心价值在于它正面处理规划的不确定性。许多端到端驾驶方法直接回归一条轨迹或控制量，但真实驾驶存在多种合理动作，确定性输出容易把多模态行为压成平均解。VADv2 用概率规划分布来建模动作空间，适合作为端到端自动驾驶方向的本期代表。\n\n## 研究背景与问题\n\n端到端驾驶希望从多视角传感器输入直接到规划控制，但规划动作处在高维连续时空空间，既难学习也难解释。已有确定性模型在闭环中容易出现不稳定行为，还常依赖规则 wrapper 修正。VADv2 的问题定义是：能否把规划动作离散为大规模 planning vocabulary，再通过 planning tokens 与 scene tokens 交互，输出动作概率分布并采样执行。\n\n## 方法主线\n\n- 模型以流式多视角图像序列为输入，将传感器信息转成环境 token 表征。\n- 它把连续规划动作空间离散成规划词表，并进一步 token 化，让规划 token 和场景 token 交互。\n- 模型从大规模驾驶示范中监督动作概率分布，最终采样动作控制车辆，而不是直接回归单一轨迹。\n\n## 实验与证据\n\nVADv2 被 ICLR 2026 接收，项目页和论文报告了 CARLA Town05 长路线闭环 benchmark 的强表现，并补充 NAVSIM 与大规模 3DGS-based benchmark 评估。重要之处在于它强调无规则 wrapper 的稳定闭环运行，这比只在 nuScenes 上报告开环规划误差更接近真实驾驶研究关心的问题。\n\n## 和组内方向的关系\n\n这篇论文对组内端到端驾驶方向有两点启发。第一，规划输出可以是分布而不是一条确定轨迹，这给不确定性交互、风险控制和多模态规划留下空间。第二，评价必须回到闭环和长路线，而不是只看短时 horizon 的 L2 error。它也可以和 V2X-VLM 对照：一个强调语义协同，一个强调概率规划。\n\n## 局限与阅读风险\n\n概率规划的 tokenization 会引入离散化设计选择，planning vocabulary 的覆盖质量会影响模型上限。CARLA 闭环结果虽重要，但仍需检查真实数据和长尾场景上的泛化。另一个问题是采样式动作如何和安全约束结合，论文结果不应被理解为概率规划自动解决安全验证。\n\n## 后续跟进\n\n- 查看项目页代码发布状态，记录 CARLA、NAVSIM 和 3DGS benchmark 的评估差异。\n- 复现时优先比较确定性回归、概率分布输出和规则 wrapper 三类设置。\n- 组会可讨论：端到端驾驶中的不确定性应该出现在规划动作、世界模型 rollout，还是两者都建模。",
        "link": "papers/vadv2-probabilistic-planning/"
      },
      {
        "id": "vista-driving-world-model",
        "tag": "world-models",
        "title": "Vista: A Generalizable Driving World Model with High Fidelity and Versatile Controllability",
        "source": "NeurIPS 2024 / https://papers.nips.cc/paper_files/paper/2024/hash/a6a066fb44f2fe0d36cf740c873b8890-Abstract-Conference.html",
        "authors": [
          "Shenyuan Gao",
          "Jiazhi Yang",
          "Li Chen",
          "Kashyap Chitta",
          "Yihang Qiu",
          "Andreas Geiger",
          "Jun Zhang",
          "Hongyang Li"
        ],
        "affiliations": [
          "Shanghai AI Laboratory",
          "University of Tübingen",
          "The University of Hong Kong and collaborators"
        ],
        "comment": "把驾驶世界模型的重点放在泛化、高保真和多层次动作可控性上，适合检验世界模型是否能服务规划评估。",
        "visual": "visual-grid",
        "visualLabel": "Vista rollout",
        "body": "## 导读判断\n\nVista 是本期世界模型方向的核心论文。它没有只追求视频生成观感，而是把 driving world model 的三个关键问题放在一起：能否泛化到未见环境、能否保留关键动态细节、能否被不同层次动作控制。对组内来说，它适合用来判断世界模型是否已经从展示型视频生成走向可用于动作评估。\n\n## 研究背景与问题\n\n自动驾驶世界模型的理想用途是预测不同动作的后果，支持仿真、规划、数据生成和风险评估。但很多视频生成模型虽然视觉效果好，却缺少动作可控性，长时 rollout 容易漂移，对未见场景也未必稳定。Vista 的问题定义更清晰：构建一个既高保真、又可用命令、目标点、轨迹、角度和速度等多种控制信号驱动的驾驶世界模型。\n\n## 方法主线\n\n- 论文通过诊断已有方法的问题，加入面向移动实例和结构信息的损失，提升关键交通细节的预测质量。\n- 它设计 latent replacement，把历史帧作为先验注入长时 rollout，改善时序一致性。\n- 在可控性上，模型支持从高层意图到低层操控的多种控制输入，使同一世界模型能用于不同规划或评估场景。\n\n## 实验与证据\n\nNeurIPS 2024 论文在多个数据集上做实验，报告 Vista 相比强通用视频生成器和已有驾驶世界模型在感知指标上有显著优势。更值得关注的是，论文进一步使用 Vista 自身建立 generalizable reward，用于真实世界动作评估而不访问 ground-truth actions。这一点把世界模型从生成器推进到规划评价工具。\n\n## 和组内方向的关系\n\n这篇论文对组内世界模型方向的筛选标准很重要：不能只看视频是否清晰，而要看 action controllability、long-horizon coherence、unseen scenario generalization 和 reward/action evaluation 是否成立。它也能和 VADv2 形成互补，一个学习规划分布，一个预测动作后果，二者可以共同构成闭环评估框架。\n\n## 局限与阅读风险\n\n世界模型的视觉保真不等于物理真实，reward 也可能继承模型偏差。长时 rollout 中罕见交通事件、交通规则违反、传感器异常和多 agent 反事实交互仍然难验证。另一个风险是评估依赖生成指标，如 FID/FVD 不能完全说明对规划安全有帮助。\n\n## 后续跟进\n\n- 重点阅读 action controllability 和 reward evaluation 部分，判断它能否接入组内规划实验。\n- 复现实验应加入反事实动作、长时 rollout 和罕见交互场景，而不只看视频质量。\n- 组会可讨论：世界模型作为 planner evaluator 时，怎样避免模型偏差被规划器利用。",
        "link": "papers/vista-driving-world-model/"
      }
    ],
    "notes": [
      {
        "user": "paper-lead",
        "time": "09:20",
        "text": "本期建议优先比较闭环规划收益和通信/几何/鲁棒性假设，不只看单项开环指标。"
      },
      {
        "user": "reading-owner",
        "time": "09:35",
        "text": "世界模型和 3DGS 两篇要一起读，重点看生成或重建结果能否真正进入规划评估。"
      }
    ],
    "body": "## 本期判断\n\n本期的共同主线是自动驾驶系统正在从单车、开环、模块化指标，转向协同信息选择、闭环规划稳定性和可验证的场景模型。Select2Drive 与 Co-MTP 代表 V2X 协同开始关心通信预算和预测-规划耦合；V2X-VLM 与 VADv2 代表端到端驾驶从感知输出转向可解释的规划分布；DeSiRe-GS 与 Vista 则把三维重建和世界模型推向可仿真、可控制、可评估的驾驶场景；MA2T 用攻击防御提醒我们，闭环收益如果不做鲁棒性检验，很容易被过度解读。\n\n## 筛选口径\n\n- 优先选择能直接命中当前七个配置方向的论文，每个方向保留一篇最能形成组内讨论的问题样本。\n- 优先保留真实 V2X、闭环驾驶、公开 benchmark、CVPR/ICRA/ICLR/NeurIPS 或可核验 arXiv 记录的工作。\n- 剔除了只展示视觉生成效果、只做非驾驶场景、或没有说明下游规划/安全收益的相近论文。\n- 对每篇论文都保留局限判断，避免把论文摘要直接改写成结论。\n\n## 按方向取用\n\n- 做协同自动驾驶或 V2X 的同学，优先看 Select2Drive、Co-MTP 和 V2X-VLM，重点比较通信预算、历史轨迹补全、车路语义融合和闭环规划收益。\n- 做三维重建或仿真的同学，优先看 DeSiRe-GS 和 Vista，重点判断场景表示是否能从视觉展示走向可评估、可控制、可服务规划。\n- 做端到端驾驶或安全鲁棒性的同学，优先看 VADv2 和 MA2T，重点比较概率规划、不确定性建模、攻击防御和闭环安全指标。\n- 组会讨论可以围绕一个共同问题展开：这些论文的提升到底来自更强模型、更好信息选择，还是更合理的闭环评测定义。",
    "bodyHtml": "<h2>本期判断</h2>\n<p>本期的共同主线是自动驾驶系统正在从单车、开环、模块化指标，转向协同信息选择、闭环规划稳定性和可验证的场景模型。Select2Drive 与 Co-MTP 代表 V2X 协同开始关心通信预算和预测-规划耦合；V2X-VLM 与 VADv2 代表端到端驾驶从感知输出转向可解释的规划分布；DeSiRe-GS 与 Vista 则把三维重建和世界模型推向可仿真、可控制、可评估的驾驶场景；MA2T 用攻击防御提醒我们，闭环收益如果不做鲁棒性检验，很容易被过度解读。</p>\n<h2>筛选口径</h2>\n<ul><li>优先选择能直接命中当前七个配置方向的论文，每个方向保留一篇最能形成组内讨论的问题样本。</li><li>优先保留真实 V2X、闭环驾驶、公开 benchmark、CVPR/ICRA/ICLR/NeurIPS 或可核验 arXiv 记录的工作。</li><li>剔除了只展示视觉生成效果、只做非驾驶场景、或没有说明下游规划/安全收益的相近论文。</li><li>对每篇论文都保留局限判断，避免把论文摘要直接改写成结论。</li></ul>\n<h2>按方向取用</h2>\n<ul><li>做协同自动驾驶或 V2X 的同学，优先看 Select2Drive、Co-MTP 和 V2X-VLM，重点比较通信预算、历史轨迹补全、车路语义融合和闭环规划收益。</li><li>做三维重建或仿真的同学，优先看 DeSiRe-GS 和 Vista，重点判断场景表示是否能从视觉展示走向可评估、可控制、可服务规划。</li><li>做端到端驾驶或安全鲁棒性的同学，优先看 VADv2 和 MA2T，重点比较概率规划、不确定性建模、攻击防御和闭环安全指标。</li><li>组会讨论可以围绕一个共同问题展开：这些论文的提升到底来自更强模型、更好信息选择，还是更合理的闭环评测定义。</li></ul>",
    "tags": [
      {
        "id": "cooperative-autonomous-driving",
        "label": "协同自动驾驶",
        "color": "#b45f49",
        "description": "关注多车协同、V2X 信息共享、协同规划和闭环自动驾驶系统。",
        "priority": 1
      },
      {
        "id": "cooperative-trajectory-prediction",
        "label": "协同轨迹预测",
        "color": "#60715f",
        "description": "关注多智能体交互建模、车车/车路信息融合和轨迹预测不确定性。",
        "priority": 1
      },
      {
        "id": "vehicle-road-cooperation",
        "label": "车路协同",
        "color": "#475a70",
        "description": "关注路侧感知、车路协同感知、基础设施辅助定位和通信约束。",
        "priority": 1
      },
      {
        "id": "3d-reconstruction",
        "label": "三维重建",
        "color": "#8b5e83",
        "description": "关注自动驾驶场景的 3D/4D 重建、NeRF/Gaussian Splatting、占据和地图构建。",
        "priority": 2
      },
      {
        "id": "autonomous-driving-security",
        "label": "自动驾驶模型攻防",
        "color": "#9a5b42",
        "description": "关注感知、预测、规划和端到端驾驶模型的攻击、防御、鲁棒性和安全评测。",
        "priority": 2
      },
      {
        "id": "end-to-end-autonomous-driving",
        "label": "端到端自动驾驶",
        "color": "#6d6254",
        "description": "关注从传感器输入到规划控制输出的端到端驾驶模型、驾驶大模型和闭环评测。",
        "priority": 1
      },
      {
        "id": "world-models",
        "label": "世界模型",
        "color": "#645063",
        "description": "关注自动驾驶和具身智能中的世界模型、视频预测、仿真生成和交互式 rollout。",
        "priority": 2
      }
    ]
  },
  {
    "id": "2026-05-11",
    "date": "2026-05-11",
    "title": "协同自动驾驶、车路协同与驾驶世界模型",
    "summary": "本期示例按新的研究兴趣配置生成，覆盖协同自动驾驶、协同轨迹预测、车路协同、端到端驾驶和世界模型等方向。",
    "keywords": [
      "协同自动驾驶",
      "车路协同",
      "世界模型"
    ],
    "papers": [
      {
        "id": "cooperative-driving-planning",
        "tag": "cooperative-autonomous-driving",
        "title": "示例：Cooperative Planning for Connected Autonomous Vehicles",
        "source": "arXiv / project page",
        "authors": [
          "Yifan Zhang",
          "Mei Chen",
          "Daniel Park"
        ],
        "affiliations": [
          "Tsinghua University",
          "Stanford University",
          "MIT CSAIL"
        ],
        "comment": "把多车协同规划拆成通信、意图共享和安全约束三个层级，适合作为协同自动驾驶方向的日报样例。",
        "visual": "visual-network",
        "visualLabel": "CAV planning",
        "body": "## 核心问题\n\n协同自动驾驶需要在有限通信带宽下共享局部观测和意图，同时保证规划结果不会引入新的冲突。论文样例关注多车之间如何在闭环场景中协调动作。\n\n## 方法速读\n\n- 将车辆的局部目标、可行轨迹和风险区域编码成轻量消息。\n- 通过图结构聚合邻近车辆意图，减少重复或冲突决策。\n- 在规划层加入安全约束，优先处理交叉口和汇入场景。\n\n## 组内关注点\n\n抓取这类论文时，应优先关注是否有闭环仿真、通信延迟建模和真实交通交互复杂度。",
        "link": "papers/cooperative-driving-planning/"
      },
      {
        "id": "cooperative-trajectory-v2x",
        "tag": "cooperative-trajectory-prediction",
        "title": "示例：V2X-Aware Cooperative Trajectory Prediction",
        "source": "OpenReview / arXiv",
        "authors": [
          "Ava Singh",
          "Rui Tan",
          "Yuki Sato"
        ],
        "affiliations": [
          "UC Berkeley",
          "University of Tokyo"
        ],
        "comment": "重点是把车车和车路信息加入多智能体轨迹预测，适合筛选协同轨迹预测方向的交互建模论文。",
        "visual": "visual-grid",
        "visualLabel": "trajectory grid",
        "body": "## 核心问题\n\n单车视角的轨迹预测容易漏掉遮挡目标和远端交互。协同轨迹预测希望利用 V2X 信息提升对关键交通参与者的未来运动估计。\n\n## 方法速读\n\n- 将邻车观测和路侧观测对齐到统一时空坐标。\n- 用交互图建模车辆之间的让行、汇入和跟驰关系。\n- 输出多模态轨迹和不确定性，支持下游规划选择。\n\n## 组内关注点\n\n后续抓取时可以重点检查数据集是否包含真实 V2X，同步误差如何处理，以及是否只在开环指标上提升。",
        "link": "papers/cooperative-trajectory-v2x/"
      },
      {
        "id": "roadside-cooperative-perception",
        "tag": "vehicle-road-cooperation",
        "title": "示例：Roadside-Assisted Cooperative Perception for Urban Driving",
        "source": "IEEE Xplore / arXiv",
        "authors": [
          "Qian He",
          "Morgan Lee",
          "Fatima Noor"
        ],
        "affiliations": [
          "Shanghai Jiao Tong University",
          "Georgia Tech"
        ],
        "comment": "把路侧感知和车端感知做时空融合，适合作为车路协同方向中基础设施辅助感知的样例。",
        "visual": "visual-wave",
        "visualLabel": "V2I fusion",
        "body": "## 核心问题\n\n车端传感器在遮挡和远距离目标上存在天然盲区。路侧单元可以提供补充视角，但会带来通信延迟、坐标对齐和感知不一致问题。\n\n## 方法速读\n\n- 对车端和路侧目标进行时间同步与空间配准。\n- 使用置信度门控选择更可靠的目标观测。\n- 在延迟通信下预测路侧信息的当前状态。\n\n## 组内关注点\n\n筛选论文时应优先关注真实路侧设备实验、通信带宽限制和是否报告端到端驾驶收益。",
        "link": "papers/roadside-cooperative-perception/"
      },
      {
        "id": "e2e-driving-model",
        "tag": "end-to-end-autonomous-driving",
        "title": "示例：Planning-Oriented End-to-End Autonomous Driving",
        "source": "arXiv / benchmark",
        "authors": [
          "Mina Kim",
          "Oliver Smith",
          "Jia Luo"
        ],
        "affiliations": [
          "KAIST",
          "Oxford Robotics Institute"
        ],
        "comment": "把感知、预测和规划统一到一个可闭环评测的驾驶模型中，适合作为端到端自动驾驶方向的核心样例。",
        "visual": "visual-wave",
        "visualLabel": "driving rollout",
        "body": "## 核心问题\n\n端到端自动驾驶希望减少模块间误差传播，但也带来可解释性、数据规模和闭环稳定性问题。样例论文关注规划导向的端到端训练。\n\n## 方法速读\n\n- 输入多传感器历史观测，输出未来轨迹或控制信号。\n- 用规划损失和闭环反馈约束模型行为。\n- 在复杂交互场景中比较端到端模型和模块化系统。\n\n## 组内关注点\n\n日报筛选时应优先保留报告闭环驾驶指标、失败案例和数据规模细节的论文。",
        "link": "papers/e2e-driving-model/"
      },
      {
        "id": "driving-world-model",
        "tag": "world-models",
        "title": "示例：World Models for Closed-Loop Autonomous Driving",
        "source": "project page / arXiv",
        "authors": [
          "Lena Hoffmann",
          "Wei Liu",
          "Arjun Rao"
        ],
        "affiliations": [
          "ETH Zurich",
          "NVIDIA Research",
          "University of Toronto"
        ],
        "comment": "用生成式世界模型预测驾驶场景演化，适合筛选世界模型、仿真生成和闭环 rollout 相关论文。",
        "visual": "visual-grid",
        "visualLabel": "world model",
        "body": "## 核心问题\n\n驾驶世界模型希望在可控条件下预测未来场景，从而支持仿真、规划评估和数据生成。关键难点是交互一致性和闭环误差积累。\n\n## 方法速读\n\n- 将历史多视角观测压缩成场景状态。\n- 条件化 ego action 和交通参与者状态，生成未来视频或中间表征。\n- 用闭环 rollout 检查预测误差是否会快速发散。\n\n## 组内关注点\n\n这类论文需要重点检查是否只是视频生成效果好，还是能真正支撑规划、仿真或数据闭环。",
        "link": "papers/driving-world-model/"
      }
    ],
    "notes": [
      {
        "user": "paper-lead",
        "time": "09:12",
        "text": "协同自动驾驶方向建议优先看闭环评测和通信约束，不只看开环感知指标。"
      },
      {
        "user": "robotics-lab",
        "time": "10:04",
        "text": "世界模型方向需要区分视频生成展示和能否支撑规划 rollout。"
      }
    ],
    "body": "这一期保留为自动驾驶方向的内容源示例。真实使用时，Codex 可以先读取 `config/research-interests.json` 做论文筛选，再把入选论文写成 `content/papers/*.md`，最后把当期简报索引写到这里。",
    "bodyHtml": "<p>这一期保留为自动驾驶方向的内容源示例。真实使用时，Codex 可以先读取 `config/research-interests.json` 做论文筛选，再把入选论文写成 `content/papers/*.md`，最后把当期简报索引写到这里。</p>",
    "tags": [
      {
        "id": "cooperative-autonomous-driving",
        "label": "协同自动驾驶",
        "color": "#b45f49",
        "description": "关注多车协同、V2X 信息共享、协同规划和闭环自动驾驶系统。",
        "priority": 1
      },
      {
        "id": "cooperative-trajectory-prediction",
        "label": "协同轨迹预测",
        "color": "#60715f",
        "description": "关注多智能体交互建模、车车/车路信息融合和轨迹预测不确定性。",
        "priority": 1
      },
      {
        "id": "vehicle-road-cooperation",
        "label": "车路协同",
        "color": "#475a70",
        "description": "关注路侧感知、车路协同感知、基础设施辅助定位和通信约束。",
        "priority": 1
      },
      {
        "id": "end-to-end-autonomous-driving",
        "label": "端到端自动驾驶",
        "color": "#6d6254",
        "description": "关注从传感器输入到规划控制输出的端到端驾驶模型、驾驶大模型和闭环评测。",
        "priority": 1
      },
      {
        "id": "world-models",
        "label": "世界模型",
        "color": "#645063",
        "description": "关注自动驾驶和具身智能中的世界模型、视频预测、仿真生成和交互式 rollout。",
        "priority": 2
      }
    ]
  },
  {
    "id": "2026-05-04",
    "date": "2026-05-04",
    "title": "三维重建与自动驾驶模型攻防",
    "summary": "上一期示例展示历史简报在左侧目录中的位置，并覆盖三维重建、自动驾驶模型攻防两个方向。",
    "keywords": [
      "三维重建",
      "模型攻防",
      "安全评测"
    ],
    "papers": [
      {
        "id": "driving-3d-reconstruction",
        "tag": "3d-reconstruction",
        "title": "示例：Dynamic 3D Reconstruction for Driving Scenes",
        "source": "CVF / project page",
        "authors": [
          "Nora Wang",
          "Isaac Miller"
        ],
        "affiliations": [
          "Carnegie Mellon University",
          "Google DeepMind"
        ],
        "comment": "关注驾驶场景的动态三维重建，可用于地图更新、仿真生成和下游感知评测。",
        "visual": "visual-grid",
        "visualLabel": "3D scene",
        "body": "## 核心问题\n\n自动驾驶场景中的三维重建不仅要恢复静态道路结构，还要处理动态车辆、行人和光照变化。样例论文关注如何构建可复用的动态场景表示。\n\n## 方法速读\n\n- 融合多帧相机和激光雷达信息，估计静态结构与动态目标。\n- 使用显式运动分解降低动态物体带来的重建伪影。\n- 输出可渲染、可查询的场景表示，用于仿真和评测。\n\n## 组内关注点\n\n后续抓取时可以把 3DGS、NeRF、occupancy、HD map 更新都纳入同一方向，但需要区分是否真正面向驾驶场景。",
        "link": "papers/driving-3d-reconstruction/"
      },
      {
        "id": "ad-model-robustness",
        "tag": "autonomous-driving-security",
        "title": "示例：Adversarial Robustness of End-to-End Driving Models",
        "source": "arXiv / GitHub",
        "authors": [
          "Elena Garcia",
          "Hao Wu"
        ],
        "affiliations": [
          "University of Washington",
          "HKUST"
        ],
        "comment": "从感知扰动扩展到规划输出攻击，适合自动驾驶模型攻防方向的安全评测样例。",
        "visual": "visual-network",
        "visualLabel": "attack path",
        "body": "## 核心问题\n\n自动驾驶模型的安全风险不只来自感知误检，也可能来自端到端规划输出被诱导偏移。论文样例关注攻击如何跨越感知、预测和规划链路。\n\n## 方法速读\n\n- 构造视觉扰动和场景级扰动，观察规划轨迹变化。\n- 用闭环仿真评估攻击是否真正导致危险驾驶行为。\n- 比较数据增强、对抗训练和不确定性估计的防御效果。\n\n## 组内关注点\n\n抓取这类论文时需要区分“模型指标下降”和“驾驶风险上升”，优先保留有闭环安全指标的工作。",
        "link": "papers/ad-model-robustness/"
      }
    ],
    "notes": [
      {
        "user": "eval-owner",
        "time": "14:37",
        "text": "模型攻防方向建议优先保留带闭环安全指标的论文。"
      }
    ],
    "body": "这是第二期示例，用于验证历史目录、跨期搜索和 tag 筛选。",
    "bodyHtml": "<p>这是第二期示例，用于验证历史目录、跨期搜索和 tag 筛选。</p>",
    "tags": [
      {
        "id": "3d-reconstruction",
        "label": "三维重建",
        "color": "#8b5e83",
        "description": "关注自动驾驶场景的 3D/4D 重建、NeRF/Gaussian Splatting、占据和地图构建。",
        "priority": 2
      },
      {
        "id": "autonomous-driving-security",
        "label": "自动驾驶模型攻防",
        "color": "#9a5b42",
        "description": "关注感知、预测、规划和端到端驾驶模型的攻击、防御、鲁棒性和安全评测。",
        "priority": 2
      }
    ]
  }
];
