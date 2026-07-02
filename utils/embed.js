/**
 * Community Hub - Embed factory
 * ------------------------------------------------------------------
 * Produces consistently themed, polished embeds (orange theme, author
 * header, footer, timestamp) so every response looks the same.
 */

const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");
const config = require("../config/config");
const { CATEGORY_EMOJI } = require("./constants");
const premium = require("./premiumService");

const COLORS = config.COLORS || {};

// The banner is the only brand image used in embeds (no logo, by design).
// It can come from a public URL (config/.env) or a local file dropped into
// web/public/assets/banner.* — local files are attached and referenced via
// attachment:// so they work in Discord without hosting.
const ASSET_DIR = path.join(__dirname, "../web/public/assets");

function findAsset(base) {
    for (const ext of ["png", "jpg", "jpeg", "webp", "gif"]) {
        const p = path.join(ASSET_DIR, `${base}.${ext}`);
        if (fs.existsSync(p)) return { path: p, name: `orbit-${base}.${ext}` };
    }
    return null;
}

/**
 * Resolve the banner image reference + the file to attach (if local).
 * @returns {{ files: AttachmentBuilder[], bannerRef: string|null }}
 */
function brandKit() {
    let bannerRef = config.BANNER_URL || null;
    const files = [];

    if (!bannerRef) {
        const b = findAsset("banner");
        if (b) {
            files.push(new AttachmentBuilder(b.path, { name: b.name }));
            bannerRef = `attachment://${b.name}`;
        }
    }
    return { files, bannerRef };
}

/**
 * Create a base embed pre-filled with the bot theme.
 * Text-only header/footer — no logo image, by design.
 * @param {object} [opts]
 * @param {string} [opts.title]
 * @param {string} [opts.description]
 * @param {number} [opts.color]
 * @returns {EmbedBuilder}
 */
function baseEmbed({ title, description, color } = {}) {
    const embed = new EmbedBuilder()
        .setColor(color ?? COLORS.PRIMARY ?? config.EMBED_COLOR)
        .setTimestamp()
        .setAuthor({ name: config.BOT_NAME })
        .setFooter({ text: config.FOOTER.TEXT });

    if (title) embed.setTitle(title);
    if (description) embed.setDescription(description);

    return embed;
}

function successEmbed(message, title = "Success") {
    return baseEmbed({
        title: `✅ ${title}`,
        description: `> ${message}`,
        color: COLORS.SUCCESS
    });
}

function errorEmbed(message, title = "Error") {
    return baseEmbed({
        title: `❌ ${title}`,
        description: `> ${message}`,
        color: COLORS.ERROR
    });
}

function infoEmbed(message, title) {
    return baseEmbed({
        title: title || undefined,
        description: `> ${message}`,
        color: COLORS.INFO
    });
}

const DIVIDER = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━";

/**
 * Like baseEmbed, but adds the banner at the bottom and returns the files
 * that must accompany the message. No logo — banner only, by design.
 * @returns {{ embed: EmbedBuilder, files: AttachmentBuilder[] }}
 */
function brandedEmbed({ title, description, color } = {}) {
    const { files, bannerRef } = brandKit();

    const embed = new EmbedBuilder()
        .setColor(color ?? COLORS.PRIMARY ?? config.EMBED_COLOR)
        .setTimestamp()
        .setAuthor({ name: config.BOT_NAME })
        .setFooter({ text: config.FOOTER.TEXT });

    if (title) embed.setTitle(title);
    if (description) embed.setDescription(description);
    if (bannerRef) embed.setImage(bannerRef);

    return { embed, files };
}

/**
 * Render a full, polished profile embed.
 * @param {object} profile  row from the profiles table
 * @param {object} [opts]
 * @param {string} [opts.headerNote] extra line shown under the title
 */
function profileEmbed(profile, { headerNote } = {}) {
    const emoji = CATEGORY_EMOJI[profile.category] || "🏷️";
    const tier = premium.meta(profile.user_id);
    const badgeLabel = premium.badgeLabel(profile.user_id);
    const inlineBadge = tier.emoji ? ` ${tier.emoji}` : "";

    // Theme color (Premium+), else tier color, else brand default.
    let color = tier.color;
    if (
        profile.theme &&
        premium.has(profile.user_id, "profileThemes") &&
        config.PREMIUM.THEMES[profile.theme] !== undefined
    ) {
        color = config.PREMIUM.THEMES[profile.theme];
    }

    const isFeatured =
        profile.featured && profile.featured_until > Date.now();

    const embed = baseEmbed({
        title: `${isFeatured ? "🌟 " : ""}👤 ${profile.name}${inlineBadge}`,
        color
    });

    const noteLines = [];
    if (badgeLabel) noteLines.push(`**${badgeLabel}**`);
    if (isFeatured) noteLines.push("🌟 **Featured Profile**");
    if (profile.investor_role) noteLines.push(`💰 *${profile.investor_role}*`);
    if (headerNote) noteLines.push(`📖 *${headerNote}*`);
    noteLines.push(DIVIDER);
    embed.setDescription(noteLines.join("\n"));

    embed.addFields(
        { name: "🎂 Age", value: codeline(profile.age), inline: true },
        { name: "🚻 Gender", value: codeline(profile.gender), inline: true },
        {
            name: "💘 Interested In",
            value: codeline(profile.interested_in),
            inline: true
        },
        {
            name: "📍 Location",
            value: codeline(profile.location),
            inline: true
        },
        {
            name: "💼 Profession",
            value: codeline(profile.profession),
            inline: true
        },
        {
            name: "🏷️ Category",
            value: profile.category ? `${emoji} ${profile.category}` : "`N/A`",
            inline: true
        }
    );

    embed.addFields(
        { name: "🛠️ Skills", value: blockOrNa(profile.skills) },
        { name: "🎯 Interests", value: blockOrNa(profile.interests) },
        { name: "📝 Bio", value: profile.bio ? `> ${profile.bio}` : "`No bio provided.`" }
    );

    if (profile.portfolio_projects) {
        embed.addFields({
            name: "📂 Portfolio Projects",
            value: profile.portfolio_projects
        });
    }

    const links = [];
    if (profile.linkedin) links.push(`[LinkedIn](${safeUrl(profile.linkedin)})`);
    if (profile.github) links.push(`[GitHub](${safeUrl(profile.github)})`);
    if (profile.portfolio)
        links.push(`[Portfolio](${safeUrl(profile.portfolio)})`);

    if (links.length) {
        embed.addFields({ name: "🔗 Links", value: links.join("  •  ") });
    }

    return embed;
}

// --- formatting helpers -------------------------------------------

function codeline(value) {
    return value === null || value === undefined || value === ""
        ? "`N/A`"
        : `\`${value}\``;
}

function blockOrNa(value) {
    if (!value) return "`N/A`";
    // Render comma lists as neat pills.
    const items = String(value)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    if (items.length <= 1) return value;
    return items.map((i) => `\`${i}\``).join(" ");
}

function safeUrl(value) {
    if (/^https?:\/\//i.test(value)) return value;
    return `https://${value}`;
}

/** Compact "👤 Name 👑" header for list items, with tier badge. */
function nameWithBadge(profile) {
    return `👤 ${profile.name}${premium.badge(profile.user_id)}`;
}

module.exports = {
    baseEmbed,
    brandedEmbed,
    brandKit,
    successEmbed,
    errorEmbed,
    infoEmbed,
    profileEmbed,
    nameWithBadge,
    DIVIDER
};
