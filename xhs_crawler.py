# -*- coding: utf-8 -*-
"""
小红书提示词爬虫（纯 HTTP，无需浏览器/登录，多博主通用）

原理:
  1. 卡片枚举必须用浏览器（主页 SSR 的 HTML 里 noteId 为空）。在 ZCode 浏览器打开
     博主主页，下滑加载，用 playwright 收集 a[href*="xsec_token"] 锚点导出 JSON:
       [["noteId","xsec_token"], ...]   （虚拟列表，需边滚边收集）
  2. 逐条抓笔记页，解析 window.__INITIAL_STATE__ → note.noteDetailMap[noteId].note
     （title / desc 完整正文 / imageList 官方排序图片 / tagList / atUserList）
  3. 序号: 正文「序号：0XX」→ 标题「P数字」→ 都没有则按收录规则判定
     （正文可复制 ≥200 字且无「附件」标记 → 收录，编号顺延到最大号+1）
  4. 编号约定: 组NN 只是去重 ID。同序号冲突：文本几乎相同→图片更全则续号并入、
     否则跳过；不同内容→让位到现有最大号+1。
  5. 图片按 imageList 顺序下载（需 Referer），Pillow 转 RGB 存 01.jpg..NN.jpg
     (quality=95)；正文截掉话题/@/尾注后写 提示词.txt（utf-8-sig + CRLF）。

用法:
  python xhs_crawler.py --notes "<笔记链接>" [--notes "<链接2>" ...]
                                        # 直接给笔记链接（浏览器地址栏完整链接，含 xsec_token）；
                                        # 也可 --notes links.txt（每行一条链接）
  python xhs_crawler.py --profile "https://www.xiaohongshu.com/user/profile/<uid>?xsec_token=..." \
                         --cards cards.json --limit 10
  python xhs_crawler.py --cards cards.json --limit 10     # 默认博主=小小东
  其他: --dry-run 只判断不下载 / --refresh 忽略已处理缓存 /
        --retry-noseries 重查「无序号」跳过的帖子 / --out 输出目录

板块（数据库重构后按板块分目录、独立编号）:
  transform 照片风格化 → collection/    generate 海报生成 → generation/
  --board auto (默认) 按提示词内容自动分类；transform=引用上传照片/原图/上下分区，
  generate=主题占位符纯生成；两者都不像 → 下载到 inbox/ 待定板块，汇报后人工归位。
  也可 --board transform|generate|<新板块名> 指定（新板块名即 skills/ 下新目录名）。

缓存: 博主模式按 uid 分文件 xhs_done_<uid>.json / xhs_noseries_<uid>.json；
      笔记链接模式用 xhs_done_notes.json。已存在同序号文件夹不会覆盖；
      手动删组后想重下，从对应缓存文件移除 noteId 再跑。
"""
import argparse, difflib, gzip, io, json, re, sys, time, urllib.request, urllib.error
from pathlib import Path

from PIL import Image

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36')
DEFAULT_USER_ID = '640cb18f0000000029012dd9'  # 小小东
DEFAULT_PROFILE_URL = ('https://www.xiaohongshu.com/user/profile/' + DEFAULT_USER_ID +
                       '?xsec_token=ABrvXDm3l7uSlLWNE2Trse7XkrwYfeT9e1nMHxOXLC-K0=&xsec_source=pc_user')

# 板块 → 目录（与 web/scripts/extract_tags.py 的 BOARDS 映射保持一致）
BOARD_DIRS = {'transform': 'collection', 'generate': 'generation'}

HEADERS = {
    'User-Agent': UA,
    'Referer': 'https://www.xiaohongshu.com/',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.6',
}


def fetch_text(url, retries=3):
    req = urllib.request.Request(url, headers={**HEADERS, 'Accept-Encoding': 'gzip',
                                               'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8'})
    last = None
    for _ in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                raw = r.read()
                if r.headers.get('Content-Encoding') == 'gzip':
                    raw = gzip.GzipFile(fileobj=io.BytesIO(raw)).read()
                return raw.decode('utf-8', errors='replace')
        except Exception as e:
            last = e
            time.sleep(1.5)
    raise last


def fetch_bytes(url, retries=3):
    if url.startswith('http://'):
        url = 'https://' + url[7:]
    req = urllib.request.Request(url, headers={**HEADERS, 'Accept': 'image/avif,image/webp,image/*,*/*;q=0.8'})
    last = None
    for _ in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read()
        except Exception as e:
            last = e
            time.sleep(1.5)
    raise last


def extract_note_state(html, nid):
    m = re.search(r'window\.__INITIAL_STATE__\s*=\s*(\{.*?\})</script>', html, re.S)
    if not m:
        return None
    s = re.sub(r'\bundefined\b', 'null', m.group(1))
    try:
        st = json.loads(s)
    except json.JSONDecodeError:
        return None
    node = (st.get('note') or {}).get('noteDetailMap', {}).get(nid)
    return (node or {}).get('note')


def style_name(title, desc=''):
    t = re.sub(r'小小东\s*P?\d*', '', title)
    t = re.sub(r'P\d{2,3}', ' ', t)
    parts = [p.strip() for p in re.split(r'[｜|：:]', t) if p.strip()]
    name = max(parts, key=len) if parts else t.strip()
    # 早期标题「博主 x A x B x P069」→ 取中文关键词段拼接
    if re.search(r'(^|\s)[x×](\s|$)', name):
        segs = [s.strip() for s in re.split(r'\s*[x×]\s*', name)
                if s.strip() and re.search(r'[\u4e00-\u9fff]', s)
                and not re.fullmatch(r'[\d\s期]+', s)]
        if len(segs) >= 2:
            name = ''.join(segs)
    # 通用标题（如「一天解锁一个AI提示词」）→ 从正文提取风格名（「重构为 XX插画」或「采用 XX的视觉语言」）
    if re.search(r'提示词|一天解锁', name):
        m = (re.search(r'重构为\*{0,2}\s*([^，。；\n]{2,40})', desc or '')
             or re.search(r'采用\*{0,2}\s*([^，。；\n：]{2,40}?)\s*\*{0,2}(?:的视觉语言|的)', desc or ''))
        if m:
            s = m.group(1).strip('* ').strip()
            segs = [x.strip() for x in re.split(r'[/＋+]', s)]
            cjk = sorted((x for x in segs if re.search(r'[\u4e00-\u9fff]', x)), key=len, reverse=True)
            s = (cjk[0] if cjk else (segs[0] if segs else s))
            s = s.replace('质感的', '').replace('质感', '')
            s = re.sub(r'(插画|设计|风格)+$', '', s).strip()
            s = re.sub(r'\s+', '', s)
            if len(s) >= 3:
                name = s if s.endswith('风') else s + '风'
        else:
            name = '待命名'
    if not name.endswith('风'):
        name += '风'
    return re.sub(r'[\\/:*?\"<>|]', '', name).strip()


def find_num(desc, title):
    m = re.search(r'序号[：:]?\s*0*(\d{1,3})', desc or '')
    if m:
        return int(m.group(1)), '正文'
    m = re.search(r'[Pp](\d{2,3})', title or '')
    if m:
        return int(m.group(1)), '标题'
    return None, None


def cut_desc(desc, note):
    # 去掉开头的导语行：在前几行里找「提示词如下：」这类引导行，从其后开始
    lines = desc.split('\n')
    cut_at = None
    for i, ln in enumerate(lines[:4]):
        s = ln.strip()
        if re.fullmatch(r'[^\n]{0,50}?(?:可以直接复制|提示词如下|提示词是|提示词[:：])\s*[:：]?', s) or s == '提示词：':
            cut_at = i + 1
            break
    if cut_at is not None:
        desc = '\n'.join(lines[cut_at:]).lstrip('\t\n ')
    idxs = []
    for t in note.get('tagList') or []:
        name = t.get('name') or ''
        if name:
            j = desc.find('#' + name)
            if j != -1:
                idxs.append(j)
    for u in note.get('atUserList') or []:
        nick = u.get('nickname') or ''
        if nick:
            j = desc.find('@' + nick)
            if j != -1:
                idxs.append(j)
    for mark in ('完整提示词', '序号：', '序号:'):
        j = desc.find(mark)
        if j != -1:
            idxs.append(j)
    if idxs:
        desc = desc[:min(idxs)]
    # 去掉结尾的作者闲聊/召唤行动句（独立成段的短句，或常见互动套话）
    paras = desc.rstrip().split('\n')
    while paras:
        last = paras[-1].strip()
        is_chitchat = bool(re.match(r'^(感谢|快去|试试|拿去|欢迎|喜欢|收藏|关注|点赞|评论|转发|期待|希望|需要|有问题|等待|直接粘|粘贴|发给|复制)', last))
        if (len(last) <= 14 and (is_chitchat or re.search(r'[!！。~\s]$', last))
                and not re.search(r'[，；：:、]|\*\*|避免|不要|必须|应当|保持|采用|确保', last)):
            paras.pop()
        else:
            break
    return re.sub(r'[\s#]+$', '', '\n'.join(paras).rstrip())


def pick_url(im):
    u = im.get('urlDefault') or ''
    if not u:
        for e in im.get('infoList') or []:
            if e.get('imageScene') == 'WB_DFT':
                u = e.get('url') or ''
                break
    return u or im.get('url') or ''


def classify_board(text):
    """按提示词正文判断板块: transform(照片风格化) / generate(海报生成) / None(待定)。
    generate 优先判定（【主题】/（XXX）占位符、文生图特征明确）；含「照片/原图」且无生成标记 → transform。"""
    if re.search(r'主题为?【|【城市地标|【\S{2,8}】[^】]{0,40}【|[（(]\s*[Xx＊*]{2,6}\s*[)）]|从零生成|无需(上传|照片)|文生图|一张[（(【]', text):
        return 'generate'
    if re.search(r'(上传|每张|每张原照|原图|照片)[\s\S]{0,24}(照片|原照|图|海报)|(照片|原图)中最具识别性|下半部分|上下(两|两个)?(区域|部分|分区)|提取照片|原照实景|保留原[照图]|参考图实景|重新切割照片空间|根据原图的|照片里的|把照片|几张.{0,14}照片', text):
        return 'transform'
    if re.search(r'照片|原图|主体|参考图', text):
        return 'transform'
    return None



def parse_profile(profile):
    """接受完整主页 URL 或裸 uid，返回 (uid, profile_url_or_None)。"""
    m = re.search(r'user/profile/([0-9a-f]{24})', profile or '')
    if m:
        uid = m.group(1)
        url = profile if profile.startswith('http') else None
        return uid, url
    if profile and re.fullmatch(r'[0-9a-f]{24}', profile):
        return profile, None
    raise SystemExit('--profile 需要是主页 URL 或 24 位 uid，收到: %r' % profile)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--profile', help='博主主页 URL（含 xsec_token）或裸 uid；默认=小小东')
    ap.add_argument('--out', default=str(Path(__file__).resolve().parent))
    ap.add_argument('--limit', type=int, default=None,
                    help='本批最多处理条数（默认: 笔记链接模式=全部, 博主模式=10）')
    ap.add_argument('--interval', type=float, default=2.5, help='笔记页访问间隔秒')
    ap.add_argument('--cards', help='卡片列表 JSON（[["noteId","token"],...]）；不填则尝试直接抓主页')
    ap.add_argument('--notes', action='append', default=[],
                    help='笔记链接（完整链接含 xsec_token，可多次传入；也可传 txt 文件每行一条）')
    ap.add_argument('--board', default='auto',
                    help='auto=按正文自动分类 | transform | generate | <新板块名>（即在 out/ 下新建目录）')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--refresh', action='store_true', help='忽略已处理缓存')
    ap.add_argument('--retry-noseries', action='store_true', help='重查此前「无序号」跳过的笔记')
    args = ap.parse_args()
    out = Path(args.out)

    if args.notes:
        uid, profile_url = None, None
    elif args.profile:
        uid, profile_url = parse_profile(args.profile)
    else:
        uid, profile_url = DEFAULT_USER_ID, DEFAULT_PROFILE_URL
    note_url = (None if uid is None else
                'https://www.xiaohongshu.com/user/profile/' + uid +
                '/{nid}?xsec_token={tok}&xsec_source=pc_user')

    # 板块解析: transform→collection/, generate→generation/, 其他名字→out/<名字>/, auto 在循环内逐条判定
    board_dirs = {}
    def board_dir(board):
        if board not in board_dirs:
            d = out / BOARD_DIRS.get(board, board)
            d.mkdir(parents=True, exist_ok=True)
            board_dirs[board] = d
        return board_dirs[board]

    def board_max_num(board):
        d = board_dir(board)
        nums = [int(m.group(1)) for p in d.iterdir()
                for m in [re.match(r'组(\d+)_', p.name)] if m]
        return max(nums) if nums else 0

    done_path = out / ('xhs_done_notes.json' if args.notes else 'xhs_done_%s.json' % uid)
    done_ids = set()
    if done_path.exists() and not args.refresh:
        try:
            done_ids = set(json.loads(done_path.read_text(encoding='utf-8')))
        except Exception:
            done_ids = set()

    def mark_done(nid):
        if args.dry_run:
            return  # 试运行不写缓存
        done_ids.add(nid)
        done_path.write_text(json.dumps(sorted(done_ids), ensure_ascii=False), encoding='utf-8')

    noseries_path = out / ('xhs_noseries_notes.json' if args.notes else 'xhs_noseries_%s.json' % uid)
    noseries = {}
    if noseries_path.exists():
        try:
            noseries = json.loads(noseries_path.read_text(encoding='utf-8'))
        except Exception:
            noseries = {}

    def mark_noseries(nid, title):
        noseries[nid] = title
        noseries_path.write_text(json.dumps(noseries, ensure_ascii=False, indent=1), encoding='utf-8')

    def retry_noseries(nid):
        return args.retry_noseries and done_ids.discard(nid) is None

    def parse_note_url(u):
        m = re.search(r'(?:/explore/|/discovery/item/|/user/profile/[0-9a-f]{24}/)([0-9a-f]{24})', u)
        return m.group(1) if m else None

    items = []  # (noteId, 抓取URL)
    if args.notes:
        raw_urls = []
        for val in args.notes:
            p = Path(val)
            if p.exists():
                raw_urls += [ln.strip() for ln in p.read_text(encoding='utf-8').splitlines()
                             if ln.strip() and not ln.strip().startswith('#')]
            else:
                raw_urls += [x.strip() for x in re.split(r'[\s,]+', val) if x.strip()]
        seen_urls = set()
        for u in raw_urls:
            if not u.startswith('http'):
                u = 'https://' + u
            nid = parse_note_url(u)
            if not nid:
                print(f'[忽略] 无法解析笔记链接: {u[:80]}')
                continue
            if nid in seen_urls:
                continue
            seen_urls.add(nid)
            items.append((nid, u))
        print(f'笔记链接模式: 解析到 {len(items)} 条笔记')
    elif args.cards:
        cards = [tuple(c) for c in json.loads(Path(args.cards).read_text(encoding='utf-8'))]
        items = [(nid, note_url.format(nid=nid, tok=tok)) for nid, tok in cards]
        print(f'从 {args.cards} 读取 {len(cards)} 张卡片（博主 uid {uid[:8]}…）')
    else:
        print('抓取主页 …')
        html = fetch_text(profile_url)
        items, seen = [], set()
        for m in re.finditer(r'/user/profile/' + uid + r'/([0-9a-f]{24})\?xsec_token=([^&\"\']+)', html):
            if m.group(1) not in seen:
                seen.add(m.group(1))
                items.append((m.group(1), note_url.format(nid=m.group(1), tok=m.group(2))))
        print(f'主页解析到 {len(items)} 张笔记卡片（最新在前）')
    if not items:
        print('!! 未能解析出任何笔记: 用 --notes 传笔记链接, 或用浏览器打开博主主页导出 --cards JSON')
        return
    limit = args.limit if args.limit is not None else (len(items) if args.notes else 10)

    ok, skipped, failed = [], [], []
    done = 0
    for nid, fetch_url in items:
        if done >= limit:
            break
        if nid in done_ids and not retry_noseries(nid):
            print(f'[缓存] {nid} 已处理过，跳过')
            continue
        time.sleep(args.interval)
        try:
            note = extract_note_state(fetch_text(fetch_url), nid)
        except Exception as e:
            failed.append((nid, f'抓取失败: {e}'))
            print(f'[失败] {nid}: {e}')
            continue
        if not note:
            skipped.append((nid, '页面无笔记数据(登录墙/风控)'))
            print(f'[跳过] {nid}: 页面无笔记数据')
            continue
        ntype = note.get('type')
        title = (note.get('title') or '').strip()
        desc = note.get('desc') or ''
        if ntype != 'normal':
            skipped.append((nid, f'非图文笔记({ntype})「{title}」'))
            print(f'[跳过] {title}: 类型 {ntype}')
            mark_done(nid)
            continue
        num, src = find_num(desc, title)
        if num is None:
            # 无序号帖子：正文能直接复制到完整提示词的也收
            kept_probe = cut_desc(desc, note)
            has_attach = bool(re.search(r'放附件|见附件|附件[里在]|附件[:：]', desc))
            if len(kept_probe) >= 120 and not has_attach:
                board0 = (args.board if args.board != 'auto' else (classify_board(kept_probe) or 'inbox'))
                num = board_max_num(board0) + 1
                src = '顺延编号'
                print(f'[收录] {title}: 无序号但正文可直接复制，编为 组{num:02d}（板块 {board0}）')
            else:
                why = '提示词在附件' if has_attach else '正文过短/合集'
                skipped.append((nid, f'{why}「{title}」'))
                print(f'[跳过] {title}: {why}')
                mark_noseries(nid, title)
                mark_done(nid)
                continue
        plain = cut_desc(desc, note)
        # 板块判定（数据库重构后每板块独立目录、独立编号）
        if args.board == 'auto':
            board = classify_board(plain) or 'inbox'
            if board == 'inbox' and classify_board(desc):
                board = classify_board(desc)
        else:
            board = args.board
        bdir = board_dir(board)
        # 编号冲突（约定：组NN 仅去重用）。同一篇：图片不少于现有 → 跳过，更全 → 续号并入；不同内容 → 让位到板块最大号+1
        prefix = '组%02d_' % num
        exist = next(iter(bdir.glob(prefix + '*')), None)
        merged_into = None
        if exist is not None:
            try:
                old = (exist / '提示词.txt').read_text(encoding='utf-8-sig')
                ratio = difflib.SequenceMatcher(None, old.strip(), plain).ratio()
            except Exception:
                ratio = 0.0
            have = len([f for f in exist.glob('*.jpg') if re.fullmatch(r'\d+\.jpg', f.name)])
            total_imgs = len(note.get('imageList') or [])
            if ratio >= 0.98 and have >= total_imgs:
                skipped.append((nid, f'同序号已存在 {exist.name}「{title}」'))
                print(f'[跳过] {title}: 同序号 {exist.name} 已存在')
                mark_done(nid)
                continue
            if ratio >= 0.98:
                merged_into = exist
                folder = exist
                print(f'[合并] {title}: 与 {exist.name} 文本相同且图片更全（{have}→{total_imgs}），续号并入')
            else:
                num = board_max_num(board) + 1
                folder = bdir / ('组%02d_%s' % (num, style_name(title, desc)))
                print(f'[改号] {title}: 序号 {prefix} 已有 {exist.name}，改用 组{num:02d}')
        else:
            folder = bdir / (prefix + style_name(title, desc))
        urls = [u for u in (pick_url(im) for im in (note.get('imageList') or [])) if u]
        if not urls:
            skipped.append((nid, f'无图片「{title}」'))
            print(f'[跳过] {title}: 无图片')
            mark_done(nid)
            continue
        if args.dry_run:
            ok.append((folder.name, len(urls), src, title))
            done += 1
            print(f'[将下载] {folder.name} | {len(urls)}图 | 序号来源:{src} | {desc[:30]}…')
            continue
        imgs = []
        try:
            for u in urls:
                data = fetch_bytes(u)
                im = Image.open(io.BytesIO(data))
                if im.mode != 'RGB':
                    im = im.convert('RGB')
                imgs.append(im)
                time.sleep(0.25)
        except Exception as e:
            failed.append((nid, f'图片下载失败: {e}「{title}」'))
            print(f'[失败] {title}: 图片下载失败 {e}')
            continue
        text = plain.replace('\r\n', '\n').replace('\r', '\n').replace('\n', '\r\n') + '\r\n'
        if merged_into is not None:
            have_list = sorted(int(f.stem) for f in folder.glob('*.jpg') if re.fullmatch(r'\d+', f.stem))
            start = (have_list[-1] if have_list else 0) + 1
        else:
            folder.mkdir(parents=True)
            start = 1
            (folder / '提示词.txt').write_bytes(b'\xef\xbb\xbf' + text.encode('utf-8'))
        for i, im in enumerate(imgs, start):
            im.save(folder / ('%02d.jpg' % i), 'JPEG', quality=95)
        ok.append((folder.name, len(imgs), src, title))
        done += 1
        mark_done(nid)
        print(f'[完成] {folder.name} | {len(imgs)}图 | 序号来源:{src} | {desc[:30]}…')

    print('\n========== 本批结果 ==========')
    print(f'下载成功 {len(ok)} 条:')
    for name, n, src, title in ok:
        print(f'  {name}  ({n}图, 序号来自{src})')
    print(f'跳过 {len(skipped)} 条:')
    for nid, why in skipped:
        print(f'  {why}')
    print(f'失败 {len(failed)} 条:')
    for nid, why in failed:
        print(f'  {why}')


if __name__ == '__main__':
    main()
