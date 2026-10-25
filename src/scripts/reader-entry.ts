// The reader, loaded only when a book is opened: epub.js (which brings its own JSZip), the notes store, the notes
// plug-in and the reader itself, in that order (the reader reads the plug-ins when it opens a book).
import ePub from "epubjs";

Object.assign(window, { ePub });

await import("./notes-store.js");
await import("./reader-notes.js");
await import("./reader.js");
