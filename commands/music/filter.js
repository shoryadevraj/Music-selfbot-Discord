import fetch from 'node-fetch';

const filters = {
  bassboost: {
    equalizer: [
      { band: 0, gain: 0.20 },
      { band: 1, gain: 0.15 },
      { band: 2, gain: 0.10 },
      { band: 3, gain: 0.05 },
      { band: 4, gain: 0.00 },
      { band: 5, gain: 0.00 },
      { band: 6, gain: 0.00 },
      { band: 7, gain: 0.00 },
      { band: 8, gain: 0.00 },
      { band: 9, gain: 0.00 },
      { band: 10, gain: 0.00 },
      { band: 11, gain: 0.00 },
      { band: 12, gain: 0.00 },
      { band: 13, gain: 0.00 },
      { band: 14, gain: 0.00 }
    ]
  },
  nightcore: {
    timescale: {
      speed: 1.25,
      pitch: 1.25,
      rate: 1.0
    }
  },
  vaporwave: {
    timescale: {
      speed: 0.85,
      pitch: 0.90,
      rate: 1.0
    }
  },
  tremolo: {
    tremolo: {
      frequency: 12,
      depth: 0.75
    }
  },
  vibrato: {
    vibrato: {
      frequency: 14,
      depth: 0.75
    }
  },
  distortion: {
    distortion: {
      sinOffset: 0.0,
      sinScale: 1.0,
      cosOffset: 0.0,
      cosScale: 1.0,
      tanOffset: 0.0,
      tanScale: 1.0,
      offset: 0.0,
      scale: 1.0
    }
  },
  rotation: {
    rotation: {
      rotationHz: 0.2
    }
  },
  channelmix: {
    channelMix: {
      leftToLeft: 1.0,
      leftToRight: 0.0,
      rightToLeft: 0.0,
      rightToRight: 1.0
    }
  },
  karaoke: {
    karaoke: {
      level: 1.0,
      monoLevel: 1.0,
      filterBand: 220,
      filterWidth: 100
    }
  },
  lowpass: {
    lowPass: {
      smoothing: 20.0
    }
  }
};

export default {
  name: 'filter',
  aliases: ['fx'],
  category: 'music',
  description: 'Apply audio filter to current track',
  usage: 'filter <filter_name>',
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

    const filterName = args[0]?.toLowerCase();

    if (!filterName || !filters[filterName]) {
      let response = '```js\n';
      response += '╭───🎛️ Available Filters 🎛️───╮\n\n';
      const filterList = Object.keys(filters);
      filterList.forEach((filter, index) => {
        response += `  [${index + 1}] ${filter}\n`;
      });
      response += '\n  Usage: filter <name>\n';
      response += '  Clear: clearfilter\n';
      response += '\n╰──────────────────────────────────╯\n```';
      await message.channel.send(response);
      return;
    }

    queue.filters = filters[filterName];

    try {
      // Update ONLY filters without passing track (prevents restart)
      const url = `${process.env.LAVALINK_REST}/sessions/${client.lavalink.sessionId}/players/${message.guild.id}`;
      
      const payload = {
        filters: queue.filters
      };

      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 
          Authorization: process.env.LAVALINK_PASSWORD, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      let response = '```js\n';
      response += '╭───🎛️ Filter Applied 🎛️───╮\n\n';
      response += `  🎛️ Filter: ${filterName}\n`;
      response += `  🎵 Track: ${queue.nowPlaying.info.title}\n`;
      response += '\n╰──────────────────────────────────╯\n```';
      
      await message.channel.send(response);
    } catch (err) {
      console.error('[Filter Error]:', err);
      await message.channel.send('``````');
    }
  }
};
