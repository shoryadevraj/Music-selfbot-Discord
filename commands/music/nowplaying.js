export default {
  name: "nowplaying",
  aliases: ["np", "current"],
  category: "music",
  description: "Show the currently playing track",

  async execute(message, args, client) {
    if (!message.guild) return;

    const queue = client.queueManager.get(message.guild.id);
    if (!queue || !queue.nowPlaying) {
      return message.channel.send("```Nothing is playing right now```");
    }

    const track = queue.nowPlaying;
    const duration = formatDuration(track.info.length);

    let response = '```js\n';
    response += 'Now Playing\n\n';
    response += ` ${track.info.title}\n`;
    response += `\n ${track.info.author}\n`;
    response += `\n Duration: ${duration}\n`;
    response += ` Volume: ${queue.volume}%\n`;
    response += ` Queue: ${queue.songs.length} song${queue.songs.length === 1 ? '' : 's'}\n`;
    response += '\n╰──────────────────────────────────╯\n```';

    await message.channel.send(response);

    // Optional: delete the command message for clean chat
    if (message.deletable) message.delete().catch(() => {});
  }
};

function formatDuration(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
