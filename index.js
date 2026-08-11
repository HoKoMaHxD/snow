require('dotenv').config();
const { 
    Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, 
    EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder 
} = require('discord.js');
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

const ClanSchema = new mongoose.Schema({
    name: String,
    symbol: String,
    status: { type: String, enum: ['none', 'ally', 'enemy', 'truce'], default: 'none' }
});

const SoloSchema = new mongoose.Schema({
    name: String
});

const Clan = mongoose.model('Clan', ClanSchema);
const Solo = mongoose.model('Solo', SoloSchema);

const commands = [
    new SlashCommandBuilder().setName('add_clan').setDescription('إضافة كلان جديد')
        .addStringOption(opt => opt.setName('name').setDescription('اسم الكلان').setRequired(true))
        .addStringOption(opt => opt.setName('symbol').setDescription('شعار الكلان').setRequired(true)),
    new SlashCommandBuilder().setName('remove_clan').setDescription('حذف كلان نهائياً')
        .addStringOption(opt => opt.setName('symbol').setDescription('شعار الكلان').setRequired(true)),
    new SlashCommandBuilder().setName('add_solo').setDescription('إضافة عداوة سولو')
        .addStringOption(opt => opt.setName('name').setDescription('اسم الشخص').setRequired(true)),
    new SlashCommandBuilder().setName('remove_solo').setDescription('إزالة عداوة سولو')
        .addStringOption(opt => opt.setName('name').setDescription('اسم الشخص').setRequired(true)),
    new SlashCommandBuilder().setName('add_enemy').setDescription('تعيين كعداوة'),
    new SlashCommandBuilder().setName('remove_enemy').setDescription('إزالة من العداوة'),
    new SlashCommandBuilder().setName('add_ally').setDescription('تعيين كتحالف'),
    new SlashCommandBuilder().setName('remove_ally').setDescription('إزالة من التحالف'),
    new SlashCommandBuilder().setName('add_truce').setDescription('تعيين كهدنة'),
    new SlashCommandBuilder().setName('remove_truce').setDescription('إزالة من الهدنة'),
    new SlashCommandBuilder().setName('show_all').setDescription('استعراض السجل الشامل')
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
(async () => {
    try {
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log('✅ Commands Registered!');
    } catch (error) {
        console.error(error);
    }
})();

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

client.on('ready', () => {
    console.log(`❄️ ${client.user.tag} is online!`);
});

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const { commandName, options } = interaction;

        if (commandName === 'add_clan') {
            await Clan.create({ name: options.getString('name'), symbol: options.getString('symbol') });
            return interaction.reply({ content: `✅ تم إضافة الكلان بنجاح.`, ephemeral: true });
        }
        if (commandName === 'remove_clan') {
            await Clan.deleteOne({ symbol: options.getString('symbol') });
            return interaction.reply({ content: `🗑️ تم حذف الكلان من القاعدة.`, ephemeral: true });
        }
        if (commandName === 'add_solo') {
            await Solo.create({ name: options.getString('name') });
            return interaction.reply({ content: `🎯 تم إضافة عداوة سولو.`, ephemeral: true });
        }
        if (commandName === 'remove_solo') {
            await Solo.deleteOne({ name: options.getString('name') });
            return interaction.reply({ content: `🗑️ تم إزالة السولو.`, ephemeral: true });
        }

        const sendMenu = async (statusFilter, customId, placeholder) => {
            const clans = await Clan.find(statusFilter);
            if (clans.length === 0) return interaction.reply({ content: '❌ لا توجد كلانات مطابقة.', ephemeral: true });
            
            const menuOptions = clans.map(c => ({ label: c.name, description: `الشعار: ${c.symbol}`, value: c._id.toString() }));
            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder).addOptions(menuOptions)
            );
            await interaction.reply({ content: 'اختر الكلان:', components: [row], ephemeral: true });
        };

        if (commandName === 'add_enemy') return sendMenu({ status: { $ne: 'enemy' } }, 'set_enemy', 'اختر كلان للعداوة...');
        if (commandName === 'remove_enemy') return sendMenu({ status: 'enemy' }, 'unset_status', 'إزالة من العداوة...');
        if (commandName === 'add_ally') return sendMenu({ status: { $ne: 'ally' } }, 'set_ally', 'اختر كلان للتحالف...');
        if (commandName === 'remove_ally') return sendMenu({ status: 'ally' }, 'unset_status', 'إزالة من التحالف...');
        if (commandName === 'add_truce') return sendMenu({ status: { $ne: 'truce' } }, 'set_truce', 'اختر كلان للهدنة...');
        if (commandName === 'remove_truce') return sendMenu({ status: 'truce' }, 'unset_status', 'إزالة من الهدنة...');

        if (commandName === 'show_all') {
            const clans = await Clan.find();
            const solos = await Solo.find();
            
            const embed = new EmbedBuilder()
                .setTitle('📋 تقرير التحالفات والعداوات')
                .setColor('#2b2d31')
                .addFields(
                    { name: '🟢 التحالفات', value: clans.filter(c => c.status === 'ally').map(c => `${c.symbol} | ${c.name}`).join('\n') || 'لا يوجد', inline: true },
                    { name: '🟡 الهدنة', value: clans.filter(c => c.status === 'truce').map(c => `${c.symbol} | ${c.name}`).join('\n') || 'لا يوجد', inline: true },
                    { name: '🔴 العداوات', value: clans.filter(c => c.status === 'enemy').map(c => `${c.symbol} | ${c.name}`).join('\n') || 'لا يوجد', inline: true },
                    { name: '🎯 السولو', value: solos.map(s => `👤 ${s.name}`).join('\n') || 'لا يوجد', inline: true }
                );
            return interaction.reply({ embeds: [embed] });
        }
    }

    if (interaction.isStringSelectMenu()) {
        const clanId = interaction.values[0];
        if (interaction.customId === 'set_enemy') await Clan.findByIdAndUpdate(clanId, { status: 'enemy' });
        if (interaction.customId === 'set_ally') await Clan.findByIdAndUpdate(clanId, { status: 'ally' });
        if (interaction.customId === 'set_truce') await Clan.findByIdAndUpdate(clanId, { status: 'truce' });
        if (interaction.customId === 'unset_status') await Clan.findByIdAndUpdate(clanId, { status: 'none' });
        
        await interaction.update({ content: '✅ تم تحديث حالة الكلان بنجاح.', components: [] });
    }
});

client.on('messageCreate', async message => {
    const sortChannelId = process.env.SORT_CHANNEL_ID;
    let contentToProcess = null;

    if (message.content === '!فرز' && message.reference) {
        try {
            const targetMessage = await message.channel.messages.fetch(message.reference.messageId);
            contentToProcess = targetMessage.content || (targetMessage.embeds[0] && targetMessage.embeds[0].description);
        } catch (error) {
            console.error("Error fetching reference message:", error);
        }
    } 
    else if (message.channelId === sortChannelId && !message.author.bot) {
        contentToProcess = message.content;
        if (message.messageSnapshots && message.messageSnapshots.size > 0) {
            const snapshot = message.messageSnapshots.first();
            contentToProcess = snapshot.message.content || (snapshot.message.embeds[0] && snapshot.message.embeds[0].description);
        }
    }

    if (contentToProcess && contentToProcess.match(/\d+\s+.*?(?=\s+\d+|$)/g)) {
        await processSorting(contentToProcess, message);
    }
});

// ==========================================
// دالة الفرز المحدثة (مع الاحتفاظ بأرقام اللاعبين)
// ==========================================
async function processSorting(content, message) {
    const regex = /(?:^|\s|\n)(\d+)\s+(.*?)(?=(?:\s|\n)\d+\s+|$)/g;
    let match;
    
    const clans = await Clan.find();
    const solos = await Solo.find();
    
    let result = { allies: [], enemies: [], truces: [], solos: [], neutral: [] };

    while ((match = regex.exec(content)) !== null) {
        const playerNumber = match[1]; 
        const playerText = match[2].trim(); 
        
        const fullPlayerString = `**${playerNumber}** | ${playerText}`;
        let matched = false;

        for (const solo of solos) {
            if (playerText.toLowerCase().includes(solo.name.toLowerCase())) {
                result.solos.push(fullPlayerString);
                matched = true; 
                break;
            }
        }

        if (matched) continue;

        for (const clan of clans) {
            if (playerText.includes(clan.symbol)) {
                if (clan.status === 'ally') result.allies.push(fullPlayerString);
                else if (clan.status === 'enemy') result.enemies.push(fullPlayerString);
                else if (clan.status === 'truce') result.truces.push(fullPlayerString);
                else result.neutral.push(fullPlayerString);
                
                matched = true; 
                break;
            }
        }

        if (!matched) result.neutral.push(fullPlayerString);
    }

    const resultEmbed = new EmbedBuilder()
        .setTitle('📊 نتيجة الفرز')
        .setColor('#2b2d31') 
        .addFields(
            { name: `🟢 التحالف (${result.allies.length})`, value: result.allies.join('\n') || 'لا يوجد', inline: true },
            { name: `🔴 العداوات (${result.enemies.length})`, value: result.enemies.join('\n') || 'لا يوجد', inline: true },
            { name: `🎯 السولو (${result.solos.length})`, value: result.solos.join('\n') || 'لا يوجد', inline: true },
            { name: `🟡 الهدنة (${result.truces.length})`, value: result.truces.join('\n') || 'لا يوجد', inline: false },
            { name: `⚪ البقية (${result.neutral.length})`, value: result.neutral.join('\n') || 'لا يوجد', inline: false }
        );
        
    await message.reply({ embeds: [resultEmbed] });
}

client.login(process.env.BOT_TOKEN);
