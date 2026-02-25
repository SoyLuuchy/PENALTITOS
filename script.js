// App State
let tournament = {
    tournamentName: "",
    players: []
};

// DOM Elements - Helper to avoid crashes if missing
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
    leaderboardBody: query('#leaderboard-table tbody'),
    summaryBody: query('#summary-table tbody'),
    finalGoalModal: get('final-goal-modal'),
    finalPlayersList: get('final-players-list'),
    btnConfirmSave: get('btn-confirm-save')
};

// --- Initialization ---
function init() {
    // Basic checks
    if (!views.menu) return console.error("Menu view missing");

    get('btn-create-tourney')?.addEventListener('click', () => switchView('create'));
    get('btn-back-menu')?.addEventListener('click', () => switchView('menu'));
    get('btn-add-participant')?.addEventListener('click', addParticipantInput);
    get('btn-start-tourney')?.addEventListener('click', initTournament);
    get('load-json')?.addEventListener('change', loadTournament);
    get('btn-end-session')?.addEventListener('click', showSummary);
    elements.btnConfirmSave?.addEventListener('click', finalizeAndSave);

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            get(`${btn.dataset.tab}-tab`)?.classList.add('active');
            if (btn.dataset.tab === 'leaderboard') updateLeaderboard();
        });
    });

    // Close modal listener
    document.querySelector('.close-modal')?.addEventListener('click', () => {
        elements.finalGoalModal.classList.remove('active');
    });
}

// --- View Navigation ---
function switchView(viewId) {
    Object.values(views).forEach(v => {
        if (v) v.classList.remove('active');
    });
    if (views[viewId]) {
        views[viewId].classList.add('active');
    }
    window.scrollTo(0, 0);
}

// --- Setup Logic ---
function addParticipantInput() {
    const div = document.createElement('div');
    div.className = 'participant-entry';
    div.innerHTML = `<input type="text" placeholder="Nombre Participante" class="input-glass participant-name">`;
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
        }))
    };

    startSession();
}

function loadTournament(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            tournament = JSON.parse(e.target.result);
            // Safety: Ensure session object exists
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
    renderControls();
    updateLeaderboard();
    switchView('game');
}

// --- Game Logic ---
function renderControls() {
    if (!elements.playerControls) return;
    elements.playerControls.innerHTML = "";
    tournament.players.forEach(player => {
        const card = document.createElement('div');
        card.className = 'player-card';
        card.innerHTML = `
            <div class="player-header">
                <span class="player-name">${player.name}</span>
                <span class="player-session-stats">Sesión: ${player.session.goals}G / ${player.session.misses}F / ${player.session.finals}Fi / ${player.session.slaps}Cl</span>
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
        renderControls();
        updateLeaderboard();
    }
};

function calculateSessionPoints() {
    const sorted = [...tournament.players].sort((a, b) => {
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

function updateLeaderboard() {
    if (!elements.leaderboardBody) return;
    const sessionPoints = calculateSessionPoints();
    const ranking = tournament.players.map(p => {
        const totalAttempts = p.session.goals + p.session.misses;
        const percent = totalAttempts > 0 ? ((p.session.goals / totalAttempts) * 100).toFixed(1) : 0;
        return {
            ...p,
            liveTotal: p.historyPoints + (sessionPoints[p.id] || 0),
            sessionPts: sessionPoints[p.id] || 0,
            percent: percent,
            displayG: p.session.goals,
            displayM: p.session.misses,
            displayT: p.session.goals + p.session.misses,
            displayFinals: p.session.finals,
            displaySlaps: p.session.slaps
        };
    }).sort((a, b) => {
        if (b.liveTotal !== a.liveTotal) return b.liveTotal - a.liveTotal;
        const totalSlapsA = a.totalSlaps + a.session.slaps;
        const totalSlapsB = b.totalSlaps + b.session.slaps;
        if (totalSlapsA !== totalSlapsB) return totalSlapsA - totalSlapsB;
        const totalFinalsA = a.totalFinals + a.session.finals;
        const totalFinalsB = b.totalFinals + b.session.finals;
        return totalFinalsB - totalFinalsA;
    });

    elements.leaderboardBody.innerHTML = ranking.map((p, i) => `
        <tr>
            <td>${i + 1}</td>
            <td>${p.name}</td>
            <td style="color: var(--primary); font-weight: bold;">${p.liveTotal}</td>
            <td style="color: #00ff88; font-weight: bold;">+${p.sessionPts}</td>
            <td>${p.percent}%</td>
            <td>${p.displayG}/${p.displayM}</td>
            <td>${p.displayT}</td>
            <td>${p.displayFinals}</td>
            <td>${p.displaySlaps}</td>
        </tr>
    `).join('');
}

// --- Persistence & Summary ---
function showSummary() {
    if (!confirm("¿Cerrar sesión y ver resultados finales?")) return;

    const sessionPoints = calculateSessionPoints();
    const finalRanking = tournament.players.map(p => {
        const hPoints = p.historyPoints + (sessionPoints[p.id] || 0);
        const g = p.totalGoals + p.session.goals;
        const m = p.totalMisses + p.session.misses;
        const f = p.totalFinals + p.session.finals;
        const s = p.totalSlaps + p.session.slaps;
        const totalTry = g + m;
        const per = totalTry > 0 ? ((g / totalTry) * 100).toFixed(1) : 0;
        return { name: p.name, points: hPoints, g, m, t: totalTry, f, s, per };
    }).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (a.s !== b.s) return a.s - b.s;
        return b.f - a.f;
    });

    if (elements.summaryBody) {
        elements.summaryBody.innerHTML = finalRanking.map((p, i) => `
            <tr>
                <td>${i + 1}</td>
                <td>${p.name}</td>
                <td style="color: var(--primary); font-weight: bold;">${p.points}</td>
            <td>${p.per}%</td>
            <td>${p.g}/${p.m}</td>
            <td>${p.t}</td>
            <td>${p.f}</td>
            <td>${p.s}</td>
            </tr>
        `).join('');
    }

    switchView('summary');
}

function finalizeAndSave() {
    const sessionPoints = calculateSessionPoints();

    tournament.players.forEach(p => {
        p.historyPoints += (sessionPoints[p.id] || 0);
        p.totalGoals += p.session.goals;
        p.totalMisses += p.session.misses;
        p.totalFinals += p.session.finals;
        p.totalSlaps += p.session.slaps;
        // The following lines are not needed here as these are temporary display properties
        // and are calculated dynamically in updateLeaderboard.
        // displayG: p.session.goals,
        // displayM: p.session.misses,
        // displayT: p.session.goals + p.session.misses,
        // displayFinals: p.session.finals,
        // displaySlaps: p.session.slaps,
        p.session = { goals: 0, misses: 0, finals: 0, slaps: 0 };
    });

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tournament, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${tournament.tournamentName}_fin.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();

    switchView('menu');
}

// Start the app
init();
