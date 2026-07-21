/* =====================================================================
   ORBIT DASHBOARD - data layer.
   Every page reads data through these functions. They return MOCK data
   today. To go live, replace each body with a fetch() to the endpoint
   noted above it. Shapes must match.

   BACKEND ENDPOINTS TO EXPOSE (all require the logged-in session):
     GET  /api/me              -> Me
     GET  /api/me/overview     -> Overview
     GET  /api/me/matches      -> Matches
     GET  /api/me/referrals    -> Referrals
     GET  /api/me/perks        -> Perks
     GET  /api/me/profile      -> Profile
     PUT  /api/me/profile      body: Profile -> { ok:true }
     GET  /api/me/settings     -> Settings
     PUT  /api/me/settings     body: Settings -> { ok:true }
     POST /api/me/delete       -> { ok:true }   (data deletion request)

   TYPES:
     Me        { id, username, avatarUrl, joinedAt }
     Tier      { key:"free"|"pro"|"premium", name, expiresAt:ms|null,
                 grantedAt:ms|null }              // null expiresAt = free
     Overview  { tier:Tier, credits:number,
                 voteStreak:{ current, best, total, nextVoteAt:ms|null },
                 referrals:{ activated, pending, next:number|null },
                 nextDrop:ms,
                 activity:[{ type:"matched"|"vote"|"referral", text, at:ms }] }
     Matches   { current: MatchCard|null, history:[HistoryItem] }
     MatchCard { a:Person, b:Person, reason, icebreaker, discordUrl }
     Person    { name, initial, color }
     HistoryItem { name, initial, color, at:ms, status:"talked"|"expired"|"new" }
     Referrals { code, activated, pending:[{ name, initial, color, at:ms }],
                 nextTier:number|null, ladder:[{ count, reward }] }
     Perks     { votes:[{ label, unlocked }], referrals:[{ label, unlocked }],
                 next:{ track:"vote"|"referral", need:number, reward } }
     Profile   { name, age, location, category, profession, bio, skills,
                 interests, links:{ linkedin, github, portfolio } }
     Settings  { voteReminder:bool, dropReminder:bool, showProfile:bool }
   ===================================================================== */
(function () {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const DAY = 86400000;
  const now = Date.now();

  // next drop = next Monday 8pm local
  function nextDrop() {
    const t = window.THEME.drop;
    const d = new Date();
    d.setHours(t.hour, 0, 0, 0);
    let add = (t.day - d.getDay() + 7) % 7;
    if (add === 0 && Date.now() > d.getTime()) add = 7;
    d.setDate(d.getDate() + add);
    return d.getTime();
  }

  const MOCK = {
    me: { id: "1024", username: "aarav", avatarUrl: "", joinedAt: now - 40 * DAY },
    overview: {
      tier: { key: "pro", name: "Pro", expiresAt: now + 6 * DAY, grantedAt: now - 24 * DAY },
      credits: 4,
      voteStreak: { current: 3, best: 7, total: 21, nextVoteAt: now + 3 * 3600000 },
      referrals: { activated: 2, pending: 1, next: 3 },
      nextDrop: nextDrop(),
      activity: [
        { type: "matched", text: "You matched with Sara", at: now - 2 * 3600000 },
        { type: "vote", text: "Vote counted, streak now 3 days", at: now - 9 * 3600000 },
        { type: "referral", text: "Kai activated your referral", at: now - 2 * DAY },
        { type: "matched", text: "You matched with Devon", at: now - 8 * DAY }
      ]
    },
    matches: {
      current: {
        a: { name: "Aarav", initial: "A", color: "#F4502A" },
        b: { name: "Sara", initial: "S", color: "#F5B93F" },
        reason: "You both love late night coding and lo-fi.",
        icebreaker: "What are you building right now?",
        discordUrl: "https://discord.com/channels/@me"
      },
      history: [
        { name: "Devon", initial: "D", color: "#7f9cff", at: now - 8 * DAY, status: "talked" },
        { name: "Mira", initial: "M", color: "#9b8cf0", at: now - 15 * DAY, status: "expired" }
      ]
    },
    referrals: {
      code: "MHCA25",
      activated: 2,
      pending: [{ name: "Kai", initial: "K", color: "#7f9cff", at: now - 3 * DAY }],
      nextTier: 3,
      ladder: [
        { count: 1, reward: "Match credits and Pro time" },
        { count: 3, reward: "1 month of Pro and Vouched badge" },
        { count: 5, reward: "Priority in the match queue" },
        { count: 10, reward: "1 month of Premium and custom accent" },
        { count: 25, reward: "Lifetime Pro and Hall of Fame" }
      ]
    },
    perks: {
      votes: [
        { label: "Bonus match and 24h Pro, every vote", unlocked: true },
        { label: "Rising Supporter role at a 3 day streak", unlocked: true },
        { label: "Early match drops at a 7 day streak", unlocked: false },
        { label: "OG Supporter badge at 30 votes", unlocked: false }
      ],
      referrals: [
        { label: "Pro time at 1 referral", unlocked: true },
        { label: "Vouched badge at 3 referrals", unlocked: false },
        { label: "Priority queue at 5 referrals", unlocked: false },
        { label: "Premium at 10 referrals", unlocked: false }
      ],
      next: { track: "vote", need: 1, reward: "early match drops" }
    },
    profile: {
      name: "Aarav", age: 24, location: "Bangalore", category: "Networking",
      profession: "Founder", bio: "Building a small dev tools startup. Always up for a chat.",
      skills: "JavaScript, product, design", interests: "startups, lo-fi, chai",
      links: { linkedin: "", github: "github.com/aarav", portfolio: "" }
    },
    settings: { voteReminder: true, dropReminder: true, showProfile: true }
  };

  // ---- public data layer (swap bodies for fetch() when wiring) ----
  const api = {
    async getMe()        { await wait(250); return clone(MOCK.me); },
    async getOverview()  { await wait(400); return clone(MOCK.overview); },
    async getMatches()   { await wait(400); return clone(MOCK.matches); },
    async getReferrals() { await wait(400); return clone(MOCK.referrals); },
    async getPerks()     { await wait(350); return clone(MOCK.perks); },
    async getProfile()   { await wait(350); return clone(MOCK.profile); },
    async saveProfile(d) { await wait(300); MOCK.profile = { ...MOCK.profile, ...d }; return { ok: true }; },
    async getSettings()  { await wait(300); return clone(MOCK.settings); },
    async saveSettings(d){ await wait(200); MOCK.settings = { ...MOCK.settings, ...d }; return { ok: true }; },
    async requestDelete(){ await wait(400); return { ok: true }; }
  };
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  window.api = api;
})();
