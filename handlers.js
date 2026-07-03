/**
 * handlers.js – Master + Masters (LID‑based)
 * All master/masters logic delegated to core.js.
 */
const config = require('./config');
const core = require('./core');               // 🆕 single source of truth
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

// ─── STATE PATH (for dynamic settings only – not master/masters) ──
const STATE_PATH = path.join(__dirname, 'storage', 'state.json');

// ─── HELPERS ──────────────────────────────────────────────────────
function ensureArray(value) {
    if (Array.isArray(value)) return value;
    if (value === undefined || value === null) return [];
    if (typeof value === 'string') return [value];
    return [];
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
                // master/masters LIDs are now in core.json – not here
            ];
            for (const key of keys) {
                if (data[key] !== undefined) config[key] = data[key];
            }
            if (data.botJid) config.botJid = core._normalizeJid(data.botJid);
            if (data.botLid) config.botLid = core._normalizeJid(data.botLid);
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
        fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
    } catch (e) {
        console.error('[STATE] Save failed:', e.message);
    }
}
global.saveState = saveState;

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

    const botJid = sock.user?.id ? core._normalizeJid(sock.user.id) : '';
    const botLid = sock.user?.lid ? core._normalizeJid(sock.user.lid) : (config.botLid || '');

    const quotedParticipant = contextInfo?.participant ? core._normalizeJid(contextInfo.participant) : '';
    if (quotedParticipant && (quotedParticipant === botJid || (botLid && quotedParticipant === botLid))) {
        return true;
    }

    const mentions = contextInfo?.mentionedJid || [];
    const normalizedMentions = mentions.map(m => core._normalizeJid(m));
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
    if (!msg) return;

    // 1. Extract message text first to check for commands
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

    const trimmedText = text.trim();
    const prefix = config.prefix || '.';

    // Check if the message is an intentional command or button interaction
    const isCommand = trimmedText.startsWith(prefix) || 
                      BUTTON_LABEL_MAP[trimmedText] || 
                      BUTTON_ID_MAP[trimmedText];

    // 2. Filter self-messages (fromMe)
    if (msg.key.fromMe) {
        // If it's a message from the bot's own number, we only allow it to proceed 
        // if it is an explicit command (prevents infinite loops on standard responses)
        if (!isCommand) return;
    }

    const jid = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid || '';
    const senderJid = core._normalizeJid(sender);
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

    // ─── LID RESOLUTION (update master/secondary LIDs on the fly) ──
    if (senderPhone) {
        const masterJid = core.getMasterJid();
        const masterPhone = masterJid ? masterJid.split('@')[0] : null;
        if (masterPhone && senderPhone === masterPhone) {
            // This sender is the master; update master LID if we received a LID message
            if (senderJid.endsWith('@lid') && core.getMasterLid() !== senderJid) {
                core.updateMasterLid(senderJid);
                console.log(`👑 Master LID updated: ${senderJid}`);
            }
        } else {
            // Check secondary masters
            const mastersJids = core.getMastersJid();
            const matchedMaster = mastersJids.find(jid => jid.split('@')[0] === senderPhone);
            if (matchedMaster && senderJid.endsWith('@lid')) {
                core.addMasterLid(senderJid);
                console.log(`👑 Secondary master LID added: ${senderJid}`);
            }
        }
    }

    // ─── PERMISSION CHECK (SINGLE CALL TO CORE) ──────────────────
    const isMaster = core.isMaster(senderJid);

    // ─── PUBLIC MODE CHECK ─────────────────────────────────────
    if (!config.isPublic && !isMaster) {
        return;
    }

    // ─── OWNER MENTION REACTION ─────────────────────────────────
    const mentioned = getMentionedJids(msg);
    const allMasterIds = [
        core.getMasterJid(),
        core.getMasterLid(),
        ...core.getMastersJid(),
        ...core.getMastersLid()
    ].filter(Boolean);

    let masterMentioned = false;
    if (mentioned.some(m => allMasterIds.includes(core._normalizeJid(m)))) {
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
        const prefixVal = config.prefix || '.';
        if (trimmedText.startsWith(prefixVal)) {
            const withoutPrefix = trimmedText.slice(prefixVal.length).trim();
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
    const prefixVal = config.prefix || '.';
    if (!trimmedText.startsWith(prefixVal)) {
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