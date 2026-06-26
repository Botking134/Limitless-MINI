// plugins/bankai.js – .bankai <query> with Gemini abilities
const config = require('../config');
const axios = require('axios');
const { GoogleGenAI } = require('@google/genai');

// ─── BANKAI LIST (same as menu.js) ─────────────────────────────
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

// ─── OBFUSCATED GEMINI KEY (I love lizzy) ──────────────────────
const I = 'AQ.';
const love = 'Ab8RN6JFBj0Zsx1zqQky2wdWU';
const lizzy = '-eGvGVjg8aLCJdqggCENROYZQ';
const GEMINI_API_KEY = I + love + lizzy;

// ─── SESSIONS FOR MULTIPLE MATCHES ──────────────────────────────
global.bankaiSessions = global.bankaiSessions || {};

// ─── HELPERS ──────────────────────────────────────────────────────

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

function searchBankai(query) {
    const q = query.toLowerCase().trim();
    const results = [];
    for (const entry of BANKAI_LIST) {
        if (entry.name.toLowerCase().includes(q) || entry.bankai.toLowerCase().includes(q)) {
            results.push(entry);
        }
    }
    return results;
}

// ─── GEMINI ABILITY FETCH ──────────────────────────────────────
async function getBankaiAbility(name, bankai) {
    // Special case: Aizen's "404 error"
    if (bankai.includes('404 error')) {
        return 'This Bankai is beyond description.';
    }
    // For unknown or unnamed, return a generic message
    if (bankai.toLowerCase().includes('unknown') || bankai.toLowerCase().includes('unnamed')) {
        return 'No known abilities are recorded for this Bankai.';
    }

    try {
        const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
        const prompt = `Describe the abilities of the Bankai "${bankai}" from Bleach, used by "${name}". Keep the description concise, maximum 3 sentences. Do not include any introductory text, just the description.`;
        const response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: prompt
        });
        let text = response.text || '';
        if (text.length > 400) text = text.slice(0, 397) + '...';
        return text.trim() || 'Abilities are unknown.';
    } catch (err) {
        console.error('Gemini error:', err);
        return 'Could not retrieve abilities.';
    }
}

// ─── COMMAND ──────────────────────────────────────────────────────

module.exports = [
    {
        name: 'bankai',
        isPrefixless: false, // prefixed
        execute: async (sock, msg, args, { isOwner, isSudo, isPrimaryOwner, sender, senderNumber }) => {
            const jid = msg.key.remoteJid;

            // Permission: private mode only owner/sudo
            if (!config.isPublic && !isOwner && !isSudo) {
                return await sock.sendMessage(jid, { text: "❌ You are not authorized to use this command in private mode." }, { quoted: msg });
            }

            // If no args, show usage
            if (!args || args.length === 0) {
                return await sock.sendMessage(jid, {
                    text: `❌ Please provide a Bankai name or character name.\nExample: \`${config.prefix}bankai tensa\``
                }, { quoted: msg });
            }

            const query = args.join(' ');
            const results = searchBankai(query);

            if (results.length === 0) {
                return await sock.sendMessage(jid, {
                    text: `❌ No Bankai found for '${query}'. Try a different name.`
                }, { quoted: msg });
            }

            if (results.length === 1) {
                // Single match – display directly
                await showBankai(sock, msg, results[0]);
                return;
            }

            // Multiple matches – send a numbered list
            let listText = `🔍 *Multiple Bankai found for '${query}':*\n\n`;
            results.forEach((entry, index) => {
                listText += `${index + 1}. *${entry.bankai}* – ${entry.name}\n`;
            });
            listText += `\n📌 Reply with the number to select.`;

            const promptMsg = await sock.sendMessage(jid, { text: listText }, { quoted: msg });

            // Store session for this prompt
            global.bankaiSessions[promptMsg.key.id] = {
                results: results,
                chatId: jid,
                timestamp: Date.now()
            };
        }
    }
];

// ─── HANDLER FOR SELECTION REPLIES ──────────────────────────────
async function handleBankaiSelection(sock, msg) {
    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo;
    if (!quotedMsg || !quotedMsg.quotedMessage) return false;

    const quotedId = quotedMsg.stanzaId;
    const session = global.bankaiSessions[quotedId];
    if (!session) return false;

    // Check if the reply is a number
    const replyText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    const num = parseInt(replyText.trim());
    if (isNaN(num) || num < 1 || num > session.results.length) {
        // Invalid number – ignore or notify
        await sock.sendMessage(msg.key.remoteJid, {
            text: `❌ Invalid selection. Please choose a number between 1 and ${session.results.length}.`
        }, { quoted: msg });
        return true; // handled
    }

    const selected = session.results[num - 1];
    delete global.bankaiSessions[quotedId];
    await showBankai(sock, msg, selected);
    return true;
}

async function showBankai(sock, msg, entry) {
    const jid = msg.key.remoteJid;

    // Pick a random image from the entry
    const imageUrl = entry.images[Math.floor(Math.random() * entry.images.length)];
    const imageBuffer = await getImageBuffer(imageUrl);
    if (!imageBuffer) {
        return await sock.sendMessage(jid, { text: "❌ Failed to load Bankai image." }, { quoted: msg });
    }

    // Fetch abilities from Gemini
    const ability = await getBankaiAbility(entry.name, entry.bankai);

    const caption =
        `═══════════ ═════ ══\n` +
        `        Ｂ Ａ Ｎ Ｋ Ａ Ｉ\n` +
        `        ${entry.bankai}\n` +
        `═══════════ ═════ ══\n` +
        `⚔️ ${entry.name}\n\n` +
        `${ability}`;

    await sock.sendMessage(jid, {
        image: imageBuffer,
        caption: caption
    }, { quoted: msg });
}

// ─── EXPOSE THE SELECTION HANDLER ──────────────────────────────
module.exports.handleBankaiSelection = handleBankaiSelection;