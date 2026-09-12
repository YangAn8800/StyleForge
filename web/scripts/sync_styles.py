# -*- coding: utf-8 -*-
"""同步脚本: collection/generation(/inbox) → web/data/styles.json + web/public/styles/

用法:
  cd web && python scripts/sync_styles.py            # 全量同步
  python scripts/sync_styles.py --clean              # 同步并清理 public/styles 下的旧目录
  python scripts/sync_styles.py --run-tags           # 同步后自动运行 extract_tags.py

规则:
  - 板块映射与 scripts/extract_tags.py 的 BOARDS 一致: transform→collection, generate→generation;
    inbox/ 里的组也同步为 transform 待定? 否——inbox 是待定区, 默认不同步, 用 --include-inbox 临时开启。
  - id = "{type}-{num}" (如 transform-93 / generate-02); 目录名 组NN_风格名 中的 NN 即 num。
  - 每个组: prompt 取 提示词.txt (utf-8-sig), images 为目录下按序号命名的 jpg。
  - 图片拷贝到 public/styles/{id}/; 旧数据里同 id 已有的 tags 保留(由 extract_tags.py 重算覆盖)。
"""
import argparse, json, re, shutil, sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

WEB = Path(__file__).resolve().parent.parent
ROOT = WEB.parent
DATA = WEB / 'data'
PUBLIC = WEB / 'public' / 'styles'

BOARDS = {'transform': 'collection', 'generate': 'generation'}

BOARD_LABELS = {
    'transform': '照片风格化',
    'generate': '海报生成',
}


def read_prompt(group_dir: Path) -> str:
    raw = (group_dir / '提示词.txt').read_bytes()
    return raw.decode('utf-8-sig').replace('\r\n', '\n').rstrip('\n')


def collect_board(board: str):
    src = ROOT / BOARDS[board]
    items = []
    for d in sorted(src.iterdir()):
        m = re.match(r'组(\d+)_(.+)', d.name)
        if not (m and d.is_dir()):
            continue
        num, name = m.group(1), m.group(2)
        prompt = read_prompt(d)
        images = sorted(
            [f.name for f in d.iterdir() if re.fullmatch(r'\d+\.jpg', f.name)],
            key=lambda s: int(s.split('.')[0]))
        if not prompt or not images:
            print(f'[跳过] {d.name}: 缺提示词或图片')
            continue
        items.append({
            'id': f'{board}-{num}',
            'num': num,
            'name': name,
            'type': board,
            'cover': f'/styles/{board}-{num}/{images[0]}',
            'images': [f'/styles/{board}-{num}/{im}' for im in images],
            'prompt': prompt,
        })
    return items


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--clean', action='store_true', help='清理 public/styles 中不在库里的目录')
    ap.add_argument('--run-tags', action='store_true', help='同步后运行 extract_tags.py')
    ap.add_argument('--include-inbox', action='store_true', help='把 inbox/ 待定组也同步进来')
    args = ap.parse_args()

    old = {s['id']: s for s in json.loads((DATA / 'styles.json').read_text(encoding='utf-8'))} \
        if (DATA / 'styles.json').exists() else {}

    styles = []
    for board in BOARDS:
        items = collect_board(board)
        styles += items
        print(f'[{board}] {BOARDS[board]}: {len(items)} 组')
    if args.include_inbox and (ROOT / 'inbox').exists():
        for d in sorted((ROOT / 'inbox').iterdir()):
            m = re.match(r'组(\d+)_(.+)', d.name)
            if not m:
                continue
            print(f'[警告] inbox 未归位: {d.name}（默认不同步）')

    # tags: 优先从 tags.json 的结构化标签拍平（词表已覆盖时最准），无则沿用旧值
    tags_data = {}
    if (DATA / 'tags.json').exists():
        try:
            tags_data = json.loads((DATA / 'tags.json').read_text(encoding='utf-8')).get('groups', {})
        except Exception:
            tags_data = {}
    kept_tags = 0
    for s in styles:
        g = tags_data.get(s['id'])
        if g and g.get('tags'):
            flat = []
            for vals in g['tags'].values():
                flat += [v for v in vals if v not in flat]
            s['tags'] = flat[:6]
            kept_tags += 1
        elif s['id'] in old and 'tags' in old[s['id']]:
            s['tags'] = old[s['id']]['tags']
        else:
            s['tags'] = []
    lost = [i for i in old if i not in {s['id'] for s in styles}]
    if lost:
        print(f'[提示] 旧 styles.json 中 {len(lost)} 条已不在库: {lost[:6]}')

    (DATA / 'styles.json').write_text(
        json.dumps(styles, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'styles.json: {len(styles)} 条 (保留 tags {kept_tags} 条)')

    # 拷贝图片
    PUBLIC.mkdir(parents=True, exist_ok=True)
    copied = 0
    for s in styles:
        dst = PUBLIC / s['id']
        board = s['type']
        src_dir = ROOT / BOARDS[board] / f"组{s['num']}_{s['name']}"
        if not src_dir.exists():
            print(f'[错误] 找不到源目录: {src_dir}')
            continue
        need = {im.name for im in src_dir.iterdir() if re.fullmatch(r'\d+\.jpg', im.name)}
        if not (dst.exists() and {f.name for f in dst.iterdir()} == need):
            if dst.exists():
                shutil.rmtree(dst)
            dst.mkdir(parents=True)
            for im in sorted((f for f in src_dir.iterdir()
                              if re.fullmatch(r'\d+\.jpg', f.name)),
                             key=lambda p: int(p.stem)):
                if im.name in need:
                    shutil.copy2(im, dst / im.name)
                    copied += 1
    print(f'图片: 拷贝 {copied} 张')

    # 清理: public/styles 里不在当前 id 集合里的目录
    if args.clean:
        valid = {s['id'] for s in styles}
        removed = 0
        for d in PUBLIC.iterdir():
            if d.is_dir() and d.name not in valid:
                shutil.rmtree(d)
                removed += 1
        print(f'清理: 移除 {removed} 个废弃目录')

    if args.run_tags:
        import subprocess
        r = subprocess.run([sys.executable, str(WEB / 'scripts' / 'extract_tags.py')],
                           cwd=str(WEB))
        sys.exit(r.returncode)


if __name__ == '__main__':
    main()
