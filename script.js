// App State
let tournament = {
    tournamentName: "",
    players: [],
    sessionHistory: [] // New field for session history
};

let actionStack = []; // For Undo system

// DOM Elements
const get = (id) => document.getElementById(id);
const query = (q) => document.querySelector(q);

const views = {
    menu: get('menu-view'),
    create: get('create-view'),
    game: get('game-view'),
    summary: get('summary-view')
};

const elements = {
    tourneyNameInput: get('tourney-name'),
    participantsContainer: get('participants-list'),
    displayTourneyName: get('display-tourney-name'),
    playerControls: get('player-controls'),
    sessionBody: query('#session-table tbody'),
    leaderboardBody: query('#leaderboard-table tbody'),
    summaryBody: query('#summary-table tbody'),
    historyList: get('session-history-list'),
    finalGoalModal: get('final-goal-modal'),
    finalPlayersList: get('final-players-list'),
    btnConfirmSave: get('btn-confirm-save'),
    btnUndo: get('btn-undo')
};

// --- Initialization ---
function init() {
    if (!views.menu) return;

    get('btn-create-tourney')?.addEventListener('click', () => switchView('create'));
    get('btn-back-menu')?.addEventListener('click', () => switchView('menu'));
    get('btn-add-participant')?.addEventListener('click', addParticipantInput);
    get('btn-start-tourney')?.addEventListener('click', initTournament);
    get('load-json')?.addEventListener('change', loadTournament);
    get('btn-end-session')?.addEventListener('click', showSummary);
    get('btn-cancel-summary')?.addEventListener('click', () => switchView('game'));
    elements.btnConfirmSave?.addEventListener('click', finalizeAndSave);
    elements.btnUndo?.addEventListener('click', undoLastAction);

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            get(`${btn.dataset.tab}-tab`)?.classList.add('active');
            updateUI();
        });
    });

    document.querySelector('.close-modal')?.addEventListener('click', () => {
        elements.finalGoalModal.classList.remove('active');
    });
}

function switchView(viewId) {
    Object.values(views).forEach(v => v?.classList.remove('active'));
    views[viewId]?.classList.add('active');
    window.scrollTo(0, 0);
    if (viewId === 'game') updateUI();
}

// --- Setup Logic ---
function addParticipantInput() {
    const div = document.createElement('div');
    div.className = 'participant-entry';
    div.innerHTML = `
        <input type="text" placeholder="Nombre Participante" class="input-glass participant-name">
        <button class="btn-remove" onclick="this.parentElement.remove()">×</button>
    `;
    elements.participantsContainer?.appendChild(div);
}

function initTournament() {
    const name = elements.tourneyNameInput.value.trim();
    if (!name) return alert("Ponle un nombre al torneo");

    const names = Array.from(document.querySelectorAll('.participant-name'))
        .map(i => i.value.trim())
        .filter(n => n !== "");

    if (names.length < 2) return alert("Añade al menos 2 participantes");

    tournament = {
        tournamentName: name,
        players: names.map(n => ({
            id: 'p' + Date.now() + Math.random().toString(36).substr(2, 5),
            name: n,
            historyPoints: 0,
            totalGoals: 0,
            totalMisses: 0,
            totalFinals: 0,
            totalSlaps: 0,
            session: { goals: 0, misses: 0, finals: 0, slaps: 0 }
        })),
        sessionHistory: []
    };

    startSession();
}

function loadTournament(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            tournament = {
                ...data,
                sessionHistory: data.sessionHistory || []
            };
            tournament.players.forEach(p => {
                p.session = { goals: 0, misses: 0, finals: 0, slaps: 0 };
            });
            startSession();
        } catch (err) {
            alert("Error al cargar el JSON");
        }
    };
    reader.readAsText(file);
}

function startSession() {
    if (elements.displayTourneyName) elements.displayTourneyName.textContent = tournament.tournamentName;
    actionStack = [];
    switchView('game');
}

// --- Game Logic ---
function updateUI() {
    renderControls();
    updateSessionBoard();
    updateGlobalBoard();
}

function renderControls() {
    if (!elements.playerControls) return;
    elements.playerControls.innerHTML = "";
    tournament.players.forEach(player => {
        const card = document.createElement('div');
        card.className = 'player-card';
        card.innerHTML = `
            <div class="player-header">
                <span class="player-name">${player.name}</span>
                <span class="player-session-stats">${player.session.goals}G / ${player.session.misses}F</span>
            </div>
            <div class="player-actions">
                <button class="score-btn goal" onclick="track('${player.id}', 'goals')">GOL</button>
                <button class="score-btn miss" onclick="track('${player.id}', 'misses')">FALLO</button>
                <button class="score-btn slap" onclick="track('${player.id}', 'slaps')">COLLEJA</button>
                <button class="score-btn final" onclick="track('${player.id}', 'finals')">FINAL</button>
            </div>
        `;
        elements.playerControls.appendChild(card);
    });
}

window.track = (playerId, type) => {
    const player = tournament.players.find(p => p.id === playerId);
    if (player) {
        player.session[type]++;
        actionStack.push({ playerId, type });

        // Visual effects
        if (type === 'goals') flashScreen('goal');
        if (type === 'misses') flashScreen('miss');
        if (type === 'slaps') flashScreen('slap');
        if (type === 'finals') flashScreen('final');

        updateUI();
    }
};

function undoLastAction() {
    const last = actionStack.pop();
    if (!last) return;
    const player = tournament.players.find(p => p.id === last.playerId);
    if (player && player.session[last.type] > 0) {
        player.session[last.type]--;
        updateUI();
    }
}

function flashScreen(type) {
    const overlay = get(`flash-overlay-${type}`);
    if (overlay) {
        overlay.classList.add('active');
        setTimeout(() => overlay.classList.remove('active'), 400);
    }
}

function calculateSessionPoints() {
    const sorted = [...tournament.players].sort((a, b) => {
        const perA = (a.session.goals + a.session.misses) > 0 ? (a.session.goals / (a.session.goals + a.session.misses)) : 0;
        const perB = (b.session.goals + b.session.misses) > 0 ? (b.session.goals / (b.session.goals + b.session.misses)) : 0;

        if (perB !== perA) return perB - perA;
        if (b.session.goals !== a.session.goals) return b.session.goals - a.session.goals;
        if (a.session.slaps !== b.session.slaps) return a.session.slaps - b.session.slaps;
        return b.session.finals - a.session.finals;
    });
    const pointsMap = {};
    sorted.forEach((p, index) => {
        let pts = 0;
        if (index === 0) pts = 5;
        else if (index === 1) pts = 4;
        else if (index === 2) pts = 3;
        else if (index === 3) pts = 2;
        else if (index === 4) pts = 1;
        pointsMap[p.id] = pts;
    });
    return pointsMap;
}

function updateSessionBoard() {
    if (!elements.sessionBody) return;
    const ranking = [...tournament.players].sort((a, b) => {
        const perA = (a.session.goals + a.session.misses) > 0 ? (a.session.goals / (a.session.goals + a.session.misses)) : 0;
        const perB = (b.session.goals + b.session.misses) > 0 ? (b.session.goals / (b.session.goals + b.session.misses)) : 0;

        if (perB !== perA) return perB - perA;
        if (b.session.goals !== a.session.goals) return b.session.goals - a.session.goals;
        if (a.session.slaps !== b.session.slaps) return a.session.slaps - b.session.slaps;
        return b.session.finals - a.session.finals;
    });

    elements.sessionBody.innerHTML = ranking.map((p, i) => {
        const total = p.session.goals + p.session.misses;
        const per = total > 0 ? ((p.session.goals / total) * 100).toFixed(1) : 0;
        return `
            <tr class="sweep-left" style="animation-delay: ${i * 0.05}s">
                <td>${i + 1}</td>
                <td>${p.name}</td>
                <td>${p.session.goals}</td>
                <td>${p.session.misses}</td>
                <td>${total}</td>
                <td>${per}%</td>
                <td>${p.session.finals}</td>
                <td>${p.session.slaps}</td>
            </tr>
        `;
    }).join('');
}

function updateGlobalBoard() {
    if (!elements.leaderboardBody) return;
    const sessionPoints = calculateSessionPoints();
    const ranking = tournament.players.map(p => {
        const currentPoints = sessionPoints[p.id] || 0;
        return {
            ...p,
            liveTotal: p.historyPoints + currentPoints,
            sessionPts: currentPoints,
            totalG: p.totalGoals + p.session.goals,
            totalM: p.totalMisses + p.session.misses,
            totalF: p.totalFinals + p.session.finals,
            totalS: p.totalSlaps + p.session.slaps
        };
    }).sort((a, b) => {
        if (b.liveTotal !== a.liveTotal) return b.liveTotal - a.liveTotal;
        if (a.totalS !== b.totalS) return a.totalS - b.totalS;
        return b.totalF - a.totalF;
    });

    elements.leaderboardBody.innerHTML = ranking.map((p, i) => {
        const totalTry = p.totalG + p.totalM;
        const per = totalTry > 0 ? ((p.totalG / totalTry) * 100).toFixed(1) : 0;
        return `
            <tr class="sweep-left" style="animation-delay: ${i * 0.05}s">
                <td>${i + 1}</td>
                <td>${p.name}</td>
                <td style="font-weight: bold; color: var(--primary);">${p.liveTotal}</td>
                <td class="sweep-top" style="color: #00ff88; font-weight: bold;">+${p.sessionPts}</td>
                <td>${per}%</td>
                <td>${p.totalG}/${p.totalM}</td>
                <td>${totalTry}</td>
                <td style="color: #7000ff; font-weight: bold;">${p.totalF}</td>
                <td style="color: #ffaa00; font-weight: bold;">${p.totalS}</td>
            </tr>
        `;
    }).join('');
}

// --- Persistence ---
function showSummary() {
    if (!confirm("¿Cerrar sesión y ver resultados finales?")) return;

    const sessionPoints = calculateSessionPoints();
    const finalSummary = tournament.players.map(p => {
        const pts = sessionPoints[p.id] || 0;
        return {
            name: p.name,
            points: p.historyPoints + pts,
            g: p.totalGoals + p.session.goals,
            m: p.totalMisses + p.session.misses,
            f: p.totalFinals + p.session.finals,
            s: p.totalSlaps + p.session.slaps,
            sessionData: { ...p.session, pts }
        };
    }).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (a.s !== b.s) return a.s - b.s;
        return b.f - a.f;
    });

    if (elements.summaryBody) {
        const initialRanking = tournament.players.map(p => {
            const currentSessionPts = sessionPoints[p.id] || 0;
            return {
                id: p.id,
                name: p.name,
                oldPoints: p.historyPoints,
                sessionPts: currentSessionPts,
                g: p.totalGoals + p.session.goals,
                m: p.totalMisses + p.session.misses,
                f: p.totalFinals + p.session.finals,
                s: p.totalSlaps + p.session.slaps
            };
        }).sort((a, b) => b.oldPoints - a.oldPoints);

        elements.summaryBody.innerHTML = initialRanking.map((p, i) => `
            <tr id="sum-row-${p.id}" class="sweep-left" style="animation-delay: ${i * 0.1}s">
                <td class="pos">${i + 1}</td>
                <td>${p.name}</td>
                <td class="pts-container" style="display: flex; gap: 8px; justify-content: center; align-items: center;">
                    <span class="pts-main" style="font-weight: bold; color: var(--primary);">${p.oldPoints}</span>
                    <span class="pts-plus" style="display: none; color: #00ff88; font-weight: bold;">+${p.sessionPts}</span>
                </td>
                <td>${((p.g / (p.g + p.m || 1)) * 100).toFixed(1)}%</td>
                <td>${p.g}/${p.m}</td>
                <td>${p.g + p.m}</td>
                <td>${p.f}</td>
                <td>${p.s}</td>
            </tr>
        `).join('');

        // Step 1: Sweep L-to-R for text (already handled by class)
        // Step 2: Show green +pts (after a delay)
        setTimeout(() => {
            document.querySelectorAll('.pts-plus').forEach(el => {
                el.style.display = 'inline';
                el.classList.add('sweep-top');
            });

            // Step 3: Merge and animate total (after green pts have been seen)
            setTimeout(() => {
                animateFinalMerge(initialRanking);
            }, 1500);
        }, 800);
    }

    renderHistory();
    switchView('summary');
}

function renderHistory() {
    if (!elements.historyList) return;
    elements.historyList.innerHTML = tournament.sessionHistory.length === 0
        ? "<p>No hay sesiones registradas.</p>"
        : tournament.sessionHistory.slice().reverse().map((session, idx) => {
            const realIdx = tournament.sessionHistory.length - 1 - idx;
            return `
                <div class="history-item clickable" onclick="viewSessionDetails(${realIdx})">
                    <div class="history-date">${session.date || `Sesión #${realIdx + 1}`}</div>
                    <div class="history-stats">
                        ${session.results.slice(0, 3).map(r => `${r.name} (${r.pts}p)`).join(', ')}...
                    </div>
                </div>
            `;
        }).join('');
}

window.viewSessionDetails = (idx) => {
    const session = tournament.sessionHistory[idx];
    if (!session) return;

    get('history-modal-title').textContent = `Detalles: ${session.date || `Sesión #${idx + 1}`}`;
    get('history-modal-body').innerHTML = session.results.map(r => `
        <tr>
            <td>${r.name}</td>
            <td>${r.goals}</td>
            <td>${r.misses}</td>
            <td style="color: #00ff88; font-weight: bold;">+${r.pts}</td>
        </tr>
    `).join('');

    get('history-modal').classList.add('active');
}

function finalizeAndSave() {
    const sessionPoints = calculateSessionPoints();
    const sessionResult = {
        date: new Date().toLocaleString(),
        results: tournament.players.map(p => ({
            name: p.name,
            pts: sessionPoints[p.id] || 0,
            goals: p.session.goals,
            misses: p.session.misses
        })).sort((a, b) => b.pts - a.pts)
    };

    tournament.sessionHistory.push(sessionResult);

    tournament.players.forEach(p => {
        p.historyPoints += (sessionPoints[p.id] || 0);
        p.totalGoals += p.session.goals;
        p.totalMisses += p.session.misses;
        p.totalFinals += p.session.finals;
        p.totalSlaps += p.session.slaps;
        p.session = { goals: 0, misses: 0, finals: 0, slaps: 0 };
    });

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tournament, null, 2));
    const link = document.createElement('a');
    link.href = dataStr;
    link.download = `${tournament.tournamentName}_updated.json`;
    link.click();

    switchView('menu');
}

function animateFinalMerge(initialRanking) {
    initialRanking.forEach(p => {
        const row = get(`sum-row-${p.id}`);
        if (!row) return;

        const ptsMain = row.querySelector('.pts-main');
        const ptsPlus = row.querySelector('.pts-plus');

        // Animation de fusion
        ptsPlus.style.transform = 'translateY(-10px)';
        ptsPlus.style.opacity = '0';
        ptsPlus.style.transition = 'all 0.5s ease-in';

        const newTotal = p.oldPoints + p.sessionPts;
        setTimeout(() => {
            ptsPlus.style.display = 'none';
            animateValue(ptsMain, p.oldPoints, newTotal, 1000);
        }, 500);
    });

    // Re-order sorting at the very end
    setTimeout(() => {
        const finalResults = initialRanking.sort((a, b) => {
            const totalA = a.oldPoints + a.sessionPts;
            const totalB = b.oldPoints + b.sessionPts;
            if (totalB !== totalA) return totalB - totalA;
            if (a.s !== b.s) return a.s - b.s;
            return b.f - a.f;
        });

        // Re-order the elements
        elements.summaryBody.style.opacity = '0';
        elements.summaryBody.style.transition = 'opacity 0.5s ease';

        setTimeout(() => {
            elements.summaryBody.innerHTML = finalResults.map((p, i) => {
                const totalPoints = p.oldPoints + p.sessionPts;
                return `
                    <tr class="sweep-left">
                        <td>${i + 1}</td>
                        <td>${p.name}</td>
                        <td style="font-weight: bold; color: var(--primary);">${totalPoints}</td>
                        <td>${((p.g / (p.g + p.m || 1)) * 100).toFixed(1)}%</td>
                        <td>${p.g}/${p.m}</td>
                        <td>${p.g + p.m}</td>
                        <td>${p.f}</td>
                        <td>${p.s}</td>
                    </tr>
                `;
            }).join('');
            elements.summaryBody.style.opacity = '1';
        }, 500);
    }, 2500);
}

function animateValue(obj, start, end, duration) {
    if (start === end) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            obj.innerHTML = end;
        }
    };
    window.requestAnimationFrame(step);
}

init();
