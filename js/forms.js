// Checks the log-in, sign-up and newsletter forms in the browser. The site has no server, so nothing is sent or stored.
// app.js calls BookshelfForms.init(page) for every page it shows, and the returned function undoes it.
(() => {
  const SIGNUP_RULES = {
    username: (v) => (v.trim() ? "" : "Enter a username."),
    password: (v) => (!v ? "Enter a password." : v.length < 6 ? "Use at least 6 characters." : ""),
    confirm: (v, form) => (v === form.elements.password.value ? "" : "The passwords do not match."),
    contact: (v) => (/^[0-9]{10}$/.test(v.trim()) ? "" : "Enter a 10-digit contact number."),
  };
  // On the log-in page an existing password may be any length
  const LOGIN_RULES = { ...SIGNUP_RULES, password: (v) => (v ? "" : "Enter your password.") };
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function check(input, rules) {
    const rule = rules[input.name];
    const message = rule ? rule(input.value, input.form) : "";
    document.getElementById(`${input.id}-error`).textContent = message;
    input.setAttribute("aria-invalid", message ? "true" : "false");
    return !message;
  }

  function accountForm(form) {
    const rules = form.dataset.validate === "login" ? LOGIN_RULES : SIGNUP_RULES;
    const inputs = [...form.querySelectorAll("input[name]")];
    const message = form.querySelector("#form-message");
    inputs.forEach((input) => input.addEventListener("blur", () => check(input, rules)));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const invalid = inputs.filter((input) => !check(input, rules));
      if (invalid.length) {
        message.textContent = "";
        invalid[0].focus();
        return;
      }
      const name = form.elements.username.value.trim();
      message.textContent = form.dataset.validate === "login"
        ? `Welcome back, ${name}! (This demo has no server, so nothing was checked or stored.)`
        : `Account created for ${name}! (This demo has no server, so nothing was stored.)`;
    });
  }

  function newsletter(form) {
    const input = form.querySelector("input[type=email]");
    const message = form.querySelector("[data-newsletter-message]");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!EMAIL.test(input.value.trim())) {
        input.setAttribute("aria-invalid", "true");
        message.textContent = "Enter an email address, like reader@example.com.";
        input.focus();
        return;
      }
      input.setAttribute("aria-invalid", "false");
      message.textContent = "Thanks! You are on the list. (Demo only: nothing was sent.)";
      form.reset();
    });
  }

  window.BookshelfForms = {
    init(page) {
      page.querySelectorAll("form[data-validate]").forEach(accountForm);
      page.querySelectorAll("form[data-newsletter]").forEach(newsletter);
      return () => {};
    },
  };
})();
