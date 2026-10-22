<h1 align="center">The Bookshelf</h1>

<p align="center"><strong>A bookshop front page with log-in and sign-up forms, in plain HTML, CSS and JavaScript.</strong></p>

<p align="center">
  <a href="https://cl0ud-9.github.io/Book-Website/"><img src="https://img.shields.io/badge/Live%20site-cl0ud--9.github.io%2FBook--Website-2e7d32?style=for-the-badge" alt="Live site" height="34"></a>
</p>

<p align="center">
  <a href="https://github.com/Cl0ud-9/Book-Website/actions/workflows/pages.yml"><img src="https://github.com/Cl0ud-9/Book-Website/actions/workflows/pages.yml/badge.svg" alt="Deploy"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-source--available-5b4bd5" alt="License: source-available"></a>
  <img src="https://img.shields.io/badge/build%20step-none-555" alt="No build step">
</p>

<br>

<p align="center">
  <img src="docs/img/home.jpg" alt="The Bookshelf home page: a header with search, a green menu, and new arrivals standing on a shelf" width="720">
</p>

The Bookshelf is the front page of an imaginary bookshop: new arrivals on a shelf, featured covers, a newsletter box
and a searchable list of arrivals whose details open with **show more**. It began as a Web Technology course project.

| Page | What it does |
|---|---|
| [Home](https://cl0ud-9.github.io/Book-Website/) | A search box that filters the arrivals by title or author as you type, a menu that jumps to each section, a shelf of new arrivals, featured covers, a newsletter box, and arrivals with expandable details. |
| [Log in](https://cl0ud-9.github.io/Book-Website/login.html) | Username and password, checked in the browser, with errors shown beside each field. |
| [Sign up](https://cl0ud-9.github.io/Book-Website/signup.html) | Username, password with confirmation, and a 10-digit contact number, checked the same way. |

### Fast and accessible

The home page scores **100 in all four Lighthouse categories** (performance, accessibility, best practices and SEO) on
a phone profile. The first cover appears in about 1.6 s and the page downloads about 0.35 MB.

- **No libraries and nothing fetched from other sites.** The icons and logo are drawn in the page, and under 90 lines
  of plain JavaScript do the rest.
- **Right-sized images.** Every cover is WebP in three widths, the browser picks the one the screen needs, and covers
  below the first screen load as you scroll.
- **Usable without a mouse or a screen.** A skip link, labelled fields, described covers, visible focus, buttons that
  announce whether they are open, and search results and form errors read out by screen readers. Text meets WCAG AA
  contrast.

<p align="center">
  <img src="docs/img/signup.jpg" alt="The sign-up form, with an error shown beside each field that needs fixing" width="360">
</p>

## Run it

Open `index.html` in a browser. That is all it needs.

To serve it the way a host would, with Node.js 18 or newer:

```bash
npm install
npm start          # http://localhost:3000
```

`server.js` is a small Express server that serves only the site's pages, styles and images.

An unfinished port of the site to Angular, from the same course, is kept on the
[`angular-port`](https://github.com/Cl0ud-9/Book-Website/tree/angular-port/angular) branch.

## How it is published

Every push to `main` runs [`.github/workflows/pages.yml`](.github/workflows/pages.yml): it copies the pages, styles,
scripts and images, checks that every local link and image in them exists (including each size of every cover and
the backgrounds named in the styles), and deploys them to GitHub Pages. A broken link stops the deploy.

## Honest limits

- **No back end.** The forms check what you type and then show a message. Nothing is sent or stored, so there are no
  accounts and no real newsletter.
- **Search covers this page only.** It filters the ten arrivals listed; there is no catalogue behind it.
- **Sample content.** The books, covers and prices are placeholders, not a real catalogue.

## Project structure

```text
index.html        the home page
login.html        log-in form
signup.html       sign-up form
404.html          shown for addresses that do not exist
css/style.css     styles shared by every page
css/forms.css     styles for the log-in and sign-up cards
js/main.js        search, show more and the newsletter message
js/forms.js       checks the log-in and sign-up fields
image/            covers (book-N-180/360/720.webp), the shelf, backgrounds and the logo
server.js         optional local server (npm start)
```

## License

**Source-available**: Copyright 2023-2026 Cloud/9, all rights reserved. You can read the code, run it yourself and
fork it to contribute back. Redistributing it, hosting copies, using it for a business or using it to train AI models
is not allowed without written permission. See [LICENSE](LICENSE). Express and the sample artwork keep their own
licenses, listed in [NOTICE](NOTICE). See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md) and
[CHANGELOG.md](CHANGELOG.md).

<br>

<p align="center">
  <sub>Made by <a href="https://github.com/Cl0ud-9">Cloud/9</a>.</sub>
</p>
