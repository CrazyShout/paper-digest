# 2026-10-14 全站文案校订

本轮逐页阅读 174 份报告、23 份简报源文件和 10 份综述，保留八章结构与技术深度。清理重点是机械归属标签、重复核验自述、含混的否定句，以及入口页缺少具体对象的评价。最终逐页状态与指纹见 [page-checklist.json](page-checklist.json)。

| 阅读内容 | 校订 | 读后保留 |
| --- | ---: | ---: |
| 论文报告（含修订版） | 111 | 63 |
| 简报 | 21 | 2 |
| 方向综述 | 10 | 0 |

两份 `test-glm` 简报是历史审计原稿与纠错对照，保留原文。首页与目录继续读取各报告短评；研究态势的标签改为具体研究问题。Idea 只改介绍与流程提示，历史候选、评审意见、分数及判定不变。论文、简报、Idea 和邮件写作模板同步调整，本轮不发送邮件。

## 复核与来源

三个作者按主方向通读全部报告，再由未参与该批撰写的审阅者检查改写上下文、证据条件和保存项；保留页做字节一致性复核。主代理负责的简报、模板与入口文案另行审阅。实际检查深度见每页记录，不以关键词命中或修改数量代替语义检查。

四组 `review-*-round1.json` 保留首轮问题与原始指纹，`review-*-round2.json` 记录修正后的通过结果。审阅属于同模型家族的交叉核对（same-family provisional）。本轮没有重新核验全部原论文或复现实验。

局部一手核验澄清了有限查询“上界”、离散动作与轨迹评测、模型计数冲突、点云配准残差，以及闭环与非反应式协议的区别。校订中发现的语义增强、来源动作歧义、残句与旧图号说明也已修复。对应前后句、来源和核验日期分别保存在 [review-corrections.json](review-corrections.json)、[fact-corrections-followup.json](fact-corrections-followup.json) 与 [author-reviews-assessment.json](author-reviews-assessment.json)。

十份综述在报告定稿后重跑原始 Markdown `rg`，候选集合均与上期相同；三维重建的宽检索文件命中由 29 变为 30，规范候选仍为 20。引用身份、候选去向、外部检索日期和实质复核日期保留。允许修改的少量引用说明字段另列来源，未将文案校订计作全面新检索。历史查询与审批保存在 [local-corpus-evidence.json](local-corpus-evidence.json)，审批绑定最终综述指纹。

## 验证

- `npm run review:preflight`、`npm run validate`、`npm test` 和 `TZ=UTC GITHUB_ACTIONS=true npm run build` 通过。
- 测试 295 项通过、7 项按既有条件跳过。既有测试运行器另排除依赖外部本地 pickle 资产的 `release-population-preflight-v7.test.mjs`；本轮未修改该策略。
- 构建 210 页；全部历史路径和锚点保留。229 条全文搜索记录的 JSON 与 gzip 解压结果相同，207 个原始图像目录文件字节保持一致。
- 桌面和 390 像素窄屏检查近期简报、十方向代表报告与修订页、全部综述、研究态势和 Idea；页面无横向溢出，宽表保留局部滚动和键盘焦点，未见 KaTeX 错误。
- 正式构建搜索通过标题排序、Enter 跳转、类型筛选、加载更多和 Escape 关闭检查。折叠深链接可展开并定位；简报打印包含折叠的检索说明，打印后恢复原展开状态。

构建、浏览器和保护项结果分别见 `build-verification.json`、`browser-verification.json`、`integrity-check.json`、`route-compatibility.json`、`print-verification.json`。部署回执和线上验证保存在本地相邻的 `2026-10-14-release/`，不回填历史审核文件。
