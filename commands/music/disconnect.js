import { getVoiceConnection } from '@discordjs/voice';

export default {
  name: 'disconnect',
  aliases: ['dc', 'leave'],
  category: 'music',
  description: 'Disconnect from voice channel',
  usage: 'disconnect',
  async execute(message, args, client) {
    if (!message.guild) {
      await message.channel.send('``````');
      return;
    }

    const guildId = message.guild.id;
    
    try {
      // Destroy Lavalink player
      await client.lavalink.destroyPlayer(guildId);
      
      // Clear queue
      client.queueManager.delete(guildId);
      
      // Disconnect from voice channel
      const connection = getVoiceConnection(guildId);
      if (connection) {
        connection.destroy();
      }
      
      await message.channel.send('👍');

      if (message.deletable) {
        await message.delete().catch(() => {});
      }
    } catch (err) {
      console.error('[DC Error]:', err);
      await message.channel.send('``````');
    }
  },
};
