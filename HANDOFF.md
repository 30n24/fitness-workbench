# 健身计划工作台（fitness-workbench）续接说明

> 用途：新开任务会话时，把本文件内容贴给 AI，它即可无缝衔接，不必重新了解项目。
> 最后更新：v54（2026-07-31）。代码托管：GitHub Pages `30n24/fitness-workbench`。

---

## 1. 项目是什么

一个**单文件 PWA 健身计划工作台**，给两个人（计划 A / 计划 B）做训练 + 饮食 + 碳循环记录。
核心诉求（用户原话风格的要点）：

- 饮食登记**忠实于用户输入**：用户输入什么文字，餐名就显示什么（如「半碗米饭」「番薯半斤」「瑞幸百香果美式不另外加糖」），但热量/碳水要按量词**精确计算**。
- **碳循环控制**是重点：需要每天碳水摄入量统计，且能自主修正。
- 品牌风味饮料（瑞幸/库迪等）品类极多（果味美式、风味拿铁、椰系、果茶），且有「不另外加糖/微甜/少甜/七分糖/标准糖」等甜度分级，必须精确识别计算。

---

## 2. 文件结构（/workspace/deploy/）

| 文件 | 作用 |
|------|------|
| `index.html` | **主程序**，单文件含全部 HTML/CSS/JS，当前 **5021 行**。改功能只改这里。 |
| `fresh.html` / `wb.html` | `index.html` 的同步副本。**每次改完 index.html 必须 `cp index.html fresh.html && cp index.html wb.html`**。 |
| `sw.js` | Service Worker。`CACHE_NAME` 需与 `index.html` 里的 `APP_VER` 同步递增。 |
| `manifest.json` / 图标 | PWA 安装资源，一般不动。 |

**版本号铁律**：改 `index.html` 后
1. `index.html` 内 `const APP_VER='NN';`（当前 1704 行）递增；
2. `sw.js` 内 `const CACHE_NAME='fitness-workbench-vNN';`（第 3 行）同步递增；
3. `cp index.html fresh.html && cp index.html wb.html`；
4. 提交并 `git push`（仓库 `30n24/fitness-workbench`，分支 `main`）。

`APP_VER` 变更会触发 `localStorage` 比对 → 清除旧 SW 缓存 → `location.reload(true)`，强制手机拉取新文件。

---

## 3. 关键架构与已落地的设计

### 3.1 食物热量/碳水三级查找（matchFoodCal 等）
1. **本地 `FOOD_DB`**（当前 `const FOOD_DB=[` 在 3110 行）：每项含 `cal`（每 100g 热量）与 `carb`（每 100g 碳水）。生鲜/常见食材走这里。
2. **USDA 直查** `usdaLookupFood`：英文/生鲜食材名，无需 API Key。
3. **AI 查** `aiLookupFood`：仅中式品牌/菜品需要「数据管理 → 🤖 AI 查热量」填的 AI Key。

> 链路是**短路式**：本地命中就不走网络。测试时屏蔽 `api.github.com` / `api.nal.usda.gov` / `fdc.nal.usda.gov` 可强制走本地路径。

### 3.2 忠实登记（v32 确立）
所有登记路径（本地/品牌饮料/USDA/AI）统一把 `raw.trim()` 存为餐名 `name`；别名只用于查热量/碳水，**不**改写显示名。
- `registerMeal(kind,name,cal,carb,inputId)`：把 `{name,cal,carb,matched:name}` 推入当日记录并重渲染。
- 餐项已显示碳水：`<span class="md">${it.carb}g碳</span>`。

### 3.3 品牌风味饮料甜度插值（resolveSugarDrink）
`FLAVORED_DRINKS` 表每项给两个锚点：`cal0/carb0`（不另外加糖）与 `cal1/carb1`（标准糖），甜度系数 `f` 插值：
- `不另外加糖=0`｜`微甜/少少甜/三分糖=0.25`｜`半糖/少甜/少糖/五分糖=0.5`｜`七分糖=0.7`｜`标准糖/全糖=1`（默认）
- 杯型：`小0.8/中1/大1.2/超大1.4`；支持数量倍乘 `qty`。
- **通用兜底**：未在表里的「果味美式/风味拿铁/果茶」按品类正则（`FLAVOR_RE`/`FRUIT_RE`）估算，标「·通用估算」。
- 品牌无关：靠饮料名子串匹配，瑞幸/库迪/星巴克等都覆盖。

### 3.4 量词解析（matchFoodCal）
支持**前缀量词**（`半碗米饭`）与**尾随量词**（`番薯半斤`、`2个鸡蛋 250ml牛奶`）。`cnNumToArabic` 处理中文数字。

### 3.5 碳水统计（v33 + v35，本次重点）
- **每餐小计**：`renderMeal` 末尾 `合计 ${total}kcal · ${totalCarb}g碳`。
- **底部汇总**：`renderDietSummary`「今日饮食汇总」卡片含逐餐 `kcal · g碳`，并新增高亮行 **「今日总碳水 Xg」**（绿色）。
- **顶部实时读数**（v35 新增）：饮食页顶部碳水循环区下方 `dietCarbNow` 显示大字号 `🍚 今日碳水 Xg` + 低碳/高碳标签，**进来第一眼可见**，解决移动端长页面底部汇总被忽略的问题。
- **自主修正（✎）含碳水**（v33）：点 ✎ 先弹「修正热量(kcal)」再弹「修正碳水(g)」，两步独立，任一步取消不影响另一步。

---

## 4. 已实现的版本脉络

| 版本 | 内容 |
|------|------|
| v27–v32 | 风味饮料甜度精确识别；瑞幸全品类覆盖；忠实登记（名=输入）；量词精确计算 |
| v33 | 每日碳水统计（每餐+全天）+ ✎碳水修正 |
| v34 | 移除顶/底栏 `backdrop-filter:blur` 降低手机发热（毛玻璃每帧重绘是发热主因） |
| v35 | 饮食页顶部新增醒目「今日碳水」实时读数 |
| v36 | 动作库/食物库超长自动折叠（>8 项折叠，点「展开全部 N」展开）；顺带修复进训练页动作库空白的潜在 bug |
| v37 | 修复概览页计划 B 部位分布缺失+英文（renderStats 的 partNames 对齐 PARTS_B，并兼容 classifyPart 写入的纯 key） |
| v38 | 降发热：页面隐藏(`visibilitychange`)即暂停全部 `infinite` 动画（`app-hidden` 类）+ 停 30s 云同步定时器；`foodList` datalist 按「自定义食物签名」缓存，仅变化时重建。画面使用时完全不变 |
| v39 | 概览页计划 B 部位分布改为列出该计划全部 5 个部位（胸/肩/背/腹/腿），含 0 次的也显示；合并 `PARTS_B` 的 `_b` 后缀 key 与 `classifyPart` 写入的纯 key 一起计数 |
| v40 | 修复手机顶部状态栏（时间/电量）被顶栏覆盖：`.topbar` 吸顶锚点 `top:0`→`top:var(--safe-t)`，并用 `::before` 把背景铺到状态栏底下（无缝）；不动顶栏高度，部位栏/动作搜索栏吸顶不受影响 |
| v41 | 修复动作自定义输入框在手机上被原生 datalist 自动替换/截断：移除 `exInput` 的 `list="exList"`，改由 JS 渲染常用动作点击小标签（`#exQuick`），点一下填入，不再触发浏览器自动补全删字；并加 `autocomplete="off"` |
| v42 | 动作重量支持 kg/磅(lb)/斤 单位：解析识别单位、内部统一转 kg 算热量（含金字塔/递减序列正确换算，修「斤」漏换算 bug），但**保存并显示原始单位**（如「45lb」「30斤」），新增动作库也记单位；旧数据无单位回退显示 kg |
| v43 | 修复选人页自定义称呼：之前只在点卡片进 App 时才落盘，填了没进/没上传一更新重进就丢；改为 `oninput` 即时写 `state.x.name` 并 `saveLocal()`，重载/版本更新都能还原；上传交 30s 定时同步（不每键推云端） |
| v44 | 新增「我的动作库」删除功能：每个动作项加红色 🗑 按钮，点按 `confirm` 后从 `exLib` 移除并重渲染（只删动作库，不影响已记录的训练）；配 `.el-del` 样式 |
| v45 | 修复冷启动（退出后台杀进程再重开）今日已训练记录不显示：根因 `enterApp()` 调 `renderAll()` 但旧 `renderAll()` 漏了 `renderCustomEx()`/`renderExParts()`（这两只在日期翻页的 `applyRecDate()` 里），导致冷启动没画今日训练列表与 5 部位视图，翻日才触发显示。现把 `renderCustomEx();renderExParts();` 补进 `renderAll()`，冷启动即渲染今日记录 |
| v46 | 四个优化：(1) 饮食输入框去原生 datalist 截断（移除 `list="foodList"`+`autocomplete="off"`，改用「最近食物」点击小标签 `#foodQuick`，跟 v41 同思路）；(2) 修热量缺口符号 bug（缺口达标时 tag 误显 `-500kcal`，改为 `+' +500kcal`）；(3) 热量缺口并入实际运动消耗 `burn=tdee+exCal`，力量/有氧/羽毛球均计入缺口；(4) 云同步加固：`doSync` 加 `_dirtyPush` 避免「仅拉取」外层吞掉待推送写入，乐观锁 409 重试由 1 次升为最多 3 次取最新 sha |
| v47 | 热量缺口改严格口径（用户要求不重复计算）：缺口 = 基础代谢 + 非训练日常活动(活动系数封顶轻度活动 0.375) + 实际记录运动(exCal)，训练只计一次。修复 v46 `tdee+exCal` 在活动系数偏高时会把活动系数里「已含训练假设」与 exCal 重复叠加的问题；同例(活动1.55+力量300)严格缺口 863 < 朴素 1125 |
| v48 | 严格口径全页对齐：抽出共享函数 `actualBurn(p, exCal)`（基础代谢+非训练日常+记录运动，训练只计一次）作为唯一真相来源；饮食页 `renderCalorieSummary` 改用它；概览/统计页新增「今日实际总消耗」一行（用同公式）。月报/周报/概览的「运动消耗/预估消耗」本就直接加总 `e.cal`（=exCal 同源），不受影响、无重复 |
| v49 | 饮食份量支持分数（碳水/热量按真实比例计算，不再整份算）：新增 `parseLeadingQty` 统一解析 阿拉伯分数(1/4,2/3)、中文分数(三分一/三分之一/二分一)、unicode(½¼⅓¾)、半；“1/4个鸡蛋”≈18kcal、“1/3碗米饭”≈39kcal/9g碳、“米饭1/2碗”≈58kcal 均正确；并修旧版「半个」被按整份算的 bug。饮食页与风味饮料页(1/2杯)共用此解析 |
| v50 | 回归修复：数量与量词/食物之间的空白导致分数丢失（“1/3 根玉米”/“米饭 1/2 碗” 之前会被丢回整份 112/22 与 116/26）。根因：`matchFoodCal` 在 `parseLeadingQty` 返回 `end` 后直接查量词，中间的空格让 `_MW_RE` 落空，分数被弃入 `unmatched`，其后「根」被当量词以 `qty=1` 重新解析。修法：在两处（prefix 与 postfix）插入空白/标点跳过循环 `while(j<text.length && /[\s、，,;；:：.。·]/.test(text[j])) j++;`，所有写法（"1/3根" / "1/3 根" / "1/3  根" / "半 根" / "米饭1/2碗" / "米饭 1/2 碗"）均正确连读；test_foodfrac 增至 26/26 |
| v51 | UI 整理：(1) 动作库(`renderExLib`)与饮食食物卡折叠阈值 8→6，超 6 项出「展开全部 N ▾」切换；(2) 饮食页「我的食物库」卡改为「最近食物」——从 早餐/午餐/晚餐/外食 历史派生、去重（`renderRecentFood`，取代原 `renderCustomFood`）；(3) 最近食物卡：点整行快速填入对应餐输入框、✕ 删除该食物「最近一条」历史记录(带 confirm)，折叠 6 项；(4) 保留「+ 自定义食物」录入（仍入匹配库 `profile().foods`）；(5) 删除底部 `foodQuick` 区块（HTML div / `renderDiet` 调用 / `renderFoodQuick` 函数），其餐输入框焦点跟踪抽成独立初始化供新卡用；新增 test_recentfood(9/9：派生顺序/去重/折叠/删除) |
| v52 | 修正「最近食物」✕ 语义：按用户要求，✕ 改为**仅从建议列表隐藏**（`profile().hiddenFoods` 名单），唔再删历史记录、唔使确认、方便直接清理建议；点整行快速填入不变；移除破坏性 `deleteRecentFood`。折叠仍 6 项。test_recentfood 改验隐藏行为(11/11) |
| v53 | 新增「重新显示」：最近食物卡底部加「已隐藏 N 项 ↺」切换，展开后列出 `profile().hiddenFoods` 中每一项（class `hidden-item`，默认 `display:none`，`show-hidden` 时显示），点该行即把该食物从 `hiddenFoods` 移除并重渲——还原到建议列表。配套 CSS 已在 748-750 行(`hidden-item`/`show-hidden`/`cf-show`)。test_recentfood 增至 15/15（含重新显示用例）。**注意**：`renderRecentFood` 内 `hidden` 变量已在函数顶部(3657 行)声明，新增区块复用、勿重复 `const` 声明（否则整页 SyntaxError） |
| v54 | 修「瑞幸橙c美式不另外加糖」点 AI 冇反应的真 bug：(1) `resolveSugarDrink` generic 兜底分支引用未声明变量 `qm` → ReferenceError，promise reject 无 catch → 用户完全冇反馈（4348 行已删死代码）；(2) FLAVORED_DRINKS 子串匹配原大小写+空白敏感（表 `'橙C美式'` 匹配唔到 `'橙c美式'`/`'橙 c 美式'`），改用 `rawNorm=raw.replace(/\s+/g,'').toLowerCase()` 与 `d.n.toLowerCase()` 容错比较；糖度/杯型/品牌识别不变。新增 test_sugardrink.js 25/25（覆盖 bug case + 空格/大小写变体 + 百香果/生椰/大杯半糖/柠C空格变体 + 奇异果 generic 兜底不再抛错 + 纯美式无风味返回 null） |

---

## 5. 测试方式（验证改动用）

真实浏览器 Playwright + Chromium，阻断外部接口走本地链路：
```bash
cd /workspace/deploy
python3.11 -m http.server 8123 &          # 起静态服务
NODE_PATH=/workspace/deploy/node_modules node 你的测试.js
```
测试脚本要点：`page.route` 屏蔽 `**/api.github.com/**`、`**/api.nal.usda.gov/**`、`**/fdc.nal.usda.gov/**`；
加载后等 `#appLoader` 变 `hidden`，再点 `.profile-card[data-profile="A"]` → `button[data-page="diet"]`。
历史测试：`/tmp/strict_test.js`（名字保真 11 例）、`/tmp/carb_test.js`（碳水统计+修正）。

---

## 6. 仍未做 / 用户曾提过但未要求实现的项

- **🔴 代码审查待修项（2026-07-30 本会话审查，要点如下；详细报告见本会话产出的 `调整建议.md`）**：
  - **同步并发丢数据**：`cloudPut` 遇 `409` 盲目用旧 `data` 覆盖；`syncPush`/`mergeDateField` 对数组字段按「日期键最后写入者胜」，双人双设备同时记某餐会静默丢条目。修法：409 重试改为「重新 `cloudGet` + 重新合并本地」；数组字段按条目 `id` 去重并集。
  - **热量缺口符号 bug**：`renderCalorieSummary` 缺口分支显示 `-def`（应为 `+def`），缺口时括号里写成「缺口达标 -500kcal」，与粗体 `500` 矛盾。一行修复。
  - **主训练页力量训练热量未计入每日缺口**：`exCal` 只含 cardio/badminton/customEx，`estExCal`/`estExCalFromDetail` 已就绪却没接。
  - **每次 `save()` 直打 GitHub API 写、无防抖**：易限流、放大 409 碰撞（建议 1–2s 防抖）。
- **「重新计算历史记录」**：用户之前提过、但未明确要，未实现。
- **把「数据管理」按钮移到主页**：用户提过，未实现。
- ~~**可选性能项**（v34 诊断时发现，未改以免过度）~~ → **已于 v38 实现（画面使用时效果完全不变）**：后台隐藏即暂停全部 `infinite` 动画（`ciPulse`/`moonPulse`/`zzz`/`waterPulse`）、停 30s 云同步定时器、foodList datalist 按签名缓存仅变化时重建。详见 v38 版本表。
- **碳水目标值**：当前只显示总量与低碳/高碳标签，未设每日碳水上限/下限参考线。

---

## 7. 新会话对接速记（直接复制给 AI）

> 我在做 `/workspace/deploy` 里的单文件 PWA 健身工作台 `健身计划工作台`（GitHub Pages `30n24/fitness-workbench`）。
> 主文件 `index.html`，改完要同步 `fresh.html`/`wb.html`、`sw.js`（CACHE_NAME）并把 `index.html` 内 `APP_VER` 一起 +1 后 `git push`。
> 设计铁律：饮食登记餐名=用户输入原文（忠实登记），热量/碳水按量词精确算；品牌风味饮料用甜度插值（FLAVORED_DRINKS 锚点 + 通用兜底）；三级查找 FOOD_DB→USDA→AI。
> 已做：v33 碳水统计（每餐+全天+✎碳水修正）、v34 去毛玻璃降发热、v35 顶部「今日碳水」实时读数、v36→v51 动作库/食物库超长自动折叠（现折叠阈值 6 项，点「展开全部 N」展开）；v51 饮食页「我的食物库」卡改为「最近食物」（从早/午/晚/外食历史派生、去重、折叠 6，点整行快速填入，✕ 仅隐藏不删历史）；v52 ✕ 改为仅入 `profile().hiddenFoods` 隐藏名单；v53 卡底「已隐藏 N 项 ↺」可重新显示；v54 修 `resolveSugarDrink` 冇反应真 bug（generic 兜底 qm 死代码 ReferenceError + FLAVORED_DRINKS 子串匹配加去空白大小写容错）。
> 测试用 Playwright 起 `python3.11 -m http.server 8123`，屏蔽外网接口走本地链路。
> 当前诉求背景：碳循环控制，每日碳水统计最重要。请先读 `HANDOFF.md` 与 `index.html` 相关函数再动手。

---

## 8. 如何对接新会话（无缝衔接方法）

**前提**：新会话的 AI 没有跨会话记忆，开场即空白。必须在新对话第一条消息里把上下文喂给它，它才会"知道过往"。

**推荐做法（二选一，优先 A）**：

### A. 直接粘贴下方「开场白」到新对话第一条消息
> 复制 §7 的对接速记全文，或整段 HANDOFF.md，作为新对话首条消息发过去即可。
> 若新会话能访问同一文件系统，可让 AI 先 `Read /workspace/HANDOFF.md`；若文件不存在（全新沙箱），则必须粘贴内容。

### B. 让新 AI 自己读代码 + git 历史（最可靠，不依赖文档）
新对话首条消息写：
> 我在做 `/workspace/deploy` 的健身工作台 PWA（GitHub Pages `30n24/fitness-workbench`）。请先 `git log --oneline -20` 看近期改动，再读 `HANDOFF.md`（若存在），然后等我指令。不要凭空假设，动手前先读 `index.html` 相关函数。

**为什么这样能无缝**：代码 + git 提交记录才是真相源。HANDOFF.md 只是加速器；即使文档丢了，新 AI 靠 `git log` 和读 `index.html` 也能还原全部背景。

**保持文档新鲜**：每完成一轮调整，让 AI 顺手把 HANDOFF.md 的版本表（§4）与对接速记（§7）更新到当前版本号，避免下次对接时信息滞后。

### 新对话开场白（直接复制）
```
继续做健身工作台 PWA（/workspace/deploy，GitHub Pages 30n24/fitness-workbench）。
主文件 index.html；改完要同步 fresh.html/wb.html、sw.js(改 CACHE_NAME) 并把 index.html 内 APP_VER 一起+1 后 git push。
设计铁律：饮食登记餐名=用户输入原文（忠实登记），热量/碳水按量词精确算；品牌风味饮料用甜度插值（FLAVORED_DRINKS 锚点+通用兜底）；三级查找 FOOD_DB→USDA→AI。
已做：v33 碳水统计（每餐+全天+✎碳水修正）、v34 去毛玻璃降发热、v35 顶部「今日碳水」实时读数、v36→v51 动作库/食物库超长自动折叠(现折叠阈值 6 项点击展开)+修复进训练页动作库空白；v51 饮食页「我的食物库」卡改为「最近食物」(从早/午/晚/外食历史派生去重、折叠6、点整行快速填入、✕仅隐藏不删历史)；v52 ✕改为仅入 hiddenFoods 隐藏名单；v53 卡底「已隐藏 N 项 ↺」可重新显示；v54 修 resolveSugarDrink 冇反应真 bug（generic 兜底 qm 死代码 ReferenceError + FLAVORED_DRINKS 匹配加去空白大小写容错）。
先 git log 看最新改动并读 HANDOFF.md（若存在），动手前先读 index.html 相关函数。当前诉求：碳循环控制，每日碳水统计最重要。
```
