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
        const settlement = this.calculate(session);
        const fmt = (n) => (n > 0 ? '+' : '') + Math.round(n).toLocaleString();

        // ===== カードヘッダー =====
        let html = `
            <div class="settlement-card">
                <div class="settlement-card__head">
                    <h3><span>💸</span> 精算・支払い管理</h3>
                    <button id="add-expense-btn" class="settlement-add-btn">＋ 経費追加</button>
                </div>
                <div class="settlement-card__body">
        `;

        // ===== 経費リスト =====
        html += `<h4 class="settlement-subtitle">経費（場代・飲食代など）</h4>`;
        if (expenses.length === 0) {
            html += `<div class="expense-empty">経費の記録はありません。</div>`;
        } else {
            let totalExpenses = 0;
            html += `<div class="expense-list">`;
            expenses.forEach((ex, idx) => {
                totalExpenses += parseInt(ex.amount);

                // 対象表示
                let targetDisplay;
                if (ex.targets && Array.isArray(ex.targets)) {
                    targetDisplay = ex.targets.length === session.players.length ? '全員' : ex.targets.join('・');
                } else if (ex.target === 'all' || !ex.target) {
                    targetDisplay = '全員';
                } else {
                    targetDisplay = ex.target;
                }

                html += `
                    <div class="expense-item">
                        <div class="expense-item__main">
                            <div class="expense-item__note">${ex.note || 'その他'}</div>
                            <div class="expense-item__meta">${ex.payer} が立替 ／ <span class="tgt">${targetDisplay}</span> の分</div>
                        </div>
                        <span class="expense-item__amount">¥${parseInt(ex.amount).toLocaleString()}</span>
                        <button class="expense-item__del" onclick="Settlement.removeExpense('${session.id}', ${idx})" title="削除">🗑️</button>
                    </div>
                `;
            });
            html += `</div>`;
            html += `<div class="expense-total"><span>経費合計</span><b>¥${totalExpenses.toLocaleString()}</b></div>`;
        }

        // ===== 最終収支（プレイヤーごとのカード）=====
        html += `<h4 class="settlement-subtitle">最終収支（受け取り / 支払い）</h4>`;
        const sortedBalances = settlement.balances.slice().sort((a, b) => b.final - a.final);
        html += `<div class="balance-list">`;
        sortedBalances.forEach(b => {
            const cls = b.final > 0 ? 'plus' : (b.final < 0 ? 'minus' : 'zero');
            const tag = b.final > 0 ? '受け取り' : (b.final < 0 ? '支払い' : '精算済');
            const netExpense = b.paid - b.share;

            // 内訳（0の項目は省略）
            const parts = [];
            if (b.gameBalance !== 0) parts.push(`麻雀 ${fmt(b.gameBalance)}`);
            if (netExpense !== 0) parts.push(`経費 ${fmt(netExpense)}`);
            const sub = parts.length ? parts.join('<span style="opacity:.4; margin:0 2px;">・</span>') : '増減なし';

            html += `
                <div class="balance-row balance-row--${cls}">
                    <div class="balance-row__main">
                        <span class="balance-row__name">${b.name}</span>
                        <span class="balance-row__final">${fmt(b.final)}<small>円</small></span>
                    </div>
                    <div class="balance-row__sub">
                        <span>${sub}</span>
                        <span class="balance-tag">${tag}</span>
                    </div>
                </div>
            `;
        });
        html += `</div>`;

        // ===== 送金リスト =====
        html += `<h4 class="settlement-subtitle settlement-subtitle--green">送金リスト（誰が誰に払う）</h4>`;
        if (settlement.transfers.length === 0) {
            html += `<div class="transfer-empty">精算完了（貸し借りなし）</div>`;
        } else {
            html += `<div class="transfer-list">`;
            settlement.transfers.forEach(t => {
                html += `
                    <div class="transfer-item">
                        <div class="transfer-item__names">
                            <span>${t.from}</span>
                            <span class="transfer-item__arrow">➔</span>
                            <span>${t.to}</span>
                        </div>
                        <span class="transfer-item__amount">¥${t.amount.toLocaleString()}</span>
                    </div>
                `;
            });
            html += `</div>`;
        }

        html += `</div></div>`; // Close body, card

        // Modal for Adding Expense
        html += `
            <dialog id="expense-modal" style="background: #1e293b; color: #fff; border: 1px solid #475569; border-radius: 8px; padding: 20px; width: 90%; max-width: 400px; ::backdrop { background: rgba(0,0,0,0.7); }">
                <h3 style="margin-top: 0;">経費を追加</h3>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-size: 0.9rem;">項目</label>
                    <select id="expense-type" onchange="const input = document.getElementById('expense-custom-note'); input.style.display = this.value === 'その他' ? 'block' : 'none'; if(this.value !== 'その他') input.value = '';" style="width: 100%; padding: 8px; background: #0f172a; color: #fff; border: 1px solid #334155; border-radius: 4px; margin-bottom: 5px;">
                        <option value="場代">場代</option>
                        <option value="飲食代">飲食代</option>
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
                        <label style="display: grid; grid-template-columns: 24px 1fr; align-items: center; width: 100%; cursor: pointer;">
                            <input type="checkbox" id="check-all" onchange="document.querySelectorAll('.player-check').forEach(c => c.checked = this.checked)" checked style="margin: 0;">
                            <span style="font-weight: bold; color: #fbbf24; white-space: nowrap;">全員</span>
                        </label>
                        <hr style="border: 0; border-top: 1px solid #334155; width: 100%; margin: 5px 0;">
                        ${session.players.map(p => `
                            <label style="display: grid; grid-template-columns: 24px 1fr; align-items: center; width: 100%; cursor: pointer;">
                                <input type="checkbox" class="player-check" value="${p}" checked onchange="const all = [...document.querySelectorAll('.player-check')]; document.getElementById('check-all').checked = all.every(c => c.checked)" style="margin: 0;">
                                <span style="white-space: nowrap;">${p}</span>
                            </label>
                        `).join('')}
                    </div>
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
        // balances[].final は表示用に保持し、送金計算は複製(remaining)で行う
        let debtors = balances.filter(b => b.final < 0)
            .map(b => ({ name: b.name, remaining: b.final }))
            .sort((a, b) => a.remaining - b.remaining);
        let creditors = balances.filter(b => b.final > 0)
            .map(b => ({ name: b.name, remaining: b.final }))
            .sort((a, b) => b.remaining - a.remaining);

        const transfers = [];
        let i = 0;
        let j = 0;

        while (i < debtors.length && j < creditors.length) {
            let debtor = debtors[i];
            let creditor = creditors[j];

            // amount to settle is min(abs(debtor.remaining), creditor.remaining)
            let amount = Math.min(Math.abs(debtor.remaining), creditor.remaining);

            if (amount > 0) {
                transfers.push({
                    from: debtor.name,
                    to: creditor.name,
                    amount: amount
                });
            }

            debtor.remaining += amount;
            creditor.remaining -= amount;

            if (Math.abs(debtor.remaining) < 1) i++;
            if (Math.abs(creditor.remaining) < 1) j++;
        }

        return {
            balances: balances,
            transfers: transfers
        };
    }
};
