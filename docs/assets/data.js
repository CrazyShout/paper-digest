window.PAPER_DIGESTS = [
  {
    "id": "2026-05-11",
    "date": "2026-05-11",
    "title": "多智能体推理、具身世界模型与无线感知",
    "summary": "本期示例覆盖三个方向：长程任务里的多智能体协作、面向机器人操作的世界模型，以及通信感知一体化里的鲁棒表征。",
    "keywords": [
      "多智能体",
      "具身AI",
      "无线感知"
    ],
    "papers": [
      {
        "id": "agent-collaboration",
        "tag": "agent-reasoning",
        "title": "Long-Horizon Agent Collaboration with Shared Memory",
        "source": "arXiv / OpenReview / GitHub",
        "authors": [
          "Lin Zhao",
          "Mei Chen",
          "Daniel Park"
        ],
        "affiliations": [
          "Tsinghua University",
          "Stanford University",
          "MIT CSAIL"
        ],
        "comment": "把协作失败拆成意图同步、工具分配和恢复策略三个层级，适合作为组内多 agent 评测的任务模板。",
        "visual": "visual-network",
        "visualLabel": "agent trace",
        "body": "## 核心问题\n\n这篇论文关注长程任务中多个 agent 如何共享状态、分配工具调用，并在失败后恢复执行。它的价值不只在方法本身，也在于把协作失败拆成了更容易诊断的事件序列。\n\n## 方法速读\n\n- 用共享记忆池记录 agent 的局部观察、工具输出和计划修订。\n- 通过角色约束减少重复调用工具的问题。\n- 在任务失败后回溯最近一次分歧点，重新分配下一步执行者。\n\n## 组内关注点\n\n如果我们后续做多 agent benchmark，可以借鉴它的失败归因表格，把错误从“最后答案错了”拆到更细的协作过程。",
        "link": "papers/agent-collaboration/"
      },
      {
        "id": "robot-world-model",
        "tag": "embodied-ai",
        "title": "Action-Conditioned World Models for Dexterous Manipulation",
        "source": "Conference proceedings",
        "authors": [
          "Ava Singh",
          "Rui Tan",
          "Yuki Sato"
        ],
        "affiliations": [
          "UC Berkeley",
          "University of Tokyo"
        ],
        "comment": "主线是把动作条件加入 latent dynamics，亮点在失败轨迹的重新采样。可以重点看数据闭环是否比单纯扩大仿真更划算。",
        "visual": "visual-grid",
        "visualLabel": "world model",
        "body": "## 核心问题\n\n机器人灵巧操作里的长程预测很容易在接触、遮挡和物体滑动时崩掉。论文尝试用动作条件世界模型降低这种误差积累。\n\n## 方法速读\n\n- 把视觉观测和动作序列编码到同一个 latent dynamics。\n- 在 rollout 中显式建模失败轨迹，让策略能看到接近失败的边界状态。\n- 通过少量真实机器人数据校准仿真分布。\n\n## 组内关注点\n\n建议重点核对真实机器人实验的 rollout 数量、失败定义和任务复杂度，避免只被仿真指标说服。",
        "link": "papers/robot-world-model/"
      },
      {
        "id": "isac-representation",
        "tag": "wireless-sensing",
        "title": "Robust CSI Representation Learning for Joint Sensing and Communication",
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
        "comment": "把 CSI 的时频结构做成可迁移表征，低信噪比场景下收益明显；后续可对比我们已有的多模态感知设定。",
        "visual": "visual-wave",
        "visualLabel": "CSI map",
        "body": "## 核心问题\n\n通信感知一体化系统里，CSI 表征会同时受到信道变化、硬件噪声和任务目标切换影响。论文关注如何学习一个对下游感知任务更稳健的表示。\n\n## 方法速读\n\n- 把 CSI 的时频结构作为主要归纳偏置。\n- 对不同信噪比和移动速度做增强，提升跨场景泛化。\n- 用通信指标和感知指标共同评估表征质量。\n\n## 组内关注点\n\n这篇适合和我们已有的多模态感知设定对照，尤其是低信噪比下的表征退化曲线。",
        "link": "papers/isac-representation/"
      }
    ],
    "notes": [
      {
        "user": "paper-lead",
        "time": "09:12",
        "text": "多智能体这篇可以拆成 benchmark 和 memory mechanism 两条线看，适合周会快速过。"
      },
      {
        "user": "robotics-lab",
        "time": "10:04",
        "text": "世界模型示例里建议重点核对 real-robot rollout 的数量，避免只看仿真指标。"
      }
    ],
    "body": "这一期保留为内容源示例。真实使用时，Codex 可以把每周抓到的论文先写成 `content/papers/*.md`，再把当期简报索引写到这里。",
    "tags": [
      {
        "id": "agent-reasoning",
        "label": "多智能体推理",
        "color": "#b45f49",
        "description": "关注 agent 协作、工具调用、记忆共享和长程规划评测。"
      },
      {
        "id": "embodied-ai",
        "label": "具身世界模型",
        "color": "#60715f",
        "description": "关注视觉-动作预测、仿真到现实迁移和机器人操作策略。"
      },
      {
        "id": "wireless-sensing",
        "label": "无线感知",
        "color": "#475a70",
        "description": "关注 ISAC、CSI 表征、低信噪比场景下的稳健感知。"
      }
    ]
  },
  {
    "id": "2026-05-04",
    "date": "2026-05-04",
    "title": "高效训练、RAG 评测与机器人数据闭环",
    "summary": "上一期示例展示历史简报在左侧目录中的位置。页面会按 date 自动倒序排列，不依赖文件名顺序。",
    "keywords": [
      "高效训练",
      "RAG",
      "机器人数据"
    ],
    "papers": [
      {
        "id": "sparse-finetune",
        "tag": "efficient-training",
        "title": "Sparse Adapter Routing for Cost-Aware Fine-Tuning",
        "source": "arXiv",
        "authors": [
          "Nora Wang",
          "Isaac Miller"
        ],
        "affiliations": [
          "Carnegie Mellon University",
          "Google DeepMind"
        ],
        "comment": "路由粒度比 LoRA module 更细，适合检查是否能和现有的训练脚本复用。",
        "visual": "visual-network",
        "visualLabel": "adapter routes",
        "body": "## 核心问题\n\n大模型微调的成本不仅来自参数量，也来自激活和路由开销。论文把 adapter 的选择变成稀疏路由问题，目标是把训练预算集中到有效路径上。\n\n## 方法速读\n\n- 每个样本只激活少量 adapter 分支。\n- 路由器根据任务和中间表示动态选择分支。\n- 用预算约束控制吞吐和显存。\n\n## 组内关注点\n\n可以先检查它是否能无痛接到我们现有训练脚本，再决定是否值得复现。",
        "link": "papers/sparse-finetune/"
      },
      {
        "id": "rag-grounding",
        "tag": "rag-eval",
        "title": "Grounded Citation Metrics for Domain RAG Systems",
        "source": "ACL Anthology",
        "authors": [
          "Elena Garcia",
          "Hao Wu"
        ],
        "affiliations": [
          "University of Washington",
          "HKUST"
        ],
        "comment": "评测从答案正确性扩展到引用证据是否覆盖核心 claim，适合做组内知识库的离线回归测试。",
        "visual": "visual-grid",
        "visualLabel": "evidence grid",
        "body": "## 核心问题\n\nRAG 系统回答正确并不代表引用可靠。论文重点检查答案里的关键 claim 是否真的被引用材料支撑。\n\n## 方法速读\n\n- 把回答拆成多个可验证 claim。\n- 对每个 claim 检查引用证据覆盖度。\n- 区分无引用、弱引用和错误引用三类问题。\n\n## 组内关注点\n\n这篇可以直接映射到论文简报生成链路，用来检查自动摘要是否给出了可追溯证据。",
        "link": "papers/rag-grounding/"
      },
      {
        "id": "robot-data-loop",
        "tag": "robot-data",
        "title": "Failure-Aware Data Collection for Robot Skill Learning",
        "source": "Project page",
        "authors": [
          "Mina Kim",
          "Oliver Smith",
          "Jia Luo"
        ],
        "affiliations": [
          "KAIST",
          "Oxford Robotics Institute"
        ],
        "comment": "抓取失败轨迹后主动补采边界案例，比均匀扩数据更高效；值得对照现有任务里的 long-tail failure。",
        "visual": "visual-wave",
        "visualLabel": "failure loop",
        "body": "## 核心问题\n\n机器人技能学习里，均匀扩充数据常常浪费在已经会做的状态上。论文把失败轨迹作为主动采样信号，优先补齐边界案例。\n\n## 方法速读\n\n- 执行任务时记录失败轨迹和关键状态。\n- 用失败密度决定下一批数据采集区域。\n- 评估成功率提升和数据采集成本之间的关系。\n\n## 组内关注点\n\n如果我们要做数据闭环，最值得借鉴的是它对 failure bucket 的定义，而不是具体模型结构。",
        "link": "papers/robot-data-loop/"
      }
    ],
    "notes": [
      {
        "user": "eval-owner",
        "time": "14:37",
        "text": "RAG 评测这篇可以直接映射到我们现在的报告生成链路。"
      }
    ],
    "body": "这是第二期示例，用于验证历史目录、跨期搜索和 tag 筛选。",
    "tags": [
      {
        "id": "efficient-training",
        "label": "高效训练",
        "color": "#8b5e83",
        "description": "关注低成本微调、稀疏激活、训练稳定性和吞吐优化。"
      },
      {
        "id": "rag-eval",
        "label": "RAG 评测",
        "color": "#b45f49",
        "description": "关注检索增强生成的证据覆盖、引用质量和领域问答评估。"
      },
      {
        "id": "robot-data",
        "label": "机器人数据闭环",
        "color": "#60715f",
        "description": "关注数据采集、失败挖掘、仿真增强和部署反馈。"
      }
    ]
  }
];
