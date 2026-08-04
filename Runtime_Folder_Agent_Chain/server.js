const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { Worker } = require('node:worker_threads');

const PORT = Number(process.env.PORT || 3000);
const OUTPUT_ROOT = path.resolve(process.cwd(), 'generated');
const MAX_LEVELS = 100;
const MAX_FILES_PER_FOLDER = 100;

function validateRequest(value) {
  const n = Number(value?.n);
  const m = Number(value?.m);
  if (!Number.isSafeInteger(n) || n < 1 || n > MAX_LEVELS) {
    throw new Error(`N must be a whole number between 1 and ${MAX_LEVELS}.`);
  }
  if (!Number.isSafeInteger(m) || m < 0 || m > MAX_FILES_PER_FOLDER) {
    throw new Error(`M must be a whole number between 0 and ${MAX_FILES_PER_FOLDER}.`);
  }
  return { n, m };
}

async function createWithAgentChain({ n, m }) {
  await fs.mkdir(OUTPUT_ROOT, { recursive: true });
  const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const runDirectory = path.join(OUTPUT_ROOT, runId);
  await fs.mkdir(runDirectory);

  return new Promise((resolve, reject) => {
    const logs = [];
    const rootAgent = new Worker(path.join(__dirname, 'folder-agent.js'), {
      workerData: { level: 1, totalLevels: n, filesPerFolder: m, parentPath: runDirectory }
    });
    let settled = false;
    rootAgent.on('message', (message) => {
      if (message.type === 'log') {
        logs.push(message.message);
        return;
      }
      if (message.type !== 'complete') return;
      settled = true;
      if (message.ok) resolve({ runId, runDirectory, createdFolders: message.createdFolders, logs });
      else reject(new Error(message.error));
    });
    rootAgent.once('error', (error) => {
      if (!settled) reject(error);
    });
    rootAgent.once('exit', (code) => {
      if (!settled && code !== 0) reject(new Error(`Root agent stopped with code ${code}.`));
    });
  });
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 10_000) request.destroy();
    });
    request.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Request body must be valid JSON.')); }
    });
    request.on('error', reject);
  });
}

function sendJson(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/') {
    const page = await fs.readFile(path.join(__dirname, 'public', 'index.html'));
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(page);
    return;
  }
  if (request.method === 'POST' && request.url === '/api/create') {
    try {
      const input = validateRequest(await readBody(request));
      const result = await createWithAgentChain(input);
      sendJson(response, 201, {
        ...result,
        relativePath: path.relative(process.cwd(), result.runDirectory),
        filesPerFolder: input.m,
        structure: formatStructure(input.n, input.m)
      });
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return;
  }
  sendJson(response, 404, { error: 'Not found.' });
});

function formatStructure(n, m, level = 1, indent = '') {
  const lines = [`${indent}Folder${level}`];
  const entries = [
    ...Array.from({ length: m }, (_, index) => `File${index + 1}.txt`),
    ...(level < n ? [`Folder${level + 1}`] : [])
  ];
  entries.forEach((entry, index) => {
    const last = index === entries.length - 1;
    lines.push(`${indent}${last ? '└── ' : '├── '}${entry}`);
    if (entry.startsWith('Folder')) {
      const childIndent = `${indent}${last ? '    ' : '│   '}`;
      lines.push(...formatStructure(n, m, level + 1, childIndent).slice(1));
    }
  });
  return lines;
}

if (require.main === module) {
  server.listen(PORT, () => console.log(`Open http://localhost:${PORT}`));
}

module.exports = { createWithAgentChain, validateRequest, formatStructure, OUTPUT_ROOT, server };
