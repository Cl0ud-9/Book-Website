# Security policy

## Reporting a vulnerability

Please do not open a public issue for a security problem. Report it privately through GitHub: open the
[Security tab](https://github.com/Cl0ud-9/Book-Website/security) and choose **Report a vulnerability**. Only the
maintainer sees what you send. The maintainer aims to answer within a week.

## What counts

- A way to run script on the site through its search box, forms, a reader's name on a reader page, or the URL.
- A way to read or change another reader's account, notes or reader page, or to take their username, past the
  database's rules (`firebase/firestore.rules`).
- A way to make the local server (`server.js`) return a file other than the site's pages, styles and images.

## Good to know

The site itself is static. Accounts, when they are switched on, are Firebase's: Firebase Authentication signs readers
in (passwords never reach the site) and Cloud Firestore keeps their reading, under the rules in
`firebase/firestore.rules`. The Firebase configuration in the pages is not a secret; the rules are what protect the
data, and `tests/e2e/accounts_check.py` tests them against Firebase's emulators.

## Supported versions

Only the current `main` gets fixes.
