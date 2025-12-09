export default {
    name: "skip",
    aliases: ["s"],

    async execute(message, args, client) {
        const queue = client.queueManager.get(message.guild.id);
        if (!queue?.nowPlaying) return;

        // Clear current timeout and play next
        if (client.trackTimeouts.has(message.guild.id)) {
            clearTimeout(client.trackTimeouts.get(message.guild.id));
        }

        await client.playNext(message.guild.id);
        message.react("skip").catch(() => {});
    }
};
