import { saveDatabase } from "../../functions/database.js";

export default {
    name: "removeuser",
    aliases: ["unallow", "unwhitelist"],
    category: "utility",
    description: "Remove a user from the allowedUsers list. (Owner only)",
    
    async execute(message, args, client) {
        if (message.author.id !== process.env.OWNER_ID) {
            return message.channel.send("```\n❌ Only the bot owner can use this command.\n```");
        }

        const userId = args[0];
        if (!userId || isNaN(userId)) {
            return message.channel.send("```\n❌ Invalid user ID.\n```");
        }

        const list = client.db.config.allowedUsers;

        if (!list.includes(userId)) {
            return message.channel.send("```\n⚠️ User is not in allowedUsers.\n```");
        }

        client.db.config.allowedUsers = list.filter(id => id !== userId);
        saveDatabase(client.db);

        message.channel.send(`\`\`\`js
✓ User removed successfully
User ID: ${userId}
\`\`\``);
    }
};
