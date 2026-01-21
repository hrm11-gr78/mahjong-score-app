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
} catch (e) {
    console.error("Firebase Init Error:", e);
    alert("データベース接続に失敗しました。インターネット接続を確認してください。");
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
            games[index] = updatedGameData;
            await sessionRef.update({ games: games });
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
    await db.collection("sessions").doc(String(sessionId)).delete();
    return true;
};

window.AppStorage.removeGameFromSession = async function (sessionId, gameId) {
    const sessionRef = db.collection("sessions").doc(String(sessionId));
    const doc = await sessionRef.get();
    if (doc.exists) {
        const session = doc.data();
        const games = session.games || [];
        const newGames = games.filter(g => g.id !== Number(gameId));
        await sessionRef.update({ games: newGames });
        return true;
    }
    return false;
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
        try {
            await firebase.auth().signInWithEmailAndPassword(email, password);
            return { success: true };
        } catch (e) {
            console.error("SignIn failed:", e);
            return { success: false, error: e.message };
        }
    },

    signUp: async function (email, password) {
        try {
            await firebase.auth().createUserWithEmailAndPassword(email, password);
            return { success: true };
        } catch (e) {
            console.error("SignUp failed:", e);
            return { success: false, error: e.message };
        }
    },

    signOut: async function () {
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
