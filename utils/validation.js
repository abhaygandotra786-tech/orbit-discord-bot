/**
 * Community Hub - Validation helpers
 */

const { CATEGORIES, GENDERS, INTERESTED_IN } = require("./constants");

/**
 * Validate and parse an age value.
 * @returns {{ ok: boolean, value?: number, error?: string }}
 */
function parseAge(raw) {
    const age = parseInt(raw, 10);

    if (Number.isNaN(age)) {
        return { ok: false, error: "Age must be a number." };
    }
    if (age < 13) {
        return { ok: false, error: "You must be at least 13 to use this bot." };
    }
    if (age > 120) {
        return { ok: false, error: "Please enter a realistic age." };
    }
    return { ok: true, value: age };
}

function isValidCategory(value) {
    return CATEGORIES.includes(value);
}

function isValidGender(value) {
    return GENDERS.includes(value);
}

function isValidInterestedIn(value) {
    return INTERESTED_IN.includes(value);
}

/**
 * Trim a string and coerce empty values to null for storage.
 */
function clean(value) {
    if (value === undefined || value === null) return null;
    const trimmed = String(value).trim();
    return trimmed.length ? trimmed : null;
}

module.exports = {
    parseAge,
    isValidCategory,
    isValidGender,
    isValidInterestedIn,
    clean
};
