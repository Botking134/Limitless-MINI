// plugins/menu.js – Bankai Menu System
const config = require('../config');
const commands = require('../commands');
const axios = require('axios');

// ─── BANKAI LIST ──────────────────────────────────────────────────
const BANKAI_LIST = [
    {
        name: 'Genryūsai Shigekuni Yamamoto',
        bankai: 'Zanka no Tachi (East / West / South / North)',
        images: ['https://files.catbox.moe/8kl56c.jpg']
    },
    {
        name: 'Soifon',
        bankai: 'Jakuho Raikōben',
        images: ['https://files.catbox.moe/c92pzb.jpg']
    },
    {
        name: 'Gin Ichimaru',
        bankai: 'Kamishini no Yari',
        images: ['https://files.catbox.moe/jl5xxp.jpg']
    },
    {
        name: 'Retsu Unohana',
        bankai: 'Minazuki',
        images: ['https://files.catbox.moe/5mpn2v.jpg', 'https://files.catbox.moe/a9rlna.jpg']
    },
    {
        name: 'Sōsuke Aizen',
        bankai: '404 error (Too powerful for a bankai)',
        images: ['https://files.catbox.moe/z7cmvo.jpg']
    },
    {
        name: 'Byakuya Kuchiki',
        bankai: 'Senbonzakura Kageyoshi (Senkei / Gōkei / Shūkei: Hakuteiken)',
        images: ['https://files.catbox.moe/to976z.jpg']
    },
    {
        name: 'Sajin Komamura',
        bankai: 'Kokujō Tengen Myō‘ō → Kokujō Tengen Myō‘ō: Dangai Jōe',
        images: ['https://files.catbox.moe/57kq5e.jpg']
    },
    {
        name: 'Shunsui Kyōraku',
        bankai: 'Katen Kyōkotsu: Kuromatsu Shinjū',
        images: ['https://files.catbox.moe/bz10zs.jpg']
    },
    {
        name: 'Kaname Tōsen',
        bankai: 'Suzumushi Tsuishiki: Enma Kōrogi',
        images: ['https://files.catbox.moe/bvvio3.jpg']
    },
    {
        name: 'Tōshirō Hitsugaya',
        bankai: 'Daiguren Hyōrinmaru (true completed form)',
        images: ['https://files.catbox.moe/3jj9h0.jpg']
    },
    {
        name: 'Kenpachi Zaraki',
        bankai: 'Unnamed (spirit: Nozarashi)',
        images: ['https://files.catbox.moe/2i6zn8.webp']
    },
    {
        name: 'Mayuri Kurotsuchi',
        bankai: 'Konjiki Ashisogi Jizō → Konjiki Ashisogi Jizō: Matai Fukuin Shōtai',
        images: ['https://files.catbox.moe/96uxvl.jpg', 'https://files.catbox.moe/0l9srs.jpg']
    },
    {
        name: 'Jūshirō Ukitake',
        bankai: 'Unknown (never revealed)',
        images: ['https://files.catbox.moe/40iaz9.jpeg']
    },
    {
        name: 'Rukia Kuchiki',
        bankai: 'Hakka no Togame',
        images: ['https://files.catbox.moe/tdn94f.jpg']
    },
    {
        name: 'Ikkaku Madarame',
        bankai: 'Ryūmon Hōzukimaru',
        images: ['https://files.catbox.moe/e4ksn1.jpg']
    },
    {
        name: 'Chōjirō Sasakibe',
        bankai: 'Kōkō Gonryō Rikyū',
        images: ['https://files.catbox.moe/08snw1.jpg']
    },
    {
        name: 'Rōjūrō Ōtoribashi (Rose)',
        bankai: 'Kinshara Butōdan',
        images: ['https://files.catbox.moe/avnjtp.jpeg']
    },
    {
        name: 'Kensei Muguruma',
        bankai: 'Tekken Tachikaze',
        images: ['https://files.catbox.moe/b9w3wg.jpg', 'https://files.catbox.moe/a58fhp.jpg']
    },
    {
        name: 'Shinji Hirako',
        bankai: 'Sakasama Yokoshima Happō Fusagari (CFYOW novel)',
        images: ['https://files.catbox.moe/7ljeh0.jpg', 'https://files.catbox.moe/6717wl.jpg']
    },
    {
        name: 'Shūhei Hisagi',
        bankai: 'Fushi no Kōjō (CFYOW novel)',
        images: ['https://files.catbox.moe/k24my3.jpeg']
    },
    {
        name: 'Senjumaru Shutara',
        bankai: 'Shatatsu Karagara Shigarami no Tsuji',
        images: ['https://files.catbox.moe/j7j6n9.jpeg']
    },
    {
        name: 'Ichibē Hyōsube',
        bankai: 'Shin‘uchi: Shirafude Ichimonji (Bankai equivalent)',
        images: ['https://files.catbox.moe/k76wq7.jpeg']
    },
    {
        name: 'Ichigo Kurosaki',
        bankai: 'Tensa Zangetsu → True Tensa Zangetsu',
        images: [
            'https://files.catbox.moe/3o05ff.jpg',
            'https://files.catbox.moe/cwr9ii.jpg',
            'https://files.catbox.moe/qc9vzm.jpeg',
            'https://files.catbox.moe/i5en66.jpeg'
        ]
    },
    {
        name: 'Kūgo Ginjō',
        bankai: 'Unnamed',
        images: ['https://files.catbox.moe/au1qw3.jpeg']
    },
    {
        name: 'Renji Abarai',
        bankai: 'Hihiō Zabimaru → Sōō Zabimaru (true Bankai)',
        images: ['https://files.catbox.moe/e0o09x.jpg', 'https://files.catbox.moe/fdcp7b.jpg']
    },
    {
        name: 'Kisuke Urahara',
        bankai: 'Kannonbiraki Benihime Aratame',
        images: ['https://files.catbox.moe/8etzbd.jpg', 'https://files.catbox.moe/6wr9tj.jpeg']
    },
    {
        name: 'Sōya Azashiro (8th Kenpachi)',
        bankai: 'Urozakuro (SAFWY novel)',
        images: ['https://files.catbox.moe/wuruer.webp']
    },
    {
        name: 'Kenpachi Kuruyashiki (7th Kenpachi)',
        bankai: 'Gagaku Kairō (SAFWY)',
        images: ['https://files.catbox.moe/xvpysl.webp']
    }
];

// ─── CATEGORY COMMAND LISTS ──────────────────────────────────────
const CATEGORIES = {
    core: [
        'ping', 'ping2', 'vv', 'vv2', 'getpp', 'setpp', 's', 'take',
        'delete', 'del', 'dlt', 'uptime', 'alive', 'crop', 'url', 'toaudio', 'tts'
    ],
    owner: [
        'setprefix', 'autoreact', 'speed', 'gitclone', 'addnote', 'delnote',
        'getnote', 'getnotes', 'notes', 'reminder', 'remind', 'autotyping',
        'autorecording', 'alwaysonline', 'autoread', 'presence', 'antidelete',
        'antiviewonce', 'antibug', 'block', 'unblock', 'archive', 'unarchive',
        'clear', 'antipm', 'update', 'statusemoji', 'autovs', 'autors',
        'ss', 'device', 'spam', 'setcmd', 'delcmd', '🥷🏼', 'fw', 'mode',
        'owners', 'setsudo', 'setowner', 'delsudo', 'delowner', 'restart',
        'shutdown', 'diagnose', 'logs'
    ],
    ai: [
        'ai', 'groq', 'aizen', 'aizen_chat', 'jarvis', 'jarvis_chat',
        'debug', 'summon', 'read', 'imagine', 'say'
    ],
    group: [
        'welcome', 'goodbye', 'setwelcome', 'setgoodbye', 'gcalerts', 'gclog',
        'kickall', 'stopkickall', 'kick', 'join', 'exit', 'leave',
        'togcstatus', 'togcjid', 'getgpp', 'setgpp', 'poll', 'tag',
        'spamtag', 'tagall', 'mute', 'unmute', 'open', 'close', 'lock',
        'unlock', 'promote', 'demote', 'link', 'invite', 'gclink',
        'admins', 'jid', 'gcjid', 'active', 'inactive', 'msgs',
        'antilink', 'antigm', 'antispam', 'antigcstatus', 'antipromote',
        'antidemote', 'warn', 'silence', 'silence_ans', 'unsilence', 'delspam'
    ],
    download: [
        'fb', 'facebook', 'tt', 'tiktok', 'yt', 'youtube', 'ig', 'instagram',
        'x', 'xdl', 'spotify', 'pinterest', 'mediafire', 'gdrive', 'obf',
        'song', 'play', 'tgs', 'apk', 'web', 'lyrics', 'img', 'xvid', 'shazam'
    ]
};

// ─── HELPERS ──────────────────────────────────────────────────────

function getRandomBankai() {
    const entry = BANKAI_LIST[Math.floor(Math.random() * BANKAI_LIST.length)];
    const image = entry.images[Math.floor(Math.random() * entry.images.length)];
    return { ...entry, image };
}

// Simple in-memory cache for image buffers (to avoid re-downloading)
const imageCache = {};

async function getImageBuffer(url) {
    if (imageCache[url]) return imageCache[url];
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);
        imageCache[url] = buffer;
        return buffer;
    } catch (err) {
        console.error(`Failed to fetch image: ${url}`, err);
        return null;
    }
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

function getStats() {
    const prefix = config.prefix || '.';
    const mode = config.isPublic ? 'Public' : 'Private';
    const uptimeSeconds = global.botStartTime ? Math.floor((Date.now() - global.botStartTime) / 1000) : 0;
    const uptimeStr = formatUptime(uptimeSeconds);
    const totalCommands = Object.keys(commands).length;
    const ram = process.memoryUsage();
    const ramUsed = (ram.heapUsed / 1024 / 1024).toFixed(2);
    const host = process.env.HOSTNAME || 'unknown';

    return { prefix, mode, uptime: uptimeStr, totalCommands, ram: `${ramUsed} MiB`, host };
}

function getCategoryCommands(category) {
    const list = CATEGORIES[category] || [];
    return list.filter(cmd => commands[cmd] !== undefined);
}

// ─── COMMANDS ─────────────────────────────────────────────────────

module.exports = [
    // ─── .menu – Main Menu ──────────────────────────────────────
    {
        name: 'menu',
        isPrefixless: false,
        execute: async (sock, msg, args) => {
            const jid = msg.key.remoteJid;
            const sender = msg.key.participant || msg.key.remoteJid || '';
            const senderName = sender.split('@')[0];

            const bankaiEntry = getRandomBankai();
            const imageBuffer = await getImageBuffer(bankaiEntry.image);
            if (!imageBuffer) {
                return await sock.sendMessage(jid, { text: '❌ Failed to load menu image.' }, { quoted: msg });
            }

            const stats = getStats();
            const menuText =
                `════════════════ ══\n` +
                `        Ｂ Ａ Ｎ Ｋ Ａ Ｉ\n` +
                `        ${bankaiEntry.bankai}\n` +
                `════════════════ ══\n` +
                `       ⟬ 𝕃𝕀𝕄𝕀𝕋𝕃𝔼𝕊𝕊-𝕄𝕀ℕ𝕀 ⟭\n\n` +
                `☵ User     : @${senderName}\n` +
                `☵ Prefix   : ${stats.prefix}\n` +
                `☵ RAM      : ${stats.ram}\n` +
                `☵ Cmds     : ${stats.totalCommands}\n` +
                `☵ Host     : ${stats.host}\n` +
                `☵ Uptime   : ${stats.uptime}\n` +
                `☵ Mode     : ${stats.mode}\n\n` +
                `════════════════ ══\n` +
                `Select a category below:`;

            const buttons = [
                { buttonId: `menu_core`, buttonText: { displayText: '🛡️ Core' }, type: 1 },
                { buttonId: `menu_owner`, buttonText: { displayText: '👑 Owner' }, type: 1 },
                { buttonId: `menu_ai`, buttonText: { displayText: '🧠 AI' }, type: 1 },
                { buttonId: `menu_group`, buttonText: { displayText: '👥 Group' }, type: 1 },
                { buttonId: `menu_dl`, buttonText: { displayText: '📥 Download' }, type: 1 }
            ];

            await sock.sendMessage(jid, {
                image: imageBuffer,
                caption: menuText,
                mentions: [sender],
                buttons: buttons,
                headerType: 1
            }, { quoted: msg });
        }
    },

    // ─── Sub-menu handlers ──────────────────────────────────────
    {
        name: 'menu_core',
        isPrefixless: false,
        execute: async (sock, msg, args) => {
            await showCategoryMenu(sock, msg, 'core');
        }
    },
    {
        name: 'menu_owner',
        isPrefixless: false,
        execute: async (sock, msg, args) => {
            await showCategoryMenu(sock, msg, 'owner');
        }
    },
    {
        name: 'menu_ai',
        isPrefixless: false,
        execute: async (sock, msg, args) => {
            await showCategoryMenu(sock, msg, 'ai');
        }
    },
    {
        name: 'menu_group',
        isPrefixless: false,
        execute: async (sock, msg, args) => {
            await showCategoryMenu(sock, msg, 'group');
        }
    },
    {
        name: 'menu_dl',
        isPrefixless: false,
        execute: async (sock, msg, args) => {
            await showCategoryMenu(sock, msg, 'download');
        }
    },
    {
        name: 'menu_back',
        isPrefixless: false,
        execute: async (sock, msg, args) => {
            const menuCmd = module.exports.find(c => c.name === 'menu');
            if (menuCmd) await menuCmd.execute(sock, msg, args);
        }
    }
];

// ─── Helper to show category sub-menu ────────────────────────────
async function showCategoryMenu(sock, msg, category) {
    const jid = msg.key.remoteJid;
    const commandsList = getCategoryCommands(category);
    if (commandsList.length === 0) {
        return await sock.sendMessage(jid, { text: `❌ No commands found in this category.` }, { quoted: msg });
    }

    const stats = getStats();
    const prefix = stats.prefix;
    const categoryDisplay = category.charAt(0).toUpperCase() + category.slice(1);

    let commandText = commandsList.map(cmd => `• ${cmd}`).join('\n');

    const menuText =
        `════════════════ ══\n` +
        `${categoryDisplay.toUpperCase()} COMMANDS\n` +
        `════════════════ ══\n\n` +
        commandText;

    const buttons = [
        { buttonId: `menu_back`, buttonText: { displayText: '🔙 Back' }, type: 1 }
    ];

    await sock.sendMessage(jid, {
        text: menuText,
        buttons: buttons,
        headerType: 1
    }, { quoted: msg });
}