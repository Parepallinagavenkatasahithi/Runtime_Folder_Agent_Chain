const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createWithAgentChain, validateRequest, formatStructure } = require('../server');

test('rejects invalid agent-chain input', () => {
  assert.throws(() => validateRequest({ n: 0, m: 2 }));
  assert.throws(() => validateRequest({ n: 2, m: 101 }));
});

test('creates nested folders through runtime worker agents', async () => {
  const result = await createWithAgentChain({ n: 3, m: 2 });
  assert.equal(result.createdFolders, 3);
  assert.deepEqual(result.logs, [
    'Agent 1 created Folder1', 'Agent 1 created File1.txt', 'Agent 1 created File2.txt',
    'Agent 1 created and started Agent 2', 'Agent 2 created Folder2', 'Agent 2 created File1.txt',
    'Agent 2 created File2.txt', 'Agent 2 created and started Agent 3', 'Agent 3 created Folder3',
    'Agent 3 created File1.txt', 'Agent 3 created File2.txt', 'Agent 3 terminated',
    'Agent 2 terminated', 'Agent 1 terminated'
  ]);
  await assert.doesNotReject(fs.access(path.join(result.runDirectory, 'Folder1', 'File1.txt')));
  await assert.doesNotReject(fs.access(path.join(result.runDirectory, 'Folder1', 'Folder2', 'File2.txt')));
  await assert.doesNotReject(fs.access(path.join(result.runDirectory, 'Folder1', 'Folder2', 'Folder3', 'File1.txt')));
  await fs.rm(result.runDirectory, { recursive: true, force: true });
});

test('formats the expected folder tree', () => {
  assert.deepEqual(formatStructure(2, 1), [
    'Folder1', '├── File1.txt', '└── Folder2', '    └── File1.txt'
  ]);
});
