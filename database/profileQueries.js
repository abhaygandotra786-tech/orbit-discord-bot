/**
 * Community Hub - Profile prepared statements
 * All profile reads/writes go through these prepared statements.
 */

const db = require("./database");

// --- Writes -------------------------------------------------------

const createProfile = db.namedRun(
    `INSERT INTO profiles (
        user_id, name, age, gender, interested_in, location,
        bio, skills, profession, linkedin, github, portfolio,
        interests, category
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
        "user_id", "name", "age", "gender", "interested_in", "location",
        "bio", "skills", "profession", "linkedin", "github", "portfolio",
        "interests", "category"
    ]
);

const updateProfile = db.namedRun(
    `UPDATE profiles SET
        name = ?, age = ?, location = ?, bio = ?, skills = ?,
        profession = ?, linkedin = ?, github = ?, portfolio = ?,
        interests = ?, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`,
    [
        "name", "age", "location", "bio", "skills", "profession",
        "linkedin", "github", "portfolio", "interests", "user_id"
    ]
);

const setCategory = db.namedRun(
    `UPDATE profiles SET category = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
    ["category", "user_id"]
);

const setGender = db.namedRun(
    `UPDATE profiles SET gender = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
    ["gender", "user_id"]
);

const setInterestedIn = db.namedRun(
    `UPDATE profiles SET interested_in = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
    ["interested_in", "user_id"]
);

const setTheme = db.namedRun(
    `UPDATE profiles SET theme = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
    ["theme", "user_id"]
);

const setFeatured = db.namedRun(
    `UPDATE profiles SET featured = ?, featured_until = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
    ["featured", "featured_until", "user_id"]
);

const setInvestorRole = db.namedRun(
    `UPDATE profiles SET investor_role = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
    ["investor_role", "user_id"]
);

const setPortfolioProjects = db.namedRun(
    `UPDATE profiles SET portfolio_projects = ?, portfolio = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
    ["portfolio_projects", "portfolio", "user_id"]
);

const incrementSearchAppearance = db.prepare(`
UPDATE profiles SET search_appearances = COALESCE(search_appearances, 0) + 1
WHERE user_id = ?
`);

const getInvestors = db.prepare(`
SELECT * FROM profiles WHERE investor_role IS NOT NULL ORDER BY created_at DESC
`);

const deleteProfile = db.prepare(`
DELETE FROM profiles WHERE user_id = ?
`);

// --- Reads --------------------------------------------------------

const getProfile = db.prepare(`SELECT * FROM profiles WHERE user_id = ?`);

const getAllProfiles = db.prepare(`
SELECT * FROM profiles ORDER BY created_at DESC
`);

const getProfilesByCategory = db.prepare(`
SELECT * FROM profiles WHERE category = ? ORDER BY created_at DESC
`);

const countProfiles = db.prepare(`SELECT COUNT(*) AS count FROM profiles`);

// --- Search -------------------------------------------------------

const searchByLocation = db.prepare(`
SELECT * FROM profiles WHERE location LIKE ? ORDER BY created_at DESC LIMIT ?
`);

const searchByProfession = db.prepare(`
SELECT * FROM profiles WHERE profession LIKE ? ORDER BY created_at DESC LIMIT ?
`);

const searchBySkills = db.prepare(`
SELECT * FROM profiles WHERE skills LIKE ? ORDER BY created_at DESC LIMIT ?
`);

const searchByCategory = db.prepare(`
SELECT * FROM profiles WHERE category LIKE ? ORDER BY created_at DESC LIMIT ?
`);

const searchByGender = db.prepare(`
SELECT * FROM profiles WHERE gender LIKE ? ORDER BY created_at DESC LIMIT ?
`);

const searchByInterests = db.prepare(`
SELECT * FROM profiles WHERE interests LIKE ? ORDER BY created_at DESC LIMIT ?
`);

module.exports = {
    createProfile,
    updateProfile,
    setCategory,
    setGender,
    setInterestedIn,
    setTheme,
    setFeatured,
    setInvestorRole,
    setPortfolioProjects,
    incrementSearchAppearance,
    getInvestors,
    deleteProfile,
    getProfile,
    getAllProfiles,
    getProfilesByCategory,
    countProfiles,
    searchByLocation,
    searchByProfession,
    searchBySkills,
    searchByCategory,
    searchByGender,
    searchByInterests
};
