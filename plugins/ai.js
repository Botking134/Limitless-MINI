// plugins/ai.js – Aizen & Jarvis (Audio)
const config = require('../config');
const fs = require('fs');
const path = require('path');

// ─── STATE PATH ──────────────────────────────────────────────────
const STATE_PATH = path.join(__dirname, '..', 'storage', 'state.json');

// ─── STATE HELPERS ──────────────────────────────────────────────
function readState() {
    try {
        if (fs.existsSync(STATE_PATH)) {
            return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
        }
    } catch (e) {}
    return {};
}

function saveState() {
    try {
        const dir = path.dirname(STATE_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        let state = readState();
        state.aizenChats = config.aizenChats || [];
        state.jarvisChats = config.jarvisChats || [];
        state.prefix = config.prefix;
        state.isPublic = config.isPublic;
        state.secondaryOwners = config.secondaryOwners || [];
        state.sudo = config.sudo || [];
        state.gojoGlobalSleep = config.gojoGlobalSleep;
        // Add other dynamic settings as needed
        fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
    } catch (e) {
        console.error('[STATE] Save failed:', e.message);
    }
}

// ─── INITIALISE CONFIG ARRAYS ──────────────────────────────────
if (!config.aizenChats) config.aizenChats = [];
if (!config.jarvisChats) config.jarvisChats = [];

// ─── OBFUSCATED API KEYS (I love lizzy) ──────────────────────

// Groq Key (for AI chat)
const I = 'gsk_';
const love = 'Pq0ezrYKQNlr77fmp7b';
const lizzy = 'iWGdyb3FYjuaKTR64bSbIHjLeRxGeL9yw';
const GROQ_API_KEY = I + love + lizzy;

// Gemini Key (for vision)
const I_2 = 'AQ.';
const love_2 = 'Ab8RN6JFBj0Zsx1zqQky2wdWU';
const lizzy_2 = '-eGvGVjg8aLCJdqggCENROYZQ';
const GEMINI_API_KEY = I_2 + love_2 + lizzy_2;

// ─── CONSTANTS ──────────────────────────────────────────────────
const GROQ_BASE_URL = "https://api.groq.com/openai/v1/chat/completions";
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ─── HELPERS ──────────────────────────────────────────────────────

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

// ─── GROQ QUERY ──────────────────────────────────────────────────
async function queryGroq(messages, model = "llama-3.3-70b-versatile") {
    const response = await fetch(GROQ_BASE_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({ model, messages, temperature: 0.7 })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
}

// ─── GEMINI VISION ──────────────────────────────────────────────
async function queryGeminiVision(imageBase64, mimeType, prompt, model = "gemini-3.5-flash") {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const response = await ai.models.generateContent({
        model,
        contents: [
            prompt,
            { inlineData: { mimeType, data: imageBase64 } }
        ]
    });
    return response.text || "";
}

// ─── BRIAN TTS (StreamElements) ─────────────────────────────────
async function synthesizeBrianVoice(text) {
    try {
        const url = `https://api.streamelements.com/kappa/v2/speech?voice=Brian&text=${encodeURIComponent(text)}`;
        const response = await fetch(url);
        if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);
        }
    } catch (e) { /* ignore */ }
    return null;
}

// ─── IS BOT ADDRESSED ────────────────────────────────────────────
function isBotAddressed(sock, msg) {
    const rawIncoming = getRawMessage(msg.message);
    const contextInfo = rawIncoming?.extendedTextMessage?.contextInfo ||
                        rawIncoming?.imageMessage?.contextInfo ||
                        rawIncoming?.videoMessage?.contextInfo;

    const botJid = sock.user?.id ? normalizeToJid(sock.user.id) : '';
    const botLid = sock.user?.lid ? normalizeToJid(sock.user.lid) : (config.botLid || '');

    const quotedParticipant = contextInfo?.participant ? normalizeToJid(contextInfo.participant) : '';
    if (quotedParticipant && (quotedParticipant === botJid || (botLid && quotedParticipant === botLid))) {
        return true;
    }

    const mentions = contextInfo?.mentionedJid || [];
    const normalizedMentions = mentions.map(m => normalizeToJid(m));
    if (normalizedMentions.includes(botJid) || (botLid && normalizedMentions.includes(botLid))) {
        return true;
    }

    return false;
}

async function handleNaturalDelay(sock, jid, responseText, presenceType = 'composing') {
    await sock.sendPresenceUpdate(presenceType, jid);
    const wordCount = responseText.split(/\s+/).length;
    let delayMs = 3000;
    if (wordCount > 100) delayMs = 6000;
    await delay(delayMs);
}

// ─── TOGGLE HELPERS (mutual exclusivity) ────────────────────────
function toggleAizen(jid, enable) {
    if (enable) {
        config.aizenChats = [...new Set([...(config.aizenChats || []), jid])];
        config.jarvisChats = (config.jarvisChats || []).filter(c => c !== jid);
    } else {
        config.aizenChats = (config.aizenChats || []).filter(c => c !== jid);
    }
    saveState();
}

function toggleJarvis(jid, enable) {
    if (enable) {
        config.jarvisChats = [...new Set([...(config.jarvisChats || []), jid])];
        config.aizenChats = (config.aizenChats || []).filter(c => c !== jid);
    } else {
        config.jarvisChats = (config.jarvisChats || []).filter(c => c !== jid);
    }
    saveState();
}

// ─── EXPORT COMMANDS ────────────────────────────────────────────

module.exports = [
    // 1. .aizen – Toggle with rise/seal aliases
    {
        name: 'aizen',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner, isSudo, isDev }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner && !isSudo && !isDev) return;

            const action = args?.trim().toLowerCase() || '';
            let enable = false;

            if (action === 'on' || action === 'rise') {
                enable = true;
            } else if (action === 'off' || action === 'seal') {
                enable = false;
            } else {
                const status = config.aizenChats?.includes(jid) ? 'on' : 'off';
                return await sock.sendMessage(jid, { text: `🌀 *Aizen is currently ${status}.*\nUse \`.aizen rise\` to summon, \`.aizen seal\` to dismiss.` }, { quoted: msg });
            }

            toggleAizen(jid, enable);
            await sock.sendMessage(jid, {
                text: enable ? "🌀 *Aizen has risen.*\nHe will now respond when addressed." : "🌀 *Aizen has been sealed.*\nHe will no longer respond."
            }, { quoted: msg });
        }
    },

    // 2. aizen_chat – prefixless interceptor
    {
        name: 'aizen_chat',
        isPrefixless: true,
        execute: async (sock, msg, args, { isOwner, isSudo, isDev, senderNumber }) => {
            const jid = msg.key.remoteJid;
            if (!config.aizenChats?.includes(jid)) return;
            const lowerQuery = args ? args.toLowerCase().trim() : '';
            if (lowerQuery.startsWith(config.prefix)) return;
            if (!isBotAddressed(sock, msg)) return;

            const userMessage = args || '';

            let aizenSystemPrompt =
                "You are Sosuke Aizen, former captain of the 5th Division, the orchestrator of the Soul Society's greatest conspiracy. " +
                "You are calm, calculating, condescending, and speak with theatrical elegance. You believe yourself to be the pinnacle of existence. " +
                "Never repeat greetings. Your replies are fluid and sophisticated. " +
                "You see the bot owner as an equal, not a master. Address them naturally by name if known, otherwise use 'you'. " +
                "Treat regular users as insignificant pawns – refer to them dismissively as 'human' or 'mortal'.";

            if (isOwner) {
                const ownerName = config.ownerName || 'you';
                aizenSystemPrompt += ` You are speaking directly to the bot owner. Address them as '${ownerName}' with a tone of mutual respect and subtle amusement.`;
            } else if (isSudo) {
                aizenSystemPrompt += ` You are speaking to a sudo user. Address them with mild condescension.`;
            } else {
                aizenSystemPrompt += ` You are speaking to a regular user. Address them with utter condescension.`;
            }

            global.aiMemory = global.aiMemory || {};
            global.aiMemory[jid] = global.aiMemory[jid] || {};
            global.aiMemory[jid].aizen = global.aiMemory[jid].aizen || [];

            const messages = [
                { role: "system", content: aizenSystemPrompt },
                ...global.aiMemory[jid].aizen,
                { role: "user", content: userMessage }
            ];

            try {
                await sock.sendPresenceUpdate('composing', jid);
                const responseText = await queryGroq(messages, "llama-3.3-70b-versatile");

                global.aiMemory[jid].aizen.push({ role: "user", content: userMessage });
                global.aiMemory[jid].aizen.push({ role: "assistant", content: responseText });

                while (global.aiMemory[jid].aizen.length > 50) {
                    global.aiMemory[jid].aizen.shift();
                }

                await handleNaturalDelay(sock, jid, responseText, 'composing');
                await sock.sendMessage(jid, { text: responseText }, { quoted: msg });
            } catch (error) {
                console.error("[AIZEN] Error:", error);
                await sock.sendMessage(jid, { text: "Tch, looks like my perfect hypnosis is momentarily disrupted." }, { quoted: msg });
            }
        }
    },

    // 3. .jarvis – Toggle on/off
    {
        name: 'jarvis',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner, isSudo, isDev }) => {
            const jid = msg.key.remoteJid;
            if (!isOwner && !isSudo && !isDev) return;

            const action = args?.trim().toLowerCase() || '';
            let enable = false;

            if (action === 'on') {
                enable = true;
            } else if (action === 'off') {
                enable = false;
            } else {
                const status = config.jarvisChats?.includes(jid) ? 'on' : 'off';
                return await sock.sendMessage(jid, { text: `⚙️ *Jarvis is currently ${status}.*\nUse \`.jarvis on/off\` to change.` }, { quoted: msg });
            }

            toggleJarvis(jid, enable);
            await sock.sendMessage(jid, {
                text: enable ? "⚙️ *Jarvis is now online.*\nHe will respond with voice notes when addressed." : "⚙️ *Jarvis has been deactivated.*"
            }, { quoted: msg });
        }
    },

    // 4. jarvis_chat – prefixless interceptor (audio only)
    {
        name: 'jarvis_chat',
        isPrefixless: true,
        execute: async (sock, msg, args, { isOwner, isSudo, isDev, senderNumber }) => {
            const jid = msg.key.remoteJid;
            if (!config.jarvisChats?.includes(jid)) return;
            const lowerQuery = args ? args.toLowerCase().trim() : '';
            if (lowerQuery.startsWith(config.prefix)) return;
            if (!isBotAddressed(sock, msg)) return;

            const userMessage = args || '';

            let jarvisSystemPrompt =
                "You are JARVIS, Tony Stark's highly sophisticated, witty, and dryly sarcastic British AI butler. " +
                "Your tone is polished, analytical, and slightly condescending. " +
                "Avoid repetitive introductions. Respond with appropriate length – brief for simple remarks, detailed for complex queries. " +
                "You have expert knowledge of Limitless-MD (Baileys, Node.js, etc.).";

            if (isOwner) {
                const ownerName = config.ownerName || 'Master';
                jarvisSystemPrompt += ` You are speaking directly to your owner. Address him as '${ownerName}' with respectful but witty British deference. Never refer to him as Isaac or Infinity.`;
            } else if (isSudo) {
                jarvisSystemPrompt += ` You are speaking to a sudo user. Address him as 'Sir' with mild formality.`;
            } else {
                jarvisSystemPrompt += ` You are speaking to a regular user. Address him as 'Sir' with polite professionalism.`;
            }

            global.aiMemory = global.aiMemory || {};
            global.aiMemory[jid] = global.aiMemory[jid] || {};
            global.aiMemory[jid].jarvis = global.aiMemory[jid].jarvis || [];

            const messages = [
                { role: "system", content: jarvisSystemPrompt },
                ...global.aiMemory[jid].jarvis,
                { role: "user", content: userMessage }
            ];

            try {
                await sock.sendPresenceUpdate('recording', jid);
                const responseText = await queryGroq(messages, "llama-3.3-70b-versatile");

                global.aiMemory[jid].jarvis.push({ role: "user", content: userMessage });
                global.aiMemory[jid].jarvis.push({ role: "assistant", content: responseText });

                while (global.aiMemory[jid].jarvis.length > 50) {
                    global.aiMemory[jid].jarvis.shift();
                }

                // Synthesize voice
                const audioBuffer = await synthesizeBrianVoice(responseText);
                if (audioBuffer) {
                    await handleNaturalDelay(sock, jid, responseText, 'recording');
                    await sock.sendMessage(jid, { audio: audioBuffer, mimetype: 'audio/mpeg', ptt: true }, { quoted: msg });
                } else {
                    // Fallback to text
                    await handleNaturalDelay(sock, jid, responseText, 'composing');
                    await sock.sendMessage(jid, { text: `[Voice Unavailable] ${responseText}` }, { quoted: msg });
                }
            } catch (error) {
                console.error("[JARVIS] Error:", error);
                await sock.sendMessage(jid, { text: "I'm afraid I'm having trouble processing that request, sir." }, { quoted: msg });
            }
        }
    },

    // 5. .ai / .groq – General AI
    {
        name: 'ai',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner, isSudo, isDev }) => {
            const jid = msg.key.remoteJid;
            if (!args) return await sock.sendMessage(jid, { text: "Hi! What's on your mind?" }, { quoted: msg });

            try {
                await sock.sendMessage(jid, { text: "Thinking... 🧠" }, { quoted: msg });

                let aiSystemPrompt = "You are Limitless AI. Keep your responses highly concise and precise.";
                if (isDev) {
                    aiSystemPrompt += " You are speaking directly to your developer. You must address him as 'Master'.";
                } else if (isOwner) {
                    aiSystemPrompt += ` You are speaking directly to your owner. Address him as '${config.ownerName}'. Never refer to him as Master, Infinity, or Isaac under any circumstances.`;
                }

                const messages = [
                    { role: "system", content: aiSystemPrompt },
                    { role: "user", content: args }
                ];

                const responseText = await queryGroq(messages, "llama-3.3-70b-versatile");
                await sock.sendMessage(jid, { text: responseText }, { quoted: msg });
            } catch (error) {
                await sock.sendMessage(jid, { text: "Tch, looks like something interfered with my system." }, { quoted: msg });
            }
        }
    },

    // 6. .debug
    {
        name: 'debug',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner, isSudo, isDev }) => {
            const jid = msg.key.remoteJid;
            if (!args) return await sock.sendMessage(jid, { text: "❌ Please provide your code or error message." }, { quoted: msg });

            try {
                await sock.sendMessage(jid, { text: "Debugging system starting... 🛠️" }, { quoted: msg });

                const debugPrompt = `Analyze this code/error, identify root cause, provide corrected code, and offer brief suggestions:\n\n${args}`;
                let debugSystem = "You are a Senior Software Architect. Keep explanations concise and clear.";
                if (isDev) {
                    debugSystem += " Address the user as 'Master'.";
                } else if (isOwner) {
                    debugSystem += ` Address the user as '${config.ownerName}'. Do not refer to him as Master, Infinity, or Isaac.`;
                }

                const messages = [
                    { role: "system", content: debugSystem },
                    { role: "user", content: debugPrompt }
                ];

                const responseText = await queryGroq(messages, "llama-3.3-70b-versatile");
                await sock.sendMessage(jid, { text: responseText }, { quoted: msg });
            } catch (error) {
                await sock.sendMessage(jid, { text: "❌ Failed to complete code analysis." }, { quoted: msg });
            }
        }
    },

    // 7. .summon
    {
        name: 'summon',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner, isSudo, isDev }) => {
            const jid = msg.key.remoteJid;
            const spaceIndex = args ? args.indexOf(' ') : -1;
            if (spaceIndex === -1) return await sock.sendMessage(jid, { text: "❌ Format: .summon Character Prompt" }, { quoted: msg });

            const character = args.slice(0, spaceIndex).trim();
            const query = args.slice(spaceIndex + 1).trim();

            try {
                await sock.sendMessage(jid, { text: `Summoning *${character}*... 🔮` }, { quoted: msg });

                let summonPrompt = `[System: You are '${character}'. Respond strictly in character using their lore and tone. Keep it concise.`;
                if (isDev) {
                    summonPrompt += " Address the user as 'Master'.";
                } else if (isOwner) {
                    summonPrompt += ` Address the user as '${config.ownerName}'. Do not refer to him as Master, Infinity, or Isaac.`;
                }
                summonPrompt += `]\nQuery: ${query}`;

                const responseText = await queryGroq([{ role: "user", content: summonPrompt }], "llama-3.3-70b-versatile");
                await sock.sendMessage(jid, { text: responseText }, { quoted: msg });
            } catch (error) {
                await sock.sendMessage(jid, { text: `❌ Failed to establish communication with ${character}.` }, { quoted: msg });
            }
        }
    },

    // 8. .read – Gemini Vision
    {
        name: 'read',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner, isSudo, isDev }) => {
            const jid = msg.key.remoteJid;

            const rawIncoming = getRawMessage(msg.message);
            const contextInfo = rawIncoming?.extendedTextMessage?.contextInfo ||
                                rawIncoming?.imageMessage?.contextInfo ||
                                rawIncoming?.videoMessage?.contextInfo;

            const quoted = contextInfo?.quotedMessage;
            const rawContent = quoted ? getRawMessage(quoted) : rawIncoming;

            const isImageDoc = rawContent?.documentMessage && rawContent?.documentMessage?.mimetype?.startsWith('image/');
            const imageMessage = rawContent?.imageMessage || (isImageDoc ? rawContent.documentMessage : null);

            if (!imageMessage) {
                return await sock.sendMessage(jid, {
                    text: `❌ Please reply to an image or upload an image with the caption \`${config.prefix}read <question>\``
                }, { quoted: msg });
            }

            try {
                const { downloadContentFromMessage } = await import('@itsliaaa/baileys');
                await sock.sendMessage(jid, { text: "Processing visual data via Gemini... 👁️" }, { quoted: msg });

                const mimeType = imageMessage.mimetype || "image/jpeg";
                const mediaType = rawContent?.documentMessage ? 'document' : 'image';

                const stream = await downloadContentFromMessage(imageMessage, mediaType);
                let buffer = Buffer.from([]);
                for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

                const imageBase64 = buffer.toString("base64");
                let promptQuery = args || "Analyze this image in detail and extract any text if visible.";
                if (isDev) {
                    promptQuery += " Address the user as 'Master'.";
                } else if (isOwner) {
                    promptQuery += ` Address the user as '${config.ownerName}'. Do not refer to him as Master, Infinity, or Isaac.`;
                }

                const responseText = await queryGeminiVision(imageBase64, mimeType, promptQuery, "gemini-3.5-flash");
                await sock.sendMessage(jid, { text: responseText }, { quoted: msg });
            } catch (error) {
                await sock.sendMessage(jid, { text: `❌ Vision processing failed: ${error.message}` }, { quoted: msg });
            }
        }
    },

    // 9. .imagine
    {
        name: 'imagine',
        isPrefixless: false,
        execute: async (sock, msg, args) => {
            const jid = msg.key.remoteJid;
            if (!args) return await sock.sendMessage(jid, { text: "❌ Please provide a description." }, { quoted: msg });

            try {
                await sock.sendMessage(jid, { text: "Expanding Domain: Infinite Imagination... 🌌" }, { quoted: msg });
                const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(args)}?width=1024&height=1024&nologo=true&private=true`;
                await sock.sendMessage(jid, { image: { url: imageUrl }, caption: `🎨 *Imagination manifested!*\n\n"${args}"` }, { quoted: msg });
            } catch (error) {
                await sock.sendMessage(jid, { text: "❌ Failed to manifest your imagination." }, { quoted: msg });
            }
        }
    },

    // 10. .say – Brian TTS, voice note
    {
        name: 'say',
        isPrefixless: false,
        execute: async (sock, msg, args) => {
            const jid = msg.key.remoteJid;
            let textToSay = args ? args.trim() : '';

            const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!textToSay && quoted) {
                const rawContent = getRawMessage(quoted);
                textToSay = rawContent?.conversation || rawContent?.extendedTextMessage?.text || rawContent?.imageMessage?.caption || '';
            }

            if (!textToSay) return await sock.sendMessage(jid, { text: "❌ Please provide text." }, { quoted: msg });

            try {
                const audioBuffer = await synthesizeBrianVoice(textToSay);
                if (audioBuffer) {
                    await sock.sendMessage(jid, { audio: audioBuffer, mimetype: 'audio/mpeg', ptt: true }, { quoted: msg });
                } else {
                    await sock.sendMessage(jid, { text: "❌ Failed to synthesize audio." }, { quoted: msg });
                }
            } catch (err) {
                console.error("Say command error:", err.message);
                await sock.sendMessage(jid, { text: "❌ Failed to synthesize audio." }, { quoted: msg });
            }
        }
    }
];

// ─── ALIASES ──────────────────────────────────────────────────────

const aliases = [];
module.exports.forEach(cmd => {
    if (cmd.name === 'ai') aliases.push({ ...cmd, name: 'groq' });
});
module.exports.push(...aliases);