import { joinVoiceChannel } from "@discordjs/voice";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import axios from "axios";

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function createIdentifier(q) {
  return /^(https?:\/\/|www\.)/i.test(q) ? q : `ytsearch:${q}`;
}


function formatDuration(ms) {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Selfbot-safe attachment permission check
async function canSendImages(channel) {
  try {
    const test = Buffer.from([0]); // 1-byte fake PNG
    const msg = await channel.send({
      files: [{ attachment: test, name: "test.png" }],
    });
    msg.delete().catch(() => {});
    return true;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------
// Canvas Card
// ------------------------------------------------------------

async function generateNowPlayingCard(track) {
  const width = 900;
  const height = 300;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Background
  const g = ctx.createLinearGradient(0, 0, width, height);
  g.addColorStop(0, "#0f0f0f");
  g.addColorStop(1, "#1a1a1a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);

  // Thumbnail
  const thumbURL =
    track.info.artworkUrl ||
    `https://img.youtube.com/vi/${track.info.identifier}/maxresdefault.jpg`;

  let thumbnail = null;
  try {
    const res = await axios.get(thumbURL, { responseType: "arraybuffer" });
    thumbnail = await loadImage(res.data);
  } catch {}

  if (thumbnail)
    ctx.drawImage(thumbnail, 20, 20, 260, 260);
  else {
    ctx.fillStyle = "#222";
    ctx.fillRect(20, 20, 260, 260);
  }

  // Title
  ctx.fillStyle = "#fff";
  ctx.font = "bold 34px Sans";
  wrapText(ctx, track.info.title, 310, 60, 560, 40);

  // Artist
  ctx.fillStyle = "#ccc";
  ctx.font = "25px Sans";
  wrapText(ctx, track.info.author, 310, 150, 560, 30);

  // Duration
  ctx.fillStyle = "#aaa";
  ctx.font = "22px Sans";
  ctx.fillText(`Duration: ${formatDuration(track.info.length)}`, 310, 220);

  // Branding
  ctx.fillStyle = "#555";
  ctx.font = "18px Sans";
  ctx.fillText("Created by Quantheon Development", width - 300, height - 20);

  return canvas.toBuffer("image/png");
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  for (const word of words) {
    const testLine = line + word + " ";
    if (ctx.measureText(testLine).width > maxWidth) {
      ctx.fillText(line, x, y);
      line = word + " ";
      y += lineHeight;
    } else line = testLine;
  }
  ctx.fillText(line, x, y);
}

// ------------------------------------------------------------
// PLAY COMMAND
// ------------------------------------------------------------

export default {
  name: "play",
  aliases: ["p"],
  category: "music",
  description: "Play a song from YouTube or URL",
  usage: "play <name | URL>",

  async execute(message, args, client) {
    if (!message.guild) return;
    const vc = message.member?.voice?.channel;

    if (!vc)
      return message.channel.send("```\n❌ Join a voice channel first.\n```");

    if (!args.length)
      return message.channel.send("```\n❌ Provide a song name.\n```");

    try {
      // Join voice channel
      joinVoiceChannel({
        channelId: vc.id,
        guildId: vc.guild.id,
        adapterCreator: vc.guild.voiceAdapterCreator,
        selfDeaf: false,
      });

      // Voice state takes time to register → more stable wait
      await new Promise((r) => setTimeout(r, 1500));

      const state = client.voiceStates[message.guild.id];
      if (!state?.token || !state?.sessionId || !state?.endpoint)
        return message.channel.send("```\n❌ Voice state not ready.\n```");

      // Load track
      const query = createIdentifier(args.join(" "));
      const result = await client.lavalink.loadTracks(query);

      if (result.loadType === "empty")
        return message.channel.send("```\n❌ No results found.\n```");

      if (result.loadType === "error")
        return message.channel.send(`\`\`\`js\n❌ ${result.data.message}\n\`\`\``);

      let track =
        result.loadType === "track"
          ? result.data
          : result.loadType === "playlist"
          ? result.data.tracks[0]
          : result.data[0];

      if (!track)
        return message.channel.send("```\n❌ Unable to load track.\n```");

      // Queue system
      let queue = client.queueManager.get(message.guild.id);
      if (!queue) {
        queue = client.queueManager.create(message.guild.id);
        queue.textChannel = message.channel;
      }

      // Add to queue
      if (queue.nowPlaying) {
        client.queueManager.addSong(message.guild.id, track);

        return message.channel.send(
          "```\n" +
            `🆙 Added to Queue\n` +
            `🎵 ${track.info.title}\n` +
            `👤 ${track.info.author}\n` +
            `#️⃣ Position: ${queue.songs.length}\n` +
            "```"
        );
      }

      // Play immediately
      queue.nowPlaying = track;
      await client.lavalink.updatePlayer(message.guild.id, track, state, {
        volume: queue.volume,
        filters: queue.filters,
      });

      // Can bot send images?
      const allowed = await canSendImages(message.channel);

      if (allowed) {
        const buffer = await generateNowPlayingCard(track);

        return message.channel.send({
          content: "🎵 **Now Playing:**",
          files: [{ attachment: buffer, name: "nowplaying.png" }],
        });
      }

      // Text Fallback
      return message.channel.send(
        "```\n" +
          `🎵 ${track.info.title}\n` +
          `👤 ${track.info.author}\n` +
          `⏱️ ${formatDuration(track.info.length)}\n` +
          "```"
      );
    } catch (e) {
      console.error("[Play Error]:", e);
      return message.channel.send(`\`\`\`js\n❌ ${e.message}\n\`\`\``);
    }
  },
};
