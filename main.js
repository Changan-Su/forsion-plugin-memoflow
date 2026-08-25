/**
 * 闪念盒 memoflow —— Forsion 桌面插件(裸 setup(ctx) 体,宿主 new Function('ctx', code) 装载)。
 *
 * flomo 式低摩擦速记:文字 + 语音进「月文件」(<工作文件夹>/YYYY-MM.md,### ISO 时间戳分节),
 * 时间线 / 标签 / 热力图 / 每日回顾再浮现 / Tangu AI 周整理。派生缓存 .memoflow-cache.json
 * 任何时候可仅凭月文件全量重建(视图里有「重建缓存」按钮)。
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
    btnShowArch: '显示归档',
    stats: '共 {c} · 连续 {d} 天',
    inputPlaceholder: '现在在想什么?Enter 发送,Shift+Enter 换行,# 打标签',
    btnSend: '记下',
    btnVoice: '🎙 语音',
    btnVoiceStop: '● 结束录音',
    btnVoiceBusy: '⋯ 转写中',
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
    emptyHint: '上面输入框随手记一条;Enter 发送。也可以用状态栏「✎ 闪念」或命令面板「闪念盒:快速记一条」。',
    noMatch: '没有匹配的闪念',
    pinnedGroup: '📌 置顶 · {n} 条',
    dayToday: '今天',
    dayYesterday: '昨天',
    flagPinned: '置顶',
    flagArchived: '已归档',
    actEdit: '编辑',
    actPin: '置顶',
    actUnpin: '取消置顶',
    actArchive: '归档',
    actRestore: '恢复',
    actToNote: '转笔记',
    actDelete: '删除',
    actSkip: '跳过',
    reviewLabel: '每日回顾',
    reviewHint: '过去的想法再看一眼 · 还剩 {left}/{total}',
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
    btnShowArch: 'Show Archived',
    stats: '{c} · {d}-day streak',
    inputPlaceholder: "What's on your mind? Enter to send, Shift+Enter for a new line, # to tag",
    btnSend: 'Capture',
    btnVoice: '🎙 Voice',
    btnVoiceStop: '● Stop',
    btnVoiceBusy: '⋯ Transcribing',
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
    emptyHint: 'Jot one down in the box above and press Enter. You can also use the "✎ Memo" status bar button or the "MemoFlow: Quick Capture" command.',
    noMatch: 'No memos match',
    pinnedGroup: '📌 Pinned · {n}',
    dayToday: 'Today',
    dayYesterday: 'Yesterday',
    flagPinned: 'Pinned',
    flagArchived: 'Archived',
    actEdit: 'Edit',
    actPin: 'Pin',
    actUnpin: 'Unpin',
    actArchive: 'Archive',
    actRestore: 'Restore',
    actToNote: 'To Note',
    actDelete: 'Delete',
    actSkip: 'Skip',
    reviewLabel: 'Daily Review',
    reviewHint: 'Another look at older thoughts · {left}/{total} left',
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
const nMonthFiles = (n) => (L() === 'en' ? `${n} month file${n === 1 ? '' : 's'}` : `${n} 个月文件`)
/** 列表分隔符按语言取:中文顿号绝不能拼进英文句子(月份清单等)。 */
const joinList = (arr) => (arr || []).join(t('listSep'))
/** 给人看的日期(数据里的 key 永远是 YYYY-MM-DD;只有展示这一处本地化)。 */
function fmtDay(key) {
  const p = String(key || '').split('-').map(Number)
  if (!p[0] || !p[1] || !p[2]) return String(key || '')
  try { return new Date(p[0], p[1] - 1, p[2], 12).toLocaleDateString(L() === 'zh' ? 'zh-CN' : 'en-US') } catch { return String(key || '') }
}

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

// ── 标签(#非空白串;# 后接标点/纯数字不算;行内多个都算) ────────────────────
function extractTags(text) {
  const out = []
  const re = /#([^\s#]+)/g
  const s = String(text == null ? '' : text)
  let m
  while ((m = re.exec(s))) {
    const t = m[1]
    if (/^\d+$/.test(t)) continue
    if (/^[\p{P}\p{S}]/u.test(t)) continue
    if (!out.includes(t)) out.push(t)
  }
  return out
}

// ── 派生缓存(纯派生,任何时候可全量重建;增量 == 全量,check 有等式断言) ────
function bumpCacheObj(c, memo) {
  const day = dayKeyOfIso(memo.ts)
  if (day) c.days[day] = (c.days[day] || 0) + 1
  for (const t of extractTags(memo.text)) c.tags[t] = (c.tags[t] || 0) + 1
  c.total = (c.total || 0) + 1
  return c
}
function cacheFromMemos(memos) {
  const c = { days: {}, tags: {}, total: 0, builtAt: 0 }
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
/** 读月文件:宿主抛错原样上抛(err.ioFail = true),缺席/空文件给 null。写路径一律用它。 */
async function readMonthRaw(ym) {
  // 局部变量刻意不叫 t:词表 helper 就叫 t(),重名会在 catch 里把它遮成 undefined
  let raw
  try { raw = await ctx.app.readFile(monthPath(ym)) }
  catch (e) {
    const err = new Error(t('readMonthFail', { ym, msg: (e && e.message) || e }))
    err.ioFail = true
    throw err
  }
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

// ── 近用标签(输入区快捷 chips) ─────────────────────────────────────────────
function recentTags() {
  try {
    const a = JSON.parse(getLS('recentTags', '[]'))
    return Array.isArray(a) ? a.filter((x) => typeof x === 'string') : []
  } catch { return [] }
}
function rememberTags(tags) {
  if (!tags || !tags.length) return
  const next = tags.concat(recentTags().filter((t) => !tags.includes(t))).slice(0, 24)
  setLS('recentTags', JSON.stringify(next))
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
function enqueueWrite(job) {
  const p = writeChain.then(job)
  writeChain = p.then(() => {}, () => {})
  return p
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
  rememberTags(extractTags(text))
  trackAchievements(c)
  ctx.activity?.log('capture', { text: text.slice(0, 60) })
  bus.emit({ type: 'added', ym })
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
function renderMemoText(container, text, onTag) {
  container.textContent = ''
  const lines = String(text == null ? '' : text).split('\n')
  for (const line of lines) {
    if (MARKER_LINE.test(line)) continue // Amadeus 块标记行是宿主结构数据,不当正文展示(文件里原样保留)
    const div = document.createElement('div')
    div.className = 'mf-line'
    let rest = line
    const re = /#([^\s#]+)|(https?:\/\/[^\s]+)/
    let m
    while ((m = re.exec(rest))) {
      if (m.index > 0) div.appendChild(document.createTextNode(rest.slice(0, m.index)))
      if (m[1] != null && !/^\d+$/.test(m[1]) && !/^[\p{P}\p{S}]/u.test(m[1])) {
        const tg = document.createElement('span')
        tg.className = 'mf-tag'
        tg.textContent = `#${m[1]}`
        if (onTag) { const name = m[1]; tg.addEventListener('click', () => onTag(name)) }
        div.appendChild(tg)
      } else if (m[2] != null) {
        const a = document.createElement('a')
        a.textContent = m[2]
        const href = safeHref(m[2])
        if (href) { a.setAttribute('href', href); a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer') }
        div.appendChild(a)
      } else {
        div.appendChild(document.createTextNode(m[0]))
      }
      rest = rest.slice(m.index + m[0].length)
    }
    if (rest) div.appendChild(document.createTextNode(rest))
    container.appendChild(div)
  }
}

// ── 主题:吃宿主 token 派生 --mf-*(bluebird 手法,含热力图色阶) ──────────────
let _probe = null
function parseColor(css) {
  try {
    const s = (css || '').trim()
    if (!s || !globalThis.document) return null
    if (!_probe) {
      const c = document.createElement('canvas')
      if (typeof c.getContext !== 'function') return null
      c.width = c.height = 1
      _probe = c.getContext('2d', { willReadFrequently: true })
    }
    if (!_probe) return null
    _probe.fillStyle = '#000000'; _probe.fillStyle = s; const a = _probe.fillStyle
    _probe.fillStyle = '#ffffff'; _probe.fillStyle = s
    if (a === '#000000' && _probe.fillStyle === '#ffffff') return null
    _probe.clearRect(0, 0, 1, 1); _probe.fillRect(0, 0, 1, 1)
    const d = _probe.getImageData(0, 0, 1, 1).data
    return [d[0], d[1], d[2], d[3] / 255]
  } catch { return null }
}
const relL = (c) => { const g = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) }; return 0.2126 * g(c[0]) + 0.7152 * g(c[1]) + 0.0722 * g(c[2]) }
const contrast = (a, b) => { const x = relL(a), y = relL(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
const onColorOf = (accent) => (contrast(accent, [255, 255, 255]) >= contrast(accent, [22, 22, 26]) ? '#ffffff' : '#16161a')
function readableOn(fg, bg, text, min = 3) {
  let c = [fg[0], fg[1], fg[2]]
  for (let i = 0; i < 12 && contrast(c, bg) < min; i++) c = c.map((v, k) => v + (text[k] - v) * 0.18)
  return `rgb(${c.map((v) => Math.round(v)).join(',')})`
}
function syncTheme(rootEl) {
  if (typeof getComputedStyle === 'undefined') return
  let cs
  try { cs = getComputedStyle(rootEl) } catch { return }
  const tok = (n) => ((cs.getPropertyValue && cs.getPropertyValue(n)) || '').trim()
  const rgb = parseColor(tok('--text')) || parseColor(cs.color) || [40, 40, 40, 1]
  const dark = relL(rgb) > 0.5
  const bgc = parseColor(tok('--bg')) || (dark ? [23, 24, 28, 1] : [255, 255, 255, 1])
  const rd = Math.round
  const f = (a) => `rgba(${rd(rgb[0])},${rd(rgb[1])},${rd(rgb[2])},${a})`
  const accent = tok('--accent') || tok('--am-accent') || (dark ? '#cfc9ff' : '#4C2585')
  const arc = parseColor(accent) || [76, 37, 133, 1]
  const af = (a) => `rgba(${rd(arc[0])},${rd(arc[1])},${rd(arc[2])},${a})`
  const set = (k, v) => rootEl.style.setProperty(`--mf-${k}`, v)
  rootEl.style.colorScheme = dark ? 'dark' : 'light'
  set('text', tok('--text') || `rgb(${rd(rgb[0])},${rd(rgb[1])},${rd(rgb[2])})`)
  set('text-sec', tok('--text-light') || f(0.72)); set('text-muted', tok('--text-muted') || f(0.5)); set('text-subtle', tok('--text-faint') || f(0.32))
  set('bg', tok('--bg') || `rgb(${rd(bgc[0])},${rd(bgc[1])},${rd(bgc[2])})`)
  set('surf', tok('--bg-card') || f(0.045)); set('surf-sub', tok('--overlay-subtle') || f(0.025))
  set('input', tok('--overlay-light') || f(0.05)); set('hover', tok('--overlay-medium') || f(0.08))
  set('border', tok('--border') || f(0.16)); set('border-sub', tok('--overlay-medium') || f(0.09))
  set('fill', accent); set('on-fill', tok('--on-accent') || onColorOf(arc))
  set('primary', readableOn(arc, bgc, rgb)); set('tint', tok('--accent-light') || af(0.13)); set('glow', af(0.22))
  set('danger', tok('--danger') || (dark ? '#e08a7d' : '#b03a2e'))
  set('shadow', tok('--card-shadow') || (dark ? '0 4px 20px rgba(0,0,0,.4)' : '0 2px 12px rgba(0,0,0,.08)'))
  set('heat0', f(0.07)); set('heat1', af(0.25)); set('heat2', af(0.45)); set('heat3', af(0.68)); set('heat4', af(0.9))
}
function themeObserver(rootEl) {
  syncTheme(rootEl)
  let disc = () => {}
  if (typeof MutationObserver !== 'undefined') {
    const ob = new MutationObserver(() => syncTheme(rootEl))
    for (let n = rootEl.parentElement; n; n = n.parentElement) ob.observe(n, { attributes: true, attributeFilter: ['class', 'data-mode', 'data-theme', 'style'] })
    disc = () => ob.disconnect()
  }
  const mq = globalThis.window && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null
  const onMq = () => syncTheme(rootEl)
  if (mq && mq.addEventListener) mq.addEventListener('change', onMq)
  return () => { disc(); if (mq && mq.removeEventListener) mq.removeEventListener('change', onMq) }
}

const STYLE = `
.mf-root{height:100%;min-height:0;overflow:auto;color:inherit;background:var(--mf-bg);font-size:13px;line-height:1.55}
.mf-root *{box-sizing:border-box}
.mf-root ::-webkit-scrollbar{width:6px;height:6px}.mf-root ::-webkit-scrollbar-thumb{background:var(--mf-border);border-radius:3px}
.mf-wrap{max-width:760px;margin:0 auto;padding:18px 20px 48px;display:flex;flex-direction:column;gap:12px}
.mf-head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.mf-title{font-size:20px;font-weight:700}
.mf-stats{font-size:11.5px;color:var(--mf-text-muted)}
.mf-flex1{flex:1}
.mf-btn{padding:6px 12px;font:inherit;font-size:12px;color:var(--mf-text-sec);border:1px solid var(--mf-border);border-radius:10px;background:var(--mf-surf);cursor:pointer;transition:background .2s,border-color .2s,color .2s;white-space:nowrap}
.mf-btn:hover:not(:disabled){background:var(--mf-tint);border-color:var(--mf-primary);color:var(--mf-primary)}
.mf-btn:disabled{opacity:.5;cursor:default}
.mf-btn.primary{color:var(--mf-on-fill);background:var(--mf-fill);border-color:transparent;font-weight:500}
.mf-btn.primary:hover:not(:disabled){color:var(--mf-on-fill);background:var(--mf-fill);filter:brightness(1.06)}
.mf-btn.on{background:var(--mf-tint);border-color:var(--mf-primary);color:var(--mf-primary)}
.mf-btn.sm{padding:4px 9px;font-size:11.5px;border-radius:8px}
.mf-card{border-radius:14px;background:var(--mf-surf);border:1px solid var(--mf-border);box-shadow:var(--mf-shadow);padding:12px}
.mf-ta{width:100%;min-height:66px;max-height:220px;resize:none;padding:9px 12px;font:inherit;color:var(--mf-text);background:var(--mf-input);border:1.5px solid var(--mf-border);border-radius:11px;outline:none;transition:border-color .2s,box-shadow .2s}
.mf-ta::placeholder{color:var(--mf-text-subtle)}
.mf-ta:focus{border-color:var(--mf-primary);box-shadow:0 0 0 3px var(--mf-glow)}
.mf-input{padding:6px 10px;font:inherit;font-size:12px;color:var(--mf-text);background:var(--mf-input);border:1.5px solid var(--mf-border);border-radius:10px;outline:none;flex:1;min-width:120px}
.mf-input:focus{border-color:var(--mf-primary)}
.mf-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.mf-chip{padding:2px 9px;border-radius:999px;background:var(--mf-tint);color:var(--mf-primary);font-size:11.5px;cursor:pointer;border:none;font-family:inherit}
.mf-chip:hover{filter:brightness(1.08)}
.mf-chip.x{background:var(--mf-surf);border:1px solid var(--mf-border);color:var(--mf-text-sec)}
.mf-hint{font-size:11px;color:var(--mf-text-subtle)}
.mf-vmsg{font-size:11px;color:var(--mf-danger);min-height:14px}
.mf-voice.rec{color:var(--mf-danger);border-color:var(--mf-danger);animation:mfpulse 1.2s ease-in-out infinite}
@keyframes mfpulse{50%{opacity:.5}}
.mf-label{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--mf-text-muted)}
.mf-rcards{display:flex;gap:10px;overflow-x:auto;padding:6px 0 2px}
.mf-rcard{flex:0 0 230px;border:1px solid var(--mf-border-sub);border-radius:12px;padding:10px;background:var(--mf-surf-sub);display:flex;flex-direction:column;gap:6px}
.mf-rdate{font-size:10.5px;color:var(--mf-text-subtle)}
.mf-rtext{font-size:12px;flex:1;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
.mf-heat{display:grid;grid-template-rows:repeat(7,11px);grid-auto-flow:column;grid-auto-columns:11px;gap:3px;padding:4px 0}
.mf-cell{width:11px;height:11px;border-radius:3px;background:var(--mf-heat0);cursor:pointer}
.mf-cell.lv1{background:var(--mf-heat1)}.mf-cell.lv2{background:var(--mf-heat2)}.mf-cell.lv3{background:var(--mf-heat3)}.mf-cell.lv4{background:var(--mf-heat4)}
.mf-cell.sel{outline:2px solid var(--mf-primary)}
.mf-cell.future{visibility:hidden}
.mf-day{font-size:11px;font-weight:700;letter-spacing:.05em;color:var(--mf-text-muted);margin:16px 2px 2px}
.mf-memo{border:1px solid var(--mf-border-sub);border-radius:12px;padding:9px 12px;background:var(--mf-surf);margin-top:8px;transition:border-color .15s}
.mf-memo:hover{border-color:var(--mf-primary)}
.mf-memo.arch{opacity:.55}
.mf-mtop{display:flex;gap:8px;align-items:center;font-size:11px;color:var(--mf-text-muted)}
.mf-flag{font-size:10px;padding:0 7px;border-radius:999px;background:var(--mf-tint);color:var(--mf-primary)}
.mf-acts{margin-left:auto;display:flex;gap:2px;opacity:0;transition:opacity .15s}
.mf-memo:hover .mf-acts{opacity:1}
.mf-abtn{border:none;background:transparent;color:var(--mf-text-muted);cursor:pointer;font-size:11px;padding:2px 7px;border-radius:6px;font-family:inherit;white-space:nowrap}
.mf-abtn:hover{background:var(--mf-hover);color:var(--mf-text)}
.mf-abtn.danger:hover{color:var(--mf-danger)}
.mf-mbody{margin-top:4px;word-break:break-word}
.mf-line{min-height:1.2em}
.mf-tag{display:inline-block;background:var(--mf-tint);color:var(--mf-primary);border-radius:6px;padding:0 5px;cursor:pointer;font-size:.94em}
.mf-tag:hover{filter:brightness(1.1)}
.mf-mbody a{color:var(--mf-primary);word-break:break-all}
.mf-empty{padding:44px 12px;text-align:center;color:var(--mf-text-subtle);font-size:12.5px}
.mf-empty b{display:block;font-size:15px;color:var(--mf-text-muted);margin-bottom:8px}
.mf-prog-head{display:flex;justify-content:space-between;gap:8px;font-size:11.5px;color:var(--mf-text-muted);margin-bottom:5px}
.mf-prog-track{height:4px;border-radius:999px;background:var(--mf-border-sub);overflow:hidden}
.mf-prog-fill{height:100%;width:0;border-radius:999px;background:var(--mf-primary);transition:width .5s ease-out}
.mf-err{color:var(--mf-danger);font-size:12px}
`

// ── UI 构件小工具(纯 createElement 直引用,check 的 DOM 垫片可直测) ─────────
function h(tag, cls, text) {
  const el = document.createElement(tag)
  if (cls) el.className = cls
  if (text != null) el.textContent = text
  return el
}
function mkBtn(label, cls, onClick) {
  const b = h('button', `mf-btn${cls ? ' ' + cls : ''}`, label)
  if (onClick) b.addEventListener('click', onClick)
  return b
}

// 每日回顾进度(模块级:同日内跨视图开关不丢「已处理」;picks = 当天首算后冻结的 ts 列表,
// 处理动作缩小池子也绝不重抽 —— 「同一天里抽到的卡固定」是 SPEC 契约)。
const reviewState = { day: '', done: new Set(), picks: null }

// ══ 闪念盒视图 ═══════════════════════════════════════════════════════════════
function mountMemos(el) {
  el.textContent = ''
  const styleEl = h('style'); styleEl.textContent = STYLE; el.appendChild(styleEl)
  const rootEl = h('div', 'mf-root'); el.appendChild(rootEl)
  const wrap = h('div', 'mf-wrap'); rootEl.appendChild(wrap)
  const offTheme = themeObserver(rootEl)

  let store = new Map()
  let loading = true
  let loadError = ''
  let filterTag = '', filterDay = '', searchQ = '', showArch = false
  let editingTs = ''
  // 编辑框里**还没保存**的草稿。整树重画(切语言 / 总线 added / 过滤)会把编辑框整个换成新元素,
  // 若那时回读磁盘原文 `m.text`,用户正在补的一大段当场消失 —— 闪念没有回收站,重画不许吃字。
  // 与 editingTs 同生命周期:进编辑/取消/保存都走 endEdit() 一处清零(null = 尚未改动 → 用 m.text)。
  let editDraft = null
  const endEdit = () => { editingTs = ''; editDraft = null }

  // ── 骨架 ──
  const head = h('div', 'mf-head')
  const stats = h('span', 'mf-stats', '')
  const btnDigest = mkBtn('', 'sm', () => { void runDigest() })
  const btnRebuild = mkBtn('', 'sm', () => { void doRebuild() })
  const btnArch = mkBtn('', 'sm', () => { showArch = !showArch; btnArch.className = `mf-btn sm${showArch ? ' on' : ''}`; renderList() })
  const titleEl = h('span', 'mf-title', '')
  head.appendChild(titleEl)
  head.appendChild(stats)
  head.appendChild(h('span', 'mf-flex1'))
  head.appendChild(btnDigest); head.appendChild(btnRebuild); head.appendChild(btnArch)
  wrap.appendChild(head)

  const digestBox = h('div'); wrap.appendChild(digestBox)

  // ── 输入区 ──
  const inputCard = h('div', 'mf-card')
  const ta = h('textarea', 'mf-ta')
  ta.setAttribute('rows', '2')
  const autoGrow = () => { if (typeof ta.scrollHeight === 'number' && ta.style) { ta.style.height = 'auto'; ta.style.height = Math.min(220, ta.scrollHeight) + 'px' } }
  ta.addEventListener('input', autoGrow)
  // 输入法合成态的 Enter(选候选词上屏)不算发送:isComposing / keyCode 229 双闸
  ta.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.shiftKey) return
    if (e.isComposing || e.keyCode === 229) return
    if (e.preventDefault) e.preventDefault()
    void doSend()
  })
  const toolRow = h('div', 'mf-row')
  const chipsBox = h('div', 'mf-row')
  const vMsg = h('div', 'mf-vmsg', '')
  const sendBtn = mkBtn('', 'primary', () => { void doSend() })
  toolRow.appendChild(chipsBox)
  toolRow.appendChild(h('span', 'mf-flex1'))
  let voiceBtn = null
  let syncVoice = () => {}
  if (voiceAvailable()) {
    voiceBtn = mkBtn('', 'mf-voice sm', null)
    voiceBtn.setAttribute('data-voice', '1')
    const syncVoiceUI = () => {
      voiceBtn.setAttribute('title', t('voiceHint'))
      if (rec.busy) { voiceBtn.textContent = t('btnVoiceBusy'); voiceBtn.disabled = true; return }
      voiceBtn.disabled = false
      if (rec.active) { voiceBtn.textContent = t('btnVoiceStop'); voiceBtn.className = 'mf-btn mf-voice sm rec' }
      else { voiceBtn.textContent = t('btnVoice'); voiceBtn.className = 'mf-btn mf-voice sm' }
    }
    syncVoice = syncVoiceUI
    syncVoiceUI()
    const onDone = (text) => {
      vMsg.textContent = ''
      ta.value = ta.value && ta.value.replace(/\s+$/, '') ? `${ta.value.replace(/\s+$/, '')} ${text}` : text
      autoGrow()
      if (ta.focus) ta.focus()
    }
    const onErr = (msg) => { vMsg.textContent = msg; say(msg, { level: 'warning' }) }
    // 两种姿势并存:按住说话(down…≥400ms…up/滑出=结束)/ 点击开始-再点结束。
    // ptrDown 区分「指针仍按着」:点击模式下光标移出按钮绝不能结束录音(否则点击模式形同虚设)。
    let ptrDown = false
    voiceBtn.addEventListener('pointerdown', (e) => {
      if (e && e.preventDefault) e.preventDefault()
      if (rec.busy) return
      ptrDown = true
      if (rec.active) { stopRec(false); return }
      vMsg.textContent = ''
      void startRec(onDone, onErr, syncVoiceUI)
    })
    voiceBtn.addEventListener('pointerup', () => { const held = ptrDown; ptrDown = false; if (held && rec.active && Date.now() - rec.t0 >= 400) stopRec(false) })
    voiceBtn.addEventListener('pointerleave', () => { const held = ptrDown; ptrDown = false; if (held && rec.active && Date.now() - rec.t0 >= 400) stopRec(false) })
    voiceBtn.addEventListener('pointercancel', () => { const held = ptrDown; ptrDown = false; if (held && rec.active) stopRec(true) })
    toolRow.appendChild(voiceBtn)
  }
  toolRow.appendChild(sendBtn)
  inputCard.appendChild(ta)
  inputCard.appendChild(toolRow)
  inputCard.appendChild(vMsg)
  wrap.appendChild(inputCard)

  const reviewBox = h('div'); wrap.appendChild(reviewBox)

  // ── 筛选行 + 热力图 ──
  const filterRow = h('div', 'mf-row')
  const searchEl = h('input', 'mf-input')
  searchEl.addEventListener('input', () => { searchQ = String(searchEl.value || ''); renderList() })
  const activeChips = h('div', 'mf-row')
  filterRow.appendChild(searchEl)
  filterRow.appendChild(activeChips)
  wrap.appendChild(filterRow)
  const heatBox = h('div'); wrap.appendChild(heatBox)
  const listBox = h('div'); wrap.appendChild(listBox)

  // ── 数据 ──
  const flatAll = () => flatten(store)
  const daysMap = () => {
    const d = {}
    for (const it of flatAll()) { const k = dayKeyOfIso(it.m.ts); if (k) d[k] = (d[k] || 0) + 1 }
    return d
  }
  async function reloadMonth(ym) {
    let memos
    try { memos = await readMonthRaw(ym) } catch { return } // 瞬时读失败:保留现有画面,绝不当「月已清空」
    if (memos && memos.length) store.set(ym, memos)
    else store.delete(ym)
  }
  async function loadStore() {
    loading = true; loadError = ''
    renderList()
    try { store = await loadAll() } catch (e) { loadError = (e && e.message) || String(e) }
    loading = false
    const failed = store.failedMonths || []
    if (failed.length) say(t('monthsFailed', { c: nMonthFiles(failed.length), list: joinList(failed) }), { level: 'warning' })
    renderAll()
  }
  // 视图变更走同一条写队列,与并发 addMemo(状态栏 quickCapture / 命令面板)排队互斥。
  // 变更以「磁盘现状为基 + 按 ts 重放本次修改」落盘(经典 read-modify-write):
  // 并发新条天然保全,总线 reloadMonth 换掉 store 数组也不会丢这次修改。
  // 磁盘读不到(抛错或缺席)一律拒改 —— 能被 patch/delete 的条目必然来自一次成功读过的月文件,
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
      store.set(ym, arr)
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
  }

  // ── 变更操作 ──
  async function patchMemo(ym, m, patch) {
    const prev = {}
    for (const k of Object.keys(patch)) prev[k] = m[k]
    try {
      Object.assign(m, patch) // 立即反映到 UI;落盘时按 ts 在磁盘现状上重放
      await persistMonthOp(ym, (arr) => {
        const x = arr.find((y) => y.ts === m.ts)
        if (x) Object.assign(x, patch)
      })
      renderAll()
    } catch (e) {
      Object.assign(m, prev) // 拒改回滚:UI 与磁盘保持一致,不留「看着改成了其实没落盘」的假象
      renderAll()
      say(t('saveFail', { msg: (e && e.message) || e }), { level: 'error' })
    }
  }
  async function deleteMemo(ym, m) {
    // y 确认是删除契约的一部分:没有 prompt 的宿主宁可不删,绝不静默单击即毁
    if (!ctx.app.prompt) { say(t('deleteNoPrompt'), { level: 'warning' }); return }
    let ok
    try { ok = await ctx.app.prompt(t('deleteConfirm'), '') } catch { return }
    if (ok == null || String(ok).trim().toLowerCase() !== 'y') return
    const prevArr = store.get(ym) || []
    try {
      store.set(ym, prevArr.filter((x) => x !== m)) // UI 先行
      await persistMonthOp(ym, (arr) => {
        const i = arr.findIndex((y) => y.ts === m.ts)
        if (i >= 0) arr.splice(i, 1)
      })
      say(t('deleted'), { level: 'success' })
      renderAll()
    } catch (e) {
      store.set(ym, prevArr) // 拒改回滚:磁盘没删成,画面也不能装删了
      renderAll()
      say(t('deleteFail', { msg: (e && e.message) || e }), { level: 'error' })
    }
  }
  async function toNote(ym, m) {
    const wasArchived = m.archived
    try {
      const p = await memoToNote(m)
      m.archived = true
      await persistMonthOp(ym, (arr) => {
        const x = arr.find((y) => y.ts === m.ts)
        if (x) x.archived = true
      })
      say(t('toNoteOk'), { level: 'success' })
      if (ctx.app.openFile) ctx.app.openFile(p)
      renderAll()
    } catch (e) {
      m.archived = wasArchived // 归档标没落盘就不装归档了(笔记文件若已写出则保留)
      renderAll()
      say(t('toNoteFail', { msg: (e && e.message) || e }), { level: 'error' })
    }
  }
  let sending = false // Enter 通道重入闸:双击 Enter / Enter+按钮同击只落一条
  async function doSend() {
    if (sending) return
    const v = ta.value
    if (!v || !String(v).trim()) return
    sending = true
    sendBtn.disabled = true
    try {
      await addMemo(v)
      ta.value = ''
      autoGrow()
      await reloadMonth(monthKeyOf(Date.now()))
      renderAll()
    } catch (e) { say(t('saveFail', { msg: (e && e.message) || e }), { level: 'error' }) }
    finally { sending = false; sendBtn.disabled = false }
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
      const c = await rebuildCacheFromStore(store)
      say(t('rebuildOk', { c: nMemos(c.total) }), { level: 'success' })
      renderAll()
    } catch (e) { say(t('rebuildFail', { msg: (e && e.message) || e }), { level: 'error' }) }
  }

  // ── 渲染 ──
  function renderStats() {
    const d = daysMap()
    let total = 0
    for (const k of Object.keys(d)) total += d[k]
    const s = streakOf(d, todayKey())
    stats.textContent = total ? t('stats', { c: nMemos(total), d: s }) : ''
  }
  /** 静态骨架上的文案(标题 / 按钮 / placeholder):语言一变就地重写,不重挂视图。 */
  function renderChrome() {
    titleEl.textContent = t('appName')
    btnDigest.textContent = t('btnDigest')
    btnRebuild.textContent = t('btnRebuild')
    btnArch.textContent = t('btnShowArch')
    sendBtn.textContent = t('btnSend')
    ta.setAttribute('placeholder', t('inputPlaceholder'))
    searchEl.setAttribute('placeholder', t('searchPlaceholder'))
    syncVoice() // 录音中也安全:它按 rec 状态重算,不会把「结束录音」写回「语音」
  }
  function renderChips() {
    chipsBox.textContent = ''
    for (const t of recentTags().slice(0, 8)) {
      const c = h('button', 'mf-chip', `#${t}`)
      c.addEventListener('click', () => {
        const cur = ta.value || ''
        ta.value = cur && !/\s$/.test(cur) ? `${cur} #${t} ` : `${cur}#${t} `
        if (ta.focus) ta.focus()
      })
      chipsBox.appendChild(c)
    }
  }
  function renderDigestBox() {
    digestBox.textContent = ''
    if (!digest.running && !digest.error && !digest.errorKey) return
    const card = h('div', 'mf-card')
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
      row.appendChild(mkBtn(t('btnCancel'), 'sm', () => { if (digest.controller) digest.controller.abort() }))
      card.appendChild(headRow); card.appendChild(track); card.appendChild(row)
    } else {
      const row = h('div', 'mf-row')
      row.appendChild(h('span', 'mf-err', t('digestFail', { msg: digestErrText() })))
      row.appendChild(h('span', 'mf-flex1'))
      row.appendChild(mkBtn(t('btnRetry'), 'sm', () => { digest.error = ''; digest.errorKey = ''; void runDigest() }))
      row.appendChild(mkBtn(t('btnGotIt'), 'sm', () => { digest.error = ''; digest.errorKey = ''; renderDigestBox() }))
      card.appendChild(row)
    }
    digestBox.appendChild(card)
  }
  function currentPicks() {
    const today = todayKey() // 不叫 t:与词表 helper t() 重名
    if (reviewState.day !== today) { reviewState.day = today; reviewState.done = new Set(); reviewState.picks = null }
    const n = reviewCountSetting()
    if (!n) return []
    const all = flatAll().map((x) => x.m)
    if (!reviewState.picks) {
      if (loading) return [] // 数据没到位不冻结,免得把空集钉成「今天没得回顾」
      reviewState.picks = pickReview(reviewEligible(all, today), seedOfDay(today), n).map((m) => m.ts)
    }
    // 冻结后只做过滤,不重抽:已删除的卡掉队;在时间线上被归档(而非经回顾处理)的也掉队;
    // 经回顾动作归档/转笔记的(已进 done)留在分母里,完成判定与「还剩 N/M」才不会自我延长。
    const byTs = new Map()
    for (const m of all) byTs.set(m.ts, m)
    return reviewState.picks.map((ts) => byTs.get(ts)).filter((m) => m && (!m.archived || reviewState.done.has(m.ts)))
  }
  function renderReview() {
    reviewBox.textContent = ''
    const today = todayKey() // 不叫 t:与词表 helper t() 重名
    if (getLS('reviewDone', '') === today) return
    const picks = currentPicks()
    if (!picks.length) return
    const remain = picks.filter((p) => !reviewState.done.has(p.ts))
    if (!remain.length) return
    const card = h('div', 'mf-card')
    const headRow = h('div', 'mf-row')
    headRow.appendChild(h('span', 'mf-label', t('reviewLabel')))
    headRow.appendChild(h('span', 'mf-hint', t('reviewHint', { left: remain.length, total: picks.length })))
    card.appendChild(headRow)
    const rowBox = h('div', 'mf-rcards')
    for (const p of remain) {
      const rc = h('div', 'mf-rcard')
      rc.setAttribute('data-review', '1')
      rc.appendChild(h('div', 'mf-rdate', fmtDay(dayKeyOfIso(p.ts))))
      const tx = h('div', 'mf-rtext')
      renderMemoText(tx, p.text, null)
      rc.appendChild(tx)
      const acts = h('div', 'mf-row')
      const done = (fn) => async () => {
        reviewState.done.add(p.ts)
        if (fn) await fn()
        // 处理动作可能让条目失去回顾资格(归档/转笔记)——picksNow 变空同样算「全部处理完」
        const picksNow = currentPicks()
        if (!picksNow.length || picksNow.every((x) => reviewState.done.has(x.ts))) {
          setLS('reviewDone', today)
          ctx.activity?.log('review_done')
          say(t('reviewDone'), { level: 'success' })
        }
        renderAll()
      }
      const home = homeOf(p)
      acts.appendChild(mkBtn(t('actSkip'), 'sm', done(null)))
      acts.appendChild(mkBtn(t('actToNote'), 'sm', done(() => (home ? toNote(home, p) : null))))
      acts.appendChild(mkBtn(t('actArchive'), 'sm', done(() => (home ? patchMemo(home, p, { archived: true }) : null))))
      rc.appendChild(acts)
      rowBox.appendChild(rc)
    }
    card.appendChild(rowBox)
    reviewBox.appendChild(card)
  }
  function homeOf(memo) {
    for (const it of flatAll()) { if (it.m === memo) return it.ym }
    return ''
  }
  function renderFilter() {
    activeChips.textContent = ''
    const add = (label, clear) => {
      const c = h('button', 'mf-chip x', `${label} ✕`)
      c.addEventListener('click', clear)
      activeChips.appendChild(c)
    }
    if (filterTag) add(`#${filterTag}`, () => { filterTag = ''; renderAll() }) // 标签名是用户数据,不翻
    if (filterDay) add(fmtDay(filterDay), () => { filterDay = ''; renderAll() })
  }
  function renderHeat() {
    heatBox.textContent = ''
    const days = daysMap()
    const grid = h('div', 'mf-heat')
    const tSer = daySerial(todayKey())
    const start = tSer - ((tSer + 3) % 7) - 77 // 12 周网格,列=周(周一开头)
    for (let i = 0; i < 84; i++) {
      const serial = start + Math.floor(i / 7) * 7 + (i % 7)
      const key = serialToKey(serial)
      const n = days[key] || 0
      const lv = n <= 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 6 ? 3 : 4
      const cell = h('span', `mf-cell lv${lv}${filterDay === key ? ' sel' : ''}`)
      cell.setAttribute('title', t('heatCell', { day: key, c: nMemos(n) })) // day 用 ISO 原键:两语言通读,且是数据键
      if (serial > tSer) cell.className = 'mf-cell future'
      else cell.addEventListener('click', () => { filterDay = filterDay === key ? '' : key; renderAll() })
      grid.appendChild(cell)
    }
    heatBox.appendChild(grid)
  }
  function memoRow(ym, m) {
    const row = h('div', `mf-memo${m.archived ? ' arch' : ''}`)
    row.setAttribute('data-memo', '1')
    const top = h('div', 'mf-mtop')
    top.appendChild(h('span', null, timeOfIso(m.ts)))
    if (m.pinned) top.appendChild(h('span', 'mf-flag', t('flagPinned')))
    if (m.archived) top.appendChild(h('span', 'mf-flag', t('flagArchived')))
    const acts = h('span', 'mf-acts')
    const ab = (label, fn, danger) => {
      const b = h('button', `mf-abtn${danger ? ' danger' : ''}`, label)
      b.addEventListener('click', fn)
      acts.appendChild(b)
    }
    ab(t('actEdit'), () => { endEdit(); editingTs = m.ts; renderList() }) // 换一条编辑 → 上一条的草稿作废
    ab(m.pinned ? t('actUnpin') : t('actPin'), () => { void patchMemo(ym, m, { pinned: !m.pinned }) })
    ab(m.archived ? t('actRestore') : t('actArchive'), () => { void patchMemo(ym, m, { archived: !m.archived }) })
    ab(t('actToNote'), () => { void toNote(ym, m) })
    ab(t('actDelete'), () => { void deleteMemo(ym, m) }, true)
    top.appendChild(acts)
    row.appendChild(top)
    if (editingTs === m.ts) {
      const ed = h('textarea', 'mf-ta')
      ed.value = editDraft != null ? editDraft : m.text // 有草稿用草稿(空串也算草稿:用户可能刚全选删掉)
      ed.addEventListener('input', () => { editDraft = String(ed.value == null ? '' : ed.value) })
      const r2 = h('div', 'mf-row')
      r2.appendChild(h('span', 'mf-flex1'))
      r2.appendChild(mkBtn(t('btnCancel'), 'sm', () => { endEdit(); renderList() }))
      r2.appendChild(mkBtn(t('btnSave'), 'primary sm', () => {
        const nv = String(ed.value == null ? '' : ed.value).replace(/\s+$/, '')
        endEdit()
        if (nv.trim() && nv !== m.text) { void patchMemo(ym, m, { text: nv }) } else renderList()
      }))
      row.appendChild(ed)
      row.appendChild(r2)
    } else {
      const body = h('div', 'mf-mbody')
      renderMemoText(body, m.text, (tag) => { filterTag = filterTag === tag ? '' : tag; renderAll() })
      row.appendChild(body)
    }
    return row
  }
  function renderList() {
    listBox.textContent = ''
    if (loading) { listBox.appendChild(h('div', 'mf-empty', t('loading'))); return }
    if (loadError) {
      const e = h('div', 'mf-empty')
      e.appendChild(h('b', null, t('loadFail')))
      e.appendChild(h('div', 'mf-err', loadError))
      e.appendChild(mkBtn(t('btnRetry'), 'sm', () => { void loadStore() }))
      listBox.appendChild(e)
      return
    }
    const flat = flatAll()
    if (!flat.length) {
      const e = h('div', 'mf-empty')
      e.appendChild(h('b', null, t('emptyTitle')))
      e.appendChild(h('div', null, t('emptyHint')))
      listBox.appendChild(e)
      return
    }
    let items = flat.filter((it) => (showArch ? true : !it.m.archived))
    if (filterTag) items = items.filter((it) => extractTags(it.m.text).includes(filterTag))
    if (filterDay) items = items.filter((it) => dayKeyOfIso(it.m.ts) === filterDay)
    if (searchQ.trim()) { const q = searchQ.trim().toLowerCase(); items = items.filter((it) => it.m.text.toLowerCase().includes(q)) }
    items.sort((a, b) => (a.m.ts < b.m.ts ? 1 : a.m.ts > b.m.ts ? -1 : 0))
    if (!items.length) {
      const e = h('div', 'mf-empty', t('noMatch'))
      listBox.appendChild(e)
      return
    }
    const pinned = items.filter((it) => it.m.pinned && !it.m.archived)
    if (pinned.length) {
      listBox.appendChild(h('div', 'mf-day', t('pinnedGroup', { n: pinned.length })))
      for (const it of pinned) listBox.appendChild(memoRow(it.ym, it.m))
    }
    const tKey = todayKey(), yKey = shiftDays(tKey, -1)
    let curDay = ''
    for (const it of items) {
      if (it.m.pinned && !it.m.archived) continue
      const k = dayKeyOfIso(it.m.ts)
      if (k !== curDay) {
        curDay = k
        const label = k === tKey ? t('dayToday') : k === yKey ? t('dayYesterday') : fmtDay(k)
        listBox.appendChild(h('div', 'mf-day', label))
      }
      listBox.appendChild(memoRow(it.ym, it.m))
    }
  }
  function renderAll() {
    renderChrome(); renderStats(); renderChips(); renderDigestBox(); renderReview(); renderFilter(); renderHeat(); renderList()
  }
  // 语言切换:宿主只广播变化,初值自己 getLocale()。**不重挂视图**——就地重画整屏,
  // 输入框里没发出去的草稿、编辑框里没保存的字、正在录的音、跑着的周整理都不能被语言切换打断。
  // 前两样各有各的机制:输入框 ta / 搜索框是 mount 时建的常驻元素(重画只改 placeholder);
  // 编辑框每次 renderList 都新建,靠 editDraft 回填 —— 少了它,切个语言就把用户正写的一段吃掉。
  const offLocale = ctx.subscribeLocale?.(() => { renderAll() })
  renderChrome()

  // ── 总线 + 启动 ──
  const offBus = bus.on((e) => {
    if (!e) return
    if (e.type === 'digest') { renderDigestBox(); return }
    if (e.type === 'added') { void reloadMonth(e.ym).then(renderAll) }
  })
  // 眼见为实:首开就把缓存文件落进工作文件夹(文件树里可见,重建按钮也有对象)。
  // 只在「读成功且文件确实缺席」时播种空缓存;读失败(抛错)一律不写 —— 缓存是写前防线的
  // 第二道证词,瞬时读失败时把它覆写成空,等于亲手拆掉防线(P0 链条,check 有回归)。
  // 内容损坏但在场的文件也不动(「重建缓存」按钮可校准),这里绝不抢救。
  async function ensureCacheFile() {
    try {
      const t = await ctx.app.readFile(cachePath())
      if (t == null || t === '') await writeCacheFile({ days: {}, tags: {}, total: 0, builtAt: Date.now() })
    } catch { /* 读失败 ≠ 缺席:什么都不写 */ }
  }
  void ensureCacheFile().then(loadStore)

  return () => { offTheme(); offBus(); if (offLocale) offLocale(); if (rec.active || rec.busy) stopRecHard() }
}

// ── 注册(id 全按 SPEC 钉死;07-18 后 API 一律可选链) ─────────────────────────
// 贡献点的标题是**单字符串**、宿主不做运行时重解析:这里取的是**注册当时**的语言,
// 语言切换后命令面板 / 设置页 / 视图 tab 标题要等重启才跟上(宿主侧已知缺口,见 README)。
// 绝不为它做「语言变了就 teardown 重注册」——那会打断录音、写队列与已打开的视图。
// keywords 反而恒双语:搜索面不该因为界面语言而搜不到。
ctx.registerView?.({ id: 'memos', title: t('appName'), mount: mountMemos, singleton: true })
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
  try { sbHandle?.update?.({ text: t('statusText'), title: t('statusTitle') }) } catch { /* 旧宿主 handle 无 update */ }
})

// ── check.mjs 测试钩子 ──────────────────────────────────────────────────────
if (globalThis.__MEMOFLOW_TEST__) {
  Object.assign(globalThis.__MEMOFLOW_TEST__, {
    parseMonth, serializeMonth, splitTailMarkers, applyCacheDelta, extractTags, mulberry32, seedOfDay, pickReview, reviewEligible,
    monthSeq, isoWeekOf, dayKeyOf, dayKeyOfIso, monthKeyOf, daySerial, serialToKey, shiftDays,
    cacheFromMemos, bumpCacheObj, streakOf, buildDigestMessage, parseDigest, digestCorpus,
    safeHref, sanitizeFileName, renderMemoText, voiceAvailable, addMemo, quickCapture, memoToNote,
    loadAll, rebuildCacheFromStore, onColorOf, readableOn, contrast, wfRoot, timeOfIso,
    MSG, L, t, fmtDay, nMemos, nMonthFiles, joinList,
  })
}

return () => {
  if (offLocaleSb) offLocaleSb()
  if (sbHandle && sbHandle.dispose) sbHandle.dispose()
  if (digest.controller) digest.controller.abort()
  stopRecHard()
}
