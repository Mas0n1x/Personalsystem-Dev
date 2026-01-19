import { prisma } from '../prisma.js';

// Notification-Typen
export type NotificationType =
  | 'PROMOTION'       // Beförderung
  | 'DEMOTION'        // Degradierung
  | 'SANCTION'        // Sanktion
  | 'BONUS'           // Sonderzahlung
  | 'TUNING'          // Tuning-Rechnungszahlung
  | 'UNIT_CHANGE'     // Unit-Wechsel
  | 'UNIT_PROMOTION'; // Beförderung innerhalb einer Unit

interface NotificationData {
  userId: string;      // User ID des Empfängers
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

// Einzelne Benachrichtigung erstellen
export async function createNotification(notification: NotificationData) {
  try {
    const created = await prisma.notification.create({
      data: {
        userId: notification.userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data ? JSON.stringify(notification.data) : null,
      },
    });

    console.log(`[Notification] Created for user ${notification.userId}: ${notification.title}`);
    return created;
  } catch (error) {
    console.error('[Notification] Error creating notification:', error);
    throw error;
  }
}

// Benachrichtigung für Beförderung
export async function notifyPromotion(
  userId: string,
  oldRank: string,
  newRank: string,
  promotedByName: string
) {
  return createNotification({
    userId,
    type: 'PROMOTION',
    title: 'Beförderung erhalten! 🎉',
    message: `Du wurdest von ${oldRank} zu ${newRank} befördert von ${promotedByName}.`,
    data: { oldRank, newRank, promotedByName },
  });
}

// Benachrichtigung für Degradierung
export async function notifyDemotion(
  userId: string,
  oldRank: string,
  newRank: string,
  demotedByName: string,
  reason?: string
) {
  return createNotification({
    userId,
    type: 'DEMOTION',
    title: 'Degradierung',
    message: `Du wurdest von ${oldRank} zu ${newRank} degradiert von ${demotedByName}.${reason ? ` Grund: ${reason}` : ''}`,
    data: { oldRank, newRank, demotedByName, reason },
  });
}

// Benachrichtigung für Sanktion
export async function notifySanction(
  userId: string,
  sanctionType: string,
  reason: string,
  issuedByName: string,
  amount?: number
) {
  const amountText = amount ? ` ($${amount.toLocaleString()})` : '';
  return createNotification({
    userId,
    type: 'SANCTION',
    title: `Sanktion erhalten: ${sanctionType}`,
    message: `Du hast eine ${sanctionType}${amountText} von ${issuedByName} erhalten. Grund: ${reason}`,
    data: { sanctionType, reason, issuedByName, amount },
  });
}

// Benachrichtigung für Sonderzahlung
export async function notifyBonus(
  userId: string,
  amount: number,
  reason: string,
  paidByName: string
) {
  return createNotification({
    userId,
    type: 'BONUS',
    title: 'Sonderzahlung erhalten! 💰',
    message: `Du hast eine Sonderzahlung von $${amount.toLocaleString()} erhalten für: ${reason}. Ausgezahlt von ${paidByName}.`,
    data: { amount, reason, paidByName },
  });
}

// Benachrichtigung für Tuning-Rechnungszahlung
export async function notifyTuningPayment(
  userId: string,
  amount: number,
  completedByName: string
) {
  return createNotification({
    userId,
    type: 'TUNING',
    title: 'Tuning-Rechnung bezahlt! 🚗',
    message: `Deine Tuning-Rechnung über $${amount.toLocaleString()} wurde von ${completedByName} bezahlt.`,
    data: { amount, completedByName },
  });
}

// Benachrichtigung für Unit-Wechsel
export async function notifyUnitChange(
  userId: string,
  previousUnit: string | null,
  newUnit: string
) {
  const fromText = previousUnit ? `von ${previousUnit} ` : '';
  return createNotification({
    userId,
    type: 'UNIT_CHANGE',
    title: 'Unit-Zuordnung geändert',
    message: `Du wurdest ${fromText}der Unit "${newUnit}" zugewiesen.`,
    data: { previousUnit, newUnit },
  });
}

// Benachrichtigung für Unit-Beförderung (z.B. Teamleitung)
export async function notifyUnitPromotion(
  userId: string,
  unit: string,
  newPosition: string,
  promotedByName: string
) {
  return createNotification({
    userId,
    type: 'UNIT_PROMOTION',
    title: `Beförderung in ${unit}! 🌟`,
    message: `Du wurdest zur ${newPosition} in ${unit} befördert von ${promotedByName}.`,
    data: { unit, newPosition, promotedByName },
  });
}
