require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const fs = require("fs");

const bot = new TelegramBot(process.env.BOT_TOKEN); // Remove polling
const app = express();

app.use(express.json()); // Enable JSON parsing

// Store signatures persistently
let channelSignatures = {};

// Load stored signatures when bot starts
const loadSignatures = () => {
  if (fs.existsSync("signatures.json")) {
    channelSignatures = JSON.parse(fs.readFileSync("signatures.json"));
    console.log("Loaded Signatures:", channelSignatures);
  }
};

// Save signatures to file
const saveSignatures = () => {
  fs.writeFileSync("signatures.json", JSON.stringify(channelSignatures));
};

// Load stored signatures at startup
loadSignatures();

// Webhook route for Telegram updates
app.post(`/webhook/${process.env.BOT_TOKEN}`, (req, res) => {
  console.log("Incoming Update:", JSON.stringify(req.body, null, 2)); // Debugging log
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Set webhook when bot starts
const WEBHOOK_URL = `https://telegram-signature-bot-1.onrender.com/webhook/${process.env.BOT_TOKEN}`;
bot.setWebHook(WEBHOOK_URL);

// Command to set a signature
bot.onText(/\/set_signature (.+)/, (msg, match) => {
  const chatId = msg.sender_chat ? msg.sender_chat.id : msg.chat.id;
  const signature = match[1];

  channelSignatures[chatId] = signature;
  saveSignatures(); // Save to file

  console.log("Updated Signatures:", channelSignatures);
  bot.sendMessage(chatId, `✅ Signature updated: "${signature}"`);
});

// Automatically edit posts to add the signature
bot.on("message", async (msg) => {
  const chatId = msg.sender_chat ? msg.sender_chat.id : msg.chat.id;
  const signature = channelSignatures[chatId];

  console.log(`Checking signature for ${chatId}:`, signature);

  if (signature && msg.text) {
    try {
      // Delete the original message
      await bot.deleteMessage(chatId, msg.message_id);

      // Repost the message with the signature
      const updatedText = `${msg.text} — ${signature}`;
      await bot.sendMessage(chatId, updatedText);
    } catch (error) {
      console.error("Error modifying message:", error);
    }
  }
});

// Start Express server
app.listen(3000, () => {
  console.log("Bot is running with webhooks...");
});
