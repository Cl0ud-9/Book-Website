// The home page's behaviour: book details, search and the newsletter form. No libraries needed.
document.addEventListener("DOMContentLoaded", () => {
  // Show more / show less: one button per book, which tells screen readers whether the details are open
  document.querySelectorAll(".show-more").forEach((button) => {
    button.addEventListener("click", () => {
      const info = document.getElementById(button.getAttribute("aria-controls"));
      const open = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!open));
      button.textContent = open ? "Show more" : "Show less";
      info.hidden = open;
    });
  });

  // Search: filters the new arrivals by title or author as you type
  const box = document.getElementById("search-box");
  const status = document.getElementById("search-status");
  const books = document.querySelectorAll(".arrivals-slider .box");
  const filter = () => {
    const words = box.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    let shown = 0;
    books.forEach((book) => {
      const match = words.every((w) => book.dataset.search.includes(w));
      book.hidden = !match;
      if (match) shown += 1;
    });
    if (!words.length) status.textContent = "";
    else if (!shown) status.textContent = `No books match "${box.value.trim()}".`;
    else status.textContent = `${shown} book${shown === 1 ? "" : "s"} match "${box.value.trim()}".`;
  };
  box.addEventListener("input", filter);
  box.form.addEventListener("submit", (event) => {
    event.preventDefault();
    filter();
    document.getElementById("arrivals").scrollIntoView();
  });

  // Newsletter: there is no server, so a valid address only gets a thank-you
  const form = document.getElementById("newsletter-form");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = document.getElementById("newsletter-email");
    document.getElementById("newsletter-message").textContent =
      `Thanks! ${email.value} would get our updates, if this demo had a server.`;
    form.reset();
  });
});
