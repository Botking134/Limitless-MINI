// config.js – The Foundation of Limitless

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

    // ─── OWNERS & SUDO ──────────────────────────────────────────
    // Accept phone numbers (without @s.whatsapp.net) or full JIDs.
    // They will be normalized to full JID format automatically.
    owner: [
        "27713655070",      // <- phone number
        "2347040491291"     // <- phone number
    ],
    sudo: [],

    // ─── BOT MODE ──────────────────────────────────────────────────
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

// ─── NORMALIZE OWNER AND SUDO LISTS ON EXPORT ──────────────────
config.owner = normalizeJidList(config.owner);
config.sudo = normalizeJidList(config.sudo);

// ─── EXPOSE HELPERS FOR USE IN OTHER FILES ─────────────────────
config._normalizeToJid = normalizeToJid;
config._normalizeJidList = normalizeJidList;
config._ensureArray = ensureArray;

module.exports = config;