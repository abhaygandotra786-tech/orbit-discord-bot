/**
 * Central interaction router.
 * Handles slash commands, modal submits, select menus and buttons.
 * Enforces the ban list before any command runs.
 */

const {
    getProfile,
    createProfile,
    updateProfile,
    setCategory,
    setGender,
    setInterestedIn
} = require("../database/profileQueries");

const {
    IDS,
    buildCoreModal,
    buildExtrasModal,
    buildSetupRows
} = require("../utils/profileComponents");

const { isBanned } = require("../database/banQueries");
const { setStatus, getConnection } = require("../database/connectionQueries");
const { like } = require("../utils/likeService");
const { recordView } = require("../utils/viewService");
const { viewLimitEmbed } = require("../utils/browse");
const session = require("../utils/session");
const { parseAge, clean } = require("../utils/validation");
const {
    profileEmbed,
    matchCardEmbed,
    sayHiRow,
    createOrbitEmbed,
    successEmbed,
    errorEmbed,
    baseEmbed
} = require("../utils/embed");
const { buildBrowseRow } = require("../utils/profileComponents");
const referrals = require("../utils/referralService");
const voteService = require("../utils/voteService");
const S = require("../config/strings");
const config = require("../config/config");
const logger = require("../utils/logger");

module.exports = {
    name: "interactionCreate",

    async execute(interaction, client) {
        try {
            if (interaction.isChatInputCommand()) {
                return handleCommand(interaction, client);
            }
            if (interaction.isModalSubmit()) {
                return handleModal(interaction);
            }
            if (interaction.isStringSelectMenu()) {
                return handleSelect(interaction);
            }
            if (interaction.isButton()) {
                return handleButton(interaction);
            }
        } catch (error) {
            logger.error("Unhandled interaction error", error);
            await safeError(
                interaction,
                "Something went wrong while processing that action."
            );
        }
    }
};

// ------------------------------------------------------------------
// Slash commands
// ------------------------------------------------------------------
async function handleCommand(interaction, client) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    // Ban enforcement (admins are exempt so they can manage the bot).
    const admin = config.ADMIN_IDS.includes(interaction.user.id);
    if (!admin && isBanned(interaction.user.id)) {
        return interaction.reply({
            embeds: [
                errorEmbed(
                    `You are banned from using ${config.BOT_NAME}.`,
                    "🚫 Access Denied"
                )
            ],
            ephemeral: true
        });
    }

    // Admin-only enforcement.
    if (command.adminOnly && !admin) {
        return interaction.reply({
            embeds: [
                errorEmbed(
                    "This command is restricted to administrators.",
                    "🚫 Access Denied"
                )
            ],
            ephemeral: true
        });
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        logger.error(`Command /${interaction.commandName} failed`, error);
        await safeError(
            interaction,
            "Orbit hit a brief hiccup. Please try that again in a moment."
        );
    }
}

// ------------------------------------------------------------------
// Modal submits
// ------------------------------------------------------------------
async function handleModal(interaction) {
    const userId = interaction.user.id;

    // --- Create profile (core fields) ---
    if (interaction.customId === IDS.CREATE_MODAL) {
        if (getProfile.get(userId)) {
            return interaction.reply({
                embeds: [errorEmbed("You already have a profile.")],
                ephemeral: true
            });
        }

        const age = parseAge(interaction.fields.getTextInputValue("age"));
        if (!age.ok) {
            return interaction.reply({
                embeds: [errorEmbed(age.error)],
                ephemeral: true
            });
        }

        createProfile.run({
            user_id: userId,
            name: clean(interaction.fields.getTextInputValue("name")),
            age: age.value,
            gender: null,
            interested_in: null,
            location: clean(interaction.fields.getTextInputValue("location")),
            bio: clean(interaction.fields.getTextInputValue("bio")),
            skills: null,
            profession: clean(interaction.fields.getTextInputValue("profession")),
            linkedin: null,
            github: null,
            portfolio: null,
            interests: null,
            category: null
        });

        logger.profile(`Profile created by ${userId}`);

        const profile = getProfile.get(userId);
        return interaction.reply({
            content:
                "Profile created. Finish setup below: pick a category, gender and preference, then add your skills and links.",
            embeds: [profileEmbed(profile)],
            components: buildSetupRows(profile),
            ephemeral: true
        });
    }

    // --- Edit profile (core fields, merge with existing) ---
    if (interaction.customId === IDS.EDIT_MODAL) {
        const existing = getProfile.get(userId);
        if (!existing) {
            return interaction.reply({
                embeds: [errorEmbed("You don't have a profile yet.")],
                ephemeral: true
            });
        }

        const age = parseAge(interaction.fields.getTextInputValue("age"));
        if (!age.ok) {
            return interaction.reply({
                embeds: [errorEmbed(age.error)],
                ephemeral: true
            });
        }

        updateProfile.run({
            user_id: userId,
            name: clean(interaction.fields.getTextInputValue("name")),
            age: age.value,
            location: clean(interaction.fields.getTextInputValue("location")),
            bio: clean(interaction.fields.getTextInputValue("bio")),
            profession: clean(interaction.fields.getTextInputValue("profession")),
            // preserve extras set elsewhere
            skills: existing.skills,
            linkedin: existing.linkedin,
            github: existing.github,
            portfolio: existing.portfolio,
            interests: existing.interests
        });

        logger.profile(`Profile edited by ${userId}`);

        const profile = getProfile.get(userId);
        return interaction.reply({
            content: "✅ Profile updated.",
            embeds: [profileEmbed(profile)],
            components: buildSetupRows(profile),
            ephemeral: true
        });
    }

    // --- Extras (skills, interests, links) ---
    if (interaction.customId === IDS.EXTRAS_MODAL) {
        const existing = getProfile.get(userId);
        if (!existing) {
            return interaction.reply({
                embeds: [errorEmbed("You don't have a profile yet.")],
                ephemeral: true
            });
        }

        updateProfile.run({
            user_id: userId,
            // preserve core fields
            name: existing.name,
            age: existing.age,
            location: existing.location,
            bio: existing.bio,
            profession: existing.profession,
            // update extras
            skills: clean(interaction.fields.getTextInputValue("skills")),
            interests: clean(interaction.fields.getTextInputValue("interests")),
            linkedin: clean(interaction.fields.getTextInputValue("linkedin")),
            github: clean(interaction.fields.getTextInputValue("github")),
            portfolio: clean(interaction.fields.getTextInputValue("portfolio"))
        });

        logger.profile(`Profile extras updated by ${userId}`);

        const profile = getProfile.get(userId);
        return interaction.reply({
            embeds: [
                successEmbed("Skills & links saved."),
                profileEmbed(profile)
            ],
            ephemeral: true
        });
    }
}

// ------------------------------------------------------------------
// Select menus (category / gender / interested-in)
// ------------------------------------------------------------------
async function handleSelect(interaction) {
    const userId = interaction.user.id;
    const value = interaction.values[0];

    if (!getProfile.get(userId)) {
        return interaction.reply({
            embeds: [errorEmbed("You don't have a profile yet.")],
            ephemeral: true
        });
    }

    if (interaction.customId === IDS.SET_CATEGORY) {
        setCategory.run({ user_id: userId, category: value });
    } else if (interaction.customId === IDS.SET_GENDER) {
        setGender.run({ user_id: userId, gender: value });
    } else if (interaction.customId === IDS.SET_INTERESTED) {
        setInterestedIn.run({ user_id: userId, interested_in: value });
    } else {
        return;
    }

    const profile = getProfile.get(userId);
    // Completing profile setup may activate a pending referral.
    referrals.handleActivation(userId, interaction.client);
    return interaction.update({
        embeds: [profileEmbed(profile)],
        components: buildSetupRows(profile)
    });
}

// ------------------------------------------------------------------
// Buttons (extras modal trigger + browse navigation)
// ------------------------------------------------------------------
async function handleButton(interaction) {
    const userId = interaction.user.id;

    // Welcome message: open the create-profile modal.
    if (interaction.customId === "welcome_create") {
        if (getProfile.get(userId)) {
            return interaction.reply({ embeds: [errorEmbed(S.errors.alreadyProfile)], ephemeral: true });
        }
        return interaction.showModal(buildCoreModal(false));
    }

    // Match card: Say hi.
    if (interaction.customId.startsWith("sayhi:")) {
        const targetId = interaction.customId.split(":")[1];
        const ib = S.match.icebreakers[Math.floor(Math.random() * S.match.icebreakers.length)];
        return interaction.reply({
            embeds: [
                createOrbitEmbed({
                    title: "Say hi",
                    body: `Go start a chat with <@${targetId}>.`,
                    fields: [{ name: "Try opening with", value: ib }]
                })
            ],
            ephemeral: true
        });
    }

    // Match card: View profile.
    if (interaction.customId.startsWith("viewprofile:")) {
        const targetId = interaction.customId.split(":")[1];
        const p = getProfile.get(targetId);
        if (!p) return interaction.reply({ embeds: [errorEmbed("That profile is not available.")], ephemeral: true });
        return interaction.reply({ embeds: [profileEmbed(p)], ephemeral: true });
    }

    // Toggle the opt-in vote reminder.
    if (interaction.customId === "vote_remind") {
        const on = !voteService.state(userId).reminderOptIn;
        voteService.toggleReminder(userId, on);
        return interaction.reply({
            embeds: [
                successEmbed(
                    on
                        ? "Reminders on. I'll DM you when your next vote is ready."
                        : "Reminders off."
                )
            ],
            ephemeral: true
        });
    }

    // Connection request accept / decline.
    if (
        interaction.customId.startsWith("connect_accept:") ||
        interaction.customId.startsWith("connect_decline:")
    ) {
        const [action, requesterId] = interaction.customId.split(":");
        const accept = action === "connect_accept";

        const conn = getConnection.get(requesterId, userId);
        if (!conn) {
            return interaction.reply({
                embeds: [errorEmbed("This connection request no longer exists.")],
                ephemeral: true
            });
        }

        setStatus.run(accept ? "accepted" : "declined", requesterId, userId);

        if (accept) {
            try {
                const requester = await interaction.client.users.fetch(requesterId);
                await requester.send({
                    embeds: [
                        successEmbed(
                            `**${interaction.user.username}** accepted your connection request! 🤝`,
                            "🤝 Connection Accepted"
                        )
                    ]
                });
            } catch {
                /* DM closed */
            }
        }

        return interaction.update({
            embeds: [
                accept
                    ? successEmbed("Connection accepted! 🤝", "🤝 Connected")
                    : baseEmbed({ title: "✖️ Request Declined", description: "Request declined." })
            ],
            components: []
        });
    }

    // Open the extras modal.
    if (interaction.customId === IDS.EXTRAS_BTN) {
        const profile = getProfile.get(userId);
        if (!profile) {
            return interaction.reply({
                embeds: [errorEmbed("You don't have a profile yet.")],
                ephemeral: true
            });
        }
        return interaction.showModal(buildExtrasModal(profile));
    }

    // Browse navigation.
    if (
        interaction.customId === IDS.BROWSE_PREV ||
        interaction.customId === IDS.BROWSE_NEXT
    ) {
        const delta = interaction.customId === IDS.BROWSE_NEXT ? 1 : -1;
        const state = session.move(userId, delta);

        if (!state) {
            return interaction.update({
                embeds: [
                    errorEmbed(
                        "This browse session has expired. Run the browse command again."
                    )
                ],
                components: []
            });
        }

        // Enforce the viewer's daily view quota (free tier).
        const quota = recordView(userId, state.profile.user_id);
        if (!quota.allowed) {
            return interaction.update({
                embeds: [viewLimitEmbed(quota)],
                components: []
            });
        }

        return interaction.update({
            embeds: [
                profileEmbed(state.profile, {
                    headerNote: `Profile ${state.index + 1} of ${state.total}`
                })
            ],
            components: [buildBrowseRow({ total: state.total })]
        });
    }

    // Like the currently displayed profile.
    if (interaction.customId === IDS.BROWSE_LIKE) {
        const state = session.current(userId);
        if (!state) {
            return interaction.reply({
                embeds: [
                    errorEmbed(
                        "This browse session has expired. Run the browse command again."
                    )
                ],
                ephemeral: true
            });
        }

        const target = state.profile;
        const result = like(userId, target.user_id);

        if (!result.ok) {
            return interaction.reply({
                embeds: [errorEmbed(result.reason)],
                ephemeral: true
            });
        }

        if (result.matched) {
            referrals.handleActivation(userId, interaction.client);
            referrals.handleActivation(target.user_id, interaction.client);
            const me = getProfile.get(userId);
            return interaction.reply({
                embeds: [matchCardEmbed({ nameA: me ? me.name : "You", nameB: target.name })],
                components: [sayHiRow(target.user_id, { withProfile: true })],
                ephemeral: true
            });
        }

        return interaction.reply({
            embeds: [
                successEmbed(`You liked **${target.name}**.`, "❤️ Like Sent")
            ],
            ephemeral: true
        });
    }
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
async function safeError(interaction, message) {
    try {
        const payload = { embeds: [errorEmbed(message)], ephemeral: true };
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(payload);
        } else if (interaction.isRepliable()) {
            await interaction.reply(payload);
        }
    } catch (err) {
        logger.error("Failed to send error reply", err);
    }
}
