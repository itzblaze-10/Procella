#!/usr/bin/env python3
"""Deploy a folder to a Netlify site, creating the site on first use.

    python3 scripts/deploy_netlify.py <site-name> <folder>

The access key is read from NETLIFY_AUTH_TOKEN in .env (python-dotenv) and never printed.
Uses Netlify's file-digest deploy: only files Netlify does not already hold are uploaded.
Publish a clean export, never the working tree: `git archive HEAD | tar -x -C <folder>` keeps
.env, local tooling and temp files out.
"""
import hashlib, json, pathlib, sys, time, urllib.error, urllib.parse, urllib.request

from dotenv import dotenv_values

API = "https://api.netlify.com/api/v1"
TOKEN = dotenv_values(pathlib.Path(__file__).resolve().parent.parent / ".env").get("NETLIFY_AUTH_TOKEN")


def call(method, path, body=None, raw=None):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    ctype = "application/octet-stream" if raw is not None else "application/json"
    req = urllib.request.Request(API + path, data=data, method=method,
                                 headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": ctype})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.load(r) if r.length != 0 else None
    except urllib.error.HTTPError as e:
        sys.exit(f"Netlify {method} {path.split('?')[0]} answered {e.code}: {e.read()[:300].decode(errors='replace')}")


def main(name, folder):
    if not TOKEN:
        sys.exit("NETLIFY_AUTH_TOKEN is missing from .env")
    root = pathlib.Path(folder).resolve()
    files = {"/" + p.relative_to(root).as_posix(): p for p in sorted(root.rglob("*")) if p.is_file()}
    if not files:
        sys.exit(f"{root} is empty")
    site = next((s for s in call("GET", "/sites?per_page=100") if s["name"] == name), None)
    if not site:
        site = call("POST", "/sites", {"name": name})
        # The account puts new sites behind a Netlify team login; a published site must be public.
        call("PATCH", f"/sites/{site['id']}", {"sso_login": False})
    digests = {path: hashlib.sha1(p.read_bytes()).hexdigest() for path, p in files.items()}
    deploy = call("POST", f"/sites/{site['id']}/deploys", {"files": digests})
    need = set(deploy.get("required", []))
    todo = [path for path, d in digests.items() if d in need]
    for n, path in enumerate(todo, 1):
        call("PUT", f"/deploys/{deploy['id']}/files{urllib.parse.quote(path)}", raw=files[path].read_bytes())
        if n % 50 == 0:
            print(f"  uploaded {n}/{len(todo)}")
    for _ in range(120):
        state = call("GET", f"/deploys/{deploy['id']}")["state"]
        if state == "ready":
            break
        if state == "error":
            sys.exit("Netlify reported a deploy error")
        time.sleep(2)
    else:
        sys.exit("Deploy did not become ready within 4 minutes")
    print(f"{name}: {len(files)} files, {len(todo)} uploaded, live at {site['ssl_url'] or site['url']}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(*sys.argv[1:])
