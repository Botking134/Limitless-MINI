// plugins/bankai.js – .bankai <query> with Groq abilities
const config = require('../config');
const axios = require('axios');

// ─── OBFUSCATED GROQ KEY ──────────────────────────────────────
const I = 'gsk_';
const love = 'Pq0ezrYKQNlr77fmp7b';
const lizzy = 'iWGdyb3FYjuaKTR64bSbIHjLeRxGeL9yw';
const GROQ_API_KEY = I + love + lizzy;
const GROQ_BASE_URL = "https://api.groq.com/openai/v1/chat/completions";

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

// ─── LEVENSHTEIN DISTANCE (fuzzy matching) ──────────────────────
function levenshtein(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b[i-1] === a[j-1]) {
                matrix[i][j] = matrix[i-1][j-1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i-1][j-1] + 1,
                    matrix[i][j-1] + 1,
                    matrix[i-1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

function getClosestMatch(query, entries) {
    const q = query.toLowerCase().trim();
    let best = null;
    let bestScore = Infinity;
    for (const entry of entries) {
        const name = entry.name.toLowerCase();
        const bankai = entry.bankai.toLowerCase();
        const distName = levenshtein(q, name);
        const distBankai = levenshtein(q, bankai);
        const dist = Math.min(distName, distBankai);
        if (dist < bestScore) {
            bestScore = dist;
            best = entry;
        }
    }
    // If the best distance is > 3, consider it not found
    if (bestScore > 3) return null;
    return best;
}

function searchBankai(query) {
    const q = query.toLowerCase().trim();
    // Exact substring matches (like before)
    const results = BANKAI_LIST.filter(entry =>
        entry.name.toLowerCase().includes(q) ||
        entry.bankai.toLowerCase().includes(q)
    );
    if (results.length > 0) return results;
    // Fallback: fuzzy match
    const closest = getClosestMatch(q, BANKAI_LIST);
    return closest ? [closest] : [];
}

// ─── GROQ ABILITY FETCH ──────────────────────────────────────────
async function getBankaiAbility(name, bankai) {
    // Special cases
    if (bankai.includes('404 error')) {
        return 'This Bankai is beyond description.';
    }
    if (bankai.toLowerCase().includes('unknown') || bankai.toLowerCase().includes('unnamed')) {
        return 'No known abilities are recorded for this Bankai.';
    }

    try {
        const prompt =
            `Describe the abilities of the Bankai "${bankai}" from the anime Bleach, used by the character "${name}". Provide a detailed explanation of its powers, effects, and any notable techniques. Keep it informative but concise (around 100-150 words). Do not include any introductory or concluding remarks, just the description.`;

        const response = await fetch(GROQ_BASE_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: "You are a knowledgeable Bleach lore expert. Provide detailed but concise descriptions." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 300
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        let text = data.choices?.[0]?.message?.content || '';
        if (text.length > 800) text = text.slice(0, 797) + '...';
        return text.trim() || 'Abilities are unknown.';
    } catch (err) {
        console.error('Groq error:', err);
        return 'Could not retrieve abilities.';
    }
}

// ─── COMMAND ──────────────────────────────────────────────────────

module.exports = [
    {
        name: 'bankai',
        isPrefixless: false,
        execute: async (sock, msg, args, { isMaster }) => {
            const jid = msg.key.remoteJid;

            // Only masters can use .bankai (in line with new architecture)
            if (!isMaster) {
                return await sock.sendMessage(jid, { text: "❌ Only the master can use this command." }, { quoted: msg });
            }

            // If no args, pick a random bankai
            if (!args || args.length === 0) {
                const randomEntry = BANKAI_LIST[Math.floor(Math.random() * BANKAI_LIST.length)];
                await showBankai(sock, msg, randomEntry);
                return;
            }

            const query = args.join(' ');
            const results = searchBankai(query);

            if (results.length === 0) {
                return await sock.sendMessage(jid, {
                    text: `❌ No Bankai found for '${query}'. Try a different name.`
                }, { quoted: msg });
            }

            if (results.length === 1) {
                await showBankai(sock, msg, results[0]);
                return;
            }

            // Multiple matches – send numbered list
            let listText = `🔍 *Multiple Bankai found for '${query}':*\n\n`;
            results.forEach((entry, index) => {
                listText += `${index + 1}. *${entry.bankai}* – ${entry.name}\n`;
            });
            listText += `\n📌 Reply with the number to select.`;

            const promptMsg = await sock.sendMessage(jid, { text: listText }, { quoted: msg });

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
        await sock.sendMessage(msg.key.remoteJid, {
            text: `❌ Invalid selection. Please choose a number between 1 and ${session.results.length}.`
        }, { quoted: msg });
        return true;
    }

    const selected = session.results[num - 1];
    delete global.bankaiSessions[quotedId];
    await showBankai(sock, msg, selected);
    return true;
}

async function showBankai(sock, msg, entry) {
    const jid = msg.key.remoteJid;

    const imageUrl = entry.images[Math.floor(Math.random() * entry.images.length)];
    const imageBuffer = await getImageBuffer(imageUrl);
    if (!imageBuffer) {
        return await sock.sendMessage(jid, { text: "❌ Failed to load Bankai image." }, { quoted: msg });
    }

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