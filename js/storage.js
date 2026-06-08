// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCk-FlI_dTmLfRb5d4WhbdP6SJ9s_6QyIw",
    authDomain: "jong-log.firebaseapp.com",
    projectId: "jong-log",
    messagingSenderId: "615006808230",
    appId: "1:615006808230:web:403e216552a3347ee4ec67",
    measurementId: "G-8X6V557373"
};

// Initialize Firebase (Compat)
let db;
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();

} catch (e) {
    console.error("Firebase Init Error:", e);
    // Alert removed to prevent blocking UI on local/offline usage
    // alert("データベース接続に失敗しました。インターネット接続を確認してください。");
}

window.AppStorage = {};

// --- Users ---

window.AppStorage.getUsers = async function () {
    try {
        const snapshot = await db.collection("users").orderBy("name").get();
        const users = [];
        snapshot.forEach((doc) => {
            users.push(doc.data().name);
        });
        return users;
    } catch (e) {
        console.error("getUsers failed:", e);
        return [];
    }
};

window.AppStorage.getUsersWithDetails = async function () {
    try {
        const snapshot = await db.collection("users").orderBy("name").get();
        const users = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            users.push({
                name: data.name,
                title: data.title || ""
            });
        });
        return users;
    } catch (e) {
        console.error("getUsersWithDetails failed:", e);
        return [];
    }
};

window.AppStorage.updateUserTitle = async function (name, title) {
    try {
        await db.collection("users").doc(name).update({ title: title });
        return true;
    } catch (e) {
        // If document doesn't exist or other error, try set with merge
        console.log("Update failed, trying set with merge...", e);
        try {
            await db.collection("users").doc(name).set({ title: title }, { merge: true });
            return true;
        } catch (e2) {
            console.error("updateUserTitle failed:", e2);
            return false;
        }
    }
};

window.AppStorage.getUserAvatar = async function (name) {
    try {
        const doc = await db.collection("users").doc(name).get();
        if (!doc.exists) return null;
        return doc.data().avatarBase64 || null;
    } catch (e) {
        console.error("getUserAvatar failed:", e);
        return null;
    }
};

window.AppStorage.updateUserAvatar = async function (name, avatarBase64) {
    const value = avatarBase64 == null
        ? firebase.firestore.FieldValue.delete()
        : avatarBase64;
    try {
        await db.collection("users").doc(name).set({ avatarBase64: value }, { merge: true });
        return true;
    } catch (e) {
        console.error("updateUserAvatar failed:", e);
        return false;
    }
};

// 表示する称号（推し称号）。配列を返す。未設定なら null（=従来の自動表示にフォールバック）
window.AppStorage.getPinnedTitles = async function (name) {
    try {
        const doc = await db.collection("users").doc(name).get();
        if (!doc.exists) return null;
        const v = doc.data().pinnedTitles;
        return Array.isArray(v) ? v : null;
    } catch (e) {
        console.error("getPinnedTitles failed:", e);
        return null;
    }
};

window.AppStorage.updatePinnedTitles = async function (name, ids) {
    const value = Array.isArray(ids) ? ids.slice(0, 3) : [];
    try {
        await db.collection("users").doc(name).set({ pinnedTitles: value }, { merge: true });
        return true;
    } catch (e) {
        console.error("updatePinnedTitles failed:", e);
        return false;
    }
};

window.AppStorage.getUnlinkedUsers = async function () {
    try {
        const snapshot = await db.collection("users").get();
        const users = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            // Check if user is NOT linked (no uid or empty uid)
            if (!data.uid) {
                users.push(doc.id);
            }
        });
        return users;
    } catch (e) {
        console.error("Error getting unlinked users: ", e);
        return [];
    }
};

// アカウント（uid あり）として登録された正式ユーザーのみを返す。
// セット作成時に手入力された「ゲスト」（uid なし）は除外する。
window.AppStorage.getAccountUsers = async function () {
    try {
        const snapshot = await db.collection("users").get();
        const users = [];
        snapshot.forEach((doc) => {
            // uid を持つドキュメント = サインアップ→紐付け済みの正式ユーザー
            if (doc.data().uid) users.push(doc.id);
        });
        users.sort((a, b) => a.localeCompare(b, 'ja'));
        return users;
    } catch (e) {
        console.error("getAccountUsers failed:", e);
        return [];
    }
};

// 指定名が正式なアカウントユーザー（uid あり）かどうか。ゲストや未登録名は false。
window.AppStorage.isAccountUser = async function (name) {
    if (!name) return false;
    try {
        const doc = await db.collection("users").doc(name).get();
        return !!(doc.exists && doc.data().uid);
    } catch (e) {
        console.error("isAccountUser failed:", e);
        return false;
    }
};

window.AppStorage.addUser = async function (name) {
    try {
        const userRef = db.collection("users").doc(name);
        const userDoc = await userRef.get();

        if (userDoc.exists) {
            return false; // Duplicate
        }

        await userRef.set({ name: name, createdAt: new Date() });
        return true;
    } catch (e) {
        console.error("addUser failed:", e);
        return false;
    }
};

window.AppStorage.removeUser = async function (name) {
    await db.collection("users").doc(name).delete();
};

// --- Sessions ---

window.AppStorage.getSessions = async function () {
    try {
        const snapshot = await db.collection("sessions").orderBy("id", "desc").get();
        const sessions = [];
        snapshot.forEach((doc) => {
            sessions.push(doc.data());
        });
        return sessions;
    } catch (e) {
        console.error("getSessions failed:", e);
        return [];
    }
};

window.AppStorage.createSession = async function (date, playerNames, rules = null) {
    if (!rules) {
        rules = await window.AppStorage.getSettings();
    }

    const sessionId = Date.now();
    const newSession = {
        id: sessionId,
        date: date,
        players: playerNames,
        rules: rules,
        games: [],
        locked: false // Default to unlocked
    };

    await db.collection("sessions").doc(String(sessionId)).set(newSession);
    return newSession;
};

window.AppStorage.getSession = async function (sessionId) {
    const doc = await db.collection("sessions").doc(String(sessionId)).get();
    if (doc.exists) {
        return doc.data();
    }
    return null;
};

window.AppStorage.addGameToSession = async function (sessionId, gameData) {
    const sessionRef = db.collection("sessions").doc(String(sessionId));

    // Firestore transaction or simple update? ArrayUnion is cleaner but gameData is complex object.
    // For simplicity with compat:
    try {
        // Use arrayUnion if possible, but we need to ensure unique objects? 
        // Just reading and updating array is fine for now (less atomic but simple).
        // Actually, Compat supports arrayUnion: firebase.firestore.FieldValue.arrayUnion(gameData)
        await sessionRef.update({
            games: firebase.firestore.FieldValue.arrayUnion(gameData)
        });

        // 関連プレイヤーの最高記録を更新
        if (gameData.players && Array.isArray(gameData.players)) {
            const playerNames = gameData.players.map(p => p.name);
            for (const playerName of playerNames) {
                await window.AppStorage.updateUserTitleRecords(playerName);
            }
        }

        return true;
    } catch (e) {
        console.error("addGameToSession failed:", e);
        return false;
    }
};

window.AppStorage.updateGameInSession = async function (sessionId, gameId, updatedGameData) {
    const sessionRef = db.collection("sessions").doc(String(sessionId));

    // We must read, find, update array, write back. 
    // Firestore doesn't easily support updating one item in array by ID without reading.
    const doc = await sessionRef.get();
    if (doc.exists) {
        const session = doc.data();
        const games = session.games || [];
        const index = games.findIndex(g => g.id === Number(gameId));
        if (index !== -1) {
            // 編集前のプレイヤー名を記録
            const oldPlayers = games[index].players ? games[index].players.map(p => p.name) : [];

            games[index] = updatedGameData;
            await sessionRef.update({ games: games });

            // 編集前と編集後のプレイヤーをマージして最高記録を更新
            const newPlayers = updatedGameData.players ? updatedGameData.players.map(p => p.name) : [];
            const allPlayers = [...new Set([...oldPlayers, ...newPlayers])];

            for (const playerName of allPlayers) {
                await window.AppStorage.updateUserTitleRecords(playerName);
            }

            return true;
        }
    }
    return false;
};

window.AppStorage.updateSession = async function (sessionId, updates) {
    await db.collection("sessions").doc(String(sessionId)).update(updates);
    return true;
};

window.AppStorage.removeSession = async function (sessionId) {
    // Check lock status before deleting
    const doc = await db.collection("sessions").doc(String(sessionId)).get();
    if (doc.exists && doc.data().locked) {
        console.warn("Attempted to delete a locked session.");
        return false;
    }

    // 削除前にセッションに含まれる全プレイヤーを記録
    const playersToUpdate = new Set();
    if (doc.exists) {
        const session = doc.data();
        if (session.games && Array.isArray(session.games)) {
            session.games.forEach(game => {
                if (game.players && Array.isArray(game.players)) {
                    game.players.forEach(p => {
                        if (p.name) playersToUpdate.add(p.name);
                    });
                }
            });
        }
    }

    await db.collection("sessions").doc(String(sessionId)).delete();

    // 削除したセッションに関連するプレイヤーの最高記録を再計算
    for (const playerName of playersToUpdate) {
        await window.AppStorage.updateUserTitleRecords(playerName);
    }

    return true;
};

window.AppStorage.removeGameFromSession = async function (sessionId, gameId) {
    const sessionRef = db.collection("sessions").doc(String(sessionId));
    const doc = await sessionRef.get();
    if (doc.exists) {
        const session = doc.data();
        const games = session.games || [];

        // 削除前のプレイヤー名を記録
        const gameToRemove = games.find(g => g.id === Number(gameId));
        const playersToUpdate = gameToRemove && gameToRemove.players ? gameToRemove.players.map(p => p.name) : [];

        const newGames = games.filter(g => g.id !== Number(gameId));
        await sessionRef.update({ games: newGames });

        // 削除したゲームに関連するプレイヤーの最高記録を再計算
        for (const playerName of playersToUpdate) {
            await window.AppStorage.updateUserTitleRecords(playerName);
        }

        return true;
    }
    return false;
};

// --- Title Records ---

/**
 * ユーザーの最高記録を取得
 * @param {string} userName - ユーザー名
 * @returns {Object|null} 最高記録オブジェクト、または存在しない場合はnull
 */
window.AppStorage.getUserTitleRecords = async function (userName) {
    try {
        const userDoc = await db.collection("users").doc(userName).get();
        if (userDoc.exists) {
            const data = userDoc.data();
            return data.titleRecords || null;
        }
        return null;
    } catch (e) {
        console.error("getUserTitleRecords failed:", e);
        return null;
    }
};

/**
 * ユーザーの最高記録を更新
 * 全セッションから統計を再計算し、最高記録を更新
 * @param {string} userName - ユーザー名
 * @returns {boolean} 成功したかどうか
 */
window.AppStorage.updateUserTitleRecords = async function (userName) {
    try {
        // 全セッションを取得
        const sessions = await window.AppStorage.getSessions();

        // ユーザーの全ゲームを集計
        const userGames = [];
        sessions.forEach(s => {
            s.games.forEach(g => {
                const p = g.players.find(x => x.name === userName);
                if (p) {
                    userGames.push({
                        rank: p.rank,
                        score: p.score,
                        finalScore: p.finalScore,
                        date: s.date,
                        yakuman: p.yakuman || []
                    });
                }
            });
        });

        // データがない場合は空の記録を保存
        if (userGames.length === 0) {
            const emptyRecords = {
                maxCumulativeScore: 0,
                minAverageRank: 0,
                maxConsecutiveTop: 0,
                maxConsecutiveRentai: 0,
                maxConsecutiveAvoidLast: 0,
                maxHighScore: 0,
                maxGameCount: 0,
                yakumanCount: 0,
                hasTenhou: false,
                hasChiihou: false,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            };
            await db.collection("users").doc(userName).set({ titleRecords: emptyRecords }, { merge: true });
            return true;
        }

        // 日付順にソート
        userGames.sort((a, b) => new Date(a.date) - new Date(b.date));

        // 統計を計算
        let currentTop = 0, maxTop = 0;
        let currentRen = 0, maxRen = 0;
        let currentAvoid = 0, maxAvoid = 0;
        let currentLast = 0, maxLast = 0;       // 連続ラス
        let currentInverse = 0, maxInverse = 0; // 連続逆連対（3〜4着）
        let highScore = -Infinity;
        let totalScore = 0;
        let minCumulativeScore = Infinity;       // 最も悪い累計スコア
        let totalRank = 0;
        let yakumanCount = 0;
        let hasTenhou = false;
        let hasChiihou = false;
        let maxCumulativeScore = -Infinity;

        userGames.forEach(g => {
            // 連続トップ
            if (g.rank === 1) currentTop++; else currentTop = 0;
            if (currentTop > maxTop) maxTop = currentTop;

            // 連続連対
            if (g.rank <= 2) currentRen++; else currentRen = 0;
            if (currentRen > maxRen) maxRen = currentRen;

            // 連続ラス回避
            if (g.rank < 4) currentAvoid++; else currentAvoid = 0;
            if (currentAvoid > maxAvoid) maxAvoid = currentAvoid;

            // 連続ラス
            if (g.rank === 4) currentLast++; else currentLast = 0;
            if (currentLast > maxLast) maxLast = currentLast;

            // 連続逆連対（3〜4着）
            if (g.rank >= 3) currentInverse++; else currentInverse = 0;
            if (currentInverse > maxInverse) maxInverse = currentInverse;

            // ハイスコア
            if (g.score > highScore) highScore = g.score;

            // 累積スコア
            totalScore += (g.finalScore || 0);
            if (totalScore > maxCumulativeScore) maxCumulativeScore = totalScore;
            if (totalScore < minCumulativeScore) minCumulativeScore = totalScore;

            // 平均順位用
            totalRank += g.rank;

            // 役満集計
            if (g.yakuman && Array.isArray(g.yakuman)) {
                yakumanCount += g.yakuman.length;
                g.yakuman.forEach(y => {
                    if (y.type === '天和') hasTenhou = true;
                    if (y.type === '地和') hasChiihou = true;
                });
            }
        });

        const gameCount = userGames.length;
        const avgRank = gameCount > 0 ? parseFloat((totalRank / gameCount).toFixed(2)) : 0;

        // 平均順位は30戦以上で記録
        const minAverageRank = gameCount >= 30 ? avgRank : Infinity;

        // 最高記録をFirestoreに保存
        const titleRecords = {
            maxCumulativeScore: parseFloat(maxCumulativeScore.toFixed(1)),
            worstCumulativeScore: minCumulativeScore === Infinity ? 0 : parseFloat(minCumulativeScore.toFixed(1)),
            minAverageRank: minAverageRank === Infinity ? 0 : minAverageRank,
            maxConsecutiveTop: maxTop,
            maxConsecutiveRentai: maxRen,
            maxConsecutiveAvoidLast: maxAvoid,
            maxConsecutiveLast: maxLast,
            maxConsecutiveInverse: maxInverse,
            maxHighScore: highScore === -Infinity ? 0 : highScore,
            maxGameCount: gameCount,
            yakumanCount: yakumanCount,
            hasTenhou: hasTenhou,
            hasChiihou: hasChiihou,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection("users").doc(userName).set({ titleRecords: titleRecords }, { merge: true });
        return true;
    } catch (e) {
        console.error("updateUserTitleRecords failed:", e);
        return false;
    }
};

// --- Leagues ---

window.AppStorage.getLeagues = async function () {
    try {
        const snapshot = await db.collection("leagues").orderBy("createdAt", "desc").get();
        const leagues = [];
        snapshot.forEach((doc) => {
            leagues.push(doc.data());
        });
        return leagues;
    } catch (e) {
        console.error("getLeagues failed:", e);
        return [];
    }
};

window.AppStorage.addLeague = async function (leagueData) {
    try {
        const id = leagueData.id || String(Date.now());
        const newLeague = {
            ...leagueData,
            id: id,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        await db.collection("leagues").doc(id).set(newLeague);
        return newLeague;
    } catch (e) {
        console.error("addLeague failed:", e);
        return null;
    }
};

window.AppStorage.updateLeague = async function (leagueId, updates) {
    try {
        updates.updatedAt = new Date();
        await db.collection("leagues").doc(String(leagueId)).update(updates);
        return true;
    } catch (e) {
        console.error("updateLeague failed:", e);
        return false;
    }
};

window.AppStorage.removeLeague = async function (leagueId) {
    try {
        await db.collection("leagues").doc(String(leagueId)).delete();
        return true;
    } catch (e) {
        console.error("removeLeague failed:", e);
        return false;
    }
};

window.AppStorage.getLeague = async function (leagueId) {
    try {
        const doc = await db.collection("leagues").doc(String(leagueId)).get();
        if (doc.exists) {
            return doc.data();
        }
        return null;
    } catch (e) {
        console.error("getLeague failed:", e);
        return null;
    }
};

// --- Settings ---

const DEFAULT_SETTINGS = {
    startScore: 25000,
    returnScore: 30000,
    uma: [30, 10, -10, -30],
    tieBreaker: 'priority'
};

window.AppStorage.getSettings = async function () {
    try {
        const doc = await db.collection("settings").doc("global").get();
        if (doc.exists) {
            return doc.data();
        }
    } catch (e) {
        console.warn("getSettings failed, using default:", e);
    }
    return DEFAULT_SETTINGS;
};

window.AppStorage.saveSettings = async function (settings) {
    await db.collection("settings").doc("global").set(settings);
};

// --- Roulette Presets (Local Only) ---
// データモデル: roulettePresets = [{ id, name, mode, items: [{label, weight}] }]
// 旧形式 'rouletteItems'（文字列配列1個）は初回読込時に自動マイグレーションする。

const ROULETTE_PRESETS_KEY = 'roulettePresets';
const ROULETTE_LEGACY_KEY = 'rouletteItems';
const ROULETTE_LAST_KEY = 'roulettePresetLast';

function _rouletteGenId() {
    return 'rl_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// 任意の項目配列（文字列 or オブジェクト混在）を {label, weight} に正規化
function _normalizeRouletteItems(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.map((it) => {
        if (it && typeof it === 'object') {
            return { label: String(it.label ?? ''), weight: Math.max(1, parseInt(it.weight, 10) || 1) };
        }
        return { label: String(it), weight: 1 };
    }).filter((it) => it.label !== '');
}

window.AppStorage.getRoulettePresets = async function () {
    const saved = localStorage.getItem(ROULETTE_PRESETS_KEY);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length) {
                // 各プリセットの items を正規化して返す
                return parsed.map((p) => ({
                    id: p.id || _rouletteGenId(),
                    name: p.name || 'ルーレット',
                    mode: p.mode || 'normal',
                    items: _normalizeRouletteItems(p.items)
                }));
            }
        } catch (e) {
            console.error('getRoulettePresets parse failed:', e);
        }
    }

    // --- 旧形式からのマイグレーション ---
    let items = [
        { label: '1', weight: 1 }, { label: '2', weight: 1 }, { label: '3', weight: 1 },
        { label: '4', weight: 1 }, { label: '5', weight: 1 }, { label: '6', weight: 1 },
        { label: '7', weight: 1 }
    ];
    const legacy = localStorage.getItem(ROULETTE_LEGACY_KEY);
    if (legacy) {
        try {
            const arr = JSON.parse(legacy);
            const normalized = _normalizeRouletteItems(arr);
            if (normalized.length) items = normalized;
        } catch (e) {
            console.error('legacy roulette migration failed:', e);
        }
    }

    const presets = [{ id: _rouletteGenId(), name: 'マイルーレット', mode: 'normal', items }];
    localStorage.setItem(ROULETTE_PRESETS_KEY, JSON.stringify(presets));
    return presets;
};

window.AppStorage.saveRoulettePresets = async function (presets) {
    localStorage.setItem(ROULETTE_PRESETS_KEY, JSON.stringify(presets));
};

window.AppStorage.getLastRoulettePresetId = function () {
    return localStorage.getItem(ROULETTE_LAST_KEY);
};

window.AppStorage.setLastRoulettePresetId = function (id) {
    localStorage.setItem(ROULETTE_LAST_KEY, id || '');
};

// --- Authentication ---

window.AppStorage.auth = {
    // Current valid Firebase User
    currentUser: null,

    init: function (onAuthStateChanged) {
        if (typeof firebase === 'undefined') {
            console.error("Firebase is not loaded.");
            // Determine behavior: Just do nothing? Or call cb with null?
            // Calling cb(null, null) keeps app in logged-out state.
            if (onAuthStateChanged) onAuthStateChanged(null, null);
            return;
        }
        firebase.auth().onAuthStateChanged(async (user) => {
            this.currentUser = user;
            let linkedUser = null;
            if (user) {
                linkedUser = await this.getLinkedUser(user.uid);
            }
            onAuthStateChanged(user, linkedUser);
        });
    },

    signIn: async function (email, password) {
        if (typeof firebase === 'undefined') return { success: false, error: "インターネット未接続のためログインできません。" };
        try {
            await firebase.auth().signInWithEmailAndPassword(email, password);
            return { success: true };
        } catch (e) {
            console.error("SignIn failed:", e);
            return { success: false, error: e.message };
        }
    },

    signInWithGoogle: async function () {
        if (typeof firebase === 'undefined') return { success: false, error: "インターネット未接続のためログインできません。" };
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            await firebase.auth().signInWithPopup(provider);
            return { success: true };
        } catch (e) {
            console.error("Google SignIn failed:", e);
            return { success: false, error: e.message };
        }
    },

    signUp: async function (email, password) {
        if (typeof firebase === 'undefined') return { success: false, error: "インターネット未接続のため作成できません。" };
        try {
            await firebase.auth().createUserWithEmailAndPassword(email, password);
            return { success: true };
        } catch (e) {
            console.error("SignUp failed:", e);
            return { success: false, error: e.message };
        }
    },

    signOut: async function () {
        if (typeof firebase === 'undefined') return { success: true }; // Already effectively out
        try {
            await firebase.auth().signOut();
            return { success: true };
        } catch (e) {
            console.error("SignOut failed:", e);
            return { success: false, error: e.message };
        }
    },

    resetPassword: async function (email) {
        if (typeof firebase === 'undefined') return { success: false, error: "インターネット未接続のため送信できません。" };
        try {
            await firebase.auth().sendPasswordResetEmail(email);
            return { success: true };
        } catch (e) {
            console.error("resetPassword failed:", e);
            return { success: false, error: e.message };
        }
    },

    getLinkedUser: async function (uid) {
        try {
            // Check if any user document has this uid
            const snapshot = await db.collection("users").where("uid", "==", uid).limit(1).get();
            if (!snapshot.empty) {
                return snapshot.docs[0].data();
            }
            return null;
        } catch (e) {
            console.error("getLinkedUser failed:", e);
            return null;
        }
    },

    linkUser: async function (uid, gameUserName) {
        try {
            // Check if this game user exists
            const userRef = db.collection("users").doc(gameUserName);
            const doc = await userRef.get();

            if (doc.exists) {
                // Update existing user with uid
                await userRef.update({ uid: uid });
            } else {
                // Create new user with uid
                await userRef.set({
                    name: gameUserName,
                    createdAt: new Date(),
                    uid: uid
                });
            }
            return true;
        } catch (e) {
            console.error("linkUser failed:", e);
            return false;
        }
    },

    updatePassword: async function (newPassword) {
        try {
            const user = firebase.auth().currentUser;
            if (user) {
                await user.updatePassword(newPassword);
                return { success: true };
            } else {
                return { success: false, error: "No user logged in" };
            }
        } catch (e) {
            console.error("Update password failed:", e);
            return { success: false, error: e.code, message: e.message };
        }
    },

    reauthenticate: async function (currentPassword) {
        try {
            const user = firebase.auth().currentUser;
            if (!user) {
                return { success: false, error: "No user logged in" };
            }
            if (!user.email) {
                return { success: false, error: "auth/no-email", message: "メールアドレスが登録されていません。" };
            }
            const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
            await user.reauthenticateWithCredential(credential);
            return { success: true };
        } catch (e) {
            console.error("Reauthenticate failed:", e);
            return { success: false, error: e.code, message: e.message };
        }
    },

    getProviderId: function () {
        const user = firebase.auth().currentUser;
        if (!user || !user.providerData || user.providerData.length === 0) return null;
        return user.providerData[0].providerId;
    }
};
// --- Delete League ---
window.AppStorage.deleteLeague = async function (leagueId) {
    try {
        // 1. Delete League Doc
        await db.collection("leagues").doc(leagueId).delete();

        // 2. Unlink Sessions
        const sessionsSnapshot = await db.collection("sessions").where("leagueId", "==", leagueId).get();
        const batch = db.batch();

        sessionsSnapshot.forEach((doc) => {
            const ref = db.collection("sessions").doc(doc.id);
            batch.update(ref, { leagueId: null }); // Or firebase.firestore.FieldValue.delete()
        });

        await batch.commit();
        return true;
    } catch (e) {
        console.error("deleteLeague failed:", e);
        return false;
    }
};

// --- 画像処理 (Base64方式) ---
// Firebase Storageは使用せず、FileReaderでBase64変換して保存する
window.AppStorage.uploadImage = async function (file, path, onProgress) {
    try {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            // プログレスバーをシミュレート（FileReaderにはprogress APIがあるが、UX向上のため疑似的に更新）
            let progress = 0;
            const progressInterval = setInterval(() => {
                progress += 20;
                if (progress > 100) progress = 100;
                if (onProgress) onProgress(progress);
                if (progress >= 100) clearInterval(progressInterval);
            }, 100);

            reader.onload = (e) => {
                clearInterval(progressInterval);
                if (onProgress) onProgress(100);
                resolve(e.target.result); // Base64文字列を返す
            };

            reader.onerror = (e) => {
                clearInterval(progressInterval);
                reject(new Error("画像のBase64変換に失敗しました"));
            };

            reader.readAsDataURL(file);
        });
    } catch (e) {
        console.error("uploadImage failed:", e);
        return null;
    }
};

// Base64方式では削除操作は不要（Firestoreのドキュメントごと削除されるため）
window.AppStorage.deleteImage = async function (pathOrUrl) {
    // Base64文字列またはnullの場合は何もしない
    if (!pathOrUrl || pathOrUrl.startsWith('data:')) {
        return true;
    }
    // Firebase Storage URLが渡された場合も無視（現在はBase64方式のみ使用）
    console.log("deleteImage: Base64方式のため削除操作をスキップ", pathOrUrl);
    return true;
};

// --- マイメンバー ---

/**
 * 指定ユーザーのマイメンバーリストを取得する
 * @param {string} userName - 自分のユーザー名
 * @returns {string[]} マイメンバーのユーザー名配列
 */
window.AppStorage.getMyMembers = async function (userName) {
    if (!userName) return [];
    try {
        const doc = await db.collection("users").doc(userName).get();
        if (doc.exists) {
            return doc.data().myMembers || [];
        }
        return [];
    } catch (e) {
        console.error("getMyMembers failed:", e);
        return [];
    }
};

/**
 * マイメンバーにユーザーを追加する（重複は無視）
 * @param {string} userName - 自分のユーザー名
 * @param {string} targetName - 追加するユーザー名
 * @returns {boolean} 成功したかどうか
 */
window.AppStorage.addMyMember = async function (userName, targetName) {
    if (!userName || !targetName || userName === targetName) return false;
    try {
        await db.collection("users").doc(userName).set(
            { myMembers: firebase.firestore.FieldValue.arrayUnion(targetName) },
            { merge: true }
        );
        return true;
    } catch (e) {
        console.error("addMyMember failed:", e);
        return false;
    }
};

/**
 * マイメンバーからユーザーを解除する
 * @param {string} userName - 自分のユーザー名
 * @param {string} targetName - 解除するユーザー名
 * @returns {boolean} 成功したかどうか
 */
window.AppStorage.removeMyMember = async function (userName, targetName) {
    if (!userName || !targetName) return false;
    try {
        await db.collection("users").doc(userName).update({
            myMembers: firebase.firestore.FieldValue.arrayRemove(targetName)
        });
        return true;
    } catch (e) {
        console.error("removeMyMember failed:", e);
        return false;
    }
};

/**
 * セッション参加者を自動的にマイメンバーへ追加する
 * 自分以外の参加者全員をマイメンバーに追加する
 * @param {string} deviceUser - デバイスユーザー名（自分）
 * @param {string[]} playerNames - セッション参加者の名前配列
 */
window.AppStorage.autoAddMembersFromSession = async function (deviceUser, playerNames) {
    if (!deviceUser || !Array.isArray(playerNames)) return;
    const targets = playerNames.filter(name => name && name !== deviceUser);
    for (const target of targets) {
        await window.AppStorage.addMyMember(deviceUser, target);
    }
};

// --- フレンド ---
// データモデル: users/{name} に friends / friendRequestsIn / friendRequestsOut（いずれも string[]）を持つ。
// 不変条件: A.friends∋B ⟺ B.friends∋A、A.out∋B ⟺ B.in∋A。
// 整合維持のため双方向の更新は db.batch() + set(merge:true) で一括コミットする
// （Security Rules を入れない方針のため、片側だけ書けて壊れるのを最小化）。

/** Firestore の arrayUnion ショートハンド */
function _arrUnion(value) {
    return firebase.firestore.FieldValue.arrayUnion(value);
}
/** Firestore の arrayRemove ショートハンド */
function _arrRemove(value) {
    return firebase.firestore.FieldValue.arrayRemove(value);
}
/** users コレクションのドキュメント参照 */
function _userRef(name) {
    return db.collection("users").doc(name);
}

/**
 * 指定ユーザーのフレンド一覧を取得する
 * @param {string} userName
 * @returns {string[]}
 */
window.AppStorage.getFriends = async function (userName) {
    if (!userName) return [];
    try {
        const doc = await _userRef(userName).get();
        return doc.exists ? (doc.data().friends || []) : [];
    } catch (e) {
        console.error("getFriends failed:", e);
        return [];
    }
};

/**
 * 受信申請・送信申請を取得する
 * @param {string} userName
 * @returns {{in: string[], out: string[]}}
 */
window.AppStorage.getFriendRequests = async function (userName) {
    if (!userName) return { in: [], out: [] };
    try {
        const doc = await _userRef(userName).get();
        if (!doc.exists) return { in: [], out: [] };
        const data = doc.data();
        return { in: data.friendRequestsIn || [], out: data.friendRequestsOut || [] };
    } catch (e) {
        console.error("getFriendRequests failed:", e);
        return { in: [], out: [] };
    }
};

/**
 * 受信申請の件数（バッジ用の軽量版）
 * @param {string} userName
 * @returns {number}
 */
window.AppStorage.getIncomingRequestCount = async function (userName) {
    if (!userName) return 0;
    try {
        const doc = await _userRef(userName).get();
        if (!doc.exists) return 0;
        return (doc.data().friendRequestsIn || []).length;
    } catch (e) {
        console.error("getIncomingRequestCount failed:", e);
        return 0;
    }
};

/**
 * 2ユーザーを相互フレンドにし、双方の申請リストから掃除する（内部共通処理）
 * @param {string} a
 * @param {string} b
 */
async function _commitFriendship(a, b) {
    const batch = db.batch();
    batch.set(_userRef(a), {
        friends: _arrUnion(b),
        friendRequestsIn: _arrRemove(b),
        friendRequestsOut: _arrRemove(b)
    }, { merge: true });
    batch.set(_userRef(b), {
        friends: _arrUnion(a),
        friendRequestsIn: _arrRemove(a),
        friendRequestsOut: _arrRemove(a)
    }, { merge: true });
    await batch.commit();
}

/**
 * フレンド申請を送る。状況に応じて自動承認・重複検知を行う。
 * @param {string} me
 * @param {string} target
 * @returns {{status: 'sent'|'auto_accepted'|'already_sent'|'already_friend'|'error'}}
 */
window.AppStorage.sendFriendRequest = async function (me, target) {
    if (!me || !target || me === target) return { status: 'error' };
    try {
        const myDoc = await _userRef(me).get();
        const data = myDoc.exists ? myDoc.data() : {};
        const friends = data.friends || [];
        const reqIn = data.friendRequestsIn || [];
        const reqOut = data.friendRequestsOut || [];

        if (friends.includes(target)) return { status: 'already_friend' };
        // 相手が先に自分へ申請していた → 自動承認で即フレンド成立
        if (reqIn.includes(target)) {
            await _commitFriendship(me, target);
            return { status: 'auto_accepted' };
        }
        if (reqOut.includes(target)) return { status: 'already_sent' };

        const batch = db.batch();
        batch.set(_userRef(me), { friendRequestsOut: _arrUnion(target) }, { merge: true });
        batch.set(_userRef(target), { friendRequestsIn: _arrUnion(me) }, { merge: true });
        await batch.commit();
        return { status: 'sent' };
    } catch (e) {
        console.error("sendFriendRequest failed:", e);
        return { status: 'error' };
    }
};

/**
 * 受信した申請を承認する（双方を相互フレンドにする）
 * @param {string} me
 * @param {string} requester 申請者
 * @returns {boolean}
 */
window.AppStorage.acceptFriendRequest = async function (me, requester) {
    if (!me || !requester || me === requester) return false;
    try {
        await _commitFriendship(me, requester);
        return true;
    } catch (e) {
        console.error("acceptFriendRequest failed:", e);
        return false;
    }
};

/**
 * 受信した申請を拒否する（自分のin・相手のoutから除去するのみ）
 * @param {string} me
 * @param {string} requester
 * @returns {boolean}
 */
window.AppStorage.declineFriendRequest = async function (me, requester) {
    if (!me || !requester) return false;
    try {
        const batch = db.batch();
        batch.set(_userRef(me), { friendRequestsIn: _arrRemove(requester) }, { merge: true });
        batch.set(_userRef(requester), { friendRequestsOut: _arrRemove(me) }, { merge: true });
        await batch.commit();
        return true;
    } catch (e) {
        console.error("declineFriendRequest failed:", e);
        return false;
    }
};

/**
 * 送信済みの申請を取り消す（自分のout・相手のinから除去するのみ）
 * @param {string} me
 * @param {string} target
 * @returns {boolean}
 */
window.AppStorage.cancelFriendRequest = async function (me, target) {
    if (!me || !target) return false;
    try {
        const batch = db.batch();
        batch.set(_userRef(me), { friendRequestsOut: _arrRemove(target) }, { merge: true });
        batch.set(_userRef(target), { friendRequestsIn: _arrRemove(me) }, { merge: true });
        await batch.commit();
        return true;
    } catch (e) {
        console.error("cancelFriendRequest failed:", e);
        return false;
    }
};

/**
 * フレンドを解除する（双方のfriendsから除去）
 * @param {string} me
 * @param {string} target
 * @returns {boolean}
 */
window.AppStorage.removeFriend = async function (me, target) {
    if (!me || !target) return false;
    try {
        const batch = db.batch();
        batch.set(_userRef(me), { friends: _arrRemove(target) }, { merge: true });
        batch.set(_userRef(target), { friends: _arrRemove(me) }, { merge: true });
        await batch.commit();
        return true;
    } catch (e) {
        console.error("removeFriend failed:", e);
        return false;
    }
};

/**
 * セッション参加者を「暗黙の同意」として即・相互フレンド化する（申請ステップを飛ばす）。
 * 同卓した相手の成績が見えなくなる退行を防ぐための処理。
 * @param {string} deviceUser
 * @param {string[]} playerNames
 */
window.AppStorage.autoFriendFromSession = async function (deviceUser, playerNames) {
    if (!deviceUser || !Array.isArray(playerNames)) return;
    const targets = [...new Set(playerNames.filter(name => name && name !== deviceUser))];
    for (const target of targets) {
        try {
            // ゲスト（アカウント未作成 = uid なし）は自動フレンド化しない
            const doc = await _userRef(target).get();
            if (!doc.exists || !doc.data().uid) continue;
            await _commitFriendship(deviceUser, target);
        } catch (e) {
            console.error("autoFriendFromSession failed for", target, e);
        }
    }
};

/**
 * 既存の myMembers を friends へ移行する（一回限り・冪等）。
 * friendsMigrated フラグで二重実行を防止。片方向 myMembers も相互フレンド化する
 * （既存の暗黙同意を尊重）。
 * @param {string} me
 */
window.AppStorage.migrateMyMembersToFriends = async function (me) {
    if (!me) return;
    try {
        const doc = await _userRef(me).get();
        if (!doc.exists) return;
        const data = doc.data();
        if (data.friendsMigrated) return;

        const myMembers = data.myMembers || [];
        const batch = db.batch();
        for (const target of myMembers) {
            if (!target || target === me) continue;
            // ゲスト（uid なし）は移行しない。正式ユーザー同士のみフレンド化する
            const td = await _userRef(target).get();
            if (!td.exists || !td.data().uid) continue;
            batch.set(_userRef(me), { friends: _arrUnion(target) }, { merge: true });
            batch.set(_userRef(target), { friends: _arrUnion(me) }, { merge: true });
        }
        batch.set(_userRef(me), { friendsMigrated: true }, { merge: true });
        await batch.commit();
    } catch (e) {
        console.error("migrateMyMembersToFriends failed:", e);
    }
};
