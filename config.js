// config.js – The Foundation of Limitless (Master + Masters Edition)
const path = require('path');

// ─── JID NORMALIZATION HELPER ──────────────────────────────────
function normalizeToJid(input) {
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
        .map(item => normalizeToJid(item))
        .filter(Boolean);
}

// ─── CONFIG EXPORT ──────────────────────────────────────────────
const config = {
    // ─── COMMAND PREFIX ──────────────────────────────────────────
    prefix: ".",

    // ─── PRIMARY MASTER (hardcoded) ─────────────────────────────
    // Accepts phone number (without @s.whatsapp.net) or full JID/LID.
    master: "2347059092107",   // Change to your number

    // ─── SECONDARY MASTERS (stored in state.json, auto‑added on pairing)
    masters: [],

    // ─── PUBLIC MODE ──────────────────────────────────────────────
    // true  = anyone can use normal commands (only masters can use owner commands)
    // false = only masters can use the bot at all
    isPublic: true,

    // ─── STICKER DEFAULTS ──────────────────────────────────────
    packName: 'Limitless-MD',
    author: 'Infinity',

    // ─── WELCOME / GOODBYE ─────────────────────────────────────
    welcome: 'Welcome @user! You have entered the Soul Society.',
    goodbye: 'Goodbye @user! May your path be clear.',

    // ─── MISC / DYNAMIC SETTINGS ──────────────────────────────
    botName: 'Limitless-MD',
    ownerName: 'Infinity',

    // ─── RUNTIME SETTINGS (stored in state.json) ──────────────
    botJid: null,
    botLid: null,
    autoReact: 'off',
    statusEmoji: '💖',
    stickerCommands: {},

    // ─── CHATBOT TOGGLES (stored in state) ──────────────────────
    aizenChats: [],
    jarvisChats: [],

    // ─── GROUP SETTINGS (stored in state) ──────────────────────
    welcome: {},
    goodbye: {},
    gcalerts: { promote: {}, demote: {}, welcome: {}, goodbye: {} },
    gclogActive: {},
    conversationLogs: {},
    antilink: {},
    antigm: {},
    antispam: {},
    antigcstatus: 'off',
    antipromote: {},
    antidemote: {},
    warns: {},
    warnThreshold: 5,
    dailyActivity: {},
    totalMessages: {}
};

// ─── NORMALIZE MASTER AND MASTERS ──────────────────────────────
if (config.master) {
    config.master = normalizeToJid(config.master);
} else {
    // If master is empty, we'll auto‑set it on first pairing in pair.js
    config.master = null;
}
config.masters = normalizeJidList(config.masters);

module.exports = config;