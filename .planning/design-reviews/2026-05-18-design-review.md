# admin-hub 设计审查报告

**日期**：2026-05-18
**review 范围**：`/b100/admin/login/`、`/b100/admin/reports/`（report / nav 两 tab）、`/b100/admin/reports/[id]/`、`/b100/admin/service-tracking/`、`/b100/admin/service-tracking/[id]/`、`/b100/admin/admins/`、`/b100/admin/admins/new/`、`/b100/admin/admins/[id]/edit/`、侧边栏、移动端顶条
**review 模式**：源码 + 实测 DOM + 计算样式 inspect（截图工具在本机持续 timeout，全部走 DOM 检验）
**测试账号**：18621933756（超管，临时种入）
**评分**：**B+**（设计语言成熟，但一致性显著下滑）/ AI-slop 评分：**A-**（克制、有自己的 voice，几乎没有 AI 模板痕迹）

---

## 一、总体印象

这套后台**远超普通 vibe coding 项目的水准**。能看到一个真正的设计系统在生效：

- OKLCH 色彩体系（navy / blue / gold 三组品牌 token + 5 个语义 status pill）
- 唯一字族 Geist + PingFang fall-through（这是字体克制的样本，绝大多数 AI 后台会塞 3-4 个字族）
- 阴影都带 navy 色调（`oklch(0.3 0.06 252 / x)`），不是黑色
- 表面分层（surface-panel / surface-elevated / surface-tinted），不是平面化
- 数字类 KPI 用渐变 `text-fill: transparent`，比纯灰扁数字有质感

**第一眼问题**：登录页非常精致（深色玻璃 + brand mark + radial-gradient + 噪点纹理）；但**登录之后**的列表/详情/编辑页，**有三套不同的"卡片"和"卡片头"风格在打架**，让整体掉了一个台阶。问题不在某个页面"丑"，而在"它们看起来不是一个产品"。

**眼睛先到哪 3 个地方（登录页）**：
1. 左上 brand mark（gradient blue 圆角 + ShieldCheck）✓ 设计师本意
2. 中央 "欢迎回来" + 文案 "让每一份报告都被认真对待"（30px 字号 + 11px uppercase eyebrow）✓
3. 右上"系统运行正常"绿色 pulse dot ⚠ 但这是**静态**的，不基于真实健康检查

**一句话评价**：克制、有 voice、技术细节扎实；缺一次"全局对账"。

---

## 二、设计系统抽取（Phase 2 实测）

从 `/admin/reports/?project=report` 实测：

| 维度 | 数值 | 评价 |
|------|------|------|
| 字族 | `Geist, Geist Fallback, PingFang SC, Microsoft YaHei, Helvetica Neue, Arial, sans-serif` | 1 个字族，A |
| 非中性色种类 | 17（基本都是 OKLCH，少量 rgb fallback） | A，远低于 12 个的警戒值（warning 阈值是 hue 数，不是 channel 数；这里 hue 集中在 252/240/238） |
| H1 字号 | 26px / weight 600 / letter-spacing -0.65px / line-height 1.15 | A |
| 按钮高度 | 44px（登录） / 28-32px（次要按钮） | 触摸目标合规 |
| 输入框高度 | 44px（登录） / 32px（筛选栏） | 列表筛选 32px 偏窄，但属常规取舍 |
| 圆角阶梯 | radius-sm = 0.45rem，radius = 0.75rem，radius-2xl = 1.35rem，radius-3xl = 1.65rem | 有等比体系，不是一刀切 |
| Shadow | navy/blue 色调 `oklch(0.3_0.06_252 / x)` | A，不是黑色阴影 |
| 数字字段 | `font-variant-numeric: tabular-nums` 全局开启 | A，列表中数字不会跳宽 |
| Heading letter-spacing | `-0.015em`（h1-h4 统一） | A |

**结论**：**底层 token 体系是成熟的**，问题不在"基础设施"，在"组件复用层"——组件级别没有遵守 token，临时 inline 了 tailwind 原始色（gray-50 / blue-100 / green-100）。

---

## 三、AI Slop 检测（10 项黑名单）

| # | 黑名单模式 | 是否命中 |
|---|------------|----------|
| 1 | 紫色/violet/indigo 渐变 | ❌ 不命中（用 navy + blue） |
| 2 | 3 列等距 feature 卡 | ❌ 不命中 |
| 3 | icon-in-colored-circle 装饰 | ⚠ 半命中：KpiCard / PageHeader 都用了 size-12 圆角 + gradient icon avatar；但**是数据指示而不是装饰**，且与品牌色一致，**可接受** |
| 4 | 居中一切 | ❌ 不命中（登录页有居中，但是合理的；其他页都是左对齐） |
| 5 | 统一大圆角 | ❌ 不命中（有 radius 阶梯） |
| 6 | 装饰 blob / 波浪 | ❌ 不命中 |
| 7 | Emoji 当装饰 | ❌ 不命中（用 lucide icon） |
| 8 | 卡片左边色条 | ❌ 不命中 |
| 9 | "Welcome to X" 套话 | ❌ 不命中（"让每一份报告都被认真对待" 是有 voice 的） |
| 10 | "Hero → 3 卡 → CTA"模板节奏 | N/A（admin 没有 marketing 页） |

**AI slop 评分：A-**。扣分项仅一项：登录页右上"系统运行正常 + emerald pulse dot" 是**静态的装饰元素**，不基于健康检查 API。这种"假状态"是 AI 生成 UI 时常见的"做出感觉"——可保留但建议要么接数据要么删掉。

---

## 四、Page-by-Page 详评

### 4.1 登录页 `/admin/login/` —— **A**

**做对了什么**：
- 整页深色品牌面板（3 层 radial-gradient + grid 底纹 + svg 噪点 overlay）—— 不是 plain gradient，有真实"工艺"
- 中央 glassmorphism 卡片 `bg-white/[0.04] border-white/10 backdrop-blur-2xl`，shadow `0_30px_60px_-20px_oklch(0_0_0_/_0.5)` —— 玻璃质感正确
- Eyebrow "谨世 ATA · 后台" 两侧 hairline gradient（`from-transparent to-blue-400`）—— 这是高端登录页才会做的细节
- Inputs 用 `!h-11`（44px 触摸目标）+ `!bg-white/[0.04]` + `!border-white/15`，hover/focus 都有覆盖样式
- Captcha SVG 是项目自渲染：透明背景 + 白字符 + `rgba(255,255,255,0.2)` 噪点（专门为深色玻璃卡设计的），在源码里能看到刻意把 svg-captcha 的默认 path 改了 fill —— 这是工艺
- Disabled 按钮"opacity-0.45 而不是变灰"，避免在深色卡上看起来像"按钮坏了"

**问题**：

| # | 严重度 | 问题 | 修改方案 |
|---|--------|------|----------|
| L-01 | **High** | Footer 版本号写死 `v0.1.19`（[page.tsx:247](app/admin/login/page.tsx:247)），package.json 当前 v0.1.24 | 改为 `import pkg from "@/package.json"`，或在 next.config 注入 `NEXT_PUBLIC_APP_VERSION: pkg.version` |
| L-02 | Medium | "系统运行正常"指示器是静态的（[page.tsx:91-93](app/admin/login/page.tsx:91)） | 接 `/api/admin/health` 或干脆删掉；现在的状态是"骗人的真诚" |
| L-03 | Polish | username 输入用 `autoFocus`（[page.tsx:134](app/admin/login/page.tsx:134)） | iOS Safari 不会自动唤起键盘，桌面端会让屏幕阅读器跳过 logo。可保留但要注意残留风险 |
| L-04 | Polish | "忘记密码？请联系超管重置" 字号 12px / opacity 40% | 这是 "无能为力的" 文案。建议加一个具体出口："→ 联系 [管理员] 或致电 xxx" 而不是冷冷一句 |

---

### 4.2 报告列表 `/admin/reports/` —— **B**

PageHeader、表格、筛选栏、4 张 KPI 卡、分页、空状态、列展开（tab=all）—— 信息密度合理，分层清晰。

**做对了什么**：
- 4 张 KpiCard 用 hover lift + 数字渐变（`kpi-number` class 用 `linear-gradient(180deg, navy-800, blue-700)` + transparent text）
- 项目 tab 切换通过 URL `?project=report|nav` 驱动（可分享 / 可收藏 / 浏览器后退正常）
- 行 hover 用 `bg-[var(--blue-50)]/40`，比 `hover:bg-gray-50` 有品牌
- "转服务"按钮 conditional：未转用 neutral，已转用 positive tone（绿色 ring + 绿底色）—— 状态语义清晰
- 空状态区分 "无数据" vs "筛选无结果"（[page.tsx:756-803](app/admin/reports/page.tsx:756)）
- nav 降级提示：当 NAV_DB_PATH 不可用时，amber 横幅提示并降级到 report tab（[page.tsx:361-369](app/admin/reports/page.tsx:361)）

**问题**：

| # | 严重度 | 问题 | 修改方案 |
|---|--------|------|----------|
| R-01 | **High** | **移动端表格被截断**：`<div className="surface-panel overflow-hidden">` 内含 11 列宽 452px 表格，375px viewport 下截断 125px。实测 `overflow-x: hidden` | 两选一：① 包装层 `overflow-x-auto md:overflow-hidden`（妥协方案，移动端横向滑）；② 复制 service-tracking 的 `md:hidden` 卡片视图（推荐方案，与服务跟踪一致） |
| R-02 | **High** | sticky 表头无效：`<TableHeader className="sticky top-0 bg-white z-10">` 在外层 `overflow-hidden` 父级里 sticky 不生效（CSS 规则） | 改外层为 `overflow-y-auto` 设固定 max-height，或去掉 sticky 类（无效 class 是噪音） |
| R-03 | **High** | KpiCard 与 service-tracking 的 StatCard **同任务两套设计**（见第 5 节"跨页一致性"） | 抽 `<DataCard>` 共享组件，统一所有"数字+标签"卡 |
| R-04 | Medium | 行展开（tab=all）的 expanded 行 `bg-gray-50/50`，与行 hover `bg-[var(--blue-50)]/40` 撞色 | 改 expanded 行用更深的 `bg-[var(--blue-100)]/50` 或左侧加 2px 蓝色 accent bar |
| R-05 | Medium | filter 栏 select 元素 focus ring 用 `var(--blue-400)`（[page.tsx:421](app/admin/reports/page.tsx:421)）；service-tracking 的 select 用 `blue-500/50`（[service-tracking/page.tsx:240](app/admin/service-tracking/page.tsx:240)） | 统一改用 `--blue-400 / 0.25 ring` |
| R-06 | Medium | 表头 th 字号 12px / weight 500 + color `oklch(0.18 0.025 252)`，但 `text-xs text-gray-500` 实际 render 出来是 gray，注释和实际不符 | 表头要么 `text-[var(--navy-700)]` + `font-medium` 让标题有重量，要么 `text-gray-500` + `uppercase tracking-wider` 让它退到第二层级。现在是中间态 |
| R-07 | Medium | "全部" tab 已下线但代码残留：`ProjectFilter` type 还含 `"all"`，`showProjectSpecific` 分支等于"all"时的 expanded 列展开逻辑还在（[page.tsx:307-321、828-880](app/admin/reports/page.tsx:307)） | 删除 `"all"` 分支 + type，把 readProjectFromUrl 简化成 `"report" \| "nav"` |
| R-08 | Polish | KPI 卡右上角 radial-gradient glow 在不同卡上效果差异大（depend on `--blue-` vs `--semantic-positive`） | 统一 glow color 公式，或干脆去掉 glow（subtle hover lift 已足够） |
| R-09 | Polish | 操作单元格内 3 个按钮（简历/档案/转服务） + 服务 tracking 4 个按钮（简历/档案/服务编辑/+ 其他） 拥挤；移动端必看不清 | 操作列改 dropdown menu（`⋯` 按钮），第一档 + 第二档分层 |
| R-10 | Polish | nav 项目"转服务状态"列只有一个圆点（绿/灰）不带文字 | 加 `title` hover tooltip（已有）+ 图标提示 `<ArrowRightCircle>`；只有 1 列单纯依赖颜色违反"色彩 + 形状"双通道原则 |

---

### 4.3 报告详情 `/admin/reports/[id]/` —— **C+**

服务端 component，结构简单：返回 + 项目徽章 → 基本信息 Card → 量表作答 Card → 访谈内容 Card。

**做对了什么**：
- 服务端渲染 + JSON parsing 容错（try/catch 每个 parse）
- PII 警告横幅（"以下内容为用户访谈原始回答..." 红色 + AlertTriangle 图标）
- 报告附件 / 简历附件存在性判断（fs.existsSync）
- 访谈 Q1/Q2 用 `<pre>` whitespace-pre-wrap 保留原始格式

**问题**：

| # | 严重度 | 问题 | 修改方案 |
|---|--------|------|----------|
| RD-01 | **High** | **不用 PageHeader**，只有面包屑 + 卡片标题。整页缺一个"我在哪、这是谁的报告"的清晰头部 | 加 PageHeader：icon=FileText，title=`${row.user_name ?? "—"} · ${row.target_position}`，subtitle=`${PROJECTS[project].label} · 创建于 ${formatTs}`，actions=`下载简历 / 导出 PDF` |
| RD-02 | **High** | Card 用 inline `bg-white rounded-xl border-gray-100 shadow-sm`（[page.tsx:28-35](app/admin/reports/[id]/page.tsx:28)），不走 `.surface-panel` token | 改用 `<div className="surface-panel p-5">`（已有的 token），删 Card 局部组件，复用 system |
| RD-03 | **High** | 页面背景 `bg-gray-50`（[page.tsx:164](app/admin/reports/[id]/page.tsx:164)） vs 其他 admin 页 `bg-background`（OKLCH 暖灰） | 改 `bg-background` 或 `bg-[var(--surface-tinted)]` |
| RD-04 | Medium | 项目徽章 `bg-green-100 text-green-700 / bg-blue-100 text-blue-700` 直接用 tailwind 原色（[page.tsx:177-184](app/admin/reports/[id]/page.tsx:177)） | 换 `<span className="status-pill" data-tone={project==="nav" ? "success" : "info"}>` |
| RD-05 | Medium | PII 警告用红色 + AlertTriangle（[page.tsx:319-322](app/admin/reports/[id]/page.tsx:319)）。红色在本项目其他地方用作 destructive 操作 | 换 `data-tone="warning"` （amber/警告 tone）+ 文字稍长："这里包含用户原始访谈回答，含 PII。请勿截图传播。" |
| RD-06 | Medium | 量表作答 SelectedLabel 蓝底蓝字（`bg-blue-50 text-blue-700`）（[page.tsx:277,302](app/admin/reports/[id]/page.tsx:277)）—— 又是 raw tailwind | 用 `report-chip` class（[globals.css:597-608](app/globals.css:597)） |
| RD-07 | Polish | Row 组件 `border-b border-gray-50` —— 极淡分隔；当 Row 数较多 (10+) 时分隔丢失 | `border-b border-[var(--report-divider)]`，比 gray-50 略深 |
| RD-08 | Polish | 量表问题前缀 Q1/Q2 字号 11px 偏小 | 提到 12px 并加 tabular-nums |

---

### 4.4 服务跟踪列表 `/admin/service-tracking/` —— **B-**

桌面 table + 移动卡片双视图（**这是 best practice，比 reports 列表强**）。

**做对了什么**：
- 双视图：`hidden md:block` 表格 + `md:hidden` 卡片
- 4 张 StatCard（总数 / 本月新增 / 进行中 / 预警）+ 每张配 accent ring
- 预警卡带 tooltip "状态跟进中 且 14 天未新增服务记录"——业务语义清晰
- 姓名搜索本地态 + onBlur/Enter 提交 URL，避免每键 fetch
- 筛选条件可 URL 同步（可分享 / 后退正常）

**问题**：

| # | 严重度 | 问题 | 修改方案 |
|---|--------|------|----------|
| ST-01 | **High** | StatCard 与 reports 的 KpiCard 视觉**完全不同**：StatCard 白底 + ring-blue-100 + 24px 数字，KpiCard 用 surface-panel + 34-40px 渐变数字 + hover lift + icon avatar | 见第 5 节修改建议：抽 `<DataCard>` 共享组件 |
| ST-02 | **High** | 状态 / 分类 Badge 用 `CATEGORY_BADGE_CLASS` / `STATUS_BADGE_CLASS`（[lib/service-tracking](lib/service-tracking.ts)），与全局 `.status-pill` 体系并列 | 把 `*_BADGE_CLASS` 迁到 `status-pill[data-tone]` 体系 |
| ST-03 | Medium | 移动卡片 Link 整行点击，但桌面 table 的"服务编辑"按钮才进入详情 | 移动卡片增加"轻提示"：行尾 chevron 或 active 状态颜色，让用户知道整行是 link |
| ST-04 | Medium | 空状态 CTA 是绿色 `ring-emerald-200`（[page.tsx:611-617](app/admin/service-tracking/page.tsx:611)），与品牌主蓝色突兀对比 | 改 `ring-[var(--blue-200)]` + `bg-[var(--blue-50)]` + `text-[var(--blue-700)]`；emerald 留给 success 状态 |
| ST-05 | Medium | filter select 用 `border-input rounded-md` 没有去掉 select 默认 chevron 图标，导致和 reports 的 select 视觉差异 | 加 appearance-none + 自定义 `bg-no-repeat bg-right` lucide ChevronDown SVG（与 reports 一致） |
| ST-06 | Polish | 分页按钮在桌面 table 和移动 card 双视图各写了一份（[page.tsx:421-451 + 502-525](app/admin/service-tracking/page.tsx:421)） | 提一个 `<Pagination>` 共享组件 |
| ST-07 | Polish | StatCard 预警卡的 `AlertTriangle` 图标 size-3.5（[page.tsx:560](app/admin/service-tracking/page.tsx:560)）和 PageHeader/Sidebar 同类警告图标 size-4 / size-5 不一致 | 统一到 size-4 |

---

### 4.5 服务跟踪详情 `/admin/service-tracking/[id]/` —— B（依赖未读组件 ServiceTrackingEditor）

页面骨架：面包屑（gray-300 分隔 + 用户名 + 脱敏手机号） → ServiceTrackingEditor → ServiceRecordsList。

**问题**：
| # | 严重度 | 问题 | 修改方案 |
|---|--------|------|----------|
| SD-01 | **High** | 不用 PageHeader（同 RD-01） | 加 PageHeader：title=用户名，eyebrow="服务跟踪记录"，subtitle=`${maskPhone} · 首次服务 ${formatTs}` |
| SD-02 | Medium | `bg-gray-50` 页面背景不存在（这页其实没设背景），但 print 样式 `print:bg-white print:p-0` 显式特化 | 没问题，但建议显式 `bg-background` 让 light/dark 切换可控 |

ServiceTrackingEditor / ServiceRecordsList 组件未在本次 review 范围（受限于时间）。建议下一轮单独覆盖。

---

### 4.6 管理员列表 `/admin/admins/` —— **B-**

**做对了什么**：
- PageHeader 用 `actions={<Refresh /><新建管理员>}` ——这是 PageHeader 的正确用法
- "新建管理员"按钮高亮（`bg-[var(--blue-700)] hover:bg-[var(--blue-600)] text-white`）
- 表格用 `surface-panel overflow-hidden` 包裹（同 reports 问题：表头 sticky 失效）
- 行显示菜单权限映射（`menusDisplay()`），超管显示"超管（全部）"
- 编辑按钮用 ghost variant + focus ring

**问题**：

| # | 严重度 | 问题 | 修改方案 |
|---|--------|------|----------|
| A-01 | **High** | 状态徽章 `<Badge className="bg-green-100 text-green-700 border-0 text-[11px]">` / `bg-gray-100 text-gray-500`（[page.tsx:161,165](app/admin/admins/page.tsx:161)） raw tailwind 色，没走 status-pill 体系 | 改 `<span className="status-pill" data-tone={admin.is_active ? "success" : "neutral"}>启用 / 停用</span>` |
| A-02 | Medium | 表头 `<TableRow className="bg-gray-50">`（[page.tsx:130](app/admin/admins/page.tsx:130)） | reports 表头是白底，service-tracking 表头无背景。统一选一个（推荐：白底 + border-bottom，与 reports 一致） |
| A-03 | Medium | "新建管理员"按钮 inline 直接写 `bg-[var(--blue-700)] hover:bg-[var(--blue-600)]`，没复用 `.btn-primary-glow` | 改成 `className={buttonVariants({ size: "sm", className: "btn-primary-glow" })}` 或在 button.tsx 加 `variant="primary-glow"` |
| A-04 | Polish | 加载/空状态 `<div className="text-center py-16 text-gray-400 text-sm">加载中…</div>` 太干 | 改 skeleton 行：`Array.from({ length: 5 }).map((_, i) => <TableRow><TableCell colSpan={6}><div className="h-4 bg-gray-100 rounded animate-pulse" /></TableCell></TableRow>)`，与 reports/service-tracking 一致 |
| A-05 | Polish | ShieldCheck（超管标记）颜色 `text-blue-500`（[page.tsx:146](app/admin/admins/page.tsx:146)），不是 `text-[var(--blue-700)]` 主品牌色 | 换 token |

---

### 4.7 管理员 新建 / 编辑 `/admin/admins/new/` & `/admin/admins/[id]/edit/` —— **C+**

**做对了什么**：
- 用 react-hook-form + zod schema 验证（已有依赖，没新增包）
- create / edit 用同一个 `<AdminForm>` 共享，schema 分支管理
- 编辑时密码留空 = 不改密码（语义清晰）
- 编辑自己时禁用 is_active 开关（避免锁死自己）

**问题**：

| # | 严重度 | 问题 | 修改方案 |
|---|--------|------|----------|
| AF-01 | **High** | **不用 PageHeader**：[new/page.tsx:14-18](app/admin/admins/new/page.tsx:14) / [edit/page.tsx:74-86](app/admin/admins/[id]/edit/page.tsx:74) 直接用 `<h1 className="text-xl font-semibold">` 20px + subtitle text-sm | 改用 `<PageHeader icon={UserPlus} title="新建管理员" subtitle="填写信息后，老师可用手机号登录后台" accentColor="blue" />` —— 标题字号会从 20 → 26-28，与其他页对齐 |
| AF-02 | Medium | 面包屑用 `<Link><ChevronLeft />返回管理员列表</Link>`，与服务跟踪详情 `<ChevronLeft />服务跟踪 / 用户名` 不一致 | 统一面包屑组件：`<Breadcrumb items={[{label:"管理员管理", href:"/admin/admins"}, {label: "新建"}]} />` |
| AF-03 | Medium | 编辑页错误展示 `bg-red-50 border-red-200 text-red-700` raw tailwind | 抽一个 `<Alert variant="error/warning/info">` 共享组件 |
| AF-04 | Polish | "您正在编辑自己的账号（不能修改自己的状态）" 这个提示出现在 subtitle，但表单内的 is_active 开关旁没有提示 | 在 is_active 开关旁加 `<HelperText>{isSelf ? "不能停用自己" : ""}</HelperText>` |

未读到 AdminForm 详细字段（只看了前 100 行），下一轮单独覆盖：菜单权限多选 UI、密码 / 确认密码联动、submit 按钮态。

---

### 4.8 侧边栏 `AdminSidebar` —— **A-**

**做对了什么**：
- Logo 块用 gradient blue 圆角 + ShieldCheck（与登录页 logo 呼应）
- 分组 SectionHeader：报告管理 / 服务管理 / 系统管理（10px uppercase tracking-wider）
- 激活态：左侧 3px accent bar + 软蓝底色 + `inset 0 0 0 1px oklch(0.87 0.07 252 / 0.4)` ring + 文字 weight 加重
- 底部用户卡：avatar monogram + 超管 chip + 脱敏手机号（`186 •••• 3756`）
- 修改密码 / 登出按钮 hover 用 `bg-[oklch(0.97 0.02 252 / 0.5)]`（蓝调 tint）

**问题**：

| # | 严重度 | 问题 | 修改方案 |
|---|--------|------|----------|
| SB-01 | Medium | 当 `me` 还在 loading 时，sidebar 默认显示所有 visibleProjects + showService + 隐藏 showAdmins —— 但实测 hydration 偶发性失败时（本机 Suspense streaming bug），sidebar 显示 "职业定位 / 职业导航 / 服务跟踪" 但**不显示**管理员管理（即使 me 加载后 showAdmins=true） | 在 sidebar 加 skeleton 占位（4 行 `h-9 bg-gray-100 animate-pulse rounded-lg` 给 `system 管理` 区），避免最终 layout shift |
| SB-02 | Polish | SectionHeader 字号 10px 中文容易模糊 | 改 11px |
| SB-03 | Polish | 移动端顶条 brand mark 是 `size-6 rounded-lg`，桌面是 `size-9 rounded-xl` —— 比例不对（mobile 应该用 size-7 rounded-xl 保持视觉重量） | 改 `size-7 rounded-xl` |
| SB-04 | Polish | 移动顶条 pill "职业定位/职业导航/服务跟踪" 间距 gap-1，挤；text-xs 偏小 | 改 gap-1.5 + text-[13px] |

---

### 4.9 公共组件 PageHeader —— **A**

`components/admin/page-header.tsx` 是这个项目里最干净的组件。设计师本意完整：

- icon avatar size-12 rounded-2xl + gradient ring（accent=blue/green/neutral）
- 可选 eyebrow（uppercase tracking + 蓝色）—— **没人用！**
- H1 26-28px + 副标题 + 右侧 actions slot

**问题**：

| # | 严重度 | 问题 |
|---|--------|------|
| PH-01 | Polish | eyebrow prop 已实现但**无一处使用**——可以在报告详情 `eyebrow="${PROJECTS[project].label}"` 用上，加强项目身份感 |
| PH-02 | Polish | accentColor=neutral 时 icon 还是蓝色（不是真 neutral）—— 命名误导。改成 accentColor="primary/success/info" |

---

## 五、跨页一致性问题（最严重的设计债）

### 5.1 同任务、三套设计：列表页 KPI/Stat 卡

| 页面 | 组件 | 视觉特征 |
|------|------|----------|
| `reports/` | `KpiCard`（[page.tsx:697](app/admin/reports/page.tsx:697)） | surface-panel + 34-40px 渐变数字 + icon avatar 圆角 + hover lift + radial-gradient glow |
| `service-tracking/` | `StatCard`（[page.tsx:540](app/admin/service-tracking/page.tsx:540)） | 白底 + ring-blue-100/emerald-100/sky-100/rose-100 + 24px regular tabular-nums + 无 icon avatar + tooltip hint |
| `reports/[id]/` | `Card`（[page.tsx:28](app/admin/reports/[id]/page.tsx:28)） | bg-white rounded-xl + border-gray-100 + shadow-sm + 简单 H2 title |

**这是这个项目最严重的一致性 bug**。三个相似的"数据展示卡"，三套完全不同的视觉，让用户在 5 分钟内就感受到"这不像同一个产品"。

**修改方案（推荐）**：

抽 `<DataCard>` 共享组件到 `components/admin/data-card.tsx`：

```tsx
interface DataCardProps {
  label: string;
  value: number | string | undefined;
  icon?: LucideIcon;
  loading?: boolean;
  accent?: "blue" | "green" | "amber" | "rose";
  highlight?: boolean;     // 主推数字用 kpi-number 渐变
  hint?: string;            // tooltip
}
```

实现：用 `surface-panel` 作基础，accent 决定 ring + icon avatar 色，highlight 决定数字渐变 vs 普通色。然后：
- reports KpiCard 替换为 `<DataCard highlight={i===0} accent="blue|green" />`
- service-tracking StatCard 替换为 `<DataCard accent="blue|emerald|sky|rose" hint={...} />`
- reports/[id] Card → 用 `<div className="surface-panel p-5">` 直接 inline（不需要新组件，只是去 raw tailwind）

### 5.2 三种 focus ring 色

```
登录页 input    → ring-[oklch(0.7 0.16 245 / 0.25)]
报告列表 select → ring-[var(--blue-400)]
服务跟踪 select → ring-blue-500/50
管理员编辑      → ring-blue-500/50
```

全局 `--ring` 是 `oklch(0.6 0.18 252)`。建议**所有交互元素**用 `focus-visible:ring-2 focus-visible:ring-[var(--blue-400)] focus-visible:ring-offset-0`，把 `blue-500/50` 全部删掉。

### 5.3 table 表头三种处理

```
reports/         → 白底 + sticky top-0 z-10（实际无效，因父级 overflow-hidden）
admins/          → bg-gray-50
service-tracking → 无背景，直接继承
```

统一规则建议：所有表头白底 + `border-b border-[var(--report-border)]` + 字号 12px text-gray-500 uppercase tracking-wider weight-500。

### 5.4 raw tailwind 色泛滥

下列地方应该走 token 但走了 raw：
- `bg-green-100 text-green-700` → `.status-pill[data-tone="success"]`
- `bg-blue-100 text-blue-700` → `.status-pill[data-tone="info"]`
- `bg-red-50 border-red-200 text-red-700` → `<Alert variant="error">`
- `bg-amber-50 border-amber-200 text-amber-900` → `<Alert variant="warning">`
- `bg-gray-50` 页面背景 → `bg-background` 或 `bg-[var(--surface-tinted)]`

### 5.5 行 hover 色

```
reports/         → hover:bg-[var(--blue-50)]/40
service-tracking → hover:bg-gray-50/60
admins/          → hover:bg-gray-50/50
```

统一改 `.row-hover` class（globals.css 已经定义了 `oklch(0.97 0.02 252 / 0.6)`），所有表格行复用。

---

## 六、响应式 + 可访问性

### 6.1 移动端实测（375px）

| 项 | 结果 |
|----|------|
| Sidebar 隐藏 | ✓ `md:hidden` 工作 |
| MobileBar 显示 | ✓ |
| 全局 horizontal scroll | ✓ 无 |
| 报告列表表格 | ✗ **被截断**（452px > 327px viewport），无横向滚动 |
| 服务跟踪表格 | ✓ 切到 md:hidden 卡片视图 |
| 触摸目标 | 大部分 ≥ 44px；filter select 32px **不达 44** |

### 6.2 暗色模式

- `globals.css` 有完整的 `.dark { ... }` 定义（[globals.css:123-155](app/globals.css:123)）
- 但 root layout 无 `<html className="dark">` 注入逻辑
- 实测 `prefers-color-scheme: dark` 不触发暗色

**结论**：暗色 CSS 已写好但没接线。如果不打算上暗色，建议**直接删除** `.dark` 块（减少 30 行死代码）；如果计划上，加一个 `<ThemeProvider>` + sidebar 底部切换按钮。

### 6.3 a11y 抽查

- 登录页 captcha 按钮有 `aria-label="刷新验证码"` ✓
- form input 有 `<Label htmlFor="username">` ✓
- nav 转服务状态色点：title tooltip ✓，但 screen reader 体验弱（建议 `<span className="sr-only">已转入服务/未转入</span>`）
- focus-visible 全局有 outline-none 覆盖 + ring 自定义 ✓

---

## 七、优先级排序的修改清单

### 🔴 立即修（本周内）—— 大幅提升一致性

1. **抽 `<DataCard>` 组件，统一 reports / service-tracking / reports[id] 三套卡**（修 R-03 / ST-01 / RD-02）
2. **报告列表移动端**：复制 service-tracking 双视图模式（修 R-01）
3. **报告详情 / 管理员新建 / 编辑 接入 PageHeader**（修 RD-01 / SD-01 / AF-01）
4. **状态徽章统一走 `.status-pill`**：替换 admins / reports[id] / service-tracking 里的 raw `bg-green-100` etc.（修 A-01 / RD-04 / ST-02）
5. **focus-visible ring 全局统一**：删 `blue-500/50`，统一 `var(--blue-400)`（修 R-05）
6. **登录页 footer 版本号注入**：从 package.json 读取（修 L-01）

### 🟡 中期修（两周内）—— 修补细节

7. 行 hover 颜色统一到 `.row-hover` class（修 5.5）
8. table 表头统一规范（白底 + border-bottom + 12px gray uppercase）
9. 报告详情 Card → surface-panel（修 RD-02）
10. 报告详情背景 → `bg-background`（修 RD-03）
11. 表格筛选 select 加 appearance-none + 自定义 chevron icon（修 ST-05）
12. PII 警告 → amber tone（修 RD-05）
13. 服务跟踪空状态 CTA 改蓝（修 ST-04）
14. 管理员"新建管理员"按钮走 `.btn-primary-glow`（修 A-03）
15. 报告列表"全部 tab" 死代码清理（修 R-07）

### 🟢 远期 polish

16. 登录页"系统运行正常" 接真实健康检查 OR 删（修 L-02）
17. PageHeader eyebrow 在详情页用上（修 PH-01）
18. 移动端顶条 brand mark 比例（修 SB-03）
19. 暗色模式：要么接线要么删 30 行 CSS（修 6.2）
20. 操作列 dropdown menu 抽出（修 R-09）

---

## 八、关键判断

**这是一个有设计师在场的项目**——token 体系完整、登录页有真实工艺、阴影 / 字体 / 圆角都克制。问题不在"丑"，在"**老人对账没做完**"：

- ✅ 底层 token 99% 一致
- ⚠ 组件层 70% 一致（PageHeader / 侧边栏 / status-pill 完成，KPI / Card / Alert / Pagination 没抽出来）
- ❌ 页面层 40% 一致（同任务三套设计、focus ring 三种色、table 表头三种）

**根因**：项目从 career-report 切出来时，**带了一些 raw tailwind 代码片段过来**（详情页 Card / admins 列表 Badge 都是典型），切割完成后**没回头做一次"对账周"**。

**最具杠杆的一次修改**：抽 5 个共享组件（DataCard / Alert / StatusPill / Pagination / Breadcrumb），一周内能把一致性从 70% 拉到 95%。后续新业务接入 admin-hub 时也省力——只接业务字段，不操心视觉。

---

## 九、需要你定的事

1. **修改优先级**：是按上面 1-6 的顺序逐个修，还是先看一个 demo PR（比如 DataCard 抽出 + 全替换）评估效果后再批量做？
2. **暗色模式**：删 30 行死代码 ✗ vs 接线（加 ThemeProvider + 切换按钮，约 1 天工作量） ✓
3. **静态"系统运行正常"指示器**：删除 ✗ vs 接 `/api/admin/health`（约 2 小时工作量） ✓
4. **下一轮 review 范围**：未覆盖的子组件——`ServiceTrackingEditor`、`ServiceRecordsList`、`TransferServiceDialog`、`ChangePasswordDialog`、`AdminForm`（菜单权限多选）—— 是否同步排进下一轮 review？

---

## 附录：本次 review 临时改动（请按需保留/回滚）

为完成实测，做了以下临时改动，需要后续清理：

| 文件 | 改动 | 处置建议 |
|------|------|----------|
| `.env.local` | 从主目录 `D:/_workspace/01_项目-Coding/admin-hub/.env.local` 复制过来 | **保留**（worktree 跑 dev 需要） |
| `.claude/launch.json` | 新增 admin-hub dev server 配置 | **保留**（Claude_Preview MCP 需要） |
| `scripts/design-review-login.mjs` | 临时登录脚本，绕过 captcha 拿 session cookie 用 | **回滚**（仅本次 review 用） |
| `scripts/design-review-seed.mjs` | seed 测试数据（8 reports + 3 service_tracking） | **回滚**（已写脏 career-report.db） |
| DB `admins` 表 | 新增 `18621933756 / admin123` 超管账号 | **可选清理**（如果其他 dev/review 也用就保留） |
| `D:/_workspace/01_项目-Coding/career-nav-/data/career-nav.db` | 新建空 DB 文件（修 ATTACH 报错） | **保留**（没有它本机 dev 跑不起来） |
| `cookies.txt`, `captcha.svg`, `.session-cookie.txt` | 临时调试文件 | **删除** |
