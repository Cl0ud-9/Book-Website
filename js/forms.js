// Checks the log-in and sign-up forms in the browser. The site has no server, so nothing is sent or stored.
const RULES = {
  username: (v) => (v.trim() ? "" : "Enter a username."),
  password: (v) => (!v ? "Enter a password." : v.length < 6 ? "Use at least 6 characters." : ""),
  confirm: (v, form) => (v === form.elements.password.value ? "" : "The passwords do not match."),
  contact: (v) => (/^[0-9]{10}$/.test(v.trim()) ? "" : "Enter a 10-digit contact number."),
};

function check(input) {
  const rule = RULES[input.name];
  const message = rule ? rule(input.value, input.form) : "";
  const error = document.getElementById(`${input.id}-error`);
  error.textContent = message;
  input.setAttribute("aria-invalid", message ? "true" : "false");
  return !message;
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("form[data-validate]");
  const inputs = [...form.querySelectorAll("input[name]")];
  // On the log-in page an existing password may be any length
  if (form.dataset.validate === "login") RULES.password = (v) => (v ? "" : "Enter your password.");

  inputs.forEach((input) => input.addEventListener("blur", () => check(input)));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const invalid = inputs.filter((input) => !check(input));
    const message = document.getElementById("form-message");
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
});
