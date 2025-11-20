import { saveDatabase } from "../../functions/database.js";

export default {
    name: "adduser",
    aliases: ["allow", "whitelist"],
    category: "utility",
    description: "Add a user to the allowedUsers list. (Owner only)",
    
    async execute(message, args, client) {
        if (message.author.id !== process.env.OWNER_ID) {
            return message.channel.send("```\n❌ Only the bot owner can use this command.\n```");
        }

        const userId = args[0];
        if (!userId || isNaN(userId)) {
            return message.channel.send("```\n❌ Invalid user ID.\n```");
        }

        const list = client.db.config.allowedUsers;

        if (list.includes(userId)) {
            return message.channel.send("```\n⚠️ User is already allowed.\n```");
        }

        list.push(userId);
        saveDatabase(client.db);

        message.channel.send(`\`\`\`js
✓ User added successfully
User ID: ${userId}
\`\`\``);
    }
};
