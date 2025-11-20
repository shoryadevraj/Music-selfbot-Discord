export default {
  name: 'clearfilter',
  aliases: ['cf', 'clearfilters'],
  category: 'music',
  description: 'Clear all audio filters',
  usage: 'clearfilter',
  async execute(message, args, client) {
    if (!message.guild) {
      await message.channel.send('``````');
      return;
    }

    const queue = client.queueManager.get(message.guild.id);
    if (!queue || !queue.nowPlaying) {
      await message.channel.send('``````');
      return;
    }

    queue.filters = {};
    
    try {
      // Clear filters using the new method (won't restart)
      await client.lavalink.updatePlayerProperties(message.guild.id, {
        filters: {}
      });

      let response = '```js\n';
      response += '  🎛️ All filters removed\n';
      response += '  ✅ Audio reset to normal\n';
      response += '\n╰──────────────────────────────────╯\n```';

      await message.channel.send(response);

    } catch (err) {
      console.error('[ClearFilter Error]:', err);
      await message.channel.send('``````');
    }
  }
};
