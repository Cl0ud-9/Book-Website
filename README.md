<h1 align="center">The Bookshelf</h1>

<p align="center"><strong>A free library of 161 classics to read in your browser or download, in a bright, playful site where everything moves.</strong></p>

<p align="center">
  <a href="https://the-bookshelf.cl0ud-9.workers.dev/"><img src="https://img.shields.io/badge/Live%20site-the--bookshelf.cl0ud--9.workers.dev-ff008c?style=for-the-badge" alt="Live site" height="34"></a>
</p>

<p align="center">
  <a href="https://github.com/Cl0ud-9/Book-Website/actions/workflows/ci.yml"><img src="https://github.com/Cl0ud-9/Book-Website/actions/workflows/ci.yml/badge.svg" alt="Check"></a>
  <a href="https://github.com/Cl0ud-9/Book-Website/actions/workflows/deploy.yml"><img src="https://github.com/Cl0ud-9/Book-Website/actions/workflows/deploy.yml/badge.svg" alt="Deploy"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-source--available-5b4bd5" alt="License: source-available"></a>
  <img src="https://img.shields.io/badge/Astro-7-bc52ee" alt="Astro 7">
  <img src="https://img.shields.io/badge/GSAP-3.15-0ae448" alt="GSAP 3.15">
</p>

<br>

<p align="center">
  <img src="docs/img/tour.webp" alt="The opening: a fat violet squiggle covers the screen, the logo springs in, and the squiggle slithers away to reveal the home page; then All books, a book's page, and the book open in the reader" width="640">
</p>

The Bookshelf is a free library of the classics with a loud, warm personality: heavy type, handwritten notes,
colour cards, stickers and motion everywhere you look. 161 books, from Austen and the Brontës to Sherlock Holmes,
Frankenstein, Tagore and Marcus Aurelius, can be read right in the browser or downloaded for a phone, Kindle or Kobo. It began as a
Web Technology course project, was rebuilt as an animated bookshop in version 2, became a library in version 3, and
moved to Astro and TypeScript in version 4.

| Page | What it does |
|---|---|
| [Home](https://the-bookshelf.cl0ud-9.workers.dev/) | Where to start, on a draggable shelf; the books you are reading; a line of the day; how it works; a book that opens as you scroll; the genres; questions; the book of the month and why it was chosen. |
| [All books](https://the-bookshelf.cl0ud-9.workers.dev/books.html) | All 161 books, most read first: fiction or non-fiction, a genre or the From India shelf, a mood and a length, searchable by title, author or genre (accents optional), sorted by title or length. The choice is kept in the address, so it can be shared. |
| [Genres](https://the-bookshelf.cl0ud-9.workers.dev/genres.html) | A shelf for each genre, fiction and non-fiction, and one of classics from India, its most read books first, to scroll or drag sideways. |
| [Questions](https://the-bookshelf.cl0ud-9.workers.dev/faq.html) | Every question, by topic, with a list of topics that follows you down the page and marks the one you are reading. |
| [A book](https://the-bookshelf.cl0ud-9.workers.dev/book-pride-and-prejudice.html) | Every book has its own page: a 3D copy that leans towards the pointer, its description, details and edition, Read now, the EPUB download, Kindle and Kobo editions, a free LibriVox audiobook where there is one, Keep for offline reading, Before you start (who's who and what to know, with no spoilers) and Lines worth knowing for the most read books, and three related books. |
| [The reader](https://the-bookshelf.cl0ud-9.workers.dev/read.html?book=pride-and-prejudice) | The book itself, in the page: its cover swings open, then pages turn on a laptop and scroll on a phone, with contents, highlights and notes, a word's meaning, text size, three page colours and three typefaces (Literata, made for reading on screens, by default). It remembers your place. |
| [Your reading](https://the-bookshelf.cl0ud-9.workers.dev/reading.html) | Your week of reading, the books you are reading, your notes, the books kept for offline reading and the ones you finished, with Back up and Restore. |
| [Your account](https://the-bookshelf.cl0ud-9.workers.dev/account.html) | Optional, and only once accounts are switched on (see below): sign in with Google or an email address, choose a name, a colour and a mark, and your reading is on every device you sign in on. |
| [A reader's page](https://the-bookshelf.cl0ud-9.workers.dev/profile.html) | For readers who share it: their name and mark, what they are reading and have finished, their reading time and, if they choose, the lines they highlighted. Never their notes. |
| [Privacy](https://the-bookshelf.cl0ud-9.workers.dev/privacy.html) | What is kept about you, where, and how to remove it. |

## The details

<p align="center">
  <img src="docs/img/shelf.jpg" alt="The Where to start shelf: colourful cards with painted classic covers, each tilted a little differently" width="49%">
  <img src="docs/img/genres.jpg" alt="The genre list: Fantasy under the pointer turns handwritten while four covers pop out around it" width="49%">
</p>

- **Page transitions.** A fat violet squiggle draws itself across the screen, the logo springs in, the next page
  loads behind it, and the squiggle slithers off again (Barba, DrawSVG). It is scaled evenly and cropped, so its ends
  stay round on any screen shape. Going back or forward swaps the page at once: phones already animate those moves
  with their own gesture, and a squiggle on top would play after the page had appeared.
- **Type.** Three roles, as on the site that inspired the design: heavy headings (Rubik 900), clean text (Figtree,
  with its own italic) and handwritten notes (Gochi Hand), each the closest free match to the original's font by
  measured overlap. Books are set in Literata, a serif drawn for long reading on screens. Headings stretch in word by
  word, notes tumble in letter by letter, and button letters dip and spring back; fades never use the springy easing,
  which made things flicker out and back.
- **A real library.** Almost all the books are Standard Ebooks editions: carefully proofread, beautifully typeset and
  released into the public domain, with covers made from public-domain paintings. A few classics from India come from
  Project Gutenberg. Every one is also out of copyright in India (the author's life plus 60 years), and so are its
  translator, illustrator and cover painter: `pipeline/rights.py` checks each of them, and where a cover painting is still
  under copyright in India the book gets a cover drawn here (`pipeline/covers.py`). So authors such as Agatha Christie,
  and Seneca's letters in a translation by a man who died in 1969, are left out.
- **A reader in the page.** epub.js shows the book itself. It opens with the book's own cover, which swings open on
  the desk. On a wide screen the book lies open on two facing pages with a spine between them, and each turn lifts a
  leaf across the spine; on one page at a time (a phone, a narrow window) a corner curls over like paper, and a swipe
  draws the page with your finger. On a phone the whole screen is the page, and the bars slip away while you read on
  and come back when you scroll up or tap. Turn pages with the arrows, the keys, a tap at either edge or a swipe; pick
  the text size, page colour, font, line spacing, and on a phone Pages or Scroll and full screen. Contents shows how
  far through the book and the chapter you are, the minutes each chapter takes, and searches the book's text. The
  footer gives the page of the chapter and the minutes left in it. Bookmark marks the page you are on. Your place is
  kept on your device, to the page, so the book page offers to continue and the home page lists what you are reading.
  Its scripts load only when a book is opened.
- **Highlights and notes.** Select any words to highlight them in one of four colours, underline them, add a note,
  copy them, or look up a word's meaning (from Wiktionary). On a laptop the bar floats by the words; on a phone it sits
  across the top, clear of the words, the selection's handles and the phone's own menus, and every tool is named. The
  Notes panel lists your bookmarks, then your highlights by chapter, exports them as Markdown, and a removed one comes
  back with Undo. They are kept
  in this browser (IndexedDB) with the words around them, so a highlight finds its place again when Standard Ebooks
  corrects an edition.
- **Reading offline.** Keep for offline reading stores a book, its page and its cover on the device, and a service
  worker (`sw.js`, written by the build) opens it with no connection. The site can be installed as an app.
- **Your reading.** Time spent reading (counted only while you are actually turning pages), a streak, the books in
  progress and finished, every note, and the books kept offline. Back up saves it all to one file, and Restore merges
  it on another device.
- **Accounts, if you want one.** Sign in with Google or an email address and a password, choose a name, a colour and
  one of eight marks (no photos, so there is nothing to moderate), and your place in each book, your highlights and
  notes, and your reading time follow you to every device. Everything is kept on the device first and the account is a
  copy: the site works the same signed out, and a long read costs the account a few writes, not hundreds. You can
  share a reader page, sign out (keeping or clearing the device's copy) and delete the account and everything in it.
  Accounts run on Firebase's free plan; its SDK loads only when you are signed in or open the account page.
- **Lines from the books.** Lines worth knowing on the most read books' pages, and a line of the day on the home page,
  each checked word for word against the edition here (`pipeline/quotes.py`): Open at this line opens the reader on it,
  and Share makes a picture of it to post.
- **A shelf you can throw.** Cards tilt and dip the further they are from the middle as you drag (Smooothy), with
  arrow buttons, arrow keys and a sideways trackpad swipe too.
- **A book that opens as you scroll.** It turns to face you, the cover swings open, three pages flip, and you fall
  into the page; only once the page fills the screen does the headline arrive. All of it is CSS 3D, driven by the
  scroll position (ScrollTrigger).
- **Genres with covers.** The genre under the pointer swaps to handwriting, its neighbours make room, and four
  covers pop out around it and drift with the pointer.
- **Books you can open.** Each book page has a 3D copy that follows the pointer, and downloading a book sets off a
  burst of confetti.
- **Little things.** Background shapes that breathe, stickers that slap on, a ring of text that turns as you scroll,
  a tagline that runs along a curve, ribbons that reverse when you scroll up, a shower of confetti in the brand
  colours, stickers you can fling with the pointer (Inertia), a footer that slides out from under the page with a
  giant wordmark, and a bookmark that wiggles on the current menu item. Icons are from Lucide.

<p align="center">
  <img src="docs/img/open-book.jpg" alt="The end of the scroll scene: the book has opened and the page reads Get lost in a good book" width="49%">
  <img src="docs/img/book.jpg" alt="A book page: a 3D copy of Pride and Prejudice beside its title, Read now and Download EPUB" width="49%">
</p>

<p align="center">
  <img src="docs/img/reader.jpg" alt="The reader: Pride and Prejudice lying open on the desk at chapter one, two facing pages with a spine between them" width="640">
</p>

<p align="center">
  <img src="docs/img/phone.jpg" alt="On a phone: the home page, and the catalogue filtered to Fantasy" width="420">
</p>

## Built to work for everyone

- **Reduced motion.** With the system setting on, nothing slides, spins or scrolls itself: pages appear at once and
  the book scene becomes a plain section.
- **No JavaScript.** Every page is complete and readable, with real links between them, and every book can still be
  downloaded; only the reader needs JavaScript.
- **Keyboard and screen readers.** A skip link, labelled fields, visible focus, sliders driven by the arrow keys, genre
  covers that follow keyboard focus, a phone menu that keeps focus inside and closes with Escape, and animated text
  that is still read out as whole sentences.
- **Smooth on a phone.** Measured frame by frame on a real Android phone (Chrome, 60 Hz): scrolling the home page
  drops about one frame in nine, down from one in four, and page changes, the menu and going back hold 60 fps. Text is
  put back together once it has landed, only what moves gets a layer of its own, the background shapes rest while you
  scroll, and the curved tagline moves letter by letter on the graphics card. The opening does its heavy setup while
  the squiggle still covers a still screen.
- **Fast anyway.** Fonts and libraries are served with the site, so it makes no requests to other servers (only
  signing in talks to Firebase). The site's fonts are cut down to the characters used (50 KB together), the reader's
  Literata loads only with a book, and the covers are WebP in four widths. Lighthouse on a phone, on the live site:

  | Page | Performance | Accessibility | Best practices | SEO | Downloads |
  |---|---|---|---|---|---|
  | Home | 81 to 96 | 100 | 100 | 100 | 687 KB |
  | All books | 89 to 91 | 100 | 100 | 100 | 545 KB |
  | A book page | 70 to 98 | 100 | 100 | 100 | 489 KB |
  | The reader | 70 to 97 | 100 | 100 | 100 | 1,073 KB, most of it the book |

  Measured on GitHub Pages, before the move to Cloudflare; performance swung from run to run there, and the painted covers weigh more than the old flat drawings did.

## Run it

With Node.js 22.12 or newer:

```bash
npm install
npm run assets:pull   # the books, covers and link pictures into .assets/ (needs the GitHub CLI, gh)
npm run dev           # http://localhost:4321, reloading as you edit
```

The site is built with [Astro](https://astro.build): every page is made ahead of time (`npm run build` writes the
whole site to `dist/`, and `npm run preview` serves it). The books and covers are not kept in git: they are one
file on the repository's [`library-assets`](https://github.com/Cl0ud-9/Book-Website/releases/tag/library-assets)
release, and `.assets/` is the local copy. `python pipeline/library.py` can also fetch them from Standard Ebooks
(slowly: it keeps to their limits).

An unfinished port of the original site to Angular, from the same course, is kept on the
[`angular-port`](https://github.com/Cl0ud-9/Book-Website/tree/angular-port/angular) branch.

## Using the original fonts

The design follows a site set in Champ, Degular and Hello Organichand. Those are paid fonts, licensed to that site,
so this repository uses the closest free fonts instead. With your own licence, put the font files in `src/assets/fonts/` and
point the three `@font-face` rules at the top of `src/styles/main.css` at them; the rest of the site uses `--font-heading`,
`--font-body` and `--font-hand` and needs no other change.

## Changing the books

The shelf is one list, `CATALOGUE` in `pipeline/library.py`: a Standard Ebooks edition and its genres here. The library
script fetches each book's details, cover and EPUB (slowly, and only once: they are cached), and the build writes every
page from what it fetched (`data/books.json`, checked against a schema in `src/lib/library.ts` on every build). What
the home page features is `FEATURED` in `src/lib/library.ts`.

**How the books are ranked.** Standard Ebooks lists its whole catalogue by how often each book is downloaded there;
the library script records each book's place in that list (`popularity`), and the site orders by it: All books,
every genre shelf and Where to start (the top ten) show the most read first, and Not sure where to begin? offers the
most read book of each mood. `python pipeline/library.py --refresh-popularity` fetches the list again.

**The book of the month** is chosen a year ahead by `pipeline/picks.py` and written into `data/picks.json`, with a
line saying why, which the home page shows. Each book is scored on how much it is read (Standard Ebooks' ranking, and
readers and ratings on Open Library), whether interest in it is rising (its Wikipedia article's views), the time of year
(love stories in February, Shakespeare in April, Tagore in May, adventures in the summer, ghost stories in October, A
Christmas Carol in December) and, once the site counts visits, how many readers here carry on past its first chapter.
Then the best is taken month by month: no book twice within a year, no author twice within six months, never the same
genre two months running, and a short book every third month. A month that has begun never changes; edit the file to
choose a different book. The site is rebuilt on the first of every month, so the pick changes by itself. The hero, the
open book and the gift are chosen by hand, for how their covers look.

```bash
python pipeline/library.py   # fetches new books into data/books.json and .assets/ (needs Pillow)
python pipeline/picks.py     # chooses the books of the month for the year ahead (data/picks.json)
python pipeline/rights.py    # checks every author, translator, illustrator and cover painter is free in India too
python pipeline/quotes.py    # finds each line in data/quotes.json in its book, for "Open at this line"
python pipeline/covers.py    # draws covers for books whose painting is not yet free in India
python pipeline/listen.py    # finds each book's free LibriVox audiobook (data/librivox.json)
python pipeline/fonts.py     # rebuilds the fonts from their sources (needs fonttools and brotli)
python pipeline/social.py    # with npm run preview running: redraws the link previews and the home-screen icon
npm run assets:push          # after any of these changes .assets/: replaces the library-assets release file
```

Before a change goes in:

```bash
npm run check         # type-checks the pages, components and scripts
npm run build
npm run check:links   # every local link, image, font and cover size in dist/ exists
npm run test:e2e      # the browser checks below, against the built site (Python, Playwright and Google Chrome)
```

`npm run test:e2e -- check effects` runs only the suites named. They are in `tests/e2e`: `check` uses the site like a
visitor, `effects` checks every hover effect after links, Back and Forward, `reader_check` the page colours and
highlighting on a phone and a laptop, and `library_check` the filters, the shelves, lines and guides. Screenshots go
to `test-results/`.

`check` drags the shelf, hovers the genres, opens the questions, checks the feed, the account and privacy
pages, follows a genre link into the catalogue, searches and sorts it (without accents), opens a book, checks its
download, goes back, reads it in the reader (turning pages, changing the page colour, and coming back to "Continue"),
opens Genres and Questions from a book's page (dragging a shelf, jumping between topics, and following a link to a
section of another page), and checks the phone menu (and that it steps aside while you read), the reader's bars on a
phone, a Contents jump on a phone (the bars stay, the saved place stays, the next chapter loads and Back to returns),
a narrowing window, highlighting and Undo, keeping a book offline, Your reading and its backup, that going back
returns to where you were, that long titles fit their cards, that no page is ever wider than a 320 px phone, reduced
motion and the site without JavaScript.

**Trying accounts locally.** Firebase's emulators run accounts on your own computer, with nothing to sign up for
(they need Java):

```bash
npm run emulators          # in a second terminal: sign-in and the database, on ports 9099 and 8080
FIREBASE_CONFIG='{"apiKey":"demo-key","authDomain":"demo-bookshelf.firebaseapp.com","projectId":"demo-bookshelf","emulator":"127.0.0.1"}' npx astro build --outDir dist-accounts
python tests/e2e/accounts_check.py   # serves that copy at http://127.0.0.1:4600/ and tests accounts end to end
```

`accounts_check` makes an account on a phone, chooses a name, highlights a line and keeps it, shares a reader
page and reads it as a visitor, signs in on a laptop and finds the highlight there, removes it there and sees it go on
the phone, signs in with Google, checks that the database refuses another account's reads and writes, and edits, signs
out and deletes.

## How it is published

Every pull request and push to `main` runs [`.github/workflows/ci.yml`](.github/workflows/ci.yml): the type check,
the build, the link check and the browser checks. Every push to `main` also runs
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): it fetches the books and covers from the
`library-assets` release, builds the site for the day (for the book of the month), checks every local link, runs
Lighthouse in its phone mode on six pages (three runs each, budgets in [`.lighthouserc.json`](.lighthouserc.json)), and
publishes `dist/` to Cloudflare Workers as static files ([`wrangler.jsonc`](wrangler.jsonc); no Worker code runs). A
broken link, or a page that falls below its speed or accessibility budget, stops the deploy. It also runs on the first
of every month. `public/_headers` sets how long browsers keep each kind of file, and `public/_redirects` serves the
home page at the bare address (every other page keeps its `.html` address).

**Setting up Cloudflare (free).** A deploy by hand, from your own computer, needs only `npx wrangler@4.152.0 login`
once, then `npm run build` and `npx wrangler@4.152.0 deploy`. For the workflow:

1. At [dash.cloudflare.com](https://dash.cloudflare.com/profile/api-tokens), create an API token from the
   **Edit Cloudflare Workers** template.
2. In the repository's Settings, Secrets and variables, Actions: the secret `CLOUDFLARE_API_TOKEN`, and the variable
   `CLOUDFLARE_ACCOUNT_ID` (shown by `npx wrangler@4.152.0 whoami`).

The Worker is named `the-bookshelf` (in `wrangler.jsonc`), so the site is at
`https://the-bookshelf.<your workers.dev subdomain>.workers.dev`. The address the pages give for links and previews is
`https://the-bookshelf.cl0ud-9.workers.dev` unless a `SITE_URL` is set when it is built.

**Turning on accounts (optional, free).** Accounts stay off, and the site says nothing about them, until it has a
Firebase project:

1. At [console.firebase.google.com](https://console.firebase.google.com), add a project (Google Analytics is not
   needed). It stays on the free Spark plan.
2. **Authentication**, Get started, then under Sign-in method switch on **Google** and **Email/Password**. Under
   Settings, Authorized domains, add `the-bookshelf.cl0ud-9.workers.dev`.
3. **Firestore Database**, Create database, in production mode, in the region nearest your readers.
4. In Firestore's **Rules** tab, replace the rules with [`firebase/firestore.rules`](firebase/firestore.rules) and
   Publish. (They keep each reader's data their own; without them the database refuses everything.)
5. Project settings, Your apps, add a **Web** app. Copy its `firebaseConfig`, with every key in double quotes, into a
   repository variable named `FIREBASE_CONFIG`, for example
   `{"apiKey":"AIza…","authDomain":"your-project.firebaseapp.com","projectId":"your-project","appId":"1:…"}`.
   These values are not secrets: every Firebase web app sends them to the browser, and the rules decide what anyone
   may do.
6. Run the deploy again (Actions, Deploy, Run workflow). The header gets Sign in.

The free plan allows 50,000 reads and 20,000 writes a day, which is a few thousand readers a day as the site uses them.
Password reset emails are limited to 150 a day.

**Counting visits (optional).** Create a free site at [GoatCounter](https://www.goatcounter.com) and put its code (the
`bookshelf` in `bookshelf.goatcounter.com`) in a repository variable named `GOATCOUNTER` (Settings, Secrets and
variables, Actions, Variables). The next deploy adds the counter: page views, and each book opened, reaching its
second chapter, finished or downloaded. GoatCounter uses no cookies and keeps nothing personal, and browsers that ask
not to be tracked are not counted at all.

## Honest limits

- **Accounts need a Firebase project.** Until one is set up (above), there are no accounts: reading is kept in your
  own browser, and Back up and Restore move it to another device by hand. No newsletter either; the footer offers a
  feed of the book of the month instead (`feed.xml`), which any feed reader can follow.
- **No discussions yet.** Talking about a book needs someone to look after the conversation. The plan for them (posts
  tied to the chapters you have read, so nothing is spoiled) waits for that. Reader pages show only names chosen
  within strict rules, marks rather than photos, and lines from the books themselves, so they need no moderator; each
  has a Report link.
- **Classics only.** Recent books, such as Colleen Hoover's, and manga such as One Piece are under copyright and
  cannot be shared for free. The site says where to borrow them instead.
- **Illustrated editions are lighter here.** Standard Ebooks gives each illustration twice, once at double
  resolution, and its two Alice books came to 18 and 24 MB, which took minutes to open. The copies here keep the
  ordinary illustrations only (3.7 and 4.1 MB); the text is untouched. A book whose EPUB the library script has not
  copied yet is read from Standard Ebooks (it limits how many a day it hands out).
- **The motion takes a moment.** The opening animation runs before the page is fully shown, which costs some time on a
  slow phone. Reduced motion skips it.

## Project structure

```text
src/pages/          every page (index, books, genres, faq, book-[slug] for each book, read, reading, account, profile,
                    login, signup, privacy, 404) and feed.xml, sitemap.xml and manifest.webmanifest
src/layouts/        Base.astro: the head, header, footer and page transition every page shares
src/components/     the parts pages are made of: covers, cards, the 3D book, buttons, the menu, accordions, ribbons
src/lib/            the data the pages are built from: the books (checked against a schema), genres, moods, the book
                    of the month, questions, icons, shapes and text helpers
src/styles/         main.css (every style: tokens, the fluid type scale, components and sections) and
                    reader-content.css (added inside a book while it is read)
src/scripts/        app.js (transitions, smooth scrolling and every animation), account.js and account-page.js
                    (accounts), reader.js and reader-notes.js (the reader, loaded only on read.html), notes-store.js
                    (highlights and notes, in IndexedDB), your-reading.js, firebase.ts (the parts of Firebase used)
src/assets/fonts/   Rubik, Figtree, Gochi Hand and Literata, Latin subset, built by pipeline/fonts.py
src/icons/          Lucide icons, inlined in every page
src/sw.template.js  the service worker; the build fills in the files it keeps
public/             image/ (the logo and home-screen icons), _headers and _redirects (for Cloudflare)
wrangler.jsonc      how Cloudflare serves the built site
data/               books.json, picks.json, quotes.json, guides.json, moods.json, librivox.json: written by the pipeline
pipeline/           the Python scripts that fetch the books and make covers, fonts, lines and link previews
integrations/       build steps: copying .assets/ into the site, and writing the service worker
tests/              links.mjs, the browser checks (e2e/), and the page-by-page comparison with version 3 (parity/)
firebase/           firestore.rules: who may read and write what in the accounts database
.assets/            not in git: books/ (the EPUB files), image/covers/ and image/social/, kept on the
                    library-assets release (pipeline/assets.mjs)
```

## License

**Source-available**: Copyright 2023-2026 Cloud/9, all rights reserved. You can read the code, run it yourself and
fork it to contribute back. Redistributing it, hosting copies, using it for a business or using it to train AI models
is not allowed without written permission. See [LICENSE](LICENSE). The libraries and fonts keep their own licenses,
listed in [NOTICE](NOTICE). See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md) and
[CHANGELOG.md](CHANGELOG.md).

<br>

<p align="center">
  <sub>Made by <a href="https://github.com/Cl0ud-9">Cloud/9</a>.</sub>
</p>
