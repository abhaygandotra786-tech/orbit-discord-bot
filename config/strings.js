/**
 * Orbit - all user-facing copy in one place.
 * Edit wording here without touching logic.
 * Rules: no em dashes, short sentences, warm and plain.
 */
module.exports = {
    brand: {
        footer: "orbit-discord-bot.onrender.com",
        nextDrop: "Next drop: Monday 8pm"
    },

    welcome: {
        title: "Welcome to Orbit",
        body:
            "Orbit matches you with people in this server every week.\n\n" +
            "Create a profile and you are in the next drop.",
        createButton: "Create profile",
        helpButton: "See commands"
    },

    match: {
        title: "Your match is here",
        // shown when we do not have a specific reason
        reasonFallback: "You have a lot in common.",
        icebreakers: [
            "What are you working on right now?",
            "Coffee, or late night coding?",
            "What brought you to this server?",
            "What could you talk about for hours?",
            "What is a small win you had this week?"
        ],
        sayHi: "Say hi",
        viewProfile: "View profile"
    },

    drop: {
        title: "Match day",
        body:
            "This week's matches are dropping soon.\n\n" +
            "Opt in to be included.",
        optIn: "Opt in"
    },

    vote: {
        title: "Thanks for voting",
        cta: "Vote on top.gg",
        // footer built dynamically with the next-vote time
        ready: "Your Orbit vote is ready. Run /vote to keep your streak alive."
    },

    referrals: {
        title: "Your referrals",
        activationNote:
            "A referral counts when your friend completes a profile and gets their first match."
    },

    errors: {
        generic: "That did not go through. Please try again in a moment.",
        noProfile: "You do not have a profile yet. Run /profile create to start.",
        alreadyProfile: "You already have a profile. Use /profile edit to update it.",
        banned: "You cannot use Orbit right now. Contact the server admins if this is a mistake.",
        adminOnly: "This command is for admins only.",
        expired: "This session expired. Run the command again."
    },

    confirm: {
        default: "Done."
    }
};
