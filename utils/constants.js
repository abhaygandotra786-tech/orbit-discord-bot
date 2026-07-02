/**
 * Community Hub - Shared constants
 * Central definitions for categories, genders and preference options.
 */

const CATEGORIES = [
    "Networking",
    "Friends",
    "Gaming",
    "Freelancing",
    "Co-Founder",
    "Dating"
];

const GENDERS = ["Male", "Female", "Other"];

const INTERESTED_IN = ["Male", "Female", "Everyone"];

const CATEGORY_EMOJI = {
    Networking: "🤝",
    Friends: "👥",
    Gaming: "🎮",
    Freelancing: "💼",
    "Co-Founder": "🚀",
    Dating: "💖"
};

module.exports = {
    CATEGORIES,
    GENDERS,
    INTERESTED_IN,
    CATEGORY_EMOJI
};
