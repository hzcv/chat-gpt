const { IgApiClient } = require('instagram-private-api');
const { sample } = require('lodash');
const { readFile, writeFile } = require('fs').promises;
const { existsSync } = require('fs');

// Configuration
const config = {
  username: 'your_instagram_username',
  password: 'your_instagram_password',
  ownerUsernames: [ // Add minimum 5 owner usernames
    'owner_account_1',
    'owner_account_2', 
    'owner_account_3',
    'owner_account_4',
    'owner_account_5'
  ],
  groupThreadId: 'your_group_thread_id',
  galiList: [
    "Oye @{user}, jyada bak bak na kar, warna juban kat dunga!",
    "@{user} chup baith ja warna thappad lagega hawa me!",
    "Oye @{user}, dimag thikane laga le apna!",
    "@{user} chinta mat kar, teri baat ka to kutta bhi intezar nahi karta!",
    "@{user} ek kaam kar, khud se baat kar, zyada better rahega!",
  ],
  ownerCommands: {
    '/status': '✅ Bot is online and working perfectly!',
    '/help': '🛠 Available commands:\n/status - Check bot status\n/help - Show this help',
    '/stats': '📊 Bot statistics:\n- Active since: {startTime}\n- Messages processed: {msgCount}'
  },
  sessionFile: './session.json'
};

// Global variables
const ig = new IgApiClient();
let repliedMessages = new Set();
let botStartTime = new Date();
let messageCount = 0;

async function login() {
  ig.state.generateDevice(config.username);
  
  if (existsSync(config.sessionFile)) {
    await ig.state.deserialize(await readFile(config.sessionFile));
  }

  await ig.account.login(config.username, config.password);
  
  // Save session
  const serialized = await ig.state.serialize();
  delete serialized.constants;
  await writeFile(config.sessionFile, JSON.stringify(serialized));
}

async function sendMessage(threadId, text) {
  await ig.direct.send({
    threadIds: [threadId],
    text: text
  });
}

async function processMessages() {
  try {
    const inbox = await ig.feed.directInbox().items();
    const groupThread = inbox.find(t => t.thread_id === config.groupThreadId);

    if (!groupThread) {
      console.log('Group thread not found!');
      return;
    }

    const messages = await ig.feed.directThread({
      threadId: groupThread.thread_id
    }).items();
    
    messageCount += messages.length;

    for (const msg of messages.reverse()) {
      if (repliedMessages.has(msg.item_id) continue;
      if (msg.user_id === ig.state.cookieUserId) continue;

      const user = await ig.user.info(msg.user_id);
      const text = msg.text || '';
      
      // Check if sender is owner
      const isOwner = config.ownerUsernames
        .map(u => u.toLowerCase())
        .includes(user.username.toLowerCase());

      // Handle owner commands
      if (isOwner) {
        const command = text.trim().split(' ')[0];
        if (config.ownerCommands[command]) {
          let response = config.ownerCommands[command];
          // Replace dynamic values
          response = response
            .replace('{startTime}', botStartTime.toLocaleString())
            .replace('{msgCount}', messageCount);
          
          await sendMessage(groupThread.thread_id, response);
          console.log(`Executed owner command: ${command}`);
          repliedMessages.add(msg.item_id);
          continue;
        }
      }

      // Regular user response
      const response = sample(config.galiList).replace('{user}', user.username);
      await sendMessage(groupThread.thread_id, response);
      console.log(`Replied to ${user.username}: ${response}`);
      repliedMessages.add(msg.item_id);
    }
  } catch (error) {
    console.error('Error processing messages:', error);
  }
}

async function main() {
  try {
    await login();
    console.log('[+] Successfully logged in');
    console.log(`[+] Monitoring group: ${config.groupThreadId}`);
    console.log(`[+] Owners: ${config.ownerUsernames.join(', ')}`);

    // Initial check
    await processMessages();
    
    // Regular checks
    setInterval(async () => {
      await processMessages();
    }, 5000);

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
