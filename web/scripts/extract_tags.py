# -*- coding: utf-8 -*-
"""标签提取引擎：词表(lexicon.json) + 学习台账(tag_state.json) + 产出(tags.json)

工作流（与用户约定的"边学边扩"规则）：
  1. python extract_tags.py          全量提取（快），报告：新增未学习的组 / 内容变更的组 /
                                      高频候选新词（未被词表覆盖、出现≥3组）
  2. 人工审阅候选词 → 编辑 lexicon.json 追加词条，version +1
  3. python extract_tags.py          重跑，确认新词条生效
  4. python extract_tags.py --learn  全部标记为已学习（记录 hash + 词表版本）

"已学习"判定：组在台账中、hash 与当前提示词一致、learned_v == 当前词表版本。
tags.json 每次运行全量重算（毫秒级），spans 与 styles.json 的 prompt 字段逐字符对齐，
前端可直接按 [start, end, cat] 切片上色。
"""
import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path

WEB = Path(__file__).resolve().parent.parent  # skills/web
DATA = WEB / "data"
ROOT = WEB.parent  # skills/
BOARDS = {"transform": ROOT / "collection", "generate": ROOT / "generation"}

STOP_CHARS = set("的了和与及或在被把是一这那不也有都很最更并等将向从于其该每两各自此为")

# 全库共用的提示词模板骨架词（无区分度），不计入候选新词
STOPGRAMS = {
    "照片", "主体", "构图", "部分", "保留", "画面", "关系", "背景", "轮廓", "结构",
    "视觉", "下半", "半部", "半部分", "下半部", "下半部分", "上半", "上半部分", "整体",
    "保持", "少量", "完整", "采用", "提取", "识别", "轻微", "叙事", "空间", "形成",
    "原图", "姿态", "区域", "两个", "高度", "严格", "分别", "独立", "输出", "一张",
    "制作", "上传", "重新", "重构", "成为", "呈现", "具有", "以及", "通过", "基于",
    "使用", "整理", "信息", "重点", "情绪", "内容", "主题", "元素", "细节", "特征",
    "风格", "设计", "感觉", "适合", "可以", "进行", "处理", "表达", "中 最", "原图中",
    "记忆点", "标志性", "辨识度", "最具", "原有", "原有色彩", "自然光影", "真实质感",
    "色彩氛围", "艺术", "海报", "提示词", "加载", "载入", "场景",
    "质感", "色彩", "局部", "原始", "识别性", "具识别", "真实", "避免", "核心",
    "面积", "环境", "边缘", "只保留", "必须", "清晰", "上方", "插画", "尺度",
    "根据", "比例", "裁切", "呼吸", "色块", "插画", "适合", "尤其",
}


def load_groups():
    """与 scripts_build_styles.py 一致：双板块扫描，gid 使用 'transform-XX'/'generate-XX' 形式"""
    groups = {}
    for btype, board in BOARDS.items():
        if not board.exists():
            continue
        for folder in sorted(board.iterdir()):
            m = re.match(r"组(\d+)_(.+)", folder.name)
            if not (folder.is_dir() and m):
                continue
            pf = folder / "提示词.txt"
            text = pf.read_bytes().decode("utf-8-sig").strip() if pf.exists() else ""
            groups[f"{btype}-{m.group(1)}"] = {
                "name": m.group(2), "text": text,
                "hash": hashlib.md5(text.encode()).hexdigest(),
            }
    return groups


def compile_terms(lex):
    return [(t["canon"], t["cat"], [re.compile(p) for p in t["pats"]]) for t in lex["terms"]]


def extract(text, terms):
    """返回 (tags, spans)。词表命中用分类色；其余实义词短语统一 'base' 柔色（全量着色）。"""
    raw = []
    for canon, cat, pats in terms:
        for pat in pats:
            for m in pat.finditer(text):
                raw.append((m.start(), m.end(), cat, canon))

    # 贪心去重叠：按起点升序、长度降序，保留长匹配
    raw.sort(key=lambda x: (x[0], -(x[1] - x[0])))
    spans, taken_end = [], -1
    for s, e, cat, canon in raw:
        if s >= taken_end:
            spans.append([s, e, cat, canon])
            taken_end = e

    # ── 全量着色：词表未覆盖的实义词短语补 'base' 片段 ──
    # 实义词 = 连续的中文/字母/数字段；排除纯功能词（的/了/与等）与超短碎片
    FUNC_WORDS = {"的", "了", "与", "及", "或", "和", "是", "在", "被", "把", "对", "为",
                  "有", "要", "会", "能", "可", "都", "也", "更", "最", "不", "一", "个",
                  "其", "这", "那", "它", "并", "等", "将", "向", "从", "于", "但", "而",
                  "如", "若", "则", "且", "以", "所", "之", "或", "各", "每", "两", "再",
                  "又", "才", "只", "就", "还", "很", "太", "去", "来", "中", "上", "下"}
    filled = []
    cursor = 0
    for s, e, cat, canon in spans:
        if s > cursor:
            filled.extend(_base_spans(text, cursor, s, FUNC_WORDS))
        filled.append([s, e, cat, canon])
        cursor = e
    if cursor < len(text):
        filled.extend(_base_spans(text, cursor, len(text), FUNC_WORDS))
    spans = filled

    tags = {}
    for _, _, cat, canon in spans:
        if cat == "base":
            continue
        tags.setdefault(cat, [])
        if canon not in tags[cat]:
            tags[cat].append(canon)
    return tags, spans


def _base_spans(text, start, end, func_words):
    """把 [start,end) 区间切成实义词短语（连续非功能词字符段），返回 base 片段"""
    out = []
    # 按 功能词/标点/空白 切分
    import re as _re
    for m in _re.finditer(r"[\u4e00-\u9fffA-Za-z0-9]+", text[start:end]):
        seg = m.group()
        # 逐词推进：功能词作为分隔符，不产生片段
        i, run_start = 0, 0
        tokens = _re.findall(r"[\u4e00-\u9fff]|[A-Za-z0-9]+", seg)
        pieces, cur = [], []
        for tok in tokens:
            if tok in func_words:
                if cur:
                    pieces.append("".join(cur))
                    cur = []
            else:
                cur.append(tok)
        if cur:
            pieces.append("".join(cur))
        # 把切出的实义词段映射回原文位置
        pos = start + m.start()
        for piece in pieces:
            idx = text.find(piece, pos, end + 10)
            if idx >= 0 and len(piece) >= 2:  # 单字碎片不上色
                out.append([idx, idx + len(piece), "base", "实义短语"])
                pos = idx + len(piece)
    return out


def candidates(groups, all_spans, lex_terms):
    """高频候选新词：把已被词表覆盖的文本屏蔽后，统计 2–6 字中文 n-gram 的文档频次"""
    doc_freq = Counter()
    for gid, g in groups.items():
        masked = list(g["text"])
        for s, e, _, _ in all_spans.get(gid, []):
            for i in range(s, e):
                masked[i] = "\x00"
        seen = set()
        for run in re.findall(r"[\u4e00-\u9fff]{2,}", "".join(masked).replace("\x00", "|")):
            for n in range(2, min(7, len(run) + 1)):
                for i in range(len(run) - n + 1):
                    gram = run[i:i + n]
                    if set(gram) & STOP_CHARS:
                        continue
                    if gram in STOPGRAMS:
                        continue
                    seen.add(gram)
        doc_freq.update(seen)
    # 去冗余：被同文档频次的更长词包含的短词丢弃
    keep = []
    for gram, df in sorted(doc_freq.items(), key=lambda x: (-x[1], -len(x[0]))):
        if df < 3:
            continue
        if any(gram in k and df == d for k, d in keep):
            continue
        keep.append((gram, df))
    return keep[:30]


def main():
    learn = "--learn" in sys.argv
    lex = json.loads((DATA / "lexicon.json").read_text(encoding="utf-8"))
    terms = compile_terms(lex)
    state_path = DATA / "tag_state.json"
    state = json.loads(state_path.read_text(encoding="utf-8")) if state_path.exists() else {}

    groups = load_groups()
    all_spans, out_groups = {}, {}
    for gid, g in groups.items():
        tags, spans = extract(g["text"], terms)
        all_spans[gid] = spans
        out_groups[gid] = {
            "tags": tags,
            "spans": spans,
            "coverage": round(sum(e - s for s, e, _, _ in spans) / max(len(g["text"]), 1), 3),
        }

    if learn:
        for gid, g in groups.items():
            state[gid] = {"hash": g["hash"], "learned_v": lex["version"]}
        state_path.write_text(json.dumps(state, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"已标记 {len(groups)} 个组为已学习（词表 v{lex['version']}）")
        return

    # ---- 报告：学习状态 ----
    new = [gid for gid in groups if gid not in state]
    changed = [gid for gid, g in groups.items()
               if gid in state and state[gid]["hash"] != g["hash"]]
    stale = [gid for gid, g in groups.items()
             if gid in state and state[gid]["hash"] == g["hash"]
             and state[gid]["learned_v"] < lex["version"]]
    removed = [gid for gid in state if gid not in groups]
    learned = [gid for gid, g in groups.items()
               if gid in state and state[gid]["hash"] == g["hash"]
               and state[gid]["learned_v"] == lex["version"]]

    print(f"=== 标签提取报告（词表 v{lex['version']}，{len(lex['terms'])} 个词条）===")
    print(f"组总数 {len(groups)} | 已学习 {len(learned)} | 新增未学习 {len(new)} | "
          f"内容变更 {len(changed)} | 词表更新后待重学 {len(stale)} | 台账残留 {len(removed)}")
    if new:
        names = [f"{g} {groups[g]['name']}" for g in new[:12]]
        print(f"  新增: {' '.join(names)}{' …' if len(new) > 12 else ''}")
    if changed:
        print(f"  变更: {' '.join(changed)}")
    if stale:
        print(f"  待重学(词表已更新): {len(stale)} 个组")

    # ---- 报告：候选新词 ----
    cands = candidates(groups, all_spans, terms)
    if cands:
        print("\n候选新词（≥3组出现、未被词表覆盖，人工审阅后加入 lexicon.json）:")
        for gram, df in cands:
            print(f"  {gram}  ({df}组)")

    # ---- 产出 ----
    tags_out = {
        "lexicon_version": lex["version"],
        "generated_at": __import__("datetime").datetime.now().isoformat(timespec="seconds"),
        "groups": out_groups,
    }
    (DATA / "tags.json").write_text(
        json.dumps(tags_out, ensure_ascii=False, indent=1), encoding="utf-8")

    # 覆盖率最低的组（提示词写法特殊，规则难命中）
    low = sorted(out_groups.items(), key=lambda kv: kv[1]["coverage"])[:5]
    print("\n覆盖率最低的组（供词表补漏参考）:")
    for gid, info in low:
        print(f"  {gid} {groups[gid]['name']}: {info['coverage']:.0%}")

    # 疑似非提示词：覆盖率极低且篇幅短（多半是帖子开场白被误存为提示词）
    suspect = [(gid, info) for gid, info in out_groups.items()
               if info["coverage"] < 0.03 and len(groups[gid]["text"]) < 400]
    if suspect:
        print("\n疑似非提示词（覆盖率<3%且<400字，建议人工核对 txt 内容）:")
        for gid, _ in suspect:
            print(f"  {gid} {groups[gid]['name']} ({len(groups[gid]['text'])}字)")
    avg = sum(v["coverage"] for v in out_groups.values()) / len(out_groups)
    print(f"平均覆盖率: {avg:.0%}  ->  已写入 data/tags.json")


if __name__ == "__main__":
    main()
