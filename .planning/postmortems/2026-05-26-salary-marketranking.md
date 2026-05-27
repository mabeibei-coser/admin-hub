# 2026-05-26 复盘：薪资报告字段抄错，整页崩

## 一句话

子公司 HR 抄了一份集团的员工档案字段表，**抄错了一个字段名**，
平时没人查不出事；有人来查那个字段时整个档案系统罢工。

## 时间线

| 时间 | 事件 |
|---|---|
| 5/25 22:53 | salary 业务接入 admin-hub（commit `e5cff36`）—— **Bug 诞生** |
| 5/25 22:53 - 5/26 13:00 | bug 沉睡 14 小时，没人点开薪资报告 |
| 5/26 13:29 | 第一个 session 开始查 bug（cac30668） |
| 5/26 13:29 - 22:46 | **9 小时** 沿着 trailingSlash / hazard import / 数据库路径 / nginx 配置一路猜，**没找到根因**，最终用户 interrupt |
| 5/26 ~22:50 | 第二个 session 开始（本次） |
| 5/26 ~22:55 | **5 分钟内**定位根因（git log + node 读数据库 + 跨 repo grep） |
| 5/26 23:30 | v0.1.45 部署修复 + 加 ErrorBoundary + 加契约 sync 机制 |

总耗时：**约 10 小时**（9 小时走偏 + 1 小时找到 + 修 + 防御 + 治本）

## 用 HR 比喻

**做了什么**：集团（salary-report 项目）让子公司 HR 部门（admin-hub）
读集团员工档案。子公司没法直接看集团数据库，所以**抄了一份《员工档案
字段定义》**留底。

**问题**：
1. 子公司抄字段表时**抄错了一个字段**——把"年度薪酬趋势"（`salaryTrend`）
   抄成了"市场排名记录"（`marketRanking`），后者根本不存在
2. 平时没人查这个字段，子公司 HR 系统一切正常
3. **第一个员工来查询薪资报告 → 系统去找"市场排名记录"字段 → 找不到 → 全屏崩**
4. 子公司没工具能验证"我抄的字段表是不是真的对得上集团数据库"
5. 集团那边也不知道子公司在用它，所以下次集团改字段不会通知子公司

## 4 个判断错叠加（旧 session 为什么 9 小时找不到）

### ① 没跑 git log
旧 session 全程没用 `git log --oneline -- <相关文件>`。
salary 业务接入是**单次 commit** (`e5cff36`)——一行 git log 5 秒锁定。
但旧 session 一上来就开始猜 URL / 路由 / 模块加载 / nginx 配置，
**忘了"昨天还好今天坏了 = 根因在最近 commit 里"这个铁律**。

### ② 没去看真实数据库
旧 session 看了 21 次代码（Read）+ 12 次找文件（Glob）+ 1 次 grep
+ 46 次 bash —— **但没有一次用 `node -e + better-sqlite3` 打开 sqlite
文件看真实 `report_json` 字段**。

类型文件写着 `marketRanking: MarketRankingItem[]`，TypeScript 没报错，
99% 的人**就此相信了类型定义**。但 types 是人抄的，会错；**数据库里
的真实 JSON 是程序写的，不会撒谎**。

### ③ 被无关线索带偏
旧 session 中途看到 pm2 log 里有 `unable to open database` ——
**这是一个真实存在但无关的旧报错**（生产另一个数据库的残留）。它
把这条当成"关键发现"，从应用层一路滑到 nginx 配置层。

这是 my-debug 模板 Phase 3 警告的 **红旗信号 #3：每修一个 bug 冒出
一个新 bug —— 层错了**。旧 session 越往下挖，离根因越远。

### ④ 默认走基础设施视角
假设链：trailingSlash → hazard import → module 加载 → 数据库路径
→ nginx 配置。**全是基础设施/环境层猜测**。

但 marketRanking bug 实际在**前端代码一行 `data.marketRanking[0]`**。
旧 session 似乎一开始就把这个 bug 框成"部署/环境问题"，没有"也可能
是接入代码本身写错了"的假设。

## 旧 session 全程 0 次 Skill 调用

最致命的判断错：**全程没调 my-debug skill**。

旧 session 的 prompt 是"Hub 里面的薪资平台报告点进去以后有报错，
**请修复**"。my-debug skill 当时的 description 主要列了"调一下/查一下/
debug"等主动调查类触发词，"请修复"这种被动语态没列在 trigger 里
→ model 没自动 invoke → 没走 Phase 1 git log 这个铁律 → 一路猜。

**修复**：5/26 已扩展 my-debug skill description，新增 4 类触发词
（修复类 / 症状类 / 交互类 / 困局类），下次说"请修复 X"会自动 invoke。

## 下次怎么避免

### 立刻能做的

- **A. bug 第一步永远 `git log`** —— "昨天还好今天坏了 = 根因在最近
  commit 里"。读 git log 比读 100 行代码效率高 50 倍
- **B. 不信 types，信数据库本身** —— 任何"为什么这个字段是 undefined"
  的问题，**第一动作是写 `node -e + better-sqlite3` 看真实数据**，而不是
  去看类型声明
- **C. 跨 repo 思考没有边界** —— admin-hub bug 看 admin-hub 代码，
  也要看上游 salary-report 源码。契约不一致问题答案**必定**在两边对比里
- **D. 一个 hypothesis 3 次没中就停** —— 不要"再猜一个"，调 my-debug
  skill 走 Phase 2 模式比对

### 长期习惯

- **E. 任何"手抄"必须配 sync 机制** —— admin-hub 接 6 个业务，原本每个
  都是手抄 types，每个都可能抄错。已治本：每个业务加 `contracts/`
  文件 + admin-hub `npm run sync-contracts` 同步
- **F. 渲染层默认要兜底** —— 报告类组件不可能保证字段 100% 对齐，
  必须用 ErrorBoundary 包每个 section，单 section 崩不连累整页
- **G. skill description 的触发词要覆盖被动语态** —— "请修复"/"X 报错"
  这种主动让 AI 动手的语态，也要 invoke 调查类 skill，因为"修复" ≠
  "立刻动手"

## 早期警报信号（出现就停）

下次再碰到下面任一情况，立刻 STOP：

1. **新接入业务后报错** → 查看接入 commit 的 diff，**别从环境/路由开始猜**
2. **TypeScript 没报错但运行时 undefined** → 99% 是 types 跟实际数据不一致，
   直接打开数据库看真实 JSON
3. **从应用层一路猜到 nginx/数据库路径** → 层错了，**根因 95% 还在应用代码**
4. **一个 session 改了 2-3 个方向都没好** → 调 my-debug skill 重启，
   不要继续猜
5. **看到"unable to open database"这类基础设施报错** → 先确认它跟当前
   bug 时间窗口对得上，**生产 log 里 90% 的 ERROR 是历史遗留，不是当前问题**

## 已做的防御（v0.1.45 - v0.1.47）

| Commit | 防御机制 |
|---|---|
| `538fd70` | salary types：marketRanking → salaryTrend；MarketSection 用 SVG 趋势折线（复刻上游视图） |
| `762daff` | **ErrorBoundary 包所有 section** —— 单 section 崩不连累整页（5 个 renderer + preview page 共 13 处包了） |
| `4d5061b` | **统一 contracts sync 机制** —— admin-hub `npm run sync-contracts` 从 6 个上游业务项目自动同步 types 文件 |
| salary-report `562a52e` + 4 个业务 commit | 每个业务加 `contracts/<repo>.ts`「对外契约文件」+ README，明确 sync 流程 |
| `~/.claude/skills/my-debug/SKILL.md` | description 扩展 4 类触发词，下次"请修复 X"自动 invoke |

## 相关 commits

| Commit | 含义 |
|---|---|
| admin-hub `e5cff36` | salary 业务接入 —— **Bug 诞生**（手抄 types 错写 marketRanking） |
| admin-hub `538fd70` | **真正修复**（types + MarketSection 改 salaryTrend） |
| admin-hub `5315db9`（v0.1.45 部署点） | 第一次上线修复 |
| admin-hub `762daff` | A 防御：ErrorBoundary |
| admin-hub `4d5061b` | B 治本：契约 sync 机制 |

## 给未来 AI 的纸条

如果你（未来某个 Claude session）在这个项目里看到：

- 用户说 "X 报告点进去崩了" / "X 后台某个页面有报错"
- 报错信息是 `Cannot read properties of undefined (reading '0' or 'map')`
- 这个 X 是 admin-hub 接的某个业务（salary / nav / startup / tailor / hazard / report）

**第一动作不是看代码，是按这个顺序：**

1. `git log --oneline -- components/admin/<X>-report-renderer.tsx components/report/<X>/` —— 看 salary 业务接入 commit
2. `node -e "const Database=require('better-sqlite3');const db=new Database('<X-DB-PATH>',{readonly:true});const r=db.prepare('SELECT report_json FROM reports ORDER BY id DESC LIMIT 1').get();console.log(Object.keys(JSON.parse(r.report_json)))"` —— 看实际数据顶层字段
3. 对比 admin-hub 的 `lib/types-<X>.ts` 跟实际数据字段是否对得上
4. 如果不对：**直接跑 `npm run sync-contracts <X>`** 从上游契约同步过来；同步后 git diff `lib/types-<X>.ts` 看变化
5. 修代码访问对的字段

99% 概率是同一个坑。
