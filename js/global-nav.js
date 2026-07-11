(function () {
  "use strict";

  var LINKS = [
    { href: "/products#shift", label: "Shift", key: "shift" },
    { href: "/guardian", label: "Guardian", key: "guardian" },
    { href: "https://prospects.sentinelprime.org", label: "Prospects", key: "prospects" },
    { href: "https://finance.sentinelprime.org", label: "Finance", key: "finance" },
    { href: "/marketing", label: "Marketing", key: "marketing" },
    { href: "/contact", label: "Contact", key: "contact" }
  ];

  var activeKey = document.body.dataset.page || "";
  var mount = document.getElementById("global-nav-mount");
  if (!mount) return;

  var linksHtml = LINKS.map(function (link) {
    var cls = link.key === activeKey ? ' class="active"' : "";
    return '<a href="' + link.href + '"' + cls + ">" + link.label + "</a>";
  }).join("");

  mount.outerHTML =
    '<nav class="nav global-nav" id="global-nav">' +
    '<a class="logo brand-lockup" href="/" aria-label="Sentinel Prime home">' +
    '<img src="/assets/logo-tesseract.svg" alt="" width="28" height="28" class="nav-logo-icon">' +
    "<span>SENTINEL PRIME</span></a>" +
    '<button class="nav-toggle" type="button" aria-label="Open navigation" aria-expanded="false"><span></span></button>' +
    '<div class="nav-links">' + linksHtml + "</div>" +
    "</nav>";
})();
