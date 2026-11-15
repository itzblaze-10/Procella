#!/usr/bin/env python3
"""Fetch real OpenStreetMap buildings, roads, water and parks for the cities in app/CITIES.md.

Writes app/data/cities/<slug>.json (format in app/CITIES.md) and rebuilds index.json.
Resumable: a city whose file exists is skipped unless --force. Raw Overpass responses are cached
in --raw (default .tmp/overpass) so a --force rebuild does not hit the network again.

    python3 scripts/fetch_cities.py                 # all cities, in CITIES.md order
    python3 scripts/fetch_cities.py paris tokyo     # just these
    python3 scripts/fetch_cities.py --force --refetch dubai

Data: (c) OpenStreetMap contributors, ODbL. Stdlib only.
"""
import argparse, datetime, json, math, os, re, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'app', 'data', 'cities')
ENDPOINTS = ['https://overpass-api.de/api/interpreter',
             'https://maps.mail.ru/osm/tools/overpass/api/interpreter']
UA = 'ProcellaHackathon/1.0 (education)'
RADIUS = 1400                # metres
L = RADIUS * 10              # clip square half-size, decimetres
MAX_BYTES = 900_000
# (simplify tolerance m, min building area m2, drop footpaths) - first stage is the spec, the rest trim
STAGES = [(0.6, 12, False), (1.0, 20, False), (1.0, 20, True), (1.5, 30, True), (2.0, 50, True), (3.0, 150, True)]


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def cities():
    txt = open(os.path.join(ROOT, 'app', 'CITIES.md'), encoding='utf-8').read()
    block = txt.split('## City list')[1].split('## Data files')[0]
    out = []
    for part in block.replace('\n', '|').split('|'):
        m = re.fullmatch(r'([a-z-]+) (.+) (-?\d+\.\d+) (-?\d+\.\d+)', part.strip())
        if m:
            slug, label, lat, lon = m.groups()
            name, _, country = label.partition(', ')
            out.append(dict(slug=slug, name=name, country=country or name, lat=float(lat), lon=float(lon)))
    assert len(out) == 30, f'parsed {len(out)} cities from CITIES.md'
    return out


# ---------------------------------------------------------------- Overpass

GREEN = ['["natural"="water"]', '["waterway"="riverbank"]', '["water"~"^(river|canal)$"]',
         '["leisure"~"^(park|garden)$"]', '["landuse"~"^(grass|forest|recreation_ground)$"]']


def query(c, parts):
    dlat = RADIUS / 111320
    dlon = RADIUS / (111320 * math.cos(math.radians(c['lat'])))
    bb = f"{c['lat'] - dlat:.6f},{c['lon'] - dlon:.6f},{c['lat'] + dlat:.6f},{c['lon'] + dlon:.6f}"
    q = []
    if 'b' in parts:
        q += [f'way["building"]({bb});', f'relation["building"]({bb});']
    if 'r' in parts:
        q += [f'way["highway"]({bb});']
    if 'g' in parts:
        q += [f'{t}{f}({bb});' for f in GREEN for t in ('way', 'relation')]
    return '[out:json][timeout:180];(' + ''.join(q) + ');out geom;'


def post(q, url):
    body = urllib.parse.urlencode({'data': q}).encode()
    req = urllib.request.Request(url, data=body, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=300) as r:
        d = json.loads(r.read())
    remark = d.get('remark', '')
    if 'error' in remark.lower() or 'timed out' in remark.lower():
        raise RuntimeError('remark: ' + remark[:160])
    return d


def fetch(q, tries):
    for i in range(tries):
        url = ENDPOINTS[i % 2]
        try:
            t = time.time()
            d = post(q, url)
            log(f'    ok {url.split("/")[2]} {time.time() - t:.0f}s, {len(d["elements"])} elements')
            return d['elements']
        except Exception as e:  # HTTP 429/504, socket timeout, bad JSON, Overpass remark
            log(f'    try {i + 1}/{tries} {url.split("/")[2]} failed: {str(e)[:160]}')
            time.sleep(min(60, 5 * 2 ** i))
    return None


def fetch_city(c):
    """One combined query; if that keeps failing, three smaller ones."""
    els = fetch(query(c, 'brg'), 3)
    if els is not None:
        return els
    log('  combined query failed, splitting')
    els = []
    for part in 'brg':
        time.sleep(5)
        got = fetch(query(c, part), 6)
        if got is None:
            raise RuntimeError(f'Overpass refused part {part!r} after retries')
        els += got
    return els


# ---------------------------------------------------------------- geometry (decimetres)

def projector(c):
    k = 111320 * 10
    kx = k * math.cos(math.radians(c['lat']))
    return lambda g: [((p['lon'] - c['lon']) * kx, -(p['lat'] - c['lat']) * k) for p in g if p]


def _cut(a, b, axis, v):
    t = (v - a[axis]) / (b[axis] - a[axis])
    return (a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]))


def clip_ring(pts):
    """Sutherland-Hodgman against the square |x|,|z| <= L. Ring is implicitly closed."""
    for axis, sign in ((0, 1), (0, -1), (1, 1), (1, -1)):
        if not pts:
            break
        out, prev = [], pts[-1]
        for cur in pts:
            cin, pin = sign * cur[axis] <= L, sign * prev[axis] <= L
            if cin != pin:
                out.append(_cut(prev, cur, axis, sign * L))
            if cin:
                out.append(cur)
            prev = cur
        pts = out
    return pts


def clip_line(pts):
    """Liang-Barsky per segment; returns the pieces inside the square."""
    lines, cur = [], []
    for a, b in zip(pts, pts[1:]):
        dx, dy, t0, t1 = b[0] - a[0], b[1] - a[1], 0.0, 1.0
        for p, q in ((-dx, a[0] + L), (dx, L - a[0]), (-dy, a[1] + L), (dy, L - a[1])):
            if p == 0:
                if q < 0:
                    t0, t1 = 1, 0
            elif p < 0:
                t0 = max(t0, q / p)
            else:
                t1 = min(t1, q / p)
        if t0 > t1:
            if cur:
                lines.append(cur)
            cur = []
            continue
        P = a if t0 == 0 else (a[0] + t0 * dx, a[1] + t0 * dy)
        Q = b if t1 == 1 else (a[0] + t1 * dx, a[1] + t1 * dy)
        if cur and cur[-1] == P:
            cur.append(Q)
        else:
            if cur:
                lines.append(cur)
            cur = [P, Q]
    if cur:
        lines.append(cur)
    return lines


def dp(pts, tol):
    """Douglas-Peucker, iterative."""
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        i, j = stack.pop()
        a, b = pts[i], pts[j]
        dx, dy = b[0] - a[0], b[1] - a[1]
        n = math.hypot(dx, dy)
        best, bi = 0, -1
        for k in range(i + 1, j):
            p = pts[k]
            d = abs(dx * (a[1] - p[1]) - dy * (a[0] - p[0])) / n if n else math.hypot(p[0] - a[0], p[1] - a[1])
            if d > best:
                best, bi = d, k
        if best > tol:
            keep[bi] = True
            stack += [(i, bi), (bi, j)]
    return [p for p, k in zip(pts, keep) if k]


def area(pts):  # m2, pts in dm
    return abs(sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(pts, pts[1:] + pts[:1]))) / 200


def to_int(pts):
    out = []
    for x, z in pts:
        p = (round(x), round(z))
        if not out or out[-1] != p:
            out.append(p)
    return out


def ring(pts, tol, min_area):
    """Raw projected ring -> clipped, simplified integer ring, or None."""
    if len(pts) > 1 and pts[0] == pts[-1]:
        pts = pts[:-1]
    pts = clip_ring(pts)
    if len(pts) < 3:
        return None
    pts = to_int(dp(pts + pts[:1], tol * 10)[:-1])
    if len(pts) > 1 and pts[0] == pts[-1]:
        pts.pop()
    if len(pts) < 3 or area(pts) < min_area:
        return None
    return pts


def stitch(ways):
    """Join member ways (lists of points) into closed rings."""
    ways = [w for w in ways if len(w) > 1]
    rings = []
    while ways:
        cur = ways.pop()
        while cur[0] != cur[-1]:
            for i, w in enumerate(ways):
                if w[0] == cur[-1]:
                    cur += w[1:]
                elif w[-1] == cur[-1]:
                    cur += w[::-1][1:]
                else:
                    continue
                ways.pop(i)
                break
            else:
                break  # open ring: close implicitly
        rings.append(cur)
    return rings


def outer_inner(el, proj):
    """Element -> (outer rings, inner rings) as projected point lists."""
    if el['type'] == 'way':
        return [proj(el.get('geometry', []))], []
    o, i = [], []
    for m in el.get('members', []):
        if m.get('type') == 'way' and m.get('geometry'):
            (i if m.get('role') == 'inner' else o if m.get('role') in ('outer', 'outline', '') else []).append(
                [(p['lon'], p['lat']) for p in m['geometry'] if p])
    back = lambda rs: [proj([{'lon': x, 'lat': y} for x, y in r]) for r in stitch(rs)]
    return back(o), back(i)


# ---------------------------------------------------------------- tags

KINDS = {
    1: 'apartments residential dormitory flats',
    2: 'office commercial hotel',
    3: 'retail supermarket shop mall department_store',
    4: 'industrial warehouse factory manufacture hangar storage_tank service transformer_tower',
    5: 'church cathedral chapel mosque temple synagogue shrine religious monastery',
    6: 'house detached semidetached_house terrace bungalow villa farm houseboat static_caravan',
    7: 'civic public school university college government hospital train_station transportation '
       'kindergarten fire_station townhall stadium museum library',
    8: 'castle palace monument',
}
KIND = {v: k for k, vs in KINDS.items() for v in vs.split()}
AMENITY = {'place_of_worship': 5, **{a: 7 for a in 'school university college hospital townhall library courthouse '
                                                 'police fire_station theatre kindergarten'.split()}}
DEFAULT_M = {0: 12, 1: 18, 2: 30, 3: 8, 4: 10, 5: 18, 6: 7, 7: 14, 8: 14}
SMALL = set('garage garages shed carport roof hut kiosk toilets cabin'.split())  # 4 m sheds and canopies

ROAD = {**{k: 0 for k in 'motorway trunk motorway_link trunk_link'.split()},
        **{k: 1 for k in 'primary primary_link'.split()},
        **{k: 2 for k in 'secondary tertiary secondary_link tertiary_link'.split()},
        **{k: 3 for k in 'residential unclassified service living_street road'.split()},
        **{k: 4 for k in 'pedestrian footway path cycleway steps track bridleway'.split()}}


def num(v):
    """'45', '45 m', '45,5', '150\'', '12\'6"' -> metres (float) or None."""
    if not v:
        return None
    v = v.split(';')[0].strip().lower().replace(',', '.')
    m = re.match(r'(\d+(?:\.\d+)?)\s*(m|meters?|metres?|ft|feet|\')?\s*(?:(\d+(?:\.\d+)?)\s*(?:"|in))?', v)
    if not m:
        return None
    x = float(m.group(1))
    if m.group(2) in ('ft', 'feet', "'"):
        x = x * 0.3048 + float(m.group(3) or 0) * 0.0254
    return x


def kind_of(t):
    k = KIND.get(t.get('building'), 0) or AMENITY.get(t.get('amenity'), 0)
    if not k and t.get('historic', 'no') != 'no':
        k = 8
    return k


def heights(t, k):
    h = num(t.get('height'))
    if h is None or not 0 < h <= 900:  # ponytail: >900 m is a typo (Burj Khalifa is 828 m)
        lv = num(t.get('building:levels'))
        if lv and 0 < lv < 200:
            h = (lv + (num(t.get('roof:levels')) or 0)) * 3.2
        else:
            h = 4 if t.get('building') in SMALL else DEFAULT_M[k]
    mh = num(t.get('min_height'))
    if mh is None:
        ml = num(t.get('building:min_level'))
        mh = ml * 3.2 if ml else 0
    if mh >= h:
        mh = 0
    return round(h * 10), round(mh * 10)


# ---------------------------------------------------------------- build one city

def build(c, els, tol, min_area, drop_paths):
    proj = projector(c)
    b, r, w, p = [], [], [], []
    seen = set()
    for el in els:
        key = (el['type'], el['id'])
        if key in seen:
            continue
        seen.add(key)
        t = el.get('tags', {})
        if t.get('building') and t['building'] != 'no':
            if t.get('location') == 'underground':
                continue
            k = kind_of(t)
            h, mh = heights(t, k)
            outers, _ = outer_inner(el, proj)
            for o in outers:
                if not o:
                    continue
                cx, cz = sum(q[0] for q in o) / len(o), sum(q[1] for q in o) / len(o)
                if math.hypot(cx, cz) > L:
                    continue
                g = ring(o, tol, min_area)
                if g:
                    b.append([h, mh, k] + [v for q in g for v in q])
        elif t.get('highway') in ROAD and el['type'] == 'way':
            cls = ROAD[t['highway']]
            if (t.get('tunnel', 'no') != 'no' or (drop_paths and cls == 4)
                    or t.get('footway') in ('sidewalk', 'crossing')):  # sidewalks duplicate the road
                continue
            for piece in clip_line(proj(el.get('geometry', []))):
                g = to_int(dp(piece, tol * 10))
                if len(g) > 1:
                    r.append([cls] + [v for q in g for v in q])
        else:
            water = (t.get('natural') == 'water' or t.get('waterway') == 'riverbank'
                     or t.get('water') in ('river', 'canal'))
            green = (t.get('leisure') in ('park', 'garden')
                     or t.get('landuse') in ('grass', 'forest', 'recreation_ground'))
            if not (water or green):
                continue
            if water and t.get('water') in ('lagoon', 'bay', 'sea'):
                continue  # open sea and lagoons come from the terrain
            outers, inners = outer_inner(el, proj)
            outs = [g for g in (ring(o, tol, 12) for o in outers) if g]
            ins = [g for g in (ring(i, tol, 12) for i in inners) if g]
            # No holes in the format: skip a polygon whose holes are a large share (islands, city blocks).
            if outs and sum(map(area, ins)) > 0.25 * sum(map(area, outs)):
                if tol == STAGES[0][0]:
                    log(f'    skipped {key} {t.get("name", "")!r}: holes cover >25%')
                continue
            for g in outs:
                (w if water else p).append([v for q in g for v in q])
    # biggest buildings first so a renderer can LOD by index
    b.sort(key=lambda e: -area(list(zip(e[3::2], e[4::2]))))
    return b, r, w, p


def make_city(c, els):
    for n, (tol, min_area, drop_paths) in enumerate(STAGES):
        b, r, w, p = build(c, els, tol, min_area, drop_paths)
        doc = {'slug': c['slug'], 'name': c['name'], 'country': c['country'], 'lat': c['lat'], 'lon': c['lon'],
               'radius': RADIUS,
               'source': '© OpenStreetMap contributors, ODbL. Overpass API, fetched '
                         + datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=5, minutes=30))).strftime('%Y-%m-%d'),
               'b': b, 'r': r, 'w': w, 'p': p}
        if n:
            doc['trimmed'] = {'tolerance_m': tol, 'min_building_m2': min_area, 'footpaths_dropped': drop_paths}
        s = json.dumps(doc, separators=(',', ':'), ensure_ascii=False)
        if len(s.encode()) <= MAX_BYTES or n == len(STAGES) - 1:
            return s, len(b)
        log(f'    {len(s.encode()) // 1000} KB > {MAX_BYTES // 1000} KB, trimming')


def write_index(all_cities):
    idx = []
    for c in all_cities:
        f = os.path.join(OUT, c['slug'] + '.json')
        if not os.path.exists(f):
            continue
        d = json.load(open(f, encoding='utf-8'))
        idx.append({k: c[k] for k in ('slug', 'name', 'country', 'lat', 'lon')} | {
            'radius': RADIUS, 'buildings': len(d['b']), 'roads': len(d['r']), 'water': len(d['w']),
            'parks': len(d['p']), 'bytes': os.path.getsize(f), 'trimmed': 'trimmed' in d})
    with open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8') as fh:
        json.dump(idx, fh, separators=(',', ':'), ensure_ascii=False)
    return idx


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('slugs', nargs='*')
    ap.add_argument('--force', action='store_true', help='rebuild cities whose file exists')
    ap.add_argument('--refetch', action='store_true', help='ignore the raw cache')
    ap.add_argument('--raw', default=os.path.join(ROOT, '.tmp', 'overpass'))
    a = ap.parse_args()
    all_cities = cities()
    todo = [c for c in all_cities if not a.slugs or c['slug'] in a.slugs]
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(a.raw, exist_ok=True)
    failed = []
    for c in todo:
        f = os.path.join(OUT, c['slug'] + '.json')
        if os.path.exists(f) and not a.force:
            log(f'{c["slug"]}: exists, skipped')
            continue
        log(f'{c["slug"]}:')
        raw = os.path.join(a.raw, c['slug'] + '.json')
        try:
            if os.path.exists(raw) and not a.refetch:
                els = json.load(open(raw, encoding='utf-8'))
            else:
                els = fetch_city(c)
                json.dump(els, open(raw, 'w', encoding='utf-8'))
                time.sleep(5)  # be polite between cities
        except RuntimeError as e:
            log(f'  FAILED: {e}')
            failed.append(c['slug'])
            continue
        s, nb = make_city(c, els)
        with open(f + '.part', 'w', encoding='utf-8') as fh:
            fh.write(s)
        os.replace(f + '.part', f)
        log(f'  {nb} buildings, {len(s.encode()) // 1000} KB')
        write_index(all_cities)
    idx = write_index(all_cities)
    log(f'index: {len(idx)} cities, {sum(e["bytes"] for e in idx) // 1000} KB total')
    if failed:
        log('FAILED: ' + ' '.join(failed))
        sys.exit(1)


if __name__ == '__main__':
    main()
