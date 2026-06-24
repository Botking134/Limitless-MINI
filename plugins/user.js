// plugins/user.js – Kyōka Suigetsu: All Commands
const fs = require('fs');
const path = require('path');
const { delay } = require('@itsliaaa/baileys');
const axios = require('axios');
const FormData = require('form-data');
const sharp = require('sharp');
const { Sticker, createSticker, StickerTypes } = require('wa-sticker-formatter');
const ffmpeg = require('fluent-ffmpeg');
const os = require('os');

// ─── CONSTANTS ──────────────────────────────────────────────────────
const BOT_NAME = 'Limitless-MD';
const DEFAULT_AUTHOR = 'Infinity';
const PACK_NAME = 'Limitless-MD';
const STICKER_QUALITY = 40; // 30/40 low size
const ALIVE_STORAGE_PATH = path.join(__dirname, '..', 'storage', 'alive.json');
const TTS_VOICE = 'Brian'; // default TTS voice

// ─── HELPERS ──────────────────────────────────────────────────────

// Bold Italic font converter
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

// Format uptime
function formatUptime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const months = Math.floor(totalSec / (30 * 24 * 3600));
    const weeks = Math.floor((totalSec % (30 * 24 * 3600)) / (7 * 24 * 3600));
    const days = Math.floor((totalSec % (7 * 24 * 3600)) / (24 * 3600));
    const hours = Math.floor((totalSec % (24 * 3600)) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    const parts = [];
    if (months > 0) parts.push(`${months}mth`);
    if (weeks > 0) parts.push(`${weeks}w`);
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
    return parts.join(' : ');
}

// Get bot speed (ping) – returns a promise with latency in ms
async function getBotSpeed() {
    try {
        const start = Date.now();
        await axios.get('https://1.1.1.1', { timeout: 3000 });
        return Date.now() - start;
    } catch {
        return 0;
    }
}

// ─── STORAGE HELPERS FOR ALIVE ──────────────────────────────────

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

// ─── COMMAND HANDLERS ──────────────────────────────────────────

// 1. PING (ritual)
async function pingCommand(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;

    await sock.sendMessage(jid, { text: 'Shatter!' });
    await delay(2000);

    await sock.sendMessage(jid, { text: 'Kyouka Suigetsu..' });
    await delay(2000);

    const loadingText = '▬✊ι═════════ﺤ  (loading...)';
    const sentMsg = await sock.sendMessage(jid, { text: loadingText });
    const msgKey = sentMsg.key;

    await delay(7000);

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

// 2. PING2 (quick)
async function ping2Command(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const receivedTime = msg.messageTimestamp ? msg.messageTimestamp * 1000 : Date.now();
    const latency = Date.now() - receivedTime;
    const speed = latency * 100;
    const response = `⨳ ${BOT_NAME} speed: ${toBoldItalic(speed + 'ms')}`;
    await sock.sendMessage(jid, { text: response });
}

// 3. .vv (view-once decrypt in chat)
async function vvCommand(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    if (!quotedMsg) {
        await sock.sendMessage(jid, { text: '❌ Reply to a view‑once message.' });
        return;
    }

    let viewOnce = quotedMsg.viewOnceMessageV2 || quotedMsg.viewOnceMessage;
    if (!viewOnce) {
        await sock.sendMessage(jid, { text: '❌ The replied message is not a view‑once message.' });
        return;
    }

    const mediaMsg = viewOnce.message || viewOnce;
    if (!mediaMsg) {
        await sock.sendMessage(jid, { text: '❌ Could not extract media.' });
        return;
    }

    try {
        const buffer = await sock.downloadMediaMessage(mediaMsg);
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
        console.error('View-once error:', error);
        await sock.sendMessage(jid, { text: '❌ Failed to decrypt. Error: ' + error.message });
    }
}

// 4. .vv2 (view-once decrypt to DM)
async function vv2Command(sock, msg, args) {
    const sender = msg.key.participant || msg.key.remoteJid;
    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    if (!quotedMsg) {
        await sock.sendMessage(sender, { text: '❌ Reply to a view‑once message.' });
        return;
    }

    let viewOnce = quotedMsg.viewOnceMessageV2 || quotedMsg.viewOnceMessage;
    if (!viewOnce) {
        await sock.sendMessage(sender, { text: '❌ The replied message is not a view‑once message.' });
        return;
    }

    const mediaMsg = viewOnce.message || viewOnce;
    if (!mediaMsg) {
        await sock.sendMessage(sender, { text: '❌ Could not extract media.' });
        return;
    }

    try {
        const buffer = await sock.downloadMediaMessage(mediaMsg);
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
        console.error('View-once error:', error);
        await sock.sendMessage(sender, { text: '❌ Failed to decrypt. Error: ' + error.message });
    }
}

// 5. getpp – get profile picture
async function getppCommand(sock, msg, args) {
    const jid = msg.key.remoteJid;
    let targetJid = null;

    // Check for mention
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    if (mentioned && mentioned.length > 0) {
        targetJid = mentioned[0];
    } else {
        // Check if replying to a message
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (quotedMsg) {
            const quotedSender = msg.message.extendedTextMessage.contextInfo.participant || msg.message.extendedTextMessage.contextInfo.remoteJid;
            if (quotedSender) targetJid = quotedSender;
        }
    }
    if (!targetJid) {
        // Use sender's own
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

// 6. setpp – update bot's profile picture
async function setppCommand(sock, msg, args) {
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

// 7. .s – convert media to sticker (low size)
async function stickerCommand(sock, msg, args) {
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
        // Use wa-sticker-formatter with quality 40
        const sticker = new Sticker(buffer, {
            pack: PACK_NAME,
            author: DEFAULT_AUTHOR,
            type: StickerTypes.FULL,
            categories: ['🤖'],
            quality: STICKER_QUALITY,
            background: '#00000000'
        });
        const stickerBuffer = await sticker.toBuffer();
        await sock.sendMessage(jid, { sticker: stickerBuffer });
    } catch (error) {
        console.error('Sticker error:', error);
        await sock.sendMessage(jid, { text: '❌ Failed to create sticker. Error: ' + error.message });
    }
}

// 8. .take – change sticker name/author
async function takeCommand(sock, msg, args) {
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

    let newAuthor = args.join(' ').trim() || DEFAULT_AUTHOR;
    if (!newAuthor) newAuthor = DEFAULT_AUTHOR;

    try {
        const buffer = await sock.downloadMediaMessage(mediaMsg);
        // Repack the sticker with new author
        const sticker = new Sticker(buffer, {
            pack: PACK_NAME,
            author: newAuthor,
            type: StickerTypes.FULL,
            categories: ['🤖'],
            quality: STICKER_QUALITY,
            background: '#00000000'
        });
        const stickerBuffer = await sticker.toBuffer();
        await sock.sendMessage(jid, { sticker: stickerBuffer });
    } catch (error) {
        console.error('Take error:', error);
        await sock.sendMessage(jid, { text: '❌ Failed to modify sticker. Error: ' + error.message });
    }
}

// 9. delete / del / dlt – delete messages with optional timer
async function deleteCommand(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quotedMsg) {
        // If no reply, just delete the command message itself
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

    // Parse timer: e.g., "5s" or "2m"
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
            // Delete the replied message
            await sock.sendMessage(jid, { delete: quotedKey });
        } catch (e) { /* ignore */ }
        try {
            // Delete the command message
            await sock.sendMessage(jid, { delete: msg.key });
        } catch (e) { /* ignore */ }
    };

    if (delayMs > 0) {
        setTimeout(deleteMessages, delayMs);
        // Optionally send a notification? We'll not send anything to keep it silent.
    } else {
        await deleteMessages();
    }
}

// 10. uptime – display bot uptime
async function uptimeCommand(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const uptimeMs = global.botStartTime ? Date.now() - global.botStartTime : 0;
    const formatted = formatUptime(uptimeMs);
    const response = toBoldItalic(formatted);
    await sock.sendMessage(jid, { text: response });
}

// 11. .alive set & .alive
async function aliveCommand(sock, msg, args) {
    const jid = msg.key.remoteJid;

    // If first arg is "set", process set
    if (args.length > 0 && args[0].toLowerCase() === 'set') {
        // Remove "set" from args
        const rest = args.slice(1).join(' ');
        // Check for --image flag
        let message = rest;
        let images = [];
        const imageIndex = rest.indexOf('--image');
        if (imageIndex !== -1) {
            const before = rest.substring(0, imageIndex).trim();
            const after = rest.substring(imageIndex + 7).trim(); // after "--image"
            message = before || 'I am alive!';
            // Split after by spaces to get URLs (treat as separate)
            if (after) {
                images = after.split(/\s+/).filter(url => url.startsWith('http'));
            }
        }
        // If message is empty, set default
        if (!message) message = 'I am alive!';
        saveAliveSettings({ message, images });
        await sock.sendMessage(jid, { text: `✅ Alive message set: "${message}" (${images.length} image(s))` });
        return;
    }

    // Otherwise, display alive message
    const settings = getAliveSettings();
    let text = settings.message || 'I am alive!';
    // Replace placeholders
    const uptime = global.botStartTime ? Date.now() - global.botStartTime : 0;
    const speed = await getBotSpeed();
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { timeZone: 'Africa/Lagos' });
    const timeStr = now.toLocaleTimeString('en-US', { timeZone: 'Africa/Lagos', hour12: true }) + ' WAT';
    text = text.replace(/\$uptime/g, formatUptime(uptime));
    text = text.replace(/\$botspeed/g, speed + 'ms');
    text = text.replace(/\$date/g, dateStr);
    text = text.replace(/\$time/g, timeStr);

    // If images exist, pick random and send as media
    if (settings.images && settings.images.length > 0) {
        const randomIndex = Math.floor(Math.random() * settings.images.length);
        const url = settings.images[randomIndex];
        try {
            // Determine if it's a gif by extension
            if (url.toLowerCase().endsWith('.gif')) {
                await sock.sendMessage(jid, { video: { url }, gifPlayback: true, caption: text });
            } else {
                await sock.sendMessage(jid, { image: { url }, caption: text });
            }
        } catch {
            // Fallback to text only
            await sock.sendMessage(jid, { text });
        }
    } else {
        await sock.sendMessage(jid, { text });
    }
}

// 12. .crop – crop image/sticker to square and send as sticker
async function cropCommand(sock, msg, args) {
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
        // Use sharp to crop to square (center crop) and resize to 512x512
        const metadata = await sharp(buffer).metadata();
        const size = Math.min(metadata.width, metadata.height);
        const left = (metadata.width - size) / 2;
        const top = (metadata.height - size) / 2;

        const croppedBuffer = await sharp(buffer)
            .extract({ left: Math.round(left), top: Math.round(top), width: Math.round(size), height: Math.round(size) })
            .resize(512, 512)
            .webp({ quality: STICKER_QUALITY })
            .toBuffer();

        // Convert to sticker
        const sticker = new Sticker(croppedBuffer, {
            pack: PACK_NAME,
            author: DEFAULT_AUTHOR,
            type: StickerTypes.FULL,
            quality: STICKER_QUALITY,
        });
        const stickerBuffer = await sticker.toBuffer();
        await sock.sendMessage(jid, { sticker: stickerBuffer });
    } catch (error) {
        console.error('Crop error:', error);
        await sock.sendMessage(jid, { text: '❌ Failed to crop. Error: ' + error.message });
    }
}

// 13. .url – upload media to catbox.moe
async function urlCommand(sock, msg, args) {
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

// 14. .toaudio – convert video to audio (MP3)
async function toaudioCommand(sock, msg, args) {
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
        // Write temp files
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
        // Cleanup
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);

        await sock.sendMessage(jid, { audio: audioBuffer, mimetype: 'audio/mpeg' });
    } catch (error) {
        console.error('toaudio error:', error);
        await sock.sendMessage(jid, { text: '❌ Failed to extract audio. Error: ' + error.message });
    }
}

// 15. .tts – text to speech
async function ttsCommand(sock, msg, args) {
    const jid = msg.key.remoteJid;
    let text = args.join(' ').trim();
    if (!text) {
        // Check if replying to a text message
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (quotedMsg && quotedMsg.conversation) {
            text = quotedMsg.conversation;
        } else {
            await sock.sendMessage(jid, { text: '❌ Provide text to speak.' });
            return;
        }
    }

    try {
        const url = `https://api.streamelements.com/kappa/v2/speech?voice=${TTS_VOICE}&text=${encodeURIComponent(text)}`;
        const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
        const buffer = Buffer.from(response.data);
        await sock.sendMessage(jid, { audio: buffer, mimetype: 'audio/mpeg' });
    } catch (error) {
        console.error('TTS error:', error);
        await sock.sendMessage(jid, { text: '❌ TTS service unavailable. Error: ' + error.message });
    }
}

// ─── EXPORT ALL COMMANDS ──────────────────────────────────────

module.exports = [
    { name: 'ping', description: 'Measure your spiritual pressure (ritual).', execute: pingCommand },
    { name: 'ping2', description: 'Quick speed check.', execute: ping2Command },
    { name: '.vv', description: 'Decrypt view-once and send in chat.', execute: vvCommand },
    { name: '.vv2', description: 'Decrypt view-once and send to your DM.', execute: vv2Command },
    { name: 'getpp', description: 'Get profile picture of user (mention or reply).', execute: getppCommand },
    { name: 'setpp', description: 'Update bot\'s profile picture (reply to image).', execute: setppCommand },
    { name: '.s', description: 'Convert media to sticker (low size).', execute: stickerCommand },
    { name: '.take', description: 'Change sticker author name (reply to sticker).', execute: takeCommand },
    { name: 'delete', description: 'Delete replied message (optional timer: 5s, 2m).', execute: deleteCommand },
    { name: 'del', description: 'Alias for delete', execute: deleteCommand },
    { name: 'dlt', description: 'Alias for delete', execute: deleteCommand },
    { name: 'uptime', description: 'Show bot uptime.', execute: uptimeCommand },
    { name: '.alive', description: 'Show custom alive message (set with ".alive set <msg> --image <urls>").', execute: aliveCommand },
    { name: '.crop', description: 'Crop image/sticker to square sticker.', execute: cropCommand },
    { name: '.url', description: 'Upload media to catbox.moe and return URL.', execute: urlCommand },
    { name: '.toaudio', description: 'Convert video to MP3 audio.', execute: toaudioCommand },
    { name: '.tts', description: 'Text-to-speech (usage: .tts <text>).', execute: ttsCommand }
];