import { joinVoiceChannel } from "@discordjs/voice";

export default {
    name: "play",
    aliases: ["p"],
    category: "music",

    async execute(message, args, client) {
        if (!message.guild) return;
        const vc = message.member?.voice?.channel;
        if (!vc) return message.channel.send("Join a voice channel first");
        if (!args.length) return message.channel.send("Give me a song name or URL");

        const query = args.join(" ");

        try {
            // Join voice
            joinVoiceChannel({
                channelId: vc.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
                selfDeaf: true,
            });

            await new Promise(r => setTimeout(r, 1500));

            const vs = client.voiceStates[message.guild.id];
            if (!vs?.sessionId) return message.channel.send("Voice not ready yet");

            // CORRECT SEARCH METHOD FOR YOUR LAVALINK — loadTracks
            const result = await client.lavalink.loadTracks(
                query.startsWith("http") ? query : `ytsearch:${query}`
            );

            // CORRECT FORMAT HANDLING — YOUR LAVALINK USES loadType + data
            if (result.loadType === "empty" || !result.data) {
                return message.channel.send("No results found");
            }

            let track;
            if (result.loadType === "track") {
                track = result.data;
            } else if (result.loadType === "playlist" || result.loadType === "search") {
                track = result.data[0];  // First result
            } else {
                return message.channel.send("Invalid result type");
            }

            if (!track.info) return message.channel.send("Invalid track");

            // Queue handling
            let queue = client.queueManager.get(message.guild.id);
            if (!queue) {
                queue = client.queueManager.create(message.guild.id);
                queue.textChannel = message.channel;
            }

            // If already playing → queue it
            if (queue.nowPlaying) {
                client.queueManager.addSong(message.guild.id, track);
                return message.react("➕").catch(() => {});  // Added to queue
            }

            // Play now + auto-queue timer
            await client.startTrack(message.guild.id, track);
            message.react("▶️").catch(() => {});  // Playing

        } catch (error) {
            console.error("[PLAY ERROR]:", error.message);
            message.channel.send("Failed to play").catch(() => {});
        }
    }
};
