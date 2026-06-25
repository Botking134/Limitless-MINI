// config.js – The Foundation of Limitless
module.exports = {
    // ─── COMMAND PREFIX ──────────────────────────────────────────
    // If null, the bot is prefixless. Otherwise, set to a string (e.g., ".").
    prefix: ".",

    // ─── OWNERS & PERMISSIONS ──────────────────────────────────
    // Primary owners (hardcoded – cannot be removed via .delowner)
    // Use full JID format: "2347059092107@s.whatsapp.net" or LID.
    owner: [
        "2347059092107@s.whatsapp.net",
        "2347040491291@s.whatsapp.net"
    ],

    // Dynamic secondary owners and sudo are stored in state.json,
    // but you can also pre‑fill them here as fallbacks.
    secondaryOwners: [],
    sudo: [],

    // Bot mode: true = public (everyone can use), false = private (only owners/sudo)
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
    // The following are usually set at runtime via state.json:
    primaryOwner: null,    // will be set on first pairing
    botJid: null,
    botLid: null,
    gojoGlobalSleep: false,
    autoReact: 'off',       // 'cmd', 'all', or 'off'
    antidelete: null,
    antiviewonce: null,
    antibug: null,
    antipm: null,
    statusEmoji: '💖',
    autovs: null,
    autors: null,
    stickerCommands: {},
    presence: {
        autotyping: { all: false, chats: [] },
        autorecording: { all: false, chats: [] },
        alwaysonline: { all: false },
        autoread: { all: false }
    },
    // Chatbot toggles (stored in state)
    aizenChats: [],
    jarvisChats: [],
    // Group settings (stored in state)
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
    totalMessages: {},
    // API keys (now hardcoded in respective plugins)
    geminiApiKey: null,   // no longer used (hardcoded in bankai.js, ai.js, group.js)
    groqApiKey: null,     // no longer used (hardcoded in ai.js)
    telegramBotToken: null // for tgs command (if you add it)
};