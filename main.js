/**
 * 闪念盒 memoflow —— Forsion 桌面插件(裸 setup(ctx) 体,宿主 new Function('ctx', code) 装载)。
 *
 * flomo 式低摩擦速记:文字 + 语音进「月文件」(<工作文件夹>/YYYY-MM.md,### ISO 时间戳分节),
 * 左栏标签树(列表源)/ 主区时间线 + 回顾牌堆 / 右栏热力图与周整理 / Mini 记 + 今天。派生缓存 .memoflow-cache.json
 * 任何时候可仅凭月文件全量重建(⋯ 菜单里有「重建缓存」)。
 *
 * 安全:一切用户/模型产出文本只走 createElement + textContent(全文件不含任何 HTML 字符串注入面)。
 * 兼容:07-18 之后的 ctx 面一律可选链,旧宿主缺席时优雅降级(藏按钮 / 回退 ctx.app.notify)。
 * 双语:MSG.zh / MSG.en 两侧键集合相等,L()/t() 取串;ctx.subscribeLocale 触发就地重画(视图不重挂)。
 *      用户数据与一切路径不随语言变(工作文件夹 / 整理子夹 / 周整理文件名 / 哨兵 / localStorage 键)。
 * 时间:「现在」一律 Date.now();回溯正午锚定;全文件无周期定时器(check 冻钟可测)。
 */
const PLUGIN_ID = 'memoflow'
const APP_ID = 'tangu'
const PIN_MARK = '⚑pin'
const ARCH_MARK = '⌫arch'
const TS_LINE = /^###\s+(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)\s*$/
const YM_RE = /^(\d{4})-(0[1-9]|1[0-2])$/
// Amadeus 块标记行(宿主 shared/amadeus/compiler/markers.ts 的 BLOCK_MARKER_RE 同款):
// 月文件被 Amadeus 编辑器采纳后,每个块前会落一行 `<!-- a N -->`。它是宿主结构数据,
// 解析时不算正文、不吃哨兵;写回时必须一字不动,哨兵绝不能追加到标记行上(否则破坏宿主块结构)。
const MARKER_LINE = /^<!--\s*a\s+[A-Za-z0-9_-]+\s*-->\s*$/

// ── 中英双语词表(zh/en 两侧键集合必须完全相等,check.mjs 有断言) ──────────────
// 翻的只有 UI 文案 + 插件自己写进产物的说明行。**用户数据与一切路径绝不随语言变**:
// 闪念正文 / 标签名 / 工作文件夹「闪念盒」/「整理」子夹 / `YYYY-Www-周整理.md` / 哨兵 /
// localStorage 键 —— 路径跟着语言走 = 切个语言像换了数据目录,旧闪念当场「消失」。
// 占位符一律 {name} 形式:英文语序与中文不同,不能靠模板串拼。
// 数量与列表这两处「拼串」按语言取:英文句子里绝不能出现中文顿号,英文名词也得按 n 分单复数
// (`1 memos` 会跟着周整理抬头落进磁盘长期留着)。计数一律走 nMemos/nMonthFiles,占位符是 {c} —— 它
// 装的是**整个计数短语**(「3 条」/「3 memos」)而不是裸数字,所以两侧语序各写各的。
const MSG = {
  zh: {
    navAll: '全部闪念',
    navReview: '每日回顾',
    navArchived: '已归档',
    navPinned: '已置顶',
    reviewPill: '回顾 {n}',
    backToLatest: '回到最新',
    savedOutOfFilter: '已记下,不在当前筛选里',
    navTags: '标签',
    tagAllUnder: '全部',
    tagFilter: '筛选这个标签',
    tagRename: '改名',
    tagMerge: '合并到…',
    tagRenameTitle: '改标签名',
    tagMergeTitle: '合并标签',
    tagRenamePrompt: '把 #{tag} 改成',
    tagMergePrompt: '把 #{tag} 合并到哪个已有标签',
    tagConfirmBody: '会改动 {c}闪念:#{from} 和它的子标签都换成 #{to}。只改闪念,不改笔记。',
    tagConfirmType: '输入 y 确认',
    tagBadName: '标签名只能有文字、数字、_ - /,不能是纯数字',
    tagIntoSelf: '不能改到自己的子标签下',
    tagMergeMissing: '没有标签 #{tag},合并的目标要已经存在',
    tagMonthGone: '文件暂不可读',
    tagDone: '已改 {c}闪念',
    tagFail: '没有改动:{msg}',
    tagPartial: '只改了 {c}闪念,其余没写进去:{msg}。再改一次可以接着补完',
    viewActivity: '活动',
    filterCount: '{c}',
    filterCountSub: '{c},含 {s}',
    filterClear: '清除',
    filterRemove: '去掉筛选 {name}',
    hashTitle: '打标签',
    more: '更多',
    justNow: '刚刚',
    deleteTitle: '删除这条闪念?删除后不可恢复',
    reviewHead: '每日回顾 · {date} 的你 · 还剩 {left} 张',
    heatTitle: '近 12 周',
    statMemos: '条闪念',
    statStreak: '天连续',
    statGroups: '组标签',
    weekCount: '本周 {c}',
    weekLine: '按主题整理成周报',
    btnStartDigest: '开始整理',
    miniToday: '今天',
    miniAll: '全部',
    listSep: '、',
    settingReviewCount: '每日回顾条数',
    settingReviewCountDesc: '每天从 7 天前更早的未归档闪念里抽几条回顾;0 = 关闭每日回顾',
    appName: '闪念盒',
    achCaptureTitle: '百念成川',
    achCaptureDesc: '累计记下 100 条闪念',
    achStreakTitle: '七日不断',
    achStreakDesc: '连续 7 天都有记录',
    cmdOpen: '闪念盒:打开',
    cmdCapture: '闪念盒:快速记一条',
    cmdDigest: '闪念盒:AI 周整理',
    statusText: '✎ 闪念',
    statusTitle: '快速记一条闪念',
    hostTooOld: '宿主版本过旧,不支持工作台视图',
    btnDigest: 'AI 周整理',
    btnRebuild: '重建缓存',
    stats: '共 {c} · 连续 {d} 天',
    inputPlaceholder: '现在在想什么?',
    btnSend: '记下',
    btnVoice: '语音',
    btnVoiceStop: '结束录音',
    btnVoiceBusy: '转写中',
    voiceHint: '按住说话,或点击开始 / 再点结束',
    searchPlaceholder: '搜索闪念…',
    btnCancel: '取消',
    btnRetry: '重试',
    btnGotIt: '知道了',
    btnSave: '保存',
    digestProgress: 'AI 周整理:{label}',
    stagePrepare: '准备语料',
    stageSubmit: '提交任务',
    stageQueued: '排队中',
    stageRunning: '整理中',
    stageWriting: '生成周整理中',
    stageDone: '完成',
    digestBusy: '周整理已在进行中',
    digestNoCorpus: '还没有可整理的闪念',
    digestNeedLogin: '请先登录 Forsion',
    digestNoEngine: '未连接到 Tangu 引擎',
    digestEmptyOut: '模型没有返回内容',
    digestOk: '周整理完成:{week}(已存入 {dir})',
    digestFail: '周整理失败:{msg}',
    digestCanceled: '已取消',
    digestQuoteLabel: '原句',
    digestHead: '> 由「闪念盒」AI 周整理生成 · {date} · 覆盖 {c}闪念',
    noteSource: '> 来源:闪念盒 {ts}',
    runStartFail: '起 run 失败 HTTP {code}',
    runNoId: '引擎未返回 runId',
    runSubFail: '订阅事件失败 HTTP {code}',
    runErr: '整理失败',
    runBroken: '与引擎的连接中断,未收到完成事件(可重试)',
    readMemosFail: '读取闪念失败:{msg}',
    micDenied: '麦克风权限被拒绝(打开 系统设置 › 隐私与安全 › 麦克风,允许本 App)',
    micNone: '没检测到麦克风设备',
    micOpenFail: '麦克风打不开:{msg}',
    recStartFail: '录音器启动失败:{msg}',
    recNoAudio: '没采集到声音(输入电平≈0):检查系统输入设备是否选对、麦克风没被静音',
    recNotHeard: '没听清,再试一次',
    quickNoPrompt: '当前宿主不支持快速输入,请打开闪念盒视图',
    quickPrompt: '记一条闪念(可随手打 #标签)',
    quickDone: '已记下 ✓',
    quickFail: '记录失败:{msg}',
    readMonthFail: '读取 {ym} 月文件失败:{msg}',
    writeCanceled: '读取 {ym} 月文件失败,为防整月覆盖已取消写入;请稍后重试',
    writeCanceledKnown: '读取 {ym} 月文件失败(本月应有约 {c}闪念),为防整月覆盖已取消写入;请稍后重试,或在视图里「重建缓存」',
    editCanceled: '读取 {ym} 月文件失败,已取消本次修改以防整月覆盖,请稍后重试',
    editCanceledGone: '{ym} 月文件不存在或暂不可读,已取消本次修改;若确认月文件已删除,请点「重建缓存」收编现状',
    rebuildRefused: '有 {c}读取失败({list}),已取消缓存重建以防证词清零;请稍后重试',
    monthsFailed: '有 {c}读取失败({list}),时间线暂缺这些月份;写入防线仍在',
    loading: '加载中…',
    loadFail: '读取闪念失败',
    emptyTitle: '还没有闪念',
    emptyHint: '在输入框里随手记一条,Enter 发送,# 打标签。',
    noMatch: '没有匹配的闪念',
    dayToday: '今天',
    dayYesterday: '昨天',
    actEdit: '编辑',
    actPin: '置顶',
    actUnpin: '取消置顶',
    actArchive: '归档',
    actRestore: '恢复',
    actToNote: '转笔记',
    actDelete: '删除',
    actSkip: '跳过',
    reviewDone: '今日回顾完成 ✓',
    heatCell: '{day} · {c}',
    rebuildPrompt: '重建缓存:从哪个月开始扫描(YYYY-MM)',
    rebuildBadMonth: '月份格式应为 YYYY-MM',
    rebuildOk: '缓存已重建:共 {c}',
    rebuildFail: '重建失败:{msg}',
    deleteNoPrompt: '当前宿主不支持确认弹框,请改用「归档」',
    deleteConfirm: '输入 y 确认删除这条闪念(不可恢复)',
    deleted: '已删除',
    deleteFail: '删除失败:{msg}',
    toNoteOk: '已转为笔记(原条已归档)',
    toNoteFail: '转笔记失败:{msg}',
    saveFail: '保存失败:{msg}',
  },
  en: {
    navAll: 'All memos',
    navReview: 'Daily review',
    navArchived: 'Archived',
    navPinned: 'Pinned',
    reviewPill: 'Review {n}',
    backToLatest: 'Back to latest',
    savedOutOfFilter: 'Saved, not in this filter',
    navTags: 'Tags',
    tagAllUnder: 'All',
    tagFilter: 'Filter by this tag',
    tagRename: 'Rename',
    tagMerge: 'Merge into…',
    tagRenameTitle: 'Rename tag',
    tagMergeTitle: 'Merge tag',
    tagRenamePrompt: 'Rename #{tag} to',
    tagMergePrompt: 'Merge #{tag} into which existing tag?',
    tagConfirmBody: 'This changes {c}: #{from} and its sub-tags become #{to}. Only memos change, not notes.',
    tagConfirmType: 'Type y to confirm',
    tagBadName: 'Tag names can only use letters, digits, _ - and /, and cannot be all digits',
    tagIntoSelf: 'A tag cannot move under itself',
    tagMergeMissing: 'There is no #{tag} tag. The merge target must already exist.',
    tagMonthGone: 'the file is temporarily unreadable',
    tagDone: 'Changed {c}',
    tagFail: 'Nothing changed: {msg}',
    tagPartial: 'Only {c} changed; the rest could not be written: {msg}. Run it again to finish.',
    viewActivity: 'Activity',
    filterCount: '{c}',
    filterCountSub: '{c}, including {s}',
    filterClear: 'Clear',
    filterRemove: 'Remove filter {name}',
    hashTitle: 'Add a tag',
    more: 'More',
    justNow: 'Just now',
    deleteTitle: 'Delete this memo? This cannot be undone',
    reviewHead: 'Daily review · you on {date} · {left} left',
    heatTitle: 'Last 12 weeks',
    statMemos: 'memos',
    statStreak: 'day streak',
    statGroups: 'tag groups',
    weekCount: 'This week: {c}',
    weekLine: 'Organize them into a digest by theme',
    btnStartDigest: 'Start',
    miniToday: 'Today',
    miniAll: 'All',
    listSep: ', ',
    settingReviewCount: 'Daily review count',
    settingReviewCountDesc: 'How many memos from 7+ days ago to resurface each day; 0 turns Daily Review off',
    appName: 'MemoFlow',
    achCaptureTitle: 'Hundred Sparks',
    achCaptureDesc: 'Capture 100 memos in total',
    achStreakTitle: 'Seven Days Running',
    achStreakDesc: 'Capture something 7 days in a row',
    cmdOpen: 'MemoFlow: Open',
    cmdCapture: 'MemoFlow: Quick Capture',
    cmdDigest: 'MemoFlow: AI Weekly Digest',
    statusText: '✎ Memo',
    statusTitle: 'Capture a quick memo',
    hostTooOld: 'This host is too old to open workbench views',
    btnDigest: 'AI Weekly Digest',
    btnRebuild: 'Rebuild Cache',
    stats: '{c} · {d}-day streak',
    inputPlaceholder: "What's on your mind?",
    btnSend: 'Capture',
    btnVoice: 'Voice',
    btnVoiceStop: 'Stop',
    btnVoiceBusy: 'Transcribing',
    voiceHint: 'Hold to talk, or click to start and click again to stop',
    searchPlaceholder: 'Search memos…',
    btnCancel: 'Cancel',
    btnRetry: 'Retry',
    btnGotIt: 'Dismiss',
    btnSave: 'Save',
    digestProgress: 'AI Weekly Digest: {label}',
    stagePrepare: 'Gathering memos',
    stageSubmit: 'Submitting',
    stageQueued: 'Queued',
    stageRunning: 'Organizing',
    stageWriting: 'Writing the digest',
    stageDone: 'Done',
    digestBusy: 'A weekly digest is already running',
    digestNoCorpus: 'No memos to organize yet',
    digestNeedLogin: 'Sign in to Forsion first',
    digestNoEngine: 'Not connected to the Tangu engine',
    digestEmptyOut: 'The model returned nothing',
    digestOk: 'Weekly digest ready: {week} (saved to {dir})',
    digestFail: 'Weekly digest failed: {msg}',
    digestCanceled: 'Canceled',
    digestQuoteLabel: 'Quotes',
    digestHead: '> Generated by MemoFlow AI Weekly Digest · {date} · covering {c}',
    noteSource: '> Source: MemoFlow memo · {ts}',
    runStartFail: 'Could not start the run (HTTP {code})',
    runNoId: 'The engine returned no runId',
    runSubFail: 'Could not subscribe to run events (HTTP {code})',
    runErr: 'The digest run failed',
    runBroken: 'Lost the connection to the engine before it finished (you can retry)',
    readMemosFail: 'Could not read your memos: {msg}',
    micDenied: 'Microphone access denied (allow this app in System Settings › Privacy & Security › Microphone)',
    micNone: 'No microphone found',
    micOpenFail: 'Could not open the microphone: {msg}',
    recStartFail: 'The recorder failed to start: {msg}',
    recNoAudio: 'No audio captured (input level is about zero): check that the right input device is selected and not muted',
    recNotHeard: 'Could not make that out — try again',
    quickNoPrompt: 'This host has no quick input — open the MemoFlow view instead',
    quickPrompt: 'Capture a memo (type # to add a tag)',
    quickDone: 'Captured ✓',
    quickFail: 'Capture failed: {msg}',
    readMonthFail: 'Could not read the {ym} month file: {msg}',
    writeCanceled: 'Could not read the {ym} month file, so the capture was canceled to keep the month from being overwritten. Please try again shortly.',
    writeCanceledKnown: 'Could not read the {ym} month file (about {c} should be in it), so the capture was canceled to keep the month from being overwritten. Try again shortly, or use "Rebuild Cache" in the view.',
    editCanceled: 'Could not read the {ym} month file, so this change was canceled to keep the month from being overwritten. Please try again shortly.',
    editCanceledGone: 'The {ym} month file is missing or temporarily unreadable, so this change was canceled. If you deleted it on purpose, use "Rebuild Cache" to adopt what is on disk.',
    rebuildRefused: '{c} could not be read ({list}), so the rebuild was canceled to keep the overwrite guard intact. Please try again shortly.',
    monthsFailed: '{c} could not be read ({list}), so those months are missing from the timeline. The write guard is still on.',
    loading: 'Loading…',
    loadFail: 'Could not load your memos',
    emptyTitle: 'No memos yet',
    emptyHint: 'Jot one down in the input box and press Enter. Type # to add a tag.',
    noMatch: 'No memos match',
    dayToday: 'Today',
    dayYesterday: 'Yesterday',
    actEdit: 'Edit',
    actPin: 'Pin',
    actUnpin: 'Unpin',
    actArchive: 'Archive',
    actRestore: 'Restore',
    actToNote: 'To Note',
    actDelete: 'Delete',
    actSkip: 'Skip',
    reviewDone: "Today's review is done ✓",
    heatCell: '{day} · {c}',
    rebuildPrompt: 'Rebuild cache: scan from which month? (YYYY-MM)',
    rebuildBadMonth: 'Month must look like YYYY-MM',
    rebuildOk: 'Cache rebuilt: {c}',
    rebuildFail: 'Rebuild failed: {msg}',
    deleteNoPrompt: 'This host has no confirmation dialog — use Archive instead',
    deleteConfirm: 'Type y to delete this memo (cannot be undone)',
    deleted: 'Deleted',
    deleteFail: 'Delete failed: {msg}',
    toNoteOk: 'Turned into a note (the memo was archived)',
    toNoteFail: 'Could not turn it into a note: {msg}',
    saveFail: 'Save failed: {msg}',
  },
}
/** 当前语言。旧宿主没有 getLocale → 回退中文(canonical)。 */
const L = () => {
  try { return ctx.getLocale && ctx.getLocale() === 'en' ? 'en' : 'zh' } catch { return 'zh' }
}
/** 取串;缺键回退中文,再缺回退键名本身(词表出洞时界面不会变空白)。 */
function t(k, vars) {
  const d = MSG[L()] || MSG.zh
  let s = d[k] != null ? d[k] : (MSG.zh[k] != null ? MSG.zh[k] : k)
  if (vars) { for (const n of Object.keys(vars)) s = s.split(`{${n}}`).join(String(vars[n])) }
  return s
}
/** 计数短语:中文「N + 量词」,英文按 N 取单复数。词表里对应的占位符是 {c},装的是**整个短语**
 *  而不是裸数字 —— 中文无复数、英文有,两侧语序也不同,只有算好再塞才能两边都地道。
 *  周整理抬头也走它:`covering 1 memos` 这种会跟着产物长期留在磁盘上,不是「界面小瑕」。 */
const nMemos = (n) => (L() === 'en' ? `${n} memo${n === 1 ? '' : 's'}` : `${n} 条`)
const nSubTags = (n) => (L() === 'en' ? `${n} sub-tag${n === 1 ? '' : 's'}` : `${n} 个子标签`)
const nMonthFiles = (n) => (L() === 'en' ? `${n} month file${n === 1 ? '' : 's'}` : `${n} 个月文件`)
/** 列表分隔符按语言取:中文顿号绝不能拼进英文句子(月份清单等)。 */
const joinList = (arr) => (arr || []).join(t('listSep'))
/** 给人看的日期(数据里的 key 永远是 YYYY-MM-DD;只有展示这一处本地化)。 */
function fmtDay(key) {
  const p = String(key || '').split('-').map(Number)
  if (!p[0] || !p[1] || !p[2]) return String(key || '')
  try { return new Date(p[0], p[1] - 1, p[2], 12).toLocaleDateString(L() === 'zh' ? 'zh-CN' : 'en-US') } catch { return String(key || '') }
}

/** 时间线和回顾卡上的日期:同一年只写月日,不跟 2026/10/21 这种数据格式。 */
function shortDay(key) {
  const p = String(key || '').split('-').map(Number)
  if (!p[0] || !p[1] || !p[2]) return String(key || '')
  const zh = L() === 'zh', sameYear = p[0] === new Date(Date.now()).getFullYear()
  if (zh) return `${sameYear ? '' : `${p[0]} 年 `}${p[1]} 月 ${p[2]} 日`
  try { return new Date(p[0], p[1] - 1, p[2], 12).toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) }) } catch { return String(key) }
}
/** 一周内写星期,更早的写月日。 */
function weekDay(key, today) {
  const p = String(key || '').split('-').map(Number), q = String(today || '').split('-').map(Number)
  if (!p[2] || !q[2]) return shortDay(key)
  const at = new Date(p[0], p[1] - 1, p[2], 12), days = Math.round((new Date(q[0], q[1] - 1, q[2], 12) - at) / 864e5)
  if (days < 2 || days > 6) return shortDay(key)
  return at.toLocaleDateString(L() === 'zh' ? 'zh-CN' : 'en-US', { weekday: L() === 'zh' ? 'short' : 'long' })
}

/** 宿主画的文案(视图标题、列表源、动作):新宿主传函数,切语言自动重算;PluginText 和 ctx.ui.icon 同一版到来。 */
const pText = (k) => (ctx.ui && ctx.ui.icon ? () => t(k) : t(k))
const isPhone = () => !!(globalThis.window && window.tangu && window.tangu.mobile)
/** 左栏能不能画树:手机上层级列表走不了整屏,摊平成「产品 / 路线图」。 */
const treeListOk = () => !!(ctx.listCapabilities && ctx.listCapabilities.includes('tree')) && !isPhone()
const sidebarOk = () => !!ctx.registerListSource && treeListOk()

ctx.registerSetting({ key: 'reviewCount', label: t('settingReviewCount'), type: 'number', default: 4, min: 0, max: 20, description: t('settingReviewCountDesc') })

// ── 小工具 ───────────────────────────────────────────────────────────────────
const say = (m, o) => (ctx.notify ? ctx.notify(m, o) : ctx.app.notify(m))
const uuid = () => (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`)
const getLS = (k, d) => { try { const v = localStorage.getItem(`plugin.${PLUGIN_ID}.${k}`); return v == null ? d : v } catch { return d } }
const setLS = (k, v) => { try { localStorage.setItem(`plugin.${PLUGIN_ID}.${k}`, String(v)) } catch { /* ignore */ } }
const wfRoot = () => (ctx.app && ctx.app.workFolder ? ctx.app.workFolder() : '闪念盒')
const monthPath = (ym) => `${wfRoot()}/${ym}.md`
const cachePath = () => `${wfRoot()}/.memoflow-cache.json`
const digestDir = () => `${wfRoot()}/整理`
const firstMonth = () => { const v = getLS('firstMonth', ''); return YM_RE.test(v) ? v : '' }
const setFirstMonth = (ym) => setLS('firstMonth', ym)
function reviewCountSetting() {
  const n = parseInt(getLS('reviewCount', '4'), 10)
  return Number.isFinite(n) ? Math.max(0, Math.min(20, n)) : 4
}
function safeHref(u) {
  const s = String(u || '').trim()
  return /^(https?:\/\/|#|mailto:)/i.test(s) ? s : ''
}
function sanitizeFileName(name) {
  return String(name || '').replace(/[\\/:*?"<>|#]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 40) || '闪念'
}

// ── 日期纪律(Date.now 单源;回溯正午锚定;日序用 Date.UTC 纯日历) ─────────
const pad2 = (n) => String(n).padStart(2, '0')
function dayKeyOf(ms) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
function monthKeyOf(ms) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}
function dayKeyOfIso(iso) {
  const t = Date.parse(iso)
  return Number.isNaN(t) ? '' : dayKeyOf(t)
}
function timeOfIso(iso) {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const d = new Date(t)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}
const todayKey = () => dayKeyOf(Date.now())
function daySerial(key) {
  const p = String(key || '').split('-').map(Number)
  return Math.floor(Date.UTC(p[0], (p[1] || 1) - 1, p[2] || 1) / 86400000)
}
function serialToKey(s) {
  const d = new Date(s * 86400000)
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
}
/** 正午锚定的日位移(DST 定式:游标定在本地正午再 ±24h,凌晨起算会在春令日跳日)。 */
function shiftDays(key, n) {
  const p = String(key || '').split('-').map(Number)
  const t = new Date(p[0], (p[1] || 1) - 1, p[2] || 1, 12).getTime() + n * 86400000
  return dayKeyOf(t)
}
/** 月序列自枚举(纯 y/m 整数推进,绕过无 listPages;跨年安全)。 */
function monthSeq(fromYm, toYm) {
  const pf = YM_RE.exec(String(fromYm || '')), pt = YM_RE.exec(String(toYm || ''))
  if (!pf || !pt) return []
  let y = +pf[1], m = +pf[2]
  const ey = +pt[1], em = +pt[2]
  const out = []
  let guard = 0
  while ((y < ey || (y === ey && m <= em)) && guard++ < 1200) {
    out.push(`${y}-${pad2(m)}`)
    m += 1
    if (m > 12) { m = 1; y += 1 }
  }
  return out
}
/** ISO 8601 周号(UTC 日序算,无 DST 因素),返回 "YYYY-Www"。 */
function isoWeekOf(key) {
  const p = String(key || '').split('-').map(Number)
  const t = new Date(Date.UTC(p[0], (p[1] || 1) - 1, p[2] || 1))
  t.setUTCDate(t.getUTCDate() + 3 - ((t.getUTCDay() + 6) % 7)) // 本周的星期四决定 ISO 年
  const isoY = t.getUTCFullYear()
  const week = Math.ceil(((t.getTime() - Date.UTC(isoY, 0, 1)) / 86400000 + 1) / 7)
  return `${isoY}-W${pad2(week)}`
}

// ── 月文件解析 / 序列化(数据契约,对称往返) ────────────────────────────────
/** 一条闪念 = "### <ISO>" 标题 + 正文至下一 ### 或 EOF;### 后不是 ISO 时间戳的行属于正文。
 *  置顶/归档 = 正文末尾的纯文本哨兵 ⚑pin / ⌫arch(解析时剥出为状态位)。
 *  首个时间戳节之前的一切原文(frontmatter / 用户手写导语)捕获为 preamble,
 *  serializeMonth 原样回放 —— 月文件宣传「纯 Markdown 可直接编辑」,插件绝不吃掉用户加的头部。 */
/** 把正文尾部连续的块标记行(及其前置空行)摘出,返回 [核心正文, 尾部原文]。
 *  哨兵剥离/追加只对核心正文进行 —— `⌫arch` 后面跟着 `<!-- a 2 -->` 时状态不能丢,
 *  写回时 `<!-- a 2 --> ⚑pin` 这种破坏宿主 BLOCK_MARKER_RE 的行绝不能出现。 */
function splitTailMarkers(body) {
  const s = String(body == null ? '' : body)
  if (!s.includes('<!--')) return [s, '']
  const lines = s.split('\n')
  let i = lines.length
  while (i > 0 && (MARKER_LINE.test(lines[i - 1]) || !lines[i - 1].trim())) i -= 1
  const suffix = lines.slice(i)
  if (!suffix.some((l) => MARKER_LINE.test(l))) return [s, '']
  return [lines.slice(0, i).join('\n'), (i > 0 ? '\n' : '') + suffix.join('\n')]
}
function parseMonth(text) {
  const lines = String(text == null ? '' : text).replace(/\r\n/g, '\n').split('\n')
  const memos = []
  let ym = ''
  let cur = null
  let preamble = null
  const flush = () => {
    if (!cur) return
    let body = cur.buf.join('\n').replace(/\s+$/, '')
    let pinned = false, archived = false
    let tail = ''
    // 标记行摘除与哨兵剥离交替到定点:既认「⌫arch\n\n<!-- a 2 -->」(Amadeus 加块后的正常形态),
    // 也顺带治好旧版写坏的「<!-- a 2 --> ⚑pin」行(哨兵挪回内容行)。
    for (;;) {
      const st = splitTailMarkers(body)
      if (st[1]) { tail = st[1] + tail; body = st[0]; continue }
      const m = /\s*(⚑pin|⌫arch)$/.exec(body)
      if (!m) break
      if (m[1] === PIN_MARK) pinned = true
      else archived = true
      body = body.slice(0, m.index).replace(/\s+$/, '')
    }
    const memo = { ts: cur.ts, text: body, pinned, archived }
    if (tail) memo.tail = tail // 仅在有尾随标记时挂字段(数据契约不变,serializeMonth 原样回放)
    memos.push(memo)
    cur = null
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const hd = TS_LINE.exec(line)
    if (hd) {
      if (preamble == null) preamble = lines.slice(0, i).join('\n')
      flush(); cur = { ts: hd[1], buf: [] }; continue
    }
    if (cur) { cur.buf.push(line); continue }
    const mh = /^#\s+(\d{4}-\d{2})\s*$/.exec(line)
    if (mh) ym = mh[1]
  }
  flush()
  if (preamble == null) preamble = lines.join('\n')
  return { ym, memos, preamble }
}
/** preamble == null → canonical 头(`# YYYY-MM` + 空行);否则逐字节回放捕获的头部。 */
function serializeMonth(ym, memos, preamble) {
  const parts = preamble == null ? [`# ${ym}`, ''] : (preamble === '' ? [] : [preamble])
  for (const mm of memos || []) {
    parts.push(`### ${mm.ts}`)
    let body = String(mm.text == null ? '' : mm.text).replace(/\s+$/, '')
    let tail = mm.tail == null ? '' : String(mm.tail)
    const marks = `${mm.pinned ? ' ' + PIN_MARK : ''}${mm.archived ? ' ' + ARCH_MARK : ''}`
    if (marks) {
      // 哨兵必须落在最后一行非标记内容之后:text 若(经手编/编辑器)自带尾随标记行,同样先摘后接
      const st = splitTailMarkers(body)
      if (st[1]) { tail = st[1] + tail; body = st[0].replace(/\s+$/, '') }
      body = body ? body + marks : marks.slice(1)
    }
    if (tail) body += tail
    parts.push(body)
    parts.push('')
  }
  return parts.join('\n')
}

// ── 标签(和 Amadeus 同一口径,闪念盒自带一份,关着 Amadeus 也能用) ────────────
// TAG_RE / NOT_TAG / normTag / tagMatches 与 Genesis shared/amadeus/links.ts 逐字同义,check.mjs 里有一组对照样例。
// # 前面必须是行首或空白(a.com/#frag 不算);字符集到标点为止(「#设计,下周再说」只取「设计」)。
const TAG_RE = /(?:^|\s)#([\p{L}\p{N}_/-]+)/gu
const NOT_TAG = /^[0-9/]+$/ // #1、#1/2 不是标签
/** 这段文字里的标签,按出现顺序去重(大小写不敏感,留最先出现的写法)。 */
function extractTags(text) {
  const re = new RegExp(TAG_RE.source, TAG_RE.flags)
  const s = String(text == null ? '' : text)
  const out = [], seen = new Set()
  let m
  while ((m = re.exec(s))) {
    const t = m[1]
    if (NOT_TAG.test(t)) continue
    const k = t.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(t)
  }
  return out
}
/** 标签归一(用户输入的名字):去空白与前导 #;不合字符集或纯数字 → null。 */
function normTag(raw) {
  const t = String(raw == null ? '' : raw).trim().replace(/^#/, '')
  return !t || !/^[\p{L}\p{N}_/-]+$/u.test(t) || NOT_TAG.test(t) ? null : t
}
/** 嵌套标签前缀匹配:查 work 命中 work 与 work/urgent,不命中 workshop。大小写不敏感。 */
function tagMatches(tag, query) {
  const t = String(tag == null ? '' : tag).toLowerCase()
  const q = String(query == null ? '' : query).trim().replace(/^#/, '').replace(/\/+$/, '').toLowerCase()
  return !!q && (t === q || t.startsWith(`${q}/`))
}

// ── 派生缓存(纯派生,任何时候可全量重建;增量 == 全量,check 有等式断言) ────
// v 变了 = 派生规则变了(v2:标签解析对齐 Amadeus)。旧版缓存的 days 仍是写前防线的证词,不能当缺席;
// 只有 tags 是错的 → upgradeCacheTags 只换 tags 表,days / total 一个字不碰。
const CACHE_V = 2
function bumpCacheObj(c, memo) {
  const day = dayKeyOfIso(memo.ts)
  if (day) c.days[day] = (c.days[day] || 0) + 1
  for (const t of extractTags(memo.text)) c.tags[t] = (c.tags[t] || 0) + 1
  c.total = (c.total || 0) + 1
  return c
}
function cacheFromMemos(memos) {
  const c = { v: CACHE_V, days: {}, tags: {}, total: 0, builtAt: 0 }
  for (const m of memos || []) bumpCacheObj(c, m)
  return c
}
function streakOf(days, today) {
  let k = today, n = 0
  if (!days[k]) k = shiftDays(k, -1)
  let guard = 0
  while (days[k] > 0 && guard++ < 4000) { n += 1; k = shiftDays(k, -1) }
  return n
}

// ── 每日回顾选卡(seed = YYYYMMDD 数字,同日稳定、跨日变化,免存已抽记录) ────
function mulberry32(a) {
  let s = a | 0
  return function next() {
    s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const seedOfDay = (key) => Number(String(key || '').replace(/-/g, '')) >>> 0
/** 「7 天前更早」= 距今 ≥7 个日历日的未归档闪念。 */
function reviewEligible(memos, today) {
  const cut = daySerial(today) - 7
  return (memos || []).filter((m) => !m.archived && daySerial(dayKeyOfIso(m.ts)) <= cut)
}
/** 确定性抽样:按 ts 升序定基,mulberry32 部分 Fisher-Yates 取前 count 条。 */
function pickReview(list, seed, count) {
  const arr = (list || []).slice().sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0))
  const rng = mulberry32(seed >>> 0)
  const n = Math.max(0, Math.min(count | 0, arr.length))
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (arr.length - i))
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t
  }
  return arr.slice(0, n)
}

// ── 文件 IO(全走 ctx.app,vault 相对路径) ─────────────────────────────────
// 「读失败」与「文件不存在」是两种世界:失败(宿主抛错)= 一切写入拒绝;缺席(null)= 还要过证词关。
// 有的宿主自己把失败折叠成 null —— 所以除了 Raw 层的抛错信号,还留两张会话记忆表 + 派生缓存做证词:
// 本会话见过的每月条数 + 每月头部原文(用户点「重建缓存」= 声明以磁盘为准,才清空)。
const monthKnownCounts = new Map()
const monthPreambles = new Map()
/** 读月文件原文:宿主抛错原样上抛(err.ioFail = true)。 */
async function readMonthText(ym) {
  // 局部变量刻意不叫 t:词表 helper 就叫 t(),重名会在 catch 里把它遮成 undefined
  try { return await ctx.app.readFile(monthPath(ym)) }
  catch (e) {
    const err = new Error(t('readMonthFail', { ym, msg: (e && e.message) || e }))
    err.ioFail = true
    throw err
  }
}
/** 读月文件并解析:缺席/空文件给 null。写路径一律用它。 */
async function readMonthRaw(ym) {
  const raw = await readMonthText(ym)
  if (!raw) return null
  const p = parseMonth(raw)
  monthPreambles.set(ym, p.preamble)
  monthKnownCounts.set(ym, p.memos.length)
  return p.memos
}
/** 折叠版(读失败=null):仅供只读展示路径,写路径禁止用它。 */
async function readMonth(ym) {
  try { return await readMonthRaw(ym) } catch { return null }
}
async function writeMonth(ym, memos) {
  await ctx.app.writeFile(monthPath(ym), serializeMonth(ym, memos, monthPreambles.get(ym)))
  monthKnownCounts.set(ym, (memos || []).length)
}
/** 派生缓存里该月(按本地日 key 前缀)应有的条数 —— readMonth 给 null 时的第二道防覆盖证词。 */
async function cachedMonthCount(ym) {
  const c = await readCacheFile()
  if (!c || !c.days) return 0
  let n = 0
  const prefix = `${ym}-`
  for (const k of Object.keys(c.days)) { if (k.startsWith(prefix)) n += c.days[k] || 0 }
  return n
}
/** 从 firstMonth 逐月推到当月(路径按日期自枚举 —— 绕过无 listPages 的关键设计)。
 *  读失败的月份不入 map,但记入 map.failedMonths —— 残缺 store 禁止用于缓存重建。 */
async function loadAll() {
  const nowYm = monthKeyOf(Date.now())
  const from = firstMonth() || nowYm
  const seq = monthSeq(from <= nowYm ? from : nowYm, nowYm)
  const map = new Map()
  map.failedMonths = []
  for (const ym of seq) {
    let memos = null
    try { memos = await readMonthRaw(ym) } catch { map.failedMonths.push(ym) }
    if (memos && memos.length) map.set(ym, memos)
  }
  return map
}
const flatten = (store) => {
  const out = []
  for (const entry of store) { for (const m of entry[1]) out.push({ ym: entry[0], m }) }
  return out
}
/** 读派生缓存:宿主抛错原样上抛(IO 失败 ≠ 缓存缺席);内容损坏按缺席算(纯派生,可重建)。 */
async function readCacheFileRaw() {
  const t = await ctx.app.readFile(cachePath())
  if (!t) return null
  try {
    const c = JSON.parse(t)
    return c && c.days && c.tags ? c : null
  } catch { return null }
}
async function readCacheFile() {
  try { return await readCacheFileRaw() } catch { return null }
}
async function writeCacheFile(c) { await ctx.app.writeFile(cachePath(), JSON.stringify(c)) }
/** 全量重建缓存。store 若带读失败月份则拒绝落盘 —— 残缺重建会把防覆盖证词清零,
 *  下一次 addMemo 就可能把「读不到但存在」的整月覆写掉(P0 链条,check 有回归)。 */
async function rebuildCacheFromStore(store) {
  const failed = (store && store.failedMonths) || []
  if (failed.length) throw new Error(t('rebuildRefused', { c: nMonthFiles(failed.length), list: joinList(failed) }))
  const c = cacheFromMemos(flatten(store).map((x) => x.m))
  c.builtAt = Date.now()
  await writeCacheFile(c)
  return c
}
/** 缓存增量补丁:用「本次操作前后该月的派生贡献」修正缓存,绝不做全库重建。 */
function applyCacheDelta(c, sub, add) {
  const patch = (table, key, d) => {
    const v = (table[key] || 0) + d
    if (v > 0) table[key] = v
    else delete table[key]
  }
  for (const k of Object.keys(sub.days)) patch(c.days, k, -sub.days[k])
  for (const k of Object.keys(add.days)) patch(c.days, k, add.days[k])
  for (const k of Object.keys(sub.tags)) patch(c.tags, k, -sub.tags[k])
  for (const k of Object.keys(add.tags)) patch(c.tags, k, add.tags[k])
  c.total = Math.max(0, (c.total || 0) - sub.total + add.total)
}

/** 旧版缓存就地升级:按新规则重算 tags。月份没读全就不动(下次打开再试),错标签留一会儿,证词不受影响。 */
function upgradeCacheTags() {
  return enqueueWrite(async () => {
    let c
    try { c = await readCacheFileRaw() } catch { return false }
    if (!c || c.v === CACHE_V) return false
    // 新设备上 firstMonth 还没记:缓存里最早的月份就是扫描起点,否则旧月份的标签重算不到
    const earliest = Object.keys(c.days).sort()[0]
    const ym = earliest ? earliest.slice(0, 7) : ''
    if (YM_RE.test(ym) && (!firstMonth() || ym < firstMonth())) setFirstMonth(ym)
    const all = await loadAll()
    if (all.failedMonths.length) return false
    // 扫描期间别的窗口可能记了一条:重读再写,旧对象上的 days 写回去会抹掉那条证词
    const latest = await readCacheFileRaw()
    if (!latest || latest.v === CACHE_V) return false
    latest.tags = cacheFromMemos(flatten(all).map((x) => x.m)).tags
    latest.v = CACHE_V
    await writeCacheFile(latest)
    return true
  })
}

// ── 成就(旧宿主可选链;宿主自动加 plugin:memoflow: 前缀) ─────────────────
ctx.achievements?.registerSeries({
  id: 'memoflow',
  title: t('appName'),
  achievements: [
    { id: 'capture-100', title: t('achCaptureTitle'), desc: t('achCaptureDesc'), event: 'capture', goal: 100, points: 20 },
    { id: 'streak-7', title: t('achStreakTitle'), desc: t('achStreakDesc'), event: 'streak7', goal: 1, points: 15 },
  ],
})
function trackAchievements(cacheObj) {
  if (!ctx.achievements) return
  try {
    ctx.achievements.track('capture')
    if (streakOf((cacheObj && cacheObj.days) || {}, todayKey()) >= 7) ctx.achievements.track('streak7')
  } catch { /* ignore */ }
}

// ── 跨视图小总线 ─────────────────────────────────────────────────────────────
const bus = (() => {
  const subs = new Set()
  return { on: (f) => (subs.add(f), () => subs.delete(f)), emit: (e) => subs.forEach((f) => { try { f(e) } catch { /* ignore */ } }) }
})()

// ── 写通道串行队列(读-改-写全程排队:并发落库 / 视图变更绝不互相覆盖) ──────
let writeChain = Promise.resolve()
// Mini 是另一个窗口,writeChain 管不到它:读-改-写再套一把跨窗口的 Web Lock,否则两边各写各的会互相覆盖整月。
function enqueueWrite(job) {
  const locks = globalThis.navigator && navigator.locks
  const guarded = !(locks && locks.request) ? job : () => {
    let ran = false
    const inner = () => { ran = true; return job() }
    // 锁本身不可用(沙箱不同源等)退回只靠 writeChain:记一条比防并发要紧
    return locks.request(`plugin.${PLUGIN_ID}.write`, inner).catch((e) => { if (ran) throw e; return job() })
  }
  const p = writeChain.then(guarded)
  writeChain = p.then(() => {}, () => {})
  return p
}

// ── 共享数据:左栏、主视图、活动栏、Mini 同一份(同一窗口经 bus,跨窗口经 pulse / watchFile) ──
const db = { map: new Map(), loading: true, error: '', started: false, pending: null, dirty: null }
/** 换掉一个月的内容。全量加载进行中时记下来:加载的快照可能比这次写入旧,收尾要重读这个月。 */
function setMonth(ym, list) {
  db.map.set(ym, list)
  if (db.dirty) db.dirty.add(ym)
}
let tagIdx = null
let mainMounts = 0
let styleHandle = null
const listSubs = new Set()
const notifyList = () => { for (const cb of [...listSubs]) { try { cb() } catch { /* ignore */ } } }
const flatAll = () => flatten(db.map)
/** 数据变了:标签索引作废,左栏与各视图都刷新。 */
function touched(e) { tagIdx = null; notifyList(); bus.emit(e) }
async function reloadMonth(ym) {
  let list
  try { list = await readMonthRaw(ym) } catch { return } // 瞬时读失败:保留现有画面,绝不当「月已清空」
  if (list && list.length) db.map.set(ym, list)
  else db.map.delete(ym)
}
/** quiet:有数据时后台刷新,界面不闪「加载中」。 */
function loadStore(quiet) {
  if (db.pending) return db.pending
  if (!quiet) { db.loading = true; db.error = ''; touched({ type: 'store' }) }
  db.pending = (async () => {
    db.dirty = new Set()
    try { db.map = await loadAll(); db.error = '' } catch (e) { db.error = (e && e.message) || String(e) }
    while (db.dirty.size) { // 重读途中又有写入就再来一轮
      const months = [...db.dirty]
      db.dirty.clear()
      for (const ym of months) await reloadMonth(ym)
    }
    db.dirty = null
    db.loading = false
    db.pending = null
    const failed = db.map.failedMonths || []
    if (failed.length) say(t('monthsFailed', { c: nMonthFiles(failed.length), list: joinList(failed) }), { level: 'warning' })
    touched({ type: 'store' })
  })()
  return db.pending
}
// 眼见为实:首开就把缓存文件落进工作文件夹(文件树里可见,重建按钮也有对象)。
// 只在「读成功且文件确实缺席」时播种空缓存;读失败(抛错)一律不写 —— 缓存是写前防线的
// 第二道证词,瞬时读失败时把它覆写成空,等于亲手拆掉防线(P0 链条,check 有回归)。
// 内容损坏但在场的文件也不动(「重建缓存」可校准),这里绝不抢救。
async function ensureCacheFile() {
  try {
    const raw = await ctx.app.readFile(cachePath())
    if (raw == null || raw === '') await writeCacheFile({ v: CACHE_V, days: {}, tags: {}, total: 0, builtAt: Date.now() })
  } catch { /* 读失败 ≠ 缺席:什么都不写 */ }
}
/** 第一次用到数据时加载;之后再挂视图(refresh)就后台刷新一次,接住视图关着时 Agent 写进来的条。 */
function ensureStore(refresh) {
  if (db.started) { if (refresh && !db.pending) void loadStore(true); return }
  db.started = true
  void ensureCacheFile().then(upgradeCacheTags).catch(() => {}).then(() => loadStore())
}
// Mini 是另一个窗口:bus 过不去,写完留一条 pulse(localStorage 的 storage 事件只发给别的窗口)。
// 文件被 Agent / 别的编辑器改了走 watchFile。两路都只刷新,不动画。
const PULSE_KEY = `plugin.${PLUGIN_ID}.pulse`
const pulse = (ym) => setLS('pulse', `${ym}|${uuid()}`)
async function refreshFrom(ym) {
  if (ym) await reloadMonth(ym)
  else await loadStore(true)
  touched({ type: 'changed' })
}
const onStorage = (e) => {
  if (e && e.key === PULSE_KEY && e.newValue) void refreshFrom(String(e.newValue).split('|')[0])
  // 另一个窗口看完了回顾:这边的牌堆也收掉,别留着能继续操作的旧卡
  if (e && e.key === `plugin.${PLUGIN_ID}.reviewDone`) { reviewOpen = false; bus.emit({ type: 'changed' }) }
}
let syncRefs = 0
let offWatch = null
function startSync() {
  syncRefs += 1
  if (syncRefs > 1) return
  const ym = monthKeyOf(Date.now())
  try { offWatch = ctx.app.watchFile ? ctx.app.watchFile(monthPath(ym), () => { void refreshFrom(ym) }) : null } catch { offWatch = null }
  if (globalThis.window && window.addEventListener) window.addEventListener('storage', onStorage)
}
function stopSync() {
  syncRefs -= 1
  if (syncRefs > 0) return
  if (offWatch) offWatch()
  offWatch = null
  if (globalThis.window && window.removeEventListener) window.removeEventListener('storage', onStorage)
}

// ── 落一条闪念(输入区 / 快速命令 / 语音共用;入队串行,防读-改-写交错) ──────
function addMemo(rawText) { return enqueueWrite(() => addMemoInner(rawText)) }
async function addMemoInner(rawText) {
  const text = String(rawText == null ? '' : rawText).replace(/\r\n/g, '\n').replace(/\s+$/, '')
  if (!text.trim()) return null
  const now = Date.now()
  const ym = monthKeyOf(now)
  // 写前防线第一道:读失败本身即拒写(不依赖任何证词)——「读不到却要整月重写」没有正当场景。
  let existing
  try { existing = await readMonthRaw(ym) }
  catch { throw new Error(t('writeCanceled', { ym })) }
  if (existing == null) {
    // 第二道:有的宿主把读失败折叠成 null;若本会话记忆或派生缓存证明本月应有数据,
    // 宁可拒写报错,也绝不把整月闪念覆写成只剩这一条(闪念不进回收站,损失不可恢复)。
    const known = Math.max(monthKnownCounts.get(ym) || 0, await cachedMonthCount(ym))
    if (known > 0) throw new Error(t('writeCanceledKnown', { ym, c: nMemos(known) }))
  }
  const memos = existing || []
  // ts 是身份键(编辑态 / 回顾 done 按 ts 匹配):同毫秒并发逐毫秒顺延,保证唯一
  let tms = now
  let iso = new Date(tms).toISOString()
  const seen = new Set(memos.map((m) => m.ts))
  while (seen.has(iso)) { tms += 1; iso = new Date(tms).toISOString() }
  const memo = { ts: iso, text, pinned: false, archived: false }
  memos.push(memo)
  await writeMonth(ym, memos)
  if (!firstMonth() || ym < firstMonth()) setFirstMonth(ym)
  // 缓存是派生物:更新失败绝不动摇已落盘的闪念,更绝不用「读失败折叠出的残缺全量」覆写既有缓存证词。
  let c = null
  try {
    c = await readCacheFileRaw()
    if (c) {
      bumpCacheObj(c, memo)
      c.builtAt = Date.now()
      await writeCacheFile(c)
    } else {
      c = await rebuildCacheFromStore(await loadAll()) // 有月份读失败时它会拒绝落盘(抛错)
    }
  } catch { c = null }
  trackAchievements(c)
  ctx.activity?.log('capture', { text: text.slice(0, 60) })
  if (db.started && (!db.loading || db.dirty)) setMonth(ym, memos)
  pulse(ym)
  touched({ type: 'added', ym, ts: memo.ts })
  return memo
}
/** 状态栏 / 命令面板的最低摩擦入口:单行 prompt 直接落库,不开视图。 */
async function quickCapture() {
  try {
    if (!ctx.app.prompt) { say(t('quickNoPrompt'), { level: 'warning' }); return }
    const v = await ctx.app.prompt(t('quickPrompt'), '')
    if (v == null || !String(v).trim()) return
    await addMemo(v)
    say(t('quickDone'), { level: 'success' })
  } catch (e) { say(t('quickFail', { msg: (e && e.message) || e }), { level: 'error' }) }
}
/** 单条转笔记(免 AI):正文 + 来源时间戳落 整理/,原条打归档标。
 *  同日同首行不覆写:探测到同名文件已存在就追加 -2/-3 序号。 */
async function memoToNote(memo) {
  const firstLine = String(memo.text || '').split('\n').find((l) => l.trim()) || '闪念'
  const base = `${digestDir()}/${dayKeyOfIso(memo.ts)}-${sanitizeFileName(firstLine)}`
  let p = `${base}.md`
  for (let i = 2; i <= 99; i++) {
    let exist = null, unknown = false
    try { exist = await ctx.app.readFile(p) } catch { unknown = true } // 读失败 ≠ 不存在:换下一个名,绝不冒险覆写
    if (exist == null && !unknown) break
    p = `${base}-${i}.md`
  }
  // 产物**路径**不随语言变(见词表注释);只有插件自己写的这行来源说明按当前语言写。
  const body = `${t('noteSource', { ts: memo.ts })}\n\n${memo.text}\n`
  await ctx.app.writeFile(p, body)
  ctx.activity?.log('to_note', { path: p })
  return p
}

// ── 引擎配置 + 纯文本 agent run(照 bluebird 配方;无 agentSlug/execMode) ────
async function getCfg() {
  try {
    const c = await (globalThis.window && window.tangu && window.tangu.getConfig ? window.tangu.getConfig() : null)
    if (c && c.backendUrl) return { backendUrl: c.backendUrl, token: c.token || '', modelId: c.modelId || '' }
  } catch { /* web 回退 */ }
  try { return { backendUrl: location.origin + '/api', token: localStorage.getItem('forsion_token') || '', modelId: '' } } catch { /* ignore */ }
  return { backendUrl: '', token: '', modelId: '' }
}
async function runAgentPlain(cfg, sessionId, message, onTick, signal, onStage) {
  // label 传的是**词表键**不是成品串:整理跑到一半用户切语言,进度条也要当场跟着变。
  const stage = (pct, label) => { if (onStage) onStage(pct, label) }
  stage(6, 'stageSubmit')
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` }
  const start = await fetch(`${cfg.backendUrl}/agent/runs`, {
    method: 'POST', headers: h, signal,
    body: JSON.stringify({ session_id: sessionId, model_id: cfg.modelId || undefined, app_id: APP_ID, message, attachments: [] }),
  })
  if (!start.ok) throw new Error((await start.text().catch(() => '')) || t('runStartFail', { code: start.status }))
  const { runId } = await start.json()
  if (!runId) throw new Error(t('runNoId'))
  const res = await fetch(`${cfg.backendUrl}/agent/runs/${encodeURIComponent(runId)}/events?fromSeq=0`, { headers: h, signal })
  if (!res.ok || !res.body) throw new Error(t('runSubFail', { code: res.status }))
  const reader = res.body.getReader(), dec = new TextDecoder()
  let buf = '', lastSeq = 0, content = ''
  while (true) {
    const chunk = await reader.read()
    if (chunk.done) break
    buf += dec.decode(chunk.value, { stream: true })
    const parts = buf.split('\n'); buf = parts.pop() || ''
    for (const line of parts) {
      const s = line.trim()
      if (!s || s.startsWith(':') || !s.startsWith('data:')) continue
      const data = s.slice(5).replace(/^ /, ''); if (!data) continue
      let ev; try { ev = JSON.parse(data) } catch { continue }
      if (typeof ev.seq === 'number') { if (ev.seq <= lastSeq) continue; lastSeq = ev.seq }
      if (ev.type === 'status') { const st = ev.payload && ev.payload.state; stage(st === 'queued' ? 12 : 20, st === 'queued' ? 'stageQueued' : 'stageRunning') }
      if (ev.type === 'token') {
        const d = ev.payload && ev.payload.delta
        if (d) { content += d; if (onTick) onTick(content) }
        stage(Math.min(92, 26 + content.length / 90), 'stageWriting')
        continue
      }
      if (ev.type === 'done') { stage(100, 'stageDone'); return (ev.payload && ev.payload.content) || content }
      if (ev.type === 'error') throw new Error((ev.payload && ev.payload.error) || t('runErr'))
    }
  }
  throw new Error(t('runBroken'))
}

// ── AI 周整理(模型侧指令一律英文;结构化产出回 ```digest 块,插件自己落盘) ──
function buildDigestMessage(entries, weekId) {
  const listing = (entries || []).map((m) => `[${m.ts}] ${String(m.text || '').replace(/\n/g, '\n    ')}`).join('\n\n')
  // 指令段一律英文;只有插件钉死的那个结构标签跟界面语言走(正文语言仍跟闪念本身)。
  const quote = t('digestQuoteLabel')
  return `Organize my fleeting notes ("memos") below into a weekly digest for week ${weekId}.

Each memo starts with its ISO timestamp in [brackets]; indented lines continue the same memo.

Requirements:
- Cluster the memos by theme: one "## <theme title>" section per theme, most important theme first.
- Under each theme: 2-5 bullet points that synthesize the ideas, then a "${quote}" sub-list quoting the original memo sentences verbatim, each quote followed by its timestamp in backticks (e.g. \`2026-08-03T02:11:05.000Z\`).
- Write the digest body in the same language as the memos (do not translate them).
- Cover every distinct idea; merge duplicates; never invent content that is not in the memos.
- Output ONLY one fenced code block whose info string is "digest", containing the whole markdown digest, and nothing outside the block:

\`\`\`digest
## <theme>
- <point>
- ${quote}:
  - "<original sentence>" — \`<timestamp>\`
\`\`\`

Memos:

${listing}`
}
function parseDigest(out) {
  // 贪婪到「最后一个 ```」:digest 正文里嵌代码围栏(周整理贴命令/代码很常见)不许把整理截成半份。
  const m = /```digest\s*\n([\s\S]*)```/i.exec(String(out || ''))
  return m ? m[1] : null
}
/** 整理语料:近 7 天(本地日)未归档;不足 50 条则取全库最近 50 条(归档除外)。 */
function digestCorpus(memos, today) {
  const live = (memos || []).filter((m) => !m.archived).sort((a, b) => (a.ts < b.ts ? -1 : 1))
  const cut = daySerial(today) - 6
  const recent = live.filter((m) => daySerial(dayKeyOfIso(m.ts)) >= cut)
  return recent.length >= 50 ? recent : live.slice(-50)
}

// 模块级整理任务:关掉视图照跑,完成自动落盘 + 打开笔记。
// label 存**词表键**、errorKey 存插件自造错误的键(引擎回的原文只能原样留在 error):
// 语言一变,进度条与「已取消」当场跟着变,不靠重挂视图。
const digest = { running: false, pct: 0, label: '', error: '', errorKey: '', controller: null, outPath: '' }
const dEmit = () => bus.emit({ type: 'digest' })
async function runDigest() {
  if (digest.running) { say(t('digestBusy'), { level: 'warning' }); return }
  digest.error = ''; digest.errorKey = ''; digest.outPath = ''
  let corpus
  try { corpus = digestCorpus(flatten(await loadAll()).map((x) => x.m), todayKey()) }
  catch (e) { say(t('readMemosFail', { msg: (e && e.message) || e }), { level: 'error' }); return }
  if (!corpus.length) { say(t('digestNoCorpus'), { level: 'warning' }); return }
  const cfg = await getCfg()
  if (!cfg.backendUrl || !cfg.token) { say(cfg.backendUrl ? t('digestNeedLogin') : t('digestNoEngine'), { level: 'error' }); return }
  const week = isoWeekOf(todayKey())
  digest.running = true; digest.pct = 4; digest.label = 'stagePrepare'; digest.controller = new AbortController()
  dEmit()
  try {
    const msg = buildDigestMessage(corpus, week)
    const out = await runAgentPlain(cfg, uuid(), msg, null, digest.controller.signal, (pct, label) => {
      digest.pct = Math.max(digest.pct, pct); if (label) digest.label = label; dEmit()
    })
    const body = parseDigest(out) || out
    if (!String(body).trim()) throw new Error(t('digestEmptyOut'))
    // 产物路径固定不随语言变(切语言不该把旧周整理藏起来)
    const p = `${digestDir()}/${week}-周整理.md`
    const head = `${t('digestHead', { date: todayKey(), c: nMemos(corpus.length) })}\n\n`
    await ctx.app.writeFile(p, head + String(body).trim() + '\n')
    digest.outPath = p
    ctx.activity?.log('digest', { week, count: corpus.length })
    say(t('digestOk', { week, dir: digestDir() }), { level: 'success' })
    if (ctx.app.openFile) ctx.app.openFile(p)
  } catch (e) {
    const aborted = digest.controller && digest.controller.signal.aborted
    digest.errorKey = aborted ? 'digestCanceled' : ''
    digest.error = aborted ? '' : ((e && e.message) || String(e))
    if (!aborted) say(t('digestFail', { msg: digest.error }), { level: 'error' })
  } finally {
    digest.running = false; digest.controller = null; dEmit()
  }
}
/** 整理面板要显示的错误文本(自造错误随语言走,引擎原文原样)。 */
const digestErrText = () => (digest.errorKey ? t(digest.errorKey) : digest.error)

// ── 语音速记(照 useVoiceInput 链路;桥缺席按钮不渲染;流/AudioContext 必收) ──
const rec = { mr: null, stream: null, active: false, busy: false, canceled: false, t0: 0 }
function voiceAvailable() {
  const w = globalThis.window
  return !!(w && w.tangu && w.tangu.transcribeAudio && typeof MediaRecorder !== 'undefined' &&
    globalThis.navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
}
/** 录音 Blob → 16kHz 单声道 WAV base64(渲染端解码+重采样,主进程/云端直接吃)。 */
async function blobToWav16k(blob) {
  const arrayBuf = await blob.arrayBuffer()
  const ac = new AudioContext()
  let decoded
  try { decoded = await ac.decodeAudioData(arrayBuf) } finally { await ac.close().catch(() => {}) }
  const frames = Math.max(1, Math.round(decoded.duration * 16000))
  const off = new OfflineAudioContext(1, frames, 16000)
  const src2 = off.createBufferSource()
  src2.buffer = decoded
  src2.connect(off.destination)
  src2.start()
  const pcm = (await off.startRendering()).getChannelData(0)
  let peak = 0
  for (let i = 0; i < pcm.length; i++) { const a = Math.abs(pcm[i]); if (a > peak) peak = a }
  if (peak < 0.005) throw new Error(t('recNoAudio'))
  const n = pcm.length
  const buf = new ArrayBuffer(44 + n * 2)
  const dv = new DataView(buf)
  const w = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)) }
  w(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); w(8, 'WAVE')
  w(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true)
  dv.setUint32(24, 16000, true); dv.setUint32(28, 32000, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true)
  w(36, 'data'); dv.setUint32(40, n * 2, true)
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]))
    dv.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}
async function startRec(onDone, onErr, onState) {
  if (rec.active || rec.busy) return
  let stream
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }) }
  catch (e) {
    onErr(e && e.name === 'NotAllowedError' ? t('micDenied')
      : e && e.name === 'NotFoundError' ? t('micNone')
      : t('micOpenFail', { msg: (e && (e.name || e.message)) || e }))
    return
  }
  const chunks = []
  let mr
  try {
    // 构造与 start 都可能抛(mimeType 不支持 / 设备被抢占):此时流已到手,
    // 必须当场停 tracks 并复位 rec.*,否则系统麦克风指示灯亮到窗口关闭、按钮卡死。
    mr = new MediaRecorder(stream)
    rec.mr = mr; rec.stream = stream; rec.active = true; rec.canceled = false; rec.t0 = Date.now()
    mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data) }
    mr.onstop = async () => {
      try { stream.getTracks().forEach((t) => t.stop()) } catch { /* ignore */ }
      rec.active = false; rec.mr = null; rec.stream = null
      onState()
      if (rec.canceled || !chunks.length) return
      rec.busy = true; onState()
      try {
        const audioBase64 = await blobToWav16k(new Blob(chunks, { type: mr.mimeType || 'audio/webm' }))
        const text = await window.tangu.transcribeAudio({ audioBase64, mime: 'audio/wav' })
        if (text && String(text).trim()) onDone(String(text).trim())
        else onErr(t('recNotHeard'))
      } catch (e) { onErr((e && e.message) || String(e)) }
      finally { rec.busy = false; onState() }
    }
    mr.start()
  } catch (e) {
    try { stream.getTracks().forEach((t) => t.stop()) } catch { /* ignore */ }
    rec.mr = null; rec.stream = null; rec.active = false
    onErr(t('recStartFail', { msg: (e && (e.name || e.message)) || e }))
    onState()
    return
  }
  onState()
}
function stopRec(cancel) {
  if (!rec.mr) return
  rec.canceled = !!cancel
  try { rec.mr.stop() } catch { /* ignore */ }
}
function stopRecHard() {
  if (rec.stream) { try { rec.stream.getTracks().forEach((t) => t.stop()) } catch { /* ignore */ } }
  stopRec(true)
}

// ── XSS 安全渲染:闪念正文 → DOM(只 createElement+textContent;标签可点过滤) ──
const INLINE_RE = new RegExp(`${TAG_RE.source}|(https?:\\/\\/[^\\s]+)`, 'gu')
function renderMemoText(container, text, onTag) {
  container.textContent = ''
  const lines = String(text == null ? '' : text).split('\n')
  for (const line of lines) {
    if (MARKER_LINE.test(line)) continue // Amadeus 块标记行是宿主结构数据,不当正文展示(文件里原样保留)
    const div = document.createElement('div')
    div.className = 'mf-line'
    // 在整行上扫,不切片:TAG_RE 带 ^,切片后 a.com/#frag 的 #frag 会被当成行首
    const re = new RegExp(INLINE_RE.source, INLINE_RE.flags)
    let last = 0
    let m
    while ((m = re.exec(line))) {
      const isTag = m[1] != null
      if (isTag && NOT_TAG.test(m[1])) continue // 纯数字留给后面当普通文字
      const start = isTag ? m.index + m[0].length - m[1].length - 1 : m.index // 前导空白算文字
      if (start > last) div.appendChild(document.createTextNode(line.slice(last, start)))
      last = re.lastIndex
      if (isTag) {
        const tg = document.createElement('span')
        tg.className = 'mf-tag'
        tg.textContent = `#${m[1]}`
        if (onTag) { const name = m[1]; tg.addEventListener('click', () => onTag(name)) }
        div.appendChild(tg)
      } else {
        const a = document.createElement('a')
        a.textContent = m[2]
        const href = safeHref(m[2])
        if (href) { a.setAttribute('href', href); a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer') }
        div.appendChild(a)
      }
    }
    if (last < line.length) div.appendChild(document.createTextNode(line.slice(last)))
    container.appendChild(div)
  }
}

const STYLE = `
.mf-root,.mf-q,.mf-side{color:var(--text);font-size:var(--ui-font-body);line-height:1.6}
.mf-root *,.mf-q *,.mf-side *{box-sizing:border-box}
.mf-root{position:relative;height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden;background:var(--bg)}
.mf-top{flex:none;max-width:640px;width:100%;margin:0 auto;padding:12px 20px 0}
.mf-top:empty{display:none}
/* 最新在下:column-reverse 让滚动原点落在底部,打开就在最新、新行接上不跳、短列表自然贴底。scrollTop 0 = 底,往上翻是负数 */
.mf-scroll{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column-reverse;container:mf-list/size;-webkit-mask-image:linear-gradient(to bottom,#000 calc(100% - 24px),rgb(0 0 0/.7) calc(100% - 18px),rgb(0 0 0/.3) calc(100% - 10px),transparent);mask-image:linear-gradient(to bottom,#000 calc(100% - 24px),rgb(0 0 0/.7) calc(100% - 18px),rgb(0 0 0/.3) calc(100% - 10px),transparent)}
.mf-wrap{flex:1 0 auto;width:100%;max-width:640px;margin:0 auto;padding:18px 20px calc(var(--mf-dock-h,103px) + 8px);display:flex;flex-direction:column;justify-content:flex-end}
.mf-wrap[data-state="1"]{justify-content:center}
@container mf-list (max-height:300px){.empty-state-icon{display:none}}
@container mf-list (max-height:240px){.empty-state-line{display:none}}
/* 输入卡悬浮在正文上,同 Chat:正文从卡底下穿过去,层本身不吃事件,卡两侧的空当把滚轮和框选还给正文 */
.mf-dock{position:absolute;left:0;right:0;bottom:0;z-index:4;pointer-events:none}
.mf-dock-in{position:relative;max-width:656px;margin:0 auto;padding:0 20px 16px;display:flex;flex-direction:column;gap:8px}
.mf-dock-in>*{pointer-events:auto}
.mf-dock-in>div:empty{display:none}
.mf-revpill{display:inline-flex;align-items:center;gap:4px;height:26px;padding:0 9px;border:0;border-radius:var(--radius-pill);background:var(--overlay-medium);color:var(--text);font:inherit;font-size:12px;white-space:nowrap;cursor:pointer}
.mf-revpill:hover{background:var(--overlay-strong)}
.mf-revpill[hidden]{display:none}
.mf-revpill[aria-expanded="true"]{background:var(--action-fill);color:var(--on-action)}
.mf-jump{position:absolute;left:0;right:0;bottom:calc(var(--mf-dock-h,103px) + 8px);z-index:5;width:max-content;margin-inline:auto;display:inline-flex;align-items:center;height:30px;padding:0 12px;border:0;border-radius:var(--radius-pill);background:var(--bg-card);box-shadow:var(--card-shadow);color:var(--text);font:inherit;font-size:var(--ui-font-caption);font-weight:500;white-space:nowrap;cursor:pointer}
.mf-jump[hidden]{display:none}
.mf-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px}
.mf-title{font-size:17px;font-weight:600}
.mf-stats{font-size:12px;color:var(--text-faint);white-space:nowrap}
.mf-flex1{flex:1}
.btn.mf-ib{display:inline-flex;align-items:center;justify-content:center;gap:5px;height:28px;min-width:28px;padding:0 7px}
.btn.ghost.mf-ib,.mf-racts .btn.ghost{border-color:transparent;background:transparent;box-shadow:none}
.btn.ghost.mf-ib:hover,.mf-racts .btn.ghost:hover{background:var(--overlay-medium)}
.mf-comp{background:var(--bg-card);border-radius:var(--radius-lg);box-shadow:var(--card-shadow);padding:12px 14px}
.mf-crow{display:flex;align-items:center;gap:6px;margin-top:6px;color:var(--text-muted)}
.mf-ta{display:block;width:100%;min-height:42px;max-height:220px;resize:none;padding:0;font:inherit;color:var(--text);background:transparent;border:0;outline:none}
.mf-ta::placeholder{color:var(--text-faint)}
.mf-edit{min-height:66px;padding:8px 10px;background:var(--overlay-light);border-radius:var(--radius-sm);margin-bottom:6px}
.mf-input{width:100%;margin-top:12px;padding:6px 10px;font:inherit;font-size:12px;color:var(--text);background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm)}
.mf-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.mf-suggest{gap:6px;margin-top:8px}
.mf-suggest:empty{display:none}
.mf-chips{display:flex;gap:6px;margin-top:12px;flex-wrap:wrap}
.mf-chip{display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:var(--radius-pill);background:var(--overlay-medium);color:var(--text);font:inherit;font-size:12px;cursor:pointer;border:0;white-space:nowrap}
.mf-chip:hover{background:var(--overlay-strong)}
.mf-chip.on{background:var(--action-fill);color:var(--on-action)}
.mf-vmsg{font-size:11px;color:var(--danger)}
.mf-vmsg:empty{display:none}
.mf-voice.rec{color:var(--danger);animation:mfpulse 1.2s ease-in-out infinite}
@keyframes mfpulse{50%{opacity:.5}}
/* 牌堆浮在输入卡上方,不进悬浮层的量高:点开不推动列表 */
.mf-review{position:absolute;left:20px;right:20px;bottom:100%;margin-bottom:8px}
.mf-review:empty{display:none}
.mf-deck{position:relative}
.mf-rc{position:relative;z-index:1;display:grid;grid-template-columns:1fr auto;gap:2px 12px;align-items:center;padding:10px 12px;border-radius:var(--radius-md);background:var(--bg-card);box-shadow:var(--card-shadow)}
.mf-rc.under{position:absolute;inset:0;z-index:0}
.mf-rdate{grid-column:1/3;font-size:11px;color:var(--text-faint)}
.mf-rtext{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.mf-racts{display:flex;gap:2px}
.mf-flt{display:none;align-items:center;gap:8px;font-size:12px;color:var(--text-muted);flex-wrap:wrap}
.mf-flt.on{display:flex}
.mf-list{margin-top:4px}
.mf-day{font-size:11px;color:var(--text-faint);padding:14px 0 4px}
.mf-rowwrap{margin:0 -8px}
.mf-memo{position:relative;display:grid;grid-template-columns:46px 1fr;gap:6px;padding:6px 8px;border-radius:var(--radius-sm)}
.mf-memo.editing{display:block}
.mf-memo:hover{background:var(--overlay-light)}
.mf-time{color:var(--text-faint);font-size:11px;padding-top:2px;font-variant-numeric:tabular-nums}
.mf-acts{position:absolute;right:4px;top:2px;display:flex;gap:2px;border-radius:var(--radius-sm);background:var(--bg);opacity:0;pointer-events:none;transition:opacity var(--duration-fast) var(--ease-calm,cubic-bezier(.33,1,.68,1))}
.mf-memo:hover .mf-acts,.mf-memo:focus-within .mf-acts,.mf-acts.phone{opacity:1;pointer-events:auto}
.mf-acts.phone{background:transparent}
.btn.mf-abtn{min-width:24px;height:24px;padding:0 4px;font-size:11px}
.btn.mf-abtn.danger:hover{color:var(--danger)}
.mf-mbody{min-width:0;word-break:break-word}
.mf-line{min-height:1.2em}
.mf-tag{color:var(--accent-ink);background:color-mix(in srgb,var(--accent-ink) 12%,transparent);border-radius:var(--radius-pill);padding:0 .4em;cursor:pointer;white-space:nowrap}
.mf-mbody a{color:var(--accent-ink);word-break:break-all}
.mf-empty{padding:44px 12px;text-align:center;color:var(--text-faint)}
.mf-empty b{display:block;font-size:15px;font-weight:600;color:var(--text-muted);margin-bottom:8px}
.mf-digest{margin:0;background:var(--bg-card);border-radius:var(--radius-md);box-shadow:var(--card-shadow);padding:10px 12px}
.mf-prog-head{display:flex;justify-content:space-between;gap:8px;font-size:12px;color:var(--text-muted);margin-bottom:5px}
.mf-prog-track{height:4px;border-radius:var(--radius-pill);background:var(--overlay-medium);overflow:hidden}
.mf-prog-fill{height:100%;width:0;border-radius:var(--radius-pill);background:var(--action-fill);transition:width var(--duration-slow) var(--ease-calm,cubic-bezier(.33,1,.68,1))}
.mf-err{color:var(--danger);font-size:12px}
.mf-ghost{position:absolute;z-index:6;pointer-events:none;white-space:pre-wrap;word-break:break-word;max-height:200px;overflow:hidden;color:var(--text);font-size:13px;line-height:1.6}
.mf-side{height:100%;overflow:auto;padding:10px 8px;color:var(--text-light)}
.mf-cap{font-size:11px;color:var(--text-faint);padding:2px 9px 4px}
.mf-heat{display:grid;grid-template-rows:repeat(7,14px);grid-auto-flow:column;grid-auto-columns:14px;gap:4px;padding:4px 9px}
.mf-cell{border-radius:3px;background:var(--overlay-medium);cursor:pointer}
.mf-cell.lv1{background:color-mix(in srgb,var(--text) 18%,transparent)}
.mf-cell.lv2{background:color-mix(in srgb,var(--text) 32%,transparent)}
.mf-cell.lv3{background:color-mix(in srgb,var(--text) 48%,transparent)}
.mf-cell.lv4{background:color-mix(in srgb,var(--text) 62%,transparent)}
.mf-cell.sel{outline:var(--focus-ring) solid var(--accent-ink)}
.mf-cell.future{visibility:hidden}
.mf-stat{display:flex;gap:18px;padding:10px 9px;font-size:12px;color:var(--text-muted)}
.mf-stat b{display:block;font-size:17px;font-weight:600;color:var(--text)}
.mf-weekcard{background:var(--overlay-light);border-radius:var(--radius-md);padding:10px 12px;margin:10px 9px}
.mf-weekcard small{display:block;color:var(--text-faint);font-size:11px;margin-bottom:4px}
.mf-weekgo{margin-top:8px}
.mf-q{position:relative;height:100%;min-height:0;display:flex;flex-direction:column;gap:8px;padding:10px;overflow:hidden;background:var(--bg)}
.mf-q .mf-comp{padding:9px 11px}
.mf-q .mf-ta{min-height:22px}
.mf-q-rest{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column-reverse}
.mf-qdock{flex:none;position:relative}
.mf-q .mf-review{left:0;right:0}
.mf-q .mf-rc{grid-template-columns:1fr}
.mf-q .mf-rdate{grid-column:1}
.mf-q[data-tiny="1"]{overflow:auto}
.mf-q[data-tiny="1"] .mf-q-rest,.mf-q[data-tiny="1"] .mf-qchips,.mf-q[data-tiny="1"] .mf-review,.mf-q[data-tiny="1"] .mf-revpill{display:none}
.mf-qchips{flex:none;display:flex;gap:6px;flex-wrap:nowrap;overflow:hidden}
.mf-q[data-wide="1"] .mf-qchips{flex-wrap:wrap}
.mf-q .mf-rowwrap{margin:0}
.mf-q .mf-memo{grid-template-columns:40px 1fr}
.mf-q .mf-day{padding-top:8px}
.mf-root[data-phone]{font-size:14px}
.mf-root[data-phone] .mf-wrap{max-width:none;padding:12px 16px calc(var(--mf-dock-h,103px) + 8px)}
.mf-root[data-phone] .mf-dock-in{max-width:none;padding:0 8px calc(12px + env(safe-area-inset-bottom))}
.mf-root[data-phone] .mf-review{left:8px;right:8px}
.mf-root[data-phone] .mf-memo{padding-right:40px}
.mf-root[data-phone] .btn.mf-abtn{min-width:36px;height:36px}
.mf-root[data-phone] .mf-rc{grid-template-columns:1fr}
.mf-root[data-phone] .mf-rdate{grid-column:1}
.mf-root[data-phone] .mf-racts .btn{min-height:36px}
@media (prefers-reduced-motion: reduce){.mf-voice.rec{animation:none}}
`

// ── UI 构件小工具(纯 createElement 直引用,check 的 DOM 垫片可直测) ─────────
function h(tag, cls, text) {
  const el = document.createElement(tag)
  if (cls) el.className = cls
  if (text != null) el.textContent = text
  return el
}
function mkBtn(label, cls, onClick) {
  const b = h('button', `btn${cls ? ' ' + cls : ''}`, label)
  b.setAttribute('type', 'button')
  if (onClick) b.addEventListener('click', onClick)
  return b
}
/** 词表图标。旧宿主没有 ctx.ui.icon → null,调用方退回文字。 */
function mkIcon(name, size) {
  try { return (ctx.ui && ctx.ui.icon && ctx.ui.icon(name, { size })) || null } catch { return null }
}
/** 只有图标的按钮:名字进 aria-label + title;没有图标词表的宿主直接写字。 */
function iconBtn(icon, label, cls, onClick) {
  const b = mkBtn('', `ghost sm mf-ib${cls ? ' ' + cls : ''}`, onClick)
  const svg = mkIcon(icon, 15)
  if (svg) b.appendChild(svg)
  else b.textContent = label
  b.setAttribute('aria-label', label)
  b.setAttribute('title', label)
  return b
}
/** 换语言时改图标钮的名字;没图标的宿主同时改字。 */
function relabel(b, label) {
  b.setAttribute('aria-label', label)
  b.setAttribute('title', label)
  if (!(ctx.ui && ctx.ui.icon)) b.textContent = label
}

// ── 动效(时长与曲线抄 play.html;减少动态效果:位移全关,只留淡入淡出) ─────
// WAAPI 的 easing 不认 var(),所以写字面值:surface / calm 与宿主 --ease-surface / --ease-calm 同一条曲线。
const EASE = { surface: 'cubic-bezier(.22,1,.36,1)', calm: 'cubic-bezier(.33,1,.68,1)', chat: 'cubic-bezier(.2,.8,.3,1)' }
function calmMotion() {
  try { return !!(globalThis.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) } catch { return false }
}
const motionMs = (ms) => (calmMotion() ? Math.min(ms, 120) : ms)
const canAnimate = (el) => !!el && typeof el.animate === 'function'
/** 动一下;元素不支持时返回已完成的 promise(落到终态由调用方兜底)。 */
function anim(el, frames, ms, ease) {
  if (!canAnimate(el)) return Promise.resolve()
  const kf = calmMotion() ? frames.map((f) => { const c = { ...f }; delete c.transform; return c }) : frames
  const a = el.animate(kf, { duration: motionMs(ms), easing: ease || EASE.surface, fill: 'backwards' })
  return a && a.finished ? a.finished.catch(() => {}) : Promise.resolve()
}
/** 高度从 a 到 b。减少动态效果时不补间(高度变化也是位移)。 */
function animHeight(el, a, b, ms) {
  if (!canAnimate(el) || calmMotion()) return Promise.resolve()
  el.style.overflow = 'hidden'
  return anim(el, [{ height: `${a}px` }, { height: `${b}px` }], ms).then(() => { el.style.overflow = '' })
}
const heightOf = (el) => (el && el.offsetHeight) || 0

/** 按 key 增量更新的一列:动效要的是「留下的行不重建」,整树重画做不到。
 *  entries = [{ key, sig, build() }];sig 变了才重建这一行。
 *  mode:none 直接到位 / filter 筛选(动效 2)/ add 记下一条(动效 1)。 */
function keyedRows(box) {
  const rows = new Map()
  const exit = (wrap, mode) => {
    if (mode !== 'filter' || !canAnimate(wrap)) { wrap.remove(); return }
    wrap.exiting = true
    const inner = wrap.firstChild
    const done = () => wrap.remove()
    if (calmMotion()) { anim(wrap, [{ opacity: 1 }, { opacity: 0 }], 120, EASE.calm).then(done); return }
    anim(inner, [{ opacity: 1 }, { opacity: 0 }], 120, EASE.calm)
    animHeight(wrap, heightOf(wrap), 0, 200).then(done)
  }
  const enter = (wrap) => {
    if (!canAnimate(wrap)) return
    anim(wrap.firstChild, [{ opacity: 0 }, { opacity: 1 }], 200, EASE.calm)
    animHeight(wrap, 0, heightOf(wrap), 200)
  }
  return {
    sync(entries, mode) {
      const want = new Set(entries.map((e) => e.key))
      for (const [key, r] of [...rows]) { if (!want.has(key)) { rows.delete(key); exit(r.wrap, mode) } }
      const fresh = []
      let prev = null
      for (const e of entries) {
        let r = rows.get(e.key)
        if (!r) { r = { wrap: h('div', 'mf-rowwrap'), sig: null }; rows.set(e.key, r); fresh.push(e.key) }
        if (r.sig !== e.sig) { r.wrap.textContent = ''; r.wrap.appendChild(e.build()); r.sig = e.sig }
        let next = prev ? prev.nextSibling : box.firstChild
        while (next && next.exiting) next = next.nextSibling
        if (next !== r.wrap) box.insertBefore(r.wrap, next || null)
        prev = r.wrap
      }
      if (mode === 'filter') for (const key of fresh) enter(rows.get(key).wrap)
      if (mode === 'add') riseIn(box, fresh.map((key) => rows.get(key).wrap))
    },
    clear() { for (const r of rows.values()) r.wrap.remove(); rows.clear() },
  }
}
/** 动效 1:新行接在列表末尾,整张列表一次 transform 托上去,新行从输入卡后面出来。时长曲线同 Chat 的 sendFlight。
 *  只动 transform:逐帧改高度会让裁切和布局一起抖。 */
function riseIn(box, wraps) {
  if (!wraps.length || !canAnimate(box)) return
  if (calmMotion()) {
    for (const w of wraps) anim(w.firstChild, [{ opacity: 0 }, { opacity: 1 }], 120, EASE.calm)
    return
  }
  const lift = wraps.reduce((sum, w) => sum + heightOf(w), 0)
  anim(box, [{ transform: `translateY(${lift}px)` }, { transform: 'none' }], 420, EASE.chat)
  for (const w of wraps) anim(w.firstChild, [{ opacity: 0 }, { opacity: 1 }], 140, 'linear')
}
/** 输入框清空前在原位放一层字影,上移 10px 淡出,代替「啪」一下清空。坐标是视口 px,要除以界面缩放。 */
function fadeDraft(host, tr, text) {
  if (!host || !tr || !text || calmMotion() || !canAnimate(host) || !host.getBoundingClientRect) return
  const z = host.currentCSSZoom || 1, hr = host.getBoundingClientRect()
  const ghost = h('div', 'mf-ghost', text)
  ghost.style.left = `${(tr.left - hr.left) / z}px`
  ghost.style.top = `${(tr.top - hr.top) / z}px`
  ghost.style.width = `${tr.width / z}px`
  host.appendChild(ghost)
  anim(ghost, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-10px)' }], 200, 'ease-out').then(() => { ghost.remove() })
}
/** 滚回最新。窗口在后台时 rAF 不跑,定时器兜底,发送不能卡在这里。 */
function scrollToLatest(sc) {
  const from = sc.scrollTop || 0
  if (Math.abs(from) < 2) return Promise.resolve()
  if (calmMotion() || typeof requestAnimationFrame !== 'function') { sc.scrollTop = 0; return Promise.resolve() }
  return new Promise((done) => {
    let over = false, guard = null
    const finish = () => { if (over) return; over = true; clearTimeout(guard); sc.scrollTop = 0; done() }
    const t0 = performance.now(), ms = 260
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms)
      if (over) return
      if (k >= 1) { finish(); return }
      sc.scrollTop = from * Math.pow(1 - k, 3)
      requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
    guard = setTimeout(finish, ms + 80)
  })
}

// ── 标签视图 ─────────────────────────────────────────────────────────────────
/** 只有闪念(未归档)才算数;父标签 = 自身 + 子标签按条去重;大小写折叠,显示最先出现的写法。 */
function buildTagIndex(list) {
  const nodes = new Map()
  const asc = (list || []).slice().sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0))
  for (const m of asc) {
    const seen = new Set()
    for (const tag of extractTags(m.text)) {
      let lower = '', shown = ''
      for (const seg of tag.split('/').filter(Boolean)) {
        const parent = lower
        lower = lower ? `${lower}/${seg.toLowerCase()}` : seg.toLowerCase()
        shown = shown ? `${shown}/${seg}` : seg
        let n = nodes.get(lower)
        if (!n) { n = { lower, path: shown, name: seg, parent, count: 0, children: [] }; nodes.set(lower, n) }
        if (!seen.has(lower)) { seen.add(lower); n.count += 1 }
      }
    }
  }
  const roots = []
  for (const n of nodes.values()) { const p = n.parent && nodes.get(n.parent); if (p) p.children.push(n); else roots.push(n) }
  const byCount = (a, b) => b.count - a.count || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
  for (const n of nodes.values()) n.children.sort(byCount)
  roots.sort(byCount)
  return { nodes, roots }
}
function tagIndex() {
  if (!tagIdx) tagIdx = buildTagIndex(flatAll().map((x) => x.m).filter((m) => !m.archived))
  return tagIdx
}
const walkTags = (idx, fn) => { const go = (n) => { fn(n); n.children.forEach(go) }; idx.roots.forEach(go) }
/** 产品/路线图 → 「产品 / 路线图」:摊平显示,手机抽屉与旧宿主左栏共用。 */
const flatTitle = (path) => path.split('/').join(' / ')
function memoHasTags(m, tags) {
  if (!tags.length) return true
  const own = extractTags(m.text)
  return tags.every((q) => own.some((tg) => tagMatches(tg, q)))
}
/** # 补全:按使用次数排,先段首命中后子串命中。value 替换「触发符 + 已输入」,宿主补一个空格(shared/chatBox.ts)。 */
function suggestTags(q) {
  const key = String(q == null ? '' : q).replace(/^#/, '').toLowerCase()
  const hit = []
  walkTags(tagIndex(), (n) => {
    if (!key || n.lower.split('/').some((seg) => seg.startsWith(key))) hit.push([0, n])
    else if (n.lower.includes(key)) hit.push([1, n])
  })
  hit.sort((a, b) => a[0] - b[0] || b[1].count - a[1].count)
  return hit.slice(0, 8).map(([, n]) => ({ label: `#${n.path}`, value: `#${n.path}`, hint: String(n.count) }))
}

// ── 左栏列表源的数据 ─────────────────────────────────────────────────────────
const nav = { view: 'all', tags: [], day: '', search: '' }
let reviewOpen = false // 牌堆开着没有。左栏「每日回顾」和胶囊都走这一个
function setNav(patch, mode) {
  Object.assign(nav, patch)
  notifyList()
  bus.emit({ type: 'nav', mode: mode || 'filter' })
}
const clearFilters = (mode) => setNav({ tags: [], day: '', search: '' }, mode)
/** 左栏点标签 = 替换;正文点标签 = 追加(同时满足),已在筛选里就去掉。 */
const pickTag = (tag) => setNav({ view: 'all', tags: [tag], day: '', search: '' })
function addTag(tag) {
  const lower = tag.toLowerCase()
  const has = nav.tags.some((x) => x.toLowerCase() === lower)
  setNav({ tags: has ? nav.tags.filter((x) => x.toLowerCase() !== lower) : nav.tags.concat(tag) })
}
function reviewLeft() {
  if (getLS('reviewDone', '') === todayKey()) return 0
  return currentPicks().filter((m) => !reviewState.done.has(m.ts)).length
}
const pinnedCount = () => flatAll().filter((it) => it.m.pinned && !it.m.archived).length
function firstLine(text) {
  return String(text || '').split('\n').find((l) => l.trim() && !MARKER_LINE.test(l)) || ''
}
/** 给宿主的行。标签树:有子标签的父标签是 folder(点它只开合),所以里面放一行「全部」来筛选父标签本身。 */
function listRows(filter) {
  const all = flatAll()
  if (db.loading || !all.length) return [] // 空的时候左栏不写字,主区讲空状态
  const q = String((filter && filter.query) || '').trim().toLowerCase()
  const idx = tagIndex()
  const tagsGroup = t('navTags')
  if (q) {
    const rows = []
    walkTags(idx, (n) => { if (n.lower.includes(q)) rows.push({ key: `tag:${n.lower}`, title: flatTitle(n.path), hint: String(n.count), icon: 'number', group: tagsGroup }) })
    const hits = all.filter((it) => !it.m.archived && it.m.text.toLowerCase().includes(q)).sort((a, b) => (a.m.ts < b.m.ts ? 1 : -1)).slice(0, 50)
    for (const it of hits) rows.push({ key: `memo:${it.m.ts}`, title: firstLine(it.m.text), hint: dayKeyOfIso(it.m.ts).slice(5), icon: 'zap', group: t('navAll') })
    return rows
  }
  const rows = [{ key: 'nav:all', title: t('navAll'), icon: 'zap', hint: String(all.filter((it) => !it.m.archived).length) }]
  const left = reviewLeft()
  if (left) rows.push({ key: 'nav:review', title: t('navReview'), icon: 'clock', hint: String(left) })
  const pins = pinnedCount()
  if (pins) rows.push({ key: 'nav:pinned', title: t('navPinned'), icon: 'pin', hint: String(pins) })
  rows.push({ key: 'nav:archived', title: t('navArchived'), icon: 'archive' })
  if (treeListOk()) {
    // 新宿主的文件夹行自己能选中;旧宿主点文件夹只开合,里面留一行「全部」筛选父标签本身
    const folderOpens = (ctx.listCapabilities || []).includes('folderOpen')
    const folderKey = (lower) => `${folderOpens ? 'tag' : 'folder'}:${lower}`
    const add = (n) => {
      const parent = n.parent ? folderKey(n.parent) : undefined
      const place = parent ? { parent } : { group: tagsGroup }
      if (!n.children.length) { rows.push({ key: `tag:${n.lower}`, title: n.name, hint: String(n.count), icon: 'number', ...place }); return }
      rows.push({ key: folderKey(n.lower), title: n.name, hint: String(n.count), kind: 'folder', icon: 'number', ...place, ...(folderOpens ? { opensOnClick: true } : {}) })
      if (!folderOpens) rows.push({ key: `tag:${n.lower}`, title: t('tagAllUnder'), hint: String(n.count), icon: 'filter', parent: `folder:${n.lower}` })
      n.children.forEach(add)
    }
    idx.roots.forEach(add)
  } else {
    walkTags(idx, (n) => rows.push({ key: `tag:${n.lower}`, title: flatTitle(n.path), hint: String(n.count), icon: 'number', group: tagsGroup }))
  }
  return rows
}
function listActiveKey() {
  if (nav.tags.length === 1) return `tag:${nav.tags[0].toLowerCase()}`
  return nav.tags.length ? null : `nav:${nav.view}`
}
function openRow(item) {
  const key = String((item && item.key) || '')
  if (mainMounts === 0 && ctx.openView) ctx.openView('memos')
  if (key === 'nav:all') setNav({ view: 'all', tags: [], day: '', search: '' })
  else if (key === 'nav:review') { reviewOpen = true; setNav({ view: 'all', tags: [], day: '', search: '' }, 'none') }
  else if (key === 'nav:pinned') setNav({ view: 'pinned', tags: [], day: '', search: '' })
  else if (key === 'nav:archived') setNav({ view: 'archived', tags: [], day: '', search: '' })
  else if (key.startsWith('tag:')) { const n = tagIndex().nodes.get(key.slice(4)); if (n) pickTag(n.path) }
  else if (key.startsWith('memo:')) setNav({ view: 'all', tags: [], day: dayKeyOfIso(key.slice(5)), search: '' })
}
function rowMenu(item) {
  const key = String((item && item.key) || '')
  const lower = key.replace(/^(tag|folder):/, '')
  if (lower === key) return []
  const n = tagIndex().nodes.get(lower)
  if (!n) return []
  const out = []
  if (key.startsWith('folder:')) out.push({ id: 'filter', label: pText('tagFilter'), icon: 'filter', run: () => { pickTag(n.path) } })
  out.push({ id: 'rename', label: pText('tagRename'), icon: 'pencil', run: () => { void renameTagFlow(n.path, 'rename') } })
  out.push({ id: 'merge', label: pText('tagMerge'), run: () => { void renameTagFlow(n.path, 'merge') } })
  return out
}

// ── 标签改名 / 合并(写盘:只动标签本身,其余字节一个不变) ──────────────────
/** 一段正文里把 from(含它的子标签)改成 to。改完和同条已有标签重复的,删掉这一处(连同它前面一个空白)。 */
function renameTagInText(text, from, to) {
  const s = String(text == null ? '' : text)
  const re = new RegExp(TAG_RE.source, TAG_RE.flags)
  const occ = []
  let m
  while ((m = re.exec(s))) {
    if (NOT_TAG.test(m[1])) continue
    const hit = tagMatches(m[1], from)
    occ.push({ start: re.lastIndex - m[1].length, end: re.lastIndex, tag: m[1], hit, next: hit ? to + m[1].slice(from.length) : m[1] })
  }
  const kept = new Set(occ.filter((o) => !o.hit).map((o) => o.tag.toLowerCase()))
  let out = '', last = 0, n = 0
  for (const o of occ) {
    if (!o.hit) continue
    n += 1
    const k = o.next.toLowerCase()
    if (kept.has(k)) {
      let a = o.start - 1, b = o.end // a 指向 #
      if (a > 0 && (s[a - 1] === ' ' || s[a - 1] === '\t')) a -= 1
      else if (s[b] === ' ' || s[b] === '\t') b += 1
      out += s.slice(last, a)
      last = b
    } else {
      kept.add(k)
      out += s.slice(last, o.start) + o.next
      last = o.end
    }
  }
  return { text: out + s.slice(last), n }
}
/** 月文件原文上逐节改,不过 parse / serialize:前言、时间戳行、块标记行、哨兵、空行全都逐字留着。 */
function renameTagInMonth(raw, from, to) {
  const s = String(raw == null ? '' : raw)
  const spans = []
  let pos = 0, body = -1
  for (const line of s.split('\n')) {
    if (TS_LINE.test(line)) {
      if (body >= 0) spans.push([body, pos])
      body = pos + line.length + 1
    }
    pos += line.length + 1
  }
  if (body >= 0) spans.push([Math.min(body, s.length), s.length])
  let out = '', last = 0, memosHit = 0
  for (const [a, b] of spans) {
    const r = renameTagInText(s.slice(a, b), from, to)
    out += s.slice(last, a) + r.text
    last = b
    if (r.n) memosHit += 1
  }
  return { text: out + s.slice(last), memos: memosHit }
}
/** 读全部月份算出要改什么。任何一个月读不到都抛错:这一步抛了,后面一个字都不写。 */
async function planTagRename(from, to) {
  const nowYm = monthKeyOf(Date.now())
  const start = firstMonth() || nowYm
  const plan = []
  for (const ym of monthSeq(start <= nowYm ? start : nowYm, nowYm)) {
    const raw = await readMonthText(ym) // 抛 ioFail
    if (!raw) {
      // 折叠宿主把读失败变成 null:证词说这个月有数据,就当读失败
      if (Math.max(monthKnownCounts.get(ym) || 0, await cachedMonthCount(ym)) > 0) throw new Error(t('readMonthFail', { ym, msg: t('tagMonthGone') }))
      continue
    }
    const r = renameTagInMonth(raw, from, to)
    if (r.memos) plan.push({ ym, raw, next: r.text, memos: r.memos })
  }
  return plan
}
async function applyTagRename(from, to) {
  return enqueueWrite(async () => {
    const plan = await planTagRename(from, to) // 确认框开着的时候文件可能变了:以此刻的磁盘为准
    const sub = { days: {}, tags: {}, total: 0 }, add = { days: {}, tags: {}, total: 0 }
    const seen = {} // 这些月份的日计数:缓存里没有的要补上,否则改完的月份没有防覆盖证词
    const sum = (into, c) => {
      for (const k of Object.keys(c.tags)) into.tags[k] = (into.tags[k] || 0) + c.tags[k]
    }
    let count = 0
    for (const { ym } of plan) {
      // 扫完全部月份要一会儿:每个月写之前重读一次,读写挨着,扫描期间追加的条不被盖掉
      let raw, r
      try {
        raw = await readMonthText(ym)
        if (!raw) throw new Error(t('readMonthFail', { ym, msg: t('tagMonthGone') }))
        r = renameTagInMonth(raw, from, to)
        if (r.memos) await ctx.app.writeFile(monthPath(ym), r.text)
      } catch (e) { const err = new Error((e && e.message) || String(e)); err.partial = count; throw err } // 再改一次能接着补完:已改的不再命中
      if (!r.memos) continue
      const before = parseMonth(raw).memos, after = parseMonth(r.text).memos
      const fresh = cacheFromMemos(after)
      sum(sub, cacheFromMemos(before)); sum(add, fresh)
      Object.assign(seen, fresh.days)
      monthKnownCounts.set(ym, after.length) // 确认期间才出现的月份也要留证词
      setMonth(ym, after)
      count += r.memos
    }
    try {
      const c = await readCacheFileRaw()
      if (c && plan.length) { applyCacheDelta(c, sub, add); for (const d of Object.keys(seen)) if (!c.days[d]) { c.days[d] = seen[d]; c.total += seen[d] } c.builtAt = Date.now(); await writeCacheFile(c) }
    } catch { /* 派生物:写不上就等「重建缓存」,闪念已经改好了 */ }
    return count
  })
}
/** 改名与合并同一条写路径,差别只在问法:合并的目标必须已经存在。 */
async function renameTagFlow(path, mode) {
  const merging = mode === 'merge'
  if (!ctx.app.prompt) { say(t('quickNoPrompt'), { level: 'warning' }); return }
  let raw
  try { raw = await ctx.app.prompt(t(merging ? 'tagMergePrompt' : 'tagRenamePrompt', { tag: path }), merging ? '' : path) } catch { return }
  if (raw == null || !String(raw).trim()) return
  const to = normTag(raw)
  if (!to) { say(t('tagBadName'), { level: 'warning' }); return }
  const from = path
  if (to === from) return
  if (to.toLowerCase().startsWith(`${from.toLowerCase()}/`)) { say(t('tagIntoSelf'), { level: 'warning' }); return }
  if (merging && !tagIndex().nodes.has(to.toLowerCase())) { say(t('tagMergeMissing', { tag: to }), { level: 'warning' }); return }
  let plan
  try { plan = await planTagRename(from, to) }
  catch (e) { say(t('tagFail', { msg: (e && e.message) || e }), { level: 'error' }); return }
  const count = plan.reduce((n, p) => n + p.memos, 0)
  if (!count) return
  const body = t('tagConfirmBody', { c: nMemos(count), from, to })
  const title = t(merging ? 'tagMergeTitle' : 'tagRenameTitle')
  let ok = false
  if (ctx.ui && ctx.ui.confirm) ok = await ctx.ui.confirm({ title, body })
  else {
    let v = null
    try { v = await ctx.app.prompt(`${body} ${t('tagConfirmType')}`, '') } catch { return }
    ok = v != null && String(v).trim().toLowerCase() === 'y'
  }
  if (!ok) return
  try {
    const n = await applyTagRename(from, to)
    const nextTags = nav.tags.map((q) => (tagMatches(q, from) ? to + q.slice(from.length) : q))
    pulse('')
    nav.tags = nextTags
    touched({ type: 'changed' })
    say(t('tagDone', { c: nMemos(n) }), { level: 'success' })
  } catch (e) {
    const msg = (e && e.message) || e
    if (e && e.partial) { pulse(''); touched({ type: 'changed' }) }
    say(e && e.partial ? t('tagPartial', { c: nMemos(e.partial), msg }) : t('tagFail', { msg }), { level: 'error' })
  }
}

// ── 对闪念的修改(视图共用;写路径的防线都在 persistMonthOp) ──────────────────
// 变更以「磁盘现状为基 + 按 ts 重放本次修改」落盘(经典 read-modify-write):
// 并发新条天然保全;磁盘读不到(抛错或缺席)一律拒改 —— 能被改的条目必然来自一次成功读过的月文件,
// 「读不到却要整月重写」没有正当场景;旧版曾回退陈旧 store 整月重写,覆没过外部新写的条(P1 回归)。
async function persistMonthOp(ym, apply) {
  await enqueueWrite(async () => {
    let disk
    try { disk = await readMonthRaw(ym) }
    catch { throw new Error(t('editCanceled', { ym })) }
    if (disk == null) throw new Error(t('editCanceledGone', { ym }))
    const arr = disk
    const before = cacheFromMemos(arr)
    apply(arr)
    setMonth(ym, arr)
    await writeMonth(ym, arr)
    // 缓存走增量补丁,绝不由 store 全量重建 —— store 可能缺读失败的月份,全量重建会把防覆盖证词清零(P0 链条)。
    try {
      const c = await readCacheFileRaw()
      if (c) {
        applyCacheDelta(c, before, cacheFromMemos(arr))
        c.builtAt = Date.now()
        await writeCacheFile(c)
      }
    } catch { /* 缓存读失败:跳过本次派生更新,保住证词;缓存的账「重建缓存」随时可校准 */ }
  })
  pulse(ym)
}
function findMemo(ts) {
  for (const it of flatAll()) { if (it.m.ts === ts) return it }
  return null
}
async function patchMemo(ts, patch) {
  const it = findMemo(ts)
  if (!it) return
  const m = it.m
  const prev = {}
  for (const k of Object.keys(patch)) prev[k] = m[k]
  try {
    Object.assign(m, patch) // 立即反映到 UI;落盘时按 ts 在磁盘现状上重放
    await persistMonthOp(it.ym, (arr) => {
      const x = arr.find((y) => y.ts === ts)
      if (x) Object.assign(x, patch)
    })
    touched({ type: 'changed' })
  } catch (e) {
    Object.assign(m, prev) // 拒改回滚:UI 与磁盘保持一致,不留「看着改成了其实没落盘」的假象
    touched({ type: 'changed' })
    say(t('saveFail', { msg: (e && e.message) || e }), { level: 'error' })
  }
}
async function deleteMemo(ts) {
  const it = findMemo(ts)
  if (!it) return
  // 确认是删除契约的一部分:没有确认框的宿主宁可不删,绝不静默单击即毁
  let ok = false
  if (ctx.ui && ctx.ui.confirm) ok = await ctx.ui.confirm({ title: t('deleteTitle'), body: firstLine(it.m.text).slice(0, 80), danger: true })
  else {
    if (!ctx.app.prompt) { say(t('deleteNoPrompt'), { level: 'warning' }); return }
    let v
    try { v = await ctx.app.prompt(t('deleteConfirm'), '') } catch { return }
    ok = v != null && String(v).trim().toLowerCase() === 'y'
  }
  if (!ok) return
  const prevArr = db.map.get(it.ym) || []
  try {
    db.map.set(it.ym, prevArr.filter((x) => x !== it.m)) // UI 先行
    await persistMonthOp(it.ym, (arr) => {
      const i = arr.findIndex((y) => y.ts === ts)
      if (i >= 0) arr.splice(i, 1)
    })
    say(t('deleted'), { level: 'success' })
    touched({ type: 'changed' })
  } catch (e) {
    db.map.set(it.ym, prevArr) // 拒改回滚:磁盘没删成,画面也不能装删了
    touched({ type: 'changed' })
    say(t('deleteFail', { msg: (e && e.message) || e }), { level: 'error' })
  }
}
async function toNote(ts) {
  const it = findMemo(ts)
  if (!it) return
  const wasArchived = it.m.archived
  try {
    const p = await memoToNote(it.m)
    it.m.archived = true
    await persistMonthOp(it.ym, (arr) => {
      const x = arr.find((y) => y.ts === ts)
      if (x) x.archived = true
    })
    say(t('toNoteOk'), { level: 'success' })
    if (ctx.app.openFile) ctx.app.openFile(p)
    touched({ type: 'changed' })
  } catch (e) {
    it.m.archived = wasArchived // 归档标没落盘就不装归档了(笔记文件若已写出则保留)
    touched({ type: 'changed' })
    say(t('toNoteFail', { msg: (e && e.message) || e }), { level: 'error' })
  }
}
async function doRebuild() {
  try {
    const cur = firstMonth() || monthKeyOf(Date.now())
    let ym = cur
    if (ctx.app.prompt) {
      const v = await ctx.app.prompt(t('rebuildPrompt'), cur)
      if (v == null) return
      ym = String(v).trim() || cur
    }
    if (!YM_RE.test(ym)) { say(t('rebuildBadMonth'), { level: 'warning' }); return }
    if (ym < cur) setFirstMonth(ym)
    // 用户主动重建 = 声明「以磁盘现状为准」:清掉写前防线的会话记忆,免得删过月文件后被拒写死锁
    monthKnownCounts.clear()
    monthPreambles.clear()
    await loadStore()
    const c = await rebuildCacheFromStore(db.map)
    say(t('rebuildOk', { c: nMemos(c.total) }), { level: 'success' })
    touched({ type: 'changed' })
  } catch (e) { say(t('rebuildFail', { msg: (e && e.message) || e }), { level: 'error' }) }
}

// ── 每日回顾的取卡(模块级:同日内跨视图开关不丢「已处理」;picks = 当天首算后冻结的 ts 列表,
// 处理动作缩小池子也绝不重抽 —— 「同一天里抽到的卡固定」是 SPEC 契约) ─────────────
const reviewState = { day: '', done: new Set(), picks: null }
function currentPicks() {
  const today = todayKey() // 不叫 t:与词表 helper t() 重名
  if (reviewState.day !== today) { reviewState.day = today; reviewState.done = new Set(); reviewState.picks = null }
  const n = reviewCountSetting()
  if (!n) return []
  const all = flatAll().map((x) => x.m)
  if (!reviewState.picks) {
    if (db.loading) return [] // 数据没到位不冻结,免得把空集钉成「今天没得回顾」
    reviewState.picks = pickReview(reviewEligible(all, today), seedOfDay(today), n).map((m) => m.ts)
  }
  // 冻结后只做过滤,不重抽:已删除的卡掉队;在时间线上被归档(而非经回顾处理)的也掉队;
  // 经回顾动作归档/转笔记的(已进 done)留在分母里,完成判定与「还剩 N/M」才不会自我延长。
  const byTs = new Map()
  for (const m of all) byTs.set(m.ts, m)
  return reviewState.picks.map((ts) => byTs.get(ts)).filter((m) => m && (!m.archived || reviewState.done.has(m.ts)))
}

// ── 输入区(主视图与 Mini 共用) ──────────────────────────────────────────────
/** 语音钮。桥缺席返回 null,不渲染。转写结果交给 onText,绝不直接发出。 */
function voiceButton(onText, onMsg) {
  if (!voiceAvailable()) return null
  const b = mkBtn('', 'ghost sm mf-ib mf-voice', null)
  b.setAttribute('data-voice', '1')
  const svg = mkIcon('audio-lines', 15)
  if (svg) b.appendChild(svg)
  const sync = () => {
    const label = rec.busy ? t('btnVoiceBusy') : rec.active ? t('btnVoiceStop') : t('btnVoice')
    b.setAttribute('aria-label', label)
    b.setAttribute('title', rec.busy || rec.active ? label : `${label} · ${t('voiceHint')}`)
    if (!svg) b.textContent = label
    b.disabled = !!rec.busy
    b.classList.toggle('rec', !!rec.active)
  }
  sync()
  const onDone = (text) => { onMsg(''); onText(text) }
  const onErr = (msg) => { onMsg(msg); say(msg, { level: 'warning' }) }
  // 两种姿势并存:按住说话(down…≥400ms…up/滑出=结束)/ 点击开始-再点结束。
  // ptrDown 区分「指针仍按着」:点击模式下光标移出按钮绝不能结束录音(否则点击模式形同虚设)。
  let ptrDown = false
  b.addEventListener('pointerdown', (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (rec.busy) return
    ptrDown = true
    if (rec.active) { stopRec(false); return }
    onMsg('')
    void startRec(onDone, onErr, sync)
  })
  b.addEventListener('pointerup', () => { const held = ptrDown; ptrDown = false; if (held && rec.active && Date.now() - rec.t0 >= 400) stopRec(false) })
  b.addEventListener('pointerleave', () => { const held = ptrDown; ptrDown = false; if (held && rec.active && Date.now() - rec.t0 >= 400) stopRec(false) })
  b.addEventListener('pointercancel', () => { const held = ptrDown; ptrDown = false; if (held && rec.active) stopRec(true) })
  return { el: b, sync }
}
/** 输入框。新宿主挂 ctx.ui.mountChatBox;认不出新字段(句柄没有 insertText,模型选择藏不掉)或没有这个接口就用自己的 textarea。
 *  opts.send(text):落一条,失败抛错 → 草稿留着。opts.extra:放进底排的控件;opts.ghostHost:字影挂在哪。 */
function mountComposer(slot, opts) {
  const host = h('div', 'mf-composer')
  slot.appendChild(host)
  const vMsg = h('div', 'mf-vmsg', '')
  let draft = ''
  let insert = () => {}
  let refocus = () => {}
  const spaced = (s) => (draft && !/\s$/.test(draft) ? ` ${s}` : s)
  const voice = voiceButton((text) => { insert(spaced(text)); refocus() }, (msg) => { vMsg.textContent = msg })
  const hashBtn = iconBtn('number', t('hashTitle'), '', () => { insert(spaced('#')); refocus() })
  const placeholder = () => t('inputPlaceholder')
  // ChatBox 不把 textarea 交出来:字的位置 = 卡的左上角 + 卡内边距(12 / 14)+ 1px 透明描边
  const cardText = () => { const r = host.getBoundingClientRect(); return { left: r.left + 15, top: r.top + 13, width: r.width - 30 } }
  const fail = (e) => say(t('saveFail', { msg: (e && e.message) || e }), { level: 'error' })

  let box = null
  if (ctx.ui && ctx.ui.mountChatBox) {
    const made = ctx.ui.mountChatBox(host, {
      label: t('appName'), placeholder: placeholder(), submitLabel: t('btnSend'),
      submitOn: 'enter', modelPicker: false,
      toolbar(el) { el.appendChild(hashBtn); if (voice) el.appendChild(voice.el); if (opts.extra) el.appendChild(opts.extra) },
      suggest: { trigger: '#', items: (q) => suggestTags(q) },
      onChange(d) { draft = String((d && d.text) || '') },
      async onSubmit(d) {
        try { await opts.send(d.text); fadeDraft(opts.ghostHost, cardText(), d.text); draft = ''; return true }
        catch (e) { fail(e); return false }
      },
    })
    if (made && typeof made.insertText === 'function') box = made
    else if (made) made.dispose()
  }
  let ta = null, sendBtn = null, suggestRow = null
  if (box) {
    insert = (s) => box.insertText(s)
    refocus = () => box.focus()
  } else {
    const card = h('div', 'mf-comp')
    ta = h('textarea', 'mf-ta')
    ta.setAttribute('rows', opts.compact ? '1' : '2')
    ta.setAttribute('aria-label', t('appName'))
    const autoGrow = () => { if (typeof ta.scrollHeight === 'number' && ta.style) { ta.style.height = 'auto'; ta.style.height = `${Math.min(220, ta.scrollHeight)}px` } }
    suggestRow = h('div', 'mf-row mf-suggest')
    const showSuggest = () => {
      suggestRow.textContent = ''
      const caret = typeof ta.selectionStart === 'number' ? ta.selectionStart : ta.value.length
      const m = /(?:^|\s)#([\p{L}\p{N}_/-]*)$/u.exec(ta.value.slice(0, caret))
      if (!m) return
      for (const it of suggestTags(m[1]).slice(0, 6)) {
        const c = h('button', 'mf-chip', it.label)
        c.setAttribute('type', 'button')
        c.addEventListener('click', () => {
          const end = typeof ta.selectionStart === 'number' ? ta.selectionStart : ta.value.length
          const start = end - m[1].length - 1
          ta.value = `${ta.value.slice(0, start)}${it.value} ${ta.value.slice(end)}`
          draft = ta.value
          suggestRow.textContent = ''
          if (ta.focus) ta.focus()
        })
        suggestRow.appendChild(c)
      }
      anim(suggestRow, [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], 150)
    }
    ta.addEventListener('input', () => { draft = String(ta.value || ''); autoGrow(); showSuggest() })
    let sending = false // Enter 通道重入闸:双击 Enter / Enter+按钮同击只落一条
    const send = async () => {
      if (sending) return
      const v = ta.value
      if (!v || !String(v).trim()) return
      sending = true
      sendBtn.disabled = true
      fadeDraft(opts.ghostHost, ta.getBoundingClientRect ? ta.getBoundingClientRect() : null, v)
      ta.value = ''
      draft = ''
      autoGrow()
      suggestRow.textContent = ''
      try { await opts.send(v) }
      catch (e) { ta.value = v; draft = v; autoGrow(); fail(e) }
      finally { sending = false; sendBtn.disabled = false }
    }
    // 输入法合成态的 Enter(选候选词上屏)不算发送:isComposing / keyCode 229 双闸
    ta.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.shiftKey) return
      if (e.isComposing || e.keyCode === 229) return
      if (e.preventDefault) e.preventDefault()
      void send()
    })
    sendBtn = mkBtn(t('btnSend'), 'primary sm', () => { void send() })
    const toolRow = h('div', 'mf-crow')
    toolRow.appendChild(hashBtn)
    if (voice) toolRow.appendChild(voice.el)
    if (opts.extra) toolRow.appendChild(opts.extra)
    toolRow.appendChild(h('span', 'mf-flex1'))
    toolRow.appendChild(sendBtn)
    card.appendChild(ta)
    card.appendChild(toolRow)
    host.appendChild(card)
    host.appendChild(suggestRow)
    insert = (s) => { ta.value = `${ta.value || ''}${s}`; draft = ta.value; autoGrow(); showSuggest() }
    refocus = () => { if (ta.focus) ta.focus() }
    ta.setAttribute('placeholder', placeholder())
  }
  host.appendChild(vMsg)
  return {
    host,
    focus() { refocus() },
    relabel() {
      if (box) box.update({ label: t('appName'), placeholder: placeholder(), submitLabel: t('btnSend') })
      else {
        ta.setAttribute('placeholder', placeholder())
        ta.setAttribute('aria-label', t('appName'))
        sendBtn.textContent = t('btnSend')
      }
      relabel(hashBtn, t('hashTitle'))
      if (voice) voice.sync() // 录音中也安全:它按 rec 状态重算,不会把「结束录音」写回「语音」
    },
    dispose() { if (box) box.dispose(); if (rec.active || rec.busy) stopRecHard() },
  }
}
/** 周整理进度 / 失败卡:主视图与活动栏各画一份。 */
function drawDigestBox(box) {
  box.textContent = ''
  if (!digest.running && !digest.error && !digest.errorKey) return
  const card = h('div', 'mf-digest')
  if (digest.running) {
    const headRow = h('div', 'mf-prog-head')
    headRow.appendChild(h('span', null, t('digestProgress', { label: digest.label ? t(digest.label) : '' })))
    headRow.appendChild(h('span', null, `${Math.round(digest.pct)}%`))
    const track = h('div', 'mf-prog-track')
    const fill = h('div', 'mf-prog-fill')
    fill.style.width = `${Math.min(100, digest.pct)}%`
    track.appendChild(fill)
    const row = h('div', 'mf-row')
    row.appendChild(h('span', 'mf-flex1'))
    row.appendChild(mkBtn(t('btnCancel'), 'ghost sm', () => { if (digest.controller) digest.controller.abort() }))
    card.appendChild(headRow); card.appendChild(track); card.appendChild(row)
  } else {
    const row = h('div', 'mf-row')
    row.appendChild(h('span', 'mf-err', t('digestFail', { msg: digestErrText() })))
    row.appendChild(h('span', 'mf-flex1'))
    row.appendChild(mkBtn(t('btnRetry'), 'ghost sm', () => { digest.error = ''; digest.errorKey = ''; void runDigest() }))
    row.appendChild(mkBtn(t('btnGotIt'), 'ghost sm', () => { digest.error = ''; digest.errorKey = ''; dEmit() }))
    card.appendChild(row)
  }
  box.appendChild(card)
}
function installStyle(el) {
  if (styleHandle) return
  el.appendChild(h('style', null, STYLE))
}
const dayLabel = (k) => {
  const today = todayKey()
  return k === today ? t('dayToday') : k === shiftDays(today, -1) ? t('dayYesterday') : weekDay(k, today)
}
/** 一行闪念的外形:时间左列 + 正文。actions 是悬停才露的那排。 */
function memoLine(m, onTag, opts) {
  const row = h('div', 'mf-memo')
  row.setAttribute('data-memo', '1')
  row.appendChild(h('span', 'mf-time', opts && opts.justNow ? t('justNow') : timeOfIso(m.ts)))
  const body = h('div', 'mf-mbody')
  renderMemoText(body, m.text, onTag)
  row.appendChild(body)
  return row
}

/** 回顾牌堆:入口是输入卡底排的「回顾 N」,点开浮在卡上方。一次一张,后面两张垫着;0 张整块收起(动效 3)。
 *  opts.blocked():当前视图不出回顾;opts.after():处理完一张后的重画。 */
function reviewDeck(box, opts) {
  const pill = h('button', 'mf-revpill')
  pill.setAttribute('type', 'button')
  const clock = mkIcon('clock', 13)
  if (clock) pill.appendChild(clock)
  const label = h('span', null, '')
  pill.appendChild(label)
  let busy = false
  const remaining = () => {
    if (opts.blocked() || getLS('reviewDone', '') === todayKey()) return []
    return currentPicks().filter((p) => !reviewState.done.has(p.ts))
  }
  function render() {
    box.textContent = ''
    const remain = remaining()
    pill.hidden = !remain.length
    label.textContent = t('reviewPill', { n: remain.length })
    const open = reviewOpen && !!remain.length
    pill.setAttribute('aria-expanded', open ? 'true' : 'false')
    if (!open) return
    const deck = h('div', 'mf-deck')
    const stack = remain.slice(0, 3)
    const cards = []
    for (let i = stack.length - 1; i >= 0; i--) {
      const p = stack[i]
      const rc = h('div', `mf-rc${i ? ' under' : ''}`)
      rc.setAttribute('data-review', '1')
      if (i) {
        rc.setAttribute('aria-hidden', 'true')
        rc.style.transform = `translateY(${i * 6}px) scale(${1 - i * 0.03})`
        rc.style.opacity = String(0.7 - i * 0.2)
      }
      rc.appendChild(h('small', 'mf-rdate', t('reviewHead', { date: shortDay(dayKeyOfIso(p.ts)), left: remain.length })))
      const tx = h('div', 'mf-rtext')
      renderMemoText(tx, p.text, null)
      rc.appendChild(tx)
      if (!i) {
        const acts = h('div', 'mf-racts')
        const act = (text, fn) => acts.appendChild(mkBtn(text, 'ghost sm', () => { void handle(p, fn, rc, cards) }))
        act(t('actSkip'), null)
        act(t('actToNote'), () => toNote(p.ts))
        act(t('actArchive'), () => patchMemo(p.ts, { archived: true }))
        rc.appendChild(acts)
      }
      cards.unshift(rc)
      deck.appendChild(rc)
    }
    box.appendChild(deck)
  }
  async function handle(p, fn, top, cards) {
    if (busy) return
    busy = true
    reviewState.done.add(p.ts)
    const moves = cards.slice(1).map((c, idx) => {
      const d = idx + 1
      return anim(c, [
        { transform: `translateY(${d * 6}px) scale(${1 - d * 0.03})`, opacity: 0.7 - d * 0.2 },
        { transform: `translateY(${(d - 1) * 6}px) scale(${1 - (d - 1) * 0.03})`, opacity: d === 1 ? 1 : 0.5 },
      ], 250)
    })
    moves.push(anim(top, [{ transform: 'none', opacity: 1 }, { transform: 'translateX(28px)', opacity: 0 }], 180, EASE.calm))
    if (cards.length === 1) { top.style.opacity = '0'; moves.push(anim(pill, [{ opacity: 1 }, { opacity: 0 }], 150, EASE.calm)) }
    await Promise.all(moves)
    if (fn) await fn()
    busy = false
    // 处理动作可能让条目失去回顾资格(归档/转笔记)——picksNow 变空同样算「全部处理完」
    const picksNow = currentPicks()
    if (!picksNow.length || picksNow.every((x) => reviewState.done.has(x.ts))) {
      reviewOpen = false
      setLS('reviewDone', todayKey())
      ctx.activity?.log('review_done')
      say(t('reviewDone'), { level: 'success' })
    }
    notifyList()
    opts.after()
  }
  function setOpen(on) {
    if (on === reviewOpen) return
    reviewOpen = on
    pill.setAttribute('aria-expanded', on ? 'true' : 'false')
    if (on) {
      render()
      if (box.firstChild) anim(box.firstChild, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], 200)
      return
    }
    if (box.firstChild) anim(box.firstChild, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(6px)' }], 150, EASE.calm).then(render)
  }
  pill.addEventListener('click', () => { setOpen(!reviewOpen) })
  return { pill, render, close: () => { setOpen(false) } }
}

// ══ 闪念盒主视图 ═════════════════════════════════════════════════════════════
function mountMemos(el, view) {
  el.textContent = ''
  mainMounts += 1
  installStyle(el)
  const phone = isPhone()
  const rootEl = h('div', 'mf-root'); el.appendChild(rootEl)
  if (phone) rootEl.setAttribute('data-phone', '1')
  const topBar = h('div', 'mf-top'); rootEl.appendChild(topBar) // 没有视图头的旧宿主:标题、搜索、标签芯片。时间线顶端是最旧的一头,放不了这些
  const scroll = h('div', 'mf-scroll'); rootEl.appendChild(scroll)
  const wrap = h('div', 'mf-wrap'); scroll.appendChild(wrap)

  let editingTs = ''
  // 编辑框里**还没保存**的草稿。行重建(切语言 / 总线 added / 过滤)会把编辑框整个换成新元素,
  // 若那时回读磁盘原文 `m.text`,用户正在补的一大段当场消失 —— 闪念没有回收站,重画不许吃字。
  // 与 editingTs 同生命周期:进编辑/取消/保存都走 endEdit() 一处清零(null = 尚未改动 → 用 m.text)。
  let editDraft = null
  const endEdit = () => { editingTs = ''; editDraft = null }

  // ── 标题行:新宿主用视图头,旧宿主自己画 ──
  const stats = h('span', 'mf-stats', '')
  const btnDigest = mkBtn('', 'ghost sm', () => { void runDigest() })
  const digestIcon = mkIcon('sparkles', 15)
  const digestText = h('span', null, '')
  if (digestIcon) btnDigest.appendChild(digestIcon)
  btnDigest.appendChild(digestText)
  const hasMenu = !!(ctx.ui && ctx.ui.contextMenu && ctx.ui.icon)
  const btnMore = hasMenu ? iconBtn('more', t('more'), '', () => {
    const entries = [{ label: t('btnRebuild'), icon: 'refresh', run: () => { void doRebuild() } }]
    if (phone) entries.unshift({ label: t('btnDigest'), icon: 'sparkles', run: () => { void runDigest() } })
    ctx.ui.contextMenu({ anchor: btnMore, align: 'end' }, entries)
  }) : null
  const btnRebuild = hasMenu ? null : mkBtn('', 'ghost sm', () => { void doRebuild() })
  // 手机:标签走宿主下拉(安卓上是原生底部抽屉,抓手、搜索和系统返回都归宿主);它也没有就退回芯片
  const PICK_PINNED = '\u0000pinned'
  const tagPickBox = phone ? h('span', 'mf-pick') : null
  let tagPick = null
  const pickOptions = () => {
    const out = [{ value: '', label: `${t('navAll')} · ${flatAll().filter((it) => !it.m.archived).length}` }]
    const pins = pinnedCount()
    if (pins) out.push({ value: PICK_PINNED, label: `${t('navPinned')} · ${pins}` })
    walkTags(tagIndex(), (n) => out.push({ value: n.path, label: `${flatTitle(n.path)} · ${n.count}` }))
    return out
  }
  if (tagPickBox && ctx.ui && ctx.ui.mountControl) {
    tagPick = ctx.ui.mountControl(tagPickBox, {
      type: 'select', size: 'toolbar', value: '', label: t('navTags'), options: pickOptions(),
      onChange: (v) => { if (v === PICK_PINNED) setNav({ view: 'pinned', tags: [], day: '', search: '' }); else if (v) pickTag(v); else setNav({ view: 'all', tags: [], day: '', search: '' }) },
    })
  }
  const useChips = !sidebarOk() && !tagPick
  const headActions = [stats, tagPick ? tagPickBox : null, phone ? null : btnDigest, btnMore, btnRebuild].filter(Boolean)
  const head = ctx.ui && ctx.ui.setViewHead ? ctx.ui.setViewHead(el, { title: pText('appName'), actions: headActions }) : null
  const titleEl = h('span', 'mf-title', '')
  if (!head) {
    const row = h('div', 'mf-head')
    row.appendChild(titleEl)
    row.appendChild(stats)
    row.appendChild(h('span', 'mf-flex1'))
    for (const a of headActions) { if (a !== stats) row.appendChild(a) }
    topBar.appendChild(row)
  }

  // ── 输入区:悬浮在底部,桌面、手机同一套。周整理进度、筛选条跟着它走,翻到哪都看得见 ──
  const dock = h('div', 'mf-dock'); rootEl.appendChild(dock)
  const dockIn = h('div', 'mf-dock-in'); dock.appendChild(dockIn)
  const digestBox = h('div'); dockIn.appendChild(digestBox)
  const filterBar = h('div', 'mf-flt'); dockIn.appendChild(filterBar)
  const reviewBox = h('div', 'mf-review'); dockIn.appendChild(reviewBox)
  const review = reviewDeck(reviewBox, {
    blocked: () => nav.view !== 'all' || !!nav.tags.length || !!nav.day || !!nav.search.trim(),
    after: () => { renderAll('none') },
  })
  let sentNow = false
  const composer = mountComposer(dockIn, {
    extra: review.pill,
    ghostHost: rootEl,
    send: async (text) => {
      await scrollToLatest(scroll) // 翻在上面时先回到底,落点才看得见
      sentNow = true
      try { await addMemo(text) } finally { sentNow = false }
    },
  })
  // 一个高度管列表底部留白和「回到最新」的位置。牌堆是绝对定位,量不进来,点开不推动列表
  const measureDock = () => { rootEl.style.setProperty('--mf-dock-h', `${dock.offsetHeight}px`) }
  measureDock()
  const dockRo = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measureDock) : null
  if (dockRo) dockRo.observe(dock)
  const jump = h('button', 'mf-jump'); rootEl.appendChild(jump)
  jump.setAttribute('type', 'button')
  const jumpText = h('span', null, '')
  jump.appendChild(jumpText)
  jump.hidden = true
  jump.addEventListener('click', () => { void scrollToLatest(scroll) })
  // 旧宿主 / 没有宿主下拉的手机:主区顶部的标签芯片 + 搜索框(新宿主这两样都在左栏)
  const searchEl = useChips ? h('input', 'mf-input') : null
  if (searchEl) searchEl.addEventListener('input', () => { setNav({ search: String(searchEl.value || '') }, 'none') })
  const chipsBox = h('div', 'mf-chips')
  if (useChips) { topBar.appendChild(searchEl); topBar.appendChild(chipsBox) }
  const stateBox = h('div'); wrap.appendChild(stateBox)
  const listBox = h('div', 'mf-list'); wrap.appendChild(listBox)
  const rows = keyedRows(listBox)
  let emptyHost = null
  // 翻在上面时,别处(Mini、云同步)来的新闪念只给按钮加计数,不抢滚动位置
  let seenTs = '', newestTs = '', unread = 0
  const atLatest = () => Math.abs(scroll.scrollTop || 0) < 4
  function syncJump() {
    if (atLatest()) { seenTs = newestTs; unread = 0 }
    jump.hidden = !unread && -(scroll.scrollTop || 0) <= (scroll.clientHeight || 0)
    jumpText.textContent = unread ? `${t('backToLatest')} · ${unread}` : t('backToLatest')
  }
  scroll.addEventListener('scroll', syncJump, { passive: true })
  scroll.addEventListener('click', () => { review.close() })
  rootEl.addEventListener('keydown', (e) => { if (e.key === 'Escape') review.close() })

  // ── 渲染 ──
  function renderStats() {
    const live = flatAll().map((x) => x.m)
    const d = {}
    for (const m of live) { const k = dayKeyOfIso(m.ts); if (k) d[k] = (d[k] || 0) + 1 }
    stats.textContent = live.length ? t('stats', { c: nMemos(live.length), d: streakOf(d, todayKey()) }) : ''
  }
  /** 静态骨架上的文案(标题 / 按钮 / placeholder):语言一变就地重写,不重挂视图。 */
  function renderChrome() {
    titleEl.textContent = t('appName')
    digestText.textContent = t('btnDigest')
    if (btnRebuild) btnRebuild.textContent = t('btnRebuild')
    if (btnMore) relabel(btnMore, t('more'))
    if (searchEl) searchEl.setAttribute('placeholder', t('searchPlaceholder'))
    composer.relabel()
  }
  function renderChips() {
    if (tagPick) tagPick.update({ value: nav.view === 'pinned' ? PICK_PINNED : nav.tags.length === 1 ? nav.tags[0] : '', options: pickOptions(), label: t('navTags') })
    if (!useChips) return
    chipsBox.textContent = ''
    const chip = (label, on, fn) => {
      const c = h('button', `mf-chip${on ? ' on' : ''}`, label)
      c.setAttribute('type', 'button')
      c.addEventListener('click', fn)
      chipsBox.appendChild(c)
    }
    chip(t('navAll'), nav.view === 'all' && !nav.tags.length, () => { setNav({ view: 'all', tags: [], day: '', search: nav.search }) })
    if (pinnedCount()) chip(t('navPinned'), nav.view === 'pinned', () => { setNav({ view: nav.view === 'pinned' ? 'all' : 'pinned' }) })
    chip(t('navArchived'), nav.view === 'archived', () => { setNav({ view: nav.view === 'archived' ? 'all' : 'archived' }) })
    walkTags(tagIndex(), (n) => chip(flatTitle(n.path), nav.tags.length === 1 && nav.tags[0].toLowerCase() === n.lower, () => { pickTag(n.path) }))
  }
  function renderFilterBar() {
    filterBar.textContent = ''
    const active = nav.tags.length || nav.day
    filterBar.classList.toggle('on', !!active)
    if (!active) return
    const add = (label, clear) => {
      const c = h('button', 'mf-chip', label)
      c.setAttribute('type', 'button')
      c.setAttribute('aria-label', t('filterRemove', { name: label }))
      const x = mkIcon('x', 12)
      if (x) c.appendChild(x)
      else c.appendChild(document.createTextNode(' ✕'))
      c.addEventListener('click', clear)
      filterBar.appendChild(c)
    }
    for (const tg of nav.tags) add(`#${tg}`, () => { setNav({ tags: nav.tags.filter((x) => x !== tg) }) }) // 标签名是用户数据,不翻
    if (nav.day) add(fmtDay(nav.day), () => { setNav({ day: '' }) })
    const shown = visibleItems().length
    const n = nav.tags.length === 1 && tagIndex().nodes.get(nav.tags[0].toLowerCase())
    const subs = n ? n.children.length : 0
    filterBar.appendChild(h('span', null, subs ? t('filterCountSub', { c: nMemos(shown), s: nSubTags(subs) }) : t('filterCount', { c: nMemos(shown) })))
    filterBar.appendChild(h('span', 'mf-flex1'))
    filterBar.appendChild(mkBtn(t('filterClear'), 'ghost sm', () => { clearFilters() }))
  }
  function visibleItems() {
    let items = flatAll().filter((it) => (nav.view === 'archived' ? it.m.archived : !it.m.archived))
    if (nav.view === 'pinned') items = items.filter((it) => it.m.pinned)
    if (nav.tags.length) items = items.filter((it) => memoHasTags(it.m, nav.tags))
    if (nav.day) items = items.filter((it) => dayKeyOfIso(it.m.ts) === nav.day)
    if (nav.search.trim()) { const q = nav.search.trim().toLowerCase(); items = items.filter((it) => it.m.text.toLowerCase().includes(q)) }
    return items.sort((a, b) => (a.m.ts < b.m.ts ? 1 : a.m.ts > b.m.ts ? -1 : 0))
  }
  function rowActions(m) {
    const ts = m.ts
    const list = [
      ['pencil', t('actEdit'), () => { endEdit(); editingTs = ts; renderList('none') }], // 换一条编辑 → 上一条的草稿作废
      ['pin', m.pinned ? t('actUnpin') : t('actPin'), () => { void patchMemo(ts, { pinned: !m.pinned }) }],
      [m.archived ? 'unarchive' : 'archive', m.archived ? t('actRestore') : t('actArchive'), () => { void patchMemo(ts, { archived: !m.archived }) }],
      ['file-text', t('actToNote'), () => { void toNote(ts) }],
      ['trash-2', t('actDelete'), () => { void deleteMemo(ts) }, true],
    ]
    const acts = h('span', 'mf-acts')
    if (phone && ctx.ui && ctx.ui.contextMenu) {
      acts.classList.add('phone')
      const more = iconBtn('more', t('more'), 'mf-abtn', () => {
        ctx.ui.contextMenu({ anchor: more, align: 'end' }, list.map(([icon, label, run, danger]) => ({ icon, label, run, danger: !!danger })))
      })
      acts.appendChild(more)
      return acts
    }
    for (const [icon, label, run, danger] of list) acts.appendChild(iconBtn(icon, label, `mf-abtn${danger ? ' danger' : ''}`, run))
    return acts
  }
  function memoRow(m, justNow) {
    const row = memoLine(m, (tag) => { addTag(tag) }, { justNow })
    row.appendChild(rowActions(m))
    if (editingTs === m.ts) {
      row.textContent = ''
      row.classList.add('editing')
      const ed = h('textarea', 'mf-ta mf-edit')
      ed.value = editDraft != null ? editDraft : m.text // 有草稿用草稿(空串也算草稿:用户可能刚全选删掉)
      ed.addEventListener('input', () => { editDraft = String(ed.value == null ? '' : ed.value) })
      const r2 = h('div', 'mf-row')
      r2.appendChild(h('span', 'mf-flex1'))
      r2.appendChild(mkBtn(t('btnCancel'), 'ghost sm', () => { endEdit(); renderList('none') }))
      r2.appendChild(mkBtn(t('btnSave'), 'primary sm', () => {
        const nv = String(ed.value == null ? '' : ed.value).replace(/\s+$/, '')
        const changed = nv.trim() && nv !== m.text
        const ts = m.ts
        endEdit()
        if (changed) { void patchMemo(ts, { text: nv }) } else renderList('none')
      }))
      row.appendChild(ed)
      row.appendChild(r2)
    }
    return row
  }
  function timeline() {
    const out = []
    let curDay = ''
    for (const it of visibleItems().reverse()) { // 旧到新:最新一条贴着输入卡
      const m = it.m
      const k = dayKeyOfIso(m.ts)
      if (k !== curDay) {
        curDay = k
        const label = dayLabel(k)
        out.push({ key: `head:${k}`, sig: label, build: () => h('div', 'mf-day', label) })
      }
      const fresh = justAdded === m.ts
      const sig = `${L()}|${m.text}|${m.pinned}|${m.archived}|${editingTs === m.ts}|${fresh}`
      out.push({ key: `memo:${m.ts}`, sig, build: () => memoRow(m, fresh) })
    }
    return out
  }
  function emptyState(title, line) {
    if (ctx.ui && ctx.ui.mountEmptyState) {
      emptyHost = ctx.ui.mountEmptyState(stateBox, { icon: 'zap', title, line })
      return
    }
    const e = h('div', 'mf-empty')
    e.appendChild(h('b', null, title))
    if (line) e.appendChild(h('div', null, line))
    stateBox.appendChild(e)
  }
  function renderList(mode) {
    if (emptyHost) { emptyHost.dispose(); emptyHost = null }
    stateBox.textContent = ''
    const clearAnd = (fn) => { rows.clear(); fn(); wrap.setAttribute('data-state', '1') }
    wrap.setAttribute('data-state', '0')
    if (db.loading) { clearAnd(() => stateBox.appendChild(h('div', 'mf-empty', t('loading')))); return }
    if (db.error) {
      clearAnd(() => {
        const e = h('div', 'mf-empty')
        e.appendChild(h('b', null, t('loadFail')))
        e.appendChild(h('div', 'mf-err', db.error))
        e.appendChild(mkBtn(t('btnRetry'), 'sm', () => { void loadStore() }))
        stateBox.appendChild(e)
      })
      return
    }
    if (!flatAll().length) { clearAnd(() => emptyState(t('emptyTitle'), t('emptyHint'))); return }
    const entries = timeline()
    if (!entries.length) { clearAnd(() => stateBox.appendChild(h('div', 'mf-empty', t('noMatch')))); return }
    rows.sync(entries, mode || 'none')
  }
  function renderAll(mode) {
    if (nav.view === 'pinned' && !pinnedCount()) nav.view = 'all' // 最后一条取消置顶:左栏那行没了,别留在空视图
    renderChrome(); renderStats(); renderChips(); review.render(); renderFilterBar(); renderList(mode)
    const items = visibleItems()
    newestTs = items.length ? items[0].m.ts : ''
    unread = items.filter((it) => it.m.ts > seenTs).length
    syncJump()
  }
  // 语言切换:宿主只广播变化,初值自己 getLocale()。**不重挂视图**——就地重画,
  // 输入框里没发出去的草稿、编辑框里没保存的字、正在录的音、跑着的周整理都不能被语言切换打断。
  const offLocale = ctx.subscribeLocale?.(() => { renderAll('none'); drawDigestBox(digestBox) })
  renderChrome()
  drawDigestBox(digestBox)

  // Mini 的「在主面板显示」带着标签筛选过来
  const applyParams = () => {
    const tg = view && view.getParams ? (view.getParams() || {}).tag : ''
    if (typeof tg === 'string' && tg && !(nav.tags.length === 1 && nav.tags[0] === tg)) pickTag(tg)
  }
  const offParams = view && view.onParamsChanged ? view.onParamsChanged(applyParams) : null

  // ── 总线 + 启动 ──
  let justAdded = ''
  const offBus = bus.on((e) => {
    if (!e) return
    if (e.type === 'digest') { drawDigestBox(digestBox); return }
    if (e.type !== 'added') justAdded = ''
    if (e.type === 'store' || e.type === 'changed') { renderAll('none'); return }
    if (e.type === 'nav') {
      // 筛选清掉了:主面板定位目标也清掉,免得重开视图又被 Mini 带来的旧标签筛上
      const carried = view && view.getParams ? (view.getParams() || {}).tag : ''
      if (carried && !nav.tags.includes(carried) && view.setParams) view.setParams({ tag: '' })
      scroll.scrollTop = 0 // 换了筛选就是另一张列表,从最新看起
      renderAll(e.mode)
      return
    }
    if (e.type === 'added') {
      justAdded = e.ts
      renderAll('add')
      if (sentNow && !visibleItems().some((it) => it.m.ts === e.ts)) say(t('savedOutOfFilter'))
    }
  })
  startSync()
  applyParams()
  renderAll('none')
  ensureStore(true)
  let alive = true
  // 进 Space 时焦点常留在刚点的 Ribbon 按钮上,只有别的输入框占着焦点才不抢
  const typing = (e) => !!e && (/^(INPUT|TEXTAREA)$/.test(e.tagName || '') || !!e.isContentEditable)
  const focusBox = () => { if (alive && !typing(document.activeElement)) composer.focus() }
  // ChatBox 是 React 异步挂的,第一下可能还没有 textarea,稍后补一次
  if (!phone) { setTimeout(focusBox, 0); setTimeout(focusBox, 250) }

  return () => {
    alive = false
    mainMounts -= 1
    offBus(); stopSync()
    if (dockRo) dockRo.disconnect()
    if (offLocale) offLocale()
    if (offParams) offParams()
    if (emptyHost) emptyHost.dispose()
    if (tagPick) tagPick.dispose()
    if (head) head.dispose()
    composer.dispose()
  }
}

// ══ 活动栏(右栏):近 12 周、统计、周整理入口 ════════════════════════════════
function mountActivity(el) {
  el.textContent = ''
  installStyle(el)
  const rootEl = h('div', 'mf-side'); el.appendChild(rootEl)
  const heatCap = h('div', 'mf-cap', ''); rootEl.appendChild(heatCap)
  const heatBox = h('div'); rootEl.appendChild(heatBox)
  const statBox = h('div', 'mf-stat'); rootEl.appendChild(statBox)
  const digestBox = h('div'); rootEl.appendChild(digestBox)
  const weekCard = h('div', 'mf-weekcard'); rootEl.appendChild(weekCard)
  function daysMap() {
    const d = {}
    for (const it of flatAll()) { const k = dayKeyOfIso(it.m.ts); if (k) d[k] = (d[k] || 0) + 1 }
    return d
  }
  function renderHeat(days) {
    heatBox.textContent = ''
    const grid = h('div', 'mf-heat')
    const tSer = daySerial(todayKey())
    const start = tSer - ((tSer + 3) % 7) - 77 // 12 周网格,列=周(周一开头)
    for (let i = 0; i < 84; i++) {
      const serial = start + Math.floor(i / 7) * 7 + (i % 7)
      const key = serialToKey(serial)
      const n = days[key] || 0
      const lv = n <= 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 6 ? 3 : 4
      const cell = h('span', `mf-cell lv${lv}${nav.day === key ? ' sel' : ''}`)
      cell.setAttribute('title', t('heatCell', { day: key, c: nMemos(n) })) // day 用 ISO 原键:两语言通读,且是数据键
      if (serial > tSer) cell.className = 'mf-cell future'
      else cell.addEventListener('click', () => { setNav({ view: 'all', day: nav.day === key ? '' : key }) })
      grid.appendChild(cell)
    }
    heatBox.appendChild(grid)
  }
  function renderAll() {
    const days = daysMap()
    const all = flatAll()
    heatCap.textContent = t('heatTitle')
    renderHeat(days)
    statBox.textContent = ''
    const stat = (n, label) => { const s = h('span'); s.appendChild(h('b', null, String(n))); s.appendChild(document.createTextNode(label)); statBox.appendChild(s) }
    stat(all.length, t('statMemos')); stat(streakOf(days, todayKey()), t('statStreak')); stat(tagIndex().roots.length, t('statGroups'))
    const week = isoWeekOf(todayKey())
    const inWeek = all.filter((it) => isoWeekOf(dayKeyOfIso(it.m.ts)) === week).length
    weekCard.textContent = ''
    weekCard.appendChild(h('small', null, t('weekCount', { c: nMemos(inWeek) })))
    weekCard.appendChild(h('div', null, t('weekLine')))
    const go = h('div', 'mf-weekgo')
    go.appendChild(mkBtn(t('btnStartDigest'), 'sm', () => { void runDigest() }))
    weekCard.appendChild(go)
    drawDigestBox(digestBox)
  }
  const offBus = bus.on((e) => {
    if (!e) return
    if (e.type === 'digest') { drawDigestBox(digestBox); return }
    renderAll()
  })
  const offLocale = ctx.subscribeLocale?.(() => { renderAll() })
  startSync()
  renderAll()
  ensureStore(true)
  return () => { offBus(); stopSync(); if (offLocale) offLocale() }
}

// ══ Mini:记 + 今天(M2) ══════════════════════════════════════════════════════
// 断点跟容器走,不写死 320×420:高度 < 240 只留输入框,宽度 ≥ 480 显示全部标签和日期分组。
const MINI_TINY_H = 240, MINI_WIDE_W = 480
function mountQuick(el, view) {
  el.textContent = ''
  installStyle(el)
  const rootEl = h('div', 'mf-q'); el.appendChild(rootEl)
  const chipsBox = h('div', 'mf-qchips'); rootEl.appendChild(chipsBox)
  const rest = h('div', 'mf-q-rest'); rootEl.appendChild(rest)
  const listBox = h('div', 'mf-list'); rest.appendChild(listBox)
  const rows = keyedRows(listBox)
  const dock = h('div', 'mf-qdock'); rootEl.appendChild(dock)
  const reviewBox = h('div', 'mf-review'); dock.appendChild(reviewBox)
  const review = reviewDeck(reviewBox, { blocked: () => !!sel, after: () => { render('none') } })
  const composer = mountComposer(dock, {
    compact: true,
    extra: review.pill,
    ghostHost: rootEl,
    send: async (text) => { await scrollToLatest(rest); await addMemo(text) },
  })
  rest.addEventListener('click', () => { review.close() })
  rootEl.addEventListener('keydown', (e) => { if (e.key === 'Escape') review.close() })
  const initial = view && view.getParams ? (view.getParams() || {}).tag : ''
  let sel = typeof initial === 'string' ? initial : ''
  let wide = false
  let justAdded = ''
  const pick = (tag) => {
    sel = sel && tag && sel.toLowerCase() === tag.toLowerCase() ? '' : tag
    if (view && view.setParams) view.setParams({ tag: sel })
    render('none')
  }
  function entries() {
    const today = todayKey()
    let items = flatAll().filter((it) => !it.m.archived)
    if (sel) items = items.filter((it) => memoHasTags(it.m, [sel]))
    else if (!wide) items = items.filter((it) => dayKeyOfIso(it.m.ts) === today)
    items.sort((a, b) => (a.m.ts < b.m.ts ? 1 : -1))
    items = items.slice(0, 100).reverse() // 取最新 100 条,旧到新排:最新一条贴着输入卡
    const out = []
    let cur = ''
    for (const it of items) {
      const k = dayKeyOfIso(it.m.ts)
      if ((wide || sel) && k !== cur) {
        cur = k
        const label = dayLabel(k)
        out.push({ key: `head:${k}`, sig: label, build: () => h('div', 'mf-day', label) })
      }
      const m = it.m
      const fresh = justAdded === m.ts
      out.push({ key: `memo:${m.ts}`, sig: `${L()}|${m.text}|${fresh}`, build: () => memoLine(m, (tag) => { pick(tag) }, { justNow: fresh }) })
    }
    return out
  }
  function renderChips() {
    chipsBox.textContent = ''
    const chip = (label, on, fn) => {
      const c = h('button', `mf-chip${on ? ' on' : ''}`, label)
      c.setAttribute('type', 'button')
      c.addEventListener('click', fn)
      chipsBox.appendChild(c)
    }
    chip(t(wide ? 'miniAll' : 'miniToday'), !sel, () => { pick('') })
    const idx = tagIndex()
    const list = wide ? idx.roots : idx.roots.slice(0, 4)
    for (const n of list) chip(n.path, !!sel && sel.toLowerCase() === n.lower, () => { pick(n.path) })
  }
  function render(mode) {
    renderChips()
    review.render()
    if (db.loading) return
    const list = entries()
    if (!list.length) { rows.clear(); return }
    rows.sync(list, mode)
  }
  const measure = (w, ht) => {
    rootEl.setAttribute('data-tiny', ht > 0 && ht < MINI_TINY_H ? '1' : '0')
    const nextWide = w >= MINI_WIDE_W
    rootEl.setAttribute('data-wide', nextWide ? '1' : '0')
    if (nextWide !== wide) { wide = nextWide; render('none') }
  }
  const ro = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver((recs) => { const r = recs[recs.length - 1]; if (r && r.contentRect) measure(r.contentRect.width, r.contentRect.height) })
    : null
  if (ro) ro.observe(el) // 量挂载点:rootEl 有内边距,contentRect 会少算
  const offBus = bus.on((e) => {
    if (!e || e.type === 'digest' || e.type === 'nav') return
    if (e.type === 'added') { justAdded = e.ts; render('add'); return }
    justAdded = ''
    render('none')
  })
  const offLocale = ctx.subscribeLocale?.(() => { composer.relabel(); render('none') })
  composer.relabel()
  startSync()
  render('none')
  ensureStore(true)
  return () => { offBus(); stopSync(); if (ro) ro.disconnect(); if (offLocale) offLocale(); composer.dispose() }
}

// ── 注册(id 全按 SPEC 钉死;07-18 后 API 一律可选链) ─────────────────────────
// 贡献点的标题是**单字符串**、宿主不做运行时重解析:这里取的是**注册当时**的语言,
// 语言切换后命令面板 / 设置页 / 视图 tab 标题要等重启才跟上(宿主侧已知缺口,见 README)。
// 绝不为它做「语言变了就 teardown 重注册」——那会打断录音、写队列与已打开的视图。
// keywords 反而恒双语:搜索面不该因为界面语言而搜不到。
styleHandle = ctx.addStyle ? ctx.addStyle(STYLE) : null
ctx.registerView?.({ id: 'memos', title: pText('appName'), mount: mountMemos, singleton: true })
ctx.registerView?.({ id: 'activity', title: pText('viewActivity'), icon: 'activity', mount: mountActivity, singleton: true })
ctx.registerView?.({ id: 'quick', title: pText('appName'), mount: mountQuick })
ctx.registerListSource?.({
  id: 'memos',
  title: pText('appName'),
  search: true,
  empty: { icon: 'zap', title: pText('emptyTitle'), line: pText('emptyHint') },
  items: listRows,
  subscribe(cb) { listSubs.add(cb); startSync(); ensureStore(); return () => { listSubs.delete(cb); stopSync() } },
  activeKey: listActiveKey,
  open: openRow,
  itemMenu: rowMenu,
})
ctx.registerCommand({
  id: 'memoflow-open', title: t('cmdOpen'), keywords: 'memoflow 闪念 速记 memo flomo 笔记 灵感 capture note idea',
  run: () => { if (ctx.openView) ctx.openView('memos'); else say(t('hostTooOld'), { level: 'warning' }) },
})
ctx.registerCommand({
  id: 'memoflow-capture', title: t('cmdCapture'), keywords: 'memoflow capture 闪念 快速 速记 记录 quick memo jot',
  run: () => { void quickCapture() },
})
ctx.registerCommand({
  id: 'memoflow-digest', title: t('cmdDigest'), keywords: 'memoflow digest 周整理 整理 weekly 回顾 summary review',
  run: () => { if (ctx.openView) ctx.openView('memos'); void runDigest() },
})
const sbHandle = ctx.registerStatusItem?.({ id: 'quick', side: 'right', text: t('statusText'), title: t('statusTitle'), onClick: () => { void quickCapture() } })
// 状态栏项是少数**能**运行时改文案的宿主面(handle.update):它跟着语言走,不必等重启。
const offLocaleSb = ctx.subscribeLocale?.(() => {
  notifyList() // 列表行的文案是 items() 算出来的,语言变了要重取
  try { sbHandle?.update?.({ text: t('statusText'), title: t('statusTitle') }) } catch { /* 旧宿主 handle 无 update */ }
})

// ── check.mjs 测试钩子 ──────────────────────────────────────────────────────
if (globalThis.__MEMOFLOW_TEST__) {
  Object.assign(globalThis.__MEMOFLOW_TEST__, {
    parseMonth, serializeMonth, splitTailMarkers, applyCacheDelta, extractTags, mulberry32, seedOfDay, pickReview, reviewEligible,
    monthSeq, isoWeekOf, dayKeyOf, dayKeyOfIso, monthKeyOf, daySerial, serialToKey, shiftDays,
    cacheFromMemos, bumpCacheObj, streakOf, buildDigestMessage, parseDigest, digestCorpus,
    safeHref, sanitizeFileName, renderMemoText, voiceAvailable, addMemo, quickCapture, memoToNote,
    loadAll, loadStore, rebuildCacheFromStore, upgradeCacheTags, wfRoot, timeOfIso, normTag, tagMatches,
    MSG, L, t, fmtDay, shortDay, weekDay, nMemos, nMonthFiles, nSubTags, joinList,
    buildTagIndex, suggestTags, listRows, listActiveKey, openRow, rowMenu, renameTagInText, renameTagInMonth, renameTagFlow, nav, setNav, keyedRows,
  })
}

return () => {
  if (offLocaleSb) offLocaleSb()
  if (sbHandle && sbHandle.dispose) sbHandle.dispose()
  if (styleHandle && styleHandle.dispose) styleHandle.dispose()
  if (digest.controller) digest.controller.abort()
  stopRecHard()
}
