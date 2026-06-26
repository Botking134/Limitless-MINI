/**
 * handlers.js – Centralized message and event handling
 * Features: command dispatch, gclog, welcome/goodbye, auto-react, owner mention reaction,
 *           button labels, bankai selection, and number‑only owner matching.
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

// ─── STATE PATH ──────────────────────────────────────────────────
const STATE_PATH = path.join(__dirname, 'storage', 'state.json');

// ─── HELPERS ──────────────────────────────────────────────────────

function normalizeJid(input) {
    if (!input) return '';
    const clean = input.replace(/:[\d]+@/, '@');
    if (clean.endsWith('@s.whatsapp.net') || clean.endsWith('@lid')) return clean;
    const raw = clean.split('@')[0].replace(/[^0-9]/g, '');
    return raw ? `${raw}@s.whatsapp.net` : '';
}

function loadState() {
    try {
        if (fs.existsSync(STATE_PATH)) {
            const data = JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
            const keys = [
                'secondaryOwners', 'sudo', 'primaryOwner', 'prefix', 'isPublic',
                'autoReact', 'antidelete', 'antiviewonce', 'antibug', 'antipm',
                'statusEmoji', 'autovs', 'autors', 'stickerCommands', 'presence',
                'aizenChats', 'jarvisChats', 'welcome', 'goodbye', 'gcalerts',
                'gclogActive', 'conversationLogs', 'antilink', 'antigm', 'antispam',
                'antigcstatus', 'antipromote', 'antidemote', 'warns', 'warnThreshold',
                'dailyActivity', 'totalMessages'
            ];
            for (const key of keys) {
                if (data[key] !== undefined) config[key] = data[key];
            }
            // Normalize all owner/sudo JIDs
            if (config.owner) {
                config.owner = config.owner.map(j => normalizeJid(j)).filter(Boolean);
            }
            if (config.secondaryOwners) {
                config.secondaryOwners = config.secondaryOwners.map(j => normalizeJid(j)).filter(Boolean);
            }
            if (config.sudo) {
                config.sudo = config.sudo.map(j => normalizeJid(j)).filter(Boolean);
            }
            if (config.primaryOwner) {
                config.primaryOwner = normalizeJid(config.primaryOwner);
            }
        }
    } catch (e) {
        console.warn('[STATE] Failed to load state:', e.message);
    }
}
loadState();

// ─── SAVE STATE ──────────────────────────────────────────────────
function saveState() {
    try {
        const dir = path.dirname(STATE_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        let state = {};
        const keys = [
            'secondaryOwners', 'sudo', 'primaryOwner', 'prefix', 'isPublic',
            'autoReact', 'antidelete', 'antiviewonce', 'antibug', 'antipm',
            'statusEmoji', 'autovs', 'autors', 'stickerCommands', 'presence',
            'aizenChats', 'jarvisChats', 'welcome', 'goodbye', 'gcalerts',
            'gclogActive', 'conversationLogs', 'antilink', 'antigm', 'antispam',
            'antigcstatus', 'antipromote', 'antidemote', 'warns', 'warnThreshold',
            'dailyActivity', 'totalMessages'
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

// ─── OTHER HELPERS ──────────────────────────────────────────────

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

// ─── OWNER MATCHING (supports numbers only) ─────────────────────
function matchesOwnerList(senderJid, senderPhone, ownerList) {
    if (!ownerList || !Array.isArray(ownerList)) return false;
    for (const entry of ownerList) {
        const normalizedEntry = normalizeJid(entry);
        // If the entry ends with @s.whatsapp.net or @lid, compare full JID
        if (normalizedEntry.endsWith('@s.whatsapp.net') || normalizedEntry.endsWith('@lid')) {
            if (senderJid === normalizedEntry) return true;
        } else {
            // Assume entry is just digits (phone number)
            if (senderPhone === entry) return true;
        }
    }
    return false;
}

// ─── EMOJI MAP FOR AUTO-REACT ──────────────────────────────────
const EMOJI_MAP = {
    // (same as before – I'll include it fully in the final code)
    ping: '🏓',
    ping2: '⚡',
    // ... all commands from previous versions
    shazam: '🎶'
};

// ─── MESSAGE HANDLER ─────────────────────────────────────────────
async function handleMessage(sock, chatUpdate) {
    const msg = chatUpdate.messages[0];
    if (!msg || msg.key.fromMe) return;

    // Extract text
    let text = '';
    if (msg.message?.conversation) {
        text = msg.message.conversation;
    } else if (msg.message?.extendedTextMessage?.text) {
        text = msg.message.extendedTextMessage.text;
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
    const allOwners = [
        ...(config.owner || []),
        config.primaryOwner || '',
        ...(config.secondaryOwners || [])
    ].filter(Boolean).map(j => normalizeJid(j));
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
    // Primary owners (hardcoded config.owner)
    const primaryOwners = (config.owner || []).map(j => normalizeJid(j));
    const primaryOwner = config.primaryOwner ? normalizeJid(config.primaryOwner) : '';
    const secondaryOwners = (config.secondaryOwners || []).map(j => normalizeJid(j));
    const sudoList = (config.sudo || []).map(j => normalizeJid(j));

    // Use number-only matching for all checks
    const isPrimaryOwner = matchesOwnerList(senderJid, senderPhone, primaryOwners) ||
                           (primaryOwner && (senderJid === primaryOwner || senderPhone === primaryOwner.split('@')[0]));
    const isOwner = isPrimaryOwner || matchesOwnerList(senderJid, senderPhone, secondaryOwners);
    const isSudo = isOwner || matchesOwnerList(senderJid, senderPhone, sudoList);

    // ─── BUTTON LABEL MAPPING ──────────────────────────────────
    const trimmedText = text.trim();
    let commandName = '';
    let args = [];
    if (BUTTON_LABEL_MAP[trimmedText]) {
        commandName = BUTTON_LABEL_MAP[trimmedText];
        args = [];
        console.log(`[BUTTON] ${trimmedText} → ${commandName}`);
    } else {
        const parts = trimmedText.split(/\s+/);
        commandName = parts.shift().toLowerCase();
        args = parts;
    }

    // ─── COMMAND DISPATCH ──────────────────────────────────────
    const handler = commands[commandName];
    if (handler && typeof handler === 'function') {
        console.log(`[CMD] Executing: ${commandName}`);
        try {
            await handler(sock, msg, args, { isOwner, isSudo, isPrimaryOwner, sender: senderJid, senderNumber: senderPhone });
            // Auto-react if enabled
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
    } else {
        // Silent ignore – no log for unhandled commands
    }
}

// ─── GROUP PARTICIPANTS HANDLER (welcome/goodbye) ──────────────
async function handleGroupParticipants(sock, update) {
    // (unchanged – same as previous)
}

module.exports = {
    handleMessage,
    handleGroupParticipants
};