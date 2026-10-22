# Changelog

What changed in each version of The Bookshelf.

The format follows [Keep a Changelog](https://keepachangelog.com), and the versions follow
[Semantic Versioning](https://semver.org).

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
