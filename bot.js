const { IgApiClient } = require('instagram-private-api');
const { sample, random } = require('lodash');
const delay = require('delay');

// ================= Configuration =================
const CONFIG = {
    USERNAME: "your_instagram_username",
    PASSWORD: "your_instagram_password",
    OWNER_USERNAMES: [ // Minimum 5 owner usernames (lowercase)
        "owner1_insta",
        "owner2_insta",
        "owner3_insta",
        "owner4_insta",
        "owner5_insta"
    ].map(u => u.toLowerCase()),
    FUN_REPLIES: [
        "Oye {user}, jyada bak bak na kar warna teri juban kat dunga!",
        "Arre {user}, itna bhi serious na ho yaar!",
        "{user} bhai thoda chill kar!",
        "Hahaha... {user} tum to bade funny ho!",
        "{user}, ye kaisi baatein kar rahe ho?",
        "Shhhh {user}... chup raho thodi der!",
        "{user} tum to harami nikle! 😂",
        "Arey {user} bhai, maze le rahe ho kya?",
        "{user} tumse na ho payega!",
        "{user} thodi izzat karo humari!",
    ],
    OWNER_COMMANDS: {
        "!info": "Bot information",
        "!help": "Show all commands",
        "!active": "Check bot status",
        "!fun on": "Enable fun mode",
        "!fun off": "Disable fun mode",
        "!addreply": "Add custom reply"
    }
};
// ==================================================

class InstagramAutoBot {
    constructor() {
        this.ig = new IgApiClient();
        this.funMode = true;
        this.customReplies = [];
        this.activeGroups = new Set();
    }

    async login() {
        try {
            if (await this.loadSession()) return true;
            
            this.ig.state.generateDevice(CONFIG.USERNAME);
            await this.ig.account.login(CONFIG.USERNAME, CONFIG.PASSWORD);
            await this.saveSession();
            console.log("Logged in successfully!");
            return true;
        } catch (err) {
            console.error("Login failed:", err);
            return false;
        }
    }

    async saveSession() {
        const session = await this.ig.state.serialize();
        require('fs').writeFileSync('./state.json', JSON.stringify(session));
    }

    async loadSession() {
        try {
            const session = require('./state.json');
            this.ig.state.deserialize(session);
            await this.ig.account.currentUser();
            return true;
        } catch (e) {
            return false;
        }
    }

    async processAllGroups() {
        const threads = await this.ig.feed.directInbox().items();
        
        for (const thread of threads) {
            if (thread.users.length > 1) {
                this.activeGroups.add(thread.thread_id);
                
                const items = await this.ig.feed.directThread({
                    threadId: thread.thread_id,
                    oldestCursor: ''
                }).items();

                for (const item of items) {
                    if (item.user_id.toString() !== this.ig.state.cookieUserId) {
                        const user = await this.ig.user.info(item.user_id);
                        
                        // Check against multiple owners
                        if (CONFIG.OWNER_USERNAMES.includes(user.username.toLowerCase()) && 
                            item.item_type === 'text' && 
                            item.text.startsWith('!')) {
                            await this.handleOwnerCommand(thread.thread_id, item.text);
                            continue;
                        }

                        if (this.funMode && Math.random() > 0.3) {
                            const reply = sample([...CONFIG.FUN_REPLIES, ...this.customReplies])
                                .replace('{user}', user.username);
                            
                            await this.ig.directThread.broadcastText({
                                threadIds: [thread.thread_id],
                                text: reply
                            });
                            await delay(2000);
                        }
                    }
                }
            }
        }
    }

    async handleOwnerCommand(threadId, command) {
        const sendReply = async (text) => {
            await this.ig.directThread.broadcastText({
                threadIds: [threadId],
                text: text
            });
        };

        switch (command.split(' ')[0]) {
            case '!help':
                const helpText = 'Owner Commands:\n' + 
                    Object.entries(CONFIG.OWNER_COMMANDS).map(([cmd, desc]) => `${cmd} - ${desc}`).join('\n');
                await sendReply(helpText);
                break;

            case '!info':
                const info = `Auto Fun Bot v2.0\nOwners: ${CONFIG.OWNER_USERNAMES.join(', ')}\n` +
                    `Fun Mode: ${this.funMode ? 'ON' : 'OFF'}\n` +
                    `Active in ${this.activeGroups.size} groups`;
                await sendReply(info);
                break;

            case '!active':
                await sendReply("Bot is active and running in all groups!");
                break;

            case '!fun':
                if (command === '!fun on') {
                    this.funMode = true;
                    await sendReply("Fun mode activated in all groups!");
                } else if (command === '!fun off') {
                    this.funMode = false;
                    await sendReply("Fun mode deactivated in all groups!");
                }
                break;

            case '!addreply':
                const newReply = command.slice(10);
                this.customReplies.push(newReply);
                await sendReply(`Added new reply: ${newReply}`);
                break;

            default:
                await sendReply("Unknown command!");
        }
    }

    async run() {
        if (!(await this.login())) return;

        console.log("Bot started. Listening in ALL groups...");
        
        while (true) {
            try {
                await this.processAllGroups();
                await delay(10000);
            } catch (err) {
                console.error("Error:", err);
                await delay(60000);
            }
        }
    }
}

// Start the bot
const bot = new InstagramAutoBot();
bot.run();
