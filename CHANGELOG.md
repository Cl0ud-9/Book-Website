# Changelog

What changed in each version of The Bookshelf.

The format follows [Keep a Changelog](https://keepachangelog.com), and the versions follow
[Semantic Versioning](https://semver.org).

## [1.0.0] - 2026-10-21

### Added

- The site is published on [GitHub Pages](https://cl0ud-9.github.io/Book-Website/), checked for broken links and
  images before every deploy.
- The book covers, shelf and background images, which were missing from the repository, so the pages render as
  designed.

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
