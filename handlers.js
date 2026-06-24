/**
 * handlers.js – Centralized message and event handling for Limitless-MD
 * This module keeps pair.js clean by separating message processing logic.
 */

const config = require('./config');
const commands = require('./commands');

/**
 * Process incoming messages: extract text, check commands, execute.
 * @param {Object} sock - Baileys socket instance
 * @param {Object} chatUpdate - messages.upsert event payload
 */
async function handleMessage(sock, chatUpdate) {
    const msg = chatUpdate.messages[0];
    if (!msg || msg.key.fromMe) return; // ignore own messages

    // Extract text from various message types
    let text = '';
    if (msg.message?.conversation) {
        text = msg.message.conversation;
    } else if (msg.message?.extendedTextMessage?.text) {
        text = msg.message.extendedTextMessage.text;
    } else {
        return; // no text to process
    }

    const args = text.trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();

    // Look up the command in the registry
    const handler = commands[commandName];
    if (handler && typeof handler === 'function') {
        try {
            await handler(sock, msg, args);
        } catch (err) {
            console.error(`[COMMAND ERROR] ${commandName}:`, err);
            // Optionally notify the user
            const jid = msg.key.remoteJid;
            await sock.sendMessage(jid, { text: `❌ An error occurred while executing the command.` }).catch(() => {});
        }
    }
}

/**
 * Handle group participant updates (welcome/goodbye).
 * Currently a placeholder – you can expand this using config.welcome and config.goodbye.
 * @param {Object} sock - Baileys socket instance
 * @param {Object} update - group-participants.update event payload
 */
async function handleGroupParticipants(sock, update) {
    // Example: send welcome message when a user joins
    // const { id: groupJid, participants, action } = update;
    // if (action === 'add') {
    //     for (const participant of participants) {
    //         const welcomeMsg = config.welcome.replace('@user', `@${participant.split('@')[0]}`);
    //         await sock.sendMessage(groupJid, { text: welcomeMsg, mentions: [participant] });
    //     }
    // }
    // if (action === 'remove') {
    //     for (const participant of participants) {
    //         const goodbyeMsg = config.goodbye.replace('@user', `@${participant.split('@')[0]}`);
    //         await sock.sendMessage(groupJid, { text: goodbyeMsg, mentions: [participant] });
    //     }
    // }
}

module.exports = {
    handleMessage,
    handleGroupParticipants
};