# The Bookshelf in Angular (unfinished)

This branch keeps an unfinished port of the site to Angular 15, started in 2023. The finished site is the plain HTML
version on [`main`](https://github.com/Cl0ud-9/Book-Website), which is the one published.

## What is here

- Routes for the home page (`/`), log in (`/login`) and sign up (`/signup`), plus an about component.
- The home, log-in and sign-up components, each made from the matching static page, and the images in
  `src/assets/image`.

## What is missing before it runs

- `src/app/app.component.html` is empty. It needs a `<router-outlet>` (and the header) for any route to show.
- The component templates are whole HTML documents, with `<html>`, `<head>` and their own stylesheet links. Only the
  `<body>` content belongs in a template, and the shared styles belong in `src/styles.css`.
- Links point at `.component.html` files instead of using `routerLink="/login"` and `routerLink="/signup"`.
- The log-in and sign-up stylesheets look for images in `../image/`; they are in `../../assets/image/`.
- Each component carries a copy of the 7.5 KB site stylesheet, over Angular's 4 KB per-component budget, so
  `ng build` stops.

## Running it

Angular 15 needs Node.js 14.20, 16.13 or 18.10 or newer within those lines.

```bash
cd angular
npm ci
npx ng serve      # http://localhost:4200
```
