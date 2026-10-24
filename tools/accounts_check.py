"""Accounts, end to end, against Firebase's local emulators: make an account, choose a name, read and highlight, keep it
in the account, see it on a second device, share a reader page, the rules that keep accounts apart (firebase/
firestore.rules), Google sign-in, editing, signing out and deleting.

usage, from the project folder (needs Java for the emulators, Playwright and Google Chrome):
  npm run emulators                      (in a second terminal; it leaves them running)
  FIREBASE_CONFIG='{"apiKey":"demo-key","authDomain":"demo-bookshelf.firebaseapp.com","projectId":"demo-bookshelf","emulator":"127.0.0.1"}'     python tools/build.py _accounts      (a copy of the pages that signs in to the emulators)
  python tools/accounts_check.py         (serves that copy at http://127.0.0.1:4600/ while it runs)
"""
import functools
import http.server
import json
import os
import sys
import threading
import time
import urllib.error
import urllib.request
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGES = os.path.join(ROOT, sys.argv[1] if len(sys.argv) > 1 else "_accounts")
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, "_check")
os.makedirs(OUT, exist_ok=True)
BASE = "http://127.0.0.1:4600/"


class Pages(http.server.SimpleHTTPRequestHandler):
    """The emulator copy's pages, and everything else (scripts, books, covers) from the project"""
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".mjs": "text/javascript", ".js": "text/javascript",
                      ".webp": "image/webp", ".woff2": "font/woff2", ".epub": "application/epub+zip"}

    def translate_path(self, path):
        rel = path.split("?", 1)[0].split("#", 1)[0].lstrip("/") or "index.html"
        for root in (PAGES, ROOT):
            full = os.path.join(root, *rel.split("/"))
            if os.path.exists(full):
                return full
        return os.path.join(PAGES, *rel.split("/"))

    def log_message(self, *args):
        pass


if not os.path.exists(os.path.join(PAGES, "account.html")):
    sys.exit(f"No emulator copy of the pages in {PAGES}: build it first (see the top of this file)")
threading.Thread(target=http.server.ThreadingHTTPServer(("127.0.0.1", 4600), Pages).serve_forever, daemon=True).start()
AUTH = "http://127.0.0.1:9099"
STORE = "http://127.0.0.1:8080/v1/projects/demo-bookshelf/databases/(default)/documents"
bad = 0
stamp = str(int(time.time()))[-6:]
EMAIL = f"ada{stamp}@example.com"
HANDLE = f"ada_{stamp}"
PASSWORD = "correct horse"


def say(ok, msg):
    global bad
    bad += not ok
    print(("ok  " if ok else "BUG ") + msg, flush=True)


def http(method, url, body=None, token=None):
    req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})})
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


SELECT = """([words, para]) => {
  for (const f of document.querySelectorAll('.epub-container iframe')) {
    const r = f.getBoundingClientRect();
    if (r.bottom < 100 || r.top > innerHeight) continue;
    const doc = f.contentDocument;
    const ps = [...doc.querySelectorAll('p')].filter(p => { const b = p.getBoundingClientRect(); const top = r.top + b.top;
      return p.textContent.trim().split(/\\s+/).length > 25 && top > 150 && top < innerHeight - 250; });
    const p = ps[para]; if (!p) continue;
    const walker = doc.createTreeWalker(p, NodeFilter.SHOW_TEXT); const t = walker.nextNode();
    const sel = doc.getSelection(); const range = doc.createRange();
    range.setStart(t, 0);
    let end = 0, seen = 0; const text = t.nodeValue;
    for (let i = 0; i < text.length && seen < words; i++) if (text[i] === ' ') { seen++; end = i; }
    range.setEnd(t, end || Math.min(text.length, 40));
    sel.removeAllRanges(); sel.addRange(range);
    const b = range.getBoundingClientRect();
    return { top: r.top + b.top, bottom: r.top + b.bottom, text: range.toString() };
  }
  return null;
}"""


def wait_state(page, state, timeout=15000):
    page.wait_for_function(f"window.BookshelfAccount && window.BookshelfAccount.current().state === '{state}'", timeout=timeout)


def sync(page):
    return page.evaluate("window.BookshelfAccount.sync()")


with sync_playwright() as p:
    br = p.chromium.launch(channel="chrome")
    errors = []

    def watch(page, label):
        page.on("pageerror", lambda e: errors.append(f"{label}: {str(e)[:200]}"))
        page.on("console", lambda m: errors.append(f"{label} console: {m.text[:200]}") if m.type == "error" and "favicon" not in m.text else None)

    # ---------- Device A, a phone: make an account ----------
    a = br.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, service_workers="block")
    a.grant_permissions(["clipboard-read", "clipboard-write"])
    pa = a.new_page(); watch(pa, "A")
    pa.goto(BASE + "account.html")
    wait_state(pa, "out")
    pa.wait_for_timeout(400)
    say(pa.locator("[data-acct-out]").is_visible() and pa.locator("[data-acct-google]").is_visible(), "A: signed out, the page offers Google and email")
    pa.screenshot(path=f"{OUT}/acct-out-phone.png", full_page=True)
    pa.locator("[data-acct-mode=up]").click()
    say(pa.locator("[data-acct-out-title]").inner_text() == "Create an account" and pa.locator("[data-acct-submit]").inner_text() == "Create my account",
        "A: I'm new here switches the form to creating an account")
    pa.fill("input[name=email]", "not-an-email"); pa.fill("input[name=password]", "x"); pa.locator("[data-acct-submit]").click()
    say("email address" in pa.locator("[data-acct-message]").inner_text(), f"A: a bad email is explained: {pa.locator('[data-acct-message]').inner_text()!r}")
    pa.fill("input[name=email]", EMAIL); pa.fill("input[name=password]", "short"); pa.locator("[data-acct-submit]").click()
    say("8 characters" in pa.locator("[data-acct-message]").inner_text(), "A: a short password is explained")
    pa.locator("[data-acct-show]").click()
    say(pa.locator("input[name=password]").get_attribute("type") == "text", "A: the eye shows the password")
    pa.fill("input[name=password]", PASSWORD); pa.locator("[data-acct-submit]").click()
    wait_state(pa, "setup")
    pa.wait_for_timeout(1200)
    say(pa.locator("[data-acct-setup]").is_visible(), "A: a new account is asked for a name and mark")
    suggested = pa.locator("input[name=handle]").input_value()
    say(suggested.startswith("ada"), f"A: a username is suggested from the email: {suggested!r}")
    pa.fill("input[name=handle]", "ad"); pa.wait_for_timeout(200)
    say("at least 3" in pa.locator("[data-acct-handle-note]").inner_text(), "A: a too-short username is explained")
    pa.fill("input[name=handle]", "Admin!"); pa.wait_for_timeout(300)
    say(pa.locator("input[name=handle]").input_value() == "admin" and "isn’t available" in pa.locator("[data-acct-handle-note]").inner_text(),
        "A: capitals and symbols are dropped as you type, and a reserved name is refused")
    pa.fill("input[name=handle]", HANDLE); pa.wait_for_timeout(1500)
    say("is free" in pa.locator("[data-acct-handle-note]").inner_text(), f"A: {HANDLE} is free: {pa.locator('[data-acct-handle-note]').inner_text()!r}")
    pa.fill("input[name=name]", "Ada Reader")
    pa.locator(".acct__swatch:has(input[value=violet])").click()
    pa.locator(".acct__mark:has(input[value=cat])").click()
    say(pa.locator("[data-acct-preview-name]").inner_text() == "Ada Reader" and pa.locator("[data-acct-preview-avatar] use").get_attribute("href") == "#i-cat",
        "A: the preview shows the name and the cat")
    pa.screenshot(path=f"{OUT}/acct-setup-phone.png", full_page=True)
    pa.locator("[data-acct-save]").click()
    wait_state(pa, "in")
    pa.wait_for_timeout(1500)
    say(pa.locator("[data-acct-in]").is_visible() and pa.locator("[data-acct-name]").inner_text() == "Ada Reader"
        and pa.locator("[data-acct-handle]").inner_text() == f"@{HANDLE}", "A: signed in, the page shows the name and username")
    say(pa.locator("[data-acct-verify]").is_visible(), "A: an email account is asked to confirm its email")
    pa.screenshot(path=f"{OUT}/acct-in-phone.png", full_page=True)

    # the menu has the account
    pa.evaluate("window.scrollTo(0, 0)"); pa.wait_for_timeout(600)
    pa.locator("[data-menu-toggle]").click(); pa.wait_for_timeout(900)
    chip = pa.locator(".account-chip.is--menu")
    say(chip.is_visible() and "Ada" in chip.inner_text() and chip.locator(".avatar").count() == 1, f"A: the menu shows the account: {chip.inner_text()!r}")
    pa.locator("[data-menu-close]").click(); pa.wait_for_timeout(700)

    # ---------- read and highlight on A, then keep it ----------
    pa.goto(BASE + "read.html?book=frankenstein")
    pa.wait_for_selector(".reader.is--ready", timeout=30000); pa.wait_for_timeout(2500)
    pa.mouse.wheel(0, 3000); pa.wait_for_timeout(1500)
    sel = pa.evaluate(SELECT, [6, 0]); pa.wait_for_timeout(800)
    pa.locator("[data-select-bar] [data-style=pink]").click(); pa.wait_for_timeout(800)
    say(sel is not None and pa.locator(".epub-container g.note-pink").count() == 1, f"A: highlighted {sel and sel['text']!r}")
    ok = sync(pa)
    say(ok is True, "A: kept in the account")
    st, _ = http("GET", f"{STORE}/users")
    say(st in (401, 403), f"rules: nobody signed out can list accounts ({st})")

    # ---------- share the reader page ----------
    pa.goto(BASE + "account.html"); wait_state(pa, "in"); pa.wait_for_timeout(1200)
    say(pa.locator("[data-acct-lines]").is_disabled(), "A: Show lines waits until the page is shared")
    pa.locator(".acct__switch:has([data-acct-public])").click(); pa.wait_for_timeout(2500)
    say("shared" in pa.locator("[data-acct-share-message]").inner_text() and pa.locator("[data-acct-page-links]").is_visible(),
        f"A: sharing the reader page: {pa.locator('[data-acct-share-message]').inner_text()!r}")
    pa.locator(".acct__switch:has([data-acct-lines])").click(); pa.wait_for_timeout(2500)
    pa.locator("[data-acct-copy]").click(); pa.wait_for_timeout(400)
    clip = pa.evaluate("navigator.clipboard.readText()")
    say(clip.endswith(f"profile.html?u={HANDLE}"), f"A: Copy the link copies {clip}")

    # ---------- anyone can see it ----------
    v = br.new_context(viewport={"width": 1440, "height": 900}, service_workers="block")
    pv = v.new_page(); watch(pv, "visitor")
    pv.goto(BASE + f"profile.html?u={HANDLE}")
    pv.wait_for_selector("[data-profile-stats]:not([hidden])", timeout=15000); pv.wait_for_timeout(800)
    say(pv.locator("[data-profile-name]").inner_text() == "Ada Reader", "visitor: the reader page shows the name")
    say("Frankenstein" in pv.locator("[data-profile-reading-list]").inner_text(), "visitor: and that Ada is reading Frankenstein")
    say(pv.locator("[data-profile-lines-list] .line").count() == 1, "visitor: and the line Ada highlighted")
    say(pv.locator("[data-profile-report]").get_attribute("href").startswith("https://github.com/"), "visitor: there is a way to report the page")
    pv.screenshot(path=f"{OUT}/acct-profile-laptop.png", full_page=True)
    pv.goto(BASE + "profile.html?u=nobody_here_123"); pv.wait_for_timeout(2500)
    say("no reader page" in pv.locator("[data-profile-status]").inner_text(), "visitor: an unknown reader is explained")

    # ---------- Device B, a laptop: sign in, and the reading is there ----------
    b = br.new_context(viewport={"width": 1440, "height": 900}, service_workers="block")
    pb = b.new_page(); watch(pb, "B")
    pb.goto(BASE + "account.html"); wait_state(pb, "out"); pb.wait_for_timeout(300)
    pb.fill("input[name=email]", EMAIL); pb.fill("input[name=password]", "wrong password"); pb.locator("[data-acct-submit]").click()
    pb.wait_for_function("document.querySelector('[data-acct-message]').textContent.length > 0", timeout=10000)
    say("don’t match" in pb.locator("[data-acct-message]").inner_text(), f"B: a wrong password is explained: {pb.locator('[data-acct-message]').inner_text()!r}")
    pb.fill("input[name=password]", PASSWORD); pb.locator("[data-acct-submit]").click()
    wait_state(pb, "in"); pb.wait_for_timeout(3000)
    chip = pb.locator(".header .account-chip")
    say(chip.is_visible() and "Ada" in chip.inner_text(), f"B: the header shows Ada: {chip.inner_text()!r}")
    pb.screenshot(path=f"{OUT}/acct-in-laptop.png")
    pb.goto(BASE + "reading.html"); pb.wait_for_timeout(3500)
    say("Frankenstein" in pb.locator("[data-reading-list]").inner_text(), "B: Reading now has Frankenstein, read on A")
    say(pb.locator("[data-notes-all] .mine__note").count() == 1, "B: and A's highlight")
    say(f"@{HANDLE}" in pb.locator("[data-mine-account]").inner_text(), f"B: Your reading says it is kept in the account: {pb.locator('[data-mine-account]').inner_text()!r}")
    # B removes the highlight; A's copy goes too
    pb.locator("[data-notes-all] .mine__note button", has_text="Remove").click(); pb.wait_for_timeout(500)
    say(sync(pb) is True, "B: kept the removal")
    pa.goto(BASE + "reading.html"); pa.wait_for_timeout(2500); sync(pa); pa.wait_for_timeout(1500)
    say(pa.locator("[data-notes-all] .mine__note").count() == 0, "A: the highlight removed on B is gone here too")

    # ---------- the rules keep accounts apart ----------
    st, signed = http("POST", f"{AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key",
                      {"email": f"eve{stamp}@example.com", "password": "eve password", "returnSecureToken": True})
    eve = signed.get("idToken")
    uid_a = pa.evaluate("window.BookshelfAccount.current().profile.uid")
    st, _ = http("GET", f"{STORE}/users/{uid_a}", token=eve)
    say(st == 403, f"rules: another account cannot read Ada's ({st})")
    st, _ = http("PATCH", f"{STORE}/users/{uid_a}/notes/x?updateMask.fieldPaths=text", {"fields": {"text": {"stringValue": "hi"}}}, token=eve)
    say(st == 403, f"rules: or write a note into it ({st})")
    st, _ = http("PATCH", f"{STORE}/handles/{HANDLE}", {"fields": {"uid": {"stringValue": signed.get("localId")}}}, token=eve)
    say(st == 403, f"rules: or take Ada's username ({st})")
    st, _ = http("PATCH", f"{STORE}/profiles/{HANDLE}?updateMask.fieldPaths=name", {"fields": {"name": {"stringValue": "Eve"}}}, token=eve)
    say(st == 403, f"rules: or change Ada's reader page ({st})")
    st, _ = http("PATCH", f"{STORE}/handles/fuckwit", {"fields": {"uid": {"stringValue": signed.get("localId")}}}, token=eve)
    say(st == 403, f"rules: a rude username is refused even past the site ({st})")
    st, _ = http("GET", f"{STORE}/profiles/{HANDLE}")
    say(st == 200, f"rules: a shared reader page is open to all ({st})")

    # ---------- a taken username, on a third account ----------
    c = br.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, service_workers="block")
    pc = c.new_page(); watch(pc, "C")
    pc.goto(BASE + "account.html"); wait_state(pc, "out")
    pc.locator("[data-acct-google]").click()
    popup = pc.wait_for_event("popup", timeout=15000)
    popup.wait_for_load_state()
    popup.wait_for_timeout(1500)
    try:
        popup.get_by_text("Add new account").click(); popup.wait_for_timeout(800)
        popup.locator("#email-input").fill(f"grace{stamp}@example.com")
        popup.locator("#display-name-input").fill("Grace Hopper")
        popup.get_by_text("Sign in with Google.com").click()
    except Exception as exc:  # the emulator's page changes now and then
        popup.screenshot(path=f"{OUT}/acct-google-popup.png")
        print("popup:", exc)
    wait_state(pc, "setup", 20000); pc.wait_for_timeout(1200)
    say(pc.locator("input[name=name]").input_value() == "Grace Hopper", "C: Google's name is suggested")
    pc.fill("input[name=handle]", HANDLE); pc.wait_for_timeout(1500)
    say("is taken" in pc.locator("[data-acct-handle-note]").inner_text(), "C: Ada's username shows as taken")
    pc.fill("input[name=handle]", f"grace_{stamp}"); pc.wait_for_timeout(1200)
    pc.locator("[data-acct-save]").click(); wait_state(pc, "in"); pc.wait_for_timeout(800)
    say(pc.locator("[data-acct-verify]").is_hidden(), "C: a Google account is not asked to confirm its email")

    # ---------- edit, sign out and delete ----------
    pa.goto(BASE + "account.html"); wait_state(pa, "in"); pa.wait_for_timeout(1000)
    pa.locator("[data-acct-edit]").click(); pa.wait_for_timeout(500)
    say(pa.locator("[data-acct-setup]").is_visible() and pa.locator("[data-acct-cancel]").is_visible(), "A: Edit opens the name and mark, with Cancel")
    pa.fill("input[name=name]", "Ada L. Reader"); pa.locator("[data-acct-save]").click(); pa.wait_for_timeout(2500)
    say(pa.locator("[data-acct-name]").inner_text() == "Ada L. Reader", "A: the new name is saved")
    pb.goto(BASE + "account.html"); wait_state(pb, "in"); pb.wait_for_timeout(800)
    pb.locator("[data-acct-signout]").click(); wait_state(pb, "out"); pb.wait_for_timeout(500)
    say(pb.locator("[data-acct-out]").is_visible() and "still on this device" in pb.locator("[data-acct-message]").inner_text(), "B: Sign out, and the reading stays on the device")
    say(pb.locator(".header .account-chip").inner_text().strip() == "Sign in", "B: the header says Sign in again")
    pa.locator("[data-acct-delete]").click(); pa.wait_for_timeout(300)
    say("again" in pa.locator("[data-acct-delete]").inner_text(), "A: Delete asks to be pressed again")
    pa.locator("[data-acct-delete]").click()
    wait_state(pa, "out", 20000); pa.wait_for_timeout(800)
    say("deleted" in pa.locator("[data-acct-message]").inner_text(), f"A: deleted: {pa.locator('[data-acct-message]').inner_text()!r}")
    st, _ = http("GET", f"{STORE}/profiles/{HANDLE}")
    say(st == 404, f"A's reader page is gone ({st})")
    st, _ = http("GET", f"{STORE}/handles/{HANDLE}")
    say(st == 404, f"A's username is free again ({st})")

    print("errors:", [e for e in errors if "ERR_" not in e] or "none")
    br.close()
print("failures:", bad)
sys.exit(1 if bad else 0)
