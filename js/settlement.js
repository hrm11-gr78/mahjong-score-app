/**
 * Settlement (Seisan) Logic & UI
 * Handles expenses, mahjong score integration, and final payout calculation.
 */
window.Settlement = {

    // Main Entry Point
    render: function (session, container) {
        if (!container) return;

        // Ensure expenses array exists
        const expenses = session.expenses || [];

        // 1. Render Header & Expense List
        let html = `
            <div class="settlement-section" style="margin-top: 30px; background: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden;">
                <div style="background: #0f172a; padding: 15px; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
                        <span>💸</span> 精算・支払い管理
                    </h3>
                    <button id="add-expense-btn" class="btn-secondary" style="font-size: 0.8rem; padding: 4px 10px;">+ 経費追加</button>
                </div>
                
                <div style="padding: 15px;">
        `;

        // Expenses List
        if (expenses.length === 0) {
            html += `<p style="color: #94a3b8; font-size: 0.9rem; text-align: center; margin: 10px 0;">経費（場代・食事代など）の記録はありません。</p>`;
        } else {
            html += `<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 0.9rem;">
                <thead>
                    <tr style="border-bottom: 1px solid #334155; color: #cbd5e1;">
                        <th style="padding: 8px; text-align: left;">項目</th>
                        <th style="padding: 8px; text-align: left;">対象 (誰の分)</th>
                        <th style="padding: 8px; text-align: left;">支払者 (立替)</th>
                        <th style="padding: 8px; text-align: right;">金額</th>
                        <th style="padding: 8px; text-align: right;">操作</th>
                    </tr>
                </thead>
                <tbody>`;

            let totalExpenses = 0;
            expenses.forEach((ex, idx) => {
                totalExpenses += parseInt(ex.amount);

                // Format Targets Display
                let targetDisplay = '';
                if (ex.targets && Array.isArray(ex.targets)) {
                    // Start: Show comma separated names
                    // If target list length equals player length, assume 'All'
                    if (ex.targets.length === session.players.length) {
                        targetDisplay = '全員';
                    } else {
                        targetDisplay = ex.targets.join(', ');
                    }
                } else if (ex.target === 'all') {
                    // Backward compatibility
                    targetDisplay = '全員';
                } else if (ex.target) {
                    // Backward compatibility
                    targetDisplay = ex.target;
                } else {
                    targetDisplay = '全員';
                }

                html += `
                    <tr style="border-bottom: 1px solid #1e293b; background: rgba(255,255,255,0.02);">
                        <td style="padding: 8px;">${ex.note || 'その他'}</td>
                        <td style="padding: 8px; color: #a78bfa;">${targetDisplay}</td>
                        <td style="padding: 8px;">${ex.payer}</td>
                        <td style="padding: 8px; text-align: right;">¥${parseInt(ex.amount).toLocaleString()}</td>
                        <td style="padding: 8px; text-align: right;">
                             <button onclick="Settlement.removeExpense('${session.id}', ${idx})" style="background:none; border:none; cursor:pointer; font-size:1rem;">🗑️</button>
                        </td>
                    </tr>
                `;
            });

            // Total Row
            html += `
                    <tr style="border-top: 1px solid #475569; font-weight: bold;">
                        <td colspan="3" style="padding: 8px; text-align: right;">合計</td>
                        <td style="padding: 8px; text-align: right; color: #fbbf24;">¥${totalExpenses.toLocaleString()}</td>
                        <td></td>
                    </tr>
                </tbody>
            </table>`;
        }

        // 2. Final Settlement Calculation
        const settlement = this.calculate(session);

        // Summary Table (Final Transfer column removed as per request)
        html += `<h4 style="font-size: 1rem; margin: 20px 0 10px; border-left: 4px solid #8b5cf6; padding-left: 10px;">最終収支</h4>`;

        html += `<div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem; white-space: nowrap;">
                    <thead>
                        <tr style="background: #0f172a;">
                            <th style="padding: 8px; text-align: left;">名前</th>
                            <th style="padding: 8px; text-align: right;">麻雀収支</th>
                            <th style="padding: 8px; text-align: right;">経費立替</th>
                            <th style="padding: 8px; text-align: right;">支払義務</th>
                        </tr>
                    </thead>
                    <tbody>`;

        settlement.balances.forEach(b => {
            html += `
                <tr style="border-bottom: 1px solid #334155;">
                    <td style="padding: 8px; font-weight: bold;">${b.name}</td>
                    <td style="padding: 8px; text-align: right; color: #94a3b8;">${b.gameBalance > 0 ? '+' : ''}${b.gameBalance.toLocaleString()}</td>
                    <td style="padding: 8px; text-align: right; color: #94a3b8;">+${b.paid.toLocaleString()}</td>
                    <td style="padding: 8px; text-align: right; color: #ef4444;">-${b.share.toLocaleString()}</td>
                </tr>
             `;
        });
        html += `</tbody></table></div>`;

        // 3. Payment Instructions
        html += `<h4 style="font-size: 1rem; margin: 25px 0 10px; border-left: 4px solid #10b981; padding-left: 10px;">送金リスト</h4>`;

        if (settlement.transfers.length === 0) {
            html += `<div style="padding: 10px; text-align: center; color: #94a3b8;">精算完了（貸借なし）</div>`;
        } else {
            html += `<div style="display: flex; flex-direction: column; gap: 10px;">`;
            settlement.transfers.forEach(t => {
                html += `
                    <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.2); padding: 10px 15px; border-radius: 8px; border-left: 4px solid #10b981;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-weight: bold;">${t.from}</span>
                            <span style="color: #94a3b8;">➔</span>
                            <span style="font-weight: bold;">${t.to}</span>
                        </div>
                        <div style="font-weight: bold; font-size: 1.1rem; color: #fbbf24;">
                            ¥${t.amount.toLocaleString()}
                        </div>
                    </div>
                 `;
            });
            html += `</div>`;
        }

        html += `</div></div>`; // Close Main Div

        // Modal for Adding Expense
        html += `
            <dialog id="expense-modal" style="background: #1e293b; color: #fff; border: 1px solid #475569; border-radius: 8px; padding: 20px; width: 90%; max-width: 400px; ::backdrop { background: rgba(0,0,0,0.7); }">
                <h3 style="margin-top: 0;">経費を追加</h3>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-size: 0.9rem;">項目</label>
                    <select id="expense-type" onchange="const input = document.getElementById('expense-custom-note'); input.style.display = this.value === 'その他' ? 'block' : 'none'; if(this.value !== 'その他') input.value = '';" style="width: 100%; padding: 8px; background: #0f172a; color: #fff; border: 1px solid #334155; border-radius: 4px; margin-bottom: 5px;">
                        <option value="場代">場代</option>
                        <option value="飲食代">飲食代</option>
                        <option value="飲み物">飲み物</option>
                        <option value="交通費">交通費</option>
                        <option value="その他">その他 (入力)</option>
                    </select>
                    <input type="text" id="expense-custom-note" placeholder="項目名を入力" style="display: none; width: 100%; padding: 8px; background: #0f172a; color: #fff; border: 1px solid #334155; border-radius: 4px;">
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-size: 0.9rem;">支払った人（立替者）</label>
                    <select id="expense-payer" style="width: 100%; padding: 8px; background: #0f172a; color: #fff; border: 1px solid #334155; border-radius: 4px;">
                        ${session.players.map(p => `<option value="${p}">${p}</option>`).join('')}
                    </select>
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-size: 0.9rem;">対象（誰の分？）</label>
                    <div style="display: flex; flex-direction: column; gap: 8px; background: #0f172a; padding: 10px; border-radius: 4px; border: 1px solid #334155;">
                        <label style="display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="check-all" onchange="document.querySelectorAll('.player-check').forEach(c => c.checked = this.checked)" checked>
                            <span style="font-weight: bold; color: #fbbf24;">全員</span>
                        </label>
                        <hr style="border: 0; border-top: 1px solid #334155; width: 100%; margin: 5px 0;">
                        ${session.players.map(p => `
                            <label style="display: flex; align-items: center; gap: 8px;">
                                <input type="checkbox" class="player-check" value="${p}" checked onchange="const all = [...document.querySelectorAll('.player-check')]; document.getElementById('check-all').checked = all.every(c => c.checked)">
                                <span>${p}</span>
                            </label>
                        `).join('')}
                    </div>
                    <p style="font-size:0.8rem; color:#94a3b8; margin-top:5px;">※ 選択したメンバーで等分されます。</p>
                </div>
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 5px; font-size: 0.9rem;">金額</label>
                    <input type="number" id="expense-amount" placeholder="1000" style="width: 100%; padding: 8px; background: #0f172a; color: #fff; border: 1px solid #334155; border-radius: 4px;">
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 10px;">
                    <button type="button" onclick="document.getElementById('expense-modal').close()" class="btn-secondary">キャンセル</button>
                    <button type="button" onclick="Settlement.addExpense('${session.id}')" class="btn-primary">保存</button>
                </div>
            </dialog>
        `;

        container.innerHTML = html;

        // Attach Event to Add Button
        const addBtn = container.querySelector('#add-expense-btn');
        const modal = container.querySelector('#expense-modal');
        if (addBtn && modal) {
            addBtn.addEventListener('click', () => {
                modal.showModal();
            });
        }
    },

    // Add Expense
    addExpense: async function (sessionId) {
        const typeSelect = document.getElementById('expense-type');
        const customNoteInput = document.getElementById('expense-custom-note');
        const payerSelect = document.getElementById('expense-payer');
        const amountInput = document.getElementById('expense-amount');
        const targetChecks = document.querySelectorAll('.player-check:checked');

        let note = typeSelect.value;
        if (note === 'その他') {
            note = customNoteInput.value.trim();
            if (!note) note = 'その他';
        }

        const payer = payerSelect.value;
        const amount = parseInt(amountInput.value);
        const targets = Array.from(targetChecks).map(c => c.value);

        if (!amount || amount <= 0) {
            alert('金額を正しく入力してください');
            return;
        }

        if (targets.length === 0) {
            alert('対象者を1人以上選択してください');
            return;
        }

        const session = await window.AppStorage.getSession(sessionId);
        if (!session) return;

        const expenses = session.expenses || [];
        expenses.push({
            id: Date.now(),
            note,
            payer,
            amount,
            targets // Array of player names
        });

        await window.AppStorage.updateSession(sessionId, { expenses });
        document.getElementById('expense-modal').close();

        if (window.openSession) window.openSession(sessionId);
    },

    // Remove Expense
    removeExpense: async function (sessionId, index) {
        if (!confirm('この経費を削除しますか？')) return;

        const session = await window.AppStorage.getSession(sessionId);
        if (!session) return;

        const expenses = session.expenses || [];
        expenses.splice(index, 1);

        await window.AppStorage.updateSession(sessionId, { expenses });
        if (window.openSession) window.openSession(sessionId);
    },

    // Calculation Logic
    calculate: function (session) {
        const players = session.players;
        const playerMap = {};

        // Initialize
        players.forEach(p => {
            playerMap[p] = { gameBalance: 0, paid: 0, share: 0, final: 0 };
        });

        // 1. Game Balance (Rate Calculation)
        if (session.rate && session.rate > 0) {
            const gameTotals = {};
            players.forEach(p => gameTotals[p] = 0);
            session.games.forEach(g => {
                g.players.forEach(gp => {
                    if (gameTotals[gp.name] !== undefined) {
                        gameTotals[gp.name] += gp.finalScore;
                    }
                });
            });

            players.forEach(p => {
                const score = parseFloat(gameTotals[p].toFixed(1));
                const amount = Math.round(score * session.rate * 10);
                playerMap[p].gameBalance = amount;
            });
        }

        // 2. Expenses
        const expenses = session.expenses || [];
        expenses.forEach(ex => {
            const amount = parseInt(ex.amount);

            // Payer gets credit
            if (playerMap[ex.payer]) {
                playerMap[ex.payer].paid += amount;
            }

            // Debt Distribution
            // Normalize targets
            let targets = ex.targets;
            if (!targets) {
                // Backward compatibility
                if (ex.target === 'all' || !ex.target) targets = players;
                else targets = [ex.target];
            }
            // Filter invalid targets
            targets = targets.filter(t => playerMap[t]);

            if (targets.length > 0) {
                const perPerson = Math.floor(amount / targets.length);
                const remainder = amount % targets.length;

                targets.forEach((p, idx) => {
                    let share = perPerson;
                    if (idx < remainder) share += 1; // Remainder to first few targets
                    playerMap[p].share += share;
                });
            }
        });

        // 3. Final Balance
        const balances = [];
        players.forEach(p => {
            const m = playerMap[p];
            // Final = GameBalance + Paid - Share
            m.final = m.gameBalance + m.paid - m.share;
            balances.push({ name: p, ...m });
        });

        // 4. Calculate Transfers (Minimizing transactions)
        let debtors = balances.filter(b => b.final < 0).sort((a, b) => a.final - b.final);
        let creditors = balances.filter(b => b.final > 0).sort((a, b) => b.final - a.final);

        const transfers = [];
        let i = 0;
        let j = 0;

        while (i < debtors.length && j < creditors.length) {
            let debtor = debtors[i];
            let creditor = creditors[j];

            // amount to settle is min(abs(debtor.final), creditor.final)
            let amount = Math.min(Math.abs(debtor.final), creditor.final);

            if (amount > 0) {
                transfers.push({
                    from: debtor.name,
                    to: creditor.name,
                    amount: amount
                });
            }

            debtor.final += amount;
            creditor.final -= amount;

            if (Math.abs(debtor.final) < 1) i++;
            if (Math.abs(creditor.final) < 1) j++;
        }

        return {
            balances: balances,
            transfers: transfers
        };
    }
};
