// index.js – Bleach Edition (The Final Incantation)
const { startBot } = require('./pair');

// ─── TEMPORARY LOG CAPTURE ──────────────────────────────────────
global.recentLogs = global.recentLogs || [];
const MAX_LOGS = 100;

const origLog = console.log;
const origWarn = console.warn;
const origError = console.error;

function pushLog(level, args) {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    global.recentLogs.push({ time: new Date().toISOString(), level, message: msg });
    if (global.recentLogs.length > MAX_LOGS) global.recentLogs.shift();
}

console.log = (...a) => { pushLog('INFO', a); origLog(...a); };
console.warn = (...a) => { pushLog('WARN', a); origWarn(...a); };
console.error = (...a) => { pushLog('ERROR', a); origError(...a); };

// ─── IGNITION ──────────────────────────────────────────────────
console.clear();

console.log(`
\x1b[35m⚔️  ════════════════════════════════════════  ⚔️\x1b[0m
\x1b[36m   "The sword that shatters reality itself."\x1b[0m
\x1b[35m          K Y Ō K A   S U I G E T S U\x1b[0m
\x1b[36m            — Aizen Sosuke —\x1b[0m
\x1b[35m⚔️  ════════════════════════════════════════  ⚔️\x1b[0m
`);

console.log(`
\x1b[33m[SYSTEM] Initiating Soul Reaper Protocol...\x1b[0m
\x1b[33m[SYSTEM] Zanpakutō: Kyōka Suigetsu\x1b[0m
\x1b[33m[SYSTEM] Status: \x1b[32mAwaiting Release Command\x1b[0m
\x1b[33m[SYSTEM] Pairs:    \x1b[36mPaired Number Receives Welcome DM\x1b[0m
`);

// ─── START THE BOT ──────────────────────────────────────────────
startBot().catch((error) => {
    console.error("\x1b[31m[FATAL ERROR] The hypnosis shattered:", error, "\x1b[0m");
    process.exit(1);
});

// ─── GLOBAL ERROR CATCHERS ────────────────────────────────────
process.on('unhandledRejection', (reason, promise) => {
    console.error("\x1b[31m[SYSTEM WARNING] Unhandled Rejection at:", promise, "reason:", reason, "\x1b[0m");
});

process.on('uncaughtException', (err) => {
    console.error("\x1b[31m[SYSTEM CRITICAL] Uncaught Exception thrown:", err, "\x1b[0m");
});