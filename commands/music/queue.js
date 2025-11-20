import { createCanvas, loadImage } from "@napi-rs/canvas";
import axios from "axios";

export default {
  name: "queue",
  aliases: ["q"],
  category: "music",
  description: "Show current music queue",
  usage: "queue",

  async execute(message, args, client) {
    if (!message.guild) return;

    const queue = client.queueManager.get(message.guild.id);
    if (!queue || !queue.nowPlaying) {
      return message.channel.send("```\n❌ Nothing is playing.\n```");
    }

    // Check if images allowed
    const imagesAllowed = await canSendImages(message.channel);

    if (imagesAllowed) {
      const img = await generateQueueCard(queue);
      await message.channel.send({
        content: "📄 **Music Queue:**",
        files: [{ attachment: img, name: "queue.png" }],
      });
    } else {
      // Text fallback
      await message.channel.send(generateQueueText(queue));
    }

    if (message.deletable) message.delete().catch(() => {});
  },
};

// ------------------------------------------------------------
// Text Fallback
// ------------------------------------------------------------

function generateQueueText(queue) {
  let txt = "```\n";
  txt += "🎵 Now Playing:\n";
  txt += `  ${queue.nowPlaying.info.title}\n`;
  txt += `  by ${queue.nowPlaying.info.author}\n\n`;

  if (queue.songs.length === 0) {
    txt += "📭 No songs in queue\n";
  } else {
    txt += "📝 Up Next:\n";
    queue.songs.slice(0, 10).forEach((song, i) => {
      const index = `[${i + 1}]`.padEnd(5);
      txt += `  ${index}${song.info.title}\n`;
      txt += `       by ${song.info.author}\n`;
    });

    if (queue.songs.length > 10) {
      txt += `\n  ...and ${queue.songs.length - 10} more songs\n`;
    }
  }

  txt += "\n```";
  return txt;
}

// ------------------------------------------------------------
// Queue Card Generator (Spotify-style)
// ------------------------------------------------------------

async function generateQueueCard(queue) {
  const width = 900;
  const height = 600;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#0f0f0f");
  gradient.addColorStop(1, "#1a1a1a");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Title
  ctx.fillStyle = "#fff";
  ctx.font = "40px Sans";
  ctx.fillText("Music Queue", 30, 60);

  // ----- NOW PLAYING PANEL -----

  ctx.fillStyle = "#181818";
  roundRect(ctx, 20, 80, 860, 140, 15);
  ctx.fill();

  const np = queue.nowPlaying;
  const npThumbURL =
    np.info.artworkUrl ||
    `https://img.youtube.com/vi/${np.info.identifier}/hqdefault.jpg`;

  let npThumb = null;
  try {
    const res = await axios.get(npThumbURL, { responseType: "arraybuffer" });
    npThumb = await loadImage(res.data);
  } catch {}

  if (npThumb) ctx.drawImage(npThumb, 35, 95, 110, 110);
  else {
    ctx.fillStyle = "#333";
    ctx.fillRect(35, 95, 110, 110);
  }

  ctx.fillStyle = "#fff";
  ctx.font = "bold 28px Sans";
  wrapText(ctx, np.info.title, 160, 120, 700, 30);

  ctx.fillStyle = "#ccc";
  ctx.font = "22px Sans";
  wrapText(ctx, np.info.author, 160, 170, 700, 26);

  // ----- UP NEXT LIST -----

  ctx.fillStyle = "#fff";
  ctx.font = "28px Sans";
  ctx.fillText("Up Next", 30, 260);

  const songs = queue.songs.slice(0, 10);

  let startY = 300;

  for (let i = 0; i < songs.length; i++) {
    const song = songs[i];

    ctx.fillStyle = "#181818";
    roundRect(ctx, 20, startY - 30, 860, 70, 10);
    ctx.fill();

    // Song number
    ctx.fillStyle = "#999";
    ctx.font = "22px Sans";
    ctx.fillText(`#${i + 1}`, 40, startY + 10);

    // Title
    ctx.fillStyle = "#fff";
    ctx.font = "24px Sans";
    wrapText(ctx, song.info.title, 120, startY - 5, 700, 28);

    // Author
    ctx.fillStyle = "#ccc";
    ctx.font = "20px Sans";
    wrapText(ctx, song.info.author, 120, startY + 25, 700, 24);

    startY += 85;
  }

  // Footer
  ctx.fillStyle = "#555";
  ctx.font = "18px Sans";
  ctx.fillText("Created by Quantheon Development", width - 300, height - 20);

  return canvas.toBuffer("image/png");
}

// ------------------------------------------------------------
// Canvas Helpers
// ------------------------------------------------------------

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";

  for (const word of words) {
    const test = line + word + " ";
    if (ctx.measureText(test).width > maxWidth) {
      ctx.fillText(line, x, y);
      line = word + " ";
      y += lineHeight;
    } else {
      line = test;
    }
  }

  ctx.fillText(line, x, y);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

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
