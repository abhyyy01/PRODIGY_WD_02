const http = require('http');

const data = JSON.stringify({
  title: "Verification Sprint Run",
  category: "Athletics",
  totalTimeMs: 35000,
  formattedTotal: "00:00:35.000",
  laps: [
    { lapNumber: 1, lapTimeMs: 17000, formattedLapTime: "00:00:17.000", splitTimeMs: 17000, formattedSplitTime: "00:00:17.000" },
    { lapNumber: 2, lapTimeMs: 18000, formattedLapTime: "00:00:18.000", splitTimeMs: 35000, formattedSplitTime: "00:00:35.000" }
  ],
  notes: "Automated verification test"
});

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/sessions',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    console.log('RESPONSE:', body);
  });
});

req.on('error', err => console.error('ERROR:', err));
req.write(data);
req.end();
