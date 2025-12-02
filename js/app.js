// Remove imports, use globals
const { calculateResult, validateTotal } = window.Mahjong;
const { getUsers, addUser, removeUser, getSessions, createSession, getSession, addGameToSession, updateGameInSession, removeSession, removeGameFromSession, getSettings, saveSettings } = window.AppStorage;

// --- DOM Elements ---
const navButtons = document.querySelectorAll('nav button');
const sections = document.querySelectorAll('section');
const userSelects = document.querySelectorAll('.user-select');

// Session Setup
const sessionSetupForm = document.getElementById('session-setup-form');
const sessionDateInput = document.getElementById('session-date');
const sessionList = document.getElementById('session-list');

// Session Detail
const sessionTitle = document.getElementById('session-title');
const sessionTotalTable = document.getElementById('session-total-table');
const gameList = document.getElementById('game-list');
const newGameBtn = document.getElementById('new-game-btn');
const backToHomeBtn = document.getElementById('back-to-home');

// Input
const scoreForm = document.getElementById('score-form');
const scoreInputs = document.querySelectorAll('input[type="number"]');
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

// State
let currentSessionId = null;
let editingGameId = null; // ID of the game being edited
let pendingGameData = null; // Store data while waiting for tie-breaker

// --- Initialization ---
function init() {
    // Set default date to today
    sessionDateInput.valueAsDate = new Date();

    renderUserOptions();
    renderUserList();
    renderSessionList();
    setupNavigation();
    setupScoreValidation();
    loadSettingsToForm();
    loadNewSetFormDefaults();
}

function loadNewSetFormDefaults() {
    const settings = getSettings();
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
}

// --- Navigation ---
function setupNavigation() {
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            navigateTo(targetId);
        });
    });

    backToHomeBtn.addEventListener('click', () => {
        navigateTo('home');
        renderSessionList(); // Refresh list
    });

    newGameBtn.addEventListener('click', () => {
        editingGameId = null; // Reset edit mode
        navigateTo('input');
        prepareInputForm();
    });

    cancelInputBtn.addEventListener('click', () => {
        editingGameId = null; // Reset edit mode
        navigateTo('session-detail');
    });
}

function navigateTo(targetId) {
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
}

// --- User Management ---
function renderUserOptions() {
    const users = getUsers();
    userSelects.forEach(select => {
        const currentVal = select.value;
        select.innerHTML = '<option value="" disabled selected>選択...</option>';
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user;
            option.textContent = user;
            select.appendChild(option);
        });
        if (currentVal && users.includes(currentVal)) {
            select.value = currentVal;
        }
    });
}

function renderUserList() {
    const users = getUsers();
    userList.innerHTML = '';
    users.forEach(user => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="user-name-link" style="cursor:pointer; text-decoration:underline;">${user}</span>
            <button class="btn-danger" data-user="${user}">削除</button>
        `;
        li.querySelector('.user-name-link').addEventListener('click', () => openUserDetail(user));
        userList.appendChild(li);
    });

    document.querySelectorAll('.btn-danger').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const user = e.target.dataset.user;
            if (confirm(`ユーザー "${user}" を削除しますか？`)) {
                removeUser(user);
                renderUserOptions();
                renderUserList();
            }
        });
    });
}

// --- User Detail ---
const userDetailName = document.getElementById('user-detail-name');
const userTotalScore = document.getElementById('user-total-score');
const userHistoryList = document.getElementById('user-history-list');
const backToUsersBtn = document.getElementById('back-to-users');

backToUsersBtn.addEventListener('click', () => {
    navigateTo('users');
});

function openUserDetail(userName) {
    userDetailName.textContent = userName;
    renderUserDetail(userName);
    navigateTo('user-detail');
}

function renderUserDetail(userName) {
    const sessions = getSessions();
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
        const scoreClass = sessionScore >= 0 ? 'score-positive' : 'score-negative';
        const scoreStr = sessionScore > 0 ? `+${sessionScore}` : `${sessionScore}`;

        html += `
            <tr style="cursor:pointer;" onclick="openSession(${session.id})">
                <td>${session.date}</td>
                <td class="${scoreClass}">${scoreStr}</td>
            </tr>
        `;
    });

    // Apply basic score display
    userTotalScore.textContent = totalScore > 0 ? `+${totalScore}` : `${totalScore}`;
    userTotalScore.className = totalScore >= 0 ? 'score-positive' : 'score-negative';

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

    userHistoryList.innerHTML = html;
}

addUserBtn.addEventListener('click', () => {
    const name = newUserNameInput.value.trim();
    if (name) {
        // Check limit
        const currentUsers = getUsers();
        if (currentUsers.length >= 30) {
            alert('ユーザー登録数の上限（30名）に達しました。');
            return;
        }

        if (addUser(name)) {
            newUserNameInput.value = '';
            renderUserOptions();
            renderUserList();
            alert(`ユーザー "${name}" を追加しました！`);
        } else {
            alert('そのユーザーは既に存在します！');
        }
    }
});

// --- Session Management ---

sessionSetupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(sessionSetupForm);
    const date = formData.get('date') || sessionDateInput.value;
    const players = [
        formData.get('p1'),
        formData.get('p2'),
        formData.get('p3'),
        formData.get('p4')
    ];

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

    const session = createSession(date, players, rules);
    openSession(session.id);
});

function renderSessionList() {
    const sessions = getSessions();
    sessionList.innerHTML = '';
    if (sessions.length === 0) {
        sessionList.innerHTML = '<p class="text-center" style="color: var(--text-secondary)">セット履歴がありません。</p>';
        return;
    }

    sessions.forEach(session => {
        const div = document.createElement('div');
        div.className = 'history-card';
        div.style.cursor = 'pointer';
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong>${session.date}</strong>
                <div>
                    <span style="margin-right: 10px;">${session.games.length} 対局</span>
                    <button class="btn-danger btn-sm delete-session-btn" data-id="${session.id}" style="padding: 2px 8px; font-size: 0.8rem;">削除</button>
                </div>
            </div>
            <div style="font-size:0.9rem; color:var(--text-secondary); margin-top:4px;">
                ${session.players.join(', ')}
            </div>
        `;

        // Card click for navigation
        div.addEventListener('click', (e) => {
            // Prevent navigation if delete button was clicked
            if (!e.target.classList.contains('delete-session-btn')) {
                openSession(session.id);
            }
        });

        // Delete button click
        div.querySelector('.delete-session-btn').addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent card click
            if (confirm('このセットを削除しますか？\nこの操作は取り消せません。')) {
                removeSession(session.id);
                renderSessionList();
            }
        });

        sessionList.appendChild(div);
    });
}

window.openSession = openSession;

function openSession(sessionId) {
    currentSessionId = sessionId;
    const session = getSession(sessionId);
    if (!session) return;

    sessionTitle.textContent = `${session.date}`;

    renderSessionTotal(session);
    renderScoreChart(session);
    renderGameList(session);
    navigateTo('session-detail');
}

function renderSessionTotal(session) {
    // Calculate totals
    const totals = {};
    session.players.forEach(p => totals[p] = 0);

    session.games.forEach(game => {
        game.players.forEach(p => {
            totals[p.name] += p.finalScore;
        });
    });

    // Sort by total score
    const sortedPlayers = session.players.slice().sort((a, b) => totals[b] - totals[a]);

    let html = `<thead><tr><th>順位</th><th>名前</th><th>合計Pt</th></tr></thead><tbody>`;
    sortedPlayers.forEach((p, i) => {
        const score = parseFloat(totals[p].toFixed(1));
        const scoreClass = score >= 0 ? 'score-positive' : 'score-negative';
        const scoreStr = score > 0 ? `+${score}` : `${score}`;
        html += `
            <tr>
                <td>${i + 1}</td>
                <td>${p}</td>
                <td class="${scoreClass}" style="font-weight:bold;">${scoreStr}</td>
            </tr>
        `;
    });
    html += `</tbody>`;
    sessionTotalTable.innerHTML = html;
}

let scoreChart = null;

function renderScoreChart(session) {
    const ctx = document.getElementById('score-chart').getContext('2d');

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

function renderGameList(session) {
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
                    <button class="btn-secondary btn-sm edit-game-btn" data-id="${game.id}" style="padding: 2px 8px; font-size: 0.8rem; margin-right: 5px;">修正</button>
                    <button class="btn-danger btn-sm delete-game-btn" data-id="${game.id}" style="padding: 2px 8px; font-size: 0.8rem;">削除</button>
                </div>
            </div>
            <table class="history-table">
                <thead>
                    <tr>
                        <th width="10%">#</th>
                        <th width="40%">名前</th>
                        <th width="25%">素点</th>
                        <th width="25%">Pt</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        `;

        card.querySelector('.edit-game-btn').addEventListener('click', () => {
            editingGameId = game.id;
            navigateTo('input');
            prepareInputForm(game);
        });

        card.querySelector('.delete-game-btn').addEventListener('click', () => {
            if (confirm('この対局結果を削除しますか？')) {
                removeGameFromSession(session.id, game.id);
                // Refresh session view
                openSession(session.id);
            }
        });

        gameList.appendChild(card);
    });
}

// --- Score Input ---

function prepareInputForm(gameToEdit = null) {
    const session = getSession(currentSessionId);
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
    scoreForm.reset();

    if (gameToEdit) {
        // Populate with existing scores
        for (let i = 0; i < 4; i++) {
            const pName = session.players[i];
            const pData = gameToEdit.players.find(p => p.name === pName);
            if (pData) {
                // rawScore is 25000 -> input 250
                const inputVal = pData.rawScore / 100;
                const input = document.querySelector(`input[name="p${i + 1}-score"]`);
                if (input) input.value = inputVal;
            }
        }
    }

    // Calculate total
    calculateTotal();
}

function setupScoreValidation() {
    scoreInputs.forEach(input => {
        input.addEventListener('input', calculateTotal);
    });
}

function calculateTotal() {
    let total = 0;
    scoreInputs.forEach(input => {
        // Only count inputs inside the score form
        if (scoreForm.contains(input)) {
            // Multiply by 100 because input is "250" -> "25000"
            const val = Number(input.value) || 0;
            total += val * 100;
        }
    });

    totalCheck.textContent = `合計: ${total}`;
    if (total === 100000) {
        totalCheck.className = 'total-check valid';
        totalCheck.textContent += ' (OK)';
        return true;
    } else {
        totalCheck.className = 'total-check invalid';
        totalCheck.textContent += ' (100,000点である必要があります)';
        return false;
    }
}

scoreForm.addEventListener('submit', (e) => {
    e.preventDefault();

    if (!calculateTotal()) {
        if (!confirm("合計点が100,000点ではありません。続行しますか？")) {
            return;
        }
    }

    const formData = new FormData(scoreForm);
    const rawScores = [];
    const playerNames = [];

    for (let i = 1; i <= 4; i++) {
        const name = formData.get(`p${i}-name`); // Hidden input
        const inputVal = Number(formData.get(`p${i}-score`));
        const score = inputVal * 100; // Convert 250 -> 25000

        playerNames.push(name);
        rawScores.push(score);
    }

    // Get session rules
    const session = getSession(currentSessionId);
    // Fallback to global settings if session has no rules (legacy)
    const settings = session.rules || getSettings();

    // Initial calculation (no priority map)
    const results = calculateResult(rawScores, settings);

    if (results.needsTieBreaker) {
        // Handle Tie Breaker
        pendingGameData = { rawScores, playerNames, settings };
        showTieBreakerModal(results.tiedGroups, playerNames);
    } else {
        // Success
        finalizeGame(results, playerNames);
    }
});

function showTieBreakerModal(tiedGroups, playerNames) {
    // For now, handle the first group only (rare to have multiple tie groups)
    // If multiple groups exist, we could handle them sequentially, but let's assume one for simplicity or just handle the first one recursively.
    // Actually, let's just handle the first group found.
    const group = tiedGroups[0]; // Array of indices [0, 1]

    tieBreakerOptions.innerHTML = '';
    group.forEach(index => {
        const btn = document.createElement('button');
        btn.textContent = playerNames[index];
        btn.onclick = () => resolveTie(group, index);
        tieBreakerOptions.appendChild(btn);
    });

    tieBreakerModal.style.display = 'flex';
}

function resolveTie(group, winnerIndex) {
    // Create priority map
    // Winner gets 1, others get 0 (or -1). 
    // Since we only resolve one winner from the group, if there are 3 tied, we might need more logic.
    // But usually it's 2 people. 
    // If 3 people tie, picking one as "top" leaves 2 tied. 
    // Simpler approach: Just give the selected one +1 priority.

    const priorityMap = pendingGameData.priorityMap || {};
    priorityMap[winnerIndex] = (priorityMap[winnerIndex] || 0) + 1;

    pendingGameData.priorityMap = priorityMap;

    // Re-calculate
    const results = calculateResult(pendingGameData.rawScores, pendingGameData.settings, priorityMap);

    if (results.needsTieBreaker) {
        // Still tied (e.g. 3 people tied, picked 1st, now 2nd/3rd are tied)
        showTieBreakerModal(results.tiedGroups, pendingGameData.playerNames);
    } else {
        tieBreakerModal.style.display = 'none';
        finalizeGame(results, pendingGameData.playerNames);
        pendingGameData = null;
    }
}

function finalizeGame(results, playerNames) {
    const gamePlayers = results.map(r => ({
        ...r,
        name: playerNames[r.index]
    }));

    const gameData = {
        id: editingGameId || Date.now(), // Use existing ID if editing
        players: gamePlayers
    };

    if (editingGameId) {
        updateGameInSession(currentSessionId, editingGameId, gameData);
        editingGameId = null; // Reset
        alert("対局結果を修正しました。");
    } else {
        addGameToSession(currentSessionId, gameData);
    }

    // Return to detail
    openSession(currentSessionId);
}

// --- Settings ---

function loadSettingsToForm() {
    const settings = getSettings();
    document.getElementById('set-start').value = settings.startScore;
    document.getElementById('set-return').value = settings.returnScore;
    document.getElementById('set-uma1').value = settings.uma[0];
    document.getElementById('set-uma2').value = settings.uma[1];
    document.getElementById('set-uma3').value = settings.uma[2];
    document.getElementById('set-uma4').value = settings.uma[3];

    // Radio buttons
    const radios = document.getElementsByName('tieBreaker');
    radios.forEach(r => {
        if (r.value === settings.tieBreaker) r.checked = true;
    });
}

settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const tieBreakerVal = document.querySelector('input[name="tieBreaker"]:checked').value;

    const settings = {
        startScore: Number(document.getElementById('set-start').value),
        returnScore: Number(document.getElementById('set-return').value),
        uma: [
            Number(document.getElementById('set-uma1').value),
            Number(document.getElementById('set-uma2').value),
            Number(document.getElementById('set-uma3').value),
            Number(document.getElementById('set-uma4').value)
        ],
        tieBreaker: tieBreakerVal
    };
    saveSettings(settings);
    alert('設定を保存しました。');
});

resetSettingsBtn.addEventListener('click', () => {
    if (confirm('設定を初期値に戻しますか？')) {
        const defaultSettings = {
            startScore: 25000,
            returnScore: 30000,
            uma: [30, 10, -10, -30],
            tieBreaker: 'priority'
        };
        saveSettings(defaultSettings);
        loadSettingsToForm();
        alert('設定を初期化しました。');
    }
});

// Start
init();
