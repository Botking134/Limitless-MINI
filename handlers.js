/**
 * handlers.js – Centralized message and event handling
 * Features: command dispatch, gclog, auto-react, owner mention reaction,
 *           agent detection (Aizen/Jarvis by name), .asst button handling,
 *           button ID mapping for menu system.
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

// ─── BUTTON ID TO COMMAND MAPPING ─────────────────────────────
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
                'botJid', 'botLid'
            ];
            for (const key of keys) {
                if (data[key] !== undefined) config[key] = data[key];
            }
            // Normalize owner and sudo from state
            if (data.owner) config.owner = normalizeJidList(data.owner);
            if (data.sudo) config.sudo = normalizeJidList(data.sudo);
            if (data.botJid) config.botJid = normalizeJid(data.botJid);
            if (data.botLid) config.botLid = normalizeJid(data.botLid);
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
            'botJid', 'botLid'
        ];
        for (const key of keys) {
            if (config[key] !== undefined) state[key] = config[key];
        }
        // Store owner and sudo as arrays
        state.owner = config.owner || [];
        state.sudo = config.sudo || [];
        fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
    } catch (e) {
        console.error('[STATE] Save failed:', e.message);
    }
}
global.saveState = saveState;

// Normalize config on load
config.owner = normalizeJidList(config.owner);
config.sudo = normalizeJidList(config.sudo);
if (config.botJid) config.botJid = normalizeJid(config.botJid);
if (config.botLid) config.botLid = normalizeJid(config.botLid);
loadState();

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

function matchesOwnerList(senderJid, senderPhone, ownerList) {
    if (!ownerList || !Array.isArray(ownerList)) return false;
    for (const entry of ownerList) {
        const normalizedEntry = normalizeJid(entry);
        if (senderJid === normalizedEntry) return true;
        // Also match by phone number
        if (senderPhone === normalizedEntry.split('@')[0]) return true;
    }
    return false;
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
    const senderPhone = senderJid.split('@')[0];

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

    // ─── OWNER MENTION REACTION ─────────────────────────────────
    const mentioned = getMentionedJids(msg);
    const allOwners = ensureArray(config.owner).map(j => normalizeJid(j)).filter(Boolean);
    let ownerMentioned = false;
    for (const m of mentioned) {
        const nm = normalizeJid(m);
        if (allOwners.includes(nm)) { ownerMentioned = true; break; }
    }
    if (ownerMentioned && !msg.key.fromMe) {
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

    // ─── PERMISSION CONTEXT ─────────────────────────────────────
    const ownerList = ensureArray(config.owner).map(j => normalizeJid(j)).filter(Boolean);
    const sudoList = ensureArray(config.sudo).map(j => normalizeJid(j)).filter(Boolean);

    const isOwner = matchesOwnerList(senderJid, senderPhone, ownerList);
    const isSudo = isOwner || matchesOwnerList(senderJid, senderPhone, sudoList);

    // ─── HANDLE .asst BUTTON PRESS ──────────────────────────────
    const trimmedText = text.trim();
    if (trimmedText === 'deactivate_all') {
        const active = config.aizenChats?.includes(jid) ? 'aizen' : (config.jarvisChats?.includes(jid) ? 'jarvis' : null);
        if (active === 'aizen') {
            if (commands['aizen']) {
                await commands['aizen'](sock, msg, ['seal'], { isOwner, isSudo, sender: senderJid, senderNumber: senderPhone });
            }
        } else if (active === 'jarvis') {
            if (commands['jarvis']) {
                await commands['jarvis'](sock, msg, ['off'], { isOwner, isSudo, sender: senderJid, senderNumber: senderPhone });
            }
        } else {
            await sock.sendMessage(jid, { text: "🤖 No active assistant to deactivate." }, { quoted: msg });
        }
        return;
    }

    // ─── COMMAND EXTRACTION ──────────────────────────────────────
    let commandName = '';
    let args = [];

    // Check button labels first
    if (BUTTON_LABEL_MAP[trimmedText]) {
        commandName = BUTTON_LABEL_MAP[trimmedText];
        args = [];
        console.log(`[BUTTON] Label match: ${trimmedText} → ${commandName}`);
    } 
    // Then check button IDs
    else if (BUTTON_ID_MAP[trimmedText]) {
        commandName = BUTTON_ID_MAP[trimmedText];
        args = [];
        console.log(`[BUTTON] ID match: ${trimmedText} → ${commandName}`);
    } 
    // Then check if it's a prefixed command
    else {
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
            console.log(`[CMD] Executing: ${commandName}`);
            try {
                await handler(sock, msg, args, { isOwner, isSudo, sender: senderJid, senderNumber: senderPhone });
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

    // ─── AGENT DETECTION (prefixless interceptors) ──────────────
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
                        await commands['aizen_chat'](sock, msg, trimmedText, { isOwner, isSudo, sender: senderJid, senderNumber: senderPhone });
                    } catch (err) {
                        console.error('[AIZEN] Interceptor error:', err);
                    }
                }
            } else if (detectedAgent === 'jarvis' && config.jarvisChats?.includes(jid)) {
                if (commands['jarvis_chat']) {
                    try {
                        await commands['jarvis_chat'](sock, msg, trimmedText, { isOwner, isSudo, sender: senderJid, senderNumber: senderPhone });
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
    // (unchanged from your original)
}

module.exports = {
    handleMessage,
    handleGroupParticipants
};