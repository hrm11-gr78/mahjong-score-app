// Imports are handled by loaded scripts. window.AppStorage is async.

// --- DOM Elements (Global) ---
const navButtons = document.querySelectorAll('nav button');
const sections = document.querySelectorAll('section');
const userSelects = document.querySelectorAll('.user-select');

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
async function init() {
    // 1. Synchronous Setup (Immediate)
    // Set default date to today
    if (sessionDateInput) {
        sessionDateInput.valueAsDate = new Date();
    }

    // Setup UI interactivity immediately
    setupScoreValidation();

    // Trigger initial navigation to set UI state
    navigateTo('home');

    // 2. Asynchronous Data Loading
    try {
        // Load data in parallel where possible or sequentially if needed
        await Promise.all([
            renderUserOptions(),
            renderUserList(),
            renderSessionList(),
            loadSettingsToForm(),
            loadNewSetFormDefaults()
        ]);

        // Initialize Roulette after base data, if on roulette page or needed
        if (rouletteCanvas) {
            await initRoulette();
        }
    } catch (e) {
        console.error("Initialization / Data Loading Failed:", e);
        // Do not alert here to avoid annoying popups if offline or slight delay
        // Maybe show a "Connection Error" toast if strictly needed.
    }
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
        if (s.id === targetId) {
            s.classList.add('active');
        }
    });

    // Toggle Header Settings Button Visibility
    const settingsBtn = document.getElementById('header-settings-btn');
    if (settingsBtn) {
        // Show on main tabs (Home, Users, Roulette)
        const mainTabs = ['home', 'users', 'roulette'];
        if (mainTabs.includes(targetId)) {
            settingsBtn.style.display = 'block';
        } else {
            settingsBtn.style.display = 'none';
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
const saveProfileUserBtn = document.getElementById('save-profile-user');

if (headerProfileBtn) {
    headerProfileBtn.addEventListener('click', async () => {
        // Populate select with latest users
        await renderUserOptions();

        // Load current device user
        const savedDeviceUser = localStorage.getItem('deviceUser');
        if (profileUserSelect && savedDeviceUser) {
            profileUserSelect.value = savedDeviceUser;
        }

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

if (saveProfileUserBtn) {
    saveProfileUserBtn.addEventListener('click', async () => {
        try {
            if (profileUserSelect) {
                const selectedUser = profileUserSelect.value;
                if (selectedUser) {
                    localStorage.setItem('deviceUser', selectedUser);
                } else {
                    localStorage.removeItem('deviceUser');
                }

                // Refresh UI (Don't block modal closing if these fail)
                Promise.all([
                    renderUserList(),
                    renderSessionList()
                ]).catch(err => console.error("UI Refresh Failed:", err));

                updateActionRestrictions();
            }
        } catch (e) {
            console.error("Save Profile Failed:", e);
        } finally {
            if (userProfileModal) {
                userProfileModal.style.display = 'none';
            }
            alert('ユーザー設定を保存しました。');
        }
    });
}

// --- User Management ---
async function renderUserOptions() {
    const users = await window.AppStorage.getUsers();

    // Update all user-select dropdowns (Game Setup & Settings)
    // We target .user-select class.
    const selects = document.querySelectorAll('.user-select');

    selects.forEach(select => {
        const currentVal = select.value;
        const isProfileUserSelect = select.id === 'profile-user-select';

        // Reset options
        if (isProfileUserSelect) {
            select.innerHTML = '<option value="">(未選択)</option>';
        } else {
            select.innerHTML = '<option value="" disabled selected>選択...</option>';
        }

        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user;
            option.textContent = user;
            select.appendChild(option);
        });

        // Restore value if still valid
        if (currentVal && users.includes(currentVal)) {
            select.value = currentVal;
        }
    });

    // Special handling for Device User Select restoration from localStorage
    const deviceUserSelect = document.getElementById('device-user-select');
    if (deviceUserSelect) {
        const savedDeviceUser = localStorage.getItem('deviceUser');
        if (savedDeviceUser && users.includes(savedDeviceUser)) {
            deviceUserSelect.value = savedDeviceUser;
        }
    }
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

async function renderUserList() {
    if (!userList) return;
    const users = await window.AppStorage.getUsers();

    // Get Device User
    const deviceUser = localStorage.getItem('deviceUser');

    userList.innerHTML = '';
    users.forEach(user => {
        const li = document.createElement('li');

        let deleteBtnHtml = '';

        // Show delete button ONLY IF:
        // 1. A device user IS set
        // AND
        // (The listed user IS the device user OR the device user is "ヒロム")
        if (deviceUser && (deviceUser === user || deviceUser === 'ヒロム')) {
            deleteBtnHtml = `<button class="btn-danger" data-user="${user}">削除</button>`;
        } else {
            deleteBtnHtml = ``;
        }

        li.innerHTML = `
            <span class="user-name-link" style="cursor:pointer; text-decoration:underline;">${user}</span>
            ${deleteBtnHtml}
        `;
        li.querySelector('.user-name-link').addEventListener('click', () => openUserDetail(user));
        userList.appendChild(li);
    });

    document.querySelectorAll('.btn-danger').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const user = e.target.dataset.user;
            // Double check logic (though UI hidden is first line of defense)
            const currentDeviceUser = localStorage.getItem('deviceUser');
            // Admin "ヒロム" can delete anyone
            if (currentDeviceUser && currentDeviceUser !== user && currentDeviceUser !== 'ヒロム') {
                alert("他のユーザーを削除する権限がありません。\n設定画面で「この端末のユーザー」を確認してください。");
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

async function openUserDetail(userName) {
    userDetailName.textContent = userName;
    await renderUserDetail(userName);
    navigateTo('user-detail');
}

window.openUserDetail = openUserDetail;

async function renderUserDetail(userName) {
    const sessions = await window.AppStorage.getSessions();
    // Filter sessions where user participated
    const userSessions = sessions.filter(s => s.players.includes(userName));

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
        const isParticipantOrAdmin = currentDeviceUser === 'ヒロム' || (Array.isArray(session.players) && session.players.includes(currentDeviceUser));

        const rowStyle = isParticipantOrAdmin ? 'style="cursor:pointer;"' : '';
        const rowAction = isParticipantOrAdmin ? `onclick="openSession(${session.id})"` : '';

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

    // Calculate cumulative amount (収支)
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
                <div style="font-size: 1rem; color: #e2e8f0; margin-bottom: 16px; letter-spacing: 1px; text-transform: uppercase; font-weight: 600; padding: 8px 20px; border: 2px solid rgba(226, 232, 240, 0.3); border-radius: 20px; display: inline-block;">
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
    if (totalGames > 0) {
        const sumRanks = (totalRankCounts[0] * 1) + (totalRankCounts[1] * 2) + (totalRankCounts[2] * 3) + (totalRankCounts[3] * 4);
        averageRank = (sumRanks / totalGames).toFixed(2);
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
        statsElement.innerHTML = `
            <div style="display: flex; justify-content: space-around; width: 100%; max-width: 400px; margin: 0 auto;">
                <div style="text-align: center;">
                    <div style="font-size: 0.9rem; margin-bottom: 5px;">1着</div>
                    <div style="font-size: 1.5rem; font-weight: bold;">${totalRankCounts[0]}</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 0.9rem; margin-bottom: 5px;">2着</div>
                    <div style="font-size: 1.5rem; font-weight: bold;">${totalRankCounts[1]}</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 0.9rem; margin-bottom: 5px;">3着</div>
                    <div style="font-size: 1.5rem; font-weight: bold;">${totalRankCounts[2]}</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 0.9rem margin-bottom: 5px;">4着</div>
                    <div style="font-size: 1.5rem; font-weight: bold;">${totalRankCounts[3]}</div>
                </div>
            </div>
            <div style="margin-top: 15px; font-size: 1.2rem; display: flex; justify-content: center; align-items: center; gap: 20px;">
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

        // Show delete button ONLY if admin AND NOT LOCKED
        const showDelete = localStorage.getItem('deviceUser') === 'ヒロム' && !isLocked;

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
    if (sessionRateSelect) sessionRateSelect.value = session.rate || 0;

    await renderSessionTotal(session);
    renderScoreChart(session);
    renderGameList(session);
    navigateTo('session-detail');
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
                    <td>${p.name}</td>
                    <td>${p.rawScore}</td>
                    <td class="${scoreClass}">${scoreStr}</td>
                </tr>
             `;
        });

        card.innerHTML = `
            <div class="history-header">
                <span>Game ${session.games.length - index}</span>
                <div>
                    ${localStorage.getItem('deviceUser') === 'ヒロム'
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

async function prepareInputForm(gameToEdit = null) {
    // Reset form immediately to prevent old data from showing
    scoreForm.reset();

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
        for (let i = 0; i < 4; i++) {
            const pName = session.players[i];
            const pData = gameToEdit.players.find(p => p.name === pName);
            if (pData) {
                // pData.rawScore might be e.g. 25000
                const scoreInput = document.querySelector(`input[name="p${i + 1}-score"]`);
                if (scoreInput) {
                    // Display as 250 because suffix is 00
                    scoreInput.value = Math.floor(pData.rawScore / 100);
                }
            }
        }
    }
}

// Real-time validation
scoreInputs.forEach(input => {
    input.addEventListener('input', validateScoreInput);
});

function validateScoreInput() {
    let currentTotal = 0;
    scoreInputs.forEach(input => {
        if (input.value) {
            currentTotal += Number(input.value) * 100;
        }
    });

    const difference = currentTotal - 100000;
    let displayText = `合計: ${currentTotal.toLocaleString()}`;

    if (difference !== 0) {
        const absDiff = Math.abs(difference);
        const diffStr = difference > 0 ? `+${absDiff.toLocaleString()}` : `-${absDiff.toLocaleString()}`;
        displayText += ` (${diffStr})`;
    }

    totalCheck.textContent = displayText;

    if (currentTotal === 100000) {
        totalCheck.className = "total-check valid";
        return true;
    } else {
        totalCheck.className = "total-check invalid";
        return false;
    }
}

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
if (scoreForm) {
    scoreForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!validateScoreInput()) {
            alert('合計点が100,000点ではありません。\n正しい点数を入力してください。');
            return;
        }

        const session = await window.AppStorage.getSession(currentSessionId);
        if (!session) return;

        // 1. Gather Inputs
        const playerData = [];
        for (let i = 1; i <= 4; i++) {
            const name = document.getElementById(`inp-p${i}-name`).value;
            const rawInput = document.querySelector(`input[name="p${i}-score"]`).value;
            const score = Number(rawInput) * 100;
            playerData.push({ name, score });
        }

        // 2. Calculate Result
        const scores = playerData.map(p => p.score);
        const result = window.Mahjong.calculateResult(scores, session.rules);

        // 3. Handle Tie-Breaker if needed
        if (result.needsTieBreaker) {
            // Show modal for tie-breaking
            pendingGameData = { playerData, session, result };
            showTieBreakerModal(result.tiedGroups, playerData);
            return;
        }

        // 4. Map results back to player names and save
        const players = result.map((playerResult, index) => ({
            name: playerData[index].name,
            rawScore: playerResult.rawScore,
            rank: playerResult.rank,
            finalScore: playerResult.finalScore
        }));

        await saveGameResult({ players });
    });
}

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

