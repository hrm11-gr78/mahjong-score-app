// Remove imports, use globals
const { calculateResult, validateTotal } = window.Mahjong;
const { getUsers, addUser, removeUser, getSessions, createSession, getSession, addGameToSession, updateGameInSession, updateSession, removeSession, removeGameFromSession, getSettings, saveSettings } = window.AppStorage;

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
const sessionRateSelect = document.getElementById('session-rate');
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

    // Trigger initial navigation to set UI state (e.g. settings button visibility)
    navigateTo('home');
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

    sessionRateSelect.addEventListener('change', (e) => {
        const newRate = Number(e.target.value);
        if (currentSessionId) {
            updateSession(currentSessionId, { rate: newRate });
            const session = getSession(currentSessionId);
            renderSessionTotal(session);
        }
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
}

// --- DOM Elements ---
const headerSettingsBtn = document.getElementById('header-settings-btn');
if (headerSettingsBtn) {
    headerSettingsBtn.addEventListener('click', () => {
        navigateTo('settings');
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

window.openUserDetail = openUserDetail;

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

        html += `
            <tr style="cursor:pointer;" onclick="openSession(${session.id})">
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
    if (!amountElement) {
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
            const amountStr = totalAmount > 0 ? `+${totalAmount}` : `${totalAmount}`;
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
    if (!statsElement) {
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
            <div style="margin-top: 15px; font-size: 1.2rem;">
                <span style="color: #e2e8f0; margin-right: 10px;">平均順位:</span>
                <span style="font-weight: 800; font-size: 1.8rem;">${averageRank}</span>
            </div>
        `;
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
    sessionRateSelect.value = session.rate || 0;

    renderSessionTotal(session);
    renderScoreChart(session);
    renderGameList(session);
    navigateTo('session-detail');
}

function renderSessionTotal(session) {
    // Calculate totals and rank counts
    const totals = {};
    const rankCounts = {}; // { playerName: [1st, 2nd, 3rd, 4th] }

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

        html += `
            <tr>
                <td>${i + 1}</td>
                <td><span style="cursor:pointer; text-decoration:underline;" onclick="openUserDetail('${p}')">${p}</span></td>
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
                        <th width="25%">最終持ち点</th>
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

// ====== ROULETTE FUNCTIONALITY ======

// Roulette DOM Elements
const rouletteCanvas = document.getElementById('roulette-canvas');
const rouletteCtx = rouletteCanvas ? rouletteCanvas.getContext('2d') : null;
const spinBtn = document.getElementById('spin-btn');
const rouletteResult = document.getElementById('roulette-result');
const rouletteInput = document.getElementById('roulette-input');
const addRouletteItemBtn = document.getElementById('add-roulette-item');
const rouletteList = document.getElementById('roulette-list');

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

// Initialize roulette if on roulette page
function initRoulette() {
    if (!rouletteCanvas) return;

    // Load saved items from localStorage
    const saved = localStorage.getItem('rouletteItems');
    if (saved) {
        try {
            rouletteItems = JSON.parse(saved);
        } catch (e) {
            rouletteItems = [];
        }
    }

    // Set default items if empty
    if (rouletteItems.length === 0) {
        rouletteItems = ['1', '2', '3', '4', '5', '6', '7'];
        saveRouletteItems();
    }

    renderRouletteList();
    drawRoulette();
}

// Save items to localStorage
function saveRouletteItems() {
    localStorage.setItem('rouletteItems', JSON.stringify(rouletteItems));
}

// Add roulette item
if (addRouletteItemBtn) {
    addRouletteItemBtn.addEventListener('click', () => {
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
        saveRouletteItems();
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
function removeRouletteItem(index) {
    rouletteItems.splice(index, 1);
    saveRouletteItems();
    renderRouletteList();
    drawRoulette();
}

// Make removeRouletteItem globally accessible
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
    const radius = 140;

    // Clear canvas
    rouletteCtx.clearRect(0, 0, rouletteCanvas.width, rouletteCanvas.height);

    const anglePerSegment = (2 * Math.PI) / rouletteItems.length;

    // Draw segments
    rouletteItems.forEach((item, index) => {
        const startAngle = rotation + (index * anglePerSegment);
        const endAngle = startAngle + anglePerSegment;

        // Draw segment
        rouletteCtx.beginPath();
        rouletteCtx.moveTo(centerX, centerY);
        rouletteCtx.arc(centerX, centerY, radius, startAngle, endAngle);
        rouletteCtx.closePath();
        rouletteCtx.fillStyle = rouletteColors[index % rouletteColors.length];
        rouletteCtx.fill();
        rouletteCtx.strokeStyle = '#1e1e1e';
        rouletteCtx.lineWidth = 2;
        rouletteCtx.stroke();

        // Draw text
        rouletteCtx.save();
        rouletteCtx.translate(centerX, centerY);
        rouletteCtx.rotate(startAngle + anglePerSegment / 2);
        rouletteCtx.textAlign = 'center';
        rouletteCtx.fillStyle = '#000';
        rouletteCtx.font = 'bold 14px Inter, sans-serif';
        rouletteCtx.fillText(item, radius * 0.65, 5);
        rouletteCtx.restore();
    });

    // Draw center circle
    rouletteCtx.beginPath();
    rouletteCtx.arc(centerX, centerY, 20, 0, 2 * Math.PI);
    rouletteCtx.fillStyle = '#bb86fc';
    rouletteCtx.fill();
    rouletteCtx.strokeStyle = '#1e1e1e';
    rouletteCtx.lineWidth = 3;
    rouletteCtx.stroke();
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

        // Extended spin duration: 5-8 seconds
        const spinDuration = 5000 + Math.random() * 3000;
        // More rotations for longer visual effect
        const finalRotation = currentRotation + (Math.PI * 2 * 8) + (Math.random() * Math.PI * 2);
        const startTime = Date.now();

        let lastTickAngle = 0;
        const tickInterval = (Math.PI * 2) / rouletteItems.length;

        function animate() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / spinDuration, 1);

            // Enhanced easing function with more dramatic slowdown at the end
            const easedProgress = easing(progress);
            const previousRotation = currentRotation;
            currentRotation = currentRotation + (finalRotation - currentRotation) * easedProgress;

            drawRoulette(currentRotation);

            // Play tick sound when crossing segment boundaries
            const currentAngle = currentRotation % (Math.PI * 2);
            const ticksPassed = Math.floor(currentAngle / tickInterval);
            const lastTicksPassed = Math.floor(lastTickAngle / tickInterval);

            if (ticksPassed !== lastTicksPassed && progress < 0.95) {
                playTickSound();
            }
            lastTickAngle = currentAngle;

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Determine result - Calculate which segment the arrow (at top) is pointing to
                const normalizedRotation = (currentRotation % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
                const anglePerSegment = (2 * Math.PI) / rouletteItems.length;

                // The arrow is at the top (-π/2 radians from the right/0)
                // In drawing: segment i starts at (rotation + i * anglePerSegment)
                // We need to find which segment contains the arrow position
                const arrowPosition = -Math.PI / 2; // Top of circle

                // Which segment is under the arrow?
                // The arrow points at arrowPosition in absolute coordinates
                // Segments are drawn starting at normalizedRotation + i * anglePerSegment
                // We need: normalizedRotation + i * anglePerSegment <= arrowPosition < normalizedRotation + (i+1) * anglePerSegment

                // Solve for i: (arrowPosition - normalizedRotation) / anglePerSegment
                let segmentIndexFloat = (arrowPosition - normalizedRotation) / anglePerSegment;

                // Normalize to positive
                while (segmentIndexFloat < 0) segmentIndexFloat += rouletteItems.length;

                const winningIndex = Math.floor(segmentIndexFloat) % rouletteItems.length;

                // Play result sound
                playResultSound();

                rouletteResult.textContent = `🎉 ${rouletteItems[winningIndex]} 🎉`;
                isSpinning = false;
                spinBtn.disabled = false;
            }
        }

        // Enhanced easing function with dramatic slowdown at the end
        function easing(t) {
            // Cubic ease-in-out with extra slowdown at the end
            if (t < 0.3) {
                // Fast start
                return 4 * t * t * t;
            } else if (t < 0.7) {
                // Medium speed
                return 1 - Math.pow(-2 * (t - 0.5) + 1, 3) / 2;
            } else {
                // Dramatic slowdown
                const localT = (t - 0.7) / 0.3;
                return 0.85 + 0.15 * (1 - Math.pow(1 - localT, 4));
            }
        }

        animate();
    });
}

// Initialize roulette when page loads
if (rouletteCanvas) {
    initRoulette();
}

// Start
init();
