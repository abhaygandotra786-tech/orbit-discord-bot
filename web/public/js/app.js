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
    for (const v of ["home", "category", "premium", "admirers"]) {
        $(`view-${v}`).classList.toggle("hidden", v !== name);
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
        $("navAdmirers").classList.remove("hidden");
    } else {
        area.innerHTML = state.config.oauthConfigured
            ? `<a class="btn sm" href="/auth/login">Login with Discord</a>`
            : `<span class="user-chip">Login disabled</span>`;
        $("navAdmirers").classList.add("hidden");
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
}

// ---- community page ----------------------------------------------
async function loadCategory(category) {
    setTheme(slugOf(category));
    setView("category");
    setActiveByPath("/" + slugOf(category));
    $("catTitle").textContent = category;
    $("catSubtitle").textContent = SUBTITLES[category] || "";
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
    $("addBtn").href = state.config.inviteUrl;
    if (state.config.logo) {
        $("brandLogo").src = state.config.logo;
        $("heroLogo").src = state.config.logo;
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

    const params = new URLSearchParams(window.location.search);
    if (params.get("login") === "ok") toast("Logged in");
    if (params.get("login") === "failed") toast("Login failed");
    if (params.has("login")) history.replaceState({}, "", location.pathname);
}

boot();
