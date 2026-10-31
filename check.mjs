/**
 * 闪念盒插件自检:宿主同款 new Function('ctx', src) 求值 main.js + DOM 垫片 + 冻钟 + 内存 vault。
 * 覆盖(SPEC「check.mjs 额外必测」全项):
 *   贡献点齐全 / disposer / 月文件解析序列化往返(多行·标签·哨兵·EOF·首节前前言逐字节)/ 标签规则(#中文 ok、#123 不算、行中多个)/
 *   seed 稳定性(同日同结果、跨日不同)/ 缓存增量==全量 / 月序列跨年自枚举 / 删除后其余条完好 /
 *   XSS(<img onerror> 时间线渲染无 attrs)/ 旧宿主(无 statusItem·transcribeAudio·achievements)不抛且语音按钮不出现。
 * 修复轮回归(20260807):
 *   P0 写前防线(月文件瞬时读失败 → 拒写不覆月,会话记忆与派生缓存两道证词)/ 并发 addMemo 串行不丢条 + ts 唯一 /
 *   每日回顾同日冻结(处理动作不重抽、绝不引入没见过的新卡)/ 前言(frontmatter/导语)写路径保全 /
 *   语音点击模式 pointerleave 不误停(按住模式滑出仍停)/ IME 合成 Enter 不发送 + 双 Enter 重入闸 / 转笔记同名不覆写。
 * 修复轮回归(20260807 第二轮):
 *   P0 链条(读失败绝不拆防线:ensureCacheFile 不播种覆写 / 变更缓存走增量补丁不由残缺 store 全量重建 /
 *   折叠宿主仅凭缓存证词仍拒写)/ P1 persistMonthOp 读不到一律拒改(绝不用陈旧 store 整月重写覆没外部新条)/
 *   Amadeus 块标记 <!-- a N -->(尾随标记不吃哨兵 · 各形态往返逐字节 · 写回不破坏宿主 BLOCK_MARKER_RE · 旧坏形态自愈 ·
 *   时间线不当正文展示)/ MediaRecorder 构造抛出必停麦克风流 / parseDigest 嵌套围栏不截断。
 * 2.0(2026-10-31):解析对账(Genesis TAG_RE 对照样例)/ 前缀匹配 / 旧缓存只换 tags / 左栏树(parent + folder + 按条去重计数)/
 *   筛选替换与追加 + 留下的行不重建 / 改名合并写盘(其余字节不变、块标记与哨兵、子标签、去重、读失败零写入、折叠宿主证词、
 *   确认期间外部写入、部分失败)/ ChatBox 新字段与句柄探测回退 / Mini 断点与参数带到主面板 / 跨窗口刷新 / 手机摊平 /
 *   六条动效的时长曲线与减少动态效果。
 * 跑法:node check.mjs
 */
process.env.TZ = 'Asia/Shanghai'
import { readFileSync } from 'node:fs'
import { strict as A } from 'node:assert'

const src = readFileSync(new URL('./main.js', import.meta.url), 'utf8')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── 静态纪律 ──
A.ok(!/innerHTML/.test(src), 'main.js 禁 innerHTML(shim 可直测 + XSS 面归零)')
A.ok(!/querySelector/.test(src), 'main.js 禁 querySelector(全部直引用)')
A.ok(!/setInterval/.test(src), '轮询用 setTimeout 自排程,禁 setInterval')
A.ok(!/new Date\(\)/.test(src), '「现在」一律 Date.now(),禁裸 new Date()')
A.ok(!/color:\s*#fff/i.test(src), 'CSS 不许写死白字')
A.ok(!/::-webkit-scrollbar/.test(src), 'DESIGN §6:全局禁写 ::-webkit-scrollbar')
A.ok(!/[\s:]1\.5px/.test(src), '不用 1.5px 线框')
A.ok(!/[🎙📌]/u.test(src), '词表里没有 emoji')
A.ok(!/--mf-/.test(src), '样式只用宿主 token,不再派生 --mf-*')
{
  const lines = src.split('\n')
  const asi = [...lines.keys()].filter((i) => {
    if (!/^\s*[([]/.test(lines[i])) return false
    let p = i - 1; while (p >= 0 && !lines[p].trim()) p--
    return p >= 0 && /[)\]'"`\w]\s*$/.test(lines[p])
  }).map((i) => i + 1)
  A.equal(asi.length, 0, `以 ( [ 开头的行会被 ASI 粘到上一句:第 ${asi.join(',')} 行`)
}

// ── 冻钟:2026-08-06 12:00 上海(= 04:00Z);语音时序测试会小步推进(不跨日) ──
let NOW = Date.parse('2026-08-06T04:00:00.000Z')
Date.now = () => NOW

// ── DOM 垫片 ──
function mkText(t) {
  const n = { tag: '#text', children: [], attrs: {}, appendChild() {}, setAttribute() {}, addEventListener() {} }
  let v = String(t)
  Object.defineProperty(n, 'textContent', { get: () => v, set: (x) => { v = String(x) } })
  return n
}
const ANIM = { on: false, log: [] }
function mkEl(tag) {
  const el = {
    tag, children: [], attrs: {}, listeners: {}, parentElement: null, isConnected: true,
    className: '', disabled: false, value: '',
    style: { setProperty() {}, removeProperty() {} },
    focus() {}, blur() {},
    setAttribute(k, v) { el.attrs[k] = String(v) },
    getAttribute(k) { return k in el.attrs ? el.attrs[k] : null },
    addEventListener(t, f) { const a = el.listeners[t] || (el.listeners[t] = []); a.push(f) },
    removeEventListener() {},
    remove() { const p = el.parentElement; if (p) p.children = p.children.filter((x) => x !== el); el.parentElement = null },
  }
  el.classList = {
    add: (...cs) => { const s = new Set(el.className.split(/\s+/).filter(Boolean)); cs.forEach((c) => s.add(c)); el.className = [...s].join(' ') },
    remove: (...cs) => { el.className = el.className.split(/\s+/).filter((c) => c && !cs.includes(c)).join(' ') },
    toggle: (c, f) => { const has = el.classList.contains(c); const want = f == null ? !has : !!f; if (want) el.classList.add(c); else el.classList.remove(c); return want },
    contains: (c) => el.className.split(/\s+/).includes(c),
  }
  let own = ''
  el.appendChild = (c) => {
    if (c && c.tag === '#frag') { for (const k of c.children.slice()) el.appendChild(k); return c }
    if (c && c.parentElement && c.parentElement !== el) c.remove?.()
    if (c && c.parentElement === el) el.children = el.children.filter((x) => x !== c)
    el.children.push(c); if (c && typeof c === 'object') c.parentElement = el
    return c
  }
  el.insertBefore = (c, ref) => {
    if (c.parentElement === el) el.children = el.children.filter((x) => x !== c)
    const i = ref ? el.children.indexOf(ref) : -1
    if (i < 0) el.children.push(c); else el.children.splice(i, 0, c)
    c.parentElement = el
    return c
  }
  const animate = (kf, o) => { ANIM.log.push({ el, kf, ms: o.duration, easing: o.easing }); return { finished: Promise.resolve() } }
  Object.defineProperty(el, 'animate', { get: () => (ANIM.on ? animate : undefined) })
  el.offsetHeight = 20
  el.getBoundingClientRect = () => ({ left: 10, top: 10, width: 300, height: 20 })
  el.children = el.children
  Object.defineProperty(el, 'firstChild', { get: () => el.children[0] || null })
  Object.defineProperty(el, 'nextSibling', { get: () => { const s = el.parentElement ? el.parentElement.children : []; return s[s.indexOf(el) + 1] || null } })
  Object.defineProperty(el, 'textContent', {
    get: () => own + el.children.map((c) => (c && c.textContent) || '').join(''),
    set: (v) => { el.children.length = 0; own = String(v) },
  })
  return el
}
globalThis.document = {
  createElement: mkEl, createTextNode: mkText, createDocumentFragment: () => mkEl('#frag'),
  addEventListener() {}, body: mkEl('body'),
}
globalThis.getComputedStyle = () => ({ getPropertyValue: () => '', color: 'rgb(40,40,40)' })
const findAll = (node, pred) => {
  const out = []
  const walk = (n) => { for (const c of (n.children || [])) { if (pred(c)) out.push(c); walk(c) } }
  walk(node)
  return out
}
const byTag = (node, tag) => findAll(node, (c) => c.tag === tag)
const byAttr = (node, key) => findAll(node, (c) => c.attrs && key in c.attrs)
const anyAttr = (node, key) => byAttr(node, key).length > 0

// ── localStorage 垫片 ──
const _ls = new Map()
globalThis.localStorage = { getItem: (k) => (_ls.has(k) ? _ls.get(k) : null), setItem: (k, v) => _ls.set(k, String(v)), removeItem: (k) => _ls.delete(k) }

// ── 新宿主 mock(语音桥 + MediaRecorder + navigator 齐备 → 语音按钮应渲染) ──
globalThis.window = {
  tangu: { transcribeAudio: async () => '语音转写文本', getConfig: async () => ({ backendUrl: 'http://test', token: 'tk' }) },
}
globalThis.MediaRecorder = class MediaRecorder {
  constructor(stream) { this.stream = stream; this.mimeType = 'audio/webm' }
  start() {}
  stop() { if (this.onstop) this.onstop() }
}
Object.defineProperty(globalThis, 'navigator', {
  value: { mediaDevices: { getUserMedia: async () => { throw new Error('no mic in node') } } },
  configurable: true, writable: true,
})

const V = new Map()
const writes = []
let failRead = null // (p) => boolean:模拟宿主 readFile 瞬时抛错(EBUSY / 云占位未下载)
const reg = { views: [], commands: [], settings: [], status: [], series: [], tracks: [], activity: [], notes: [], opened: [] }
let promptReply = null
const ctx = {
  registerView: (v) => reg.views.push(v),
  registerCommand: (c) => reg.commands.push(c),
  registerSetting: (s) => reg.settings.push(s),
  registerStatusItem: (s) => { reg.status.push(s); return { update() {}, dispose() {} } },
  openView() {},
  notify: (m, o) => reg.notes.push([m, o]),
  activity: { log: (e, d) => reg.activity.push([e, d]) },
  achievements: { registerSeries: (s) => reg.series.push(s), track: (e) => reg.tracks.push(e) },
  app: {
    notify() {},
    openFile: (p) => reg.opened.push(p),
    readFile: async (p) => { if (failRead && failRead(p)) throw new Error('EBUSY (mock)'); return V.has(p) ? V.get(p) : null },
    writeFile: async (p, t) => { V.set(p, String(t)); writes.push(p) },
    workFolder: () => '闪念盒',
    prompt: async () => promptReply,
  },
}
globalThis.__MEMOFLOW_TEST__ = {}
const dispose = new Function('ctx', src)(ctx)
const T = globalThis.__MEMOFLOW_TEST__

// ── 贡献点契约 ──
A.equal(typeof dispose, 'function', 'setup 应返回 disposer')
A.ok(reg.views.find((v) => v.id === 'memos' && typeof v.mount === 'function'), '应注册 memos 视图')
for (const id of ['memoflow-open', 'memoflow-capture', 'memoflow-digest']) {
  A.ok(reg.commands.find((c) => c.id === id && typeof c.run === 'function'), `应注册 ${id} 命令`)
}
{
  const s = reg.settings.find((x) => x.key === 'reviewCount')
  A.ok(s, '应声明 reviewCount 设置')
  A.equal(s.type, 'number'); A.equal(s.default, 4)
}
A.ok(reg.status.find((s) => s.id === 'quick' && typeof s.onClick === 'function'), '应注册 quick 状态栏项')
{
  const series = reg.series.find((s) => s.id === 'memoflow')
  A.ok(series, '应注册成就系列')
  A.deepEqual(series.achievements.map((a) => a.event).sort(), ['capture', 'streak7'], '成就事件:capture + streak7')
  A.ok(series.achievements.find((a) => a.event === 'capture' && a.goal === 100), '累计 100 条')
}
for (const k of ['parseMonth', 'serializeMonth', 'extractTags', 'pickReview', 'monthSeq', 'isoWeekOf', 'cacheFromMemos', 'bumpCacheObj', 'buildDigestMessage', 'parseDigest', 'renderMemoText', 'addMemo', 'voiceAvailable']) {
  A.equal(typeof T[k], 'function', `钩子应暴露 ${k}`)
}

// ── 日期纪律(冻钟 + 上海时区) ──
A.equal(T.dayKeyOf(NOW), '2026-08-06', '冻钟今天 = 2026-08-06(上海)')
A.equal(T.monthKeyOf(NOW), '2026-08')
A.equal(T.dayKeyOfIso('2026-08-01T18:30:00.000Z'), '2026-08-02', 'UTC 跨午夜 → 上海本地日 +1')
A.equal(T.shiftDays('2026-08-06', -7), '2026-07-30', '正午锚定回溯 7 天')
A.equal(T.shiftDays('2026-01-01', -1), '2025-12-31', '跨年回溯')
A.equal(T.isoWeekOf('2026-08-06'), '2026-W32', 'ISO 周号')
A.equal(T.isoWeekOf('2026-01-01'), '2026-W01')
A.equal(T.isoWeekOf('2027-01-01'), '2026-W53', 'ISO 年界:2027-01-01 属 2026-W53')

// ── 月序列自枚举(跨年) ──
A.deepEqual(T.monthSeq('2025-11', '2026-02'), ['2025-11', '2025-12', '2026-01', '2026-02'], '2025-11→2026-02 跨年枚举')
A.deepEqual(T.monthSeq('2026-08', '2026-08'), ['2026-08'])
A.deepEqual(T.monthSeq('bad', '2026-08'), [], '非法输入给空')

// ── 标签解析:#中文 ok、#123 不算、# 后接标点不算、行中多个、去重 ──
A.deepEqual(T.extractTags('想到 #forsion 和 #产品 再提 #forsion'), ['forsion', '产品'], '行中多个 + 去重')
A.deepEqual(T.extractTags('编号 #123 不算 #中文标签 算'), ['中文标签'], '#纯数字不算、#中文 ok')
A.deepEqual(T.extractTags('#,bad #!x #。y'), [], '# 后接标点不算')
A.deepEqual(T.extractTags('多行\n#tag2 第二行'), ['tag2'], '多行正文里也解析')
A.deepEqual(T.extractTags(''), [])
A.deepEqual(T.extractTags('今天看了 #设计,下周再说'), ['设计'], '中文逗号不吞句子')
A.deepEqual(T.extractTags('今天看了 #设计，下周再说。'), ['设计'], '全角逗号同样到标点为止')
A.deepEqual(T.extractTags('a.com/#frag'), [], 'URL 片段不算标签')
A.deepEqual(T.extractTags('看过,#x'), [], '# 前面不是空白不算(和 Amadeus 一致)')
// 解析对账:Genesis desktop/shared/amadeus/links.ts 的 TAG_RE + parseTags 过滤规则同款参照(不含 maskCode:闪念不做代码块遮罩)
{
  const GENESIS_TAG_RE = /(?:^|\s)#([\p{L}\p{N}_/-]+)/gu
  const genesisParse = (md) => {
    const out = [], seen = new Set()
    for (const m of md.matchAll(GENESIS_TAG_RE)) {
      const t = m[1]
      if (/^[0-9/]+$/.test(t)) continue
      const k = t.toLowerCase()
      if (!seen.has(k)) { seen.add(k); out.push(t) }
    }
    return out
  }
  const SAMPLES = [
    ['今天看了 #设计,下周再说', ['设计']], ['a.com/#frag', []], ['#产品/路线图 #产品/用户', ['产品/路线图', '产品/用户']],
    ['#1 #1/2 #2026', []], ['#2026-10', ['2026-10']], ['#Foo #foo #FOO', ['Foo']], ['行首#不算 行中 #算', ['算']],
    ['#a#b', ['a']], ['第一行\n#第二行 尾', ['第二行']], ['#snake_case #kebab-case', ['snake_case', 'kebab-case']],
    ['#日本語 #한글 #émigré', ['日本語', '한글', 'émigré']], ['(#括号内)', []], ['# 空格', []], ['##双井', []],
    ['tab\t#制表', ['制表']], ['#a/ #b//c', ['a/', 'b//c']], ['全角空格\u3000#标签', ['标签']],
  ]
  for (const [input, want] of SAMPLES) {
    A.deepEqual(genesisParse(input), want, `对照样例本身:${input}`)
    A.deepEqual(T.extractTags(input), want, `extractTags 与 Genesis 同口径:${input}`)
  }
}
// 前缀匹配(同 Genesis tagMatches)
A.equal(T.tagMatches('work', 'work'), true); A.equal(T.tagMatches('work/urgent', 'work'), true, '查 work 命中子标签')
A.equal(T.tagMatches('workshop', 'work'), false, '查 work 不命中 workshop'); A.equal(T.tagMatches('Work/Urgent', 'wORK'), true, '大小写不敏感')
A.equal(T.tagMatches('work', '#work/'), true, '查询串去 # 与尾斜杠'); A.equal(T.tagMatches('work', ''), false, '空查询不命中')
A.equal(T.normTag(' #产品/路线图 '), '产品/路线图'); A.equal(T.normTag('a b'), null, '带空格不是标签名')
A.equal(T.normTag('#123'), null, '纯数字不是标签名'); A.equal(T.normTag('1/2'), null); A.equal(T.normTag(''), null)

// ── 月文件解析 / 序列化往返(多行条 / 标签 / 哨兵 / EOF 边界) ──
const CANON = `# 2026-08

### 2026-08-06T01:12:33.000Z
今天想到:插件生态的护城河是 Agent 纵深 #forsion #产品

### 2026-08-06T06:02:10.000Z
多行闪念
第二行也属于这条,直到下一个 ### 或 EOF。

### 2026-08-06T07:00:00.000Z
被置顶的想法 ⚑pin

### 2026-08-06T08:00:00.000Z
已归档的想法 ⌫arch

### 2026-08-06T09:00:00.000Z
又置顶又归档 ⚑pin ⌫arch
`
{
  const p = T.parseMonth(CANON)
  A.equal(p.ym, '2026-08', '应解析出月头')
  A.equal(p.memos.length, 5)
  A.equal(p.memos[0].text, '今天想到:插件生态的护城河是 Agent 纵深 #forsion #产品')
  A.equal(p.memos[1].text, '多行闪念\n第二行也属于这条,直到下一个 ### 或 EOF。', '多行正文归同一条')
  A.deepEqual([p.memos[2].pinned, p.memos[2].archived], [true, false], '⚑pin 哨兵 → 置顶')
  A.equal(p.memos[2].text, '被置顶的想法', '哨兵从正文剥出')
  A.deepEqual([p.memos[3].pinned, p.memos[3].archived], [false, true], '⌫arch 哨兵 → 归档')
  A.deepEqual([p.memos[4].pinned, p.memos[4].archived], [true, true], '双哨兵都解析')
  A.equal(T.serializeMonth('2026-08', p.memos), CANON, '序列化/解析对称(canonical 往返逐字节)')
  A.equal(T.serializeMonth('2026-08', p.memos, p.preamble), CANON, '显式回放 canonical 前言仍逐字节')
}
// 首节前前言(frontmatter / 手写导语)= 数据,不许有损
{
  const withFm = '---\nfoo: 1\n---\n导语一行\n\n### 2026-08-01T04:00:00.000Z\n正文 #tag\n'
  const pp = T.parseMonth(withFm)
  A.equal(pp.memos.length, 1)
  A.equal(pp.preamble, '---\nfoo: 1\n---\n导语一行\n', '前言捕获(不含首个时间戳节)')
  A.equal(T.serializeMonth('2026-08', pp.memos, pp.preamble), withFm, '带前言的月文件往返逐字节')
  const noPre = '### 2026-08-01T04:00:00.000Z\n直接开节\n'
  const p0 = T.parseMonth(noPre)
  A.equal(p0.preamble, '', '无前言 → 空串')
  A.equal(T.serializeMonth('2026-08', p0.memos, p0.preamble), noPre, '空前言不强加 canonical 头')
}
{
  const eof = '# 2026-07\n\n### 2026-07-20T02:00:00.000Z\n最后一条没有结尾空行 #尾'
  const p = T.parseMonth(eof)
  A.equal(p.memos.length, 1, 'EOF 无空行也算一条')
  A.equal(p.memos[0].text, '最后一条没有结尾空行 #尾')
  const p2 = T.parseMonth(T.serializeMonth('2026-07', p.memos))
  A.deepEqual(p2.memos, p.memos, 'EOF 边界二次往返稳定')
}
{
  const tricky = T.serializeMonth('2026-06', [{ ts: '2026-06-01T04:00:00.000Z', text: '正文里有一行\n### 不是时间戳的三号标题\n仍属于本条', pinned: false, archived: false }])
  const p = T.parseMonth(tricky)
  A.equal(p.memos.length, 1, '### 后不是 ISO 时间戳的行不算分界')
  A.ok(p.memos[0].text.includes('### 不是时间戳的三号标题'), '该行保留在正文里')
}

// ── Amadeus 块标记 <!-- a N -->(宿主 markers.ts 的 BLOCK_MARKER_RE 同款):
//    月文件被 Amadeus 编辑器采纳后,尾随标记行不许吃掉哨兵、往返必须逐字节、写回不许破坏宿主块结构 ──
const BLOCK_MARKER_RE = /^<!--\s*a\s+([A-Za-z0-9_-]+)\s*-->\s*$/
{
  // 单块收编 + 末尾追加空块(在 Amadeus 里点「＋」/拖文件后的真实形态)
  const doc = ['---', 'amadeus_page: pg1', 'amadeus_schema: 3', '---', '', '<!-- a 1 -->', '',
    '# 2026-08', '', '### 2026-08-01T09:12:33.000Z', '置顶的 #forsion ⚑pin', '',
    '### 2026-08-03T01:00:00.000Z', '这条归档了 ⌫arch', '', '<!-- a 2 -->', ''].join('\n')
  const p = T.parseMonth(doc)
  A.equal(p.memos.length, 2)
  A.deepEqual([p.memos[0].pinned, p.memos[1].archived], [true, true], '尾随 <!-- a 2 --> 不吃掉 ⚑pin / ⌫arch 哨兵')
  A.equal(p.memos[1].text, '这条归档了', '哨兵与标记行都不进正文')
  A.equal(T.serializeMonth('2026-08', p.memos, p.preamble), doc, 'Amadeus 单块+空块形态往返逐字节')
  // 写回不破坏宿主块结构:置顶带尾标记的最后一条,哨兵必须落在内容行
  p.memos[1].pinned = true
  const out = T.serializeMonth('2026-08', p.memos, p.preamble)
  const markersOf = (s) => s.split('\n').filter((l) => BLOCK_MARKER_RE.test(l))
  A.deepEqual(markersOf(out), markersOf(doc), '写回后宿主可识别的块标记一个不少')
  A.ok(out.split('\n').every((l) => !l.includes('<!-- a') || BLOCK_MARKER_RE.test(l)), '绝不产出「<!-- a 2 --> ⚑pin」这种破坏 BLOCK_MARKER_RE 的行')
  A.ok(out.includes('这条归档了 ⚑pin ⌫arch\n\n<!-- a 2 -->'), '哨兵追加在最后一行非标记内容之后')
}
{
  // 逐段多块(粘贴 / agent 写入形态):标记行夹在每段身前身后
  const doc = ['<!-- a 1 -->', '', '# 2026-08', '', '<!-- a 2 -->', '', '### 2026-08-05T02:00:00.000Z', '',
    '<!-- a 3 -->', '', '逐段成块的一条 ⚑pin', '', '<!-- a 4 -->', ''].join('\n')
  const p = T.parseMonth(doc)
  A.equal(p.memos.length, 1)
  A.equal(p.memos[0].pinned, true, '逐段多块形态:⚑pin 仍被识别')
  A.equal(T.serializeMonth('2026-08', p.memos, p.preamble), doc, '逐段多块形态往返逐字节')
}
{
  // 自愈:旧版曾写坏成「<!-- a 2 --> ⚑pin」——解析仍认哨兵,写回时哨兵挪回内容行
  const broken = '# 2026-08\n\n### 2026-08-01T02:00:00.000Z\n旧版写坏的\n<!-- a 2 --> ⚑pin\n'
  const p = T.parseMonth(broken)
  A.deepEqual([p.memos[0].pinned, p.memos[0].text], [true, '旧版写坏的'], '写坏形态:哨兵照认、正文干净')
  const healed = T.serializeMonth('2026-08', p.memos, p.preamble)
  A.ok(healed.includes('旧版写坏的 ⚑pin\n<!-- a 2 -->'), '写回自愈:哨兵回到内容行,标记行恢复纯净')
}
{
  // 时间线展示:标记行不当正文渲染(文件里原样保留,只是不给用户看结构噪音)
  const box = mkEl('div')
  T.renderMemoText(box, '正文行\n<!-- a 3 -->\n下一行', null)
  A.ok(!box.textContent.includes('<!-- a'), '块标记行不出现在时间线正文里')
  A.ok(box.textContent.includes('正文行') && box.textContent.includes('下一行'), '正文行照常渲染')
}

// ── 删除某条后其余条完好 ──
{
  const a = { ts: '2026-05-01T04:00:00.000Z', text: '条A #a', pinned: false, archived: false }
  const b = { ts: '2026-05-02T04:00:00.000Z', text: '条B\n第二行', pinned: true, archived: false }
  const c = { ts: '2026-05-03T04:00:00.000Z', text: '条C ⚑不是哨兵开头', pinned: false, archived: true }
  const t3 = T.serializeMonth('2026-05', [a, b, c])
  const left = T.parseMonth(t3).memos.filter((m) => m.ts !== b.ts)
  const t4 = T.serializeMonth('2026-05', left)
  A.equal(left.length, 2)
  A.ok(!t4.includes('条B'), '被删条移除')
  A.ok(t4.includes(`### ${a.ts}\n条A #a`), '条A 节逐字完好')
  A.ok(t4.includes(`### ${c.ts}\n条C ⚑不是哨兵开头 ⌫arch`), '条C 节(含归档哨兵)逐字完好')
  A.deepEqual(T.parseMonth(t4).memos, [a, c].map((m) => ({ ...m })), '删除后再解析与原对象一致')
}

// ── 缓存:全量重建 == 增量结果 ──
{
  const ms = [
    { ts: '2026-08-01T04:00:00.000Z', text: 'x #a #b', pinned: false, archived: false },
    { ts: '2026-08-01T05:00:00.000Z', text: 'y #a', pinned: false, archived: true },
    { ts: '2026-08-03T04:00:00.000Z', text: 'z #中文', pinned: true, archived: false },
    { ts: '2026-08-01T18:30:00.000Z', text: '跨午夜 #a', pinned: false, archived: false },
  ]
  const full = T.cacheFromMemos(ms)
  const inc = ms.reduce((c2, m) => T.bumpCacheObj(c2, m), { days: {}, tags: {}, total: 0, builtAt: 0 })
  A.deepEqual({ days: full.days, tags: full.tags, total: full.total }, { days: inc.days, tags: inc.tags, total: inc.total }, '增量与全量一致')
  A.equal(full.days['2026-08-01'], 2)
  A.equal(full.days['2026-08-02'], 1, '跨午夜条记入本地日')
  A.equal(full.tags.a, 3); A.equal(full.tags['中文'], 1); A.equal(full.total, 4)
}

// ── 每日回顾:seed 稳定性 + 资格边界 ──
{
  const corpus = []
  for (let i = 0; i < 30; i++) {
    corpus.push({ ts: new Date(NOW - (8 + i * 2) * 86400000).toISOString(), text: `想法 ${i}`, pinned: false, archived: i % 9 === 0 })
  }
  const today = '2026-08-06'
  const elig = T.reviewEligible(corpus, today)
  A.ok(elig.every((m) => !m.archived), '归档条不进回顾')
  const b7 = { ts: '2026-07-30T04:00:00.000Z', text: '恰好 7 天前', pinned: false, archived: false }
  const b6 = { ts: '2026-07-31T04:00:00.000Z', text: '6 天前', pinned: false, archived: false }
  A.equal(T.reviewEligible([b7, b6], today).length, 1, '恰 7 天算「更早」,6 天不算')
  A.equal(T.reviewEligible([b7, b6], today)[0].ts, b7.ts)
  const p1 = T.pickReview(elig, T.seedOfDay(today), 4).map((m) => m.ts)
  const p2 = T.pickReview(elig, T.seedOfDay(today), 4).map((m) => m.ts)
  A.deepEqual(p1, p2, '同日同 seed 结果稳定')
  A.equal(p1.length, 4)
  const picksByDay = new Set()
  for (const d of ['2026-08-06', '2026-08-07', '2026-08-08', '2026-08-09', '2026-08-10']) {
    picksByDay.add(T.pickReview(elig, T.seedOfDay(d), 4).map((m) => m.ts).join('|'))
  }
  A.ok(picksByDay.size >= 2, '跨日 seed 变化应带来不同选卡')
  A.equal(T.pickReview(elig, T.seedOfDay(today), 999).length, elig.length, 'count 超量取全部')
  A.equal(T.pickReview([], 123, 4).length, 0, '空集合安全')
}

// ── 周整理:语料规则 + 指令 + digest 块解析 ──
{
  const mk = (daysAgo, i) => ({ ts: new Date(NOW - daysAgo * 86400000).toISOString(), text: `memo ${i}`, pinned: false, archived: false })
  const few = [mk(1, 0), mk(2, 1), mk(30, 2), { ...mk(3, 3), archived: true }]
  const corpus = T.digestCorpus(few, '2026-08-06')
  A.ok(corpus.every((m) => !m.archived), '归档条不进语料')
  A.equal(corpus.length, 3, '近 7 天不足 50 → 取全库最近 50(此处全部 3 条)')
  const many = []
  for (let i = 0; i < 60; i++) many.push(mk((i % 6) + 1, i))
  A.equal(T.digestCorpus(many, '2026-08-06').length, 60, '近 7 天 ≥50 → 全取近 7 天')
  const msg = T.buildDigestMessage([{ ts: '2026-08-03T02:11:05.000Z', text: '第一行\n第二行' }], '2026-W32')
  A.ok(msg.includes('```digest'), '指令要求 digest 代码块')
  A.ok(msg.includes('[2026-08-03T02:11:05.000Z]'), '语料带时间戳')
  A.ok(msg.includes('Cluster the memos by theme'), '模型侧指令是英文')
  A.ok(msg.includes('2026-W32'))
  A.equal(T.parseDigest('杂讯\n```digest\n## 主题\n- 要点\n```\n尾巴'), '## 主题\n- 要点\n', '解析 digest 块')
  A.equal(T.parseDigest('没有块'), null)
  A.equal(
    T.parseDigest('```digest\n## 主题\n- 要点\n\n```js\nconst x = 1\n```\n更多要点\n```'),
    '## 主题\n- 要点\n\n```js\nconst x = 1\n```\n更多要点\n',
    'digest 正文里嵌代码围栏不截断(贪婪到最后一个围栏,绝不静默丢半份周整理)'
  )
}

// ── XSS:恶意字符串走渲染器后无元素/属性注入 ──
{
  const box = mkEl('div')
  T.renderMemoText(box, '闪念 <img src=x onerror=alert(1)> #tag1 https://x.com javascript:alert(2)', () => {})
  A.equal(byTag(box, 'img').length, 0, '绝不能创建 img 元素')
  A.equal(anyAttr(box, 'onerror'), false, '绝不能设 onerror 属性')
  A.ok(box.textContent.includes('<img') && box.textContent.includes('onerror'), '恶意 HTML 变字面文字')
  const tags = findAll(box, (c) => c.className === 'mf-tag')
  A.equal(tags.length, 1); A.equal(tags[0].textContent, '#tag1', '标签渲染成可点 chip')
  const links = byTag(box, 'a')
  A.equal(links.length, 1)
  const box2 = mkEl('div')
  T.renderMemoText(box2, '看 a.com/#frag 和 https://x.com/#y 再 #设计,下周 #123', () => {})
  A.deepEqual(findAll(box2, (c) => c.className === 'mf-tag').map((c) => c.textContent), ['#设计'], '渲染的标签识别与解析同口径')
  A.equal(box2.textContent, '看 a.com/#frag 和 https://x.com/#y 再 #设计,下周 #123', '切开渲染不丢任何一个字符')
  A.equal(byTag(box2, 'a')[0].attrs.href, 'https://x.com/#y', '链接里的 # 留在链接里')
  A.equal(links[0].attrs.href, 'https://x.com', 'https 链接放行')
  A.equal(T.safeHref('javascript:alert(1)'), '', 'javascript: 拒绝')
}

// ── 落库:addMemo → 月文件 + 缓存 + firstMonth + 成就 + 活动日志 ──
{
  await T.addMemo('测试第一条 #tag1 #123')
  const monthText = V.get('闪念盒/2026-08.md')
  A.ok(monthText, '月文件写入 <workFolder>/YYYY-MM.md')
  A.ok(monthText.startsWith('# 2026-08\n'), '月头')
  A.ok(monthText.includes('### 2026-08-06T04:00:00.000Z'), '冻钟 ISO 时间戳节')
  A.ok(monthText.includes('测试第一条 #tag1 #123'))
  A.equal(_ls.get('plugin.memoflow.firstMonth'), '2026-08', '首次写入记 firstMonth')
  const cache = JSON.parse(V.get('闪念盒/.memoflow-cache.json'))
  A.equal(cache.days['2026-08-06'], 1)
  A.equal(cache.tags.tag1, 1)
  A.equal(cache.tags['123'], undefined, '#123 不进标签缓存')
  A.equal(cache.total, 1)
  A.ok(reg.tracks.includes('capture'), '成就 capture 埋点')
  A.ok(reg.activity.find(([e]) => e === 'capture'), '活动日志 capture')
}
// 快速命令(状态栏同源):prompt → 落库
{
  promptReply = '快速一条 #quick'
  await T.quickCapture()
  promptReply = null
  A.ok(V.get('闪念盒/2026-08.md').includes('快速一条 #quick'), 'quickCapture 落库')
  const cache = JSON.parse(V.get('闪念盒/.memoflow-cache.json'))
  A.equal(cache.total, 2, '缓存增量更新')
}
// P0 写前防线:月文件瞬时读失败(宿主折叠成 null)→ 拒写报错,绝不整月覆写
{
  const monthP = '闪念盒/2026-08.md'
  const before = V.get(monthP)
  failRead = (p) => p === monthP
  let rejected = null
  try { await T.addMemo('这条不该写进去') } catch (e) { rejected = e }
  failRead = null
  A.ok(rejected, '读失败 + 会话/缓存证明本月有数据 → addMemo 必须拒写')
  A.ok(String(rejected && rejected.message).includes('取消写入'), '错误信息说明防覆盖取消')
  A.equal(V.get(monthP), before, '月文件一字未动(整月数据未被覆写)')
  await T.addMemo('恢复后正常追加')
  const after = V.get(monthP)
  A.ok(after.includes('测试第一条') && after.includes('快速一条') && after.includes('恢复后正常追加'), '恢复后旧条完好、新条追加')
}
// 并发落库:写队列串行,先写者不被覆盖;同毫秒 ts 逐毫秒顺延保唯一(ts 是身份键)
{
  await Promise.all([T.addMemo('并发A #dual'), T.addMemo('并发B #dual')])
  const txt = V.get('闪念盒/2026-08.md')
  A.ok(txt.includes('并发A') && txt.includes('并发B'), '并发两条都落库,无一丢失')
  const pm = T.parseMonth(txt)
  A.equal(new Set(pm.memos.map((m) => m.ts)).size, pm.memos.length, '同毫秒并发 ts 唯一化')
}
// 前言保全(写路径集成):用户在月文件首节前加的 frontmatter/导语,落库后原样还在
{
  const monthP = '闪念盒/2026-08.md'
  V.set(monthP, '---\namadeus_next_id: 7\n---\n手写导语一行\n\n' + V.get(monthP))
  await T.addMemo('前言保全测试')
  const txt = V.get(monthP)
  A.ok(txt.startsWith('---\namadeus_next_id: 7\n---\n手写导语一行\n\n# 2026-08'), '首节前 frontmatter/导语逐字保留')
  A.ok(txt.includes('前言保全测试') && txt.includes('测试第一条'), '新旧条都在')
}
// 转笔记:整理/<日期>-<首行截断>.md + 来源时间戳
{
  const memo = { ts: '2026-08-05T04:00:00.000Z', text: '值得沉淀的想法 #keep\n第二行', pinned: false, archived: false }
  const p = await T.memoToNote(memo)
  A.equal(p, '闪念盒/整理/2026-08-05-值得沉淀的想法 _keep.md', '路径 = 整理/<日期>-<首行截断>(# 被清洗)')
  A.ok(V.get(p).includes('> 来源:闪念盒 2026-08-05T04:00:00.000Z'), '带来源时间戳')
  A.ok(V.get(p).includes('第二行'), '全文保留')
  // 同日同首行再转一次:不覆写既有笔记,追加 -2 序号
  const memo2 = { ts: '2026-08-05T05:00:00.000Z', text: '值得沉淀的想法 #keep\n另一条同首行', pinned: false, archived: false }
  const p2 = await T.memoToNote(memo2)
  A.equal(p2, '闪念盒/整理/2026-08-05-值得沉淀的想法 _keep-2.md', '同名探测 → -2 序号')
  A.ok(V.get(p).includes('第二行') && V.get(p2).includes('另一条同首行'), '两份笔记各自完好,先者未被覆写')
}

// ── 挂载视图(新宿主):时间线 / 回顾条 / 热力图 / 语音按钮 / XSS ──
{
  _ls.set('plugin.memoflow.firstMonth', '2026-07')
  const julyLines = ['# 2026-07', '']
  for (let i = 0; i < 10; i++) {
    julyLines.push(`### 2026-07-${String(10 + i).padStart(2, '0')}T02:00:00.000Z`, `回顾素材 ${i} #旧`, '')
  }
  V.set('闪念盒/2026-07.md', julyLines.join('\n'))
  const cur = V.get('闪念盒/2026-08.md')
  V.set('闪念盒/2026-08.md', cur + [
    '### 2026-08-05T10:00:00.000Z', 'XSS 尝试 <img src=x onerror=alert(1)> #安全', '',
    '### 2026-08-05T11:00:00.000Z', '置顶的 ⚑pin', '',
    '### 2026-08-05T12:00:00.000Z', '归档的 ⌫arch', '',
  ].join('\n'))
  const view = reg.views.find((v) => v.id === 'memos')
  const mountEl = mkEl('div')
  const cleanup = view.mount(mountEl)
  await sleep(40)
  A.equal(byTag(mountEl, 'img').length, 0, '时间线无 img 注入')
  A.equal(anyAttr(mountEl, 'onerror'), false, '时间线无 onerror 属性')
  A.ok(mountEl.textContent.includes('<img'), '恶意串以字面文字展示')
  const memosShown = byAttr(mountEl, 'data-memo')
  A.ok(memosShown.length >= 4, `时间线渲染条目(见 ${memosShown.length} 条,归档默认隐藏)`)
  A.ok(mountEl.textContent.includes('置顶'), '置顶分组/徽标可见')
  A.ok(!mountEl.textContent.includes('归档的 ⌫arch'), '哨兵不外漏')
  const reviewCards = byAttr(mountEl, 'data-review')
  A.ok(reviewCards.length >= 1 && reviewCards.length <= 4, `每日回顾条出现(${reviewCards.length} 卡)`)
  A.ok(byAttr(mountEl, 'data-voice').length === 1, '语音桥在场 → 语音按钮渲染')
  const sideEl = mkEl('div')
  const sideOff = reg.views.find((v) => v.id === 'activity').mount(sideEl)
  await sleep(10)
  const cells = findAll(sideEl, (c) => c.attrs && /^\d{4}-\d{2}-\d{2} · \d+ 条$/.test(c.attrs.title || ''))
  A.equal(cells.length, 84, '热力图进右栏:12 周 × 7 天,格子 title=日期+条数')
  A.ok(cells.some((c) => c.attrs.title === '2026-08-06 · 6 条'), '今天格子计数正确')
  A.ok(!findAll(mountEl, (c) => /mf-cell/.test(c.className || '')).length, '主区不再放热力图')
  sideOff()

  // ── 每日回顾同日冻结:处理动作缩小池子也不重抽,绝不引入没见过的新卡 ──
  {
    const cardsOf = () => byAttr(mountEl, 'data-review')
    const textOf = (c) => findAll(c, (x) => x.className === 'mf-rtext')[0].textContent
    const topCard = () => cardsOf().find((c) => !c.attrs['aria-hidden'])
    const leftOf = () => Number(/还剩 (\d+) 张/.exec(findAll(topCard(), (x) => x.className === 'mf-rdate')[0].textContent)[1])
    A.equal(cardsOf().filter((c) => !c.attrs['aria-hidden']).length, 1, '牌堆一次只露一张')
    A.equal(findAll(cardsOf().find((c) => c.attrs['aria-hidden']), (c) => c.tag === 'button').length, 0, '垫在后面的牌没有按钮')
    // 冻结判据:今天的卡固定是 pickReview 这 4 条,处理动作绝不重抽
    const pool = T.reviewEligible([...T.parseMonth(V.get('闪念盒/2026-07.md')).memos, ...T.parseMonth(V.get('闪念盒/2026-08.md')).memos], '2026-08-06')
    const frozen = T.pickReview(pool, T.seedOfDay('2026-08-06'), 4).map((m) => m.text)
    const left0 = leftOf(), first = textOf(topCard())
    A.ok(left0 >= 2, `冻结测试需要 ≥2 张卡(见 ${left0})`)
    const arcBtn = findAll(topCard(), (c) => c.tag === 'button' && c.textContent === '归档')[0]
    arcBtn.listeners.click[0]()
    await sleep(40)
    A.equal(leftOf(), left0 - 1, '处理一张后只少这一张(不重抽补位)')
    A.ok(cardsOf().map(textOf).every((t2) => frozen.includes(t2)), '同日回顾卡冻结:绝不引入没见过的新卡')
    A.ok(!cardsOf().map(textOf).includes(first), '被归档的卡不再显示')
  }

  // ── Enter 通道:IME 合成态不发送;双 Enter 重入闸只落一条 ──
  {
    const ta = findAll(mountEl, (c) => c.tag === 'textarea')[0]
    const kd = ta.listeners.keydown[0]
    ta.value = 'IME 半截拼音'
    kd({ key: 'Enter', shiftKey: false, isComposing: true, preventDefault() {} })
    kd({ key: 'Enter', shiftKey: false, keyCode: 229, preventDefault() {} })
    await sleep(30)
    A.ok(!V.get('闪念盒/2026-08.md').includes('IME 半截拼音'), 'IME 合成态 Enter 不发送')
    ta.value = '回车正常发送'
    kd({ key: 'Enter', shiftKey: false, preventDefault() {} })
    await sleep(30)
    A.ok(V.get('闪念盒/2026-08.md').includes('回车正常发送'), '非合成态 Enter 正常发送')
    ta.value = '双击回车只此一条'
    kd({ key: 'Enter', shiftKey: false, preventDefault() {} })
    kd({ key: 'Enter', shiftKey: false, preventDefault() {} })
    await sleep(30)
    const cnt = V.get('闪念盒/2026-08.md').split('双击回车只此一条').length - 1
    A.equal(cnt, 1, '双 Enter 重入闸:只落一条')
  }

  // ── 视图变更 × 并发落库:persistMonth 与 addMemo 同队列且回灌磁盘新条,先写者不被覆盖 ──
  {
    const pinnedBefore = T.parseMonth(V.get('闪念盒/2026-08.md')).memos.filter((m) => m.pinned).length
    const pinBtn = findAll(mountEl, (c) => c.tag === 'button' && c.textContent === '置顶')[0]
    A.ok(pinBtn, '时间线上有可置顶的行')
    const pAdd = T.addMemo('并发期间落的一条') // 模拟状态栏 quickCapture 与视图操作同时发生
    pinBtn.listeners.click[0]()
    await pAdd
    await sleep(40)
    const after = T.parseMonth(V.get('闪念盒/2026-08.md'))
    A.equal(after.memos.filter((m) => m.pinned).length, pinnedBefore + 1, '置顶已生效')
    A.ok(after.memos.some((m) => m.text === '并发期间落的一条'), '并发落库的一条未被视图全月写覆盖')
  }

  // ── 外部写入 × 视图变更:另一窗口/agent 直写月文件(无总线通知,store 陈旧),
  //    变更以磁盘为基按 ts 重放 → 外部新条不被覆没 ──
  {
    const monthP = '闪念盒/2026-08.md'
    const pinnedBefore = T.parseMonth(V.get(monthP)).memos.filter((m) => m.pinned).length
    V.set(monthP, V.get(monthP) + ['### 2026-08-06T05:59:59.000Z', '外部落的一条', ''].join('\n'))
    const pinBtn = findAll(mountEl, (c) => c.tag === 'button' && c.textContent === '置顶')[0]
    A.ok(pinBtn, '时间线上还有可置顶的行')
    pinBtn.listeners.click[0]()
    await sleep(40)
    const after = T.parseMonth(V.get(monthP))
    A.equal(after.memos.filter((m) => m.pinned).length, pinnedBefore + 1, '置顶已生效(外部写入场景)')
    A.ok(after.memos.some((m) => m.text === '外部落的一条'), '磁盘上已有而 store 未及回灌的新条不被覆没')
  }

  // ── 视图变更的缓存走增量补丁,绝不由 store 全量重建(P0 链条的另一半):
  //    先给缓存塞一笔 store 里不存在的「旁月」账,删除一条后旁月账必须原样还在 ──
  {
    const cacheP = '闪念盒/.memoflow-cache.json'
    const c0 = JSON.parse(V.get(cacheP))
    c0.days['2025-01-01'] = 3
    c0.total += 3
    V.set(cacheP, JSON.stringify(c0))
    promptReply = 'y'
    const delBtn = findAll(mountEl, (c) => c.tag === 'button' && c.textContent === '删除')[0]
    A.ok(delBtn, '时间线上有可删的行')
    delBtn.listeners.click[0]()
    await sleep(40)
    promptReply = null
    const c1 = JSON.parse(V.get(cacheP))
    A.equal(c1.days['2025-01-01'], 3, '不在 store 里的旁月计数原样保留(增量补丁,绝不全量重算掉证词)')
    A.equal(c1.total, c0.total - 1, '删除一条后缓存 total 恰减 1')
  }

  // ── P1 回归:瞬时读失败窗口内的视图变更必须拒改,绝不用陈旧 store 整月重写覆没外部新条 ──
  {
    const monthP = '闪念盒/2026-08.md'
    V.set(monthP, V.get(monthP) + ['### 2026-08-06T06:30:00.000Z', '外部新条(读失败窗口)', ''].join('\n'))
    const before = V.get(monthP)
    const notesBefore = reg.notes.length
    failRead = (p) => p === monthP
    const pinBtn = findAll(mountEl, (c) => c.tag === 'button' && c.textContent === '置顶')[0]
    A.ok(pinBtn, '时间线上有可置顶的行(读失败窗口)')
    pinBtn.listeners.click[0]()
    await sleep(40)
    failRead = null
    A.equal(V.get(monthP), before, '读失败窗口内置顶:月文件一字未动,外部新条未被覆没')
    A.ok(reg.notes.slice(notesBefore).some(([m]) => String(m).includes('取消')), '拒改有用户可见的报错')
  }
  // 月文件被外部删除:变更同样拒改,绝不用陈旧 store 凭空重建整月
  {
    const monthP = '闪念盒/2026-08.md'
    const before = V.get(monthP)
    V.delete(monthP)
    const pinBtn = findAll(mountEl, (c) => c.tag === 'button' && c.textContent === '置顶')[0]
    pinBtn.listeners.click[0]()
    await sleep(40)
    A.ok(!V.has(monthP), '月文件缺席:置顶拒改,不得用陈旧 store 重建整月')
    V.set(monthP, before) // 恢复现场
  }

  // ── 语音:点击模式(快抬起)光标移出不误停;按住模式滑出仍停 ──
  {
    navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop() {} }] })
    const vb = byAttr(mountEl, 'data-voice')[0]
    const fire = (type, ev) => { for (const f of vb.listeners[type] || []) f(ev || {}) }
    fire('pointerdown', { preventDefault() {} })
    await sleep(10)
    A.ok(vb.textContent.includes('结束录音'), '点击开始录音')
    fire('pointerup') // 快速抬起(<400ms)= 点击模式
    A.ok(vb.textContent.includes('结束录音'), '点击模式:快速抬起不结束')
    NOW += 1000
    fire('pointerleave') // 关键回归:点击模式下光标移出按钮,录音必须继续
    A.ok(vb.textContent.includes('结束录音'), '点击模式:pointerleave 不误停录音')
    fire('pointerdown', { preventDefault() {} }) // 第二次点击 = 结束
    await sleep(10)
    A.ok(!vb.textContent.includes('结束录音'), '第二次点击结束录音')
    fire('pointerup')
    // 按住说话:≥400ms 后滑出按钮 → 结束(原有兜底不丢)
    fire('pointerdown', { preventDefault() {} })
    await sleep(10)
    A.ok(vb.textContent.includes('结束录音'), '按住开始录音')
    NOW += 1000
    fire('pointerleave')
    A.ok(!vb.textContent.includes('结束录音'), '按住模式滑出按钮 → 结束录音')
  }

  // ── P2 回归:MediaRecorder 构造抛出 → 已到手的麦克风流必须停、按钮复位、错误可见 ──
  {
    const vb = byAttr(mountEl, 'data-voice')[0]
    const fire = (type, ev) => { for (const f of vb.listeners[type] || []) f(ev || {}) }
    let stopped = 0
    navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop() { stopped += 1 } }] })
    const RealMR = globalThis.MediaRecorder
    globalThis.MediaRecorder = class BadMR { constructor() { throw new Error('NotSupportedError (mock)') } }
    fire('pointerdown', { preventDefault() {} })
    await sleep(10)
    globalThis.MediaRecorder = RealMR
    A.equal(stopped, 1, '构造抛出:麦克风流当场停掉(不许指示灯亮到窗口关闭)')
    A.ok(!vb.textContent.includes('结束录音') && !vb.disabled, '构造抛出:按钮复位可再试,不卡「结束录音」')
    A.ok(mountEl.textContent.includes('录音器启动失败'), '构造抛出:错误对用户可见')
    fire('pointerup')
  }

  A.equal(typeof cleanup, 'function', 'mount 返回清理函数')
  cleanup()
}

dispose()

// ── P0 第二道证词:全新会话(无内存计数)仅凭派生缓存也要拒写 ──
{
  const V3 = new Map()
  V3.set('闪念盒/.memoflow-cache.json', JSON.stringify({ days: { '2026-08-01': 2 }, tags: {}, total: 2, builtAt: 1 }))
  const ctx4 = {
    registerView() {}, registerCommand() {}, registerSetting() {},
    app: {
      notify() {},
      readFile: async (p) => { if (p === '闪念盒/2026-08.md') throw new Error('EBUSY (mock)'); return V3.has(p) ? V3.get(p) : null },
      writeFile: async (p, t) => V3.set(p, String(t)),
      openFile() {},
      workFolder: () => '闪念盒',
    },
  }
  globalThis.__MEMOFLOW_TEST__ = {}
  const dispose4 = new Function('ctx', src)(ctx4)
  let rejected = null
  try { await globalThis.__MEMOFLOW_TEST__.addMemo('新会话也不该覆写') } catch (e) { rejected = e }
  A.ok(rejected && String(rejected.message).includes('取消写入'), '新会话仅凭缓存证词也拒写')
  A.ok(!V3.has('闪念盒/2026-08.md'), '月文件未被创建/覆写')
  dispose4()
}

// ── P0 第一道防线:月文件读失败本身即拒写(缓存也读不到、无会话记忆,证词全缺时防线仍在)──
{
  const V8 = new Map()
  const AUG8 = '闪念盒/2026-08.md'
  const before8 = '# 2026-08\n\n### 2026-08-01T02:00:00.000Z\n仅存的一条\n'
  V8.set(AUG8, before8)
  const ctx8 = {
    registerView() {}, registerCommand() {}, registerSetting() {},
    app: {
      notify() {},
      readFile: async () => { throw new Error('EBUSY (mock)') }, // 月文件与缓存同抖(同一次 IO 故障)
      writeFile: async (p, t) => V8.set(p, String(t)),
      openFile() {},
      workFolder: () => '闪念盒',
    },
  }
  globalThis.__MEMOFLOW_TEST__ = {}
  const dispose8 = new Function('ctx', src)(ctx8)
  let rejected = null
  try { await globalThis.__MEMOFLOW_TEST__.addMemo('IO 全抖动也不该覆写') } catch (e) { rejected = e }
  A.ok(rejected && String(rejected.message).includes('取消写入'), '读失败本身即拒写(不依赖任何证词)')
  A.equal(V8.get(AUG8), before8, 'IO 全抖动:月文件一字未动')
  dispose8()
}

// ── P0 证词分支:折叠宿主(读失败也返回 null,没有抛错信号)→ 仅凭派生缓存证词仍拒写 ──
{
  const V7 = new Map()
  V7.set('闪念盒/.memoflow-cache.json', JSON.stringify({ days: { '2026-08-01': 2 }, tags: {}, total: 2, builtAt: 1 }))
  const ctx7 = {
    registerView() {}, registerCommand() {}, registerSetting() {},
    app: {
      notify() {},
      readFile: async (p) => (p === '闪念盒/2026-08.md' ? null : (V7.has(p) ? V7.get(p) : null)),
      writeFile: async (p, t) => V7.set(p, String(t)),
      openFile() {},
      workFolder: () => '闪念盒',
    },
  }
  globalThis.__MEMOFLOW_TEST__ = {}
  const dispose7 = new Function('ctx', src)(ctx7)
  let rejected = null
  try { await globalThis.__MEMOFLOW_TEST__.addMemo('折叠宿主也不该覆写') } catch (e) { rejected = e }
  A.ok(rejected && String(rejected.message).includes('取消写入'), '折叠宿主(读失败=null):缓存证词单独扛住,仍拒写')
  A.ok(!V7.has('闪念盒/2026-08.md'), '月文件未被创建/覆写(折叠宿主)')
  dispose7()
}

// ── P0 链条回归 A:缓存文件瞬时读失败 → ensureCacheFile 绝不播种空缓存覆写第二道证词 ──
{
  const V5 = new Map()
  const CACHE5 = '闪念盒/.memoflow-cache.json'
  const cacheBefore = JSON.stringify({ days: { '2026-08-01': 6 }, tags: { x: 1 }, total: 6, builtAt: 1 })
  V5.set(CACHE5, cacheBefore)
  V5.set('闪念盒/2026-08.md', '# 2026-08\n\n### 2026-08-01T02:00:00.000Z\n条1\n')
  let fail5 = (p) => p === CACHE5
  const reg5 = { views: [] }
  const ctx5 = {
    registerView: (v) => reg5.views.push(v), registerCommand() {}, registerSetting() {}, openView() {},
    app: {
      notify() {}, openFile() {}, workFolder: () => '闪念盒', prompt: async () => null,
      readFile: async (p) => { if (fail5 && fail5(p)) throw new Error('EBUSY (mock)'); return V5.has(p) ? V5.get(p) : null },
      writeFile: async (p, t) => V5.set(p, String(t)),
    },
  }
  _ls.set('plugin.memoflow.firstMonth', '2026-08')
  globalThis.__MEMOFLOW_TEST__ = {}
  const dispose5 = new Function('ctx', src)(ctx5)
  const el5 = mkEl('div')
  const cleanup5 = reg5.views[0].mount(el5)
  await sleep(40)
  fail5 = null
  A.equal(V5.get(CACHE5), cacheBefore, '缓存读失败时挂载视图:缓存文件一字未改(证词保住)')
  cleanup5(); dispose5()
}

// ── P0 链条回归 B(probe-witness 场景):当月读失败 → 先置顶别的月再 addMemo,
//    缓存证词不许被残缺 store 全量重建清零,当月文件必须一字未动 ──
{
  const V6 = new Map()
  const JUL6 = '闪念盒/2026-07.md', AUG6 = '闪念盒/2026-08.md', CACHE6 = '闪念盒/.memoflow-cache.json'
  V6.set(JUL6, ['# 2026-07', '', '### 2026-07-10T02:00:00.000Z', '七月条1', '', '### 2026-07-11T02:00:00.000Z', '七月条2', ''].join('\n'))
  const augLines = ['# 2026-08', '']
  for (let i = 1; i <= 6; i++) augLines.push(`### 2026-08-0${i}T02:00:00.000Z`, `八月条${i}`, '')
  V6.set(AUG6, augLines.join('\n'))
  V6.set(CACHE6, JSON.stringify({
    days: { '2026-07-10': 1, '2026-07-11': 1, '2026-08-01': 1, '2026-08-02': 1, '2026-08-03': 1, '2026-08-04': 1, '2026-08-05': 1, '2026-08-06': 1 },
    tags: {}, total: 8, builtAt: 1,
  }))
  const augBefore = V6.get(AUG6)
  let fail6 = (p) => p === AUG6
  const reg6 = { views: [], notes: [] }
  const ctx6 = {
    registerView: (v) => reg6.views.push(v), registerCommand() {}, registerSetting() {}, openView() {},
    notify: (m, o) => reg6.notes.push([m, o]),
    app: {
      notify() {}, openFile() {}, workFolder: () => '闪念盒', prompt: async () => null,
      readFile: async (p) => { if (fail6 && fail6(p)) throw new Error('EBUSY (mock)'); return V6.has(p) ? V6.get(p) : null },
      writeFile: async (p, t) => V6.set(p, String(t)),
    },
  }
  _ls.set('plugin.memoflow.firstMonth', '2026-07')
  globalThis.__MEMOFLOW_TEST__ = {}
  const dispose6 = new Function('ctx', src)(ctx6)
  const T6 = globalThis.__MEMOFLOW_TEST__
  const el6 = mkEl('div')
  const cleanup6 = reg6.views[0].mount(el6)
  await sleep(40)
  const pinBtn6 = findAll(el6, (c) => c.tag === 'button' && c.textContent === '置顶')[0]
  A.ok(pinBtn6, 'P0 链条:七月条目可置顶')
  pinBtn6.listeners.click[0]()
  await sleep(40)
  A.ok(V6.get(JUL6).includes('⚑pin'), '置顶已落七月文件(别的月读失败不牵连本月操作)')
  const cacheAfterPin = JSON.parse(V6.get(CACHE6))
  A.equal(Object.keys(cacheAfterPin.days).filter((k) => k.startsWith('2026-08-')).length, 6, '置顶别的月之后,当月证词仍在缓存里(绝不由残缺 store 全量重建)')
  let rejected6 = null
  try { await T6.addMemo('这条不该把八月覆写掉') } catch (e) { rejected6 = e }
  A.ok(rejected6 && String(rejected6.message).includes('取消写入'), '当月读失败:随手记仍被拒写')
  A.equal(V6.get(AUG6), augBefore, '当月文件一字未动(P0 链条闭环)')
  fail6 = null
  cleanup6(); dispose6()
}

// ── 旧版缓存:错标签要被重算掉,days 证词不能丢;月份读失败时一字不改 ──
{
  const CACHE = '闪念盒/.memoflow-cache.json', AUG = '闪念盒/2026-08.md'
  const mkCtx = (V, fail) => ({
    registerView() {}, registerCommand() {}, registerSetting() {},
    app: {
      notify() {}, openFile() {}, workFolder: () => '闪念盒',
      readFile: async (p) => { if (fail && fail(p)) throw new Error('EBUSY (mock)'); return V.has(p) ? V.get(p) : null },
      writeFile: async (p, t) => V.set(p, String(t)),
    },
  })
  const stale = JSON.stringify({ days: { '2026-08-01': 1, '2025-01-01': 3 }, tags: { '设计,下周再说': 1 }, total: 4, builtAt: 1 })
  _ls.set('plugin.memoflow.firstMonth', '2026-08')
  const V = new Map([[CACHE, stale], [AUG, '# 2026-08\n\n### 2026-08-01T02:00:00.000Z\n今天看了 #设计,下周再说\n']])
  globalThis.__MEMOFLOW_TEST__ = {}
  const d1 = new Function('ctx', src)(mkCtx(V, (p) => p.endsWith('2025-01.md') ? true : false))
  await globalThis.__MEMOFLOW_TEST__.upgradeCacheTags()
  A.equal(V.get(CACHE), stale, '旧缓存 + 有月份读失败:缓存一字不改,下次再试')
  d1()
  _ls.set('plugin.memoflow.firstMonth', '2026-08')
  globalThis.__MEMOFLOW_TEST__ = {}
  const d2 = new Function('ctx', src)(mkCtx(V))
  await globalThis.__MEMOFLOW_TEST__.upgradeCacheTags()
  const up = JSON.parse(V.get(CACHE))
  A.deepEqual(up.tags, { 设计: 1 }, '旧缓存的错标签被新规则重算掉')
  A.equal(up.v, 2, '升级后写上新版本号')
  A.deepEqual(up.days, { '2026-08-01': 1, '2025-01-01': 3 }, '只换 tags:days 证词原样保留(不由 loadAll 的残缺视野重算)')
  A.equal(up.total, 4, 'total 不动')
  A.equal(_ls.get('plugin.memoflow.firstMonth'), '2025-01', '缓存里更早的月份补进扫描起点')
  const body = V.get(AUG)
  A.ok(body.includes('今天看了 #设计,下周再说'), '升级不碰月文件正文')
  const after = V.get(CACHE)
  await globalThis.__MEMOFLOW_TEST__.upgradeCacheTags()
  A.equal(V.get(CACHE), after, '已是新版本:不重算不重写')
  d2()
}

// ── 旧宿主 A(有 registerView,但无 statusItem / transcribeAudio / achievements / notify / activity / workFolder):
//    setup 不抛 + 语音按钮不出现 + 空状态可见 ──
{
  delete globalThis.window
  const V2 = new Map()
  const reg2 = { views: [], commands: [], settings: [] }
  const ctx2 = {
    registerView: (v) => reg2.views.push(v),
    registerCommand: (c) => reg2.commands.push(c),
    registerSetting: (s) => reg2.settings.push(s),
    app: {
      notify() {},
      readFile: async (p) => (V2.has(p) ? V2.get(p) : null),
      writeFile: async (p, t) => V2.set(p, String(t)),
      openFile() {},
    },
  }
  globalThis.__MEMOFLOW_TEST__ = {}
  const dispose2 = new Function('ctx', src)(ctx2)
  A.equal(typeof dispose2, 'function', '旧宿主 A:setup 不抛且返回 disposer')
  A.equal(globalThis.__MEMOFLOW_TEST__.voiceAvailable(), false, '无语音桥 → voiceAvailable false')
  const mountEl = mkEl('div')
  const cleanup = reg2.views[0].mount(mountEl)
  await sleep(40)
  A.equal(byAttr(mountEl, 'data-voice').length, 0, '旧宿主语音按钮不渲染')
  A.ok(mountEl.textContent.includes('还没有闪念'), '空状态文案')
  A.ok(V2.has('闪念盒/.memoflow-cache.json'), '无 workFolder → 回退默认夹「闪念盒」')
  cleanup()
  dispose2()
  // 命令在缺 openView 的宿主上跑也不抛
  reg2.commands.find((c) => c.id === 'memoflow-open').run()
  reg2.commands.find((c) => c.id === 'memoflow-capture').run()
  await sleep(10)
}

// ── 旧宿主 B(07-18 后 API 全删,连 registerView 都没有):setup 不抛 ──
{
  const reg3 = { commands: [] }
  const ctx3 = {
    registerCommand: (c) => reg3.commands.push(c),
    registerSetting() {},
    app: { notify() {}, readFile: async () => null, writeFile: async () => {}, openFile() {} },
  }
  globalThis.__MEMOFLOW_TEST__ = {}
  const dispose3 = new Function('ctx', src)(ctx3)
  A.equal(typeof dispose3, 'function', '旧宿主 B:全删 07-18 后 API 仍不抛')
  A.equal(reg3.commands.length, 3, '命令照常注册')
  reg3.commands.find((c) => c.id === 'memoflow-open').run() // 无 openView → 提示降级,不抛
  dispose3()
}

// ── 双语(2026-08-14 起的 ctx.getLocale / subscribeLocale) ──────────────────
//   ① 词表两侧键集合完全相等(漏翻一条就红)
//   ② 宿主广播语言变更后,**同一个已挂载的视图元素**就地变成英文 —— 靠「下次打开才变」不算过
//     (这条是真机门禁 plugin-view.e2e.cjs 第 8 项在 node 里的等价预演)
{
  const V9 = new Map()
  let loc = 'zh'
  const localeSubs = new Set()
  const fireLocale = (l) => { for (const cb of [...localeSubs]) cb(l) }
  const reg9 = { views: [], status: [] }
  const ctx9 = {
    registerView: (v) => reg9.views.push(v), registerCommand() {}, registerSetting() {}, openView() {},
    registerStatusItem: (s) => { reg9.status.push(s); return { update: (patch) => Object.assign(s, patch), dispose() {} } },
    getLocale: () => loc,
    subscribeLocale: (cb) => { localeSubs.add(cb); return () => localeSubs.delete(cb) },
    app: {
      notify() {}, openFile() {}, workFolder: () => '闪念盒', prompt: async () => null,
      readFile: async (p) => (V9.has(p) ? V9.get(p) : null),
      writeFile: async (p, x) => V9.set(p, String(x)),
    },
  }
  globalThis.__MEMOFLOW_TEST__ = {}
  const dispose9 = new Function('ctx', src)(ctx9)
  const T9 = globalThis.__MEMOFLOW_TEST__

  // ① 词表形态
  A.ok(T9.MSG && T9.MSG.zh && T9.MSG.en, '应暴露 MSG 词表(zh + en)')
  const zhKeys = Object.keys(T9.MSG.zh).sort()
  const enKeys = Object.keys(T9.MSG.en).sort()
  A.deepEqual(enKeys, zhKeys, '双语词表:zh 与 en 的键集合必须完全相等')
  A.ok(zhKeys.length >= 60, `词表覆盖到位(见 ${zhKeys.length} 个键)`)
  A.deepEqual(zhKeys.filter((k) => !String(T9.MSG.en[k] || '').trim()), [], '英文侧不许有空串占位')
  A.deepEqual(zhKeys.filter((k) => /[一-鿿]/.test(String(T9.MSG.en[k]))), [], '英文侧不许残留中文')
  A.deepEqual(zhKeys.filter((k) => !String(T9.MSG.zh[k] || '').trim()), [], '中文侧不许有空串占位')
  // 占位符两侧必须同集合,否则英文串会漏渲染出 {n} 这种裸花括号
  const holders = (s) => String(s).match(/\{[a-zA-Z]+\}/g) || []
  A.deepEqual(
    zhKeys.filter((k) => holders(T9.MSG.zh[k]).sort().join(',') !== holders(T9.MSG.en[k]).sort().join(',')),
    [], '两侧占位符 {name} 集合一致',
  )
  A.equal(T9.L(), 'zh', 'getLocale 给 zh → L() 为 zh')

  // ② 切 en:同一个挂载元素就地变英文,不重挂
  const el9 = mkEl('div')
  const cleanup9 = reg9.views[0].mount(el9)
  await sleep(40)
  const zh9 = el9.textContent
  A.ok(zh9.includes('还没有闪念'), '默认中文:空状态文案是中文')
  A.ok(zh9.includes('记下') && zh9.includes('重建缓存'), '默认中文:按钮文案是中文')
  A.ok(localeSubs.size >= 1, '插件应订阅 ctx.subscribeLocale')
  loc = 'en'
  fireLocale('en')
  await sleep(20)
  const en9 = el9.textContent
  A.ok(en9.includes('No memos yet'), '切 en 后同一挂载元素就地变英文(空状态,视图未重挂)')
  A.ok(en9.includes('Capture') && en9.includes('Rebuild Cache') && en9.includes('AI Weekly Digest'),
    '切 en 后静态骨架(标题/按钮)也重画成英文')
  A.ok(!en9.includes('还没有闪念') && !en9.includes('重建缓存'), '英文界面不残留中文原串')
  const sb9 = reg9.status[0]
  A.ok(sb9 && !/[一-鿿]/.test(String(sb9.text)), '状态栏项能运行时更新(handle.update)→ 切 en 后不残留中文')
  // 语言退订:视图清理退一条,插件 disposer 退干净
  const afterMount = localeSubs.size
  cleanup9()
  A.equal(localeSubs.size, afterMount - 1, 'mount 清理函数退掉视图那条语言订阅')
  dispose9()
  A.equal(localeSubs.size, 0, '插件 disposer 退掉剩余语言订阅')
}

// ── 双语(二):zh→en→zh 回归 · 切语言不吃编辑框草稿 · 计数与列表分隔符按语言 ──────
//   上面那块只走到「切成英文」就收工,漏掉三类洞(1.1.1 复核点名,补在这里):
//   ① 单向漂移:切回中文必须**逐字**回到初始态,不能留下英文残渣或格式偏移;
//   ② 编辑框是每次 renderList 新建的元素 —— 若重画时回读磁盘原文,用户没保存的补充当场消失。
//      闪念没有回收站,而 README/CHANGELOG 明写「正在编辑的那条不会被打断」:这条断言就是那句
//      承诺的执行面,红了说明**文档在撒谎**,不是测试太严;
//   ③ 拼串本地化:英文句子里出现中文顿号、`1 memos` 这种复数错 —— 后者会跟着周整理抬头落进
//      磁盘长期留着,不是「界面小瑕」。
{
  A.ok(!/join\('、'\)/.test(src), '列表分隔符禁硬编码中文顿号(一律走词表 listSep / joinList)')
  const V10 = new Map()
  V10.set('闪念盒/2026-08.md', [
    '# 2026-08', '',
    '### 2026-08-05T04:00:00.000Z', '原始正文', '',
    '### 2026-08-05T05:00:00.000Z', '第二条', '',
  ].join('\n'))
  let loc = 'zh'
  const subs10 = new Set()
  const fireLocale = (l) => { loc = l; for (const cb of [...subs10]) cb(l) }
  const reg10 = { views: [] }
  const ctx10 = {
    registerView: (v) => reg10.views.push(v), registerCommand() {}, registerSetting() {}, openView() {},
    registerStatusItem: () => ({ update() {}, dispose() {} }),
    getLocale: () => loc,
    subscribeLocale: (cb) => { subs10.add(cb); return () => subs10.delete(cb) },
    app: {
      notify() {}, openFile() {}, workFolder: () => '闪念盒', prompt: async () => null,
      readFile: async (p) => (V10.has(p) ? V10.get(p) : null),
      writeFile: async (p, x) => V10.set(p, String(x)),
    },
  }
  globalThis.__MEMOFLOW_TEST__ = {}
  const dispose10 = new Function('ctx', src)(ctx10)
  const T10 = globalThis.__MEMOFLOW_TEST__
  const el10 = mkEl('div')
  const cleanup10 = reg10.views[0].mount(el10)
  await sleep(40)

  // ① zh → en → zh 逐字回归(切回来才算走完一个来回)
  const zhText0 = el10.textContent
  const phOf = () => findAll(el10, (c) => c.attrs && 'placeholder' in c.attrs).map((c) => c.attrs.placeholder)
  const ph0 = phOf()
  A.ok(zhText0.includes('原始正文') && zhText0.includes('第二条'), '中文界面渲染出两条闪念')
  A.ok(ph0.length >= 2, `placeholder 采到样本(见 ${ph0.length} 个)`)
  // 裸占位符扫描:词表改了占位符名(本版 {n}→{c})却漏改某个调用点时,界面会**照常渲染**、
  // 只是多出一个 "{c}" —— 不抛错、不变空白,靠肉眼和「英文无中文」都抓不到
  const leakScan = (label) => {
    const attrTxt = findAll(el10, (c) => c.attrs && ('title' in c.attrs || 'placeholder' in c.attrs))
      .map((c) => `${c.attrs.title || ''} ${c.attrs.placeholder || ''}`).join(' ')
    const hit = `${el10.textContent} ${attrTxt}`.match(/\{[a-zA-Z]+\}/g)
    A.equal(hit, null, `${label}:界面上不许出现没替换掉的裸占位符(见 ${hit ? hit.join(' ') : ''})`)
  }
  leakScan('中文界面')
  fireLocale('en')
  await sleep(20)
  A.ok(el10.textContent.includes('Capture') && !el10.textContent.includes('重建缓存'), '切 en 生效')
  leakScan('英文界面')
  fireLocale('zh')
  await sleep(20)
  A.equal(el10.textContent, zhText0, 'zh→en→zh:整棵视图逐字回到初始中文(无残渣、无单向漂移)')
  A.deepEqual(phOf(), ph0, 'zh→en→zh:placeholder 也逐字回中文')

  // ② 切语言不吃编辑框里没保存的字(整树重画 ≠ 丢草稿)
  const rowsOf = () => byAttr(el10, 'data-memo')
  const btnIn = (row, label) => findAll(row, (c) => c.tag === 'button' && c.textContent === label)[0]
  const rowWith = (s) => rowsOf().find((r) => r.textContent.includes(s))
  // 编辑中的那一行按「行内有 textarea」找:整树重画换掉元素、并发落库还会挪动行序,
  // 拿旧引用或旧下标必然失手(输入区那个 textarea 不在 memo 行里,不会误命中)。
  const edRow = () => rowsOf().find((r) => byTag(r, 'textarea').length > 0)
  const edNow = () => { const r = edRow(); return r ? byTag(r, 'textarea')[0] : null }
  A.ok(rowWith('原始正文') && rowWith('第二条'), '两条闪念各占一行')
  btnIn(rowWith('原始正文'), '编辑').listeners.click[0]()
  await sleep(20)
  A.ok(edNow(), '点「编辑」后行内出现编辑框')
  A.equal(edNow().value, '原始正文', '编辑框初值 = 磁盘原文')
  const DRAFT = '原始正文 —— 我正在写的一大段还没保存的补充'
  edNow().value = DRAFT
  edNow().listeners.input[0]()
  fireLocale('en')
  await sleep(20)
  A.ok(edNow(), '切语言后编辑框还开着(编辑态不被关掉)')
  A.equal(edNow().value, DRAFT, '切语言不吃编辑框草稿(README/CHANGELOG「正在编辑的那条不会被打断」的执行面)')
  // 总线重画(状态栏 quickCapture 落库触发 reloadMonth→renderAll)同样不许吃草稿
  await T10.addMemo('别处落的一条')
  await sleep(40)
  A.ok(edNow(), '并发落库后编辑框仍在')
  A.equal(edNow().value, DRAFT, '并发落库触发的整树重画同样不吃编辑框草稿')
  // 草稿真能存下去:此时界面是英文,按钮名 Save
  btnIn(edRow(), 'Save').listeners.click[0]()
  await sleep(40)
  A.ok(V10.get('闪念盒/2026-08.md').includes(DRAFT), '保存落盘的是草稿全文,不是被重画回读的磁盘原文')
  A.equal(edNow(), null, '保存后退出编辑态')

  // 换一条编辑 → 上一条的草稿必须作废(否则第二条的编辑框会带出上一条的字)
  fireLocale('zh')
  await sleep(20)
  btnIn(rowWith(DRAFT), '编辑').listeners.click[0]()
  await sleep(20)
  edNow().value = '这段不该跑到第二条里去'
  edNow().listeners.input[0]()
  btnIn(rowWith('第二条'), '编辑').listeners.click[0]()
  await sleep(20)
  A.equal(rowsOf().filter((r) => byTag(r, 'textarea').length > 0).length, 1, '同一时刻只有一条处于编辑态')
  A.equal(edNow().value, '第二条', '换一条编辑:上一条的草稿作废,不串味')
  btnIn(edRow(), '取消').listeners.click[0]()
  await sleep(20)
  A.equal(edNow(), null, '取消后退出编辑态')

  // ③ 计数与列表分隔符按语言取
  fireLocale('zh')
  A.equal(T10.nMemos(1), '1 条', '中文无复数:1 条')
  A.equal(T10.nMemos(2), '2 条', '中文无复数:2 条')
  A.equal(T10.nMonthFiles(1), '1 个月文件', '中文量词:个月文件')
  A.equal(T10.joinList(['2026-06', '2026-07']), '2026-06、2026-07', '中文列表用顿号')
  A.equal(
    T10.t('digestHead', { date: '2026-08-14', c: T10.nMemos(3) }),
    '> 由「闪念盒」AI 周整理生成 · 2026-08-14 · 覆盖 3 条闪念',
    '中文周整理抬头逐字未变(产物格式不因本地化重构漂移)',
  )
  fireLocale('en')
  A.equal(T10.nMemos(1), '1 memo', '英文单数不带 s')
  A.equal(T10.nMemos(2), '2 memos', '英文复数带 s')
  A.equal(T10.nMonthFiles(1), '1 month file', '英文单数:month file')
  A.equal(T10.nMonthFiles(2), '2 month files', '英文复数:month files')
  A.equal(T10.joinList(['2026-06', '2026-07']), '2026-06, 2026-07', '英文列表用逗号')
  // 中文标点用码点写死:直接把「,」打进字符类容易误敲成 ASCII 逗号,那条断言就恒真了
  const CJK_PUNCT = /[\u3001\u3002\uFF0C\uFF0E\uFF1A\uFF1B\uFF08\uFF09\u300C\u300D]/
  const warnEn = T10.t('monthsFailed', { c: T10.nMonthFiles(2), list: T10.joinList(['2026-06', '2026-07']) })
  A.ok(!CJK_PUNCT.test(warnEn), `英文告警不含中文标点:${warnEn}`)
  A.ok(warnEn.startsWith('2 month files could not be read (2026-06, 2026-07)'), `英文告警拼串正确:${warnEn}`)
  const refuseEn = T10.t('rebuildRefused', { c: T10.nMonthFiles(1), list: T10.joinList(['2026-06']) })
  A.ok(!CJK_PUNCT.test(refuseEn) && refuseEn.startsWith('1 month file could not be read'), `重建拒绝串英文单数正确:${refuseEn}`)
  // 这行会跟着周整理产物落盘长期留着 —— 英文单复数错在这里代价最大
  const headEn1 = T10.t('digestHead', { date: '2026-08-14', c: T10.nMemos(1) })
  A.ok(headEn1.endsWith('covering 1 memo'), `落盘的周整理抬头英文单数正确:${headEn1}`)
  A.ok(T10.t('digestHead', { date: '2026-08-14', c: T10.nMemos(9) }).endsWith('covering 9 memos'), '落盘的周整理抬头英文复数正确')
  for (const k of ['stats', 'heatCell', 'rebuildOk', 'digestHead', 'writeCanceledKnown', 'rebuildRefused', 'monthsFailed']) {
    A.ok(!/\{n\}/.test(String(T10.MSG.en[k])) && !/\{n\}/.test(String(T10.MSG.zh[k])),
      `计数串 ${k} 走 {c} 整短语,不许再留裸数字 {n}(英文会拼出 1 memos)`)
  }
  // 占位符 × 调用点静态对账:上面的 leakScan 只盖到视图里渲染得出来的串,
  // 告警/产物类(digestHead、writeCanceledKnown…)平时不上屏,漏改调用点要等用户踩
  const holdersOf = (s) => [...new Set(String(s).match(/\{[a-zA-Z]+\}/g) || [])].map((x) => x.slice(1, -1))
  const missing = []
  for (const k of Object.keys(T10.MSG.zh)) {
    const need = holdersOf(T10.MSG.zh[k])
    if (!need.length) continue
    const re = new RegExp(`t\\('${k}',\\s*\\{([^}]*)\\}`, 'g')
    let m
    while ((m = re.exec(src))) {
      for (const nm of need) {
        if (!new RegExp(`(^|[\\s,{])${nm}\\s*([:,]|$)`).test(m[1])) missing.push(`${k} 的调用点没给 {${nm}}`)
      }
    }
  }
  A.deepEqual(missing, [], 't() 字面调用点必须给齐词表里的占位符(缺一个就渲染出裸 {name},不抛错)')

  cleanup10()
  dispose10()
  A.equal(subs10.size, 0, '双语(二):语言订阅退干净')
}

// ══ 2.0 新宿主:左栏列表源 · 筛选 · 改名合并 · ChatBox · Mini · 手机 · 动效 ══════════════
function mkHost(o = {}) {
  const V = new Map(o.files || [])
  const reg = { views: [], lists: [], commands: [], notes: [], confirms: [], menus: [], writes: [], boxes: [], controls: [], heads: [], watch: new Map(), empty: [] }
  const fail = { read: o.failRead || null, write: null }
  const ui = o.ui === false ? undefined : {
    icon: (name) => { const s = mkEl('svg'); s.attrs['data-icon'] = name; return s },
    confirm: async (x) => { reg.confirms.push(x); return o.confirm !== false },
    contextMenu: (at, items) => { reg.menus.push({ at, items }); return { close() {} } },
    setViewHead: (el, opts) => { const h2 = { opts, actions: mkEl('div'), update() {}, dispose() { h2.gone = true } }; for (const a of opts.actions || []) h2.actions.appendChild(a); reg.heads.push(h2); return h2 },
    mountEmptyState: (el, opts) => { reg.empty.push(opts); const d = mkEl('div'); d.textContent = opts.title; el.appendChild(d); return { update() {}, dispose() { d.remove() } } },
    ...(o.control === false ? {} : { mountControl: (el, c) => { const h2 = { c, update(p) { Object.assign(c, p) }, dispose() {} }; reg.controls.push(h2); return h2 } }),
    ...(o.chatBox === 'new' ? { mountChatBox: (el, opts) => {
      const toolbar = mkEl('div'); el.appendChild(toolbar)
      if (opts.toolbar) opts.toolbar(toolbar)
      const b = { opts, toolbar, inserted: [], focused: 0, disposed: 0, update(p) { Object.assign(opts, p) }, focus() { b.focused += 1 }, dispose() { b.disposed += 1 }, insertText(s) { b.inserted.push(s) } }
      reg.boxes.push(b)
      return b
    } } : {}),
    ...(o.chatBox === 'old' ? { mountChatBox: (el, opts) => { const b = { opts, disposed: 0, update() {}, focus() {}, dispose() { b.disposed += 1 } }; reg.boxes.push(b); return b } } : {}),
  }
  const ctx = {
    registerView: (v) => reg.views.push(v), registerCommand: (c) => reg.commands.push(c), registerSetting() {},
    ...(o.list === false ? {} : { registerListSource: (s) => reg.lists.push(s) }),
    listCapabilities: o.caps === undefined ? ['tree', 'items', 'rename'] : o.caps,
    openView() {}, notify: (m, l) => reg.notes.push([m, l]), getLocale: () => o.locale || 'zh',
    ...(ui ? { ui } : {}),
    app: {
      notify() {}, openFile() {}, workFolder: () => '闪念盒',
      prompt: async () => o.prompt?.shift?.() ?? null,
      readFile: async (p) => { if (fail.read && fail.read(p)) throw new Error('EBUSY (mock)'); return V.has(p) ? V.get(p) : null },
      writeFile: async (p, t2) => { if (fail.write && fail.write(p)) throw new Error('ENOSPC (mock)'); V.set(p, String(t2)); reg.writes.push(p) },
      ...(o.watch ? { watchFile: (p, cb) => { reg.watch.set(p, cb); return () => reg.watch.delete(p) } } : {}),
    },
  }
  globalThis.__MEMOFLOW_TEST__ = {}
  const dispose = new Function('ctx', src)(ctx)
  return { V, reg, ctx, fail, T: globalThis.__MEMOFLOW_TEST__, dispose, view: (id) => reg.views.find((v) => v.id === id), list: () => reg.lists[0] }
}
const AUGP = '闪念盒/2026-08.md', CACHEP = '闪念盒/.memoflow-cache.json'
const mdOf = (...rows) => ['# 2026-08', '', ...rows.flatMap(([ts, x]) => [`### 2026-08-${ts}:00:00.000Z`, x, ''])].join('\n')
const TAGGED = mdOf(
  ['01T02', 'a 路线 #产品/路线图 #产品/用户'], ['02T02', 'b #产品'], ['03T02', 'c #设计 #产品'], ['04T02', 'd #Design/颜色'],
  ['05T02', 'e #workshop'], ['05T03', 'f 没标签'], ['05T04', '归档的 #产品/路线图 ⌫arch'],
)
_ls.set('plugin.memoflow.firstMonth', '2026-08')
_ls.delete('plugin.memoflow.reviewDone')

// ── 标签索引:按条去重、大小写折叠、显示最先出现的写法、归档不计 ──
{
  const H = mkHost()
  const idx = H.T.buildTagIndex(T.parseMonth(TAGGED).memos.filter((m) => !m.archived))
  A.equal(idx.nodes.get('产品').count, 3, '父标签 = 自身 + 子标签按条去重(同一条带两个子标签只算一次)')
  A.equal(idx.nodes.get('产品/路线图').count, 1)
  A.deepEqual(idx.roots[0].children.map((n) => n.name).sort(), ['用户', '路线图'].sort(), '子标签挂在父标签下')
  const ci = H.T.buildTagIndex([
    { ts: '2026-08-02T00:00:00.000Z', text: '#foo/Bar', archived: false }, { ts: '2026-08-01T00:00:00.000Z', text: '#Foo', archived: false },
  ])
  A.equal(ci.nodes.size, 2, '大小写折叠成一个节点')
  A.equal(ci.nodes.get('foo').path, 'Foo', '显示最先出现的写法(按时间)')
  A.equal(ci.nodes.get('foo').count, 2)
  H.dispose()
}

// ── 左栏列表源:树(parent + folder)/ 平铺回退 / 空库 / 搜索 ──
{
  const H = mkHost({ files: [[AUGP, TAGGED]] })
  const src = H.list()
  A.ok(src, '注册了左栏列表源')
  A.equal(src.items().length, 0, '没加载时给空:不写假数据')
  let pings = 0
  const off = src.subscribe(() => { pings += 1 })
  await sleep(30)
  A.ok(pings > 0, '加载完通知左栏')
  const rows = src.items()
  const by = (k) => rows.find((r) => r.key === k)
  A.deepEqual(rows.slice(0, 1).map((r) => r.key), ['nav:all'])
  A.ok(by('nav:archived'), '已归档进左栏')
  A.equal(by('folder:产品').kind, 'folder', '有子标签的是 folder')
  A.equal(by('folder:产品').hint, '3', 'hint 放计数')
  A.equal(by('tag:产品').parent, 'folder:产品', '父标签本身要有一行能点(folder 点了只开合)')
  A.equal(by('tag:产品/路线图').parent, 'folder:产品', '子标签 parent 指向父 folder')
  A.equal(by('tag:产品/路线图').title, '路线图', '树里只写最后一段')
  A.equal(by('folder:产品').group, H.T.t('navTags'), '顶层归到「标签」分区')
  A.equal(by('tag:产品/路线图').group, undefined, '子行不写 group')
  A.equal(by('tag:设计').kind, undefined, '没子标签的是普通行')
  A.equal(src.activeKey(), 'nav:all', '缺省高亮全部闪念')
  src.open(by('tag:产品'))
  A.equal(src.activeKey(), 'tag:产品', '点标签后高亮这一行')
  A.deepEqual(H.T.nav.tags, ['产品'], '左栏点 = 替换')
  src.open(by('nav:all'))
  const q = src.items({ query: '路线' })
  A.ok(q.every((r) => !r.parent && !r.kind), '搜索结果是平铺的')
  A.ok(q.some((r) => r.key === 'tag:产品/路线图' && r.title === '产品 / 路线图'), '搜索能搜到标签')
  A.ok(q.some((r) => r.key.startsWith('memo:')), '搜索能搜到闪念')
  A.ok(!q.some((r) => r.title.includes('归档的')), '搜索不含已归档')
  A.deepEqual(src.itemMenu({ key: 'nav:all' }), [], '导航行没有标签菜单')
  A.deepEqual(src.itemMenu(by('tag:设计')).map((a) => a.id), ['rename', 'merge'], '标签右键:改名、合并')
  A.deepEqual(src.itemMenu(by('folder:产品')).map((a) => a.id), ['filter', 'rename', 'merge'], 'folder 行另有筛选')
  off(); H.dispose()

  const old = mkHost({ files: [[AUGP, TAGGED]], caps: undefined === 0 ? [] : [], ui: false })
  const offOld = old.list().subscribe(() => {})
  await sleep(30)
  const flat = old.list().items()
  A.ok(flat.every((r) => !r.parent && !r.kind), '没有 tree 能力:不发 parent / folder')
  A.ok(flat.some((r) => r.title === '产品 / 路线图'), '平铺时写全路径')
  offOld(); old.dispose()

  const none = mkHost()
  const offNone = none.list().subscribe(() => {})
  await sleep(30)
  A.deepEqual(none.list().items(), [], '空库:左栏不写字,不带示例')
  A.ok(none.list().empty && typeof none.list().empty.title === 'function', '列表源给了 empty,文案跟语言走')
  A.equal(none.V.get(AUGP), undefined, '装好是空的:不写示例闪念')
  offNone(); none.dispose()
}

// ── 筛选:左栏替换 / 正文追加 / 清除;前缀匹配;动效 2 不重建留下的行 ──
{
  const H = mkHost({ files: [[AUGP, TAGGED]] })
  const el = mkEl('div')
  const off = H.view('memos').mount(el)
  await sleep(30)
  const rowsNow = () => byAttr(el, 'data-memo').map((r) => r.textContent)
  A.equal(rowsNow().length, 6, '时间线默认不含已归档')
  A.ok(H.reg.heads.length === 1, '标题行用 ctx.ui.setViewHead')
  const keptEl = byAttr(el, 'data-memo').find((r) => r.textContent.includes('b #产品'))
  H.list().open({ key: 'tag:产品' })
  await sleep(10)
  A.deepEqual(rowsNow().map((s) => s.split(' ')[0].slice(-1)).sort(), ['a', 'b', 'c'], '查 产品 命中自身与子标签')
  A.equal(byAttr(el, 'data-memo').find((r) => r.textContent.includes('b #产品')), keptEl, '留下的行不重建(动效的前提,整树重画做不到)')
  const barText = () => findAll(el, (c) => /mf-flt/.test(c.className || ''))[0].textContent
  A.ok(barText().includes('#产品') && barText().includes('3 条') && barText().includes('2 个子标签'), `筛选条写清数量:${barText()}`)
  const tagBtn = findAll(el, (c) => c.className === 'mf-tag' && c.textContent === '#设计')[0]
  tagBtn.listeners.click[0]()
  await sleep(10)
  A.deepEqual(H.T.nav.tags, ['产品', '设计'], '正文点标签 = 追加')
  A.equal(rowsNow().length, 1, '追加后同时满足')
  H.list().open({ key: 'tag:设计' })
  await sleep(10)
  A.deepEqual(H.T.nav.tags, ['设计'], '左栏点 = 替换,不累加')
  H.T.setNav({ tags: ['work'] })
  await sleep(10)
  A.equal(rowsNow().length, 0, '查 work 不命中 workshop')
  A.ok(el.textContent.includes('没有匹配的闪念'))
  const clear = findAll(el, (c) => c.tag === 'button' && c.textContent === '清除')[0]
  clear.listeners.click[0]()
  await sleep(10)
  A.deepEqual(H.T.nav.tags, [], '筛选条上清除')
  A.equal(rowsNow().length, 6)
  H.list().open({ key: 'nav:archived' })
  await sleep(10)
  A.equal(rowsNow().length, 1, '已归档视图只列归档')
  A.ok(rowsNow()[0].includes('归档的'))
  H.list().open({ key: 'nav:all' })
  off(); H.dispose()
}

// ── 标签改名 / 合并:写盘断言 ──
const RAW = [
  '---', 'amadeus_page: pg1', '---', '手写导语 #产品 不在任何一节里', '', '<!-- a 1 -->', '', '# 2026-08', '',
  '### 2026-08-01T02:00:00.000Z', '置顶 #产品 中间,#产品/路线图 ⚑pin', '',
  '', // 非规范的多余空行
  '### 2026-08-02T02:00:00.000Z', '归档 #Product/x 尾 #产品/路线图/深 ⌫arch', '', '<!-- a 2 -->', '',
  '### 2026-08-03T02:00:00.000Z', '无关 #产品线 #设计', '',
  '### 2026-08-04T02:00:00.000Z', '行尾空格 #产品  ', 'a.com/#产品',
].join('\n')
{
  const r = T.renameTagInText('x #产品 y #产品/路线图 z #产品线 a.com/#产品', '产品', '项目')
  A.equal(r.text, 'x #项目 y #项目/路线图 z #产品线 a.com/#产品', '只改标签 token:前缀外的、URL 片段不动')
  A.equal(r.n, 2)
  A.equal(T.renameTagInText('#Foo/Bar', 'foo', 'baz').text, '#baz/Bar', '大小写不敏感,子段写法保留')
  A.equal(T.renameTagInText('a #旧 b #新 c', '旧', '新').text, 'a b #新 c', '合并去重:删这一处和它前面的空白')
  A.equal(T.renameTagInText('#旧 #新 c', '旧', '新').text, '#新 c', '行首的重复:删它后面的空白')
  A.equal(T.renameTagInText('#旧 x #旧/y #旧', '旧', '新').text, '#新 x #新/y', '改完互相重复的只留第一个')
  A.equal(T.renameTagInText('x #新 #新', '旧', '新').text, 'x #新 #新', '和这次改名无关的重复不碰')

  const out = T.renameTagInMonth(RAW, '产品', '项目')
  const expected = RAW
    .replace('置顶 #产品 中间,#产品/路线图 ⚑pin', '置顶 #项目 中间,#产品/路线图 ⚑pin')
    .replace('尾 #产品/路线图/深 ⌫arch', '尾 #项目/路线图/深 ⌫arch')
    .replace('行尾空格 #产品  ', '行尾空格 #项目  ')
  A.equal(out.text, expected, '改名后其余字节不变(前言、块标记、哨兵、多余空行、行尾空格)')
  A.equal(out.memos, 3, '按条计数')
  A.ok(out.text.includes('手写导语 #产品'), '首节前的前言不算闪念,不动')
  A.ok(out.text.includes('<!-- a 1 -->') && out.text.includes('<!-- a 2 -->'), '块标记行原样')
  A.deepEqual(T.parseMonth(out.text).memos.map((m) => [m.pinned, m.archived]), T.parseMonth(RAW).memos.map((m) => [m.pinned, m.archived]), '哨兵语义不变')
  const crlf = '# 2026-08\r\n\r\n### 2026-08-01T02:00:00.000Z\r\n#产品 一行\r\n'
  A.equal(T.renameTagInMonth(crlf, '产品', '项目').text, crlf.replace('#产品', '#项目'), 'CRLF 文件不被改换行')
}
{
  const cache = { v: 2, days: { '2026-08-01': 1, '2026-08-02': 1, '2026-08-03': 1, '2026-08-04': 1 }, tags: { 产品: 2, '产品/路线图': 2, 'Product/x': 1, 产品线: 1, 设计: 1 }, total: 4, builtAt: 1 }
  const H = mkHost({ files: [[AUGP, RAW], [CACHEP, JSON.stringify(cache)]], prompt: ['项目'] })
  const offL = H.list().subscribe(() => {})
  await sleep(30)
  H.T.setNav({ tags: ['产品/路线图'] }, 'none')
  await H.T.renameTagFlow('产品', 'rename')
  await sleep(10)
  A.equal(H.reg.confirms.length, 1, '改之前先确认')
  A.ok(H.reg.confirms[0].body.includes('3 条') && H.reg.confirms[0].body.includes('#产品') && H.reg.confirms[0].body.includes('#项目'), `确认框写明改多少条:${H.reg.confirms[0].body}`)
  const after = H.V.get(AUGP)
  A.equal(after, T.renameTagInMonth(RAW, '产品', '项目').text, '落盘内容 = 逐字替换')
  A.ok(after.includes('#项目/路线图 ⚑pin') || after.includes('#项目/路线图/深 ⌫arch'), '子标签跟着改(产品/路线图 → 项目/路线图)')
  const c2 = JSON.parse(H.V.get(CACHEP))
  A.equal(c2.tags['产品'], undefined, '缓存减掉旧标签')
  A.equal(c2.tags['项目'], 2, '缓存加上新标签')
  A.deepEqual(c2.days, cache.days, '改名不动 days 证词')
  A.deepEqual(H.T.nav.tags, ['项目/路线图'], '正在筛的标签跟着改名')
  A.ok(H.T.listRows().some((r) => r.key === 'tag:项目'), '左栏跟着更新')
  offL(); H.dispose()
}
{
  // 确认框点取消:一字不写
  const H = mkHost({ files: [[AUGP, RAW]], prompt: ['项目'], confirm: false })
  const offL = H.list().subscribe(() => {})
  await sleep(30)
  const n0 = H.reg.writes.length
  await H.T.renameTagFlow('产品', 'rename')
  A.equal(H.reg.writes.length, n0, '确认取消:不写')
  A.equal(H.V.get(AUGP), RAW)
  offL(); H.dispose()
}
{
  // 读失败即拒写:别的月份读不到,整个改名零写入(哪怕本月读得到)
  _ls.set('plugin.memoflow.firstMonth', '2026-07')
  const JUL = '闪念盒/2026-07.md'
  const julRaw = '# 2026-07\n\n### 2026-07-01T02:00:00.000Z\n七月 #产品\n'
  const H = mkHost({ files: [[AUGP, RAW], [JUL, julRaw]], prompt: ['项目'] })
  const offL = H.list().subscribe(() => {})
  await sleep(30)
  H.fail.read = (p) => p === JUL
  const n0 = H.reg.writes.length
  await H.T.renameTagFlow('产品', 'rename')
  H.fail.read = null
  A.equal(H.reg.writes.length, n0, '有月份读失败:零写入')
  A.equal(H.reg.confirms.length, 0, '读不全不问,直接报错')
  A.ok(H.reg.notes.some(([m]) => String(m).includes('没有改动')), '告诉用户没改动')
  A.equal(H.V.get(AUGP), RAW, '本月文件一字未动')
  offL(); H.dispose()

  // 折叠宿主:读失败变成 null,缓存证词说这个月有数据 → 同样拒写
  const cache = JSON.stringify({ v: 2, days: { '2026-07-01': 1, '2026-08-01': 1 }, tags: {}, total: 2, builtAt: 1 })
  const H2 = mkHost({ files: [[AUGP, RAW], [CACHEP, cache]], prompt: ['项目'] })
  const offL2 = H2.list().subscribe(() => {})
  await sleep(30)
  const n1 = H2.reg.writes.length
  await H2.T.renameTagFlow('产品', 'rename')
  A.equal(H2.reg.writes.length, n1, '折叠宿主:证词说七月有数据但读到 null,零写入')
  A.equal(H2.V.get(AUGP), RAW)
  offL2(); H2.dispose()

  // 确认框开着时月文件变了:以写入那一刻的磁盘为准,外部新条不被覆没
  _ls.set('plugin.memoflow.firstMonth', '2026-08')
  const H3 = mkHost({ files: [[AUGP, RAW]], prompt: ['项目'] })
  const offL3 = H3.list().subscribe(() => {})
  await sleep(30)
  H3.ctx.ui.confirm = async () => { H3.V.set(AUGP, `${H3.V.get(AUGP)}\n\n### 2026-08-05T02:00:00.000Z\n确认期间写进来的 #产品\n`); return true }
  await H3.T.renameTagFlow('产品', 'rename')
  A.ok(H3.V.get(AUGP).includes('确认期间写进来的 #项目'), '确认期间的新条保留,也一起改名')
  offL3(); H3.dispose()

  // 写到一半失败:如实说改了多少,不说「没有改动」
  _ls.set('plugin.memoflow.firstMonth', '2026-07')
  const H4 = mkHost({ files: [[AUGP, RAW], [JUL, julRaw]], prompt: ['项目'] })
  const offL4 = H4.list().subscribe(() => {})
  await sleep(30)
  H4.fail.write = (p) => p === AUGP
  await H4.T.renameTagFlow('产品', 'rename')
  H4.fail.write = null
  A.ok(H4.V.get(JUL).includes('#项目'), '第一个月写成了')
  A.ok(H4.reg.notes.some(([m]) => String(m).includes('只改了 1 条')), '部分失败如实报告')
  offL4(); H4.dispose()
  _ls.set('plugin.memoflow.firstMonth', '2026-08')
}
{
  // 合并:目标必须存在;同一条去重
  const raw = mdOf(['01T02', 'x #旧 y #新'], ['02T02', 'z #旧'], ['03T02', 'w #新'])
  const H = mkHost({ files: [[AUGP, raw]], prompt: ['不存在', '新'] })
  const offL = H.list().subscribe(() => {})
  await sleep(30)
  await H.T.renameTagFlow('旧', 'merge')
  A.equal(H.V.get(AUGP), raw, '合并目标不存在:不写')
  await H.T.renameTagFlow('旧', 'merge')
  const out = H.V.get(AUGP)
  A.ok(out.includes('x y #新'), '合并去重')
  A.ok(out.includes('z #新') && out.includes('w #新'))
  A.ok(!out.includes('#旧'))
  offL(); H.dispose()
  const H2 = mkHost({ files: [[AUGP, raw]], prompt: ['#1', '旧/子'] })
  const offL2 = H2.list().subscribe(() => {})
  await sleep(30)
  await H2.T.renameTagFlow('旧', 'rename')
  await H2.T.renameTagFlow('旧', 'rename')
  A.equal(H2.V.get(AUGP), raw, '非法名字、改到自己子标签下:都不写')
  offL2(); H2.dispose()
}

// ── ChatBox:新字段 / 句柄探测回退 / 语音进输入框不直接发 ──
{
  globalThis.window = { tangu: { transcribeAudio: async () => '语音转写文本' } }
  const stream = { getTracks: () => [{ stop() {} }] }
  navigator.mediaDevices.getUserMedia = async () => stream
  globalThis.Blob = globalThis.Blob || class {}
  const H = mkHost({ files: [[AUGP, TAGGED]], chatBox: 'new' })
  const el = mkEl('div')
  const off = H.view('memos').mount(el)
  await sleep(30)
  const box = H.reg.boxes[0]
  A.ok(box, '新宿主挂 mountChatBox')
  A.equal(box.opts.submitOn, 'enter', 'Enter 发送')
  A.equal(box.opts.modelPicker, false, '不显示模型选择')
  A.equal(box.opts.suggest.trigger, '#', '# 触发补全')
  A.equal(byTag(el, 'textarea').length, 0, '不再画自己的 textarea')
  A.equal(byAttr(box.toolbar, 'data-voice').length, 1, '语音钮进 toolbar')
  const sg = box.opts.suggest.items('产')
  A.deepEqual(sg.map((x) => x.label), ['#产品', '#产品/用户', '#产品/路线图'], '补全按次数排,段首命中')
  A.deepEqual(Object.keys(sg[0]).sort(), ['hint', 'id', 'insert', 'label', 'value'], '补全行形状(与宿主的约定,README 有记录)')
  A.equal(sg[0].insert, '#产品 ')
  const hashBtn = findAll(box.toolbar, (c) => c.tag === 'button' && c.attrs['aria-label'] === '打标签')[0]
  hashBtn.listeners.click[0]()
  A.deepEqual(box.inserted, ['#'], '# 按钮走 insertText')
  A.equal(box.focused, 1, '# 按钮后焦点回输入框')
  box.opts.onChange({ text: '已有字' })
  hashBtn.listeners.click[0]()
  A.equal(box.inserted[1], ' #', '有字时补空格,否则 # 不算标签')
  box.opts.onChange({ text: '' })
  A.equal(await box.opts.onSubmit({ text: '从 ChatBox 记下 #产品' }), true, '提交成功返回 true,宿主清空')
  await sleep(10)
  A.ok(H.V.get(AUGP).includes('从 ChatBox 记下 #产品'))
  A.ok(byAttr(el, 'data-memo').some((r) => r.textContent.includes('从 ChatBox 记下')), '记下后时间线更新')
  H.fail.read = (p) => p === AUGP
  A.equal(await box.opts.onSubmit({ text: '写不进去' }), false, '落库失败返回 false,草稿留着')
  H.fail.read = null
  A.ok(!H.V.get(AUGP).includes('写不进去'))
  // 语音:转写文字进输入框,不直接发
  const n0 = T.parseMonth(H.V.get(AUGP)).memos.length
  box.inserted.length = 0
  const vb = byAttr(box.toolbar, 'data-voice')[0]
  const realWav = globalThis.AudioContext
  globalThis.AudioContext = class { async decodeAudioData() { return { duration: 1, length: 16000 } } async close() {} }
  globalThis.OfflineAudioContext = class {
    constructor() { this.destination = {} }
    createBufferSource() { return { connect() {}, start() {} } }
    async startRendering() { return { getChannelData: () => new Float32Array(1600).fill(0.5) } }
  }
  const realMR = globalThis.MediaRecorder
  globalThis.MediaRecorder = class { constructor() { this.mimeType = 'audio/webm' } start() {} stop() { this.ondataavailable({ data: { size: 4 } }); this.onstop() } }
  globalThis.Blob = class { constructor(p) { this.p = p } async arrayBuffer() { return new ArrayBuffer(8) } }
  vb.listeners.pointerdown[0]({ preventDefault() {} })
  await sleep(10)
  vb.listeners.pointerdown[0]({ preventDefault() {} })
  await sleep(30)
  globalThis.MediaRecorder = realMR; globalThis.AudioContext = realWav
  A.deepEqual(box.inserted, ['语音转写文本'], '语音转写走 insertText')
  A.equal(T.parseMonth(H.V.get(AUGP)).memos.length, n0, '语音不直接发出')
  off()
  A.equal(box.disposed, 1, '卸载时收回 ChatBox')
  H.dispose()

  // 旧宿主:有 mountChatBox 但不认新字段 → 收掉,用自己的 textarea
  const H2 = mkHost({ chatBox: 'old' })
  const el2 = mkEl('div')
  const off2 = H2.view('memos').mount(el2)
  await sleep(20)
  A.equal(H2.reg.boxes[0].disposed, 1, '句柄没有 insertText:当场收掉(模型选择藏不掉)')
  A.equal(byTag(el2, 'textarea').length, 1, '退回自己的 textarea')
  off2(); H2.dispose()

  // 回退输入框的 # 补全
  const H3 = mkHost({ files: [[AUGP, TAGGED]] })
  const el3 = mkEl('div')
  const off3 = H3.view('memos').mount(el3)
  await sleep(20)
  const ta = byTag(el3, 'textarea')[0]
  A.equal(byAttr(el3, 'data-voice').length, 1, 'textarea 路径语音钮仍在')
  ta.value = '今天 #产'
  ta.listeners.input.forEach((f) => f())
  const chip = findAll(el3, (c) => /mf-suggest/.test(c.className || ''))[0].children[0]
  A.equal(chip.textContent, '#产品', '回退路径也有 # 补全')
  chip.listeners.click[0]()
  A.equal(ta.value, '今天 #产品 ', '点补全替换半截标签')
  off3(); H3.dispose()
}

// ── Mini M2:quick 视图 · 跟容器走的断点 · 记完留在原地 · 带筛选到主面板 ──
{
  globalThis.window = { tangu: {} }
  const space = JSON.parse(readFileSync(new URL('./spaces/memoflow/space.json', import.meta.url), 'utf8'))
  A.deepEqual(space.name, { zh: '闪念盒', en: 'MemoFlow' })
  A.equal(space.mini.view.type, 'plugin:memoflow:quick')
  A.equal(space.mini.mainView.type, 'plugin:memoflow:memos')
  A.ok(space.mini.name.zh && space.mini.name.en, 'mini name 中英都有')
  A.ok(!space.requires.views.includes('plugin:memoflow:quick'), 'Mini 视图不进 requires.views')
  A.equal(space.layout.left[0].params.mode, 'plugin:memoflow:memos', '左栏是列表源')
  A.equal(space.layout.right[0].type, 'plugin:memoflow:activity', '右栏是活动视图')
  const manifest = JSON.parse(readFileSync(new URL('./manifest.json', import.meta.url), 'utf8'))
  A.equal(manifest.version, '2.0.0')
  A.equal(manifest.onboarding.steps.length, manifest.onboarding.en.steps.length, 'onboarding 中英同数')
  A.ok(!/🎙/.test(JSON.stringify(manifest)), 'onboarding 不再提 emoji 按钮')

  let ro = null
  globalThis.ResizeObserver = class { constructor(cb) { this.cb = cb; ro = this } observe() {} disconnect() { this.gone = true } }
  const today = '2026-08-06'
  const files = [[AUGP, mdOf(['01T02', '旧的 #设计'], ['01T03', '旧的二 #读书'], ['06T02', '今天的 #设计'], ['06T03', '今天没标签'])]]
  const H = mkHost({ files, chatBox: 'new', caps: ['tree'] })
  const params = { tag: '' }
  const view = { surface: 'mini', getParams: () => params, setParams: (p) => Object.assign(params, p) }
  const el = mkEl('div')
  const off = H.view('quick').mount(el, view)
  await sleep(30)
  const root = el.children.find((c) => c.className === 'mf-q')
  const size = (w, h2) => ro.cb([{ contentRect: { width: w, height: h2 } }])
  const rows = () => byAttr(el, 'data-memo').map((r) => r.textContent)
  A.equal(rows().length, 2, '缺省只列今天')
  A.ok(!el.textContent.includes('旧的'), '今天之外的不列')
  const chips = () => findAll(el, (c) => /mf-chip/.test(c.className || ''))
  A.equal(chips()[0].textContent, '今天', '第一颗是今天')
  A.ok(chips()[0].className.includes('on'))
  size(320, 420)
  A.equal(root.attrs['data-tiny'], '0')
  size(260, 160)
  A.equal(root.attrs['data-tiny'], '1', '高度 < 240 只留输入框(不写死 320×420)')
  size(260, 239); A.equal(root.attrs['data-tiny'], '1')
  size(260, 240); A.equal(root.attrs['data-tiny'], '0', '断点是 240')
  size(640, 560)
  A.equal(rows().length, 4, '宽度 ≥ 480 显示全部')
  A.ok(findAll(el, (c) => c.className === 'mf-day').length >= 2, '宽时按日分组')
  A.equal(chips()[0].textContent, '全部')
  size(479, 560)
  A.equal(rows().length, 2, '断点是 480')
  await H.reg.boxes[0].opts.onSubmit({ text: '在 Mini 记的 #设计' })
  await sleep(10)
  A.ok(rows()[0].includes('在 Mini 记的'), '记完留在 Mini,新行在最上面')
  A.ok(rows()[0].includes('刚刚'), '确认行写「刚刚」')
  A.equal(H.reg.boxes[0].focused, 0, '记完不动焦点')
  const tagChip = chips().find((c) => c.textContent === '设计')
  tagChip.listeners.click[0]()
  await sleep(5)
  A.equal(params.tag, '设计', '选标签写进参数,「在主面板显示」带过去')
  A.equal(rows().length, 3, '标签筛选跨日')
  // 主视图:带着参数打开 + 参数变化 + 清除筛选把参数清掉
  const mainEl = mkEl('div')
  const cbs = []
  const offMain = H.view('memos').mount(mainEl, { getParams: () => params, setParams: (p) => Object.assign(params, p), onParamsChanged: (f) => { cbs.push(f); return () => {} } })
  await sleep(20)
  A.deepEqual(H.T.nav.tags, ['设计'], '主视图接住 Mini 带来的筛选')
  H.T.setNav({ tags: [] })
  A.equal(params.tag, '', '清除筛选后定位参数也清掉')
  params.tag = '读书'
  cbs[0]()
  A.deepEqual(H.T.nav.tags, ['读书'], 'onParamsChanged 不重挂也跟上')
  // 同窗口两个视图:一处记下另一处更新
  await H.reg.boxes[1].opts.onSubmit({ text: '主视图记的 #设计' })
  await sleep(10)
  A.ok(rows().some((s) => s.includes('主视图记的')), '主视图记下,Mini 跟着更新')
  offMain(); off()
  A.equal(ro.gone, true, '卸载时断开 ResizeObserver')
  H.dispose()
  delete globalThis.ResizeObserver
  void today
}

// ── 跨窗口与外部改动:storage pulse / watchFile ──
{
  const listeners = {}
  globalThis.window = { tangu: {}, addEventListener: (k, f) => { listeners[k] = f }, removeEventListener: (k) => { delete listeners[k] } }
  const H = mkHost({ files: [[AUGP, mdOf(['05T02', '一条'])]], watch: true })
  const el = mkEl('div')
  const off = H.view('memos').mount(el)
  await sleep(30)
  const rows = () => byAttr(el, 'data-memo').length
  A.equal(rows(), 1)
  H.V.set(AUGP, mdOf(['05T02', '一条'], ['05T03', 'Mini 窗口记的']))
  A.equal(typeof listeners.storage, 'function', '订了 storage 事件')
  listeners.storage({ key: 'plugin.memoflow.pulse', newValue: '2026-08|x' })
  await sleep(10)
  A.equal(rows(), 2, '另一个窗口写完,这边刷新')
  H.V.set(AUGP, mdOf(['05T02', '一条'], ['05T03', 'Mini 窗口记的'], ['05T04', 'Agent 写的']))
  H.reg.watch.get(AUGP)()
  await sleep(10)
  A.equal(rows(), 3, 'Agent 改文件走 watchFile 刷新')
  await H.T.addMemo('本窗口写一条')
  A.ok(_ls.get('plugin.memoflow.pulse').startsWith('2026-08|'), '写完留 pulse 给别的窗口')
  off()
  A.equal(H.reg.watch.size, 0, '卸载退订 watchFile')
  A.equal(listeners.storage, undefined, '卸载退订 storage')
  H.dispose()
  globalThis.window = { tangu: {} }
}

// ── 手机:单列、输入贴底、标签走宿主下拉、左栏摊平、操作进 ⋯ ──
{
  globalThis.window = { tangu: { mobile: true } }
  const H = mkHost({ files: [[AUGP, TAGGED]], chatBox: 'new' })
  const el = mkEl('div')
  const off = H.view('memos').mount(el)
  await sleep(30)
  const root = el.children.find((c) => c.className === 'mf-root')
  A.equal(root.attrs['data-phone'], '1', '手机标记')
  const dock = root.children.find((c) => c.className === 'mf-dock')
  A.ok(dock && findAll(dock, (c) => c.className === 'mf-composer').length === 1, '输入框在贴底的 dock 里')
  const pick = H.reg.controls[0]
  A.ok(pick && pick.c.type === 'select', '标签走宿主下拉(安卓原生底部抽屉,抓手和系统返回归宿主)')
  A.ok(pick.c.options.some((x) => x.label.startsWith('产品 / 路线图')), '手机上摊平成「产品 / 路线图」')
  pick.c.onChange('产品/路线图')
  await sleep(10)
  A.deepEqual(H.T.nav.tags, ['产品/路线图'])
  A.equal(pick.c.value, '产品/路线图', '选中态回写下拉')
  pick.c.onChange('')
  await sleep(10)
  A.deepEqual(H.T.nav.tags, [])
  const flat = H.T.listRows()
  A.ok(flat.every((r) => !r.parent && !r.kind), '层级走不了原生整屏:列表源摊平')
  A.ok(flat.some((r) => r.title === '产品 / 路线图'))
  const row0 = byAttr(el, 'data-memo')[0]
  const moreBtn = findAll(row0, (c) => c.tag === 'button')
  A.equal(moreBtn.length, 1, '手机上每行只有一颗 ⋯,不搬桌面的横排按钮')
  moreBtn[0].listeners.click[0]()
  A.equal(H.reg.menus.at(-1).items.length, 5, '五个操作进菜单(安卓上是原生抽屉)')
  A.ok(H.reg.menus.at(-1).at.anchor === moreBtn[0])
  off(); H.dispose()

  // 手机但宿主没有下拉:退回主区芯片
  const H2 = mkHost({ files: [[AUGP, TAGGED]], control: false })
  const el2 = mkEl('div')
  const off2 = H2.view('memos').mount(el2)
  await sleep(20)
  A.ok(findAll(el2, (c) => /mf-chip/.test(c.className || '') && c.textContent === '产品 / 路线图').length === 1, '没有 mountControl:摊平的标签芯片')
  off2(); H2.dispose()
  globalThis.window = { tangu: {} }
}

// ── 动效:时长、曲线、减少动态效果(照 play.html) ──
{
  ANIM.on = true
  const H = mkHost({ files: [[AUGP, TAGGED]] })
  const el = mkEl('div')
  const off = H.view('memos').mount(el)
  await sleep(30)
  const durs = () => ANIM.log.map((a) => a.ms)
  const frames = () => ANIM.log.map((a) => a.kf)
  ANIM.log.length = 0
  H.T.setNav({ tags: ['设计'] })
  await sleep(5)
  A.ok(durs().includes(120) && durs().includes(200), `筛选:淡出 120 + 收高 200(见 ${durs()})`)
  A.ok(ANIM.log.some((a) => a.ms === 120 && a.easing === 'cubic-bezier(.33,1,.68,1)'), '淡出用 calm 曲线')
  A.ok(ANIM.log.some((a) => a.ms === 200 && a.easing === 'cubic-bezier(.22,1,.36,1)'), '高度用 surface 曲线')
  H.T.setNav({ tags: [] })
  await sleep(5)
  // 记下:新行长高 320,飞行 420
  ANIM.log.length = 0
  const ta = byTag(el, 'textarea')[0]
  ta.value = '飞一条'
  ta.listeners.keydown[0]({ key: 'Enter', shiftKey: false, preventDefault() {} })
  await sleep(10)
  A.ok(durs().includes(320), `记下:新行长高 320(见 ${durs()})`)
  A.ok(durs().includes(420), '记下:飞行 420')
  A.ok(frames().some((k) => /^translate\(/.test(String(k[1].transform))), '飞行是位移')
  A.ok(!findAll(el, (c) => c.className === 'mf-fly').length, '飞完收掉')
  const fresh = byAttr(el, 'data-memo')[0]
  A.ok(fresh.textContent.includes('刚刚'), '新行写「刚刚」')
  // 回顾牌堆
  ANIM.log.length = 0
  _ls.delete('plugin.memoflow.reviewDone')
  off(); H.dispose()
  const julyRows = ['# 2026-07', '']
  for (let i = 0; i < 6; i++) julyRows.push(`### 2026-07-1${i}T02:00:00.000Z`, `旧念 ${i}`, '')
  _ls.set('plugin.memoflow.firstMonth', '2026-07')
  const H2 = mkHost({ files: [['闪念盒/2026-07.md', julyRows.join('\n')]] })
  const el2 = mkEl('div')
  const off2 = H2.view('memos').mount(el2)
  await sleep(30)
  ANIM.log.length = 0
  const top = byAttr(el2, 'data-review').find((c) => !c.attrs['aria-hidden'])
  findAll(top, (c) => c.tag === 'button' && c.textContent === '跳过')[0].listeners.click[0]()
  await sleep(10)
  A.ok(durs().includes(250) && durs().includes(180), `回顾:顶牌滑走 180,后牌上移 250(见 ${durs()})`)
  A.ok(frames().some((k) => k[1].transform === 'translateX(28px)'), '顶牌向右滑走')
  // 处理到 0 张:整块收起
  for (let i = 0; i < 6; i++) {
    const c = byAttr(el2, 'data-review').find((x) => !x.attrs['aria-hidden'])
    if (!c) break
    findAll(c, (b) => b.tag === 'button' && b.textContent === '跳过')[0].listeners.click[0]()
    await sleep(10)
  }
  A.equal(byAttr(el2, 'data-review').length, 0, '0 张整块收起')
  A.equal(_ls.get('plugin.memoflow.reviewDone'), '2026-08-06')
  off2(); H2.dispose()
  _ls.set('plugin.memoflow.firstMonth', '2026-08')
  _ls.delete('plugin.memoflow.reviewDone')

  // 减少动态效果:位移全关,高度不补间,只留淡入淡出
  globalThis.matchMedia = (q) => ({ matches: /prefers-reduced-motion/.test(q) })
  const H3 = mkHost({ files: [[AUGP, TAGGED]] })
  const el3 = mkEl('div')
  const off3 = H3.view('memos').mount(el3)
  await sleep(30)
  ANIM.log.length = 0
  H3.T.setNav({ tags: ['设计'] })
  await sleep(5)
  const ta3 = byTag(el3, 'textarea')[0]
  H3.T.setNav({ tags: [] })
  await sleep(5)
  ta3.value = '安静地记一条'
  ta3.listeners.keydown[0]({ key: 'Enter', shiftKey: false, preventDefault() {} })
  await sleep(10)
  A.ok(ANIM.log.length > 0, '减少动态效果仍有淡入淡出')
  A.ok(ANIM.log.every((a) => a.kf.every((f) => !('transform' in f) && !('height' in f))), '减少动态效果:没有位移也没有高度补间')
  A.ok(ANIM.log.every((a) => a.ms <= 120), '减少动态效果:时长封顶 120')
  off3(); H3.dispose()
  delete globalThis.matchMedia
  ANIM.on = false
}

// ── 主视图骨架:重建缓存进 ⋯ 菜单,草稿不被刷新吃掉 ──
{
  const H = mkHost({ files: [[AUGP, TAGGED]] })
  const el = mkEl('div')
  const off = H.view('memos').mount(el)
  await sleep(30)
  const head = H.reg.heads[0]
  A.ok(!byTag(el, 'button').some((b) => b.textContent === '重建缓存'), '重建缓存不占主区')
  const more = findAll(head.actions, (c) => c.tag === 'button' && c.attrs['aria-label'] === '更多')[0]
  more.listeners.click[0]()
  A.equal(H.reg.menus[0].items[0].label, '重建缓存', '收进 ⋯ 菜单')
  A.ok(!el.textContent.includes('显示归档'), '「显示归档」变成左栏「已归档」')
  const ta = byTag(el, 'textarea')[0]
  ta.value = '还没发出去的草稿'
  await H.T.addMemo('别处落的一条')
  await sleep(10)
  A.equal(byTag(el, 'textarea')[0], ta, '局部更新:输入框不重建')
  A.equal(ta.value, '还没发出去的草稿', '记下 / 刷新不吃输入框草稿')
  off()
  A.equal(head.gone, true, '卸载收回视图头')
  H.dispose()
}

console.log('check ok — 3 视图/3 命令/1 设置/状态栏/成就 契约 + 月文件往返(含前言/Amadeus 块标记四形态) + 标签 + seed 回顾(同日冻结) + 缓存等式 + 跨年月序 + 删除保全 + XSS + P0 写前防线(ioFail 拒写/折叠宿主缓存证词/ensureCacheFile 不覆写/增量补丁不清证词/P0 链条闭环) + P1 变更读不到一律拒改 + 并发串行 + IME/双Enter 闸 + 语音双姿势 + MediaRecorder 抛出停流 + digest 嵌套围栏 + 转笔记不覆写 + 双旧宿主降级 + 2.0(解析对账 · 前缀匹配 · 缓存升级 · 左栏树 · 筛选 · 改名合并写盘 · ChatBox 回退 · Mini · 跨窗口 · 手机 · 动效) + 双语(词表两侧键/占位符集合相等 · 切 en 后同一挂载视图就地变英文 · 语言订阅退干净 · zh→en→zh 逐字回归 · 切语言/并发落库不吃编辑框草稿 · 计数单复数与列表分隔符按语言 · 裸占位符扫描+调用点对账) 全部通过')
