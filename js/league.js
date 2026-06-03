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

        // Advanced analytics (Tier 1 features) — computed once, cached for radar/share.
        const adv = this.computeAdvanced(league, leagueSessions);
        this._style = this.computeStyleMetrics(stats, adv);
        this._adv = adv;
        this._lastLeague = league;
        this._lastSessions = leagueSessions;
        this._lastStats = stats;
        const styleDefault = this._style.active.includes(currentUser)
            ? currentUser
            : (this._style.active[0] || null);

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
                ${adv.totalGames > 0 ? `<button onclick="League.shareSeasonImage()" class="league-detail-toolbar__share">📸 シェア</button>` : ''}
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

            <!-- Title race & comeback simulator -->
            ${this.renderTitleRace(league, stats, adv)}

            <!-- Rivalry map -->
            ${this.renderRivalry(league, stats, adv, currentUser)}

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

            <!-- Play-style diagnosis -->
            ${this.renderPlayStyle(styleDefault)}

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

        // Render play-style radar for the default player
        if (styleDefault) this.renderStyleRadar(styleDefault);
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
            <dialog id="create-league-modal" class="lc-modal">
                <div class="lc-modal__head">
                    <span class="lc-modal__head-icon">🏆</span>
                    <h3 class="lc-modal__title">新しいリーグを作成</h3>
                    <button type="button" class="lc-modal__close" onclick="document.getElementById('create-league-modal').close()" aria-label="閉じる">✕</button>
                </div>

                <div class="lc-modal__body">
                    <!-- リーグ名 -->
                    <div class="lc-field">
                        <div class="lc-field__label-row">
                            <label class="lc-field__label" for="league-title-input">リーグ名</label>
                        </div>
                        <input type="text" id="league-title-input" class="lc-input" placeholder="例: 2026年 第1期リーグ" oninput="League.updatePreview()">
                        <div class="lc-error" id="league-title-error">リーグ名を入力してください</div>
                    </div>

                    <!-- 参加メンバー -->
                    <div class="lc-field">
                        <div class="lc-field__label-row">
                            <label class="lc-field__label">参加メンバー</label>
                            <span class="lc-count-badge" id="league-member-count">0名選択中</span>
                        </div>
                        <div class="lc-chips" id="league-member-chips">
                            <span class="lc-chips__empty">下から4〜20名を選択してください</span>
                        </div>
                        <div class="lc-search">
                            <span class="lc-search__icon">🔍</span>
                            <input type="text" id="league-member-search" class="lc-input" placeholder="メンバーを検索…" oninput="League.filterMembers(this.value)">
                        </div>
                        <div id="league-player-select" class="lc-members">
                            <!-- JS populated -->
                        </div>
                        <div class="lc-error" id="league-member-error">メンバーは4名以上選択してください</div>
                    </div>

                    <!-- 終了条件 -->
                    <div class="lc-field">
                        <div class="lc-field__label-row">
                            <label class="lc-field__label">終了条件</label>
                        </div>
                        <div class="lc-seg" id="league-rule-seg">
                            <button type="button" class="lc-seg__btn lc-seg__btn--active" data-rule="count" onclick="League.setRuleType('count')">半荘数</button>
                            <button type="button" class="lc-seg__btn" data-rule="period" onclick="League.setRuleType('period')">期間</button>
                        </div>

                        <!-- 半荘数 -->
                        <div id="league-rule-count-input" class="lc-rule-suffix">
                            <input type="number" id="league-rule-value-num" class="lc-input" placeholder="例: 50" min="1" oninput="League.updatePreview()">
                            <span class="lc-rule-suffix__unit">半荘で終了</span>
                        </div>

                        <!-- 期間 -->
                        <div id="league-rule-period-inputs" class="lc-rule-period" style="display: none;">
                            <input type="date" id="league-rule-value-start-date" class="lc-input" title="開始日" oninput="League.updatePreview()">
                            <span class="lc-rule-period__sep">~</span>
                            <input type="date" id="league-rule-value-end-date" class="lc-input" title="終了日" oninput="League.updatePreview()">
                        </div>
                        <div class="lc-error" id="league-rule-error"></div>
                    </div>

                    <!-- プレビュー -->
                    <div class="lc-preview">
                        <div class="lc-preview__head">
                            <span>🏆</span>
                            <span class="lc-preview__title lc-preview__title--placeholder" id="league-preview-title">リーグ名未入力</span>
                        </div>
                        <div class="lc-preview__meta">
                            <span id="league-preview-members">👥 0名</span>
                            <span id="league-preview-rule">📅 終了条件 未設定</span>
                        </div>
                    </div>
                </div>

                <div class="lc-footer">
                    <button type="button" onclick="document.getElementById('create-league-modal').close()" class="btn-secondary">キャンセル</button>
                    <button type="button" id="league-create-submit" onclick="League.submitCreate()" class="lc-btn-create" disabled>作成</button>
                </div>
            </dialog>
        `;
    },

    // --- Logic ---

    // --- Create modal state ---
    _allUsers: [],
    _selectedMembers: [],
    _ruleType: 'count',

    showCreateModal: async function () {
        const modal = document.getElementById('create-league-modal');

        // Reset state
        this._selectedMembers = [];
        this._ruleType = 'count';

        // Reset inputs
        document.getElementById('league-title-input').value = '';
        document.getElementById('league-member-search').value = '';
        document.getElementById('league-rule-value-num').value = '';
        document.getElementById('league-rule-value-start-date').value = '';
        document.getElementById('league-rule-value-end-date').value = '';
        this.setRuleType('count');
        this.clearError('league-title-error', 'league-title-input');
        this.clearError('league-member-error');
        this.clearError('league-rule-error');

        // Load users + their avatars
        this._allUsers = await window.AppStorage.getUsers();
        await this.ensureAvatars(this._allUsers);

        this.renderMemberTiles('');
        this.renderChips();
        this.updateMemberCount();
        this.updatePreview();

        modal.showModal();
    },

    // Build the member tile grid, optionally filtered by query
    renderMemberTiles: function (query) {
        const container = document.getElementById('league-player-select');
        if (!container) return;
        const q = (query || '').trim().toLowerCase();
        const list = this._allUsers.filter(u => !q || String(u).toLowerCase().includes(q));

        if (list.length === 0) {
            container.innerHTML = `<div class="lc-members__empty">${q ? '該当するメンバーがいません' : 'メンバーがいません'}</div>`;
            return;
        }

        container.innerHTML = list.map(u => {
            const selected = this._selectedMembers.includes(u);
            return `
                <div class="lc-member ${selected ? 'lc-member--selected' : ''}" data-name="${this.escape(u)}" onclick="League.toggleMember('${this.escapeAttr(u)}')">
                    ${this.avatarHtml(u)}
                    <span class="lc-member__name">${this.escape(u)}</span>
                    <span class="lc-member__check">✓</span>
                </div>
            `;
        }).join('');
    },

    filterMembers: function (query) {
        this.renderMemberTiles(query);
    },

    toggleMember: function (name) {
        const idx = this._selectedMembers.indexOf(name);
        if (idx >= 0) {
            this._selectedMembers.splice(idx, 1);
        } else {
            this._selectedMembers.push(name);
        }
        // Re-render the tile state without losing the current search filter
        const search = document.getElementById('league-member-search');
        this.renderMemberTiles(search ? search.value : '');
        this.renderChips();
        this.updateMemberCount();
        this.updatePreview();
        if (this._selectedMembers.length >= 4) this.clearError('league-member-error');
    },

    removeMember: function (name) {
        const idx = this._selectedMembers.indexOf(name);
        if (idx >= 0) this._selectedMembers.splice(idx, 1);
        const search = document.getElementById('league-member-search');
        this.renderMemberTiles(search ? search.value : '');
        this.renderChips();
        this.updateMemberCount();
        this.updatePreview();
    },

    renderChips: function () {
        const chips = document.getElementById('league-member-chips');
        if (!chips) return;
        if (this._selectedMembers.length === 0) {
            chips.innerHTML = `<span class="lc-chips__empty">下から4名以上を選択してください</span>`;
            return;
        }
        chips.innerHTML = this._selectedMembers.map(name => `
            <span class="lc-chip">
                ${this.avatarHtml(name)}
                <span>${this.escape(name)}</span>
                <button type="button" class="lc-chip__remove" onclick="League.removeMember('${this.escapeAttr(name)}')" aria-label="${this.escape(name)} を外す">✕</button>
            </span>
        `).join('');
    },

    updateMemberCount: function () {
        const badge = document.getElementById('league-member-count');
        const submit = document.getElementById('league-create-submit');
        const n = this._selectedMembers.length;
        const ok = n >= 4;
        if (badge) {
            badge.textContent = `${n}名選択中`;
            badge.classList.toggle('lc-count-badge--ok', ok);
        }
        if (submit) submit.disabled = !this.isFormValid();
    },

    setRuleType: function (type) {
        this._ruleType = type;
        const seg = document.getElementById('league-rule-seg');
        if (seg) {
            seg.querySelectorAll('.lc-seg__btn').forEach(btn => {
                btn.classList.toggle('lc-seg__btn--active', btn.dataset.rule === type);
            });
        }
        const countInput = document.getElementById('league-rule-count-input');
        const periodInputs = document.getElementById('league-rule-period-inputs');
        if (type === 'period') {
            if (countInput) countInput.style.display = 'none';
            if (periodInputs) periodInputs.style.display = 'flex';
        } else {
            if (countInput) countInput.style.display = 'flex';
            if (periodInputs) periodInputs.style.display = 'none';
        }
        this.clearError('league-rule-error');
        this.updatePreview();
    },

    // Backwards-compat alias (in case anything else calls it)
    toggleRuleInput: function () {
        this.setRuleType(this._ruleType === 'period' ? 'count' : 'period');
    },

    // Live preview card
    updatePreview: function () {
        const title = (document.getElementById('league-title-input')?.value || '').trim();
        const titleEl = document.getElementById('league-preview-title');
        if (titleEl) {
            if (title) {
                titleEl.textContent = title;
                titleEl.classList.remove('lc-preview__title--placeholder');
            } else {
                titleEl.textContent = 'リーグ名未入力';
                titleEl.classList.add('lc-preview__title--placeholder');
            }
        }

        const membersEl = document.getElementById('league-preview-members');
        if (membersEl) membersEl.textContent = `👥 ${this._selectedMembers.length}名`;

        const ruleEl = document.getElementById('league-preview-rule');
        if (ruleEl) {
            let ruleText = '📅 終了条件 未設定';
            if (this._ruleType === 'count') {
                const v = document.getElementById('league-rule-value-num')?.value;
                if (v) ruleText = `📅 全 ${v} 半荘`;
            } else {
                const s = document.getElementById('league-rule-value-start-date')?.value;
                const e = document.getElementById('league-rule-value-end-date')?.value;
                if (s && e) {
                    ruleText = `📅 ${new Date(s).toLocaleDateString()} ~ ${new Date(e).toLocaleDateString()}`;
                }
            }
            ruleEl.textContent = ruleText;
        }

        const submit = document.getElementById('league-create-submit');
        if (submit) submit.disabled = !this.isFormValid();
    },

    isFormValid: function () {
        const title = (document.getElementById('league-title-input')?.value || '').trim();
        if (!title) return false;
        if (this._selectedMembers.length < 4) return false;
        if (this._ruleType === 'count') {
            const v = document.getElementById('league-rule-value-num')?.value;
            if (!v || Number(v) < 1) return false;
        } else {
            const s = document.getElementById('league-rule-value-start-date')?.value;
            const e = document.getElementById('league-rule-value-end-date')?.value;
            if (!s || !e || s > e) return false;
        }
        return true;
    },

    showError: function (errorId, inputId) {
        const err = document.getElementById(errorId);
        if (err) err.classList.add('lc-error--show');
        if (inputId) {
            const input = document.getElementById(inputId);
            if (input) input.classList.add('lc-input--error');
        }
    },

    clearError: function (errorId, inputId) {
        const err = document.getElementById(errorId);
        if (err) err.classList.remove('lc-error--show');
        if (inputId) {
            const input = document.getElementById(inputId);
            if (input) input.classList.remove('lc-input--error');
        }
    },

    // Escape a string for safe use inside a single-quoted JS string in an inline handler
    escapeAttr: function (s) {
        return String(s ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    },

    submitCreate: async function () {
        const title = document.getElementById('league-title-input').value.trim();
        const players = [...this._selectedMembers];
        const ruleType = this._ruleType;
        const rule = { type: ruleType };

        // Inline validation
        let valid = true;
        this.clearError('league-title-error', 'league-title-input');
        this.clearError('league-member-error');
        this.clearError('league-rule-error');

        if (!title) {
            this.showError('league-title-error', 'league-title-input');
            valid = false;
        }
        if (players.length < 4) {
            this.showError('league-member-error');
            valid = false;
        }

        if (ruleType === 'period') {
            const start = document.getElementById('league-rule-value-start-date').value;
            const end = document.getElementById('league-rule-value-end-date').value;
            const ruleErr = document.getElementById('league-rule-error');
            if (!start || !end) {
                if (ruleErr) ruleErr.textContent = '期間（開始日・終了日）を入力してください';
                this.showError('league-rule-error');
                valid = false;
            } else if (start > end) {
                if (ruleErr) ruleErr.textContent = '開始日は終了日より前にしてください';
                this.showError('league-rule-error');
                valid = false;
            } else {
                rule.start = start;
                rule.end = end;
            }
        } else {
            const val = document.getElementById('league-rule-value-num').value;
            const ruleErr = document.getElementById('league-rule-error');
            if (!val || Number(val) < 1) {
                if (ruleErr) ruleErr.textContent = '半荘数を入力してください';
                this.showError('league-rule-error');
                valid = false;
            } else {
                rule.value = val;
            }
        }

        if (!valid) return;

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


    // ============================================================
    //  Advanced analytics (Tier 1 features)
    // ============================================================

    // Walk every game once and derive: pairwise head-to-head, per-player
    // finalScore list, max single-game swing, leader timeline, biggest hit.
    computeAdvanced: function (league, sessions) {
        const players = league.players || [];
        const h2h = {};         // h2h[a][b] = { win, loss }
        const scoreList = {};   // name -> [finalScore, ...]
        players.forEach(p => { h2h[p] = {}; scoreList[p] = []; });

        const sorted = [...sessions].sort((x, y) => this.compareSessionsAsc(x, y));
        const flatGames = [];
        sorted.forEach(s => (s.games || []).forEach(g => flatGames.push(g)));

        let maxSwing = 0;
        let maxHit = { name: null, score: -Infinity };
        const running = {};
        players.forEach(p => running[p] = 0);
        const leadTimeline = []; // { game: idx(1-based), leader }
        let prevLeader = null;

        flatGames.forEach((g, gi) => {
            const ranked = [...g.players].sort((a, b) => b.finalScore - a.finalScore);
            if (ranked.length) {
                const sw = ranked[0].finalScore - ranked[ranked.length - 1].finalScore;
                if (sw > maxSwing) maxSwing = sw;
            }
            // head-to-head: every higher-ranked player beats every lower one
            for (let i = 0; i < ranked.length; i++) {
                for (let j = i + 1; j < ranked.length; j++) {
                    const hi = ranked[i].name, lo = ranked[j].name;
                    if (!h2h[hi] || !h2h[lo]) continue; // league members only
                    h2h[hi][lo] = h2h[hi][lo] || { win: 0, loss: 0 };
                    h2h[lo][hi] = h2h[lo][hi] || { win: 0, loss: 0 };
                    h2h[hi][lo].win++;
                    h2h[lo][hi].loss++;
                }
            }
            g.players.forEach(gp => {
                if (scoreList[gp.name]) scoreList[gp.name].push(gp.finalScore);
                if (running[gp.name] !== undefined) running[gp.name] += gp.finalScore;
                if (gp.finalScore > maxHit.score) maxHit = { name: gp.name, score: gp.finalScore };
            });
            // current leader among players who have played at least once
            let leader = null, best = -Infinity;
            players.forEach(p => {
                if (scoreList[p].length > 0 && running[p] > best) { best = running[p]; leader = p; }
            });
            if (leader && leader !== prevLeader) {
                leadTimeline.push({ game: gi + 1, leader });
                prevLeader = leader;
            }
        });

        return { h2h, scoreList, maxSwing, maxHit, leadTimeline, totalGames: flatGames.length };
    },

    stdev: function (arr) {
        if (!arr || arr.length < 2) return 0;
        const m = arr.reduce((a, b) => a + b, 0) / arr.length;
        const v = arr.reduce((a, b) => a + (b - m) * (b - m), 0) / arr.length;
        return Math.sqrt(v);
    },

    // Most-contested opponent for a given player: many shared games + even record.
    findRival: function (focus, h2h) {
        const table = h2h[focus];
        if (!table) return null;
        let best = null, bestScore = -Infinity;
        Object.keys(table).forEach(o => {
            const r = table[o];
            const total = r.win + r.loss;
            if (total < 1) return;
            const score = total - Math.abs(r.win - r.loss); // favor many + balanced
            if (score > bestScore) { bestScore = score; best = { name: o, win: r.win, loss: r.loss, total }; }
        });
        return best;
    },

    // League-wide most-contested pair (for the share card).
    leagueRivalPair: function (h2h, players) {
        let best = null, bestScore = -Infinity;
        for (let i = 0; i < players.length; i++) {
            for (let j = i + 1; j < players.length; j++) {
                const a = players[i], b = players[j];
                const r = h2h[a] && h2h[a][b];
                if (!r) continue;
                const total = r.win + r.loss;
                if (total < 2) continue;
                const score = total - Math.abs(r.win - r.loss);
                if (score > bestScore) { bestScore = score; best = { a, b, aWin: r.win, bWin: r.loss, total }; }
            }
        }
        return best;
    },

    // ---------- Feature 1: Rivalry map ----------

    renderRivalry: function (league, stats, adv, currentUser) {
        if (adv.totalGames === 0) return '';
        const players = (league.players || []);
        const active = stats.filter(s => s.games > 0);
        if (active.length < 2) return '';

        // Focus = current user if they actually played, else the leader.
        const focus = active.some(s => s.name === currentUser) ? currentUser : active[0].name;
        const rival = this.findRival(focus, adv.h2h);

        let rivalCard = '';
        if (rival) {
            const focusStat = stats.find(s => s.name === focus);
            const rivalStat = stats.find(s => s.name === rival.name);
            const scoreDiff = focusStat && rivalStat ? (focusStat.score - rivalStat.score) : 0;
            const diffSign = scoreDiff > 0 ? '+' : '';
            const wl = rival.win > rival.loss ? 'rival-card__wl--win' : (rival.win < rival.loss ? 'rival-card__wl--lose' : '');
            rivalCard = `
                <div class="rival-card">
                    <div class="rival-card__head">⚔️ ${this.escape(focus === currentUser ? 'あなた' : focus)} の宿命のライバル</div>
                    <div class="rival-card__vs">
                        <div class="rival-card__side">
                            ${this.avatarHtml(focus, 'lg')}
                            <span class="rival-card__name">${this.escape(focus)}</span>
                        </div>
                        <div class="rival-card__center">
                            <div class="rival-card__record ${wl}">${rival.win} <span>勝</span> ${rival.loss} <span>敗</span></div>
                            <div class="rival-card__meta">同卓 ${rival.total} 局 ・ スコア差 ${diffSign}${scoreDiff.toFixed(1)}</div>
                        </div>
                        <div class="rival-card__side">
                            ${this.avatarHtml(rival.name, 'lg')}
                            <span class="rival-card__name">${this.escape(rival.name)}</span>
                        </div>
                    </div>
                </div>
            `;
        }

        // Head-to-head matrix (row beats column). Win=green, loss=red.
        const names = active.map(s => s.name);
        const headCols = names.map(n => `<th class="h2h__col">${this.avatarHtml(n)}</th>`).join('');
        const bodyRows = names.map(rowName => {
            const cells = names.map(colName => {
                if (rowName === colName) return `<td class="h2h__cell h2h__cell--self">—</td>`;
                const r = adv.h2h[rowName] && adv.h2h[rowName][colName];
                if (!r || (r.win + r.loss) === 0) return `<td class="h2h__cell h2h__cell--none">·</td>`;
                const cls = r.win > r.loss ? 'h2h__cell--win' : (r.win < r.loss ? 'h2h__cell--lose' : 'h2h__cell--even');
                return `<td class="h2h__cell ${cls}" title="${this.escape(rowName)} vs ${this.escape(colName)}: ${r.win}勝${r.loss}敗">${r.win}-${r.loss}</td>`;
            }).join('');
            return `<tr><th class="h2h__row">${this.avatarHtml(rowName)}<span>${this.escape(rowName)}</span></th>${cells}</tr>`;
        }).join('');

        return `
            <h3 class="league-section-title">⚔️ ライバル関係</h3>
            ${rivalCard}
            <div class="h2h-wrap">
                <div class="h2h-scroll">
                    <table class="h2h">
                        <thead><tr><th class="h2h__corner">勝-敗</th>${headCols}</tr></thead>
                        <tbody>${bodyRows}</tbody>
                    </table>
                </div>
                <div class="h2h__legend">行が列に対する成績（<span class="h2h__legend-dot h2h__legend-dot--win"></span>勝ち越し / <span class="h2h__legend-dot h2h__legend-dot--lose"></span>負け越し）</div>
            </div>
        `;
    },

    // ---------- Feature 2: Title race & comeback simulator ----------

    renderTitleRace: function (league, stats, adv) {
        if (!stats.length || adv.totalGames === 0) return '';
        const leader = stats[0];
        const rule = league.rule || {};
        const maxSwing = adv.maxSwing > 0 ? adv.maxSwing : 50;

        let remainingGames = null;
        let remainHtml = '';
        if (rule.type === 'count') {
            const target = parseInt(rule.value) || 0;
            remainingGames = Math.max(0, target - adv.totalGames);
            remainHtml = `<div class="title-race__remain"><span>残り</span><strong>${remainingGames}</strong><span>半荘</span></div>`;
        } else if (rule.type === 'period' && rule.end) {
            const end = new Date(rule.end); end.setHours(23, 59, 59, 999);
            const days = Math.max(0, Math.ceil((end - new Date()) / (1000 * 60 * 60 * 24)));
            remainHtml = `<div class="title-race__remain"><span>残り</span><strong>${days}</strong><span>日</span></div>`;
        }

        const rows = stats.slice(0, 5).map((p, i) => {
            const gap = leader.score - p.score;
            let status = '', statusCls = '';
            if (i === 0) {
                const second = stats[1];
                if (remainingGames !== null && second && (remainingGames === 0 || (leader.score - second.score) > remainingGames * maxSwing)) {
                    status = '👑 優勝確定'; statusCls = 'title-race__status--clinched';
                } else {
                    status = '首位'; statusCls = 'title-race__status--leader';
                }
            } else if (remainingGames !== null) {
                if (remainingGames === 0 || gap > remainingGames * maxSwing) {
                    status = '可能性なし'; statusCls = 'title-race__status--out';
                } else {
                    status = `逆転まで実質${Math.ceil(gap / maxSwing)}戦`; statusCls = 'title-race__status--alive';
                }
            } else {
                status = '逆転圏内'; statusCls = 'title-race__status--alive';
            }
            const sign = p.score > 0 ? '+' : '';
            const totalCls = p.score >= 0 ? 'title-race__total--pos' : 'title-race__total--neg';
            const behindHtml = i === 0
                ? `<span class="title-race__behind title-race__behind--leader">— トップ —</span>`
                : `<span class="title-race__behind">首位差 <b>-${gap.toFixed(1)}</b></span>`;
            return `
                <div class="title-race__row">
                    <span class="title-race__rank">${i + 1}</span>
                    ${this.avatarHtml(p.name)}
                    <span class="title-race__name">${this.escape(p.name)}</span>
                    <span class="title-race__scores">
                        <span class="title-race__total ${totalCls}">${sign}${p.score.toFixed(1)}</span>
                        ${behindHtml}
                    </span>
                    <span class="title-race__status ${statusCls}">${status}</span>
                </div>
            `;
        }).join('');

        // Leader timeline strip
        let timelineHtml = '';
        if (adv.leadTimeline.length <= 1) {
            const only = adv.leadTimeline[0];
            timelineHtml = only ? `<div class="lead-timeline__solo">🏁 第${only.game}戦からずっと <b>${this.escape(only.leader)}</b> が首位</div>` : '';
        } else {
            const items = adv.leadTimeline.map((t, idx) => {
                const next = adv.leadTimeline[idx + 1];
                const range = next ? `${t.game}〜${next.game - 1}戦` : `${t.game}戦〜`;
                return `<div class="lead-timeline__node"><span class="lead-timeline__leader">${this.escape(t.leader)}</span><span class="lead-timeline__range">${range}</span></div>`;
            }).join('<span class="lead-timeline__arrow">→</span>');
            timelineHtml = `<div class="lead-timeline"><div class="lead-timeline__title">首位の変遷</div><div class="lead-timeline__track">${items}</div></div>`;
        }

        return `
            <h3 class="league-section-title">🏁 優勝レース</h3>
            <div class="title-race">
                <div class="title-race__head">
                    ${remainHtml}
                    <div class="title-race__note">大きい数字は<b>累計スコア</b>。状況欄は最大変動 ${maxSwing.toFixed(1)} と残り試合からの逆転可能性の目安です。</div>
                </div>
                <div class="title-race__col-caption">
                    <span>順位・プレイヤー</span>
                    <span>累計スコア / 首位差</span>
                </div>
                <div class="title-race__list">${rows}</div>
                ${timelineHtml}
            </div>
        `;
    },

    // ---------- Feature 3: Play-style radar + archetype ----------

    computeStyleMetrics: function (stats, adv) {
        const active = stats.filter(s => s.games > 0);
        const raw = {};
        active.forEach(s => {
            raw[s.name] = {
                power: s.maxScore === -Infinity ? 0 : s.maxScore,
                stability: -this.stdev(adv.scoreList[s.name] || []), // higher (closer to 0) = more stable
                rentai: parseFloat(s.rentaiRate) || 0,
                avoidLast: parseFloat(s.avoidLastRate) || 0,
                top: parseFloat(s.topRate) || 0
            };
        });
        const keys = ['power', 'stability', 'rentai', 'avoidLast', 'top'];
        const minmax = {};
        keys.forEach(k => {
            const vals = active.map(s => raw[s.name][k]);
            minmax[k] = { min: Math.min(...vals), max: Math.max(...vals) };
        });
        const norm = {}, archetype = {};
        active.forEach(s => {
            const n = {};
            keys.forEach(k => {
                const { min, max } = minmax[k];
                n[k] = (max === min) ? 50 : ((raw[s.name][k] - min) / (max - min)) * 100;
            });
            norm[s.name] = n;
            archetype[s.name] = this.pickArchetype(n);
        });
        return { raw, norm, archetype, active: active.map(s => s.name) };
    },

    pickArchetype: function (n) {
        if (n.power >= 66 && n.stability <= 40) return { icon: '💥', label: '一発逆転型' };
        if (n.stability >= 66 && n.avoidLast >= 55) return { icon: '🛡️', label: '鉄壁の安定型' };
        if (n.top >= 66) return { icon: '⚔️', label: '攻めの大将' };
        if (n.rentai >= 66) return { icon: '📈', label: 'コンスタント型' };
        if (n.avoidLast >= 66) return { icon: '🧱', label: '粘りの守備型' };
        return { icon: '🎯', label: 'オールラウンダー' };
    },

    renderPlayStyle: function (defaultName) {
        if (!this._style || this._style.active.length === 0) return '';
        const options = this._style.active.map(n =>
            `<option value="${this.escapeAttr(n)}" ${n === defaultName ? 'selected' : ''}>${this.escape(n)}</option>`
        ).join('');
        return `
            <h3 class="league-section-title">🎯 プレイスタイル診断</h3>
            <div class="playstyle">
                <div class="playstyle__bar">
                    <select id="league-style-select" class="playstyle__select" onchange="League.renderStyleRadar(this.value)">${options}</select>
                    <span class="playstyle__archetype" id="league-style-archetype"></span>
                </div>
                <div class="playstyle__chart"><canvas id="league-style-radar"></canvas></div>
                <div class="playstyle__hint">各指標はリーグ内の相対値（0〜100）で表示しています。</div>
            </div>
        `;
    },

    renderStyleRadar: function (name) {
        const ctx = document.getElementById('league-style-radar');
        if (!ctx || !this._style || !this._style.norm[name]) return;
        const existing = Chart.getChart(ctx);
        if (existing) existing.destroy();
        const n = this._style.norm[name];
        new Chart(ctx, {
            type: 'radar',
            data: {
                labels: ['火力', '安定感', '連対力', 'ラス回避', '攻撃力'],
                datasets: [{
                    label: name,
                    data: [n.power, n.stability, n.rentai, n.avoidLast, n.top],
                    backgroundColor: 'rgba(187, 134, 252, 0.25)',
                    borderColor: '#bb86fc',
                    borderWidth: 2,
                    pointBackgroundColor: '#bb86fc',
                    pointRadius: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, datalabels: { display: false } },
                scales: {
                    r: {
                        min: 0, max: 100,
                        ticks: { display: false, stepSize: 25 },
                        grid: { color: '#334155' },
                        angleLines: { color: '#334155' },
                        pointLabels: { color: '#cbd5e1', font: { size: 12 } }
                    }
                }
            }
        });
        const arch = this._style.archetype[name];
        const badge = document.getElementById('league-style-archetype');
        if (badge && arch) badge.textContent = `${arch.icon} ${arch.label}`;
    },

    // ---------- Feature 4: Season "Wrapped" share card ----------

    shareSeasonImage: async function () {
        if (typeof html2canvas === 'undefined') {
            alert('画像生成ライブラリが読み込まれていません。再読み込みしてください。');
            return;
        }
        const league = this._lastLeague;
        const stats = this._lastStats;
        const adv = this._adv;
        if (!league || !stats || !adv || adv.totalGames === 0) {
            alert('まだ集計できる対局がありません。');
            return;
        }

        const champion = stats[0];
        const rivalPair = this.leagueRivalPair(adv.h2h, (league.players || []).filter(p => (adv.scoreList[p] || []).length > 0));
        const top3 = stats.slice(0, 3);

        const card = document.createElement('div');
        Object.assign(card.style, {
            position: 'fixed', top: '0', left: '0', width: '1080px', height: '1920px',
            zIndex: '-9999', background: '#0f172a', color: '#fff',
            fontFamily: "'Inter', sans-serif", padding: '90px 70px', boxSizing: 'border-box',
            display: 'flex', flexDirection: 'column',
            backgroundImage: 'radial-gradient(circle at top right, rgba(187,134,252,0.25), transparent 45%), radial-gradient(circle at bottom left, rgba(3,218,198,0.18), transparent 45%)'
        });

        const fmtScore = (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}`;
        const medal = ['🥇', '🥈', '🥉'];

        card.innerHTML = `
            <div style="border-bottom: 3px solid #334155; padding-bottom: 36px;">
                <div style="font-size: 1.9rem; color: #94a3b8; letter-spacing: 6px; font-weight: 600;">LEAGUE WRAPPED</div>
                <div style="font-size: 4.2rem; font-weight: 900; margin-top: 14px; line-height: 1.15;">${this.escape(league.title)}</div>
                <div style="font-size: 1.7rem; color: #cbd5e1; margin-top: 16px;">📅 ${this.escape(this.formatRule(league.rule))} ・ 👥 ${league.players.length}名 ・ 🀄 全${adv.totalGames}戦</div>
            </div>

            <div style="margin-top: 60px; background: linear-gradient(135deg, rgba(251,191,36,0.18), rgba(187,134,252,0.12)); border: 2px solid rgba(251,191,36,0.5); border-radius: 28px; padding: 44px 50px;">
                <div style="font-size: 1.6rem; color: #fbbf24; letter-spacing: 3px; font-weight: 700;">👑 CHAMPION</div>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 18px;">
                    <div style="font-size: 4rem; font-weight: 900;">${this.escape(champion.name)}</div>
                    <div style="font-size: 3.4rem; font-weight: 800; color: ${champion.score >= 0 ? '#4ade80' : '#f87171'};">${fmtScore(champion.score)}</div>
                </div>
                <div style="font-size: 1.5rem; color: #cbd5e1; margin-top: 8px;">${champion.games}戦 ・ 平均順位 ${champion.avgRank} ・ トップ率 ${champion.topRate}</div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 44px;">
                <div style="background: rgba(30,41,59,0.6); border: 2px solid #334155; border-radius: 24px; padding: 36px;">
                    <div style="font-size: 1.4rem; color: #94a3b8;">💥 最大の一撃</div>
                    <div style="font-size: 3rem; font-weight: 900; color: #4ade80; margin-top: 12px;">${adv.maxHit.score > 0 ? '+' : ''}${adv.maxHit.score.toFixed(1)}</div>
                    <div style="font-size: 1.7rem; margin-top: 6px;">${this.escape(adv.maxHit.name || '-')}</div>
                </div>
                <div style="background: rgba(30,41,59,0.6); border: 2px solid #334155; border-radius: 24px; padding: 36px;">
                    <div style="font-size: 1.4rem; color: #94a3b8;">⚔️ 宿命のライバル</div>
                    ${rivalPair
                        ? `<div style="font-size: 2.1rem; font-weight: 800; margin-top: 12px; line-height:1.3;">${this.escape(rivalPair.a)}<br>vs ${this.escape(rivalPair.b)}</div>
                           <div style="font-size: 1.5rem; color:#cbd5e1; margin-top: 8px;">通算 ${rivalPair.aWin}-${rivalPair.bWin}（${rivalPair.total}局）</div>`
                        : `<div style="font-size: 1.6rem; color:#64748b; margin-top: 16px;">データ不足</div>`}
                </div>
            </div>

            <div style="margin-top: 48px; flex-grow: 1;">
                <div style="font-size: 1.5rem; color: #cbd5e1; border-left: 6px solid #a78bfa; padding-left: 18px; font-weight: bold;">FINAL STANDINGS (TOP 3)</div>
                ${top3.map((p, i) => `
                    <div style="display:flex; align-items:center; justify-content:space-between; background: rgba(30,41,59,0.5); border:2px solid #334155; border-radius:18px; padding: 26px 36px; margin-top: 20px;">
                        <div style="display:flex; align-items:center; gap: 26px;">
                            <span style="font-size: 2.6rem;">${medal[i]}</span>
                            <span style="font-size: 2.2rem; font-weight: 700;">${this.escape(p.name)}</span>
                        </div>
                        <span style="font-size: 2.4rem; font-weight: 800; color:${p.score >= 0 ? '#4ade80' : '#f87171'};">${fmtScore(p.score)}</span>
                    </div>
                `).join('')}
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; padding-top: 30px; border-top: 2px solid #334155;">
                <div style="font-size: 1.3rem; color: #64748b;">#雀ログ #リーグ戦</div>
                <div style="font-size: 1.7rem; font-weight: bold; background: linear-gradient(to right, #c084fc, #6366f1); -webkit-background-clip: text; color: transparent;">Powered by 雀ログ</div>
            </div>
        `;

        document.body.appendChild(card);
        try {
            const canvas = await html2canvas(card, { backgroundColor: '#0f172a', scale: 2 });
            const link = document.createElement('a');
            link.download = `jonglog_league_${(league.title || 'season').replace(/\s+/g, '_')}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (e) {
            console.error('Wrapped image generation failed:', e);
            alert('画像の生成に失敗しました。');
        } finally {
            document.body.removeChild(card);
        }
    },

    getColorForIndex: function (index) {
        // 24 distinct hues so leagues up to ~20 players keep readable, unique line colors.
        const colors = [
            '#ef4444', // red
            '#3b82f6', // blue
            '#10b981', // emerald
            '#f59e0b', // amber
            '#8b5cf6', // violet
            '#ec4899', // pink
            '#06b6d4', // cyan
            '#f97316', // orange
            '#84cc16', // lime
            '#14b8a6', // teal
            '#6366f1', // indigo
            '#d946ef', // fuchsia
            '#dc2626', // dark red
            '#2563eb', // dark blue
            '#059669', // dark emerald
            '#d97706', // dark amber
            '#7c3aed', // dark violet
            '#db2777', // dark pink
            '#0891b2', // dark cyan
            '#65a30d', // dark lime
            '#e879f9', // light fuchsia
            '#22d3ee', // light cyan
            '#fbbf24', // light amber
            '#a78bfa'  // light violet
        ];
        return colors[index % colors.length];
    }
};
