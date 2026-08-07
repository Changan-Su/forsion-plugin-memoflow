---
name: MemoFlow Fleeting Notes
description: Use when the user asks to read, search, summarize, digest, or edit their fleeting notes ("闪念" / memos) captured with the MemoFlow (闪念盒) plugin. Teaches the exact on-disk month-file format (### ISO-timestamp sections, inline #tags, ⚑pin/⌫arch sentinels), the derived cache, and the digest output conventions, so notes can be read and written without corrupting them.
version: 1.0.0
category: 知识管理
---

# MemoFlow Fleeting Notes

The MemoFlow (闪念盒) desktop plugin stores the user's fleeting notes as plain markdown **month files** inside the notes vault. This skill teaches you the exact format so you can read, search, summarize, and (carefully) edit them with the host file tools (`read_file` / `write_file` / `search_files`).

## Where the files live

All paths are relative to the vault, inside the plugin's work folder (default **`闪念盒/`** — the user may have renamed it in the plugin's settings; if `闪念盒/` is missing, search for files named `20??-??.md` containing `### 20??-…Z` headings):

```
闪念盒/
├── 2026-08.md              ← month file: all memos captured in 2026-08
├── .memoflow-cache.json    ← derived stats (day counts / tag counts). DERIVED — never hand-edit;
│                              the plugin can rebuild it from month files at any time.
└── 整理/                    ← outputs: converted notes and weekly digests
    ├── 2026-08-05-<title>.md
    └── 2026-W32-周整理.md
```

## Month file format (exact contract)

```markdown
# 2026-08

### 2026-08-06T09:12:33.000Z
今天想到:插件生态的护城河是 Agent 纵深 #forsion #产品

### 2026-08-06T14:02:10.000Z
多行闪念
第二行也属于这条,直到下一个 ### 或 EOF。 ⚑pin
```

Rules:

- One memo = a `### <ISO-8601 UTC timestamp>` heading + its body, running until the next `###` **timestamp** heading or EOF. A `###` line that is *not* an ISO timestamp is ordinary body text — do not treat it as a boundary.
- Tags are inline `#<non-whitespace>` runs inside the body (`#中文` counts; `#123` pure digits and `#` followed by punctuation do not). Tags stay in the body text — never strip them.
- Status sentinels are plain-text markers at the very end of the body: `⚑pin` (pinned) and/or `⌫arch` (archived), space-separated, in that order. Example: `一条已归档的置顶 ⚑pin ⌫arch`.
- Memos are append-ordered; timestamps are the memo's identity.

**⚠️ When editing month files: preserve timestamps and sentinel markers exactly.** Never rewrite a memo's `### <timestamp>` heading, never reorder sections, never drop a trailing `⚑pin` / `⌫arch`. To archive a memo, append ` ⌫arch` to the end of its body; to add a memo, append a new `### <current UTC ISO timestamp>` section at the end of the current month's file (create `# YYYY-MM` header line first if the file is new).

After editing month files, mention to the user that the plugin's 「重建缓存」 button will refresh the stats cache (or ignore it — the cache is safely regenerable).

## Digest output conventions

When the user asks you to digest / organize their memos (weekly review, thematic summary):

1. Read the relevant month files (current + previous month usually suffice; the exact 7-day window is derived from the `###` timestamps).
2. Skip memos whose body ends with `⌫arch` (archived) unless the user explicitly asks to include them.
3. Cluster by theme. Output structure (write body in the memos' own language, typically Chinese):
   - one `## <theme>` section per theme, most important first;
   - 2-5 synthesized bullet points per theme;
   - then a `原句` sub-list quoting the original sentences verbatim, each ending with its timestamp in backticks, e.g. `` `2026-08-03T02:11:05.000Z` ``.
4. Save to `闪念盒/整理/<ISO-week>-周整理.md` (e.g. `2026-W32-周整理.md`), with a first line noting the generation date and how many memos it covers. Ask before overwriting an existing digest for the same week.

Single-memo conversion ("转笔记"): write `闪念盒/整理/<YYYY-MM-DD>-<first-line-truncated>.md` starting with `> 来源:闪念盒 <timestamp>`, then the full memo body; then append ` ⌫arch` to the original memo.

## Self-check before delivering

- [ ] Every edited month file still parses: each memo keeps its original `### <timestamp>` line and sentinels.
- [ ] Digest quotes are verbatim and every quote carries its source timestamp.
- [ ] Nothing was written outside the plugin's work folder.
