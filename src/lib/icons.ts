// The icons: Lucide's (src/icons, ISC licence) under the names the pages use, gathered into one sprite that every page
// carries once, so an icon is a <use> of it.

/** name used in the pages -> Lucide file */
export const ICONS = {
  expand: "maximize", shrink: "minimize", down: "arrow-down-to-line", user: "user-round", logout: "log-out", feather: "feather",
  leaf: "leaf", coffee: "coffee", cat: "cat", eye: "eye", "eye-off": "eye-off", sync: "refresh-cw", link: "link",
  cloud: "cloud-check", arrow: "arrow-right", left: "arrow-left", up: "arrow-up", plus: "plus", menu: "menu", close: "x",
  search: "search", book: "book-open", sparkles: "sparkles", gift: "gift", bookmark: "bookmark", heart: "heart", mail: "mail",
  star: "star", layers: "layers", globe: "globe", package: "package", clock: "clock", download: "download",
  contents: "list-ordered", type: "type", sun: "sun", moon: "moon", prev: "chevron-left", next: "chevron-right",
  read: "book-marked", highlight: "highlighter", note: "notebook-pen", trash: "trash-2", copy: "copy", share: "share-2",
  listen: "headphones", offline: "wifi-off", save: "hard-drive-download", chart: "chart-column", flame: "flame",
  define: "book-a", pencil: "pencil", check: "check", underline: "underline", library: "library", flag: "flag",
} as const;

/** the site's own drawings, which are not Lucide's */
const OWN = {
  logo: '<symbol id="i-logo" viewBox="0 0 48 48"><path fill="currentColor" d="M24 9.5c-4.2-3.3-10.3-4.4-17-3.5a2 2 0 0 0-1.7 2v27.6a2 2 0 0 0 2.3 2c6.2-.8 11.3.2 15.2 3.1a2 2 0 0 0 2.4 0c3.9-2.9 9-3.9 15.2-3.1a2 2 0 0 0 2.3-2V8a2 2 0 0 0-1.7-2c-6.7-.9-12.8.2-17 3.5Zm-2.2 4.2v20.9c-3.6-1.8-7.9-2.6-12.5-2.4V10c4.9-.4 9.3.8 12.5 3.7Zm4.4 0c3.2-2.9 7.6-4.1 12.5-3.7v22.2c-4.6-.2-8.9.6-12.5 2.4V13.7Z"/><path fill="currentColor" d="M33 4h5v12l-2.5-2-2.5 2z"/></symbol>',
  "bookmark-on": '<symbol id="i-bookmark-on" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></symbol>',
  github: '<symbol id="i-github" viewBox="0 0 24 24"><path fill="currentColor" d="M12 .5a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.4-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0C17.3 4.6 18.3 5 18.3 5c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.2c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .5Z"/></symbol>',
} as const;

export type IconName = keyof typeof ICONS | keyof typeof OWN;

const files = import.meta.glob<string>("../icons/*.svg", { query: "?raw", import: "default", eager: true });

function lucideSymbol(name: string, file: string): string {
  const svg = files[`../icons/${file}.svg`];
  if (!svg) throw new Error(`icon ${name}: src/icons/${file}.svg is missing`);
  const inner = svg.slice(svg.indexOf(">", svg.indexOf("<svg")) + 1, svg.lastIndexOf("</svg>")).replace(/\s+/g, " ").trim();
  return `  <symbol id="i-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</symbol>`;
}

export const SPRITE = `<svg xmlns="http://www.w3.org/2000/svg" hidden>
  ${OWN.logo}
  ${OWN["bookmark-on"]}
  ${OWN.github}
${Object.entries(ICONS).map(([name, file]) => lucideSymbol(name, file)).join("\n")}
</svg>`;
