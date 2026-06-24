/**
 * plugins/user.js
 * Limitless-MD Plugin – Kyōka Suigetsu Command Arsenal
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');
const { delay } = require('@itsliaaa/baileys');
const axios = require('axios');
const FormData = require('form-data');
const sharp = require('sharp');
const { Sticker } = require('wa-sticker-formatter');
const ffmpeg = require('fluent-ffmpeg');
const os = require('os');

// ─── HELPERS ──────────────────────────────────────────────────────

// Recursively unwrap Baileys message wrappers (ephemeral, view-once, etc.)
function getRawMessage(message) {
    if (!message) return null;
    if (message.ephemeralMessage?.message) return getRawMessage(message.ephemeralMessage.message);
    if (message.viewOnceMessage?.message) return getRawMessage(message.viewOnceMessage.message);
    if (message.viewOnceMessageV2?.message) return getRawMessage(message.viewOnceMessageV2.message);
    if (message.viewOnceMessageV2Extension?.message) return getRawMessage(message.viewOnceMessageV2Extension.message);
    if (message.documentWithCaptionMessage?.message) return getRawMessage(message.documentWithCaptionMessage.message);
    return message;
}

function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts = [];
    if (d > 0) parts.push(d + 'd');
    if (h > 0) parts.push(h + 'h');
    if (m > 0) parts.push(m + 'm');
    if (s > 0 || parts.length === 0) parts.push(s + 's');
    return parts.join(' ');
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

function toBoldItalic(text) {
    const map = {
        'A': '𝘈', 'B': '𝘉', 'C': '𝘊', 'D': '𝘋', 'E': '𝘌', 'F': '𝘍', 'G': '𝘎', 'H': '𝘏',
        'I': '𝘐', 'J': '𝘑', 'K': '𝘒', 'L': '𝘓', 'M': '𝘔', 'N': '𝘕', 'O': '𝘖', 'P': '𝘗',
        'Q': '𝘘', 'R': '𝘙', 'S': '𝘚', 'T': '𝘛', 'U': '𝘜', 'V': '𝘝', 'W': '𝘞', 'X': '𝘟',
        'Y': '𝘠', 'Z': '𝘡',
        'a': '𝘢', 'b': '𝘣', 'c': '𝘤', 'd': '𝘥', 'e': '𝘦', 'f': '𝘧', 'g': '𝘨', 'h': '𝘩',
        'i': '𝘪', 'j': '𝘫', 'k': '𝘬', 'l': '𝘭', 'm': '𝘮', 'n': '𝘯', 'o': '𝘰', 'p': '𝘱',
        'q': '𝘲', 'r': '𝘳', 's': '𝘴', 't': '𝘵', 'u': '𝘶', 'v': '𝘷', 'w': '𝘸', 'x': '𝘹',
        'y': '𝘺', 'z': '𝘻',
        '0': '𝟶', '1': '𝟷', '2': '𝟸', '3': '𝟹', '4': '𝟺',
        '5': '𝟻', '6': '𝟼', '7': '𝟽', '8': '𝟾', '9': '𝟿'
    };
    return text.split('').map(ch => map[ch] || ch).join('');
}

async function getBotSpeed() {
    try {
        const start = Date.now();
        await axios.get('https://1.1.1.1', { timeout: 3000 });
        return Date.now() - start;
    } catch {
        return 0;
    }
}

// ─── ALIVE STORAGE ──────────────────────────────────────────────

const ALIVE_STORAGE_PATH = path.join(__dirname, '..', 'storage', 'alive.json');

function getAliveSettings() {
    if (!fs.existsSync(ALIVE_STORAGE_PATH)) {
        return { message: 'I am alive! Uptime: $uptime', images: [] };
    }
    try {
        return JSON.parse(fs.readFileSync(ALIVE_STORAGE_PATH, 'utf8'));
    } catch {
        return { message: 'I am alive! Uptime: $uptime', images: [] };
    }
}

function saveAliveSettings(settings) {
    const dir = path.dirname(ALIVE_STORAGE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(ALIVE_STORAGE_PATH, JSON.stringify(settings, null, 2));
}

// ─── COMMAND EXPORTS ─────────────────────────────────────────────

module.exports = [
    // 1. ping – UPDATED with progress bar animation on third line
    {
        name: 'ping',
        isPrefixless: false,
        execute: async (sock, msg, args) => {
            const jid = msg.key.remoteJid;
            const sender = msg.key.participant || msg.key.remoteJid;

            // Step 1: Shatter!
            await sock.sendMessage(jid, { text: 'Shatter!' });
            await delay(2000);

            // Step 2: Kyouka Suigetsu..
            await sock.sendMessage(jid, { text: 'Kyouka Suigetsu..' });
            await delay(2000);

            // Step 3: Send the initial message with sword and empty progress bar
            const swordLine = '▬✊ι═════════ﺤ  [□□□□□□]';
            const sentMsg = await sock.sendMessage(jid, { text: swordLine });
            const msgKey = sentMsg.key;

            // Progress frames (Option A)
            const frames = ['[□□□□□□]', '[■□□□□□]', '[■■□□□□]', '[■■■□□□]', '[■■■■□□]', '[■■■■■□]', '[■■■■■■]'];
            let frameIndex = 0;
            const totalFrames = frames.length;

            // Animation loop for 7 seconds (update every 400ms)
            const startTime = Date.now();
            const duration = 7000;
            while (Date.now() - startTime < duration) {
                const frame = frames[frameIndex % totalFrames];
                const newText = `▬✊ι═════════ﺤ  ${frame}`;
                await sock.sendMessage(jid, { text: newText, edit: msgKey });
                frameIndex++;
                await delay(400);
            }

            // Final edit: replace with mention + spiritual pressure
            const receivedTime = msg.messageTimestamp ? msg.messageTimestamp * 1000 : Date.now();
            const latency = Date.now() - receivedTime;
            const spiritualPressure = latency * 10;

            const mentionText = `@${sender.split('@')[0]}`;
            const finalText =
                `${mentionText}\n` +
                `Spiritual Pressure:: ${toBoldItalic(spiritualPressure + 'ms')}`;

            await sock.sendMessage(jid, {
                text: finalText,
                edit: msgKey,
                mentions: [sender]
            });
        }
    },

    // 2. ping2 – UPDATED output format
    {
        name: 'ping2',
        isPrefixless: false,
        execute: async (sock, msg, args) => {
            const jid = msg.key.remoteJid;
            const receivedTime = msg.messageTimestamp ? msg.messageTimestamp * 1000 : Date.now();
            const latency = Date.now() - receivedTime;
            // New format: "> $botspeed *100"
            const response = `> ${latency}ms *100`;
            await sock.sendMessage(jid, { text: response });
        }
    },

    // 3. .vv – with diagnostic logs
    {
        name: '.vv',
        isPrefixless: false,
        execute: async (sock, msg, args) => {
            const jid = msg.key.remoteJid;
            const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

            console.log('[VV] Raw quoted message:', JSON.stringify(quotedMsg, null, 2));

            if (!quotedMsg) {
                await sock.sendMessage(jid, { text: '❌ Reply to a view‑once message.' });
                return;
            }

            const rawQuoted = getRawMessage(quotedMsg);
            console.log('[VV] After unwrap:', JSON.stringify(rawQuoted, null, 2));

            if (!rawQuoted) {
                await sock.sendMessage(jid, { text: '❌ Could not parse the quoted message.' });
                return;
            }

            const viewOnce = rawQuoted.viewOnceMessageV2 || rawQuoted.viewOnceMessage;
            console.log('[VV] viewOnce object:', viewOnce);

            if (!viewOnce) {
                await sock.sendMessage(jid, { text: '❌ The replied message is not a view‑once message.' });
                return;
            }

            const mediaMsg = getRawMessage(viewOnce);
            console.log('[VV] mediaMsg (inner):', mediaMsg);

            if (!mediaMsg) {
                await sock.sendMessage(jid, { text: '❌ Could not extract media from view‑once.' });
                return;
            }

            try {
                // Pass the entire viewOnce object to downloadMediaMessage
                const buffer = await sock.downloadMediaMessage(viewOnce);
                const type = Object.keys(mediaMsg)[0];
                let sendContent = {};
                if (type === 'imageMessage') {
                    sendContent = { image: buffer, caption: '🔓 Decrypted view‑once image.' };
                } else if (type === 'videoMessage') {
                    sendContent = { video: buffer, caption: '🔓 Decrypted view‑once video.' };
                } else if (type === 'audioMessage') {
                    sendContent = { audio: buffer, mimetype: 'audio/ogg; codecs=opus' };
                } else {
                    sendContent = { document: buffer, mimetype: 'application/octet-stream', fileName: 'decrypted.bin' };
                }
                await sock.sendMessage(jid, sendContent);
            } catch (error) {
                console.error('[VV] Download error:', error);
                await sock.sendMessage(jid, { text: '❌ Failed to decrypt. Error: ' + error.message });
            }
        }
    },

    // 4. .vv2 – with diagnostic logs (identical logic, but sends to DM)
    {
        name: '.vv2',
        isPrefixless: false,
        execute: async (sock, msg, args) => {
            const sender = msg.key.participant || msg.key.remoteJid;
            const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

            console.log('[VV2] Raw quoted message:', JSON.stringify(quotedMsg, null, 2));

            if (!quotedMsg) {
                await sock.sendMessage(sender, { text: '❌ Reply to a view‑once message.' });
                return;
            }

            const rawQuoted = getRawMessage(quotedMsg);
            console.log('[VV2] After unwrap:', JSON.stringify(rawQuoted, null, 2));

            if (!rawQuoted) {
                await sock.sendMessage(sender, { text: '❌ Could not parse the quoted message.' });
                return;
            }

            const viewOnce = rawQuoted.viewOnceMessageV2 || rawQuoted.viewOnceMessage;
            console.log('[VV2] viewOnce object:', viewOnce);

            if (!viewOnce) {
                await sock.sendMessage(sender, { text: '❌ The replied message is not a view‑once message.' });
                return;
            }

            const mediaMsg = getRawMessage(viewOnce);
            console.log('[VV2] mediaMsg (inner):', mediaMsg);

            if (!mediaMsg) {
                await sock.sendMessage(sender, { text: '❌ Could not extract media from view‑once.' });
                return;
            }

            try {
                const buffer = await sock.downloadMediaMessage(viewOnce);
                const type = Object.keys(mediaMsg)[0];
                let sendContent = {};
                if (type === 'imageMessage') {
                    sendContent = { image: buffer, caption: '🔓 Decrypted view‑once image (sent to your DM).' };
                } else if (type === 'videoMessage') {
                    sendContent = { video: buffer, caption: '🔓 Decrypted view‑once video (sent to your DM).' };
                } else if (type === 'audioMessage') {
                    sendContent = { audio: buffer, mimetype: 'audio/ogg; codecs=opus' };
                } else {
                    sendContent = { document: buffer, mimetype: 'application/octet-stream', fileName: 'decrypted.bin' };
                }
                await sock.sendMessage(sender, sendContent);
            } catch (error) {
                console.error('[VV2] Download error:', error);
                await sock.sendMessage(sender, { text: '❌ Failed to decrypt. Error: ' + error.message });
            }
        }
    },

    // ... (the rest of the commands remain unchanged)
    // 5. getpp
    {
        name: 'getpp',
        isPrefixless: false,
        execute: async (sock, msg, args) => {
            const jid = msg.key.remoteJid;
            let targetJid = null;
            const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
            if (mentioned && mentioned.length > 0) {
                targetJid = mentioned[0];
            } else {
                const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                if (quotedMsg) {
                    const quotedSender = msg.message.extendedTextMessage.contextInfo.participant || msg.message.extendedTextMessage.contextInfo.remoteJid;
                    if (quotedSender) targetJid = quotedSender;
                }
            }
            if (!targetJid) {
                targetJid = msg.key.participant || msg.key.remoteJid;
            }
            try {
                const ppUrl = await sock.profilePictureUrl(targetJid, 'image');
                const response = await axios.get(ppUrl, { responseType: 'arraybuffer' });
                const buffer = Buffer.from(response.data);
                await sock.sendMessage(jid, {
                    image: buffer,
                    caption: `👤 Profile picture of @${targetJid.split('@')[0]}`,
                    mentions: [targetJid]
                });
            } catch {
                await sock.sendMessage(jid, { text: '❌ This soul has no profile picture.' });
            }
        }
    },

    // 6. setpp
    {
        name: 'setpp',
        isPrefixless: false,
        execute: async (sock, msg, args) => {
            const jid = msg.key.remoteJid;
            const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quotedMsg) {
                await sock.sendMessage(jid, { text: '❌ Reply to an image to set as bot profile picture.' });
                return;
            }
            const mediaMsg = quotedMsg.imageMessage || quotedMsg.videoMessage || quotedMsg.documentMessage;
            if (!mediaMsg) {
                await sock.sendMessage(jid, { text: '❌ The replied message is not an image.' });
                return;
            }
            try {
                const buffer = await sock.downloadMediaMessage(mediaMsg);
                await sock.updateProfilePicture(sock.user.id, buffer);
                await sock.sendMessage(jid, { text: '✅ The Soul Reaper\'s visage has been reshaped.' });
            } catch (error) {
                console.error('setpp error:', error);
                await sock.sendMessage(jid, { text: '❌ Failed to update profile picture. Error: ' + error.message });
            }
        }
    },

    // 7. .s
    {
        name: '.s',
        isPrefixless: false,
        execute: async (sock, msg, args) => {
            const jid = msg.key.remoteJid;
            const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quotedMsg) {
                await sock.sendMessage(jid, { text: '❌ Reply to an image or video to convert to sticker.' });
                return;
            }
            const mediaMsg = quotedMsg.imageMessage || quotedMsg.videoMessage || quotedMsg.stickerMessage;
            if (!mediaMsg) {
                await sock.sendMessage(jid, { text: '❌ Unsupported media type.' });
                return;
            }
            try {
                const buffer = await sock.downloadMediaMessage(mediaMsg);
                const sticker = new Sticker(buffer, {
                    pack: 'Limitless-MD',
                    author: 'Infinity',
                    type: 0,
                    categories: ['🤖'],
                    quality: 40,
                    background: '#00000000'
                });
                const stickerBuffer = await sticker.toBuffer();
                await sock.sendMessage(jid, { sticker: stickerBuffer });
            } catch (error) {
                console.error('Sticker error:', error);
                await sock.sendMessage(jid, { text: '❌ Failed to create sticker. Error: ' + error.message });
            }
        }
    },

    // 8. .take
    {
        name: '.take',
        isPrefixless: false,
        execute: async (sock, msg, args) => {
            const jid = msg.key.remoteJid;
            const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quotedMsg) {
                await sock.sendMessage(jid, { text: '❌ Reply to a sticker to change its name.' });
                return;
            }
            const mediaMsg = quotedMsg.stickerMessage;
            if (!mediaMsg) {
                await sock.sendMessage(jid, { text: '❌ The replied message is not a sticker.' });
                return;
            }
            let newAuthor = args.join(' ').trim() || 'Infinity';
            try {
                const buffer = await sock.downloadMediaMessage(mediaMsg);
                const sticker = new Sticker(buffer, {
                    pack: 'Limitless-MD',
                    author: newAuthor,
                    type: 0,
                    categories: ['🤖'],
                    quality: 40,
                    background: '#00000000'
                });
                const stickerBuffer = await sticker.toBuffer();
                await sock.sendMessage(jid, { sticker: stickerBuffer });
            } catch (error) {
                console.error('Take error:', error);
                await sock.sendMessage(jid, { text: '❌ Failed to modify sticker. Error: ' + error.message });
            }
        }
    },

    // 9. delete
    {
        name: 'delete',
        isPrefixless: false,
        execute: async (sock, msg, args) => {
            const jid = msg.key.remoteJid;
            const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quotedMsg) {
                try {
                    await sock.sendMessage(jid, { delete: msg.key });
                } catch { /* ignore */ }
                return;
            }
            const quotedKey = msg.message.extendedTextMessage.contextInfo.stanzaId ? {
                id: msg.message.extendedTextMessage.contextInfo.stanzaId,
                remoteJid: jid,
                fromMe: false,
                participant: msg.message.extendedTextMessage.contextInfo.participant || undefined
            } : msg.key;
            let delayMs = 0;
            if (args.length > 0) {
                const timerStr = args[0];
                const match = timerStr.match(/^(\d+)(s|m)?$/);
                if (match) {
                    const value = parseInt(match[1]);
                    const unit = match[2] || 's';
                    delayMs = unit === 'm' ? value * 60 * 1000 : value * 1000;
                }
            }
            const deleteMessages = async () => {
                try {
                    await sock.sendMessage(jid, { delete: quotedKey });
                } catch (e) { /* ignore */ }
                try {
                    await sock.sendMessage(jid, { delete: msg.key });
                } catch (e) { /* ignore */ }
            };
            if (delayMs > 0) {
                setTimeout(deleteMessages, delayMs);
            } else {
                await deleteMessages();
            }
        }
    },

    // 10. del (alias)
    {
        name: 'del',
        isPrefixless: false,
        execute: async (sock, msg, args) => {
            const delCmd = module.exports.find(cmd => cmd.name === 'delete');
            if (delCmd) await delCmd.execute(sock, msg, args);
        }
    },

    // 11. dlt (alias)
    {
        name: 'dlt',
        isPrefixless: false,
        execute: async (sock, msg, args) => {
            const delCmd = module.exports.find(cmd => cmd.name === 'delete');
            if (delCmd) await delCmd.execute(sock, msg, args);
        }
    },

    // 12. uptime
    {
        name: 'uptime',
        isPrefixless: false,
        execute: async (sock, msg, args) => {
            const jid = msg.key.remoteJid;
            const uptimeMs = global.botStartTime ? Date.now() - global.botStartTime : 0;
            const formatted = formatUptime(uptimeMs);
            const response = toBoldItalic(formatted);
            await sock.sendMessage(jid, { text: response });
        }
    },

    // 13. .alive
    {
        name: '.alive',
        isPrefixless: false,
        execute: async (sock, msg, args) => {
            const jid = msg.key.remoteJid;
            if (args.length > 0 && args[0].toLowerCase() === 'set') {
                const rest = args.slice(1).join(' ');
                let message = rest;
                let images = [];
                const imageIndex = rest.indexOf('--image');
                if (imageIndex !== -1) {
                    const before = rest.substring(0, imageIndex).trim();
                    const after = rest.substring(imageIndex + 7).trim();
                    message = before || 'I am alive!';
                    if (after) {
                        images = after.split(/\s+/).filter(url => url.startsWith('http'));
                    }
                }
                if (!message) message = 'I am alive!';
                saveAliveSettings({ message, images });
                await sock.sendMessage(jid, { text: `✅ Alive message set: "${message}" (${images.length} image(s))` });
                return;
            }
            const settings = getAliveSettings();
            let text = settings.message || 'I am alive!';
            const uptime = global.botStartTime ? Date.now() - global.botStartTime : 0;
            const speed = await getBotSpeed();
            const now = new Date();
            const dateStr = now.toLocaleDateString('en-US', { timeZone: 'Africa/Lagos' });
            const timeStr = now.toLocaleTimeString('en-US', { timeZone: 'Africa/Lagos', hour12: true }) + ' WAT';
            text = text.replace(/\$uptime/g, formatUptime(uptime));
            text = text.replace(/\$botspeed/g, speed + 'ms');
            text = text.replace(/\$date/g, dateStr);
            text = text.replace(/\$time/g, timeStr);
            if (settings.images && settings.images.length > 0) {
                const randomIndex = Math.floor(Math.random() * settings.images.length);
                const url = settings.images[randomIndex];
                try {
                    if (url.toLowerCase().endsWith('.gif')) {
                        await sock.sendMessage(jid, { video: { url }, gifPlayback: true, caption: text });
                    } else {
                        await sock.sendMessage(jid, { image: { url }, caption: text });
                    }
                } catch {
                    await sock.sendMessage(jid, { text });
                }
            } else {
                await sock.sendMessage(jid, { text });
            }
        }
    },

    // 14. .crop
    {
        name: '.crop',
        isPrefixless: false,
        execute: async (sock, msg, args) => {
            const jid = msg.key.remoteJid;
            const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quotedMsg) {
                await sock.sendMessage(jid, { text: '❌ Reply to an image or sticker to crop.' });
                return;
            }
            const mediaMsg = quotedMsg.imageMessage || quotedMsg.stickerMessage || quotedMsg.videoMessage;
            if (!mediaMsg) {
                await sock.sendMessage(jid, { text: '❌ Unsupported media type. Use image or sticker.' });
                return;
            }
            try {
                const buffer = await sock.downloadMediaMessage(mediaMsg);
                const metadata = await sharp(buffer).metadata();
                const size = Math.min(metadata.width, metadata.height);
                const left = (metadata.width - size) / 2;
                const top = (metadata.height - size) / 2;
                const croppedBuffer = await sharp(buffer)
                    .extract({ left: Math.round(left), top: Math.round(top), width: Math.round(size), height: Math.round(size) })
                    .resize(512, 512)
                    .webp({ quality: 40 })
                    .toBuffer();
                const sticker = new Sticker(croppedBuffer, {
                    pack: 'Limitless-MD',
                    author: 'Infinity',
                    type: 0,
                    quality: 40,
                });
                const stickerBuffer = await sticker.toBuffer();
                await sock.sendMessage(jid, { sticker: stickerBuffer });
            } catch (error) {
                console.error('Crop error:', error);
                await sock.sendMessage(jid, { text: '❌ Failed to crop. Error: ' + error.message });
            }
        }
    },

    // 15. .url
    {
        name: '.url',
        isPrefixless: false,
        execute: async (sock, msg, args) => {
            const jid = msg.key.remoteJid;
            const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quotedMsg) {
                await sock.sendMessage(jid, { text: '❌ Reply to an image or file to upload.' });
                return;
            }
            const mediaMsg = quotedMsg.imageMessage || quotedMsg.videoMessage || quotedMsg.audioMessage || quotedMsg.documentMessage;
            if (!mediaMsg) {
                await sock.sendMessage(jid, { text: '❌ Unsupported media type.' });
                return;
            }
            try {
                const buffer = await sock.downloadMediaMessage(mediaMsg);
                const form = new FormData();
                form.append('reqtype', 'fileupload');
                form.append('fileToUpload', buffer, 'file.bin');
                const response = await axios.post('https://catbox.moe/user/api.php', form, {
                    headers: form.getHeaders(),
                    timeout: 60000
                });
                const url = response.data.trim();
                await sock.sendMessage(jid, { text: `🔗 Uploaded to Catbox: ${url}` });
            } catch (error) {
                console.error('Upload error:', error);
                await sock.sendMessage(jid, { text: '❌ Upload failed. Error: ' + error.message });
            }
        }
    },

    // 16. .toaudio
    {
        name: '.toaudio',
        isPrefixless: false,
        execute: async (sock, msg, args) => {
            const jid = msg.key.remoteJid;
            const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quotedMsg) {
                await sock.sendMessage(jid, { text: '❌ Reply to a video to extract audio.' });
                return;
            }
            const mediaMsg = quotedMsg.videoMessage;
            if (!mediaMsg) {
                await sock.sendMessage(jid, { text: '❌ The replied message is not a video.' });
                return;
            }
            try {
                const buffer = await sock.downloadMediaMessage(mediaMsg);
                const tempDir = os.tmpdir();
                const inputPath = path.join(tempDir, `input_${Date.now()}.mp4`);
                const outputPath = path.join(tempDir, `output_${Date.now()}.mp3`);
                fs.writeFileSync(inputPath, buffer);
                await new Promise((resolve, reject) => {
                    ffmpeg(inputPath)
                        .toFormat('mp3')
                        .audioBitrate(128)
                        .audioFrequency(44100)
                        .on('end', resolve)
                        .on('error', reject)
                        .save(outputPath);
                });
                const audioBuffer = fs.readFileSync(outputPath);
                fs.unlinkSync(inputPath);
                fs.unlinkSync(outputPath);
                await sock.sendMessage(jid, { audio: audioBuffer, mimetype: 'audio/mpeg' });
            } catch (error) {
                console.error('toaudio error:', error);
                await sock.sendMessage(jid, { text: '❌ Failed to extract audio. Error: ' + error.message });
            }
        }
    },

    // 17. .tts
    {
        name: '.tts',
        isPrefixless: false,
        execute: async (sock, msg, args) => {
            const jid = msg.key.remoteJid;
            let text = args.join(' ').trim();
            if (!text) {
                const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                if (quotedMsg && quotedMsg.conversation) {
                    text = quotedMsg.conversation;
                } else {
                    await sock.sendMessage(jid, { text: '❌ Provide text to speak.' });
                    return;
                }
            }
            try {
                const url = `https://api.streamelements.com/kappa/v2/speech?voice=Brian&text=${encodeURIComponent(text)}`;
                const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
                const buffer = Buffer.from(response.data);
                await sock.sendMessage(jid, { audio: buffer, mimetype: 'audio/mpeg' });
            } catch (error) {
                console.error('TTS error:', error);
                await sock.sendMessage(jid, { text: '❌ TTS service unavailable. Error: ' + error.message });
            }
        }
    }
];