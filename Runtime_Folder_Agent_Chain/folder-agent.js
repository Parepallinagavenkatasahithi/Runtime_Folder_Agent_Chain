const fs = require('node:fs/promises');
const path = require('node:path');
const { Worker, parentPort, workerData } = require('node:worker_threads');

async function runAgent({ level, totalLevels, filesPerFolder, parentPath }) {
  // This runtime agent owns exactly one folder level.
  const folderPath = path.join(parentPath, `Folder${level}`);
  await fs.mkdir(folderPath, { recursive: false });
  parentPort.postMessage({ type: 'log', message: `Agent ${level} created Folder${level}` });
  for (let index = 1; index <= filesPerFolder; index += 1) {
    await fs.writeFile(path.join(folderPath, `File${index}.txt`), `Created by Agent ${level}.\n`, 'utf8');
    parentPort.postMessage({ type: 'log', message: `Agent ${level} created File${index}.txt` });
  }

  if (level === totalLevels) {
    parentPort.postMessage({ type: 'log', message: `Agent ${level} terminated` });
    return 1;
  }

  // The child is created now, by its parent agent; no agents are pre-created.
  return new Promise((resolve, reject) => {
    parentPort.postMessage({ type: 'log', message: `Agent ${level} created and started Agent ${level + 1}` });
    const childAgent = new Worker(__filename, {
      workerData: { level: level + 1, totalLevels, filesPerFolder, parentPath: folderPath }
    });
    let settled = false;
    childAgent.on('message', (message) => {
      if (message.type === 'log') {
        parentPort.postMessage(message);
        return;
      }
      if (message.type !== 'complete') return;
      settled = true;
      if (message.ok) resolve(message.createdFolders + 1);
      else reject(new Error(message.error));
    });
    childAgent.once('error', (error) => { if (!settled) reject(error); });
    childAgent.once('exit', (code) => {
      if (!settled && code !== 0) reject(new Error(`Agent ${level + 1} stopped with code ${code}.`));
    });
  });
}

runAgent(workerData)
  .then((createdFolders) => {
    if (workerData.level < workerData.totalLevels) {
      parentPort.postMessage({ type: 'log', message: `Agent ${workerData.level} terminated` });
    }
    parentPort.postMessage({ type: 'complete', ok: true, createdFolders });
  })
  .catch((error) => parentPort.postMessage({ type: 'complete', ok: false, error: error.message }));
