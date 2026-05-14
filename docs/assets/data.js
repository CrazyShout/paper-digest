window.PAPER_DIGESTS = [
  {
    "id": "2026-05-14",
    "date": "2026-05-14",
    "title": "从可归责测试到世界-动作闭环",
    "summary": "本期新增自动驾驶测试方向，并按八个长期方向扫描近期论文。主线是自动驾驶研究正在把协同、重建、世界模型和安全评测统一到闭环、可交互、可归责的证据链里。",
    "keywords": [
      "自动驾驶测试",
      "责任归因",
      "V2X 协同",
      "4DGS",
      "世界模型"
    ],
    "papers": [
      {
        "id": "cars-responsibility-testing",
        "tag": "autonomous-driving-testing",
        "tags": [
          "autonomous-driving-testing",
          "autonomous-driving-security"
        ],
        "title": "Learning Responsibility-Attributed Adversarial Scenarios for Testing Autonomous Vehicles",
        "source": "arXiv:2605.13751 / https://arxiv.org/abs/2605.13751",
        "authors": [
          "Yizhuo Xiao",
          "Haotian Yan",
          "Ying Wang",
          "Zhongpan Zhu",
          "Yuxin Zhang",
          "Xintao Yan",
          "Mustafa Suphi Erden",
          "Cheng Wang"
        ],
        "affiliations": [
          "作者单位见论文 PDF"
        ],
        "comment": "CARS 把自动驾驶测试从发现碰撞推进到责任归因：测试用例不仅要危险，还要能判断失败是否来自 ADS 可避免缺陷。",
        "body": "## 一句话定位\n\nCARS 是一篇自动驾驶测试和安全关键场景生成论文。它的核心新意是把 responsibility attribution 直接纳入 adversarial scenario generation，让闭环仿真生成的碰撞场景既物理可行，又能区分 ADS 可避免缺陷和不可避免交通冲突。\n\n## 论文要解决的问题\n\n很多 adversarial simulation 方法能高效找到碰撞，但碰撞本身不等于有用测试证据。如果对方车辆行为不合理，或者冲突本身不可避免，测试只能证明场景危险，不能证明 ADS 有可修复问题。CARS 的问题是：如何生成既能触发失败、又能按规范驾驶责任模型归因的测试场景，从而让 ADS validation 产生可解释、可监管对齐的安全证据。\n\n## 方法和系统设计\n\n- Context-aware adversary selection 根据场景上下文选择合适的对手交通参与者，避免无意义或不现实攻击。\n- Generative adversarial policy 在闭环仿真中优化，生成可导致碰撞的交互行为。\n- Responsibility attribution 与场景生成过程耦合，使用 regulation-prescribed careful and competent driver models 判断失败责任。\n\n## 关键图与可视化结果\n\n![图 1：CARS 的问题定义，区分普通碰撞发现和带责任归因的安全测试证据](https://arxiv.org/html/2605.13751v1/nc_images/problem.png)\n\n这张图清楚说明新增“自动驾驶测试”方向为什么必要：测试不是把系统撞坏就结束，而是要回答事故是否源于 ADS 可避免缺陷。\n\n![图 2：CARS 方法流程，展示上下文对手选择、生成式对抗策略和责任归因的耦合](https://arxiv.org/html/2605.13751v1/nc_images/methodology.png)\n\n这张图是论文最值得复用的框架：scenario generation、closed-loop simulation 和 responsibility model 不应是三段互不相干的后处理，而应共同定义测试目标。\n\n## 实验结论与证据\n\n论文在覆盖多种国家交通环境的 benchmark 数据集上评估，并报告 CARS 能持续发现 physically feasible collision scenarios，同时保持较高 attribution rates，并在多个 regulation-prescribed careful and competent driver models 下验证。证据主线是：自动驾驶测试应该从“发现碰撞”升级到“构造可解释、可归责、可监管对齐的失败证据”。\n\n## 应用场景与启发\n\n- 应用场景：ADS 仿真测试、安全关键场景生成、事故责任分析、闭环安全回归和监管证据包构建。\n- 方法启发：场景生成目标函数要同时包含 criticality、feasibility、behavioral realism 和 responsibility attribution。\n- 讨论问题：责任归因模型应采用交通法规、RSS/ISO 类模型、人类驾驶数据，还是多模型交叉一致性。\n\n## 局限与阅读风险\n\n责任归因高度依赖法规模型和场景抽象。不同国家、不同道路类型、不同 ADS ODD 下，careful and competent driver model 可能不一致。另一个风险是生成场景为了归责而变窄，遗漏不可归责但工程上仍危险的 corner cases。\n\n## 后续跟进\n\n- 详细记录论文使用的责任模型、数据集、仿真环境和 adversarial policy 训练细节。\n- 和 Dynasto、SaFeR、Drivora 对比，整理自动驾驶测试方向的四个维度：场景有效性、行为真实性、闭环可重复性和责任归因。\n- 将 CARS 作为新增测试方向的首篇核心报告，后续补充闭环协同 benchmark 和搜索式测试基础设施。",
        "link": "papers/cars-responsibility-testing/"
      },
      {
        "id": "caad-causality-aware-driving",
        "tag": "end-to-end-autonomous-driving",
        "title": "Causality-Aware End-to-End Autonomous Driving via Ego-Centric Joint Scene Modeling",
        "source": "arXiv:2605.13646 / https://arxiv.org/abs/2605.13646",
        "authors": [
          "Seokha Moon",
          "Minseung Lee",
          "Joon Seo",
          "Jinkyu Kim",
          "Jungbeom Lee"
        ],
        "affiliations": [
          "作者单位见论文 PDF"
        ],
        "comment": "CaAD 把端到端驾驶中的自车规划和周围交通参与者响应放进同一个因果场景建模框架，重点看交互场景下闭环规划是否更一致。",
        "tags": [
          "end-to-end-autonomous-driving"
        ],
        "body": "## 一句话定位\n\nCaAD 是一篇因果感知端到端自动驾驶论文。它认为现有 E2E 模型常把自车轨迹预测和周围 agent 行为预测处理成弱耦合问题，忽略“自车动作会改变别人、别人反应又会改变自车决策”的因果互依赖，因此在交互密集场景中容易输出不一致规划。\n\n## 论文要解决的问题\n\n端到端驾驶已经从传感器到轨迹的直接映射走向闭环 benchmark，但很多方法仍用边际预测或隐式特征融合处理交互。真实路口、并线和避让场景中，自车决策和周围 agent 的未来并不是独立变量。CaAD 的问题是：能否在 ego-centric shared latent scene representation 中显式学习自车与交互相关 agent 的 causal dependencies，并把这种因果结构对齐到闭环规划反馈。\n\n## 方法和系统设计\n\n- Ego-centric joint-causal modeling module 基于边际预测分支，学习自车和交互相关 agent 之间的因果依赖。\n- Causality-aware policy alignment 使用 joint-mode embeddings，将随机自车策略和来自交通、地图上下文的闭环反馈对齐。\n- 模型目标不是只提升开环轨迹误差，而是让规划在交互关键场景中更一致、更可闭环执行。\n\n## 关键图与可视化结果\n\n![图 1：CaAD 框架，展示 ego-centric joint scene modeling 和 causality-aware policy alignment](https://arxiv.org/html/2605.13646v1/x1.png)\n\n这张图展示了 CaAD 把因果依赖放在场景潜表示里的方式。值得关注的是它不是后处理规则，而是在策略学习阶段就让自车动作和周围 agent 反应共同进入表示。\n\n![图 2：CaAD 的交互建模和规划结果可视化](https://arxiv.org/html/2605.13646v1/x2.png)\n\n这张可视化结果用于检查论文主张是否落到交互场景：如果因果建模有效，收益应该集中在并线、路口、跟车和避让等 reciprocal interaction 明显的片段。\n\n## 实验结论与证据\n\n论文在 Bench2Drive 和 NAVSIM 上报告强闭环表现：Bench2Drive Driving Score 87.53、Success Rate 71.81，NAVSIM PDMS 91.1。证据重点是因果联合建模和 policy alignment 对闭环规划有贡献，而不只是开环 trajectory prediction 更准。\n\n## 应用场景与启发\n\n- 应用场景：端到端闭环驾驶、交互关键场景规划、Bench2Drive/NAVSIM 方法对比和多 agent 行为建模。\n- 方法启发：端到端模型需要把“自车动作改变场景”的反馈纳入训练目标，而不是只预测一个静态未来。\n- 讨论问题：因果依赖应该从数据中学，还是需要交通规则、责任模型和安全约束共同定义。\n\n## 局限与阅读风险\n\n因果命名容易高估模型解释性，详细阅读时需要确认因果模块是否有可验证干预实验，还是主要通过结构设计和 benchmark 指标间接证明。Bench2Drive/NAVSIM 成绩重要，但真实道路长尾、传感器异常和多车博弈仍需要进一步验证。\n\n## 后续跟进\n\n- 检查消融：joint-causal modeling、joint-mode embeddings 和 policy alignment 各自贡献多少。\n- 对照 VADv2 概率规划，比较多模态动作分布和因果交互建模是否互补。\n- 在组会中用 CaAD 作为端到端闭环规划方向的最新代表，重点讨论因果表征能否真正提高可解释安全性。",
        "link": "papers/caad-causality-aware-driving/"
      },
      {
        "id": "real2sim-physics-4dgs",
        "tag": "3d-reconstruction",
        "tags": [
          "3d-reconstruction",
          "autonomous-driving-testing"
        ],
        "title": "Real2Sim: A Physics-driven and Editable Gaussian Splatting Framework for Autonomous Driving Scenes",
        "source": "arXiv:2605.13591 / https://arxiv.org/abs/2605.13591",
        "authors": [
          "Kaicong Huang",
          "Talha Azfar",
          "Weisong Shi",
          "Ruimin Ke"
        ],
        "affiliations": [
          "作者单位见论文 PDF"
        ],
        "comment": "Real2Sim 把 4D Gaussian Splatting 和可微 MPM 物理求解结合，目标是让驾驶场景重建不仅可看，还能编辑、碰撞和生成可用于下游测试的 corner cases。",
        "body": "## 一句话定位\n\nReal2Sim 是一篇自动驾驶场景 4D 重建与仿真生成论文。它把动态场景重建成时间连续 Gaussian primitives，并接入 differentiable Material Point Method，让重建资产支持 instance-level editing、物体交互和碰撞后的轨迹模拟。\n\n## 论文要解决的问题\n\n驾驶场景重建和生成最近进展很快，但很多方法仍主要优化视觉真实感，缺少时间一致性、空间一致性和物理可交互性。对自动驾驶来说，仅能渲染好看的视频不够，场景还要能编辑、能制造安全关键事件、能服务 perception、tracking、trajectory prediction 和 policy learning。Real2Sim 的问题是：如何把真实数据重建成可编辑、物理驱动的仿真资产，缩小传统仿真和真实数据之间的 reality gap。\n\n## 方法和系统设计\n\n- 用 4D Gaussian Splatting 重建动态驾驶场景，把车辆、行人等动态实体表示为时间连续高斯基元。\n- 通过 instance-level editing 改变物体位置、动作或交互关系，使真实场景能生成新场景变体。\n- 引入 differentiable MPM solver 模拟 object-object 和 object-environment interaction，重点支持碰撞、接触和 post-impact trajectory。\n\n## 关键图与可视化结果\n\n![图 1：Real2Sim 总体框架，展示从真实驾驶数据到 4DGS 重建、编辑和物理仿真的流程](https://arxiv.org/html/2605.13591v1/x1.png)\n\n这张图说明 Real2Sim 的目标不是单纯重建，而是把重建结果转成可用于生成和测试的仿真接口。对组内研究来说，它把三维重建、场景编辑和自动驾驶测试连接成一条链。\n\n![图 2：Real2Sim 的编辑与物理交互可视化结果](https://arxiv.org/html/2605.13591v1/x2.png)\n\n这张图支撑论文对 physics-aware synthesis 的主张。需要关注的是编辑后的场景是否同时保持视觉真实、几何一致和物理合理，而不是只看单帧渲染质量。\n\n## 实验结论与证据\n\n论文在 Waymo Open Dataset 上验证 rendering、reconstruction、editing 和 physics simulation 能力，并强调生成场景可服务下游 perception、tracking、trajectory prediction 和 end-to-end policy learning。证据重点是 4DGS 重建不再停留在视觉结果，而是能支持碰撞和碰后轨迹这类 safety-critical scenario synthesis。\n\n## 应用场景与启发\n\n- 应用场景：驾驶仿真资产生成、corner case 扩增、碰撞场景编辑、感知与预测模型数据增强和端到端策略学习。\n- 方法启发：3D/4D 重建如果要进入自动驾驶闭环，必须提供可编辑对象、物理交互和可重复评测接口。\n- 讨论问题：物理驱动生成的场景如何验证“真实合理”，是依赖物理约束、真实轨迹分布，还是下游模型失效模式。\n\n## 局限与阅读风险\n\n4DGS 与 MPM 的结合会引入计算成本、材质参数估计和物体交互建模假设。Waymo 数据上的结果说明可行性，但真实事故、非刚体对象、复杂天气和传感器退化仍需要更细验证。另一个风险是生成的 corner case 可能物理可行但统计上过于罕见，需要和测试责任归因方法配合。\n\n## 后续跟进\n\n- 检查代码、资产导出格式和 Waymo 数据处理流程是否开放。\n- 复现时不要只看 PSNR/视觉质量，要加入几何一致性、物理合理性和下游检测/预测变化。\n- 和 CARS、Dynasto 等测试论文连接，评估 Real2Sim 生成场景是否能成为可归责 ADS 测试用例。",
        "link": "papers/real2sim-physics-4dgs/"
      },
      {
        "id": "dawn-world-action-model",
        "tag": "world-models",
        "tags": [
          "world-models",
          "end-to-end-autonomous-driving"
        ],
        "title": "The DAWN of World-Action Interactive Models",
        "source": "arXiv:2605.11550 / https://arxiv.org/abs/2605.11550",
        "authors": [
          "Hongbo Lu",
          "Liang Yao",
          "Chenghao He",
          "Haoyu Wang",
          "Xiang Gu",
          "Xianfei Li",
          "Wenlong Liao",
          "Tao He",
          "Pai Peng"
        ],
        "affiliations": [
          "作者单位见论文 PDF"
        ],
        "comment": "DAWN 把驾驶世界模型从单向预测推进到 world-action 交互生成：世界假设条件动作，动作假设再反过来更新世界预测。",
        "body": "## 一句话定位\n\nDAWN 是一篇驾驶 World-Action Interactive Model 论文。它把世界演化和动作生成看成互相制约的过程，而不是先预测世界、再独立规划动作，核心是用 latent generative baseline 递归细化 world hypothesis 和 action hypothesis。\n\n## 论文要解决的问题\n\n驾驶世界模型常见两类缺口：一类只生成未来场景，看起来真实但未必能指导规划；另一类把动作生成和世界预测做成并行分支或 rigid predict-then-plan pipeline，缺少双向反馈。真实驾驶里，某个机动动作会改变场景未来，而可行机动又取决于场景未来。DAWN 的问题是：如何让 world prediction 和 action denoising 在推理时相互条件化，从而生成更可行动的未来和轨迹。\n\n## 方法和系统设计\n\n- DAWN 在紧凑语义 latent space 中工作，避免在像素空间做长时域全量 rollout。\n- World Predictor 预测未来世界假设，并把这个假设作为 World-Conditioned Action Denoiser 的条件。\n- Denoised action hypothesis 再反馈给世界预测器，推理阶段递归细化世界和动作，实现短显式 latent rollout 支撑长时域轨迹生成。\n\n## 关键图与可视化结果\n\n![图 1：DAWN 的 World-Action Interactive Model 框架，展示世界预测和动作去噪的递归耦合](https://arxiv.org/html/2605.11550v1/x1.png)\n\n这张图说明 DAWN 的新意在耦合方式：世界模型不是 planner 的旁路解释器，而是直接参与动作生成；动作也不是世界预测后的静态输出，而会反向修正世界假设。\n\n![图 2：DAWN 的规划和世界-动作交互可视化结果](https://arxiv.org/html/2605.11550v1/x2.png)\n\n这张图适合检查 DAWN 是否真正服务规划。阅读时不要只看生成结果自然不自然，还要看世界假设变化是否和动作选择存在一致关系。\n\n## 实验结论与证据\n\n摘要报告 DAWN 在多个自动驾驶 benchmark 上取得强规划表现和较好的 safety-related results。证据主线是 interactive world-action generation 比孤立世界预测或 rigid pipeline 更适合复杂交互场景。由于摘要未给出具体数据，详细阅读应重点核对 benchmark 名称、闭环指标、消融设置和 safety-related 指标定义。\n\n## 应用场景与启发\n\n- 应用场景：驾驶世界模型、长时域规划、动作条件未来生成、闭环 planner evaluator 和端到端策略学习。\n- 方法启发：世界模型的下一步不是更长视频，而是更可被动作查询、更能反作用于规划的 latent rollout。\n- 讨论问题：world-action 交互应在 latent space 中完成，还是需要显式几何、交通规则和风险约束参与。\n\n## 局限与阅读风险\n\n论文主张依赖 benchmark 和安全指标是否足够覆盖真实交互风险。Latent world hypothesis 可行动，但可解释性和物理一致性未必天然成立。若缺少真实闭环仿真或长尾场景验证，DAWN 更适合作为方法方向信号，而不是工程可部署结论。\n\n## 后续跟进\n\n- 检查论文是否发布代码、模型和 benchmark 配置。\n- 对照 Vista、DriveFuture、WorldLens 等工作，把“生成质量”“规划收益”“闭环安全”分开记录。\n- 尝试把 DAWN 和 CaAD 一起读：一个强调世界-动作递归，一个强调 ego-agent 因果依赖，二者可能是端到端驾驶闭环建模的两条互补线。",
        "link": "papers/dawn-world-action-model/"
      },
      {
        "id": "view-induced-trajectory-manipulation",
        "tag": "autonomous-driving-security",
        "tags": [
          "autonomous-driving-security",
          "autonomous-driving-testing"
        ],
        "title": "Still Camouflage, Moving Illusion: View-Induced Trajectory Manipulation in Autonomous Driving",
        "source": "arXiv:2605.12743 / https://arxiv.org/abs/2605.12743",
        "authors": [
          "Shuo Ju",
          "Qingzhao Zhang",
          "Huashan Chen",
          "Xuheng Wang",
          "Haotang Li",
          "Wanqian Zhang",
          "Feng Liu",
          "Kebin Peng",
          "Sen He"
        ],
        "affiliations": [
          "作者单位见论文 PDF"
        ],
        "comment": "这篇论文把视角变化从物理攻击的难点变成攻击机制本身，展示静态伪装如何诱导轨迹漂移并触发下游急刹。",
        "body": "## 一句话定位\n\nStill Camouflage, Moving Illusion 是一篇面向视觉自动驾驶链路的物理对抗攻击论文。它的关键新意是：不再努力让 adversarial patch 在多视角下保持同一错误，而是利用车辆相对运动带来的视角变化，让静态伪装自然产生随时间演化的特征漂移，进而误导轨迹推断。\n\n## 论文要解决的问题\n\n已有物理攻击常把视角变化当作鲁棒优化挑战，需要复杂多视角 patch 或主动变化装置。自动驾驶系统真正关心的不是单帧检测是否错，而是多帧跟踪、轨迹预测和决策是否被持续误导。论文的问题是：一个静态、被动、看似普通的伪装物，能否在正常相对运动中制造“物理合理但错误”的轨迹，例如虚假 cut-in，并传导到规划层触发不必要急刹。\n\n## 方法和系统设计\n\n- 攻击对象是视觉自动驾驶中的多帧感知与轨迹推断链路，而不是单帧分类。\n- 静态 adversarial camouflage 安装在车辆上，利用视角变化让外观随相对运动自然变化。\n- 这种 view-induced feature drift 会让系统推断错误轨迹，进而影响 downstream decision-making，例如在通过停放车辆时触发 hard braking。\n\n## 关键图与可视化结果\n\n![图 1：视角诱导轨迹操纵的攻击场景，展示静态伪装如何随相对运动产生误导](https://arxiv.org/html/2605.12743v1/fig/attack-scenario-1.png)\n\n这张图直接说明论文的攻击面：威胁不是孤立图片上的误检，而是伪装车辆和受害车辆之间的相对运动。它适合作为自动驾驶攻防讨论里的“时间维物理攻击”案例。\n\n![图 2：攻击流程，展示从伪装设计到轨迹误导和下游急刹事件的传播链路](https://arxiv.org/html/2605.12743v1/fig/pipeline.png)\n\n这张流程图支撑论文的系统性主张。读者应重点检查攻击是否真的穿过 detection/tracking/prediction/planning 链路，而不是只在某个中间模块上制造局部误差。\n\n## 实验结论与证据\n\n论文在 nuScenes 上展示攻击效果，摘要报告以 hard-braking event 计量的端到端成功率最高达到 87.5%，并在不同场景背景、受害车速度和感知模型上做鲁棒性验证。证据重点是静态伪装可以诱导看似物理合理的错误轨迹，并影响最终驾驶行为。\n\n## 应用场景与启发\n\n- 应用场景：自动驾驶物理攻击评测、多帧感知鲁棒性测试、轨迹预测安全验证和端到端急刹回归测试。\n- 方法启发：鲁棒性不能只看单帧检测框；视角变化、时间一致性和下游规划响应必须一起评估。\n- 讨论问题：防御应该针对伪装纹理、轨迹一致性、物体运动学约束，还是针对规划层对异常轨迹的风险响应。\n\n## 局限与阅读风险\n\nnuScenes 离线验证能说明攻击链路，但真实道路物理可实施性、材质可制造性、法规可见性、天气光照和多传感器冗余仍需要实车或高保真仿真确认。硬刹成功率是重要安全信号，但还需要看误报代价和防御后的正常驾驶性能。\n\n## 后续跟进\n\n- 检查攻击对不同 perception stack、tracking smoothing 和 prediction horizon 的敏感性。\n- 复现时加入 LiDAR/radar fusion，观察多模态系统是否能削弱 view-induced feature drift。\n- 和测试方向的责任归因结合，判断攻击引发的急刹是否能被归类为 ADS 可避免缺陷。",
        "link": "papers/view-induced-trajectory-manipulation/"
      },
      {
        "id": "swarmdrive-v2v-coordination",
        "tag": "cooperative-autonomous-driving",
        "title": "SwarmDrive: Semantic V2V Coordination for Latency-Constrained Cooperative Autonomous Driving",
        "source": "arXiv:2604.22852 / https://arxiv.org/abs/2604.22852",
        "authors": [
          "Anjie Qiu",
          "Donglin Wang",
          "Zexin Fang",
          "Sanket Partani",
          "Hans D. Schotten"
        ],
        "affiliations": [
          "作者单位见论文 PDF"
        ],
        "comment": "SwarmDrive 把协同自动驾驶的共享对象从大特征图转成不确定性触发的语义意图分布，关注 V2V 协同在遮挡路口和低延迟约束下是否真正改变决策。",
        "tags": [
          "cooperative-autonomous-driving"
        ],
        "body": "## 一句话定位\n\nSwarmDrive 是一篇面向低时延协同驾驶的 V2V 语义协调论文。它不把云端大模型当成默认推理中心，而是让邻近车辆在本地运行小语言模型，只在不确定性高时共享紧凑意图分布，并用事件触发共识来降低延迟和通信负担。\n\n## 论文要解决的问题\n\n协同自动驾驶的关键矛盾正在从“能不能共享更多传感器信息”转向“什么信息值得在有限时延内共享”。云端 LLM 推理有往返通信延迟和连接稳定性问题，单车本地模型又容易在遮挡路口缺少视野。SwarmDrive 的切入点是：在遮挡导致单车意图判断不可靠时，能否用 V2V 语义信息补齐局部视角，同时避免持续广播带来的带宽和丢包问题。\n\n## 方法和系统设计\n\n- 每辆车本地运行 Small Language Model，输出场景理解和意图分布，而不是依赖云端闭环推理。\n- 系统用熵阈值判断是否触发协同，只有不确定性较高时才向邻车共享意图分布。\n- 多车意图通过事件触发共识融合，目标是在遮挡交互中提升成功率，同时把端到端延迟控制在车端可用范围内。\n\n## 关键图与可视化结果\n\n![图 1：SwarmDrive 的语义 V2V 协同流程，展示本地 SLM、意图分布共享和事件触发共识](https://arxiv.org/html/2604.22852v1/x1.png)\n\n这张图说明论文的核心不是把更多原始感知发给其他车辆，而是把通信接口压缩成决策相关的语义意图。它适合用来讨论协同驾驶中“共享表征”从 feature map 向 intent distribution 的转移。\n\n![图 2：遮挡路口场景和不同通信设置下的协同效果对比](https://arxiv.org/html/2604.22852v1/x2.png)\n\n这张结果图支撑了论文的主要应用场景：遮挡路口里，单车模型视野不足，邻车意图能改变通行决策。但它也提醒读者，实验仍集中在一个可执行遮挡场景，不等于真实 6G 车联网部署已经验证。\n\n## 实验结论与证据\n\n论文在一个遮挡路口案例上做 5-seed executable study，并报告 Swarm 6G 设置把成功率从单车本地 SLM 的 68.9% 提升到 94.1%，同时把云端参考延迟 510 ms 降到 151.4 ms。它还做了 swarm size、packet loss 和 entropy threshold 的鲁棒性扫描，当前原型中约 4 辆活跃协同车、0.65 熵阈值是较平衡的配置。证据重点是低延迟语义协同在目标场景中可行，但外推到复杂路网前还需要更多交互类型和真实通信栈验证。\n\n## 应用场景与启发\n\n- 应用场景：低带宽 V2V 协同、遮挡路口通行、车端小模型协同推理和通信触发策略设计。\n- 方法启发：协同信息不一定是密集特征或点云，意图分布可以成为更轻量、面向规划的共享接口。\n- 讨论问题：如果加入路侧单元、轨迹预测器或世界模型，熵触发策略应该由谁来定义，通信预算又应该和安全风险如何绑定。\n\n## 局限与阅读风险\n\n论文的实验规模较小，主要支撑 targeted intersection case 下的可行性，而不是通用协同驾驶能力。SLM 的语义输出稳定性、意图分布校准、丢包下的安全退化和多车数量增长后的通信拥塞都需要独立评估。\n\n## 后续跟进\n\n- 检查论文代码或仿真配置是否开放，优先复现实验中的遮挡路口。\n- 对比持续广播、Top-K feature sharing、reference point sharing 和 entropy-triggered intent sharing 的通信-安全曲线。\n- 跟进 V2V 语义协同是否能和闭环测试 benchmark 结合，形成可重复的协同驾驶评测协议。",
        "link": "papers/swarmdrive-v2v-coordination/"
      },
      {
        "id": "urbanv2x-cooperative-navigation",
        "tag": "vehicle-road-cooperation",
        "tags": [
          "vehicle-road-cooperation",
          "cooperative-autonomous-driving"
        ],
        "title": "UrbanV2X: A Multisensory Vehicle-Infrastructure Dataset for Cooperative Navigation in Urban Areas",
        "source": "IEEE ITSC 2025 / arXiv:2512.20224 / https://arxiv.org/abs/2512.20224 / https://polyu-taslab.github.io/UrbanV2X/",
        "authors": [
          "Qijun Qin",
          "Ziqi Zhang",
          "Yihan Zhong",
          "Feng Huang",
          "Xikun Liu",
          "Runzhi Hu",
          "Hang Chen",
          "Wei Hu",
          "Dongzhe Su",
          "Jun Zhang",
          "Hoi-Fung Ng",
          "Weisong Wen"
        ],
        "affiliations": [
          "The Hong Kong Polytechnic University and collaborators"
        ],
        "comment": "UrbanV2X 提供香港 C-V2X 测试场里的车端和路侧多传感器数据，价值在于把车路协同导航从仿真或单模态感知推进到真实城市数据资产。",
        "body": "## 一句话定位\n\nUrbanV2X 是一个面向城市车路协同导航的多传感器数据集。它的核心新意不是提出一个新网络，而是提供车端和路侧同步采集的 camera、LiDAR、4D radar、UWB、IMU、GNSS-RTK/INS 等数据，用真实 Hong Kong C-V2X testbed 支撑协同导航研究。\n\n## 论文要解决的问题\n\n车路协同研究长期缺少真实、多模态、可标定、可同步的数据。很多方法在仿真或单车数据集上验证，难以评估路侧基础设施在定位、感知覆盖和导航鲁棒性上的真实贡献。UrbanV2X 的问题定义是：如何构建一个覆盖车端与路侧传感器、包含时间同步和标定信息、并能支持 cooperative navigation benchmark 的城市数据资产。\n\n## 方法和系统设计\n\n- 车端平台包含多工业相机、LiDAR、4D radar、UWB、IMU 和高精度 GNSS-RTK/INS。\n- 路侧基础设施提供 LiDAR、GNSS 和 UWB 测量，并和车端通过 Precision Time Protocol 做同步。\n- 数据集提供传感器标定和导航算法 benchmark，降低后续研究从数据清洗到评估协议的启动成本。\n\n## 关键图与可视化结果\n\n![图 1：UrbanV2X 数据集总体概览，展示车辆、路侧基础设施和协同导航数据流](https://arxiv.org/html/2512.20224v1/pic/Overview.png)\n\n这张图说明 UrbanV2X 的价值在“系统形态”而非单一算法。它把车端感知、路侧基础设施和通信同步放在同一数据框架里，适合作为车路协同研究的数据入口。\n\n![图 2：UrbanV2X 车端与路侧传感器系统架构](https://arxiv.org/html/2512.20224v1/pic/sys_architecture.png)\n\n这张图帮助读者检查数据集是否足以支撑自己的任务：如果研究关注定位、同步误差、UWB 辅助或路侧 LiDAR 视角，这里的传感器组合比普通单车数据集更匹配。\n\n## 实验结论与证据\n\n论文报告数据来自香港 C-V2X testbed，并提供同步、标定和多类传感器数据，还 benchmark 多种导航算法。证据价值在于真实设备、真实城市环境和公开数据，而不是某个单一模型指标。对车路协同方向，它可以支撑基础设施辅助定位、V2I 感知覆盖、UWB/GNSS 融合和多传感器协同导航等后续实验。\n\n## 应用场景与启发\n\n- 应用场景：车路协同导航、路侧辅助定位、V2I 数据融合、城市 C-V2X 测试场评估和多传感器标定流程。\n- 方法启发：车路协同 benchmark 需要把时间同步、标定、坐标系转换和通信假设显式写进协议。\n- 讨论问题：如果只用车端数据能达到接近表现，路侧基础设施的增益应该用遮挡、长尾和定位退化场景来重新定义。\n\n## 局限与阅读风险\n\n数据集论文的直接贡献是数据资产和 benchmark，不等同于证明某个协同算法已经达到部署级效果。需要继续检查场景规模、路线多样性、天气/光照覆盖、标注粒度和数据许可。若后续研究只在 UrbanV2X 上做离线融合，还要额外补闭环导航或安全收益评估。\n\n## 后续跟进\n\n- 下载项目页数据样例，确认传感器时间戳、标定文件和 benchmark 代码格式。\n- 选取一个最小任务做基线复现：GNSS/UWB 融合定位或路侧 LiDAR 辅助导航。\n- 和 DAIR-V2X、V2X-Seq 等数据集对比，整理各自适合的协同感知、预测和导航任务。",
        "link": "papers/urbanv2x-cooperative-navigation/"
      },
      {
        "id": "copad-v2x-trajectory-prediction",
        "tag": "cooperative-trajectory-prediction",
        "tags": [
          "cooperative-trajectory-prediction",
          "vehicle-road-cooperation",
          "cooperative-autonomous-driving"
        ],
        "title": "CoPAD: Multi-source Trajectory Fusion and Cooperative Trajectory Prediction with Anchor-oriented Decoder in V2X Scenarios",
        "source": "IROS 2025 / arXiv:2509.15984 / https://arxiv.org/abs/2509.15984",
        "authors": [
          "Kangyu Wu",
          "Jiaqi Qiao",
          "Ya Zhang"
        ],
        "affiliations": [
          "作者单位见论文 PDF"
        ],
        "comment": "CoPAD 是近期协同轨迹预测里较直接的一篇 V2X 工作，用多源轨迹融合、历史交互注意力和 anchor-oriented decoder 处理单车感知轨迹不稳定的问题。",
        "body": "## 一句话定位\n\nCoPAD 是一篇 V2X 场景下的协同轨迹预测论文。它把车端和路侧的多源历史轨迹先做轻量融合，再用时间注意力和稀疏 anchor 解码未来轨迹，核心价值在于把协同信息从“补感知范围”推进到“稳定预测输入”。\n\n## 论文要解决的问题\n\n轨迹预测通常假设历史轨迹可靠，但单车感知在遮挡、远距离、小目标和传感器噪声下会产生断裂、漂移和漏检。V2X 可以提供更多视角，但多源轨迹存在重复、时序不齐和质量差异。CoPAD 的问题是：如何在不引入过重通信和模型复杂度的前提下，把车端与路侧轨迹融合成更完整的历史上下文，并让预测器利用交互信息输出多模态未来。\n\n## 方法和系统设计\n\n- 多源轨迹融合模块用 Hungarian matching 和 Kalman filtering 对车端、路侧轨迹进行早期融合，降低重复和断裂。\n- Past Time Attention 模块建模历史轨迹之间的潜在交互，补充单点或单帧协同感知无法表达的时序依赖。\n- Mode attention 和 anchor-oriented decoder 用稀疏 anchors 生成多样化未来轨迹，避免只输出单一平均轨迹。\n\n## 关键图与可视化结果\n\n![图 1：CoPAD 总体框架，包含多源轨迹融合、历史时间注意力、模式注意力和 anchor-oriented decoder](https://arxiv.org/html/2509.15984v1/1.png)\n\n这张图展示了 CoPAD 的信息流：协同不发生在最终预测结果之后，而是从历史轨迹质量控制开始。对组内复现来说，最值得关注的是融合模块和预测模块是否可以拆开评估。\n\n![图 2：CoPAD 在 V2X 场景中的多源轨迹输入与预测输出示意](https://arxiv.org/html/2509.15984v1/2.png)\n\n这张图支撑论文对“多源轨迹更完整”的主张。它能帮助读者检查模型收益到底来自 V2X 视野补全，还是来自 decoder 对多模态轨迹的更好表达。\n\n## 实验结论与证据\n\n论文在 DAIR-V2X-Seq 数据集上评估，并声称 CoPAD 达到 state-of-the-art cooperative trajectory prediction 表现。摘要给出的证据链主要是融合模块提升历史轨迹完整性，PTA 捕捉历史交互，anchor decoder 提升多样性。详细阅读时应重点核对每个模块的消融，以及不同遮挡、距离和路侧参与程度下的收益是否一致。\n\n## 应用场景与启发\n\n- 应用场景：车路协同轨迹预测、路口遮挡目标预测、V2X planner 输入预处理和轨迹数据质量增强。\n- 方法启发：协同预测的第一步可能不是换更大的预测网络，而是把多源历史轨迹融合做稳。\n- 讨论问题：当 V2X 轨迹融合出错时，预测器应该显式建模不确定性，还是把错误交给后续 planner 吸收。\n\n## 局限与阅读风险\n\nCoPAD 主要围绕 DAIR-V2X-Seq 展开，能否迁移到更复杂城市路网、异构传感器配置和通信延迟条件仍需验证。早期融合依赖匹配和滤波质量，一旦多源轨迹 ID association 错误，后续预测可能会放大错误。\n\n## 后续跟进\n\n- 优先检查 DAIR-V2X-Seq 上的评估协议、消融表和公开代码状态。\n- 复现时单独记录 fusion-only、PTA-only、mode attention 和 anchor decoder 的贡献。\n- 和 Co-MTP 对照：一个偏多源轨迹质量控制，一个偏多时间 V2X 融合，适合组成协同预测 baseline 组合。",
        "link": "papers/copad-v2x-trajectory-prediction/"
      }
    ],
    "notes": [
      {
        "user": "paper-lead",
        "time": "09:10",
        "text": "新增自动驾驶测试方向后，建议把 CARS、Real2Sim 和攻击论文一起看：测试用例需要危险、真实、可归责，也要能落到闭环系统。"
      },
      {
        "user": "reading-owner",
        "time": "09:30",
        "text": "世界模型和端到端驾驶方向今天重点看闭环反馈：DAWN 处理世界-动作互相条件化，CaAD 处理自车和周围 agent 的因果依赖。"
      }
    ],
    "body": "## 本期判断\n\n本期新增“自动驾驶测试”作为长期方向，因为近期论文的共同趋势已经不只是提出更强模型，而是追问模型失败能否被系统性构造、复现和归责。CARS 把测试目标从“找到碰撞”推进到“生成可归责安全证据”；Real2Sim 把 4DGS 重建推进到可编辑、可碰撞的场景生成；Still Camouflage 则提醒攻击可以沿多帧感知、轨迹预测和规划链路传播。与此同时，CaAD 和 DAWN 分别从因果交互和 world-action 递归建模推动端到端驾驶闭环化，SwarmDrive、UrbanV2X 与 CoPAD 则继续把 V2X 协同从感知共享推进到意图、导航和预测任务。\n\n## 筛选口径\n\n- 本期按八个配置方向扫描近期论文；单篇论文如果横跨多个方向，会在多个 tag 分区下出现，但详细报告只维护一份。\n- 优先保留能形成闭环证据链的论文：可归责测试、闭环规划、物理可编辑场景、真实车路协同数据、V2X 预测和多帧攻击传播。\n- 降权只展示视觉生成质量、只做单帧感知指标、或没有说明下游规划/安全收益的论文。\n- 对应报告均写入 arXiv 或项目页来源；有官方 arXiv HTML 图片的论文优先放入方法图、场景图或系统图，并在正文说明图片支撑的结论。\n\n## 方向扫描\n\n- 自动驾驶测试：最新热点是把 safety-critical scenario generation 从碰撞发现升级到 feasibility、behavioral realism 和 responsibility attribution。CARS 是今天最该读的代表；Dynasto、SaFeR、Drivora 可作为后续补充，分别偏有效失败发现、可行性约束和搜索式测试基础设施。\n- 端到端自动驾驶：CaAD、Action Emergence、MindVLA-U1、DIAL 等新论文集中在闭环能力、意图条件动作和 VLA 统一架构。今天入选 CaAD，因为它给出 Bench2Drive/NAVSIM 闭环数字，并把 ego-agent 交互作为核心问题。\n- 三维重建：Real2Sim、PointForward、Ground4D、CARD 说明驾驶 3D/4D 研究正在从重建质量转向仿真可用性、feedforward 速度、复杂地形和场景编辑。今天入选 Real2Sim，并同时标到自动驾驶测试，因为它把 4DGS 和物理求解连接到 corner case 生成。\n- 世界模型：DAWN、DeepSight、CoWorld-VLA、DriveFuture、WorldLens 同时出现，说明方向正在分化为可规划世界模型、VLA 中间表征和评测基准。今天入选 DAWN，因为它直接建模世界假设和动作假设的双向递归。\n- 自动驾驶模型攻防：最新进展从静态 patch 或单帧误检转向多帧轨迹操纵、MLLM transfer attack、RGB-T 物理攻击和极端天气 benchmark。今天入选 Still Camouflage，并同时标到自动驾驶测试，因为它把视角变化变成时间维攻击工具，并报告最高 87.5% hard-braking 成功率。\n- 协同自动驾驶：SwarmDrive、MDrive、混合交通 potential game 等工作说明协同不再只拼通信带宽，而是进入语义意图、闭环 multi-agent benchmark 和真实混合交通验证。今天入选 SwarmDrive，作为低时延 V2V 语义协同样本。\n- 车路协同：UrbanV2X、VRS、Infrastructure-Centric World Models 和 IMPACT 分别补数据集、路侧数据合成、路侧世界模型和混合数字孪生测试。今天入选 UrbanV2X，因为真实 C-V2X 多传感器数据对后续协同导航和定位任务最基础。\n- 协同轨迹预测：近期专门命中 V2X cooperative trajectory prediction 的论文少于世界模型和测试方向，CoPAD 是较直接的新样本；Co-MTP 仍是多时间融合的重要对照。今天入选 CoPAD，作为多源轨迹融合和 anchor 解码的轻量基线。\n\n## 应用场景与讨论线索\n\n- 测试证据链：CARS、Real2Sim 和 Still Camouflage 可以组成一条讨论线。CARS 负责“失败是否可归责”，Real2Sim 负责“场景能否物理编辑和复现”，Still Camouflage 负责“攻击如何穿过多帧链路影响驾驶行为”。\n- 闭环建模：CaAD 与 DAWN 可以一起读。前者强调自车与周围 agent 的因果互依赖，后者强调世界预测和动作生成的递归耦合，都在回答 E2E 驾驶如何从开环轨迹拟合走向可行动推理。\n- 协同数据和通信：SwarmDrive、UrbanV2X、CoPAD 对应语义通信、真实车路数据和协同预测三层问题。组会可以讨论 V2X 的增益到底来自信息更多、视角更稳，还是评测协议更接近真实遮挡与交互。\n- 本期最值得先读 CARS，其次读 Real2Sim 和 CaAD。CARS 决定新增测试方向的评价口径；Real2Sim 连接场景生成和下游测试；CaAD 代表端到端闭环规划的最新建模趋势。",
    "bodyHtml": "<h2>本期判断</h2>\n<p>本期新增“自动驾驶测试”作为长期方向，因为近期论文的共同趋势已经不只是提出更强模型，而是追问模型失败能否被系统性构造、复现和归责。CARS 把测试目标从“找到碰撞”推进到“生成可归责安全证据”；Real2Sim 把 4DGS 重建推进到可编辑、可碰撞的场景生成；Still Camouflage 则提醒攻击可以沿多帧感知、轨迹预测和规划链路传播。与此同时，CaAD 和 DAWN 分别从因果交互和 world-action 递归建模推动端到端驾驶闭环化，SwarmDrive、UrbanV2X 与 CoPAD 则继续把 V2X 协同从感知共享推进到意图、导航和预测任务。</p>\n<h2>筛选口径</h2>\n<ul><li>本期按八个配置方向扫描近期论文；单篇论文如果横跨多个方向，会在多个 tag 分区下出现，但详细报告只维护一份。</li><li>优先保留能形成闭环证据链的论文：可归责测试、闭环规划、物理可编辑场景、真实车路协同数据、V2X 预测和多帧攻击传播。</li><li>降权只展示视觉生成质量、只做单帧感知指标、或没有说明下游规划/安全收益的论文。</li><li>对应报告均写入 arXiv 或项目页来源；有官方 arXiv HTML 图片的论文优先放入方法图、场景图或系统图，并在正文说明图片支撑的结论。</li></ul>\n<h2>方向扫描</h2>\n<ul><li>自动驾驶测试：最新热点是把 safety-critical scenario generation 从碰撞发现升级到 feasibility、behavioral realism 和 responsibility attribution。CARS 是今天最该读的代表；Dynasto、SaFeR、Drivora 可作为后续补充，分别偏有效失败发现、可行性约束和搜索式测试基础设施。</li><li>端到端自动驾驶：CaAD、Action Emergence、MindVLA-U1、DIAL 等新论文集中在闭环能力、意图条件动作和 VLA 统一架构。今天入选 CaAD，因为它给出 Bench2Drive/NAVSIM 闭环数字，并把 ego-agent 交互作为核心问题。</li><li>三维重建：Real2Sim、PointForward、Ground4D、CARD 说明驾驶 3D/4D 研究正在从重建质量转向仿真可用性、feedforward 速度、复杂地形和场景编辑。今天入选 Real2Sim，并同时标到自动驾驶测试，因为它把 4DGS 和物理求解连接到 corner case 生成。</li><li>世界模型：DAWN、DeepSight、CoWorld-VLA、DriveFuture、WorldLens 同时出现，说明方向正在分化为可规划世界模型、VLA 中间表征和评测基准。今天入选 DAWN，因为它直接建模世界假设和动作假设的双向递归。</li><li>自动驾驶模型攻防：最新进展从静态 patch 或单帧误检转向多帧轨迹操纵、MLLM transfer attack、RGB-T 物理攻击和极端天气 benchmark。今天入选 Still Camouflage，并同时标到自动驾驶测试，因为它把视角变化变成时间维攻击工具，并报告最高 87.5% hard-braking 成功率。</li><li>协同自动驾驶：SwarmDrive、MDrive、混合交通 potential game 等工作说明协同不再只拼通信带宽，而是进入语义意图、闭环 multi-agent benchmark 和真实混合交通验证。今天入选 SwarmDrive，作为低时延 V2V 语义协同样本。</li><li>车路协同：UrbanV2X、VRS、Infrastructure-Centric World Models 和 IMPACT 分别补数据集、路侧数据合成、路侧世界模型和混合数字孪生测试。今天入选 UrbanV2X，因为真实 C-V2X 多传感器数据对后续协同导航和定位任务最基础。</li><li>协同轨迹预测：近期专门命中 V2X cooperative trajectory prediction 的论文少于世界模型和测试方向，CoPAD 是较直接的新样本；Co-MTP 仍是多时间融合的重要对照。今天入选 CoPAD，作为多源轨迹融合和 anchor 解码的轻量基线。</li></ul>\n<h2>应用场景与讨论线索</h2>\n<ul><li>测试证据链：CARS、Real2Sim 和 Still Camouflage 可以组成一条讨论线。CARS 负责“失败是否可归责”，Real2Sim 负责“场景能否物理编辑和复现”，Still Camouflage 负责“攻击如何穿过多帧链路影响驾驶行为”。</li><li>闭环建模：CaAD 与 DAWN 可以一起读。前者强调自车与周围 agent 的因果互依赖，后者强调世界预测和动作生成的递归耦合，都在回答 E2E 驾驶如何从开环轨迹拟合走向可行动推理。</li><li>协同数据和通信：SwarmDrive、UrbanV2X、CoPAD 对应语义通信、真实车路数据和协同预测三层问题。组会可以讨论 V2X 的增益到底来自信息更多、视角更稳，还是评测协议更接近真实遮挡与交互。</li><li>本期最值得先读 CARS，其次读 Real2Sim 和 CaAD。CARS 决定新增测试方向的评价口径；Real2Sim 连接场景生成和下游测试；CaAD 代表端到端闭环规划的最新建模趋势。</li></ul>",
    "tags": [
      {
        "id": "autonomous-driving-testing",
        "label": "自动驾驶测试",
        "color": "#9a7b2f",
        "description": "关注自动驾驶系统的仿真测试、闭环评测、安全关键场景生成、责任归因、场景筛选和测试基础设施。",
        "priority": 1
      },
      {
        "id": "autonomous-driving-security",
        "label": "自动驾驶模型攻防",
        "color": "#a33f4a",
        "description": "关注感知、预测、规划和端到端驾驶模型的攻击、防御、鲁棒性和安全评测。",
        "priority": 2
      },
      {
        "id": "end-to-end-autonomous-driving",
        "label": "端到端自动驾驶",
        "color": "#526274",
        "description": "关注从传感器输入到规划控制输出的端到端驾驶模型、驾驶大模型和闭环评测。",
        "priority": 1
      },
      {
        "id": "3d-reconstruction",
        "label": "三维重建",
        "color": "#b66a3c",
        "description": "关注自动驾驶场景的 3D/4D 重建、NeRF/Gaussian Splatting、占据和地图构建。",
        "priority": 2
      },
      {
        "id": "world-models",
        "label": "世界模型",
        "color": "#7a5fa8",
        "description": "关注自动驾驶和具身智能中的世界模型、视频预测、仿真生成和交互式 rollout。",
        "priority": 2
      },
      {
        "id": "cooperative-autonomous-driving",
        "label": "协同自动驾驶",
        "color": "#2f6f8f",
        "description": "关注多车协同、V2X 信息共享、协同规划和闭环自动驾驶系统。",
        "priority": 1
      },
      {
        "id": "vehicle-road-cooperation",
        "label": "车路协同",
        "color": "#6a668f",
        "description": "关注路侧感知、车路协同感知、基础设施辅助定位和通信约束。",
        "priority": 1
      },
      {
        "id": "cooperative-trajectory-prediction",
        "label": "协同轨迹预测",
        "color": "#3f7d58",
        "description": "关注多智能体交互建模、车车/车路信息融合和轨迹预测不确定性。",
        "priority": 1
      }
    ]
  },
  {
    "id": "2026-05-13",
    "date": "2026-05-13",
    "title": "从 V2X 协同到可规划世界模型",
    "summary": "本期按当前配置方向重新筛选真实论文，主线是把自动驾驶研究从单点开环指标推进到协同通信、闭环规划、动态三维场景、世界模型和鲁棒安全评测。",
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
        "tags": [
          "cooperative-autonomous-driving",
          "vehicle-road-cooperation"
        ],
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
        "comment": "Select2Drive 关注 V2X 自动驾驶里最容易被低估的工程问题：带宽、延迟和位姿误差存在时，并不是传得越多越好。它把通信选择直接和闭环驾驶表现挂钩，适合用于协同驾驶系统的信息价值评估。",
        "body": "## 一句话定位\n\nSelect2Drive 是一篇把 V2X 协同从“多视角融合”推进到“按驾驶效用选择通信内容”的论文。它的核心判断是，真实车路协同系统受带宽、延迟、定位误差和计算预算限制，协同模块必须学会只传对 ego 决策关键的信息，而不是默认扩大感知范围就能提升驾驶安全。\n\n## 论文要解决的问题\n\n很多协同感知论文主要报告检测或感知精度，但真实驾驶闭环里还有另一层约束：信息从支持车辆或 RSU 传到 ego 车之后，还要经过预测、规划和控制。传输区域太大、语义特征太重或通信时延太高，都可能抵消协同感知带来的收益。Select2Drive 因此把问题定义为 pragmatic communications：在动态交通场景中，怎样选择驾驶关键区域、减少无关通信，并让选择结果最终体现在 route completion 和 driving score 上。\n\n## 方法和系统设计\n\n- 系统建模覆盖感知、决策和控制三段，把 V2X 传输看作闭环驾驶链路的一部分，而不是独立的感知模块。\n- 论文使用分布式预测感知和运动感知重建来降低传输与推理开销，避免完整语义特征在时延约束下变成负担。\n- 通信选择围绕重要区域展开，优先传递对 ego 后续决策有价值的空间信息，并在 V2Xverse 与 DAIR-V2X 场景中测试带宽受限、位姿误差和动态交通密度的影响。\n\n## 关键图与可视化结果\n\n![图 1：Select2Drive 的 V2X-AD 闭环系统模型，展示感知、决策、控制和协同通信之间的关系](https://arxiv.org/html/2501.12040v4/x2.png)\n\n这张图的价值在于它把协同通信放进完整自动驾驶循环，而不是把通信当作感知前端的附属功能。读这篇论文时应重点看上半部分的闭环迭代：通信选择影响当前感知，感知结果影响决策，动作反馈又影响下一轮需要通信的区域。\n\n![图 2：低带宽场景下协同感知可视化，展示 ego 对周围目标位置的预测与真实位置对照](https://arxiv.org/html/2501.12040v4/x11.png)\n\n这类图比单纯表格更能说明论文的目标：在 5 MHz 等受限通信条件下，系统仍要保留对周围动态目标的关键空间判断。需要注意的是，图中展示的是协同感知质量，不等同于所有长尾闭环风险都被解决。\n\n## 实验结论与证据\n\n论文在 V2Xverse 和 DAIR-V2X 上做离线与闭环评估，证据链包括有限带宽、定位误差、不同场景密度和闭环驾驶表现。它不是只报告 mAP 或重建误差，而是把通信策略的收益落到 driving score、route completion 等驾驶指标上。这个证据结构比较重要：如果一个协同方法只提升感知表格，却无法改善规划稳定性或路线完成率，它的部署价值就需要重新评估。\n\n## 应用场景与启发\n\n- 应用场景：路口 RSU 协助、队列跟车、高速合流、遮挡严重的城市交叉口，以及低带宽车路协同部署。\n- 方法启发：V2X 信息选择可以按“对规划的边际贡献”定义，而不是按传感器视野或目标置信度粗略筛选。\n- 讨论问题：未来协同系统的训练目标是否应该直接优化闭环驾驶效用，而不是先优化感知、再假设规划会受益。\n\n## 局限与阅读风险\n\n论文结论仍依赖仿真平台、通信模型和数据集覆盖。现实部署中会出现更复杂的异步传输、丢包、标定漂移、RSU 盲区和交通参与者长尾行为。另一个风险是重要区域选择可能对当前 planner 或驾驶风格过拟合，换成更保守或更激进的规划器后，通信收益不一定保持。\n\n## 后续跟进\n\n- 检查 V2Xverse 与 DAIR-V2X 的通信带宽、位姿误差和闭环指标定义。\n- 复现实验优先选择低带宽、高动态密度和遮挡交叉口场景。\n- 继续跟进 pragmatic communication 是否能扩展到协同预测、协同规划和多车任务分配。",
        "link": "papers/select2drive-pragmatic-communications/"
      },
      {
        "id": "co-mtp-v2x-trajectory-prediction",
        "tag": "cooperative-trajectory-prediction",
        "tags": [
          "cooperative-trajectory-prediction",
          "vehicle-road-cooperation",
          "cooperative-autonomous-driving"
        ],
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
        "comment": "Co-MTP 把 V2X 信息用于轨迹预测，而不只停留在单帧协同感知。它把基础设施历史观测、预测结果和 ego planning action 一起放进异构图，适合讨论车路协同如何真正服务未来行为建模。",
        "body": "## 一句话定位\n\nCo-MTP 是一篇面向 V2X 轨迹预测的 ICRA 2025 工作，重点是把协同信息拆成历史域和未来域来使用。它回答的问题不是“路侧感知能否看得更远”，而是“基础设施提供的历史轨迹、预测结果和 ego 规划意图如何共同改善未来多模态轨迹预测”。\n\n## 论文要解决的问题\n\n单车轨迹预测在遮挡、交叉口、远距离车辆和复杂交互中经常缺少完整历史轨迹。已有 V2X 研究多集中在检测或 BEV 感知，默认更完整的感知会自然改善预测，但预测任务还需要理解历史运动模式、道路拓扑、agent-agent 交互以及 ego 自身规划动作。Co-MTP 的切入点是多时间域融合：过去用协同观测补全历史，未来用 ego planning 和基础设施预测建模交互。\n\n## 方法和系统设计\n\n- 论文把来自 AV 和 infrastructure 的轨迹数据、地图元素、基础设施预测结果和 ego planning action 构造成异构场景图。\n- 历史域侧重补全 AV 视角下缺失或不稳定的历史轨迹，缓解遮挡和视野受限带来的输入偏差。\n- 未来域把 ego planning 与其他交通参与者意图纳入图交互，使预测不只是孤立 agent 轨迹外推，而是 planning-conditioned scene forecasting。\n\n## 关键图与可视化结果\n\n![图 1：Co-MTP 总体架构，展示基础设施信息共享、异构图构造、多时间融合和多模态轨迹解码](https://arxiv.org/html/2502.16589v3/overview.jpg)\n\n这张架构图说明 Co-MTP 的信息流不是简单特征拼接。基础设施先共享历史和预测结果，系统再把交通参与者与地图元素放进相对坐标系下的异构图，最后通过 Transformer 层和多模态解码器输出未来轨迹。\n\n![图 2：STFA 异构图示意，展示 AV 历史节点、基础设施节点、规划节点和预测节点之间的未来交互关系](https://arxiv.org/html/2502.16589v3/STFA_1.png)\n\n这张图是理解论文贡献的关键：V2X 信息不只补当前观测，还作为独立节点参与未来交互建模。它将“协同预测”从数据增强问题转成图结构设计问题，方便后续做消融和替换。\n\n## 实验结论与证据\n\n论文在 V2X-Seq 数据集上评估，主要关注多模态轨迹预测精度、模型消融、噪声分析和时间延迟评估。它的证据价值在于消融粒度较清楚：可以分别检查历史融合、未来融合、STFA 图结构和基础设施信息对预测的贡献。定性案例覆盖 following、highway、speed up、wait to turn 等场景，能观察预测轨迹与历史/未来真值之间的关系。\n\n## 应用场景与启发\n\n- 应用场景：车路协同交叉口预测、遮挡车辆历史轨迹恢复、高速合流、多车交互预测和 planner 评估前的场景未来生成。\n- 方法启发：协同轨迹预测应显式区分“过去补全”和“未来交互”，否则很难判断 V2X 信息到底在哪个时间段起作用。\n- 讨论问题：如果 ego planning action 进入预测模型，那么预测与规划之间是否应该联合训练，而不是先预测再规划。\n\n## 局限与阅读风险\n\nV2X-Seq 是真实数据，但真实部署中的时间同步、通信延迟、标定漂移和基础设施故障仍可能比论文设定更复杂。另一个风险是 ADE/FDE 的提升并不自动说明规划安全改善，特别是在多模态预测中，模型可能给出更接近真值的轨迹集合，却仍无法被 downstream planner 稳定利用。\n\n## 后续跟进\n\n- 检查 V2X-Seq 的传感器同步、基础设施视角和时间延迟建模。\n- 复现时优先做无 V2X、仅历史融合、历史+未来融合、加入 ego planning 四组对照。\n- 继续跟进 planning-conditioned prediction 是否能接入闭环规划评估。",
        "link": "papers/co-mtp-v2x-trajectory-prediction/"
      },
      {
        "id": "v2x-vlm-cooperative-driving",
        "tag": "vehicle-road-cooperation",
        "tags": [
          "vehicle-road-cooperation",
          "cooperative-autonomous-driving",
          "end-to-end-autonomous-driving"
        ],
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
        "comment": "V2X-VLM 尝试让车端和路侧图像、语义文本与轨迹规划在同一个端到端框架里对齐。它适合评估视觉语言模型是否能把车路协同从感知增强推进到安全规划。",
        "body": "## 一句话定位\n\nV2X-VLM 是一篇把大型视觉语言模型引入车路协同端到端驾驶的论文。它的主要价值不是“使用 VLM”本身，而是尝试用多视角图像和语义文本统一车辆端与基础设施端信息，并将这种融合结果直接用于轨迹规划。\n\n## 论文要解决的问题\n\n车路协同的直观优势是基础设施可以补足 ego 车被遮挡或视野不足的区域。但车辆和路侧视角存在几何差异、语义粒度差异、传感器质量差异和通信成本差异，直接拼接特征容易产生错配。与此同时，端到端驾驶需要最终输出可执行轨迹，单纯提升检测或语义理解不一定改善碰撞率。V2X-VLM 因此尝试把多源视觉输入、文本化场景描述和规划目标放在同一个语义空间里学习。\n\n## 方法和系统设计\n\n- 输入包括车辆端相机图像、基础设施端相机图像和语义文本 prompt，经过 VLM backbone 做多视角、多模态融合。\n- 论文使用对比学习做视觉特征与文本语义对齐，缓解车端和路侧信息在语义层面的错位。\n- 训练中加入知识蒸馏以稳定复杂端到端任务，评估时关注 L2 error、collision rate、传输成本、扰动鲁棒性和推理效率。\n\n## 关键图与可视化结果\n\n![图 1：V2X-VLM 框架，展示车辆端和基础设施端图像、文本语义、对比对齐、知识蒸馏与轨迹规划输出](https://arxiv.org/html/2408.09251v3/x2.png)\n\n这张图说明论文不是把路侧图像粗暴拼到车端输入后面，而是利用语义 prompt 和 VLM backbone 做统一场景理解。读者需要重点看 contrastive alignment 与 knowledge distillation 的位置，因为这两个设计承担了异构信息对齐和训练稳定化的责任。\n\n![图 2：V2X-VLM 在三类常见驾驶场景中的轨迹规划可视化，连续帧以 1 Hz 展示](https://arxiv.org/html/2408.09251v3/x3.png)\n\n这张可视化结果把论文从“感知增强”拉回“规划输出”。它能帮助判断路侧视角是否真的改变了 ego 轨迹选择，但仍需要结合碰撞率和通信成本表格一起看，不能只凭轨迹图判断系统可靠。\n\n## 实验结论与证据\n\n论文报告了 L2 轨迹误差、碰撞率、通信传输成本、扰动鲁棒性和 latency/FPS，并通过消融说明对比对齐、知识蒸馏等组件会影响规划精度。这个证据结构比只做 V2X 检测更贴近应用，因为它同时考虑规划安全、传输代价和实时性。需要特别关注的是，VLM 的语义能力是否在碰撞率上带来稳定收益，而不仅是让模型解释更自然。\n\n## 应用场景与启发\n\n- 应用场景：路侧相机辅助交叉口通行、遮挡区域车辆提前识别、施工或拥堵场景下的语义提示式协同驾驶。\n- 方法启发：基础设施信息进入端到端模型时，可以通过语义对齐和蒸馏约束来控制异构融合，而不是只做 BEV 特征拼接。\n- 讨论问题：车路协同中的语言语义是必要中间层，还是目前主要起到正则化、对齐和可解释化作用。\n\n## 局限与阅读风险\n\nVLM 引入了更高计算成本，也可能带来不可解释的语义错误。文本 prompt 的生成方式、模板化程度和数据集偏差会直接影响结论。另一个风险是基础设施传感器失效、通信降采样和极端遮挡是否被充分覆盖；如果这些退化场景不够强，论文中的鲁棒性结论可能偏乐观。\n\n## 后续跟进\n\n- 检查数据集来源、文本 prompt 构造方式和是否包含真实基础设施传感器。\n- 复现时同时记录 L2 error、collision rate、传输成本和延迟，不只比较规划误差。\n- 跟进 V2X-VLM 与纯 BEV V2X 方法、纯 VLM 单车方法之间的公平对比。",
        "link": "papers/v2x-vlm-cooperative-driving/"
      },
      {
        "id": "desire-gs-4d-street-gaussians",
        "tag": "3d-reconstruction",
        "tags": [
          "3d-reconstruction",
          "world-models"
        ],
        "title": "DeSiRe-GS: 4D Street Gaussians for Static-Dynamic Decomposition and Surface Reconstruction for Urban Driving Scenes",
        "source": "CVPR 2025 / arXiv:2411.11921 / https://openaccess.thecvf.com/content/CVPR2025/html/Peng_DeSiRe-GS_4D_Street_Gaussians_for_Static-Dynamic_Decomposition_and_Surface_Reconstruction_CVPR_2025_paper.html",
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
        "comment": "DeSiRe-GS 用自监督 4D Gaussian Splatting 做城市驾驶场景的静动态分解和表面重建。它的价值在于把视觉渲染质量、动态对象处理和几何可信度放到同一个驾驶场景表示问题里。",
        "body": "## 一句话定位\n\nDeSiRe-GS 是 CVPR 2025 的驾驶场景 4D Gaussian Splatting 工作，目标是在没有额外 3D bounding box 标注的情况下，同时做好静动态分解、动态街景表示和高保真表面重建。它适合作为三维重建和驾驶仿真方向的高质量样本。\n\n## 论文要解决的问题\n\n普通 3DGS 在静态或受控场景里效果很好，但自动驾驶数据包含快速移动的车辆、行人、稀疏多视角、长距离道路和复杂遮挡。动态区域容易产生 ghosting、漂浮高斯和表面不一致，导致图像看起来能渲染，却难以作为仿真、地图更新或下游评测的可靠几何表示。DeSiRe-GS 的问题是：如何在自监督设置下从驾驶视频中分离静态背景和动态对象，并让动态区域的几何更贴合真实表面。\n\n## 方法和系统设计\n\n- 论文采用两阶段优化：先利用动态区域重建误差提取 2D motion masks，再将这些 motion priors 可微映射到 Gaussian 空间。\n- 表示层面构建 4D street Gaussian，将静态背景与动态对象分开建模，避免动态物体污染静态场景。\n- 正则设计包括 Gaussian scale、跨视角一致性和表面约束，目标是减少漂浮高斯，并提升动态区域几何质量。\n\n## 关键图与可视化结果\n\n![图 1：DeSiRe-GS pipeline，展示自监督 motion prior、静动态分解和 4D street Gaussian 优化流程](https://arxiv.org/html/2411.11921v2/figures_low_res/pipeline4.png)\n\n这张图是理解论文方法的入口。DeSiRe-GS 不依赖外部 3D 框标注，而是从渲染误差和 motion masks 中获得动态先验，再把二维动态线索转到 Gaussian 空间中约束场景表示。\n\n![图 2：DeSiRe-GS 与 S3Gaussian、PVG 的定性对比，展示动态驾驶场景中的渲染和分解效果](https://arxiv.org/html/2411.11921v2/figures_low_res/qualitative_comp_2.png)\n\n这张定性对比图需要和表格一起读。它能展示 DeSiRe-GS 在动态对象边界、道路结构和局部表面质量上的优势，但定性图本身不能证明几何可用于闭环驾驶，还需要深度一致性和下游任务验证。\n\n## 实验结论与证据\n\n论文在 Waymo Open Dataset、KITTI 等驾驶数据上比较重建、novel view synthesis、静动态分解和渲染质量，并与自监督方法以及带 3D bbox 标注的方法对照。它的关键证据不只是 PSNR/SSIM/LPIPS，而是动态区域和表面重建质量的改善。多视角一致性深度图进一步说明方法在几何侧有收益，不只是生成更漂亮的图像。\n\n## 应用场景与启发\n\n- 应用场景：驾驶仿真资产构建、动态场景重放、闭环规划场景编辑、道路数字孪生和下游感知算法评测。\n- 方法启发：驾驶 3DGS 的成功标准不能只看新视角渲染，还要看动态对象是否分离、表面是否可信、几何是否能被下游任务消费。\n- 讨论问题：4DGS 场景表示能否成为世界模型 rollout 或闭环仿真的几何底座，而不是只做离线可视化。\n\n## 局限与阅读风险\n\n自监督 motion prior 的质量是核心风险。夜间、雨雾、低纹理道路、稀有交通参与者和强反光场景可能破坏动态分解。另一个风险是 per-scene optimization 的效率和泛化能力；如果每个场景都需要较重优化，它更适合作为数据资产构建工具，而不一定适合实时驾驶系统。\n\n## 后续跟进\n\n- 检查代码开放情况、每个场景的优化时间和 Waymo/KITTI 数据预处理。\n- 复现时加入动态区域深度误差、表面一致性和下游感知评测，而不只看渲染指标。\n- 跟进 4DGS 与驾驶世界模型、闭环仿真 benchmark 的结合方式。",
        "link": "papers/desire-gs-4d-street-gaussians/"
      },
      {
        "id": "maat-e2e-adversarial-training",
        "tag": "autonomous-driving-security",
        "tags": [
          "autonomous-driving-security",
          "end-to-end-autonomous-driving",
          "autonomous-driving-testing"
        ],
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
        "comment": "MA2T 把对抗训练从分类或感知模块推进到端到端驾驶链路，关注攻击如何穿过感知、预测和规划影响最终驾驶行为。它适合作为自动驾驶鲁棒性评测与防御设计的基线论文。",
        "body": "## 一句话定位\n\nMA2T 是一篇端到端自动驾驶鲁棒训练论文，核心目标是在感知、预测、规划等模块强耦合的驾驶模型中做自适应对抗训练。它强调防御不能只保护某个局部任务，而要看最终规划输出和闭环驾驶行为是否更安全。\n\n## 论文要解决的问题\n\n传统对抗训练通常面对分类、检测或分割模型，输出目标单一，损失函数清楚。但端到端驾驶模型包含多个模块和多个任务，攻击可以在中间特征里传播，最终改变轨迹规划。直接把普通 PGD 对抗训练套进端到端模型，可能只提升局部模块鲁棒性，却损害整体驾驶效果。MA2T 的问题是：如何在不同模块注入扰动，并动态调整各模块训练贡献，使模型在攻击、自然扰动和闭环环境中都更稳。\n\n## 方法和系统设计\n\n- Module-wise Noise Injection 在输入或模块连接处引入扰动，使训练覆盖感知、预测、规划链路中的不同脆弱点。\n- Dynamic Weight Accumulation Adaptation 根据模块对鲁棒训练的贡献动态调整权重，避免某个模块损失主导训练。\n- 评估覆盖 white-box、black-box、adaptive attack、natural corruption 和 CARLA 闭环模拟，尽量把开环指标与驾驶行为联系起来。\n\n## 关键图与可视化结果\n\n![图 1：MA2T 方法示意，以 UniAD 为例展示噪声可以注入输入数据和模块连接位置](https://arxiv.org/html/2409.07321v1/x1.png)\n\n这张图说明 MA2T 的关键不是单个攻击算子，而是“模块级”训练视角。端到端驾驶模型的中间表示会跨模块传播，扰动位置不同，最终影响的规划风险也不同。\n\n![图 2：同一场景中 clean、被攻击和 MA2T 防御后的规划可视化对比](https://arxiv.org/html/2409.07321v1/x7.png)\n\n这张图展示了防御论文最需要的定性证据：攻击后规划可能从安全避让变成碰撞风险，而经过 MA2T 训练后，模型在同类攻击下能恢复更合理的轨迹。它提供了“规划风险”层面的直观证据，但仍需要和 CARLA 闭环统计一起判断稳定性。\n\n## 实验结论与证据\n\n论文在 nuScenes 上使用 UniAD、VAD 等端到端驾驶模型进行 white-box 和 black-box 设置评估，主要观察规划 Avg. L2 Error 等指标在攻击下的变化。它还补充自然扰动和 CARLA 闭环结果，说明防御不只改善开环误差，也可能降低模拟驾驶中的失效风险。更有价值的是 adaptive attack 结果，因为这能避免防御只对固定攻击方式有效。\n\n## 应用场景与启发\n\n- 应用场景：端到端驾驶模型上线前的鲁棒性测试、自动驾驶攻防 benchmark、防御训练 baseline 和安全回归测试。\n- 方法启发：鲁棒性评估应沿着模块链路定位脆弱点，并把最终规划和闭环风险纳入评价。\n- 讨论问题：对 V2X-VLM、世界模型式驾驶系统和概率规划模型，模块级防御是否仍然适用，还是需要按任务风险重新定义攻击面。\n\n## 局限与阅读风险\n\n对抗训练通常有训练成本和 clean performance trade-off，需要检查正常场景性能是否下降。攻击设置虽然较丰富，但真实世界还包括物理扰动、传感器故障、通信异常、场景级诱导和数据分布漂移。MA2T 的模块划分依赖具体端到端架构，迁移到大模型或世界模型架构时未必直接可用。\n\n## 后续跟进\n\n- 记录论文使用的端到端模型、攻击类型、扰动预算和闭环指标，形成安全评测清单。\n- 复现时至少包含 clean、white-box、black-box、adaptive attack、natural corruption 五类结果。\n- 跟进端到端驾驶防御是否能与不确定性规划、安全约束和仿真世界模型结合。",
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
        "comment": "VADv2 把端到端驾驶规划从确定性轨迹回归改成动作概率分布学习，用 planning vocabulary 表达多种合理驾驶动作。它适合作为闭环端到端驾驶和不确定性规划的核心阅读样本。",
        "tags": [
          "end-to-end-autonomous-driving"
        ],
        "body": "## 一句话定位\n\nVADv2 是一篇以概率规划为核心的端到端自动驾驶论文。它认为真实驾驶中一个场景往往存在多种合理动作，确定性轨迹回归会把多模态行为压成平均解，而概率规划可以显式建模动作不确定性，并在闭环中采样可执行动作。\n\n## 论文要解决的问题\n\n端到端驾驶常把多视角传感器输入映射成一条轨迹或控制量，但驾驶动作空间是高维连续时空空间，并且受驾驶风格、交互对象、交通规则和短期目标影响。确定性模型在可行解非凸或多模态时容易输出中间轨迹，闭环执行时可能不稳定。VADv2 的问题定义是：能否从大规模驾驶示范中学习 scene-conditioned action distribution，而不是只学习一个平均轨迹。\n\n## 方法和系统设计\n\n- 模型以流式多视角图像序列为输入，将传感器信息 token 化为 scene representation。\n- 论文将连续规划动作空间离散成 planning vocabulary，并把动作也 token 化，让 planning tokens 与 scene tokens 交互。\n- 训练时用大规模驾驶示范和场景约束监督动作概率分布，推理时从分布中采样动作控制车辆，减少规则 wrapper 的依赖。\n\n## 关键图与可视化结果\n\n![图 1：VADv2 总体架构，展示多视角图像输入、场景 token、规划动作 token、动作概率分布和采样控制](https://arxiv.org/html/2402.13243v2/x2.png)\n\n这张图说明 VADv2 的关键设计在输出端。它不是直接回归一条轨迹，而是把 planning action space 建成词表，再预测动作分布。这使模型可以表达多个合理动作，也方便把场景约束纳入概率分布训练。\n\n![图 2：VADv2 在 CARLA Town05 Long benchmark 中的定性结果，展示不同速度、变道和交互场景下的多模态规划](https://arxiv.org/html/2402.13243v2/x3.png)\n\n这张可视化结果对应论文的核心主张：在跟车、变道、路口等场景中，模型可以生成多个合理候选动作，而不是单一平均轨迹。需要注意的是，可视化展示多样性，但安全性还要看闭环指标和不同交通密度下的消融结果。\n\n## 实验结论与证据\n\n论文报告 CARLA Town05 Long 闭环 benchmark、NAVSIM、NAVSIMv2 和 3DGS-based benchmark 结果，并强调在无规则 wrapper 设置下仍能获得稳定闭环表现。它还对多模态输出、planning vocabulary size、planning manners 和交通密度做消融。证据重点不是某个开环 L2 指标，而是概率规划是否能在长路线闭环中减少不稳定行为。\n\n## 应用场景与启发\n\n- 应用场景：端到端闭环驾驶、长路线仿真评估、自动驾驶不确定性建模、多候选轨迹规划和 planner benchmark。\n- 方法启发：规划输出可以是分布而不是单条轨迹；这样更适合风险评估、保守采样、交互式规划和后续安全约束。\n- 讨论问题：概率规划的不确定性应该只出现在动作层，还是应该同时和世界模型 rollout、其他 agent 预测一起建模。\n\n## 局限与阅读风险\n\nplanning vocabulary 的构建会引入离散化偏差，词表规模、采样方式和示范数据覆盖会影响上限。CARLA 闭环结果很重要，但真实道路长尾场景、传感器异常和交通规则复杂性仍需要单独验证。另一个风险是采样式动作不等于安全动作，概率分布还需要和可验证约束或风险模型结合。\n\n## 后续跟进\n\n- 检查项目页代码、CARLA/NAVSIM 配置和 3DGS-based benchmark 的可复现性。\n- 复现时比较确定性回归、概率规划、不同 vocabulary size 和是否使用规则 wrapper。\n- 跟进概率规划与 V2X 协同、世界模型动作评估之间的结合。",
        "link": "papers/vadv2-probabilistic-planning/"
      },
      {
        "id": "vista-driving-world-model",
        "tag": "world-models",
        "tags": [
          "world-models",
          "autonomous-driving-testing"
        ],
        "title": "Vista: A Generalizable Driving World Model with High Fidelity and Versatile Controllability",
        "source": "NeurIPS 2024 / arXiv:2405.17398 / https://papers.nips.cc/paper_files/paper/2024/hash/a6a066fb44f2fe0d36cf740c873b8890-Abstract-Conference.html",
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
        "comment": "Vista 把驾驶世界模型的评价重点放在泛化、高保真、长时一致性和动作可控性上。它适合用来判断世界模型是否能从视频生成展示走向规划动作评估和闭环仿真。",
        "body": "## 一句话定位\n\nVista 是 NeurIPS 2024 的驾驶世界模型论文，目标是预测高保真、可泛化、可由多种动作信号控制的驾驶未来。它的重要性在于不只展示生成视频，而是把世界模型与动作可控性、长时 rollout 和 reward/action evaluation 联系起来。\n\n## 论文要解决的问题\n\n自动驾驶世界模型的理想用途是预测不同动作的后果，进而服务规划、仿真、数据生成和风险评估。但很多视频生成模型缺少驾驶动作控制，长时 rollout 容易漂移，对未见场景和关键交通细节的保持也不稳定。Vista 的问题定义更完整：世界模型必须同时满足未见环境泛化、高分辨率动态细节、多层次动作控制和可用于动作评价的 reward 建模。\n\n## 方法和系统设计\n\n- 论文先诊断已有驾驶世界模型在移动实例、结构细节和长时一致性上的问题，再设计动态增强与结构保持损失。\n- latent replacement 将历史帧作为先验注入长时预测，改善 autoregressive rollout 中的时序一致性。\n- 可控性覆盖 command、goal point、trajectory、angle、speed 等多种动作格式，并通过协同训练兼顾大规模开放视频数据和带动作标注的驾驶数据。\n\n## 关键图与可视化结果\n\n![图 1：Vista pipeline，展示动态先验注入、动作条件控制、长时自回归 rollout 和两阶段训练流程](https://arxiv.org/html/2405.17398v5/x3.png)\n\n这张图把 Vista 的三个核心能力放在一起：高保真未来预测、动作条件控制和长时扩展。重点看 latent replacement 和第二阶段 action control training，因为它们决定模型能否从单帧视频生成转向可控驾驶仿真。\n\n![图 2：Vista 的多模态动作可控性可视化，展示不同动作条件在多种驾驶场景中的响应结果](https://arxiv.org/html/2405.17398v5/x9.png)\n\n这张结果图用于判断“世界模型是否听动作”。如果同一条件帧下不同 command、goal、trajectory 或速度能产生对应未来，模型才可能用于 planner evaluation。仍需注意，视觉上响应动作不等于物理上完全真实，特别是长尾交互和交通规则违反场景。\n\n## 实验结论与证据\n\n论文在多个数据集上比较 generalization、fidelity、action controllability 和 reward modeling。它报告 Vista 相比通用视频生成模型和已有驾驶世界模型在 FID/FVD 等指标上有明显优势，也通过人评、动作控制结果和 reward/action evaluation 证明模型不只是生成清晰视频。特别值得关注的是 generalizable reward：论文利用 Vista 自身预测不确定性评价真实世界动作，不依赖特定数据集外部检测器。\n\n## 应用场景与启发\n\n- 应用场景：反事实动作评估、自动驾驶仿真、长尾场景扩增、planner reward estimation、生成式闭环测试和数据资产构建。\n- 方法启发：驾驶世界模型的评价应包括 action controllability、long-horizon coherence、unseen scenario generalization 和 reward reliability，而不能只看 FID/FVD。\n- 讨论问题：如果规划器使用世界模型作为 evaluator，怎样防止规划器利用模型偏差，得到视觉上合理但物理上危险的策略。\n\n## 局限与阅读风险\n\n视觉保真不等于物理真实，reward 也可能继承世界模型偏差。长时 rollout 中罕见交通事件、复杂多 agent 反事实、传感器异常和交通规则违反仍难验证。另一个风险是生成指标无法直接说明规划安全；模型是否能用于真实 planner，还需要闭环对照和失败案例分析。\n\n## 后续跟进\n\n- 阅读项目页和代码，确认训练数据、动作条件格式、reward estimation 细节和推理成本。\n- 复现实验优先做反事实动作、长时 rollout、未见场景泛化和 reward 与真实驾驶结果的一致性。\n- 跟进 Vista 与 VADv2 这类概率规划方法的组合：一个预测动作后果，一个输出动作分布。",
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
    "body": "## 本期判断\n\n本期七篇论文的共同变化是：自动驾驶研究正在从单点模块指标，转向“信息是否真正改变驾驶行为”的系统问题。Select2Drive 关注 V2X 里什么信息值得传，Co-MTP 关注协同信息如何进入未来轨迹预测，V2X-VLM 关注车端和路侧语义如何服务端到端规划。DeSiRe-GS 与 Vista 则分别从几何场景表示和生成式世界模型两个方向回答同一个问题：我们能否构建可控、可评估、可服务规划的驾驶环境。VADv2 和 MA2T 是本期的安全边界，一篇把规划输出从单轨迹改成概率分布，另一篇提醒端到端驾驶收益必须经受攻击和扰动检验。\n\n## 筛选口径\n\n- 优先选择能直接命中当前七个配置方向的论文，每个方向保留一篇最能形成讨论的问题样本。\n- 优先保留真实 V2X、闭环驾驶、公开 benchmark、CVPR/ICRA/ICLR/NeurIPS 或可核验 arXiv 记录的工作。\n- 剔除只展示视觉生成效果、只做非驾驶场景、或没有说明下游规划/安全收益的相近论文。\n- 对每篇论文都要求有明确证据链：它到底提升了通信效率、预测质量、规划安全、几何可信度、动作可控性还是鲁棒性。\n- 单篇详细报告必须放入论文原图或官方可视化结果，并解释图支撑了什么结论、没有支撑什么结论。\n\n## 应用场景与讨论线索\n\n- 协同系统：Select2Drive、Co-MTP、V2X-VLM 都在挑战“更多信息一定更好”的直觉，应用场景包括低带宽 V2X、遮挡路口、车路协同预测和语义辅助规划。\n- 场景建模：DeSiRe-GS 与 Vista 可以一起看，一个偏几何与动态分解，一个偏生成式未来预测和动作控制，适合讨论驾驶仿真资产和 planner evaluator 的边界。\n- 闭环安全：VADv2 与 MA2T 都提醒规划结果不能只看开环误差，应用场景包括长路线仿真、概率动作采样、安全回归测试和对抗鲁棒评估。\n- 本期最值得讨论的问题是：一篇论文的提升到底来自更强模型、更好信息选择、更合理的场景表示，还是更接近真实部署的闭环评测定义。",
    "bodyHtml": "<h2>本期判断</h2>\n<p>本期七篇论文的共同变化是：自动驾驶研究正在从单点模块指标，转向“信息是否真正改变驾驶行为”的系统问题。Select2Drive 关注 V2X 里什么信息值得传，Co-MTP 关注协同信息如何进入未来轨迹预测，V2X-VLM 关注车端和路侧语义如何服务端到端规划。DeSiRe-GS 与 Vista 则分别从几何场景表示和生成式世界模型两个方向回答同一个问题：我们能否构建可控、可评估、可服务规划的驾驶环境。VADv2 和 MA2T 是本期的安全边界，一篇把规划输出从单轨迹改成概率分布，另一篇提醒端到端驾驶收益必须经受攻击和扰动检验。</p>\n<h2>筛选口径</h2>\n<ul><li>优先选择能直接命中当前七个配置方向的论文，每个方向保留一篇最能形成讨论的问题样本。</li><li>优先保留真实 V2X、闭环驾驶、公开 benchmark、CVPR/ICRA/ICLR/NeurIPS 或可核验 arXiv 记录的工作。</li><li>剔除只展示视觉生成效果、只做非驾驶场景、或没有说明下游规划/安全收益的相近论文。</li><li>对每篇论文都要求有明确证据链：它到底提升了通信效率、预测质量、规划安全、几何可信度、动作可控性还是鲁棒性。</li><li>单篇详细报告必须放入论文原图或官方可视化结果，并解释图支撑了什么结论、没有支撑什么结论。</li></ul>\n<h2>应用场景与讨论线索</h2>\n<ul><li>协同系统：Select2Drive、Co-MTP、V2X-VLM 都在挑战“更多信息一定更好”的直觉，应用场景包括低带宽 V2X、遮挡路口、车路协同预测和语义辅助规划。</li><li>场景建模：DeSiRe-GS 与 Vista 可以一起看，一个偏几何与动态分解，一个偏生成式未来预测和动作控制，适合讨论驾驶仿真资产和 planner evaluator 的边界。</li><li>闭环安全：VADv2 与 MA2T 都提醒规划结果不能只看开环误差，应用场景包括长路线仿真、概率动作采样、安全回归测试和对抗鲁棒评估。</li><li>本期最值得讨论的问题是：一篇论文的提升到底来自更强模型、更好信息选择、更合理的场景表示，还是更接近真实部署的闭环评测定义。</li></ul>",
    "tags": [
      {
        "id": "cooperative-autonomous-driving",
        "label": "协同自动驾驶",
        "color": "#2f6f8f",
        "description": "关注多车协同、V2X 信息共享、协同规划和闭环自动驾驶系统。",
        "priority": 1
      },
      {
        "id": "vehicle-road-cooperation",
        "label": "车路协同",
        "color": "#6a668f",
        "description": "关注路侧感知、车路协同感知、基础设施辅助定位和通信约束。",
        "priority": 1
      },
      {
        "id": "cooperative-trajectory-prediction",
        "label": "协同轨迹预测",
        "color": "#3f7d58",
        "description": "关注多智能体交互建模、车车/车路信息融合和轨迹预测不确定性。",
        "priority": 1
      },
      {
        "id": "end-to-end-autonomous-driving",
        "label": "端到端自动驾驶",
        "color": "#526274",
        "description": "关注从传感器输入到规划控制输出的端到端驾驶模型、驾驶大模型和闭环评测。",
        "priority": 1
      },
      {
        "id": "3d-reconstruction",
        "label": "三维重建",
        "color": "#b66a3c",
        "description": "关注自动驾驶场景的 3D/4D 重建、NeRF/Gaussian Splatting、占据和地图构建。",
        "priority": 2
      },
      {
        "id": "world-models",
        "label": "世界模型",
        "color": "#7a5fa8",
        "description": "关注自动驾驶和具身智能中的世界模型、视频预测、仿真生成和交互式 rollout。",
        "priority": 2
      },
      {
        "id": "autonomous-driving-security",
        "label": "自动驾驶模型攻防",
        "color": "#a33f4a",
        "description": "关注感知、预测、规划和端到端驾驶模型的攻击、防御、鲁棒性和安全评测。",
        "priority": 2
      },
      {
        "id": "autonomous-driving-testing",
        "label": "自动驾驶测试",
        "color": "#9a7b2f",
        "description": "关注自动驾驶系统的仿真测试、闭环评测、安全关键场景生成、责任归因、场景筛选和测试基础设施。",
        "priority": 1
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
        "tags": [
          "cooperative-autonomous-driving"
        ],
        "body": "## 核心问题\n\n协同自动驾驶需要在有限通信带宽下共享局部观测和意图，同时保证规划结果不会引入新的冲突。论文样例关注多车之间如何在闭环场景中协调动作。\n\n## 方法速读\n\n- 将车辆的局部目标、可行轨迹和风险区域编码成轻量消息。\n- 通过图结构聚合邻近车辆意图，减少重复或冲突决策。\n- 在规划层加入安全约束，优先处理交叉口和汇入场景。\n\n## 组内关注点\n\n抓取这类论文时，应优先关注是否有闭环仿真、通信延迟建模和真实交通交互复杂度。",
        "link": "papers/cooperative-driving-planning/"
      },
      {
        "id": "cooperative-trajectory-v2x",
        "tag": "cooperative-trajectory-prediction",
        "tags": [
          "cooperative-trajectory-prediction",
          "vehicle-road-cooperation",
          "cooperative-autonomous-driving"
        ],
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
        "tags": [
          "vehicle-road-cooperation",
          "cooperative-autonomous-driving"
        ],
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
        "tags": [
          "end-to-end-autonomous-driving"
        ],
        "body": "## 核心问题\n\n端到端自动驾驶希望减少模块间误差传播，但也带来可解释性、数据规模和闭环稳定性问题。样例论文关注规划导向的端到端训练。\n\n## 方法速读\n\n- 输入多传感器历史观测，输出未来轨迹或控制信号。\n- 用规划损失和闭环反馈约束模型行为。\n- 在复杂交互场景中比较端到端模型和模块化系统。\n\n## 组内关注点\n\n日报筛选时应优先保留报告闭环驾驶指标、失败案例和数据规模细节的论文。",
        "link": "papers/e2e-driving-model/"
      },
      {
        "id": "driving-world-model",
        "tag": "world-models",
        "tags": [
          "world-models",
          "end-to-end-autonomous-driving",
          "autonomous-driving-testing"
        ],
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
        "color": "#2f6f8f",
        "description": "关注多车协同、V2X 信息共享、协同规划和闭环自动驾驶系统。",
        "priority": 1
      },
      {
        "id": "cooperative-trajectory-prediction",
        "label": "协同轨迹预测",
        "color": "#3f7d58",
        "description": "关注多智能体交互建模、车车/车路信息融合和轨迹预测不确定性。",
        "priority": 1
      },
      {
        "id": "vehicle-road-cooperation",
        "label": "车路协同",
        "color": "#6a668f",
        "description": "关注路侧感知、车路协同感知、基础设施辅助定位和通信约束。",
        "priority": 1
      },
      {
        "id": "end-to-end-autonomous-driving",
        "label": "端到端自动驾驶",
        "color": "#526274",
        "description": "关注从传感器输入到规划控制输出的端到端驾驶模型、驾驶大模型和闭环评测。",
        "priority": 1
      },
      {
        "id": "world-models",
        "label": "世界模型",
        "color": "#7a5fa8",
        "description": "关注自动驾驶和具身智能中的世界模型、视频预测、仿真生成和交互式 rollout。",
        "priority": 2
      },
      {
        "id": "autonomous-driving-testing",
        "label": "自动驾驶测试",
        "color": "#9a7b2f",
        "description": "关注自动驾驶系统的仿真测试、闭环评测、安全关键场景生成、责任归因、场景筛选和测试基础设施。",
        "priority": 1
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
        "tags": [
          "3d-reconstruction",
          "world-models"
        ],
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
        "tags": [
          "autonomous-driving-security",
          "end-to-end-autonomous-driving"
        ],
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
        "color": "#b66a3c",
        "description": "关注自动驾驶场景的 3D/4D 重建、NeRF/Gaussian Splatting、占据和地图构建。",
        "priority": 2
      },
      {
        "id": "world-models",
        "label": "世界模型",
        "color": "#7a5fa8",
        "description": "关注自动驾驶和具身智能中的世界模型、视频预测、仿真生成和交互式 rollout。",
        "priority": 2
      },
      {
        "id": "autonomous-driving-security",
        "label": "自动驾驶模型攻防",
        "color": "#a33f4a",
        "description": "关注感知、预测、规划和端到端驾驶模型的攻击、防御、鲁棒性和安全评测。",
        "priority": 2
      },
      {
        "id": "end-to-end-autonomous-driving",
        "label": "端到端自动驾驶",
        "color": "#526274",
        "description": "关注从传感器输入到规划控制输出的端到端驾驶模型、驾驶大模型和闭环评测。",
        "priority": 1
      }
    ]
  }
];
