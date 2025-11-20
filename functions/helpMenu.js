import { createCanvas } from "@napi-rs/canvas";

/**
 * generateHelpMenu(client, category = null)
 * - returns { files: [{ attachment: Buffer, name }] } on success
 * - returns string (text fallback) on failure
 */

export async function generateHelpMenu(client, category = null) {
  const commands = Array.from(client.commands.values());

  if (!category) {
    return await generateHomepage(client, commands);
  }

  const filtered = commands.filter(
    (cmd) => cmd.category && cmd.category.toLowerCase() === category.toLowerCase()
  );

  if (filtered.length === 0) {
    return await generateHomepage(client, commands, `Category "${category}" not found!`);
  }

  return await generateCategoryHelp(client, filtered, category);
}

/* -------------------------
   Helpers to build data
   ------------------------- */
function buildCategoryMap(commands) {
  const categories = {};
  commands.forEach((cmd) => {
    const cat = cmd.category ? String(cmd.category) : "uncategorized";
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(cmd);
  });
  return categories;
}

/* -------------------------
   Homepage wrapper
   ------------------------- */
async function generateHomepage(client, commands, errorMsg = null) {
  const categories = buildCategoryMap(commands);
  try {
    const imageBuffer = await generateHomepageImage(categories, errorMsg);
    return { files: [{ attachment: imageBuffer, name: "help.png" }] };
  } catch (err) {
    console.error("Help image generation failed:", err?.message || err);
    return generateHomepageText(categories, errorMsg);
  }
}

/* -------------------------
   Category wrapper
   ------------------------- */
async function generateCategoryHelp(client, commands, categoryName) {
  try {
    const imageBuffer = await generateCategoryImage(commands, categoryName);
    return { files: [{ attachment: imageBuffer, name: "commands.png" }] };
  } catch (err) {
    console.error("Category image generation failed:", err?.message || err);
    return generateCategoryText(commands, categoryName);
  }
}

/* -------------------------------------------------
   Canvas constants & small helpers
   ------------------------------------------------- */
const WIDTH = 1280;
const HEIGHT = 720;
const PADDING = 28;

const PALETTE = {
  bgTop: "#071014",
  bgBottom: "#0f1c1e",
  cardBg: "rgba(255,255,255,0.04)",
  cardBorder: "rgba(24,255,255,0.10)",
  accent: "#18ffff",
  text: "#eaf6f6",
  dim: "rgba(234,246,246,0.65)",
  gold: "#ffd166",
};

const FONTS = {
  title: '700 28px "Inter", sans-serif',
  subtitle: '400 14px "Inter", sans-serif',
  section: '600 20px "Inter", sans-serif',
  itemTitle: '600 18px "Inter", sans-serif',
  itemDesc: '400 14px "Inter", sans-serif',
  footer: '400 12px "Inter", sans-serif',
};

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* draw background */
function drawBackground(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  g.addColorStop(0, PALETTE.bgTop);
  g.addColorStop(1, PALETTE.bgBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // faint diagonal lines for depth (very subtle)
  ctx.strokeStyle = "rgba(255,255,255,0.02)";
  ctx.lineWidth = 1;
  for (let i = -WIDTH; i < WIDTH * 2; i += 56) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + WIDTH, HEIGHT);
    ctx.stroke();
  }
}

/* draw centered glass card */
function drawCard(ctx, x, y, w, h) {
  roundedRect(ctx, x, y, w, h, 12);
  ctx.fillStyle = PALETTE.cardBg;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = PALETTE.cardBorder;
  ctx.stroke();
}

/* draw category pill */
function drawPill(ctx, x, y, w, h, label, count) {
  roundedRect(ctx, x, y, w, h, 10);
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  ctx.fill();
  ctx.strokeStyle = "rgba(24,255,255,0.06)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = PALETTE.accent;
  ctx.font = FONTS.section;
  ctx.fillText(label.toUpperCase(), x + 16, y + 34);

  // count bubble
  const bubbleW = 44;
  roundedRect(ctx, x + w - bubbleW - 12, y + 8, bubbleW, h - 16, 8);
  ctx.fillStyle = "rgba(24,255,255,0.12)";
  ctx.fill();
  ctx.fillStyle = "#001818";
  ctx.font = '600 14px "Inter", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText(String(count), x + w - bubbleW / 2 - 12, y + 32);
  ctx.textAlign = "left";
}

/* draw one command row (compact) */
function drawCommandRow(ctx, x, y, w, cmd) {
  // strip background
  roundedRect(ctx, x, y, w, 86, 10);
  ctx.fillStyle = "rgba(255,255,255,0.02)";
  ctx.fill();
  ctx.strokeStyle = "rgba(24,255,255,0.04)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // title
  ctx.fillStyle = PALETTE.accent;
  ctx.font = FONTS.itemTitle;
  ctx.fillText(cmd.name, x + 18, y + 34);

  // desc (trim to fit)
  ctx.fillStyle = PALETTE.gold;
  ctx.font = FONTS.itemDesc;
  let desc = cmd.description || "No description";
  while (ctx.measureText(desc).width > w - 200 && desc.length > 10) desc = desc.slice(0, -1);
  if (desc !== (cmd.description || "")) desc = desc.slice(0, -3) + "...";
  ctx.fillText(desc, x + 18, y + 62);

  // usage right aligned
  ctx.fillStyle = PALETTE.text;
  ctx.font = '400 12px "Inter", sans-serif';
  ctx.textAlign = "right";
  ctx.fillText(cmd.usage || "", x + w - 18, y + 36);
  ctx.textAlign = "left";
}

/* -------------------------------------------------
   Generate homepage image
   ------------------------------------------------- */
async function generateHomepageImage(categories, errorMsg = null) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  drawBackground(ctx);

  // header
  ctx.fillStyle = PALETTE.text;
  ctx.font = '700 26px "Inter", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("ROCK SELFBOT — COMMANDS", WIDTH / 2, 60);

  ctx.fillStyle = PALETTE.dim;
  ctx.font = FONTS.subtitle;
  ctx.fillText("Premium command dashboard — Created by Quantheon Development", WIDTH / 2, 86);

  // central card
  const cardW = WIDTH - PADDING * 4;
  const cardH = HEIGHT - 160;
  const cardX = PADDING * 2;
  const cardY = 110;
  drawCard(ctx, cardX, cardY, cardW, cardH);

  // Title inside card
  ctx.fillStyle = PALETTE.accent;
  ctx.font = '700 20px "Inter", sans-serif';
  ctx.textAlign = "left";
  ctx.fillText("Available Categories", cardX + 22, cardY + 44);

  // Error badge if needed
  if (errorMsg) {
    roundedRect(ctx, cardX + cardW - 360, cardY + 22, 320, 40, 10);
    ctx.fillStyle = "rgba(255,99,99,0.12)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,99,99,0.22)";
    ctx.stroke();

    ctx.fillStyle = "#ff6b6b";
    ctx.font = '600 14px "Inter", sans-serif';
    ctx.fillText(errorMsg, cardX + cardW - 336, cardY + 48);
  }

  // draw category pills (grid)
  const catNames = Object.keys(categories).sort((a, b) => a.localeCompare(b));
  const pillsPerRow = 3;
  const gap = 20;
  const pillW = Math.floor((cardW - 80 - (pillsPerRow - 1) * gap) / pillsPerRow);
  let rx = cardX + 22;
  let ry = cardY + 80;

  for (let i = 0; i < catNames.length; i++) {
    const cat = catNames[i];
    drawPill(ctx, rx, ry, pillW, 56, cat, categories[cat].length);

    rx += pillW + gap;
    if ((i + 1) % pillsPerRow === 0) {
      rx = cardX + 22;
      ry += 76;
    }
  }

  // usage & footer inside card bottom
  ctx.fillStyle = PALETTE.dim;
  ctx.font = '400 13px "Inter", sans-serif';
  ctx.fillText(
    `Usage: ${process.env.PREFIX || "!"}help <category>  •  Example: ${process.env.PREFIX || "!"}help music`,
    cardX + 22,
    cardY + cardH - 36
  );

  // footer text
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = FONTS.footer;
  ctx.textAlign = "center";
  ctx.fillText("Created by Quantheon Development • Premium Selfbot Solution", WIDTH / 2, HEIGHT - 16);

  return canvas.toBuffer("image/png");
}

/* -------------------------------------------------
   Generate category image (two-column layout to show all)
   ------------------------------------------------- */
async function generateCategoryImage(commands, categoryName) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  drawBackground(ctx);

  // header
  ctx.fillStyle = PALETTE.text;
  ctx.font = '700 26px "Inter", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText(`${String(categoryName).toUpperCase()} — COMMANDS`, WIDTH / 2, 60);

  ctx.fillStyle = PALETTE.dim;
  ctx.font = FONTS.subtitle;
  ctx.fillText("Created by Quantheon Development", WIDTH / 2, 86);

  // central card
  const cardW = WIDTH - PADDING * 4;
  const cardH = HEIGHT - 160;
  const cardX = PADDING * 2;
  const cardY = 110;
  drawCard(ctx, cardX, cardY, cardW, cardH);

  // left title
  ctx.fillStyle = PALETTE.accent;
  ctx.font = '700 18px "Inter", sans-serif';
  ctx.textAlign = "left";
  ctx.fillText(`${commands.length} Commands`, cardX + 22, cardY + 44);

  // compute two-column layout
  const innerX = cardX + 22;
  const innerY = cardY + 80;
  const innerW = cardW - 44;
  const gutter = 24;
  const colCount = Math.min(2, Math.ceil(commands.length / 4)); // at least 1-2 columns
  const colW = Math.floor((innerW - gutter * (colCount - 1)) / colCount);

  // max rows per column
  const maxRows = Math.floor((cardH - 140) / 110) + 1;
  let index = 0;

  for (let c = 0; c < colCount; c++) {
    let y = innerY;
    const x = innerX + c * (colW + gutter);

    for (let r = 0; r < maxRows && index < commands.length; r++, index++) {
      drawCommandRow(ctx, x, y, colW, commands[index]);
      y += 110;
    }
  }

  // if still commands left (very large categories), indicate how many more
  if (index < commands.length) {
    const remaining = commands.length - index;
    ctx.fillStyle = PALETTE.dim;
    ctx.font = '400 13px "Inter", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText(`... and ${remaining} more commands not shown ...`, WIDTH / 2, cardY + cardH - 56);
  }

  // footer
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = FONTS.footer;
  ctx.textAlign = "center";
  ctx.fillText("Created by Quantheon Development • Premium Selfbot Solution", WIDTH / 2, HEIGHT - 16);

  return canvas.toBuffer("image/png");
}

/* -------------------------------------------------
   Text fallback generators
   ------------------------------------------------- */
function generateHomepageText(categories, errorMsg = null) {
  const keys = Object.keys(categories).sort((a, b) => a.localeCompare(b));
  let out = "```\nROCK SELFBOT - CATEGORIES\n\n";
  if (errorMsg) out += `ERROR: ${errorMsg}\n\n`;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    out += `${String(i + 1).padStart(2, "0")}. ${k.toUpperCase()} (${categories[k].length})\n`;
  }
  out += `\nUsage: ${process.env.PREFIX || "!"}help <category>\n`;
  out += "\nCreated by Quantheon Development\n```";
  return out;
}

function generateCategoryText(commands, categoryName) {
  let out = "```\n";
  out += `${String(categoryName).toUpperCase()} - COMMANDS\n\n`;
  for (let i = 0; i < commands.length; i++) {
    const c = commands[i];
    out += `${String(i + 1).padStart(2, "0")}. ${c.name} - ${c.description || "No description"}\n`;
    if (c.usage) out += `     Usage: ${c.usage}\n`;
  }
  out += "\nCreated by Quantheon Development\n```";
  return out;
}

/* -------------------------------------------------
   Default export: command wrapper (keeps your API)
   - Sends image if allowed, otherwise falls back to text
   ------------------------------------------------- */
export default {
  name: "help",
  aliases: ["h", "commands"],
  category: "utility",
  description: "Show premium help menu (compact Spotify-style)",
  usage: "help [category]",

  async execute(message, args, client) {
    const category = args[0] || null;
    const commands = Array.from(client.commands.values());
    const categories = buildCategoryMap(commands);

    try {
      const result = await generateHelpMenu(client, category);

      // Decide if bot can attach files in this channel
      const botMember = message.guild?.members?.me || message.guild?.members?.cache?.get(client.user?.id);
      let canAttach = true;
      try {
        canAttach = !!message.channel.permissionsFor(botMember)?.has("AttachFiles");
      } catch {
        canAttach = true;
      }

      // If generator returned text, send text
      if (typeof result === "string") {
        return await message.channel.send(result);
      }

      // result is image wrapper
      if (!canAttach) {
        // fallback to text representation
        if (!category) {
          return await message.channel.send(generateHomepageText(categories));
        } else {
          const cmds = commands.filter(
            (cmd) => cmd.category && cmd.category.toLowerCase() === category.toLowerCase()
          );
          return await message.channel.send(generateCategoryText(cmds, category));
        }
      }

      // send image
      return await message.channel.send({ files: result.files });
    } catch (err) {
      console.error("Help command error:", err);
      // final fallback
      return await message.channel.send("```\n❌ An error occurred while generating the help menu.\n```");
    }
  },
};
