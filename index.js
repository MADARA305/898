const fs = require("fs");
const config = require("./config.json");

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionsBitField,
  Partials,
  SlashCommandBuilder,
  REST,
  Routes,
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
  ],
  partials: [Partials.GuildMember],
});

// تسجيل الـ Slash Commands
async function registerSlashCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName('broadcast')
      .setDescription('Open broadcast control panel'),
  ];

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  try {
    console.log('تسجيل Slash Commands...');
    
    // تسجيل الأوامر لجميع الخوادم
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands },
    );

    console.log('تم تسجيل Slash Commands بنجاح!');
  } catch (error) {
    console.error('خطأ في تسجيل Slash Commands:', error);
  }
}

client.once("ready", async () => {
  console.log("Bot is Ready!");
  console.log("Code by Wick Studio");
  console.log("discord.gg/wicks");
  
  // تسجيل الـ Slash Commands
  await registerSlashCommands();
});

client.on("messageCreate", async (message) => {
  if (!message.content.startsWith("!bc") || message.author.bot) return;

  // إنشاء interaction object مؤقت للاستفادة من الدالة المشتركة
  const fakeInteraction = {
    guild: message.guild,
    user: message.author,
    reply: async (options) => {
      return await message.reply(options);
    }
  };

  await createBroadcastPanel(fakeInteraction, false);
});

// دالة لإنشاء لوحة البرودكاست
async function createBroadcastPanel(interaction, isSlashCommand = false) {
  const allowedRoleId = config.allowedRoleId;
  const member = interaction.guild.members.cache.get(interaction.user.id);

  if (!member.roles.cache.has(allowedRoleId)) {
    return interaction.reply({
      content: "ليس لديك صلاحية لاستخدام هذا الامر!",
      ephemeral: true,
    });
  }

  if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return interaction.reply({
      content: "ليس لديك صلاحية لاستخدام هذا الامر!",
      ephemeral: true,
    });
  }

  const embed = new EmbedBuilder()
    .setColor("#0099ff")
    .setTitle("لوحة تحكم البرودكاست")
    .setImage(config.image)
    .setDescription("الرجاء اختيار نوع الارسال للاعضاء.");

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("send_all")
      .setLabel("ارسل للجميع")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("send_online")
      .setLabel("ارسل للمتصلين")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("send_offline")
      .setLabel("ارسل للغير المتصلين")
      .setStyle(ButtonStyle.Danger),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("send_role")
      .setLabel("ارسل لأصحاب الرول")
      .setStyle(ButtonStyle.Secondary),
  );

  await interaction.reply({
    embeds: [embed],
    components: [row1, row2],
    ephemeral: true,
  });
}

client.on("interactionCreate", async (interaction) => {
  try {
    // التعامل مع الـ Slash Commands
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'broadcast') {
        await createBroadcastPanel(interaction, true);
        return;
      }
    }

    if (interaction.isButton()) {
      let customId;
      if (interaction.customId === "send_all") {
        customId = "modal_all";
      } else if (interaction.customId === "send_online") {
        customId = "modal_online";
      } else if (interaction.customId === "send_offline") {
        customId = "modal_offline";
      } else if (interaction.customId === "send_role") {
        customId = "modal_role";
      }

      const modal = new ModalBuilder()
        .setCustomId(customId)
        .setTitle("Type your message");

      const messageInput = new TextInputBuilder()
        .setCustomId("messageInput")
        .setLabel("اكتب رسالتك هنا")
        .setStyle(TextInputStyle.Paragraph);

      modal.addComponents(new ActionRowBuilder().addComponents(messageInput));

      await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit()) {
      const message = interaction.fields.getTextInputValue("messageInput");

      const guild = interaction.guild;
      if (!guild) return;

      await interaction.deferReply({
        ephemeral: true,
      });
      if (interaction.customId === "modal_all") {
        const membersToSend = guild.members.cache.filter(
          (member) => !member.user.bot,
        );
        await Promise.all(
          membersToSend.map(async (member) => {
            try {
              await member.send({
                content: `${message}\n<@${member.user.id}>`,
                allowedMentions: { parse: ["users"] },
              });
            } catch (error) {
              console.error(
                `Error sending message to ${member.user.tag}:`,
                error,
              );
            }
          }),
        );
      } else if (interaction.customId === "modal_online") {
        const onlineMembersToSend = guild.members.cache.filter(
          (member) =>
            !member.user.bot &&
            member.presence &&
            member.presence.status !== "offline",
        );
        await Promise.all(
          onlineMembersToSend.map(async (member) => {
            try {
              await member.send({
                content: `${message}\n<@${member.user.id}>`,
                allowedMentions: { parse: ["users"] },
              });
            } catch (error) {
              console.error(
                `Error sending message to ${member.user.tag}:`,
                error,
              );
            }
          }),
        );
      } else if (interaction.customId === "modal_offline") {
        const offlineMembersToSend = guild.members.cache.filter(
          (member) =>
            !member.user.bot &&
            (!member.presence || member.presence.status === "offline"),
        );
        await Promise.all(
          offlineMembersToSend.map(async (member) => {
            try {
              await member.send({
                content: `${message}\n<@${member.user.id}>`,
                allowedMentions: { parse: ["users"] },
              });
            } catch (error) {
              console.error(
                `Error sending message to ${member.user.tag}:`,
                error,
              );
            }
          }),
        );
      } else if (interaction.customId === "modal_role") {
        const targetRoleId = config.targetRoleId;
        const roleMembersToSend = guild.members.cache.filter(
          (member) =>
            !member.user.bot &&
            member.roles.cache.has(targetRoleId),
        );
        await Promise.all(
          roleMembersToSend.map(async (member) => {
            try {
              await member.send({
                content: `${message}\n<@${member.user.id}>`,
                allowedMentions: { parse: ["users"] },
              });
            } catch (error) {
              console.error(
                `Error sending message to ${member.user.tag}:`,
                error,
              );
            }
          }),
        );
      }
      await interaction.editReply({
        content: "تم ارسال رسالتك الى الاعضاء بنجاح.",
      });
    }
  } catch (error) {
    console.error("Error in interactionCreate event:", error);
  }
});

client.login(process.env.TOKEN);
