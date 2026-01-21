import {
  TextChannel,
  Client,
  MessageFlags,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ButtonStyle,
} from 'discord.js';
import { prisma } from '../prisma.js';

// Discord Client wird vom discordBot.ts exportiert
let discordClient: Client | null = null;

export function setDiscordClient(client: Client) {
  discordClient = client;
}

// Announcement-Typen
export type AnnouncementType =
  | 'PROMOTION'
  | 'DEMOTION'
  | 'SANCTION'
  | 'UNIT_CHANGE'
  | 'UNIT_PROMOTION'
  | 'ACADEMY_GRADUATION'
  | 'ACADEMY_TRAINING'
  | 'TERMINATION'
  | 'HIRE';

// Farben für verschiedene Ankündigungstypen (Hex)
const COLORS = {
  PROMOTION: 0x22c55e,       // Grün
  DEMOTION: 0xef4444,        // Rot
  SANCTION: 0xf97316,        // Orange
  UNIT_CHANGE: 0x8b5cf6,     // Lila
  UNIT_PROMOTION: 0x06b6d4,  // Cyan
  ACADEMY_GRADUATION: 0x3b82f6, // Blau
  ACADEMY_TRAINING: 0x06b6d4,   // Cyan
  TERMINATION: 0x64748b,     // Grau
  HIRE: 0x10b981,            // Smaragd
};

// Emojis für verschiedene Ankündigungstypen
const EMOJIS = {
  PROMOTION: '🎉',
  DEMOTION: '📉',
  SANCTION: '⚠️',
  UNIT_CHANGE: '🔄',
  UNIT_PROMOTION: '🌟',
  ACADEMY_GRADUATION: '🎓',
  ACADEMY_TRAINING: '📚',
  TERMINATION: '👋',
  HIRE: '🆕',
};

// Titel für verschiedene Ankündigungstypen
const TITLES = {
  PROMOTION: 'Beförderung',
  DEMOTION: 'Degradierung',
  SANCTION: 'Sanktion',
  UNIT_CHANGE: 'Unit-Wechsel',
  UNIT_PROMOTION: 'Unit-Beförderung',
  ACADEMY_GRADUATION: 'Ausbildung Abgeschlossen',
  ACADEMY_TRAINING: 'Neue Schulung',
  TERMINATION: 'Kündigung',
  HIRE: 'Neueinstellung',
};

// Kanal für Ankündigung abrufen
async function getAnnouncementChannel(type: AnnouncementType): Promise<TextChannel | null> {
  if (!discordClient) {
    console.warn('[Discord Announcements] Discord client not initialized');
    return null;
  }

  try {
    const config = await prisma.discordAnnouncementChannel.findUnique({
      where: { type },
    });

    if (!config || !config.enabled || !config.channelId) {
      return null;
    }

    const channel = await discordClient.channels.fetch(config.channelId);
    if (channel && channel.isTextBased()) {
      return channel as TextChannel;
    }
    return null;
  } catch (error) {
    console.error(`[Discord Announcements] Error fetching channel for ${type}:`, error);
    return null;
  }
}

// Generische Ankündigung senden mit Components v2
async function sendAnnouncementV2(type: AnnouncementType, container: ContainerBuilder): Promise<boolean> {
  try {
    const channel = await getAnnouncementChannel(type);
    if (!channel) {
      return false;
    }

    await channel.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
    console.log(`[Discord Announcements] Sent ${type} announcement (Components v2)`);
    return true;
  } catch (error) {
    console.error(`[Discord Announcements] Error sending ${type} announcement:`, error);
    return false;
  }
}

// Helper: Datum formatieren
function formatDate(date: Date | null): string {
  if (!date) return 'Unbekannt';
  return new Date(date).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Helper: Aktuelles Datum und Uhrzeit
function getCurrentTimestamp(): string {
  return new Date().toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ==================== BEFÖRDERUNG ====================
interface PromotionData {
  employeeName: string;
  employeeAvatar?: string | null;
  oldRank: string;
  newRank: string;
  promotedBy: string;
  reason?: string | null;
  badgeNumber?: string | null;
}

export async function announcePromotion(data: PromotionData): Promise<boolean> {
  const container = new ContainerBuilder()
    .setAccentColor(COLORS.PROMOTION)
    .addTextDisplayComponents(
      (text) => text.setContent(`# ${EMOJIS.PROMOTION} ${TITLES.PROMOTION}`),
    )
    .addSeparatorComponents((sep) => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addSectionComponents((section) =>
      section
        .addTextDisplayComponents(
          (text) => text.setContent(`### **${data.employeeName}** wurde befördert!`),
        )
        .setButtonAccessory((btn) =>
          btn.setCustomId('promotion_info')
            .setLabel('Gratulieren')
            .setStyle(ButtonStyle.Success)
            .setEmoji({ name: '🎊' })
            .setDisabled(true)
        )
    )
    .addSeparatorComponents((sep) => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      (text) => text.setContent(
        `📊 **Rang:** \`${data.oldRank}\` ➜ \`${data.newRank}\`\n` +
        `👤 **Befördert von:** ${data.promotedBy}` +
        (data.badgeNumber ? `\n🎫 **Dienstnummer:** ${data.badgeNumber}` : '')
      ),
    );

  if (data.reason) {
    container.addSeparatorComponents((sep) => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    container.addTextDisplayComponents(
      (text) => text.setContent(`📝 **Begründung:**\n> ${data.reason}`),
    );
  }

  container.addSeparatorComponents((sep) => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small));
  container.addTextDisplayComponents(
    (text) => text.setContent(`-# 🕐 ${getCurrentTimestamp()} • LSPD Personalsystem`),
  );

  return sendAnnouncementV2('PROMOTION', container);
}

// ==================== DEGRADIERUNG ====================
interface DemotionData {
  employeeName: string;
  employeeAvatar?: string | null;
  oldRank: string;
  newRank: string;
  demotedBy: string;
  reason?: string | null;
  badgeNumber?: string | null;
}

export async function announceDemotion(data: DemotionData): Promise<boolean> {
  const container = new ContainerBuilder()
    .setAccentColor(COLORS.DEMOTION)
    .addTextDisplayComponents(
      (text) => text.setContent(`# ${EMOJIS.DEMOTION} ${TITLES.DEMOTION}`),
    )
    .addSeparatorComponents((sep) => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addSectionComponents((section) =>
      section
        .addTextDisplayComponents(
          (text) => text.setContent(`### **${data.employeeName}** wurde degradiert.`),
        )
        .setButtonAccessory((btn) =>
          btn.setCustomId('demotion_info')
            .setLabel('Degradierung')
            .setStyle(ButtonStyle.Danger)
            .setEmoji({ name: '⬇️' })
            .setDisabled(true)
        )
    )
    .addSeparatorComponents((sep) => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      (text) => text.setContent(
        `📊 **Rang:** \`${data.oldRank}\` ➜ \`${data.newRank}\`\n` +
        `👤 **Degradiert von:** ${data.demotedBy}` +
        (data.badgeNumber ? `\n🎫 **Dienstnummer:** ${data.badgeNumber}` : '')
      ),
    );

  if (data.reason) {
    container.addSeparatorComponents((sep) => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    container.addTextDisplayComponents(
      (text) => text.setContent(`📝 **Begründung:**\n> ${data.reason}`),
    );
  }

  container.addSeparatorComponents((sep) => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small));
  container.addTextDisplayComponents(
    (text) => text.setContent(`-# 🕐 ${getCurrentTimestamp()} • LSPD Personalsystem`),
  );

  return sendAnnouncementV2('DEMOTION', container);
}

// ==================== SANKTION ====================
interface SanctionData {
  employeeName: string;
  employeeAvatar?: string | null;
  sanctionType: string;
  reason: string;
  issuedBy: string;
  amount?: number | null;
  measure?: string | null;
  expiresAt?: Date | null;
}

export async function announceSanction(data: SanctionData): Promise<boolean> {
  const container = new ContainerBuilder()
    .setAccentColor(COLORS.SANCTION)
    .addTextDisplayComponents(
      (text) => text.setContent(`# ${EMOJIS.SANCTION} ${TITLES.SANCTION}`),
    )
    .addSeparatorComponents((sep) => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addSectionComponents((section) =>
      section
        .addTextDisplayComponents(
          (text) => text.setContent(`### **${data.employeeName}** hat eine Sanktion erhalten.`),
        )
        .setButtonAccessory((btn) =>
          btn.setCustomId('sanction_info')
            .setLabel(data.sanctionType)
            .setStyle(ButtonStyle.Secondary)
            .setEmoji({ name: '⚖️' })
            .setDisabled(true)
        )
    )
    .addSeparatorComponents((sep) => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      (text) => text.setContent(
        `⚖️ **Art:** ${data.sanctionType}\n` +
        `👤 **Ausgestellt von:** ${data.issuedBy}` +
        (data.amount ? `\n💰 **Geldstrafe:** $${data.amount.toLocaleString()}` : '') +
        (data.expiresAt ? `\n⏰ **Gültig bis:** ${formatDate(data.expiresAt)}` : '')
      ),
    );

  if (data.measure) {
    container.addSeparatorComponents((sep) => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    container.addTextDisplayComponents(
      (text) => text.setContent(`📋 **Maßnahme:**\n> ${data.measure}`),
    );
  }

  container.addSeparatorComponents((sep) => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small));
  container.addTextDisplayComponents(
    (text) => text.setContent(`📝 **Begründung:**\n> ${data.reason}`),
  );

  container.addSeparatorComponents((sep) => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small));
  container.addTextDisplayComponents(
    (text) => text.setContent(`-# 🕐 ${getCurrentTimestamp()} • LSPD Personalsystem`),
  );

  return sendAnnouncementV2('SANCTION', container);
}

// ==================== UNIT-WECHSEL ====================
interface UnitChangeData {
  employeeName: string;
  employeeAvatar?: string | null;
  previousUnit?: string | null;
  newUnit: string;
  badgeNumber?: string | null;
}

export async function announceUnitChange(data: UnitChangeData): Promise<boolean> {
  const description = data.previousUnit
    ? `### **${data.employeeName}** hat die Unit gewechselt.`
    : `### **${data.employeeName}** wurde einer Unit zugewiesen.`;

  const container = new ContainerBuilder()
    .setAccentColor(COLORS.UNIT_CHANGE)
    .addTextDisplayComponents(
      (text) => text.setContent(`# ${EMOJIS.UNIT_CHANGE} ${TITLES.UNIT_CHANGE}`),
    )
    .addSeparatorComponents((sep) => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addSectionComponents((section) =>
      section
        .addTextDisplayComponents(
          (text) => text.setContent(description),
        )
        .setButtonAccessory((btn) =>
          btn.setCustomId('unit_change_info')
            .setLabel('Unit')
            .setStyle(ButtonStyle.Primary)
            .setEmoji({ name: '🏢' })
            .setDisabled(true)
        )
    )
    .addSeparatorComponents((sep) => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small));

  if (data.previousUnit) {
    container.addTextDisplayComponents(
      (text) => text.setContent(
        `🔙 **Vorherige Unit:** ${data.previousUnit}\n` +
        `➡️ **Neue Unit:** ${data.newUnit}` +
        (data.badgeNumber ? `\n🎫 **Dienstnummer:** ${data.badgeNumber}` : '')
      ),
    );
  } else {
    container.addTextDisplayComponents(
      (text) => text.setContent(
        `🆕 **Zugewiesene Unit:** ${data.newUnit}` +
        (data.badgeNumber ? `\n🎫 **Dienstnummer:** ${data.badgeNumber}` : '')
      ),
    );
  }

  container.addSeparatorComponents((sep) => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small));
  container.addTextDisplayComponents(
    (text) => text.setContent(`-# 🕐 ${getCurrentTimestamp()} • LSPD Personalsystem`),
  );

  return sendAnnouncementV2('UNIT_CHANGE', container);
}

// ==================== UNIT-BEFÖRDERUNG ====================
interface UnitPromotionData {
  employeeName: string;
  employeeAvatar?: string | null;
  unit: string;
  oldPosition?: string | null;
  newPosition: string;
  promotedBy: string;
  badgeNumber?: string | null;
}

export async function announceUnitPromotion(data: UnitPromotionData): Promise<boolean> {
  const container = new ContainerBuilder()
    .setAccentColor(COLORS.UNIT_PROMOTION)
    .addTextDisplayComponents(
      (text) => text.setContent(`# ${EMOJIS.UNIT_PROMOTION} ${TITLES.UNIT_PROMOTION}`),
    )
    .addSeparatorComponents((sep) => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addSectionComponents((section) =>
      section
        .addTextDisplayComponents(
          (text) => text.setContent(`### **${data.employeeName}** wurde in der Unit befördert!`),
        )
        .setButtonAccessory((btn) =>
          btn.setCustomId('unit_promo_info')
            .setLabel(data.unit)
            .setStyle(ButtonStyle.Success)
            .setEmoji({ name: '⭐' })
            .setDisabled(true)
        )
    )
    .addSeparatorComponents((sep) => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      (text) => text.setContent(
        `🏢 **Unit:** ${data.unit}\n` +
        (data.oldPosition ? `📊 **Position:** \`${data.oldPosition}\` ➜ \`${data.newPosition}\`\n` : `🆕 **Position:** ${data.newPosition}\n`) +
        `👤 **Befördert von:** ${data.promotedBy}` +
        (data.badgeNumber ? `\n🎫 **Dienstnummer:** ${data.badgeNumber}` : '')
      ),
    )
    .addSeparatorComponents((sep) => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      (text) => text.setContent(`-# 🕐 ${getCurrentTimestamp()} • LSPD Personalsystem`),
    );

  return sendAnnouncementV2('UNIT_PROMOTION', container);
}

// ==================== AUSBILDUNG ABGESCHLOSSEN ====================
interface AcademyGraduationData {
  employeeName: string;
  employeeAvatar?: string | null;
  graduationType: string;
  completedBy?: string | null;
  badgeNumber?: string | null;
  notes?: string | null;
}

export async function announceAcademyGraduation(data: AcademyGraduationData): Promise<boolean> {
  const container = new ContainerBuilder()
    .setAccentColor(COLORS.ACADEMY_GRADUATION)
    .addTextDisplayComponents(
      (text) => text.setContent(`# ${EMOJIS.ACADEMY_GRADUATION} ${TITLES.ACADEMY_GRADUATION}`),
    )
    .addSeparatorComponents((sep) => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addSectionComponents((section) =>
      section
        .addTextDisplayComponents(
          (text) => text.setContent(`### **${data.employeeName}** hat die Ausbildung erfolgreich abgeschlossen!`),
        )
        .setButtonAccessory((btn) =>
          btn.setCustomId('graduation_info')
            .setLabel('Bestanden')
            .setStyle(ButtonStyle.Success)
            .setEmoji({ name: '✅' })
            .setDisabled(true)
        )
    )
    .addSeparatorComponents((sep) => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      (text) => text.setContent(
        `📚 **Ausbildung:** ${data.graduationType}` +
        (data.completedBy ? `\n👨‍🏫 **Ausbilder:** ${data.completedBy}` : '') +
        (data.badgeNumber ? `\n🎫 **Dienstnummer:** ${data.badgeNumber}` : '')
      ),
    );

  if (data.notes) {
    container.addSeparatorComponents((sep) => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    container.addTextDisplayComponents(
      (text) => text.setContent(`📝 **Anmerkungen:**\n> ${data.notes}`),
    );
  }

  container.addSeparatorComponents((sep) => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small));
  container.addTextDisplayComponents(
    (text) => text.setContent(`-# 🕐 ${getCurrentTimestamp()} • LSPD Personalsystem`),
  );

  return sendAnnouncementV2('ACADEMY_GRADUATION', container);
}

// ==================== KÜNDIGUNG ====================
interface TerminationData {
  employeeName: string;
  employeeAvatar?: string | null;
  rank: string;
  terminationType: 'RESIGNATION' | 'TERMINATION' | 'INACTIVE';
  reason?: string | null;
  terminatedBy?: string | null;
  badgeNumber?: string | null;
  hireDate?: Date | null;
}

export async function announceTermination(data: TerminationData): Promise<boolean> {
  const typeLabels = {
    RESIGNATION: 'Eigenkündigung',
    TERMINATION: 'Entlassung',
    INACTIVE: 'Inaktivität',
  };

  const typeEmojis = {
    RESIGNATION: '📤',
    TERMINATION: '🚫',
    INACTIVE: '💤',
  };

  const container = new ContainerBuilder()
    .setAccentColor(COLORS.TERMINATION)
    .addTextDisplayComponents(
      (text) => text.setContent(`# ${EMOJIS.TERMINATION} ${TITLES.TERMINATION}`),
    )
    .addSeparatorComponents((sep) => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addSectionComponents((section) =>
      section
        .addTextDisplayComponents(
          (text) => text.setContent(`### **${data.employeeName}** hat das LSPD verlassen.`),
        )
        .setButtonAccessory((btn) =>
          btn.setCustomId('termination_info')
            .setLabel(typeLabels[data.terminationType])
            .setStyle(ButtonStyle.Secondary)
            .setEmoji({ name: typeEmojis[data.terminationType] })
            .setDisabled(true)
        )
    )
    .addSeparatorComponents((sep) => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      (text) => text.setContent(
        `📊 **Letzter Rang:** ${data.rank}\n` +
        `${typeEmojis[data.terminationType]} **Art:** ${typeLabels[data.terminationType]}` +
        (data.badgeNumber ? `\n🎫 **Dienstnummer:** ${data.badgeNumber}` : '') +
        (data.hireDate ? `\n📅 **Eingestellt am:** ${formatDate(data.hireDate)}` : '') +
        (data.terminatedBy ? `\n👤 **Bearbeitet von:** ${data.terminatedBy}` : '')
      ),
    );

  if (data.reason) {
    container.addSeparatorComponents((sep) => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    container.addTextDisplayComponents(
      (text) => text.setContent(`📝 **Begründung:**\n> ${data.reason}`),
    );
  }

  container.addSeparatorComponents((sep) => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small));
  container.addTextDisplayComponents(
    (text) => text.setContent(`-# 🕐 ${getCurrentTimestamp()} • LSPD Personalsystem`),
  );

  return sendAnnouncementV2('TERMINATION', container);
}

// ==================== NEUEINSTELLUNG ====================
interface HireData {
  employeeName: string;
  employeeAvatar?: string | null;
  rank: string;
  badgeNumber: string;
  hiredBy?: string | null;
}

export async function announceHire(data: HireData): Promise<boolean> {
  const container = new ContainerBuilder()
    .setAccentColor(COLORS.HIRE)
    .addTextDisplayComponents(
      (text) => text.setContent(`# ${EMOJIS.HIRE} ${TITLES.HIRE}`),
    )
    .addSeparatorComponents((sep) => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addSectionComponents((section) =>
      section
        .addTextDisplayComponents(
          (text) => text.setContent(`### Willkommen beim LSPD, **${data.employeeName}**!`),
        )
        .setButtonAccessory((btn) =>
          btn.setCustomId('hire_info')
            .setLabel('Willkommen!')
            .setStyle(ButtonStyle.Success)
            .setEmoji({ name: '👋' })
            .setDisabled(true)
        )
    )
    .addSeparatorComponents((sep) => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      (text) => text.setContent(
        `📊 **Rang:** ${data.rank}\n` +
        `🎫 **Dienstnummer:** ${data.badgeNumber}` +
        (data.hiredBy ? `\n👤 **Eingestellt von:** ${data.hiredBy}` : '')
      ),
    )
    .addSeparatorComponents((sep) => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      (text) => text.setContent(
        `> *Wir freuen uns, dich im Los Santos Police Department begrüßen zu dürfen!*\n` +
        `> *Viel Erfolg bei deiner Karriere!*`
      ),
    )
    .addSeparatorComponents((sep) => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      (text) => text.setContent(`-# 🕐 ${getCurrentTimestamp()} • LSPD Personalsystem`),
    );

  return sendAnnouncementV2('HIRE', container);
}

// ==================== DIENSTNUMMER/NAMEN ÄNDERUNG ====================
interface EmployeeChangeData {
  employeeName: string;
  employeeAvatar?: string | null;
  badgeNumber?: string | null;
  oldBadgeNumber?: string | null;
  oldName?: string | null;
  changedBy: string;
  changeType: 'BADGE_NUMBER' | 'NAME' | 'BOTH';
}

export async function announceEmployeeChange(data: EmployeeChangeData): Promise<boolean> {
  const emoji = data.changeType === 'BADGE_NUMBER' ? '🔢' : data.changeType === 'NAME' ? '📝' : '✏️';
  const title = data.changeType === 'BADGE_NUMBER' ? 'Dienstnummer geändert' :
                data.changeType === 'NAME' ? 'Name geändert' : 'Daten geändert';

  const container = new ContainerBuilder()
    .setAccentColor(0x3b82f6) // Blau
    .addTextDisplayComponents(
      (text) => text.setContent(`# ${emoji} ${title}`),
    )
    .addSeparatorComponents((sep) => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addSectionComponents((section) =>
      section
        .addTextDisplayComponents(
          (text) => text.setContent(`### **${data.employeeName}**`),
        )
        .setButtonAccessory((btn) =>
          btn.setCustomId('change_info')
            .setLabel('Änderung')
            .setStyle(ButtonStyle.Primary)
            .setEmoji({ name: '📋' })
            .setDisabled(true)
        )
    )
    .addSeparatorComponents((sep) => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small));

  let changeDetails = '';
  if (data.changeType === 'BADGE_NUMBER' || data.changeType === 'BOTH') {
    changeDetails += `🔢 **Dienstnummer:** \`${data.oldBadgeNumber || 'Keine'}\` ➜ \`${data.badgeNumber || 'Keine'}\`\n`;
  }
  if (data.changeType === 'NAME' || data.changeType === 'BOTH') {
    changeDetails += `📝 **Name:** \`${data.oldName || 'Unbekannt'}\` ➜ \`${data.employeeName}\`\n`;
  }
  changeDetails += `👤 **Geändert von:** ${data.changedBy}`;

  container.addTextDisplayComponents(
    (text) => text.setContent(changeDetails),
  );

  container.addSeparatorComponents((sep) => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small));
  container.addTextDisplayComponents(
    (text) => text.setContent(`-# 🕐 ${getCurrentTimestamp()} • LSPD Personalsystem`),
  );

  return sendAnnouncementV2('PROMOTION', container); // Nutze PROMOTION-Kanal für diese Ankündigungen
}

// ==================== ACADEMY TRAINING ====================
interface TrainingAnnouncementData {
  trainingTitle: string;
  trainingType: string;
  scheduledAt: Date;
  instructorName: string;
  location?: string | null;
  maxParticipants?: number | null;
  description?: string | null;
}

export async function announceTraining(data: TrainingAnnouncementData): Promise<boolean> {
  const formattedDate = data.scheduledAt.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const container = new ContainerBuilder()
    .setAccentColor(COLORS.ACADEMY_TRAINING)
    .addTextDisplayComponents(
      (text) => text.setContent(`# ${EMOJIS.ACADEMY_TRAINING} ${TITLES.ACADEMY_TRAINING}`),
    )
    .addSeparatorComponents((sep) => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addSectionComponents((section) =>
      section
        .addTextDisplayComponents(
          (text) => text.setContent(`### ${data.trainingTitle}`),
        )
        .setButtonAccessory((btn) =>
          btn.setCustomId('training_info')
            .setLabel(data.trainingType)
            .setStyle(ButtonStyle.Primary)
            .setEmoji({ name: '📖' })
            .setDisabled(true)
        )
    )
    .addSeparatorComponents((sep) => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      (text) => text.setContent(
        `📅 **Termin:** ${formattedDate}\n` +
        `👨‍🏫 **Ausbilder:** ${data.instructorName}` +
        (data.location ? `\n📍 **Ort:** ${data.location}` : '') +
        (data.maxParticipants ? `\n👥 **Max. Teilnehmer:** ${data.maxParticipants}` : '')
      ),
    );

  if (data.description) {
    container.addSeparatorComponents((sep) => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    container.addTextDisplayComponents(
      (text) => text.setContent(`📝 **Beschreibung:**\n> ${data.description}`),
    );
  }

  container.addSeparatorComponents((sep) => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small));
  container.addTextDisplayComponents(
    (text) => text.setContent(
      `> *Melde dich bei Interesse beim Ausbilder oder in der Police Academy!*`
    ),
  );

  container.addSeparatorComponents((sep) => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small));
  container.addTextDisplayComponents(
    (text) => text.setContent(`-# 🕐 ${getCurrentTimestamp()} • LSPD Personalsystem`),
  );

  return sendAnnouncementV2('ACADEMY_TRAINING', container);
}
