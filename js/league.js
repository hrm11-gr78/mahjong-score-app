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

    // --- Avatar helpers (delegate to app.js global helpers) ---

    ensureAvatars: async function (names) {
        if (typeof window.ensureAvatarsLoaded === 'function') {
            await window.ensureAvatarsLoaded(names);
        }
    },

    avatarHtml: function (name, size) {
        if (typeof window.renderAvatarHtml === 'function') {
            return window.renderAvatarHtml(name, size);
        }
        const initial = (name || '?').slice(0, 1);
        const cls = size === 'lg' ? 'gallery-avatar gallery-avatar--lg' : 'gallery-avatar';
        return `<span class="${cls}">${this.escape(initial)}</span>`;
    },

    escape: function (s) {
        if (typeof window.escapeHtml === 'function') return window.escapeHtml(s);
        return String(s ?? '').replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    },

    // --- Main Views ---

    // Render League List (Entry Point)
    renderList: async function (container) {
        if (!container) return;

        container.innerHTML = '<div style="text-align:center; padding:20px;">読み込み中...</div>';
        const [leagues, allSessions] = await Promise.all([
            window.AppStorage.getLeagues(),
            window.AppStorage.getSessions()
        ]);

        const activeLeagues = leagues.filter(l => l.status !== 'completed');
        const pastLeagues = leagues.filter(l => l.status === 'completed');

        // Preload avatars for all participants across leagues
        const allNames = new Set();
        leagues.forEach(l => (l.players || []).forEach(p => allNames.add(p)));
        await this.ensureAvatars(Array.from(allNames));

        const currentUser = localStorage.getItem('deviceUser');

        let html = `
            <div class="league-list-header">
                <h2><span>🏆</span> リーグ戦</h2>
                <button onclick="League.showCreateModal()" class="league-list-header__cta">+ リーグ作成</button>
            </div>
        `;

        // Active leagues — hero cards
        html += `
            <div class="league-list-heading">
                <span class="league-list-heading__bar"></span>
                <span>開催中</span>
                <span class="league-list-heading__count">${activeLeagues.length}</span>
            </div>
        `;

        if (activeLeagues.length === 0) {
            html += `
                <div class="league-empty">
                    <div class="league-empty__glyph">🏆</div>
                    <div>現在開催中のリーグはありません</div>
                    <div style="margin-top:4px; opacity:0.7;">新しいリーグを作って仲間と競おう</div>
                </div>
            `;
        } else {
            html += `<div style="display: flex; flex-direction: column; gap: 14px;">`;
            for (const l of activeLeagues) {
                const sessionsForLeague = allSessions.filter(s => s.leagueId === l.id);
                html += this.createHeroCard(l, sessionsForLeague, currentUser);
            }
            html += `</div>`;
        }

        // Past leagues — compact rows
        if (pastLeagues.length > 0) {
            html += `
                <div class="league-list-heading">
                    <span class="league-list-heading__bar league-list-heading__bar--past"></span>
                    <span>過去のリーグ</span>
                    <span class="league-list-heading__count">${pastLeagues.length}</span>
                </div>
            `;
            html += `<div>`;
            pastLeagues.forEach(l => {
                html += this.createPastRow(l);
            });
            html += `</div>`;
        }

        // Create modal HTML
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

        const allSessions = await window.AppStorage.getSessions();
        const leagueSessions = allSessions.filter(s => s.leagueId === leagueId);

        // Preload avatars for all participants
        await this.ensureAvatars(league.players || []);

        const stats = this.calculateLeagueStats(league, leagueSessions);
        const currentUser = localStorage.getItem('deviceUser');
        const canEdit = this.isParticipant(league);

        const isPast = league.status === 'completed';
        const pillCls = isPast ? 'league-pill--completed' : 'league-pill--active';
        const pillText = isPast ? '終了' : '開催中';

        // Self stats (if participant and has games)
        const selfIdx = stats.findIndex(s => s.name === currentUser);
        const selfStat = selfIdx >= 0 ? stats[selfIdx] : null;
        const diffFromTop = selfStat && selfIdx > 0 ? (stats[0].score - selfStat.score) : 0;

        let html = `
            <div class="league-detail-toolbar">
                <button onclick="League.renderList(document.getElementById('league-section'))" class="league-detail-toolbar__back">&lt; 一覧へ</button>
                <div class="league-detail-toolbar__spacer"></div>
                ${canEdit ? `<button onclick="League.deleteLeague('${leagueId}')" class="league-detail-toolbar__danger">削除</button>` : ''}
            </div>

            <!-- Hero -->
            <div class="league-detail-hero">
                <div class="league-detail-hero__title-row">
                    <h2 class="league-detail-hero__title">${this.escape(league.title)}</h2>
                    <span class="league-pill ${pillCls}">${pillText}</span>
                </div>
                <div class="league-detail-hero__meta">
                    <span class="league-detail-hero__meta-item">📅 ${this.escape(this.formatRule(league.rule))}</span>
                    <span class="league-detail-hero__meta-item">👥 ${league.players.length}名</span>
                </div>
                ${this.renderAvatarStack(league.players)}
                ${this.createProgressSection(league, leagueSessions.length)}
                ${selfStat ? this.renderSelfStats(selfStat, selfIdx, diffFromTop) : ''}
            </div>

            <!-- Podium -->
            <h3 class="league-section-title">順位</h3>
            ${this.renderPodium(stats, currentUser)}

            <!-- Detailed Stats Grid (kept) -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 24px;">

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
                                        <td style="padding: 10px; font-weight: bold; display: flex; align-items: center; gap: 8px;">${this.avatarHtml(p.name)}<span>${this.escape(p.name)}</span></td>
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
                                        <td style="padding: 10px; font-weight: bold; display: flex; align-items: center; gap: 8px;">${this.avatarHtml(p.name)}<span>${this.escape(p.name)}</span></td>
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

            <!-- Rank Distribution -->
            <h3 class="league-section-title">順位分布</h3>
            ${this.renderRankDistribution(stats)}

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
            ${this.renderChartSummary(stats, leagueSessions)}

            <!-- History -->
            <h3 style="margin-top: 30px;">対局履歴</h3>
            <div id="league-history-list">
                ${this.createHistoryListHtml(leagueSessions, league)}
            </div>

            <div style="text-align: right; margin-top: 20px;">
                 ${league.status !== 'completed' && canEdit ? `<button onclick="League.completeLeague('${leagueId}')" class="btn-secondary" style="border-color: #ef4444; color: #ef4444;">リーグを終了する</button>` : ''}
            </div>
        `;

        container.innerHTML = html;

        // Render Chart
        this.renderChart(stats, leagueSessions, league.players, this.currentChartMode);
    },

    // Compact summary row shown right below the trend chart.
    // Shows each player's cumulative total + their most recent game's delta.
    renderChartSummary: function (stats, sessions) {
        // Last game per player (chronologically latest game they appeared in)
        const sortedSessions = [...sessions].sort((a, b) => this.compareSessionsAsc(a, b));
        const lastGameByPlayer = {};
        sortedSessions.forEach(s => {
            s.games.forEach(g => {
                g.players.forEach(gp => {
                    lastGameByPlayer[gp.name] = { finalScore: gp.finalScore };
                });
            });
        });
        const lastGameRanks = (() => {
            // Get the very last game across all sessions and compute ranks for it
            const lastSession = sortedSessions[sortedSessions.length - 1];
            if (!lastSession || !lastSession.games.length) return {};
            const lastGame = lastSession.games[lastSession.games.length - 1];
            const sorted = [...lastGame.players].sort((a, b) => b.finalScore - a.finalScore);
            const ranks = {};
            sorted.forEach((p, i) => { ranks[p.name] = i + 1; });
            return ranks;
        })();

        // Items sorted by cumulative score desc (same order as podium)
        const rowHtml = stats.map(p => {
            const total = p.score;
            const totalSign = total > 0 ? '+' : '';
            const totalCls = total >= 0 ? 'chart-summary__total--pos' : 'chart-summary__total--neg';
            const last = lastGameByPlayer[p.name];
            const lastRank = lastGameRanks[p.name];
            const medal = lastRank === 1 ? '🥇' : lastRank === 2 ? '🥈' : lastRank === 3 ? '🥉' : (lastRank === 4 ? '4' : '—');
            const medalCls = lastRank === 4 ? 'chart-summary__medal--last' : '';
            let deltaHtml = '';
            if (last) {
                const dSign = last.finalScore > 0 ? '+' : '';
                const dCls = last.finalScore >= 0 ? 'chart-summary__delta--pos' : 'chart-summary__delta--neg';
                deltaHtml = `<span class="chart-summary__delta ${dCls}">${dSign}${last.finalScore.toFixed(1)}</span>`;
            } else {
                deltaHtml = `<span class="chart-summary__delta chart-summary__delta--none">—</span>`;
            }
            return `
                <div class="chart-summary__row">
                    <span class="chart-summary__medal ${medalCls}">${medal}</span>
                    ${this.avatarHtml(p.name)}
                    <span class="chart-summary__name">${this.escape(p.name)}</span>
                    ${deltaHtml}
                    <span class="chart-summary__total ${totalCls}">${totalSign}${total.toFixed(1)}</span>
                </div>
            `;
        }).join('');

        return `
            <div class="chart-summary">
                <div class="chart-summary__head">
                    <span class="chart-summary__title">最終戦の結果 → 累積</span>
                </div>
                <div class="chart-summary__list">${rowHtml}</div>
            </div>
        `;
    },

    // HTML rank distribution (100% stacked horizontal bars)
    renderRankDistribution: function (stats) {
        if (!stats || stats.length === 0) {
            return `<div class="league-empty" style="margin-top:8px;"><div>順位データがありません</div></div>`;
        }

        const rowHtml = (p) => {
            // Avatar + name + games + top-rate pill
            const headHtml = `
                <div class="rank-dist__head">
                    ${this.avatarHtml(p.name)}
                    <span class="rank-dist__name">${this.escape(p.name)}</span>
                    ${p.games > 0 ? `<span class="rank-dist__top-rate">Top率 ${p.topRate}</span>` : ''}
                    <span class="rank-dist__games">${p.games}戦</span>
                </div>
            `;

            if (p.games === 0) {
                return `
                    <div class="rank-dist__row">
                        ${headHtml}
                        <div class="rank-dist__bar">
                            <div class="rank-dist__empty-label">未参加</div>
                        </div>
                    </div>
                `;
            }

            // Compute percentages
            const total = p.games;
            const pcts = p.ranks.map(c => (c / total) * 100);

            // Build segments; only show count inside if width is wide enough (>= 10%)
            const segs = p.ranks.map((count, i) => {
                if (count === 0) return '';
                const w = pcts[i];
                const inner = w >= 10 ? `${count}` : '';
                return `<div class="rank-dist__seg rank-dist__seg--${i + 1}" style="width:${w.toFixed(2)}%;" title="${i + 1}着 ${count} (${w.toFixed(0)}%)">${inner}</div>`;
            }).join('');

            // Counts row (always show all 4 with dim if zero)
            const counts = p.ranks.map((count, i) => {
                const zeroCls = count === 0 ? 'rank-dist__count--zero' : '';
                return `
                    <div class="rank-dist__count ${zeroCls}">
                        <span class="rank-dist__count-dot rank-dist__count-dot--${i + 1}"></span>
                        <span>${i + 1}着</span>
                        <span class="rank-dist__count-val">${count}</span>
                    </div>
                `;
            }).join('');

            return `
                <div class="rank-dist__row">
                    ${headHtml}
                    <div class="rank-dist__bar">${segs}</div>
                    <div class="rank-dist__counts">${counts}</div>
                </div>
            `;
        };

        return `<div class="rank-dist">${stats.map(rowHtml).join('')}</div>`;
    },

    switchChartMode: function (mode) {
        this.currentChartMode = mode;
        this.renderDetail(this.currentLeagueId, document.getElementById('league-section'));
    },

    // --- Helpers (rendering pieces) ---

    renderAvatarStack: function (players) {
        if (!players || players.length === 0) return '';
        const visible = players.slice(0, 6);
        const remain = players.length - visible.length;
        return `
            <div class="league-avatar-stack">
                <div class="league-avatar-stack__list">
                    ${visible.map(p => this.avatarHtml(p)).join('')}
                </div>
                <div class="league-avatar-stack__count">${players.length}名${remain > 0 ? ` (+${remain})` : ''}</div>
            </div>
        `;
    },

    renderSelfStats: function (self, rankIdx, diffFromTop) {
        const rank = rankIdx + 1;
        const scoreCls = self.score >= 0 ? 'league-self-stat__value--pos' : 'league-self-stat__value--neg';
        const scoreSign = self.score > 0 ? '+' : '';
        const diffLabel = rankIdx === 0 ? '首位' : `-${diffFromTop.toFixed(1)}`;
        return `
            <div class="league-self-stats">
                <div class="league-self-stat league-self-stat--highlight">
                    <div class="league-self-stat__label">自分の順位</div>
                    <div class="league-self-stat__value">${rank}<span class="league-self-stat__unit">位</span></div>
                </div>
                <div class="league-self-stat">
                    <div class="league-self-stat__label">累計スコア</div>
                    <div class="league-self-stat__value ${scoreCls}">${scoreSign}${self.score.toFixed(1)}</div>
                </div>
                <div class="league-self-stat">
                    <div class="league-self-stat__label">平均順位</div>
                    <div class="league-self-stat__value">${self.avgRank}</div>
                </div>
                <div class="league-self-stat">
                    <div class="league-self-stat__label">首位との差</div>
                    <div class="league-self-stat__value" style="font-size:0.95rem;">${diffLabel}</div>
                </div>
            </div>
        `;
    },

    renderPodium: function (stats, currentUser) {
        if (stats.length === 0) {
            return `<div class="league-empty" style="margin-top:8px;"><div>まだ対局がありません</div></div>`;
        }

        const top = stats[0];
        const second = stats[1];
        const third = stats[2];
        const rest = stats.slice(3);

        const topScoreSign = top.score > 0 ? '+' : '';

        const slotHtml = (player, medalIcon, slotCls) => {
            if (!player) return '<div class="league-podium__slot" style="visibility:hidden;"></div>';
            const sign = player.score > 0 ? '+' : '';
            const scoreCls = player.score >= 0 ? 'league-podium__slot-score--pos' : 'league-podium__slot-score--neg';
            return `
                <div class="league-podium__slot ${slotCls}">
                    <span class="league-podium__slot-medal">${medalIcon}</span>
                    ${this.avatarHtml(player.name)}
                    <div class="league-podium__slot-body">
                        <div class="league-podium__slot-name">${this.escape(player.name)}</div>
                        <div class="league-podium__slot-score ${scoreCls}">${sign}${player.score.toFixed(1)}</div>
                        <div class="league-podium__slot-meta">${player.games}戦</div>
                    </div>
                </div>
            `;
        };

        let html = `
            <div class="league-podium">
                <div class="league-podium__top">
                    <span class="league-podium__medal">🥇</span>
                    ${this.avatarHtml(top.name, 'lg')}
                    <div class="league-podium__top-body">
                        <div class="league-podium__top-name">${this.escape(top.name)}</div>
                        <div class="league-podium__top-score">${topScoreSign}${top.score.toFixed(1)}</div>
                        <div class="league-podium__top-meta">${top.games}戦 / 平均順位 ${top.avgRank}</div>
                    </div>
                </div>
        `;

        if (second || third) {
            html += `
                <div class="league-podium__row">
                    ${slotHtml(second, '🥈', 'league-podium__slot--silver')}
                    ${slotHtml(third, '🥉', 'league-podium__slot--bronze')}
                </div>
            `;
        }

        if (rest.length > 0) {
            html += `<div class="league-ranked-list">`;
            rest.forEach((p, i) => {
                const rank = i + 4;
                const isSelf = p.name === currentUser;
                const sign = p.score > 0 ? '+' : '';
                const scoreCls = p.score >= 0 ? 'league-ranked-row__score--pos' : 'league-ranked-row__score--neg';
                html += `
                    <div class="league-ranked-row ${isSelf ? 'league-ranked-row--self' : ''}">
                        <div class="league-ranked-row__rank">${rank}</div>
                        ${this.avatarHtml(p.name)}
                        <div class="league-ranked-row__name">${this.escape(p.name)}</div>
                        <div class="league-ranked-row__score ${scoreCls}">${sign}${p.score.toFixed(1)}</div>
                        <div class="league-ranked-row__games">${p.games}戦</div>
                    </div>
                `;
            });
            html += `</div>`;
        }

        html += `</div>`;
        return html;
    },

    // --- Hero card on list ---

    createHeroCard: function (league, sessions, currentUser) {
        const isPast = league.status === 'completed';
        const pillCls = isPast ? 'league-pill--completed' : 'league-pill--active';
        const pillText = isPast ? '終了' : '開催中';

        const stats = this.calculateLeagueStats(league, sessions);
        const top = stats[0];
        const selfIdx = stats.findIndex(s => s.name === currentUser);
        const selfStat = selfIdx >= 0 ? stats[selfIdx] : null;
        const diffFromTop = selfStat && selfIdx > 0 ? (top.score - selfStat.score) : 0;

        const recent5 = currentUser ? this.getRecentResults(sessions, currentUser, 5) : null;

        let rowsHtml = '';
        if (top && top.games > 0) {
            const topSign = top.score > 0 ? '+' : '';
            const topScoreCls = top.score >= 0 ? 'league-hero-row__score--pos' : 'league-hero-row__score--neg';
            rowsHtml += `
                <div class="league-hero-row league-hero-row--leader">
                    <div class="league-hero-row__badge">👑</div>
                    ${this.avatarHtml(top.name)}
                    <div class="league-hero-row__name">${this.escape(top.name)}</div>
                    <div class="league-hero-row__score ${topScoreCls}">${topSign}${top.score.toFixed(1)}</div>
                </div>
            `;
        }

        if (selfStat && selfStat.games > 0 && selfIdx > 0) {
            const selfSign = selfStat.score > 0 ? '+' : '';
            const selfScoreCls = selfStat.score >= 0 ? 'league-hero-row__score--pos' : 'league-hero-row__score--neg';
            rowsHtml += `
                <div class="league-hero-row league-hero-row--self">
                    <div class="league-hero-row__badge">${selfIdx + 1}位</div>
                    ${this.avatarHtml(selfStat.name)}
                    <div class="league-hero-row__name">あなた</div>
                    <div class="league-hero-row__score ${selfScoreCls}">${selfSign}${selfStat.score.toFixed(1)}</div>
                    <div class="league-hero-row__diff">-${diffFromTop.toFixed(1)}</div>
                </div>
            `;
        }

        // Recent 5 dots
        let recentHtml = '';
        if (recent5 && recent5.results.length > 0) {
            const sumSign = recent5.sum > 0 ? '+' : '';
            const sumCls = recent5.sum >= 0 ? 'league-hero-row__score--pos' : 'league-hero-row__score--neg';
            const dots = recent5.results.map(r => {
                if (r === 'top') return `<span class="league-recent__dot league-recent__dot--top">1</span>`;
                if (r === 'last') return `<span class="league-recent__dot league-recent__dot--last">4</span>`;
                return `<span class="league-recent__dot league-recent__dot--mid"></span>`;
            }).join('');
            recentHtml = `
                <div class="league-recent">
                    <span>直近${recent5.results.length}戦</span>
                    <span class="league-recent__dots">${dots}</span>
                    <span class="league-recent__sum ${sumCls}">${sumSign}${recent5.sum.toFixed(1)}</span>
                </div>
            `;
        }

        return `
            <div class="league-hero-card" onclick="League.renderDetail('${league.id}', document.getElementById('league-section'))">
                <div class="league-hero-card__head">
                    <div class="league-hero-card__trophy">🏆</div>
                    <div class="league-hero-card__title-wrap">
                        <h3 class="league-hero-card__title">${this.escape(league.title)}</h3>
                        <div class="league-hero-card__meta">📅 ${this.escape(this.formatRule(league.rule))}</div>
                    </div>
                    <span class="league-pill ${pillCls}">${pillText}</span>
                </div>
                ${this.renderAvatarStack(league.players)}
                ${this.createProgressSection(league, sessions.length)}
                ${rowsHtml ? `<div class="league-hero-card__rows">${rowsHtml}</div>` : ''}
                ${recentHtml}
            </div>
        `;
    },

    createPastRow: function (league) {
        const rule = this.formatRule(league.rule);
        return `
            <div class="league-past-row" onclick="League.renderDetail('${league.id}', document.getElementById('league-section'))">
                <span style="font-size:0.9rem;">🏆</span>
                <div class="league-past-row__title">${this.escape(league.title)}</div>
                <div class="league-past-row__date">${this.escape(rule)}</div>
                <span class="league-pill league-pill--completed">終了</span>
            </div>
        `;
    },

    // --- Stats calculation helpers ---

    // Compare sessions chronologically.
    // Primary: date ascending. Tie-breaker: session id ascending (creation order),
    // since session.id is a millisecond timestamp at create time.
    compareSessionsAsc: function (a, b) {
        const dateDiff = new Date(a.date) - new Date(b.date);
        if (dateDiff !== 0) return dateDiff;
        return (Number(a.id) || 0) - (Number(b.id) || 0);
    },

    // Get last N game results for a player across the league sessions
    // Returns { results: ['top'|'mid'|'last', ...], sum: number }
    // Order: oldest -> newest of the last N
    getRecentResults: function (sessions, playerName, limit = 5) {
        // Flatten games in chronological order
        const sortedSessions = [...sessions].sort((a, b) => this.compareSessionsAsc(a, b));
        const playerGames = []; // { rank, finalScore }
        sortedSessions.forEach(s => {
            s.games.forEach(g => {
                const rankedPlayers = [...g.players].sort((a, b) => b.finalScore - a.finalScore);
                const idx = rankedPlayers.findIndex(p => p.name === playerName);
                if (idx >= 0) {
                    playerGames.push({
                        rank: idx + 1,
                        finalScore: rankedPlayers[idx].finalScore
                    });
                }
            });
        });
        const recent = playerGames.slice(-limit);
        const results = recent.map(g => {
            if (g.rank === 1) return 'top';
            if (g.rank === 4) return 'last';
            return 'mid';
        });
        const sum = recent.reduce((acc, g) => acc + g.finalScore, 0);
        return { results, sum };
    },

    createProgressSection: function (league, currentCount) {
        if (!league.rule) return '';

        let label = '';
        let progress = 0;
        let total = 0;

        if (league.rule.type === 'count') {
            total = parseInt(league.rule.value);
            progress = total > 0 ? Math.min(100, (currentCount / total) * 100) : 0;
            label = `${currentCount} / ${total} 半荘`;
        } else if (league.rule.type === 'days') {
            return '';
        } else {
            // Period
            const end = new Date(league.rule.end);
            const now = new Date();
            const start = league.rule.start ? new Date(league.rule.start) : new Date((league.createdAt && league.createdAt.seconds) ? league.createdAt.seconds * 1000 : Date.now());

            const totalTime = end - start;
            const elapsed = now - start;
            progress = Math.min(100, Math.max(0, (elapsed / totalTime) * 100));
            label = `${new Date(league.rule.start).toLocaleDateString()} ~ ${new Date(league.rule.end).toLocaleDateString()}`;
        }

        return `
            <div class="league-progress">
                <div class="league-progress__label">
                    <span>進捗</span>
                    <span class="league-progress__value">${label}</span>
                </div>
                <div class="league-progress__bar">
                    <div class="league-progress__fill" style="width:${progress}%;"></div>
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
            numInput.value = '';
            periodInputs.style.display = 'flex';
        } else {
            numInput.style.display = 'block';
            periodInputs.style.display = 'none';
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

        let linkedCount = 0;
        if (ruleType === 'period' && newLeague && newLeague.id) {
            try {
                const sessions = await window.AppStorage.getSessions();
                const start = new Date(rule.start);
                const end = new Date(rule.end);
                end.setHours(23, 59, 59, 999);

                for (const sess of sessions) {
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
            alert('リーグから除外しました');
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
                maxScore: -Infinity,
                totalRawScore: 0
            };
        });

        sessions.forEach(s => {
            s.games.forEach(g => {
                const rankedPlayers = [...g.players].sort((a, b) => b.finalScore - a.finalScore);

                rankedPlayers.forEach((gp, idx) => {
                    if (stats[gp.name]) {
                        stats[gp.name].score += gp.finalScore;
                        stats[gp.name].games += 1;
                        stats[gp.name].ranks[idx]++;

                        if (gp.finalScore > stats[gp.name].maxScore) {
                            stats[gp.name].maxScore = gp.finalScore;
                        }

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

    createHistoryListHtml: function (sessions, league) {
        if (sessions.length === 0) return '<div style="color:#94a3b8;">まだ記録がありません</div>';

        const canEdit = this.isParticipant(league);
        // Date desc (newest day first), but within same date keep creation order asc
        const sortedSessions = [...sessions].sort((a, b) => {
            const dateDiff = new Date(b.date) - new Date(a.date);
            if (dateDiff !== 0) return dateDiff;
            return (Number(a.id) || 0) - (Number(b.id) || 0);
        });

        let html = '';
        for (const s of sortedSessions) {
            const dateStr = new Date(s.date).toLocaleDateString();

            // Calculate session totals
            const totals = {};
            const playerOrder = [];
            s.games.forEach(g => g.players.forEach(p => {
                if (!(p.name in totals)) playerOrder.push(p.name);
                totals[p.name] = (totals[p.name] || 0) + p.finalScore;
            }));

            const avatarsHtml = playerOrder.map(name => this.avatarHtml(name)).join('');
            const scoresHtml = playerOrder.map(name => {
                const score = totals[name];
                const cls = score >= 0 ? '#4ade80' : '#ef4444';
                const sign = score > 0 ? '+' : '';
                return `<span style="color:${cls}; white-space:nowrap;">${this.escape(name)}: ${sign}${Math.round(score)}</span>`;
            }).join('');

            html += `
                <div onclick="openSession(${s.id})" style="background: rgba(255,255,255,0.02); border-bottom: 1px solid #334155; padding: 10px; cursor: pointer; transition: background 0.2s; position: relative;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='rgba(255,255,255,0.02)'">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div style="font-size: 0.8rem; color: #94a3b8; margin-bottom: 5px;">${dateStr} (${s.games.length}戦)</div>
                        ${canEdit ? `<button onclick="League.unlinkSession('${s.id}', event); setTimeout(() => League.renderDetail('${league.id}', document.getElementById('league-section')), 100);" style="background: none; border: 1px solid #475569; color: #94a3b8; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; cursor: pointer;">除外</button>` : ''}
                    </div>
                    <div class="league-history-row__avatars">${avatarsHtml}</div>
                    <div style="display: flex; flex-wrap: wrap; gap: 10px; font-size: 0.9rem; margin-top: 6px;">${scoresHtml}</div>
                </div>
            `;
        }
        return html;
    },

    renderChart: function (stats, sessions, players, mode = 'game') {
        const ctx = document.getElementById('league-chart');
        if (!ctx) return;

        // Ensure datalabels plugin is registered (idempotent)
        if (typeof ChartDataLabels !== 'undefined' && !Chart.registry.plugins.get('datalabels')) {
            Chart.register(ChartDataLabels);
        }

        const existingChart = Chart.getChart(ctx);
        if (existingChart) existingChart.destroy();

        sessions.sort((a, b) => this.compareSessionsAsc(a, b));

        const datasets = players.map((p, i) => {
            const color = this.getColorForIndex(i);
            return {
                label: p,
                data: [0],
                borderColor: color,
                backgroundColor: color,
                fill: false,
                tension: 0.1,
                pointRadius: (ctx) => ctx.dataIndex === ctx.dataset.data.length - 1 ? 6 : 2,
                pointHoverRadius: (ctx) => ctx.dataIndex === ctx.dataset.data.length - 1 ? 8 : 4,
                pointBorderWidth: (ctx) => ctx.dataIndex === ctx.dataset.data.length - 1 ? 2 : 1,
                pointBackgroundColor: (ctx) => ctx.dataIndex === ctx.dataset.data.length - 1 ? color : '#0f172a',
                pointBorderColor: color
            };
        });

        let labels = ['Start'];
        let runningScores = {};
        players.forEach(p => runningScores[p] = 0);

        if (mode === 'session') {
            sessions.forEach((s) => {
                let sessionImpact = {};
                players.forEach(p => sessionImpact[p] = 0);

                s.games.forEach(g => {
                    g.players.forEach(gp => {
                        if (sessionImpact[gp.name] !== undefined) {
                            sessionImpact[gp.name] += gp.finalScore;
                        }
                    });
                });

                players.forEach(p => {
                    runningScores[p] += sessionImpact[p];
                });

                datasets.forEach(d => {
                    d.data.push(runningScores[d.label]);
                });

                const dateStr = new Date(s.date).toLocaleDateString();
                labels.push(`${dateStr}`);
            });

        } else {
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
                layout: {
                    padding: { right: 18 }
                },
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
                        intersect: false,
                        callbacks: {
                            title: (items) => {
                                if (!items.length) return '';
                                const lbl = String(items[0].label);
                                return /^\d+$/.test(lbl) ? `第 ${lbl} 戦` : lbl;
                            },
                            label: (item) => `${item.dataset.label}: ${item.parsed.y > 0 ? '+' : ''}${item.parsed.y.toFixed(1)}`
                        }
                    }
                }
            }
        });
    },


    getColorForIndex: function (index) {
        const colors = [
            '#ef4444',
            '#3b82f6',
            '#10b981',
            '#f59e0b',
            '#8b5cf6',
            '#ec4899',
            '#06b6d4',
            '#f97316',
            '#84cc16',
            '#14b8a6',
            '#6366f1',
            '#d946ef'
        ];
        return colors[index % colors.length];
    }
};
