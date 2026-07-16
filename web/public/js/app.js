/* ============================================================
   Orbit — website client (minimal, multi-page routing)
   ============================================================ */

const state = { config: null, me: null };
const CATS = ["Networking", "Friends", "Gaming", "Freelancing", "Co-Founder", "Dating"];
const SUBTITLES = {
    Networking: "Meet professionals and grow your network.",
    Friends: "Find people to talk to and spend time with.",
    Gaming: "Team up with fellow players.",
    Freelancing: "Freelancers, clients and collaborators.",
    "Co-Founder": "Find a co-founder for your venture.",
    Dating: "Meet someone new — 18+."
};

const $ = (id) => document.getElementById(id);
const slugOf = (name) => name.toLowerCase();
const nameFromSlug = (slug) =>
    CATS.find((n) => slugOf(n) === decodeURIComponent(slug || "")) || null;

async function api(path, options) {
    const res = await fetch(path, {
        headers: { "Content-Type": "application/json" },
        ...options
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
}

function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.add("hidden"), 2600);
}

function escape(str) {
    return String(str ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
}

// ---- routing -----------------------------------------------------
function setView(name) {
    for (const v of ["home", "category", "premium", "admirers", "dashboard"]) {
        $(`view-${v}`).classList.toggle("hidden", v !== name);
    }
    const active = $(`view-${name}`);
    if (active) {
        active.classList.remove("reveal");
        void active.offsetWidth; // reflow so the reveal animation replays
        active.classList.add("reveal");
    }
    window.scrollTo({ top: 0 });
}
function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
}
function setActiveByPath(path) {
    document.querySelectorAll(".nav-center a").forEach((a) => {
        a.classList.toggle("active", a.getAttribute("href") === path);
    });
    const catBtn = $("catBtn");
    if (catBtn) {
        catBtn.classList.toggle(
            "active",
            CATS.some((n) => "/" + slugOf(n) === path)
        );
    }
}
function navigate(path, push = true) {
    if (push && location.pathname !== path) history.pushState({}, "", path);
    route(path);
}
function route(path) {
    const p = path || location.pathname;
    if (p === "/premium") return showPremium();
    if (p === "/dashboard") return loadDashboard();
    if (p === "/interest") return loadAdmirers();
    const name = nameFromSlug(p.replace(/^\//, ""));
    if (name) return loadCategory(name);
    return loadHome();
}
window.addEventListener("popstate", () => route(location.pathname));

// Intercept internal links (data-link) for SPA navigation.
document.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-link]");
    if (!a) return;
    e.preventDefault();
    navigate(a.getAttribute("href"));
});

// ---- auth --------------------------------------------------------
function renderAuth() {
    const area = $("authArea");
    if (state.me) {
        area.innerHTML = `
            <span class="user-chip">${escape(state.me.username)}</span>
            <button class="btn ghost sm" id="logoutBtn">Logout</button>`;
        $("logoutBtn").onclick = async () => {
            await api("/auth/logout", { method: "POST" });
            state.me = null;
            renderAuth();
            toast("Logged out");
        };
        $("navDashboard").classList.remove("hidden");
    } else {
        area.innerHTML = state.config.oauthConfigured
            ? `<a class="btn sm" href="/auth/login">Login with Discord</a>`
            : `<span class="user-chip">Login disabled</span>`;
        $("navDashboard").classList.add("hidden");
    }
}

// ---- home --------------------------------------------------------
async function loadHome() {
    setTheme("home");
    setView("home");
    setActiveByPath("/");

    const stats = (await api("/api/stats")).body;
    $("heroStats").innerHTML = `
        <div class="stat"><b>${stats.profiles}</b><span>Members</span></div>
        <div class="stat"><b>${stats.likes}</b><span>Connections</span></div>
        <div class="stat"><b>${CATS.length}</b><span>Communities</span></div>`;

    // trust strip: category chips (link to each community page)
    const trust = $("trustRow");
    if (trust) {
        trust.innerHTML = CATS.map(
            (c) => `<a class="trust-chip" href="/${slugOf(c)}" data-link>${c}</a>`
        ).join("");
    }

    // reveal feature cards with a gentle stagger
    document.querySelectorAll("#view-home .reveal-on-scroll").forEach((el, i) => {
        setTimeout(() => el.classList.add("in"), 120 + i * 90);
    });
}

// ---- community page ----------------------------------------------
async function loadCategory(category) {
    state.currentCategory = category;
    setTheme(slugOf(category));
    setView("category");
    setActiveByPath("/" + slugOf(category));
    $("catTitle").textContent = category;
    $("catSubtitle").textContent = SUBTITLES[category] || "";
    $("catSearchInput").value = "";
    $("catSearchInput").placeholder = `Search ${category}…`;
    $("profileGrid").innerHTML = `<div class="empty">Loading…</div>`;
    $("emptyState").classList.add("hidden");

    const { body } = await api(`/api/profiles?category=${encodeURIComponent(category)}`);
    renderProfiles(body.profiles, "profileGrid");

    if (!body.profiles.length) {
        $("profileGrid").innerHTML = "";
        const empty = $("emptyState");
        empty.textContent = `No members here yet. Join with /profile create in Discord.`;
        empty.classList.remove("hidden");
    }
}

async function searchProfiles(q, category) {
    q = (q || "").trim();
    if (!q) return;
    state.currentCategory = category || null;
    setView("category");
    setTheme(category ? slugOf(category) : "home");
    setActiveByPath(category ? "/" + slugOf(category) : "/search");
    $("catTitle").textContent = category || "Search";
    $("catSubtitle").textContent = `Results for “${q}”`;
    $("catSearchInput").value = q;
    $("catSearchInput").placeholder = category ? `Search ${category}…` : "Search everyone…";
    $("profileGrid").innerHTML = `<div class="empty">Searching…</div>`;
    $("emptyState").classList.add("hidden");

    const url =
        `/api/search?q=${encodeURIComponent(q)}` +
        (category ? `&category=${encodeURIComponent(category)}` : "");
    const { body } = await api(url);
    renderProfiles(body.profiles, "profileGrid");
    if (!body.profiles.length) {
        $("profileGrid").innerHTML = "";
        const e = $("emptyState");
        e.textContent = `No members matched “${q}”.`;
        e.classList.remove("hidden");
    }
}

function tierTag(tier) {
    if (tier === "pro") return `<span class="tag pro">Pro</span>`;
    if (tier === "premium") return `<span class="tag premium">Premium</span>`;
    return "";
}

function renderProfiles(profiles, gridId) {
    const grid = $(gridId);
    grid.innerHTML = "";
    for (const p of profiles) grid.appendChild(profileCard(p));
}

function profileCard(p) {
    const card = document.createElement("div");
    card.className = "profile-card" + (p.featured ? " featured" : "");
    const initial = (p.name || "?").charAt(0).toUpperCase();
    card.innerHTML = `
        <div class="pc-top">
            <div class="avatar">${escape(initial)}</div>
            <div class="pc-id">
                <div class="pc-name">${escape(p.name)} ${tierTag(p.tier)}${p.featured ? '<span class="tag featured">Featured</span>' : ""}</div>
                <div class="pc-discord">@${escape(p.discord)}</div>
            </div>
        </div>
        <div class="pc-bottom">
            <button class="like-btn ${p.likedByMe ? "liked" : ""}">${p.likedByMe ? "Liked" : "Like"}</button>
            <span class="like-count">${p.likes} like${p.likes === 1 ? "" : "s"}</span>
        </div>`;
    const btn = card.querySelector(".like-btn");
    const count = card.querySelector(".like-count");
    btn.onclick = () => handleLike(p, btn, count);
    return card;
}

async function handleLike(p, btn, count) {
    if (!state.me) {
        if (state.config.oauthConfigured) {
            toast("Sign in with Discord to like");
            setTimeout(() => (window.location.href = "/auth/login"), 900);
        } else {
            toast("Sign-in isn't set up yet");
        }
        return;
    }
    if (p.likedByMe) return toast("Already liked");
    btn.disabled = true;
    const { status, body } = await api("/api/like", {
        method: "POST",
        body: JSON.stringify({ targetId: p.id })
    });
    btn.disabled = false;
    if (status === 200) {
        p.likedByMe = true;
        p.likes = body.likes;
        btn.classList.add("liked");
        btn.textContent = "Liked";
        count.textContent = `${p.likes} like${p.likes === 1 ? "" : "s"}`;
        toast(body.matched ? "It's a match — see /matches in Discord" : "Interest registered");
    } else if (status === 401) {
        window.location.href = "/auth/login";
    } else {
        toast(body.reason || "Could not complete that");
    }
}

// ---- premium page ------------------------------------------------
function showPremium() {
    setTheme("home");
    setView("premium");
    setActiveByPath("/premium");
}

function renderPricing() {
    const grid = $("pricingGrid");
    grid.innerHTML = "";
    const cur = state.config.currency || "$";

    for (const tier of state.config.tiers) {
        const card = document.createElement("div");
        card.className = "price-card" + (tier.recommended ? " featured" : "");
        const price =
            tier.price > 0
                ? `<span class="amt">${cur}${tier.price.toFixed(2)}</span><span class="per">/mo</span>`
                : `<span class="amt">Free</span>`;
        const features = tier.perks
            .slice(0, 5)
            .map((p) => `<li>${escape(p.replace(/^[^\w`]+/, "").trim())}</li>`)
            .join("");
        const btn =
            tier.price > 0
                ? `<button class="pc-btn ${tier.recommended ? "primary" : ""}" data-tier="${tier.key}">Get ${escape(tier.name)}</button>`
                : `<a class="pc-btn" href="${state.config.inviteUrl}" target="_blank" rel="noopener">Add to Discord</a>`;
        card.innerHTML = `
            ${tier.recommended ? '<span class="price-badge">Popular</span>' : ""}
            <div class="pc-tier">${escape(tier.name)}</div>
            <div class="pc-price">${price}</div>
            <ul class="pc-features">${features}</ul>
            ${btn}`;
        grid.appendChild(card);
    }
    for (const b of grid.querySelectorAll(".pc-btn[data-tier]")) {
        b.onclick = () => startCheckout(b.dataset.tier);
    }
}

async function startCheckout(tier) {
    if (!state.me) {
        toast("Sign in with Discord to upgrade");
        setTimeout(() => (window.location.href = "/auth/login"), 900);
        return;
    }
    if (!state.config.paymentsEnabled) return toast("Payments aren't set up yet");
    toast("Opening secure checkout…");
    const { status, body } = await api("/api/checkout", {
        method: "POST",
        body: JSON.stringify({ tier })
    });
    if (status === 200 && body.url) window.location.href = body.url;
    else toast("Could not start checkout");
}

// ---- dashboard ---------------------------------------------------
async function loadDashboard() {
    if (!state.me) {
        window.location.href = "/auth/login";
        return;
    }
    setTheme("home");
    setView("dashboard");
    setActiveByPath("/dashboard");

    const { status, body } = await api("/api/me/dashboard");
    if (status !== 200) return;

    $("dashGreeting").textContent = `Welcome back, ${escape(state.me.username)}`;
    const renews = body.expiresAt
        ? ` · renews ${new Date(body.expiresAt).toLocaleDateString()}`
        : "";
    $("dashPlan").innerHTML = `${body.badge ? escape(body.badge) : "Free member"}${renews}`;

    // actions
    if (body.tier === "free") {
        $("dashActions").innerHTML = `<a class="btn" href="/premium" data-link>Upgrade plan</a>`;
    } else {
        $("dashActions").innerHTML =
            (body.manageUrl
                ? `<a class="btn ghost" href="${body.manageUrl}" target="_blank" rel="noopener">Manage</a>`
                : "") + `<a class="btn ghost" href="/premium" data-link>Change plan</a>`;
    }

    // ---- stat cards (segmented bars + share pill) ----
    const s = body.stats;
    const metrics = [
        { label: "Likes received", val: s.likesReceived, ic: "❤" },
        { label: "Matches", val: s.matches, ic: "✦" },
        { label: "Profile views", val: s.views, ic: "◉" },
        { label: "Search hits", val: s.searchAppearances, ic: "⌕" }
    ];
    const maxVal = Math.max(1, ...metrics.map((m) => m.val));
    const SEG = 8;
    $("dashStats").innerHTML = metrics
        .map((m) => {
            const ratio = m.val / maxVal;
            const filled = Math.max(m.val > 0 ? 1 : 0, Math.round(ratio * SEG));
            const pct = Math.round(ratio * 100);
            const segs = Array.from({ length: SEG }, (_, i) =>
                `<i class="${i < filled ? "on" : ""}"></i>`
            ).join("");
            return `<div class="stat-card">
                <div class="sc-top"><span class="sc-ic">${m.ic}</span><span class="sc-label">${m.label}</span>
                    <span class="sc-pill">${pct}%</span></div>
                <b data-count="${m.val}">0</b>
                <div class="sc-bar">${segs}</div>
            </div>`;
        })
        .join("");
    animateCounts();

    // ---- statistics chart (compare the four metrics) ----
    const chartMax = Math.max(1, ...metrics.map((m) => m.val));
    const bars = metrics
        .map((m) => {
            const h = Math.round((m.val / chartMax) * 100);
            return `<div class="bar-col">
                <div class="bar-track"><div class="bar-fill" style="--h:${h}%">
                    <span class="bar-val">${m.val}</span></div></div>
                <span class="bar-label">${m.label.split(" ")[0]}</span>
            </div>`;
        })
        .join("");
    $("dashChartCard").innerHTML = `
        <div class="card-head"><h3>📊 Activity overview</h3>
            <span class="card-hint">All-time</span></div>
        <div class="bar-chart">${bars}</div>`;
    requestAnimationFrame(() =>
        document.querySelectorAll(".bar-fill").forEach((b) => (b.style.height = b.style.getPropertyValue("--h")))
    );

    // ---- plan / upgrade promo ----
    if (body.tier === "free") {
        $("dashPromoCard").innerHTML = `
            <div class="promo-glow"></div>
            <div class="promo-body">
                <span class="promo-kicker">UPGRADE</span>
                <h3>Get seen first</h3>
                <p>Unlock who liked you, boosted visibility and AI matchmaking.</p>
                <a class="btn light" href="/premium" data-link>View plans</a>
            </div>`;
    } else {
        $("dashPromoCard").innerHTML = `
            <div class="promo-glow"></div>
            <div class="promo-body">
                <span class="promo-kicker">${escape(body.tierName || "Member")}</span>
                <h3>You're all set</h3>
                <p>${body.expiresAt ? "Renews " + new Date(body.expiresAt).toLocaleDateString() : "Active membership"}.</p>
                <a class="btn light" href="/premium" data-link>Manage plan</a>
            </div>`;
    }

    // ---- resource links rail ----
    const link = (ic, title, sub, href, ext) =>
        `<a class="res-row" href="${href}" ${ext ? 'target="_blank" rel="noopener"' : 'data-link'}>
            <span class="res-ic">${ic}</span>
            <span class="res-txt"><b>${title}</b><small>${sub}</small></span>
            <span class="res-arr">↗</span></a>`;
    const addUrl = state.config.inviteUrl || "#";
    const supportUrl = state.config.supportServer || "#";
    $("dashLinksCard").innerHTML =
        `<div class="card-head"><h3>Quick links</h3></div>` +
        link("➕", "Add to Discord", "Bring Orbit to your server", addUrl, true) +
        link("✦", "Premium", "Compare plans & perks", "/premium", false) +
        link("💬", "Support server", "Get help from the team", supportUrl, true) +
        link("👤", "Edit profile", "Use /profile edit in Discord", addUrl, true);

    // ---- profile card ----
    if (body.profile) {
        const meta = [body.profile.category, body.profile.profession, body.profile.location]
            .filter(Boolean)
            .join(" · ");
        $("dashProfileCard").innerHTML = `
            <div class="card-head"><h3>👤 Your profile</h3></div>
            <div class="dp-name">${escape(body.profile.name)} ${tierTag(body.tier)}${body.profile.featured ? '<span class="tag featured">Featured</span>' : ""}</div>
            <div class="dp-meta">${escape(meta || "—")}</div>
            ${body.profile.skills ? `<div class="dp-skills">${escape(body.profile.skills)}</div>` : ""}
            <p class="dp-note">Edit your profile in Discord with <code>/profile edit</code>.</p>`;
    } else {
        $("dashProfileCard").innerHTML = `
            <div class="card-head"><h3>👤 Your profile</h3></div>
            <p class="dp-note">You haven't created a profile yet. Run <code>/profile create</code> in Discord.</p>`;
    }

    // ---- admirers card ----
    const ad = body.admirers;
    let html = `<div class="card-head"><h3>❤ Who liked you</h3></div>`;
    if (ad.locked) {
        html += `<p class="big-num">${ad.count}</p>
            <p class="dp-note">member(s) liked you. Unlock their names with Premium.</p>
            <a class="btn" href="/premium" data-link>Unlock with Premium</a>`;
    } else if (!ad.list.length) {
        html += `<p class="dp-note">No interest yet — keep networking.</p>`;
    } else {
        html += ad.list
            .slice(0, 8)
            .map(
                (a) =>
                    `<div class="dp-row"><span>${escape(a.name)}${a.matched ? " · matched" : ""}</span><span class="muted">@${escape(a.discord)}</span></div>`
            )
            .join("");
    }
    $("dashAdmirersCard").innerHTML = html;
}

function animateCounts() {
    document.querySelectorAll("#dashStats b[data-count]").forEach((el) => {
        const target = Number(el.dataset.count) || 0;
        const dur = 700;
        const start = performance.now();
        const step = (t) => {
            const p = Math.min(1, (t - start) / dur);
            el.textContent = Math.round(p * target);
            if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    });
}

// ---- interest page -----------------------------------------------
async function loadAdmirers() {
    if (!state.me) return navigate("/");
    setTheme("home");
    setView("admirers");
    const grid = $("admirersGrid");
    grid.innerHTML = `<div class="empty">Loading…</div>`;
    const { body } = await api("/api/admirers");

    if (body.locked) {
        grid.innerHTML = "";
        $("admirersSub").innerHTML =
            `${body.count} member(s) liked you. Reveal names with <a href="/premium" data-link>Premium</a>.`;
        return;
    }
    $("admirersSub").textContent = `${body.count} member(s) liked you.`;
    grid.innerHTML = "";
    if (!body.admirers.length) {
        grid.innerHTML = `<div class="empty">No interest received yet.</div>`;
        return;
    }
    for (const a of body.admirers) {
        const card = document.createElement("div");
        card.className = "profile-card";
        const initial = (a.name || "?").charAt(0).toUpperCase();
        card.innerHTML = `
            <div class="pc-top">
                <div class="avatar">${escape(initial)}</div>
                <div class="pc-id">
                    <div class="pc-name">${escape(a.name)} ${a.matched ? '<span class="tag featured">Matched</span>' : ""}</div>
                    <div class="pc-discord">@${escape(a.discord)} · ${escape(a.category || "")}</div>
                </div>
            </div>`;
        grid.appendChild(card);
    }
}

// ---- boot --------------------------------------------------------
async function boot() {
    state.config = (await api("/api/config")).body;
    state.me = (await api("/api/me")).body.user;

    $("brandName").textContent = state.config.botName;
    $("footerName").textContent = state.config.botName;
    document.title = state.config.botName;
    document.querySelectorAll("#addBtn, #addBtn2").forEach((a) => (a.href = state.config.inviteUrl));
    if (state.config.logo) {
        $("brandLogo").src = state.config.logo;
    }
    if (state.config.banner) {
        const hv = $("heroVisual");
        if (hv) hv.src = state.config.banner;
    }
    if (state.config.manageUrl) {
        const m = $("manageLink");
        m.href = state.config.manageUrl;
        m.classList.remove("hidden");
    }

    renderAuth();
    renderPricing();
    route(location.pathname);

    // Categories dropdown toggle
    const dropdown = $("catDropdown");
    $("catBtn").addEventListener("click", (e) => {
        e.stopPropagation();
        dropdown.classList.toggle("open");
    });
    document.addEventListener("click", () => dropdown.classList.remove("open"));

    // Cinematic "scroll to explore"
    const sc = $("scrollCta");
    if (sc) sc.addEventListener("click", () => $("landing").scrollIntoView({ behavior: "smooth" }));

    // Search forms
    $("heroSearch").addEventListener("submit", (e) => {
        e.preventDefault();
        searchProfiles($("heroSearchInput").value, null);
    });
    const navSearch = $("navSearch");
    if (navSearch) {
        navSearch.addEventListener("submit", (e) => {
            e.preventDefault();
            const q = $("navSearchInput").value.trim();
            if (q) searchProfiles(q, null);
        });
    }
    $("catSearch").addEventListener("submit", (e) => {
        e.preventDefault();
        const q = $("catSearchInput").value.trim();
        if (!q) {
            if (state.currentCategory) loadCategory(state.currentCategory);
            return;
        }
        searchProfiles(q, state.currentCategory);
    });

    const params = new URLSearchParams(window.location.search);
    if (params.get("login") === "ok") toast("Logged in");
    if (params.get("login") === "failed") toast("Login failed");
    if (params.has("login")) history.replaceState({}, "", location.pathname);
}

boot();
