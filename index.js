require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

let channelSignatures = {}; // Initialize empty object

// Load stored signatures when bot starts
const loadSignatures = () => {
  if (fs.existsSync("signatures.json")) {
    channelSignatures = JSON.parse(fs.readFileSync("signatures.json"));
    console.log("Loaded Signatures:", channelSignatures); // Debugging log
  }
};

// Save signatures to file
const saveSignatures = () => {
  fs.writeFileSync("signatures.json", JSON.stringify(channelSignatures));
};

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Load stored signatures at startup
loadSignatures();

bot.onText(/\/set_signature (.+)/, (msg, match) => {
  const chatId = msg.sender_chat ? msg.sender_chat.id : msg.chat.id;
  const signature = match[1];

  channelSignatures[chatId] = signature; // Store signature
  saveSignatures(); // Save to file

  console.log("Updated Signatures:", channelSignatures); // Debugging log
  bot.sendMessage(chatId, `✅ Signature updated: "${signature}"`);
});

bot.on("message", async (msg) => {
  console.log("Received message:", msg); // Log full message object

  const chatId = msg.sender_chat ? msg.sender_chat.id : msg.chat.id;
  console.log(`Checking signature for ${chatId}:`, channelSignatures[chatId]); // Debugging log

  const signature = channelSignatures[chatId];

  if (signature && msg.text) {
    const updatedText = `${msg.text} — ${signature}`;
    await bot.editMessageText(updatedText, {
      chat_id: chatId,
      message_id: msg.message_id,
    });
  }
});

console.log("Bot is running...");
