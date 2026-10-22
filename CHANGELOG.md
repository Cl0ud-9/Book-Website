# Changelog

What changed in each version of The Bookshelf.

The format follows [Keep a Changelog](https://keepachangelog.com), and the versions follow
[Semantic Versioning](https://semver.org).

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
  They now glide into place.
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
