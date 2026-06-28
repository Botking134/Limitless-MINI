// plugins/owner.js – Bleach: The Blade of the Soul Reaper
const config = require('../config');
const core = require('../core'); // Single source of truth
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// ─── STATE FILE ──────────────────────────────────────────────────
const STATE_PATH = path.join(__dirname, '..', 'storage', 'state.json');

function readState() {
    try {
        if (fs.existsSync(STATE_PATH)) {
            return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
        }
    } catch (e) {}
    return {};
}

function writeState(state) {
    const dir = path.dirname(STATE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
}

// ─── HELPERS ──────────────────────────────────────────────────────

function normalizeJid(input) {
    if (!input) return '';
    const clean = input.replace(/:[\d]+@/, '@');
    if (clean.endsWith('@s.whatsapp.net') || clean.endsWith('@lid')) return clean;
    const raw = clean.split('@')[0].replace(/[^0-9]/g, '');
    return raw ? `${raw}@s.whatsapp.net` : '';
}

function getRawMessage(message) {
    if (!message) return null;
    if (message.ephemeralMessage?.message) return getRawMessage(message.ephemeralMessage.message);
    if (message.viewOnceMessage?.message) return getRawMessage(message.viewOnceMessage.message);
    if (message.viewOnceMessageV2?.message) return getRawMessage(message.viewOnceMessageV2.message);
    if (message.viewOnceMessageV2Extension?.message) return getRawMessage(message.viewOnceMessageV2Extension.message);
    if (message.documentWithCaptionMessage?.message) return getRawMessage(message.documentWithCaptionMessage.message);
    return message;
}

function parseTarget(msg, args) {
    const rawMsg = getRawMessage(msg.message);
    const ctx = rawMsg?.contextInfo || rawMsg?.extendedTextMessage?.contextInfo;
    if (ctx?.participant) return normalizeJid(ctx.participant);
    if (ctx?.mentionedJid && ctx.mentionedJid.length > 0) return normalizeJid(ctx.mentionedJid[0]);
    if (args) {
        const clean = Array.isArray(args) ? (args.join('').replace(/[^0-9]/g, '')) : args.replace(/[^0-9]/g, '');
        if (clean.length >= 7) return `${clean}@s.whatsapp.net`;
    }
    return '';
}

function parseDuration(str) {
    const match = str.match(/^(\d+)([smh])$/i);
    if (!match) return null;
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    if (unit === 's') return value * 1000;
    if (unit === 'm') return value * 60 * 1000;
    if (unit === 'h') return value * 60 * 60 * 1000;
    return null;
}

function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    let str = '';
    if (d) str += `${d}d `;
    if (h) str += `${h}h `;
    if (m) str += `${m}m `;
    if (s || !str) str += `${s}s`;
    return str.trim();
}

// ─── TOGGLE HELPERS ─────────────────────────────────────────────

function toggleState(key, subKey, jid, args) {
    const state = readState();
    if (!state.presence) state.presence = {};
    const chatKey = subKey || 'chats';

    // Safely read args array
    const target = (Array.isArray(args) && args[0]) ? args[0].toLowerCase().trim() : (typeof args === 'string' ? args.toLowerCase().trim() : '');

    if (target === 'on') {
        if (!state.presence[chatKey]) state.presence[chatKey] = [];
        if (!state.presence[chatKey].includes(jid)) state.presence[chatKey].push(jid);
        writeState(state);
        return `🟢 *${key} activated for this chat.*`;
    } else if (target === 'off') {
        if (state.presence[chatKey]) {
            state.presence[chatKey] = state.presence[chatKey].filter(id => id !== jid);
        }
        writeState(state);
        return `💤 *${key} deactivated for this chat.*`;
    } else if (target === 'all') {
        state.presence[chatKey + '_all'] = true;
        writeState(state);
        return `🟢 *${key} activated globally!*`;
    } else if (target === 'off all' || target === 'offall') {
        state.presence[chatKey + '_all'] = false;
        if (state.presence[chatKey]) state.presence[chatKey] = [];
        writeState(state);
        return `💤 *${key} deactivated globally.*`;
    }
    return `❌ Usage: \`${config.prefix}${key} on/off/all/offall\``;
}

// ─── NOTES ──────────────────────────────────────────────────────

const NOTES_PATH = path.join(__dirname, '..', 'storage', 'notes.json');

function readNotes() {
    try {
        if (fs.existsSync(NOTES_PATH)) return JSON.parse(fs.readFileSync(NOTES_PATH, 'utf-8'));
    } catch (e) {}
    return {};
}

function writeNotes(notes) {
    const dir = path.dirname(NOTES_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(NOTES_PATH, JSON.stringify(notes, null, 2), 'utf-8');
}

// ─── REMINDERS ──────────────────────────────────────────────────

const REMINDERS_PATH = path.join(__dirname, '..', 'storage', 'reminders.json');

function readReminders() {
    try {
        if (fs.existsSync(REMINDERS_PATH)) return JSON.parse(fs.readFileSync(REMINDERS_PATH, 'utf-8'));
    } catch (e) {}
    return [];
}

function writeReminders(reminders) {
    const dir = path.dirname(NOTES_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(REMINDERS_PATH, JSON.stringify(reminders, null, 2), 'utf-8');
}

// ─── REMINDER INTERVAL ──────────────────────────────────────────
if (!global.reminderInterval) {
    global.reminderInterval = setInterval(async () => {
        if (!global.activeSock) return;
        const reminders = readReminders();
        const now = Date.now();
        const due = reminders.filter(r => r.triggerTime <= now);
        const remaining = reminders.filter(r => r.triggerTime > now);
        for (const r of due) {
            try {
                const text = `🔔 *Reminder:* ${r.title}\n📝 ${r.text}`;
                await global.activeSock.sendMessage(r.jid, { text });
            } catch (e) {}
        }
        if (due.length) writeReminders(remaining);
    }, 10000);
}

// ─── DIAGNOSE ────────────────────────────────────────────────────
function diagnosePlugins() {
    const pluginsDir = path.join(__dirname);
    const results = [];
    if (!fs.existsSync(pluginsDir)) return [{ file: 'plugins dir not found', status: 'error' }];

    const files = fs.readdirSync(pluginsDir).filter(f => f.endsWith('.js'));
    for (const file of files) {
        const filePath = path.join(pluginsDir, file);
        try {
            delete require.cache[require.resolve(filePath)];
            require(filePath);
            results.push({ file, status: '✅ Loaded' });
        } catch (err) {
            results.push({ file, status: '❌ Failed', error: err.message });
        }
    }
    return results;
}

// ─── EXPORT ──────────────────────────────────────────────────────

module.exports = [
    // 1. setprefix
    {
        name: 'setprefix',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner) return;
            const newPrefix = (args && args[0]) ? args[0].trim() : '';
            if (!newPrefix) return await sock.sendMessage(jid, { text: '❌ Provide a new prefix.' });
            config.prefix = newPrefix;
            const state = readState();
            state.prefix = newPrefix;
            writeState(state);
            await sock.sendMessage(jid, { text: `✅ Prefix set to: \`${newPrefix}\`` });
            try { require('../commands').reload(); } catch (e) {}
        }
    },

    // 2. autoreact
    {
        name: 'autoreact',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner) return;
            const mode = (args && args[0]) ? args[0].toLowerCase().trim() : '';
            if (!['cmd', 'all', 'off'].includes(mode)) {
                return await sock.sendMessage(jid, { text: '❌ Usage: `autoreact cmd|all|off`' });
            }
            const state = readState();
            state.autoReact = mode;
            writeState(state);
            await sock.sendMessage(jid, { text: `✅ AutoReact set to: \`${mode}\`` });
        }
    },

    // 3. speed (prefixless)
    {
        name: 'speed',
        isPrefixless: true,
        execute: async (sock, msg, args) => {
            const jid = msg.key.remoteJid;
            const start = Date.now();
            const sent = await sock.sendMessage(jid, { text: '⚡' });
            const latency = Date.now() - start;
            await sock.sendMessage(jid, { text: `⏱️ Speed: ${latency}ms`, edit: sent.key });
        }
    },

    // 4. gitclone
    {
        name: 'gitclone',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner) return;
            const input = (args && args[0]) ? args[0].trim() : '';
            if (!input) return await sock.sendMessage(jid, { text: '❌ Usage: `gitclone username/repo`' });
            const [owner, repo] = input.split('/');
            if (!owner || !repo) return await sock.sendMessage(jid, { text: '❌ Invalid format. Use `username/repo`' });
            const statusMsg = await sock.sendMessage(jid, { text: `📥 Fetching ${owner}/${repo}...` });
            try {
                const url = `https://api.github.com/repos/${owner}/${repo}/zipball`;
                const res = await fetch(url);
                if (!res.ok) throw new Error(`GitHub error ${res.status}`);
                const buffer = Buffer.from(await res.arrayBuffer());
                await sock.sendMessage(jid, {
                    document: buffer,
                    mimetype: 'application/zip',
                    fileName: `${repo}-source.zip`,
                    caption: `📦 ${owner}/${repo} archive.`
                });
                try { await sock.sendMessage(jid, { delete: statusMsg.key }); } catch (e) {}
            } catch (err) {
                await sock.sendMessage(jid, { text: `❌ Failed: ${err.message}`, edit: statusMsg.key });
            }
        }
    },

    // 5. notes
    {
        name: 'notes',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner) return;
            const notes = readNotes();
            const chatNotes = notes[jid] || {};
            const total = Object.keys(chatNotes).length;
            const list = Object.keys(chatNotes).map(k => `• ${k}`).join('\n');
            const text = `📝 *Notes in this chat:* ${total}\n${list || '_None_'}`;
            await sock.sendMessage(jid, { text });
        }
    },

    // 6. addnote
    {
        name: 'addnote',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner) return;
            const content = args ? args.join(' ').trim() : '';
            if (!content) return await sock.sendMessage(jid, { text: '❌ Usage: `addnote <content>`' });
            const notes = readNotes();
            if (!notes[jid]) notes[jid] = {};
            const key = `note_${Date.now()}`;
            notes[jid][key] = { content, author: msg.pushName || 'User', time: Date.now() };
            writeNotes(notes);
            await sock.sendMessage(jid, { text: `✅ Note saved as: \`${key}\`` });
        }
    },

    // 7. delnote
    {
        name: 'delnote',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner) return;
            const key = (args && args[0]) ? args[0].trim() : '';
            if (!key) return await sock.sendMessage(jid, { text: '❌ Usage: `delnote <key>`' });
            const notes = readNotes();
            if (!notes[jid] || !notes[jid][key]) return await sock.sendMessage(jid, { text: '❌ Note not found.' });
            delete notes[jid][key];
            writeNotes(notes);
            await sock.sendMessage(jid, { text: `✅ Note \`${key}\` deleted.` });
        }
    },

    // 8. getnote
    {
        name: 'getnote',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner) return;
            const key = (args && args[0]) ? args[0].trim() : '';
            if (!key) return await sock.sendMessage(jid, { text: '❌ Usage: `getnote <key>`' });
            const notes = readNotes();
            if (!notes[jid] || !notes[jid][key]) return await sock.sendMessage(jid, { text: '❌ Note not found.' });
            const note = notes[jid][key];
            const text = `📝 *${key}*\n${note.content}\n— ${note.author} @ ${new Date(note.time).toLocaleString()}`;
            await sock.sendMessage(jid, { text });
        }
    },

    // 9. getnotes
    {
        name: 'getnotes',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner) return;
            const notes = readNotes();
            const chatNotes = notes[jid] || {};
            const list = Object.keys(chatNotes).map(k => `• ${k}`).join('\n');
            await sock.sendMessage(jid, { text: `📋 *All note keys:*\n${list || '_None_'}` });
        }
    },

    // 10. reminder
    {
        name: 'reminder',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner) return;
            const duration = (args && args[0]) ? args[0].trim() : '';
            const text = (args && args.length > 1) ? args.slice(1).join(' ') : '';
            if (!duration || !text) return await sock.sendMessage(jid, { text: '❌ Usage: `reminder 10m text`' });
            const ms = parseDuration(duration);
            if (!ms) return await sock.sendMessage(jid, { text: '❌ Invalid duration. Use e.g., 10s, 5m, 2h' });
            const reminders = readReminders();
            reminders.push({
                jid,
                title: 'Reminder',
                text,
                triggerTime: Date.now() + ms,
                durationStr: duration,
                timeSet: Date.now()
            });
            writeReminders(reminders);
            await sock.sendMessage(jid, { text: `⏳ Reminder set for \`${duration}\`.` });
        }
    },

    // 11. remind
    {
        name: 'remind',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner) return;
            const reminders = readReminders();
            const subCmd = (args && args[0]) ? args[0].toLowerCase().trim() : '';
            if (subCmd === 'cancel') {
                if (reminders.length === 0) return await sock.sendMessage(jid, { text: '❌ No active reminders.' });
                let list = '';
                reminders.forEach((r, i) => {
                    const remaining = Math.max(0, r.triggerTime - Date.now());
                    list += `${i+1}. ${r.title} (${formatUptime(Math.floor(remaining/1000))} left)\n`;
                });
                await sock.sendMessage(jid, { text: `📋 *Active reminders:*\n${list}\nReply with \`remind abort <index>\`` });
                return;
            }
            if (subCmd === 'abort') {
                const idx = (args && args[1]) ? parseInt(args[1]) : NaN;
                if (isNaN(idx) || idx < 1 || idx > reminders.length) return await sock.sendMessage(jid, { text: '❌ Invalid index.' });
                const removed = reminders.splice(idx-1, 1);
                writeReminders(reminders);
                await sock.sendMessage(jid, { text: `✅ Reminder "${removed[0].title}" cancelled.` });
                return;
            }
            if (reminders.length === 0) return await sock.sendMessage(jid, { text: '📋 No active reminders.' });
            let list = '';
            reminders.forEach((r, i) => {
                const remaining = Math.max(0, r.triggerTime - Date.now());
                list += `${i+1}. ${r.title} (${formatUptime(Math.floor(remaining/1000))} left)\n`;
            });
            await sock.sendMessage(jid, { text: `📋 *Active reminders:*\n${list}` });
        }
    },

    // 12. presence commands: autotyping, autorecording, alwaysonline, autoread
    {
        name: 'autotyping',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner) return;
            const result = toggleState('AutoTyping', 'autotyping', jid, args);
            await sock.sendMessage(jid, { text: result });
        }
    },
    {
        name: 'autorecording',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner) return;
            const result = toggleState('AutoRecording', 'autorecording', jid, args);
            await sock.sendMessage(jid, { text: result });
        }
    },
    {
        name: 'alwaysonline',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner) return;
            const target = (args && args[0]) ? args[0].toLowerCase().trim() : '';
            const state = readState();
            if (!state.presence) state.presence = {};
            if (target === 'on' || target === 'all') {
                state.presence.alwaysonline_all = true;
                writeState(state);
                await sock.sendMessage(jid, { text: '🟢 AlwaysOnline activated globally.' });
            } else if (target === 'off' || target === 'offall') {
                state.presence.alwaysonline_all = false;
                writeState(state);
                await sock.sendMessage(jid, { text: '💤 AlwaysOnline deactivated.' });
            } else {
                await sock.sendMessage(jid, { text: '❌ Usage: `alwaysonline on/off`' });
            }
        }
    },
    {
        name: 'autoread',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner) return;
            const target = (args && args[0]) ? args[0].toLowerCase().trim() : '';
            const state = readState();
            if (!state.presence) state.presence = {};
            if (target === 'on' || target === 'all') {
                state.presence.autoread_all = true;
                writeState(state);
                await sock.sendMessage(jid, { text: '🟢 AutoRead activated globally.' });
            } else if (target === 'off' || target === 'offall') {
                state.presence.autoread_all = false;
                writeState(state);
                await sock.sendMessage(jid, { text: '💤 AutoRead deactivated.' });
            } else {
                await sock.sendMessage(jid, { text: '❌ Usage: `autoread on/off`' });
            }
        }
    },
    {
        name: 'presence',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner) return;
            const state = readState();
            const p = state.presence || {};
            const typing = p.autotyping_all ? 'All' : (p.autotyping || []).includes(jid) ? 'Here' : 'Off';
            const recording = p.autorecording_all ? 'All' : (p.autorecording || []).includes(jid) ? 'Here' : 'Off';
            const online = p.alwaysonline_all ? 'On' : 'Off';
            const read = p.autoread_all ? 'On' : 'Off';
            const text = `🕴️ *Presence Settings*\nTyping: ${typing}\nRecording: ${recording}\nAlwaysOnline: ${online}\nAutoRead: ${read}`;
            await sock.sendMessage(jid, { text });
        }
    },

    // 13. antidelete
    {
        name: 'antidelete',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner) return;
            const mode = (args && args[0]) ? args[0].toLowerCase().trim() : '';
            if (!['-g', '-pm', '-all', '-off'].includes(mode)) {
                return await sock.sendMessage(jid, { text: '❌ Usage: `antidelete -g|-pm|-all|-off`' });
            }
            const state = readState();
            state.antidelete = mode.replace('-', '');
            writeState(state);
            await sock.sendMessage(jid, { text: `✅ AntiDelete set to: \`${mode}\`` });
        }
    },

    // 14. antiviewonce
    {
        name: 'antiviewonce',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner) return;
            const mode = (args && args[0]) ? args[0].toLowerCase().trim() : '';
            if (!['-g', '-pm', '-all', '-off'].includes(mode)) {
                return await sock.sendMessage(jid, { text: '❌ Usage: `antiviewonce -g|-pm|-all|-off`' });
            }
            const state = readState();
            state.antiviewonce = mode.replace('-', '');
            writeState(state);
            await sock.sendMessage(jid, { text: `✅ AntiViewOnce set to: \`${mode}\`` });
        }
    },

    // 15. antibug
    {
        name: 'antibug',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner) return;
            const mode = (args && args[0]) ? args[0].toLowerCase().trim() : '';
            if (!['on', 'off'].includes(mode)) return await sock.sendMessage(jid, { text: '❌ Usage: `antibug on/off`' });
            const state = readState();
            state.antibug = mode;
            writeState(state);
            await sock.sendMessage(jid, { text: `✅ Antibug ${mode === 'on' ? 'enabled' : 'disabled'}.` });
        }
    },

    // 16. block
    {
        name: 'block',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner) return;
            const target = parseTarget(msg, args);
            if (!target) return await sock.sendMessage(jid, { text: '❌ Mention or reply to a user.' });
            await sock.updateBlockStatus(target, 'block');
            await sock.sendMessage(jid, { text: `🚫 Blocked @${target.split('@')[0]}` });
        }
    },

    // 17. unblock
    {
        name: 'unblock',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner) return;
            const target = parseTarget(msg, args);
            if (!target) return await sock.sendMessage(jid, { text: '❌ Mention or reply to a user.' });
            await sock.updateBlockStatus(target, 'unblock');
            await sock.sendMessage(jid, { text: `✅ Unblocked @${target.split('@')[0]}` });
        }
    },

    // 18. archive
    {
        name: 'archive',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner) return;
            await sock.chatModify({ archive: true, lastMessages: [msg] }, jid);
            await sock.sendMessage(jid, { text: '📂 Chat archived.' });
        }
    },

    // 19. unarchive
    {
        name: 'unarchive',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner) return;
            await sock.chatModify({ archive: false, lastMessages: [msg] }, jid);
            await sock.sendMessage(jid, { text: '📂 Chat unarchived.' });
        }
    },

    // 20. clear
    {
        name: 'clear',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner) return;
            await sock.chatModify({ delete: true, lastMessages: [msg] }, jid);
        }
    },

    // 21. antipm
    {
        name: 'antipm',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner) return;
            const mode = (args && args[0]) ? args[0].toLowerCase().trim() : '';
            if (!['on', 'off'].includes(mode)) return await sock.sendMessage(jid, { text: '❌ Usage: `antipm on/off`' });
            const state = readState();
            state.antipm = mode;
            writeState(state);
            await sock.sendMessage(jid, { text: `✅ AntiPM ${mode === 'on' ? 'enabled' : 'disabled'}.` });
        }
    },

    // 22. update
    {
        name: 'update',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner) return;
            await sock.sendMessage(jid, { text: '🔄 Pulling updates from GitHub...' });
            const repo = 'https://github.com/Botking134/Limitless-MINI.git';
            const cmds = [
                `git remote add origin ${repo} 2>/dev/null || git remote set-url origin ${repo}`,
                `git fetch origin`,
                `git reset --hard origin/master || git reset --hard origin/main`,
                `npm install --silent`
            ];
            exec(cmds.join(' && '), async (err) => {
                if (err) {
                    await sock.sendMessage(jid, { text: `❌ Update failed:\n${err.message}` });
                } else {
                    await sock.sendMessage(jid, { text: `✅ Update successful! Restarting...` });
                    setTimeout(() => process.exit(1), 2000);
                }
            });
        }
    },

    // 23. statusemoji
    {
        name: 'statusemoji',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner) return;
            const emoji = (args && args[0]) ? args[0].trim() : '';
            if (!emoji) return await sock.sendMessage(jid, { text: '❌ Provide an emoji.' });
            const state = readState();
            state.statusEmoji = emoji;
            writeState(state);
            await sock.sendMessage(jid, { text: `✅ Status emoji set to: ${emoji}` });
        }
    },

    // 24. autovs (autoviewstatus)
    {
        name: 'autovs',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner) return;
            const mode = (args && args[0]) ? args[0].toLowerCase().trim() : '';
            if (!['on', 'off'].includes(mode)) return await sock.sendMessage(jid, { text: '❌ Usage: `autovs on/off`' });
            const state = readState();
            state.autovs = mode;
            writeState(state);
            await sock.sendMessage(jid, { text: `✅ AutoViewStatus ${mode === 'on' ? 'enabled' : 'disabled'}.` });
        }
    },

    // 25. autors (autoreactstatus)
    {
        name: 'autors',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner) return;
            const mode = (args && args[0]) ? args[0].toLowerCase().trim() : '';
            if (!['on', 'off'].includes(mode)) return await sock.sendMessage(jid, { text: '❌ Usage: `autors on/off`' });
            const state = readState();
            state.autors = mode;
            writeState(state);
            await sock.sendMessage(jid, { text: `✅ AutoReactStatus ${mode === 'on' ? 'enabled' : 'disabled'}.` });
        }
    },

    // 26. ss
    {
        name: 'ss',
        isPrefixless: false,
        execute: async (sock, msg, args) => {
            const jid = msg.key.remoteJid;
            let url = (args && args[0]) ? args[0].trim() : '';
            if (!url) {
                const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                if (quoted) {
                    const raw = getRawMessage(quoted);
                    url = raw?.conversation || raw?.extendedTextMessage?.text || '';
                }
            }
            if (!url) return await sock.sendMessage(jid, { text: '❌ Provide a URL or reply to a message containing a URL.' });
            if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
            try {
                const screenshot = `https://image.thum.io/get/width/1280/crop/800/${url}`;
                await sock.sendMessage(jid, { image: { url: screenshot }, caption: `📸 ${url}` });
            } catch {
                await sock.sendMessage(jid, { text: '❌ Failed to capture screenshot.' });
            }
        }
    },

    // 27. device
    {
        name: 'device',
        isPrefixless: false,
        execute: async (sock, msg, args) => {
            const jid = msg.key.remoteJid;
            let targetId = msg.key.id;
            const quoted = msg.message?.extendedTextMessage?.contextInfo;
            if (quoted && quoted.stanzaId) targetId = quoted.stanzaId;
            const len = targetId.length;
            let device = 'Unknown';
            if (len === 20 && targetId.startsWith('3A')) device = 'iOS';
            else if (len === 12 || targetId.startsWith('3EB0') || targetId.startsWith('BAE5')) device = 'PC';
            else if (len === 32 || (len >= 16 && len <= 22)) device = 'Android';
            await sock.sendMessage(jid, { text: `📱 Device: ${device}` });
        }
    },

    // 28. spam
    {
        name: 'spam',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner) return;
            const count = (args && args[0]) ? parseInt(args[0]) : NaN;
            if (isNaN(count) || count < 1 || count > 30) return await sock.sendMessage(jid, { text: '❌ Count must be 1-30.' });
            const text = (args && args.length > 1) ? args.slice(1).join(' ') : '';
            if (!text) return await sock.sendMessage(jid, { text: '❌ Provide text to spam.' });
            for (let i = 0; i < count; i++) {
                await sock.sendMessage(jid, { text });
                await new Promise(r => setTimeout(r, 500));
            }
        }
    },

    // 29. setcmd
    {
        name: 'setcmd',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner) return;
            const cmdName = (args && args[0]) ? args[0].trim() : '';
            if (!cmdName) return await sock.sendMessage(jid, { text: '❌ Usage: `setcmd <command>` (reply to a sticker)' });
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quoted) return await sock.sendMessage(jid, { text: '❌ Reply to a sticker.' });
            const sticker = quoted.stickerMessage;
            if (!sticker) return await sock.sendMessage(jid, { text: '❌ Not a sticker.' });
            const hash = sticker.fileSha256?.toString('base64');
            if (!hash) return await sock.sendMessage(jid, { text: '❌ Could not read sticker hash.' });
            const state = readState();
            if (!state.stickerCommands) state.stickerCommands = {};
            state.stickerCommands[hash] = cmdName;
            writeState(state);
            await sock.sendMessage(jid, { text: `✅ Sticker mapped to: \`${cmdName}\`` });
        }
    },

    // 30. delcmd
    {
        name: 'delcmd',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner) return;
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quoted) return await sock.sendMessage(jid, { text: '❌ Reply to a sticker.' });
            const sticker = quoted.stickerMessage;
            if (!sticker) return await sock.sendMessage(jid, { text: '❌ Not a sticker.' });
            const hash = sticker.fileSha256?.toString('base64');
            if (!hash) return await sock.sendMessage(jid, { text: '❌ Could not read sticker hash.' });
            const state = readState();
            if (!state.stickerCommands || !state.stickerCommands[hash]) return await sock.sendMessage(jid, { text: '❌ No mapping for this sticker.' });
            delete state.stickerCommands[hash];
            writeState(state);
            await sock.sendMessage(jid, { text: '✅ Mapping removed.' });
        }
    },

    // 31. 🥷🏼 (kamui)
    {
        name: '🥷🏼',
        isPrefixless: true,
        execute: async (sock, msg) => {
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quoted) return;
            const raw = getRawMessage(quoted);
            const media = raw?.imageMessage || raw?.videoMessage || raw?.audioMessage;
            if (!media) return;
            const sender = msg.key.participant || msg.key.remoteJid;
            if (!sender) return;
            try {
                const type = raw.imageMessage ? 'image' : (raw.videoMessage ? 'video' : 'audio');
                
                // Dynamically import Baileys to circumvent synchronous ESM restrictions
                const { downloadContentFromMessage } = await import('@itsliaaa/baileys');
                
                const stream = await downloadContentFromMessage(media, type);
                let buffer = Buffer.from([]);
                for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                if (type === 'image') {
                    await sock.sendMessage(sender, { image: buffer, caption: ' ' });
                } else if (type === 'video') {
                    await sock.sendMessage(sender, { video: buffer, mimetype: media.mimetype || 'video/mp4', caption: ' ' });
                } else {
                    await sock.sendMessage(sender, { audio: buffer, mimetype: media.mimetype || 'audio/ogg; codecs=opus', ptt: media.ptt || false });
                }
            } catch (e) {}
        }
    },

    // 32. fw
    {
        name: 'fw',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner) return;
            const rawNum = (args && args[0]) ? args[0].replace(/[^0-9]/g, '') : '';
            if (!rawNum) return await sock.sendMessage(jid, { text: '❌ Usage: `fw <number>` (reply to a message)' });
            const target = rawNum + '@s.whatsapp.net';
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quoted) return await sock.sendMessage(jid, { text: '❌ Reply to a message to forward.' });
            try {
                await sock.sendMessage(target, { forward: quoted });
                await sock.sendMessage(jid, { text: `✅ Forwarded to ${target}` });
            } catch (e) {
                await sock.sendMessage(jid, { text: `❌ Failed: ${e.message}` });
            }
        }
    },

    // 33. mode
    {
        name: 'mode',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner) return;
            const mode = (args && args[0]) ? args[0].toLowerCase().trim() : '';
            if (!['public', 'private'].includes(mode)) return await sock.sendMessage(jid, { text: '❌ Usage: `mode public|private`' });
            const state = readState();
            state.isPublic = (mode === 'public');
            writeState(state);
            config.isPublic = state.isPublic;
            await sock.sendMessage(jid, { text: `✅ Mode set to: ${mode}` });
        }
    },

    // 34. owners
    {
        name: 'owners',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner) return;
            const primaryJid = core.getMasterJid() || 'None';
            const primaryLid = core.getMasterLid() || 'None';
            const secondJids = core.getMastersJid();
            const secondLids = core.getMastersLid();

            let text = '👑 *OWNERS LIST*\n━━━━━━━━━━━━━━━━━━━\n\n';
            text += `👤 *Primary Owner (JID):* @${primaryJid.split('@')[0]}\n`;
            text += `👤 *Primary Owner (LID):* @${primaryLid.split('@')[0]}\n\n`;
            
            text += `👥 *Secondary Owners (JIDs):*\n`;
            text += secondJids.map(jid => `• @${jid.split('@')[0]}`).join('\n') || '• None';
            text += `\n\n👥 *Secondary Owners (LIDs):*\n`;
            text += secondLids.map(lid => `• @${lid.split('@')[0]}`).join('\n') || '• None';

            const mentions = [primaryJid, primaryLid, ...secondJids, ...secondLids].filter(Boolean);
            await sock.sendMessage(jid, { text, mentions });
        }
    }, 

    // 35. setsudo (Updates Sudo, auto-resolves LID)
    {
        name: 'setsudo',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner) return;
            const target = parseTarget(msg, args);
            if (!target) return await sock.sendMessage(jid, { text: '❌ Mention or reply to a user.' });

            // Active server lookup for LID
            let resolvedLid = null;
            try {
                const lookup = await sock.onWhatsApp(target.split('@')[0]); // Fixed: onWhatsApp
                if (lookup && lookup[0] && lookup[0].exists) {
                    resolvedLid = lookup[0].lid || null;
                }
            } catch (e) {}

            const state = readState();
            if (!state.sudo) state.sudo = [];
            if (state.sudo.includes(target)) return await sock.sendMessage(jid, { text: '⚠️ Already sudo.' });
            
            state.sudo.push(target);
            if (resolvedLid && !state.sudo.includes(resolvedLid)) {
                state.sudo.push(resolvedLid);
            }
            writeState(state);

            const label = resolvedLid ? `@${target.split('@')[0]} & LID @${resolvedLid.split('@')[0]}` : `@${target.split('@')[0]}`;
            await sock.sendMessage(jid, { 
                text: `✅ ${label} added to sudo.`, 
                mentions: [target, resolvedLid].filter(Boolean) 
            });
        }
    },

    // 36. setowner (Updates owner, auto-resolves LID)
    {
        name: 'setowner',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner) return;
            const target = parseTarget(msg, args);
            if (!target) return await sock.sendMessage(jid, { text: '❌ Mention or reply to a user.' });

            // Active server lookup for LID
            let resolvedLid = null;
            try {
                const lookup = await sock.onWhatsApp(target.split('@')[0]); // Fixed: onWhatsApp
                if (lookup && lookup[0] && lookup[0].exists) {
                    resolvedLid = lookup[0].lid || null;
                }
            } catch (e) {}

            // Save in dynamic state.json
            const state = readState();
            if (!state.secondaryOwners) state.secondaryOwners = [];
            if (state.secondaryOwners.includes(target)) return await sock.sendMessage(jid, { text: '⚠️ Already secondary owner.' });
            
            state.secondaryOwners.push(target);
            if (resolvedLid && !state.secondaryOwners.includes(resolvedLid)) {
                state.secondaryOwners.push(resolvedLid);
            }
            writeState(state);

            // Save in Single Source of Truth database (core.js/core.json)
            core.addMaster(target);
            if (resolvedLid) core.addMasterLid(resolvedLid);

            const label = resolvedLid ? `@${target.split('@')[0]} & LID @${resolvedLid.split('@')[0]}` : `@${target.split('@')[0]}`;
            await sock.sendMessage(jid, { 
                text: `✅ ${label} registered as secondary owner.`, 
                mentions: [target, resolvedLid].filter(Boolean) 
            });
        }
    },

    // 37. delsudo
    {
        name: 'delsudo',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner) return;
            const target = parseTarget(msg, args);
            if (!target) return await sock.sendMessage(jid, { text: '❌ Mention or reply to a user.' });
            const state = readState();
            if (!state.sudo || !state.sudo.includes(target)) return await sock.sendMessage(jid, { text: '⚠️ Not in sudo list.' });
            state.sudo = state.sudo.filter(id => id !== target);
            writeState(state);
            await sock.sendMessage(jid, { text: `✅ @${target.split('@')[0]} removed from sudo.` });
        }
    },

    // 38. delowner
    {
        name: 'delowner',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner) return;
            const target = parseTarget(msg, args);
            if (!target) return await sock.sendMessage(jid, { text: '❌ Mention or reply to a user.' });

            const state = readState();
            const primaryJid = core.getMasterJid() || '';
            const primaryLid = core.getMasterLid() || '';

            if (target === primaryJid || target === primaryLid) {
                return await sock.sendMessage(jid, { text: '❌ Cannot remove the primary owner.' });
            }

            core.removeMaster(target); // Remove from Single Source of Truth

            if (state.secondaryOwners) {
                state.secondaryOwners = state.secondaryOwners.filter(id => id !== target);
                writeState(state);
            }

            await sock.sendMessage(jid, { text: `✅ @${target.split('@')[0]} removed from owners.` });
        }
    }, 

    // 39. restart
    {
        name: 'restart',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner) return;
            await sock.sendMessage(jid, { text: '🔄 Restarting...' });
            process.exit(1);
        }
    },

    // 40. shutdown
    {
        name: 'shutdown',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner) return;
            await sock.sendMessage(jid, { text: '💤 Shutting down...' });
            process.exit(0);
        }
    },

    // 41. diagnose
    {
        name: 'diagnose',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner) return;
            const results = diagnosePlugins();
            let report = '🔍 *Plugin Diagnosis*\n━━━━━━━━━━━━━━━━━━━\n\n';
            for (const r of results) {
                report += `${r.status} ${r.file}\n`;
                if (r.error) report += `   ⚠️ ${r.error}\n`;
            }
            if (results.length === 0) report += '⚠️ No plugin files found.';
            await sock.sendMessage(jid, { text: report });
        }
    },

    // 42. logs
    {
        name: 'logs',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner) return;
            if (!global.recentLogs || global.recentLogs.length === 0) {
                return await sock.sendMessage(jid, { text: '📋 No recent logs available.' });
            }
            const countInput = (args && args[0]) ? parseInt(args[0]) : NaN;
            let count = countInput || 20;
            if (count > 100) count = 100;
            const logs = global.recentLogs.slice(-count);
            let text = `📋 *Recent Logs (last ${logs.length})*\n━━━━━━━━━━━━━━━━━━━\n\n`;
            logs.forEach(entry => {
                const time = entry.time.split('T')[1].slice(0, 8);
                text += `[${time}] ${entry.level}: ${entry.message}\n`;
            });
            if (text.length > 65000) text = text.slice(0, 65000) + '\n... (truncated)';
            await sock.sendMessage(jid, { text });
        }
    }
];