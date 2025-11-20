import 'dotenv/config';
import { Client } from 'discord.js-selfbot-v13';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadDatabase, saveDatabase } from './functions/database.js';
import Lavalink from './functions/lavalink.js';
import queueManager from './functions/queue.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Selfbot client
const client = new Client({
    checkUpdate: false
});

// Lavalink instance
const lavalink = new Lavalink({
    restHost: process.env.LAVALINK_REST,
    wsHost: process.env.LAVALINK_WS,
    password: process.env.LAVALINK_PASSWORD,
    clientName: process.env.CLIENT_NAME || 'Selfbot',
});

// Store voice states
client.voiceStates = {};

// Collections
client.commands = new Map();
client.aliases = new Map();
client.cooldowns = new Map();
client.deletedMessages = new Map();

client.lavalink = lavalink;
client.queueManager = queueManager;

// Load DB
client.db = loadDatabase();

// Load commands
const categoriesPath = path.join(__dirname, 'commands');
const categories = fs.readdirSync(categoriesPath).filter(f =>
    fs.statSync(path.join(categoriesPath, f)).isDirectory()
);

console.log('\n╭─────────────────────────╮');
console.log('│   Loading Commands...   │');
console.log('╰─────────────────────────╯\n');

for (const category of categories) {
    const commandsPath = path.join(categoriesPath, category);
    const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = (await import(`file://${filePath}`)).default;

        if (!command?.name) continue;

        client.commands.set(command.name, command);

        if (Array.isArray(command.aliases)) {
            command.aliases.forEach(alias => client.aliases.set(alias, command.name));
        }

        console.log(`✓ Loaded: ${command.name} (${category})`);
    }
}

console.log(`\n✓ Loaded ${client.commands.size} commands\n`);


// Deleted message snipe
client.on('messageDelete', message => {
    if (!message || !message.content) return;

    client.deletedMessages.set(message.channel.id, {
        content: message.content,
        author: message.author.tag,
        authorId: message.author.id,
        timestamp: Date.now()
    });

    setTimeout(() => client.deletedMessages.delete(message.channel.id), 60000);
});


// Lavalink voice events
client.ws.on('VOICE_STATE_UPDATE', p => {
    if (p.user_id !== client.user.id) return;

    if (!client.voiceStates[p.guild_id]) client.voiceStates[p.guild_id] = {};
    client.voiceStates[p.guild_id].sessionId = p.session_id;
});

client.ws.on('VOICE_SERVER_UPDATE', p => {
    if (!client.voiceStates[p.guild_id]) client.voiceStates[p.guild_id] = {};
    Object.assign(client.voiceStates[p.guild_id], {
        token: p.token,
        endpoint: p.endpoint
    });
});


// Lavalink ready
lavalink.on('ready', () => console.log('[Lavalink] Connected'));


// Allowed users
function getAllowedUsers() {
    return client.db.config.allowedUsers || [];
}

function isAllowedUser(id) {
    if (id === process.env.OWNER_ID) return true;
    return getAllowedUsers().includes(id);
}


// Ready event
client.on('ready', () => {
    console.log('\n╭─────────────────────────╮');
    console.log('│   Selfbot Connected!    │');
    console.log('╰─────────────────────────╯');
    console.log(`User: ${client.user.username}`);
    console.log(`Prefix: ${process.env.PREFIX}`);
    console.log(`Allowed Users: ${getAllowedUsers().length}`);
    console.log(`No-Prefix Mode: ${client.db.noPrefixMode}`);
    console.log('──────────────────────────\n');

    lavalink.connect(client.user.id);
});


// Command handler
client.on('messageCreate', async message => {
    if (!isAllowedUser(message.author.id)) return;

    const prefix = process.env.PREFIX;
    const noPrefixMode = client.db.noPrefixMode;

    let text = message.content;
    let hasPrefix = text.startsWith(prefix);

    let parts = [];

    if (noPrefixMode) {
        parts = text.trim().split(/\s+/);
    } else if (hasPrefix) {
        parts = text.slice(prefix.length).trim().split(/\s+/);
    } else return;

    const cmdName = parts.shift().toLowerCase();
    const cmd = client.commands.get(cmdName) || client.commands.get(client.aliases.get(cmdName));
    if (!cmd) return;

    try {
        if (message.deletable) message.delete().catch(() => {});
        await cmd.execute(message, parts, client);
    } catch (e) {
        console.error(e);
        message.channel.send(`\`\`\`js\nError: ${e.message}\n\`\`\``).catch(() => {});
    }
});


// Error handling
client.on('error', err => console.error('Client Error:', err));
process.on('unhandledRejection', err => console.error('Unhandled Rejection:', err));


// Login
client.login(process.env.TOKEN).catch(err => {
    console.error('Login Failed:', err);
    process.exit(1);
});
