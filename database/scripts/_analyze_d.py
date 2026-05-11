import re, sys
TOKEN_RE = re.compile(r'"((?:[^"\\]|\\.)*)"|(\?)|(\S+)')

path = sys.argv[1]
n = int(sys.argv[2]) if len(sys.argv) > 2 else 3

with open(path, encoding='latin-1', errors='replace') as f:
    lines = f.readlines()
merged, buf = [], ''
for raw in lines:
    line = raw.rstrip('\r\n')
    buf = (buf + ' ' + line.strip()) if buf else line
    if buf.count('"') % 2 == 0:
        merged.append(buf); buf = ''
if buf: merged.append(buf)

count = 0
for ln in merged:
    s = ln.strip()
    if not s or s == '.': continue
    toks = [m.group(1) if m.group(1) is not None else ('?' if m.group(2) else m.group(3)) for m in TOKEN_RE.finditer(s)]
    if len(toks) > 2:
        print(f'{len(toks)} tokens')
        for i,t in enumerate(toks): print(f'  [{i}] {repr(t)[:90]}')
        count += 1
        if count >= n: break
