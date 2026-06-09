(function () {
  document.querySelectorAll(".mock-shift-penguin").forEach(function (el) {
    var img = el.querySelector(".mock-shift-penguin__img");
    if (!img) return;

    var hopping = false;

    function move(event) {
      var rect = el.getBoundingClientRect();
      var x = (event.clientX - rect.left) / rect.width - 0.5;
      var y = (event.clientY - rect.top) / rect.height - 0.5;
      img.style.transform =
        "translate(" + (x * 22) + "px, " + (y * 12) + "px) rotate(" + (x * 14) + "deg) scale(1.1)";
    }

    function reset() {
      if (!hopping) img.style.transform = "";
    }

    function hop() {
      hopping = true;
      el.classList.add("mock-shift-penguin--hop");
      window.setTimeout(function () {
        el.classList.remove("mock-shift-penguin--hop");
        hopping = false;
        reset();
      }, 520);
    }

    el.addEventListener("mousemove", move);
    el.addEventListener("mouseleave", reset);
    el.addEventListener("click", hop);
    el.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        hop();
      }
    });
    el.setAttribute("tabindex", "0");
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", "Interactive Linux penguin");
  });
})();
