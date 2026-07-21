/* =====================================================================
   ORBIT DASHBOARD - theme + config + copy, all in one place.
   Colors also live in css/dash.css (:root). The few hexes here are for
   things JS draws (progress rings). Edit copy freely.
   Rules: no em dashes. Short, plain sentences.
   ===================================================================== */
window.THEME = {
  appName: "Orbit",
  logo: "/logo.png",

  // links used by deep-link buttons (wire to your real ones later)
  links: {
    community: "https://discord.gg/MBnqeusz92",
    topgg: "https://top.gg/bot/YOUR_BOT_ID/vote"
  },

  // the weekly match drop, local time (0 = Sunday ... 1 = Monday)
  drop: { day: 1, hour: 20, label: "Monday 8pm" },

  // hexes JS needs (rings/sparklines). Everything else is CSS.
  ink: { coral: "#F4502A", gold: "#F5B93F", track: "#2C2420" },

  nav: [
    { id: "overview", label: "Overview" },
    { id: "matches", label: "Matches" },
    { id: "referrals", label: "Referrals" },
    { id: "perks", label: "Perks" },
    { id: "profile", label: "Profile" },
    { id: "settings", label: "Settings" }
  ],

  copy: {
    overview: { title: "Overview", context: "Everything at a glance." },
    matches: { title: "Matches", context: "Your current match and history." },
    referrals: { title: "Referrals", context: "Invite friends, earn rewards." },
    perks: { title: "Perks", context: "What votes and referrals unlock." },
    profile: { title: "Profile", context: "This is what others see when you match." },
    settings: { title: "Settings", context: "Notifications, privacy, and your data." },

    dropTitle: "Next match drop",
    voteCta: "Vote on top.gg",
    sayHi: "Say hi on Discord",
    copyCode: "Copy code",
    copied: "Copied",
    saveProfile: "Save profile",
    saved: "Saved",

    empty: {
      match: "No match yet. Your next one arrives with the weekly drop.",
      history: "No past matches yet. Say hi to your first one.",
      pending: "No pending invites. Share your code to get started.",
      activity: "Nothing here yet. Your activity will show up as it happens."
    },

    referralNote: "A referral counts when your friend completes a profile and gets matched.",
    dataDelete: "Request data deletion. This removes your profile and history. It cannot be undone."
  }
};
