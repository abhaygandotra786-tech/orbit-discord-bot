/**
 * Community Hub - Browse helper
 * ------------------------------------------------------------------
 * Shared rendering for every "browse" experience (general, dating,
 * networking, founder, freelance). Stores a paginated session and
 * replies with a themed profile card + navigation buttons.
 */

const session = require("./session");
const { profileEmbed, errorEmbed, baseEmbed } = require("./embed");
const { buildBrowseRow } = require("./profileComponents");
const premium = require("./premiumService");
const { recordView } = require("./viewService");
const config = require("../config/config");

/**
 * Start a browse session and send the first page.
 * @param {import("discord.js").ChatInputCommandInteraction} interaction
 * @param {object[]} profiles
 * @param {string} context  session label e.g. "browse", "dating"
 * @param {string} [emptyMsg]
 */
async function startBrowse(interaction, profiles, context, emptyMsg) {
    if (!profiles || profiles.length === 0) {
        return interaction.reply({
            embeds: [
                errorEmbed(
                    emptyMsg || "No profiles found to browse.",
                    "🔍 Nothing Here Yet"
                )
            ],
            ephemeral: true
        });
    }

    // VIP discovery: Pro > Premium > Free, featured profiles to the very top.
    const ordered = profiles
        .map((p, i) => ({ p, i }))
        .sort(
            (a, b) =>
                premium.visibilityWeight(b.p) - premium.visibilityWeight(a.p) ||
                a.i - b.i
        )
        .map((x) => x.p);

    // Enforce the viewer's daily view quota (free tier).
    const quota = recordView(interaction.user.id, ordered[0].user_id);
    if (!quota.allowed) {
        return interaction.reply({ embeds: [viewLimitEmbed(quota)], ephemeral: true });
    }

    session.setSession(interaction.user.id, ordered, context);

    const profile = ordered[0];
    const embed = profileEmbed(profile, {
        headerNote: `Profile 1 of ${ordered.length}`
    });

    return interaction.reply({
        embeds: [embed],
        components: [buildBrowseRow({ total: ordered.length })],
        ephemeral: true
    });
}

/** Upsell shown when a free user exhausts their daily views. */
function viewLimitEmbed(quota) {
    return baseEmbed({
        title: "🔒 Daily View Limit Reached",
        description:
            `You've viewed your **${quota.limit}** profiles for today.\n` +
            `Upgrade to **Premium** for **unlimited** browsing — use \`/premium plans\`.`,
        color: config.COLORS.PREMIUM
    });
}

module.exports = { startBrowse, viewLimitEmbed };
