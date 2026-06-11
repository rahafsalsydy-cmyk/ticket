// ---- كود تزييف الـ Port لمنصة Render لمنع إغلاق البوت ----
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is Online!'));
app.listen(port, () => console.log(`🌍 Server is listening on port ${port}`));
// ---------------------------------------------------------

const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelType, PermissionsBitField, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } = require('discord.js');
const Keyv = require('keyv');
require('dotenv').config();

// إعداد قاعدة البيانات لحفظ الإعدادات في Render
const db = new Keyv('sqlite://tickets.sqlite');

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

client.once('ready', () => {
    console.log(`✅ البوت جاهز ويعمل الآن! باسم: ${client.user.tag}`);
});

// ================= [ نظام التفاعل عبر الأمر النصي المباشر ] =================
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // يمكنك تغيير "!panel" إلى أي أمر تفضله للاستدعاء
    if (message.content === '!panel') {
        
        // حماية اللوحة: السماح فقط للأشخاص الذين لديهم صلاحية الإدارة (Administrator)
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

        // إنشاء أزرار لوحة التحكم الخاصة بك
        const controlRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('admin_add_ticket_type')
                .setLabel('➕ إضافة قسم تذكرة جديد')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('admin_send_setup')
                .setLabel('📤 إرسال لوحة التذاكر هنا')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('admin_reset_data')
                .setLabel('🗑️ إعادة تعيين وكل الأقسام')
                .setStyle(ButtonStyle.Danger)
        );

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🛠️ لوحة تحكم التذاكر الذكية')
            .setDescription('مرحباً بك يا مدير السيرفر! إليك خيارات التحكم السريعة وإعداد النظام بضغطة زر:\n\n' +
                            '• **إضافة قسم جديد**: يتيح لك تحديد الكاتيجوري واسم التذكرة والرتبة المسؤولة.\n' +
                            '• **إرسال لوحة التذاكر**: سيقوم بنشر رسالة التذاكر للأعضاء في هذه الروم حالاً.\n' +
                            '• **إعادة تعيين**: لمسح جميع الأقسام التي قمت بتهيئتها مسبقاً للبدء من جديد.')
            .setFooter({ text: 'هذه اللوحة تظهر للإدارة فقط' });

        await message.reply({ embeds: [embed], components: [controlRow] });
    }
});

// ================= [ التفاعلات والـ Interactions ] =================
client.on('interactionCreate', async (interaction) => {
    
    // أ) الضغط على زر "إضافة قسم تذكرة جديد"
    if (interaction.isButton() && interaction.customId === 'admin_add_ticket_type') {
        const categories = interaction.guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory);
        
        if (categories.size === 0) {
            return interaction.reply({ content: '❌ لا يوجد أي كاتيجوري في هذا السيرفر! يرجى إنشاء كاتيجوري أولاً.', ephemeral: true });
        }

        const categoryMenu = new StringSelectMenuBuilder()
            .setCustomId('select_category_config')
            .setPlaceholder('اختر الكاتيجوري التي ستظهر فيها التذكرة...')
            .addOptions(categories.map(c => ({ label: c.name, value: c.id })).slice(0, 25));

        const row = new ActionRowBuilder().addComponents(categoryMenu);

        await interaction.reply({
            content: '⚙️ **الخطوة 1:** اختر الكاتيجوري التي تريد أن تفتح التذكرة بداخلها من القائمة أدناه:',
            components: [row],
            ephemeral: true
        });
    }

    // ب) استقبال اختيار الكاتيجوري وفتح الـ Modal
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_category_config') {
        const categoryId = interaction.values[0];

        const modal = new ModalBuilder()
            .setCustomId(`modal_config_${categoryId}`)
            .setTitle('بيانات التذكرة الجديدة');

        const ticketNameInput = new TextInputBuilder()
            .setCustomId('ticket_label')
            .setLabel("ما هو اسم/نوع التذكرة؟ (مثال: دعم الكلان)")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const roleIdInput = new TextInputBuilder()
            .setCustomId('ticket_role')
            .setLabel("رقم (ID) الرتبة المخصصة للقسم")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(ticketNameInput),
            new ActionRowBuilder().addComponents(roleIdInput)
        );

        await interaction.showModal(modal);
    }

    // ج) حفظ بيانات الـ Modal في قاعدة البيانات
    if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_config_')) {
        const categoryId = interaction.customId.split('_')[2];
        const label = interaction.fields.getTextInputValue('ticket_label');
        const roleId = interaction.fields.getTextInputValue('ticket_role');
        const value = `ticket_${Date.now()}`;

        const savedTypes = await db.get(`tickets_${interaction.guild.id}`) || [];
        savedTypes.push({ label, value, categoryId, roleId });
        
        await db.set(`tickets_${interaction.guild.id}`, savedTypes);

        await interaction.reply({ content: `✅ تم بنجاح إضافة قسم **(${label})**!\nالآن اكتب الأمر \`!panel\` مجدداً واضغط على زر **"إرسال لوحة التذاكر هنا"** في الروم المخصصة للأعضاء.`, ephemeral: true });
    }

    // د) الضغط على زر "إرسال لوحة التذاكر هنا" للأعضاء
    if (interaction.isButton() && interaction.customId === 'admin_send_setup') {
        const savedTypes = await db.get(`tickets_${interaction.guild.id}`) || [];

        if (savedTypes.length === 0) {
            return interaction.reply({ content: '❌ لم تقوم بإضافة أي أقسام تذاكر حتى الآن! اضغط على زر إضافة قسم أولاً.', ephemeral: true });
        }

        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('user_ticket_select')
                .setPlaceholder('اضغط هنا واختار نوع التذكرة...')
                .addOptions(savedTypes.map(t => ({ label: t.label, value: t.value, description: `فتح تذكرة قسم ${t.label}` })))
        );

        const embed = new EmbedBuilder()
            .setColor('#2f3136')
            .setTitle('📩 مركز الدعم الفني والتذاكر')
            .setDescription('مرحباً بك! يرجى اختيار القسم المناسب لمشكلتك أو طلبك من القائمة المنسدلة أدناه ليتم فتح تذكرة خاصة بك.')
            .setFooter({ text: 'نظام التذاكر الآلي' });

        // إرسال الرسالة في الروم الحالية المفتوحة للأعضاء
        await interaction.channel.send({ embeds: [embed], components: [menu] });
        await interaction.reply({ content: '✅ تم إرسال لوحة التذاكر للأعضاء بنجاح في هذه الروم!', ephemeral: true });
    }

    // هـ) زر مسح البيانات بالكامل للبدء من جديد
    if (interaction.isButton() && interaction.customId === 'admin_reset_data') {
        await db.delete(`tickets_${interaction.guild.id}`);
        await interaction.reply({ content: '🗑️ تم مسح كافة الأقسام والإعدادات المسجلة بنجاح. يمكنك الإعداد من جديد الآن.', ephemeral: true });
    }

    // و) عندما يختار "عضو" تذكرة لفتحها من القائمة المنسدلة العامة
    if (interaction.isStringSelectMenu() && interaction.customId === 'user_ticket_select') {
        await interaction.deferReply({ ephemeral: true });

        const savedTypes = await db.get(`tickets_${interaction.guild.id}`) || [];
        const selectedType = savedTypes.find(t => t.value === interaction.values[0]);

        if (!selectedType) return interaction.editReply({ content: '❌ حدث خطأ، يبدو أن هذا القسم لم يعد موجوداً.' });

        const channelName = `${selectedType.label}-${interaction.user.username}`.replace(/\s+/g, '-').toLowerCase();

        // إنشاء روم الشات المغلق
        const channel = await interaction.guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: selectedType.categoryId,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }, // إغلاق عن الجميع
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AttachFiles, PermissionsBitField.Flags.ReadMessageHistory] }, // صاحب التذكرة
                { id: selectedType.roleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AttachFiles, PermissionsBitField.Flags.ReadMessageHistory] } // رتبة الدعم المحددة للقسم
            ],
        });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`delete_ticket_${selectedType.roleId}`)
                .setLabel('🗑️ حذف التذكرة')
                .setStyle(ButtonStyle.Danger)
        );

        await channel.send({
            content: `👋 مرحباً ${interaction.user} | منشن المسؤولين: <@&${selectedType.roleId}>\nلقد فتحت تذكرة قسم **${selectedType.label}**، يرجى كتابة تفاصيل طلبك هنا.`,
            components: [row]
        });

        await interaction.editReply({ content: `✅ تم فتح تذكرتك بنجاح هنا: ${channel}` });
    }

    // ز) الضغط على زر حذف التذكرة داخل الشات المفتوح
    if (interaction.isButton() && interaction.customId.startsWith('delete_ticket_')) {
        const allowedRoleId = interaction.customId.split('_')[2];

        // لا يحذفها إلا صاحب الرتبة المحددة للقسم أو إداري السيرفر
        if (interaction.member.roles.cache.has(allowedRoleId) || interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            await interaction.reply('🔒 جاري حذف التذكرة تماماً خلال 3 ثوانٍ...');
            setTimeout(() => {
                interaction.channel.delete().catch(() => {});
            }, 3000);
        } else {
            await interaction.reply({ content: '❌ عذراً، لا يمكنك حذف هذه التذكرة. هذا الإجراء مخصص لرتب الدعم الفني الخاصة بهذا القسم فقط.', ephemeral: true });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
