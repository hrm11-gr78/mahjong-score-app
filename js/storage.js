// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCk-FlI_dTmLfRb5d4WhbdP6SJ9s_6QyIw",
    authDomain: "jong-log.firebaseapp.com",
    projectId: "jong-log",
    storageBucket: "jong-log.firebasestorage.app",
    messagingSenderId: "615006808230",
    appId: "1:615006808230:web:403e216552a3347ee4ec67",
    measurementId: "G-8X6V557373"
};

// Initialize Firebase (Compat)
let db;
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    // Initialize Storage
    if (firebase.storage) {
        window.storage = firebase.storage();
    }
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
        let highScore = -Infinity;
        let totalScore = 0;
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

            // ハイスコア
            if (g.score > highScore) highScore = g.score;

            // 累積スコア
            totalScore += (g.finalScore || 0);
            if (totalScore > maxCumulativeScore) maxCumulativeScore = totalScore;

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
            minAverageRank: minAverageRank === Infinity ? 0 : minAverageRank,
            maxConsecutiveTop: maxTop,
            maxConsecutiveRentai: maxRen,
            maxConsecutiveAvoidLast: maxAvoid,
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

// --- Roulette (Local Only) ---

window.AppStorage.getRouletteItems = async function () {
    const saved = localStorage.getItem('rouletteItems');
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (e) {
            console.error(e);
        }
    }
    return ['1', '2', '3', '4', '5', '6', '7']; // Default
};

window.AppStorage.saveRouletteItems = async function (items) {
    localStorage.setItem('rouletteItems', JSON.stringify(items));
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

// --- Storage (Images) ---
window.AppStorage.uploadImage = async function (file, path, onProgress) {
    if (!window.storage) {
        console.error("Firebase Storage not initialized");
        return null;
    }

    // Auth Check
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) {
        const errorMsg = "ログインしていません。アップロードにはログインが必要です。";
        console.error(errorMsg);
        alert(errorMsg); // Alert immediately to user
        return null; // Or reject promise? The caller expects a promise usually.
        // Actually, returning null will likely cause the caller (await uploadImage) to get null, 
        // which might be handled or processed as "success with no URL".
        // Better to throw error or let the caller verify.
        // But for deep debugging, let's throw.
        throw new Error(errorMsg);
    }
    try {
        const storageRef = window.storage.ref();
        const imageRef = storageRef.child(path);
        const uploadTask = imageRef.put(file);

        return new Promise((resolve, reject) => {
            // Timeout after 30 seconds
            const timeoutId = setTimeout(() => {
                uploadTask.cancel();
                reject(new Error("Upload timed out (network issue?)"));
            }, 30000);

            uploadTask.on('state_changed',
                (snapshot) => {
                    if (onProgress) {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        onProgress(progress);
                    }
                },
                (error) => {
                    clearTimeout(timeoutId);
                    console.error("Upload failed in task:", error);
                    reject(error);
                },
                async () => {
                    clearTimeout(timeoutId);
                    try {
                        const url = await uploadTask.snapshot.ref.getDownloadURL();
                        resolve(url);
                    } catch (e) {
                        reject(e);
                    }
                }
            );
        });
    } catch (e) {
        console.error("Upload failed:", e);
        return null;
    }
};

window.AppStorage.deleteImage = async function (pathOrUrl) {
    if (!window.storage) return false;
    try {
        let imageRef;
        if (pathOrUrl.startsWith('http')) {
            imageRef = window.storage.refFromURL(pathOrUrl);
        } else {
            imageRef = window.storage.ref().child(pathOrUrl);
        }
        await imageRef.delete();
        return true;
    } catch (e) {
        console.error("Delete image failed:", e);
        return false;
    }
};
