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
// Preset controls
const roulettePresetSelect = document.getElementById('roulette-preset-select');
const presetNewBtn = document.getElementById('preset-new');
const presetRenameBtn = document.getElementById('preset-rename');
const presetDuplicateBtn = document.getElementById('preset-duplicate');
const presetDeleteBtn = document.getElementById('preset-delete');

// State
let currentSessionId = null;
let editingGameId = null; // ID of the game being edited
let pendingGameData = null; // Store data while waiting for tie-breaker
let pendingGameYakumans = []; // [NEW] Store yakumans for current game input

// Roulette State
let roulettePresets = [];      // [{id, name, mode, items:[{label, weight}]}]
let currentPresetId = null;
let rouletteItems = [];        // アクティブなプリセットの items への参照
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
    if (profileBtn) profileBtn.style.display = 'flex';

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

// Convert raw Firebase auth errors into safe Japanese messages.
// Sign-in failures are deliberately collapsed into one generic message so
// the UI never reveals whether an email is registered (account enumeration).
function friendlyAuthError(rawError, context) {
    const err = (rawError || '').toString();
    const has = (code) => err.includes(code);

    if (has('auth/invalid-credential') || has('auth/invalid-login-credentials') ||
        has('auth/wrong-password') || has('auth/user-not-found')) {
        return 'メールアドレスまたはパスワードが正しくありません。';
    }
    if (has('auth/invalid-email')) return 'メールアドレスの形式が正しくありません。';
    if (has('auth/email-already-in-use')) return 'このメールアドレスは既に使用されています。ログインしてください。';
    if (has('auth/weak-password')) return 'パスワードは6文字以上で設定してください。';
    if (has('auth/too-many-requests')) return '試行回数が多すぎます。しばらく時間をおいて再度お試しください。';
    if (has('auth/user-disabled')) return 'このアカウントは無効化されています。';
    if (has('auth/network-request-failed')) return 'ネットワークに接続できませんでした。通信環境をご確認ください。';
    if (has('auth/popup-closed-by-user') || has('auth/cancelled-popup-request')) return 'ログインがキャンセルされました。';

    return context === 'signup'
        ? '登録に失敗しました。しばらくしてから再度お試しください。'
        : 'ログインに失敗しました。しばらくしてから再度お試しください。';
}

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
            showError(loginError, friendlyAuthError(result.error, 'login'));
        }
    });
}

const forgotPasswordBtn = document.getElementById('forgot-password');
if (forgotPasswordBtn) {
    forgotPasswordBtn.addEventListener('click', async () => {
        const email = loginEmailInput.value.trim();
        loginError.classList.remove('is-success');
        if (!email) {
            showError(loginError, "メールアドレスを入力してから「パスワードをお忘れですか？」を押してください。");
            loginEmailInput.focus();
            return;
        }
        const result = await window.AppStorage.auth.resetPassword(email);
        // Treat "user not found" as success too, so we never disclose whether
        // the address is registered (account enumeration protection).
        if (result.success || (result.error && result.error.includes('auth/user-not-found'))) {
            loginError.classList.add('is-success');
            showError(loginError, "パスワード再設定用のメールを送信しました。届かない場合は迷惑メールもご確認ください。");
        } else if (result.error && result.error.includes('auth/invalid-email')) {
            showError(loginError, "メールアドレスの形式が正しくありません。");
        } else {
            showError(loginError, "メールの送信に失敗しました。しばらくしてから再度お試しください。");
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
            showError(signupError, friendlyAuthError(result.error, 'signup'));
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
            showError(loginError, friendlyAuthError(result.error, 'login'));
        }
    });
}

const googleSignupBtn = document.getElementById('google-signup-btn');
if (googleSignupBtn) {
    googleSignupBtn.addEventListener('click', async () => {
        const result = await window.AppStorage.auth.signInWithGoogle();
        if (!result.success) {
            showError(signupError, friendlyAuthError(result.error, 'signup'));
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

        // data-target を持たないボタン（「その他」など）は専用ハンドラで処理するためスキップ
        if (!btn.dataset.target) return;
        if (btn.dataset.listenerAttached) return;

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = btn.dataset.target;
            navigateTo(targetId);
        });
        btn.dataset.listenerAttached = 'true';
    });

    // 1b. ヘッダーアイコン（ユーザー設定 / ルール設定）
    const profileBtn = document.getElementById('header-profile-btn');
    if (profileBtn && !profileBtn.dataset.listenerAttached) {
        profileBtn.addEventListener('click', () => openProfileModal());
        profileBtn.dataset.listenerAttached = 'true';
    }
    const settingsBtn = document.getElementById('header-settings-btn');
    if (settingsBtn && !settingsBtn.dataset.listenerAttached) {
        settingsBtn.addEventListener('click', () => navigateTo('settings'));
        settingsBtn.dataset.listenerAttached = 'true';
    }

    // 1c. ホームの「新規セット」フォーム開閉
    const newSetToggle = document.getElementById('new-set-toggle');
    if (newSetToggle && !newSetToggle.dataset.listenerAttached) {
        newSetToggle.addEventListener('click', () => {
            const panel = document.getElementById('new-set-panel');
            const isOpen = panel && panel.style.display !== 'none';
            setNewSetPanel(!isOpen);
            if (!isOpen) {
                // 開いたら初期化（自分セット・ルール読込・状態反映）＋スクロール
                onNewSetPanelOpen();
                document.getElementById('new-set-panel')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
        newSetToggle.dataset.listenerAttached = 'true';
    }
    const newSetCancel = document.getElementById('new-set-cancel');
    if (newSetCancel && !newSetCancel.dataset.listenerAttached) {
        newSetCancel.addEventListener('click', () => setNewSetPanel(false));
        newSetCancel.dataset.listenerAttached = 'true';
    }

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

// 詳細画面 → どのボトムナビタブを点灯させるかのマッピング
// （設定はヘッダーアイコン経由なのでボトムタブの点灯対象外）
const NAV_PARENT_MAP = {
    'home': 'home',
    'session-detail': 'home',
    'input': 'home',
    'users': 'users',
    'user-detail': 'users',
    'league-section': 'league-section',
    'roulette': 'roulette',
    'gallery': 'gallery'
};

// 認証・初期設定画面（ヘッダーアイコンを隠す）
const AUTH_SCREENS = ['login', 'signup', 'link-user'];

// ホームの「新規セット」フォームパネルの開閉
function setNewSetPanel(open) {
    const panel = document.getElementById('new-set-panel');
    const toggle = document.getElementById('new-set-toggle');
    if (!panel || !toggle) return;
    panel.style.display = open ? 'block' : 'none';
    toggle.classList.toggle('open', open);
    const label = toggle.querySelector('.new-set-cta__label');
    if (label) label.textContent = open ? '閉じる' : '新規セット';
}

function navigateTo(targetId) {
    if (!targetId) return;
    console.log(`Navigating to: ${targetId}. Found ${sections.length} sections.`);

    // Update Sections
    sections.forEach(s => {
        s.classList.remove('active');
        // Force inline style toggle to ensure visibility
        s.style.display = 'none';

        if (s.id === targetId) {
            s.classList.add('active');
            s.style.display = 'block';
            console.log("Navigated to:", targetId); // Debug log
        }
    });

    // Render dynamic section content
    if (targetId === 'gallery' && window.renderGallery) {
        window.renderGallery();
    }
    if (targetId === 'league-section' && window.League) {
        window.League.renderList(document.getElementById('league-section'));
    }
    // ホームは履歴ファースト：表示のたびに新規セットフォームは畳む
    if (targetId === 'home') {
        setNewSetPanel(false);
    }

    // ボトムナビのアクティブ表示（詳細画面は親タブを点灯）
    const activeNav = NAV_PARENT_MAP[targetId] || null;
    navButtons.forEach(b => {
        const match = b.dataset.target && b.dataset.target === activeNav;
        b.classList.toggle('active', !!match);
    });
    // ヘッダーアイコン（ユーザー設定 / ルール設定）は認証画面以外で表示
    const isAuthScreen = AUTH_SCREENS.includes(targetId);
    const profileBtn = document.getElementById('header-profile-btn');
    const settingsBtn = document.getElementById('header-settings-btn');
    if (profileBtn) profileBtn.style.display = isAuthScreen ? 'none' : 'flex';
    if (settingsBtn) settingsBtn.style.display = isAuthScreen ? 'none' : 'flex';

    // スコア入力中はミスタップ防止でボトムナビを隠す
    document.body.classList.toggle('hide-bottom-nav', targetId === 'input');

    // Hide the global app header on the standalone auth screens so the
    // card's own branding badge isn't duplicated by the header logo.
    document.body.classList.toggle('auth-fullscreen', targetId === 'signup' || targetId === 'login');

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
    // Roulette preset controls
    const presetControls = [
        document.getElementById('roulette-preset-select'),
        document.getElementById('preset-new'),
        document.getElementById('preset-rename'),
        document.getElementById('preset-duplicate'),
        document.getElementById('preset-delete')
    ];

    // Messages to toggle
    const restrictionMsgs = document.querySelectorAll('.restricted-access-msg');
    // ホームの新規セット作成 CTA
    const newSetToggle = document.getElementById('new-set-toggle');

    if (isRestricted) {
        // Hide/Disable active elements
        if (sessionSetupForm) sessionSetupForm.style.display = 'none';
        if (newSetToggle) newSetToggle.style.display = 'none';
        setNewSetPanel(false);
        if (newGameBtn) newGameBtn.style.display = 'none';
        if (spinBtn) spinBtn.disabled = true;
        if (addRouletteItemBtn) addRouletteItemBtn.disabled = true;
        if (rouletteInput) rouletteInput.disabled = true;
        presetControls.forEach(el => { if (el) el.disabled = true; });
        if (scoreForm) scoreForm.style.display = 'none';
        if (settingsForm) settingsForm.style.display = 'none';

        // Show messages
        restrictionMsgs.forEach(msg => msg.style.display = 'block');
    } else {
        // Show/Enable active elements
        if (sessionSetupForm) sessionSetupForm.style.display = 'block';
        if (newSetToggle) newSetToggle.style.display = 'flex';
        if (newGameBtn) newGameBtn.style.display = 'block';
        if (spinBtn) spinBtn.disabled = false;
        if (addRouletteItemBtn) addRouletteItemBtn.disabled = false;
        if (rouletteInput) rouletteInput.disabled = false;
        presetControls.forEach(el => { if (el) el.disabled = false; });
        if (scoreForm) scoreForm.style.display = 'block';
        if (settingsForm) settingsForm.style.display = 'block';

        // Hide messages
        restrictionMsgs.forEach(msg => msg.style.display = 'none');
    }
}

// --- DOM Elements ---
const userProfileModal = document.getElementById('user-profile-modal');
const profileUserSelect = document.getElementById('profile-user-select');
const closeProfileModalBtn = document.getElementById('close-profile-modal');
const signOutBtn = document.getElementById('sign-out-btn');

// プロフィールモーダルを開く（「その他」シートのユーザー設定から呼び出す）
async function openProfileModal() {
    // Load current info
    const deviceUser = localStorage.getItem('deviceUser') || '未設定';
    const currentUser = window.AppStorage.auth.currentUser;
    const email = currentUser ? currentUser.email : '未ログイン';

    // Update Modal Content
    const nameEl = document.getElementById('profile-game-name');
    const emailEl = document.getElementById('profile-email');

    if (nameEl) nameEl.textContent = deviceUser;
    if (emailEl) emailEl.textContent = email;

    // Account metadata (creation / last sign-in)
    const createdEl = document.getElementById('profile-created');
    const lastLoginEl = document.getElementById('profile-last-login');
    const meta = currentUser && currentUser.metadata;
    if (createdEl) createdEl.textContent = formatProfileDate(meta && meta.creationTime);
    if (lastLoginEl) lastLoginEl.textContent = formatProfileDate(meta && meta.lastSignInTime);

    // Show modal
    if (userProfileModal) {
        userProfileModal.style.display = 'flex';
    }

    // Load avatar (async; show placeholder until ready)
    setProfileAvatarImage(null);
    if (deviceUser && deviceUser !== '未設定') {
        try {
            const avatar = await window.AppStorage.getUserAvatar(deviceUser);
            setProfileAvatarImage(avatar);
        } catch (e) {
            console.error('Failed to load avatar:', e);
        }
    }
}

// --- Profile Avatar Upload ---
const profileAvatarBtn = document.getElementById('profile-avatar-btn');
const profileAvatarInput = document.getElementById('profile-avatar-input');
const profileAvatarImg = document.getElementById('profile-avatar-img');
const profileAvatarPlaceholder = document.getElementById('profile-avatar-placeholder');
const profileAvatarLoading = document.getElementById('profile-avatar-loading');
const profileAvatarMenu = document.getElementById('profile-avatar-menu');
const profileAvatarMenuChange = document.getElementById('profile-avatar-menu-change');
const profileAvatarMenuRemove = document.getElementById('profile-avatar-menu-remove');

let profileHasAvatar = false;

function openProfileAvatarMenu() {
    if (profileAvatarMenu) {
        profileAvatarMenu.style.display = 'flex';
        // Defer to next frame so the transition kicks in
        requestAnimationFrame(() => profileAvatarMenu.classList.add('is-open'));
    }
}

function closeProfileAvatarMenu() {
    if (profileAvatarMenu) {
        profileAvatarMenu.classList.remove('is-open');
        // Wait for the fade-out before hiding (matches CSS transition)
        setTimeout(() => {
            if (profileAvatarMenu && !profileAvatarMenu.classList.contains('is-open')) {
                profileAvatarMenu.style.display = 'none';
            }
        }, 160);
    }
}

function openProfileAvatarFilePicker() {
    if (!profileAvatarInput) return;
    profileAvatarInput.value = '';
    profileAvatarInput.click();
}

function setProfileAvatarImage(base64OrUrl) {
    if (!profileAvatarImg || !profileAvatarPlaceholder) return;
    if (base64OrUrl) {
        profileAvatarImg.src = base64OrUrl;
        profileAvatarImg.style.display = 'block';
        profileAvatarPlaceholder.style.display = 'none';
        profileHasAvatar = true;
    } else {
        profileAvatarImg.removeAttribute('src');
        profileAvatarImg.style.display = 'none';
        profileAvatarPlaceholder.style.display = '';
        profileHasAvatar = false;
    }
}

function setProfileAvatarLoading(loading) {
    if (profileAvatarLoading) profileAvatarLoading.style.display = loading ? 'block' : 'none';
    if (profileAvatarBtn) profileAvatarBtn.disabled = !!loading;
}

if (profileAvatarBtn && profileAvatarInput) {
    profileAvatarBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (profileHasAvatar) {
            // Toggle the popover menu
            const isOpen = profileAvatarMenu && profileAvatarMenu.classList.contains('is-open');
            if (isOpen) {
                closeProfileAvatarMenu();
            } else {
                openProfileAvatarMenu();
            }
        } else {
            // No avatar yet — go straight to the file picker
            openProfileAvatarFilePicker();
        }
    });
}

if (profileAvatarMenuChange) {
    profileAvatarMenuChange.addEventListener('click', () => {
        closeProfileAvatarMenu();
        openProfileAvatarFilePicker();
    });
}

if (profileAvatarMenuRemove) {
    profileAvatarMenuRemove.addEventListener('click', async () => {
        closeProfileAvatarMenu();
        const deviceUser = localStorage.getItem('deviceUser');
        if (!deviceUser) return;
        if (!confirm('プロフィール画像を削除しますか？')) return;

        setProfileAvatarLoading(true);
        try {
            const ok = await window.AppStorage.updateUserAvatar(deviceUser, null);
            if (!ok) throw new Error('削除に失敗しました');
            setProfileAvatarImage(null);
        } catch (err) {
            console.error('Avatar delete failed:', err);
            alert(`画像の削除に失敗しました\n${err.message || ''}`);
        } finally {
            setProfileAvatarLoading(false);
        }
    });
}

// Close the popover when clicking outside the avatar/menu
document.addEventListener('click', (e) => {
    if (!profileAvatarMenu || profileAvatarMenu.style.display === 'none') return;
    if (profileAvatarBtn && profileAvatarBtn.contains(e.target)) return;
    if (profileAvatarMenu.contains(e.target)) return;
    closeProfileAvatarMenu();
});

if (profileAvatarInput) {
    profileAvatarInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            alert('画像ファイルを選択してください');
            return;
        }
        openAvatarCropper(file);
    });
}

function formatProfileDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}/${m}/${day}`;
}

// --- Avatar Cropper ---
const avatarCropperModal = document.getElementById('avatar-cropper-modal');
const avatarCropperStage = document.getElementById('avatar-cropper-stage');
const avatarCropperImage = document.getElementById('avatar-cropper-image');
const avatarCropperZoom = document.getElementById('avatar-cropper-zoom');
const avatarCropperCancelBtn = document.getElementById('avatar-cropper-cancel');
const avatarCropperConfirmBtn = document.getElementById('avatar-cropper-confirm');

const cropState = {
    objectUrl: null,
    natW: 0,
    natH: 0,
    stageSize: 280,
    minScale: 1, // fit-cover scale
    scale: 1,
    tx: 0,
    ty: 0,
    dragging: false,
    startPx: 0,
    startPy: 0,
    startTx: 0,
    startTy: 0,
};

function applyCropTransform() {
    avatarCropperImage.style.transform =
        `translate(${cropState.tx}px, ${cropState.ty}px) scale(${cropState.scale})`;
}

function clampCropOffsets() {
    const W = cropState.stageSize;
    const minTx = W - cropState.natW * cropState.scale;
    const minTy = W - cropState.natH * cropState.scale;
    cropState.tx = Math.min(0, Math.max(minTx, cropState.tx));
    cropState.ty = Math.min(0, Math.max(minTy, cropState.ty));
}

function openAvatarCropper(file) {
    if (cropState.objectUrl) URL.revokeObjectURL(cropState.objectUrl);
    cropState.objectUrl = URL.createObjectURL(file);

    avatarCropperImage.onload = () => {
        cropState.natW = avatarCropperImage.naturalWidth;
        cropState.natH = avatarCropperImage.naturalHeight;
        const W = cropState.stageSize;
        // Fit-cover so the image fully covers the square stage
        const coverScale = Math.max(W / cropState.natW, W / cropState.natH);
        cropState.minScale = coverScale;
        cropState.scale = coverScale;
        // Slider range: 1x (cover) to 3x cover
        avatarCropperZoom.min = '1';
        avatarCropperZoom.max = '3';
        avatarCropperZoom.step = '0.01';
        avatarCropperZoom.value = '1';
        // Center
        cropState.tx = (W - cropState.natW * cropState.scale) / 2;
        cropState.ty = (W - cropState.natH * cropState.scale) / 2;
        clampCropOffsets();
        applyCropTransform();
    };
    avatarCropperImage.src = cropState.objectUrl;
    avatarCropperModal.style.display = 'flex';
}

function closeAvatarCropper() {
    avatarCropperModal.style.display = 'none';
    if (cropState.objectUrl) {
        URL.revokeObjectURL(cropState.objectUrl);
        cropState.objectUrl = null;
    }
    avatarCropperImage.removeAttribute('src');
    // Reset the file input so picking the same file again still triggers change
    if (profileAvatarInput) profileAvatarInput.value = '';
}

if (avatarCropperZoom) {
    avatarCropperZoom.addEventListener('input', () => {
        const W = cropState.stageSize;
        const multiplier = parseFloat(avatarCropperZoom.value) || 1;
        const newScale = cropState.minScale * multiplier;
        // Keep stage center anchored while zooming
        const centerX = W / 2;
        const centerY = W / 2;
        const imgCxBefore = (centerX - cropState.tx) / cropState.scale;
        const imgCyBefore = (centerY - cropState.ty) / cropState.scale;
        cropState.scale = newScale;
        cropState.tx = centerX - imgCxBefore * newScale;
        cropState.ty = centerY - imgCyBefore * newScale;
        clampCropOffsets();
        applyCropTransform();
    });
}

if (avatarCropperStage) {
    const onPointerDown = (e) => {
        cropState.dragging = true;
        cropState.startPx = e.clientX;
        cropState.startPy = e.clientY;
        cropState.startTx = cropState.tx;
        cropState.startTy = cropState.ty;
        avatarCropperStage.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e) => {
        if (!cropState.dragging) return;
        cropState.tx = cropState.startTx + (e.clientX - cropState.startPx);
        cropState.ty = cropState.startTy + (e.clientY - cropState.startPy);
        clampCropOffsets();
        applyCropTransform();
    };
    const onPointerUp = (e) => {
        cropState.dragging = false;
        try { avatarCropperStage.releasePointerCapture(e.pointerId); } catch (_) { }
    };
    avatarCropperStage.addEventListener('pointerdown', onPointerDown);
    avatarCropperStage.addEventListener('pointermove', onPointerMove);
    avatarCropperStage.addEventListener('pointerup', onPointerUp);
    avatarCropperStage.addEventListener('pointercancel', onPointerUp);

    // Mouse wheel zoom on desktop
    avatarCropperStage.addEventListener('wheel', (e) => {
        e.preventDefault();
        const cur = parseFloat(avatarCropperZoom.value) || 1;
        const step = e.deltaY < 0 ? 0.08 : -0.08;
        const next = Math.min(3, Math.max(1, cur + step));
        avatarCropperZoom.value = String(next);
        avatarCropperZoom.dispatchEvent(new Event('input'));
    }, { passive: false });
}

if (avatarCropperCancelBtn) {
    avatarCropperCancelBtn.addEventListener('click', closeAvatarCropper);
}

if (avatarCropperConfirmBtn) {
    avatarCropperConfirmBtn.addEventListener('click', async () => {
        const deviceUser = localStorage.getItem('deviceUser');
        if (!deviceUser) {
            alert('ユーザー名が設定されていません');
            return;
        }

        const OUT = 256; // final avatar resolution (px)
        const W = cropState.stageSize;
        // Visible region of the image in image-coords
        const srcX = -cropState.tx / cropState.scale;
        const srcY = -cropState.ty / cropState.scale;
        const srcSize = W / cropState.scale;

        const canvas = document.createElement('canvas');
        canvas.width = OUT;
        canvas.height = OUT;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(avatarCropperImage, srcX, srcY, srcSize, srcSize, 0, 0, OUT, OUT);

        const blob = await new Promise((resolve) =>
            canvas.toBlob(resolve, 'image/jpeg', 0.85)
        );
        if (!blob) {
            alert('画像の生成に失敗しました');
            return;
        }

        // Close cropper first to give immediate feedback
        closeAvatarCropper();

        setProfileAvatarLoading(true);
        try {
            const base64 = await window.AppStorage.uploadImage(blob, `avatars/${deviceUser}.jpg`);
            if (!base64) throw new Error('画像変換に失敗しました');
            if (base64.length > 900_000) {
                throw new Error('画像サイズが大きすぎます。別の画像を選んでください。');
            }
            const ok = await window.AppStorage.updateUserAvatar(deviceUser, base64);
            if (!ok) throw new Error('保存に失敗しました');
            setProfileAvatarImage(base64);
        } catch (err) {
            console.error('Avatar upload failed:', err);
            alert(`プロフィール画像の保存に失敗しました\n${err.message || ''}`);
        } finally {
            setProfileAvatarLoading(false);
        }
    });
}


if (closeProfileModalBtn) {
    closeProfileModalBtn.addEventListener('click', () => {
        if (userProfileModal) {
            userProfileModal.style.display = 'none';
        }
        closeProfileAvatarMenu();
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

// Reauth Modal Elements
const reauthModal = document.getElementById('reauth-modal');
const reauthPasswordInput = document.getElementById('reauth-password-input');
const reauthError = document.getElementById('reauth-error');
const reauthCancelBtn = document.getElementById('reauth-cancel-btn');
const reauthSubmitBtn = document.getElementById('reauth-submit-btn');

// Holds the new password between the initial updatePassword attempt and the post-reauth retry.
let pendingNewPassword = null;

function resetPasswordChangeForm() {
    passwordChangeForm.style.display = 'none';
    showPasswordChangeBtn.style.display = 'inline-block';
    if (newPasswordInput) newPasswordInput.value = '';
}

// Tracks whether the user-profile-modal was visible before we hid it for reauth,
// so we can restore it on cancel.
let reauthWasProfileModalOpen = false;

function closeReauthModal(restoreProfile) {
    if (reauthModal) reauthModal.style.display = 'none';
    if (reauthPasswordInput) reauthPasswordInput.value = '';
    if (reauthError) reauthError.textContent = '';
    pendingNewPassword = null;
    if (restoreProfile && reauthWasProfileModalOpen && userProfileModal) {
        userProfileModal.style.display = 'flex';
    }
    reauthWasProfileModalOpen = false;
}

function openReauthModal() {
    if (!reauthModal) return;
    reauthWasProfileModalOpen = !!(userProfileModal && userProfileModal.style.display !== 'none' && userProfileModal.style.display !== '');
    if (reauthWasProfileModalOpen) {
        userProfileModal.style.display = 'none';
    }
    if (reauthError) reauthError.textContent = '';
    if (reauthPasswordInput) reauthPasswordInput.value = '';
    reauthModal.style.display = 'flex';
    setTimeout(() => { if (reauthPasswordInput) reauthPasswordInput.focus(); }, 50);
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
            resetPasswordChangeForm();
            return;
        }

        if (result.error === 'auth/requires-recent-login') {
            const providerId = window.AppStorage.auth.getProviderId();
            if (providerId && providerId !== 'password') {
                alert('このアカウントはメールアドレス/パスワードでのログインではないため、パスワードを変更できません。');
                return;
            }
            pendingNewPassword = newPassword;
            openReauthModal();
        } else {
            alert('パスワードの変更に失敗しました: ' + result.message);
        }
    });
}

if (reauthCancelBtn) {
    reauthCancelBtn.addEventListener('click', () => {
        closeReauthModal(true);
    });
}

if (reauthSubmitBtn) {
    reauthSubmitBtn.addEventListener('click', async () => {
        const currentPassword = reauthPasswordInput ? reauthPasswordInput.value : '';
        if (!currentPassword) {
            if (reauthError) reauthError.textContent = '現在のパスワードを入力してください。';
            return;
        }
        if (!pendingNewPassword) {
            if (reauthError) reauthError.textContent = '内部エラー: 新しいパスワードが見つかりません。';
            return;
        }

        reauthSubmitBtn.disabled = true;
        const prevLabel = reauthSubmitBtn.textContent;
        reauthSubmitBtn.textContent = '認証中...';
        if (reauthError) reauthError.textContent = '';

        const reauthResult = await window.AppStorage.auth.reauthenticate(currentPassword);
        if (!reauthResult.success) {
            reauthSubmitBtn.disabled = false;
            reauthSubmitBtn.textContent = prevLabel;
            if (reauthResult.error === 'auth/wrong-password' || reauthResult.error === 'auth/invalid-credential') {
                if (reauthError) reauthError.textContent = 'パスワードが間違っています。';
            } else if (reauthResult.error === 'auth/too-many-requests') {
                if (reauthError) reauthError.textContent = '試行回数が多すぎます。しばらく待ってから再試行してください。';
            } else {
                if (reauthError) reauthError.textContent = '再認証に失敗しました: ' + (reauthResult.message || reauthResult.error);
            }
            return;
        }

        const updateResult = await window.AppStorage.auth.updatePassword(pendingNewPassword);
        reauthSubmitBtn.disabled = false;
        reauthSubmitBtn.textContent = prevLabel;

        if (updateResult.success) {
            closeReauthModal(false);
            resetPasswordChangeForm();
            alert('パスワードを変更しました。');
        } else {
            if (reauthError) reauthError.textContent = 'パスワードの変更に失敗しました: ' + (updateResult.message || updateResult.error);
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

// リーグ戦・役満ギャラリーへの遷移はボトムナビ／「その他」シート経由。
// 描画は navigateTo() 内で行う（league-section→League.renderList, gallery→renderGallery）。

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

// =========================================================================
// 新規セット：座席カードのロジック
// =========================================================================
const SEAT_IDS = ['p1', 'p2', 'p3', 'p4'];
const avatarCache = {}; // name -> base64 | null
const RULES_LS_KEY = 'lastSetRules';

// 指定座席の現在値（select選択 or ゲスト入力）
function getSeatName(pid) {
    const wrapper = document.getElementById(`${pid}-wrapper`);
    if (!wrapper) return '';
    const select = wrapper.querySelector('select');
    const input = wrapper.querySelector('input');
    if (select && select.style.display !== 'none') return select.value || '';
    return input ? (input.value || '').trim() : '';
}

// 座席のモード切替（ゲスト入力 / リスト選択）
function setSeatGuestMode(pid, guest) {
    const wrapper = document.getElementById(`${pid}-wrapper`);
    if (!wrapper) return;
    const select = wrapper.querySelector('select');
    const input = wrapper.querySelector('input');
    const btn = wrapper.querySelector('.toggle-guest-btn');
    if (guest) {
        select.style.display = 'none';
        select.removeAttribute('required');
        input.style.display = 'block';
        input.setAttribute('required', '');
        if (btn) { btn.textContent = '📋'; btn.title = 'リストから選択'; }
    } else {
        select.style.display = 'block';
        select.setAttribute('required', '');
        input.style.display = 'none';
        input.removeAttribute('required');
        if (btn) { btn.textContent = '🖊️'; btn.title = '手動入力切替'; }
    }
}

// 座席にプレイヤーをセット（リストにあればselect、なければゲスト入力に）
function setSeatName(pid, name) {
    const wrapper = document.getElementById(`${pid}-wrapper`);
    if (!wrapper) return;
    const select = wrapper.querySelector('select');
    const input = wrapper.querySelector('input');
    if (!name) {
        setSeatGuestMode(pid, false);
        select.value = '';
        input.value = '';
        return;
    }
    const hasOption = Array.from(select.options).some(o => o.value === name);
    if (hasOption) {
        setSeatGuestMode(pid, false);
        select.value = name;
        input.value = '';
    } else {
        setSeatGuestMode(pid, true);
        input.value = name;
    }
}

// アバター表示を更新（画像 → イニシャル → ＋ の順でフォールバック）
async function updateSeatAvatar(pid) {
    const el = document.getElementById(`${pid}-avatar`);
    if (!el) return;
    const name = getSeatName(pid);
    if (!name) {
        el.innerHTML = '＋';
        return;
    }
    el.textContent = name.charAt(0); // イニシャルを即時表示
    if (avatarCache[name] === undefined && window.AppStorage && window.AppStorage.getUserAvatar) {
        try {
            avatarCache[name] = await window.AppStorage.getUserAvatar(name);
        } catch (e) {
            avatarCache[name] = null;
        }
    }
    // 取得後も同じ名前が表示されていれば画像を反映
    if (getSeatName(pid) === name && avatarCache[name]) {
        el.innerHTML = `<img src="${avatarCache[name]}" alt="">`;
    }
}

// 重複防止・空席ハイライト・開始ボタン活性・アバター更新をまとめて反映
function refreshSeatState() {
    const names = SEAT_IDS.map(getSeatName);
    const chosen = names.filter(Boolean);

    SEAT_IDS.forEach((pid, idx) => {
        const wrapper = document.getElementById(`${pid}-wrapper`);
        if (!wrapper) return;
        const select = wrapper.querySelector('select');
        const own = names[idx];
        // 他席で選択済みの名前を無効化（重複防止）
        Array.from(select.options).forEach(opt => {
            if (!opt.value) return;
            opt.disabled = opt.value !== own && chosen.includes(opt.value);
        });
        wrapper.classList.toggle('is-empty', !own);
        updateSeatAvatar(pid);
    });

    // 4人が揃い、重複が無いときだけ開始ボタンを活性化
    const isValid = chosen.length === 4 && new Set(chosen).size === 4;
    const submitBtn = document.getElementById('session-setup-submit-btn');
    if (submitBtn) submitBtn.disabled = !isValid;
}

// P1（起家）にデバイスユーザーを自動セット（空席のときのみ）
function prefillSelfSeat() {
    const deviceUser = localStorage.getItem('deviceUser');
    if (!deviceUser) return;
    if (getSeatName('p1')) return;
    const select = document.querySelector('#p1-wrapper select');
    if (select && Array.from(select.options).some(o => o.value === deviceUser)) {
        setSeatName('p1', deviceUser);
    }
}

// 「前回のメンバー」：自分が参加した最新セットの4人を呼び出す
async function fillPrevMembers() {
    const deviceUser = localStorage.getItem('deviceUser');
    let sessions = [];
    try {
        sessions = await window.AppStorage.getSessions();
    } catch (e) {
        sessions = [];
    }
    let target = sessions.find(s => Array.isArray(s.players) && s.players.includes(deviceUser));
    if (!target) target = sessions[0];
    if (!target || !Array.isArray(target.players) || target.players.length === 0) {
        if (typeof showToast === 'function') showToast('呼び出せる前回のメンバーがありません。');
        return;
    }
    const players = target.players.slice(0, 4);
    SEAT_IDS.forEach((pid, i) => setSeatName(pid, players[i] || ''));
    refreshSeatState();
    if (typeof showToast === 'function') showToast('前回のメンバーを呼び出しました。');
}

// 「席替え」：現在の着席をシャッフル
function shuffleSeats() {
    const names = SEAT_IDS.map(getSeatName);
    if (names.filter(Boolean).length < 2) return;
    for (let i = names.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [names[i], names[j]] = [names[j], names[i]];
    }
    SEAT_IDS.forEach((pid, i) => setSeatName(pid, names[i]));
    refreshSeatState();
}

// オカ表示の更新（返し点と配給原点から算出）
function updateOkaDisplay() {
    const okaEl = document.getElementById('new-set-oka');
    if (!okaEl) return;
    const start = Number(document.getElementById('new-set-start')?.value) || 0;
    const ret = Number(document.getElementById('new-set-return')?.value) || 0;
    const oka = ((ret - start) * 4) / 1000; // 1000点 = 1.0pt
    okaEl.textContent = `${oka > 0 ? '+' : ''}${oka.toFixed(1)}`;
    okaEl.style.color = oka >= 0 ? 'var(--secondary-color)' : 'var(--error-color)';
}

// 前回使用したルールを既定値として読み込む
function loadRememberedRules() {
    try {
        const raw = localStorage.getItem(RULES_LS_KEY);
        if (raw) {
            const r = JSON.parse(raw);
            const set = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.value = v; };
            set('new-set-start', r.startScore);
            set('new-set-return', r.returnScore);
            if (Array.isArray(r.uma)) {
                set('new-set-uma1', r.uma[0]); set('new-set-uma2', r.uma[1]);
                set('new-set-uma3', r.uma[2]); set('new-set-uma4', r.uma[3]);
            }
            if (r.tieBreaker) {
                const radio = document.querySelector(`input[name="newSetTieBreaker"][value="${r.tieBreaker}"]`);
                if (radio) radio.checked = true;
            }
        }
    } catch (e) { /* ignore */ }
    updateOkaDisplay();
}

// ルールを記憶（セット作成時に呼ぶ）
function rememberRules(rules) {
    try { localStorage.setItem(RULES_LS_KEY, JSON.stringify(rules)); } catch (e) { /* ignore */ }
}

// 新規セットフォームのイベント配線（起動時に一度だけ）
function setupNewSetForm() {
    SEAT_IDS.forEach(pid => {
        const wrapper = document.getElementById(`${pid}-wrapper`);
        if (!wrapper) return;
        const select = wrapper.querySelector('select');
        const input = wrapper.querySelector('input');
        if (select) select.addEventListener('change', refreshSeatState);
        if (input) input.addEventListener('input', refreshSeatState);
    });
    // ゲスト切替後も状態を再計算
    document.querySelectorAll('.toggle-guest-btn').forEach(btn => {
        btn.addEventListener('click', () => setTimeout(refreshSeatState, 0));
    });
    document.getElementById('seat-prev-members')?.addEventListener('click', fillPrevMembers);
    document.getElementById('seat-shuffle')?.addEventListener('click', shuffleSeats);
    ['new-set-start', 'new-set-return'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', updateOkaDisplay);
    });
}

// パネルを開いたときの初期化（自分セット・ルール読込・状態反映）
function onNewSetPanelOpen() {
    loadRememberedRules();
    prefillSelfSeat();
    refreshSeatState();
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

// 称号 id → 定義 の逆引き（ピン留め称号の表示解決用）
const TITLES_BY_ID = new Map(TITLES.map(t => [t.id, t]));

// セッションの時系列ソート用コンパレータ。
// date は日付のみ（時刻なし）なので、同日内は登録順を表す id（= 作成時の Date.now()）でタイブレークする。
function bySessionAsc(a, b) {
    return (new Date(a.date) - new Date(b.date)) || ((a.id || 0) - (b.id || 0));
}
function bySessionDesc(a, b) {
    return (new Date(b.date) - new Date(a.date)) || ((b.id || 0) - (a.id || 0));
}

async function getUserStats(userName, allSessions) {
    if (!allSessions || allSessions.length === 0) return null;

    // 登録順（date 昇順 → 同日は id 昇順）でセッションを並べてから収集する。
    // セッション内のゲームは追加順（配列順）が登録順なのでそのまま使う。
    const userGames = [];
    [...allSessions].sort(bySessionAsc).forEach(s => {
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

    // userGames は既に登録順（date→id）で収集済みなので再ソートしない
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

/**
 * リーグの終了条件（期間）に対局日が収まるか判定する。
 * - 期間(period)リーグ: 開始日〜終了日（終了日は23:59:59まで）の範囲内なら true。
 * - 半荘数(count)/条件なしのリーグ: 日付の制約はないので常に true。
 * @param {object} league
 * @param {string} dateStr - 対局日（'YYYY-MM-DD' 等）
 * @returns {boolean}
 */
function leagueAcceptsDate(league, dateStr) {
    const rule = league && league.rule;
    if (!rule || rule.type !== 'period') return true;
    if (!rule.start || !rule.end) return true; // 期間が未設定なら制約しない
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return true; // 日付不正時は弾かない（従来挙動を維持）
    const start = new Date(rule.start);
    const end = new Date(rule.end);
    end.setHours(23, 59, 59, 999);
    return d >= start && d <= end;
}

/**
 * 複数のリーグ候補から、記録先を1つ選ばせる確認ダイアログを表示する。
 * @param {Array<object>} candidates - 一致したリーグの配列
 * @returns {Promise<string|null>} 選択されたリーグID。スキップ/キャンセル時は null。
 */
function chooseLeagueDialog(candidates) {
    return new Promise((resolve) => {
        const fmtRule = (l) => (window.League && typeof window.League.formatRule === 'function')
            ? window.League.formatRule(l.rule)
            : '';
        const dialog = document.createElement('dialog');
        dialog.className = 'choose-league-modal';
        dialog.innerHTML = `
            <div class="choose-league-modal__head">
                <span class="choose-league-modal__icon">🏆</span>
                <h3 class="choose-league-modal__title">記録するリーグを選択</h3>
            </div>
            <p class="choose-league-modal__desc">この対局は複数のリーグの条件に一致します。記録するリーグを選んでください。</p>
            <div class="choose-league-modal__list">
                ${candidates.map(l => `
                    <button type="button" class="choose-league-modal__item" data-id="${escapeHtml(String(l.id))}">
                        <span class="choose-league-modal__item-title">${escapeHtml(l.title || '(無題)')}</span>
                        <span class="choose-league-modal__item-meta">📅 ${escapeHtml(fmtRule(l))} ・ 👥 ${l.players.length}名</span>
                    </button>
                `).join('')}
            </div>
            <div class="choose-league-modal__footer">
                <button type="button" class="btn-secondary" data-action="none">どれにも記録しない</button>
            </div>
        `;
        document.body.appendChild(dialog);

        let settled = false;
        const cleanup = (val) => {
            if (settled) return;
            settled = true;
            try { dialog.close(); } catch (_) {}
            dialog.remove();
            resolve(val);
        };

        dialog.querySelectorAll('.choose-league-modal__item').forEach(btn => {
            btn.addEventListener('click', () => cleanup(btn.dataset.id));
        });
        dialog.querySelector('[data-action="none"]').addEventListener('click', () => cleanup(null));
        // ESC キーや backdrop でのキャンセルは「記録しない」扱い
        dialog.addEventListener('cancel', (e) => { e.preventDefault(); cleanup(null); });

        dialog.showModal();
    });
}

/**
 * ボタンのローディング状態を切り替えるユーティリティ
 * @param {HTMLElement} btn - 対象ボタン
 * @param {boolean} isLoading - trueで処理中状態、falseで元に戻す
 * @param {string} [loadingText='処理中...'] - 処理中に表示するテキスト
 */
function setButtonLoading(btn, isLoading, loadingText = '処理中...') {
    if (!btn) return;
    if (isLoading) {
        btn.dataset.originalText = btn.innerHTML;
        btn.innerHTML = `<span style="display:inline-flex;align-items:center;gap:6px;">
            <span style="width:14px;height:14px;border:2px solid rgba(255,255,255,0.4);border-top-color:#fff;border-radius:50%;display:inline-block;animation:btn-spin 0.6s linear infinite;flex-shrink:0;"></span>
            ${loadingText}
        </span>`;
        btn.disabled = true;
        btn.style.opacity = '0.8';
    } else {
        btn.innerHTML = btn.dataset.originalText || btn.innerHTML;
        btn.disabled = false;
        btn.style.opacity = '';
    }
}

// ボタンスピナー用CSSキーフレームを動的に追加（重複防止）
if (!document.getElementById('btn-spin-style')) {
    const btnSpinStyle = document.createElement('style');
    btnSpinStyle.id = 'btn-spin-style';
    btnSpinStyle.textContent = '@keyframes btn-spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(btnSpinStyle);
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

// 一覧表示用の称号アイコンHTML。
// ユーザーが意図的に選択した称号（pinnedIds）だけを表示する。未設定(null)・0個なら何も表示しない。
function titleIconsForDisplay(pinnedIds, maxIcons = 3) {
    if (!Array.isArray(pinnedIds)) return '';
    return pinnedIds.slice(0, maxIcons)
        .map(id => TITLES_BY_ID.get(id))
        .filter(Boolean)
        .map(t => `<span class="title-icon" data-name="${t.name}" data-desc="${t.description}" style="cursor:pointer;" title="${t.name}\n${t.description}">${t.icon}</span>`)
        .join('');
}

// 累計スコアのスパークライン用ポイント（セッション単位の累積）を生成
function buildCumulativePoints(userName, sessions) {
    const userSessions = sessions
        .filter(s => s.games && s.games.some(g => g.players.some(p => p.name === userName)))
        .sort(bySessionAsc);
    const points = [];
    let total = 0;
    userSessions.forEach(s => {
        let ss = 0;
        s.games.forEach(g => {
            const p = g.players.find(x => x.name === userName);
            if (p) ss += (p.finalScore || 0);
        });
        total += ss;
        points.push(parseFloat(total.toFixed(1)));
    });
    return points;
}

// 小型スパークラインSVG（リーダーボード行用）
function miniSparklineSVG(points, w = 44, h = 24) {
    if (!points || points.length < 2) return '';
    const pad = 3;
    const min = Math.min(0, ...points);
    const max = Math.max(0, ...points);
    const range = (max - min) || 1;
    const toX = i => pad + (i / (points.length - 1)) * (w - pad * 2);
    const toY = v => pad + (h - pad * 2) - ((v - min) / range) * (h - pad * 2);
    const zeroY = toY(0).toFixed(1);
    const line = points.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
    const last = points[points.length - 1];
    const stroke = last >= 0 ? '#4ade80' : '#f87171';
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        <line x1="${pad}" y1="${zeroY}" x2="${w - pad}" y2="${zeroY}" stroke="rgba(148,163,184,0.3)" stroke-width="1" stroke-dasharray="2,2"/>
        <polyline points="${line}" fill="none" stroke="${stroke}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
    </svg>`;
}

// 一覧の並び替え状態（セッション内で保持）
let leaderboardSort = 'score';

async function renderUserList() {
    if (!userList) return;

    const [allUsers, sessions] = await Promise.all([
        window.AppStorage.getUsers(),
        window.AppStorage.getSessions()
    ]);

    const deviceUser = localStorage.getItem('deviceUser');
    const isAdmin = deviceUser === 'ヒロム';

    // マイメンバーフィルタリング: 管理者は全員表示、一般ユーザーは自分+マイメンバーのみ
    let users = allUsers;
    if (!isAdmin && deviceUser) {
        const myMembers = await window.AppStorage.getMyMembers(deviceUser);
        const visibleNames = new Set([deviceUser, ...myMembers]);
        users = allUsers.filter(u => visibleNames.has(u));
    } else if (!deviceUser) {
        // デバイスユーザー未設定は自分を特定できないので全員非表示
        users = [];
    }

    // 旧・自分専用セクションが残っていれば撤去
    const oldSelf = document.getElementById('self-user-section');
    if (oldSelf) oldSelf.remove();

    // リーダーボードのコンテナ（userList の直前に配置）
    let board = document.getElementById('leaderboard-container');
    if (!board) {
        board = document.createElement('div');
        board.id = 'leaderboard-container';
        if (userList.parentNode) userList.parentNode.insertBefore(board, userList);
    }
    // userList は空のまま、マイメンバー管理セクションのアンカーとして残す
    userList.innerHTML = '';

    if (users.length === 0) {
        board.innerHTML = `<div style="text-align:center; color:#94a3b8; padding:40px 0; font-size:0.9rem;">表示できるユーザーがいません。</div>`;
        await renderMyMemberSection(deviceUser, allUsers);
        return;
    }

    // 各ユーザーの集計
    const rows = await Promise.all(users.map(async name => {
        const stats = await getUserStats(name, sessions);
        const pinned = await window.AppStorage.getPinnedTitles(name);
        return {
            name,
            isSelf: name === deviceUser,
            gameCount: stats ? stats.gameCount : 0,
            totalScore: stats ? stats.totalScore : 0,
            avgRank: stats && stats.avgRank > 0 ? stats.avgRank : null,
            titleIcons: titleIconsForDisplay(pinned),
            spark: buildCumulativePoints(name, sessions),
        };
    }));

    // 並び替え
    const sorters = {
        score: (a, b) => b.totalScore - a.totalScore,
        rank: (a, b) => {
            // 平均順位は小さいほど上位。未対戦(null)は末尾へ
            if (a.avgRank === null && b.avgRank === null) return 0;
            if (a.avgRank === null) return 1;
            if (b.avgRank === null) return -1;
            return a.avgRank - b.avgRank;
        },
        games: (a, b) => b.gameCount - a.gameCount,
    };
    rows.sort(sorters[leaderboardSort] || sorters.score);
    // 実際の順位（メダル/番号用）を確定。同値は同順位（競技順位 1,2,2,4 方式）
    const metricOf = (r) => leaderboardSort === 'rank' ? r.avgRank
        : (leaderboardSort === 'games' ? r.gameCount : r.totalScore);
    let prevVal, prevPlace = 0;
    rows.forEach((r, i) => {
        const v = metricOf(r);
        if (i > 0 && v === prevVal) {
            r.place = prevPlace;
        } else {
            r.place = i + 1;
            prevPlace = r.place;
        }
        prevVal = v;
    });

    const SORTS = [
        { key: 'score', label: '累計スコア' },
        { key: 'rank', label: '平均順位' },
        { key: 'games', label: '対戦数' },
    ];
    const sortLabel = (SORTS.find(s => s.key === leaderboardSort) || SORTS[0]).label;

    const self = rows.find(r => r.isSelf);
    const others = rows.filter(r => !r.isSelf);

    // ---- 自分専用ヒーローカード（最上部・大きく表示）----
    let heroHtml = '';
    if (self) {
        const sc = self.totalScore;
        const scoreColor = sc > 0 ? '#4ade80' : (sc < 0 ? '#f87171' : '#94a3b8');
        const scoreSign = sc > 0 ? '+' : '';
        const avgStr = self.avgRank !== null ? self.avgRank.toFixed(2) : '-';
        const placeMedal = self.place === 1 ? '🥇' : self.place === 2 ? '🥈' : self.place === 3 ? '🥉' : `${self.place}位`;
        const rankCls = self.place <= 3 ? `lb-rank--${self.place}` : '';
        const heroIcons = self.titleIcons ? `<span class="lb-sub__icons">${self.titleIcons}</span>` : '';

        // プロフィール画像（設定済みならアイコンの代わりに表示）
        let selfAvatar = null;
        try { selfAvatar = await window.AppStorage.getUserAvatar(self.name); } catch (_) { selfAvatar = null; }
        const headIcon = selfAvatar
            ? `<div class="lb-self-hero__ava"><img src="${selfAvatar}" alt="${self.name}"></div>`
            : `<div class="lb-self-hero__rank ${rankCls}">${placeMedal}</div>`;

        // 自分の着順内訳からトップ率・連対率を算出
        const rc = [0, 0, 0, 0];
        let tg = 0;
        sessions.forEach(s => {
            (s.games || []).forEach(g => {
                const p = g.players ? g.players.find(x => x.name === self.name) : null;
                if (!p) return;
                if (p.rank >= 1 && p.rank <= 4) { rc[p.rank - 1]++; tg++; }
            });
        });
        const topRate = tg > 0 ? ((rc[0] / tg) * 100).toFixed(1) + '%' : '-';
        const rentaiRate = tg > 0 ? (((rc[0] + rc[1]) / tg) * 100).toFixed(1) + '%' : '-';

        heroHtml = `
            <div class="lb-self-hero" data-user="${self.name}">
                <div class="lb-self-hero__head">
                    ${headIcon}
                    <div style="flex:1; min-width:0;">
                        <div class="lb-self-hero__name">
                            <span>${self.name}</span>
                            <span class="lb-self-hero__you">YOU</span>
                        </div>
                        <div class="lb-self-hero__rankline">${sortLabel} ${self.place}位 / ${rows.length}人${heroIcons}</div>
                    </div>
                </div>
                <div class="lb-self-hero__body">
                    <div>
                        <div class="lb-self-hero__score" style="color:${scoreColor};">${scoreSign}${sc}</div>
                        <div class="lb-self-hero__scorelabel">累計スコア</div>
                    </div>
                    <div class="lb-self-hero__spark">${bigSparklineSVG(self.spark, 140, 56)}</div>
                </div>
                <div class="lb-self-hero__stats">
                    <div><span>平均順位</span><b>${avgStr}</b></div>
                    <div><span>トップ率</span><b>${topRate}</b></div>
                    <div><span>連対率</span><b>${rentaiRate}</b></div>
                    <div><span>対戦数</span><b>${self.gameCount}</b></div>
                </div>
            </div>
        `;
    }

    let html = heroHtml + `
        <div class="lb-toolbar">
            <span class="lb-toolbar__label">ランキング</span>
            ${SORTS.map(s => `<button class="lb-sort-btn ${s.key === leaderboardSort ? 'active' : ''}" data-sort="${s.key}">${s.label}</button>`).join('')}
        </div>
    `;

    rows.forEach((r) => {
        const place = r.place;
        const rankClass = place <= 3 ? `lb-rank--${place}` : '';
        const medal = place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : place;
        const scoreColor = r.totalScore > 0 ? '#4ade80' : (r.totalScore < 0 ? '#f87171' : '#94a3b8');
        const scoreSign = r.totalScore > 0 ? '+' : '';
        const avgStr = r.avgRank !== null ? r.avgRank.toFixed(2) : '-';

        // 主要メトリクス（並び替え対象を右側に強調表示）
        const primary = {
            score: { value: `${scoreSign}${r.totalScore}`, unit: '累計スコア', color: scoreColor },
            rank: { value: avgStr, unit: '平均順位', color: '#e2e8f0' },
            games: { value: r.gameCount, unit: '対戦数', color: '#e2e8f0' },
        }[leaderboardSort];

        // サブ行（主要メトリクス以外の2項目）
        const subMap = {
            score: `累計 <b style="color:${scoreColor};">${scoreSign}${r.totalScore}</b>`,
            rank: `平均 <b style="color:#e2e8f0;">${avgStr}</b>`,
            games: `<b style="color:#e2e8f0;">${r.gameCount}</b>戦`,
        };
        const subHtml = ['score', 'rank', 'games']
            .filter(k => k !== leaderboardSort)
            .map(k => subMap[k]).join(' ・ ');

        const iconsHtml = r.titleIcons ? `<span class="lb-sub__icons">${r.titleIcons}</span>` : '';
        const youBadge = r.isSelf
            ? '<span style="font-size:0.6rem; background:var(--primary-color,#bb86fc); color:#000; padding:1px 6px; border-radius:999px; font-weight:bold;">YOU</span>'
            : '';

        html += `
            <div class="lb-row ${r.isSelf ? 'is-self' : ''}">
                <div class="lb-rank ${rankClass}">${medal}</div>
                <div class="lb-main" data-user="${r.name}">
                    <div class="lb-name">
                        <span>${r.name}</span>
                        ${youBadge}
                    </div>
                    <div class="lb-sub">${subHtml}${iconsHtml}</div>
                </div>
                <div class="lb-spark">${miniSparklineSVG(r.spark)}</div>
                <div class="lb-metric">
                    <div class="lb-metric__value" style="color:${primary.color};">${primary.value}</div>
                    <div class="lb-metric__unit">${primary.unit}</div>
                </div>
            </div>
        `;
    });

    if (others.length === 0) {
        html += `<div style="text-align:center; color:#94a3b8; padding:16px 0 4px; font-size:0.85rem;">マイメンバーを追加すると比較できます。</div>`;
    }

    board.innerHTML = html;

    // 並び替えボタン
    board.querySelectorAll('.lb-sort-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            leaderboardSort = btn.dataset.sort;
            renderUserList();
        });
    });

    // 自分のヒーローカードクリックで詳細 / 称号アイコンでツールチップ
    const heroEl = board.querySelector('.lb-self-hero');
    if (heroEl) {
        heroEl.addEventListener('click', (e) => {
            const icon = e.target.closest('.title-icon');
            if (icon) {
                e.stopPropagation();
                showToast(`【${icon.dataset.name}】\n${icon.dataset.desc}`);
                return;
            }
            openUserDetail(heroEl.dataset.user);
        });
    }

    // 行クリックで詳細 / 称号アイコンでツールチップ（委譲）
    board.querySelectorAll('.lb-row').forEach(row => {
        row.addEventListener('click', (e) => {
            const icon = e.target.closest('.title-icon');
            if (icon) {
                e.stopPropagation();
                showToast(`【${icon.dataset.name}】\n${icon.dataset.desc}`);
                return;
            }
            const main = row.querySelector('.lb-main');
            if (main && main.dataset.user) openUserDetail(main.dataset.user);
        });
        row.style.cursor = 'pointer';
    });

    // ユーザー一覧描画後にマイメンバー管理UIを描画
    await renderMyMemberSection(deviceUser, allUsers);
}

// --- User Detail ---
const userDetailName = document.getElementById('user-detail-name');
const backToUsersBtn = document.getElementById('back-to-users');

if (backToUsersBtn) {
    backToUsersBtn.addEventListener('click', () => {
        navigateTo('users');
    });
}

// function to open user detail
async function openUserDetail(userName) {
    userDetailName.textContent = userName;

    // -----------------------------------------------------------------------
    // 期間フィルターUI を生成
    // -----------------------------------------------------------------------
    const filterContainer = document.getElementById('user-detail-period-filter');
    if (filterContainer) {
        // 期間スクラバーのスナップ定義（左=広い→右=狭い）
        const TIME_SNAPS = [
            { key: 'all', label: '全期間' },
            { key: '1y', label: '1年' },
            { key: '6m', label: '半年' },
            { key: '3m', label: '3ヶ月' },
            { key: '1m', label: '1ヶ月' },
        ];
        const COUNT_SNAPS = [
            { key: 'all', label: '全部' },
            { key: 'last100', label: '直近100' },
            { key: 'last50', label: '直近50' },
            { key: 'last25', label: '直近25' },
            { key: 'last10', label: '直近10' },
        ];
        const LABEL_MAP = {
            all: '全期間', '1y': '直近1年', '6m': '直近半年', '3m': '直近3ヶ月', '1m': '直近1ヶ月',
            last100: '直近100半荘', last50: '直近50半荘', last25: '直近25半荘', last10: '直近10半荘', custom: 'カスタム期間'
        };

        let mode = 'time';       // 'time' | 'count'
        let customFrom = '', customTo = '';

        // ユーザーが参加した全セッション
        const allSess = await window.AppStorage.getSessions();
        const allUserSess = allSess.filter(s =>
            (s.players && s.players.includes(userName)) ||
            (s.games && s.games.some(g => g.players.some(p => p.name === userName)))
        );

        // 月別アクティビティ（対局数）を算出（直近14ヶ月まで）
        function buildMonthlyActivity(sessions, maxMonths = 14) {
            const counts = {};
            let minYm = null;
            sessions.forEach(s => {
                const d = new Date(s.date);
                if (isNaN(d)) return;
                const ym = d.getFullYear() * 12 + d.getMonth();
                counts[ym] = (counts[ym] || 0) + ((s.games && s.games.length) || 0);
                if (minYm === null || ym < minYm) minYm = ym;
            });
            const now = new Date();
            const nowYm = now.getFullYear() * 12 + now.getMonth();
            if (minYm === null) return [];
            const startYm = Math.max(minYm, nowYm - (maxMonths - 1));
            const months = [];
            for (let ym = startYm; ym <= nowYm; ym++) {
                months.push({ ym, y: Math.floor(ym / 12), m: ym % 12, games: counts[ym] || 0 });
            }
            return months;
        }
        const monthly = buildMonthlyActivity(allUserSess);
        const totalGames = allUserSess.reduce((a, s) => a + ((s.games && s.games.length) || 0), 0);

        function cutoffForKey(key) {
            const now = new Date();
            const d = new Date(now);
            if (key === '1m') { d.setMonth(d.getMonth() - 1); return d; }
            if (key === '3m') { d.setMonth(d.getMonth() - 3); return d; }
            if (key === '6m') { d.setMonth(d.getMonth() - 6); return d; }
            if (key === '1y') { d.setFullYear(d.getFullYear() - 1); return d; }
            return null;
        }

        const snaps = () => (mode === 'time' ? TIME_SNAPS : COUNT_SNAPS);

        // 静的DOM
        filterContainer.innerHTML = `
            <div class="pf">
                <div class="pf__head">
                    <div class="pf__modes">
                        <button class="pf__mode is-active" data-mode="time">📅 期間</button>
                        <button class="pf__mode" data-mode="count">🀄 半荘数</button>
                    </div>
                    <button class="pf__custom-toggle" id="pf-custom-toggle">カスタム</button>
                </div>
                <div class="pf__viz" id="pf-viz"></div>
                <div class="pf__presets" id="pf-presets"></div>
                <div class="pf__label" id="pf-label">—</div>
                <div class="pf__custom" id="pf-custom" style="display:none;">
                    <input type="date" id="period-from">
                    <span>〜</span>
                    <input type="date" id="period-to">
                    <button id="period-custom-apply">適用</button>
                </div>
            </div>
        `;

        const vizEl = filterContainer.querySelector('#pf-viz');
        const presetsEl = filterContainer.querySelector('#pf-presets');
        const labelEl = filterContainer.querySelector('#pf-label');
        const customEl = filterContainer.querySelector('#pf-custom');

        // 文脈ビジュアル（時間=月別ヒストグラム / 半荘数=比率バー）。読むだけ・操作はボタン。
        function renderViz(activeKey) {
            if (mode === 'time') {
                if (!monthly.length) { vizEl.innerHTML = '<div class="pf__noviz">対局データがありません</div>'; return; }
                const cutoff = cutoffForKey(activeKey);
                const maxG = Math.max(1, ...monthly.map(m => m.games));
                const bars = monthly.map(m => {
                    const h = Math.max(6, Math.round((m.games / maxG) * 100));
                    const monthEnd = new Date(m.y, m.m + 1, 0);
                    const on = !cutoff || monthEnd >= cutoff;
                    return `<div class="pf__bar ${on ? 'is-on' : ''}" title="${m.y}/${m.m + 1} ・ ${m.games}局"><div class="pf__bar-fill" style="height:${h}%"></div></div>`;
                }).join('');
                const first = monthly[0];
                vizEl.innerHTML = `<div class="pf__viz-cap">月別の対局数（色付き＝選択中の期間）</div>
                    <div class="pf__bars">${bars}</div>
                    <div class="pf__axis"><span>${first.y % 100}/${first.m + 1}</span><span>今月</span></div>`;
            } else {
                const n = { all: totalGames, last100: 100, last50: 50, last25: 25, last10: 10 }[activeKey] ?? totalGames;
                const shown = Math.min(n, totalGames);
                const pct = totalGames ? Math.round((shown / totalGames) * 100) : 0;
                vizEl.innerHTML = `<div class="pf__viz-cap">全${totalGames}半荘のうち、色付き＝選択中</div>
                    <div class="pf__prop"><div class="pf__prop-fill" style="width:${pct}%"></div></div>
                    <div class="pf__axis"><span>古い</span><span>最近</span></div>`;
            }
        }

        // 操作の主役：ラベル付きプリセットボタン
        function renderPresets(activeKey) {
            presetsEl.innerHTML = snaps().map(s =>
                `<button class="pf__preset ${s.key === activeKey ? 'is-active' : ''}" data-key="${s.key}">${s.label}</button>`
            ).join('');
        }

        // 1回分の重い再描画（renderUserDetail + ラベル/ビジュアル更新）
        async function runRender(key) {
            const filtered = filterSessionsByPeriod(allUserSess, key, { from: customFrom, to: customTo });
            await renderUserDetail(userName, filtered, key);

            // ライブ・カバレッジ・ラベル
            const setCount = filtered.length;
            const gameCount = filtered.reduce((a, s) => a + ((s.games && s.games.length) || 0), 0);
            const icon = (key === 'all') ? '📊' : (key.startsWith('last') ? '🀄' : '🗓');
            labelEl.innerHTML = `${icon} <b>${LABEL_MAP[key] || '期間'}</b> <span class="pf__cov">${setCount}セット / ${gameCount}戦</span>`;

            if (key !== 'custom') renderViz(key);
        }

        // 再入ガード：レンダリング中の連打は「最新の選択」だけを予約し、直列に処理する。
        // （await されない多重呼び出しによる Chart.js のキャンバス競合・ハングを防ぐ）
        let rendering = false;
        let pendingKey = null;
        async function applyFilter(key, fromVal, toVal) {
            if (fromVal !== undefined) customFrom = fromVal;
            if (toVal !== undefined) customTo = toVal;

            // 押した瞬間のボタン選択フィードバックは軽量なので即時反映
            renderPresets(key);

            // すでに描画中なら、最新キーだけ予約して戻る（多重描画を防ぐ）
            if (rendering) { pendingKey = key; return; }

            rendering = true;
            try {
                let cur = key;
                while (cur !== null) {
                    pendingKey = null;
                    await runRender(cur);
                    cur = pendingKey;           // 描画中に押された最後のキー
                    if (cur !== null) renderPresets(cur);
                }
            } finally {
                rendering = false;
            }
        }

        // プリセットボタン（委譲）
        presetsEl.addEventListener('click', (e) => {
            const btn = e.target.closest('.pf__preset');
            if (!btn) return;
            customEl.style.display = 'none';
            applyFilter(btn.dataset.key);
        });

        // モード切替
        filterContainer.querySelectorAll('.pf__mode').forEach(btn => {
            btn.addEventListener('click', () => {
                if (mode === btn.dataset.mode) return;
                mode = btn.dataset.mode;
                filterContainer.querySelectorAll('.pf__mode').forEach(b => b.classList.toggle('is-active', b === btn));
                customEl.style.display = 'none';
                applyFilter(snaps()[0].key);
            });
        });

        // カスタム
        filterContainer.querySelector('#pf-custom-toggle').addEventListener('click', () => {
            customEl.style.display = (customEl.style.display === 'none') ? 'flex' : 'none';
        });
        customEl.querySelector('#period-custom-apply').addEventListener('click', () => {
            const f = document.getElementById('period-from').value;
            const t = document.getElementById('period-to').value;
            if (!f && !t) { showToast('期間を指定してください'); return; }
            applyFilter('custom', f, t);
        });

        // 初期化（全期間）
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

    const sorted = [...allUserSessions].sort(bySessionAsc);

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
    if (filterKey === 'last25') return lastNGames(25);
    if (filterKey === 'last50') return lastNGames(50);
    if (filterKey === 'last100') return lastNGames(100);

    const now = new Date();
    let cutoff;
    if (filterKey === '1m') { cutoff = new Date(now); cutoff.setMonth(cutoff.getMonth() - 1); }
    if (filterKey === '3m') { cutoff = new Date(now); cutoff.setMonth(cutoff.getMonth() - 3); }
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

// 累計スコア推移の中型スパークライン（KPIヒーロー用）
function bigSparklineSVG(points, w = 280, h = 70) {
    if (!points || points.length < 2) return '';
    const padX = 22, padTop = 16, padBot = 8;
    const chartH = h - padTop - padBot;
    const min = Math.min(0, ...points);
    const max = Math.max(0, ...points);
    const range = (max - min) || 1;
    const toX = i => padX + (i / (points.length - 1)) * (w - padX * 2);
    const toY = v => padTop + chartH - ((v - min) / range) * chartH;
    const zeroY = toY(0).toFixed(1);
    const line = points.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
    const firstX = toX(0).toFixed(1), lastX = toX(points.length - 1).toFixed(1);
    const last = points[points.length - 1];
    const stroke = last >= 0 ? 'rgba(74,222,128,0.95)' : 'rgba(248,113,113,0.95)';
    const fill = last >= 0 ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)';
    const lx = toX(points.length - 1).toFixed(1), ly = toY(last).toFixed(1);
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="max-width:100%;">
        <line x1="${padX}" y1="${zeroY}" x2="${w - padX}" y2="${zeroY}" stroke="rgba(148,163,184,0.3)" stroke-width="1" stroke-dasharray="4,3"/>
        <path d="M${firstX},${zeroY} ${points.map((v, i) => `L${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ')} L${lastX},${zeroY} Z" fill="${fill}"/>
        <polyline points="${line}" fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
        <circle cx="${lx}" cy="${ly}" r="3.5" fill="${stroke}"/>
    </svg>`;
}

// 個人詳細ヒーロー用：意味が伝わる「累計スコアの推移」グラフ（見出し・0基準線・最高/現在ラベル・時間軸つき）
function heroTrendChart(points, sessionCount) {
    if (!points || points.length < 2) return '';
    const w = 280, H = 96, padX = 30, padTop = 20, padBot = 18;
    const chartH = H - padTop - padBot;
    const min = Math.min(0, ...points);
    const max = Math.max(0, ...points);
    const range = (max - min) || 1;
    const toX = i => padX + (i / (points.length - 1)) * (w - padX * 2);
    const toY = v => padTop + chartH - ((v - min) / range) * chartH;
    const zeroY = toY(0);
    const last = points[points.length - 1];
    const lastIdx = points.length - 1;
    const peak = Math.max(...points);
    const peakIdx = points.indexOf(peak);
    const stroke = last >= 0 ? 'rgba(74,222,128,0.95)' : 'rgba(248,113,113,0.95)';
    const fill = last >= 0 ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)';
    const fmt = v => (v > 0 ? '+' : '') + (Math.round(v * 10) / 10);
    const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
    const linePts = points.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
    const areaPath = `M${toX(0).toFixed(1)},${zeroY.toFixed(1)} ${points.map((v, i) => `L${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ')} L${toX(lastIdx).toFixed(1)},${zeroY.toFixed(1)} Z`;

    let marks = '';
    // 0 基準線のラベル
    marks += `<text x="${padX - 6}" y="${(zeroY + 3).toFixed(1)}" text-anchor="end" font-size="8" fill="rgba(148,163,184,0.85)">0</text>`;

    // 最高点（プラスのときのみ）
    if (peak > 0) {
        const px = toX(peakIdx), py = toY(peak);
        marks += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3" fill="${stroke}"/>`;
        const lx = clamp(px, padX + 18, w - padX - 18);
        const labelTxt = (peakIdx === lastIdx) ? `現在 ${fmt(peak)}` : `最高 ${fmt(peak)}`;
        marks += `<text x="${lx.toFixed(1)}" y="${(py - 6).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="bold" fill="rgba(255,255,255,0.95)">${labelTxt}</text>`;
    }

    // 現在地（最高点と別の位置のときだけラベル）
    const cx = toX(lastIdx), cy = toY(last);
    marks += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4" fill="${stroke}" stroke="#fff" stroke-width="1"/>`;
    if (peakIdx !== lastIdx) {
        const ly = (cy + 14 < H - padBot + 12) ? cy + 14 : cy - 7;
        const lx = clamp(cx, padX + 16, w - padX - 10);
        marks += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" font-size="9" font-weight="bold" fill="${stroke}">現在 ${fmt(last)}</text>`;
    }

    return `
        <div style="margin-top:14px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.12);">
            <div style="font-size:0.72rem; color:rgba(255,255,255,0.55); margin-bottom:6px; letter-spacing:0.5px;">累計スコアの推移 · ${sessionCount}セット</div>
            <svg width="${w}" height="${H}" viewBox="0 0 ${w} ${H}" style="max-width:100%; overflow:visible;">
                <line x1="${padX}" y1="${zeroY.toFixed(1)}" x2="${w - padX}" y2="${zeroY.toFixed(1)}" stroke="rgba(148,163,184,0.3)" stroke-width="1" stroke-dasharray="4,3"/>
                <path d="${areaPath}" fill="${fill}"/>
                <polyline points="${linePts}" fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
                ${marks}
                <text x="${padX}" y="${H - 4}" text-anchor="start" font-size="8" fill="rgba(148,163,184,0.7)">古い</text>
                <text x="${w - padX}" y="${H - 4}" text-anchor="end" font-size="8" fill="rgba(148,163,184,0.7)">最近</text>
            </svg>
        </div>`;
}

// 称号コレクションのHTMLを生成（未獲得には進捗バー付き）
// 戻り値: { html, unlocked, total }
function buildTitleCollectionHtml(userName, stats, pinnedIds = null, editable = false) {
    const pinnedSet = new Set(Array.isArray(pinnedIds) ? pinnedIds : []);
    const typeMap = stats ? {
        streak_top: stats.maxConsecutiveTop || stats.maxTop || 0,
        streak_rentai: stats.maxConsecutiveRentai || stats.maxRen || 0,
        streak_avoid: stats.maxConsecutiveAvoidLast || stats.maxAvoid || 0,
        high_score: stats.maxHighScore || stats.highScore || 0,
        game_count: stats.maxGameCount || stats.gameCount || 0,
        total_score: stats.maxCumulativeScore || stats.totalScore || 0,
        streak_last: stats.maxConsecutiveLast || stats.maxLast || 0,
        streak_inverse: stats.maxConsecutiveInverse || stats.maxInverse || 0,
    } : {};
    const catOrder = ['special', 'yakuman', 'game_count', 'total_score', 'streak_top', 'streak_rentai', 'streak_avoid', 'high_score', 'avg_rank', 'streak_last', 'streak_inverse', 'minus_score'];
    const rankOrder = ['bronze', 'silver', 'gold', 'special', 'shame'];
    const sorted = [...TITLES].sort((a, b) => {
        const d = catOrder.indexOf(a.category) - catOrder.indexOf(b.category);
        return d !== 0 ? d : rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank);
    });

    let unlocked = 0, total = 0, pinnedCount = 0, html = '';
    sorted.forEach(title => {
        if (title.id === 'founder' && userName !== 'ヒロム') return;
        total++;

        let isUnlocked = false, progress = null, hint = '';
        if (title.check) {
            isUnlocked = !!(stats && title.check(stats));
        } else if (title.threshold !== undefined) {
            if (title.category === 'minus_score') {
                const worst = stats ? (stats.worstCumulativeScore ?? stats.minCumulativeScore ?? stats.totalScore ?? 0) : 0;
                isUnlocked = worst <= title.threshold;
            } else {
                const cur = typeMap[title.category] ?? 0;
                isUnlocked = cur >= title.threshold;
                if (!isUnlocked && title.rank !== 'shame' && title.threshold > 0) {
                    progress = Math.max(0, Math.min(1, cur / title.threshold));
                    hint = `あと ${Math.max(0, Math.ceil(title.threshold - cur))} で獲得（${cur} / ${title.threshold}）`;
                }
            }
        }
        if (isUnlocked) unlocked++;

        const isPinned = isUnlocked && pinnedSet.has(title.id);
        if (isPinned) pinnedCount++;

        const rankClass = isUnlocked ? `title-card--${title.rank}` : '';
        const lockedClass = isUnlocked ? '' : 'is-locked';
        const pinnedClass = isPinned ? 'is-pinned' : '';
        const selectableClass = (editable && isUnlocked) ? 'is-selectable' : '';
        const icon = isUnlocked ? title.icon : '❓';
        const name = isUnlocked ? title.name : '???';
        const progHtml = (progress !== null)
            ? `<div class="title-prog"><div class="title-prog__bar" style="width:${(progress * 100).toFixed(0)}%;"></div></div><div class="title-prog__text">${Math.round(progress * 100)}%</div>`
            : '';
        const pinBadge = isPinned ? '<span class="title-card__pin" aria-hidden="true">⭐</span>' : '';

        html += `<div class="title-card ${rankClass} ${lockedClass} ${pinnedClass} ${selectableClass}"
            data-id="${title.id}"
            data-unlocked="${isUnlocked ? '1' : '0'}"
            data-name="${title.name}" data-desc="${title.description}"
            data-rank="${(title.rank || '').toUpperCase()}" data-hint="${hint}">
            ${pinBadge}
            <div class="title-card__icon"${isUnlocked ? '' : ' style="filter:grayscale(100%);"'}>${icon}</div>
            <div class="title-card__name">${name}</div>
            ${progHtml}
        </div>`;
    });
    return { html, unlocked, total, pinnedCount };
}

async function renderUserDetail(userName, filteredSessions = null, filterKey = 'all') {
    const sessions = await window.AppStorage.getSessions();
    const allUserSessions = sessions.filter(s =>
        (s.players && s.players.includes(userName)) ||
        (s.games && s.games.some(g => g.players.some(p => p.name === userName)))
    );
    const userSessions = filteredSessions !== null ? filteredSessions : allUserSessions;

    // 時系列（古い→新しい）と表示用（新しい→古い）
    const chronological = [...userSessions].sort(bySessionAsc);
    const newestFirst = [...userSessions].sort(bySessionDesc);

    // セッションごとのスコア・累計・収支
    let totalScore = 0;
    let totalAmount = 0;
    let hasRate = false;
    const sessionScores = new Map();
    const cumulativePoints = [];
    chronological.forEach(session => {
        let sessionScore = 0;
        session.games.forEach(game => {
            const p = game.players.find(x => x.name === userName);
            if (p) sessionScore += (p.finalScore || 0);
        });
        totalScore += sessionScore;
        sessionScores.set(session.id, sessionScore);
        cumulativePoints.push(parseFloat(totalScore.toFixed(1)));
        const rate = session.rate || 0;
        if (rate > 0) { hasRate = true; totalAmount += Math.round(sessionScore * rate * 10); }
    });

    // 着順集計・起家別・着順シーケンス
    const rankCounts = [0, 0, 0, 0];
    let totalGames = 0;
    const windStats = { '東': 0, '南': 0, '西': 0, '北': 0 };
    const rankSequence = [];
    chronological.forEach(session => {
        session.games.forEach(game => {
            const p = game.players.find(x => x.name === userName);
            if (!p) return;
            if (p.rank >= 1 && p.rank <= 4) {
                rankCounts[p.rank - 1]++;
                totalGames++;
                rankSequence.push(p.rank);
            }
            if (p.wind && windStats[p.wind] !== undefined) windStats[p.wind] += (p.finalScore || 0);
        });
    });

    let avgRank = null, topRate = null, rentaiRate = null, avoidLastRate = null;
    if (totalGames > 0) {
        const sumRanks = rankCounts[0] + rankCounts[1] * 2 + rankCounts[2] * 3 + rankCounts[3] * 4;
        avgRank = sumRanks / totalGames;
        topRate = (rankCounts[0] / totalGames) * 100;
        rentaiRate = ((rankCounts[0] + rankCounts[1]) / totalGames) * 100;
        avoidLastRate = ((totalGames - rankCounts[3]) / totalGames) * 100;
    }

    // 全期間スタッツ（ハイライト・称号用）
    const allTimeStats = await getUserStats(userName, sessions);

    // ====== ラベル・色 ======
    const PERIOD_LABELS = {
        all: '累計', last10: '直近10半荘', last25: '直近25半荘', last50: '直近50半荘', last100: '直近100半荘',
        '1m': '直近1ヶ月', '3m': '直近3ヶ月', '6m': '直近半年', '1y': '直近1年', custom: '期間'
    };
    const pLabel = PERIOD_LABELS[filterKey] || '期間';
    const dispScore = parseFloat(totalScore.toFixed(1));
    const scoreColor = dispScore > 0 ? '#4ade80' : (dispScore < 0 ? '#f87171' : '#94a3b8');
    const scoreSign = dispScore > 0 ? '+' : '';
    const scoreIcon = dispScore > 100 ? '🔥' : dispScore > 0 ? '📈' : dispScore === 0 ? '⚖️' : dispScore > -100 ? '📉' : '⚠️';
    const avgStr = avgRank !== null ? avgRank.toFixed(2) : '-';
    const topStr = topRate !== null ? topRate.toFixed(1) + '%' : '-';
    const rentaiStr = rentaiRate !== null ? rentaiRate.toFixed(1) + '%' : '-';

    const avgBadge = avgRank === null ? ''
        : avgRank <= 2.4 ? '<span class="stat-kpi__badge stat-kpi__badge--good">好調</span>'
            : avgRank <= 2.6 ? '<span class="stat-kpi__badge">標準</span>'
                : '<span class="stat-kpi__badge stat-kpi__badge--bad">伸びしろ</span>';
    const topBadge = (topRate !== null && topRate >= 28) ? '<span class="stat-kpi__badge stat-kpi__badge--good">高い</span>' : '';

    // ====== KPIサマリー ======
    const kpiEl = document.getElementById('ud-kpi');
    if (kpiEl) {
        const amountStr = hasRate
            ? (totalAmount > 0 ? `+${totalAmount.toLocaleString()}` : totalAmount.toLocaleString())
            : null;
        const amountColor = totalAmount > 0 ? '#4ade80' : (totalAmount < 0 ? '#f87171' : '#94a3b8');
        kpiEl.innerHTML = `
            <div class="stat-kpi stat-kpi--hero">
                <div class="stat-kpi__label">${pLabel}スコア</div>
                <div class="stat-kpi__value" style="color:${scoreColor};">
                    <span class="stat-kpi__icon">${scoreIcon}</span>${scoreSign}${dispScore}
                </div>
                ${amountStr !== null ? `<div style="font-size:0.85rem; color:#cbd5e1; margin-top:4px;">${pLabel}収支 <b style="color:${amountColor};">${amountStr}</b></div>` : ''}
                ${heroTrendChart(cumulativePoints, chronological.length)}
            </div>
            <div class="stat-kpi">
                <div class="stat-kpi__label">平均順位</div>
                <div class="stat-kpi__value">${avgStr}</div>
                ${avgBadge}
            </div>
            <div class="stat-kpi">
                <div class="stat-kpi__label">トップ率</div>
                <div class="stat-kpi__value">${topStr}</div>
                ${topBadge}
            </div>
            <div class="stat-kpi">
                <div class="stat-kpi__label">連対率</div>
                <div class="stat-kpi__value">${rentaiStr}</div>
            </div>
            <div class="stat-kpi">
                <div class="stat-kpi__label">対戦数</div>
                <div class="stat-kpi__value">${totalGames}</div>
            </div>
        `;
    }

    // ====== ハイライトバナー（全期間実績ベース）======
    const highlightEl = document.getElementById('ud-highlight');
    if (highlightEl) {
        let icon = '', text = '';
        const at = allTimeStats;
        if (at) {
            const maxTop = at.maxConsecutiveTop || at.maxTop || 0;
            const cum = at.maxCumulativeScore || 0;
            const gc = at.maxGameCount || at.gameCount || 0;
            const yk = at.recordYakumanCount || at.yakumanCount || 0;
            if (at.recordHasTenhou || at.hasTenhou) { icon = '🀫'; text = '<b>天和</b>を達成した伝説の打ち手！'; }
            else if (yk > 0) { icon = '🌸'; text = `通算 <b>${yk}回</b> の役満を達成！`; }
            else if (maxTop >= 3) { icon = '🔥'; text = `最高 <b>${maxTop}連続トップ</b> の爆発力！`; }
            else if (at.minAverageRank && at.minAverageRank > 0 && at.minAverageRank <= 2.4) { icon = '✨'; text = `安定の平均順位 <b>${at.minAverageRank.toFixed(2)}</b>（30戦以上）`; }
            else if (cum >= 300) { icon = '📈'; text = `自己ベスト累計 <b>+${Math.round(cum)}</b> を記録！`; }
            else if (gc >= 100) { icon = '🀄'; text = `通算 <b>${gc}戦</b> の歴戦の打ち手！`; }
        }
        highlightEl.innerHTML = text
            ? `<div class="stat-highlight"><div class="stat-highlight__icon">${icon}</div><div class="stat-highlight__text">${text}</div></div>`
            : '';
    }

    // ====== セット履歴行（新しい順）======
    let historyRows = '';
    newestFirst.forEach(session => {
        const ss = sessionScores.get(session.id) || 0;
        const sc = parseFloat(ss.toFixed(1));
        const scClass = sc >= 0 ? 'score-positive' : 'score-negative';
        const scStr = sc > 0 ? `+${sc}` : `${sc}`;
        const rate = session.rate || 0;
        let amountHtml;
        if (rate > 0) {
            const amount = Math.round(ss * rate * 10);
            amountHtml = `<td class="${amount >= 0 ? 'score-positive' : 'score-negative'}">${amount > 0 ? '+' + amount : amount}</td>`;
        } else { amountHtml = '<td>-</td>'; }
        const rc = [0, 0, 0, 0];
        session.games.forEach(g => {
            const p = g.players.find(x => x.name === userName);
            if (p && p.rank >= 1 && p.rank <= 4) rc[p.rank - 1]++;
        });
        historyRows += `
            <tr style="cursor:pointer;" onclick="openSession(${session.id})">
                <td>${session.date}</td>
                <td class="${scClass}">${scStr}</td>
                ${amountHtml}
                <td>${rc[0]}</td><td>${rc[1]}</td><td>${rc[2]}</td><td>${rc[3]}</td>
            </tr>`;
    });

    // ====== 称号コレクション ======
    // 自分のページなら表示称号を選択（ピン留め）できる
    const titleEditable = (userName === localStorage.getItem('deviceUser'));
    let pinnedIds = null;
    try { pinnedIds = await window.AppStorage.getPinnedTitles(userName); } catch (_) { pinnedIds = null; }
    const titles = buildTitleCollectionHtml(userName, allTimeStats, pinnedIds, titleEditable);

    // ====== 詳細アコーディオン ======
    // 既存チャートインスタンスを破棄
    ['rank-pie-chart', 'rank-history-canvas-internal'].forEach(id => {
        const c = document.getElementById(id);
        if (c && c.chartInstance) { c.chartInstance.destroy(); c.chartInstance = null; }
    });

    const rankPcts = rankCounts.map(c => totalGames > 0 ? ((c / totalGames) * 100).toFixed(1) + '%' : '0.0%');
    const rankColors = ['#fcd34d', '#94a3b8', '#475569', '#ef4444'];
    const rankCountCells = [1, 2, 3, 4].map((r, i) => `
        <div style="text-align:center;">
            <div style="font-size:0.85rem; margin-bottom:4px; color:#e2e8f0; display:flex; align-items:center; justify-content:center; gap:5px;">
                <span style="width:10px; height:10px; border-radius:50%; background:${rankColors[i]}; display:inline-block;"></span>${r}着
            </div>
            <div style="font-size:1.3rem; font-weight:bold;">${rankCounts[i]} <span style="font-size:0.75rem; color:#94a3b8; font-weight:normal;">(${rankPcts[i]})</span></div>
        </div>`).join('');

    const windCells = ['東', '南', '西', '北'].map(w => {
        const v = Math.round(windStats[w] * 10) / 10;
        const col = v > 0 ? '#4ade80' : (v < 0 ? '#f87171' : '#cbd5e1');
        return `<div style="text-align:center; background:rgba(255,255,255,0.04); padding:10px 8px; border-radius:8px;">
            <div style="font-size:0.8rem; color:#94a3b8; margin-bottom:2px;">${w}</div>
            <div style="font-size:1rem; font-weight:bold; color:${col};">${v > 0 ? '+' : ''}${v}</div>
        </div>`;
    }).join('');

    const detailsEl = document.getElementById('ud-details');
    if (detailsEl) {
        detailsEl.innerHTML = `
            <details class="stat-acc" open>
                <summary><span class="stat-acc__icon">📊</span><span class="stat-acc__title">着順内訳</span><span class="stat-acc__chevron">▾</span></summary>
                <div class="stat-acc__body">
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap;">
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px 24px; flex:1; min-width:180px;">
                            ${rankCountCells}
                        </div>
                        <div style="width:110px; height:110px;"><canvas id="rank-pie-chart"></canvas></div>
                    </div>
                    <div style="display:flex; justify-content:space-around; margin-top:16px; padding-top:14px; border-top:1px solid #334155;">
                        <div style="text-align:center;"><div style="font-size:0.78rem; color:#94a3b8;">トップ率</div><div style="font-size:1.1rem; font-weight:bold;">${topStr}</div></div>
                        <div style="text-align:center;"><div style="font-size:0.78rem; color:#94a3b8;">連対率</div><div style="font-size:1.1rem; font-weight:bold;">${rentaiStr}</div></div>
                        <div style="text-align:center;"><div style="font-size:0.78rem; color:#94a3b8;">ラス回避率</div><div style="font-size:1.1rem; font-weight:bold;">${avoidLastRate !== null ? avoidLastRate.toFixed(1) + '%' : '-'}</div></div>
                    </div>
                </div>
            </details>

            <details class="stat-acc">
                <summary><span class="stat-acc__icon">🪑</span><span class="stat-acc__title">起家別トータルスコア</span><span class="stat-acc__chevron">▾</span></summary>
                <div class="stat-acc__body">
                    <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:8px;">${windCells}</div>
                </div>
            </details>

            <details class="stat-acc">
                <summary><span class="stat-acc__icon">📈</span><span class="stat-acc__title">着順推移</span><span class="stat-acc__hint">${totalGames}戦</span><span class="stat-acc__chevron">▾</span></summary>
                <div class="stat-acc__body">
                    <div style="height:180px; position:relative;"><canvas id="rank-history-canvas-internal"></canvas></div>
                </div>
            </details>

            <details class="stat-acc">
                <summary><span class="stat-acc__icon">🏅</span><span class="stat-acc__title">称号コレクション</span><span class="stat-acc__hint" id="ud-title-hint">${titles.unlocked} / ${titles.total}</span><span class="stat-acc__chevron">▾</span></summary>
                <div class="stat-acc__body">
                    ${titleEditable ? `<div class="title-edit-note" id="ud-title-note">⭐ タップで一覧に表示する称号を選択（最大3つ・現在 ${titles.pinnedCount}/3）</div>` : ''}
                    <div class="title-grid" id="ud-title-grid">${titles.html}</div>
                </div>
            </details>

            <details class="stat-acc">
                <summary><span class="stat-acc__icon">🗓</span><span class="stat-acc__title">セット履歴</span><span class="stat-acc__hint">${newestFirst.length}件</span><span class="stat-acc__chevron">▾</span></summary>
                <div class="stat-acc__body" style="overflow-x:auto;">
                    <table class="history-table" style="width:100%;">
                        <thead><tr><th>日付</th><th>スコア</th><th>収支</th><th style="font-size:0.8em">1着</th><th style="font-size:0.8em">2着</th><th style="font-size:0.8em">3着</th><th style="font-size:0.8em">4着</th></tr></thead>
                        <tbody>${historyRows || '<tr><td colspan="7" style="text-align:center; color:#94a3b8; padding:16px;">記録がありません</td></tr>'}</tbody>
                    </table>
                </div>
            </details>
        `;

        // 称号クリック（委譲）。自分のページでは獲得済みカードのタップで表示称号をトグル。
        // detailsEl は再描画ごとに同一要素が残るため、古いハンドラを外してから付け直す。
        let pinnedLocal = Array.isArray(pinnedIds) ? [...pinnedIds] : [];
        if (detailsEl._titleClickHandler) detailsEl.removeEventListener('click', detailsEl._titleClickHandler);
        detailsEl._titleClickHandler = async (e) => {
            const card = e.target.closest('.title-card');
            if (!card) return;
            const unlocked = card.dataset.unlocked === '1';

            if (titleEditable && unlocked) {
                const id = card.dataset.id;
                const idx = pinnedLocal.indexOf(id);
                if (idx >= 0) {
                    pinnedLocal.splice(idx, 1);
                } else {
                    if (pinnedLocal.length >= 3) { showToast('表示できる称号は最大3つまでです'); return; }
                    pinnedLocal.push(id);
                }
                await window.AppStorage.updatePinnedTitles(userName, pinnedLocal);

                // 称号グリッドだけ再描画（他アコーディオン/チャートは維持）
                const rebuilt = buildTitleCollectionHtml(userName, allTimeStats, pinnedLocal, true);
                const gridEl = document.getElementById('ud-title-grid');
                if (gridEl) gridEl.innerHTML = rebuilt.html;
                const noteEl = document.getElementById('ud-title-note');
                if (noteEl) noteEl.textContent = `⭐ タップで一覧に表示する称号を選択（最大3つ・現在 ${rebuilt.pinnedCount}/3）`;

                // 一覧側の表示も最新化（バックグラウンド）
                renderUserList();
            } else {
                if (unlocked) showToast(`【${card.dataset.name}】\n${card.dataset.desc}\nランク: ${card.dataset.rank}`);
                else showToast(`【未獲得】\n${card.dataset.hint || '条件を満たすと獲得できます'}`);
            }
        };
        detailsEl.addEventListener('click', detailsEl._titleClickHandler);

        // 円グラフ
        if (typeof ChartDataLabels !== 'undefined') Chart.register(ChartDataLabels);
        const pieCanvas = document.getElementById('rank-pie-chart');
        if (pieCanvas && totalGames > 0) {
            // 二重生成（Canvas is already in use）を確実に回避
            if (typeof Chart.getChart === 'function') { const ex = Chart.getChart(pieCanvas); if (ex) ex.destroy(); }
            pieCanvas.chartInstance = new Chart(pieCanvas.getContext('2d'), {
                type: 'doughnut',
                data: { labels: ['1着', '2着', '3着', '4着'], datasets: [{ data: rankCounts, backgroundColor: rankColors, borderWidth: 0 }] },
                options: {
                    responsive: true, maintainAspectRatio: false, cutout: '50%',
                    plugins: {
                        legend: { display: false }, tooltip: { enabled: false },
                        datalabels: {
                            color: '#fff', font: { weight: 'bold', size: 13 },
                            formatter: (v, ctx) => v === 0 ? '' : ctx.chart.data.labels[ctx.dataIndex]
                        }
                    }
                }
            });
        }

        // 着順推移ライン（折りたたみ内は開いた時にresize）
        const lineCanvas = document.getElementById('rank-history-canvas-internal');
        if (lineCanvas && rankSequence.length > 0) {
            if (typeof Chart.getChart === 'function') { const ex = Chart.getChart(lineCanvas); if (ex) ex.destroy(); }
            lineCanvas.chartInstance = new Chart(lineCanvas.getContext('2d'), {
                type: 'line',
                data: {
                    labels: rankSequence.map((_, i) => `${i + 1}`),
                    datasets: [{
                        label: '順位', data: rankSequence, borderColor: '#a78bfa',
                        backgroundColor: 'rgba(167,139,250,0.2)', borderWidth: 2, pointBackgroundColor: '#fff',
                        pointBorderColor: '#8b5cf6', pointRadius: 5, pointHoverRadius: 7, tension: 0.1, fill: false, clip: false
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    layout: { padding: { top: 16, bottom: 12, left: 8, right: 8 } },
                    scales: {
                        y: { min: 1, max: 4, reverse: true, ticks: { stepSize: 1, color: '#e2e8f0', font: { size: 12 } }, grid: { color: 'rgba(255,255,255,0.1)' } },
                        x: { display: false }
                    },
                    plugins: { legend: { display: false }, datalabels: { display: false } }
                }
            });
            const lineDetails = lineCanvas.closest('details');
            if (lineDetails) {
                lineDetails.addEventListener('toggle', () => {
                    if (lineDetails.open && lineCanvas.chartInstance) lineCanvas.chartInstance.resize();
                });
            }
        }
    }
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

        // 次回のためにルールを記憶
        rememberRules(rules);

        // バリデーション通過後にローディング開始
        const submitBtn = document.getElementById('session-setup-submit-btn');
        setButtonLoading(submitBtn, true, 'セット作成中...');

        try {
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
                    // Candidate = active league that contains all 4 players, and (for period
                    // leagues) whose date range includes this session's date.
                    const candidates = leagues.filter(l =>
                        l.status === 'active' &&
                        Array.isArray(l.players) && l.players.length >= 4 &&
                        players.every(p => l.players.includes(p)) &&
                        leagueAcceptsDate(l, getDate)
                    );

                    let target = null;
                    if (candidates.length === 1) {
                        target = candidates[0];
                    } else if (candidates.length > 1) {
                        // Multiple leagues match → let the user pick (or skip).
                        const chosenId = await chooseLeagueDialog(candidates);
                        target = chosenId ? candidates.find(l => l.id === chosenId) : null;
                    }

                    if (target) {
                        await window.AppStorage.updateSession(session.id, { leagueId: target.id });
                        if (typeof showToast === 'function') {
                            showToast(`リーグ「${target.title}」の対局として記録しました。`);
                        }
                    }
                }
            } catch (e) {
                console.error("League link error:", e);
            }

            await openSession(session.id);
        } finally {
            // 画面遷移後もボタン状態をリセット（再度homeに戻ったときのため）
            setButtonLoading(submitBtn, false);
        }
    });
}

// セット一覧の対戦相手フィルタ状態（再描画をまたいで保持）
let sessionListMemberFilter = 'all';

// 指定ユーザーのそのセットでの成績を集計（参加していなければ null）
function getSelfSessionResult(session, selfName) {
    if (!selfName || !Array.isArray(session.players) || !session.players.includes(selfName)) return null;
    let total = 0, rankSum = 0, games = 0, tops = 0;
    (session.games || []).forEach(g => {
        const p = (g.players || []).find(x => x.name === selfName);
        if (p) {
            total += (p.finalScore || 0);
            rankSum += (p.rank || 0);
            games++;
            if (p.rank === 1) tops++;
        }
    });
    return {
        total: parseFloat(total.toFixed(1)),
        avgRank: games > 0 ? rankSum / games : 0,
        games,
        tops
    };
}

// セットの日付表示用の整形（曜日・月キー・相対表記）
function formatSessionDate(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
        return { day: dateStr || '不明', dow: '', monthKey: 'その他', relative: '' };
    }
    const dows = ['日', '月', '火', '水', '木', '金', '土'];
    const day = `${d.getMonth() + 1}/${d.getDate()}`;
    const dow = dows[d.getDay()];
    const monthKey = `${d.getFullYear()}年${d.getMonth() + 1}月`;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(d);
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today - target) / 86400000);
    let relative = '';
    if (diffDays === 0) relative = '今日';
    else if (diffDays === 1) relative = '昨日';
    else if (diffDays > 1 && diffDays < 7) relative = `${diffDays}日前`;

    return { day, dow, monthKey, relative };
}

async function renderSessionList() {
    if (!sessionList) return;
    const sessions = await window.AppStorage.getSessions();
    const deviceUser = localStorage.getItem('deviceUser');
    const isAdmin = deviceUser === 'ヒロム';

    // --- 参加者によるフィルタ（既存仕様を踏襲） ---
    let filteredSessions;
    if (isAdmin) {
        filteredSessions = sessions;
    } else if (deviceUser) {
        filteredSessions = sessions.filter(s => Array.isArray(s.players) && s.players.includes(deviceUser));
    } else {
        filteredSessions = [];
    }

    sessionList.innerHTML = '';

    if (filteredSessions.length === 0) {
        let msg = 'セット履歴がありません。';
        if (!deviceUser) {
            msg = 'セット履歴を表示するには、ユーザー設定が必要です。';
        } else if (!isAdmin) {
            msg = '参加したセット履歴がありません。「＋新規セット」から記録を始めましょう。';
        }
        sessionList.innerHTML = `<div class="session-empty"><p>${msg}</p></div>`;
        return;
    }

    const selfName = deviceUser;

    // --- サマリーヘッダー（対戦相手フィルタに関わらず全体の自分成績） ---
    if (selfName) {
        let totalScore = 0, totalGames = 0, totalTops = 0, setCount = 0;
        filteredSessions.forEach(s => {
            const r = getSelfSessionResult(s, selfName);
            if (r && r.games > 0) {
                totalScore += r.total;
                totalGames += r.games;
                totalTops += r.tops;
                setCount++;
            }
        });
        if (totalGames > 0) {
            totalScore = parseFloat(totalScore.toFixed(1));
            const scoreClass = totalScore >= 0 ? 'score-positive' : 'score-negative';
            const scoreStr = (totalScore > 0 ? '+' : '') + totalScore.toFixed(1);
            const topRate = ((totalTops / totalGames) * 100).toFixed(1);
            const summary = document.createElement('div');
            summary.className = 'session-summary';
            summary.innerHTML = `
                <div class="session-summary__item">
                    <span class="session-summary__label">通算収支</span>
                    <span class="session-summary__value ${scoreClass}">${scoreStr}</span>
                </div>
                <div class="session-summary__item">
                    <span class="session-summary__label">セット</span>
                    <span class="session-summary__value">${setCount}</span>
                </div>
                <div class="session-summary__item">
                    <span class="session-summary__label">対局</span>
                    <span class="session-summary__value">${totalGames}</span>
                </div>
                <div class="session-summary__item">
                    <span class="session-summary__label">トップ率</span>
                    <span class="session-summary__value">${topRate}%</span>
                </div>
            `;
            sessionList.appendChild(summary);
        }
    }

    // --- 対戦相手フィルタの選択肢を構築 ---
    const coMembers = new Set();
    filteredSessions.forEach(s => (s.players || []).forEach(p => {
        if (p !== selfName) coMembers.add(p);
    }));
    if (sessionListMemberFilter !== 'all' && !coMembers.has(sessionListMemberFilter)) {
        sessionListMemberFilter = 'all';
    }

    if (coMembers.size > 0) {
        const memberOptions = ['all', ...Array.from(coMembers).sort((a, b) => a.localeCompare(b, 'ja'))];
        const filterBar = document.createElement('div');
        filterBar.className = 'session-filter';
        const opts = memberOptions.map(m =>
            `<option value="${m}"${m === sessionListMemberFilter ? ' selected' : ''}>${m === 'all' ? '全メンバー' : m}</option>`
        ).join('');
        filterBar.innerHTML = `
            <label class="session-filter__label" for="session-member-filter">対戦相手</label>
            <select class="session-filter__select" id="session-member-filter">${opts}</select>
        `;
        sessionList.appendChild(filterBar);
        filterBar.querySelector('#session-member-filter').addEventListener('change', (e) => {
            sessionListMemberFilter = e.target.value;
            renderSessionList();
        });
    }

    // --- 対戦相手フィルタを適用 ---
    let viewSessions = filteredSessions;
    if (sessionListMemberFilter !== 'all') {
        viewSessions = filteredSessions.filter(s => (s.players || []).includes(sessionListMemberFilter));
    }

    if (viewSessions.length === 0) {
        const none = document.createElement('div');
        none.className = 'session-empty';
        none.innerHTML = `<p>「${sessionListMemberFilter}」さんとのセットはありません。</p>`;
        sessionList.appendChild(none);
        return;
    }

    // --- 開催中（記録中＝未ロック）と過去（ロック済み）に分割 ---
    const ongoingSessions = viewSessions.filter(s => s.locked !== true);
    const pastSessions = viewSessions.filter(s => s.locked === true);

    // セッションカードを生成（live=記録中表示）
    function makeSessionCard(session, live) {
        const dateInfo = formatSessionDate(session.date);
        const div = document.createElement('div');
        div.className = 'session-card' + (live ? ' session-card--live' : '');

        const isLocked = session.locked === true;
        const isParticipant = Array.isArray(session.players) && session.players.includes(deviceUser);
        const showDelete = (isAdmin || isParticipant) && !isLocked;

        // 自分のこのセットでの成績
        const self = getSelfSessionResult(session, selfName);
        let resultHtml;
        if (self && self.games > 0) {
            const scoreClass = self.total >= 0 ? 'score-positive' : 'score-negative';
            const scoreStr = (self.total > 0 ? '+' : '') + self.total.toFixed(1);
            const medal = self.tops > 0 ? ` 🥇${self.tops > 1 ? '×' + self.tops : ''}` : '';
            resultHtml = `
                <div class="session-card__result">
                    <span class="session-card__score ${scoreClass}">${scoreStr}</span>
                    <span class="session-card__sub">平均${self.avgRank.toFixed(2)}着${medal}</span>
                </div>`;
        } else if (isParticipant) {
            // 参加者だがまだ対局記録なし
            resultHtml = `<div class="session-card__result"><span class="session-card__sub" style="color:var(--text-secondary);">${live ? '記録中' : '記録なし'}</span></div>`;
        } else {
            resultHtml = `<div class="session-card__result"><span class="session-card__sub">観戦</span></div>`;
        }

        const liveBadge = live ? `<span class="session-card__live"><span class="live-dot" aria-hidden="true"></span>記録中</span>` : '';

        div.innerHTML = `
            <div class="session-card__left">
                <div class="session-card__date">
                    <span class="session-card__day">${dateInfo.day}<span class="session-card__dow">(${dateInfo.dow})</span></span>
                    ${dateInfo.relative ? `<span class="session-card__relative">${dateInfo.relative}</span>` : ''}
                </div>
                <div class="session-card__info">
                    <span class="session-card__games">${(session.games || []).length}対局${liveBadge}</span>
                    <span class="session-card__players">${(session.players || []).map(n => `<span class="player-chip${n === selfName ? ' is-self' : ''}">${n}</span>`).join('')}</span>
                </div>
            </div>
            ${resultHtml}
            <div class="session-card__actions">
                ${showDelete ? `<button class="session-icon-btn session-delete-btn" data-id="${session.id}" title="削除">🗑</button>` : ''}
            </div>
        `;

        div.addEventListener('click', (e) => {
            if (!e.target.closest('.session-delete-btn')) {
                openSession(session.id);
            }
        });

        const deleteSessionBtn = div.querySelector('.session-delete-btn');
        if (deleteSessionBtn) {
            deleteSessionBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
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

        return div;
    }

    // --- 開催中のセット（最上部・強調表示）---
    if (ongoingSessions.length > 0) {
        const liveHeader = document.createElement('div');
        liveHeader.className = 'session-group-header session-group-header--live';
        liveHeader.innerHTML = `<span class="live-dot" aria-hidden="true"></span>開催中のセット<span class="session-group-header__count">${ongoingSessions.length}</span>`;
        sessionList.appendChild(liveHeader);
        ongoingSessions.forEach(session => sessionList.appendChild(makeSessionCard(session, true)));
    }

    // --- 過去のセット（月別グルーピング）---
    if (pastSessions.length > 0) {
        // 開催中セットがあるときは「過去のセット」見出しで区切る
        if (ongoingSessions.length > 0) {
            const pastHeader = document.createElement('div');
            pastHeader.className = 'session-group-header session-group-header--past';
            pastHeader.textContent = '過去のセット';
            sessionList.appendChild(pastHeader);
        }

        let lastMonthKey = null;
        pastSessions.forEach(session => {
            const dateInfo = formatSessionDate(session.date);
            if (dateInfo.monthKey !== lastMonthKey) {
                lastMonthKey = dateInfo.monthKey;
                const groupHeader = document.createElement('div');
                groupHeader.className = 'session-group-header';
                groupHeader.textContent = dateInfo.monthKey;
                sessionList.appendChild(groupHeader);
            }
            sessionList.appendChild(makeSessionCard(session, false));
        });
    }
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
    // 収支（レート）は参加者・管理者のみ閲覧可。非参加者にはレート行ごと非表示。
    const rateRow = document.getElementById('session-rate-row');
    if (rateRow) rateRow.style.display = canEdit ? '' : 'none';

    // Finish/Resume Button（参加者・管理者のみ表示）
    if (canEdit) {
        renderSessionControls(session);
    } else {
        // 閲覧専用：コントロールエリアを非表示
        const controlsDiv = document.getElementById('session-controls-area');
        if (controlsDiv) controlsDiv.innerHTML = '';
    }

    renderSelfBanner(session);
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
            newGameBtn.className = 'btn-locked-notice';
            newGameBtn.innerHTML = '<span class="btn-locked-notice__icon">🔒</span><span class="btn-locked-notice__text">このセットはロックされています<small>「セットを再開」で編集できます</small></span>';
            newGameBtn.style.backgroundColor = "";
            newGameBtn.style.cursor = "";
            newGameBtn.style.opacity = "";
        } else {
            newGameBtn.style.display = '';
            newGameBtn.disabled = false;
            newGameBtn.className = 'btn-primary';
            newGameBtn.innerHTML = "+ 対局を追加";
            newGameBtn.style.backgroundColor = "";
            newGameBtn.style.cursor = "";
            newGameBtn.style.opacity = "";
        }
    }
}

// セット詳細：自分のこの卓での成績バナー
function renderSelfBanner(session) {
    const banner = document.getElementById('session-self-banner');
    if (!banner) return;
    const selfName = localStorage.getItem('deviceUser');
    const r = getSelfSessionResult(session, selfName);
    if (!r || r.games === 0) {
        banner.innerHTML = '';
        banner.style.display = 'none';
        return;
    }
    banner.style.display = '';

    const scoreClass = r.total >= 0 ? 'score-positive' : 'score-negative';
    const scoreStr = (r.total > 0 ? '+' : '') + r.total.toFixed(1);

    // 着順推移（古い順）
    const ranks = [];
    (session.games || []).forEach(g => {
        const p = (g.players || []).find(x => x.name === selfName);
        if (p) ranks.push(p.rank);
    });
    const rankChips = ranks.map(rk => `<span class="rank-dot rank-${rk}">${rk}</span>`).join('');
    const medal = r.tops > 0 ? `🥇×${r.tops}` : '—';

    banner.innerHTML = `
        <div class="self-banner">
            <div class="self-banner__head">
                <span class="self-banner__name">${selfName}</span>
                <span class="self-banner__score ${scoreClass}">${scoreStr}</span>
            </div>
            <div class="self-banner__stats">
                <span><b>平均</b> ${r.avgRank.toFixed(2)}着</span>
                <span><b>トップ</b> ${medal}</span>
                <span class="self-banner__ranks"><b>着順</b> ${rankChips}</span>
            </div>
        </div>
    `;
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

    controlsDiv.className = 'session-actions';
    controlsDiv.removeAttribute('style');
    controlsDiv.innerHTML = '';
    const btn = document.createElement('button');
    const isLocked = !!session.locked;

    if (isLocked) {
        btn.innerHTML = '<span class="session-action-btn__icon">🔓</span>セットを再開';
        btn.className = 'session-action-btn session-action-btn--resume';
        btn.onclick = async () => {
            if (confirm('セットを再開しますか？\n修正が可能になります。')) {
                await window.AppStorage.updateSession(session.id, { locked: false });
                await openSession(session.id);
            }
        };
    } else {
        btn.innerHTML = '<span class="session-action-btn__icon">🔒</span>セットを終了';
        btn.className = 'session-action-btn session-action-btn--end';
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
    shareBtn.innerHTML = '<span class="session-action-btn__icon">📷</span>画像で共有';
    shareBtn.className = 'session-action-btn session-action-btn--share';
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
    const selfName = localStorage.getItem('deviceUser');

    // 収支は参加者・管理者のみ閲覧可（非参加者には列ごと非表示）
    const isAdmin = selfName === 'ヒロム';
    const isParticipant = Array.isArray(session.players) && session.players.includes(selfName);
    const showAmount = rate > 0 && (isAdmin || isParticipant);

    // Build Table Header
    let html = `<thead><tr>
        <th>順位</th>
        <th>名前</th>
        <th>合計Pt</th>
        ${showAmount ? '<th>収支</th>' : ''}
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
        if (showAmount) {
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

        const isSelf = p === selfName;
        const medals = ['🥇', '🥈', '🥉'];
        const rankLabel = i < 3 ? medals[i] : (i + 1);
        const rowClass = `${isSelf ? 'self-row' : ''}${i === 0 ? ' top-row' : ''}`.trim();

        html += `
            <tr class="${rowClass}">
                <td>${rankLabel}</td>
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
    const selfName = localStorage.getItem('deviceUser');
    const labels = ['開始'];
    session.games.forEach((_, i) => labels.push(`${i + 1}局`));

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

        // 自分の線は太く・最前面・点を強調
        const isSelf = player === selfName;
        return {
            label: isSelf ? `${player}（あなた）` : player,
            data: data,
            borderColor: colors[index % colors.length],
            backgroundColor: 'rgba(0,0,0,0)',
            tension: 0.1,
            borderWidth: isSelf ? 4 : 2,
            pointRadius: isSelf ? 3 : 2,
            order: isSelf ? 0 : 1
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

    const deviceUser = localStorage.getItem('deviceUser');
    const isParticipant = Array.isArray(session.players) && session.players.includes(deviceUser);
    const isLocked = !!session.locked;
    const showControls = (deviceUser === 'ヒロム' || isParticipant) && !isLocked;
    const medals = ['🥇', '🥈', '🥉'];

    // 最新の対局を上に表示
    [...session.games].reverse().forEach((game, index) => {
        const gameNo = session.games.length - index;
        const card = document.createElement('div');
        card.className = 'game-card';

        const sortedPlayers = [...game.players].sort((a, b) => a.rank - b.rank);

        // 役満バッジ
        const yakumans = [];
        game.players.forEach(p => (p.yakuman || []).forEach(y => yakumans.push({ name: p.name, type: y.type })));
        const yakumanBadge = yakumans.length > 0
            ? `<span class="yakuman-badge">🀄 役満 ${yakumans.map(y => `${y.name}（${y.type}）`).join('・')}</span>`
            : '';

        // コンパクト表示（2×2グリッド）
        const compact = sortedPlayers.map(p => {
            const medal = p.rank <= 3 ? medals[p.rank - 1] : `${p.rank}`;
            const sc = p.finalScore >= 0 ? 'score-positive' : 'score-negative';
            const scStr = p.finalScore > 0 ? `+${p.finalScore}` : `${p.finalScore}`;
            const isSelf = p.name === deviceUser;
            const hasYaku = (p.yakuman || []).length > 0;
            return `
                <div class="game-pl${isSelf ? ' is-self' : ''}">
                    <span class="game-pl__rank">${medal}</span>
                    <span class="game-pl__name">${p.name}${hasYaku ? ' 🀄' : ''}</span>
                    <span class="game-pl__score ${sc}">${scStr}</span>
                </div>`;
        }).join('');

        // 詳細表示（最終持ち点を含む）
        const detailRows = sortedPlayers.map(p => {
            const sc = p.finalScore >= 0 ? 'score-positive' : 'score-negative';
            const scStr = p.finalScore > 0 ? `+${p.finalScore}` : `${p.finalScore}`;
            const windHtml = p.wind ? `<span style="display:inline-block; width:18px; text-align:center; color:#94a3b8; font-weight:bold;">${p.wind}</span>` : '';
            return `<tr><td>${p.rank}</td><td>${windHtml}${p.name}</td><td>${p.rawScore}</td><td class="${sc}">${scStr}</td></tr>`;
        }).join('');

        card.innerHTML = `
            <div class="game-card__head">
                <span class="game-card__no">${gameNo}局</span>
                ${yakumanBadge}
                <div class="game-card__actions">
                    ${showControls ? `
                        <button class="btn-secondary btn-sm edit-game-btn" data-id="${game.id}" style="padding:2px 8px; font-size:0.8rem;">修正</button>
                        <button class="btn-danger btn-sm delete-game-btn" data-id="${game.id}" style="padding:2px 8px; font-size:0.8rem;">削除</button>
                    ` : ''}
                </div>
            </div>
            <div class="game-card__compact" title="タップで最終持ち点を表示">${compact}</div>
            <div class="game-card__detail" style="display:none;">
                <table class="history-table">
                    <thead><tr><th width="10%">#</th><th width="40%">名前</th><th width="25%">最終持ち点</th><th width="25%">Pt</th></tr></thead>
                    <tbody>${detailRows}</tbody>
                </table>
            </div>
        `;

        // タップで詳細を開閉
        const compactEl = card.querySelector('.game-card__compact');
        const detailEl = card.querySelector('.game-card__detail');
        compactEl.addEventListener('click', () => {
            const open = detailEl.style.display !== 'none';
            detailEl.style.display = open ? 'none' : 'block';
            card.classList.toggle('is-open', !open);
        });

        const editBtn = card.querySelector('.edit-game-btn');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                editingGameId = game.id;
                navigateTo('input');
                prepareInputForm(game);
            });
        }

        const deleteGameBtn = card.querySelector('.delete-game-btn');
        if (deleteGameBtn) {
            deleteGameBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm('この対局結果を削除しますか？')) {
                    await window.AppStorage.removeGameFromSession(session.id, game.id);
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

    // バリデーション通過後にローディング開始
    const scoreSubmitBtn = document.getElementById('score-submit-btn');
    setButtonLoading(scoreSubmitBtn, true, '保存中...');

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

    try {
        // Save
        await saveGameResult({ players: playersResult });
    } finally {
        setButtonLoading(scoreSubmitBtn, false);
    }

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

        ruleInitialSettings = { ...settings, uma: [...settings.uma] };
        updateRuleSaveState();

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

let ruleInitialSettings = null;

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

    ruleInitialSettings = {
        startScore: settings.startScore,
        returnScore: settings.returnScore,
        uma: [...settings.uma],
        tieBreaker: settings.tieBreaker,
    };

    refreshRuleUI();
}

// --- Rule preset & live integrity ---
const RULE_PRESETS = {
    mleague:  { startScore: 25000, returnScore: 30000, uma: [30, 10, -10, -30], tieBreaker: 'priority' },
    standard: { startScore: 25000, returnScore: 30000, uma: [20, 10, -10, -20], tieBreaker: 'split' },
    kyogi:    { startScore: 30000, returnScore: 30000, uma: [20, 10, -10, -20], tieBreaker: 'priority' },
};

function readCurrentRuleForm() {
    const startScore = Number(document.getElementById('set-start').value);
    const returnScore = Number(document.getElementById('set-return').value);
    const uma = [
        Number(document.getElementById('set-uma1').value),
        Number(document.getElementById('set-uma2').value),
        Number(document.getElementById('set-uma3').value),
        Number(document.getElementById('set-uma4').value),
    ];
    const tieBreakerRadio = document.querySelector('input[name="tieBreaker"]:checked');
    const tieBreaker = tieBreakerRadio ? tieBreakerRadio.value : 'priority';
    return { startScore, returnScore, uma, tieBreaker };
}

function updateRuleIntegrity() {
    const r = readCurrentRuleForm();
    const umaSum = r.uma.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
    const oka = Math.max(0, (r.returnScore - r.startScore) * 4);

    const umaEl = document.getElementById('rule-integrity-uma');
    const umaBadge = document.getElementById('rule-integrity-uma-badge');
    const okaEl = document.getElementById('rule-integrity-oka');
    if (umaEl) umaEl.textContent = (umaSum > 0 ? '+' : '') + umaSum;
    if (umaBadge) {
        umaBadge.classList.remove('rule-integrity__badge--ok', 'rule-integrity__badge--ng');
        if (umaSum === 0) {
            umaBadge.textContent = 'OK';
            umaBadge.classList.add('rule-integrity__badge--ok');
        } else {
            umaBadge.textContent = `合計が0ではありません`;
            umaBadge.classList.add('rule-integrity__badge--ng');
        }
    }
    if (okaEl) okaEl.textContent = oka.toLocaleString('en-US');
}

function rulesMatchPreset(current, preset) {
    return current.startScore === preset.startScore
        && current.returnScore === preset.returnScore
        && current.tieBreaker === preset.tieBreaker
        && current.uma.length === 4
        && current.uma.every((v, i) => v === preset.uma[i]);
}

function updateRulePresetActive() {
    const current = readCurrentRuleForm();
    let matchedKey = null;
    Object.keys(RULE_PRESETS).forEach(key => {
        if (rulesMatchPreset(current, RULE_PRESETS[key])) matchedKey = key;
    });

    document.querySelectorAll('.rule-preset-btn').forEach(btn => {
        const key = btn.dataset.preset;
        if (key === 'custom') {
            // Custom indicator: highlights when no preset matches
            btn.classList.toggle('is-active', matchedKey === null);
        } else {
            btn.classList.toggle('is-active', key === matchedKey);
        }
    });

    const stateEl = document.getElementById('rule-preset-state');
    if (stateEl) {
        if (matchedKey) {
            const labels = { mleague: 'Mリーグ準拠', standard: '一般ルール', kyogi: '競技ルール' };
            stateEl.textContent = labels[matchedKey] || matchedKey;
            stateEl.dataset.state = 'preset';
        } else {
            stateEl.textContent = '✨ カスタム設定中';
            stateEl.dataset.state = 'custom';
        }
    }
}

function applyRulePreset(key) {
    const preset = RULE_PRESETS[key];
    if (!preset) return;
    document.getElementById('set-start').value = preset.startScore;
    document.getElementById('set-return').value = preset.returnScore;
    document.getElementById('set-uma1').value = preset.uma[0];
    document.getElementById('set-uma2').value = preset.uma[1];
    document.getElementById('set-uma3').value = preset.uma[2];
    document.getElementById('set-uma4').value = preset.uma[3];
    document.getElementsByName('tieBreaker').forEach(r => {
        r.checked = r.value === preset.tieBreaker;
    });
    updateRuleIntegrity();
    updateRulePresetActive();
}

document.querySelectorAll('.rule-preset-btn').forEach(btn => {
    if (btn.dataset.preset === 'custom') return; // indicator only
    btn.addEventListener('click', () => applyRulePreset(btn.dataset.preset));
});

function refreshRuleUI() {
    updateRuleIntegrity();
    updateRulePresetActive();
    updateRulePreview();
    updateRuleSaveState();
}

// Live recalculation on any rule input change
['set-start', 'set-return', 'set-uma1', 'set-uma2', 'set-uma3', 'set-uma4'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', refreshRuleUI);
});
document.getElementsByName('tieBreaker').forEach((r) => {
    r.addEventListener('change', refreshRuleUI);
});

// --- Live preview ---
const PREVIEW_NORMAL_SCORES = [50000, 30000, 15000, 5000];
const PREVIEW_TIE_SCORES = [35000, 35000, 20000, 10000];
const PREVIEW_WINDS = ['東', '南', '西', '北'];

function renderPreviewRows(ulId, players, withWinds) {
    const ul = document.getElementById(ulId);
    if (!ul) return;
    ul.innerHTML = '';
    // Sort by rank for display
    const sorted = [...players].sort((a, b) => (a.rank - b.rank) || (a.index - b.index));
    sorted.forEach((p) => {
        const li = document.createElement('li');
        li.className = 'rule-preview__row';
        const rankCls = `rule-preview__rank rule-preview__rank--${p.rank}`;
        const finalNum = Number(p.finalScore);
        const finalCls = finalNum > 0 ? 'rule-preview__final--pos' : (finalNum < 0 ? 'rule-preview__final--neg' : '');
        const sign = finalNum > 0 ? '+' : '';
        const wind = withWinds ? `<span class="rule-preview__wind">${PREVIEW_WINDS[p.index]}家</span>` : '<span></span>';
        li.innerHTML = `
            <span class="${rankCls}">${p.rank}</span>
            ${wind}
            <span class="rule-preview__raw">${p.rawScore.toLocaleString('en-US')}</span>
            <span class="rule-preview__final ${finalCls}">${sign}${finalNum.toFixed(1)}</span>
        `;
        ul.appendChild(li);
    });
}

function updateRulePreview() {
    const cur = readCurrentRuleForm();
    const umaSum = cur.uma.reduce((a, b) => a + b, 0);
    // Bail out if config is invalid (uma sum != 0 or return < start) — clear and show note
    if (umaSum !== 0 || cur.returnScore < cur.startScore) {
        ['rule-preview-normal', 'rule-preview-tie'].forEach(id => {
            const ul = document.getElementById(id);
            if (ul) ul.innerHTML = '<li class="rule-preview__row" style="color: var(--text-secondary); font-size: 0.78rem;">設定値を整えると例が表示されます</li>';
        });
        const modeEl = document.getElementById('rule-preview-tie-mode');
        if (modeEl) modeEl.textContent = '';
        return;
    }

    if (!window.Mahjong || !window.Mahjong.calculateResult) return;

    const normalRes = window.Mahjong.calculateResult(PREVIEW_NORMAL_SCORES, cur);
    if (Array.isArray(normalRes)) renderPreviewRows('rule-preview-normal', normalRes, false);

    // Tie scenario — pass winds (East..North) so priority mode can resolve
    const tieRes = window.Mahjong.calculateResult(PREVIEW_TIE_SCORES, cur, PREVIEW_WINDS);
    if (Array.isArray(tieRes)) renderPreviewRows('rule-preview-tie', tieRes, true);

    const modeEl = document.getElementById('rule-preview-tie-mode');
    if (modeEl) modeEl.textContent = cur.tieBreaker === 'priority' ? '起家優先' : '山分け';
}

// --- Save state (unchanged disabling + change badge) ---
function rulesEqual(a, b) {
    if (!a || !b) return false;
    return a.startScore === b.startScore
        && a.returnScore === b.returnScore
        && a.tieBreaker === b.tieBreaker
        && a.uma.length === 4 && b.uma.length === 4
        && a.uma.every((v, i) => v === b.uma[i]);
}

function updateRuleSaveState() {
    const cur = readCurrentRuleForm();
    const saveBtn = document.getElementById('settings-save-btn');
    const changesBadge = document.getElementById('rule-form-changes');
    if (!saveBtn || !changesBadge) return;

    const umaSum = cur.uma.reduce((a, b) => a + b, 0);
    const invalid = umaSum !== 0 || cur.returnScore < cur.startScore
        || !Number.isFinite(cur.startScore) || !Number.isFinite(cur.returnScore);

    const changed = ruleInitialSettings && !rulesEqual(cur, ruleInitialSettings);

    saveBtn.disabled = !changed || invalid;
    changesBadge.classList.toggle('is-visible', !!changed);
}

// --- Help popover ---
const HELP_TEXTS = {
    'start-score': {
        title: '配給原点',
        body: '各プレイヤーが対局開始時に持つ点数。通常 25000点 が一般的で、競技ルールでは 30000点 のことも。'
    },
    'return-score': {
        title: '返し点',
        body: '終局時の精算基準となる点数。(返し点 − 配給原点)×4 がオカとして1着に支給されます。Mリーグルールでは 30000点。'
    },
    'uma': {
        title: 'ウマ',
        body: '終局順位ごとに加減される点数。合計は0になるよう設定します。(+30/+10/−10/−30) や (+20/+10/−10/−20) のような対称形が一般的です。'
    },
    'tie-breaker': {
        title: '同点時の処理',
        body: '点数が並んだとき順位をどう決めるか。「起家優先」は風（東＞南＞西＞北）の順、「山分け」はウマ・オカを同点者で頭割りします。'
    },
};

const helpPopover = document.getElementById('rule-help-popover');
const helpPopoverTitle = document.getElementById('rule-help-popover-title');
const helpPopoverBody = document.getElementById('rule-help-popover-body');
let helpPopoverAnchor = null;

function openHelpPopover(anchor, key) {
    const def = HELP_TEXTS[key];
    if (!def || !helpPopover) return;
    helpPopoverTitle.textContent = def.title;
    helpPopoverBody.textContent = def.body;
    helpPopover.classList.add('is-open');
    helpPopover.setAttribute('aria-hidden', 'false');
    helpPopoverAnchor = anchor;

    // Position below the anchor
    const rect = anchor.getBoundingClientRect();
    const popRect = helpPopover.getBoundingClientRect();
    const scrollY = window.scrollY || window.pageYOffset;
    const scrollX = window.scrollX || window.pageXOffset;

    let top = rect.bottom + scrollY + 8;
    let left = rect.left + scrollX + rect.width / 2 - popRect.width / 2;

    // Clamp to viewport horizontally
    const margin = 8;
    const maxLeft = scrollX + document.documentElement.clientWidth - popRect.width - margin;
    if (left < scrollX + margin) left = scrollX + margin;
    if (left > maxLeft) left = maxLeft;

    helpPopover.style.top = `${top}px`;
    helpPopover.style.left = `${left}px`;

    // Position arrow
    const arrow = helpPopover.querySelector('.rule-help-popover__arrow');
    if (arrow) {
        const anchorCenter = rect.left + scrollX + rect.width / 2;
        arrow.style.left = `${Math.max(8, Math.min(popRect.width - 18, anchorCenter - left - 5))}px`;
    }
}

function closeHelpPopover() {
    if (!helpPopover) return;
    helpPopover.classList.remove('is-open');
    helpPopover.setAttribute('aria-hidden', 'true');
    helpPopoverAnchor = null;
}

document.querySelectorAll('.rule-help').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = btn.dataset.help;
        if (helpPopoverAnchor === btn && helpPopover.classList.contains('is-open')) {
            closeHelpPopover();
        } else {
            openHelpPopover(btn, key);
        }
    });
});

document.addEventListener('click', (e) => {
    if (!helpPopover || !helpPopover.classList.contains('is-open')) return;
    if (helpPopover.contains(e.target)) return;
    if (e.target.classList && e.target.classList.contains('rule-help')) return;
    closeHelpPopover();
});

window.addEventListener('resize', closeHelpPopover);

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
        roulettePresets = await window.AppStorage.getRoulettePresets();
    } catch (e) {
        console.error("Failed to load roulette presets", e);
        roulettePresets = [];
    }

    // 何らかの理由で空ならデフォルトを1つ用意
    if (!Array.isArray(roulettePresets) || roulettePresets.length === 0) {
        roulettePresets = [{
            id: 'rl_default', name: 'マイルーレット', mode: 'normal',
            items: ['1', '2', '3', '4', '5', '6', '7'].map(l => ({ label: l, weight: 1 }))
        }];
    }

    // 前回開いていたプリセットを復元
    const lastId = window.AppStorage.getLastRoulettePresetId
        ? window.AppStorage.getLastRoulettePresetId() : null;
    currentPresetId = (lastId && roulettePresets.some(p => p.id === lastId))
        ? lastId : roulettePresets[0].id;

    syncItemsFromPreset();
    renderPresetSelect();
    renderRouletteList();
    drawRoulette();
}

// アクティブなプリセットを取得
function getActivePreset() {
    return roulettePresets.find(p => p.id === currentPresetId) || roulettePresets[0] || null;
}

// アクティブなプリセットの items を rouletteItems に同期（参照を合わせる）
function syncItemsFromPreset() {
    const p = getActivePreset();
    rouletteItems = p ? p.items : [];
}

// プリセット全体を永続化
async function saveRouletteItems() {
    await window.AppStorage.saveRoulettePresets(roulettePresets);
}

// プリセット選択ドロップダウンを再描画
function renderPresetSelect() {
    if (!roulettePresetSelect) return;
    roulettePresetSelect.innerHTML = '';
    roulettePresets.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.name}（${p.items.length}）`;
        roulettePresetSelect.appendChild(opt);
    });
    roulettePresetSelect.value = currentPresetId;
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

        if (rouletteItems.some(it => it.label === value)) {
            alert('同じ項目が既に存在します。');
            return;
        }

        rouletteItems.push({ label: value, weight: 1 });
        await saveRouletteItems(); // Async save
        rouletteInput.value = '';
        renderPresetSelect();
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
    renderPresetSelect();
    renderRouletteList();
    drawRoulette();
}
window.removeRouletteItem = removeRouletteItem;

// 重み（当たりやすさ）を変更
async function changeRouletteWeight(index, delta) {
    const it = rouletteItems[index];
    if (!it) return;
    it.weight = Math.max(1, Math.min(20, (it.weight || 1) + delta));
    await saveRouletteItems();
    renderRouletteList();
    drawRoulette();
}
window.changeRouletteWeight = changeRouletteWeight;

// Render roulette item list
function renderRouletteList() {
    if (!rouletteList) return;

    rouletteList.innerHTML = '';
    rouletteItems.forEach((item, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="rl-item-label">${escapeHtml(item.label)}</span>
            <div class="rl-item-weight" title="当たりやすさ（重み）">
                <button type="button" onclick="changeRouletteWeight(${index}, -1)">−</button>
                <span class="rl-weight-val">${item.weight || 1}</span>
                <button type="button" onclick="changeRouletteWeight(${index}, 1)">＋</button>
            </div>
            <button type="button" class="rl-item-remove" onclick="removeRouletteItem(${index})">×</button>
        `;
        rouletteList.appendChild(li);
    });
}

// --- Preset management UI ---
async function switchPreset(id) {
    if (!roulettePresets.some(p => p.id === id)) return;
    currentPresetId = id;
    if (window.AppStorage.setLastRoulettePresetId) {
        window.AppStorage.setLastRoulettePresetId(id);
    }
    syncItemsFromPreset();
    renderPresetSelect();
    renderRouletteList();
    currentRotation = 0;
    if (rouletteResult) rouletteResult.innerHTML = '';
    drawRoulette();
}

if (roulettePresetSelect) {
    roulettePresetSelect.addEventListener('change', (e) => switchPreset(e.target.value));
}

// --- 名前入力モーダル（prompt() の代替。環境依存でダイアログが出ない問題を回避） ---
const rouletteNameModal = document.getElementById('roulette-name-modal');
const rouletteNameTitle = document.getElementById('roulette-name-title');
const rouletteNameInput = document.getElementById('roulette-name-input');
const rouletteNameOk = document.getElementById('roulette-name-ok');
const rouletteNameCancel = document.getElementById('roulette-name-cancel');
let _rouletteNameResolve = null;

function promptRouletteName(title, defaultValue = '') {
    return new Promise((resolve) => {
        if (!rouletteNameModal) { resolve(null); return; }
        _rouletteNameResolve = resolve;
        rouletteNameTitle.textContent = title;
        rouletteNameInput.value = defaultValue;
        rouletteNameModal.style.display = 'flex';
        setTimeout(() => { rouletteNameInput.focus(); rouletteNameInput.select(); }, 50);
    });
}

function _resolveRouletteName(value) {
    if (rouletteNameModal) rouletteNameModal.style.display = 'none';
    const r = _rouletteNameResolve;
    _rouletteNameResolve = null;
    if (r) r(value);
}

if (rouletteNameOk) rouletteNameOk.addEventListener('click', () => _resolveRouletteName((rouletteNameInput.value || '').trim()));
if (rouletteNameCancel) rouletteNameCancel.addEventListener('click', () => _resolveRouletteName(null));
if (rouletteNameModal) {
    rouletteNameModal.addEventListener('click', (e) => { if (e.target === rouletteNameModal) _resolveRouletteName(null); });
}
if (rouletteNameInput) {
    rouletteNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); _resolveRouletteName((rouletteNameInput.value || '').trim()); }
        else if (e.key === 'Escape') { e.preventDefault(); _resolveRouletteName(null); }
    });
}

if (presetNewBtn) {
    presetNewBtn.addEventListener('click', async () => {
        const name = await promptRouletteName('新しいルーレットを作成', '新しいルーレット');
        if (!name) return;
        const preset = { id: 'rl_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), name, mode: 'normal', items: [] };
        roulettePresets.push(preset);
        await saveRouletteItems();
        await switchPreset(preset.id);
    });
}

if (presetRenameBtn) {
    presetRenameBtn.addEventListener('click', async () => {
        const p = getActivePreset();
        if (!p) return;
        const name = await promptRouletteName('ルーレットの名前を変更', p.name);
        if (!name) return;
        p.name = name;
        await saveRouletteItems();
        renderPresetSelect();
    });
}

if (presetDuplicateBtn) {
    presetDuplicateBtn.addEventListener('click', async () => {
        const p = getActivePreset();
        if (!p) return;
        const copy = {
            id: 'rl_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
            name: p.name + ' のコピー',
            mode: p.mode || 'normal',
            items: p.items.map(it => ({ label: it.label, weight: it.weight || 1 }))
        };
        roulettePresets.push(copy);
        await saveRouletteItems();
        await switchPreset(copy.id);
    });
}

if (presetDeleteBtn) {
    presetDeleteBtn.addEventListener('click', async () => {
        const p = getActivePreset();
        if (!p) return;
        if (roulettePresets.length <= 1) {
            alert('最後の1個は削除できません。');
            return;
        }
        if (!confirm(`「${p.name}」を削除しますか？`)) return;
        roulettePresets = roulettePresets.filter(x => x.id !== p.id);
        await saveRouletteItems();
        await switchPreset(roulettePresets[0].id);
    });
}

// 重み付きセグメントの境界を計算（0〜2πの非回転座標）
function computeRouletteSegments() {
    const total = rouletteItems.reduce((s, i) => s + (i.weight || 1), 0) || 1;
    let acc = 0;
    const segs = [];
    for (let i = 0; i < rouletteItems.length; i++) {
        const frac = (rouletteItems[i].weight || 1) / total;
        const start = acc * 2 * Math.PI;
        acc += frac;
        const end = acc * 2 * Math.PI;
        segs.push({ start, end, mid: (start + end) / 2 });
    }
    return segs;
}

// 現在の回転角でポインタ（真上）が指すセグメントindexを返す
function getRouletteIndexAt(rotation) {
    const segs = computeRouletteSegments();
    if (segs.length === 0) return 0;
    const pointer = -Math.PI / 2;
    let rel = ((pointer - rotation) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    for (let i = 0; i < segs.length; i++) {
        if (rel >= segs[i].start && rel < segs[i].end) return i;
    }
    return segs.length - 1;
}

// Draw roulette wheel
// highlightIndex >= 0 のとき当選セグメントを発光（glow）、他を暗転（dim 0..1）させる
function drawRoulette(rotation = 0, highlightIndex = -1, dim = 0, glow = 0) {
    if (!rouletteCtx || rouletteItems.length === 0) return;

    const centerX = rouletteCanvas.width / 2;
    const centerY = rouletteCanvas.height / 2;
    // Outer radius for the wheel
    const radius = 130;

    // Clear canvas
    rouletteCtx.clearRect(0, 0, rouletteCanvas.width, rouletteCanvas.height);

    // 重み付きセグメント境界（不均等）
    const segments = computeRouletteSegments();

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
        const seg = segments[index];
        const startAngle = rotation + seg.start;
        const endAngle = rotation + seg.end;

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
        rouletteCtx.rotate(rotation + seg.mid);
        rouletteCtx.textAlign = 'center';
        rouletteCtx.textBaseline = 'middle';

        // Shadow for text readability
        rouletteCtx.shadowColor = "rgba(0,0,0,0.5)";
        rouletteCtx.shadowBlur = 4;
        rouletteCtx.shadowOffsetX = 1;
        rouletteCtx.shadowOffsetY = 1;

        rouletteCtx.fillStyle = '#fff';
        // Auto-scale font based on label length
        const label = item.label != null ? String(item.label) : '';
        const fontSize = Math.min(18, (radius * 0.7) / (Math.max(1, label.length) * 0.8));
        rouletteCtx.font = `bold ${Math.max(10, fontSize)}px Inter, 'Noto Sans JP', sans-serif`;

        // Push text out a bit
        rouletteCtx.fillText(label, radius * 0.6, 0);
        rouletteCtx.restore();

        // --- 当選ハイライト / 暗転 ---
        if (highlightIndex >= 0) {
            if (index === highlightIndex) {
                // 当たり: 内側に淡い発光
                rouletteCtx.save();
                rouletteCtx.beginPath();
                rouletteCtx.moveTo(centerX, centerY);
                rouletteCtx.arc(centerX, centerY, radius, startAngle, endAngle);
                rouletteCtx.closePath();
                rouletteCtx.clip();
                rouletteCtx.fillStyle = `rgba(255,255,255,${0.18 * glow})`;
                rouletteCtx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
                rouletteCtx.restore();
                // 当たり: 金色の縁取り＋グロー
                rouletteCtx.save();
                rouletteCtx.beginPath();
                rouletteCtx.moveTo(centerX, centerY);
                rouletteCtx.arc(centerX, centerY, radius, startAngle, endAngle);
                rouletteCtx.closePath();
                rouletteCtx.lineWidth = 3;
                rouletteCtx.strokeStyle = `rgba(255,235,150,${0.4 + 0.6 * glow})`;
                rouletteCtx.shadowColor = "rgba(255,220,120,0.9)";
                rouletteCtx.shadowBlur = 20 * glow;
                rouletteCtx.stroke();
                rouletteCtx.restore();
            } else {
                // 外れ: 暗転
                rouletteCtx.save();
                rouletteCtx.beginPath();
                rouletteCtx.moveTo(centerX, centerY);
                rouletteCtx.arc(centerX, centerY, radius, startAngle, endAngle);
                rouletteCtx.closePath();
                rouletteCtx.clip();
                rouletteCtx.fillStyle = `rgba(0,0,0,${0.6 * dim})`;
                rouletteCtx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
                rouletteCtx.restore();
            }
        }
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
// tension(0..1) が高いほどピッチを上げ、減速時の緊張感（ドラムロール）を演出
function playTickSound(tension = 0) {
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    const tn = Math.min(1, Math.max(0, tension));
    oscillator.frequency.value = 600 + 600 * tn; // 600Hz → 1200Hz
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

// --- B3: 触覚フィードバック ---
function rouletteVibrate(pattern) {
    try {
        if (navigator.vibrate) navigator.vibrate(pattern);
    } catch (e) { /* 非対応端末は無視 */ }
}

// --- B3: 当たり演出（紙吹雪） ---
function launchConfetti(opts = {}) {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2000;';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const colors = opts.colors || ['#bb86fc', '#03dac6', '#cf6679', '#ffb74d', '#f59e0b', '#3b82f6', '#ffffff'];
    const originX = canvas.width / 2;
    const originY = canvas.height * 0.38;
    const particles = [];
    const N = opts.count || 140;
    for (let i = 0; i < N; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 4 + Math.random() * 9;
        particles.push({
            x: originX, y: originY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 4,
            size: 5 + Math.random() * 7,
            color: colors[(Math.random() * colors.length) | 0],
            rot: Math.random() * Math.PI,
            vr: (Math.random() - 0.5) * 0.3
        });
    }

    const start = performance.now();
    const DURATION = 2200;
    function frame(now) {
        const elapsed = now - start;
        const life = Math.max(0, 1 - elapsed / DURATION);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.vy += 0.18;   // 重力
            p.vx *= 0.99;
            p.x += p.vx;
            p.y += p.vy;
            p.rot += p.vr;
            ctx.save();
            ctx.globalAlpha = life;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
            ctx.restore();
        });
        if (elapsed < DURATION) {
            requestAnimationFrame(frame);
        } else {
            canvas.remove();
        }
    }
    requestAnimationFrame(frame);
}

// --- 当選セグメントのハイライト演出（当たりを発光、他を暗転） ---
function animateSegmentHighlight(winningIndex) {
    const start = performance.now();
    const DURATION = 1400;
    function frame(now) {
        if (isSpinning) return; // 新しいスピンが始まったら中断
        const t = Math.min(1, (now - start) / DURATION);
        const dim = Math.min(1, t * 3);                       // 素早く暗転
        const glow = 0.5 + 0.5 * Math.abs(Math.sin(t * Math.PI * 3)); // 数回パルス
        drawRoulette(currentRotation, winningIndex, dim, glow);
        if (t < 1) requestAnimationFrame(frame);
        else drawRoulette(currentRotation, winningIndex, 1, 0.65); // 落ち着いた状態で固定
    }
    requestAnimationFrame(frame);
}

// --- 集中線（マンガ風スピードライン） ---
function launchFocusLines(rare) {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:1999;';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const cx = canvas.width / 2;
    const cy = canvas.height * 0.38;
    const maxR = Math.hypot(canvas.width, canvas.height);
    const N = 50;
    const start = performance.now();
    const DUR = 600;
    function frame(now) {
        const t = (now - start) / DUR;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const alpha = Math.max(0, 1 - t);
        const inner = 60 + t * 160; // 中心はクリアに保ち、外へ広がる
        for (let i = 0; i < N; i++) {
            const a = (i / N) * Math.PI * 2;
            const wide = (i % 2 === 0) ? 0.014 : 0.007;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
            ctx.lineTo(cx + Math.cos(a - wide) * maxR, cy + Math.sin(a - wide) * maxR);
            ctx.lineTo(cx + Math.cos(a + wide) * maxR, cy + Math.sin(a + wide) * maxR);
            ctx.closePath();
            ctx.fillStyle = rare ? `rgba(255,215,0,${alpha * 0.85})` : `rgba(255,255,255,${alpha * 0.5})`;
            ctx.fill();
        }
        if (t < 1) requestAnimationFrame(frame);
        else canvas.remove();
    }
    requestAnimationFrame(frame);
}

// --- レア当選のファンファーレ（アルペジオ和音） ---
function playFanfare() {
    if (!audioContext) return;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((f, i) => {
        const t0 = audioContext.currentTime + i * 0.1;
        const osc = audioContext.createOscillator();
        const g = audioContext.createGain();
        osc.connect(g); g.connect(audioContext.destination);
        osc.type = 'triangle';
        osc.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.45);
        osc.start(t0); osc.stop(t0 + 0.5);
    });
}

// --- レア予兆（虹×金フラッシュ＋上昇音） ---
function flashRareOverlay() {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:1998;mix-blend-mode:screen;opacity:0;';
    el.style.background = 'radial-gradient(circle at 50% 38%, rgba(255,215,0,0.6), rgba(255,0,200,0.35) 40%, rgba(0,200,255,0.25) 70%, transparent 80%)';
    document.body.appendChild(el);
    const start = performance.now();
    const DUR = 900;
    function frame(now) {
        const t = (now - start) / DUR;
        el.style.opacity = String(Math.max(0, Math.sin(t * Math.PI * 3)) * (1 - t * 0.3));
        if (t < 1) requestAnimationFrame(frame);
        else el.remove();
    }
    requestAnimationFrame(frame);

    // 上昇音
    if (audioContext) {
        const osc = audioContext.createOscillator();
        const g = audioContext.createGain();
        osc.connect(g); g.connect(audioContext.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.85);
        g.gain.setValueAtTime(0.0001, audioContext.currentTime);
        g.gain.exponentialRampToValueAtTime(0.2, audioContext.currentTime + 0.1);
        g.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.9);
        osc.start(); osc.stop(audioContext.currentTime + 0.95);
    }
}

// --- ① カウントダウン「3・2・1・GO!」用のビープ ---
function playCountBeep(isGo) {
    if (!audioContext) return;
    const osc = audioContext.createOscillator();
    const g = audioContext.createGain();
    osc.connect(g); g.connect(audioContext.destination);
    osc.type = 'square';
    osc.frequency.value = isGo ? 880 : 440;
    const t0 = audioContext.currentTime;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + (isGo ? 0.4 : 0.15));
    osc.start(t0); osc.stop(t0 + (isGo ? 0.45 : 0.2));
}

// --- ① カウントダウン演出（完了後に onDone を呼ぶ） ---
function runCountdown(onDone) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:2001;';
    document.body.appendChild(overlay);

    const steps = ['3', '2', '1', 'GO!'];
    let i = 0;
    function showStep() {
        if (i >= steps.length) {
            overlay.remove();
            if (onDone) onDone();
            return;
        }
        const txt = steps[i];
        const isGo = (txt === 'GO!');
        const el = document.createElement('div');
        el.className = 'countdown-num' + (isGo ? ' countdown-go' : '');
        el.textContent = txt;
        overlay.innerHTML = '';
        overlay.appendChild(el);
        playCountBeep(isGo);
        i++;
        setTimeout(showStep, isGo ? 450 : 520);
    }
    showStep();
}

// --- ② 回転中のスパーク＋スポットライト追従 ---
let wheelFxCanvas = null;
let wheelFxRunning = false;
let wheelFxLoopId = 0;

function startWheelSpinFx() {
    if (!rouletteCanvas) return;
    const wrap = rouletteCanvas.parentElement;
    if (!wrap) return;
    const PAD = 30;
    if (!wheelFxCanvas) {
        wheelFxCanvas = document.createElement('canvas');
        wheelFxCanvas.width = rouletteCanvas.width + PAD * 2;
        wheelFxCanvas.height = rouletteCanvas.height + PAD * 2;
        wheelFxCanvas.style.cssText = `position:absolute;top:${-PAD}px;left:${-PAD}px;width:${rouletteCanvas.width + PAD * 2}px;height:${rouletteCanvas.height + PAD * 2}px;pointer-events:none;z-index:3;`;
        wrap.appendChild(wheelFxCanvas);
    }
    const ctx = wheelFxCanvas.getContext('2d');
    const cx = wheelFxCanvas.width / 2;
    const cy = wheelFxCanvas.height / 2;
    const R = 138; // ホイール外周付近
    const particles = [];
    let sweep = 0;
    wheelFxRunning = true;
    const myId = ++wheelFxLoopId; // 新しいスピンが始まったら旧ループは停止

    function frame() {
        if (myId !== wheelFxLoopId) return;
        ctx.clearRect(0, 0, wheelFxCanvas.width, wheelFxCanvas.height);

        // 回転中のみ: スポットライト追従＋スパーク生成（停止後は既存のみ消化）
        if (wheelFxRunning) {
            // スポットライト追従（ホイール面を走る光）
            sweep += 0.16;
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, R, 0, Math.PI * 2);
            ctx.clip();
            ctx.translate(cx, cy);
            ctx.rotate(sweep);
            const bx = 0, by = -R * 0.72;
            const grad = ctx.createRadialGradient(bx, by, 0, bx, by, R * 0.7);
            grad.addColorStop(0, 'rgba(255,255,255,0.30)');
            grad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(bx, by, R * 0.7, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // スパーク生成（外周から放射状に）
            if (Math.random() < 0.7) {
                const a = Math.random() * Math.PI * 2;
                const sp = 1.2 + Math.random() * 3;
                particles.push({
                    x: cx + Math.cos(a) * R,
                    y: cy + Math.sin(a) * R,
                    vx: Math.cos(a) * sp,
                    vy: Math.sin(a) * sp,
                    life: 1,
                    color: Math.random() < 0.5 ? '#ffd54a' : '#03dac6'
                });
            }
        }
        for (const p of particles) {
            p.x += p.vx; p.y += p.vy; p.life -= 0.045;
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        for (let k = particles.length - 1; k >= 0; k--) {
            if (particles[k].life <= 0) particles.splice(k, 1);
        }

        if (wheelFxRunning || particles.length > 0) {
            requestAnimationFrame(frame);
        } else {
            ctx.clearRect(0, 0, wheelFxCanvas.width, wheelFxCanvas.height);
        }
    }
    requestAnimationFrame(frame);
}

function stopWheelSpinFx() {
    wheelFxRunning = false;
}

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
        spinBtn.textContent = "…";

        // ① カウントダウン「3・2・1・GO!」→ 完了後にスピン開始
        runCountdown(() => {
        spinBtn.textContent = "回転中...";
        // 回転中はホイールのネオン発光を強める＋スパーク/スポットライト
        if (rouletteCanvas && rouletteCanvas.parentElement) {
            rouletteCanvas.parentElement.classList.add('is-spinning');
        }
        startWheelSpinFx();

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

        // レア「激アツ」演出（ガチャ風）— 低確率で発動
        const isRare = Math.random() < 0.12;

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

        // Sound state — セグメント境界をまたぐたびにチック音を鳴らす（重み付き対応）
        let lastTickSegment = getRouletteIndexAt(startRotation);
        // 滑り/逆回転エフェクト用の代表的な1セグメント分の角度（近似）
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
            const currentSegment = getRouletteIndexAt(currentRotation);

            if (currentSegment !== lastTickSegment) {
                // ② ドラムロール: 減速（進行度）に応じてチック音のピッチを上げる
                const tension = Math.min(1, (performance.now() - startTime) / duration);
                playTickSound(tension);
            }
            lastTickSegment = currentSegment;
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
            // Calculate Result（重み付きセグメント対応）
            const winningIndex = getRouletteIndexAt(currentRotation);
            const winningItem = rouletteItems[winningIndex];
            const winningLabel = winningItem ? String(winningItem.label) : '';

            const finalize = () => {
                isSpinning = false;
                spinBtn.disabled = false;
                spinBtn.style.color = "";
                spinBtn.textContent = "もう一度回す";
                if (rouletteCanvas && rouletteCanvas.parentElement) {
                    rouletteCanvas.parentElement.classList.remove('is-spinning');
                }
                stopWheelSpinFx();
            };

            const reveal = () => {
                // 当選ハイライト＋集中線
                animateSegmentHighlight(winningIndex);
                launchFocusLines(isRare);

                // サウンド・触覚・紙吹雪
                if (isRare) {
                    playFanfare();
                    rouletteVibrate([40, 30, 40, 30, 180]);
                    launchConfetti({ colors: ['#ffd700', '#ff5ec7', '#5ecbff', '#fff7a0', '#ff8a00', '#a0ff8a', '#ffffff'], count: 260 });
                } else {
                    playResultSound();
                    rouletteVibrate([60, 40, 120]);
                    launchConfetti();
                }

                // Effect badge
                let effectBadge = "";
                if (effectType === 1) effectBadge = "<span style='font-size:0.7rem; background:#ff4444; color:white; padding:2px 6px; border-radius:4px; margin-bottom:5px; display:inline-block;'>再始動発動！</span><br>";
                if (effectType === 2) effectBadge = "<span style='font-size:0.7rem; background:#f59e0b; color:white; padding:2px 6px; border-radius:4px; margin-bottom:5px; display:inline-block;'>滑り発動！</span><br>";
                if (effectType === 3) effectBadge = "<span style='font-size:0.7rem; background:#3b82f6; color:white; padding:2px 6px; border-radius:4px; margin-bottom:5px; display:inline-block;'>逆回転発動！</span><br>";
                if (isRare) effectBadge = "<span class='rare-badge'>★ 激アツ ★</span><br>" + effectBadge;

                // Show Result
                const winnerColor = isRare ? '#ffd700' : '#bb86fc';
                const winnerShadow = isRare ? '0 0 16px rgba(255,215,0,0.7)' : '0 0 10px rgba(187,134,252,0.5)';
                const winnerHtml = `<div style="font-size:1.6rem; font-weight:bold; color:${winnerColor}; text-shadow:${winnerShadow};">${escapeHtml(winningLabel)}</div>`;
                rouletteResult.innerHTML = `${effectBadge}<div style="font-size:0.8rem; color:#888;">${isRare ? '★ RARE ★' : 'RESULT'}</div>${winnerHtml}`;
                rouletteResult.classList.toggle('rare', isRare);

                finalize();
            };

            if (isRare) {
                // ガチャ風の予兆 → 少し溜めてから結果
                flashRareOverlay();
                spinBtn.textContent = "！？";
                setTimeout(reveal, 900);
            } else {
                reveal();
            }
        }

        requestAnimationFrame(animate);
        }); // ① runCountdown 完了コールバック終了
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
setupNewSetForm();

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
// Type-specific gradient / glyph for placeholder cards
const YAKUMAN_STYLE = {
    '国士無双':   { gradient: 'linear-gradient(135deg, #b300ff, #ffd700)', glyph: '🀇' },
    '四暗刻':     { gradient: 'linear-gradient(135deg, #4a0e0e, #d32f2f)', glyph: '🀊' },
    '四槓子':     { gradient: 'linear-gradient(135deg, #37474f, #90a4ae)', glyph: '🀜' },
    '大三元':     { gradient: 'linear-gradient(135deg, #c0392b, #e74c3c)', glyph: '🀄' },
    '大四喜':     { gradient: 'linear-gradient(135deg, #0d47a1, #5472d3)', glyph: '🀁' },
    '小四喜':     { gradient: 'linear-gradient(135deg, #00695c, #4db6ac)', glyph: '🀂' },
    '字一色':     { gradient: 'linear-gradient(135deg, #d4af37, #f7e98e)', glyph: '🀀' },
    '緑一色':     { gradient: 'linear-gradient(135deg, #1b5e20, #66bb6a)', glyph: '🀅' },
    '清老頭':     { gradient: 'linear-gradient(135deg, #455a64, #90a4ae)', glyph: '🀙' },
    '四喜和':     { gradient: 'linear-gradient(135deg, #1565c0, #42a5f5)', glyph: '🀁' }, // 旧データ互換（図鑑からは除外）
    '九蓮宝燈':   { gradient: 'linear-gradient(135deg, #6a1b9a, #ce93d8)', glyph: '🀐' },
    '天和':       { gradient: 'linear-gradient(135deg, #00838f, #80deea)', glyph: '🀆' },
    '地和':       { gradient: 'linear-gradient(135deg, #4e342e, #a1887f)', glyph: '🀫' },
    '数え役満':   { gradient: 'linear-gradient(135deg, #f57c00, #ffb74d)', glyph: '🔢' },
};
const YAKUMAN_DEFAULT_STYLE = { gradient: 'linear-gradient(135deg, #475569, #94a3b8)', glyph: '🀄' };

// Gallery filter state (per page-load)
const galleryState = { player: 'all', type: 'all' };

// Avatar cache: { name -> base64 or null (no avatar) }
const galleryAvatarCache = {};

async function ensureAvatarsLoaded(names) {
    const need = names.filter(n => n && !(n in galleryAvatarCache));
    if (need.length === 0) return;
    await Promise.all(need.map(async (name) => {
        try {
            const v = await window.AppStorage.getUserAvatar(name);
            galleryAvatarCache[name] = v || null;
        } catch (_) {
            galleryAvatarCache[name] = null;
        }
    }));
}

function renderAvatarHtml(name, size) {
    const url = galleryAvatarCache[name];
    const cls = size === 'lg' ? 'gallery-avatar gallery-avatar--lg' : 'gallery-avatar';
    if (url) {
        return `<span class="${cls}"><img src="${escapeHtml(url)}" alt=""></span>`;
    }
    const initial = (name || '?').slice(0, 1);
    return `<span class="${cls}">${escapeHtml(initial)}</span>`;
}

// Full list of yakuman for the dex (matches the datalist in index.html)
const YAKUMAN_DEX_LIST = [
    '国士無双', '四暗刻', '四槓子', '大三元', '大四喜', '小四喜',
    '字一色', '緑一色', '清老頭', '九蓮宝燈', '天和', '地和', '数え役満'
];

function renderYakumanDex(typeCounts) {
    const grid = document.getElementById('gallery-dex-grid');
    const progress = document.getElementById('gallery-dex-progress');
    if (!grid || !progress) return;

    let achieved = 0;
    grid.innerHTML = YAKUMAN_DEX_LIST.map(name => {
        const count = typeCounts[name] || 0;
        const isAch = count > 0;
        if (isAch) achieved++;
        const style = YAKUMAN_STYLE[name] || YAKUMAN_DEFAULT_STYLE;
        return `
            <div class="gallery-dex-cell ${isAch ? '' : 'gallery-dex-cell--locked'}"
                 style="background: ${style.gradient};"
                 data-type="${escapeHtml(name)}" data-achieved="${isAch ? '1' : '0'}">
                <span class="gallery-dex-cell__glyph" aria-hidden="true">${style.glyph}</span>
                <span class="gallery-dex-cell__name">${escapeHtml(name)}</span>
                ${isAch ? `<span class="gallery-dex-cell__count">×${count}</span>` : `<span class="gallery-dex-cell__lock" aria-hidden="true">🔒</span>`}
            </div>
        `;
    }).join('');
    progress.textContent = `${achieved} / ${YAKUMAN_DEX_LIST.length}`;

    // Click: filter gallery by type
    grid.querySelectorAll('.gallery-dex-cell').forEach(cell => {
        cell.addEventListener('click', () => {
            if (cell.dataset.achieved !== '1') return;
            const t = cell.dataset.type;
            galleryState.type = t;
            // Update type chip highlights to match
            document.querySelectorAll('#gallery-filter-types .gallery-chip').forEach(b => {
                b.classList.toggle('is-active', b.dataset.value === t);
            });
            renderGalleryCards(window._galleryAll || []);
            // Scroll list into view
            document.getElementById('gallery-list').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
}

function groupByMonth(yakumans) {
    const groups = {};
    yakumans.forEach(y => {
        const d = new Date(y.timestamp);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!groups[key]) groups[key] = { year: d.getFullYear(), month: d.getMonth() + 1, items: [] };
        groups[key].items.push(y);
    });
    return Object.keys(groups).sort().reverse().map(k => groups[k]);
}

function formatCardDate(timestamp) {
    if (!timestamp) return '';
    const ms = Date.now() - new Date(timestamp).getTime();
    const day = ms / 86400000;
    if (day < 7) return formatRelativeJa(timestamp);
    return new Date(timestamp).toLocaleDateString('ja-JP');
}

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function formatRelativeJa(timestamp) {
    if (!timestamp) return '—';
    const ms = Date.now() - new Date(timestamp).getTime();
    if (!Number.isFinite(ms) || ms < 0) return '—';
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return 'たった今';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}分前`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}時間前`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}日前`;
    if (day < 30) return `${Math.floor(day / 7)}週間前`;
    if (day < 365) return `${Math.floor(day / 30)}ヶ月前`;
    return `${Math.floor(day / 365)}年前`;
}

window.renderGallery = async function () {
    const list = document.getElementById('gallery-list');
    if (!list) return;

    list.innerHTML = '<div style="text-align:center; grid-column: 1/-1;">読み込み中...</div>';
    document.getElementById('gallery-stats').style.display = 'none';
    document.getElementById('gallery-filters').style.display = 'none';

    try {
        const sessions = await window.AppStorage.getSessions();
        const allYakumans = [];
        sessions.forEach(s => {
            (s.games || []).forEach(g => {
                (g.players || []).forEach(p => {
                    if (p.yakuman && Array.isArray(p.yakuman)) {
                        p.yakuman.forEach(y => {
                            if (!y.timestamp) y.timestamp = s.date;
                            allYakumans.push(y);
                        });
                    }
                });
            });
        });
        allYakumans.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        if (allYakumans.length === 0) {
            document.getElementById('gallery-dex').style.display = 'none';
            list.innerHTML = renderGalleryEmpty();
            return;
        }

        // --- Stats ---
        const stats = computeGalleryStats(allYakumans);
        document.getElementById('gallery-stat-total').textContent = stats.total;
        document.getElementById('gallery-stat-achievers').textContent = stats.achievers;
        document.getElementById('gallery-stat-top-type').textContent = stats.topType || '—';
        document.getElementById('gallery-stat-last').textContent = stats.lastRelative;
        document.getElementById('gallery-stats').style.display = '';

        // --- Dex ---
        const typeCounts = {};
        allYakumans.forEach(y => { if (y.type) typeCounts[y.type] = (typeCounts[y.type] || 0) + 1; });
        renderYakumanDex(typeCounts);
        document.getElementById('gallery-dex').style.display = '';

        // --- Avatars ---
        const uniquePlayers = Array.from(new Set(allYakumans.map(y => y.playerName).filter(Boolean)));
        await ensureAvatarsLoaded(uniquePlayers);

        // --- Filters ---
        buildGalleryFilters(allYakumans);
        document.getElementById('gallery-filters').style.display = '';

        // --- Apply filters & render ---
        renderGalleryCards(allYakumans);

    } catch (e) {
        console.error(e);
        list.innerHTML = '<div style="text-align:center; grid-column: 1/-1;">エラーが発生しました</div>';
    }
};

function computeGalleryStats(yakumans) {
    const players = new Set();
    const typeCount = {};
    yakumans.forEach(y => {
        if (y.playerName) players.add(y.playerName);
        if (y.type) typeCount[y.type] = (typeCount[y.type] || 0) + 1;
    });
    let topType = null, topN = 0;
    Object.entries(typeCount).forEach(([t, n]) => {
        if (n > topN) { topType = t; topN = n; }
    });
    const lastTs = yakumans[0] && yakumans[0].timestamp;
    return {
        total: yakumans.length,
        achievers: players.size,
        topType: topType ? `${topType}` : null,
        lastRelative: formatRelativeJa(lastTs)
    };
}

function buildGalleryFilters(yakumans) {
    const deviceUser = localStorage.getItem('deviceUser');

    // Count occurrences for chip labels
    const playerCounts = {};
    const typeCounts = {};
    yakumans.forEach(y => {
        if (y.playerName) playerCounts[y.playerName] = (playerCounts[y.playerName] || 0) + 1;
        if (y.type) typeCounts[y.type] = (typeCounts[y.type] || 0) + 1;
    });

    // Player chips: すべて → 自分 → 他プレイヤー（達成回数降順）
    const playersWrap = document.getElementById('gallery-filter-players');
    const playerChips = [];
    playerChips.push({ value: 'all', label: 'すべて', count: yakumans.length });
    if (deviceUser && playerCounts[deviceUser]) {
        playerChips.push({ value: deviceUser, label: `自分（${deviceUser}）`, count: playerCounts[deviceUser] });
    }
    Object.entries(playerCounts)
        .filter(([name]) => name !== deviceUser)
        .sort(([, a], [, b]) => b - a)
        .forEach(([name, n]) => playerChips.push({ value: name, label: name, count: n }));

    playersWrap.innerHTML = playerChips.map(c => `
        <button type="button" class="gallery-chip${galleryState.player === c.value ? ' is-active' : ''}"
            data-filter="player" data-value="${escapeHtml(c.value)}">
            ${escapeHtml(c.label)}<span class="gallery-chip__count">${c.count}</span>
        </button>
    `).join('');

    // Type chips: すべて → 達成回数降順
    const typesWrap = document.getElementById('gallery-filter-types');
    const typeChips = [{ value: 'all', label: 'すべて', count: yakumans.length }];
    Object.entries(typeCounts)
        .sort(([, a], [, b]) => b - a)
        .forEach(([t, n]) => typeChips.push({ value: t, label: t, count: n }));

    typesWrap.innerHTML = typeChips.map(c => `
        <button type="button" class="gallery-chip${galleryState.type === c.value ? ' is-active' : ''}"
            data-filter="type" data-value="${escapeHtml(c.value)}">
            ${escapeHtml(c.label)}<span class="gallery-chip__count">${c.count}</span>
        </button>
    `).join('');

    // Wire up clicks (delegated once per render is fine since we replace innerHTML)
    [playersWrap, typesWrap].forEach(wrap => {
        wrap.querySelectorAll('.gallery-chip').forEach(btn => {
            btn.addEventListener('click', () => {
                const k = btn.dataset.filter;
                galleryState[k] = btn.dataset.value;
                wrap.querySelectorAll('.gallery-chip').forEach(b => b.classList.toggle('is-active', b === btn));
                // Re-render cards only
                renderGalleryCards(window._galleryAll || []);
            });
        });
    });

    // Cache for re-render
    window._galleryAll = yakumans;
}

function buildGalleryCard(y) {
    const dateStr = formatCardDate(y.timestamp);
    const rawImage = y.imageUrl || y.imagePath || null;
    const displayImage = (rawImage && (rawImage.startsWith('data:') || rawImage.startsWith('http'))) ? rawImage : null;
    const style = YAKUMAN_STYLE[y.type] || YAKUMAN_DEFAULT_STYLE;

    const card = document.createElement('div');
    card.className = 'gallery-card';

    let mediaHtml;
    if (displayImage) {
        const escapedUrl = escapeHtml(displayImage).replace(/'/g, '%27');
        mediaHtml = `<div class="gallery-card__media" style="background-image: url('${escapedUrl}');"></div>`;
    } else {
        mediaHtml = `<div class="gallery-card__media gallery-card__media--placeholder" style="background: ${style.gradient};">
            <span class="gallery-card__placeholder-shine" aria-hidden="true"></span>
            <span class="gallery-card__placeholder-glyph" aria-hidden="true">${style.glyph}</span>
        </div>`;
    }

    card.innerHTML = `
        ${mediaHtml}
        <div class="gallery-card__body">
            <div class="gallery-card__date">${escapeHtml(dateStr)}</div>
            <div class="gallery-card__type">${escapeHtml(y.type || '')}</div>
            <div class="gallery-card__player-row">
                ${renderAvatarHtml(y.playerName)}
                <span class="gallery-card__player">${escapeHtml(y.playerName || '')}</span>
            </div>
            ${y.comment ? `<div class="gallery-card__comment">${escapeHtml(y.comment)}</div>` : ''}
        </div>
    `;

    // Whole card is clickable to open detail
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => openYakumanDetail(y));

    return card;
}

function renderGalleryCards(yakumans) {
    const list = document.getElementById('gallery-list');
    if (!list) return;

    const filtered = yakumans.filter(y => {
        if (galleryState.player !== 'all' && y.playerName !== galleryState.player) return false;
        if (galleryState.type !== 'all' && y.type !== galleryState.type) return false;
        return true;
    });

    if (filtered.length === 0) {
        list.innerHTML = `<div style="grid-column:1/-1; padding: 30px; text-align:center; color: var(--text-secondary); border: 1px dashed rgba(255,255,255,0.1); border-radius: 12px;">
            この絞り込みに該当する記録はありません
        </div>`;
        return;
    }

    list.innerHTML = '';
    const months = groupByMonth(filtered);
    months.forEach(group => {
        const wrap = document.createElement('div');
        wrap.className = 'gallery-month-group';
        const header = document.createElement('div');
        header.className = 'gallery-month-group__header';
        header.innerHTML = `<span>${group.year}年${group.month}月</span><span class="gallery-month-group__count">${group.items.length}件</span>`;
        const grid = document.createElement('div');
        grid.className = 'gallery-month-group__grid';
        group.items.forEach(y => grid.appendChild(buildGalleryCard(y)));
        wrap.appendChild(header);
        wrap.appendChild(grid);
        list.appendChild(wrap);
    });
}

// --- Yakuman Detail Modal ---
function openYakumanDetail(y) {
    const modal = document.getElementById('yakuman-detail-modal');
    if (!modal) return;

    const rawImage = y.imageUrl || y.imagePath || null;
    const displayImage = (rawImage && (rawImage.startsWith('data:') || rawImage.startsWith('http'))) ? rawImage : null;
    const style = YAKUMAN_STYLE[y.type] || YAKUMAN_DEFAULT_STYLE;

    const hero = document.getElementById('yakuman-detail-hero');
    if (displayImage) {
        hero.className = 'yakuman-detail__hero';
        hero.style.background = `#000 url('${escapeHtml(displayImage).replace(/'/g, '%27')}') center/cover no-repeat`;
        hero.innerHTML = '';
    } else {
        hero.className = 'yakuman-detail__hero yakuman-detail__hero--placeholder';
        hero.style.background = style.gradient;
        hero.innerHTML = `<span class="yakuman-detail__hero-glyph">${style.glyph}</span>`;
    }

    document.getElementById('yakuman-detail-type').textContent = y.type || '';
    document.getElementById('yakuman-detail-avatar').innerHTML = renderAvatarHtml(y.playerName, 'lg');
    document.getElementById('yakuman-detail-player').textContent = y.playerName || '';

    const dateEl = document.getElementById('yakuman-detail-date');
    if (y.timestamp) {
        const full = new Date(y.timestamp).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
        const rel = formatRelativeJa(y.timestamp);
        dateEl.textContent = `${full}（${rel}）`;
    } else {
        dateEl.textContent = '';
    }

    document.getElementById('yakuman-detail-comment').textContent = y.comment || '';

    modal.style.display = 'flex';
}

function closeYakumanDetail() {
    const modal = document.getElementById('yakuman-detail-modal');
    if (modal) modal.style.display = 'none';
}

const yakumanDetailCloseBtn = document.getElementById('yakuman-detail-close');
if (yakumanDetailCloseBtn) {
    yakumanDetailCloseBtn.addEventListener('click', closeYakumanDetail);
}
const yakumanDetailModal = document.getElementById('yakuman-detail-modal');
if (yakumanDetailModal) {
    yakumanDetailModal.addEventListener('click', (e) => {
        if (e.target === yakumanDetailModal) closeYakumanDetail();
    });
}

function renderGalleryEmpty() {
    return `
        <div class="gallery-empty">
            <div class="gallery-empty__art" aria-hidden="true">🌸</div>
            <div class="gallery-empty__title">役満の記録はまだありません</div>
            <div class="gallery-empty__sub">対局中に役満が出たら、達成の瞬間を写真とともに残しておきましょう。</div>
            <div class="gallery-empty__steps">
                <div class="gallery-empty__step"><span class="gallery-empty__step-num">1</span>セット詳細を開く</div>
                <div class="gallery-empty__step"><span class="gallery-empty__step-num">2</span>「🌸 役満達成」ボタンをタップ</div>
                <div class="gallery-empty__step"><span class="gallery-empty__step-num">3</span>達成者・役満種類・写真を登録</div>
            </div>
        </div>
    `;
}
