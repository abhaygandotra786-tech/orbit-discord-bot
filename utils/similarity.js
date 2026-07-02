/**
 * Community Hub - Compatibility engine
 * ------------------------------------------------------------------
 * Heuristic profile-matching used by /match-ai and /recommend.
 * Produces a 0-100 compatibility score plus human-readable reasons.
 */

function toSet(value) {
    return new Set(
        String(value || "")
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean)
    );
}

function overlap(aSet, bSet) {
    const shared = [];
    for (const item of aSet) if (bSet.has(item)) shared.push(item);
    return shared;
}

/**
 * Compute a compatibility result between two profiles.
 * @returns {{
 *   score: number,
 *   sharedSkills: string[],
 *   sharedInterests: string[],
 *   sameCategory: boolean,
 *   sameProfession: boolean,
 *   sameLocation: boolean,
 *   reasons: string[]
 * }}
 */
function compatibility(a, b) {
    const aSkills = toSet(a.skills);
    const bSkills = toSet(b.skills);
    const aInterests = toSet(a.interests);
    const bInterests = toSet(b.interests);

    const sharedSkills = overlap(aSkills, bSkills);
    const sharedInterests = overlap(aInterests, bInterests);

    const sameCategory = !!a.category && a.category === b.category;
    const sameProfession =
        !!a.profession &&
        a.profession.trim().toLowerCase() ===
            String(b.profession || "").trim().toLowerCase();
    const sameLocation =
        !!a.location &&
        a.location.trim().toLowerCase() ===
            String(b.location || "").trim().toLowerCase();

    // Weighted scoring.
    let score = 0;
    const skillRatio =
        aSkills.size && bSkills.size
            ? sharedSkills.length / Math.min(aSkills.size, bSkills.size)
            : 0;
    const interestRatio =
        aInterests.size && bInterests.size
            ? sharedInterests.length / Math.min(aInterests.size, bInterests.size)
            : 0;

    score += skillRatio * 35;
    score += interestRatio * 25;
    if (sameCategory) score += 20;
    if (sameProfession) score += 12;
    if (sameLocation) score += 8;

    // Small base so reasonable profiles aren't near-zero.
    score = Math.min(100, Math.round(score + 5));

    const reasons = [];
    if (sharedSkills.length)
        reasons.push(`Shared skills: ${sharedSkills.join(", ")}`);
    if (sharedInterests.length)
        reasons.push(`Shared interests: ${sharedInterests.join(", ")}`);
    if (sameProfession) reasons.push(`Same profession (${a.profession})`);
    if (sameCategory) reasons.push(`Same category (${a.category})`);
    if (sameLocation) reasons.push(`Same location (${a.location})`);
    if (!reasons.length) reasons.push("Both active members of the community");

    return {
        score,
        sharedSkills,
        sharedInterests,
        sameCategory,
        sameProfession,
        sameLocation,
        reasons
    };
}

module.exports = { compatibility };
