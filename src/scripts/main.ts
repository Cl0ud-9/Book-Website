// The site's script, on every page: the animation libraries from npm (bundled, fingerprinted and cached, instead of the
// copies the site used to carry), then accounts and the site itself. Modules run in the order they are imported.
import "./globals";
import "./kids.js";
import "./account.js";
import "./app.js";
