// core.js – Shinigami Core (Single Source of Truth for Master & Masters)
const fs = require('fs');
const path = require('path');

const STORAGE_DIR = path.join(__dirname, 'storage');
const CORE_FILE = path.join(STORAGE_DIR, 'core.json');

// ─── JID NORMALISATION ──────────────────────────────────────────
function normalizeToJid(input) {
    if (!input) return '';
    const clean = String(input).replace(/:[\d]+@/, '@');
    if (clean.endsWith('@s.whatsapp.net') || clean.endsWith('@lid')) return clean;
    const raw = clean.split('@')[0].replace(/[^0-9]/g, '');
    return raw ? `${raw}@s.whatsapp.net` : '';
}

// ─── IN‑MEMORY STATE ──────────────────────────────────────────
let state = {
    masterJid: null,
    masterLid: null,
    mastersJid: [],
    mastersLid: []
};

// ─── ATOMIC WRITE ──────────────────────────────────────────────
function save() {
    if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
    const tmp = CORE_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf-8');
    fs.renameSync(tmp, CORE_FILE);
}

// ─── LOAD / SEED ────────────────────────────────────────────────
function load() {
    try {
        if (fs.existsSync(CORE_FILE)) {
            const data = JSON.parse(fs.readFileSync(CORE_FILE, 'utf-8'));
            state.masterJid = data.masterJid ? normalizeToJid(data.masterJid) : null;
            state.masterLid = data.masterLid ? normalizeToJid(data.masterLid) : null;
            state.mastersJid = Array.isArray(data.mastersJid) ? data.mastersJid.map(normalizeToJid).filter(Boolean) : [];
            state.mastersLid = Array.isArray(data.mastersLid) ? data.mastersLid.map(normalizeToJid).filter(Boolean) : [];
        } else {
            // First run – seed from config.js
            const config = require('./config');
            if (config.master) {
                const jid = normalizeToJid(config.master);
                state.masterJid = jid;
                // LID unknown – stays null
            }
            if (Array.isArray(config.masters)) {
                state.mastersJid = config.masters.map(normalizeToJid).filter(Boolean);
            }
            save();
        }
    } catch (e) {
        console.error('[core] Load error:', e.message);
        save();
    }
}

// ─── PUBLIC API ──────────────────────────────────────────────────
function getMasterJid()  { return state.masterJid; }
function getMasterLid()  { return state.masterLid; }
function getMastersJid() { return [...state.mastersJid]; }
function getMastersLid() { return [...state.mastersLid]; }

function setMaster(input) {
    const jid = normalizeToJid(input);
    if (!jid) throw new Error('Invalid master input');
    // Remove from secondary lists
    state.mastersJid = state.mastersJid.filter(m => m !== jid);
    state.mastersLid = state.mastersLid.filter(m => m !== jid);
    state.masterJid = jid;
    // LID stays whatever it was – overwriting master doesn't erase LID
    save();
    return jid;
}

function updateMasterLid(lid) {
    const normalized = normalizeToJid(lid);
    if (!normalized) return;
    if (state.masterLid !== normalized) {
        state.masterLid = normalized;
        // Remove from secondary LIDs if present
        state.mastersLid = state.mastersLid.filter(l => l !== normalized);
        save();
    }
}

function addMaster(input) {
    const jid = normalizeToJid(input);
    if (!jid) return false;
    if (jid === state.masterJid) return false; // can't add primary master
    if (!state.mastersJid.includes(jid)) {
        state.mastersJid.push(jid);
        save();
        return true;
    }
    return false;
}

function addMasterLid(lid) {
    const normalized = normalizeToJid(lid);
    if (!normalized) return;
    if (normalized === state.masterLid) return; // already primary
    if (!state.mastersLid.includes(normalized)) {
        state.mastersLid.push(normalized);
        save();
    }
}

function removeMaster(input) {
    const jid = normalizeToJid(input);
    const idxJ = state.mastersJid.indexOf(jid);
    const idxL = state.mastersLid.indexOf(jid);
    let changed = false;
    if (idxJ !== -1) { state.mastersJid.splice(idxJ, 1); changed = true; }
    if (idxL !== -1) { state.mastersLid.splice(idxL, 1); changed = true; }
    if (changed) save();
    return changed;
}

function isMaster(input) {
    const norm = normalizeToJid(input);
    if (!norm) return false;
    // Exact match
    if (norm === state.masterJid || norm === state.masterLid) return true;
    if (state.mastersJid.includes(norm) || state.mastersLid.includes(norm)) return true;
    // Match by phone number (for cases where a JID comes in and master is stored as LID, or vice versa)
    const phone = norm.split('@')[0];
    if (phone) {
        if ((state.masterJid && state.masterJid.split('@')[0] === phone) ||
            (state.masterLid && state.masterLid.split('@')[0] === phone)) {
            return true;
        }
        if (state.mastersJid.some(j => j.split('@')[0] === phone) ||
            state.mastersLid.some(j => j.split('@')[0] === phone)) {
            return true;
        }
    }
    return false;
}

function _normalizeJid(input) { return normalizeToJid(input); }

// ─── INIT ────────────────────────────────────────────────────────
load();

module.exports = {
    getMasterJid,
    getMasterLid,
    getMastersJid,
    getMastersLid,
    setMaster,
    updateMasterLid,
    addMaster,
    addMasterLid,
    removeMaster,
    isMaster,
    _normalizeJid
};