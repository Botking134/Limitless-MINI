/**
 * handlers.js – Master + Masters (LID‑based)
 * Stores resolved LIDs for master and secondary masters in state.json.
 */

const config = require('./config');
const commands = require('./commands');
const fs = require('fs');
const path = require('path');
const bankaiPlugin = require('./plugins/bankai');

// ─── BUTTON LABEL TO COMMAND MAPPING ──────────────────────────
const BUTTON_LABEL_MAP = {
    "🛡️ Core": "menu_core",
    "👑 Owner": "menu_owner",
    "🧠 AI": "menu_ai",
    "👥 Group": "menu_group",
    "📥 Download": "menu_dl",
    "🔙 Back": "menu_back"
};

const BUTTON_ID_MAP = {
    "menu_core": "menu_core",
    "menu_owner": "menu_owner",
    "menu_ai": "menu_ai",
    "menu_group": "menu_group",
    "menu_dl": "menu_dl",
    "menu_back": "menu_back"
};

// ─── STATE PATH ──────────────────────────────────────────────────
const STATE_PATH = path.join(__dirname, 'storage', 'state.json');

// ─── HELPERS ──────────────────────────────────────────────────────

function normalizeJid(input) {
    if (!input) return '';
    const clean = String(input).replace(/:[\d]+@/, '@');
    if (clean.endsWith('@s.whatsapp.net') || clean.endsWith('@lid')) return clean;
    const raw = clean.split('@')[0].replace(/[^0-9]/g, '');
    return raw ? `${raw}@s.whatsapp.net` : '';
}

function ensureArray(value) {
    if (Array.isArray(value)) return value;
    if (value === undefined || value === null) return [];
    if (typeof value === 'string') return [value];
    return [];
}

function normalizeJidList(list) {
    return ensureArray(list)
        .map(item => normalizeJid(item))
        .filter(Boolean);
}

function loadState() {
    try {
        if (fs.existsSync(STATE_PATH)) {
            const data = JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
            const keys = [
                'prefix', 'isPublic', 'autoReact', 'statusEmoji',
                'stickerCommands', 'aizenChats', 'jarvisChats',
                'welcome', 'goodbye', 'gcalerts', 'gclogActive',
                'conversationLogs', 'antilink', 'antigm', 'antispam',
                'antigcstatus', 'antipromote', 'antidemote',
                'warns', 'warnThreshold', 'dailyActivity', 'totalMessages',
                'botJid', 'botLid',
                'masterLid', 'mastersLids'  // <-- store resolved LIDs
            ];
            for (const key of keys) {
                if (data[key] !== undefined) config[key] = data[key];
            }
            // Normalize master and masters from state (if they were stored as phone JIDs)
            if (data.master) config.master = normalizeJid(data.master);
            if (data.masters) config.masters = normalizeJidList(data.masters);
            if (data.botJid) config.botJid = normalizeJid(data.botJid);
            if (data.botLid) config.botLid = normalizeJid(data.botLid);
            if (data.masterLid) config.masterLid = normalizeJid(data.masterLid);
            if (data.mastersLids) config.mastersLids = normalizeJidList(data.mastersLids);
        }
    } catch (e) {
        console.warn('[STATE] Failed to load state:', e.message);
    }
}

function saveState() {
    try {
        const dir = path.dirname(STATE_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        let state = {};
        const keys = [
            'prefix', 'isPublic', 'autoReact', 'statusEmoji',
            'stickerCommands', 'aizenChats', 'jarvisChats',
            'welcome', 'goodbye', 'gcalerts', 'gclogActive',
            'conversationLogs', 'antilink', 'antigm', 'antispam',
            'antigcstatus', 'antipromote', 'antidemote',
            'warns', 'warnThreshold', 'dailyActivity', 'totalMessages',
            'botJid', 'botLid',
            'master', 'masters', 'masterLid', 'mastersLids'
        ];
        for (const key of keys) {
            if (config[key] !== undefined) state[key] = config[key];
        }
        fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
    } catch (e) {
        console.error('[STATE] Save failed:', e.message);
    }
}
global.saveState = saveState;

// Normalize config on load
if (config.master) config.master = normalizeJid(config.master);
config.masters = normalizeJidList(config.masters);
if (config.botJid) config.botJid = normalizeJid(config.botJid);
if (config.botLid) config.botLid = normalizeJid(config.botLid);
if (config.masterLid) config.masterLid = normalizeJid(config.masterLid);
if (config.mastersLids) config.mastersLids = normalizeJidList(config.mastersLids);
loadState();

console.log(`📊 [HANDLERS] Commands loaded: ${Object.keys(commands).length}`);

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function getRawMessage(message) {
    if (!message) return null;
    if (message.ephemeralMessage?.message) return getRawMessage(message.ephemeralMessage.message);
    if (message.viewOnceMessage?.message) return getRawMessage(message.viewOnceMessage.message);
    if (message.viewOnceMessageV2?.message) return getRawMessage(message.viewOnceMessageV2.message);
    if (message.viewOnceMessageV2Extension?.message) return getRawMessage(message.viewOnceMessageV2Extension.message);
    if (message.documentWithCaptionMessage?.message) return getRawMessage(message.documentWithCaptionMessage.message);
    return message;
}

function getMentionedJids(msg) {
    const raw = getRawMessage(msg.message);
    const ctx = raw?.contextInfo || raw?.extendedTextMessage?.contextInfo;
    return ctx?.mentionedJid || [];
}

function isBotAddressed(sock, msg) {
    const rawIncoming = getRawMessage(msg.message);
    const contextInfo = rawIncoming?.extendedTextMessage?.contextInfo ||
                        rawIncoming?.imageMessage?.contextInfo ||
                        rawIncoming?.videoMessage?.contextInfo;

    const botJid = sock.user?.id ? normalizeJid(sock.user.id) : '';
    const botLid = sock.user?.lid ? normalizeJid(sock.user.lid) : (config.botLid || '');

    const quotedParticipant = contextInfo?.participant ? normalizeJid(contextInfo.participant) : '';
    if (quotedParticipant && (quotedParticipant === botJid || (botLid && quotedParticipant === botLid))) {
        return true;
    }

    const mentions = contextInfo?.mentionedJid || [];
    const normalizedMentions = mentions.map(m => normalizeJid(m));
    if (normalizedMentions.includes(botJid) || (botLid && normalizedMentions.includes(botLid))) {
        return true;
    }

    return false;
}

// ─── EMOJI MAP FOR AUTO-REACT ──────────────────────────────────
const EMOJI_MAP = {
    ping: '🏓',
    ping2: '⚡',
    shazam: '🎶'
};

// ─── RESOLVE MASTER / MASTERS LIDs ─────────────────────────────
function resolveMasterLids(sock, senderJid, senderPhone) {
    // Check if senderJid is a LID
    const isLid = senderJid.endsWith('@lid');
    if (!isLid) return; // Only resolve LIDs

    // Check if this sender's phone number matches the primary master
    if (config.master && senderPhone === config.master.split('@')[0]) {
        if (config.masterLid !== senderJid) {
            config.masterLid = senderJid;
            console.log(`👑 Master LID resolved: ${senderJid}`);
            saveState();
        }
        return;
    }

    // Check if this sender's phone number matches any secondary master
    if (Array.isArray(config.masters) && config.masters.length > 0) {
        const matchingMaster = config.masters.find(m => m.split('@')[0] === senderPhone);
        if (matchingMaster) {
            // Ensure mastersLids array exists
            if (!Array.isArray(config.mastersLids)) config.mastersLids = [];
            if (!config.mastersLids.includes(senderJid)) {
                config.mastersLids.push(senderJid);
                console.log(`👑 Secondary master LID resolved: ${senderJid}`);
                saveState();
            }
            return;
        }
    }

    // Also check if senderJid already matches any stored LID (no action needed)
}

// ─── MESSAGE HANDLER ─────────────────────────────────────────────
async function handleMessage(sock, chatUpdate) {
    const msg = chatUpdate.messages[0];
    if (!msg || msg.key.fromMe) return;

    let text = '';
    if (msg.message?.conversation) {
        text = msg.message.conversation;
    } else if (msg.message?.extendedTextMessage?.text) {
        text = msg.message.extendedTextMessage.text;
    } else if (msg.message?.buttonsResponseMessage?.selectedButtonId) {
        text = msg.message.buttonsResponseMessage.selectedButtonId;
    } else if (msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId) {
        text = msg.message.listResponseMessage.singleSelectReply.selectedRowId;
    } else {
        text = '[Media]';
    }

    const jid = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid || '';
    const senderJid = normalizeJid(sender);
    const senderPhone = senderJid.endsWith('@lid') ? null : senderJid.split('@')[0];

    // ─── GCLOG RECORDING ────────────────────────────────────────
    if (jid.endsWith('@g.us') && config.gclogActive?.[jid]) {
        if (!config.conversationLogs) config.conversationLogs = {};
        if (!config.conversationLogs[jid]) config.conversationLogs[jid] = [];
        config.conversationLogs[jid].push({
            time: Date.now(),
            sender: senderJid,
            text: text
        });
        if (config.conversationLogs[jid].length % 10 === 0) saveState();
    }

    // ─── RESOLVE LIDs FOR MASTER / MASTERS ─────────────────────
    // If senderJid is a LID and matches master phone, store it
    if (senderJid.endsWith('@lid') && senderPhone) {
        resolveMasterLids(sock, senderJid, senderPhone);
    }

    // ─── PERMISSION CONTEXT ─────────────────────────────────────
    // Primary master: check phone JID + LID
    const masterPhoneJid = config.master ? normalizeJid(config.master) : '';
    const masterLid = config.masterLid ? normalizeJid(config.masterLid) : '';

    // Secondary masters: check phone JIDs + LIDs
    const masterPhoneJids = Array.isArray(config.masters) ? config.masters.map(m => normalizeJid(m)).filter(Boolean) : [];
    const mastersLids = Array.isArray(config.mastersLids) ? config.mastersLids.map(m => normalizeJid(m)).filter(Boolean) : [];

    const isMaster =
        senderJid === masterPhoneJid ||
        senderJid === masterLid ||
        masterPhoneJids.includes(senderJid) ||
        mastersLids.includes(senderJid) ||
        (senderPhone && masterPhoneJid && senderPhone === masterPhoneJid.split('@')[0]) ||
        (senderPhone && masterPhoneJids.some(p => p.split('@')[0] === senderPhone));

    // ─── PUBLIC MODE CHECK ─────────────────────────────────────
    if (!config.isPublic && !isMaster) {
        return;
    }

    // ─── OWNER MENTION REACTION ─────────────────────────────────
    const mentioned = getMentionedJids(msg);
    const allMasters = [masterPhoneJid, masterLid, ...masterPhoneJids, ...mastersLids].filter(Boolean);
    let masterMentioned = false;
    if (allMasters.length > 0 && mentioned.some(m => allMasters.includes(normalizeJid(m)))) {
        masterMentioned = true;
    }
    if (masterMentioned && !msg.key.fromMe) {
        const emojis = ['3⃣', '2⃣', '1⃣', '0⃣', '⛩️'];
        for (const emoji of emojis) {
            try {
                await sock.sendMessage(jid, { react: { text: emoji, key: msg.key } });
                await delay(800);
            } catch (e) { /* ignore */ }
        }
    }

    // ─── BANKAI SELECTION HANDLER ──────────────────────────────
    if (msg.message?.extendedTextMessage?.contextInfo?.stanzaId) {
        const handled = await bankaiPlugin.handleBankaiSelection(sock, msg);
        if (handled) return;
    }

    // ─── HANDLE .asst BUTTON PRESS ──────────────────────────────
    const trimmedText = text.trim();
    if (trimmedText === 'deactivate_all') {
        if (!isMaster) {
            await sock.sendMessage(jid, { text: "❌ Only masters can deactivate assistants." }, { quoted: msg });
            return;
        }
        const active = config.aizenChats?.includes(jid) ? 'aizen' : (config.jarvisChats?.includes(jid) ? 'jarvis' : null);
        if (active === 'aizen') {
            if (commands['aizen']) {
                await commands['aizen'](sock, msg, ['seal'], { isMaster, sender: senderJid, senderNumber: senderPhone });
            }
        } else if (active === 'jarvis') {
            if (commands['jarvis']) {
                await commands['jarvis'](sock, msg, ['off'], { isMaster, sender: senderJid, senderNumber: senderPhone });
            }
        } else {
            await sock.sendMessage(jid, { text: "🤖 No active assistant to deactivate." }, { quoted: msg });
        }
        return;
    }

    // ─── COMMAND EXTRACTION ──────────────────────────────────────
    let commandName = '';
    let args = [];

    if (BUTTON_LABEL_MAP[trimmedText]) {
        commandName = BUTTON_LABEL_MAP[trimmedText];
        args = [];
        console.log(`[BUTTON] Label match: ${trimmedText} → ${commandName}`);
    } else if (BUTTON_ID_MAP[trimmedText]) {
        commandName = BUTTON_ID_MAP[trimmedText];
        args = [];
        console.log(`[BUTTON] ID match: ${trimmedText} → ${commandName}`);
    } else {
        const prefix = config.prefix || '.';
        if (trimmedText.startsWith(prefix)) {
            const withoutPrefix = trimmedText.slice(prefix.length).trim();
            const parts = withoutPrefix.split(/\s+/);
            commandName = parts.shift().toLowerCase();
            args = parts;
        } else {
            commandName = '';
            args = [];
        }
    }

    // ─── COMMAND DISPATCH ──────────────────────────────────────
    if (commandName) {
        const handler = commands[commandName];
        if (handler && typeof handler === 'function') {
            // Master-only commands
            const masterCommands = [
                'aizen', 'jarvis', 'asst',
                'setprefix', 'autoreact', 'mode', 'update', 'restart', 'shutdown',
                'block', 'unblock', 'clear', 'antipm', 'statusemoji',
                'addmaster', 'delmaster', 'masters', 'diagnose', 'logs'
            ];
            if (masterCommands.includes(commandName) && !isMaster) {
                await sock.sendMessage(jid, { text: "❌ Only masters can use this command." }, { quoted: msg });
                return;
            }

            console.log(`[CMD] Executing: ${commandName}`);
            try {
                await handler(sock, msg, args, { isMaster, sender: senderJid, senderNumber: senderPhone });
                if (config.autoReact === 'cmd') {
                    const emoji = EMOJI_MAP[commandName];
                    if (emoji) {
                        try {
                            await sock.sendMessage(jid, { react: { text: emoji, key: msg.key } });
                        } catch (e) { /* ignore */ }
                    }
                }
            } catch (err) {
                console.error(`[CMD] Error in ${commandName}:`, err);
                await sock.sendMessage(jid, { text: `❌ An error occurred while executing the command.` }).catch(() => {});
            }
            return;
        }
    }

    // ─── AGENT DETECTION ──────────────────────────────────────────
    const prefix = config.prefix || '.';
    if (!trimmedText.startsWith(prefix)) {
        const lowerMsg = trimmedText.toLowerCase();

        const mentionsAizen = lowerMsg.includes('aizen');
        const mentionsJarvis = lowerMsg.includes('jarvis');

        let detectedAgent = null;
        let isAddressed = isBotAddressed(sock, msg);

        if (mentionsAizen) {
            detectedAgent = 'aizen';
        } else if (mentionsJarvis) {
            detectedAgent = 'jarvis';
        } else if (isAddressed) {
            if (config.aizenChats?.includes(jid)) detectedAgent = 'aizen';
            else if (config.jarvisChats?.includes(jid)) detectedAgent = 'jarvis';
        }

        if (detectedAgent) {
            if (detectedAgent === 'aizen' && config.aizenChats?.includes(jid)) {
                if (commands['aizen_chat']) {
                    try {
                        await commands['aizen_chat'](sock, msg, trimmedText, { isMaster, sender: senderJid, senderNumber: senderPhone });
                    } catch (err) {
                        console.error('[AIZEN] Interceptor error:', err);
                    }
                }
            } else if (detectedAgent === 'jarvis' && config.jarvisChats?.includes(jid)) {
                if (commands['jarvis_chat']) {
                    try {
                        await commands['jarvis_chat'](sock, msg, trimmedText, { isMaster, sender: senderJid, senderNumber: senderPhone });
                    } catch (err) {
                        console.error('[JARVIS] Interceptor error:', err);
                    }
                }
            }
        }
    }
}

// ─── GROUP PARTICIPANTS HANDLER ─────────────────────────────────
async function handleGroupParticipants(sock, update) {
    // Keep your existing implementation here
}

module.exports = {
    handleMessage,
    handleGroupParticipants
};