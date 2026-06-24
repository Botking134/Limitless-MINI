/**
 * handlers.js – Centralized message and event handling with diagnostic logging
 */

const config = require('./config');
const commands = require('./commands');

async function handleMessage(sock, chatUpdate) {
    const msg = chatUpdate.messages[0];
    if (!msg || msg.key.fromMe) return;

    // Extract text
    let text = '';
    if (msg.message?.conversation) {
        text = msg.message.conversation;
    } else if (msg.message?.extendedTextMessage?.text) {
        text = msg.message.extendedTextMessage.text;
    } else {
        return; // not a text message
    }

    console.log(`[CMD] Received: "${text}"`);

    const args = text.trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();

    console.log(`[CMD] Parsed command: "${commandName}", args:`, args);

    const handler = commands[commandName];
    if (handler && typeof handler === 'function') {
        console.log(`[CMD] Executing: ${commandName}`);
        try {
            await handler(sock, msg, args);
        } catch (err) {
            console.error(`[CMD] Error in ${commandName}:`, err);
            const jid = msg.key.remoteJid;
            await sock.sendMessage(jid, { text: `❌ An error occurred while executing the command.` }).catch(() => {});
        }
    } else {
        console.log(`[CMD] No handler found for "${commandName}"`);
    }
}

async function handleGroupParticipants(sock, update) {
    // Placeholder – can be expanded later
    console.log('[GROUP] Participant update:', update);
}

module.exports = {
    handleMessage,
    handleGroupParticipants
};