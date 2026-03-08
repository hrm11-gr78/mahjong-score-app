// Imports are handled by loaded scripts. window.AppStorage is async.

// --- DOM Elements (Global) ---
const navButtons = document.querySelectorAll('nav button');
const sections = document.querySelectorAll('section');
const userSelects = document.querySelectorAll('.user-select');

// Auth Elements
const loginSection = document.getElementById('login');
const signupSection = document.getElementById('signup');
const linkUserSection = document.getElementById('link-user');
const loginEmailInput = document.getElementById('login-email');
const loginPasswordInput = document.getElementById('login-password');
const loginBtn = document.getElementById('login-btn');
const showSignupBtn = document.getElementById('show-signup');
const loginError = document.getElementById('login-error');

const signupEmailInput = document.getElementById('signup-email');
const signupPasswordInput = document.getElementById('signup-password');
const signupBtn = document.getElementById('signup-btn');
const showLoginBtn = document.getElementById('show-login');
const signupError = document.getElementById('signup-error');

const linkUserSelect = document.getElementById('link-user-select');
const linkUserNewNameInput = document.getElementById('link-user-new-name');
const linkUserBtn = document.getElementById('link-user-btn');

// Session Setup

// Session Setup
const sessionSetupForm = document.getElementById('session-setup-form');
const sessionDateInput = document.getElementById('session-date');
const sessionList = document.getElementById('session-list');

// Session Detail
const sessionTitle = document.getElementById('session-title');
const sessionRateSelect = document.getElementById('session-rate');
const sessionTotalTable = document.getElementById('session-total-table');
const gameList = document.getElementById('game-list');
const newGameBtn = document.getElementById('new-game-btn');
const backToHomeBtn = document.getElementById('back-to-home');

// Input
const scoreForm = document.getElementById('score-form');
const scoreInputs = document.querySelectorAll('#score-form input[name$="-score"]');
const totalCheck = document.getElementById('total-check');
const cancelInputBtn = document.getElementById('cancel-input');

// Users
const userList = document.getElementById('user-list');
const addUserBtn = document.getElementById('add-user-btn');
const newUserNameInput = document.getElementById('new-user-name');

// Settings
const settingsForm = document.getElementById('settings-form');
const resetSettingsBtn = document.getElementById('reset-settings');

// Tie Breaker Modal
const tieBreakerModal = document.getElementById('tie-breaker-modal');
const tieBreakerOptions = document.getElementById('tie-breaker-options');

// Roulette DOM Elements
const rouletteCanvas = document.getElementById('roulette-canvas');
const rouletteCtx = rouletteCanvas ? rouletteCanvas.getContext('2d') : null;
const spinBtn = document.getElementById('spin-btn');
const rouletteResult = document.getElementById('roulette-result');
const rouletteInput = document.getElementById('roulette-input');
const addRouletteItemBtn = document.getElementById('add-roulette-item');
const rouletteList = document.getElementById('roulette-list');

// State
let currentSessionId = null;
let editingGameId = null; // ID of the game being edited
let pendingGameData = null; // Store data while waiting for tie-breaker
let pendingGameYakumans = []; // [NEW] Store yakumans for current game input

// Roulette State
let rouletteItems = [];
let isSpinning = false;
let currentRotation = 0;

// Color palette for roulette segments
const rouletteColors = [
    '#bb86fc', '#03dac6', '#cf6679', '#ffb74d',
    '#8b86fc', '#03da86', '#cf8879', '#ffb78d',
    '#9b86fc', '#03daa6', '#cf6699', '#ffb70d',
    '#ab86fc', '#03dac0', '#cf66a9', '#ffb75d',
    '#cb86fc', '#03da90', '#cf66b9', '#ffb79d'
];

// --- Initialization ---
// --- Initialization ---
async function init() {
    // 1. Synchronous Setup (Immediate)
    if (sessionDateInput) {
        sessionDateInput.valueAsDate = new Date();
    }

    setupScoreValidation();
    setupYakumanModal(); // [NEW] Initialize Modal Listeners

    // 2. Initialize Auth & State
    window.AppStorage.auth.init(handleAuthStateChanged);

    // 3. User & Session Data is loaded AFTER auth is confirmed (in handleAuthStateChanged)
}

async function handleAuthStateChanged(user, linkedUser) {
    // Auth確認完了 → ローディング画面を非表示にする
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) loadingScreen.classList.add('hidden');

    const nav = document.querySelector('nav');
    const profileBtn = document.getElementById('header-profile-btn');

    if (!user) {
        // Not logged in -> Show Login
        if (nav) nav.style.display = 'none';
        if (profileBtn) profileBtn.style.display = 'none';
        navigateTo('login');
        return;
    }

    // Logged in
    console.log("Logged in as:", user.email);

    // Check if linked to Game User
    if (!linkedUser) {
        console.log("User not linked. Redirecting to Link User Screen.");
        // Not linked -> Show Link User Screen
        // Ensure other sections are hidden
        if (nav) nav.style.display = 'none';
        if (profileBtn) profileBtn.style.display = 'none';

        // We need to load users first to populate the select
        await renderUserOptions();
        navigateTo('link-user');
        return;
    }

    // Linked! -> Set Device User and Go Home
    console.log("Linked Game User:", linkedUser.name);

    // Show Nav and Profile Button
    if (nav) nav.style.display = 'flex';
    if (profileBtn) profileBtn.style.display = 'block';

    localStorage.setItem('deviceUser', linkedUser.name); // Sync local storage for compat

    // Load Data
    try {
        await Promise.all([
            renderUserOptions(),
            renderUserList(),
            renderSessionList(),
            loadSettingsToForm(),
            loadNewSetFormDefaults()
        ]);

        if (rouletteCanvas) {
            await initRoulette();
        }
    } catch (e) {
        console.error("Data Loading Failed:", e);
    }

    // Go to Home
    navigateTo('home');
}

// --- Auth Event Listeners ---

if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
        const email = loginEmailInput.value;
        const password = loginPasswordInput.value;
        if (!email || !password) {
            showError(loginError, "メールアドレスとパスワードを入力してください。");
            return;
        }

        const result = await window.AppStorage.auth.signIn(email, password);
        if (!result.success) {
            showError(loginError, "ログインに失敗しました: " + result.error);
        }
    });
}

if (signupBtn) {
    signupBtn.addEventListener('click', async () => {
        const email = signupEmailInput.value;
        const password = signupPasswordInput.value;
        if (!email || !password) {
            showError(signupError, "メールアドレスとパスワードを入力してください。");
            return;
        }

        const result = await window.AppStorage.auth.signUp(email, password);
        if (!result.success) {
            let msg = "登録に失敗しました: " + result.error;
            if (result.error && result.error.includes('email-already-in-use')) {
                msg = "このメールアドレスは既に使用されています。ログインしてください。";
            }
            showError(signupError, msg);
        } else {
            // Success! 
            // Manually transition to Link User screen to ensure smooth flow
            // Hide Login UI elements
            const nav = document.querySelector('nav');
            const profileBtn = document.getElementById('header-profile-btn');
            if (nav) nav.style.display = 'none';
            if (profileBtn) profileBtn.style.display = 'none';

            // Load options and navigate
            await renderUserOptions();
            navigateTo('link-user');
        }
    });
}

const googleLoginBtn = document.getElementById('google-login-btn');
if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', async () => {
        const result = await window.AppStorage.auth.signInWithGoogle();
        if (!result.success) {
            showError(loginError, "Googleログインに失敗しました: " + result.error);
        }
    });
}

const googleSignupBtn = document.getElementById('google-signup-btn');
if (googleSignupBtn) {
    googleSignupBtn.addEventListener('click', async () => {
        const result = await window.AppStorage.auth.signInWithGoogle();
        if (!result.success) {
            showError(signupError, "Google登録に失敗しました: " + result.error);
        }
    });
}

if (showSignupBtn) {
    showSignupBtn.addEventListener('click', () => navigateTo('signup'));
}

if (showLoginBtn) {
    showLoginBtn.addEventListener('click', () => navigateTo('login'));
}

if (linkUserBtn) {
    linkUserBtn.addEventListener('click', async () => {
        const newName = linkUserNewNameInput.value.trim();

        if (!newName) {
            alert("ユーザー名を入力してください。");
            return;
        }

        const currentUser = window.AppStorage.auth.currentUser;
        if (!currentUser) return;

        const success = await window.AppStorage.auth.linkUser(currentUser.uid, newName);
        if (success) {
            // 連携完了 → Auth状態を再取得してホームへ
            const linked = await window.AppStorage.auth.getLinkedUser(currentUser.uid);
            handleAuthStateChanged(currentUser, linked);
        } else {
            alert("ユーザーの作成に失敗しました。別の名前を試してください。");
        }
    });
}

function showError(element, message) {
    element.textContent = message;
    element.style.display = 'block';
}

async function loadNewSetFormDefaults() {
    if (!document.getElementById('new-set-start')) return;
    try {
        const settings = await window.AppStorage.getSettings();
        document.getElementById('new-set-start').value = settings.startScore;
        document.getElementById('new-set-return').value = settings.returnScore;
        document.getElementById('new-set-uma1').value = settings.uma[0];
        document.getElementById('new-set-uma2').value = settings.uma[1];
        document.getElementById('new-set-uma3').value = settings.uma[2];
        document.getElementById('new-set-uma4').value = settings.uma[3];

        const radios = document.getElementsByName('newSetTieBreaker');
        radios.forEach(r => {
            if (r.value === settings.tieBreaker) r.checked = true;
        });
    } catch (e) {
        console.warn("Failed to load new set defaults", e);
    }
}

// --- Navigation ---
function setupNavigation() {
    // 1. Direct Nav Buttons (Home, Users, Roulette)
    navButtons.forEach(btn => {
        // Remove old listeners by cloning
        // Note: cloning removes listeners but also breaks references to the old DOM element if stored elsewhere.
        // Since 'navButtons' is a static NodeList captured at load, we shouldn't clone if we want to reuse that list.
        // Instead, just adding listener is fine as init() runs once.
        // If we want to be super safe against double-init, we can check a flag.

        if (btn.dataset.listenerAttached) return;

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = btn.dataset.target;
            navigateTo(targetId);
        });
        btn.dataset.listenerAttached = 'true';
    });

    // 2. Specific Action Buttons
    if (backToHomeBtn) {
        // Use onclick to overwrite any existing listeners (simple safety)
        backToHomeBtn.onclick = () => {
            navigateTo('home');
            renderSessionList();
        };
    }

    if (newGameBtn) {
        newGameBtn.onclick = () => {
            editingGameId = null;
            navigateTo('input');
            prepareInputForm();
        };
    }

    if (cancelInputBtn) {
        cancelInputBtn.onclick = () => {
            editingGameId = null;
            navigateTo('session-detail');
        };
    }

    if (sessionRateSelect) {
        // onchange is safer for single binding
        sessionRateSelect.onchange = async (e) => {
            const newRate = Number(e.target.value);
            if (currentSessionId) {
                await window.AppStorage.updateSession(currentSessionId, { rate: newRate });
                const session = await window.AppStorage.getSession(currentSessionId);
                renderSessionTotal(session);
            }
        };
    }
}

function navigateTo(targetId) {
    if (!targetId) return;
    console.log(`Navigating to: ${targetId}. Found ${sections.length} sections.`);

    // Update Buttons
    navButtons.forEach(b => {
        if (b.dataset.target === targetId) {
            b.classList.add('active');
        } else {
            b.classList.remove('active');
        }
    });

    // Update Sections
    sections.forEach(s => {
        s.classList.remove('active');
        // Force inline style toggle to ensure visibility
        s.style.display = 'none';

        if (s.id === targetId) {
            s.classList.add('active');
            s.style.display = 'block';
            s.classList.add('active');
            s.style.display = 'block';
            console.log("Navigated to:", targetId); // Debug log

            // [NEW] Render Gallery
            if (targetId === 'gallery' && window.renderGallery) {
                window.renderGallery();
            }
        }
    });

    // Toggle Header Settings & League Button Visibility
    const settingsBtn = document.getElementById('header-settings-btn');
    const leagueBtn = document.getElementById('header-league-btn');
    const galleryBtn = document.getElementById('header-gallery-btn');

    // Show on main tabs (Home, Users, Roulette)
    // Note: League section itself is a "main" view but handled via header now.
    const mainTabs = ['home', 'users', 'roulette', 'league-section', 'session-detail', 'input', 'user-detail', 'settings', 'gallery'];

    if (settingsBtn) {
        if (mainTabs.includes(targetId)) {
            settingsBtn.style.display = 'block';
        } else {
            settingsBtn.style.display = 'none';
        }
    }

    if (leagueBtn) {
        if (mainTabs.includes(targetId)) {
            leagueBtn.style.display = 'block';
        } else {
            leagueBtn.style.display = 'none';
        }
    }

    if (galleryBtn) {
        if (mainTabs.includes(targetId)) {
            galleryBtn.style.display = 'block';
        } else {
            galleryBtn.style.display = 'none';
        }
    }

    // Apply Action Restrictions
    updateActionRestrictions();
}

/**
 * Restrictions when no Device User is selected
 */
function updateActionRestrictions() {
    const deviceUser = localStorage.getItem('deviceUser');
    const isRestricted = !deviceUser;

    // Elements to toggle
    const sessionSetupForm = document.getElementById('session-setup-form');
    const newGameBtn = document.getElementById('new-game-btn');
    const spinBtn = document.getElementById('spin-btn');
    const addRouletteItemBtn = document.getElementById('add-roulette-item');
    const rouletteInput = document.getElementById('roulette-input');
    const scoreForm = document.getElementById('score-form');
    const settingsForm = document.getElementById('settings-form');

    // Messages to toggle
    const restrictionMsgs = document.querySelectorAll('.restricted-access-msg');

    if (isRestricted) {
        // Hide/Disable active elements
        if (sessionSetupForm) sessionSetupForm.style.display = 'none';
        if (newGameBtn) newGameBtn.style.display = 'none';
        if (spinBtn) spinBtn.disabled = true;
        if (addRouletteItemBtn) addRouletteItemBtn.disabled = true;
        if (rouletteInput) rouletteInput.disabled = true;
        if (scoreForm) scoreForm.style.display = 'none';
        if (settingsForm) settingsForm.style.display = 'none';

        // Show messages
        restrictionMsgs.forEach(msg => msg.style.display = 'block');
    } else {
        // Show/Enable active elements
        if (sessionSetupForm) sessionSetupForm.style.display = 'block';
        if (newGameBtn) newGameBtn.style.display = 'block';
        if (spinBtn) spinBtn.disabled = false;
        if (addRouletteItemBtn) addRouletteItemBtn.disabled = false;
        if (rouletteInput) rouletteInput.disabled = false;
        if (scoreForm) scoreForm.style.display = 'block';
        if (settingsForm) settingsForm.style.display = 'block';

        // Hide messages
        restrictionMsgs.forEach(msg => msg.style.display = 'none');
    }
}

// --- DOM Elements ---
const headerSettingsBtn = document.getElementById('header-settings-btn');
if (headerSettingsBtn) {
    headerSettingsBtn.addEventListener('click', () => {
        navigateTo('settings');
    });
}

const headerProfileBtn = document.getElementById('header-profile-btn');
const userProfileModal = document.getElementById('user-profile-modal');
const profileUserSelect = document.getElementById('profile-user-select');
const closeProfileModalBtn = document.getElementById('close-profile-modal');
const signOutBtn = document.getElementById('sign-out-btn');

if (headerProfileBtn) {
    headerProfileBtn.addEventListener('click', async () => {
        // Load current info
        const deviceUser = localStorage.getItem('deviceUser') || '未設定';
        const currentUser = window.AppStorage.auth.currentUser;
        const email = currentUser ? currentUser.email : '未ログイン';

        // Update Modal Content
        const nameEl = document.getElementById('profile-game-name');
        const emailEl = document.getElementById('profile-email');

        if (nameEl) nameEl.textContent = deviceUser;
        if (emailEl) emailEl.textContent = email;

        // Show modal
        if (userProfileModal) {
            userProfileModal.style.display = 'flex';
        }
    });
}

if (closeProfileModalBtn) {
    closeProfileModalBtn.addEventListener('click', () => {
        if (userProfileModal) {
            userProfileModal.style.display = 'none';
        }
    });
}

if (signOutBtn) {
    signOutBtn.addEventListener('click', async () => {
        if (confirm('サインアウトしますか？')) {
            if (userProfileModal) {
                userProfileModal.style.display = 'none';
            }
            await window.AppStorage.auth.signOut();
            // handleAuthStateChanged will handle the rest (redirect, etc.)
        }
    });
}

// Password Change Features
const showPasswordChangeBtn = document.getElementById('show-password-change');
const passwordChangeForm = document.getElementById('password-change-form');
const cancelPasswordChangeBtn = document.getElementById('cancel-password-change');
const updatePasswordBtn = document.getElementById('update-password-btn');
const newPasswordInput = document.getElementById('new-password-input');

if (showPasswordChangeBtn) {
    showPasswordChangeBtn.addEventListener('click', () => {
        passwordChangeForm.style.display = 'block';
        showPasswordChangeBtn.style.display = 'none';
    });
}

if (cancelPasswordChangeBtn) {
    cancelPasswordChangeBtn.addEventListener('click', () => {
        passwordChangeForm.style.display = 'none';
        showPasswordChangeBtn.style.display = 'inline-block';
        if (newPasswordInput) newPasswordInput.value = '';
    });
}

if (updatePasswordBtn) {
    updatePasswordBtn.addEventListener('click', async () => {
        const newPassword = newPasswordInput.value;
        if (!newPassword || newPassword.length < 6) {
            alert('パスワードは6文字以上で入力してください。');
            return;
        }

        const result = await window.AppStorage.auth.updatePassword(newPassword);
        if (result.success) {
            alert('パスワードを変更しました。');
            passwordChangeForm.style.display = 'none';
            showPasswordChangeBtn.style.display = 'inline-block';
            newPasswordInput.value = '';
        } else {
            if (result.error === 'auth/requires-recent-login') {
                alert('セキュリティのため、再ログインが必要です。ログアウトします。');
                await window.AppStorage.auth.signOut();
                if (userProfileModal) userProfileModal.style.display = 'none';
            } else {
                alert('パスワードの変更に失敗しました: ' + result.message);
            }
        }
    });
}

// --- User Management ---
async function renderUserOptions() {
    const allUsers = await window.AppStorage.getUsers();

    // For the User Link Screen, we only want unlinked users
    const unlinkedUsers = await window.AppStorage.getUnlinkedUsers();

    // デバイスユーザーのマイメンバーを取得
    const deviceUser = localStorage.getItem('deviceUser');
    const myMembers = deviceUser ? await window.AppStorage.getMyMembers(deviceUser) : [];

    // Update all user-select dropdowns (Game Setup & Settings)
    const selects = document.querySelectorAll('.user-select');

    selects.forEach(select => {
        const currentVal = select.value;
        const isLinkUserSelect = select.id === 'link-user-select';
        const isProfileUserSelect = select.id === 'profile-user-select';
        // プレイヤー選択セレクト（p1〜p4）か判定
        const isPlayerSelect = /^p[1-4]-select$/.test(select.id);

        // Choose which list to use
        const userSource = isLinkUserSelect ? unlinkedUsers : allUsers;

        // Reset options
        if (isProfileUserSelect) {
            select.innerHTML = '<option value="">(未選択)</option>';
        } else {
            select.innerHTML = '<option value="" disabled selected>選択...</option>';
        }

        if (isPlayerSelect && myMembers.length > 0) {
            // マイメンバー + 自分を上位グループに、残りを下位グループに分ける
            const prioritySet = new Set([...myMembers, ...(deviceUser ? [deviceUser] : [])]);
            const priorityUsers = userSource.filter(u => prioritySet.has(u));
            const otherUsers = userSource.filter(u => !prioritySet.has(u));

            if (priorityUsers.length > 0) {
                const groupA = document.createElement('optgroup');
                groupA.label = 'マイメンバー';
                priorityUsers.forEach(user => {
                    const opt = document.createElement('option');
                    opt.value = user;
                    opt.textContent = user;
                    groupA.appendChild(opt);
                });
                select.appendChild(groupA);
            }

            if (otherUsers.length > 0) {
                const groupB = document.createElement('optgroup');
                groupB.label = 'その他';
                otherUsers.forEach(user => {
                    const opt = document.createElement('option');
                    opt.value = user;
                    opt.textContent = user;
                    groupB.appendChild(opt);
                });
                select.appendChild(groupB);
            }
        } else {
            // 通常表示
            userSource.forEach(user => {
                const option = document.createElement('option');
                option.value = user;
                option.textContent = user;
                select.appendChild(option);
            });
        }

        // Restore value if still valid in the new list
        if (currentVal && userSource.includes(currentVal)) {
            select.value = currentVal;
        }
    });

    // Special handling for Device User Select restoration from localStorage
    const deviceUserSelect = document.getElementById('device-user-select');
    if (deviceUserSelect) {
        const savedDeviceUser = localStorage.getItem('deviceUser');
        if (savedDeviceUser && allUsers.includes(savedDeviceUser)) {
            deviceUserSelect.value = savedDeviceUser;
        }
    }
}


// Header League Button Listener
const headerLeagueBtn = document.getElementById('header-league-btn');
if (headerLeagueBtn) {
    headerLeagueBtn.addEventListener('click', () => {
        navigateTo('league-section');
        if (window.League) {
            window.League.renderList(document.getElementById('league-section'));
        }
    });
}

// Header Gallery Button Listener
const headerGalleryBtn = document.getElementById('header-gallery-btn');
if (headerGalleryBtn) {
    headerGalleryBtn.addEventListener('click', () => {
        navigateTo('gallery');
    });
}

function setupSessionFormToggles() {
    document.querySelectorAll('.toggle-guest-btn').forEach(btn => {
        // Remove old listener (simple way is to clone, but we use robust "listenerAttached" check now globaly if needed)
        // Here we can just assume it's fine or do the check.
        if (btn.dataset.listenerAttached) return;

        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target; // e.g., "p1"
            const wrapper = document.getElementById(`${targetId}-wrapper`);
            const select = wrapper.querySelector('select');
            const input = wrapper.querySelector('input');

            if (select.style.display !== 'none') {
                // Switch to Input
                select.style.display = 'none';
                select.removeAttribute('required'); // Remove required from hidden select

                input.style.display = 'block';
                input.setAttribute('required', ''); // Add required to visible input
                input.focus();

                btn.textContent = '📋'; // Change icon to "List"
                btn.title = "リストから選択";
            } else {
                // Switch to Select
                select.style.display = 'block';
                select.setAttribute('required', ''); // Add required back to visible select

                input.style.display = 'none';
                input.removeAttribute('required'); // Remove required from hidden input

                btn.textContent = '🖊️'; // Change icon to "Edit"
                btn.title = "手動入力切替";
            }
        });
        btn.dataset.listenerAttached = 'true';
    });
}
// -------------------------------------------------------------------------
// TITLE SYSTEM
// -------------------------------------------------------------------------

const TITLES = [
    // Special
    { id: 'founder', name: '創設者', icon: '👑', category: 'special', rank: 'special', check: (stats) => stats.userName === 'ヒロム', description: 'このアプリの創設者' },

    // Consecutive Top
    { id: 'top_3', name: '青龍', icon: '🐉', category: 'streak_top', rank: 'bronze', threshold: 3, description: '3連続トップ' },
    { id: 'top_5', name: '白虎', icon: '🐯', category: 'streak_top', rank: 'silver', threshold: 5, description: '5連続トップ' },
    { id: 'top_10', name: '朱雀', icon: '🦅', category: 'streak_top', rank: 'gold', threshold: 10, description: '10連続トップ' },

    // Consecutive Rentai (1st or 2nd)
    { id: 'rentai_3', name: '駆け出し', icon: '🐣', category: 'streak_rentai', rank: 'bronze', threshold: 3, description: '3連続連対' },
    { id: 'rentai_5', name: '手練れ', icon: '⚔️', category: 'streak_rentai', rank: 'silver', threshold: 5, description: '5連続連対' },
    { id: 'rentai_10', name: '鉄壁', icon: '🏰', category: 'streak_rentai', rank: 'gold', threshold: 10, description: '10連続連対' },

    // Consecutive Avoid Last (Not 4th)
    { id: 'avoid_5', name: '慎重居士', icon: '🦉', category: 'streak_avoid', rank: 'bronze', threshold: 5, description: '5連続ラス回避' },
    { id: 'avoid_10', name: '不沈艦', icon: '⚓', category: 'streak_avoid', rank: 'silver', threshold: 10, description: '10連続ラス回避' },
    { id: 'avoid_20', name: '不死鳥', icon: '🔥', category: 'streak_avoid', rank: 'gold', threshold: 20, description: '20連続ラス回避' },

    // High Score
    { id: 'score_50k', name: '大物手', icon: '🧨', category: 'high_score', rank: 'bronze', threshold: 50000, description: '持ち点5万点以上' },
    { id: 'score_75k', name: '役満級', icon: '💣', category: 'high_score', rank: 'silver', threshold: 75000, description: '持ち点7万5千点以上' },
    { id: 'score_100k', name: '伝説', icon: '🐲', category: 'high_score', rank: 'gold', threshold: 100000, description: '持ち点10万点以上' },

    // Game Count
    { id: 'games_30', name: '闘士', icon: '🥊', category: 'game_count', rank: 'bronze', threshold: 30, description: '対戦数30回以上' },
    { id: 'games_50', name: '歴戦の勇士', icon: '🎖️', category: 'game_count', rank: 'silver', threshold: 50, description: '対戦数50回以上' },
    { id: 'games_100', name: '百戦錬磨', icon: '🦾', category: 'game_count', rank: 'gold', threshold: 100, description: '対戦数100回以上' },

    // Total Score
    { id: 'total_200', name: '勝ち組', icon: '💰', category: 'total_score', rank: 'bronze', threshold: 200, description: '累計スコア+200以上' },
    { id: 'total_500', name: '黒字請負人', icon: '📈', category: 'total_score', rank: 'silver', threshold: 500, description: '累計スコア+500以上' },
    { id: 'total_1000', name: 'ミリオネア', icon: '💎', category: 'total_score', rank: 'gold', threshold: 1000, description: '累計スコア+1000以上' },

    // Average Rank (Lower is better, handled by check or inverted threshold logic in app)
    // Using 'check' logic for flexibility
    { id: 'avg_240', name: 'アベレージヒッター', icon: '🎯', category: 'avg_rank', rank: 'bronze', check: (stats) => stats.minAverageRank > 0 && stats.minAverageRank <= 2.40, description: '平均順位2.40以下 (30戦以上)' },
    { id: 'avg_225', name: '卓上の支配者', icon: '🎩', category: 'avg_rank', rank: 'silver', check: (stats) => stats.minAverageRank > 0 && stats.minAverageRank <= 2.25, description: '平均順位2.25以下 (30戦以上)' },
    { id: 'avg_210', name: '覇王', icon: '🔱', category: 'avg_rank', rank: 'gold', check: (stats) => stats.minAverageRank > 0 && stats.minAverageRank <= 2.10, description: '平均順位2.10以下 (30戦以上)' },

    // Yakuman系称号
    { id: 'yakuman_beginner', name: '役満経験者', icon: '🌸', category: 'yakuman', rank: 'bronze', check: (stats) => (stats.recordYakumanCount || stats.yakumanCount) >= 1, description: '役満1回以上達成' },
    { id: 'yakuman_master', name: '役満マスター', icon: '🏵️', category: 'yakuman', rank: 'silver', check: (stats) => (stats.recordYakumanCount || stats.yakumanCount) >= 5, description: '役満5回以上達成' },
    { id: 'yakuman_god', name: '役満神', icon: '✨', category: 'yakuman', rank: 'gold', check: (stats) => (stats.recordYakumanCount || stats.yakumanCount) >= 10, description: '役満10回以上達成' },
    { id: 'tenhou_holder', name: '天運の持ち主', icon: '☀️', category: 'yakuman', rank: 'special', check: (stats) => (stats.recordHasTenhou || stats.hasTenhou) === true, description: '天和達成' },
    { id: 'chiihou_holder', name: '地運の持ち主', icon: '🌏', category: 'yakuman', rank: 'special', check: (stats) => (stats.recordHasChiihou || stats.hasChiihou) === true, description: '地和達成' },

    // 不名誉系称号（shame ランク）
    // 連続ラス
    { id: 'last_3', name: '泥沼', icon: '🌀', category: 'streak_last', rank: 'shame', threshold: 3, description: '3連続ラス' },
    { id: 'last_5', name: '底なし沼', icon: '💀', category: 'streak_last', rank: 'shame', threshold: 5, description: '5連続ラス' },
    { id: 'last_10', name: '奈落', icon: '☠️', category: 'streak_last', rank: 'shame', threshold: 10, description: '10連続ラス' },

    // 連続逆連対（3〜4着）
    { id: 'inverse_3', name: '苦労人', icon: '😓', category: 'streak_inverse', rank: 'shame', threshold: 3, description: '3連続逆連対（3〜4着）' },
    { id: 'inverse_5', name: '受難者', icon: '😭', category: 'streak_inverse', rank: 'shame', threshold: 5, description: '5連続逆連対（3〜4着）' },
    { id: 'inverse_10', name: '呪われし者', icon: '👻', category: 'streak_inverse', rank: 'shame', threshold: 10, description: '10連続逆連対（3〜4着）' },

    // 累計マイナス
    { id: 'minus_200', name: 'マイナス街道', icon: '📉', category: 'minus_score', rank: 'shame', threshold: -200, description: '累計スコア-200以下' },
    { id: 'minus_500', name: '万年赤字', icon: '🩸', category: 'minus_score', rank: 'shame', threshold: -500, description: '累計スコア-500以下' },
    { id: 'minus_1000', name: '底辺の帝王', icon: '👑💀', category: 'minus_score', rank: 'shame', threshold: -1000, description: '累計スコア-1000以下' },
];

async function getUserStats(userName, allSessions) {
    if (!allSessions || allSessions.length === 0) return null;

    const userGames = [];
    allSessions.forEach(s => {
        s.games.forEach(g => {
            const p = g.players.find(x => x.name === userName);
            if (p) {
                // We need finalScore for total score calculation and to know rank
                userGames.push({ rank: p.rank, score: p.score, finalScore: p.finalScore, date: s.date, yakuman: p.yakuman || [] });
            }
        });
    });

    if (userGames.length === 0) {
        // Firestoreから最高記録を取得
        const titleRecords = await window.AppStorage.getUserTitleRecords(userName);
        if (titleRecords) {
            return {
                userName,
                maxTop: titleRecords.maxConsecutiveTop || 0,
                maxRen: titleRecords.maxConsecutiveRentai || 0,
                maxAvoid: titleRecords.maxConsecutiveAvoidLast || 0,
                highScore: titleRecords.maxHighScore || 0,
                gameCount: titleRecords.maxGameCount || 0,
                totalScore: 0,
                avgRank: 0,
                yakumanCount: 0,
                hasTenhou: false,
                hasChiihou: false,

                // Keep records for titles
                maxCumulativeScore: titleRecords.maxCumulativeScore || 0,
                minAverageRank: titleRecords.minAverageRank || 0,
            };
        }
        return { userName, maxTop: 0, maxRen: 0, maxAvoid: 0, highScore: 0, gameCount: 0, totalScore: 0, avgRank: 0, yakumanCount: 0, hasTenhou: false, hasChiihou: false };
    }

    let currentTop = 0; let maxTop = 0;
    let currentRen = 0; let maxRen = 0;
    let currentAvoid = 0; let maxAvoid = 0;
    let currentLast = 0; let maxLast = 0;       // 連続ラス
    let currentInverse = 0; let maxInverse = 0; // 連続逆連対（3〜4着）
    let highScore = -Infinity;
    let totalScore = 0;
    let minCumulativeScore = Infinity;           // 最も悪い累計スコア
    let totalRank = 0;

    // 役満カウント
    let yakumanCount = 0;
    let hasTenhou = false;
    let hasChiihou = false;

    // Sorting by date is crucial for streak calculation
    userGames.sort((a, b) => new Date(a.date) - new Date(b.date));

    userGames.forEach(g => {
        if (g.rank === 1) currentTop++; else currentTop = 0;
        if (currentTop > maxTop) maxTop = currentTop;

        if (g.rank <= 2) currentRen++; else currentRen = 0;
        if (currentRen > maxRen) maxRen = currentRen;

        if (g.rank < 4) currentAvoid++; else currentAvoid = 0;
        if (currentAvoid > maxAvoid) maxAvoid = currentAvoid;

        // 連続ラス
        if (g.rank === 4) currentLast++; else currentLast = 0;
        if (currentLast > maxLast) maxLast = currentLast;

        // 連続逆連対（3〜4着）
        if (g.rank >= 3) currentInverse++; else currentInverse = 0;
        if (currentInverse > maxInverse) maxInverse = currentInverse;

        if (g.score > highScore) highScore = g.score;

        totalScore += (g.finalScore || 0);
        if (totalScore < minCumulativeScore) minCumulativeScore = totalScore;
        totalRank += g.rank;

        // 役満の集計
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
    totalScore = parseFloat(totalScore.toFixed(1));

    // Firestoreから最高記録を取得してマージ
    const titleRecords = await window.AppStorage.getUserTitleRecords(userName);

    // 称号判定には最高記録を使用
    return {
        userName,
        // 現在の統計値（画面表示用）
        maxTop,
        maxRen,
        maxAvoid,
        maxLast,
        maxInverse,
        highScore,
        gameCount,
        totalScore,
        minCumulativeScore: minCumulativeScore === Infinity ? 0 : minCumulativeScore,
        avgRank,
        yakumanCount,
        hasTenhou,
        hasChiihou,
        // 最高記録（称号判定用）
        maxCumulativeScore: titleRecords ? titleRecords.maxCumulativeScore : totalScore,
        minAverageRank: titleRecords ? titleRecords.minAverageRank : (gameCount >= 30 ? avgRank : 0),
        maxConsecutiveTop: titleRecords ? titleRecords.maxConsecutiveTop : maxTop,
        maxConsecutiveRentai: titleRecords ? titleRecords.maxConsecutiveRentai : maxRen,
        maxConsecutiveAvoidLast: titleRecords ? titleRecords.maxConsecutiveAvoidLast : maxAvoid,
        maxConsecutiveLast: titleRecords ? (titleRecords.maxConsecutiveLast || 0) : maxLast,
        maxConsecutiveInverse: titleRecords ? (titleRecords.maxConsecutiveInverse || 0) : maxInverse,
        maxHighScore: titleRecords ? titleRecords.maxHighScore : highScore,
        maxGameCount: titleRecords ? titleRecords.maxGameCount : gameCount,
        worstCumulativeScore: titleRecords ? (titleRecords.worstCumulativeScore || minCumulativeScore) : minCumulativeScore,
        recordYakumanCount: titleRecords ? titleRecords.yakumanCount : yakumanCount,
        recordHasTenhou: titleRecords ? titleRecords.hasTenhou : hasTenhou,
        recordHasChiihou: titleRecords ? titleRecords.hasChiihou : hasChiihou
    };
}

async function calculateUserTitles(userName, allSessions) {
    const stats = await getUserStats(userName, allSessions);
    if (!stats) return TITLES.filter(t => t.check && t.check({ userName })); // Fallback

    const earnedTitles = [];

    // Special
    TITLES.filter(t => t.category === 'special').forEach(t => {
        if (t.check && t.check(stats)) earnedTitles.push(t);
    });

    // Return BEST title in each category for List View
    // Note: avg_rank titles use the 'check' property, so they are covered by the check logic below if we add a filter for that,
    // OR we can leave them out of "Best" list view if they are too verbose. A "Best" list usually focuses on streaks/scores.
    // Let's stick to the main ones for the small icon list.
    const categories = ['streak_top', 'streak_rentai', 'streak_avoid', 'high_score', 'game_count', 'total_score'];
    const typeMap = {
        'streak_top': stats.maxConsecutiveTop || stats.maxTop,
        'streak_rentai': stats.maxConsecutiveRentai || stats.maxRen,
        'streak_avoid': stats.maxConsecutiveAvoidLast || stats.maxAvoid,
        'high_score': stats.maxHighScore || stats.highScore,
        'game_count': stats.maxGameCount || stats.gameCount,
        'total_score': stats.maxCumulativeScore || stats.totalScore
    };

    categories.forEach(cat => {
        const value = typeMap[cat];
        const potential = TITLES.filter(t => t.category === cat && value >= t.threshold);
        potential.sort((a, b) => b.threshold - a.threshold); // Highest first
        if (potential.length > 0) earnedTitles.push(potential[0]);
    });

    // 不名誉系カテゴリ（値が小さいほど悪い → threshold 以下で取得）
    const shameCategories = ['streak_last', 'streak_inverse'];
    const shameTypeMap = {
        'streak_last': stats.maxConsecutiveLast || stats.maxLast || 0,
        'streak_inverse': stats.maxConsecutiveInverse || stats.maxInverse || 0,
    };

    shameCategories.forEach(cat => {
        const value = shameTypeMap[cat];
        // threshold 以上（ラス3連なら value >= 3）で解除
        const potential = TITLES.filter(t => t.category === cat && value >= t.threshold);
        potential.sort((a, b) => b.threshold - a.threshold);
        if (potential.length > 0) earnedTitles.push(potential[0]);
    });

    // 累計マイナス称号（worstCumulativeScore が threshold 以下で取得）
    const worstScore = stats.worstCumulativeScore ?? stats.minCumulativeScore ?? stats.totalScore;
    const minusPotential = TITLES.filter(t => t.category === 'minus_score' && worstScore <= t.threshold);
    minusPotential.sort((a, b) => a.threshold - b.threshold); // より小さい（悪い）threshold 優先
    if (minusPotential.length > 0) earnedTitles.push(minusPotential[0]);

    // Also need to check 'check' based titles (Average Rank, Founder)
    // Filter for titles that have a 'check' function AND haven't been added yet (though our categories separation is clean)
    TITLES.filter(t => t.check).forEach(t => {
        // Prevent duplicates if by chance it was added (e.g. founder was special)
        if (!earnedTitles.some(et => et.id === t.id)) {
            if (t.check(stats)) earnedTitles.push(t);
        }
    });

    return earnedTitles;
}
// Utility: Show Toast Notification
function showToast(message, duration = 3000) {
    let toast = document.getElementById('app-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'app-toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: rgba(50, 50, 50, 0.9);
            color: #fff;
            padding: 10px 20px;
            border-radius: 4px;
            z-index: 9999;
            font-size: 0.9rem;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s;
            text-align: center;
            white-space: pre-line;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            max-width: 90%;
        `;
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';

    // Clear previous timeout if any mechanism existed, but simpler to just set new one
    setTimeout(() => {
        toast.style.opacity = '0';
    }, duration);
}

// --- マイメンバー管理UI ---

/**
 * ユーザー一覧画面にマイメンバー管理セクションを描画する
 * @param {string} deviceUser - デバイスユーザー名
 * @param {string[]} allUsers - 全ユーザー名の配列
 */
async function renderMyMemberSection(deviceUser, allUsers) {
    // マイメンバーセクションの取得または作成
    let section = document.getElementById('my-member-section');
    if (!section) {
        section = document.createElement('div');
        section.id = 'my-member-section';
    }
    // 毎回 userList の直後に配置（既存要素でも正しい位置に移動）
    if (userList && userList.parentNode) {
        userList.parentNode.insertBefore(section, userList.nextSibling);
    }

    // デバイスユーザー未設定の場合は非表示
    if (!deviceUser) {
        section.innerHTML = '';
        return;
    }

    const myMembers = await window.AppStorage.getMyMembers(deviceUser);

    // 追加可能なユーザー（自分・既存マイメンバー以外）
    const candidates = allUsers.filter(u => u !== deviceUser && !myMembers.includes(u));

    // HTMLを構築
    section.innerHTML = `
        <div style="background:#1e293b; border:1px solid #334155; border-radius:10px; padding:16px; margin-top:20px;">
            <h3 style="color:#e2e8f0; font-size:1rem; margin:0 0 14px 0; display:flex; align-items:center; gap:8px;">
                👥 マイメンバー管理
                <span style="font-size:0.75rem; color:#94a3b8; font-weight:normal;">(${myMembers.length}人登録中)</span>
            </h3>

            <!-- 追加フォーム -->
            <div style="margin-bottom:10px;">
                <div style="font-size:0.8rem; color:#94a3b8; margin-bottom:6px;">メンバーを追加</div>
                <div style="display:flex; gap:8px; align-items:center;">
                    <div style="flex:1; min-width:0;">
                        <input
                            id="my-member-add-input"
                            type="text"
                            placeholder="ユーザー名を入力..."
                            list="my-member-add-candidates"
                            style="width:100%; box-sizing:border-box; padding:8px 12px; background:#0f172a; border:1px solid #475569; border-radius:8px; color:#e2e8f0; font-size:0.9rem;"
                            autocomplete="off"
                        />
                        <datalist id="my-member-add-candidates">
                            ${candidates.map(name => `<option value="${name}">`).join('')}
                        </datalist>
                    </div>
                    <button
                        id="my-member-add-btn"
                        style="padding:8px 16px; background:linear-gradient(135deg,#6366f1,#8b5cf6); color:white; border:none; border-radius:8px; cursor:pointer; font-size:0.9rem; white-space:nowrap; flex-shrink:0;"
                    >追加</button>
                </div>
            </div>

            <!-- 解除フォーム（登録中メンバーがいる場合のみ表示） -->
            ${myMembers.length > 0 ? `
            <div>
                <div style="font-size:0.8rem; color:#94a3b8; margin-bottom:6px;">メンバーを解除</div>
                <div style="display:flex; gap:8px; align-items:center;">
                    <div style="flex:1; min-width:0;">
                        <input
                            id="my-member-remove-input"
                            type="text"
                            placeholder="解除するユーザー名を入力..."
                            list="my-member-remove-candidates"
                            style="width:100%; box-sizing:border-box; padding:8px 12px; background:#0f172a; border:1px solid #ef4444; border-radius:8px; color:#e2e8f0; font-size:0.9rem;"
                            autocomplete="off"
                        />
                        <datalist id="my-member-remove-candidates">
                            ${myMembers.map(name => `<option value="${name}">`).join('')}
                        </datalist>
                    </div>
                    <button
                        id="my-member-remove-btn"
                        style="padding:8px 16px; background:#7f1d1d; color:#fca5a5; border:1px solid #ef4444; border-radius:8px; cursor:pointer; font-size:0.9rem; white-space:nowrap; flex-shrink:0;"
                    >解除</button>
                </div>
            </div>
            ` : ''}
        </div>
    `;

    // 「追加」ボタンのイベント
    const addBtn = document.getElementById('my-member-add-btn');
    const addInput = document.getElementById('my-member-add-input');
    if (addBtn && addInput) {
        const doAdd = async () => {
            const targetName = addInput.value.trim();
            if (!targetName) { showToast('ユーザー名を入力してください'); return; }
            if (targetName === deviceUser) { showToast('自分自身は追加できません'); return; }
            if (myMembers.includes(targetName)) { showToast(`「${targetName}」はすでにマイメンバーです`); return; }
            if (!allUsers.includes(targetName)) { showToast(`「${targetName}」というユーザーは見つかりません`); return; }
            const success = await window.AppStorage.addMyMember(deviceUser, targetName);
            if (success) {
                addInput.value = '';
                showToast(`「${targetName}」をマイメンバーに追加しました`);
                // ユーザー一覧とセット作成フォームの両方を更新
                await Promise.all([renderUserList(), renderUserOptions()]);
            } else {
                showToast('追加に失敗しました');
            }
        };
        addBtn.addEventListener('click', doAdd);
        addInput.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); });
    }

    // 「解除」ボタンのイベント
    const removeBtn = document.getElementById('my-member-remove-btn');
    const removeInput = document.getElementById('my-member-remove-input');
    if (removeBtn && removeInput) {
        const doRemove = async () => {
            const targetName = removeInput.value.trim();
            if (!targetName) { showToast('解除するユーザー名を入力してください'); return; }
            if (!myMembers.includes(targetName)) { showToast(`「${targetName}」はマイメンバーに登録されていません`); return; }
            if (confirm(`「${targetName}」をマイメンバーから解除しますか？`)) {
                await window.AppStorage.removeMyMember(deviceUser, targetName);
                showToast(`「${targetName}」をマイメンバーから解除しました`);
                await Promise.all([renderUserList(), renderUserOptions()]);
            }
        };
        removeBtn.addEventListener('click', doRemove);
        removeInput.addEventListener('keydown', e => { if (e.key === 'Enter') doRemove(); });
    }
}

async function renderUserList() {
    if (!userList) return;

    // Fetch users with details AND all sessions for stats calculation
    // Note: We don't need getUsersWithDetails anymore since manual titles are removed.
    // But we need sessions to calculate titles.
    const [allUsers, sessions] = await Promise.all([
        window.AppStorage.getUsers(),
        window.AppStorage.getSessions()
    ]);

    // Get Device User
    const deviceUser = localStorage.getItem('deviceUser');
    const isAdmin = deviceUser === 'ヒロム';

    // マイメンバーフィルタリング: 管理者は全員表示、一般ユーザーは自分+マイメンバーのみ
    let myMembers = [];
    let users = allUsers;
    if (!isAdmin && deviceUser) {
        myMembers = await window.AppStorage.getMyMembers(deviceUser);
        const visibleNames = new Set([deviceUser, ...myMembers]);
        users = allUsers.filter(u => visibleNames.has(u));
        // 表示順: 自分を先頭、次にマイメンバーの順
        users.sort((a, b) => {
            if (a === deviceUser) return -1;
            if (b === deviceUser) return 1;
            return 0; // マイメンバー間は登録順を維持
        });
    } else if (!deviceUser) {
        // デバイスユーザー未設定は自分を特定できないので全員非表示
        users = [];
    }

    // Toggle Add User Form Visibility
    const addUserSection = document.getElementById('add-user-section');
    const userManagementHeader = document.querySelector('#users h2');

    if (newUserNameInput && addUserBtn) {
        if (isAdmin) {
            newUserNameInput.style.display = 'inline-block';
            addUserBtn.style.display = 'inline-block';
            if (userManagementHeader) userManagementHeader.style.display = 'block';
        } else {
            newUserNameInput.style.display = 'none';
            addUserBtn.style.display = 'none';
            if (userManagementHeader) userManagementHeader.style.display = 'none';
        }
    }

    // 自分をユーザーリストから除外（別セクションで表示するため）
    const usersWithoutSelf = users.filter(u => u !== deviceUser);

    // ---- 自分専用セクション ----
    // 自分を登録ユーザー一覧から分離して、専用セクションに表示する
    const selfSectionId = 'self-user-section';
    let selfSection = document.getElementById(selfSectionId);
    if (!selfSection) {
        selfSection = document.createElement('div');
        selfSection.id = selfSectionId;
        if (userList && userList.parentNode) {
            userList.parentNode.insertBefore(selfSection, userList);
        }
    }

    if (deviceUser && allUsers.includes(deviceUser)) {
        const selfStats = await getUserStats(deviceUser, sessions);
        const selfGameCount = selfStats ? selfStats.gameCount : 0;
        const selfTotalScore = selfStats ? selfStats.totalScore : 0;
        const selfAvgRank = selfStats && selfStats.avgRank > 0 ? selfStats.avgRank.toFixed(2) : '-';
        const selfScoreClass = selfTotalScore >= 0 ? 'score-positive' : 'score-negative';
        const selfScoreStr = selfTotalScore > 0 ? `+${parseFloat(selfTotalScore.toFixed(1))}` : `${parseFloat(selfTotalScore.toFixed(1))}`;

        const selfTitles = await calculateUserTitles(deviceUser, sessions);
        const rankPriority2 = { gold: 4, silver: 3, bronze: 2, special: 2, shame: 1 };
        const bestByCategory2 = new Map();
        selfTitles.forEach(t => {
            const prev = bestByCategory2.get(t.category);
            if (!prev || (rankPriority2[t.rank] ?? 0) > (rankPriority2[prev.rank] ?? 0)) {
                bestByCategory2.set(t.category, t);
            }
        });
        const selfTitleIcons = Array.from(bestByCategory2.values()).map(t =>
            `<span class="title-icon" data-name="${t.name}" data-desc="${t.description}" style="margin-right:2px; cursor:pointer;" title="${t.name}\n${t.description}">${t.icon}</span>`
        ).join('');

        const selfScoreColor = selfTotalScore > 0 ? '#4ade80' : (selfTotalScore < 0 ? '#f87171' : '#94a3b8');
        const selfScoreSign = selfTotalScore > 0 ? '+' : '';

        // マイメンバーがいる場合のみ「登録ユーザー」見出しを表示
        const hasMemberSection = usersWithoutSelf.length > 0;

        selfSection.innerHTML = `
            <!-- 自分セクション -->
            <div style="margin-bottom:16px;">
                <div style="font-size:0.75rem; color:#94a3b8; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px; padding-left:2px;">マイアカウント</div>
                <ul style="list-style:none; padding:0; margin:0;">
                    <li style="background:#1e293b; border:1px solid #334155; border-radius:10px; padding:14px 16px; display:flex; justify-content:space-between; align-items:center; width:100%;">
                        <div class="user-info-area" style="display:flex; align-items:center; gap:8px; flex:1; min-width:0;">
                            <span class="user-name-link" data-user="${deviceUser}" style="cursor:pointer; text-decoration:underline; font-size:1.0rem; font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${deviceUser}</span>
                            <div style="display:flex; align-items:center; flex-shrink:0;">
                                ${selfTitleIcons ? `<div style="font-size:1.0rem;">${selfTitleIcons}</div>` : ''}
                            </div>
                        </div>
                        <div style="display:flex; align-items:center; gap:10px; flex-shrink:0;">
                            <div class="user-stats-box">
                                <span class="stat-item user-game-count">${selfGameCount}戦</span>
                                <div class="stat-separator"></div>
                                <span class="stat-item user-total-score" style="color:${selfScoreColor}; font-weight:bold;">${selfScoreSign}${selfTotalScore}</span>
                                <div class="stat-separator"></div>
                                <span class="stat-item user-avg-rank">Avg <span style="color:#e2e8f0;">${selfAvgRank}</span></span>
                            </div>
                        </div>
                    </li>
                </ul>
            </div>

            <!-- 区切り（マイメンバーがいる場合） -->
            ${hasMemberSection ? `
            <div style="position:relative; text-align:center; margin:20px 0 14px;">
                <hr style="border:none; border-top:1px solid #334155; margin:0; position:absolute; top:50%; width:100%; z-index:1;">
                <span style="background:var(--bg-color, #0f172a); padding:0 12px; color:#64748b; font-size:0.7rem; font-weight:bold; letter-spacing:2px; position:relative; z-index:2;">登録ユーザー</span>
            </div>
            ` : ''}
        `;

        // クリックで詳細へ
        selfSection.querySelector('.user-name-link').addEventListener('click', () => openUserDetail(deviceUser));
        // タイトルアイコンのツールチップ
        selfSection.querySelectorAll('.title-icon').forEach(icon => {
            icon.addEventListener('click', (e) => {
                e.stopPropagation();
                showToast(`【${icon.dataset.name}】\n${icon.dataset.desc}`);
            });
        });
    } else {
        selfSection.innerHTML = '';
    }

    userList.innerHTML = '';

    const listItems = await Promise.all(usersWithoutSelf.map(async user => {
        // Calculate Stats using helper
        const stats = await getUserStats(user, sessions);
        const gameCount = stats ? stats.gameCount : 0;
        const totalScore = stats ? stats.totalScore : 0;
        const avgRank = stats && stats.avgRank > 0 ? stats.avgRank.toFixed(2) : '-';

        // 称号を取得し、カテゴリごとに最高ランクのみ残す（ユーザー一覧表示用）
        const myTitles = await calculateUserTitles(user, sessions);
        const rankPriority = { gold: 4, silver: 3, bronze: 2, special: 2, shame: 1 };
        const bestByCategory = new Map();
        myTitles.forEach(t => {
            const prev = bestByCategory.get(t.category);
            if (!prev || (rankPriority[t.rank] ?? 0) > (rankPriority[prev.rank] ?? 0)) {
                bestByCategory.set(t.category, t);
            }
        });
        const displayTitles = Array.from(bestByCategory.values());

        const titleIcons = displayTitles.map(t =>
            `<span class="title-icon" data-name="${t.name}" data-desc="${t.description}" style="margin-right:2px; cursor:pointer;" title="${t.name}\n${t.description}">${t.icon}</span>`
        ).join('');

        const li = document.createElement('li');

        let deleteBtnHtml = '';
        if (isAdmin) {
            deleteBtnHtml = `<button class="btn-danger" data-user="${user}" style="margin-left:5px; padding:2px 8px; font-size:0.7rem;">削除</button>`;
        }

        // Score Color
        const scoreColor = totalScore > 0 ? '#4ade80' : (totalScore < 0 ? '#f87171' : '#94a3b8');
        const scoreSign = totalScore > 0 ? '+' : '';

        // Rich List Item Layout
        // Use classes for responsive layout
        li.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                <div class="user-info-area" style="display:flex; align-items:center; gap:8px; flex:1; min-width:0;">
                    <span class="user-name-link" style="cursor:pointer; text-decoration:underline; font-size:1.0rem; font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${user}</span>
                    <div style="display:flex; align-items:center; flex-shrink:0;">
                         ${titleIcons ? `<div style="font-size:1.0rem;">${titleIcons}</div>` : ''}
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:10px; flex-shrink:0;">
                    <div class="user-stats-box">
                        <span class="stat-item user-game-count">${gameCount}戦</span>
                        <div class="stat-separator"></div>
                        <span class="stat-item user-total-score" style="color:${scoreColor}; font-weight:bold;">${scoreSign}${totalScore}</span>
                        <div class="stat-separator"></div>
                        <span class="stat-item user-avg-rank">Avg <span style="color:#e2e8f0;">${avgRank}</span></span>
                    </div>
                    ${deleteBtnHtml}
                </div>
            </div>
        `;

        // Navigation Handler
        li.querySelector('.user-name-link').addEventListener('click', (e) => {
            e.stopPropagation();
            openUserDetail(user);
        });

        // Title Icon Click Handler (Delegation within the item, or just attach to spans)
        li.querySelectorAll('.title-icon').forEach(icon => {
            icon.addEventListener('click', (e) => {
                e.stopPropagation(); // Stop bubbling so row click (if enabled) doesn't fire
                const name = icon.dataset.name;
                const desc = icon.dataset.desc;
                showToast(`【${name}】\n${desc}`);
            });
        });

        return li;
    }));

    listItems.forEach(li => userList.appendChild(li));

    // ユーザー一覧描画後にマイメンバー管理UIを描画
    // 表示順: 自分 → マイメンバー → マイメンバー管理
    await renderMyMemberSection(deviceUser, allUsers);

    userList.querySelectorAll('.btn-danger').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const button = e.currentTarget;
            const user = button.dataset.user;

            // Double check logic (though UI hidden is first line of defense)
            const currentDeviceUser = localStorage.getItem('deviceUser');

            // Permission check:
            // 1. Must be logged in
            // 2. Can delete ONLY if Admin ('ヒロム')
            const isMegaAdmin = currentDeviceUser === 'ヒロム';

            if (!currentDeviceUser || !isMegaAdmin) {
                alert("ユーザーを削除する権限がありません。\n管理者（ヒロム）のみが削除可能です。");
                return;
            }

            if (confirm(`ユーザー "${user}" を削除しますか？`)) {
                await window.AppStorage.removeUser(user);
                // If I deleted myself, clear device user
                if (currentDeviceUser === user) {
                    localStorage.removeItem('deviceUser');
                }

                await renderUserOptions();
                await renderUserList();
            }
        });
    });
}

// --- User Detail ---
const userDetailName = document.getElementById('user-detail-name');
const userTotalScore = document.getElementById('user-total-score');
const userHistoryList = document.getElementById('user-history-list');
const backToUsersBtn = document.getElementById('back-to-users');

if (backToUsersBtn) {
    backToUsersBtn.addEventListener('click', () => {
        navigateTo('users');
    });
}

// function to open user detail
async function openUserDetail(userName) {
    userDetailName.textContent = userName;

    // Fetch Sessions & Stats
    const sessions = await window.AppStorage.getSessions();
    const stats = await getUserStats(userName, sessions);

    // -------------------------------------------------------------------------
    // RENDER TITLE COLLECTION
    // -------------------------------------------------------------------------
    const container = document.getElementById('user-detail');

    // Create or Get Container
    let collectionContainer = document.getElementById('title-collection-container');
    if (!collectionContainer) {
        collectionContainer = document.createElement('div');
        collectionContainer.id = 'title-collection-container';
        collectionContainer.style.cssText = 'margin: 0 0 25px 0; background: #1e293b; padding: 15px; border-radius: 8px; border: 1px solid #334155;';

        // Insert AFTER the cumulative score card
        const scoreCard = document.getElementById('cumulative-score-card');
        if (scoreCard && scoreCard.parentNode) {
            if (scoreCard.nextSibling) {
                scoreCard.parentNode.insertBefore(collectionContainer, scoreCard.nextSibling);
            } else {
                scoreCard.parentNode.appendChild(collectionContainer);
            }
        } else {
            // Fallback
            container.appendChild(collectionContainer);
        }
    }

    collectionContainer.innerHTML = '<h3 style="color:#e2e8f0; font-size:1rem; margin:0 0 15px 0; border-bottom:1px solid #334155; padding-bottom:10px;">称号コレクション</h3>';

    const grid = document.createElement('div');
    grid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 10px;';

    // Pre-calculate unlocked status
    const typeMap = stats ? {
        'streak_top': stats.maxConsecutiveTop || stats.maxTop,
        'streak_rentai': stats.maxConsecutiveRentai || stats.maxRen,
        'streak_avoid': stats.maxConsecutiveAvoidLast || stats.maxAvoid,
        'high_score': stats.maxHighScore || stats.highScore,
        'game_count': stats.maxGameCount || stats.gameCount,
        'total_score': stats.maxCumulativeScore || stats.totalScore,
        // 不名誉系（大きいほど悪い連続型）
        'streak_last': stats.maxConsecutiveLast || stats.maxLast || 0,
        'streak_inverse': stats.maxConsecutiveInverse || stats.maxInverse || 0,
        // avg_rank は 'check' 処理
    } : {};

    // 称号カードのソート順（不名誉系を末尾に）
    const catOrder = ['special', 'yakuman', 'game_count', 'total_score', 'streak_top', 'streak_rentai', 'streak_avoid', 'high_score', 'avg_rank', 'streak_last', 'streak_inverse', 'minus_score'];
    const rankOrder = ['bronze', 'silver', 'gold', 'special', 'shame'];

    const sortedTitles = [...TITLES].sort((a, b) => {
        const catDiff = catOrder.indexOf(a.category) - catOrder.indexOf(b.category);
        if (catDiff !== 0) return catDiff;
        return rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank);
    });

    sortedTitles.forEach(title => {
        // Hide Founder title for anyone else
        if (title.id === 'founder' && userName !== 'ヒロム') return;

        let isUnlocked = false;
        // Check-based titles (special, yakuman, avg_rank, etc.)
        if (title.check) {
            if (stats && title.check(stats)) isUnlocked = true;
        }
        // Threshold-based titles
        else if (title.threshold !== undefined) {
            if (title.category === 'minus_score') {
                // 累計マイナス称号は最悪累計スコアが threshold 以下で解除
                const worstScore = stats
                    ? (stats.worstCumulativeScore ?? stats.minCumulativeScore ?? stats.totalScore ?? 0)
                    : 0;
                if (worstScore <= title.threshold) isUnlocked = true;
            } else {
                // 通常の間口比較（連続ラス・逆連対も正値 threshold なので >= でOK）
                const userVal = typeMap[title.category] ?? 0;
                if (userVal >= title.threshold) isUnlocked = true;
            }
        }

        const card = document.createElement('div');

        // Styling
        let borderColor = '#334155';
        let bgColor = 'rgba(30, 41, 59, 0.5)';
        let opacity = '0.5';

        if (isUnlocked) {
            opacity = '1';
            bgColor = 'rgba(51, 65, 85, 0.8)';
            if (title.rank === 'gold') borderColor = '#ffd700';
            else if (title.rank === 'silver') borderColor = '#c0c0c0';
            else if (title.rank === 'bronze') borderColor = '#cd7f32';
            else if (title.rank === 'special') borderColor = '#a855f7';
            else if (title.rank === 'shame') { borderColor = '#dc2626'; bgColor = 'rgba(127, 29, 29, 0.4)'; }
        }

        card.style.cssText = `
            border: 2px solid ${borderColor};
            background: ${bgColor};
            border-radius: 8px;
            padding: 10px 5px;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 5px;
            opacity: ${opacity};
            min-height: 80px;
            cursor: pointer;
            transition: transform 0.1s;
        `;

        // Hover effect for desktop
        card.onmouseover = () => card.style.transform = 'scale(1.02)';
        card.onmouseout = () => card.style.transform = 'scale(1)';

        if (isUnlocked) {
            card.innerHTML = `
                <div style="font-size: 1.8rem;">${title.icon}</div>
                <div style="font-size: 0.7rem; font-weight: bold; color: #fff; line-height:1.2;">${title.name}</div>
            `;
            card.title = `${title.name}\n${title.description}\nランク: ${title.rank.toUpperCase()}`;
        } else {
            // Masked
            card.innerHTML = `
                <div style="font-size: 1.8rem; filter: grayscale(100%);">❓</div>
                <div style="font-size: 0.7rem; font-weight: bold; color: #64748b;">???</div>
            `;
            card.title = "未獲得";
        }

        // Add Click Listener for Toast
        card.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isUnlocked) {
                showToast(`【${title.name}】\n${title.description}\nランク: ${title.rank.toUpperCase()}`);
            } else {
                showToast(`【未獲得】\n条件を満たすと獲得できます`);
            }
        });

        grid.appendChild(card);
    });

    collectionContainer.appendChild(grid);

    // -----------------------------------------------------------------------
    // 期間フィルターUI を生成
    // -----------------------------------------------------------------------
    const filterContainer = document.getElementById('user-detail-period-filter');
    if (filterContainer) {
        const FILTERS = [
            { key: 'all', label: '全期間' },
            { key: 'last10', label: '直近10半荘' },
            { key: 'last50', label: '直近50半荘' },
            { key: 'last100', label: '直近100半荘' },
            { key: '1m', label: '1ヶ月' },
            { key: '6m', label: '半年' },
            { key: '1y', label: '1年' },
            { key: 'custom', label: 'カスタム' },
        ];

        // フィルター状態をページ単位で保持
        let currentFilter = 'all';
        let customFrom = '';
        let customTo = '';

        // セッションをフラットな半荘単位で扱うため全ユーザーセッションを先取り
        const allSess = await window.AppStorage.getSessions();
        const allUserSess = allSess.filter(s =>
            (s.players && s.players.includes(userName)) ||
            (s.games && s.games.some(g => g.players.some(p => p.name === userName)))
        );

        /**
         * フィルターを適用して画面を再描画する
         */
        async function applyFilter(key, fromVal, toVal) {
            currentFilter = key;
            customFrom = fromVal || customFrom;
            customTo = toVal || customTo;

            const filtered = filterSessionsByPeriod(allUserSess, key, { from: customFrom, to: customTo });
            await renderUserDetail(userName, filtered, key);

            // スコアカードのラベルをフィルターに合わせて更新
            const labelMap = {
                all: '累計スコア', last10: '直近10半荘スコア', last50: '直近50半荘スコア',
                last100: '直近100半荘スコア', '1m': '直近1ヶ月スコア', '6m': '直近半年スコア',
                '1y': '直近1年スコア', custom: '期間スコア'
            };
            const amountLabelMap = {
                all: '累計収支', last10: '直近10半荘収支', last50: '直近50半荘収支',
                last100: '直近100半荘収支', '1m': '直近1ヶ月収支', '6m': '直近半年収支',
                '1y': '直近1年収支', custom: '期間収支'
            };
            const cardLabel = document.getElementById('cumulative-score-card')?.querySelector('[style*="border-radius: 20px"]');
            if (cardLabel) cardLabel.textContent = labelMap[key] || '期間スコア';
            const amountLabel = document.getElementById('amount-section-label');
            if (amountLabel) amountLabel.textContent = amountLabelMap[key] || '期間収支';

            // ボタン選択状態を更新
            filterContainer.querySelectorAll('.period-btn').forEach(btn => {
                const isActive = btn.dataset.key === key;
                btn.style.background = isActive ? 'var(--primary-color, #bb86fc)' : 'rgba(51,65,85,0.8)';
                btn.style.color = isActive ? '#000' : '#e2e8f0';
                btn.style.borderColor = isActive ? 'var(--primary-color, #bb86fc)' : '#475569';
                btn.style.fontWeight = isActive ? 'bold' : 'normal';
            });

            // カスタム欄の表示/非表示
            const customArea = document.getElementById('period-custom-area');
            if (customArea) customArea.style.display = (key === 'custom') ? 'flex' : 'none';
        }

        // ボタン行を構築
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px;';

        FILTERS.forEach(f => {
            const btn = document.createElement('button');
            btn.className = 'period-btn';
            btn.dataset.key = f.key;
            btn.textContent = f.label;
            btn.style.cssText = `
                padding: 4px 12px; border-radius: 20px; border: 1px solid #475569;
                background: rgba(51,65,85,0.8); color: #e2e8f0;
                font-size: 0.78rem; cursor: pointer; transition: all 0.15s;
            `;
            btn.addEventListener('click', () => applyFilter(f.key));
            btnRow.appendChild(btn);
        });

        // カスタム日付入力欄
        const customArea = document.createElement('div');
        customArea.id = 'period-custom-area';
        customArea.style.cssText = 'display:none; align-items:center; gap:8px; flex-wrap:wrap; margin-top:4px;';
        customArea.innerHTML = `
            <span style="font-size:0.8rem; color:#94a3b8;">期間：</span>
            <input type="date" id="period-from" style="background:#1e293b; border:1px solid #475569; color:#e2e8f0; border-radius:6px; padding:3px 8px; font-size:0.8rem;">
            <span style="color:#94a3b8;">〜</span>
            <input type="date" id="period-to"   style="background:#1e293b; border:1px solid #475569; color:#e2e8f0; border-radius:6px; padding:3px 8px; font-size:0.8rem;">
            <button id="period-custom-apply" style="padding:3px 12px; border-radius:6px; background:var(--primary-color,#bb86fc); color:#000; border:none; font-size:0.8rem; cursor:pointer; font-weight:bold;">適用</button>
        `;

        filterContainer.innerHTML = '';
        filterContainer.appendChild(btnRow);
        filterContainer.appendChild(customArea);

        // カスタム適用ボタン
        customArea.querySelector('#period-custom-apply').addEventListener('click', () => {
            const f = document.getElementById('period-from').value;
            const t = document.getElementById('period-to').value;
            applyFilter('custom', f, t);
        });

        // 初期表示（全期間）
        await applyFilter('all');
    } else {
        await renderUserDetail(userName);
    }

    navigateTo('user-detail');
}

window.openUserDetail = openUserDetail;

/**
 * 期間フィルター処理ヘルパー
 * @param {Array} allUserSessions - ユーザーが参加したセッション全件（時系列ソート済み）
 * @param {string} filterKey - フィルターキー
 * @param {{from: string, to: string}} customRange - カスタム期間（filterKey==='custom' のとき参照）
 * @returns {Array} フィルター後のセッション
 */
function filterSessionsByPeriod(allUserSessions, filterKey, customRange = {}) {
    if (!filterKey || filterKey === 'all') return allUserSessions;

    const sorted = [...allUserSessions].sort((a, b) => new Date(a.date) - new Date(b.date));

    // 直近N半荘（ゲーム数がちょうどNになるように最古セッションを切り詰め）
    const lastNGames = (n) => {
        let remaining = n;
        const result = [];
        for (let i = sorted.length - 1; i >= 0; i--) {
            const session = sorted[i];
            const games = (session.games && session.games.length) || 0;
            if (games <= remaining) {
                // セッション全体が必要数の範囲内 → 丸ごと追加
                result.unshift(session);
                remaining -= games;
            } else {
                // このセッションの新しい方から remaining 件だけ取り出す
                const trimmed = { ...session, games: session.games.slice(-remaining) };
                result.unshift(trimmed);
                remaining = 0;
            }
            if (remaining <= 0) break;
        }
        return result;
    };

    if (filterKey === 'last10') return lastNGames(10);
    if (filterKey === 'last50') return lastNGames(50);
    if (filterKey === 'last100') return lastNGames(100);

    const now = new Date();
    let cutoff;
    if (filterKey === '1m') { cutoff = new Date(now); cutoff.setMonth(cutoff.getMonth() - 1); }
    if (filterKey === '6m') { cutoff = new Date(now); cutoff.setMonth(cutoff.getMonth() - 6); }
    if (filterKey === '1y') { cutoff = new Date(now); cutoff.setFullYear(cutoff.getFullYear() - 1); }
    if (cutoff) return sorted.filter(s => new Date(s.date) >= cutoff);

    if (filterKey === 'custom') {
        const from = customRange.from ? new Date(customRange.from) : null;
        const to = customRange.to ? new Date(customRange.to + 'T23:59:59') : null;
        return sorted.filter(s => {
            const d = new Date(s.date);
            if (from && d < from) return false;
            if (to && d > to) return false;
            return true;
        });
    }

    return allUserSessions;
}

async function renderUserDetail(userName, filteredSessions = null, filterKey = 'all') {
    const sessions = await window.AppStorage.getSessions();
    // ユーザーが参加した全セッションを取得
    const allUserSessions = sessions.filter(s =>
        (s.players && s.players.includes(userName)) ||
        (s.games && s.games.some(g => g.players.some(p => p.name === userName)))
    );

    // フィルター済みセッションが渡された場合はそちらを使う
    const userSessions = filteredSessions !== null ? filteredSessions : allUserSessions;


    // Sort by date (newest first for display)
    userSessions.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Calculate cumulative score by processing in chronological order
    const chronological = [...userSessions].sort((a, b) => new Date(a.date) - new Date(b.date));
    let totalScore = 0;
    const sessionScores = new Map();

    chronological.forEach(session => {
        let sessionScore = 0;
        session.games.forEach(game => {
            const pData = game.players.find(p => p.name === userName);
            if (pData) {
                sessionScore += pData.finalScore;
            }
        });
        totalScore += sessionScore;
        sessionScores.set(session.id, sessionScore);
    });

    // Build HTML with sessions in newest-first order
    let html = '';
    userSessions.forEach(session => {
        const sessionScore = sessionScores.get(session.id);
        const score = parseFloat(sessionScore.toFixed(1));
        const scoreClass = score >= 0 ? 'score-positive' : 'score-negative';
        const scoreStr = score > 0 ? `+${score}` : `${score}`;

        // Calculate amount based on session rate
        const rate = session.rate || 0;
        let amountHtml = '';
        if (rate > 0) {
            const amount = Math.round(sessionScore * rate * 10);
            const amountClass = amount >= 0 ? 'score-positive' : 'score-negative';
            const amountStr = amount > 0 ? `+${amount}` : `${amount}`;
            amountHtml = `<td class="${amountClass}">${amountStr}</td>`;
        } else {
            amountHtml = '<td>-</td>';
        }

        // Calculate rank counts for this session
        const rankCounts = [0, 0, 0, 0];
        session.games.forEach(game => {
            const pData = game.players.find(p => p.name === userName);
            if (pData && pData.rank >= 1 && pData.rank <= 4) {
                rankCounts[pData.rank - 1]++;
            }
        });

        const currentDeviceUser = localStorage.getItem('deviceUser');
        // セッション詳細はopenSession内で閲覧権限を制御するため、常にクリック可能にする
        const rowStyle = 'style="cursor:pointer;"';
        const rowAction = `onclick="openSession(${session.id})"`;

        html += `
            <tr ${rowStyle} ${rowAction}>
                <td>${session.date}</td>
                <td class="${scoreClass}">${scoreStr}</td>
                ${amountHtml}
                <td>${rankCounts[0]}</td>
                <td>${rankCounts[1]}</td>
                <td>${rankCounts[2]}</td>
                <td>${rankCounts[3]}</td>
            </tr>
        `;
    });

    // Apply basic score display
    const displayScore = parseFloat(totalScore.toFixed(1));
    userTotalScore.textContent = displayScore > 0 ? `+${displayScore}` : `${displayScore}`;
    userTotalScore.className = displayScore >= 0 ? 'score-positive' : 'score-negative';

    // Get elements for rich styling
    const scoreCard = document.getElementById('cumulative-score-card');
    const scoreIcon = document.getElementById('score-icon');

    if (scoreCard && scoreIcon) {
        // Apply gradient and styling based on score with softer, app-matching colors
        if (totalScore > 100) {
            scoreCard.style.background = 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)';
            scoreCard.style.borderColor = '#a78bfa';
            scoreIcon.textContent = '🔥';
        } else if (totalScore > 0) {
            scoreCard.style.background = 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)';
            scoreCard.style.borderColor = '#c4b5fd';
            scoreIcon.textContent = '📈';
        } else if (totalScore === 0) {
            scoreCard.style.background = 'linear-gradient(135deg, #6b7280 0%, #9ca3af 100%)';
            scoreCard.style.borderColor = '#d1d5db';
            scoreIcon.textContent = '⚖️';
        } else if (totalScore > -100) {
            scoreCard.style.background = 'linear-gradient(135deg, #f472b6 0%, #fb7185 100%)';
            scoreCard.style.borderColor = '#fda4af';
            scoreIcon.textContent = '📉';
        } else {
            scoreCard.style.background = 'linear-gradient(135deg, #fb7185 0%, #fda4af 100%)';
            scoreCard.style.borderColor = '#fecdd3';
            scoreIcon.textContent = '⚠️';
        }
    }

    // --- スパークライングラフを描画 ---
    const sparklineContainer = document.getElementById('score-sparkline-container');
    if (sparklineContainer) {
        // 毎回必ずリセット（前回フィルターの値が残らないようにする）
        let points = [];
        let labelText = '';

        // lastN フィルター時はゲーム単位、それ以外はセッション単位
        const isLastN = ['last10', 'last50', 'last100'].includes(filterKey);
        if (isLastN) {
            // ゲーム(半荘)単位で直近5回分を取得
            const allGamesList = [];
            chronological.forEach(session => {
                session.games.forEach(game => {
                    const p = game.players.find(x => x.name === userName);
                    if (p) {
                        allGamesList.push(p.finalScore);
                    }
                });
            });
            const recentGames = allGamesList; // フィルター済み全件を使用（スコアカードと一致させる）
            if (recentGames.length > 0) {
                // 初期値0を除外したいため、配列は空にしてポイントを積み上げる
                points = [];
                let currentTotal = 0;
                recentGames.forEach(score => {
                    currentTotal += score;
                    points.push(parseFloat(currentTotal.toFixed(1)));
                });
                labelText = `直近${recentGames.length}半荘のスコア遷移`;
            }
        } else {
            // セッション(セット)単位で取得（Mapを使わず直接計算してスコアカードと一致させる）
            if (chronological.length >= 1) {
                points = [];
                let currentTotal = 0;
                chronological.forEach(session => {
                    let sessionScore = 0;
                    (session.games || []).forEach(game => {
                        const p = game.players ? game.players.find(x => x.name === userName) : null;
                        if (p) sessionScore += p.finalScore;
                    });
                    currentTotal += sessionScore;
                    points.push(parseFloat(currentTotal.toFixed(1)));
                });
                labelText = `直近${chronological.length}セットのスコア遷移`;
            }
        }

        if (points.length >= 2) {
            // SVGのサイズ
            const svgW = 280;
            const svgH = 90;        // ラベルエリア分サイズを拡張
            const padX = 24;
            const padY = 6;
            const labelAreaH = 20;  // 上部にラベル専用エリアを確保
            const chartW = svgW - padX * 2;
            const chartH = svgH - padY * 2 - labelAreaH; // ラベルエリア公发

            // 0 のラインも必ずグラフ領域に収めるように min / max に 0 を含める
            const minVal = Math.min(0, ...points);
            const maxVal = Math.max(0, ...points);
            const range = maxVal - minVal || 1;

            // 座標変換関数（クラシックエリアは labelAreaH 下に）
            const toX = i => padX + (i / (points.length - 1)) * chartW;
            const toY = v => labelAreaH + padY + chartH - ((v - minVal) / range) * chartH;

            // 0ラインのY座標
            const zeroY = toY(0);

            // ポリラインの座標
            const polylinePoints = points.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');

            // 塗りつぶし用のパス
            const lastX = toX(points.length - 1);
            const firstX = toX(0);

            // 線・塗りつぶしは背景色に関わらず白系で統一（コントラスト確保）
            const lineColor = 'rgba(255,255,255,0.95)';
            const fillColor = 'rgba(255,255,255,0.15)';

            // 最大値・最小値・最終値のインデックス
            const maxIndex = points.indexOf(Math.max(...points));
            const minIndex = points.indexOf(Math.min(...points));
            const lastIndex = points.length - 1;

            // 表示するラベルを優先度順に確定（近すぎる場合は低優先を省略）
            const MIN_LABEL_DIST = 42; // ラベル間の最小X距離（px）
            const candidates = [
                { idx: lastIndex, priority: 3 }, // 最終値（最高優先）
                { idx: maxIndex, priority: 2 }, // 最大値
                { idx: minIndex, priority: 1 }, // 最小値
            ];
            // 同じインデックスが重複する候補を除外（例：最大値=最終値のとき）
            const unique = candidates.filter(
                (c, i, arr) => arr.findIndex(x => x.idx === c.idx) === i
            );
            const confirmedLabels = new Set();
            unique.sort((a, b) => b.priority - a.priority).forEach(c => {
                const cx = toX(c.idx);
                const tooClose = [...confirmedLabels].some(
                    fi => Math.abs(toX(fi) - cx) < MIN_LABEL_DIST
                );
                if (!tooClose) confirmedLabels.add(c.idx);
            });

            let dotLabels = '';
            points.forEach((v, i) => {
                const x = toX(i);
                const y = toY(v);
                const labelColor = 'rgba(255,255,255,0.9)';

                // 最大値・最小値・最終値のみラベルを表示（重複回避済み）
                const showLabel = confirmedLabels.has(i);

                const sign = v > 0 ? '+' : '';
                const labelText = `${sign}${v}`;

                // ラベルは常にドット中心でセンタリング
                const textAnchor = 'middle';
                const labelX = x;


                if (showLabel) {
                    // 文字幅を近似してボックスサイズを計算（1文字≈5.5px）
                    const charWidth = 5.5;
                    const boxPad = 3;
                    const textW = labelText.length * charWidth + boxPad * 2;
                    const textH = 13;
                    // ラベルは常にラベルエリア内(グラフ線の上)に固定配置
                    const lY = labelAreaH - 3;
                    // ボックスX: 中央配置、SVG端でクランプ
                    const boxX = Math.max(0, Math.min(svgW - textW, x - textW / 2));
                    const centeredTextX = boxX + textW / 2;
                    // コネクター線（ラベルボックス底面からドットまで）
                    const connectorTop = lY + 2;
                    const connectorBot = y - 6;
                    if (connectorTop < connectorBot) {
                        dotLabels += `<line x1="${x}" y1="${connectorTop}" x2="${x}" y2="${connectorBot}" stroke="rgba(255,255,255,0.5)" stroke-width="1" stroke-dasharray="2,1"/>`;
                    }
                    // 背景ボックス（半透明黒）→ 前景テキスト（白）の順で描画
                    dotLabels += `<rect x="${boxX}" y="${lY - textH + 2}" width="${textW}" height="${textH}" rx="3" fill="rgba(0,0,0,0.5)"/>`;
                    dotLabels += `<text x="${centeredTextX}" y="${lY}" text-anchor="middle" font-size="9" fill="rgba(255,255,255,0.95)" font-weight="bold">${labelText}</text>`;
                }
                // ラベルありは大きめの目立つ白丸、なしは小さい山
                dotLabels += `<circle cx="${x}" cy="${y}" r="${showLabel ? 5 : 2}" fill="rgba(255,255,255,${showLabel ? 1 : 0.7})" stroke="rgba(255,255,255,0.4)" stroke-width="${showLabel ? 2 : 0}"/>`;
            });


            sparklineContainer.innerHTML = `
                <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.15);">
                        <div style="font-size: 0.75rem; color: rgba(255,255,255,0.5); margin-bottom: 8px; letter-spacing: 0.5px;">
                        ${labelText}
                        </div>
                    <svg width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" style="overflow:visible; max-width:100%;">
                        <line x1="${padX}" y1="${zeroY}" x2="${svgW - padX}" y2="${zeroY}"
                              stroke="rgba(255,255,255,0.2)" stroke-width="1" stroke-dasharray="4,3"/>
                        <path d="M${firstX},${zeroY} ${points.map((v, i) => `L${toX(i)},${toY(v)}`).join(' ')} L${lastX},${zeroY} Z"
                              fill="${fillColor}"/>
                        <polyline points="${polylinePoints}"
                                  fill="none"
                                  stroke="${lineColor}"
                                  stroke-width="2.5"
                                  stroke-linejoin="round"
                                  stroke-linecap="round"/>
                        ${dotLabels}
                    </svg>
                </div>
            `;
        } else {
            // データ不足の場合は非表示
            sparklineContainer.innerHTML = '';
        }
    }


    let totalAmount = 0;
    chronological.forEach(session => {
        const sessionScore = sessionScores.get(session.id);
        const rate = session.rate || 0;
        if (rate > 0) {
            const amount = Math.round(sessionScore * rate * 10);
            totalAmount += amount;
        }
    });

    // Display cumulative amount on the score card
    let amountElement = document.getElementById('user-total-amount');
    if (!amountElement && scoreCard) {
        // Create the element if it doesn't exist
        const scoreCardContent = scoreCard.querySelector('[style*="z-index: 1"]');
        if (scoreCardContent) {
            const amountDiv = document.createElement('div');
            amountDiv.style.cssText = 'margin-top: 30px; padding-top: 30px; border-top: 1px solid rgba(255,255,255,0.2);';
            amountDiv.innerHTML = `
                <div id="amount-section-label" style="font-size: 1rem; color: #e2e8f0; margin-bottom: 16px; letter-spacing: 1px; text-transform: uppercase; font-weight: 600; padding: 8px 20px; border: 2px solid rgba(226, 232, 240, 0.3); border-radius: 20px; display: inline-block;">
                    累計収支
                </div>
                <div style="display: flex; align-items: center; justify-content: center; gap: 15px;">
                    <div style="font-size: 2.5rem; filter: drop-shadow(0 2px 8px rgba(0,0,0,0.3));">💰</div>
                    <div style="font-size: 3.5rem; font-weight: 800; line-height: 1; text-shadow: 0 4px 12px rgba(0,0,0,0.4);">
                        <span id="user-total-amount">-</span>
                    </div>
                </div>
            `;
            scoreCardContent.appendChild(amountDiv);
            amountElement = document.getElementById('user-total-amount');
        }
    }

    if (amountElement) {
        if (totalAmount === 0 && chronological.every(s => !s.rate || s.rate === 0)) {
            amountElement.textContent = '-';
            amountElement.className = '';
        } else {
            const amountStr = totalAmount > 0 ? `+${totalAmount.toLocaleString()}` : `${totalAmount.toLocaleString()}`;
            amountElement.textContent = amountStr;
            amountElement.className = totalAmount >= 0 ? 'score-positive' : 'score-negative';
        }
    }

    // Calculate total rank counts and average rank
    const totalRankCounts = [0, 0, 0, 0];
    let totalGames = 0;

    chronological.forEach(session => {
        session.games.forEach(game => {
            const pData = game.players.find(p => p.name === userName);
            if (pData && pData.rank >= 1 && pData.rank <= 4) {
                totalRankCounts[pData.rank - 1]++;
                totalGames++;
            }
        });
    });

    let averageRank = 0;
    let topRate = '-';
    let rentaiRate = '-';
    let avoidLastRate = '-';

    if (totalGames > 0) {
        const sumRanks = (totalRankCounts[0] * 1) + (totalRankCounts[1] * 2) + (totalRankCounts[2] * 3) + (totalRankCounts[3] * 4);
        averageRank = (sumRanks / totalGames).toFixed(2);

        topRate = ((totalRankCounts[0] / totalGames) * 100).toFixed(1) + '%';
        rentaiRate = (((totalRankCounts[0] + totalRankCounts[1]) / totalGames) * 100).toFixed(1) + '%';
        avoidLastRate = (((totalGames - totalRankCounts[3]) / totalGames) * 100).toFixed(1) + '%';
    } else {
        averageRank = '-';
    }

    // Display rank stats on the score card
    let statsElement = document.getElementById('user-rank-stats');
    if (!statsElement && scoreCard) {
        const scoreCardContent = scoreCard.querySelector('[style*="z-index: 1"]');
        if (scoreCardContent) {
            const statsDiv = document.createElement('div');
            statsDiv.style.cssText = 'margin-top: 30px; padding-top: 30px; border-top: 1px solid rgba(255,255,255,0.2);';
            statsDiv.innerHTML = `
                <div style="font-size: 1rem; color: #e2e8f0; margin-bottom: 16px; letter-spacing: 1px; text-transform: uppercase; font-weight: 600; padding: 8px 20px; border: 2px solid rgba(226, 232, 240, 0.3); border-radius: 20px; display: inline-block;">
                    成績詳細
                </div>
                <div id="user-rank-stats" style="display: flex; flex-direction: column; gap: 15px; color: #fff;">
                    <!-- Stats injected here -->
                </div>
            `;
            scoreCardContent.appendChild(statsDiv);
            statsElement = document.getElementById('user-rank-stats');
        }
    }

    if (statsElement) {
        // 既存の Chart インスタンスをinnerHTML置換前に破棄
        ['rank-pie-chart', 'rank-history-canvas-internal'].forEach(id => {
            const c = document.getElementById(id);
            if (c && c.chartInstance) { c.chartInstance.destroy(); c.chartInstance = null; }
        });

        // Calculate percentages for pie chart legend
        const rankPcts = totalRankCounts.map(count => totalGames > 0 ? ((count / totalGames) * 100).toFixed(1) + '%' : '0.0%');

        statsElement.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; max-width: 400px; margin: 0 auto;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px 30px; flex: 1;">
                    <div style="text-align: center;">
                        <div style="font-size: 0.9rem; margin-bottom: 5px; color: #e2e8f0; display:flex; align-items:center; justify-content:center; gap:5px;">
                            <div style="width:10px; height:10px; border-radius:50%; background-color:#fcd34d;"></div> 1着
                        </div>
                        <div style="font-size: 1.4rem; font-weight: bold;">${totalRankCounts[0]} <span style="font-size:0.8rem; color:#cbd5e1; font-weight:normal;">(${rankPcts[0]})</span></div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 0.9rem; margin-bottom: 5px; color: #e2e8f0; display:flex; align-items:center; justify-content:center; gap:5px;">
                            <div style="width:10px; height:10px; border-radius:50%; background-color:#94a3b8;"></div> 2着
                        </div>
                        <div style="font-size: 1.4rem; font-weight: bold;">${totalRankCounts[1]} <span style="font-size:0.8rem; color:#cbd5e1; font-weight:normal;">(${rankPcts[1]})</span></div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 0.9rem; margin-bottom: 5px; color: #e2e8f0; display:flex; align-items:center; justify-content:center; gap:5px;">
                            <div style="width:10px; height:10px; border-radius:50%; background-color:#475569;"></div> 3着
                        </div>
                        <div style="font-size: 1.4rem; font-weight: bold;">${totalRankCounts[2]} <span style="font-size:0.8rem; color:#cbd5e1; font-weight:normal;">(${rankPcts[2]})</span></div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 0.9rem; margin-bottom: 5px; color: #e2e8f0; display:flex; align-items:center; justify-content:center; gap:5px;">
                            <div style="width:10px; height:10px; border-radius:50%; background-color:#ef4444;"></div> 4着
                        </div>
                        <div style="font-size: 1.4rem; font-weight: bold;">${totalRankCounts[3]} <span style="font-size:0.8rem; color:#cbd5e1; font-weight:normal;">(${rankPcts[3]})</span></div>
                    </div>
                </div>
                <div style="width: 100px; height: 100px; margin-left: 20px;">
                    <canvas id="rank-pie-chart"></canvas>
                </div>
            </div>
            
            <div style="display: flex; justify-content: space-around; width: 100%; max-width: 400px; margin: 15px auto 0; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.1);">
                <div style="text-align: center;">
                    <div style="font-size: 0.8rem; margin-bottom: 3px; color: #cbd5e1;">トップ率</div>
                    <div style="font-size: 1.1rem; font-weight: bold;">${topRate}</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 0.8rem; margin-bottom: 3px; color: #cbd5e1;">連対率</div>
                    <div style="font-size: 1.1rem; font-weight: bold;">${rentaiRate}</div>
                </div>
                <div style="text-align: center;">
                <div style="font-size: 0.8rem; margin-bottom: 3px; color: #cbd5e1;">ラス回避率</div>
                    <div style="font-size: 1.1rem; font-weight: bold;">${avoidLastRate}</div>
                </div>
            </div>

            <!-- Seat Stats (Wind Total Score) -->
            ${(() => {
                // Calculate Wind Totals
                const windStats = { "東": 0, "南": 0, "西": 0, "北": 0 };
                chronological.forEach(session => {
                    session.games.forEach(game => {
                        const pData = game.players.find(p => p.name === userName);
                        if (pData && pData.wind && windStats[pData.wind] !== undefined) {
                            windStats[pData.wind] += pData.finalScore;
                        }
                    });
                });

                // Generate HTML
                const winds = ["東", "南", "西", "北"];
                let windHtml = '';
                winds.forEach(w => {
                    const score = Math.round(windStats[w] * 10) / 10;
                    const color = score > 0 ? '#4ade80' : (score < 0 ? '#f87171' : '#cbd5e1');
                    const sign = score > 0 ? '+' : '';
                    windHtml += `
                        <div style="text-align: center; background: rgba(255,255,255,0.05); padding: 8px; border-radius: 8px;">
                            <div style="font-size: 0.8rem; color: #94a3b8; margin-bottom: 2px;">${w}</div>
                            <div style="font-size: 1rem; font-weight: bold; color: ${color};">${sign}${score}</div>
                        </div>
                    `;
                });

                return `
                    <div style="margin: 20px auto 0; width: 100%; max-width: 400px;">
                        <div style="font-size: 0.9rem; color: rgba(255,255,255,0.7); margin-bottom: 5px; text-align: center;">起家別トータルスコア</div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px;">
                            ${windHtml}
                        </div>
                    </div>
                `;
            })()}

            <!-- Graph Container -->
            <div style="margin: 20px auto 10px; width: 100%; max-width: 400px;">
                <div style="font-size: 0.9rem; color: rgba(255,255,255,0.7); margin-bottom: 5px;">フィルター期間の着順推移（${totalGames}戦）</div>
                <div style="height: 180px; position: relative;">
                    <canvas id="rank-history-canvas-internal" style="width: 100%; height: 100%;"></canvas>
                </div>
            </div>

            <div style="margin-top: 10px; font-size: 1.2rem; display: flex; justify-content: center; align-items: center; gap: 20px;">
                <div>
                    <span style="color: #e2e8f0; margin-right: 10px;">対戦数:</span>
                    <span style="font-weight: 800; font-size: 1.8rem;">${totalGames}</span>
                </div>
                <div>
                    <span style="color: #e2e8f0; margin-right: 10px;">平均順位:</span>
                    <span style="font-weight: 800; font-size: 1.8rem;">${averageRank}</span>
                </div>
            </div>
        `;

        // Draw Pie Chart
        if (typeof ChartDataLabels !== 'undefined') {
            Chart.register(ChartDataLabels);
        }

        const pieCanvas = document.getElementById('rank-pie-chart');
        if (pieCanvas) {
            const pieCtx = pieCanvas.getContext('2d');
            pieCanvas.chartInstance = new Chart(pieCtx, {
                type: 'doughnut',
                data: {
                    labels: ['1着', '2着', '3着', '4着'],
                    datasets: [{
                        data: totalRankCounts,
                        backgroundColor: [
                            '#fcd34d', // 1st
                            '#94a3b8', // 2nd
                            '#475569', // 3rd
                            '#ef4444'  // 4th
                        ],
                        borderColor: 'transparent',
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '50%', // Thicker ring
                    plugins: {
                        legend: { display: false },
                        tooltip: { enabled: false },
                        datalabels: {
                            color: '#fff',
                            font: {
                                weight: 'bold',
                                size: 14
                            },
                            formatter: (value, ctx) => {
                                if (value === 0) return '';
                                return ctx.chart.data.labels[ctx.dataIndex];
                            },
                            display: true
                        }
                    }
                }
            });
        } // end if(pieCanvas)
    }

    // Rank History Chart
    // Note: We need to wait for the DOM to update since we injected HTML above?
    // Actually, statsElement.innerHTML update is synchronous, so the element exists now.
    const rankHistoryCanvas = document.getElementById('rank-history-canvas-internal');
    if (rankHistoryCanvas) {
        // Prepare Data: Sort by date ASC (oldest to newest) for chart
        // Filter out games where this user played
        const allGames = [];
        chronological.forEach(s => { // chronological is userSessions sorted by date ASC
            s.games.forEach(g => {
                const p = g.players.find(x => x.name === userName);
                if (p && p.rank) {
                    allGames.push({ rank: p.rank, date: s.date });
                }
            });
        });

        // フィルター期間の全ゲームを使用（直近10件に限定しない）
        const recentGames = allGames; // フィルター済み全ゲーム
        const labels = recentGames.map((_, i) => `${i + 1}`);
        const dataPoints = recentGames.map(g => g.rank);

        if (rankHistoryCanvas.chartInstance) {
            rankHistoryCanvas.chartInstance.destroy();
        }

        const ctx = rankHistoryCanvas.getContext('2d');
        rankHistoryCanvas.chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '順位',
                    data: dataPoints,
                    borderColor: '#a78bfa',
                    backgroundColor: 'rgba(167, 139, 250, 0.2)',
                    borderWidth: 2,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#8b5cf6',
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    tension: 0.1,
                    fill: false,
                    clip: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        top: 20,
                        bottom: 20,
                        left: 10,
                        right: 10
                    }
                },
                scales: {
                    y: {
                        min: 1,
                        max: 4,
                        reverse: true, // 1st place at top
                        ticks: {
                            display: true, // Show labels
                            stepSize: 1,
                            color: '#e2e8f0',
                            font: { size: 12 }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    x: {
                        display: false // Hide x-axis labels to keep it clean, or show simple index
                    }
                },
                plugins: {
                    legend: { display: false },
                    datalabels: { display: false }
                }
            }
        });
    }

    userHistoryList.innerHTML = html;
}

if (addUserBtn) {
    addUserBtn.addEventListener('click', async () => {
        const name = newUserNameInput.value.trim();
        if (name) {
            // Check limit
            const currentUsers = await window.AppStorage.getUsers();
            if (currentUsers.length >= 30) {
                alert('ユーザー登録数の上限（30名）に達しました。');
                return;
            }

            if (await window.AppStorage.addUser(name)) {
                newUserNameInput.value = '';
                await renderUserOptions();
                await renderUserList();
                alert(`ユーザー "${name}" を追加しました！`);
            } else {
                alert('そのユーザーは既に存在します！');
            }
        }
    });
}

// --- Session Management ---

if (sessionSetupForm) {
    sessionSetupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(sessionSetupForm);
        const getDate = formData.get('date') || sessionDateInput.value;

        // Helper to get value
        const getPlayerName = (id) => {
            const wrapper = document.getElementById(`${id}-wrapper`);
            const select = wrapper.querySelector('select');
            const input = wrapper.querySelector('input');
            if (select.style.display !== 'none') {
                return select.value;
            } else {
                return input.value.trim();
            }
        };

        const players = [
            getPlayerName('p1'),
            getPlayerName('p2'),
            getPlayerName('p3'),
            getPlayerName('p4')
        ];

        if (players.some(p => !p)) {
            alert("全ての対局者を選択または入力してください。");
            return;
        }

        if (new Set(players).size !== 4) {
            alert("同じユーザーを重複して選択することはできません！");
            return;
        }

        const rules = {
            startScore: Number(document.getElementById('new-set-start').value),
            returnScore: Number(document.getElementById('new-set-return').value),
            uma: [
                Number(document.getElementById('new-set-uma1').value),
                Number(document.getElementById('new-set-uma2').value),
                Number(document.getElementById('new-set-uma3').value),
                Number(document.getElementById('new-set-uma4').value)
            ],
            tieBreaker: document.querySelector('input[name="newSetTieBreaker"]:checked').value
        };

        const session = await window.AppStorage.createSession(getDate, players, rules);

        // セッション参加者を自動的にマイメンバーへ追加し、UIを即時更新
        try {
            const currentDeviceUser = localStorage.getItem('deviceUser');
            if (currentDeviceUser) {
                await window.AppStorage.autoAddMembersFromSession(currentDeviceUser, players);
                // マイメンバーが更新されたのでユーザー一覧とセット作成フォームを即時反映
                await Promise.all([renderUserList(), renderUserOptions()]);
            }
        } catch (e) {
            console.error("マイメンバー自動追加エラー:", e);
        }

        // Auto-link to League
        try {
            if (window.AppStorage.getLeagues) {
                const leagues = await window.AppStorage.getLeagues();
                const activeLeague = leagues.find(l =>
                    l.status === 'active' &&
                    l.players.length >= 4 &&
                    players.every(p => l.players.includes(p))
                );

                if (activeLeague) {
                    await window.AppStorage.updateSession(session.id, { leagueId: activeLeague.id });
                    if (typeof showToast === 'function') {
                        showToast(`リーグ「${activeLeague.title}」の対局として記録しました。`);
                    }
                }
            }
        } catch (e) {
            console.error("League link error:", e);
        }

        await openSession(session.id);
    });
}

async function renderSessionList() {
    if (!sessionList) return;
    const sessions = await window.AppStorage.getSessions();

    // Filter by Device User
    const deviceUser = localStorage.getItem('deviceUser');
    let filteredSessions = sessions;

    // Filtering logic:
    if (deviceUser === 'ヒロム') {
        // Admin sees everything
        filteredSessions = sessions;
    } else if (deviceUser) {
        // Normal user sees only their games
        filteredSessions = sessions.filter(s => Array.isArray(s.players) && s.players.includes(deviceUser));
    } else {
        // No user selected: show nothing
        filteredSessions = [];
    }

    sessionList.innerHTML = '';
    if (filteredSessions.length === 0) {
        let msg = 'セット履歴がありません。';
        if (!deviceUser) {
            msg = 'セット履歴を表示するには、ユーザー設定が必要です。';
        } else if (deviceUser !== 'ヒロム') {
            msg = '参加したセット履歴がありません。';
        }
        sessionList.innerHTML = `<p class="text-center" style="color: var(--text-secondary)">${msg}</p>`;
        return;
    }

    filteredSessions.forEach(session => {
        const div = document.createElement('div');
        div.className = 'history-card';
        div.style.cursor = 'pointer';

        // Lock Status
        const isLocked = session.locked === true;
        const lockIcon = isLocked ? '🔒' : '🔓';

        // Show delete button if admin OR participant, AND NOT LOCKED
        const isParticipant = Array.isArray(session.players) && session.players.includes(deviceUser);
        const showDelete = (deviceUser === 'ヒロム' || isParticipant) && !isLocked;

        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong>${session.date}</strong>
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:0.9rem;">${session.games.length} 対局</span>
                    ${localStorage.getItem('deviceUser') === 'ヒロム'
                ? `<span class="session-lock-btn" data-id="${session.id}" style="cursor:pointer; font-size:1.2rem;">${lockIcon}</span>`
                : ''}
                    ${showDelete
                ? `<button class="btn-danger btn-sm delete-session-btn" data-id="${session.id}" style="padding: 2px 8px; font-size: 0.8rem;">削除</button>`
                : ''}
                </div>
            </div>
            <div style="font-size:0.9rem; color:var(--text-secondary); margin-top:4px;">
                ${(session.players || []).join(', ')}
            </div>
        `;

        // Card click for navigation
        div.addEventListener('click', (e) => {
            // Prevent navigation if delete button or lock button were clicked
            if (!e.target.closest('.delete-session-btn') && !e.target.closest('.session-lock-btn')) {
                openSession(session.id);
            }
        });

        // Lock button click
        const lockBtn = div.querySelector('.session-lock-btn');
        if (lockBtn) {
            lockBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                // Toggle lock
                await window.AppStorage.updateSession(session.id, { locked: !isLocked });
                await renderSessionList();
            });
        }

        // Delete button click
        const deleteSessionBtn = div.querySelector('.delete-session-btn');
        if (deleteSessionBtn) {
            deleteSessionBtn.addEventListener('click', async (e) => {
                e.stopPropagation(); // Prevent card click
                if (confirm('このセットを削除しますか？\nこの操作は取り消せません。')) {
                    const success = await window.AppStorage.removeSession(session.id);
                    if (success !== false) {
                        await renderSessionList();
                    } else {
                        alert('削除できませんでした（ロックされている可能性があります）。');
                    }
                }
            });
        }

        sessionList.appendChild(div);
    });
}

window.openSession = openSession;

async function openSession(sessionId) {
    currentSessionId = sessionId;
    const session = await window.AppStorage.getSession(sessionId);
    if (!session) return;

    if (sessionTitle) sessionTitle.textContent = `${session.date}`;

    // 閲覧者が参加者か管理者かを判定
    const viewerUser = localStorage.getItem('deviceUser');
    const isAdmin = viewerUser === 'ヒロム';
    const isParticipant = Array.isArray(session.players) && session.players.includes(viewerUser);
    const canEdit = isAdmin || isParticipant;

    // Rate Select Lock
    if (sessionRateSelect) {
        sessionRateSelect.value = session.rate || 0;
        sessionRateSelect.disabled = !canEdit || !!session.locked;
    }

    // Finish/Resume Button（参加者・管理者のみ表示）
    if (canEdit) {
        renderSessionControls(session);
    } else {
        // 閲覧専用：コントロールエリアを非表示
        const controlsDiv = document.getElementById('session-controls-area');
        if (controlsDiv) controlsDiv.innerHTML = '';
    }

    await renderSessionTotal(session);
    renderScoreChart(session);
    renderGameList(session);

    // Settlement UI
    const container = document.getElementById('session-detail');
    if (container) {
        let settDiv = document.getElementById('settlement-area');
        if (!settDiv) {
            settDiv = document.createElement('div');
            settDiv.id = 'settlement-area';
            container.appendChild(settDiv);
        }
        if (canEdit && window.Settlement) {
            // 参加者・管理者のみ割り勘を表示
            settDiv.style.display = '';
            window.Settlement.render(session, settDiv);
        } else if (!canEdit) {
            // 閲覧専用：割り勘エリアを非表示
            settDiv.innerHTML = '';
            settDiv.style.display = 'none';
        }
    }

    navigateTo('session-detail');

    // Add Game Button Lock (Apply AFTER navigation so it overrides default visibility)
    const newGameBtn = document.getElementById('new-game-btn');
    if (newGameBtn) {
        if (!canEdit) {
            // 閲覧専用モード：対局追加ボタンを非表示
            newGameBtn.style.display = 'none';
            newGameBtn.disabled = true;
        } else if (session.locked) {
            newGameBtn.style.display = '';
            newGameBtn.disabled = true;
            newGameBtn.innerHTML = "🔒 セットはロックされています";
            newGameBtn.style.backgroundColor = "#475569";
            newGameBtn.style.cursor = "not-allowed";
            newGameBtn.style.opacity = "0.7";
        } else {
            newGameBtn.style.display = '';
            newGameBtn.disabled = false;
            newGameBtn.innerHTML = "+ 対局を追加";
            newGameBtn.style.backgroundColor = "";
            newGameBtn.style.cursor = "";
            newGameBtn.style.opacity = "";
        }
    }
}

function renderSessionControls(session) {
    const container = document.getElementById('session-detail');
    let controlsDiv = document.getElementById('session-controls-area');

    if (!controlsDiv) {
        controlsDiv = document.createElement('div');
        controlsDiv.id = 'session-controls-area';
        controlsDiv.style.cssText = 'margin: 20px 0; text-align: center;';
        // Insert before the game list or chart? 
        // Let's put it after the total table (which is top) and chart, before game list?
        // Or at the very bottom? User said "End of set", implies functionality.
        // Let's ensure it's accessible.
        // Finding a good insertion point:
        const gameListArea = document.getElementById('game-list');
        if (gameListArea) {
            gameListArea.parentNode.insertBefore(controlsDiv, gameListArea);
        } else {
            container.appendChild(controlsDiv);
        }
    }

    controlsDiv.innerHTML = '';
    const btn = document.createElement('button');
    const isLocked = !!session.locked;

    if (isLocked) {
        btn.textContent = 'セット再開 (ロック解除)';
        btn.className = 'btn-secondary'; // or distinct style
        btn.style.cssText = 'width: 100%; padding: 12px; font-weight: bold; background: #475569; color: #cbd5e1;';
        btn.onclick = async () => {
            if (confirm('セットを再開しますか？\n修正が可能になります。')) {
                await window.AppStorage.updateSession(session.id, { locked: false });
                await openSession(session.id);
            }
        };
    } else {
        btn.textContent = 'セット終了 (ロックする)';
        btn.className = 'btn-primary';
        btn.style.cssText = 'width: 100%; padding: 12px; font-weight: bold; margin-bottom: 10px;'; // Add margin for spacing
        btn.onclick = async () => {
            if (confirm('セットを終了してロックしますか？\n(後から解除も可能です)')) {
                await window.AppStorage.updateSession(session.id, { locked: true });
                await openSession(session.id);
            }
        };
    }
    controlsDiv.appendChild(btn);

    // Share Button
    const shareBtn = document.createElement('button');
    shareBtn.innerHTML = '📷 画像共有';
    shareBtn.className = 'btn-secondary';
    shareBtn.style.cssText = 'width: 100%; padding: 12px; font-weight: bold; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; border: none; margin-top: 10px;';
    shareBtn.onclick = () => {
        if (window.Share) {
            window.Share.generateSessionImage(session);
        } else {
            alert('Share module not loaded.');
        }
    };
    controlsDiv.appendChild(shareBtn);
}

async function renderSessionTotal(session) {
    if (!sessionTotalTable) return;
    // Calculate totals and rank counts
    const totals = {};
    const rankCounts = {}; // { playerName: [1st, 2nd, 3rd, 4th] }

    // Fetch registered users to check for guests
    const registeredUsers = await window.AppStorage.getUsers();

    session.players.forEach(p => {
        totals[p] = 0;
        rankCounts[p] = [0, 0, 0, 0];
    });

    session.games.forEach(game => {
        // Sort players in this game by rank to ensure correct indexing if needed, 
        // though game.players usually has rank info.
        // game.players objects have { name, rank, finalScore, ... }
        game.players.forEach(p => {
            if (totals[p.name] !== undefined) {
                totals[p.name] += p.finalScore;
            }
            if (rankCounts[p.name] !== undefined && p.rank >= 1 && p.rank <= 4) {
                rankCounts[p.name][p.rank - 1]++;
            }
        });
    });

    // Sort by total score
    const sortedPlayers = session.players.slice().sort((a, b) => totals[b] - totals[a]);
    const rate = session.rate || 0;

    // Build Table Header
    let html = `<thead><tr>
        <th>順位</th>
        <th>名前</th>
        <th>合計Pt</th>
        ${rate > 0 ? '<th>収支</th>' : ''}
        <th style="font-size:0.8em;">1着</th>
        <th style="font-size:0.8em;">2着</th>
        <th style="font-size:0.8em;">3着</th>
        <th style="font-size:0.8em;">4着</th>
    </tr></thead><tbody>`;

    sortedPlayers.forEach((p, i) => {
        const score = parseFloat(totals[p].toFixed(1));
        const scoreClass = score >= 0 ? 'score-positive' : 'score-negative';
        const scoreStr = score > 0 ? `+${score}` : `${score}`;

        let amountHtml = '';
        if (rate > 0) {
            const amount = Math.round(score * rate * 10);
            const amountClass = amount >= 0 ? 'score-positive' : 'score-negative';
            const amountStr = amount > 0 ? `+${amount}` : `${amount}`;
            amountHtml = `<td class="${amountClass}">${amountStr}</td>`;
        }

        // Get rank counts
        const counts = rankCounts[p];
        const c1 = counts[0];
        const c2 = counts[1];
        const c3 = counts[2];
        const c4 = counts[3];

        // Check if player is registered
        const isRegistered = registeredUsers.includes(p);
        const nameHtml = isRegistered
            ? `<span style="cursor:pointer; text-decoration:underline;" onclick="openUserDetail('${p}')">${p}</span>`
            : `<span>${p}</span>`;

        html += `
            <tr>
                <td>${i + 1}</td>
                <td>${nameHtml}</td>
                <td class="${scoreClass}" style="font-weight:bold;">${scoreStr}</td>
                ${amountHtml}
                <td>${c1}</td>
                <td>${c2}</td>
                <td>${c3}</td>
                <td>${c4}</td>
            </tr>
        `;
    });
    html += `</tbody>`;
    sessionTotalTable.innerHTML = html;
}

let scoreChart = null;

function renderScoreChart(session) {
    const canvas = document.getElementById('score-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Destroy existing chart if any
    if (scoreChart) {
        scoreChart.destroy();
    }

    // Prepare Data
    const labels = ['Start'];
    session.games.forEach((_, i) => labels.push(`Game ${i + 1}`));

    const datasets = session.players.map((player, index) => {
        const data = [0]; // Start at 0
        let currentScore = 0;

        session.games.forEach(game => {
            const pData = game.players.find(p => p.name === player);
            if (pData) {
                currentScore += pData.finalScore;
            }
            data.push(currentScore);
        });

        // Colors for 4 players
        const colors = [
            '#bb86fc', // Purple
            '#03dac6', // Teal
            '#cf6679', // Red
            '#ffb74d'  // Orange
        ];

        return {
            label: player,
            data: data,
            borderColor: colors[index % colors.length],
            backgroundColor: 'rgba(0,0,0,0)',
            tension: 0.1
        };
    });

    if (typeof Chart !== 'undefined') {
        scoreChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        grid: {
                            color: '#333'
                        },
                        ticks: {
                            color: '#b0b0b0'
                        }
                    },
                    x: {
                        grid: {
                            color: '#333'
                        },
                        ticks: {
                            color: '#b0b0b0'
                        }
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: '#ffffff'
                        }
                    },
                    datalabels: {
                        display: false
                    }
                }
            }
        });
    }
}

function renderGameList(session) {
    if (!gameList) return;
    gameList.innerHTML = '';
    if (session.games.length === 0) {
        gameList.innerHTML = '<p class="text-center" style="color: var(--text-secondary)">まだ対局がありません。</p>';
        return;
    }

    // Show latest first
    [...session.games].reverse().forEach((game, index) => {
        const card = document.createElement('div');
        card.className = 'history-card';

        // Sort by Rank
        const sortedPlayers = [...game.players].sort((a, b) => a.rank - b.rank);

        let rows = '';
        sortedPlayers.forEach(p => {
            const scoreClass = p.finalScore >= 0 ? 'score-positive' : 'score-negative';
            const scoreStr = p.finalScore > 0 ? `+${p.finalScore}` : p.finalScore;
            rows += `
                <tr>
                    <td>${p.rank}</td>
                    <td>${p.wind ? `<span style="display:inline-block; width:20px; text-align:center; margin-right:5px; color:#94a3b8; font-weight:bold;">${p.wind}</span>` : ''}${p.name}</td>
                    <td>${p.rawScore}</td>
                    <td class="${scoreClass}">${scoreStr}</td>
                </tr>
             `;
        });


        // Edit/Delete Buttons logic
        // Only show if Admin OR Participant, AND Session is NOT locked
        const deviceUser = localStorage.getItem('deviceUser');
        const isParticipant = Array.isArray(session.players) && session.players.includes(deviceUser);
        const isLocked = !!session.locked;
        const showControls = (deviceUser === 'ヒロム' || isParticipant) && !isLocked;

        card.innerHTML = `
            <div class="history-header">
                <span>Game ${session.games.length - index}</span>
                <div>
                    ${showControls
                ? `
                        <button class="btn-secondary btn-sm edit-game-btn" data-id="${game.id}" style="padding: 2px 8px; font-size: 0.8rem; margin-right: 5px;">修正</button>
                        <button class="btn-danger btn-sm delete-game-btn" data-id="${game.id}" style="padding: 2px 8px; font-size: 0.8rem;">削除</button>
                        `
                : ''}
                </div>
            </div>
            <table class="history-table">
                <thead>
                    <tr>
                        <th width="10%">#</th>
                        <th width="40%">名前</th>
                        <th width="25%">最終持ち点</th>
                        <th width="25%">Pt</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        `;

        const editBtn = card.querySelector('.edit-game-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                editingGameId = game.id;
                navigateTo('input');
                prepareInputForm(game);
            });
        }

        const deleteGameBtn = card.querySelector('.delete-game-btn');
        if (deleteGameBtn) {
            deleteGameBtn.addEventListener('click', async () => {
                if (confirm('この対局結果を削除しますか？')) {
                    await window.AppStorage.removeGameFromSession(session.id, game.id);
                    // Refresh session view
                    await openSession(session.id);
                }
            });
        }

        gameList.appendChild(card);
    });
}

// --- Score Input ---
// Input Mode State
let isDirectScoreMode = false;

const modePointsBtn = document.getElementById('mode-points');
const modeDirectBtn = document.getElementById('mode-direct');

if (modePointsBtn && modeDirectBtn) {
    modePointsBtn.addEventListener('click', () => setInputMode(false));
    modeDirectBtn.addEventListener('click', () => setInputMode(true));
}

function setInputMode(isDirect) {
    isDirectScoreMode = isDirect;

    // UI Update
    if (isDirect) {
        modePointsBtn.className = 'btn-secondary';
        modeDirectBtn.className = 'btn-primary';

        // Input fields config for Direct Score
        scoreInputs.forEach(input => {
            input.placeholder = "+50.5";
            input.step = "0.1"; // Allow decimals
            // Hide suffix "00"
            const suffix = input.nextElementSibling;
            if (suffix && suffix.classList.contains('suffix')) {
                suffix.style.display = 'none';
            }
        });
    } else {
        modePointsBtn.className = 'btn-primary';
        modeDirectBtn.className = 'btn-secondary';

        // Input fields config for Points
        scoreInputs.forEach(input => {
            input.placeholder = "250";
            input.removeAttribute('step'); // Integer only usually, or default
            // Show suffix "00"
            const suffix = input.nextElementSibling;
            if (suffix && suffix.classList.contains('suffix')) {
                suffix.style.display = 'inline';
            }
        });
    }

    // Re-validate immediately
    validateScoreInput();
}

async function prepareInputForm(gameToEdit = null) {
    // Reset form immediately
    scoreForm.reset();
    pendingGameYakumans = []; // [NEW] Reset yakumans

    // Default to Points Mode unless editing a game that looks like direct input?
    // Hard to tell difference strictly, but usually we start with Points.
    setInputMode(false);

    // Clear all input fields and wind selects
    const inputs = document.querySelectorAll('#score-form input[type="number"]');
    const windSelects = document.querySelectorAll('#score-form select[name$="-wind"]');

    inputs.forEach(input => input.value = '');
    windSelects.forEach(sel => sel.value = ''); // Reset winds

    if (gameToEdit) {
        totalCheck.textContent = "合計: 100000";
        totalCheck.className = "total-check valid";
    } else {
        totalCheck.textContent = "合計: 0";
        totalCheck.className = "total-check";
    }

    const session = await window.AppStorage.getSession(currentSessionId);
    if (!session) return;

    //Set player names
    for (let i = 0; i < 4; i++) {
        const label = document.getElementById(`lbl-p${i + 1}`);
        const hiddenInput = document.getElementById(`inp-p${i + 1}-name`);
        if (label && hiddenInput) {
            label.textContent = session.players[i];
            hiddenInput.value = session.players[i];
        }
    }

    if (gameToEdit) {
        // Populate with existing scores
        // If we want to support direct edit of direct scores, we need to know if it was direct.
        // For now, always assume points mode for edit unless we persist metadata.
        // Or check if rawScore is 0/null which implies direct mode?

        // Heuristic: If rawScore is missing or 0, maybe direct mode?
        // But legacy data might vary. 
        // Let's assume Points Mode for now as requested "Default".

        // Need to map game.players back to session.players order
        // const session = await window.AppStorage.getSession(currentSessionId); // Already fetched above

        session.players.forEach((pName, i) => {
            const pData = gameToEdit.players.find(gp => gp.name === pName);
            if (pData) {
                const scoreInput = document.querySelector(`input[name="p${i + 1}-score"]`);
                if (scoreInput) {
                    // Check if rawScore seems valid for points mode
                    if (pData.rawScore !== undefined && pData.rawScore !== 0) {
                        scoreInput.value = Math.floor(pData.rawScore / 100);
                    } else {
                        // Switch to direct mode if rawScore is missing (implied direct save)
                        setInputMode(true);
                        scoreInput.value = pData.finalScore;
                    }
                }
                // Set Wind
                const windSel = document.querySelector(`select[name="p${i + 1}-wind"]`);
                if (windSel && pData.wind) {
                    windSel.value = pData.wind;
                }
            }
        });
        validateScoreInput();
    }
}

// Real-time validation
scoreInputs.forEach(input => {
    input.addEventListener('input', validateScoreInput);
});

function validateScoreInput() {
    let currentTotal = 0;
    let isValid = false;
    let displayText = "";

    if (isDirectScoreMode) {
        // Direct Mode Validation
        // Sum should be close to 0 (or match rules)
        // Just sum the values
        scoreInputs.forEach(input => {
            if (input.value) {
                currentTotal += Number(input.value);
            }
        });

        // Round to 1 decimal to avoid float errors
        currentTotal = Math.round(currentTotal * 10) / 10;

        displayText = `合計: ${currentTotal}`;

        // For direct mode, we allow non-zero sums (e.g. slight adjustments),
        // but maybe warn? For now, allow everything that is entered.
        // User knows what they are doing.
        isValid = true;
        totalCheck.className = "total-check valid";

        // Maybe warn if not 0?
        if (currentTotal !== 0) {
            totalCheck.className = "total-check"; // Warning color (yellowish/default)
            displayText += " (注意: 0ではありません)";
        }

    } else {
        // Points Mode Validation
        scoreInputs.forEach(input => {
            if (input.value) {
                currentTotal += Number(input.value) * 100;
            }
        });

        const difference = currentTotal - 100000;
        displayText = `合計: ${currentTotal.toLocaleString()}`;

        if (difference !== 0) {
            const absDiff = Math.abs(difference);
            const diffStr = difference > 0 ? `+${absDiff.toLocaleString()}` : `-${absDiff.toLocaleString()}`;
            displayText += ` (${diffStr})`;
            isValid = false;
        } else {
            isValid = true;
        }

        totalCheck.className = isValid ? "total-check valid" : "total-check invalid";
    }

    totalCheck.textContent = displayText;
    return isValid;
}

// --- Game Submission ---
scoreForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentSessionId) return;

    // Final Validation
    if (!validateScoreInput() && !isDirectScoreMode) {
        // In Direct mode we are lenient, in Points mode we are strict about 100000
        alert('点数の合計が100,000点になっていません。');
        return;
    }

    const formData = new FormData(scoreForm);
    const session = await window.AppStorage.getSession(currentSessionId);

    // Gather scores and winds
    const playerScores = []; // Array of raw scores OR direct final scores
    const playerWinds = [];
    for (let i = 1; i <= 4; i++) {
        const val = Number(formData.get(`p${i}-score`));
        const wind = formData.get(`p${i}-wind`);
        playerScores.push(val);
        playerWinds.push(wind);
    }

    // Wind Validation: All or None
    const setWinds = playerWinds.filter(w => w !== "");
    if (setWinds.length > 0 && setWinds.length < 4) {
        alert("起家・場所決めの入力が不完全です。\n設定する場合は全員分を入力してください（設定しない場合は全員「-」にしてください）。");
        return;
    }

    // Check for Duplicate Winds if all are set
    if (setWinds.length === 4) {
        const uniqueWinds = new Set(setWinds);
        if (uniqueWinds.size !== 4) {
            alert("風（方角）が重複しています。\n東・南・西・北をそれぞれ1人ずつ割り当ててください。");
            return;
        }
    }

    // Calculate or Assign Result
    let playersResult;

    if (isDirectScoreMode) {
        // DIRECT MODE
        // Calculate Raw Score from Final Score
        // Formula: Raw = (Final - Uma - [Oka if Top]) * 1000 + ReturnScore

        // 1. Get Rules
        const rules = session.rules || await window.AppStorage.getSettings();
        const startScore = rules.startScore;
        const returnScore = rules.returnScore;
        const uma = rules.uma; // [Top, 2nd, 3rd, 4th]
        const oka = (returnScore - startScore) * 4 / 1000;

        // 2. Create objects
        let tempPlayers = session.players.map((name, index) => ({
            name: name,
            finalScore: playerScores[index],
            wind: playerWinds[index],
            index: index
        }));

        // 3. Assign ranks based on final score
        // Define Wind Priority
        const windOrder = { "東": 0, "南": 1, "西": 2, "北": 3 };
        const tieRule = rules.tieBreaker || 'split';

        tempPlayers.sort((a, b) => {
            if (b.finalScore !== a.finalScore) {
                return b.finalScore - a.finalScore;
            }
            // Tie-breaker
            if (tieRule === 'priority') {
                // Check if both have valid winds
                const wA = windOrder[a.wind];
                const wB = windOrder[b.wind];
                if (wA !== undefined && wB !== undefined) {
                    return wA - wB; // Lower index (East=0) wins (comes first)
                }
            }
            return 0;
        });

        tempPlayers.forEach((p, i) => {
            p.rank = i + 1;

            // 4. Reverse Calculation
            // Point = (Raw - Return) / 1000
            // Final = Point + Uma + [Oka]
            // Final = (Raw - Return)/1000 + Uma + [Oka]
            // Final - Uma - [Oka] = (Raw - Return)/1000
            // (Final - Uma - [Oka]) * 1000 + Return = Raw

            let currentUma = uma[i];
            // Handle incomplete uma (e.g. 3 person mahjong rules if applicable in future, but assuming 4 here)
            if (currentUma === undefined) currentUma = 0;

            let isTop = (i === 0);

            // Calculate Raw Score
            let rawCalc = (p.finalScore - currentUma - (isTop ? oka : 0)) * 1000 + returnScore;

            // Round to nearest 100 just in case of float drifts, though it should be exact for valid scores
            p.rawScore = Math.round(rawCalc / 100) * 100;
        });



        // 5. Validation: Check for Rank Inversions & Total Zero
        // Check if higher ranks have higher or equal rawScore
        for (let i = 0; i < tempPlayers.length - 1; i++) {
            if (tempPlayers[i].rawScore < tempPlayers[i + 1].rawScore) {
                alert(`順位と点数が矛盾しています。\n${i + 1}位の点数が${i + 2}位より低くなっています。\n入力されたスコア差が、順位点（オカ・ウマ）の差より小さい可能性があります。`);
                return;
            }
        }

        // Check sum of final scores (should be 0)
        const totalFinalScore = playerScores.reduce((a, b) => a + b, 0);
        // Allow tiny float error
        if (Math.abs(totalFinalScore) > 0.1) {
            alert(`スコアの合計が0になっていません（合計: ${Math.round(totalFinalScore * 10) / 10}）。\n正しく入力してください。`);
            return;
        }

        // 6. Restore order
        tempPlayers.sort((a, b) => a.index - b.index);

        playersResult = tempPlayers.map(p => ({
            name: p.name,
            rawScore: p.rawScore,
            rank: p.rank,
            finalScore: p.finalScore
        }));

    } else {
        // POINTS MODE (Standard)
        const scores = playerScores.map(s => s * 100); // x100 back to full points

        // Check ties logic (if priority needed)
        // Pass playerWinds as 3rd optional argument
        const checkResult = window.Mahjong.calculateResult(scores, session.rules, playerWinds);

        if (checkResult.needsTieBreaker) {
            // Need to resolve ties (MANUALLY)
            // This happens if winds are NOT set (partial input check prevents this, but maybe empty strings passed)
            // OR if duplicate winds caused conflicts (validation prevents this)
            // OR if tieBreaker rule is 'priority' but wind data was insufficient to resolve it.

            // Store pending data and show modal
            pendingGameData = {
                playerData: session.players.map((name, i) => ({ name: name, score: scores[i] })),
                session: session,
                result: checkResult
            };
            showTieBreakerModal(checkResult.tiedGroups, pendingGameData.playerData);
            return; // Stop here, wait for modal
        }

        // No ties, or resolved automatically
        playersResult = checkResult.map((r, i) => ({
            name: session.players[i],
            rawScore: r.rawScore,
            rank: r.rank,
            finalScore: r.finalScore,
            wind: playerWinds[i] // Ensure wind is attached
        }));
    }

    // [NEW] Wait for any background uploads to complete
    if (pendingGameYakumans.length > 0) {
        // Check for active uploads（先にアップロード完了を待つ）
        const activeUploads = pendingGameYakumans
            .filter(y => y.uploadPromise)
            .map(y => y.uploadPromise);

        if (activeUploads.length > 0) {
            const submitBtn = scoreForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = '画像アップロード完了待ち...';
            }

            try {
                await Promise.all(activeUploads);
            } catch (e) {
                console.error("Some background uploads failed", e);
            }

            if (submitBtn) {
                submitBtn.textContent = '保存中...';
            }
        }

        // Firestoreに保存できないプロパティ（Promise・BlobURL）を除去したクリーンなオブジェクトをセット
        playersResult.forEach(p => {
            const yList = pendingGameYakumans.filter(y => y.playerName === p.name);
            if (yList.length > 0) {
                p.yakuman = yList.map(y => ({
                    id: y.id,
                    playerName: y.playerName,
                    type: y.type,
                    comment: y.comment || '',
                    // blob: URL はFirestoreに保存できないため除外（アップロード完了後は正しいURLが入っているはず）
                    imageUrl: (y.imageUrl && !y.imageUrl.startsWith('blob:')) ? y.imageUrl : null,
                    imagePath: y.imagePath || null,
                    timestamp: y.timestamp
                    // uploadPromise, isUploading はFirestoreに保存できないため除外
                }));
            }
        });
    }

    // Save
    await saveGameResult({ players: playersResult });

    // Close modal/form
    navigateTo('session-detail');
});

// Settings form
if (settingsForm) {
    settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const settings = {
            startScore: Number(document.getElementById('set-start').value),
            returnScore: Number(document.getElementById('set-return').value),
            uma: [
                Number(document.getElementById('set-uma1').value),
                Number(document.getElementById('set-uma2').value),
                Number(document.getElementById('set-uma3').value),
                Number(document.getElementById('set-uma4').value)
            ],
            tieBreaker: document.querySelector('input[name="tieBreaker"]:checked').value
        };
        await window.AppStorage.saveSettings(settings);

        alert('設定を保存しました。');
    });
}

if (resetSettingsBtn) {
    resetSettingsBtn.addEventListener('click', async () => {
        if (confirm('設定を初期値に戻しますか？')) {
            const DEFAULT_SETTINGS = {
                startScore: 25000,
                returnScore: 30000,
                uma: [30, 10, -10, -30],
                tieBreaker: 'priority'
            };
            await window.AppStorage.saveSettings(DEFAULT_SETTINGS);
            await loadSettingsToForm();
            alert('設定を初期化しました。');
        }
    });
}

async function loadSettingsToForm() {
    const settings = await window.AppStorage.getSettings();
    document.getElementById('set-start').value = settings.startScore;
    document.getElementById('set-return').value = settings.returnScore;
    document.getElementById('set-uma1').value = settings.uma[0];
    document.getElementById('set-uma2').value = settings.uma[1];
    document.getElementById('set-uma3').value = settings.uma[2];
    document.getElementById('set-uma4').value = settings.uma[3];

    const radios = document.getElementsByName('tieBreaker');
    radios.forEach(r => {
        if (r.value === settings.tieBreaker) r.checked = true;
    });
}

function setupScoreValidation() {
    // Initial validation setup is handled by event listeners above
}

// --- Score Submission ---


// TIE BREAKER HANDLING
// Global state for sequential selection
let currentTieGroup = null;
let currentTieOrder = [];

// Show modal
function showTieBreakerModal(tiedGroups) {
    if (!tieBreakerModal || !tieBreakerOptions) return;

    // Always take the first group to resolve
    currentTieGroup = tiedGroups[0];
    currentTieOrder = []; // Reset order list for this group

    // Sort indices for consistent display
    // currentTieGroup is array of playerIndices

    renderTieBreakerUI();

    tieBreakerModal.style.display = 'flex';
}

function renderTieBreakerUI() {
    tieBreakerOptions.innerHTML = '';

    const title = document.createElement('div');
    title.style.color = 'white';
    title.style.marginBottom = '10px';
    title.textContent = `同点のプレイヤーがいます（${currentTieGroup.length}名）。優先順位が高い順（起家に近い順）に選択してください。`;
    tieBreakerOptions.appendChild(title);

    const { playerData } = pendingGameData;

    currentTieGroup.forEach(playerIndex => {
        const playerName = playerData[playerIndex].name;

        // check if already selected
        const selectedIndex = currentTieOrder.indexOf(playerIndex);
        const isSelected = selectedIndex !== -1;

        const btn = document.createElement('button');
        // If selected, show rank badge. If not, show name.
        if (isSelected) {
            btn.innerHTML = `${playerName} <span style="background:#4caf50; color:white; border-radius:50%; width:20px; height:20px; display:inline-block; text-align:center; line-height:20px; font-size:12px;">${selectedIndex + 1}</span>`;
            btn.disabled = true;
            btn.style.opacity = '0.7';
            btn.style.borderColor = '#4caf50';
        } else {
            btn.textContent = playerName;
            btn.onclick = () => selectTiePlayer(playerIndex);
        }

        tieBreakerOptions.appendChild(btn);
    });

    // Reset Button
    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'リセット';
    resetBtn.className = 'btn-danger';
    resetBtn.style.marginTop = '10px';
    resetBtn.onclick = () => {
        currentTieOrder = [];
        renderTieBreakerUI();
    };
    tieBreakerOptions.appendChild(resetBtn);
}

function selectTiePlayer(playerIndex) {
    currentTieOrder.push(playerIndex);
    renderTieBreakerUI();

    // Check if done
    if (currentTieOrder.length === currentTieGroup.length) {
        // Allow a small delay to see the last selection state?
        setTimeout(() => {
            resolveTieGroup();
        }, 300);
    }
}

async function resolveTieGroup() {
    tieBreakerModal.style.display = 'none';
    if (!pendingGameData) return;

    // We have the order: currentTieOrder = [HighestPriorityIndex, 2nd, ..., Lowest]
    // Assign numerical priority. 
    // Higher number = Higher Priority.
    // Max priority can be 100.
    // Index 0 (Highest) -> p + (N-0)

    if (!pendingGameData.priorityMap) pendingGameData.priorityMap = {};

    const N = currentTieOrder.length;
    currentTieOrder.forEach((playerIndex, i) => {
        // Priority: Higher is better.
        // i=0 is 1st (Highest).
        // Give 1st place N points, 2nd place N-1 points...
        // We add this to existing map? 
        // No, assuming priorityMap is fresh or we just overwrite for these specific players.
        pendingGameData.priorityMap[playerIndex] = (N - i);
    });

    // Re-run calculation to see if MORE ties exist
    const { playerData, session } = pendingGameData;
    const scores = playerData.map(p => p.score);

    const result = window.Mahjong.calculateResult(scores, session.rules, pendingGameData.priorityMap);

    if (result.needsTieBreaker) {
        // Still needs tie breaker (maybe another group, or logic error)
        // Check if we made progress? 
        // We resolved `currentTieGroup`. Next call should return OTHER groups.
        showTieBreakerModal(result.tiedGroups);
    } else {
        // All done!

        // Map results back
        const players = result.map((playerResult, index) => ({
            name: playerData[index].name,
            rawScore: playerResult.rawScore,
            rank: playerResult.rank,
            finalScore: playerResult.finalScore
        }));

        await saveGameResult({ players });
        pendingGameData = null;
    }
}

async function saveGameResult(result) {
    const session = await window.AppStorage.getSession(currentSessionId);

    const gameId = editingGameId ? Number(editingGameId) : Date.now();
    const gameData = {
        id: gameId,
        timestamp: new Date().toISOString(),
        players: result.players
    };

    if (editingGameId) {
        await window.AppStorage.updateGameInSession(currentSessionId, gameId, gameData);
        alert('対局結果を修正しました。');
    } else {
        await window.AppStorage.addGameToSession(currentSessionId, gameData);
        alert('対局結果を保存しました！');
    }

    editingGameId = null;
    navigateTo('session-detail');
    await openSession(currentSessionId);
}


// ====== ROULETTE FUNCTIONALITY ======

// Initialize roulette if on roulette page
async function initRoulette() {
    if (!rouletteCanvas) return;

    try {
        // Load saved items from AppStorage (Async)
        rouletteItems = await window.AppStorage.getRouletteItems();

        // Items must be array
        if (!Array.isArray(rouletteItems)) {
            rouletteItems = ['1', '2', '3', '4', '5', '6', '7'];
        }

    } catch (e) {
        console.error("Failed to load roulette items", e);
        rouletteItems = ['1', '2', '3', '4', '5', '6', '7'];
    }

    renderRouletteList();
    drawRoulette();
}

// Save items to AppStorage
async function saveRouletteItems() {
    await window.AppStorage.saveRouletteItems(rouletteItems);
}

// Add roulette item
if (addRouletteItemBtn) {
    addRouletteItemBtn.addEventListener('click', async () => {
        const value = rouletteInput.value.trim();
        if (!value) {
            alert('項目を入力してください。');
            return;
        }

        if (rouletteItems.length >= 20) {
            alert('項目は最大20個までです。');
            return;
        }

        if (rouletteItems.includes(value)) {
            alert('同じ項目が既に存在します。');
            return;
        }

        rouletteItems.push(value);
        await saveRouletteItems(); // Async save
        rouletteInput.value = '';
        renderRouletteList();
        drawRoulette();
    });

    // Allow Enter key to add item
    rouletteInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addRouletteItemBtn.click();
        }
    });
}

// Remove roulette item
async function removeRouletteItem(index) {
    rouletteItems.splice(index, 1);
    await saveRouletteItems(); // Async save
    renderRouletteList();
    drawRoulette();
}

// Make removeRouletteItem globally accessible (wrapper to handle async promise if needed, though click handler ignores it)
window.removeRouletteItem = removeRouletteItem;

// Render roulette item list
function renderRouletteList() {
    if (!rouletteList) return;

    rouletteList.innerHTML = '';
    rouletteItems.forEach((item, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${item}</span>
            <button onclick="removeRouletteItem(${index})">×</button>
        `;
        rouletteList.appendChild(li);
    });
}

// Draw roulette wheel
function drawRoulette(rotation = 0) {
    if (!rouletteCtx || rouletteItems.length === 0) return;

    const centerX = rouletteCanvas.width / 2;
    const centerY = rouletteCanvas.height / 2;
    // Outer radius for the wheel
    const radius = 130;

    // Clear canvas
    rouletteCtx.clearRect(0, 0, rouletteCanvas.width, rouletteCanvas.height);

    const anglePerSegment = (2 * Math.PI) / rouletteItems.length;

    // --- 1. Draw Outer Bezel / Shadow ---
    // Drop shadow for the whole wheel
    rouletteCtx.save();
    rouletteCtx.shadowColor = "rgba(0, 0, 0, 0.5)";
    rouletteCtx.shadowBlur = 15;
    rouletteCtx.shadowOffsetX = 5;
    rouletteCtx.shadowOffsetY = 5;

    rouletteCtx.beginPath();
    rouletteCtx.arc(centerX, centerY, radius + 10, 0, 2 * Math.PI);
    rouletteCtx.fillStyle = "#333";
    rouletteCtx.fill();
    rouletteCtx.restore();

    // Metallic Bezel
    const bezelGradient = rouletteCtx.createLinearGradient(centerX - radius, centerY - radius, centerX + radius, centerY + radius);
    bezelGradient.addColorStop(0, "#444");
    bezelGradient.addColorStop(0.5, "#888");
    bezelGradient.addColorStop(1, "#444");

    rouletteCtx.beginPath();
    rouletteCtx.arc(centerX, centerY, radius + 8, 0, 2 * Math.PI);
    rouletteCtx.fillStyle = bezelGradient;
    rouletteCtx.fill();

    // Darker inner rim
    rouletteCtx.beginPath();
    rouletteCtx.arc(centerX, centerY, radius + 2, 0, 2 * Math.PI);
    rouletteCtx.fillStyle = "#1a1a1a";
    rouletteCtx.fill();


    // --- 2. Draw Segments ---
    rouletteItems.forEach((item, index) => {
        const startAngle = rotation + (index * anglePerSegment);
        const endAngle = startAngle + anglePerSegment;

        // Clip to radius
        rouletteCtx.beginPath();
        rouletteCtx.moveTo(centerX, centerY);
        rouletteCtx.arc(centerX, centerY, radius, startAngle, endAngle);
        rouletteCtx.closePath();

        // Main Color
        rouletteCtx.fillStyle = rouletteColors[index % rouletteColors.length];
        rouletteCtx.fill();

        // Inner Highlight (Glossy effect)
        rouletteCtx.save();
        rouletteCtx.clip();
        const gloss = rouletteCtx.createRadialGradient(centerX, centerY, radius * 0.2, centerX, centerY, radius);
        gloss.addColorStop(0, "rgba(255, 255, 255, 0.1)");
        gloss.addColorStop(1, "rgba(0, 0, 0, 0.1)");
        rouletteCtx.fillStyle = gloss;
        rouletteCtx.fill();
        rouletteCtx.restore();

        // Stroke
        rouletteCtx.strokeStyle = 'rgba(0,0,0,0.2)';
        rouletteCtx.lineWidth = 1;
        rouletteCtx.stroke();

        // --- 3. Draw Text ---
        rouletteCtx.save();
        rouletteCtx.translate(centerX, centerY);
        rouletteCtx.rotate(startAngle + anglePerSegment / 2);
        rouletteCtx.textAlign = 'center';
        rouletteCtx.textBaseline = 'middle';

        // Shadow for text readability
        rouletteCtx.shadowColor = "rgba(0,0,0,0.5)";
        rouletteCtx.shadowBlur = 4;
        rouletteCtx.shadowOffsetX = 1;
        rouletteCtx.shadowOffsetY = 1;

        rouletteCtx.fillStyle = '#fff';
        // Auto-scale font based on item length
        const fontSize = Math.min(18, (radius * 0.7) / (item.length * 0.8));
        rouletteCtx.font = `bold ${Math.max(10, fontSize)}px Inter, 'Noto Sans JP', sans-serif`;

        // Push text out a bit
        rouletteCtx.fillText(item, radius * 0.6, 0);
        rouletteCtx.restore();
    });

    // --- 4. Center Decoration ---
    // Outer gold ring
    rouletteCtx.beginPath();
    rouletteCtx.arc(centerX, centerY, 25, 0, 2 * Math.PI);
    rouletteCtx.fillStyle = "#f59e0b"; // Gold
    rouletteCtx.fill();
    rouletteCtx.strokeStyle = "#b45309";
    rouletteCtx.lineWidth = 2;
    rouletteCtx.stroke();

    // Inner knob
    rouletteCtx.beginPath();
    rouletteCtx.arc(centerX, centerY, 18, 0, 2 * Math.PI);
    const knobGrad = rouletteCtx.createRadialGradient(centerX - 5, centerY - 5, 2, centerX, centerY, 20);
    knobGrad.addColorStop(0, "#fff");
    knobGrad.addColorStop(1, "#ccc");
    rouletteCtx.fillStyle = knobGrad;
    rouletteCtx.fill();

    // Center star or dot
    rouletteCtx.beginPath();
    rouletteCtx.arc(centerX, centerY, 5, 0, 2 * Math.PI);
    rouletteCtx.fillStyle = "#333";
    rouletteCtx.fill();

    // --- 5. Pointer (Outside Loop, Static position) ---
    // Triangle pointing down at top
    const pointerSize = 20;
    rouletteCtx.save();
    // Move to top center, slightly overlapping
    rouletteCtx.translate(centerX, centerY - radius - 5);

    // Shadow for pointer
    rouletteCtx.shadowColor = "rgba(0,0,0,0.5)";
    rouletteCtx.shadowBlur = 5;
    rouletteCtx.shadowOffsetY = 3;

    rouletteCtx.beginPath();
    rouletteCtx.moveTo(-12, -15);
    rouletteCtx.lineTo(12, -15);
    rouletteCtx.lineTo(0, 10); // Point down
    rouletteCtx.closePath();

    rouletteCtx.fillStyle = "#ef4444"; // Red pointer
    rouletteCtx.fill();
    rouletteCtx.strokeStyle = "#fff";
    rouletteCtx.lineWidth = 2;
    rouletteCtx.stroke();
    rouletteCtx.restore();
}

// Audio context for sound effects
let audioContext = null;

// Initialize audio context (requires user interaction)
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

// Play tick sound
function playTickSound() {
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'square';

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.05);
}

// Play result sound
function playResultSound() {
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Rising tone
    oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.3);
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
}

// Spin roulette
// Spin roulette
// Spin roulette
if (spinBtn) {
    spinBtn.addEventListener('click', () => {
        if (isSpinning) return;

        if (rouletteItems.length < 2) {
            alert('項目を2つ以上追加してください。');
            return;
        }

        // Initialize audio on first interaction
        initAudio();

        isSpinning = true;
        rouletteResult.textContent = '';
        spinBtn.disabled = true;
        spinBtn.textContent = "回転中...";

        // ---- Animation Configuration & Logic ----

        // Determine Effect Type
        // 0: Normal (80%)
        // 1: Respin (10%)
        // 2: Slip (5%)
        // 3: Reverse (5%) - New!
        const rand = Math.random();
        let effectType = 0;

        if (rand < 0.05) effectType = 3;       // 5% Reverse
        else if (rand < 0.10) effectType = 2;  // 5% Slip (cumulative 10%)
        else if (rand < 0.20) effectType = 1;  // 10% Respin (cumulative 20%)
        // else Normal (80%)

        // Debug overrides (Uncomment to test specific effects)
        // effectType = 1; // Force Respin
        // effectType = 2; // Force Slip
        // effectType = 3; // Force Reverse

        const startTime = performance.now();

        // Define phases for animation based on effect type
        let startRotation = currentRotation;
        let targetRotation = 0;
        let duration = 0;
        let phase = 0; // 0: Main Spin, 1+: Effects

        // Setup initial spin
        const baseDuration = (effectType === 1) ? 6000 : 8000;
        const randomDuration = Math.random() * 2000;
        duration = baseDuration + randomDuration;

        // Calculate Target
        const minSpins = 10;
        const randomAngle = Math.random() * Math.PI * 2;
        const totalRotationDelta = (Math.PI * 2 * minSpins) + randomAngle;

        targetRotation = startRotation + totalRotationDelta;

        let initialTarget = targetRotation;

        // Sound state
        let lastTickAngle = startRotation % (Math.PI * 2);
        const tickInterval = (Math.PI * 2) / rouletteItems.length;

        function animate(currentTime) {
            const elapsed = currentTime - startTime;

            // Phase 0: The main spin
            if (phase === 0) {
                if (elapsed < duration) {
                    const t = elapsed / duration;
                    const ease = 1 - Math.pow(1 - t, 5); // EaseOutQuint

                    currentRotation = startRotation + (initialTarget - startRotation) * ease;
                    drawRoulette(currentRotation);
                    checkTick();
                    requestAnimationFrame(animate);
                } else {
                    // Phase 0 Done.
                    currentRotation = initialTarget;
                    drawRoulette(currentRotation);

                    if (effectType === 0) {
                        finishSpin();
                    } else if (effectType === 1) {
                        phase = 1;
                        triggerRespin();
                    } else if (effectType === 2) {
                        phase = 2;
                        triggerSlip();
                    } else if (effectType === 3) {
                        phase = 3;
                        triggerReverse();
                    }
                }
            }
        }

        function checkTick() {
            const currentNormalized = currentRotation % (Math.PI * 2);
            const currentSegment = Math.floor(currentNormalized / tickInterval);
            const lastSegment = Math.floor(lastTickAngle / tickInterval);

            if (currentSegment !== lastSegment) {
                playTickSound();
            }
            lastTickAngle = currentNormalized;
        }

        // --- Effect 1: Respin ---
        function triggerRespin() {
            setTimeout(() => {
                playTickSound();

                const respinStart = performance.now();
                const respinDuration = 4000;
                const respinStartRot = currentRotation;
                const respinDelta = (Math.PI * 2 * 5) + (Math.random() * Math.PI * 2);
                const respinTarget = respinStartRot + respinDelta;

                spinBtn.textContent = "再始動！？";
                spinBtn.style.color = "#ff4444";

                function animateRespin(now) {
                    const el = now - respinStart;
                    if (el < respinDuration) {
                        const t = el / respinDuration;
                        const ease = 1 - Math.pow(1 - t, 4);

                        currentRotation = respinStartRot + (respinTarget - respinStartRot) * ease;
                        drawRoulette(currentRotation);
                        checkTick();
                        requestAnimationFrame(animateRespin);
                    } else {
                        currentRotation = respinTarget;
                        drawRoulette(currentRotation);
                        finishSpin();
                    }
                }
                requestAnimationFrame(animateRespin);

            }, 800);
        }

        // --- Effect 2: Slip ---
        function triggerSlip() {
            setTimeout(() => {
                const slipStart = performance.now();
                const slipDuration = 500;
                const slipStartRot = currentRotation;
                const slipDelta = tickInterval; // 1 segment

                spinBtn.textContent = "滑り！？";
                spinBtn.style.color = "#f59e0b";

                playTickSound();

                function animateSlip(now) {
                    const el = now - slipStart;
                    if (el < slipDuration) {
                        const t = el / slipDuration;
                        // Elastic Out for bump effect
                        const c4 = (2 * Math.PI) / 3;
                        const ease = t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;

                        currentRotation = slipStartRot + (slipDelta * ease);
                        drawRoulette(currentRotation);
                        requestAnimationFrame(animateSlip);
                    } else {
                        currentRotation = slipStartRot + slipDelta;
                        drawRoulette(currentRotation);
                        finishSpin();
                    }
                }
                requestAnimationFrame(animateSlip);

            }, 600);
        }

        // --- Effect 3: Reverse ---
        function triggerReverse() {
            setTimeout(() => {
                const revStart = performance.now();
                const revDuration = 1500; // Bounce back quickly
                const revStartRot = currentRotation;

                // Move BACKWARDS by random amount (2-5 segments)
                const segmentsBack = 2 + Math.floor(Math.random() * 3);
                const revDelta = -(tickInterval * segmentsBack);

                spinBtn.textContent = "逆回転！？";
                spinBtn.style.color = "#3b82f6";

                // Boing sound (simulated by rapid tick or result sound pitch shift? just result for now)
                playResultSound(); // Surprise!

                function animateReverse(now) {
                    const el = now - revStart;
                    if (el < revDuration) {
                        const t = el / revDuration;
                        // EaseOutBack for the bounce effect
                        const c1 = 1.70158;
                        const c3 = c1 + 1;
                        const ease = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);

                        currentRotation = revStartRot + (revDelta * ease);
                        drawRoulette(currentRotation);
                        // Check tick backwards?
                        checkTick();
                        requestAnimationFrame(animateReverse);
                    } else {
                        currentRotation = revStartRot + revDelta;
                        drawRoulette(currentRotation);
                        finishSpin();
                    }
                }
                requestAnimationFrame(animateReverse);

            }, 600);
        }


        function finishSpin() {
            // Reset Button Style
            spinBtn.style.color = "";
            spinBtn.textContent = "もう一度回す";

            // Calculate Result
            const normalizedRotation = (currentRotation % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);

            const anglePerSegment = (2 * Math.PI) / rouletteItems.length;
            const pointerAngle = -Math.PI / 2;
            let indexFloat = (pointerAngle - normalizedRotation) / anglePerSegment;
            while (indexFloat < 0) indexFloat += rouletteItems.length;

            const winningIndex = Math.floor(indexFloat) % rouletteItems.length;
            const winningItem = rouletteItems[winningIndex];

            // Play Success Sound
            playResultSound();

            // Effect badge
            let effectBadge = "";
            if (effectType === 1) effectBadge = "<span style='font-size:0.7rem; background:#ff4444; color:white; padding:2px 6px; border-radius:4px; margin-bottom:5px; display:inline-block;'>再始動発動！</span><br>";
            if (effectType === 2) effectBadge = "<span style='font-size:0.7rem; background:#f59e0b; color:white; padding:2px 6px; border-radius:4px; margin-bottom:5px; display:inline-block;'>滑り発動！</span><br>";
            if (effectType === 3) effectBadge = "<span style='font-size:0.7rem; background:#3b82f6; color:white; padding:2px 6px; border-radius:4px; margin-bottom:5px; display:inline-block;'>逆回転発動！</span><br>";

            // Show Result
            rouletteResult.innerHTML = `
                ${effectBadge}
                <div style="font-size:0.8rem; color:#888;">RESULT</div>
                <div style="font-size:1.5rem; font-weight:bold; color:#bb86fc; text-shadow:0 0 10px rgba(187,134,252,0.5);">
                    ${winningItem}
                </div>
            `;

            isSpinning = false;
            spinBtn.disabled = false;
        }

        requestAnimationFrame(animate);
    });
}


// App Title Click
document.getElementById('app-title')?.addEventListener('click', () => {
    const homeBtn = document.querySelector('nav button[data-target="home"]');
    if (homeBtn) homeBtn.click();
});

// Start at bottom of script
// Replace the window load event listener with immediate execution for navigation
setupNavigation();
setupSessionFormToggles();

// Function to handle safe initialization
function safeInit() {
    init().catch(err => {
        console.error("Critical Init Error:", err);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', safeInit);
} else {
    safeInit();
}


// --- Yakuman Gallery & Modal Logic ---

function setupYakumanModal() {
    const modal = document.getElementById('yakuman-modal');
    const openBtn = document.getElementById('open-yakuman-modal-btn');
    const closeBtn = document.getElementById('close-yakuman-modal');
    const saveBtn = document.getElementById('save-yakuman-btn');

    // Inputs
    const playerSelect = document.getElementById('yakuman-player-select');
    const typeInput = document.getElementById('yakuman-type-input');
    const imageInput = document.getElementById('yakuman-image-input');
    const commentInput = document.getElementById('yakuman-comment-input');
    const imagePreview = document.getElementById('yakuman-image-preview');

    if (!modal || !openBtn) return;

    // OPEN
    openBtn.addEventListener('click', async () => {
        // Populate players from current session
        const session = await window.AppStorage.getSession(currentSessionId);
        if (!session) {
            alert('対局情報が見つかりません');
            return;
        }

        playerSelect.innerHTML = '';
        session.players.forEach(p => {
            const op = document.createElement('option');
            op.value = p;
            op.textContent = p;
            playerSelect.appendChild(op);
        });

        // Reset inputs
        typeInput.value = '';
        imageInput.value = '';
        commentInput.value = '';
        imagePreview.style.display = 'none';
        imagePreview.querySelector('img').src = '';

        // Reset upload state
        uploadPromise = null;
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = '登録する';
        }

        modal.style.display = 'flex';
    });

    // CLOSE
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    // IMAGE PREVIEW & UPLOAD OPTIMIZATION
    let uploadPromise = null; // Store pending upload promise
    let readyUploadResult = null; // Store result if upload finishes before save

    if (imageInput) {
        imageInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];

            // Reset states for new selection
            uploadPromise = null;
            readyUploadResult = null;
            if (saveBtn) saveBtn.disabled = false; // Re-enable save button

            if (file) {
                // 1. Preview
                const reader = new FileReader();
                reader.onload = (ev) => {
                    imagePreview.querySelector('img').src = ev.target.result;
                    imagePreview.style.display = 'block';
                };
                reader.readAsDataURL(file);

                // 2. Start Background Upload
                const progressContainer = document.getElementById('yakuman-upload-progress-container');
                const progressBar = document.getElementById('yakuman-upload-progress-bar');

                if (progressContainer && progressBar) {
                    progressContainer.style.display = 'block';
                    progressBar.style.width = '0%';
                }

                // Create promise
                uploadPromise = (async () => {
                    try {
                        const compressedBlob = await resizeAndCompressImage(file, 800, 0.6);
                        const timestamp = Date.now();
                        const path = `yakuman/${timestamp}_${Math.random().toString(36).substr(2, 9)}.jpg`;

                        const url = await window.AppStorage.uploadImage(compressedBlob, path, (progress) => {
                            if (progressBar) progressBar.style.width = `${progress}%`;
                        });

                        return { url, path };
                    } catch (err) {
                        console.error("BG Upload failed", err);
                        throw err;
                    }
                })();

                // On completion or failure
                uploadPromise.then((result) => {
                    readyUploadResult = result; // Store the successful result
                    if (progressBar) progressBar.style.width = '100%';
                    console.log("Image upload finished in background.");
                }).catch((err) => {
                    console.error("Upload Promise Failed:", err);
                    alert(`アップロードに失敗しました。\n詳細: ${err.message || err.code || '不明なエラー'}`);

                    // Clear states on failure
                    uploadPromise = null;
                    readyUploadResult = null;
                    if (progressContainer) progressContainer.style.display = 'none';
                    if (saveBtn) {
                        saveBtn.textContent = 'アップロード失敗 (再選択してください)';
                        saveBtn.disabled = true; // Keep disabled if failed
                    }
                });
            } else {
                // No file selected, clear states
                uploadPromise = null;
                readyUploadResult = null;
                if (saveBtn) {
                    saveBtn.textContent = '登録する';
                    saveBtn.disabled = false;
                }
                const progressContainer = document.getElementById('yakuman-upload-progress-container');
                if (progressContainer) progressContainer.style.display = 'none';
            }
        });
    }

    // SAVE
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const player = playerSelect.value;
            const type = typeInput.value.trim();
            const comment = commentInput.value.trim();

            if (!type) {
                alert('役満の種類を入力してください');
                return;
            }

            // Create Data Object Immediately
            const yakumanData = {
                id: Date.now(),
                playerName: player,
                type: type,
                comment: comment,
                imageUrl: null, // Will be updated
                imagePath: null,
                timestamp: Date.now(),
                isUploading: false,
                uploadPromise: null // To track background upload for this specific item
            };

            // Logic to handle image state
            if (readyUploadResult) {
                // Upload already finished successfully
                yakumanData.imageUrl = readyUploadResult.url;
                yakumanData.imagePath = readyUploadResult.path;
                console.log("Using pre-uploaded image result.");
            } else if (uploadPromise) {
                // Upload is still in progress - Optimistic Mode
                yakumanData.isUploading = true;

                // Use the PREVIEW image as temporary placeholder if possible
                const previewImg = document.querySelector('#yakuman-image-preview img');
                if (previewImg && previewImg.src) {
                    yakumanData.imageUrl = previewImg.src; // Local Blob URL
                }

                // Attach the promise to this data object so we can await it later if needed (at Game Submit)
                yakumanData.uploadPromise = uploadPromise.then(result => {
                    yakumanData.imageUrl = result.url;
                    yakumanData.imagePath = result.path;
                    yakumanData.isUploading = false;
                    console.log("Background Upload Completed for", type);
                }).catch(err => {
                    console.error("Background Upload Failed for", type, err);
                    alert(`「${type}」の画像アップロードに失敗しました。保存されません。`);
                    // Remove from pending list
                    const idx = pendingGameYakumans.indexOf(yakumanData);
                    if (idx > -1) pendingGameYakumans.splice(idx, 1);
                });

                // Show toast or alert (non-blocking)
                if (typeof showToast === 'function') showToast("画像をバックグラウンドでアップロードしています...");
                else alert('画像をバックグラウンドでアップロードしています。\n完了するまで画面を閉じないでください。');

            }
            // If no image was selected, imageUrl and imagePath remain null, which is fine.

            // Add to Pending
            pendingGameYakumans.push(yakumanData);

            alert('役満を一時保存しました。\nこの対局の結果を保存する際に一緒に記録されます。');

            // Close Modal Immediately
            modal.style.display = 'none';

            // Reset form for next entry
            typeInput.value = '';
            commentInput.value = '';
            imageInput.value = ''; // Clear file input
            imagePreview.style.display = 'none';
            imagePreview.querySelector('img').src = '';
            uploadPromise = null; // Clear global upload state
            readyUploadResult = null; // Clear global upload result
            const progressContainer = document.getElementById('yakuman-upload-progress-container');
            if (progressContainer) progressContainer.style.display = 'none';
            saveBtn.disabled = false;
            saveBtn.textContent = '登録する';
        });
    }
}

// Image Utility
function resizeAndCompressImage(file, maxSide, quality) {
    return new Promise((resolve, reject) => {
        // Timeout after 60 seconds
        const timeoutId = setTimeout(() => {
            reject(new Error("Image processing timed out"));
        }, 60000);

        const url = URL.createObjectURL(file);
        const img = new Image();
        img.src = url;
        img.onload = () => {
            clearTimeout(timeoutId);
            URL.revokeObjectURL(url); // Cleanup
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxSide) {
                    height *= maxSide / width;
                    width = maxSide;
                }
            } else {
                if (height > maxSide) {
                    width *= maxSide / height;
                    height = maxSide;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Canvas to Blob failed'));
            }, 'image/jpeg', quality);
        };
        img.onerror = (err) => {
            clearTimeout(timeoutId);
            URL.revokeObjectURL(url);
            reject(err);
        };
    });
}

// Image Viewer
function openImageViewer(url) {
    const modal = document.getElementById('image-viewer-modal');
    const img = document.getElementById('image-viewer-img');
    if (modal && img) {
        img.src = url;
        modal.style.display = 'flex';
    }
}

// Close Image Viewer Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('image-viewer-modal');
    const closeBtn = document.getElementById('close-image-viewer');

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (modal) modal.style.display = 'none';
        });
    }
});

// Render Gallery
window.renderGallery = async function () {
    const list = document.getElementById('gallery-list');
    if (!list) return;

    list.innerHTML = '<div style="text-align:center; grid-column: 1/-1;">読み込み中...</div>';

    try {
        const sessions = await window.AppStorage.getSessions();
        const allYakumans = [];

        sessions.forEach(s => {
            s.games.forEach(g => {
                g.players.forEach(p => {
                    if (p.yakuman && Array.isArray(p.yakuman)) {
                        p.yakuman.forEach(y => {
                            // Enrich data if needed
                            if (!y.timestamp) y.timestamp = s.date; // Fallback
                            allYakumans.push(y);
                        });
                    }
                });
            });
        });

        // Sort desc
        allYakumans.sort((a, b) => b.timestamp - a.timestamp);

        list.innerHTML = '';
        if (allYakumans.length === 0) {
            list.innerHTML = '<div style="text-align:center; grid-column: 1/-1; color: #94a3b8;">まだ役満の記録がありません。<br>対局中に「🌸 役満達成」ボタンから登録できます。</div>';
            return;
        }

        allYakumans.forEach(y => {
            const dateStr = new Date(y.timestamp).toLocaleDateString();
            const item = document.createElement('div');
            item.style.cssText = 'background: #1e293b; border-radius: 8px; border: 1px solid #334155; overflow: hidden; display: flex; flex-direction: column;';

            // imageUrl（旧）または imagePath（Base64/新）のどちらかを使う
            // data: または http で始まる場合のみ有効な画像として扱う（旧Firebase Storageパスは除外）
            const rawImage = y.imageUrl || y.imagePath || null;
            const displayImage = (rawImage && (rawImage.startsWith('data:') || rawImage.startsWith('http')))
                ? rawImage
                : null;

            let imgHtml = '';
            if (displayImage) {
                imgHtml = `<div style="height: 120px; background: url('${displayImage}') center/cover no-repeat; cursor: pointer;" onclick="openImageViewer('${displayImage}')"></div>`;
            } else {
                imgHtml = `<div style="height: 120px; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; font-size: 2rem;">🀄</div>`;
            }

            item.innerHTML = `
                 ${imgHtml}
                 <div style="padding: 10px;">
                     <div style="font-size: 0.8rem; color: #94a3b8; margin-bottom: 4px;">${dateStr}</div>
                     <div style="font-weight: bold; color: #fbbf24; font-size: 1.1rem; margin-bottom: 4px;">${y.type}</div>
                     <div style="font-size: 0.9rem; font-weight: bold; margin-bottom: 4px;">${y.playerName}</div>
                     <div style="font-size: 0.8rem; color: #cbd5e1; word-break: break-all;">${y.comment || ''}</div>
                 </div>
             `;
            list.appendChild(item);
        });

    } catch (e) {
        console.error(e);
        list.innerHTML = '<div style="text-align:center; grid-column: 1/-1;">エラーが発生しました</div>';
    }
};
