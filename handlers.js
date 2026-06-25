/**
 * handlers.js – Centralized message and event handling with permission context
 */

const config = require('./config');
const commands = require('./commands');
const fs = require('fs');
const path = require('path');

// ─── STATE PATH ──────────────────────────────────────────────────
const STATE_PATH = path.join(__dirname, 'storage', 'state.json');

function loadState() {
    try {
        if (fs.existsSync(STATE_PATH)) {
            const data = JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
            if (data.secondaryOwners) config.secondaryOwners = data.secondaryOwners;
            if (data.sudo) config.sudo = data.sudo;
            if (data.primaryOwner) config.primaryOwner = data.primaryOwner;
            if (data.prefix !== undefined) config.prefix = data.prefix;
            if (data.isPublic !== undefined) config.isPublic = data.isPublic;
            if (data.autoReact) config.autoReact = data.autoReact;
            if (data.antidelete) config.antidelete = data.antidelete;
            if (data.antiviewonce) config.antiviewonce = data.antiviewonce;
            if (data.antibug) config.antibug = data.antibug;
            if (data.antipm) config.antipm = data.antipm;
            if (data.statusEmoji) config.statusEmoji = data.statusEmoji;
            if (data.autovs) config.autovs = data.autovs;
            if (data.autors) config.autors = data.autors;
            if (data.stickerCommands) config.stickerCommands = data.stickerCommands;
            if (data.presence) config.presence = data.presence;
        }
    } catch (e) {
        console.warn('[STATE] Failed to load state:', e.message);
    }
}
loadState();

async function handleMessage(sock, chatUpdate) {
    const msg = chatUpdate.messages[0];
    if (!msg || msg.key.fromMe) return;

    let text = '';
    if (msg.message?.conversation) {
        text = msg.message.conversation;
    } else if (msg.message?.extendedTextMessage?.text) {
        text = msg.message.extendedTextMessage.text;
    } else {
        return;
    }

    const args = text.trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();

    const handler = commands[commandName];
    if (handler && typeof handler === 'function') {
        // ─── PERMISSION CONTEXT ──────────────────────────────────
        const sender = msg.key.participant || msg.key.remoteJid || '';
        const senderNumber = sender.split('@')[0];

        // Primary owners: hardcoded config.owner + dynamic primaryOwner from state
        const hardcodedOwners = config.owner || [];
        const primaryOwner = config.primaryOwner || '';
        const secondaryOwners = config.secondaryOwners || [];
        const sudoList = config.sudo || [];

        const isPrimaryOwner = hardcodedOwners.includes(sender) || sender === primaryOwner;
        const isOwner = isPrimaryOwner || secondaryOwners.includes(sender);
        const isSudo = isOwner || sudoList.includes(sender);

        // Only log when a command is executed
        console.log(`[CMD] Executing: ${commandName} (isOwner: ${isOwner}, isSudo: ${isSudo})`);

        try {
            await handler(sock, msg, args, { isOwner, isSudo, isPrimaryOwner, sender, senderNumber });
        } catch (err) {
            console.error(`[CMD] Error in ${commandName}:`, err);
            const jid = msg.key.remoteJid;
            await sock.sendMessage(jid, { text: `❌ An error occurred while executing the command.` }).catch(() => {});
        }
    }
    // No log for unhandled commands – kept silent.
}

async function handleGroupParticipants(sock, update) {
    // Placeholder
}

module.exports = {
    handleMessage,
    handleGroupParticipants
};