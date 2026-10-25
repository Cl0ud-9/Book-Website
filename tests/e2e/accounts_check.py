"""Accounts, end to end, against Firebase's local emulators: the header and menu signed out and in, making an account on
the sign-up page (the reading done before it comes along), choosing a name, highlighting and choosing a page colour,
keeping them in the account, signing in on a second device and finding them there, signing in on a device that already
has reading (asked first: add it, or leave it out), sharing a reader page, the rules that keep accounts apart
(firebase/firestore.rules), Google sign-in, editing, signing out and deleting.

usage, from the project folder (needs Java for the emulators, Playwright and Google Chrome):
  npm run emulators                      (in a second terminal; it leaves them running)
  FIREBASE_CONFIG='{"apiKey":"demo-key","authDomain":"demo-bookshelf.firebaseapp.com","projectId":"demo-bookshelf","emulator":"127.0.0.1"}' \
    npx astro build --outDir dist-accounts   (a copy of the site that signs in to the emulators)
  python tests/e2e/accounts_check.py         (serves that copy at http://127.0.0.1:4600/ while it runs)
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

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PAGES = os.path.join(ROOT, sys.argv[1] if len(sys.argv) > 1 else "dist-accounts")
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, "test-results", "accounts")
os.makedirs(OUT, exist_ok=True)
BASE = "http://127.0.0.1:4600/"


class Pages(http.server.SimpleHTTPRequestHandler):
    """The emulator copy of the site, built whole (pages, scripts, books and covers)"""
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".mjs": "text/javascript", ".js": "text/javascript",
                      ".webp": "image/webp", ".woff2": "font/woff2", ".epub": "application/epub+zip"}

    def translate_path(self, path):
        rel = path.split("?", 1)[0].split("#", 1)[0].lstrip("/") or "index.html"
        for root in (PAGES,):
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

    # ---------- Device A, a phone: signed out, then a new account ----------
    a = br.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, service_workers="block")
    a.grant_permissions(["clipboard-read", "clipboard-write"])
    pa = a.new_page(); watch(pa, "A")
    pa.goto(BASE); pa.wait_for_timeout(2500)
    pa.locator("[data-menu-toggle]").click(); pa.wait_for_timeout(900)
    say(pa.locator(".menu div[data-when=out] a[href='login.html']").is_visible() and pa.locator(".menu a[href='signup.html']").is_visible()
        and pa.locator(".menu div[data-when=in]").is_hidden(), "A: signed out, the menu offers Sign in and Create a free account")
    pa.locator("[data-menu-close]").click(); pa.wait_for_timeout(700)
    shown = pa.evaluate("[...document.querySelectorAll('.open-book [data-book-open-button]')].filter(s => getComputedStyle(s).display !== 'none').map(s => s.textContent.trim())")
    say(shown == ["Start reading", "Create a free account"], f"A: the open book offers Start reading and Create a free account: {shown}")
    # reading before making an account: it is kept, without asking, when the account is new
    pa.goto(BASE + "read.html?book=frankenstein")
    pa.wait_for_selector(".reader.is--ready", timeout=30000); pa.wait_for_timeout(2500)
    pa.goto(BASE + "signup.html"); wait_state(pa, "out"); pa.wait_for_timeout(400)
    say(pa.locator("[data-acct-google]").is_visible() and pa.locator("[data-acct-submit]").inner_text().strip() == "Create my account",
        "A: the sign-up page offers Google and an email")
    pa.screenshot(path=f"{OUT}/acct-signup-phone.png", full_page=True)
    pa.fill("input[name=email]", "not-an-email"); pa.fill("input[name=password]", "x"); pa.locator("[data-acct-submit]").click()
    say("email address" in pa.locator("[data-acct-message]").inner_text(), f"A: a bad email is explained: {pa.locator('[data-acct-message]').inner_text()!r}")
    pa.fill("input[name=email]", EMAIL); pa.fill("input[name=password]", "short"); pa.locator("[data-acct-submit]").click()
    say("8 characters" in pa.locator("[data-acct-message]").inner_text(), "A: a short password is explained")
    pa.locator("[data-acct-show]").click()
    say(pa.locator("input[name=password]").get_attribute("type") == "text", "A: the eye shows the password")
    pa.fill("input[name=password]", PASSWORD); pa.locator("[data-acct-submit]").click()
    wait_state(pa, "setup")
    pa.wait_for_timeout(1200)
    say(pa.locator("[data-acct-setup]").is_visible(), "A: a new account is asked for a name and mark, in the same card")
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
    pa.wait_for_selector("[data-auth-done]:not([hidden])", timeout=15000); pa.wait_for_timeout(1000)
    say("all set, Ada" in pa.locator("[data-auth-done-title]").inner_text(), f"A: {pa.locator('[data-auth-done-title]').inner_text()!r}")
    pa.goto(BASE + "account.html"); wait_state(pa, "in"); pa.wait_for_timeout(1500)
    say(pa.locator("[data-acct-in]").is_visible() and pa.locator("[data-acct-name]").inner_text() == "Ada Reader"
        and pa.locator("[data-acct-handle]").inner_text() == f"@{HANDLE}", "A: Your account shows the name and username")
    say(pa.locator("[data-acct-verify]").is_visible(), "A: an email account is asked to confirm its email")
    pa.screenshot(path=f"{OUT}/acct-in-phone.png", full_page=True)
    pa.evaluate("window.scrollTo(0, 0)"); pa.wait_for_timeout(600)
    pa.locator("[data-menu-toggle]").click(); pa.wait_for_timeout(900)
    me = pa.locator(".menu .button-alt.is--me")
    say(me.is_visible() and "Ada" in me.inner_text() and me.locator(".avatar use").get_attribute("href") == "#i-cat"
        and pa.locator(".menu div[data-when=out]").is_hidden(), f"A: the menu shows Ada and her mark: {me.inner_text()!r}")
    pa.locator("[data-menu-close]").click(); pa.wait_for_timeout(700)

    # ---------- read, highlight and choose a page colour on A, then keep it ----------
    pa.goto(BASE + "read.html?book=frankenstein")
    pa.wait_for_selector(".reader.is--ready", timeout=30000); pa.wait_for_timeout(2500)
    pa.mouse.wheel(0, 3000); pa.wait_for_timeout(1500)
    sel = pa.evaluate(SELECT, [6, 0]); pa.wait_for_timeout(800)
    pa.locator("[data-select-bar] [data-style=pink]").click(); pa.wait_for_timeout(800)
    say(sel is not None and pa.locator(".epub-container g.note-pink").count() == 1, f"A: highlighted {sel and sel['text']!r}")
    pa.locator(".reader").evaluate("r => r.classList.remove('is--immersive')")
    pa.locator("[aria-controls=reader-settings]").click(); pa.wait_for_timeout(300)
    pa.locator("[data-reader-theme=night]").click(); pa.keyboard.press("Escape"); pa.wait_for_timeout(300)
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
    say(pv.locator("[data-profile-mine]").get_attribute("href") == "signup.html", "visitor: Make your own reader page leads to signing up")
    pv.screenshot(path=f"{OUT}/acct-profile-laptop.png", full_page=True)
    pv.goto(BASE + "profile.html?u=nobody_here_123"); pv.wait_for_timeout(2500)
    say("no reader page" in pv.locator("[data-profile-status]").inner_text(), "visitor: an unknown reader is explained")

    # ---------- Device B, a laptop: sign in, and the reading is there ----------
    b = br.new_context(viewport={"width": 1440, "height": 900}, service_workers="block")
    pb = b.new_page(); watch(pb, "B")
    pb.goto(BASE); pb.wait_for_timeout(2500)
    say(pb.locator(".header li[data-when=out] a[href='login.html']").is_visible() and pb.locator(".header .button-alt.is--me").is_hidden(),
        "B: signed out, the header's orange button is Sign in")
    pb.goto(BASE + "login.html"); wait_state(pb, "out"); pb.wait_for_timeout(300)
    pb.fill("input[name=email]", EMAIL); pb.fill("input[name=password]", "wrong password"); pb.locator("[data-acct-submit]").click()
    pb.wait_for_function("document.querySelector('[data-acct-message]').textContent.length > 0", timeout=10000)
    say("don’t match" in pb.locator("[data-acct-message]").inner_text(), f"B: a wrong password is explained: {pb.locator('[data-acct-message]').inner_text()!r}")
    pb.fill("input[name=password]", PASSWORD); pb.locator("[data-acct-submit]").click()
    wait_state(pb, "in"); pb.wait_for_selector("[data-auth-done]:not([hidden])", timeout=15000); pb.wait_for_timeout(3000)
    say("Welcome back, Ada" in pb.locator("[data-auth-done-title]").inner_text(), f"B: {pb.locator('[data-auth-done-title]').inner_text()!r}")
    me = pb.locator(".header .button-alt.is--me")
    say(me.is_visible() and "Ada" in me.inner_text() and pb.locator(".header li[data-when=out]").is_hidden(), f"B: the header shows Ada: {me.inner_text()!r}")
    pb.screenshot(path=f"{OUT}/acct-in-laptop.png")
    say(pb.evaluate("JSON.parse(localStorage.getItem('bookshelf:reader') || '{}').theme") == "night", "B: the Night page chosen on A came too")
    pb.goto(BASE + "reading.html"); pb.wait_for_timeout(3500)
    say("Frankenstein" in pb.locator("[data-reading-list]").inner_text(), "B: Reading now has Frankenstein, read on A")
    say(pb.locator("[data-notes-all] .mine__note").count() == 1, "B: and A's highlight")
    say(f"@{HANDLE}" in pb.locator("[data-mine-account]").inner_text(), f"B: Your reading says it is kept in the account: {pb.locator('[data-mine-account]').inner_text()!r}")
    # B removes the highlight; A's copy goes too
    pb.locator("[data-notes-all] .mine__note button", has_text="Remove").click(); pb.wait_for_timeout(500)
    say(sync(pb) is True, "B: kept the removal")
    pa.goto(BASE + "reading.html"); pa.wait_for_timeout(2500); sync(pa); pa.wait_for_timeout(1500)
    say(pa.locator("[data-notes-all] .mine__note").count() == 0, "A: the highlight removed on B is gone here too")

    # ---------- signing in on a device that already has reading: asked first ----------
    for answer in ("keep", "drop"):
        book = "dracula" if answer == "keep" else "moby-dick"
        d = br.new_context(viewport={"width": 1440, "height": 900}, service_workers="block")
        pd = d.new_page(); watch(pd, f"D-{answer}")
        pd.goto(BASE + f"read.html?book={book}"); pd.wait_for_selector(".reader.is--ready", timeout=30000); pd.wait_for_timeout(2000)
        pd.goto(BASE + "login.html"); wait_state(pd, "out")
        pd.fill("input[name=email]", EMAIL); pd.fill("input[name=password]", PASSWORD); pd.locator("[data-acct-submit]").click()
        wait_state(pd, "merge"); pd.wait_for_timeout(800)
        text = pd.locator("[data-acct-merge-text]").inner_text()
        say(pd.locator("[data-acct-merge]").is_visible() and "1 book" in text, f"D: signing in on a device with reading asks first: {text!r}")
        if answer == "keep":
            pd.locator("[data-acct-merge-keep]").click()
        else:
            pd.locator("[data-acct-merge-drop]").click()
        wait_state(pd, "in", 20000); pd.wait_for_timeout(1500)
        places = pd.evaluate("Object.keys(JSON.parse(localStorage.getItem('bookshelf:reading') || '{}'))")
        if answer == "keep":
            sync(pa); pa.goto(BASE + "reading.html"); pa.wait_for_timeout(2500)
            say("Dracula" in pa.locator("[data-reading-list]").inner_text() and "frankenstein" in places,
                "D: Add it puts Dracula in the account (A sees it), and the account's Frankenstein comes here")
        else:
            say("moby-dick" not in places and "frankenstein" in places, f"D: Leave it out leaves Moby Dick off, and the account's reading takes its place: {places}")
            sync(pa); pa.goto(BASE + "reading.html"); pa.wait_for_timeout(2500)
            say("Moby" not in pa.locator("[data-reading-list]").inner_text(), "D: and Moby Dick never reaches the account")
        d.close()

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

    # ---------- Google, and a taken username, on a third account ----------
    c = br.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, service_workers="block")
    pc = c.new_page(); watch(pc, "C")
    pc.goto(BASE + "signup.html"); wait_state(pc, "out")
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
    pc.goto(BASE + "account.html"); wait_state(pc, "in"); pc.wait_for_timeout(1000)
    say(pc.locator("[data-acct-verify]").is_hidden(), "C: a Google account is not asked to confirm its email")

    # ---------- edit, sign out and delete ----------
    pa.goto(BASE + "account.html"); wait_state(pa, "in"); pa.wait_for_timeout(1000)
    pa.locator("[data-acct-edit]").click(); pa.wait_for_timeout(500)
    say(pa.locator("[data-acct-setup]").is_visible() and pa.locator("[data-acct-cancel]").is_visible(), "A: Edit opens the name and mark, with Cancel")
    pa.fill("input[name=name]", "Ada L. Reader"); pa.locator("[data-acct-save]").click(); pa.wait_for_timeout(2500)
    say(pa.locator("[data-acct-name]").inner_text() == "Ada L. Reader", "A: the new name is saved")
    pb.goto(BASE + "account.html"); wait_state(pb, "in"); pb.wait_for_timeout(800)
    pb.locator("[data-acct-signout]").click(); wait_state(pb, "out"); pb.wait_for_timeout(500)
    say(pb.locator("[data-acct-out]").is_visible() and "still on this device" in pb.locator("[data-acct-message]").inner_text()
        and pb.locator("[data-acct-out] a[href='login.html']").is_visible(), "B: Sign out, the reading stays on the device, and Sign in is offered")
    say(pb.locator(".header li[data-when=out] a[href='login.html']").is_visible() and pb.locator(".header .button-alt.is--me").is_hidden(),
        "B: the header says Sign in again")
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
