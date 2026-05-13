window.PAPER_DIGESTS = [
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
