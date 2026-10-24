# Changelog

What changed in each version of The Bookshelf.

The format follows [Keep a Changelog](https://keepachangelog.com), and the versions follow
[Semantic Versioning](https://semver.org).

## [3.5.0] - 2026-10-25

### Added

- Pages that turn like paper. On one page at a time (a phone, a narrow window) a corner lifts and curls across, the back
  of the paper shaded and the page beneath in its shadow; a swipe draws the page with your finger, and letting go early
  lays it back down. Two facing pages turn across the spine as before.
- Bookmarks. Bookmark, in the reader's bar, marks the page you are on: the button fills and a ribbon hangs from the
  page. Bookmarks are listed first in Notes, kept with your notes (and in your account), and shown on Your reading.
- Search the book, in Contents: chapters whose names match stay in the list, and every place the words appear in the
  text is listed below with the words in bold; choosing one opens the book there, marks the words for a moment, and
  Back to … returns you.
- Contents shows how far through the book you are and about how long is left, the minutes each chapter takes, and
  how far through the chapter you are in.
- Page numbers in the footer: the page (or pages, on two facing pages) of the chapter, and how many it has at this size.
- On a phone: Pages or Scroll, line spacing, full screen, the screen kept awake while you read, and Back closing the
  open panel or bar before it leaves the book.
- Sign-in and sign-up pages, the header showing who is signed in, and a question before a device's reading joins an
  account.

### Changed

- The Text panel is laid out on a grid: each setting's name in a column of its own (above its choices on a phone),
  choices sharing their row evenly with each icon beside its word, and the chosen page colour ringed in the page's ink.
- The highlight bar has two rows, the colours and Underline in one and Note, Define, Copy, Share and Remove in the
  other, says whether you are marking new words or changing a mark, and names each tool on hover.
- Choices that slide: the highlight in a row of options (All books, Fiction, Non-fiction; the reader's font, spacing and
  mode) moves to the new choice, and steps, messages and popups arrive rather than blink in.

### Fixed

- A tap on a page in Chrome on Android picked out the word and opened Google's Touch to Search instead of turning the
  page.
- Reopening a book, changing the text size, font or spacing, or going back into the chapter before could leave you a
  page or two from where you were: a chapter grows after it is shown (its type and spacing arrive, then its fonts), and
  a place at the very top of a page was taken for the end of the page before. The reader now waits for the chapter to
  settle and finds the place by its first letter.
- The last pages of a chapter could not be reached until a turn woke epub.js, which had missed the chapter growing.
- Highlights that span an invisible word joiner (Standard Ebooks puts them in dates and names) were saved with a space
  in its place and then shown as not found in this edition.
- Underlines were drawn as boxes, the same words could be underlined again and again, and Remove left one behind; the
  same words are now marked once, and marking over a mark changes or joins it.
- After a fast fling on a phone the screen could stay blank.
- Engravings were inverted twice on the Night page, and showed on a white box on Paper and Sepia.
- Time left in a chapter said hundreds of minutes until the book was measured.

## [3.4.0] - 2026-10-24

### Added

- Accounts, once the site has a Firebase project (README: "Turning on accounts"). Sign in with Google or an email
  address and a password, choose a name, a username, a colour and a mark, and your place in each book, your highlights
  and notes, and your reading time are kept in your account and come with you to every device you sign in on. The
  site works as before signed out; signing out can keep or clear the device's copy, and deleting the account removes
  everything it kept. The database's rules (`firebase/firestore.rules`) keep each account's data its own.
- Reader pages, for those who share theirs: name and mark, what they are reading and have finished, their reading time
  and, if they choose, the lines they highlighted (never notes), with a link to report a page.
- A privacy page saying what is kept about you, where, and how to remove it.
- Non-fiction: philosophy, lives and memoirs, history and politics, science and nature, essays and letters. All books
  can show fiction or non-fiction, any genre, the new From India shelf, a mood and a length, kept in the address.
- Twenty books, among them The Origin of Species, On Liberty, Frederick Douglass's Narrative, three by Tagore
  (Gitanjali, The Home and the World and My Reminiscences), and five classics from India from Project Gutenberg, by
  Sarojini Naidu, Toru Dutt and Kalidasa among others. 161 books in all. Meditations, The Art of War and Walden moved
  to the non-fiction shelves.
- Before you start (who's who and what to know, without spoilers) and Lines worth knowing on the most read books'
  pages, a line of the day on the home page, Open at this line in the reader, and Share as a picture.
- Each book page names its edition, Standard Ebooks or Project Gutenberg.
- The book of the month is chosen by `tools/picks.py` from how much a book is read here and on Open Library, how
  readers rate it, rising interest and the time of year, under rules that keep the months varied, and the home page
  says why it was chosen.
- A feed of the book of the month (`feed.xml`) in place of the newsletter sign-up, which sent nothing.
- Literata, a serif drawn for reading on screens, is the reader's typeface, with Georgia and the site's sans as the
  other choices, and the site's text has a real italic.
- `tools/accounts_check.py`, `tools/reader_check.py` and `tools/library_check.py` test accounts (against Firebase's
  emulators), the reader's colours and highlighting, and the library's filters, shelves, lines and guides.

### Changed

- On a phone, the highlight bar sits across the top of the screen, in place of the reader's bar, with every tool
  named. Floating by the words it covered them and the handles that stretch a selection, fought the phone's own Copy
  menu and Google's search panel, and vanished after a handle was dragged. It now stays while a selection is stretched
  or scrolled, and goes when the selection does.
- The open book on the home page shows its headline and buttons only once its page fills the screen; they used to
  arrive while the book was still opening behind them.
- The two Alice books are kept here, with their illustrations at ordinary resolution, and open in seconds: from
  Standard Ebooks they were 18 and 24 MB and took minutes. Engravings sit on the page's own colour.
- The old log-in and sign-up addresses lead to Your account (or Your reading, without accounts).
- The "Staff pick" sticker says "This month", as no staff choose the book.
- Sections on Your reading have headings a size down, in proportion to what is under them.
- Seneca's letters, Gandhi's autobiography and Arsène Lupin left the shelf: their translators died after 1965, or
  their dates are unknown, so they may still be under copyright in India. Seven books whose cover paintings may be
  have covers drawn here instead.

### Fixed

- Switching the reader from Night back to Paper (or to any page colour used before) left the old colours: the text
  stayed light on a dark page.
- The book in the middle of the page-change screen vanished and came back, and turned inside out, as it left: its fade
  used a springy easing that went past nothing. If a slow phone made the next page load in full, the screen went blank
  and the book appeared a second time; that page now starts covered, the book in place.
- Menus, cards and handwritten notes no longer flicker as they fade in, for the same reason.
- The How it works cards no longer cover the ends of each other's lines.
- The reader's footer said "Titlepage"; it says "Title page".
- Standard Ebooks' imprint page is no longer justified on a phone, where it left wide gaps between words.
- The phone menu's Tab trap skips links that are hidden.

## [3.3.0] - 2026-10-24

### Added

- Highlights and notes in the reader. Select any words to highlight them in one of four colours, underline them, add
  a note, copy them or look up a word's meaning (from Wiktionary). The Notes panel lists them by chapter, opens the book
  at each one and exports them as Markdown. A removed highlight comes back with Undo. They stay in this browser.
- Reading offline: Keep for offline reading on a book's page, or in the reader's Text settings, stores the book on the
  device, and it opens with no connection. The site can be installed as an app, with its own icon.
- Your reading: your week of reading as a chart, a streak, the books you are reading and have finished, all your notes,
  the books kept offline, and Back up, Restore and Clear everything.
- A free LibriVox audiobook on 110 books' pages.
- On a phone, each of the reader's tools has a label under its icon, and Download sits in Text settings.

### Changed

- The header, the menu, the footer and the home page's buttons lead to Your reading and the books, instead of the
  log-in and sign-up previews, which did nothing. "Talk about it" in How it works is now "Make it yours", as there are
  no discussions yet.
- The four How it works cards overlap only slightly, so none hides the end of another's lines.
- The Questions page answers how to read offline and how to move your notes to another device.

## [3.2.0] - 2026-10-24

### Added

- Contents marks the chapters you have read, groups the edition's own pages (title page, imprint, colophon, licence)
  under "About this edition", calls bare numbers "Chapter I", and offers a search box in books with 25 or more
  entries, such as The Count of Monte Cristo.
- After a jump through Contents, a "Back to …" button returns you to where you were.
- A speed and accessibility check on every deploy: Lighthouse, in its phone mode, three runs per page, with budgets in
  `.lighthouserc.json`. A page that drops below them stops the deploy.
- Optional counting with GoatCounter (no cookies, nothing personal), turned on by a `GOATCOUNTER` repository variable.
  Browsers that ask not to be tracked are never counted. A new question on the Questions page says what is counted.

### Changed

- The opening squiggle plays only when a visit starts on the home page. Every other page, however you arrive, shows
  straight away.
- Effects further down a page are built as you come near them, and cards and shelves rise in using the browser's
  own tools, so pages are ready to use much sooner on a slow phone. On a slowed phone CPU the main thread is blocked
  for 147 ms instead of 2.1 s on All books, 273 ms instead of 707 ms on Genres, and 667 ms instead of 1.5 s on home.
- The reader switches between one page, two pages and scrolling when the window changes size, at the same place.

### Fixed

- On a phone, after jumping to a chapter through Contents, the book could not be scrolled any further: the next
  chapter never loaded.
- On a phone, the top bar hid itself after a Contents jump, so Contents could not be opened again.
- Looking at a chapter through Contents moved your saved place, so "Continue reading" started wherever you had looked.
- Choosing Colophon in Contents named the next section instead.
- Narrowing the window after opening a book left the two-page spine shadow running through a single page.
- The Questions page never told Chrome when its main text appeared, so its speed could not be measured.

## [3.1.1] - 2026-10-23

### Changed

- Every book except the two illustrated Alice editions (over 8 MB) is now kept on the site, so reading and
  downloading no longer depend on Standard Ebooks being reachable. 142 of the 144 books open the book of the month
  with their real first line.

### Fixed

- Adding books could change the book of the month in the middle of a month. Each month's pick is now written down
  in `library/picks.json` a year ahead, and a month never changes once it has been shown.

## [3.1.0] - 2026-10-23

### Added

- A Genres page: a shelf for each of the eleven genres, most read first, to scroll or drag sideways.
- A Questions page: every question by topic, with a list of topics that stays in view and marks the one you are
  reading (a bar of topic pills on a phone). Ranking and the book of the month are among the answers.
- All books can be sorted by most read, title, or length, and the choice is kept in the address.
- The books are ranked by how often they are read at Standard Ebooks, and every shelf shows the most read first.
- The book of the month takes turns among the twelve most read books, opens with its real first line, and changes
  by itself: the site is rebuilt on the first of every month.
- The reader opens with the book's cover, which swings open on the desk once the first page is ready.
- On a wide screen the book lies open on the desk with a spine between its pages, and each turn lifts a leaf across
  it; on a narrower one the words slide on. On a phone the bars slip away while you read on and come back when you
  scroll up or tap. The contents mark the chapter you are in, and a new chapter's name rises into the footer.

### Changed

- Genres and Questions in the menu and footer open their own pages.
- "Made by readers, for readers" now sits on the page under the open book's buttons.
- The reader's page colours fade into each other, and long words break at the line's end so justified text on a
  phone has no wide gaps.

### Fixed

- Genres and Questions, clicked anywhere but the home page (in the reader, say), opened the top of the home page:
  a link to a section of another page now lands on that section.
- "Made by readers, for readers" sat on the dark edge of the open book on a laptop, where it could not be read.
- On a phone the topic pills wrapped onto two and three lines, and the genre shelves were wider than the screen.
- On a tablet, the title page and the imprint were each followed by a blank page.
- The home page still said the library ran "from Austen to Asimov", though Asimov is not in it.
- The book of the month rounded down: a book of 1 hour 58 minutes was "about 1 hour" long. It now says 2 hours.
- On a phone, the moon sticker covered the end of the book of the month's first line.

## [3.0.0] - 2026-10-22

The Bookshelf is now a free library of the classics. The look, the motion and every animation stay; the made-up books,
prices and bag are gone.

### Added

- 144 classics, from Austen and the Brontës to Sherlock Holmes, Frankenstein and Gatsby, in eleven genres: Standard
  Ebooks editions with their painted covers, free of copyright in both the US and India. `tools/library.py` fetches
  each book's details, cover and EPUB (slowly, and only once), and the pages are built from what it fetched.
- A reader in the page (`read.html`, with epub.js): pages to turn on a laptop, two facing pages on a wide screen, a long
  scroll on a phone, contents, text size, Paper, Sepia and Night pages, and Book, Serif and Sans fonts. It remembers
  your place on your device, and says so plainly if a book cannot be opened. Its scripts load only when a book is.
- Every book's page has Read now, an EPUB download (with a burst of confetti), Kindle and Kobo editions, the full
  description, reading time, length and translator.
- Continue reading on the home page, and a Read button that becomes Continue (with how far you got).
- Search ignores accents, so "bronte" finds Brontë.

### Changed

- The home page: Where to start, Not sure where to begin?, Book of the month with real lines from the book, eleven
  genres, and new questions, including why recent bestsellers and manga cannot be here.
- All books shows the whole library, and its cards drop in as they come into view instead of all at once.
- Card titles fit their card by the length of their own longest word, so short titles stay big.

### Removed

- The ten made-up books, their prices, Add to bag, and the tools that drew their covers.

### Fixed

- In the reader on a phone, a strip of white showed under the page once the browser hid its address bar. The reader
  now always fills the whole screen, in every page colour.
- The two books on the home page, the cover on a book's page and the gift book swung back and forth before settling.
  They now rise straight into place and float up and down without rocking. The home page's books also seemed to
  change their 3D angle as they moved, because they were seen through one viewpoint fixed to the hero; each book now
  carries its own, so its angle stays the same.
- After a new version went live, a browser could keep using the old scripts for up to ten minutes. The site's CSS and
  scripts now carry a version in their address, so every visit gets the current ones.
- On a phone, an orange gap showed between a 3D book's cover and its pages at the corners. The pages now sit just
  inside the covers, as in a real hardback.
- Tapping or clicking a book at the top of the home page makes it lean a little towards your finger and spring back.
- The reader's buttons kept their names for screen readers on phones, each page has a title, and the reader no longer
  adds an unload listener (deprecated in browsers).

## [2.3.1] - 2026-10-22

### Fixed

- The Readers' favourites shelf jittered back and forth when the page was scrolled past it on a laptop. All four
  books fit on screen, so the shelf had nothing to slide and its limits turned inside out; it now stands still. The
  main shelf also ignores up-and-down scrolling now, and moves with a sideways trackpad swipe as well as a drag.
- On phones, the edges of the 3D books' pages looked like a barcode, and the book at the back drew its page block as
  a strip across its cover. The page edges are softer, and the back book is 3D again.
- The bookmark on the current page's button stuck up out of the top of the window, where it was cut off. It now
  hangs below the button, and the header buttons are round pills like the original's.

### Added

- `tools/effects.py` checks that every hover effect still responds after a link, Back and Forward.

## [2.3.0] - 2026-10-22

Smoothness, measured frame by frame on a real Android phone, and the small things a finished site has.

### Changed

- Scrolling on a phone is much smoother: the home page drops about one frame in nine while scrolling, down from one
  in four. Hundreds of finished letters no longer each keep a layer and a transform, the genre words only get their
  layers while the pointer is over them, the background shapes rest while a phone scrolls, and the curved tagline
  moves letter by letter instead of being laid out again every frame.
- The opening does its heavy setup (fonts, measuring the page, decoding the hero's covers) while the squiggle still
  covers a still screen, so the animation itself runs without a hitch.
- Going back returns to where you were on the page, as on any other site.
- On desktop, the shelf slider measures its cards before moving them and stops working while it is off screen.

### Added

- Link previews: a 1200 x 630 picture for the site and one for each book, the size and format every chat app and
  social site shows, with the tags they read. Also a home-screen icon for phones, canonical addresses and a sitemap.
- `tools/fonts.py` rebuilds the three fonts from their sources, and `tools/social.py` redraws the previews.

### Fixed

- The rupee sign in every price came from a different font: the cut-down Figtree had left it out. The ✦ in the ribbons
  and badges also came from a system font; one is now drawn into Rubik, matching the confetti sparkle.
- With reduced motion or without JavaScript, the curved tagline was not shown at all.
- After moving to another page from halfway down one, the Menu button could stay hidden until you scrolled up.
- The 404 page is no longer offered to search engines.

## [2.2.0] - 2026-10-22

### Changed

- The squiggle transition is back, in place of the panel. It now scales evenly and crops instead of stretching to
  the screen, so its ends stay round on a tall phone, and it starts wide enough to cover every corner.
- Type follows the site that inspired the design, role for role: Rubik 900 for headings, Figtree for text and
  Gochi Hand for the handwritten notes, the closest free matches to its fonts by measured overlap. The serif italic
  is gone, headings are plain again, and the logo is "Bookshelf" with "The shop" beside it.
- The phone Menu button is a split button, a text block and a square icon block, like the other buttons.

### Fixed

- Going back or forward on a phone showed the page and then played the transition over it, because phones already
  slide the previous page in with their back gesture. History moves now swap the page at once.
- Going back sometimes reloaded the whole page instead of swapping it: always on some browsers, and on all of them if
  back was pressed while the squiggle was still on screen. A back press during a transition now waits for it to end.
- The page could be wider than a phone screen: the footer's bottom row overshot its edges, and the logo and Menu
  button did not fit beside each other below about 420 px. Nothing can widen the page now, even while animating.
- The footer wordmark was cut off at the right edge.
- On phones, long book titles ("The Lighthouse Letters", "Last Seen Wednesday") ran past the edge of their card, and
  "Contemporary" ran off the genre panel. Both now shrink to fit their box.
- The phone Menu button covered whatever was under it while reading. It slides away while scrolling down and comes
  back as soon as you scroll up (or tab to it).
- The Contemporary tag on Paper Moons was the same pale green as its card, so only the word showed. A tag that
  matches its card is white now.
- Words in the curved tagline ran together at its bends on phones.

## [2.1.0] - 2026-10-22

A cleaner, more finished pass, and every book can now be opened. On the live site every page scores 100 for
accessibility, best practices and SEO, and 89 to 98 for performance on a phone.

### Added

- A page for each of the ten books: a 3D copy that leans towards the pointer, the price and saving, Add to bag (with
  a burst of confetti), the details, and three related books. Every card on the site opens one, and dragging a shelf
  never opens a card by mistake.
- A new footer: a monthly newsletter, three columns of links, a giant wordmark and a tidy sign-off with Back to top.
- Icons from Lucide on the stickers, book details, newsletter field and Back to top.

### Changed

- The opening and page transitions: a violet panel with the wordmark rolling up letter by letter, which lifts away on
  a smooth curve, replacing the round-ended squiggle. It now covers the whole screen on phones too, corners included.
- Type: heavy Rubik headings with one word in Instrument Serif italic, Instrument Sans for text, and Instrument Serif
  italic for the notes that were handwritten. The three fonts weigh 77 KB together.
- Brand confetti and flingable stickers (a moon, a sparkle, a staff-pick seal) instead of emoji, and a Readers' choice
  badge instead of the cartoon heart.
- The hero shows two books, one leaning behind the other, instead of three scattered across the page.

### Fixed

- The intro left the screen's corners uncovered on phones.

## [2.0.0] - 2026-10-22

A redesign: a bright, illustrated bookshop where everything moves, with a new page for the whole catalogue. On the
live site, Lighthouse on a phone scores 90 to 99 for performance and 100 for accessibility, best practices and SEO on
every page.

### Added

- An opening animation: a violet squiggle covers the screen, the logo springs in, and the squiggle slithers away to
  reveal the page. Moving between pages plays it in reverse, without reloading.
- Smooth scrolling, and headings, notes and stickers that stretch, tumble and pop in as they arrive.
- A draggable shelf of new books whose cards tilt as they move, with arrow buttons and arrow keys.
- How it works: four cards that fan out and make room for the one under the pointer.
- A closed book that turns to face you, opens and flips its pages as you scroll.
- A giant genre list: the word under the pointer turns handwritten and four covers pop out around it.
- Readers' favourites with a shower of emoji, a curved scrolling tagline, ribbons that run the other way when you
  scroll up, emoji you can fling with the pointer, and a footer that slides out from under the page.
- `books.html`: every book, searchable by title, author or genre, with genre chips. Genre links on the home page open
  it already filtered.
- Ten original covers, drawn for the site in 180, 360, 720 and 1080 pixel widths, with new fictional titles and
  authors.
- A phone menu, a 404 page in the new style, and `tools/` with the page generator, the cover renderer and a browser
  check that exercises the site on desktop, phone, reduced motion and without JavaScript.

### Changed

- The look: a yellow, magenta and violet palette, chunky display type, handwritten notes, rounded colour cards.
- Fonts and libraries (GSAP, Lenis, Barba, Smooothy) are served with the site, so it still makes no requests to other
  servers. Fonts are cut down to the characters used: 122 KB for all four.
- The link check before each deploy also follows links with a query or fragment, and fonts named in the styles.

### Removed

- The old stock covers, the shelf picture and the background photos.

### Accessibility

- Everything that moves respects the reduced-motion setting, and without JavaScript every page is complete and
  readable.
- Split-up animated text is read as whole words and sentences by screen readers, sliders and genre covers work with
  the keyboard, and the phone menu traps focus and closes with Escape.

## [1.1.0] - 2026-10-22

Faster, accessible, and no longer dependent on other sites. In Lighthouse on a phone, the home page went from 67 to 100
for performance, 74 to 100 for accessibility, 96 to 100 for best practices and 82 to 100 for SEO. The first cover
appears in 1.6 s instead of 11.3 s, and the page downloads about 0.35 MB instead of 4.2 MB.

### Added

- The search box searches: it filters the new arrivals by title or author as you type and says how many match.
- The newsletter form thanks you instead of reloading the page.
- The forms show errors beside each field instead of in pop-ups, and move you to the first one.
- A skip link, a label for every field, a description for every cover, and a visible keyboard focus.
- A page for addresses that do not exist (`404.html`), page descriptions for search engines, and a link preview.

### Changed

- Covers and backgrounds are WebP in three widths (180, 360 and 720 pixels) instead of PNG and JPEG up to 2250
  pixels tall, and the browser picks the one it needs. Covers below the first screen load as you scroll.
- The green is darker, so white text on it is readable (contrast 4.7:1 instead of 2.9:1).
- New arrivals are laid out in columns, and the shelf shows several covers a row on phones instead of one.
- The icons and the logo are small drawings in the page. Font Awesome and jQuery are no longer loaded, and the logo,
  the favicon and three covers are no longer fetched from Pinterest and Amazon.
- The page uses the system font. Poppins was named but never loaded.

### Fixed

- Wrong titles and authors: "A Story of Misty Forest" by Brigitte Schwartz (was "Mistery" and "Schwertz"), Noell
  Morrison (was "Marrison"), and two descriptions credited the wrong author.
- The featured section was never closed, and the footer used an `<n>` tag, which does not exist.
- The log-in and sign-up cards were wider than small phone screens.

## [1.0.0] - 2026-10-21

### Added

- The site is published on [GitHub Pages](https://cl0ud-9.github.io/Book-Website/), checked for broken links and
  images before every deploy.
- The book covers, shelf and background images, which were missing from the repository, so the pages render as
  designed.
- A phone layout for the header, where the search box was squeezed to a sliver.

### Fixed

- Icons never showed, because Font Awesome was not loaded.
- The logo text overlapped the logo image.
- The Sign-up button went nowhere, and the Log-in button opened a copy of the sign-up form. `login.html` now asks for a
  username and password, `signup.html` keeps the registration form, and they link to each other and home.
- Each form page had two titles, both "Login Page".
- The sign-up form accepted contact numbers longer than 10 digits, and said passwords had to be "greater than" 6
  characters when 6 was allowed.
- `server.js` (was `BookWeb.js`) served a page that does not exist, and the whole project folder with it. It now
  serves only the site.

### Changed

- `Assignment_2.html` and `SignUp.html` are now `login.html` and `signup.html`; `style.css` moved to `css/`, where
  the pages look for it.

## [0.1.0] - 2023-04-17

The Web Technology course project: the home page, the forms and an Express server.
