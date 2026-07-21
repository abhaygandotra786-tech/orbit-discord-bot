/* Orbit dashboard - rendering, routing, motion. Reads via window.api. */
(function () {
  const T = window.THEME, api = window.api;
  const main = document.getElementById("main");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let dropTimer = null, voteTimer = null;

  /* ---------- utils ---------- */
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const two = (n) => String(n).padStart(2, "0");
  function timeAgo(ms) {
    const s = Math.floor((Date.now() - ms) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    return Math.floor(s / 86400) + "d ago";
  }
  function fmtDate(ms) { return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }

  // one-time count-up on [data-count]
  function countUp() {
    document.querySelectorAll("[data-count]").forEach((el) => {
      const target = Number(el.dataset.count) || 0;
      if (reduce) { el.textContent = target; return; }
      const dur = 700, st = performance.now();
      const step = (t) => {
        const p = Math.min(1, (t - st) / dur), e = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(e * target);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  function pageHead(id) {
    const c = T.copy[id];
    return `<div class="page-head"><h1>${c.title}</h1><p>${c.context}</p></div>`;
  }
  function loading(id, blocks) {
    main.innerHTML = pageHead(id) + blocks;
  }
  const skCards = (n) => `<div class="grid g3">${'<div class="sk sk-card"></div>'.repeat(n)}</div>`;
  const skList = `<div class="card"><div class="sk sk-line" style="width:40%"></div><div class="sk sk-line"></div><div class="sk sk-line"></div><div class="sk sk-line" style="width:70%"></div></div>`;

  /* ---------- sidebar + tabs ---------- */
  function buildNav(active) {
    document.getElementById("sbNav").innerHTML = T.nav.map((n) =>
      `<a class="sb-item ${n.id === active ? "active" : ""}" href="#${n.id}"><span class="dot"></span>${n.label}</a>`
    ).join("");
    document.getElementById("tabbar").innerHTML = T.nav.slice(0, 5).map((n) =>
      `<a class="${n.id === active ? "active" : ""}" href="#${n.id}">${n.label}</a>`
    ).join("");
  }

  /* ---------- router ---------- */
  const PAGES = {
    overview: renderOverview, matches: renderMatches, referrals: renderReferrals,
    perks: renderPerks, profile: renderProfile, settings: renderSettings
  };
  function current() { return (location.hash.replace("#", "") || "overview"); }
  async function route() {
    if (dropTimer) clearInterval(dropTimer);
    if (voteTimer) clearInterval(voteTimer);
    const p = current();
    buildNav(p);
    (PAGES[p] || renderOverview)();
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);

  /* ---------- OVERVIEW ---------- */
  async function renderOverview() {
    loading("overview", skCards(3) + '<div class="sk sk-card" style="height:180px;margin-top:16px"></div>');
    const d = await api.getOverview();

    // tier ring percent
    let ringP = 0, tierTime = "Free plan";
    if (d.tier.key !== "free" && d.tier.expiresAt) {
      const total = d.tier.expiresAt - (d.tier.grantedAt || d.tier.expiresAt - 1);
      ringP = Math.max(4, Math.min(100, Math.round(((d.tier.expiresAt - Date.now()) / total) * 100)));
      const daysLeft = Math.max(0, Math.ceil((d.tier.expiresAt - Date.now()) / 86400000));
      tierTime = `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`;
    }
    const ref = d.referrals;
    const refPct = ref.next ? Math.min(100, Math.round((ref.activated / ref.next) * 100)) : 100;

    main.innerHTML = pageHead("overview") + `
      <div class="grid g3">
        <div class="card tier-card">
          <div class="ring" style="--p:${ringP};--track:${T.ink.track}"><div class="hole">${esc(d.tier.name)}</div></div>
          <div><div class="label">Your plan</div><div class="sub" style="margin-top:8px">${tierTime}</div></div>
        </div>
        <div class="card">
          <div class="label">Vote streak</div>
          <div class="big" style="margin-top:10px"><span data-count="${d.voteStreak.current}">0</span> <span class="accent-gold" style="font-size:22px">&#9733;</span></div>
          <div class="sub">${voteLine(d.voteStreak)}</div>
        </div>
        <div class="card">
          <div class="label">Referrals</div>
          <div class="big" style="margin-top:10px"><span data-count="${ref.activated}">0</span></div>
          <div class="sub">${ref.next ? `${ref.next - ref.activated} more to the next reward` : "All rewards unlocked"}</div>
          <div class="bar"><i style="width:${refPct}%"></i></div>
        </div>
      </div>

      <div class="card timer-card" style="margin-top:16px">
        <div class="label">${T.copy.dropTitle}</div>
        <div class="timer" id="timer">
          <div class="unit"><div class="num" data-t="d">00</div><div class="u">Days</div></div>
          <div class="sep">:</div>
          <div class="unit"><div class="num" data-t="h">00</div><div class="u">Hours</div></div>
          <div class="sep">:</div>
          <div class="unit"><div class="num" data-t="m">00</div><div class="u">Min</div></div>
          <div class="sep">:</div>
          <div class="unit"><div class="num" data-t="s">00</div><div class="u">Sec</div></div>
        </div>
        <div class="sub" style="margin-top:12px">Matches drop every ${T.drop.label}.</div>
      </div>

      <div class="card" style="margin-top:16px">
        <div class="label" style="margin-bottom:6px">Recent activity</div>
        ${d.activity.length ? `<div class="feed">${d.activity.map((a) =>
          `<div class="row"><span>${esc(a.text)}</span><span class="when">${timeAgo(a.at)}</span></div>`).join("")}</div>`
          : `<div class="empty">${T.copy.empty.activity}</div>`}
      </div>`;
    countUp();
    startTimer(d.nextDrop);
  }
  function voteLine(v) {
    if (!v.nextVoteAt || v.nextVoteAt <= Date.now()) return "You can vote now";
    const h = Math.ceil((v.nextVoteAt - Date.now()) / 3600000);
    return `Next vote in ${h}h`;
  }
  function startTimer(target) {
    const tick = () => {
      let diff = Math.max(0, target - Date.now());
      const d = Math.floor(diff / 86400000); diff -= d * 86400000;
      const h = Math.floor(diff / 3600000); diff -= h * 3600000;
      const m = Math.floor(diff / 60000); diff -= m * 60000;
      const s = Math.floor(diff / 1000);
      const set = (k, v) => { const el = document.querySelector(`#timer [data-t="${k}"]`); if (el) el.textContent = two(v); };
      set("d", d); set("h", h); set("m", m); set("s", s);
    };
    tick();
    if (!reduce) dropTimer = setInterval(tick, 1000);
  }

  /* ---------- MATCHES ---------- */
  async function renderMatches() {
    loading("matches", '<div class="sk sk-card" style="height:200px"></div>' + skList);
    const d = await api.getMatches();
    const cur = d.current;
    const currentCard = cur ? `
      <div class="card match">
        <div class="pair">
          <span class="av" style="background:${cur.a.color}">${esc(cur.a.initial)}</span>
          <span class="plus">+</span>
          <span class="av" style="background:${cur.b.color}">${esc(cur.b.initial)}</span>
          <span class="names">${esc(cur.a.name)} and ${esc(cur.b.name)}</span>
        </div>
        <div class="why">${esc(cur.reason)}</div>
        <div class="ib"><div class="label">Icebreaker</div>${esc(cur.icebreaker)}</div>
        <a class="btn btn-primary" href="${esc(cur.discordUrl)}" target="_blank" rel="noopener">${T.copy.sayHi}</a>
      </div>`
      : `<div class="card"><div class="empty">${T.copy.empty.match}</div></div>`;

    const history = d.history.length ? `
      <div class="card" style="margin-top:16px">
        <div class="label" style="margin-bottom:6px">Match history</div>
        <div class="hist">${d.history.map((h) =>
          `<div class="row"><span class="av" style="background:${h.color}">${esc(h.initial)}</span>
           <span class="nm">${esc(h.name)}</span><span class="st ${h.status}">${esc(h.status)} &middot; ${fmtDate(h.at)}</span></div>`).join("")}</div>
      </div>`
      : `<div class="card" style="margin-top:16px"><div class="empty">${T.copy.empty.history}</div></div>`;

    main.innerHTML = pageHead("matches") + currentCard + history;
  }

  /* ---------- REFERRALS ---------- */
  async function renderReferrals() {
    loading("referrals", '<div class="sk sk-card" style="height:150px"></div>' + skList);
    const d = await api.getReferrals();
    const steps = d.ladder.map((l) => {
      const done = d.activated >= l.count;
      const here = d.nextTier === l.count;
      return `<div class="step ${done ? "done" : ""} ${here ? "here" : ""}"><div class="node">${l.count}</div><div class="cap">${done ? "done" : here ? "next" : ""}</div></div>`;
    }).join("");
    const nextReward = d.ladder.find((l) => l.count === d.nextTier);

    main.innerHTML = pageHead("referrals") + `
      <div class="card code-box">
        <div class="label">Your code</div>
        <div class="code" id="refCode">${esc(d.code)}</div>
        <div class="copy-wrap"><button class="btn btn-ghost" id="copyBtn" data-code="${esc(d.code)}">${T.copy.copyCode}</button></div>
      </div>
      <div class="card" style="margin-top:16px">
        <div class="label">Progress</div>
        <div class="stepper">${steps}</div>
        ${nextReward ? `<div class="next-unlock">Next: <b>${d.nextTier} referrals</b> unlocks ${esc(nextReward.reward)}.</div>` : `<div class="next-unlock">You unlocked every referral reward.</div>`}
      </div>
      <div class="card" style="margin-top:16px">
        <div class="label" style="margin-bottom:6px">Pending</div>
        ${d.pending.length ? `<div class="hist">${d.pending.map((p) =>
          `<div class="row"><span class="av" style="background:${p.color}">${esc(p.initial)}</span><span class="nm">${esc(p.name)}</span><span class="st">joined ${fmtDate(p.at)}</span></div>`).join("")}</div>
          <div class="sub" style="margin-top:12px">${T.copy.referralNote}</div>`
          : `<div class="empty">${T.copy.empty.pending}</div>`}
      </div>`;

    const btn = document.getElementById("copyBtn");
    btn.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(btn.dataset.code); } catch { /* ignore */ }
      btn.textContent = T.copy.copied;
      setTimeout(() => (btn.textContent = T.copy.copyCode), 1400);
    });
  }

  /* ---------- PERKS ---------- */
  async function renderPerks() {
    loading("perks", skList);
    const d = await api.getPerks();
    const col = (items) => items.map((i) =>
      `<div class="node ${i.unlocked ? "on" : ""}"><span class="mark"></span><span class="t">${esc(i.label)}</span></div>`).join("");
    main.innerHTML = pageHead("perks") + `
      <div class="card">
        <div class="tl">
          <div><h3>Votes</h3>${col(d.votes)}</div>
          <div><h3>Referrals</h3>${col(d.referrals)}</div>
        </div>
        <div class="next-unlock">${d.next.track === "vote" ? `${d.next.need} more vote` : `${d.next.need} more referral`}${d.next.need > 1 ? "s" : ""} until ${esc(d.next.reward)}.</div>
      </div>`;
  }

  /* ---------- PROFILE ---------- */
  async function renderProfile() {
    loading("profile", skList);
    const p = await api.getProfile();
    main.innerHTML = pageHead("profile") + `
      <div class="grid g2">
        <div class="card">
          <form class="form" id="profForm">
            <div class="row2">
              <div class="field"><label>Name</label><input name="name" value="${esc(p.name)}" /></div>
              <div class="field"><label>Age</label><input name="age" type="number" value="${esc(p.age)}" /></div>
            </div>
            <div class="row2">
              <div class="field"><label>Location</label><input name="location" value="${esc(p.location)}" /></div>
              <div class="field"><label>Profession</label><input name="profession" value="${esc(p.profession)}" /></div>
            </div>
            <div class="field"><label>Category</label><input name="category" value="${esc(p.category)}" /></div>
            <div class="field"><label>About</label><textarea name="bio">${esc(p.bio)}</textarea></div>
            <div class="field"><label>Skills</label><input name="skills" value="${esc(p.skills)}" /></div>
            <div class="field"><label>Interests</label><input name="interests" value="${esc(p.interests)}" /></div>
            <button class="btn btn-primary" id="saveBtn" type="submit">${T.copy.saveProfile}</button>
          </form>
        </div>
        <div class="card">
          <div class="label" style="margin-bottom:12px">Preview</div>
          <div class="match">
            <div class="pair">
              <span class="av" style="background:#F4502A">${esc((p.name || "?")[0])}</span>
              <span class="plus">+</span>
              <span class="av" style="background:#F5B93F">?</span>
              <span class="names">${esc(p.name)} and you</span>
            </div>
            <div class="why">${esc(p.bio || "Your about line shows here.")}</div>
            <div class="ib"><div class="label">Icebreaker</div>What are you working on right now?</div>
          </div>
        </div>
      </div>`;

    document.getElementById("profForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("saveBtn");
      const data = Object.fromEntries(new FormData(e.target).entries());
      btn.disabled = true; btn.textContent = "Saving";
      await api.saveProfile(data);
      btn.textContent = T.copy.saved;
      setTimeout(() => { btn.textContent = T.copy.saveProfile; btn.disabled = false; }, 1400);
    });
  }

  /* ---------- SETTINGS ---------- */
  async function renderSettings() {
    loading("settings", skList);
    const s = await api.getSettings();
    const toggle = (key, title, desc) =>
      `<div class="toggle-row"><div><div class="t">${title}</div><div class="d">${desc}</div></div>
       <div class="switch ${s[key] ? "on" : ""}" data-key="${key}"><i></i></div></div>`;
    main.innerHTML = pageHead("settings") + `
      <div class="card">
        ${toggle("voteReminder", "Vote reminder", "Get a DM when your next vote is ready.")}
        ${toggle("dropReminder", "Drop reminder", "Get a DM before the weekly match drop.")}
        ${toggle("showProfile", "Show my profile", "Let members find you in browse and search.")}
      </div>
      <div class="card" style="margin-top:16px">
        <div class="t" style="font-weight:800;margin-bottom:6px">Your data</div>
        <div class="d" style="color:var(--muted);font-size:13.5px;margin-bottom:14px">${T.copy.dataDelete}</div>
        <button class="btn btn-danger" id="delBtn">Request deletion</button>
      </div>`;

    document.querySelectorAll(".switch").forEach((sw) => {
      sw.addEventListener("click", async () => {
        const on = !sw.classList.contains("on");
        sw.classList.toggle("on", on);
        await api.saveSettings({ [sw.dataset.key]: on });
      });
    });
    const del = document.getElementById("delBtn");
    del.addEventListener("click", async () => {
      if (del.dataset.confirm !== "1") { del.dataset.confirm = "1"; del.textContent = "Tap again to confirm"; return; }
      del.disabled = true; del.textContent = "Requesting";
      await api.requestDelete();
      del.textContent = "Request sent";
    });
  }

  /* ---------- boot ---------- */
  (async function boot() {
    try {
      const me = await api.getMe();
      document.getElementById("sbName").textContent = me.username;
      const av = document.getElementById("sbAvatar");
      av.innerHTML = me.avatarUrl ? `<img src="${esc(me.avatarUrl)}" alt="" />` : esc((me.username || "?")[0].toUpperCase());
    } catch { /* keep placeholder */ }
    route();
  })();
})();
