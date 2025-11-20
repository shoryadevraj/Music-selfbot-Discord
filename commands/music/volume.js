export default {
  name: 'volume',
  aliases: ['vol', 'v'],
  category: 'music',
  description: 'Set volume (0-200)',
  usage: 'volume <0-200>',
  async execute(message, args, client) {
    if (!message.guild) {
      await message.channel.send('``````');
      return;
    }

    const queue = client.queueManager.get(message.guild.id);
    if (!queue) {
      await message.channel.send('``````');
      return;
    }

    const vol = parseInt(args[0]);
    if (isNaN(vol) || vol < 0 || vol > 200) {
      await message.channel.send('``````');
      return;
    }

    queue.volume = vol;
    
    try {
      // Update ONLY volume using the new method (won't restart)
      await client.lavalink.updatePlayerProperties(message.guild.id, {
        volume: vol
      });

      const volumeBar = '█'.repeat(Math.floor(vol / 10)) + '░'.repeat(20 - Math.floor(vol / 10));
      
      let response = '```js\n';
      response += `  🔊 Volume: ${vol}%\n`;
      response += `  [${volumeBar}]\n`;
      response += '\n╰──────────────────────────────────╯\n```';

      await message.channel.send(response);

    } catch (err) {
      console.error('[Volume Error]:', err);
      await message.channel.send('``````');
    }
  }
};
