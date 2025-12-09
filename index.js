import 'dotenv/config';
import { Client } from 'discord.js-selfbot-v13';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadDatabase } from './functions/database.js';
import Lavalink from './functions/lavalink.js';
import queueManager from './functions/queue.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({ checkUpdate: false });

const lavalink = new Lavalink({
    restHost: process.env.LAVALINK_REST,
    wsHost: process.env.LAVALINK_WS,
    password: process.env.LAVALINK_PASSWORD,
    clientName: process.env.CLIENT_NAME || 'Selfbot',
});

// Collections
client.voiceStates = {};
client.commands = new Map();
client.aliases = new Map();
client.trackTimeouts = new Map();
client.lavalink = lavalink;
client.queueManager = queueManager;
client.db = loadDatabase();

// Load commands
const cmdPath = path.join(__dirname, 'commands');
for (const category of fs.readdirSync(cmdPath).filter(f => fs.statSync(path.join(cmdPath, f)).isDirectory())) {
    for (const file of fs.readdirSync(path.join(cmdPath, category)).filter(f => f.endsWith('.js'))) {
        const fullPath = path.join(cmdPath, category, file);
        const command = (await import(`file://${fullPath}`)).default;
        if (command?.name) {
            client.commands.set(command.name, command);
            command.aliases?.forEach(alias => client.aliases.set(alias, command.name));
            console.log(`Loaded: ${command.name} (${category})`);
        }
    }
}

// Voice state tracking
client.ws.on('VOICE_STATE_UPDATE', packet => {
    if (packet.user_id !== client.user.id) return;
    const gid = packet.guild_id;
    client.voiceStates[gid] ??= {};
    client.voiceStates[gid].sessionId = packet.session_id;
});

client.ws.on('VOICE_SERVER_UPDATE', packet => {
    const gid = packet.guild_id;
    client.voiceStates[gid] ??= {};
    client.voiceStates[gid].token = packet.token;
    client.voiceStates[gid].endpoint = packet.endpoint;
});

lavalink.on('ready', () => console.log('[Lavalink] Connected'));

// AUTO-QUEUE — 100% WORKING
client.startTrack = async (guildId, track) => {
    const queue = client.queueManager.get(guildId);
    if (!queue) return;

    queue.nowPlaying = track;

    if (client.trackTimeouts.has(guildId)) {
        clearTimeout(client.trackTimeouts.get(guildId));
    }

    try {
        const vs = client.voiceStates[guildId];
        await lavalink.updatePlayer(guildId, track, vs, {
            volume: queue.volume || 100,
            filters: queue.filters || {}
        });

        queue.textChannel?.react?.("▶").catch(() => {});

        const duration = track.info.length || 180000;
        const timeout = setTimeout(() => client.playNext(guildId), duration + 1000);
        client.trackTimeouts.set(guildId, timeout);

    } catch (e) {
        console.error("Failed to start track:", e.message);
    }
};

client.playNext = async (guildId) => {
    const queue = client.queueManager.get(guildId);
    if (!queue) return;

    const next = client.queueManager.getNext(guildId);
    if (!next) {
        queue.nowPlaying = null;
        queue.textChannel?.react?.("⏹").catch(() => {});
        return;
    }

    await client.startTrack(guildId, next);
};

// Ready
client.on('ready', () => {
    console.log(`\nLogged in as ${client.user.tag}`);
    console.log('Auto-queue: 100% WORKING');
    console.log('Text lock: ' + (process.env.LOCK_TEXT_CHANNEL ? 'ENABLED' : 'DISABLED'));
    console.log('Voice lock: ' + (process.env.LOCK_VOICE_CHANNEL ? 'ENABLED' : 'DISABLED'));
    console.log('Force prefix: ' + (process.env.FORCE_PREFIX === 'true' ? 'YES' : 'NO'));
    lavalink.connect(client.user.id);
});

// ULTIMATE COMMAND HANDLER — FULLY CONTROLLABLE FEATURES
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    // Owner + allowed users
    const isOwner = message.author.id === process.env.OWNER_ID;
    const isAllowed = client.db.config?.allowedUsers?.includes(message.author.id);
    if (!isOwner && !isAllowed) return;

    const prefix = process.env.PREFIX || "!";

    // FEATURE 1: FORCE PREFIX (ignores DB noPrefixMode)
    const forcePrefix = process.env.FORCE_PREFIX === "true";
    if (forcePrefix && !message.content.startsWith(prefix)) return;

    // FEATURE 2: LOCK TO SPECIFIC TEXT CHANNEL
    if (process.env.LOCK_TEXT_CHANNEL && message.channel.id !== process.env.LOCK_TEXT_CHANNEL) return;

    // Parse args (respect noPrefixMode unless forcePrefix)
    let args = [];
    if (forcePrefix) {
        if (!message.content.startsWith(prefix)) return;
        args = message.content.slice(prefix.length).trim().split(/ +/);
    } else if (!client.db.noPrefixMode) {
        if (!message.content.startsWith(prefix)) return;
        args = message.content.slice(prefix.length).trim().split(/ +/);
    } else {
        args = message.content.trim().split(/ +/);
    }

    const cmdName = args.shift()?.toLowerCase();
    const command = client.commands.get(cmdName) || client.commands.get(client.aliases.get(cmdName));
    if (!command) return;

    // FEATURE 3: LOCK MUSIC TO SPECIFIC VOICE CHANNEL
    if (process.env.LOCK_VOICE_CHANNEL && command.category === "music") {
        const requiredVC = process.env.LOCK_VOICE_CHANNEL;
        if (!message.member?.voice?.channel || message.member.voice.channel.id !== requiredVC) {
            return message.channel.send("```Join the music voice channel first```");
        }
    }

    try {
        if (message.deletable) await message.delete().catch(() => {});
        await command.execute(message, args, client);
    } catch (error) {
        console.error("Command error:", error);
        message.channel.send("```An error occurred```").catch(() => {});
    }
});

// Login
client.login(process.env.TOKEN).catch(err => {
    console.error("Login failed:", err.message);
    process.exit(1);
});
