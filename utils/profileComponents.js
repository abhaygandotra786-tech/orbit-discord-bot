/**
 * Community Hub - Profile UI components
 * ------------------------------------------------------------------
 * Builders for the modals, select menus and buttons used by the
 * profile create/edit flow and by profile browsing.
 *
 * Discord limits a modal to 5 text inputs, and a profile has more
 * fields than that, so the flow is split into:
 *   1. A "core" modal (name, age, location, profession, bio)
 *   2. An "extras" modal (skills, interests, linkedin, github, portfolio)
 *   3. Select menus for category, gender and interested-in.
 */

const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const { CATEGORIES, GENDERS, INTERESTED_IN } = require("./constants");

// --- Custom IDs (shared with the interaction router) --------------
const IDS = {
    CREATE_MODAL: "profile_create_modal",
    EDIT_MODAL: "profile_edit_modal",
    EXTRAS_MODAL: "profile_extras_modal",
    EXTRAS_BTN: "profile_extras_btn",
    SET_CATEGORY: "profile_set_category",
    SET_GENDER: "profile_set_gender",
    SET_INTERESTED: "profile_set_interested",
    BROWSE_PREV: "browse_prev",
    BROWSE_NEXT: "browse_next",
    BROWSE_LIKE: "browse_like"
};

function input(id, label, style, { required = false, value = "", max } = {}) {
    const builder = new TextInputBuilder()
        .setCustomId(id)
        .setLabel(label)
        .setStyle(style)
        .setRequired(required);

    if (value) builder.setValue(String(value));
    if (max) builder.setMaxLength(max);
    return new ActionRowBuilder().addComponents(builder);
}

/** Core modal — used for both create and edit (prefilled when editing). */
function buildCoreModal(profile = null) {
    const editing = Boolean(profile);

    return new ModalBuilder()
        .setCustomId(editing ? IDS.EDIT_MODAL : IDS.CREATE_MODAL)
        .setTitle(editing ? "Edit Profile" : "Create Profile")
        .addComponents(
            input("name", "Name", TextInputStyle.Short, {
                required: true,
                value: profile?.name,
                max: 80
            }),
            input("age", "Age", TextInputStyle.Short, {
                required: true,
                value: profile?.age,
                max: 3
            }),
            input("location", "Location", TextInputStyle.Short, {
                required: true,
                value: profile?.location,
                max: 100
            }),
            input("profession", "Profession", TextInputStyle.Short, {
                value: profile?.profession,
                max: 100
            }),
            input("bio", "Bio", TextInputStyle.Paragraph, {
                value: profile?.bio,
                max: 1000
            })
        );
}

/** Extras modal — skills, interests and links. */
function buildExtrasModal(profile = null) {
    return new ModalBuilder()
        .setCustomId(IDS.EXTRAS_MODAL)
        .setTitle("Skills & Links")
        .addComponents(
            input("skills", "Skills (comma separated)", TextInputStyle.Paragraph, {
                value: profile?.skills,
                max: 500
            }),
            input("interests", "Interests (comma separated)", TextInputStyle.Paragraph, {
                value: profile?.interests,
                max: 500
            }),
            input("linkedin", "LinkedIn URL", TextInputStyle.Short, {
                value: profile?.linkedin,
                max: 200
            }),
            input("github", "GitHub URL", TextInputStyle.Short, {
                value: profile?.github,
                max: 200
            }),
            input("portfolio", "Portfolio URL", TextInputStyle.Short, {
                value: profile?.portfolio,
                max: 200
            })
        );
}

/** Select menus + extras button shown after a profile is saved. */
function buildSetupRows(profile = {}) {
    const categorySelect = new StringSelectMenuBuilder()
        .setCustomId(IDS.SET_CATEGORY)
        .setPlaceholder(
            profile.category ? `Category: ${profile.category}` : "Select a category"
        )
        .addOptions(
            CATEGORIES.map((c) => ({
                label: c,
                value: c,
                default: profile.category === c
            }))
        );

    const genderSelect = new StringSelectMenuBuilder()
        .setCustomId(IDS.SET_GENDER)
        .setPlaceholder(
            profile.gender ? `Gender: ${profile.gender}` : "Select your gender"
        )
        .addOptions(
            GENDERS.map((g) => ({
                label: g,
                value: g,
                default: profile.gender === g
            }))
        );

    const interestedSelect = new StringSelectMenuBuilder()
        .setCustomId(IDS.SET_INTERESTED)
        .setPlaceholder(
            profile.interested_in
                ? `Interested in: ${profile.interested_in}`
                : "Select who you're interested in"
        )
        .addOptions(
            INTERESTED_IN.map((i) => ({
                label: i,
                value: i,
                default: profile.interested_in === i
            }))
        );

    const extrasButton = new ButtonBuilder()
        .setCustomId(IDS.EXTRAS_BTN)
        .setLabel("Add Skills & Links")
        .setEmoji("🛠️")
        .setStyle(ButtonStyle.Secondary);

    return [
        new ActionRowBuilder().addComponents(categorySelect),
        new ActionRowBuilder().addComponents(genderSelect),
        new ActionRowBuilder().addComponents(interestedSelect),
        new ActionRowBuilder().addComponents(extrasButton)
    ];
}

/** Navigation row for profile browsing. */
function buildBrowseRow({ total } = { total: 1 }) {
    const disabled = total <= 1;

    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(IDS.BROWSE_PREV)
            .setLabel("Previous")
            .setEmoji("⬅️")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(IDS.BROWSE_NEXT)
            .setLabel("Next")
            .setEmoji("➡️")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(IDS.BROWSE_LIKE)
            .setLabel("Like")
            .setEmoji("❤️")
            .setStyle(ButtonStyle.Success)
    );
}

module.exports = {
    IDS,
    buildCoreModal,
    buildExtrasModal,
    buildSetupRows,
    buildBrowseRow
};
