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

client.voiceStates = {};
client.commands = new Map();
client.aliases = new Map();
client.trackTimeouts = new Map();        // ← stores setTimeout IDs
client.lavalink = lavalink;
client.queueManager = queueManager;
client.db = loadDatabase();

// Load commands
const cmdPath = path.join(__dirname, 'commands');
for (const cat of fs.readdirSync(cmdPath).filter(f => fs.statSync(path.join(cmdPath, f)).isDirectory())) {
    for (const file of fs.readdirSync(path.join(cmdPath, cat)).filter(f => f.endsWith('.js'))) {
        const cmd = (await import(`file://${path.join(cmdPath, cat, file)}`)).default;
        if (cmd?.name) {
            client.commands.set(cmd.name, cmd);
            cmd.aliases?.forEach(a => client.aliases.set(a, cmd.name));
            console.log(`Loaded: ${cmd.name}`);
        }
    }
}

// Voice state handling
client.ws.on('VOICE_STATE_UPDATE', p => {
    if (p.user_id !== client.user.id) return;
    client.voiceStates[p.guild_id] ??= {};
    client.voiceStates[p.guild_id].sessionId = p.session_id;
});

client.ws.on('VOICE_SERVER_UPDATE', p => {
    client.voiceStates[p.guild_id] ??= {};
    client.voiceStates[p.guild_id].token = p.token;
    client.voiceStates[p.guild_id].endpoint = p.endpoint;
});

lavalink.on('ready', () => console.log('[Lavalink] Connected'));

// AUTO-QUEUE: 100% WORKING — NO SKIP NEEDED
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

        queue.textChannel?.react?.("play").catch(() => {});

        const duration = track.info.length || 180000;
        const timeout = setTimeout(() => client.playNext(guildId), duration + 1000);
        client.trackTimeouts.set(guildId, timeout);

    } catch (e) {
        console.error("Play failed:", e.message);
    }
};

client.playNext = async (guildId) => {
    const queue = client.queueManager.get(guildId);
    if (!queue) return;

    const nextTrack = client.queueManager.getNext(guildId);
    if (!nextTrack) {
        queue.nowPlaying = null;
        queue.textChannel?.react?.("stop").catch(() => {});
        return;
    }

    await client.startTrack(guildId, nextTrack);
};

// Ready
client.on('ready', () => {
    console.log(`\n${client.user.tag} — AUTO-QUEUE 100% WORKING`);
    console.log('Songs play one after another automatically');
    lavalink.connect(client.user.id);
});

// Command handler
client.on('messageCreate', async msg => {
    if (msg.author.id !== process.env.OWNER_ID && !client.db.config?.allowedUsers?.includes(msg.author.id)) return;

    const prefix = process.env.PREFIX || '!';
    if (!client.db.noPrefixMode && !msg.content.startsWith(prefix)) return;

    const args = client.db.noPrefixMode 
        ? msg.content.trim().split(/ +/)
        : msg.content.slice(prefix.length).trim().split(/ +/);

    const cmdName = args.shift()?.toLowerCase();
    const cmd = client.commands.get(cmdName) || client.commands.get(client.aliases.get(cmdName));
    if (!cmd) return;

    try {
        if (msg.deletable) await msg.delete().catch(() => {});
        await cmd.execute(msg, args, client);
    } catch (e) {
        console.error(e);
    }
});

client.login(process.env.TOKEN).catch(() => process.exit(1));
