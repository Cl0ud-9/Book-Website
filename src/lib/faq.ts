// The questions on the FAQ page, by topic. An answer may end with a link: [its words, its address].
import { ACCOUNTS } from "./config";

export type Question = readonly [question: string, answer: string, link?: readonly [string, string]];

const ACCOUNT_FAQ: Question[] = [
  ["Do I need an account?",
    "No. Reading, downloading, your place in each book, your highlights, notes and reading time all work without one. "
    + "They are kept on your own device, and Your reading shows them all."],
  ...(ACCOUNTS ? [
    ["What does an account add?",
      "Your reading on every device: sign in on your phone and your laptop, and your place in each book, your "
      + "highlights, notes and reading time are on both. You also get a name and a reader page you can share if you "
      + "want to, with what you are reading and have finished.", ["Your account", "account.html"]],
    ["Who can see my reading?",
      "Only you, unless you share your reader page. Then anyone with its link sees your name, the books you are "
      + "reading and have finished, your reading time and, if you choose, the lines you highlighted. Your notes are "
      + "never shown to anyone."],
    ["How do I sign in?",
      "With your Google account, or with an email address and a password. Forgot it? Press Forgot your password on "
      + "the sign-in page and we will email you a link to choose a new one."],
    ["Can I delete my account?",
      "Yes, at any time, on Your account. Everything it keeps is removed for good. Your own device keeps its copy, so "
      + "you can carry on reading without an account."],
  ] as Question[] : []),
  ["Can I move my notes to another phone or laptop?",
    (ACCOUNTS ? "Sign in on both and they are on both. Or, without an account: " : "Yes. ")
    + "On Your reading, Back up saves everything to one small file; open Your reading on the other device and choose "
    + "Restore with that file."],
];

export const FAQ_TOPICS: readonly (readonly [key: string, name: string, colour: string, icon: string, items: Question[]])[] = [
  ["reading", "Reading", "pale-blue", "read", [
    ["How do I read a book here?",
      "Open any book and press Read now. It opens right in your browser: on a laptop you turn the pages with the "
      + "arrows, the arrow keys or a swipe, and on a phone you simply scroll."],
    ["Will it remember where I stopped?",
      "Yes. Open the book again and it picks up on your page, and the home page lists the books you are reading. "
      + (ACCOUNTS ? "It is kept on this device, and in your account if you sign in, so your other devices know it too."
        : "It is kept on this device.")],
    ["Can I change how the text looks?",
      "Press Text in the reader: make the type bigger or smaller, choose a Paper, Sepia or Night page, and read in "
      + "Literata (a serif made for reading on screens), Georgia or a sans."],
    ["Does it work without the internet?",
      "Yes, for the books you keep on this device: press Keep for offline reading on a book's page, or in the "
      + "reader's Text settings, and it opens with no connection at all. Downloaded books work anywhere too."],
  ]],
  ["downloads", "Downloads", "pale-green", "download", [
    ["Can I keep a book?", "Yes. Every book page has an EPUB download, the format almost every reading app uses."],
    ["Can I read on a Kindle or a Kobo?",
      "Yes. Each book page links to a Kindle edition and a Kobo edition. You can also send the EPUB to a Kindle "
      + "with Amazon's Send to Kindle."],
    ["What app opens an EPUB on my phone?",
      "Apple Books on an iPhone, and Google Play Books or any EPUB reader on Android. Or skip the app and press "
      + "Read now."],
  ]],
  ["books", "The books", "pale-pink", "bookmark", [
    ["Where do the books come from?",
      "Almost all are Standard Ebooks editions: public-domain classics carefully proofread and typeset by volunteers, "
      + "with covers made from public-domain paintings. A few classics from India that Standard Ebooks does not have "
      + "come from Project Gutenberg. Each book's page says which edition it is."],
    ["How are the books ranked?",
      "By how much they are read. The order comes from Standard Ebooks' popularity ranking, so All books starts "
      + "with the most read, and Where to start on the home page is the top ten."],
    ["How is the book of the month chosen?",
      "A new one on the first of every month, chosen for how much it is read, here and on Open Library, how "
      + "readers rate it, and the time of year: ghost stories in October, A Christmas Carol in December. No book "
      + "comes round twice in a year, nor an author twice in six months, and every third month is a short read. "
      + "The home page says why each one was chosen."],
    ["Will there be more books?",
      "Yes, a few at a time. Every new one gets its own page, with a cover, a description and the download."],
  ]],
  ["copyright", "Free and fair", "pale-periwinkle", "globe", [
    ["Are the books really free?",
      "Yes. They are in the public domain, so they belong to everyone. No ads, no catch, and no account needed."],
    ["Why are there no new bestsellers or manga?",
      "Recent books, such as Colleen Hoover's, and manga such as One Piece are still under copyright, so they "
      + "cannot be shared for free. Your local library can lend you most of them, often as ebooks through an app "
      + "like Libby."],
    ["Are they free where I live?",
      "Every book here is in the public domain in the United States and in India, where copyright lasts for the "
      + "author's life and sixty years. That goes for translators, illustrators and cover painters too: where a cover "
      + "painting is still under copyright in India, the book has a cover drawn here instead. Most books are free almost "
      + "everywhere, but check your country's rules."],
    ["Do you track what I read?",
      "We count, without cookies and without knowing who you are, how often each page is visited and how often "
      + "each book is opened, reaches its second chapter, is finished or is downloaded. That is how the book of the "
      + "month learns what people enjoy. If your browser asks sites not to track you, we count nothing at all. Your "
      + "reading stays on your own device" + (ACCOUNTS ? ", and in your account if you make one, where only you can see it." : ".")],
    ["What do you keep about me?",
      "The privacy page says exactly what is kept, where, and how to remove it.", ["Read it", "privacy.html"]],
  ]],
  ["account", "Your account", "pale-yellow", "sparkles", ACCOUNT_FAQ],
  ["contact", "Contact", "soft-orange", "mail", [
    ["How can I get in touch?", "Through the project on GitHub, where you can report a problem or suggest a book.",
      ["Open GitHub", "https://github.com/Cl0ud-9/Book-Website/issues"]],
  ]],
];
