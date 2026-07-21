/* Shared marketing-site behaviors: link wiring, nav, reveals, counters, faq. */
(function () {
  const C = window.ORBIT || {};
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // wire links
  const set = (sel, url, ext) =>
    document.querySelectorAll(sel).forEach((a) => {
      a.href = url;
      if (ext) { a.target = "_blank"; a.rel = "noopener"; }
    });
  set("[data-invite]", C.inviteLink, true);
  set("[data-community]", C.communityLink, false);
  set("[data-topgg]", C.topggLink, true);

  // glass nav on scroll
  const nav = document.querySelector(".nav");
  if (nav) addEventListener("scroll", () => nav.classList.toggle("stuck", scrollY > 10), { passive: true });

  // fade-and-rise reveal (the only decorative motion kept)
  const els = document.querySelectorAll(".reveal");
  if (reduce || !("IntersectionObserver" in window)) {
    els.forEach((e) => e.classList.add("in"));
  } else {
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }),
      { threshold: 0.14, rootMargin: "0px 0px -8% 0px" }
    );
    els.forEach((e) => io.observe(e));
  }

  // count-up
  const nums = document.querySelectorAll("[data-count-to]");
  const fmt = (n) => (n >= 1000 ? Math.round(n / 100) / 10 + "k" : String(n));
  const run = (el) => {
    const target = (C.counters || {})[el.dataset.countTo] || 0;
    if (reduce) { el.textContent = fmt(target); return; }
    const dur = 1500, st = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - st) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(Math.round(e * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  if (nums.length) {
    if (!("IntersectionObserver" in window)) nums.forEach(run);
    else {
      const io = new IntersectionObserver(
        (es) => es.forEach((e) => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } }),
        { threshold: 0.6 }
      );
      nums.forEach((n) => io.observe(n));
    }
  }

  // FAQ accordion (smooth height)
  document.querySelectorAll(".qa").forEach((qa) => {
    const btn = qa.querySelector("button"), ans = qa.querySelector(".ans");
    if (!btn || !ans) return;
    btn.addEventListener("click", () => {
      const open = qa.classList.toggle("open");
      ans.style.maxHeight = open ? ans.scrollHeight + "px" : 0;
    });
  });
})();
