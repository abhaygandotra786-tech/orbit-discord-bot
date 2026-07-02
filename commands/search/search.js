/**
 * /search - profile search.
 *  - Free: a single basic filter, capped at the daily search limit.
 *  - Premium+: advanced multi-filter search and age ranges.
 */

const { SlashCommandBuilder } = require("discord.js");

const db = require("../../database/database");
const { incrementSearchAppearance } = require("../../database/profileQueries");
const { baseEmbed, errorEmbed, nameWithBadge } = require("../../utils/embed");
const { CATEGORIES, GENDERS } = require("../../utils/constants");
const { requireCapability } = require("../../utils/gate");
const premium = require("../../utils/premiumService");
const usage = require("../../utils/usageService");
const config = require("../../config/config");

/** Parse "24-30" or "24" into a WHERE clause + params. */
function parseAgeRange(raw) {
    const m = String(raw).match(/^\s*(\d{1,3})\s*(?:-\s*(\d{1,3}))?\s*$/);
    if (!m) return null;
    const min = parseInt(m[1], 10);
    const max = m[2] ? parseInt(m[2], 10) : min;
    return { clause: "age BETWEEN ? AND ?", params: [Math.min(min, max), Math.max(min, max)] };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("search")
        .setDescription("Search community profiles")
        .addStringOption((o) => o.setName("location").setDescription("Filter by location"))
        .addStringOption((o) => o.setName("skills").setDescription("Filter by skill"))
        .addStringOption((o) => o.setName("profession").setDescription("Filter by profession"))
        .addStringOption((o) => o.setName("interests").setDescription("Filter by interest"))
        .addStringOption((o) =>
            o
                .setName("category")
                .setDescription("Filter by category")
                .addChoices(...CATEGORIES.map((c) => ({ name: c, value: c })))
        )
        .addStringOption((o) =>
            o
                .setName("gender")
                .setDescription("Filter by gender (advanced)")
                .addChoices(...GENDERS.map((g) => ({ name: g, value: g })))
        )
        .addStringOption((o) =>
            o.setName("age").setDescription("Age or range, e.g. 24-30 (advanced)")
        ),

    async execute(interaction) {
        const userId = interaction.user.id;

        // Collect provided filters.
        const provided = [];
        const where = [];
        const params = [];

        for (const field of ["location", "skills", "profession", "interests"]) {
            const val = interaction.options.getString(field);
            if (val) {
                provided.push(`${field}: ${val}`);
                where.push(`${field} LIKE ?`);
                params.push(`%${val}%`);
            }
        }
        const category = interaction.options.getString("category");
        if (category) {
            provided.push(`category: ${category}`);
            where.push("category = ?");
            params.push(category);
        }
        const gender = interaction.options.getString("gender");
        const ageRaw = interaction.options.getString("age");

        if (provided.length === 0 && !gender && !ageRaw) {
            return interaction.reply({
                embeds: [errorEmbed("Please provide at least one search filter.")],
                ephemeral: true
            });
        }

        // Advanced = age filter, gender filter, or more than one filter at once.
        const advanced =
            !!ageRaw || !!gender || provided.length + (gender ? 1 : 0) + (ageRaw ? 1 : 0) > 1;

        if (advanced) {
            if (!(await requireCapability(interaction, "advancedSearch", "Advanced search")))
                return;
        }

        if (gender) {
            provided.push(`gender: ${gender}`);
            where.push("gender = ?");
            params.push(gender);
        }
        if (ageRaw) {
            const range = parseAgeRange(ageRaw);
            if (!range) {
                return interaction.reply({
                    embeds: [errorEmbed("Invalid age format. Use e.g. `24` or `24-30`.")],
                    ephemeral: true
                });
            }
            provided.push(`age: ${ageRaw}`);
            where.push(range.clause);
            params.push(...range.params);
        }

        // Daily search limit (free tier only).
        const quota = usage.consume(userId, "searches");
        if (!quota.allowed) {
            return interaction.reply({
                embeds: [
                    baseEmbed({
                        title: "🔒 Daily Search Limit Reached",
                        description:
                            `You've used your **${quota.limit}** searches for today.\n` +
                            "Upgrade to **Premium** for unlimited searches — `/premium plans`.",
                        color: config.COLORS.PREMIUM
                    })
                ],
                ephemeral: true
            });
        }

        const limit = config.LIMITS.SEARCH_RESULTS;
        const sql = `SELECT * FROM profiles WHERE ${where.join(" AND ")} LIMIT 200`;
        let results = db.prepare(sql).all(...params);

        // Track search appearances + rank by visibility (VIP/featured first).
        for (const p of results) incrementSearchAppearance.run(p.user_id);
        results = results
            .map((p, i) => ({ p, i }))
            .sort(
                (a, b) =>
                    premium.visibilityWeight(b.p) - premium.visibilityWeight(a.p) ||
                    a.i - b.i
            )
            .map((x) => x.p)
            .slice(0, limit);

        if (results.length === 0) {
            return interaction.reply({
                embeds: [errorEmbed("No profiles matched your filters.", "🔍 No Results")],
                ephemeral: true
            });
        }

        const embed = baseEmbed({
            title: "🔍 Search Results",
            description:
                `Filters — ${provided.join(" • ")}\nFound **${results.length}** match(es).`
        });

        for (const p of results) {
            embed.addFields({
                name: `${nameWithBadge(p)} (${p.age ?? "N/A"})`,
                value:
                    `📍 ${p.location || "N/A"} • 💼 ${p.profession || "N/A"}\n` +
                    `🛠️ ${p.skills || "N/A"}\n🏷️ ${p.category || "N/A"} • <@${p.user_id}>`
            });
        }

        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
