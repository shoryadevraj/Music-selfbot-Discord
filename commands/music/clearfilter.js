export default {
  name: 'clearfilter',
  aliases: ['cf', 'clearfilters'],
  category: 'music',
  description: 'Clear all audio filters',
  usage: 'clearfilter',
  async execute(message, args, client) {
    if (!message.guild) {
      await message.channel.send('This command can only be used in a server.');
      return;
    }

    const queue = client.queueManager.get(message.guild.id);
    if (!queue || !queue.nowPlaying) {
      await message.channel.send('Nothing is playing right now.');
      return;
    }

    queue.filters = {};
    
    try {
      // Clear filters using the new method (won't restart)
      await client.lavalink.updatePlayerProperties(message.guild.id, {
        filters: {}
      });

      await message.channel.send('All filters have been removed. Audio is now normal.');

    } catch (err) {
      console.error('[ClearFilter Error]:', err);
      await message.channel.send('Failed to clear filters.');
    }
  }
};
