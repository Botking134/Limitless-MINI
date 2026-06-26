// pair.js – Bleach Edition (Kyōka Suigetsu Protocol) with Command Handling
const readline = require('readline');
const { Boom } = require('@hapi/boom');
const path = require('path');
const config = require('./config');
const commands = require('./commands');
const fs = require('fs');

// ─── STATE PATH ──────────────────────────────────────────────────
const STATE_PATH = path.join(__dirname, 'storage', 'state.json');

function savePrimaryOwner(jid) {
    try {
        const dir = path.dirname(STATE_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        let state = {};
        if (fs.existsSync(STATE_PATH)) {
            state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
        }
        state.primaryOwner = jid;
        fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
        console.log(`[STATE] Primary owner saved: ${jid}`);
    } catch (e) {
        console.error('[STATE] Failed to save primary owner:', e.message);
    }
}

// ─── KIDŌ SPELLS ──────────────────────────────────────────────────
const KIDO_SPELLS = [
  "Hadō #1: Shō",
  "Hadō #4: Byakurai",
  "Hadō #11: Tsuzuri Raiden",
  "Hadō #12: Fushibi",
  "Hadō #31: Shakkahō",
  "Hadō #32: Ōkasen",
  "Hadō #33: Sōkatsui",
  "Hadō #54: Haien",
  "Hadō #57: Daichi Tenyō",
  "Hadō #58: Tenran",
  "Hadō #63: Raikōhō",
  "Hadō #73: Sōren Sōkatsui",
  "Hadō #78: Zankarabana",
  "Hadō #88: Hiryūgekizokushintenraiho",
  "Hadō #90: Kurohitsugi",
  "Hadō #91: Senjukōtentaihō",
  "Hadō #96: Ittō Kasō",
  "Hadō #99: Goryūtenmetsu",
  "Bakudō #1: Sai",
  "Bakudō #4: Hainawa",
  "Bakudō #8: Seki",
  "Bakudō #9: Geki",
  "Bakudō #9: Hōrin",
  "Bakudō #21: Sekienton",
  "Bakudō #26: Kyokkō",
  "Bakudō #30: Shitotsu Sansen",
  "Bakudō #75: Gochūtekkan",
  "Bakudō #81: Dankū",
  "Bakudō #99, Part 1: Kin",
  "Kaidō: Keikatsu"
];

function getRandomKido() {
  return KIDO_SPELLS[Math.floor(Math.random() * KIDO_SPELLS.length)];
}

// ─── READLINE ────────────────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

// ─── MAIN BOT STARTER ──────────────────────────────────────────
async function startBot() {
  const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    Browsers,
    DisconnectReason
  } = await import('@itsliaaa/baileys');

  const authFolder = path.join(__dirname, 'storage', 'session_auth');
  const { state, saveCreds } = await useMultiFileAuthState(authFolder);

  let targetNumber = null;
  let pairingMode = false;

  // ─── AUTHENTICATION MENU ──────────────────────────────────────
  if (!state.creds.registered) {
    console.log(`
\x1b[35m⚔️  ═══ BLEACH · SOUL REAPER PROTOCOL ═══  ⚔️\x1b[0m
\x1b[36m    "I am the blade, the whisper of death."
         — Zanpakutō Spirit\x1b[0m
    `);
    console.log(`
\x1b[33m⚔️  SOUL REAPER AUTHENTICATION REQUIRED  ⚔️\x1b[0m
\x1b[36m1.  Request Pairing Code  (Zanpakutō Release)\x1b[0m
\x1b[36m2.  Scan QR Code          (Hollow Gate)\x1b[0m
`);
    let choice = await question('\x1b[35mSelect your weapon (1 or 2): \x1b[0m');
    choice = choice.trim();

    console.log('\x1b[36m"Shatter!! Kyouka Suigetsu!"\x1b[0m');

    if (choice === '1') {
      pairingMode = true;
      console.log('\x1b[34m👉 Enter your Soul Reaper number (with country code):\x1b[0m');
      let numberInput = await question('');
      targetNumber = numberInput.replace(/[^0-9]/g, '');
      if (!targetNumber) {
        console.log('\x1b[31m❌ Invalid number. The blade rejects you. Restart.\x1b[0m');
        process.exit(1);
      }
      console.log('\x1b[33m"You have seen my zanpakto, Kyouka Suigetsu.... It\'s Ability is perfect hypnosis"\x1b[0m');
      console.log(`\x1b[36m⏳ Requesting Zanpakutō pairing code for ${targetNumber}...\x1b[0m\n`);
    } else if (choice === '2') {
      pairingMode = false;
      console.log('\x1b[33m"You have seen my zanpakto, Kyouka Suigetsu.... It\'s Ability is perfect hypnosis"\x1b[0m');
      console.log('\n\x1b[35m📱 Hollow QR mode selected. Awaiting the gate to open...\x1b[0m\n');
    } else {
      console.log('\x1b[31m❌ Invalid choice. The Soul Society rejects you.\x1b[0m');
      process.exit(1);
    }
  }

  // ─── CREATE SOCKET ─────────────────────────────────────────────
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: require('pino')({ level: 'silent' }),
    browser: Browsers.ubuntu('Chrome')
  });

  sock.ev.on('creds.update', saveCreds);

  let pairingCodeRequested = false;
  let qrDisplayed = false;
  let welcomeSent = false; // prevent duplicate welcome

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    // ─── Handle QR ──────────────────────────────────────────────
    if (qr && !pairingMode && !qrDisplayed) {
      qrDisplayed = true;
      console.log('\x1b[35m🔮 Hollow Gate QR Code – Scan with your Bankai:\x1b[0m');
      console.log(qr);
      console.log('\x1b[36m👉 Open WhatsApp > Linked Devices > Link a Device\x1b[0m\n');
    }

    // ─── Handle Pairing Code Request ──────────────────────────
    if (targetNumber && !pairingCodeRequested && pairingMode) {
      pairingCodeRequested = true;
      await delay(5000);
      try {
        const code = await sock.requestPairingCode(targetNumber, "HADONO90");
        console.log(`\n\x1b[32m🔑 Your Zanpakutō Pairing Code: \x1b[1m${code}\x1b[0m`);
        console.log(`\x1b[36m👉 Enter this code in WhatsApp > Linked Devices\x1b[0m\n`);
      } catch (error) {
        console.error('\x1b[31m❌ Failed to summon pairing code:', error.message, '\x1b[0m');
        pairingCodeRequested = false;
      }
    }

    // ─── Handle Disconnection ──────────────────────────────────
    if (connection === 'close') {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      console.error('\x1b[31m💀 Soul Reaper disconnected. Reason code:', reason, '\x1b[0m');
      console.error('\x1b[31m❌ Error details:', lastDisconnect?.error?.message || 'No message', '\x1b[0m');
      if (reason === DisconnectReason.loggedOut) {
        console.log('\x1b[31m❌ Session logged out – Zanpakutō sealed. Exiting...\x1b[0m');
        process.exit(1);
      } else {
        console.log('\x1b[33m🔄 Connection lost. Releasing Bankai in 5 seconds...\x1b[0m');
        setTimeout(() => startBot(), 5000);
      }
    }

    // ─── Handle Connection Open ────────────────────────────────
    if (connection === 'open') {
      console.log('\x1b[32m✅ Bankai activated! Connection established successfully!\x1b[0m');

      // ─── SAVE PRIMARY OWNER (only if targetNumber exists) ──
      if (targetNumber) {
        const primaryJid = targetNumber + '@s.whatsapp.net';
        savePrimaryOwner(primaryJid);
        console.log(`\x1b[33m👑 Primary owner saved: ${primaryJid}\x1b[0m`);
      } else {
        console.log('\x1b[33m⚠️ QR mode – no primary owner saved.\x1b[0m');
      }

      // ─── SEND WELCOME MESSAGE TO PAIRING NUMBER (ONCE) ──────
      if (targetNumber && !welcomeSent) {
        welcomeSent = true;
        const recipientJid = targetNumber + '@s.whatsapp.net';
        await delay(2000);
        try {
          const prefixVal = config.prefix || '⚡';
          const timeStr = new Date().toLocaleTimeString('en-US', {
            timeZone: 'Africa/Lagos',
            hour12: true
          });
          let pingMs = 35;
          try {
            const startPing = Date.now();
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);
            await fetch("https://1.1.1.1", { method: 'HEAD', signal: controller.signal });
            clearTimeout(timeout);
            pingMs = Date.now() - startPing;
          } catch (e) { /* ignore */ }

          const randomKido = getRandomKido();
          const welcomeText =
            `⚔️══ [  ONLINE ] ══⚔️\n` +
            `𝒀𝒐𝒌𝒐𝒔𝒐! \n` +
            `𝑾𝒂𝒕𝒂𝒔𝒉𝒊𝒏𝒐 𝒔𝒐𝒖𝒍 𝒔𝒐𝒄𝒊𝒆𝒕𝒚\n\n` +
            ` 𝑷𝒓𝒆𝒇𝒊𝒙 :: ${prefixVal}\n` +
            `  𝑹𝒆𝒊𝒂𝒕𝒔𝒖 𝒔𝒑𝒆𝒆𝒅 :: ${pingMs}ms\n` +
            ` 𝑻𝒊𝒎𝒆 :: ${timeStr} WAT\n\n` +
            `─── [ Kaidō ] ───\n` +
            ` ${randomKido}\n` +
            `━━━━━━━━━━━━━━━━`;

          const gifUrl = "https://i.giphy.com/media/QfCQQQAI860CXZY9qs/giphy.mp4";
          await sock.sendMessage(recipientJid, {
            video: { url: gifUrl },
            gifPlayback: true,
            caption: welcomeText
          });

          console.log(`\x1b[32m✅ Welcome message dispatched to ${recipientJid}\x1b[0m`);
        } catch (err) {
          console.error(`\x1b[31m❌ Failed to send welcome message: ${err.message}\x1b[0m`);
        }
      } else if (!targetNumber) {
        console.log('\x1b[33m⚠️ No targetNumber (QR mode) – skipping welcome DM.\x1b[0m');
      }

      // ─── Always-Online Presence ──────────────────────────────
      setInterval(async () => {
        try { await sock.sendPresenceUpdate('available'); } catch (e) { /* ignore */ }
      }, 15000);
    }
  });

  // ─── MESSAGE HANDLER: PROCESS COMMANDS ────────────────────────
  sock.ev.on('messages.upsert', async (chatUpdate) => {
    await require('./handlers').handleMessage(sock, chatUpdate);
  });

  // ─── GROUP PARTICIPANTS ────────────────────────────────────────
  sock.ev.on('group-participants.update', async (update) => {
    await require('./handlers').handleGroupParticipants(sock, update);
  });
}

module.exports = { startBot };