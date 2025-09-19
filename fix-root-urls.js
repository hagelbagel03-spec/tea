#!/usr/bin/env node

// Root-System URL Fix Script
// Führen Sie diesen aus: node fix-root-urls.js

const fs = require('fs');
const path = require('path');

const indexPath = './frontend/app/index.tsx';

// Lese die Datei
let content = fs.readFileSync(indexPath, 'utf8');

// ERSETZE die Environment Variable zurück zu hart-codierter URL für Root
content = content.replace(
  /const API_URL = process\.env\.EXPO_PUBLIC_BACKEND_URL \|\| "http:\/\/localhost:8001";/,
  'const API_URL = "http://localhost:8001";'
);

// ODER wenn Sie eine externe IP haben, ersetzen Sie localhost mit Ihrer IP:
// content = content.replace(
//   /const API_URL = process\.env\.EXPO_PUBLIC_BACKEND_URL \|\| "http:\/\/localhost:8001";/,
//   'const API_URL = "http://YOUR_SERVER_IP:8001";'
// );

// Schreibe zurück
fs.writeFileSync(indexPath, content);

console.log('✅ URL auf localhost:8001 gesetzt für Root-System');
console.log('📝 Falls Sie externe IP brauchen, editieren Sie die Zeile manuell in index.tsx');