// commands.js
const fs = require('fs');
const path = require('path');
const config = require('./config');

// ─── EXPORT MAP ──────────────────────────────────────────────────
// We assign commands directly to module.exports so they can be
// dynamically reloaded without breaking references.
const commands = module.exports;

// ─── PLUGINS DIRECTORY ──────────────────────────────────────────
const pluginsDir = path.join(__dirname, 'plugins');

// Ensure plugins directory exists
if (!fs.existsSync(pluginsDir)) {
    fs.mkdirSync(pluginsDir, { recursive: true });
}

// ─── FILE SCANNER ────────────────────────────────────────────────
function getFilesRecursive(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;

    const list = fs.readdirSync(dir);
    for (const file of list) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getFilesRecursive(filePath));
        } else if (file.endsWith('.js')) {
            results.push(filePath);
        }
    }
    return results;
}

// ─── COMMAND REGISTRATION ────────────────────────────────────────
function register(cmd) {
    if (!cmd.name || typeof cmd.execute !== 'function') return;

    // Determine key:
    // - If prefix is null or undefined → always prefixless
    // - If cmd.isPrefixless → prefixless
    // - Else prepend config.prefix
    const usePrefixless = (config.prefix === null || config.prefix === undefined) || cmd.isPrefixless;
    const key = usePrefixless
        ? cmd.name.toLowerCase()
        : `${config.prefix}${cmd.name.toLowerCase()}`;

    if (key === 'reload') return;
    commands[key] = cmd.execute;
}

// ─── HOT RELOAD ──────────────────────────────────────────────────
function reloadCommands() {
    for (const key in commands) {
        if (key !== 'reload') {
            delete commands[key];
        }
    }

    const pluginFiles = getFilesRecursive(pluginsDir);
    for (const filePath of pluginFiles) {
        try {
            delete require.cache[require.resolve(filePath)];
            const plugin = require(filePath);
            if (Array.isArray(plugin)) {
                plugin.forEach(cmd => register(cmd));
            } else {
                register(plugin);
            }
        } catch (error) {
            console.error(`⚠️ Failed to load plugin [${path.basename(filePath)}]:`, error.message);
        }
    }

    const prefixDisplay = config.prefix === null || config.prefix === undefined ? 'none (prefixless)' : config.prefix;
    console.log(`🔄 [LOADER] Recompiled all triggers under prefix: "${prefixDisplay}"`);
}

// ─── INITIAL BOOT LOAD ──────────────────────────────────────────
console.log(`📦 [LOADER] Scanning plugins in: ${pluginsDir}`);
const pluginFiles = getFilesRecursive(pluginsDir);

if (pluginFiles.length === 0) {
    console.log(`⚠️ [LOADER] No plugins found in /plugins. Place your .js command files there.`);
}

for (const filePath of pluginFiles) {
    try {
        const plugin = require(filePath);
        if (Array.isArray(plugin)) {
            plugin.forEach(cmd => register(cmd));
        } else {
            register(plugin);
        }
    } catch (error) {
        console.error(`⚠️ Failed to load plugin [${path.basename(filePath)}]:`, error.message);
    }
}

// ─── ATTACH RELOAD METHOD ────────────────────────────────────────
commands.reload = reloadCommands;

const prefixDisplay = config.prefix === null || config.prefix === undefined ? 'none (prefixless)' : config.prefix;
console.log(`✅ [LOADER] Loaded ${Object.keys(commands).length - 1} commands with prefix "${prefixDisplay}"`);