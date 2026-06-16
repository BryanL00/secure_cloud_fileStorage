const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');
const fileRoutes = require('./routes/file.routes');
const userRoutes = require('./routes/user.routes');
const folderRoutes = require('./routes/folder.routes');
const auditRoutes = require('./routes/audit.routes');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/users', userRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/audit', auditRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Secure Cloud Storage API is running' });
});

const PORT = process.env.PORT || 3001;

// Serve over HTTPS (TLS) when a key/cert pair is available, satisfying the
// "secure communication between client and server" requirement. Falls back to
// plain HTTP only if certs are missing (e.g. behind a TLS-terminating proxy).
const KEY_PATH = process.env.SSL_KEY_PATH || path.join(__dirname, '../certs/server.key');
const CERT_PATH = process.env.SSL_CERT_PATH || path.join(__dirname, '../certs/server.cert');

if (fs.existsSync(KEY_PATH) && fs.existsSync(CERT_PATH)) {
  const credentials = {
    key: fs.readFileSync(KEY_PATH, 'utf8'),
    cert: fs.readFileSync(CERT_PATH, 'utf8'),
  };
  https.createServer(credentials, app).listen(PORT, () => {
    console.log(`Server running on https://localhost:${PORT} (TLS enabled)`);
  });
} else {
  console.warn(
    'TLS certificates not found — starting in plain HTTP.\n' +
    `Expected key at ${KEY_PATH} and cert at ${CERT_PATH}.\n` +
    'Generate them with the openssl command in the README, or terminate TLS at a reverse proxy.'
  );
  http.createServer(app).listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT} (no TLS)`);
  });
}