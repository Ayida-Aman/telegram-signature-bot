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
  const messageId = msg.message_id;
  const signature = channelSignatures[chatId];

  console.log(`Checking signature for ${chatId}:`, signature);
  console.log(`Message details:`, JSON.stringify(msg, null, 2));

  if (signature) {
    try {
      if (msg.text && !msg.text.includes(signature)) {
        // Handle text messages
        const updatedText = `${msg.text}\n\n${signature}`;
        await bot.editMessageText(updatedText, {
          chat_id: chatId,
          message_id: messageId,
        });
        console.log(`Edited text message ${messageId} in ${chatId}`);
      } else if (
        msg.caption &&
        (msg.photo || msg.video || msg.document) &&
        !msg.caption.includes(signature)
      ) {
        // Handle media messages with captions
        const updatedCaption = `${msg.caption}\n\n${signature}`;
        await bot.editMessageCaption({
          chat_id: chatId,
          message_id: messageId,
          caption: updatedCaption,
        });
        console.log(`Edited caption for message ${messageId} in ${chatId}`);
      } else {
        console.log(
          `No text or caption to edit, or signature already present for message ${messageId} in ${chatId}`
        );
      }
    } catch (error) {
      console.error(
        `❌ Error editing message ${messageId} in ${chatId}:`,
        error.response?.body?.description || error.message
      );
      // Fallback: Delete and repost if editing fails
      try {
        await bot.deleteMessage(chatId, messageId);
        console.log(`Deleted message ${messageId} in ${chatId}`);
        if (msg.text) {
          // Repost text message
          await bot.sendMessage(chatId, `${msg.text}\n\n${signature}`);
          console.log(`Reposted text message in ${chatId}`);
        } else if (msg.caption && msg.photo) {
          // Repost image with caption
          await bot.sendPhoto(chatId, msg.photo[msg.photo.length - 1].file_id, {
            caption: `${msg.caption}\n\n${signature}`,
          });
          console.log(`Reposted photo with caption in ${chatId}`);
        }
      } catch (fallbackError) {
        console.error(
          `❌ Error in fallback for message ${messageId} in ${chatId}:`,
          fallbackError.response?.body?.description || fallbackError.message
        );
        await bot.sendMessage(
          chatId,
          `⚠️ Could not process message to add signature: ${
            fallbackError.response?.body?.description || fallbackError.message
          }`
        );
      }
    }
  } else {
    console.log(`No signature found for channel ${chatId}`);
  }
});

console.log("Stored Signatures:", channelSignatures);

app.listen(3000, () => {
  console.log("Bot is running with webhooks...");
});
