export default {
  name: "help",
  aliases: ["h", "commands"],
  category: "utility",
  description: "Show all commands and categories",
  usage: "help [category]",

  async execute(message, args, client) {
    const prefix = process.env.PREFIX || "!";
    const categoryArg = args[0]?.toLowerCase();

    const commands = Array.from(client.commands.values());
    const categories = {};

    // Group commands by category
    commands.forEach(cmd => {
      const cat = cmd.category ? cmd.category.toLowerCase() : "other";
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(cmd);
    });

    // If a category is specified
    if (categoryArg) {
      const foundCat = Object.keys(categories).find(c => c === categoryArg);
      if (!foundCat) {
        return message.channel.send(`\`\`\`js\nCategory "${categoryArg}" not found!\n\`\`\``);
      }

      const cmds = categories[foundCat];
      let response = '```js\n';
      response += `${foundCat.toUpperCase()} COMMANDS\n\n`;

      cmds.forEach((cmd, i) => {
        response += `${String(i + 1).padStart(2)}. ${cmd.name}`;
        if (cmd.aliases && cmd.aliases.length > 0) {
          response += ` (${cmd.aliases.join(", ")})`;
        }
        response += `\n   ${cmd.description || "No description"}\n`;
        if (cmd.usage) {
          response += `   Usage: ${prefix}${cmd.usage}\n`;
        }
        response += `\n`;
      });

      response += '╰──────────────────────────────────╯\n```';
      return message.channel.send(response);
    }

    // Main help menu (all categories)
    let response = '```js\n';
    response += 'S SELFBOT — COMMANDS\n\n';

    const sortedCats = Object.keys(categories).sort();
    sortedCats.forEach((cat, i) => {
      const count = categories[cat].length;
      const name = cat.charAt(0).toUpperCase() + cat.slice(1);
      response += `${String(i + 1).padStart(2)}. ${name} (${count} command${count === 1 ? '' : 's'})\n`;
    });

    response += `\nUsage: ${prefix}help <category>\n`;
    response += `Example: ${prefix}help music\n\n`;
    response += 'Created by Shorya Devraj\n';
    response += '╰──────────────────────────────────╯\n```';

    await message.channel.send(response);

    // Clean chat
    if (message.deletable) {
      message.delete().catch(() => {});
    }
  }
};
