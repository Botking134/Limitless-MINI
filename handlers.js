/**
 * handlers.js – Centralized message and event handling with permission context
 */

const config = require('./config');
const commands = require('./commands');
const fs = require('fs');
const path = require('path');

// Load dynamic state to get secondary owners and sudo list
const STATE_PATH = path.join(__dirname, 'storage', 'state.json');
function loadState() {
    try {
        if (fs.existsSync(STATE_PATH)) {
            const data = JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
            if (data.secondaryOwners) config.secondaryOwners = data.secondaryOwners;
            if (data.sudo) config.sudo = data.sudo;
            if (data.prefix !== undefined) config.prefix = data.prefix;
            if (data.isPublic !== undefined) config.isPublic = data.isPublic;
            if (data.autoReact) config.autoReact = data.autoReact;
        }
    } catch (e) {}
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

        const primaryOwners = config.owner || [];
        const secondaryOwners = config.secondaryOwners || [];
        const sudoList = config.sudo || [];

        const isPrimaryOwner = primaryOwners.includes(sender);
        const isOwner = isPrimaryOwner || secondaryOwners.includes(sender);
        const isSudo = isOwner || sudoList.includes(sender);

        // Only log when a command is actually executed
        console.log(`[CMD] Executing: ${commandName} (isOwner: ${isOwner}, isSudo: ${isSudo})`);

        try {
            await handler(sock, msg, args, { isOwner, isSudo, isPrimaryOwner, sender, senderNumber });
        } catch (err) {
            console.error(`[CMD] Error in ${commandName}:`, err);
            const jid = msg.key.remoteJid;
            await sock.sendMessage(jid, { text: `❌ An error occurred while executing the command.` }).catch(() => {});
        }
    } else {
        // Optional: keep this if you want to see unhandled commands; comment or remove to silence completely.
        // console.log(`[CMD] No handler found for "${commandName}"`);
    }
}

async function handleGroupParticipants(sock, update) {
    // Placeholder – can be expanded later
    // console.log('[GROUP] Participant update:', update);
}

module.exports = {
    handleMessage,
    handleGroupParticipants
};