require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const fs = require("fs");

const bot = new TelegramBot(process.env.BOT_TOKEN);
const app = express();

app.use(express.json());

let channelSignatures = {};
let awaitingChannelId = {};

const loadSignatures = () => {
  if (fs.existsSync("signatures.json")) {
    channelSignatures = JSON.parse(fs.readFileSync("signatures.json"));
    console.log("Loaded Signatures:", channelSignatures);
  }
};
const saveSignatures = () => {
  fs.writeFileSync("signatures.json", JSON.stringify(channelSignatures));
};

loadSignatures();

app.post(`/webhook/${process.env.BOT_TOKEN}`, (req, res) => {
  console.log("Incoming Update:", JSON.stringify(req.body, null, 2));
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

const WEBHOOK_URL = `https://telegram-signature-bot-1.onrender.com/webhook/${process.env.BOT_TOKEN}`;
bot.setWebHook(WEBHOOK_URL);

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const welcomeMessage = `
👋 Welcome to SignatureBot!

This bot automatically appends a signature to every post you make in your Telegram channel.

To get started, please set your signature using this command:
  
/set_signature Your Signature

For example:
/set_signature @aydus_journey

`;

  bot.sendMessage(chatId, welcomeMessage);
});

bot.onText(/\/set_signature (.+)/, (msg, match) => {
  const userId = msg.chat.id;
  const signature = match[1];
  awaitingChannelId[userId] = signature;

  bot.sendMessage(
    userId,
    "Please provide the channel ID where this signature should be applied."
  );
});

bot.on("message", (msg) => {
  const userId = msg.chat.id;

  if (awaitingChannelId[userId]) {
    let channelId = msg.text.trim();

    if (!channelId.startsWith("-100")) {
      channelId = `-100${channelId}`;
    }

    const signature = awaitingChannelId[userId];
    channelSignatures[channelId] = signature;
    saveSignatures();

    bot.sendMessage(
      userId,
      `✅ Signature "${signature}" has been saved for channel ${channelId}.`
    );

    delete awaitingChannelId[userId];
  }
});

bot.on("channel_post", async (msg) => {
  const chatId = msg.chat.id;
  const signature = channelSignatures[chatId];

  console.log(`Checking signature for ${chatId}:`, signature);

  if (signature && msg.text) {
    try {
      await bot.deleteMessage(chatId, msg.message_id);

      // ✨ New: Add a blank line before the signature
      const updatedText = `${msg.text}\n\n${signature}`;
      await bot.sendMessage(chatId, updatedText);
    } catch (error) {
      console.error(
        "❌ Error modifying message:",
        error.response?.body || error.message
      );
    }
  }
});

console.log("Stored Signatures:", channelSignatures);

app.listen(3000, () => {
  console.log("Bot is running with webhooks...");
});
