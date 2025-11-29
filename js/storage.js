/**
 * Storage Utility
 * Wrapper for localStorage
 */

const KEYS = {
    USERS: 'mahjong_users',
    SESSIONS: 'mahjong_sessions',
    SETTINGS: 'mahjong_settings'
};

window.AppStorage = {};

// --- Users ---

window.AppStorage.getUsers = function () {
    const data = localStorage.getItem(KEYS.USERS);
    return data ? JSON.parse(data) : [];
};

window.AppStorage.addUser = function (name) {
    const users = window.AppStorage.getUsers();
    if (users.includes(name)) {
        return false; // Duplicate
    }
    users.push(name);
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));
    return true;
};

window.AppStorage.removeUser = function (name) {
    let users = window.AppStorage.getUsers();
    users = users.filter(u => u !== name);
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));
};

// --- Sessions ---

window.AppStorage.getSessions = function () {
    const data = localStorage.getItem(KEYS.SESSIONS);
    return data ? JSON.parse(data) : [];
};

window.AppStorage.createSession = function (date, playerNames, rules = null) {
    const sessions = window.AppStorage.getSessions();
    // Use provided rules or fallback to current global settings
    const sessionRules = rules || window.AppStorage.getSettings();

    const newSession = {
        id: Date.now(),
        date: date, // YYYY-MM-DD
        players: playerNames, // Array of 4 names
        rules: sessionRules,
        games: []
    };
    sessions.unshift(newSession);
    localStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions));
    return newSession;
};

window.AppStorage.getSession = function (sessionId) {
    const sessions = window.AppStorage.getSessions();
    return sessions.find(s => s.id === Number(sessionId));
};

window.AppStorage.addGameToSession = function (sessionId, gameData) {
    const sessions = window.AppStorage.getSessions();
    const sessionIndex = sessions.findIndex(s => s.id === Number(sessionId));

    if (sessionIndex !== -1) {
        sessions[sessionIndex].games.push(gameData);
        localStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions));
        return true;
    }
    return false;
};

window.AppStorage.updateSession = function (sessionId, updates) {
    const sessions = window.AppStorage.getSessions();
    const sessionIndex = sessions.findIndex(s => s.id === Number(sessionId));

    if (sessionIndex !== -1) {
        sessions[sessionIndex] = { ...sessions[sessionIndex], ...updates };
        localStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions));
        return true;
    }
    return false;
};

window.AppStorage.removeSession = function (sessionId) {
    let sessions = window.AppStorage.getSessions();
    sessions = sessions.filter(s => s.id !== Number(sessionId));
    localStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions));
};

window.AppStorage.removeGameFromSession = function (sessionId, gameId) {
    const sessions = window.AppStorage.getSessions();
    const sessionIndex = sessions.findIndex(s => s.id === Number(sessionId));

    if (sessionIndex !== -1) {
        sessions[sessionIndex].games = sessions[sessionIndex].games.filter(g => g.id !== Number(gameId));
        localStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions));
        return true;
    }
    return false;
};

window.AppStorage.clearAllData = function () {
    localStorage.removeItem(KEYS.USERS);
    localStorage.removeItem(KEYS.SESSIONS);
    localStorage.removeItem(KEYS.SETTINGS);
};

// --- Settings ---

const DEFAULT_SETTINGS = {
    startScore: 25000,
    returnScore: 30000,
    uma: [30, 10, -10, -30],
    tieBreaker: 'priority' // 'priority' or 'split'
};

window.AppStorage.getSettings = function () {
    const data = localStorage.getItem(KEYS.SETTINGS);
    return data ? JSON.parse(data) : DEFAULT_SETTINGS;
};

window.AppStorage.saveSettings = function (settings) {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
};
