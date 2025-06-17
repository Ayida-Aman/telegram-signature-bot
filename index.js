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

// Track ongoing signature setups
let awaitingChannelId = {};

// Command to set a signature
bot.onText(/\/set_signature (.+)/, (msg, match) => {
  const userId = msg.chat.id;
  const signature = match[1];

  // Store signature temporarily until the user provides a channel ID
  awaitingChannelId[userId] = signature;

  bot.sendMessage(
    userId,
    "Please provide the channel ID where this signature should be set."
  );
});

// Automatically edit posts to add the signature
bot.on("message", (msg) => {
  const userId = msg.chat.id;

  if (awaitingChannelId[userId]) {
    let channelId = msg.text; // User inputted channel ID

    // Ensure the channel ID is correctly formatted
    if (!channelId.startsWith("-100")) {
      channelId = `-100${channelId}`;
    }

    const signature = awaitingChannelId[userId];

    // Save the corrected channel ID with the signature
    channelSignatures[channelId] = signature;
    saveSignatures(); // Persist data

    bot.sendMessage(
      userId,
      `✅ Signature "${signature}" has been set for channel ${channelId}.`
    );
    delete awaitingChannelId[userId]; // Cleanup temporary storage
  }
});

// Start Express server
app.listen(3000, () => {
  console.log("Bot is running with webhooks...");
});
