/**
 * Orbit - the ONE embed factory.
 * ------------------------------------------------------------------
 * Every embed in the codebase goes through createOrbitEmbed(). It enforces
 * the design system: one coral brand color (soft red for errors, muted green
 * for confirmations), an "Orbit" author line with the logo icon, tidy
 * spacing, and a quiet plain-text footer.
 *
 * Design rules (do not break):
 *  - One color per kind. Nothing else, ever.
 *  - At most one emoji per embed, only in the title.
 *  - No emoji in body, field names, or footers.
 *  - Short lines, bold only for the one thing that matters.
 */
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const config = require("../config/config");
const S = require("../config/strings");
const premium = require("./premiumService");
const { badges } = require("./rewardsStore");

// The only colors Orbit ever uses.
const COLOR = {
    brand: 0xf4502a,   // coral, the default for everything
    error: 0xed4245,   // soft red
    confirm: 0x57f287  // muted green
};

/**
 * The single embed builder.
 * @param {object} o
 * @param {string} [o.title]   short, 2 to 5 words
 * @param {string} [o.body]    1 to 3 short lines (use \n\n between ideas)
 * @param {Array}  [o.fields]  [{name, value, inline}] empty values are skipped
 * @param {string} [o.footer]  one quiet plain line
 * @param {"brand"|"error"|"confirm"} [o.kind]
 * @param {boolean} [o.timestamp]
 * @returns {EmbedBuilder}
 */
function createOrbitEmbed({ title, body, fields, footer, kind = "brand", timestamp } = {}) {
    const embed = new EmbedBuilder()
        .setColor(COLOR[kind] || COLOR.brand)
        .setAuthor(
            config.LOGO_URL
                ? { name: config.BOT_NAME, iconURL: config.LOGO_URL }
                : { name: config.BOT_NAME }
        );

    if (title) embed.setTitle(title);
    if (body) embed.setDescription(body);
    if (Array.isArray(fields)) {
        for (const f of fields) {
            if (f && f.value != null && String(f.value).trim() !== "") {
                embed.addFields({ name: f.name, value: String(f.value).trim(), inline: Boolean(f.inline) });
            }
        }
    }
    if (footer) embed.setFooter({ text: footer });
    if (timestamp) embed.setTimestamp();
    return embed;
}

/* ==================================================================
   Back-compat wrappers: existing call sites keep working, but every
   embed now conforms to the design system automatically.
   ================================================================== */
function baseEmbed({ title, description } = {}) {
    return createOrbitEmbed({ title, body: description, footer: S.brand.footer });
}
/** Returns { embed, files } for callers that still destructure it. No banner. */
function brandedEmbed({ title, description } = {}) {
    return { embed: createOrbitEmbed({ title, body: description, footer: S.brand.footer }), files: [] };
}
function successEmbed(message, title = S.confirm.default) {
    return createOrbitEmbed({ title, body: message, kind: "confirm" });
}
function errorEmbed(message, title = "Heads up") {
    return createOrbitEmbed({ title, body: message, kind: "error" });
}
function infoEmbed(message, title) {
    return createOrbitEmbed({ title, body: message, footer: S.brand.footer });
}
// no-op kept for old imports; the design system has no dividers
const DIVIDER = "";
function brandKit() {
    return { files: [], bannerRef: null };
}

/* ==================================================================
   Profile card: name, a short context line, 3 to 4 fields max.
   ================================================================== */
function profileEmbed(profile, { headerNote } = {}) {
    const isFeatured = profile.featured && profile.featured_until > Date.now();
    const tierName = premium.meta(profile.user_id).name; // "Free" | "Pro" | "Premium"
    const vouched = safeHasBadge(profile.user_id, "Vouched");

    const line1 = [profile.age, profile.gender, profile.location].filter(Boolean).join("  ·  ");
    const line2 = [profile.category, profile.profession].filter(Boolean).join("  ·  ");
    const status = [];
    if (tierName && tierName !== "Free") status.push(tierName);
    if (vouched) status.push("Vouched");
    if (isFeatured) status.push("Featured");
    if (headerNote) status.push(headerNote);

    const body = [line1, line2, status.length ? `**${status.join("  ·  ")}**` : ""]
        .filter(Boolean)
        .join("\n");

    const fields = [
        { name: "About", value: profile.bio },
        { name: "Skills", value: profile.skills },
        { name: "Interests", value: profile.interests },
        { name: "Links", value: buildLinks(profile) }
    ].filter((f) => f.value);

    return createOrbitEmbed({
        title: profile.name,
        body,
        fields: fields.slice(0, 4),
        footer: S.brand.footer
    });
}

/* ==================================================================
   Match card: the hero embed. Two names, one reason, one icebreaker.
   ================================================================== */
function matchCardEmbed({ nameA, nameB, reason, icebreaker } = {}) {
    const ib = icebreaker || S.match.icebreakers[Math.floor(Math.random() * S.match.icebreakers.length)];
    return createOrbitEmbed({
        title: S.match.title,
        body: `**${nameA}** and **${nameB}**\n\n${reason || S.match.reasonFallback}`,
        fields: [{ name: "Icebreaker", value: ib }],
        footer: S.brand.footer
    });
}

/** A single [Say hi] primary button (optionally with [View profile]). */
function sayHiRow(targetId, { withProfile = false } = {}) {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`sayhi:${targetId}`).setLabel(S.match.sayHi).setStyle(ButtonStyle.Primary)
    );
    if (withProfile) {
        row.addComponents(
            new ButtonBuilder().setCustomId(`viewprofile:${targetId}`).setLabel(S.match.viewProfile).setStyle(ButtonStyle.Secondary)
        );
    }
    return row;
}

/* ---- small helpers ---- */
function safeUrl(v) {
    return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}
function buildLinks(profile) {
    const links = [];
    if (profile.linkedin) links.push(`[LinkedIn](${safeUrl(profile.linkedin)})`);
    if (profile.github) links.push(`[GitHub](${safeUrl(profile.github)})`);
    if (profile.portfolio) links.push(`[Portfolio](${safeUrl(profile.portfolio)})`);
    return links.join("  ·  ");
}
function safeHasBadge(userId, badge) {
    try { return badges.has(userId, badge); } catch { return false; }
}
/** Plain name for list items (no emoji, per the design system). */
function nameWithBadge(profile) {
    return profile.name;
}

module.exports = {
    createOrbitEmbed,
    COLOR,
    baseEmbed,
    brandedEmbed,
    brandKit,
    successEmbed,
    errorEmbed,
    infoEmbed,
    profileEmbed,
    matchCardEmbed,
    sayHiRow,
    nameWithBadge,
    DIVIDER
};
