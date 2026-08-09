/* ==========================================================================
   AETHEL CHRONO-MASTER - APPLICATION ENGINE
   High Precision Timer, Moving Background Black Clock Canvas, Web Audio & API
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================
  const state = {
    mode: 'stopwatch', // 'stopwatch' | 'countdown'
    isRunning: false,
    startTime: 0,
    elapsedTime: 0, // Accumulated time in ms
    timerId: null,
    
    // Countdown specific
    countdownDuration: 300000, // Default 5 mins in ms
    countdownRemaining: 300000,
    
    // Lap Tracking
    laps: [],
    lapStartTime: 0,
    lastLapSplitTime: 0,
    
    // Audio Synth
    soundEnabled: true,
    audioCtx: null,

    // Backend Connection
    apiBase: '/api'
  };

  // DOM Elements Selection
  const dom = {
    // Canvas
    canvas: document.getElementById('bg-clock-canvas'),
    
    // Header & Controls
    soundToggleBtn: document.getElementById('sound-toggle-btn'),
    statusPill: document.getElementById('server-status-pill'),
    exportAllBtn: document.getElementById('export-all-btn'),
    modeTabs: document.querySelectorAll('.mode-tab'),
    crownPusherBtn: document.getElementById('crown-pusher-btn'),
    
    // Digital Displays
    digitsHours: document.getElementById('digits-hours'),
    digitsMinutes: document.getElementById('digits-minutes'),
    digitsSeconds: document.getElementById('digits-seconds'),
    digitsMillis: document.getElementById('digits-millis'),
    currentLapPreview: document.getElementById('current-lap-preview'),
    currentLapNumber: document.getElementById('current-lap-number'),
    currentLapTime: document.getElementById('current-lap-time'),
    countdownInputs: document.getElementById('countdown-inputs'),
    inputHrs: document.getElementById('input-hrs'),
    inputMin: document.getElementById('input-min'),
    inputSec: document.getElementById('input-sec'),

    // Analog Hands
    mainHand: document.getElementById('analog-main-hand'),
    lapHand: document.getElementById('analog-lap-hand'),
    minSubHand: document.getElementById('min-sub-hand'),
    msSubHand: document.getElementById('ms-sub-hand'),

    // Buttons
    startBtn: document.getElementById('start-btn'),
    startBtnLabel: document.getElementById('start-btn-label'),
    lapBtn: document.getElementById('lap-btn'),
    resetBtn: document.getElementById('reset-btn'),
    saveTriggerBtn: document.getElementById('save-session-trigger-btn'),

    // Telemetry & Laps
    recordedLapsCount: document.getElementById('recorded-laps-count'),
    metricFastest: document.getElementById('metric-fastest'),
    metricAvg: document.getElementById('metric-avg'),
    metricSlowest: document.getElementById('metric-slowest'),
    chartEmptyState: document.getElementById('chart-empty-state'),
    barsWrapper: document.getElementById('bars-wrapper'),
    lapsTableBody: document.getElementById('laps-table-body'),

    // Saved History
    serverStatsBar: document.getElementById('server-stats-bar'),
    statTotalSessions: document.getElementById('stat-total-sessions'),
    statTotalTime: document.getElementById('stat-total-time'),
    statTotalLaps: document.getElementById('stat-total-laps'),
    statFastestLap: document.getElementById('stat-fastest-lap'),
    sessionsGrid: document.getElementById('sessions-grid'),
    refreshSessionsBtn: document.getElementById('refresh-sessions-btn'),

    // Save Modal
    saveModalOverlay: document.getElementById('save-modal-overlay'),
    closeSaveModal: document.getElementById('close-save-modal'),
    cancelSaveBtn: document.getElementById('cancel-save-btn'),
    saveSessionForm: document.getElementById('save-session-form'),
    sessionTitle: document.getElementById('session-title'),
    sessionCategory: document.getElementById('session-category'),
    sessionNotes: document.getElementById('session-notes'),
    modalSummaryTime: document.getElementById('modal-summary-time'),
    modalSummaryLaps: document.getElementById('modal-summary-laps'),

    // Detail Modal
    detailModalOverlay: document.getElementById('detail-modal-overlay'),
    closeDetailModal: document.getElementById('close-detail-modal'),
    detailModalTitle: document.getElementById('detail-modal-title'),
    detailModalContent: document.getElementById('detail-modal-content')
  };

  // Initialize Application
  initApp();

  function initApp() {
    setupAnalogDialTicks();
    initMovingBackgroundClock();
    initAudioContext();
    bindEvents();
    checkBackendConnection();
    loadSavedSessions();
    loadServerStats();
  }

  // ==========================================
  // WEB AUDIO SYNTHESIZER
  // ==========================================
  function initAudioContext() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      state.audioCtx = new AudioContext();
    }
  }

  function playSound(type) {
    if (!state.soundEnabled || !state.audioCtx) return;
    if (state.audioCtx.state === 'suspended') {
      state.audioCtx.resume();
    }

    try {
      const now = state.audioCtx.currentTime;
      const osc = state.audioCtx.createOscillator();
      const gain = state.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(state.audioCtx.destination);

      if (type === 'tick') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1000, now);
        osc.frequency.exponentialRampToValueAtTime(250, now + 0.03);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
        osc.start(now);
        osc.stop(now + 0.03);
      } else if (type === 'click') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(700, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.06);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc.start(now);
        osc.stop(now + 0.06);
      } else if (type === 'lap') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1560, now);
        osc.frequency.setValueAtTime(2340, now + 0.08);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (type === 'alarm') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, now);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
      }
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  }

  // ==========================================
  // HIGH-PRECISION TIMER LOGIC
  // ==========================================
  function startTimer() {
    if (state.isRunning) return;

    playSound('click');
    state.isRunning = true;

    if (state.mode === 'stopwatch') {
      state.startTime = performance.now() - state.elapsedTime;
      if (state.laps.length === 0) {
        state.lapStartTime = state.startTime;
      }
    } else {
      const hrs = parseInt(dom.inputHrs.value) || 0;
      const min = parseInt(dom.inputMin.value) || 0;
      const sec = parseInt(dom.inputSec.value) || 0;
      state.countdownDuration = (hrs * 3600 + min * 60 + sec) * 1000;
      
      if (state.countdownRemaining <= 0 || state.countdownRemaining > state.countdownDuration) {
        state.countdownRemaining = state.countdownDuration;
      }
      state.startTime = performance.now() - (state.countdownDuration - state.countdownRemaining);
    }

    updateUIState();
    runTimerLoop();
  }

  function pauseTimer() {
    if (!state.isRunning) return;

    playSound('click');
    state.isRunning = false;
    if (state.timerId) cancelAnimationFrame(state.timerId);
    updateUIState();
  }

  function resetTimer() {
    playSound('click');
    state.isRunning = false;
    if (state.timerId) cancelAnimationFrame(state.timerId);
    
    state.elapsedTime = 0;
    state.countdownRemaining = state.countdownDuration;
    state.laps = [];
    state.lastLapSplitTime = 0;

    renderDigitalTime(state.mode === 'stopwatch' ? 0 : state.countdownDuration);
    updateAnalogHands(0, 0);
    renderLapsTable();
    updateUIState();
  }

  function runTimerLoop() {
    if (!state.isRunning) return;

    const now = performance.now();

    if (state.mode === 'stopwatch') {
      state.elapsedTime = now - state.startTime;
      renderDigitalTime(state.elapsedTime);

      const currSec = Math.floor(state.elapsedTime / 1000);
      if (currSec !== state.lastTickSec) {
        playSound('tick');
        state.lastTickSec = currSec;
      }

      updateAnalogHands(state.elapsedTime, getCurrentLapDuration());
      state.timerId = requestAnimationFrame(runTimerLoop);
    } else {
      const elapsed = now - state.startTime;
      state.countdownRemaining = Math.max(0, state.countdownDuration - elapsed);
      renderDigitalTime(state.countdownRemaining);

      updateAnalogHands(state.countdownRemaining, 0);

      if (state.countdownRemaining <= 0) {
        state.isRunning = false;
        playSound('alarm');
        alert('⌛ Chronometer Countdown Completed!');
        updateUIState();
      } else {
        state.timerId = requestAnimationFrame(runTimerLoop);
      }
    }
  }

  function recordLap() {
    if (!state.isRunning || state.mode !== 'stopwatch') return;

    playSound('lap');
    const totalSplitTime = state.elapsedTime;
    const lapTime = totalSplitTime - state.lastLapSplitTime;
    state.lastLapSplitTime = totalSplitTime;

    const lapObj = {
      lapNumber: state.laps.length + 1,
      lapTimeMs: lapTime,
      formattedLapTime: formatMs(lapTime),
      splitTimeMs: totalSplitTime,
      formattedSplitTime: formatMs(totalSplitTime)
    };

    state.laps.unshift(lapObj);
    renderLapsTable();
  }

  function getCurrentLapDuration() {
    if (state.laps.length === 0) return state.elapsedTime;
    return state.elapsedTime - state.lastLapSplitTime;
  }

  // ==========================================
  // UI RENDERING & ANALYTICS
  // ==========================================
  function renderDigitalTime(ms) {
    const formatted = formatMsParts(ms);
    dom.digitsHours.textContent = formatted.hours;
    dom.digitsMinutes.textContent = formatted.minutes;
    dom.digitsSeconds.textContent = formatted.seconds;
    dom.digitsMillis.textContent = formatted.millis;

    if (state.mode === 'stopwatch') {
      const lapMs = getCurrentLapDuration();
      dom.currentLapNumber.textContent = `#${state.laps.length + 1}`;
      dom.currentLapTime.textContent = formatMs(lapMs);
    }
  }

  function updateAnalogHands(totalMs, currentLapMs) {
    // Continuous cumulative rotation to ensure smooth 360° clockwise motion past 12 o'clock without backward jumps
    const mainDeg = (totalMs / 1000) * 6;
    dom.mainHand.style.transform = `rotate(${mainDeg}deg)`;

    const lapDeg = (currentLapMs / 1000) * 6;
    dom.lapHand.style.transform = `rotate(${lapDeg}deg)`;

    const minDeg = (totalMs / 60000) * 6;
    dom.minSubHand.style.transform = `rotate(${minDeg}deg)`;

    // 1/100s sub-dial hand rotates 360 degrees every 1 second (1000ms)
    const msDeg = (totalMs / 1000) * 360;
    dom.msSubHand.style.transform = `rotate(${msDeg}deg)`;
  }

  function renderLapsTable() {
    const totalLaps = state.laps.length;
    dom.recordedLapsCount.textContent = `${totalLaps} Laps Recorded`;

    if (totalLaps === 0) {
      dom.metricFastest.textContent = '--:--.---';
      dom.metricAvg.textContent = '--:--.---';
      dom.metricSlowest.textContent = '--:--.---';
      dom.chartEmptyState.classList.remove('hidden');
      dom.barsWrapper.classList.add('hidden');
      dom.lapsTableBody.innerHTML = `
        <tr class="empty-row">
          <td colspan="5">No lap times recorded. Click "START" then "LAP / SPLIT" during timing.</td>
        </tr>
      `;
      dom.saveTriggerBtn.disabled = true;
      return;
    }

    dom.saveTriggerBtn.disabled = false;

    const lapTimes = state.laps.map(l => l.lapTimeMs);
    const fastestMs = Math.min(...lapTimes);
    const slowestMs = Math.max(...lapTimes);
    const avgMs = Math.round(lapTimes.reduce((a, b) => a + b, 0) / lapTimes.length);

    dom.metricFastest.textContent = formatMs(fastestMs);
    dom.metricSlowest.textContent = formatMs(slowestMs);
    dom.metricAvg.textContent = formatMs(avgMs);

    let tableHtml = '';
    state.laps.forEach((lap) => {
      let badgeHtml = '<span class="badge-normal">Normal</span>';
      if (lap.lapTimeMs === fastestMs && totalLaps > 1) {
        badgeHtml = '<span class="badge-fastest"><i class="fa-solid fa-crown"></i> Fastest</span>';
      } else if (lap.lapTimeMs === slowestMs && totalLaps > 1) {
        badgeHtml = '<span class="badge-slowest">Slowest</span>';
      }

      const deltaMs = lap.lapTimeMs - avgMs;
      const deltaSign = deltaMs > 0 ? '+' : '';
      const deltaFormatted = `${deltaSign}${(deltaMs / 1000).toFixed(3)}s`;

      tableHtml += `
        <tr>
          <td>#${lap.lapNumber}</td>
          <td><strong>${lap.formattedLapTime}</strong></td>
          <td>${lap.formattedSplitTime}</td>
          <td style="color: ${deltaMs <= 0 ? 'var(--brass-dark)' : 'var(--accent-red)'}">${deltaFormatted}</td>
          <td>${badgeHtml}</td>
        </tr>
      `;
    });
    dom.lapsTableBody.innerHTML = tableHtml;

    renderLapChart(state.laps, fastestMs, slowestMs);
  }

  function renderLapChart(laps, fastestMs, slowestMs) {
    dom.chartEmptyState.classList.add('hidden');
    dom.barsWrapper.classList.remove('hidden');

    const reversedLaps = [...laps].reverse();
    const maxVal = slowestMs > 0 ? slowestMs : 1;

    let barsHtml = '';
    reversedLaps.forEach(l => {
      const heightPct = Math.max(15, Math.round((l.lapTimeMs / maxVal) * 100));
      let barClass = 'bar-fill';
      if (l.lapTimeMs === fastestMs && laps.length > 1) barClass += ' fastest';
      if (l.lapTimeMs === slowestMs && laps.length > 1) barClass += ' slowest';

      barsHtml += `
        <div class="chart-bar-item" title="Lap #${l.lapNumber}: ${l.formattedLapTime}">
          <div class="${barClass}" style="height: ${heightPct}%"></div>
          <span class="bar-label">L${l.lapNumber}</span>
        </div>
      `;
    });
    dom.barsWrapper.innerHTML = barsHtml;
  }

  function updateUIState() {
    if (state.isRunning) {
      dom.startBtn.classList.add('running');
      dom.startBtnLabel.textContent = 'PAUSE';
      dom.startBtn.querySelector('i').className = 'fa-solid fa-pause';
      dom.lapBtn.disabled = state.mode !== 'stopwatch';
    } else {
      dom.startBtn.classList.remove('running');
      dom.startBtnLabel.textContent = 'START';
      dom.startBtn.querySelector('i').className = 'fa-solid fa-play';
      dom.lapBtn.disabled = true;
    }
  }

  function setupAnalogDialTicks() {
    const ticksContainer = document.getElementById('dial-ticks');
    if (!ticksContainer) return;

    let ticksHtml = '';
    for (let i = 0; i < 60; i++) {
      const deg = i * 6;
      const isMajor = i % 5 === 0;
      ticksHtml += `<div class="tick-mark ${isMajor ? 'major' : ''}" style="transform: rotate(${deg}deg)"></div>`;
      
      if (isMajor) {
        const num = i === 0 ? 60 : i;
        ticksHtml += `<div class="tick-number" style="transform: rotate(${deg}deg)">${num}</div>`;
      }
    }
    ticksContainer.innerHTML = ticksHtml;
  }

  // ==========================================
  // MOVING BACKGROUND BLACK CLOCK WITH CHORD / PENDULUM
  // ==========================================
  function initMovingBackgroundClock() {
    const ctx = dom.canvas.getContext('2d');
    let pendulumAngle = 0;

    function resize() {
      dom.canvas.width = window.innerWidth;
      dom.canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    function drawBackgroundClock() {
      ctx.clearRect(0, 0, dom.canvas.width, dom.canvas.height);

      const w = dom.canvas.width;
      const h = dom.canvas.height;
      
      // Position the background clock centered slightly to the right
      const clockX = w * 0.72;
      const clockY = h * 0.38;
      const radius = Math.min(w, h) * 0.28;

      const date = new Date();
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const seconds = date.getSeconds() + date.getMilliseconds() / 1000;

      // 1. Draw Winding Chord & Pendulum
      pendulumAngle += 0.03;
      const pendulumSwing = Math.sin(pendulumAngle) * 0.12;
      const chordLength = radius * 1.6;
      const pendulumBobX = clockX + Math.sin(pendulumSwing) * chordLength;
      const pendulumBobY = clockY + Math.cos(pendulumSwing) * chordLength;

      // Draw Winding Chord/Chain Line
      ctx.beginPath();
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 3;
      ctx.moveTo(clockX, clockY);
      ctx.lineTo(pendulumBobX, pendulumBobY);
      ctx.stroke();

      // Pendulum Brass Bob Weight
      ctx.beginPath();
      ctx.arc(pendulumBobX, pendulumBobY, 18, 0, Math.PI * 2);
      ctx.fillStyle = '#b8860b';
      ctx.fill();
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 3;
      ctx.stroke();

      // 2. Draw Large Black Clock Frame
      ctx.beginPath();
      ctx.arc(clockX, clockY, radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(26, 26, 26, 0.92)';
      ctx.fill();
      ctx.strokeStyle = '#c89d35';
      ctx.lineWidth = 6;
      ctx.stroke();

      // Inner subtle ring
      ctx.beginPath();
      ctx.arc(clockX, clockY, radius * 0.95, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(243, 224, 152, 0.2)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 3. Draw Hour Numbers (Roman Numerals)
      const numerals = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
      ctx.fillStyle = '#eae2d2';
      ctx.font = `700 ${Math.round(radius * 0.11)}px "Cinzel", serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      numerals.forEach((num, idx) => {
        const ang = (idx * Math.PI) / 6;
        const nx = clockX + Math.sin(ang) * (radius * 0.78);
        const ny = clockY - Math.cos(ang) * (radius * 0.78);
        ctx.fillText(num, nx, ny);
      });

      // 4. Moving Clock Hands (Black Steel & Gold Needle)
      // Hour hand
      const hrAngle = ((hours % 12) + minutes / 60) * (Math.PI / 6);
      drawHand(ctx, clockX, clockY, hrAngle, radius * 0.48, 6, '#eae2d2');

      // Minute hand
      const minAngle = (minutes + seconds / 60) * (Math.PI / 30);
      drawHand(ctx, clockX, clockY, minAngle, radius * 0.68, 4, '#eae2d2');

      // Second hand (moving continuously)
      const secAngle = seconds * (Math.PI / 30);
      drawHand(ctx, clockX, clockY, secAngle, radius * 0.82, 2, '#d4af37');

      // Center Cap
      ctx.beginPath();
      ctx.arc(clockX, clockY, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#d4af37';
      ctx.fill();

      requestAnimationFrame(drawBackgroundClock);
    }

    function drawHand(ctx, cx, cy, angle, length, width, color) {
      ctx.save();
      ctx.beginPath();
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.strokeStyle = color;
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.sin(angle) * length, cy - Math.cos(angle) * length);
      ctx.stroke();
      ctx.restore();
    }

    requestAnimationFrame(drawBackgroundClock);
  }

  // ==========================================
  // REST API INTEGRATION
  // ==========================================
  async function checkBackendConnection() {
    try {
      const res = await fetch(`${state.apiBase}/health`);
      if (res.ok) {
        dom.statusPill.innerHTML = `
          <span class="status-dot"></span>
          <span class="status-text">Backend Connected</span>
        `;
      }
    } catch (e) {
      dom.statusPill.innerHTML = `
        <span class="status-dot" style="background: var(--accent-red); box-shadow: 0 0 8px var(--accent-red)"></span>
        <span class="status-text">Offline / Local Mode</span>
      `;
    }
  }

  async function loadSavedSessions() {
    dom.sessionsGrid.innerHTML = `
      <div class="loading-spinner-container" id="sessions-loading">
        <i class="fa-solid fa-circle-notch fa-spin"></i>
        <p>Connecting to Horology Database...</p>
      </div>
    `;

    try {
      const res = await fetch(`${state.apiBase}/sessions`);
      const data = await res.json();

      if (data.success && data.sessions) {
        renderSessionsGrid(data.sessions);
      }
    } catch (e) {
      dom.sessionsGrid.innerHTML = `<p style="color: var(--text-muted); text-align: center; grid-column: 1/-1;">Could not connect to backend server.</p>`;
    }
  }

  async function loadServerStats() {
    try {
      const res = await fetch(`${state.apiBase}/stats`);
      const data = await res.json();
      if (data.success && data.stats) {
        dom.statTotalSessions.textContent = data.stats.totalSessions;
        dom.statTotalTime.textContent = data.stats.formattedAggregateTime;
        dom.statTotalLaps.textContent = data.stats.totalLaps;
        dom.statFastestLap.textContent = data.stats.formattedGlobalFastestLap;
      }
    } catch (e) {
      console.warn('Failed to load server stats:', e);
    }
  }

  function renderSessionsGrid(sessions) {
    if (!sessions || sessions.length === 0) {
      dom.sessionsGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 30px;">
          <i class="fa-solid fa-box-open" style="font-size: 2rem; color: var(--brass-dark); margin-bottom: 10px;"></i>
          <p>No saved timing sessions yet. Record laps and click "SAVE" to store sessions.</p>
        </div>
      `;
      return;
    }

    let cardsHtml = '';
    sessions.forEach(sess => {
      const dateStr = new Date(sess.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      cardsHtml += `
        <div class="session-card" data-id="${sess.id}">
          <div>
            <div class="card-header">
              <span class="card-title">${escapeHtml(sess.title)}</span>
              <span class="card-tag">${escapeHtml(sess.category || 'General')}</span>
            </div>
            <div class="card-time">${sess.formattedTotal}</div>
            <div class="card-meta">
              <span><i class="fa-solid fa-flag"></i> ${sess.laps.length} Laps</span>
              <span><i class="fa-solid fa-calendar"></i> ${dateStr}</span>
            </div>
          </div>
          <div class="card-actions">
            <button class="card-btn view-card-btn" onclick="window.viewSessionDetail('${sess.id}')">
              <i class="fa-solid fa-eye"></i> Details
            </button>
            <button class="card-btn delete-card-btn" onclick="window.deleteSession('${sess.id}')" title="Delete Session">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
      `;
    });
    dom.sessionsGrid.innerHTML = cardsHtml;
  }

  // Save Session Form Submit
  dom.saveSessionForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = dom.sessionTitle.value.trim();
    const category = dom.sessionCategory.value;
    const notes = dom.sessionNotes.value.trim();

    const payload = {
      title,
      category,
      totalTimeMs: state.elapsedTime,
      formattedTotal: formatMs(state.elapsedTime),
      laps: state.laps,
      notes
    };

    try {
      const res = await fetch(`${state.apiBase}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        playSound('lap');
        closeSaveModal();
        loadSavedSessions();
        loadServerStats();
      } else {
        alert('Error saving session: ' + data.error);
      }
    } catch (e) {
      alert('Failed to connect to backend server.');
    }
  });

  // Global Session Handlers
  window.viewSessionDetail = async (id) => {
    try {
      const res = await fetch(`${state.apiBase}/sessions/${id}`);
      const data = await res.json();
      if (data.success && data.session) {
        const s = data.session;
        dom.detailModalTitle.textContent = `${s.title} (${s.category})`;

        let lapRows = '';
        s.laps.forEach(l => {
          lapRows += `
            <tr>
              <td>#${l.lapNumber}</td>
              <td>${l.formattedLapTime}</td>
              <td>${l.formattedSplitTime}</td>
            </tr>
          `;
        });

        dom.detailModalContent.innerHTML = `
          <div style="margin-bottom: 20px;">
            <p style="font-size: 1.8rem; font-family: var(--font-mono); color: var(--brass-dark); font-weight: 700;">${s.formattedTotal}</p>
            <p style="color: var(--text-muted); font-size: 0.85rem;">Recorded on: ${new Date(s.createdAt).toLocaleString()}</p>
            ${s.notes ? `<p style="margin-top: 10px; background: var(--bg-cream-100); padding: 10px; border-radius: 8px; color: var(--steel-dark); font-style: italic;">"${escapeHtml(s.notes)}"</p>` : ''}
          </div>
          <table class="chrono-table" style="width: 100%;">
            <thead>
              <tr><th>Lap #</th><th>Lap Duration</th><th>Total Split</th></tr>
            </thead>
            <tbody>${lapRows}</tbody>
          </table>
        `;
        dom.detailModalOverlay.classList.remove('hidden');
      }
    } catch (e) {
      alert('Could not load session details.');
    }
  };

  window.deleteSession = async (id) => {
    if (!confirm('Are you sure you want to delete this session record?')) return;
    try {
      const res = await fetch(`${state.apiBase}/sessions/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        loadSavedSessions();
        loadServerStats();
      }
    } catch (e) {
      alert('Failed to delete session.');
    }
  };

  // CSV Export Trigger
  dom.exportAllBtn.addEventListener('click', async () => {
    try {
      const res = await fetch(`${state.apiBase}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'csv' })
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AETHEL_Chrono_Sessions_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      alert('Error exporting sessions.');
    }
  });

  // ==========================================
  // EVENT BINDINGS
  // ==========================================
  function bindEvents() {
    // Top Crown Pusher Click
    if (dom.crownPusherBtn) {
      dom.crownPusherBtn.addEventListener('click', () => {
        dom.startBtn.click();
      });
    }

    // Sound Toggle
    dom.soundToggleBtn.addEventListener('click', () => {
      state.soundEnabled = !state.soundEnabled;
      const icon = dom.soundToggleBtn.querySelector('i');
      const tooltip = dom.soundToggleBtn.querySelector('.btn-tooltip');
      if (state.soundEnabled) {
        icon.className = 'fa-solid fa-volume-high';
        tooltip.textContent = 'Sound ON';
      } else {
        icon.className = 'fa-solid fa-volume-xmark';
        tooltip.textContent = 'Sound OFF';
      }
    });

    // Mode Switcher
    dom.modeTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        if (state.isRunning) pauseTimer();
        dom.modeTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.mode = tab.dataset.mode;

        if (state.mode === 'countdown') {
          dom.countdownInputs.classList.remove('hidden');
          dom.currentLapPreview.classList.add('hidden');
          dom.lapBtn.style.display = 'none';
        } else {
          dom.countdownInputs.classList.add('hidden');
          dom.currentLapPreview.classList.remove('hidden');
          dom.lapBtn.style.display = 'flex';
        }
        resetTimer();
      });
    });

    // Primary Buttons
    dom.startBtn.addEventListener('click', () => {
      if (state.isRunning) pauseTimer();
      else startTimer();
    });

    dom.lapBtn.addEventListener('click', recordLap);
    dom.resetBtn.addEventListener('click', resetTimer);

    // Save Modal Triggers
    dom.saveTriggerBtn.addEventListener('click', openSaveModal);
    dom.closeSaveModal.addEventListener('click', closeSaveModal);
    dom.cancelSaveBtn.addEventListener('click', closeSaveModal);
    dom.closeDetailModal.addEventListener('click', () => dom.detailModalOverlay.classList.add('hidden'));

    dom.refreshSessionsBtn.addEventListener('click', () => {
      loadSavedSessions();
      loadServerStats();
    });

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        dom.startBtn.click();
      } else if (e.code === 'KeyL') {
        e.preventDefault();
        if (!dom.lapBtn.disabled) dom.lapBtn.click();
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        dom.resetBtn.click();
      } else if (e.code === 'KeyS') {
        e.preventDefault();
        if (!dom.saveTriggerBtn.disabled) dom.saveTriggerBtn.click();
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        dom.soundToggleBtn.click();
      }
    });
  }

  function openSaveModal() {
    dom.modalSummaryTime.textContent = formatMs(state.elapsedTime);
    dom.modalSummaryLaps.textContent = state.laps.length;
    dom.saveModalOverlay.classList.remove('hidden');
    dom.sessionTitle.focus();
  }

  function closeSaveModal() {
    dom.saveModalOverlay.classList.add('hidden');
    dom.saveSessionForm.reset();
  }

  // Helper Utilities
  function formatMs(ms) {
    const parts = formatMsParts(ms);
    return `${parts.hours !== '00' ? parts.hours + ':' : ''}${parts.minutes}:${parts.seconds}.${parts.millis}`;
  }

  function formatMsParts(ms) {
    if (!ms || ms <= 0) return { hours: '00', minutes: '00', seconds: '00', millis: '000' };
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const mi = Math.floor(ms % 1000);

    return {
      hours: String(h).padStart(2, '0'),
      minutes: String(m).padStart(2, '0'),
      seconds: String(s).padStart(2, '0'),
      millis: String(mi).padStart(3, '0')
    };
  }

  function escapeHtml(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
  }
});
