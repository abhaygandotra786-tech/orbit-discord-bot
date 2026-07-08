/* ============================================================
   Orbit — website client
   ============================================================ */

const state = { config: null, me: null };

const $ = (id) => document.getElementById(id);
const themeKey = (cat) => cat.toLowerCase();

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

function setView(name) {
    for (const v of ["home", "category", "admirers"]) {
        $(`view-${v}`).classList.toggle("hidden", v !== name);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
}

function scrollToEl(id) {
    const el = $(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---- auth area ----
function renderAuth() {
    const area = $("authArea");
    if (state.me) {
        area.innerHTML = `
            <span class="user-chip">${escape(state.me.username)}</span>
            <button class="btn ghost" id="logoutBtn">Logout</button>`;
        $("logoutBtn").onclick = async () => {
            await api("/auth/logout", { method: "POST" });
            state.me = null;
            renderAuth();
            toast("Logged out");
        };
        $("navAdmirers").classList.remove("hidden");
    } else {
        area.innerHTML = state.config.oauthConfigured
            ? `<a class="btn discord" href="/auth/login">✦ Login with Discord</a>`
            : `<span class="user-chip">Login disabled</span>`;
        $("navAdmirers").classList.add("hidden");
    }
}

// ---- pricing ----
function renderPricing() {
    const grid = $("pricingGrid");
    grid.innerHTML = "";
    const cur = state.config.currency || "$";

    for (const tier of state.config.tiers) {
        const card = document.createElement("div");
        card.className = "price-card" + (tier.recommended ? " featured" : "");

        const price =
            tier.price > 0
                ? `<span class="amt">${cur}${tier.price.toFixed(2)}</span><span class="per">/ month</span>`
                : `<span class="amt">${cur}0</span><span class="per">/ forever</span>`;

        const features = tier.perks
            .map((p) => `<li><span class="check">✓</span><span>${escape(p)}</span></li>`)
            .join("");

        const btn =
            tier.price > 0
                ? `<button class="pc-btn ${tier.recommended ? "primary" : ""}" data-tier="${tier.key}">Get ${escape(tier.name)}</button>`
                : `<a class="pc-btn" href="${state.config.inviteUrl}" target="_blank" rel="noopener">Get started free</a>`;

        card.innerHTML = `
            ${tier.recommended ? '<span class="price-badge">Most Popular</span>' : ""}
            <div class="pc-tier">${tier.emoji ? tier.emoji + " " : ""}${escape(tier.name)}</div>
            <div class="pc-price">${price}</div>
            <ul class="pc-features">${features}</ul>
            ${btn}`;
        grid.appendChild(card);
    }

    // Wire the paid-tier buttons to the Dodo checkout flow.
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
    if (!state.config.paymentsEnabled) {
        toast("Payments aren't set up yet — check back soon");
        return;
    }
    toast("Opening secure checkout…");
    const { status, body } = await api("/api/checkout", {
        method: "POST",
        body: JSON.stringify({ tier })
    });
    if (status === 200 && body.url) {
        window.location.href = body.url;
    } else {
        toast(body.error === "payments_unconfigured" ? "Payments not set up yet" : "Could not start checkout");
    }
}

// ---- home ----
async function loadHome() {
    setTheme("home");
    setView("home");
    setActiveNav("navHome");

    const cats = (await api("/api/categories")).body;
    const grid = $("categoryGrid");
    grid.innerHTML = "";
    for (const c of cats) {
        const card = document.createElement("div");
        card.className = `category-card cc-${themeKey(c.name)}`;
        card.innerHTML = `
            <span class="cc-bar"></span>
            <div class="cc-body">
                <div class="cc-name">${escape(c.name)}</div>
                <div class="cc-count">${c.count} member${c.count === 1 ? "" : "s"}</div>
            </div>
            <span class="cc-arrow">→</span>`;
        card.onclick = () => loadCategory(c.name);
        grid.appendChild(card);
    }

    const stats = (await api("/api/stats")).body;
    $("heroStats").innerHTML = `
        <div><b>${stats.profiles}</b> Members</div>
        <div><b>${stats.likes}</b> Connections</div>
        <div><b>${cats.length}</b> Communities</div>`;

    const tt = document.getElementById("trustText");
    if (tt) {
        tt.textContent =
            stats.profiles > 0
                ? `Trusted by ${stats.profiles} member${stats.profiles === 1 ? "" : "s"}`
                : "Join the growing Orbit community";
    }
}

function setActiveNav(activeId) {
    for (const id of ["navHome", "navCommunities", "navPremium"]) {
        $(id).classList.toggle("active", id === activeId);
    }
}

// ---- category ----
const SUBTITLES = {
    Networking: "Connect with professionals and expand your network.",
    Friends: "Meet members to socialise and spend time with.",
    Gaming: "Find teammates and fellow players.",
    Freelancing: "Freelancers, clients and project collaborators.",
    "Co-Founder": "Find a co-founder for your next venture.",
    Dating: "Meet someone new — members 18 and over."
};

async function loadCategory(category) {
    setTheme(themeKey(category));
    setView("category");
    $("catTitle").textContent = category;
    $("catSubtitle").textContent = SUBTITLES[category] || "";
    $("profileGrid").innerHTML = `<div class="empty">Loading…</div>`;
    $("emptyState").classList.add("hidden");

    const { body } = await api(`/api/profiles?category=${encodeURIComponent(category)}`);
    renderProfiles(body.profiles, "profileGrid");

    if (!body.profiles.length) {
        $("profileGrid").innerHTML = "";
        const empty = $("emptyState");
        empty.textContent = `No members in ${category} yet. Join from the Discord bot with /profile create!`;
        empty.classList.remove("hidden");
    }
}

function tierBadge(tier) {
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
                <div class="pc-name">${escape(p.name)} ${tierBadge(p.tier)}
                    ${p.featured ? '<span class="tag featured">Featured</span>' : ""}
                </div>
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
            toast("Sign in with Discord to register interest");
            setTimeout(() => (window.location.href = "/auth/login"), 900);
        } else {
            toast("Sign-in is not configured yet");
        }
        return;
    }
    if (p.likedByMe) {
        toast("You've already liked this member");
        return;
    }
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
        toast(body.matched ? "It's a match — view it with /matches in Discord" : "Interest registered");
    } else if (status === 401) {
        window.location.href = "/auth/login";
    } else {
        toast(body.reason || "Could not complete that right now");
    }
}

// ---- admirers ----
async function loadAdmirers() {
    if (!state.me) return;
    setTheme("home");
    setView("admirers");
    const grid = $("admirersGrid");
    grid.innerHTML = `<div class="empty">Loading…</div>`;
    const { body } = await api("/api/admirers");

    if (body.locked) {
        grid.innerHTML = "";
        $("admirersSub").innerHTML =
            `<b>${body.count}</b> member(s) have liked you. ` +
            `Reveal their names with a <a href="${body.upgradeUrl}" target="_blank" rel="noopener" style="color:var(--accent)">Premium membership</a>.`;
        return;
    }
    $("admirersSub").textContent = `${body.count} member(s) have liked you.`;
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

// ---- utils ----
function escape(str) {
    return String(str ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
}

// ---- boot ----
async function boot() {
    state.config = (await api("/api/config")).body;
    state.me = (await api("/api/me")).body.user;

    $("brandName").textContent = state.config.botName;
    $("footerName").textContent = state.config.botName;
    document.title = `${state.config.botName} — Premium`;
    $("addBtn").href = state.config.inviteUrl;
    const toPricing = (e) => {
        if (e) e.preventDefault();
        ensureHome(() => scrollToEl("pricingBlock"));
        setActiveNav("navPremium");
    };
    $("upgradeLink").onclick = toPricing;
    $("premiumPill").onclick = toPricing;
    $("announceBtn").onclick = toPricing;

    // logo (brand + hero)
    if (state.config.logo) {
        $("brandLogo").src = state.config.logo;
        $("pheroLogo").src = state.config.logo;
    }

    renderAuth();
    renderPricing();
    await loadHome();

    $("navHome").onclick = (e) => { e.preventDefault(); loadHome(); };
    $("brandLink").onclick = (e) => { e.preventDefault(); loadHome(); };
    $("navCommunities").onclick = (e) => { e.preventDefault(); ensureHome(() => scrollToEl("communitiesBlock")); setActiveNav("navCommunities"); };
    $("navPremium").onclick = (e) => { e.preventDefault(); ensureHome(() => scrollToEl("pricingBlock")); setActiveNav("navPremium"); };
    $("navAdmirers").onclick = (e) => { e.preventDefault(); loadAdmirers(); };
    $("backBtn").onclick = () => loadHome();
    $("backBtn2").onclick = () => loadHome();
    $("seeFeaturesBtn").onclick = () => { ensureHome(() => scrollToEl("pricingBlock")); setActiveNav("navPremium"); };

    const params = new URLSearchParams(window.location.search);
    if (params.get("login") === "ok") toast("Logged in with Discord");
    if (params.get("login") === "failed") toast("Login failed, please try again");
    if (params.has("login")) window.history.replaceState({}, "", "/");
}

/** Make sure the home view is visible, then run a callback (e.g. scroll). */
function ensureHome(cb) {
    const onHome = !$("view-home").classList.contains("hidden");
    if (onHome) {
        cb();
    } else {
        setView("home");
        setTheme("home");
        setTimeout(cb, 60);
    }
}

boot();
