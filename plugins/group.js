// plugins/group.js – Complete Group Management
const config = require('../config');
const fs = require('fs');
const path = require('path');
const https = require('https');
const axios = require('axios');

// SSL-ignoring agent to bypass hosting certificate validation errors
const sslAgent = new https.Agent({ rejectUnauthorized: false });

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
        const keys = [
            'welcome', 'goodbye', 'gcalerts', 'gclogActive', 'conversationLogs',
            'antilink', 'antigm', 'antispam', 'antigcstatus', 'antipromote', 'antidemote',
            'warns', 'warnThreshold', 'dailyActivity', 'totalMessages',
            'secondaryOwners', 'sudo', 'primaryOwner', 'prefix', 'isPublic',
            'autoReact', 'antidelete', 'antiviewonce', 'antibug', 'antipm',
            'statusEmoji', 'autovs', 'autors', 'stickerCommands', 'presence',
            'aizenChats', 'jarvisChats'
        ];
        for (const key of keys) {
            if (config[key] !== undefined) state[key] = config[key];
        }
        fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
    } catch (e) {
        console.error('[STATE] Save failed:', e.message);
    }
}

// ─── INITIALISE CONFIG ──────────────────────────────────────────
if (!config.welcome) config.welcome = {};
if (!config.goodbye) config.goodbye = {};
if (!config.gcalerts) config.gcalerts = { promote: {}, demote: {}, welcome: {}, goodbye: {} };
if (!config.gclogActive) config.gclogActive = {};
if (!config.conversationLogs) config.conversationLogs = {};
if (!config.antilink) config.antilink = {};
if (!config.antigm) config.antigm = {};
if (!config.antispam) config.antispam = {};
if (!config.antigcstatus) config.antigcstatus = 'off';
if (!config.antipromote) config.antipromote = {};
if (!config.antidemote) config.antidemote = {};
if (!config.warns) config.warns = {};
if (!config.warnThreshold) config.warnThreshold = 5;
if (!config.dailyActivity) config.dailyActivity = {};
if (!config.totalMessages) config.totalMessages = {};

// ─── GLOBAL INTERVALS ───────────────────────────────────────────
global.gclogIntervals = global.gclogIntervals || {};
global.kickallActive = global.kickallActive || {};
global.tkickTimers = global.tkickTimers || {};
global.groupTimers = global.groupTimers || {};
global.silencedUsers = global.silencedUsers || {};

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

function parseTargetUser(msg, args) {
    const rawMsg = getRawMessage(msg.message);
    const contextInfo = rawMsg?.contextInfo ||
                        rawMsg?.extendedTextMessage?.contextInfo ||
                        rawMsg?.imageMessage?.contextInfo ||
                        rawMsg?.videoMessage?.contextInfo ||
                        rawMsg?.stickerMessage?.contextInfo ||
                        rawMsg?.audioMessage?.contextInfo ||
                        rawMsg?.documentMessage?.contextInfo;
    const mentions = contextInfo?.mentionedJid || [];
    if (mentions.length > 0) {
        return normalizeToJid(mentions[0]);
    }
    if (contextInfo?.participant) {
        return normalizeToJid(contextInfo.participant);
    }
    
    const argsStr = Array.isArray(args) ? args.join(' ') : (args || '');
    if (argsStr) {
        const cleanDigits = argsStr.replace(/[^0-9]/g, '');
        if (cleanDigits.length >= 7) {
            return `${cleanDigits}@s.whatsapp.net`;
        }
    }
    return '';
}

function parseDuration(str) {
    const match = str.match(/^(\d+)([smh])$/i);
    if (!match) return null;
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    if (unit === 's') return value * 1000;
    if (unit === 'm') return value * 60 * 1000;
    if (unit === 'h') return value * 60 * 60 * 1000;
    return null;
}

function isDeveloper(jid) {
    const devs = config.devLids || [];
    return devs.includes(jid);
}

function isOwnerTarget(target) {
    const owners = config.owner || [];
    const secondary = config.secondaryOwners || [];
    const allOwners = [...owners, ...secondary];
    return allOwners.includes(target);
}

async function verifyPermissions(sock, msg, jid, isOwner, isDev = false, isSudo = false, commandName = '') {
    const senderJid = normalizeToJid(msg.key.participant || msg.key.remoteJid || '');
    if (isDev) return true;
    const isAuthorized = isOwner || isSudo;
    if (!isAuthorized) return false;

    const exemptCommands = ['tag', 'tagall', 'admins', 'link', 'invite', 'gclink', 'jid', 'gcjid'];
    if (exemptCommands.includes(commandName.toLowerCase())) {
        return true;
    }

    const groupMetadata = await sock.groupMetadata(jid);
    const participants = groupMetadata.participants;
    const botJid = sock.user?.id ? normalizeToJid(sock.user.id) : '';
    const botLid = sock.user?.lid ? normalizeToJid(sock.user.lid) : (config.botLid || '');
    const botParticipant = participants.find(p => {
        const pId = normalizeToJid(p.id);
        const pLid = p.lid ? normalizeToJid(p.lid) : '';
        return (botJid && (pId === botJid || pLid === botJid)) ||
               (botLid && (pId === botLid || pLid === botLid));
    });
    const isBotAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';
    if (!isBotAdmin) {
        await sock.sendMessage(jid, { text: "❌ I must be an administrator in this group first!" }, { quoted: msg });
        return false;
    }

    const sender = participants.find(p => {
        const pId = normalizeToJid(p.id);
        const pLid = p.lid ? normalizeToJid(p.lid) : '';
        return pId === senderJid || (pLid && pLid === senderJid);
    });
    const isSenderAdmin = sender?.admin === 'admin' || sender?.admin === 'superadmin';
    if (!isSenderAdmin) {
        await sock.sendMessage(jid, { text: "❌ You must be an administrator in this group to run this command!" }, { quoted: msg });
        return false;
    }
    return true;
}

// ─── OBFUSCATED GEMINI KEY (I love lizzy) ──────────────────────
const I = 'AQ.';
const love = 'Ab8RN6JFBj0Zsx1zqQky2wdWU';
const lizzy = '-eGvGVjg8aLCJdqggCENROYZQ';
const GEMINI_API_KEY = I + love + lizzy;

// ─── GEMINI SUMMARY (for gclog) ─────────────────────────────────
async function queryGeminiText(prompt, logString) {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: `${prompt}\n\nHere are the chat logs:\n${logString}`
        });
        return response.text || "Could not generate summary.";
    } catch (sdkErr) {
        const response = await ai.interactions.create({
            model: "gemini-3.5-flash",
            input: `${prompt}\n\nHere are the chat logs:\n${logString}`
        });
        return response.text || response.output || "Could not generate summary.";
    }
}

async function triggerSummary(sock, jid) {
    const logs = config.conversationLogs?.[jid] || [];
    if (logs.length === 0) return;
    const logString = logs.map(l => `[${new Date(l.time).toLocaleTimeString()}] ${l.sender}: ${l.text}`).join('\n');
    const prompt =
        "You are Sosuke Aizen, former captain of the 5th Division. You are calm, calculating, and theatrical. " +
        "Summarize this group conversation in a number of bullet points that intelligently capture the key topics and flow of the chat. " +
        "Do not simply match the number of messages; instead, condense the conversation into a meaningful summary with as many points as needed to cover the main ideas. " +
        "Write in Aizen's condescending, elegant, and slightly mocking tone. Do not include any intro or outro – just the bullet points. " +
        "Format: Each bullet point on a new line, starting with • or -.";
    try {
        const responseText = await queryGeminiText(prompt, logString);
        await sock.sendMessage(jid, { text: `🌀 *Aizen's Analysis...*\n\n${responseText.trim()}` });
        if (config.conversationLogs) config.conversationLogs[jid] = [];
        saveState();
    } catch (err) {
        console.error("Auto summary failed:", err);
    }
}

// ─── EXPORT COMMANDS ────────────────────────────────────────────

module.exports = [
    // ─── WELCOME & GOODBYE ──────────────────────────────────────
    {
        name: 'welcome',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner, isSudo, isDev }) => {
            const jid = msg.key.remoteJid;
            if (!jid.endsWith('@g.us')) return;
            const isAuthorized = await verifyPermissions(sock, msg, jid, isOwner, isDev, isSudo, 'welcome');
            if (!isAuthorized) return;

            const action = (args && args[0]) ? args[0].toLowerCase().trim() : '';
            if (action === 'on') {
                config.welcome[jid] = config.welcome[jid] || { active: true, text: 'Welcome @user!', images: [] };
                config.welcome[jid].active = true;
                config.gcalerts.welcome[jid] = 'on';
                saveState();
                return await sock.sendMessage(jid, { text: "✅ Welcome messages enabled." });
            } else if (action === 'off') {
                if (config.welcome[jid]) config.welcome[jid].active = false;
                config.gcalerts.welcome[jid] = 'off';
                saveState();
                return await sock.sendMessage(jid, { text: "❌ Welcome messages disabled." });
            } else {
                const status = config.welcome[jid]?.active ? 'on' : 'off';
                const msgText = config.welcome[jid]?.text || 'Welcome @user!';
                await sock.sendMessage(jid, { text: `✅ Welcome status: ${status}\nMessage: "${msgText}"\nImages: ${(config.welcome[jid]?.images || []).length}` });
            }
        }
    },
    {
        name: 'goodbye',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner, isSudo, isDev }) => {
            const jid = msg.key.remoteJid;
            if (!jid.endsWith('@g.us')) return;
            const isAuthorized = await verifyPermissions(sock, msg, jid, isOwner, isDev, isSudo, 'goodbye');
            if (!isAuthorized) return;

            const action = (args && args[0]) ? args[0].toLowerCase().trim() : '';
            if (action === 'on') {
                config.goodbye[jid] = config.goodbye[jid] || { active: true, text: 'Goodbye @user!', images: [] };
                config.goodbye[jid].active = true;
                config.gcalerts.goodbye[jid] = 'on';
                saveState();
                return await sock.sendMessage(jid, { text: "✅ Goodbye messages enabled." });
            } else if (action === 'off') {
                if (config.goodbye[jid]) config.goodbye[jid].active = false;
                config.gcalerts.goodbye[jid] = 'off';
                saveState();
                return await sock.sendMessage(jid, { text: "❌ Goodbye messages disabled." });
            } else {
                const status = config.goodbye[jid]?.active ? 'on' : 'off';
                const msgText = config.goodbye[jid]?.text || 'Goodbye @user!';
                await sock.sendMessage(jid, { text: `✅ Goodbye status: ${status}\nMessage: "${msgText}"\nImages: ${(config.goodbye[jid]?.images || []).length}` });
            }
        }
    },
    {
        name: 'setwelcome',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner, isSudo, isDev }) => {
            const jid = msg.key.remoteJid;
            if (!jid.endsWith('@g.us')) return;
            const isAuthorized = await verifyPermissions(sock, msg, jid, isOwner, isDev, isSudo, 'setwelcome');
            if (!isAuthorized) return;

            const fullText = Array.isArray(args) ? args.join(' ').trim() : (args || '').trim();
            if (!fullText) return await sock.sendMessage(jid, { text: "❌ Provide a message. Example: .setwelcome Hello @user! --image https://example.com/img.jpg" });

            let text = fullText;
            let images = [];
            const imageIndex = fullText.indexOf('--image');
            if (imageIndex !== -1) {
                const before = fullText.substring(0, imageIndex).trim();
                const after = fullText.substring(imageIndex + 7).trim();
                text = before || 'Welcome @user!';
                if (after) {
                    images = after.split(/\s+/).filter(url => url.startsWith('http'));
                }
            }
            config.welcome[jid] = { active: true, text, images };
            config.gcalerts.welcome[jid] = 'on';
            saveState();
            await sock.sendMessage(jid, { text: `✅ Welcome message set.\nText: "${text}"\nImages: ${images.length}` });
        }
    },
    {
        name: 'setgoodbye',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner, isSudo, isDev }) => {
            const jid = msg.key.remoteJid;
            if (!jid.endsWith('@g.us')) return;
            const isAuthorized = await verifyPermissions(sock, msg, jid, isOwner, isDev, isSudo, 'setgoodbye');
            if (!isAuthorized) return;

            const fullText = Array.isArray(args) ? args.join(' ').trim() : (args || '').trim();
            if (!fullText) return await sock.sendMessage(jid, { text: "❌ Provide a message. Example: .setgoodbye Farewell @user! --image https://example.com/img.jpg" });

            let text = fullText;
            let images = [];
            const imageIndex = fullText.indexOf('--image');
            if (imageIndex !== -1) {
                const before = fullText.substring(0, imageIndex).trim();
                const after = fullText.substring(imageIndex + 7).trim();
                text = before || 'Goodbye @user!';
                if (after) {
                    images = after.split(/\s+/).filter(url => url.startsWith('http'));
                }
            }
            config.goodbye[jid] = { active: true, text, images };
            config.gcalerts.goodbye[jid] = 'on';
            saveState();
            await sock.sendMessage(jid, { text: `✅ Goodbye message set.\nText: "${text}"\nImages: ${images.length}` });
        }
    },

    // ─── GCALERTS ────────────────────────────────────────────────
    {
        name: 'gcalerts',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner, isSudo, isDev }) => {
            const jid = msg.key.remoteJid;
            if (!jid.endsWith('@g.us')) return;
            const isAuthorized = await verifyPermissions(sock, msg, jid, isOwner, isDev, isSudo, 'gcalerts');
            if (!isAuthorized) return;

            if (!config.gcalerts) config.gcalerts = { promote: {}, demote: {}, welcome: {}, goodbye: {} };

            const fullText = Array.isArray(args) ? args.join(' ').trim() : (args || '').trim();
            if (!fullText) {
                const prom = config.gcalerts.promote?.[jid] || 'off';
                const dem = config.gcalerts.demote?.[jid] || 'off';
                const wel = config.gcalerts.welcome?.[jid] || 'off';
                const gb = config.gcalerts.goodbye?.[jid] || 'off';
                const text =
                    `🔔 *Alert Settings*\n` +
                    `Promote: ${prom}\nDemote: ${dem}\nWelcome: ${wel}\nGoodbye: ${gb}\n\n` +
                    `Use .gcalerts <promote/demote/welcome/goodbye> <on/off>`;
                const buttons = [
                    { buttonId: `${config.prefix}gcalerts promote on`, buttonText: { displayText: 'Promote ON' }, type: 1 },
                    { buttonId: `${config.prefix}gcalerts promote off`, buttonText: { displayText: 'Promote OFF' }, type: 1 },
                    { buttonId: `${config.prefix}gcalerts demote on`, buttonText: { displayText: 'Demote ON' }, type: 1 },
                    { buttonId: `${config.prefix}gcalerts demote off`, buttonText: { displayText: 'Demote OFF' }, type: 1 },
                ];
                try {
                    await sock.sendMessage(jid, { text, buttons, headerType: 1 }, { quoted: msg });
                } catch (e) {
                    await sock.sendMessage(jid, { text });
                }
                return;
            }

            const parts = fullText.split(' ');
            const sub = parts[0].toLowerCase();
            const toggle = parts[1]?.toLowerCase();
            if (!['promote', 'demote', 'welcome', 'goodbye'].includes(sub) || !['on', 'off'].includes(toggle)) {
                return await sock.sendMessage(jid, { text: "❌ Usage: .gcalerts <promote/demote/welcome/goodbye> <on/off>" });
            }
            config.gcalerts[sub][jid] = toggle;
            if (sub === 'welcome') {
                if (!config.welcome[jid]) config.welcome[jid] = { active: false, text: 'Welcome @user!', images: [] };
                config.welcome[jid].active = (toggle === 'on');
            }
            if (sub === 'goodbye') {
                if (!config.goodbye[jid]) config.goodbye[jid] = { active: false, text: 'Goodbye @user!', images: [] };
                config.goodbye[jid].active = (toggle === 'on');
            }
            saveState();
            await sock.sendMessage(jid, { text: `✅ ${sub} alert set to ${toggle.toUpperCase()}` });
        }
    },

    // ─── GCLOG ──────────────────────────────────────────────────
    {
        name: 'gclog',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner, isSudo, isDev }) => {
            const jid = msg.key.remoteJid;
            if (!jid.endsWith('@g.us')) return;
            const isAuthorized = await verifyPermissions(sock, msg, jid, isOwner, isDev, isSudo, 'gclog');
            if (!isAuthorized) return;

            const action = (args && args[0]) ? args[0].toLowerCase().trim() : '';
            if (action === 'on') {
                config.gclogActive[jid] = true;
                if (global.gclogIntervals[jid]) clearInterval(global.gclogIntervals[jid]);
                global.gclogIntervals[jid] = setInterval(async () => {
                    await triggerSummary(sock, jid);
                }, 3 * 60 * 60 * 1000);
                saveState();
                await sock.sendMessage(jid, { text: "📊 gclog enabled. Summaries will be generated every 3 hours." });
            } else if (action === 'off') {
                if (global.gclogIntervals[jid]) {
                    clearInterval(global.gclogIntervals[jid]);
                    delete global.gclogIntervals[jid];
                }
                config.gclogActive[jid] = false;
                if (config.conversationLogs) delete config.conversationLogs[jid];
                saveState();
                await sock.sendMessage(jid, { text: "💤 gclog disabled. Logs cleared." });
            } else if (action === 'check') {
                const logs = config.conversationLogs?.[jid] || [];
                if (logs.length === 0) return await sock.sendMessage(jid, { text: "📊 No logs recorded yet." });
                const logString = logs.slice(-20).map(l => `[${new Date(l.time).toLocaleTimeString()}] ${l.sender}: ${l.text}`).join('\n');
                await sock.sendMessage(jid, { text: `📊 *Recent logs (last 20):*\n${logString}` });
            } else {
                const status = config.gclogActive[jid] ? 'on' : 'off';
                const count = config.conversationLogs?.[jid]?.length || 0;
                await sock.sendMessage(jid, { text: `📊 gclog status: ${status}\nLogs recorded: ${count}` });
            }
        }
    },

    // ─── KICKALL ─────────────────────────────────────────────────
    {
        name: 'kickall',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner, isSudo, isDev }) => {
            const jid = msg.key.remoteJid;
            if (!jid.endsWith('@g.us')) return;
            const isAuthorized = await verifyPermissions(sock, msg, jid, isOwner, isDev, isSudo, 'kickall');
            if (!isAuthorized) return;

            const duration = (args && args[0]) ? parseDuration(args[0]) : 20000;
            if (!duration) return await sock.sendMessage(jid, { text: "❌ Invalid duration (e.g., 10s, 2m, 1h)." });

            const groupMetadata = await sock.groupMetadata(jid);
            const participants = groupMetadata.participants;
            const botJid = normalizeToJid(sock.user.id);
            const targets = participants.filter(p => {
                const pId = normalizeToJid(p.id);
                return pId !== botJid && !isOwnerTarget(pId) && !isDeveloper(pId) && p.admin !== 'superadmin' && p.admin !== 'admin';
            }).map(p => p.id);

            if (targets.length === 0) return await sock.sendMessage(jid, { text: "❌ No non‑admin members to kick." });

            global.kickallActive[jid] = true;
            const secs = Math.floor(duration / 1000);
            const text = `⏳ Kicking all non‑admin members in ${secs} seconds. Use .stopkickall to abort.`;
            const button = { text, buttons: [{ buttonId: `${config.prefix}stopkickall`, buttonText: { displayText: 'Stop 🛑' }, type: 1 }], headerType: 1 };
            try {
                await sock.sendMessage(jid, button, { quoted: msg });
            } catch (e) {
                await sock.sendMessage(jid, { text });
            }

            await delay(duration);
            if (!global.kickallActive[jid]) return;

            let kicked = 0;
            for (const target of targets) {
                if (!global.kickallActive[jid]) break;
                try {
                    await sock.groupParticipantsUpdate(jid, [target], 'remove');
                    kicked++;
                    await delay(1000);
                } catch (e) { /* ignore */ }
            }
            delete global.kickallActive[jid];
            await sock.sendMessage(jid, { text: `✅ Kicked ${kicked} members.` });
        }
    },
    {
        name: 'stopkickall',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner, isSudo, isDev }) => {
            const jid = msg.key.remoteJid;
            if (global.kickallActive[jid]) {
                global.kickallActive[jid] = false;
                await sock.sendMessage(jid, { text: "🛑 Kickall aborted." });
            } else {
                await sock.sendMessage(jid, { text: "❌ No active kickall operation." });
            }
        }
    },

    // ─── KICK ────────────────────────────────────────────────────
    {
        name: 'kick',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner, isSudo, isDev }) => {
            const jid = msg.key.remoteJid;
            if (!jid.endsWith('@g.us')) return;
            const isAuthorized = await verifyPermissions(sock, msg, jid, isOwner, isDev, isSudo, 'kick');
            if (!isAuthorized) return;

            let target = parseTargetUser(msg, args);
            if (!target) return await sock.sendMessage(jid, { text: "❌ Mention or reply to a user." });
            if (isDeveloper(target) || isOwnerTarget(target)) {
                return await sock.sendMessage(jid, { text: "❌ Cannot kick owner or developer." });
            }

            let timer = 0;
            if (args) {
                const parts = Array.isArray(args) ? args : args.split(' ');
                for (const part of parts) {
                    const dur = parseDuration(part);
                    if (dur) timer = dur;
                }
            }
            if (timer > 0) {
                const key = `${jid}_${target}`;
                if (global.tkickTimers[key]) clearTimeout(global.tkickTimers[key].timeoutId);
                const timeoutId = setTimeout(async () => {
                    try {
                        await sock.groupParticipantsUpdate(jid, [target], 'remove');
                        await sock.sendMessage(jid, { text: `⏳ Timed kick executed for @${target.split('@')[0]}.`, mentions: [target] });
                    } catch (e) { /* ignore */ }
                    delete global.tkickTimers[key];
                }, timer);
                global.tkickTimers[key] = { timeoutId, targetJid: target, endTime: Date.now() + timer };
                await sock.sendMessage(jid, { text: `⏳ Will kick @${target.split('@')[0]} in ${Math.floor(timer/1000)}s.`, mentions: [target] });
                return;
            }

            await sock.groupParticipantsUpdate(jid, [target], 'remove');
            await sock.sendMessage(jid, { text: `👋 Kicked @${target.split('@')[0]}.`, mentions: [target] });
        }
    },

    // ─── JOIN ────────────────────────────────────────────────────
    {
        name: 'join',
        isPrefixless: false,
        execute: async (sock, msg, args) => {
            const jid = msg.key.remoteJid;
            const argsStr = Array.isArray(args) ? args.join(' ').trim() : (args || '').trim();
            if (!argsStr) return await sock.sendMessage(jid, { text: "❌ Provide an invite link." });
            const match = argsStr.match(/chat.whatsapp.com\/([a-zA-Z0-9]{15,25})/);
            if (!match) return await sock.sendMessage(jid, { text: "❌ Invalid invite link." });
            try {
                const code = match[1];
                const joinedJid = await sock.groupAcceptInvite(code);
                await sock.sendMessage(jid, { text: `✅ Joined group: ${joinedJid}` });
            } catch (e) {
                await sock.sendMessage(jid, { text: `❌ Failed: ${e.message}` });
            }
        }
    },

    // ─── EXIT ────────────────────────────────────────────────────
    {
        name: 'exit',
        isPrefixless: false,
        execute: async (sock, msg, args) => {
            const jid = msg.key.remoteJid;
            const target = (args && args[0]) ? args[0].trim() : jid;
            if (!target.endsWith('@g.us')) return await sock.sendMessage(jid, { text: "❌ Not a group." });
            try {
                await sock.sendMessage(target, { text: "👋 Leaving group." });
                await sock.groupLeave(target);
                if (target !== jid) await sock.sendMessage(jid, { text: `✅ Left ${target}` });
            } catch (e) {
                await sock.sendMessage(jid, { text: `❌ Failed: ${e.message}` });
            }
        }
    },

    // ─── TOGCSTATUS ──────────────────────────────────────────────
    {
        name: 'togcstatus',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner, isSudo, isDev }) => {
            const jid = msg.key.remoteJid;
            if (!jid.endsWith('@g.us')) return;
            const isAuthorized = await verifyPermissions(sock, msg, jid, isOwner, isDev, isSudo, 'togcstatus');
            if (!isAuthorized) return;

            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const rawContent = quoted ? getRawMessage(quoted) : null;
            try {
                const { downloadContentFromMessage, prepareWAMessageMedia, generateWAMessageFromContent, proto } = await import('@itsliaaa/baileys');
                let messagePayload = {};
                let mediaType = null;
                let buffer = null;
                let caption = '';

                if (rawContent?.imageMessage || rawContent?.videoMessage || rawContent?.audioMessage) {
                    mediaType = rawContent.imageMessage ? 'image' : (rawContent.videoMessage ? 'video' : 'audio');
                    const targetMsg = rawContent[mediaType + 'Message'];
                    const stream = await downloadContentFromMessage(targetMsg, mediaType);
                    let buf = Buffer.from([]);
                    for await (const chunk of stream) buf = Buffer.concat([buf, chunk]);
                    buffer = buf;
                    caption = targetMsg.caption || '';
                }

                if (buffer) {
                    const mediaOptions = mediaType === 'image' ? { image: buffer, caption } :
                                       (mediaType === 'video' ? { video: buffer, caption } :
                                       { audio: buffer, mimetype: targetMsg.mimetype, ptt: targetMsg.ptt || false, seconds: targetMsg.seconds });
                    const prepared = await prepareWAMessageMedia(mediaOptions, { upload: sock.waUploadToServer });
                    const msgObj = {};
                    if (mediaType === 'image') msgObj.imageMessage = prepared.imageMessage;
                    else if (mediaType === 'video') msgObj.videoMessage = prepared.videoMessage;
                    else msgObj.audioMessage = prepared.audioMessage;
                    messagePayload = { groupStatusMessageV2: { message: msgObj } };
                } else {
                    const text = (Array.isArray(args) ? args.join(' ').trim() : args) || quoted?.conversation || quoted?.extendedTextMessage?.text || '';
                    if (!text) return await sock.sendMessage(jid, { text: "❌ Provide text or reply to media." });
                    const randomHex = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
                    const bgColor = 0xff000000 + parseInt(randomHex, 16);
                    messagePayload = { groupStatusMessageV2: { message: { extendedTextMessage: { text, backgroundArgb: bgColor, font: 2 } } } };
                }

                const statusMsg = generateWAMessageFromContent(jid, proto.Message.fromObject(messagePayload), { userJid: sock.user.id });
                await sock.relayMessage(jid, statusMsg.message, { messageId: statusMsg.key.id });
                await sock.sendMessage(jid, { react: { text: '✓', key: msg.key } });
            } catch (e) {
                await sock.sendMessage(jid, { text: `❌ Failed: ${e.message}` });
            }
        }
    },

    // ─── TOGCJID ─────────────────────────────────────────────────
    {
        name: 'togcjid',
        isPrefixless: false,
        execute: async (sock, msg, args) => {
            const jid = msg.key.remoteJid;
            const argsStr = Array.isArray(args) ? args.join(' ').trim() : (args || '').trim();
            const targetJid = argsStr ? argsStr.split(' ')[0] : '';
            if (!targetJid || !targetJid.endsWith('@g.us')) return await sock.sendMessage(jid, { text: "❌ Provide a valid group JID." });
            const remaining = argsStr.replace(targetJid, '').trim();
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const rawContent = quoted ? getRawMessage(quoted) : null;
            try {
                const { downloadContentFromMessage, prepareWAMessageMedia, generateWAMessageFromContent, proto } = await import('@itsliaaa/baileys');
                let messagePayload = {};
                let mediaType = null;
                let buffer = null;
                let caption = '';

                if (rawContent?.imageMessage || rawContent?.videoMessage || rawContent?.audioMessage) {
                    mediaType = rawContent.imageMessage ? 'image' : (rawContent.videoMessage ? 'video' : 'audio');
                    const targetMsg = rawContent[mediaType + 'Message'];
                    const stream = await downloadContentFromMessage(targetMsg, mediaType);
                    let buf = Buffer.from([]);
                    for await (const chunk of stream) buf = Buffer.concat([buf, chunk]);
                    buffer = buf;
                    caption = targetMsg.caption || '';
                }

                if (buffer) {
                    const mediaOptions = mediaType === 'image' ? { image: buffer, caption } :
                                       (mediaType === 'video' ? { video: buffer, caption } :
                                       { audio: buffer, mimetype: targetMsg.mimetype, ptt: targetMsg.ptt || false, seconds: targetMsg.seconds });
                    const prepared = await prepareWAMessageMedia(mediaOptions, { upload: sock.waUploadToServer });
                    const msgObj = {};
                    if (mediaType === 'image') msgObj.imageMessage = prepared.imageMessage;
                    else if (mediaType === 'video') msgObj.videoMessage = prepared.videoMessage;
                    else msgObj.audioMessage = prepared.audioMessage;
                    messagePayload = { groupStatusMessageV2: { message: msgObj } };
                } else {
                    const text = remaining || quoted?.conversation || quoted?.extendedTextMessage?.text || '';
                    if (!text) return await sock.sendMessage(jid, { text: "❌ Provide text or reply to media." });
                    const randomHex = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
                    const bgColor = 0xff000000 + parseInt(randomHex, 16);
                    messagePayload = { groupStatusMessageV2: { message: { extendedTextMessage: { text, backgroundArgb: bgColor, font: 2 } } } };
                }

                const statusMsg = generateWAMessageFromContent(targetJid, proto.Message.fromObject(messagePayload), { userJid: sock.user.id });
                await sock.relayMessage(targetJid, statusMsg.message, { messageId: statusMsg.key.id });
                await sock.sendMessage(jid, { react: { text: '✓', key: msg.key } });
            } catch (e) {
                await sock.sendMessage(jid, { text: `❌ Failed: ${e.message}` });
            }
        }
    },

    // ─── GETGPP ──────────────────────────────────────────────────
    {
        name: 'getgpp',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner, isSudo, isDev }) => {
            const jid = msg.key.remoteJid;
            if (!jid.endsWith('@g.us')) return;
            const isAuthorized = await verifyPermissions(sock, msg, jid, isOwner, isDev, isSudo, 'getgpp');
            if (!isAuthorized) return;
            try {
                const url = await sock.profilePictureUrl(jid, 'image');
                await sock.sendMessage(jid, { image: { url }, caption: "🖼️ Group Profile Picture" });
            } catch {
                await sock.sendMessage(jid, { text: "❌ No group profile picture found." });
            }
        }
    },

    // ─── SETGPP ──────────────────────────────────────────────────
    {
        name: 'setgpp',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner, isSudo, isDev }) => {
            const jid = msg.key.remoteJid;
            if (!jid.endsWith('@g.us')) return;
            const isAuthorized = await verifyPermissions(sock, msg, jid, isOwner, isDev, isSudo, 'setgpp');
            if (!isAuthorized) return;

            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quoted || !quoted.imageMessage) return await sock.sendMessage(jid, { text: "❌ Reply to an image." });
            try {
                const { downloadContentFromMessage } = await import('@itsliaaa/baileys');
                const stream = await downloadContentFromMessage(quoted.imageMessage, 'image');
                let buffer = Buffer.from([]);
                for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                await sock.updateProfilePicture(jid, buffer);
                await sock.sendMessage(jid, { text: "✅ Group profile picture updated." });
            } catch (e) {
                await sock.sendMessage(jid, { text: `❌ Failed: ${e.message}` });
            }
        }
    },

    // ─── POLL ────────────────────────────────────────────────────
    {
        name: 'poll',
        isPrefixless: false,
        execute: async (sock, msg, args) => {
            const jid = msg.key.remoteJid;
            const argsStr = Array.isArray(args) ? args.join(' ').trim() : (args || '').trim();
            const match = argsStr ? argsStr.match(/^(.+?)\s*\((.+?)\)$/) : null;
            if (!match) return await sock.sendMessage(jid, { text: "❌ Format: Question? (Option1/Option2)" });
            const question = match[1].trim();
            const options = match[2].split('/').map(o => o.trim()).filter(o => o);
            if (options.length < 2) return await sock.sendMessage(jid, { text: "❌ Minimum 2 options." });
            try {
                await sock.sendMessage(jid, { poll: { name: question, values: options, selectableCount: 1 } });
            } catch (e) {
                await sock.sendMessage(jid, { text: `❌ Failed: ${e.message}` });
            }
        }
    },

    // ─── TAG ─────────────────────────────────────────────────────
    {
        name: 'tag',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner, isSudo, isDev }) => {
            const jid = msg.key.remoteJid;
            if (!jid.endsWith('@g.us')) return;
            const isAuthorized = await verifyPermissions(sock, msg, jid, isOwner, isDev, isSudo, 'tag');
            if (!isAuthorized) return;

            const groupMetadata = await sock.groupMetadata(jid);
            const participants = groupMetadata.participants.map(p => p.id);
            const text = (Array.isArray(args) ? args.join(' ').trim() : args) || '👥';
            await sock.sendMessage(jid, { text, mentions: participants });
            try { await sock.sendMessage(jid, { delete: msg.key }); } catch (e) {}
        }
    },

    // ─── SPAMTAG ─────────────────────────────────────────────────
    {
        name: 'spamtag',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner, isSudo, isDev }) => {
            const jid = msg.key.remoteJid;
            if (!jid.endsWith('@g.us')) return;
            const isAuthorized = await verifyPermissions(sock, msg, jid, isOwner, isDev, isSudo, 'spamtag');
            if (!isAuthorized) return;

            const argsStr = Array.isArray(args) ? args.join(' ').trim() : (args || '').trim();
            const parts = argsStr.split(' ');
            let count = parseInt(parts[0]) || 3;
            if (count < 1 || count > 30) count = 3;
            const text = parts.slice(1).join(' ') || '📢';
            const groupMetadata = await sock.groupMetadata(jid);
            const participants = groupMetadata.participants.map(p => p.id);
            for (let i = 0; i < count; i++) {
                await sock.sendMessage(jid, { text, mentions: participants });
                await delay(1000);
            }
        }
    },

    // ─── TAGALL ──────────────────────────────────────────────────
    {
        name: 'tagall',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner, isSudo, isDev }) => {
            const jid = msg.key.remoteJid;
            if (!jid.endsWith('@g.us')) return;
            const isAuthorized = await verifyPermissions(sock, msg, jid, isOwner, isDev, isSudo, 'tagall');
            if (!isAuthorized) return;

            const groupMetadata = await sock.groupMetadata(jid);
            const participants = groupMetadata.participants.map(p => p.id);
            const text = (Array.isArray(args) ? args.join(' ').trim() : args) || '📢 Attention everyone!';
            await sock.sendMessage(jid, { text, mentions: participants });
        }
    },

    // ─── MUTE ────────────────────────────────────────────────────
    {
        name: 'mute',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner, isSudo, isDev }) => {
            const jid = msg.key.remoteJid;
            if (!jid.endsWith('@g.us')) return;
            const isAuthorized = await verifyPermissions(sock, msg, jid, isOwner, isDev, isSudo, 'mute');
            if (!isAuthorized) return;

            const argsStr = Array.isArray(args) ? args.join(' ').trim() : (args || '').trim();
            if (!argsStr) {
                const buttons = [
                    { buttonId: `mute close`, buttonText: { displayText: 'Mute 🔒' }, type: 1 },
                    { buttonId: `mute open`, buttonText: { displayText: 'Unmute 🔓' }, type: 1 }
                ];
                await sock.sendMessage(jid, { text: "🔒 *Group Mute Settings*", buttons, headerType: 1 }, { quoted: msg });
                return;
            }
            const parts = argsStr.split(' ');
            const action = parts[0].toLowerCase();
            const timer = parts[1] ? parseDuration(parts[1]) : null;

            if (['open', 'unmute', 'unlock'].includes(action)) {
                await sock.groupSettingUpdate(jid, 'not_announcement');
                if (timer) {
                    if (global.groupTimers[jid]) clearTimeout(global.groupTimers[jid]);
                    global.groupTimers[jid] = setTimeout(async () => {
                        await sock.groupSettingUpdate(jid, 'announcement');
                        await sock.sendMessage(jid, { text: "🔒 Group muted automatically (timer expired)." });
                        delete global.groupTimers[jid];
                    }, timer);
                    await sock.sendMessage(jid, { text: `🔓 Group unmuted for ${parts[1]}.` });
                } else {
                    await sock.sendMessage(jid, { text: "🔓 Group unmuted." });
                }
            } else if (['close', 'mute', 'lock'].includes(action)) {
                await sock.groupSettingUpdate(jid, 'announcement');
                if (timer) {
                    if (global.groupTimers[jid]) clearTimeout(global.groupTimers[jid]);
                    global.groupTimers[jid] = setTimeout(async () => {
                        await sock.groupSettingUpdate(jid, 'not_announcement');
                        await sock.sendMessage(jid, { text: "🔓 Group unmuted automatically (timer expired)." });
                        delete global.groupTimers[jid];
                    }, timer);
                    await sock.sendMessage(jid, { text: `🔒 Group muted for ${parts[1]}.` });
                } else {
                    await sock.sendMessage(jid, { text: "🔒 Group muted." });
                }
            }
        }
    },

    // ─── PROMOTE ─────────────────────────────────────────────────
    {
        name: 'promote',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner, isSudo, isDev }) => {
            const jid = msg.key.remoteJid;
            if (!jid.endsWith('@g.us')) return;
            const isAuthorized = await verifyPermissions(sock, msg, jid, isOwner, isDev, isSudo, 'promote');
            if (!isAuthorized) return;

            const target = parseTargetUser(msg, args);
            if (!target) return await sock.sendMessage(jid, { text: "❌ Mention or reply to a user." });
            await sock.groupParticipantsUpdate(jid, [target], 'promote');
            await sock.sendMessage(jid, { text: `👑 Promoted @${target.split('@')[0]}.`, mentions: [target] });
        }
    },

    // ─── DEMOTE ──────────────────────────────────────────────────
    {
        name: 'demote',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner, isSudo, isDev }) => {
            const jid = msg.key.remoteJid;
            if (!jid.endsWith('@g.us')) return;
            const isAuthorized = await verifyPermissions(sock, msg, jid, isOwner, isDev, isSudo, 'demote');
            if (!isAuthorized) return;

            const target = parseTargetUser(msg, args);
            if (!target) return await sock.sendMessage(jid, { text: "❌ Mention or reply to a user." });
            if (isDeveloper(target) || isOwnerTarget(target)) return await sock.sendMessage(jid, { text: "❌ Cannot demote owner/developer." });
            await sock.groupParticipantsUpdate(jid, [target], 'demote');
            await sock.sendMessage(jid, { text: `👋 Demoted @${target.split('@')[0]}.`, mentions: [target] });
        }
    },

    // ─── LINK ────────────────────────────────────────────────────
    {
        name: 'link',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner, isSudo, isDev }) => {
            const jid = msg.key.remoteJid;
            if (!jid.endsWith('@g.us')) return;
            const isAuthorized = await verifyPermissions(sock, msg, jid, isOwner, isDev, isSudo, 'link');
            if (!isAuthorized) return;
            try {
                const code = await sock.groupInviteCode(jid);
                await sock.sendMessage(jid, { text: `🔗 https://chat.whatsapp.com/${code}` });
            } catch (e) {
                await sock.sendMessage(jid, { text: `❌ Failed: ${e.message}` });
            }
        }
    },

    // ─── ADMINS ──────────────────────────────────────────────────
    {
        name: 'admins',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner, isSudo, isDev }) => {
            const jid = msg.key.remoteJid;
            if (!jid.endsWith('@g.us')) return;
            const isAuthorized = await verifyPermissions(sock, msg, jid, isOwner, isDev, isSudo, 'admins');
            if (!isAuthorized) return;

            const groupMetadata = await sock.groupMetadata(jid);
            const admins = groupMetadata.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin').map(p => p.id);
            const list = admins.map(j => `@${j.split('@')[0]}`).join(' ');
            await sock.sendMessage(jid, { text: `👑 *Admins:*\n${list}`, mentions: admins });
        }
    },

    // ─── JID ─────────────────────────────────────────────────────
    {
        name: 'jid',
        isPrefixless: false,
        execute: async (sock, msg, args) => {
            const jid = msg.key.remoteJid;
            await sock.sendMessage(jid, { text: jid });
        }
    },

    // ─── ACTIVE ──────────────────────────────────────────────────
    {
        name: 'active',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner, isSudo, isDev }) => {
            const jid = msg.key.remoteJid;
            if (!jid.endsWith('@g.us')) return;
            const isAuthorized = await verifyPermissions(sock, msg, jid, isOwner, isDev, isSudo, 'active');
            if (!isAuthorized) return;

            const groupMetadata = await sock.groupMetadata(jid);
            const participants = groupMetadata.participants.map(p => p.id);
            const today = new Date().toDateString();
            const active = [];
            const inactive = [];
            for (const p of participants) {
                const key = `${jid}_${normalizeToJid(p)}`;
                const data = config.dailyActivity?.[key];
                if (data && data.date === today && data.count > 0) active.push(p);
                else inactive.push(p);
            }
            if (active.length === 0) return await sock.sendMessage(jid, { text: "📊 No active members today." });
            await sock.sendMessage(jid, {
                text: `📊 *Active members today:*\n${active.map(j => `@${j.split('@')[0]}`).join(' ')}\n\nInactive: ${inactive.length}`,
                mentions: active
            });
        }
    },

    // ─── INACTIVE ────────────────────────────────────────────────
    {
        name: 'inactive',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner, isSudo, isDev }) => {
            const jid = msg.key.remoteJid;
            if (!jid.endsWith('@g.us')) return;
            const isAuthorized = await verifyPermissions(sock, msg, jid, isOwner, isDev, isSudo, 'inactive');
            if (!isAuthorized) return;

            const groupMetadata = await sock.groupMetadata(jid);
            const participants = groupMetadata.participants.map(p => p.id);
            const today = new Date().toDateString();
            const inactive = [];
            for (const p of participants) {
                const key = `${jid}_${normalizeToJid(p)}`;
                const data = config.dailyActivity?.[key];
                if (!data || data.date !== today || data.count === 0) inactive.push(p);
            }
            if (inactive.length === 0) return await sock.sendMessage(jid, { text: "📊 Everyone has been active today!" });
            await sock.sendMessage(jid, {
                text: `📊 *Inactive members today:*\n${inactive.map(j => `@${j.split('@')[0]}`).join(' ')}`,
                mentions: inactive
            });
        }
    },

    // ─── MSGS ────────────────────────────────────────────────────
    {
        name: 'msgs',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner, isSudo, isDev }) => {
            const jid = msg.key.remoteJid;
            if (!jid.endsWith('@g.us')) return;
            const isAuthorized = await verifyPermissions(sock, msg, jid, isOwner, isDev, isSudo, 'msgs');
            if (!isAuthorized) return;

            const groupMetadata = await sock.groupMetadata(jid);
            const participants = groupMetadata.participants.map(p => p.id);
            let counts = [];
            for (const p of participants) {
                const key = `${jid}_${normalizeToJid(p)}`;
                const count = config.totalMessages?.[key] || 0;
                counts.push({ jid: p, count });
            }
            counts.sort((a, b) => b.count - a.count);
            let text = '📊 *Message counts:*\n';
            for (const entry of counts) {
                text += `• @${entry.jid.split('@')[0]} : ${entry.count}\n`;
            }
            await sock.sendMessage(jid, { text, mentions: counts.map(e => e.jid) });
        }
    },

    // ─── ANTILINK ────────────────────────────────────────────────
    {
        name: 'antilink',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner, isSudo, isDev }) => {
            const jid = msg.key.remoteJid;
            if (!jid.endsWith('@g.us')) return;
            const isAuthorized = await verifyPermissions(sock, msg, jid, isOwner, isDev, isSudo, 'antilink');
            if (!isAuthorized) return;

            const actions = ['off', 'delete', 'warn', 'kick'];
            const action = (args && args[0]) ? args[0].toLowerCase().trim() : '';
            if (!action) {
                const current = config.antilink[jid] || 'off';
                const buttons = actions.map(a => ({
                    buttonId: `${config.prefix}antilink ${a}`,
                    buttonText: { displayText: a.toUpperCase() },
                    type: 1
                }));
                await sock.sendMessage(jid, { text: `🔗 Antilink: ${current}`, buttons, headerType: 1 }, { quoted: msg });
                return;
            }
            if (!actions.includes(action)) return await sock.sendMessage(jid, { text: "❌ Use off/delete/warn/kick" });
            config.antilink[jid] = action;
            saveState();
            await sock.sendMessage(jid, { text: `✅ Antilink set to: ${action}` });
        }
    },

    // ─── ANTIGM ──────────────────────────────────────────────────
    {
        name: 'antigm',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner, isSudo, isDev }) => {
            const jid = msg.key.remoteJid;
            if (!jid.endsWith('@g.us')) return;
            const isAuthorized = await verifyPermissions(sock, msg, jid, isOwner, isDev, isSudo, 'antigm');
            if (!isAuthorized) return;

            const actions = ['off', 'delete', 'warn', 'kick'];
            const action = (args && args[0]) ? args[0].toLowerCase().trim() : '';
            if (!action) {
                const current = config.antigm[jid] || 'off';
                const buttons = actions.map(a => ({
                    buttonId: `${config.prefix}antigm ${a}`,
                    buttonText: { displayText: a.toUpperCase() },
                    type: 1
                }));
                await sock.sendMessage(jid, { text: `🚫 Antigm: ${current}`, buttons, headerType: 1 }, { quoted: msg });
                return;
            }
            if (!actions.includes(action)) return await sock.sendMessage(jid, { text: "❌ Use off/delete/warn/kick" });
            config.antigm[jid] = action;
            saveState();
            await sock.sendMessage(jid, { text: `✅ Antigm set to: ${action}` });
        }
    },

    // ─── ANTISPAM ────────────────────────────────────────────────
    {
        name: 'antispam',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner, isSudo, isDev }) => {
            const jid = msg.key.remoteJid;
            if (!jid.endsWith('@g.us')) return;
            const isAuthorized = await verifyPermissions(sock, msg, jid, isOwner, isDev, isSudo, 'antispam');
            if (!isAuthorized) return;

            const argsStr = Array.isArray(args) ? args.join(' ').trim() : (args || '').trim();
            if (!argsStr) {
                const status = config.antispam[jid]?.status || 'off';
                const rate = config.antispam[jid]?.rate || { count: 1, seconds: 2 };
                await sock.sendMessage(jid, { text: `🛡️ Antispam: ${status}\nThreshold: ${rate.count}/${rate.seconds}s` });
                return;
            }
            const parts = argsStr.split(' ');
            const action = parts[0].toLowerCase();
            if (action === 'on') {
                if (!config.antispam[jid]) config.antispam[jid] = { status: 'on', rate: { count: 1, seconds: 2 } };
                else config.antispam[jid].status = 'on';
                saveState();
                await sock.sendMessage(jid, { text: "✅ Antispam enabled." });
            } else if (action === 'off') {
                if (config.antispam[jid]) config.antispam[jid].status = 'off';
                saveState();
                await sock.sendMessage(jid, { text: "💤 Antispam disabled." });
            } else if (action === 'trig') {
                const param = parts[1] || '';
                const match = param.match(/^(\d+)\/(\d+)s$/);
                if (!match) return await sock.sendMessage(jid, { text: "❌ Format: antispam trig 1/2s" });
                const count = parseInt(match[1]);
                const seconds = parseInt(match[2]);
                if (!config.antispam[jid]) config.antispam[jid] = { status: 'on', rate: {} };
                config.antispam[jid].rate = { count, seconds };
                config.antispam[jid].status = 'on';
                saveState();
                await sock.sendMessage(jid, { text: `✅ Spam threshold set: ${count}/${seconds}s` });
            } else {
                await sock.sendMessage(jid, { text: "❌ Usage: antispam on/off/trig 1/2s" });
            }
        }
    },

    // ─── ANTIGCSTATUS ────────────────────────────────────────────
    {
        name: 'antigcstatus',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner, isSudo, isDev }) => {
            const jid = msg.key.remoteJid;
            if (!jid.endsWith('@g.us')) return;
            const isAuthorized = await verifyPermissions(sock, msg, jid, isOwner, isDev, isSudo, 'antigcstatus');
            if (!isAuthorized) return;

            const actions = ['off', 'delete', 'warn', 'kick'];
            const action = (args && args[0]) ? args[0].toLowerCase().trim() : '';
            if (!action) {
                const current = config.antigcstatus || 'off';
                const buttons = actions.map(a => ({
                    buttonId: `${config.prefix}antigcstatus ${a}`,
                    buttonText: { displayText: a.toUpperCase() },
                    type: 1
                }));
                await sock.sendMessage(jid, { text: `🛡️ Antigcstatus: ${current}`, buttons, headerType: 1 }, { quoted: msg });
                return;
            }
            if (!actions.includes(action)) return await sock.sendMessage(jid, { text: "❌ Use off/delete/warn/kick" });
            config.antigcstatus = action;
            saveState();
            await sock.sendMessage(jid, { text: `✅ Antigcstatus set to: ${action}` });
        }
    },

    // ─── ANTIPROMOTE ─────────────────────────────────────────────
    {
        name: 'antipromote',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner, isSudo, isDev }) => {
            const jid = msg.key.remoteJid;
            if (!jid.endsWith('@g.us')) return;
            const isAuthorized = await verifyPermissions(sock, msg, jid, isOwner, isDev, isSudo, 'antipromote');
            if (!isAuthorized) return;

            const action = (args && args[0]) ? args[0].toLowerCase().trim() : '';
            if (action === 'on') {
                config.antipromote[jid] = 'on';
                saveState();
                await sock.sendMessage(jid, { text: "✅ Antipromote enabled." });
            } else if (action === 'off') {
                config.antipromote[jid] = 'off';
                saveState();
                await sock.sendMessage(jid, { text: "💤 Antipromote disabled." });
            } else {
                const status = config.antipromote[jid] || 'off';
                await sock.sendMessage(jid, { text: `🛡️ Antipromote: ${status}` });
            }
        }
    },

    // ─── ANTIDEMOTE ──────────────────────────────────────────────
    {
        name: 'antidemote',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner, isSudo, isDev }) => {
            const jid = msg.key.remoteJid;
            if (!jid.endsWith('@g.us')) return;
            const isAuthorized = await verifyPermissions(sock, msg, jid, isOwner, isDev, isSudo, 'antidemote');
            if (!isAuthorized) return;

            const action = (args && args[0]) ? args[0].toLowerCase().trim() : '';
            if (action === 'on') {
                config.antidemote[jid] = 'on';
                saveState();
                await sock.sendMessage(jid, { text: "✅ Antidemote enabled." });
            } else if (action === 'off') {
                config.antidemote[jid] = 'off';
                saveState();
                await sock.sendMessage(jid, { text: "💤 Antidemote disabled." });
            } else {
                const status = config.antidemote[jid] || 'off';
                await sock.sendMessage(jid, { text: `🛡️ Antidemote: ${status}` });
            }
        }
    },

    // ─── WARN ────────────────────────────────────────────────────
    {
        name: 'warn',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner, isSudo, isDev }) => {
            const jid = msg.key.remoteJid;
            if (!jid.endsWith('@g.us')) return;
            const isAuthorized = await verifyPermissions(sock, msg, jid, isOwner, isDev, isSudo, 'warn');
            if (!isAuthorized) return;

            const target = parseTargetUser(msg, args);
            if (!target) return await sock.sendMessage(jid, { text: "❌ Mention or reply to a user." });
            if (isDeveloper(target) || isOwnerTarget(target)) return await sock.sendMessage(jid, { text: "❌ Cannot warn owner/developer." });

            const key = `${jid}_${target.split('@')[0]}`;
            config.warns[key] = (config.warns[key] || 0) + 1;
            const count = config.warns[key];
            const threshold = config.warnThreshold || 5;
            if (count >= threshold) {
                await sock.groupParticipantsUpdate(jid, [target], 'remove');
                await sock.sendMessage(jid, { text: `👋 Kicked @${target.split('@')[0]} (${count}/${threshold} warnings).`, mentions: [target] });
                config.warns[key] = 0;
            } else {
                await sock.sendMessage(jid, { text: `⚠️ @${target.split('@')[0]} warned (${count}/${threshold}).`, mentions: [target] });
            }
            saveState();
        }
    },

    // ─── SILENCE ─────────────────────────────────────────────────
    {
        name: 'silence',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner, isSudo, isDev }) => {
            const jid = msg.key.remoteJid;
            if (!jid.endsWith('@g.us')) return;
            const isAuthorized = await verifyPermissions(sock, msg, jid, isOwner, isDev, isSudo, 'silence');
            if (!isAuthorized) return;

            const target = parseTargetUser(msg, args);
            if (!target) return await sock.sendMessage(jid, { text: "❌ Mention or reply to a user." });
            if (isDeveloper(target) || isOwnerTarget(target)) return await sock.sendMessage(jid, { text: "❌ Cannot silence owner/developer." });

            const argsStr = Array.isArray(args) ? args.join(' ').trim() : (args || '').trim();
            const rest = argsStr.replace(/@[^ ]+/g, '').trim();
            const parts = rest.split(' ');
            let type = 'all';
            let timer = '1h';
            if (parts[0] && ['-s', '-m'].includes(parts[0])) {
                type = parts[0] === '-s' ? 'sticker' : 'message';
                timer = parts[1] || '1h';
            } else if (parts[0]) {
                timer = parts[0];
            }
            const durationMs = parseDuration(timer) || 3600000;
            const key = `${jid}_${target}`;
            if (!global.silencedUsers[jid]) global.silencedUsers[jid] = {};
            global.silencedUsers[jid][target] = { type, endTime: Date.now() + durationMs };
            await sock.sendMessage(jid, { text: `🔇 Silenced @${target.split('@')[0]} (${type}) for ${timer}.`, mentions: [target] });
        }
    },

    // ─── SILENCE_ANS (button handler) ───────────────────────────
    {
        name: 'silence_ans',
        isPrefixless: false,
        execute: async (sock, msg, args) => {
            const parts = Array.isArray(args) ? args : (args ? args.split(' ') : []);
            const type = parts[0];
            const targetNum = parts[1];
            const timer = parts[2] || '1h';
            if (!type || !targetNum) return;
            const target = `${targetNum}@s.whatsapp.net`;
            const jid = msg.key.remoteJid;
            if (isDeveloper(target) || isOwnerTarget(target)) {
                await sock.sendMessage(jid, { text: "❌ Cannot silence owner/developer." });
                return;
            }
            const durationMs = parseDuration(timer) || 3600000;
            if (!global.silencedUsers[jid]) global.silencedUsers[jid] = {};
            global.silencedUsers[jid][target] = { type, endTime: Date.now() + durationMs };
            await sock.sendMessage(jid, { text: `🔇 Silenced @${targetNum} (${type}) for ${timer}.`, mentions: [target] });
        }
    },

    // ─── UNSILENCE ───────────────────────────────────────────────
    {
        name: 'unsilence',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner, isSudo, isDev }) => {
            const jid = msg.key.remoteJid;
            if (!jid.endsWith('@g.us')) return;
            const isAuthorized = await verifyPermissions(sock, msg, jid, isOwner, isDev, isSudo, 'unsilence');
            if (!isAuthorized) return;

            const target = parseTargetUser(msg, args);
            if (!target) return await sock.sendMessage(jid, { text: "❌ Mention or reply to a user." });
            if (global.silencedUsers[jid] && global.silencedUsers[jid][target]) {
                delete global.silencedUsers[jid][target];
                await sock.sendMessage(jid, { text: `🔊 Unsilenced @${target.split('@')[0]}.`, mentions: [target] });
            } else {
                await sock.sendMessage(jid, { text: `❌ @${target.split('@')[0]} is not silenced.`, mentions: [target] });
            }
        }
    },

    // ─── DELSPAM ──────────────────────────────────────────────────
    {
        name: 'delspam',
        isPrefixless: false,
        execute: async (sock, msg, args, { isOwner, isSudo, isDev }) => {
            const jid = msg.key.remoteJid;
            if (!jid.endsWith('@g.us')) return;
            const isAuthorized = await verifyPermissions(sock, msg, jid, isOwner, isDev, isSudo, 'delspam');
            if (!isAuthorized) return;

            const target = parseTargetUser(msg, '');
            if (!target) return await sock.sendMessage(jid, { text: "❌ Mention or reply to a user." });
            let count = 10;
            if (args) {
                const partsStr = Array.isArray(args) ? args.join(' ') : args;
                const num = parseInt(partsStr);
                if (!isNaN(num) && num > 0) count = Math.min(num, 50);
            }
            const store = global.messageStore || {};
            const messages = Object.values(store)
                .filter(m => {
                    const mJid = m.key.remoteJid;
                    const sender = normalizeToJid(m.key.participant || m.key.remoteJid || '');
                    return mJid === jid && sender === target;
                })
                .sort((a, b) => (a.messageTimestamp || 0) - (b.messageTimestamp || 0));
            if (messages.length === 0) return await sock.sendMessage(jid, { text: `❌ No messages from @${target.split('@')[0]} in store.`, mentions: [target] });
            const toDelete = messages.slice(-Math.min(count, messages.length));
            let deleted = 0;
            for (const m of toDelete) {
                try {
                    await sock.sendMessage(jid, { delete: m.key });
                    deleted++;
                    if (global.messageStore && global.messageStore[m.key.id]) delete global.messageStore[m.key.id];
                    await delay(300);
                } catch (e) { /* ignore */ }
            }
            await sock.sendMessage(jid, { text: `🧹 Deleted ${deleted} messages from @${target.split('@')[0]}.`, mentions: [target] });
        }
    }
];

// ─── ALIASES ──────────────────────────────────────────────────────

const aliases = [];
module.exports.forEach(cmd => {
    if (cmd.name === 'exit') {
        aliases.push({ ...cmd, name: 'leave' });
    }
    if (cmd.name === 'link') {
        aliases.push({ ...cmd, name: 'invite' });
        aliases.push({ ...cmd, name: 'gclink' });
    }
    if (cmd.name === 'mute') {
        aliases.push({ ...cmd, name: 'unmute' });
        aliases.push({ ...cmd, name: 'open' });
        aliases.push({ ...cmd, name: 'close' });
        aliases.push({ ...cmd, name: 'lock' });
        aliases.push({ ...cmd, name: 'unlock' });
    }
});
module.exports.push(...aliases);