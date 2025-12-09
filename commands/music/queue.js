export default {
  name: "queue",
  aliases: ["q"],
  category: "music",
  description: "Show current music queue",
  usage: "queue",

  async execute(message, args, client) {
    if (!message.guild) return;

    const queue = client.queueManager.get(message.guild.id);

    // Nothing playing at all
    if (!queue || (!queue.nowPlaying && queue.songs.length === 0)) {
      return message.channel.send("```Queue is empty```");
    }

    let response = '```js\n';
    response += 'Music Queue\n\n';

    // Now Playing
    if (queue.nowPlaying) {
      response += 'Now Playing\n';
      response += ` ${queue.nowPlaying.info.title}\n`;
      response += ` by ${queue.nowPlaying.info.author}\n\n`;
    }

    // Up Next
    if (queue.songs.length === 0) {
      response += 'No songs in queue\n';
    } else {
      response += `Up Next (${queue.songs.length} song${queue.songs.length === 1 ? '' : 's'})\n\n`;

      queue.songs.slice(0, 15).forEach((song, i) => {
        response += ` ${i + 1}. ${song.info.title}\n`;
        response += `    by ${song.info.author}\n\n`;
      });

      if (queue.songs.length > 15) {
        response += ` ...and ${queue.songs.length - 15} more\n`;
      }
    }

    response += '╰──────────────────────────────────╯\n```';

    await message.channel.send(response);

    // Clean chat — delete the !queue command
    if (message.deletable) {
      message.delete().catch(() => {});
    }
  }
};
