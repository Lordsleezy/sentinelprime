(function () {
  "use strict";

  function setupMobileNav() {
    var nav = document.querySelector(".nav");
    var toggle = document.querySelector(".nav-toggle");
    var links = document.querySelector(".nav-links");
    if (!nav || !toggle || !links) return;

    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    links.addEventListener("click", function (event) {
      if (event.target && event.target.tagName === "A") {
        nav.classList.remove("nav-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  async function setupAccountNav() {
    var navLinks = document.querySelector(".nav-links");
    if (!navLinks || navLinks.querySelector("[data-account-link]")) return;
    var account = document.createElement("a");
    account.setAttribute("data-account-link", "true");
    account.href = "/login";
    account.textContent = "Login";
    try {
      var response = await fetch("/api/account", { credentials: "same-origin" });
      if (response.ok) {
        account.href = "/account";
        account.textContent = "My Account";
      }
    } catch (_) {}
    var cta = navLinks.querySelector(".nav-cta");
    navLinks.insertBefore(account, cta || null);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupMobileNav);
    document.addEventListener("DOMContentLoaded", setupAccountNav);
  } else {
    setupMobileNav();
    setupAccountNav();
  }
})();
