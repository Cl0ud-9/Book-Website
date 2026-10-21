// Serves the site locally at http://localhost:3000. Opening index.html directly works too.
const express = require("express");

const app = express();
const port = process.env.PORT || 3000;

// Only the site's own files are served, not the server, its packages or the project docs
const site = ["index.html", "login.html", "signup.html", "css", "image"];
app.use((req, res, next) => {
  const first = decodeURIComponent(req.path).split("/")[1];
  if (first === "" || site.includes(first)) return next();
  res.sendStatus(404);
});
app.use(express.static(__dirname, { index: "index.html", dotfiles: "deny" }));

app.listen(port, () => {
  console.log(`The Bookshelf is running at http://localhost:${port}`);
});
