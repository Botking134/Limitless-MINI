/**
 * handlers.js – Centralized message and event handling
 * Includes: Command dispatch, gclog, welcome/goodbye, auto-react, owner mention reaction, button labels, bankai selection
 */

const config = require('./config');
const commands = require('./commands');
const fs = require('fs');
const path = require('path');
const bankaiPlugin = require('./plugins/bankai'); // ADDED

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
        }
    } catch (e) { /* ignore */ }
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

// ─── HELPERS ──────────────────────────────────────────────────────

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function normalizeToJid(input) {
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

function getMentionedJids(msg) {
    const raw = getRawMessage(msg.message);
    const ctx = raw?.contextInfo || raw?.extendedTextMessage?.contextInfo;
    return ctx?.mentionedJid || [];
}

// ─── EMOJI MAP FOR AUTO-REACT ──────────────────────────────────
const EMOJI_MAP = {
    // Core
    ping: '🏓',
    ping2: '⚡',
    vv: '👁️',
    vv2: '📩',
    getpp: '🖼️',
    setpp: '🔄',
    s: '🎨',
    take: '✏️',
    delete: '🗑️',
    del: '🗑️',
    dlt: '🗑️',
    uptime: '⏱️',
    alive: '💚',
    crop: '✂️',
    url: '🔗',
    toaudio: '🎧',
    tts: '🗣️',

    // Owner
    setprefix: '⚙️',
    autoreact: '🤖',
    speed: '🚀',
    gitclone: '📦',
    addnote: '📝',
    delnote: '❌',
    getnote: '📄',
    getnotes: '📋',
    notes: '📚',
    reminder: '⏰',
    remind: '🔔',
    autotyping: '⌨️',
    autorecording: '🎙️',
    alwaysonline: '🌐',
    autoread: '👀',
    presence: '📊',
    antidelete: '🛡️',
    antiviewonce: '🛡️',
    antibug: '🛡️',
    block: '🚫',
    unblock: '✅',
    archive: '📂',
    unarchive: '📂',
    clear: '🧹',
    antipm: '🛡️',
    update: '🔄',
    statusemoji: '😊',
    autovs: '👁️',
    autors: '🤖',
    ss: '📸',
    device: '📱',
    spam: '💬',
    setcmd: '🏷️',
    delcmd: '🏷️',
    '🥷🏼': '🥷🏼',
    fw: '📨',
    mode: '🔓',
    owners: '👑',
    setsudo: '👑',
    setowner: '👑',
    delsudo: '👑',
    delowner: '👑',
    restart: '🔄',
    shutdown: '💤',
    diagnose: '🔍',
    logs: '📋',

    // AI
    ai: '🧠',
    groq: '🧠',
    aizen: '🌀',
    aizen_chat: '🌀',
    jarvis: '🤖',
    jarvis_chat: '🤖',
    debug: '🛠️',
    summon: '🔮',
    read: '👁️',
    imagine: '🎨',
    say: '🗣️',

    // Group
    welcome: '👋',
    goodbye: '👋',
    setwelcome: '✏️',
    setgoodbye: '✏️',
    gcalerts: '🔔',
    gclog: '📊',
    kickall: '🦶',
    stopkickall: '🛑',
    kick: '🦶',
    join: '➕',
    exit: '🚪',
    leave: '🚪',
    togcstatus: '📡',
    togcjid: '📡',
    getgpp: '🖼️',
    setgpp: '🔄',
    poll: '📊',
    tag: '🏷️',
    spamtag: '💬',
    tagall: '🏷️',
    mute: '🔇',
    unmute: '🔊',
    open: '🔓',
    close: '🔒',
    lock: '🔒',
    unlock: '🔓',
    promote: '👑',
    demote: '👑',
    link: '🔗',
    invite: '🔗',
    gclink: '🔗',
    admins: '👑',
    jid: '🆔',
    gcjid: '🆔',
    active: '✅',
    inactive: '❌',
    msgs: '💬',
    antilink: '🛡️',
    antigm: '🛡️',
    antispam: '🛡️',
    antigcstatus: '🛡️',
    antipromote: '🛡️',
    antidemote: '🛡️',
    warn: '⚠️',
    silence: '🔇',
    silence_ans: '🔇',
    unsilence: '🔊',
    delspam: '🗑️',

    // Download
    fb: '📘',
    facebook: '📘',
    tt: '🎵',
    tiktok: '🎵',
    yt: '▶️',
    youtube: '▶️',
    ig: '📸',
    instagram: '📸',
    x: '🐦',
    xdl: '🐦',
    spotify: '🎵',
    pinterest: '📌',
    mediafire: '📦',
    gdrive: '☁️',
    obf: '🔒',
    song: '🎵',
    play: '▶️',
    tgs: '📦',
    apk: '📱',
    web: '🌐',
    lyrics: '📝',
    img: '🖼️',
    xvid: '🎥',
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
    const senderNumber = sender.split('@')[0];

    // ─── GCLOG RECORDING ────────────────────────────────────────
    if (jid.endsWith('@g.us') && config.gclogActive?.[jid]) {
        if (!config.conversationLogs) config.conversationLogs = {};
        if (!config.conversationLogs[jid]) config.conversationLogs[jid] = [];
        config.conversationLogs[jid].push({
            time: Date.now(),
            sender: normalizeToJid(sender),
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
    ].filter(Boolean).map(j => normalizeToJid(j));
    let ownerMentioned = false;
    for (const m of mentioned) {
        const nm = normalizeToJid(m);
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

    // ─── BANKAI SELECTION HANDLER (if it's a reply to a bankai list) ─
    if (msg.message?.extendedTextMessage?.contextInfo?.stanzaId) {
        const handled = await bankaiPlugin.handleBankaiSelection(sock, msg);
        if (handled) return; // handled by bankai plugin
    }

    // ─── BUTTON LABEL MAPPING ──────────────────────────────────
    const trimmedText = text.trim();
    let commandName = '';
    let args = [];
    if (BUTTON_LABEL_MAP[trimmedText]) {
        // It's a button press
        commandName = BUTTON_LABEL_MAP[trimmedText];
        args = [];
        console.log(`[CMD] Button pressed: "${trimmedText}" → ${commandName}`);
    } else {
        // Normal command parsing
        const parts = trimmedText.split(/\s+/);
        commandName = parts.shift().toLowerCase();
        args = parts;
    }

    const handler = commands[commandName];
    if (handler && typeof handler === 'function') {
        const primaryOwners = config.owner || [];
        const primaryOwner = config.primaryOwner || '';
        const secondaryOwners = config.secondaryOwners || [];
        const sudoList = config.sudo || [];

        const isPrimaryOwner = primaryOwners.includes(sender) || sender === primaryOwner;
        const isOwner = isPrimaryOwner || secondaryOwners.includes(sender);
        const isSudo = isOwner || sudoList.includes(sender);

        console.log(`[CMD] Executing: ${commandName} (isOwner: ${isOwner}, isSudo: ${isSudo})`);

        try {
            await handler(sock, msg, args, { isOwner, isSudo, isPrimaryOwner, sender, senderNumber });

            // ─── AUTO-REACT (cmd mode) ──────────────────────────
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
        // No handler found – ignore
    }
}

// ─── GROUP PARTICIPANTS HANDLER (welcome/goodbye) ──────────────
async function handleGroupParticipants(sock, update) {
    const jid = update.id;
    const participants = update.participants;
    const action = update.action;

    if (!jid.endsWith('@g.us')) return;

    if (action === 'add') {
        const welcomeConfig = config.welcome?.[jid];
        if (welcomeConfig?.active) {
            const msgTemplate = welcomeConfig.text || 'Welcome @user!';
            const images = welcomeConfig.images || [];
            const groupMetadata = await sock.groupMetadata(jid);
            const groupName = groupMetadata.subject || 'Group';
            const groupSize = groupMetadata.participants.length;

            for (const participant of participants) {
                const userMention = `@${participant.split('@')[0]}`;
                const now = new Date();
                const timeStr = now.toLocaleTimeString('en-US', { timeZone: 'Africa/Lagos', hour12: true });
                const dateStr = now.toLocaleDateString('en-US', { timeZone: 'Africa/Lagos' });

                let finalText = msgTemplate
                    .replace(/@user/g, userMention)
                    .replace(/@name/g, groupName)
                    .replace(/@size/g, groupSize)
                    .replace(/@time/g, timeStr)
                    .replace(/@date/g, dateStr);

                let imageUrl = null;
                if (images.length > 0) {
                    imageUrl = images[Math.floor(Math.random() * images.length)];
                }

                try {
                    if (imageUrl) {
                        const isGif = imageUrl.toLowerCase().endsWith('.gif');
                        if (isGif) {
                            await sock.sendMessage(jid, {
                                video: { url: imageUrl },
                                gifPlayback: true,
                                caption: finalText,
                                mentions: [participant]
                            });
                        } else {
                            await sock.sendMessage(jid, {
                                image: { url: imageUrl },
                                caption: finalText,
                                mentions: [participant]
                            });
                        }
                    } else {
                        await sock.sendMessage(jid, {
                            text: finalText,
                            mentions: [participant]
                        });
                    }
                } catch (err) {
                    console.error('Welcome send error:', err);
                }
            }
        }
    }

    if (action === 'remove') {
        const goodbyeConfig = config.goodbye?.[jid];
        if (goodbyeConfig?.active) {
            const msgTemplate = goodbyeConfig.text || 'Goodbye @user!';
            const images = goodbyeConfig.images || [];
            const groupMetadata = await sock.groupMetadata(jid);
            const groupName = groupMetadata.subject || 'Group';
            const groupSize = groupMetadata.participants.length;

            for (const participant of participants) {
                const userMention = `@${participant.split('@')[0]}`;
                const now = new Date();
                const timeStr = now.toLocaleTimeString('en-US', { timeZone: 'Africa/Lagos', hour12: true });
                const dateStr = now.toLocaleDateString('en-US', { timeZone: 'Africa/Lagos' });

                let finalText = msgTemplate
                    .replace(/@user/g, userMention)
                    .replace(/@name/g, groupName)
                    .replace(/@size/g, groupSize)
                    .replace(/@time/g, timeStr)
                    .replace(/@date/g, dateStr);

                let imageUrl = null;
                if (images.length > 0) {
                    imageUrl = images[Math.floor(Math.random() * images.length)];
                }

                try {
                    if (imageUrl) {
                        const isGif = imageUrl.toLowerCase().endsWith('.gif');
                        if (isGif) {
                            await sock.sendMessage(jid, {
                                video: { url: imageUrl },
                                gifPlayback: true,
                                caption: finalText,
                                mentions: [participant]
                            });
                        } else {
                            await sock.sendMessage(jid, {
                                image: { url: imageUrl },
                                caption: finalText,
                                mentions: [participant]
                            });
                        }
                    } else {
                        await sock.sendMessage(jid, {
                            text: finalText,
                            mentions: [participant]
                        });
                    }
                } catch (err) {
                    console.error('Goodbye send error:', err);
                }
            }
        }
    }
}

module.exports = {
    handleMessage,
    handleGroupParticipants
};