import { createCanvas, loadImage } from "@napi-rs/canvas";
import axios from "axios";

// ------------------------------------------------------------
// Now Playing Command
// ------------------------------------------------------------

export default {
  name: "nowplaying",
  aliases: ["np", "current"],
  category: "music",
  description: "Show the currently playing track",
  usage: "nowplaying",

  async execute(message, args, client) {
    if (!message.guild) return;

    const queue = client.queueManager.get(message.guild.id);
    if (!queue || !queue.nowPlaying) {
      return message.channel.send("```\n❌ Nothing is playing.\n```");
    }

    const track = queue.nowPlaying;

    // Check if images are allowed
    const imagesAllowed = await canSendImages(message.channel);

    if (imagesAllowed) {
      const img = await generateNowPlayingCard(track, queue);
      await message.channel.send({
        content: "🎧 **Now Playing:**",
        files: [{ attachment: img, name: "nowplaying.png" }],
      });
    } else {
      // Fallback Text
      await message.channel.send(
        "```\n" +
          `🎵 ${track.info.title}\n` +
          `👤 ${track.info.author}\n` +
          `⏱️ ${formatDuration(track.info.length)}\n` +
          `🔊 Volume: ${queue.volume}%\n` +
          `📝 Queue: ${queue.songs.length} songs\n` +
          "```"
      );
    }

    if (message.deletable) message.delete().catch(() => {});
  },
};

// ------------------------------------------------------------
// Card Generator (same theme as PLAY command)
// ------------------------------------------------------------

async function generateNowPlayingCard(track, queue) {
  const width = 900;
  const height = 300;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#0f0f0f");
  gradient.addColorStop(1, "#1a1a1a");
  ctx.fillStyle = gradient;
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

  if (thumbnail) ctx.drawImage(thumbnail, 20, 20, 260, 260);
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
  ctx.fillText(`Duration: ${formatDuration(track.info.length)}`, 310, 210);

  // Volume + Queue Count
  ctx.fillStyle = "#aaa";
  ctx.font = "20px Sans";
  ctx.fillText(`Volume: ${queue.volume}%`, 310, 245);
  ctx.fillText(`Queue: ${queue.songs.length} songs`, 310, 275);

  // Branding
  ctx.fillStyle = "#555";
  ctx.font = "18px Sans";
  ctx.fillText("Created by Quantheon Development", width - 300, height - 20);

  return canvas.toBuffer("image/png");
}

// ------------------------------------------------------------
// Utilities
// ------------------------------------------------------------

async function canSendImages(channel) {
  try {
    const test = Buffer.from([0]);
    const msg = await channel.send({
      files: [{ attachment: test, name: "test.png" }],
    });
    msg.delete().catch(() => {});
    return true;
  } catch {
    return false;
  }
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  for (const word of words) {
    const test = line + word + " ";
    if (ctx.measureText(test).width > maxWidth) {
      ctx.fillText(line, x, y);
      line = word + " ";
      y += lineHeight;
    } else line = test;
  }
  ctx.fillText(line, x, y);
}

function formatDuration(ms) {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
