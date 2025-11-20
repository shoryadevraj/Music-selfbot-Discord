import { generateHelpMenu } from "../../functions/helpMenu.js";

export default {
    name: "help",
    aliases: ["h"],
    category: "utility",
    description: "Shows command categories or details of a specific category.",
    
    async execute(message, args, client) {
        const category = args[0] || null;
        
        try {
            const helpMenu = await generateHelpMenu(client, category);
            
            if (typeof helpMenu === 'string') {
                // Text response
                await message.channel.send(helpMenu);
            } else {
                // Object with files (image response)
                await message.channel.send(helpMenu);
            }
        } catch (error) {
            console.error("Help command error:", error);
            // Fallback to simple text if everything fails
            await message.channel.send("```\n❌ An error occurred while generating the help menu.\n```");
        }
    }
};