/**
 * Mahjong Score Calculation Logic (M-League Rules Compatible)
 * 
 * Rules:
 * - Start Score: Configurable (Default 25000)
 * - Return Score: Configurable (Default 30000)
 * - Oka: (Return - Start) * 4 (Default +20)
 * - Uma: Configurable (Default +30, +10, -10, -30)
 * - Tie-breaker: 
 *      - 'priority': Manual selection (East > South > West > North)
 *      - 'split': Split points equally
 */

window.Mahjong = {};

/**
 * Calculate final scores including Oka and Uma
 * @param {number[]} scores - Array of 4 raw scores (integer)
 * @param {object} settings - Settings object { startScore, returnScore, uma, tieBreaker }
 * @param {object} [priorityMap] - Optional map { index: priorityValue } for manual tie-breaking (higher value = higher rank)
 * @returns {object|object[]} Array of result objects OR { needsTieBreaker: true, tiedIndices: [[0,1]] }
 */
window.Mahjong.calculateResult = function (scores, settings, priorityMap = null) {
    // Default settings
    const startScore = settings?.startScore ?? 25000;
    const returnScore = settings?.returnScore ?? 30000;
    const uma = settings?.uma ?? [30, 10, -10, -30];
    const tieBreaker = settings?.tieBreaker ?? 'priority';

    const oka = (returnScore - startScore) * 4 / 1000;

    // 1. Create player objects
    let players = scores.map((score, index) => ({
        rawScore: score,
        index: index,
        // If priorityMap provided, use it. Otherwise default to 0.
        priority: priorityMap ? (priorityMap[index] || 0) : 0
    }));

    // 2. Check for ties if Priority mode and no map provided
    if (tieBreaker === 'priority' && !priorityMap) {
        // Group by score
        const scoreGroups = {};
        players.forEach(p => {
            if (!scoreGroups[p.rawScore]) scoreGroups[p.rawScore] = [];
            scoreGroups[p.rawScore].push(p.index);
        });

        const tiedGroups = Object.values(scoreGroups).filter(g => g.length > 1);
        if (tiedGroups.length > 0) {
            return {
                needsTieBreaker: true,
                tiedGroups: tiedGroups // Array of arrays of indices, e.g. [[0, 1], [2, 3]]
            };
        }
    }

    // 3. Sort
    players.sort((a, b) => {
        if (b.rawScore !== a.rawScore) {
            return b.rawScore - a.rawScore;
        }
        // If scores equal, check priority (Higher priority comes first)
        if (tieBreaker === 'priority') {
            return b.priority - a.priority;
        }
        return 0; // Keep original order for split (doesn't matter)
    });

    // 4. Assign Rank and Calculate Points
    // First, calculate base points for everyone
    players.forEach(p => {
        p.basePoint = (p.rawScore - returnScore) / 1000;
    });

    // Handle Split Logic
    if (tieBreaker === 'split') {
        let currentRank = 1;
        for (let i = 0; i < 4;) {
            // Find how many players have the same score
            let count = 1;
            while (i + count < 4 && players[i + count].rawScore === players[i].rawScore) {
                count++;
            }

            // Calculate total Uma (+ Oka if 1st) for these positions
            let totalUma = 0;
            let totalOka = 0;
            for (let j = 0; j < count; j++) {
                const rankIdx = i + j; // 0-based rank index (0=1st, 1=2nd...)
                totalUma += uma[rankIdx];
                if (rankIdx === 0) totalOka = oka;
            }

            // Distribute equally
            const pointsPerPlayer = (totalUma + totalOka) / count;

            // Assign to all tied players
            for (let j = 0; j < count; j++) {
                players[i + j].rank = currentRank; // They all get the highest rank
                players[i + j].finalScore = Math.round((players[i + j].basePoint + pointsPerPlayer) * 10) / 10;
            }

            // Advance
            i += count;
            currentRank += count;
        }
    } else {
        // Priority Mode (Already sorted by score then priority)
        players.forEach((p, rankIndex) => {
            p.rank = rankIndex + 1;
            let point = p.basePoint + uma[rankIndex];
            if (rankIndex === 0) point += oka;
            p.finalScore = Math.round(point * 10) / 10;
        });
    }

    // Restore original order for return
    players.sort((a, b) => a.index - b.index);
    return players;
};

/**
 * Validate total score
 */
window.Mahjong.validateTotal = function (scores) {
    const total = scores.reduce((a, b) => a + b, 0);
    return total === 100000;
};
