const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Vercel serverless environment path handling
const SEED_FILE = path.join(__dirname, 'data', 'sessions.json');
const DATA_FILE = process.env.VERCEL ? '/tmp/sessions.json' : SEED_FILE;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper to safely read database
function readSessions() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      const dir = path.dirname(DATA_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      
      // If seed file exists, copy seed data to /tmp/sessions.json
      if (fs.existsSync(SEED_FILE)) {
        const seedData = fs.readFileSync(SEED_FILE, 'utf8');
        fs.writeFileSync(DATA_FILE, seedData, 'utf8');
        return JSON.parse(seedData || '[]');
      }
      
      fs.writeFileSync(DATA_FILE, '[]', 'utf8');
      return [];
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    console.error('Error reading sessions database:', err);
    return [];
  }
}

// Helper to write database
function writeSessions(sessions) {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(sessions, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing sessions database:', err);
  }
}

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'AETHEL CHRONO-MASTER SERVER',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.VERCEL ? 'vercel-serverless' : 'local-node'
  });
});

// GET /api/sessions - Get all saved sessions
app.get('/api/sessions', (req, res) => {
  const sessions = readSessions();
  res.json({
    success: true,
    count: sessions.length,
    sessions: sessions
  });
});

// POST /api/sessions - Create new saved session
app.post('/api/sessions', (req, res) => {
  const { title, category, totalTimeMs, formattedTotal, laps, notes } = req.body;

  if (!totalTimeMs || !laps || !Array.isArray(laps)) {
    return res.status(400).json({ success: false, error: 'Invalid session payload. totalTimeMs and laps are required.' });
  }

  const lapTimes = laps.map(l => l.lapTimeMs || 0).filter(t => t > 0);
  const fastestLapMs = lapTimes.length > 0 ? Math.min(...lapTimes) : 0;
  const slowestLapMs = lapTimes.length > 0 ? Math.max(...lapTimes) : 0;
  const avgLapMs = lapTimes.length > 0 ? Math.round(lapTimes.reduce((a, b) => a + b, 0) / lapTimes.length) : 0;

  const newSession = {
    id: `sess-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    title: title || `Session #${Date.now().toString().slice(-4)}`,
    category: category || 'General',
    totalTimeMs,
    formattedTotal: formattedTotal || '00:00:00.000',
    laps,
    fastestLapMs,
    slowestLapMs,
    avgLapMs,
    notes: notes || '',
    createdAt: new Date().toISOString()
  };

  const sessions = readSessions();
  sessions.unshift(newSession);
  writeSessions(sessions);

  res.status(201).json({
    success: true,
    message: 'Session recorded successfully',
    session: newSession
  });
});

// GET /api/sessions/:id - Get specific session
app.get('/api/sessions/:id', (req, res) => {
  const sessions = readSessions();
  const session = sessions.find(s => s.id === req.params.id);
  if (!session) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }
  res.json({ success: true, session });
});

// DELETE /api/sessions/:id - Delete a session
app.delete('/api/sessions/:id', (req, res) => {
  let sessions = readSessions();
  const initialCount = sessions.length;
  sessions = sessions.filter(s => s.id !== req.params.id);

  if (sessions.length === initialCount) {
    return res.status(404).json({ success: false, error: 'Session not found for deletion' });
  }

  writeSessions(sessions);
  res.json({ success: true, message: 'Session deleted successfully' });
});

// GET /api/stats - Global telemetry & telemetry metrics
app.get('/api/stats', (req, res) => {
  const sessions = readSessions();
  const totalSessions = sessions.length;
  let aggregateTimeMs = 0;
  let totalLaps = 0;
  let globalFastestLapMs = Infinity;

  sessions.forEach(s => {
    aggregateTimeMs += s.totalTimeMs || 0;
    if (s.laps && Array.isArray(s.laps)) {
      totalLaps += s.laps.length;
      s.laps.forEach(l => {
        if (l.lapTimeMs && l.lapTimeMs < globalFastestLapMs) {
          globalFastestLapMs = l.lapTimeMs;
        }
      });
    }
  });

  if (globalFastestLapMs === Infinity) globalFastestLapMs = 0;

  res.json({
    success: true,
    stats: {
      totalSessions,
      aggregateTimeMs,
      formattedAggregateTime: formatMs(aggregateTimeMs),
      totalLaps,
      globalFastestLapMs,
      formattedGlobalFastestLap: formatMs(globalFastestLapMs)
    }
  });
});

// POST /api/export - Export sessions as CSV or JSON payload
app.post('/api/export', (req, res) => {
  const { format, sessionId } = req.body;
  let sessions = readSessions();

  if (sessionId) {
    sessions = sessions.filter(s => s.id === sessionId);
  }

  if (format === 'csv') {
    let csv = 'Session ID,Title,Category,Date,Total Time,Total Laps,Fastest Lap,Avg Lap,Notes\n';
    sessions.forEach(s => {
      csv += `"${s.id}","${s.title}","${s.category}","${s.createdAt}","${s.formattedTotal}",${s.laps.length},"${formatMs(s.fastestLapMs)}","${formatMs(s.avgLapMs)}","${s.notes}"\n`;
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="aethel_chrono_sessions.csv"');
    return res.send(csv);
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="aethel_chrono_sessions.json"');
  res.send(JSON.stringify(sessions, null, 2));
});

// Catch-all route to serve public/index.html on Vercel / Root route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

function formatMs(ms) {
  if (!ms || ms <= 0) return '00:00:00.000';
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = Math.floor(ms % 1000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(` AETHEL CHRONO-MASTER SERVER ONLINE`);
    console.log(` Horology Stopwatch API: http://localhost:${PORT}`);
    console.log(`===================================================`);
  });
}

module.exports = app;
