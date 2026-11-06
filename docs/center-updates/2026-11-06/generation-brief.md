# 本轮研究探索：生成输入

用户要求更新 Idea 与综述中心，利用现有探索 skills，全面思考本库与外部文献，避免防御性思考。特别持续关注三维未知物体分割与 4D 高斯，同时覆盖既有十个方向。

本轮处于文献和研究方案阶段。目标是提出值得检验的方法，不是宣称已经跑出结果。适当自建模型模块、数据接口或实验流程是正常研究工作。预算默认先用公开数据及单至数卡做数日级首项实验，形成完整研究可用 6–12 周；实际硬件尚未约定。

证据目录 generation-evidence/ 已冻结。阅读各方向包中的摘要、方法片段和本地全文路径，使用新近外部论文，不能只依赖现有综述。历史候选供辨识相同假设和既有结果；不要沿用旧分数或把旧判定作为否定新问题的理由。任何重新提出的机制要明确与旧候选的关系。

请围绕五个分析视角独立生成：直接方法、表示与跨领域连接、序列决策、系统资源、学习目标。生成 12 个具体候选，十个方向各至少一个，额外两个可跨方向。方法应简单到同事听一次就能复述，不为了回应所有风险叠加门控或审计器。研究密集不是禁区。允许高收益高风险候选。不要自行筛选、排名或淘汰；保留每个候选供另一个角色比较。

每个候选用中文给出：稳定短 ID、主方向和交叉方向、标题、method（2–4步）、hypothesis、whyNow、upside、risk、priorWork（至少两项一手来源 URL、重合点与差分）、implementation（reuse/build分开）、firstExperiment（question/setup/baselines/measurement/positive/negative/unclear/budget）、evidence（至少三项含本库及外部来源与其实际作用）、与历史候选关系。

预算、效果和结果解释均是计划，不可编造实验。生成时不读另一生成者的输出。输出结构为 shard_id, generator_model, assigned_unit_ids（五个分析视角）, covered_unit_ids, status, candidates, errors。可在回复中返回 JSON，不修改 production 文件；如果输出很大，可写自己唯一的 docs/center-updates/2026-11-06/generation-<model>.json。
