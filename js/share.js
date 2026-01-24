
const Share = {
    /**
     * Generate an image for a specific session
     * @param {Object} session - The session object
     */
    generateSessionImage: async function (session) {
        if (!typeof html2canvas === 'undefined') {
            alert('Image generation library not loaded. Please refresh and try again.');
            return;
        }

        // 1. Calculate stats (Rankings)
        const playerScores = {};
        session.games.forEach(g => {
            g.players.forEach(p => {
                playerScores[p.name] = (playerScores[p.name] || 0) + p.finalScore;
            });
        });

        // Convert to array and sort
        const rankedPlayers = Object.keys(playerScores).map(name => ({
            name: name,
            score: playerScores[name]
        })).sort((a, b) => b.score - a.score);


        // 2. Create Temporary Container (Insta Story Ratio 9:16)
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '1080px';
        container.style.height = '1920px';
        container.style.zIndex = '-9999';
        container.style.background = '#0f172a';
        container.style.color = '#ffffff';
        container.style.fontFamily = "'Inter', sans-serif";
        container.style.padding = '80px 60px'; // More padding
        container.style.boxSizing = 'border-box';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.justifyContent = 'space-between'; // Distribute content
        container.style.backgroundImage = 'radial-gradient(circle at top right, rgba(99, 102, 241, 0.2), transparent 40%), radial-gradient(circle at bottom left, rgba(236, 72, 153, 0.2), transparent 40%)';

        // 3. Build HTML Content
        const dateStr = session.date.split('T')[0].replace(/-/g, '/');

        let html = '';

        // -- Header --
        html += `
            <div style="border-bottom: 3px solid #334155; padding-bottom: 30px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                    <div>
                        <div style="font-size: 1.8rem; color: #94a3b8; letter-spacing: 4px; font-weight: 500; margin-bottom: 10px;">MATCH RESULT</div>
                        <div style="font-size: 4rem; font-weight: 900; background: linear-gradient(to right, #c084fc, #6366f1); -webkit-background-clip: text; color: transparent;">雀ログ</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 2.2rem; font-weight: bold; color: #f8fafc;">${dateStr}</div>
                        <div style="font-size: 1.5rem; color: #64748b;">Total ${session.games.length} Games</div>
                    </div>
                </div>
            </div>
        `;

        // -- Ranking (Vertical Stack) --
        html += `<div style="display: flex; flex-direction: column; gap: 20px; flex-grow: 1; justify-content: center;">`;
        html += `<div style="font-size: 1.5rem; color: #cbd5e1; border-left: 6px solid #f472b6; padding-left: 15px; margin-bottom: 10px; font-weight: bold;">RANKING</div>`;

        rankedPlayers.forEach((p, index) => {
            const isTop = index === 0;

            let bgStyle = 'background: rgba(30, 41, 59, 0.6);';
            let borderStyle = 'border: 2px solid #334155;';
            let rankColor = '#94a3b8';
            let scoreColor = p.score > 0 ? '#4ade80' : '#f87171';

            if (isTop) {
                bgStyle = 'background: linear-gradient(90deg, rgba(251, 191, 36, 0.1), rgba(30, 41, 59, 0.6));';
                borderStyle = 'border: 2px solid rgba(251, 191, 36, 0.5);';
                rankColor = '#fbbf24';
            }

            html += `
                <div style="${bgStyle} ${borderStyle} border-radius: 20px; padding: 25px 40px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2);">
                    <div style="display: flex; align-items: center; gap: 30px;">
                        <div style="font-size: 2.5rem; font-weight: 900; color: ${rankColor}; width: 50px; text-align: center;">${index + 1}</div>
                        <div style="font-size: 2rem; font-weight: bold; color: #f1f5f9;">${p.name}</div>
                    </div>
                    <div style="font-size: 2.8rem; font-weight: 800; color: ${scoreColor}; text-shadow: 0 0 15px rgba(0,0,0,0.5);">
                        ${p.score > 0 ? '+' : ''}${p.score.toFixed(1)}
                    </div>
                </div>
            `;
        });
        html += `</div>`;

        // -- Chart --
        html += `<div style="margin-bottom: 40px;">`;
        html += `<div style="font-size: 1.5rem; color: #cbd5e1; border-left: 6px solid #38bdf8; padding-left: 15px; margin-bottom: 20px; font-weight: bold;">CHART</div>`;

        const chartCanvas = document.getElementById('score-chart');
        if (chartCanvas) {
            const chartDataUrl = chartCanvas.toDataURL();
            html += `
                <div style="background: rgba(30, 41, 59, 0.6); border: 2px solid #334155; border-radius: 20px; padding: 20px; height: 400px; display: flex; align-items: center; justify-content: center;">
                    <img src="${chartDataUrl}" style="width: 100%; height: 100%; object-fit: contain;">
                </div>
            `;
        } else {
            html += `<div style="color: #64748b; font-style: italic; font-size: 1.2rem; text-align: center; padding: 20px;">Chart not available</div>`;
        }
        html += `</div>`;

        // -- Game Log (Matrix) --
        html += `<div style="margin-bottom: 20px;">`;
        html += `<div style="font-size: 1.5rem; color: #cbd5e1; border-left: 6px solid #a78bfa; padding-left: 15px; margin-bottom: 20px; font-weight: bold;">GAME LOG</div>`;
        html += `<div style="overflow-x: hidden; border: 2px solid #334155; border-radius: 20px; background: rgba(30, 41, 59, 0.4);">`;
        html += `<table style="width: 100%; border-collapse: collapse; font-size: 1.2rem; color: #cbd5e1;">`;

        // Header
        html += `<thead><tr style="background: rgba(15, 23, 42, 0.8);">`;
        html += `<th style="text-align: left; padding: 15px 20px; color: #94a3b8;">Player</th>`;
        session.games.forEach((_, idx) => {
            if (idx >= 8) return;
            html += `<th style="text-align: center; padding: 15px; color: #94a3b8;">${idx + 1}</th>`;
        });
        html += `</tr></thead>`;

        // Body
        html += `<tbody>`;
        rankedPlayers.forEach(p => {
            html += `<tr style="border-top: 1px solid #334155;">`;
            html += `<td style="padding: 15px 20px; font-weight: bold; color: #e2e8f0;">${p.name}</td>`;

            session.games.forEach((g, idx) => {
                if (idx >= 8) return;
                const playerResult = g.players.find(gp => gp.name === p.name);
                const score = playerResult ? playerResult.finalScore : 0;

                let color = '#cbd5e1';
                let weight = 'normal';
                let bg = '';

                if (score > 0) color = '#4ade80';
                else if (score < 0) color = '#f87171';

                const maxScore = Math.max(...g.players.map(pl => pl.finalScore));
                if (score === maxScore) {
                    weight = 'bold';
                    bg = 'background: rgba(251, 191, 36, 0.1); border-radius: 8px;';
                    color = '#fbbf24';
                }

                html += `<td style="text-align: center; padding: 10px;">`;
                html += `<span style="display: inline-block; padding: 5px 10px; ${bg} color: ${color}; font-weight: ${weight};">${Math.round(score)}</span>`;
                html += `</td>`;
            });
            html += `</tr>`;
        });
        html += `</tbody></table></div></div>`;

        // -- Footer --
        html += `
            <div style="margin-top: auto; display: flex; justify-content: space-between; align-items: center; padding-top: 20px; border-top: 2px solid #334155;">
                <div style="font-size: 1.2rem; color: #64748b;">#MahjongScoreApp</div>
                <div style="font-size: 1.5rem; font-weight: bold; color: #e2e8f0;">Powered by 雀ログ</div>
            </div>
        `;

        container.innerHTML = html;
        document.body.appendChild(container);

        // 4. Generate Canvas
        try {
            const canvas = await html2canvas(container, {
                backgroundColor: '#0f172a',
                scale: 2 // High resolution
            });

            // 5. Download Image
            const link = document.createElement('a');
            link.download = `mahjong_result_${dateStr.replace(/\//g, '')}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();

        } catch (e) {
            console.error("Image generation failed:", e);
            alert("画像の生成に失敗しました。");
        } finally {
            // Clean up
            document.body.removeChild(container);
        }
    }
};

window.Share = Share;
