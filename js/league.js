/**
 * League System Logic
 */
window.League = {
    currentLeagueId: null,
    currentChartMode: 'game', // 'game' or 'session'

    // Helper to check permission
    isParticipant: function (league) {
        if (!league || !league.players) return false;
        const currentUser = localStorage.getItem('deviceUser');
        // Admin check: 'ヒロム' has all permissions
        if (currentUser === 'ヒロム') return true;
        return currentUser && league.players.includes(currentUser);
    },

    // --- Main Views ---

    // Render League List (Entry Point)
    renderList: async function (container) {
        if (!container) return;

        container.innerHTML = '<div style="text-align:center; padding:20px;">読み込み中...</div>';
        const leagues = await window.AppStorage.getLeagues();

        let html = `
            <div class="content-header">
                <h2 style="display: flex; align-items: center; gap: 10px;">
                    <span>🏆</span> リーグ戦
                </h2>
                <button onclick="League.showCreateModal()" class="btn-primary">+ リーグ作成</button>
            </div>
        `;

        // Active Leagues
        const activeLeagues = leagues.filter(l => l.status !== 'completed');
        const pastLeagues = leagues.filter(l => l.status === 'completed');

        html += `<h3 style="border-left: 4px solid #10b981; padding-left: 10px; margin-top: 20px;">開催中</h3>`;

        if (activeLeagues.length === 0) {
            html += `<p style="color: #94a3b8; padding: 10px;">現在開催中のリーグはありません。</p>`;
        } else {
            html += `<div class="league-grid" style="display: grid; gap: 15px; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));">`;
            activeLeagues.forEach(l => {
                html += this.createLeagueCard(l);
            });
            html += `</div>`;
        }

        // Past Leagues
        if (pastLeagues.length > 0) {
            html += `<h3 style="border-left: 4px solid #64748b; padding-left: 10px; margin-top: 30px;">過去のリーグ</h3>`;
            html += `<div class="league-grid" style="display: grid; gap: 15px; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));">`;
            pastLeagues.forEach(l => {
                html += this.createLeagueCard(l, true);
            });
            html += `</div>`;
        }

        // Create Modal HTML
        html += this.getCreateModalHtml();

        container.innerHTML = html;
    },

    // Render League Detail
    renderDetail: async function (leagueId, container) {
        this.currentLeagueId = leagueId;
        const league = await window.AppStorage.getLeague(leagueId);
        if (!league) {
            alert("リーグが見つかりませんでした");
            return;
        }

        // Fetch related sessions
        const allSessions = await window.AppStorage.getSessions();
        const leagueSessions = allSessions.filter(s => s.leagueId === leagueId);

        // Calculate Stats
        const stats = this.calculateLeagueStats(league, leagueSessions);

        let html = `
            <div class="content-header" style="display: flex; align-items: center;">
                <button onclick="League.renderList(document.getElementById('league-section'))" class="btn-secondary" style="margin-right: 10px;">&lt; 一覧へ</button>
                <h2 style="margin: 0; font-size: 1.2rem; flex: 1;">${league.title}</h2>
                ${this.isParticipant(league) ? `<button onclick="League.deleteLeague('${leagueId}')" class="btn-danger" style="padding: 4px 8px; font-size: 0.8em;">削除</button>` : ''}
            </div>
                        
            <!-- Summary Rules -->
            <div style="background: rgba(255,255,255,0.05); padding: 10px 15px; border-radius: 8px; margin-bottom: 20px; font-size: 0.9rem; display: flex; gap: 20px; flex-wrap: wrap;">
                <div><span>👥</span> ${league.players.join(', ')}</div>
                <div><span>📅</span> ${this.formatRule(league.rule)}</div>
                <div style="margin-left: auto; color: ${league.status === 'completed' ? '#94a3b8' : '#10b981'}; font-weight: bold;">
                    ${league.status === 'completed' ? '終了' : '開催中'}
                </div>
            </div>

            <!-- Progress -->
            ${this.createProgressSection(league, leagueSessions.length)}

            <!-- Main Ranking Table -->
            <h3 style="margin-top: 20px;">順位表</h3>
            <div style="background: #1e293b; border-radius: 8px; border: 1px solid #334155; overflow: hidden; margin-bottom: 20px;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead style="background: #0f172a;">
                        <tr>
                            <th style="padding: 15px; text-align: center; width: 60px;">順位</th>
                            <th style="padding: 15px; text-align: left;">名前</th>
                            <th style="padding: 15px; text-align: right; font-size: 1.1rem;">Total</th>
                            <th style="padding: 15px; text-align: right;">対局数</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${stats.map((p, idx) => `
                            <tr style="border-bottom: 1px solid #334155;">
                                <td style="padding: 15px; text-align: center; font-weight: 800; font-size: 1.2rem; color: ${idx === 0 ? '#fbbf24' : (idx === 1 ? '#94a3b8' : (idx === 2 ? '#b45309' : '#fff'))};">
                                    ${idx + 1}
                                </td>
                                <td style="padding: 15px; font-weight: bold; font-size: 1.1rem;">
                                    ${p.name}
                                </td>
                                <td style="padding: 15px; text-align: right; font-weight: 800; font-size: 1.2rem; color: ${p.score >= 0 ? '#4ade80' : '#ef4444'};">
                                    ${p.score > 0 ? '+' : ''}${p.score.toFixed(1)}
                                </td>
                                <td style="padding: 15px; text-align: right; color: #cbd5e1;">${p.games}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <!-- Detailed Stats Grid -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
                
                <!-- Stability Stats -->
                <div>
                    <h4 style="margin: 0 0 10px 0; color: #94a3b8;">🛡️ 安定感データ</h4>
                    <div style="background: #1e293b; border-radius: 8px; border: 1px solid #334155; overflow: hidden;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                            <thead style="background: #0f172a;">
                                <tr>
                                    <th style="padding: 10px; text-align: left;">名前</th>
                                    <th style="padding: 10px; text-align: right;">平均順位</th>
                                    <th style="padding: 10px; text-align: right;">連対率</th>
                                    <th style="padding: 10px; text-align: right;">ラス回避率</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${stats.map(p => `
                                    <tr style="border-bottom: 1px solid #334155;">
                                        <td style="padding: 10px; font-weight: bold;">${p.name}</td>
                                        <td style="padding: 10px; text-align: right;">${p.avgRank}</td>
                                        <td style="padding: 10px; text-align: right;">${p.rentaiRate}</td>
                                        <td style="padding: 10px; text-align: right;">${p.avoidLastRate}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Offensive Stats -->
                <div>
                    <h4 style="margin: 0 0 10px 0; color: #94a3b8;">⚔️ 攻撃力データ</h4>
                    <div style="background: #1e293b; border-radius: 8px; border: 1px solid #334155; overflow: hidden;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                            <thead style="background: #0f172a;">
                                <tr>
                                    <th style="padding: 10px; text-align: left;">名前</th>
                                    <th style="padding: 10px; text-align: right;">トップ率</th>
                                    <th style="padding: 10px; text-align: right;">最高スコア</th>
                                    <th style="padding: 10px; text-align: right;">平均素点</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${stats.map(p => `
                                    <tr style="border-bottom: 1px solid #334155;">
                                        <td style="padding: 10px; font-weight: bold;">${p.name}</td>
                                        <td style="padding: 10px; text-align: right;">${p.topRate}</td>
                                        <td style="padding: 10px; text-align: right; color: ${p.maxScore > 0 ? '#4ade80' : '#fff'};">${p.maxScore !== -Infinity ? (p.maxScore > 0 ? '+' : '') + p.maxScore.toFixed(1) : '-'}</td>
                                        <td style="padding: 10px; text-align: right;">${p.avgRawScore}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Rank Chart Container -->
             <h3 style="margin-top: 30px;">順位分布</h3>
            <div style="background: rgba(30, 41, 59, 0.5); border: 1px solid #334155; border-radius: 8px; padding: 10px; height: 300px; margin-bottom: 20px;">
                <canvas id="league-rank-chart"></canvas>
            </div>

            <!-- Chart Container -->
            <div style="display: flex; justify-content: space-between; align-items: end; margin-top: 30px; margin-bottom: 10px;">
                <h3 style="margin: 0;">推移グラフ</h3>
                <div style="background: #0f172a; padding: 3px; border-radius: 6px; display: flex; gap: 5px;">
                    <button onclick="League.switchChartMode('game')" style="padding: 4px 12px; font-size: 0.8rem; border: none; border-radius: 4px; cursor: pointer; background: ${this.currentChartMode === 'game' ? '#3b82f6' : 'transparent'}; color: ${this.currentChartMode === 'game' ? '#fff' : '#94a3b8'}; transition: all 0.2s;">半荘ごと</button>
                    <button onclick="League.switchChartMode('session')" style="padding: 4px 12px; font-size: 0.8rem; border: none; border-radius: 4px; cursor: pointer; background: ${this.currentChartMode === 'session' ? '#3b82f6' : 'transparent'}; color: ${this.currentChartMode === 'session' ? '#fff' : '#94a3b8'}; transition: all 0.2s;">セットごと</button>
                </div>
            </div>
            <div style="background: rgba(30, 41, 59, 0.5); border: 1px solid #334155; border-radius: 8px; padding: 10px; height: 300px;">
                <canvas id="league-chart"></canvas>
            </div>

            <!-- History -->
            <h3 style="margin-top: 30px;">対局履歴</h3>
            <div id="league-history-list">
                ${await this.createHistoryListHtml(leagueSessions, league)}
            </div>
            
            <div style="text-align: right; margin-top: 20px;">
                 ${league.status !== 'completed' && this.isParticipant(league) ? `<button onclick="League.completeLeague('${leagueId}')" class="btn-secondary" style="border-color: #ef4444; color: #ef4444;">リーグを終了する</button>` : ''}
            </div>
        `;

        container.innerHTML = html;

        // Render Chart
        this.renderChart(stats, leagueSessions, league.players, this.currentChartMode);
        this.renderRankChart(stats, league.players);
    },

    switchChartMode: function (mode) {
        this.currentChartMode = mode;
        this.renderDetail(this.currentLeagueId, document.getElementById('league-section'));
    },

    // --- Helpers ---

    createLeagueCard: function (league, isPast = false) {
        const ruleText = this.formatRule(league.rule);
        const statusColor = isPast ? '#64748b' : '#10b981';

        return `
            <div onclick="League.renderDetail('${league.id}', document.getElementById('league-section'))" 
                 style="background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 15px; cursor: pointer; transition: transform 0.2s; position: relative;"
                 onmouseover="this.style.transform='translateY(-2px)'" 
                 onmouseout="this.style.transform='translateY(0)'">
                <div style="position: absolute; top: 10px; right: 10px; background: ${statusColor}; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.7rem;">
                    ${isPast ? '終了' : '開催中'}
                </div>
                <h4 style="margin: 0 0 10px 0; font-size: 1.1rem; padding-right: 50px;">${league.title}</h4>
                <div style="font-size: 0.85rem; color: #cbd5e1; display: flex; flex-direction: column; gap: 5px;">
                    <div>👥 ${league.players.join(', ')}</div>
                    <div>📜 ${ruleText}</div>
                </div>
            </div>
        `;
    },

    createProgressSection: function (league, currentCount) {
        if (!league.rule) return '';

        let label = '';
        let progress = 0;
        let total = 0;

        if (league.rule.type === 'count') {
            total = parseInt(league.rule.value);
            progress = Math.min(100, (currentCount / total) * 100);
            label = `${currentCount} / ${total} 半荘`;
        } else if (league.rule.type === 'days') {
            // Logic for days would require counting unique dates in sessions
            // For simplify, treat as games for now or just hide progress
            return '';
        } else {
            // Period
            const end = new Date(league.rule.end);
            const now = new Date();
            const start = league.rule.start ? new Date(league.rule.start) : new Date(league.createdAt.seconds * 1000);

            const totalTime = end - start;
            const elapsed = now - start;
            progress = Math.min(100, Math.max(0, (elapsed / totalTime) * 100)); // Clamp 0-100
            label = `${new Date(league.rule.start).toLocaleDateString()} ~ ${new Date(league.rule.end).toLocaleDateString()}`;
        }

        return `
            <div style="margin-top: 15px;">
                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 5px;">
                    <span>進捗状況</span>
                    <span>${label}</span>
                </div>
                <div style="background: #334155; height: 10px; border-radius: 5px; overflow: hidden;">
                    <div style="background: #3b82f6; width: ${progress}%; height: 100%;"></div>
                </div>
            </div>
        `;
    },

    getCreateModalHtml: function () {
        return `
            <dialog id="create-league-modal" style="background: #1e293b; color: #fff; border: 1px solid #475569; border-radius: 8px; padding: 20px; width: 95%; max-width: 500px; ::backdrop { background: rgba(0,0,0,0.7); }">
                <h3 style="margin-top: 0;">新しいリーグを作成</h3>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-size: 0.9rem;">リーグ名</label>
                    <input type="text" id="league-title-input" placeholder="例: 2026年 第1期リーグ" style="width: 100%; padding: 8px; background: #0f172a; color: #fff; border: 1px solid #334155; border-radius: 4px;">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-size: 0.9rem;">参加メンバー (4名)</label>
                    <div id="league-player-select" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: #0f172a; padding: 10px; border-radius: 4px; max-height: 150px; overflow-y: auto;">
                        <!-- JS populated -->
                    </div>
                </div>

                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-size: 0.9rem;">終了条件</label>
                    <div style="display: flex; gap: 10px; margin-bottom: 8px;">
                        <select id="league-rule-type" onchange="League.toggleRuleInput()" style="padding: 8px; background: #0f172a; color: #fff; border: 1px solid #334155; border-radius: 4px;">
                            <option value="count">半荘数</option>
                            <option value="period">期間</option>
                        </select>
                        <input type="number" id="league-rule-value-num" placeholder="回数 (例: 50)" style="flex: 1; min-width: 120px; padding: 8px; background: #0f172a; color: #fff; border: 1px solid #334155; border-radius: 4px;">
                        
                        <!-- Period Inputs -->
                        <div id="league-rule-period-inputs" style="flex: 2; display: none; gap: 5px; align-items: center;">
                            <input type="date" id="league-rule-value-start-date" title="開始日" style="flex: 1; padding: 8px; background: #0f172a; color: #fff; border: 1px solid #334155; border-radius: 4px;">
                            <span>~</span>
                            <input type="date" id="league-rule-value-end-date" title="終了日" style="flex: 1; padding: 8px; background: #0f172a; color: #fff; border: 1px solid #334155; border-radius: 4px;">
                        </div>
                    </div>
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
                    <button onclick="document.getElementById('create-league-modal').close()" class="btn-secondary">キャンセル</button>
                    <button onclick="League.submitCreate()" class="btn-primary">作成</button>
                </div>
            </dialog>
        `;
    },

    // --- Logic ---

    showCreateModal: async function () {
        const modal = document.getElementById('create-league-modal');
        const playerContainer = document.getElementById('league-player-select');

        // Populate players
        const users = await window.AppStorage.getUsers();
        playerContainer.innerHTML = users.map(u => `
            <label style="display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 8px; font-size: 0.9rem; cursor: pointer; padding: 6px; background: rgba(255,255,255,0.05); border-radius: 4px; transition: background 0.2s;">
                <input type="checkbox" name="league-players" value="${u}" style="transform: scale(1.1);"> 
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;">${u}</span>
            </label>
        `).join('');

        modal.showModal();
    },

    toggleRuleInput: function () {
        const type = document.getElementById('league-rule-type').value;
        const numInput = document.getElementById('league-rule-value-num');
        const periodInputs = document.getElementById('league-rule-period-inputs');

        if (type === 'period') {
            numInput.style.display = 'none';
            numInput.value = ''; // Clean up
            periodInputs.style.display = 'flex';
        } else {
            numInput.style.display = 'block';
            periodInputs.style.display = 'none';
            // Clean up period inputs
            document.getElementById('league-rule-value-start-date').value = '';
            document.getElementById('league-rule-value-end-date').value = '';
        }
    },

    submitCreate: async function () {
        const title = document.getElementById('league-title-input').value.trim();
        const playerChecks = document.querySelectorAll('input[name="league-players"]:checked');
        const players = Array.from(playerChecks).map(c => c.value);

        const ruleType = document.getElementById('league-rule-type').value;
        const rule = { type: ruleType };

        if (ruleType === 'period') {
            const start = document.getElementById('league-rule-value-start-date').value;
            const end = document.getElementById('league-rule-value-end-date').value;
            if (!start || !end) return alert("期間（開始日・終了日）を入力してください");
            if (start > end) return alert("開始日は終了日より前である必要があります");
            rule.start = start;
            rule.end = end;
        } else {
            const val = document.getElementById('league-rule-value-num').value;
            if (!val) return alert("回数を入力してください");
            rule.value = val;
        }

        if (!title) return alert("リーグ名を入力してください");
        if (players.length < 4) return alert("メンバーは4名以上選択してください");

        const newLeague = await window.AppStorage.addLeague({
            title,
            players,
            rule,
            status: 'active'
        });

        // Auto-link existing sessions if Period
        let linkedCount = 0;
        if (ruleType === 'period' && newLeague && newLeague.id) {
            try {
                const sessions = await window.AppStorage.getSessions();
                const start = new Date(rule.start);
                // Set end date to end of day
                const end = new Date(rule.end);
                end.setHours(23, 59, 59, 999);

                for (const sess of sessions) {
                    // Check players match (sess has 4 players, newLeague has >= 4)
                    // Logic: All 4 players of the session must be in the league players list
                    const pMatch = sess.players.length === 4 &&
                        sess.players.every(p => players.includes(p));

                    if (pMatch) {
                        const sDate = new Date(sess.date);
                        if (sDate >= start && sDate <= end) {
                            await window.AppStorage.updateSession(sess.id, { leagueId: newLeague.id });
                            linkedCount++;
                        }
                    }
                }
            } catch (e) {
                console.error("Auto-link error", e);
            }
        }

        document.getElementById('create-league-modal').close();
        if (linkedCount > 0) {
            alert(`リーグを作成し、期間内の${linkedCount}件の対局を紐付けました。`);
        } else {
            alert('リーグを作成しました。');
        }
        this.renderList(document.getElementById('league-section'));
    },

    completeLeague: async function (id) {
        if (!confirm('このリーグを終了済みにしますか？')) return;
        await window.AppStorage.updateLeague(id, { status: 'completed' });
        this.renderDetail(id, document.getElementById('league-section'));
    },

    deleteLeague: async function (id) {
        if (!confirm('本当にこのリーグを削除しますか？\n（紐付けられた対局データは削除されませんが、リーグとの紐付けは解除されます）')) return;

        const success = await window.AppStorage.deleteLeague(id);
        if (success) {
            alert('リーグを削除しました');
            this.renderList(document.getElementById('league-section'));
        } else {
            alert('削除に失敗しました');
        }
    },

    unlinkSession: async function (sessionId, event) {
        if (event) event.stopPropagation();
        if (!confirm('この対局をリーグ戦の記録から除外しますか？\n（対局データ自体は削除されません）')) return;

        try {
            await window.AppStorage.updateSession(sessionId, { leagueId: null });
            // Refresh logic - need active league ID. 
            // Since we don't have easy access to current league ID here without context,
            // we can re-render the detail if we are currently viewing it.
            // But unlinkSession is called from the list.
            // Let's assume we are in the detail view. 
            // We can check the active league ID from the DOM or simply reload the current view.

            // Re-fetching the current active league ID from the UI context would be ideal,
            // but for now, let's find the current active league ID from the rendered chart or header?
            // Actually, `renderDetail` sets `this.activeLeagueId`? No.
            // Let's rely on finding the container or just re-render if we can pass the league ID.
            // Wait, I can pass leagueId to unlinkSession if I update the call in HTML.

            alert('リーグから除外しました');

            // Reload the current detail view if possible, or just the list.
            // A simple way is to retrieve the league ID from the parent 'createHistoryListHtml' context? 
            // No, unlinkSession is global.
            // Let's pass leagueId as 2nd arg.
        } catch (e) {
            console.error(e);
            alert('除外に失敗しました');
        }
    },

    calculateLeagueStats: function (league, sessions) {
        const stats = {};
        league.players.forEach(p => {
            stats[p] = {
                name: p,
                score: 0,
                games: 0,
                ranks: [0, 0, 0, 0],
                maxScore: -Infinity, // Initialize with very low number
                totalRawScore: 0
            };
        });

        sessions.forEach(s => {
            s.games.forEach(g => {
                // Correctly determine ranks by sorting players by score descending
                const rankedPlayers = [...g.players].sort((a, b) => b.finalScore - a.finalScore);

                rankedPlayers.forEach((gp, idx) => {
                    if (stats[gp.name]) {
                        stats[gp.name].score += gp.finalScore;
                        stats[gp.name].games += 1;
                        stats[gp.name].ranks[idx]++; // idx 0 is 1st, idx 1 is 2nd, etc.

                        // Update Max Score
                        if (gp.finalScore > stats[gp.name].maxScore) {
                            stats[gp.name].maxScore = gp.finalScore;
                        }

                        // Add Raw Score (Ensure it exists, fallback to calculated from final if needed but app.js should save it)
                        // If rawScore is missing, approximate from finalScore??? 
                        // Ideally app.js saves rawScore. Let's assume it does or fallback to finalScore * 1000 + 30000? No, unsafe.
                        // Let's check app.js saveGameResult. It saves `result.players` which has `rawScore`.
                        if (gp.rawScore !== undefined) {
                            stats[gp.name].totalRawScore += gp.rawScore;
                        }
                    }
                });
            });
        });

        return Object.values(stats).map(s => {
            const totalRank = s.ranks[0] * 1 + s.ranks[1] * 2 + s.ranks[2] * 3 + s.ranks[3] * 4;
            return {
                ...s,
                avgRank: s.games > 0 ? (totalRank / s.games).toFixed(2) : '0.00',
                topRate: s.games > 0 ? ((s.ranks[0] / s.games) * 100).toFixed(1) + '%' : '0.0%',
                rentaiRate: s.games > 0 ? (((s.ranks[0] + s.ranks[1]) / s.games) * 100).toFixed(1) + '%' : '0.0%',
                avoidLastRate: s.games > 0 ? (((s.games - s.ranks[3]) / s.games) * 100).toFixed(1) + '%' : '0.0%',
                avgRawScore: s.games > 0 ? Math.round(s.totalRawScore / s.games).toLocaleString() : '0'
            };
        }).sort((a, b) => b.score - a.score);
    },

    formatRule: function (rule) {
        if (!rule) return '条件なし';
        if (rule.type === 'count') return `全 ${rule.value} 半荘`;
        if (rule.type === 'period') {
            if (rule.start && rule.end) {
                return `${new Date(rule.start).toLocaleDateString()} ~ ${new Date(rule.end).toLocaleDateString()}`;
            }
            return `${rule.value || '未設定'} まで`;
        }
        return `${rule.value}`;
    },

    createHistoryListHtml: async function (sessions, league) {
        if (sessions.length === 0) return '<div style="color:#94a3b8;">まだ記録がありません</div>';

        // Check permission
        const canEdit = this.isParticipant(league);

        let html = '';
        for (const s of sessions) {
            const dateStr = new Date(s.date).toLocaleDateString();
            // Simple version of game list
            html += `
                <div onclick="openSession(${s.id})" style="background: rgba(255,255,255,0.02); border-bottom: 1px solid #334155; padding: 10px; cursor: pointer; transition: background 0.2s; position: relative;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='rgba(255,255,255,0.02)'">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div style="font-size: 0.8rem; color: #94a3b8; margin-bottom: 5px;">${dateStr} (${s.games.length}戦)</div>
                        ${canEdit ? `<button onclick="League.unlinkSession('${s.id}', event); setTimeout(() => League.renderDetail('${sessions[0].leagueId}', document.getElementById('league-section')), 100);" style="background: none; border: 1px solid #475569; color: #94a3b8; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; cursor: pointer;">除外</button>` : ''}
                    </div>
                    <div style="display: flex; gap: 10px; font-size: 0.9rem;">
             `;

            // Calculate session total for visual
            const totals = {};
            s.games.forEach(g => g.players.forEach(p => {
                totals[p.name] = (totals[p.name] || 0) + p.finalScore;
            }));

            Object.keys(totals).forEach(name => {
                const score = totals[name];
                html += `<span style="color: ${score >= 0 ? '#4ade80' : '#ef4444'}">${name}: ${score > 0 ? '+' : ''}${Math.round(score)}</span>`;
            });

            html += `</div></div>`;
        }
        return html;
    },

    renderChart: function (stats, sessions, players, mode = 'game') {
        const ctx = document.getElementById('league-chart');
        if (!ctx) return;

        // Destroy previous chart if exists
        const existingChart = Chart.getChart(ctx);
        if (existingChart) existingChart.destroy();

        // Prepare datasets
        sessions.sort((a, b) => new Date(a.date) - new Date(b.date)); // Sort sessions by date

        const datasets = players.map((p, i) => ({
            label: p,
            data: [0], // Start at 0
            borderColor: this.getColorForIndex(i),
            fill: false,
            tension: 0.1
        }));

        let labels = ['Start'];
        let runningScores = {};
        players.forEach(p => runningScores[p] = 0);

        if (mode === 'session') {
            // SESSION MODE
            sessions.forEach((s, idx) => {
                // Calculate total score impact of this session for each player
                let sessionImpact = {};
                players.forEach(p => sessionImpact[p] = 0);

                s.games.forEach(g => {
                    g.players.forEach(gp => {
                        if (sessionImpact[gp.name] !== undefined) {
                            sessionImpact[gp.name] += gp.finalScore;
                        }
                    });
                });

                // Update running scores
                players.forEach(p => {
                    runningScores[p] += sessionImpact[p];
                });

                // Push data points
                datasets.forEach(d => {
                    d.data.push(runningScores[d.label]);
                });

                // Label: Date + Session Num? Or just index?
                // Using Date is better.
                const dateStr = new Date(s.date).toLocaleDateString();
                labels.push(`${dateStr}`);
            });

        } else {
            // GAME MODE (Default)
            const allGames = [];
            sessions.forEach(s => {
                s.games.forEach(g => allGames.push(g));
            });

            allGames.forEach(g => {
                g.players.forEach(gp => {
                    if (runningScores[gp.name] !== undefined) {
                        runningScores[gp.name] += gp.finalScore;
                    }
                });
                // Push new point
                datasets.forEach(d => {
                    d.data.push(runningScores[d.label]);
                });
            });

            const gameLabels = Array.from({ length: allGames.length }, (_, i) => `${i + 1}`);
            labels = [...labels, ...gameLabels];
        }

        new Chart(ctx, {
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
                        grid: { color: '#334155' },
                        ticks: { color: '#cbd5e1' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#cbd5e1' }
                    }
                },
                plugins: {
                    legend: {
                        labels: { color: '#cbd5e1' }
                    },
                    datalabels: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                }
            }
        });
    },

    renderRankChart: function (stats, players) {
        const ctx = document.getElementById('league-rank-chart');
        if (!ctx) return;

        const existingChart = Chart.getChart(ctx);
        if (existingChart) existingChart.destroy();

        // Sort stats to match the order of 'players' array or keep sorting by ranking?
        // Usually charts match the order of the table (Ranking).
        // Let's use the stats array which is already sorted by score (Ranking order).

        const labels = stats.map(s => s.name);

        // Prepare data for 1st, 2nd, 3rd, 4th
        const data1 = stats.map(s => s.ranks[0]);
        const data2 = stats.map(s => s.ranks[1]);
        const data3 = stats.map(s => s.ranks[2]);
        const data4 = stats.map(s => s.ranks[3]);

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '1着',
                        data: data1,
                        backgroundColor: '#fbbf24', // Amber 400
                        borderRadius: 4,
                        barPercentage: 0.6,
                        categoryPercentage: 0.8,
                        stack: 'Stack 0'
                    },
                    {
                        label: '2着',
                        data: data2,
                        backgroundColor: '#94a3b8', // Slate 400
                        borderRadius: 4,
                        barPercentage: 0.6,
                        categoryPercentage: 0.8,
                        stack: 'Stack 0'
                    },
                    {
                        label: '3着',
                        data: data3,
                        backgroundColor: '#b45309', // Amber 700 / Bronze
                        borderRadius: 4,
                        barPercentage: 0.6,
                        categoryPercentage: 0.8,
                        stack: 'Stack 0'
                    },
                    {
                        label: '4着',
                        data: data4,
                        backgroundColor: '#ef4444', // Red 500
                        borderRadius: 4,
                        barPercentage: 0.6,
                        categoryPercentage: 0.8,
                        stack: 'Stack 0'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: true,
                        grid: { display: false },
                        ticks: { color: '#94a3b8', font: { weight: 'bold' } }
                    },
                    y: {
                        stacked: true,
                        grid: { color: 'rgba(51, 65, 85, 0.5)', drawBorder: false }, // Softer grid
                        ticks: { color: '#94a3b8', stepSize: 1 }
                    }
                },
                plugins: {
                    legend: {
                        labels: { color: '#cbd5e1', usePointStyle: true, pointStyle: 'circle' }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleColor: '#e2e8f0',
                        bodyColor: '#cbd5e1',
                        padding: 10,
                        cornerRadius: 8,
                        displayColors: true,
                        mode: 'index',
                        intersect: false
                    }
                }
            }
        });
    },

    getColorForIndex: function (index) {
        const colors = [
            '#ef4444', // Red
            '#3b82f6', // Blue
            '#10b981', // Green
            '#f59e0b', // Amber/Yellow
            '#8b5cf6', // Violet
            '#ec4899', // Pink
            '#06b6d4', // Cyan
            '#f97316', // Orange
            '#84cc16', // Lime
            '#14b8a6', // Teal
            '#6366f1', // Indigo
            '#d946ef'  // Fuchsia
        ];
        return colors[index % colors.length];
    }
};
