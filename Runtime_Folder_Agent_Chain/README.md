# Runtime Folder Agent Chain

## Project overview

A dependency-free Node.js web application that creates a nested folder structure from two inputs:

- **N**: number of nested folders
- **M**: number of text files inside every folder

It uses a runtime agent chain: each agent owns one folder level, creates that folder and its files, dynamically creates and starts the next agent when required, then terminates.

## Technologies used

- Node.js built-in HTTP server for the application and API
- Node.js `worker_threads` for isolated runtime agents
- Node.js `fs/promises` for file-system operations
- Node.js built-in test runner for automated verification

## Run

```powershell
node server.js
```

Open `http://localhost:3000`, provide N and M, and submit the form. Each run is written below `generated/run-<unique-id>/` so prior runs are preserved.

To verify the implementation:

```powershell
node --test
```

## Agent lifecycle

`server.js` creates only the root agent at runtime. `folder-agent.js` is the runtime-agent program.

1. The level-1 agent creates `Folder1` and its `M` files.
2. If another level is required, that agent dynamically creates and starts exactly one level-2 agent.
3. The child repeats the process in its parent folder.
4. After its child reports completion, each agent reports to its parent and terminates.

No child agent is created ahead of time, and an agent creates no folder level except the one matching its own `level` value. The user interface also shows the final tree and an execution log that demonstrates the runtime agent lifecycle.

Input validation limits N and M to 1–100 and 0–100 respectively, preventing unexpectedly large local writes.

## Sample output

For N = 3 and M = 2, the page displays:

```text
Successfully created a runtime agent chain with 3 nested folders and 2 files per folder.

Generated Structure

Folder1
├── File1.txt
├── File2.txt
└── Folder2
    ├── File1.txt
    ├── File2.txt
    └── Folder3
        ├── File1.txt
        └── File2.txt

Agent Execution Log

Agent 1 created Folder1
Agent 1 created File1.txt
Agent 1 created File2.txt
Agent 1 created and started Agent 2
...
Agent 3 terminated
Agent 2 terminated
Agent 1 terminated
```
