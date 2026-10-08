#!/usr/bin/env python3
"""Load a Blossom week bank into Sow's Blossom lane (idempotent).
   python3 sow_blossom_import.py [manifest.json]   (default: /home/user/tab/files/blossom-social/week1/manifest.json)
Manifest: {complete, timezone, posts:[{id,date,time,series,title,files:[abs jpg paths],caption}]}
Images -> Supabase Storage sow-media/blossom/<id>/<n>-<sha8>.jpg (+ a 270px thumb t<n>-<sha8>.jpg), uploaded only when new.
Then POST https://sow-ng.vercel.app/api/blossom {action:'import'} with x-sow-key: new posts are added; unposted posts get new
captions/images/times; posted ones are left alone. Secrets are read from files and never printed."""
import sys, json, hashlib, io, requests
from PIL import Image
MAN = sys.argv[1] if len(sys.argv) > 1 else '/home/user/tab/files/blossom-social/week1/manifest.json'
def envf(p): return {l.split('=', 1)[0]: l.split('=', 1)[1].strip().strip('"') for l in open(p) if '=' in l and not l.startswith('#')}
SK = envf('/home/user/tab/files/.blossom-supabase-secret.env')['SUPABASE_SECRET_KEY']
KEY = envf('/home/user/tab/files/.sow-secrets.env')['SOW_API_KEY']
SB = 'https://rlbrhpjljjgpqpqjrpkc.supabase.co'; APP = 'https://sow-ng.vercel.app'
def pub(path): return f'{SB}/storage/v1/object/public/sow-media/{path}'
def upload(path, data):
    if requests.head(pub(path), timeout=30).status_code == 200: return pub(path), False
    r = requests.post(f'{SB}/storage/v1/object/sow-media/{path}', headers={'apikey': SK, 'Authorization': 'Bearer ' + SK, 'Content-Type': 'image/jpeg', 'x-upsert': 'true', 'Cache-Control': 'max-age=31536000'}, data=data, timeout=120)
    assert r.ok, (path, r.status_code, r.text[:200]); return pub(path), True
def as_jpeg(fp):
    b = open(fp, 'rb').read()
    im = Image.open(io.BytesIO(b))
    if im.format == 'JPEG' and im.mode == 'RGB' and len(b) <= 4 * 1024 * 1024: return b, im
    im = im.convert('RGB'); o = io.BytesIO(); im.save(o, 'JPEG', quality=90, optimize=True, progressive=True); return o.getvalue(), im
m = json.load(open(MAN)); posts = []; up = 0
for p in m['posts']:
    imgs = []
    for n, fp in enumerate(p['files'], 1):
        data, im = as_jpeg(fp); sha = hashlib.sha1(data).hexdigest()[:8]
        url, new = upload(f"blossom/{p['id']}/{n}-{sha}.jpg", data); up += new
        t = im.copy(); t.thumbnail((270, 338)); o = io.BytesIO(); t.save(o, 'JPEG', quality=80, optimize=True)
        turl, new2 = upload(f"blossom/{p['id']}/t{n}-{sha}.jpg", o.getvalue()); up += new2
        imgs.append({'url': url, 'thumb': turl, 'bytes': len(data), 'sha': sha})
    posts.append({'id': p['id'], 'date': p['date'], 'time': p['time'], 'series': p['series'], 'title': p.get('title', ''), 'caption': p['caption'], 'images': imgs})
r = requests.post(APP + '/api/blossom', headers={'x-sow-key': KEY, 'Content-Type': 'application/json'}, json={'action': 'import', 'posts': posts}, timeout=120)
assert r.ok, (r.status_code, r.text[:300]); j = r.json()
print(json.dumps({'manifest_complete': m.get('complete'), 'manifest_posts': len(m['posts']), 'files_uploaded': up, 'added': j['added'], 'updated': j['updated'], 'kept': j['kept'], 'lane_posts': len(j['posts']),
                  'lane_dates': sorted(set(x['date'] for x in j['posts']))}, indent=1))
