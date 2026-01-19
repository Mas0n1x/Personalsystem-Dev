import { prisma } from '../prisma.js';
import { getWeekBounds, createBonusPayment } from '../routes/bonus.js';

// ==================== BONUS TRIGGER FUNCTIONS ====================

// Diese Funktionen werden von anderen Routen aufgerufen, wenn eine Tätigkeit abgeschlossen wird

/**
 * Trigger für abgeschlossene Bewerbung (HR)
 */
export async function triggerApplicationCompleted(processedByEmployeeId: string, applicantName: string, applicationId: string): Promise<void> {
  await createBonusPayment(
    'APPLICATION_COMPLETED',
    processedByEmployeeId,
    `Bewerbung von ${applicantName} bearbeitet`,
    applicationId,
    'Application'
  );
}

/**
 * Trigger für durchgeführtes Onboarding (HR)
 */
export async function triggerApplicationOnboarding(processedByEmployeeId: string, applicantName: string, applicationId: string): Promise<void> {
  await createBonusPayment(
    'APPLICATION_ONBOARDING',
    processedByEmployeeId,
    `Onboarding für ${applicantName} durchgeführt`,
    applicationId,
    'Application'
  );
}

/**
 * Trigger für abgelehnte Bewerbung (HR)
 * Der HR-Mitarbeiter erhält auch bei Ablehnung eine Sonderzahlung für die Bearbeitung
 */
export async function triggerApplicationRejected(processedByEmployeeId: string, applicantName: string, applicationId: string): Promise<void> {
  await createBonusPayment(
    'APPLICATION_REJECTED',
    processedByEmployeeId,
    `Bewerbung von ${applicantName} bearbeitet (abgelehnt)`,
    applicationId,
    'Application'
  );
}

/**
 * Trigger für durchgeführte Schulung (Academy)
 */
export async function triggerTrainingConducted(instructorEmployeeId: string, trainingTitle: string, trainingId: string): Promise<void> {
  await createBonusPayment(
    'TRAINING_CONDUCTED',
    instructorEmployeeId,
    `Schulung "${trainingTitle}" durchgeführt`,
    trainingId,
    'Training'
  );
}

/**
 * Trigger für Schulungsteilnahme (Academy)
 */
export async function triggerTrainingParticipated(participantEmployeeId: string, trainingTitle: string, trainingId: string): Promise<void> {
  await createBonusPayment(
    'TRAINING_PARTICIPATED',
    participantEmployeeId,
    `An Schulung "${trainingTitle}" teilgenommen`,
    trainingId,
    'Training'
  );
}

/**
 * Trigger für abgenommene Prüfung (Academy)
 */
export async function triggerExamConducted(examinerEmployeeId: string, candidateName: string, examId: string): Promise<void> {
  await createBonusPayment(
    'EXAM_CONDUCTED',
    examinerEmployeeId,
    `Prüfung für ${candidateName} abgenommen`,
    examId,
    'AcademyExam'
  );
}

/**
 * Trigger für abgeschlossene Nachschulung (Academy)
 */
export async function triggerRetrainingCompleted(completedByEmployeeId: string, employeeName: string, retrainingId: string): Promise<void> {
  await createBonusPayment(
    'RETRAINING_COMPLETED',
    completedByEmployeeId,
    `Nachschulung für ${employeeName} durchgeführt`,
    retrainingId,
    'AcademyRetraining'
  );
}

/**
 * Trigger für abgeschlossenes Ausbildungsmodul (Academy)
 */
export async function triggerAcademyModuleCompleted(completedByEmployeeId: string, moduleName: string, progressId: string): Promise<void> {
  await createBonusPayment(
    'ACADEMY_MODULE_COMPLETED',
    completedByEmployeeId,
    `Modul "${moduleName}" abgeschlossen`,
    progressId,
    'AcademyProgress'
  );
}

/**
 * Trigger für eröffnete IA-Ermittlung
 */
export async function triggerInvestigationOpened(leadInvestigatorEmployeeId: string, caseNumber: string, investigationId: string): Promise<void> {
  await createBonusPayment(
    'INVESTIGATION_OPENED',
    leadInvestigatorEmployeeId,
    `IA-Ermittlung ${caseNumber} eröffnet`,
    investigationId,
    'Investigation'
  );
}

/**
 * Trigger für abgeschlossene IA-Ermittlung
 */
export async function triggerInvestigationClosed(leadInvestigatorEmployeeId: string, caseNumber: string, investigationId: string): Promise<void> {
  await createBonusPayment(
    'INVESTIGATION_CLOSED',
    leadInvestigatorEmployeeId,
    `IA-Ermittlung ${caseNumber} abgeschlossen`,
    investigationId,
    'Investigation'
  );
}

/**
 * Trigger für durchgeführte Unit-Überprüfung
 */
export async function triggerUnitReviewCompleted(reviewerEmployeeId: string, unitName: string, reviewId: string): Promise<void> {
  await createBonusPayment(
    'UNIT_REVIEW_COMPLETED',
    reviewerEmployeeId,
    `Überprüfung für ${unitName} durchgeführt`,
    reviewId,
    'UnitReview'
  );
}

/**
 * Trigger für eröffnete Ermittlungsakte (Detective)
 */
export async function triggerCaseOpened(detectiveEmployeeId: string, caseNumber: string, caseId: string): Promise<void> {
  await createBonusPayment(
    'CASE_OPENED',
    detectiveEmployeeId,
    `Ermittlungsakte ${caseNumber} eröffnet`,
    caseId,
    'Case'
  );
}

/**
 * Trigger für abgeschlossene Ermittlungsakte (Detective)
 */
export async function triggerCaseClosed(detectiveEmployeeId: string, caseNumber: string, caseId: string): Promise<void> {
  await createBonusPayment(
    'CASE_CLOSED',
    detectiveEmployeeId,
    `Ermittlungsakte ${caseNumber} abgeschlossen`,
    caseId,
    'Case'
  );
}

/**
 * Trigger für Räuber-Einsatzleitung
 */
export async function triggerRobberyLeader(leaderEmployeeId: string, robberyId: string): Promise<void> {
  await createBonusPayment(
    'ROBBERY_LEADER',
    leaderEmployeeId,
    `Einsatzleitung bei Raub`,
    robberyId,
    'Robbery'
  );
}

/**
 * Trigger für Räuber-Verhandlungsführung
 */
export async function triggerRobberyNegotiator(negotiatorEmployeeId: string, robberyId: string): Promise<void> {
  await createBonusPayment(
    'ROBBERY_NEGOTIATOR',
    negotiatorEmployeeId,
    `Verhandlungsführung bei Raub`,
    robberyId,
    'Robbery'
  );
}

/**
 * Trigger für eingelagertes Asservat
 */
export async function triggerEvidenceStored(storedByEmployeeId: string, evidenceName: string, evidenceId: string): Promise<void> {
  await createBonusPayment(
    'EVIDENCE_STORED',
    storedByEmployeeId,
    `Asservat "${evidenceName}" eingelagert`,
    evidenceId,
    'Evidence'
  );
}

/**
 * Trigger für erteilte Sanktion
 */
export async function triggerSanctionIssued(issuedByEmployeeId: string, employeeName: string, sanctionId: string): Promise<void> {
  await createBonusPayment(
    'SANCTION_ISSUED',
    issuedByEmployeeId,
    `Sanktion für ${employeeName} erteilt`,
    sanctionId,
    'Sanction'
  );
}

// ==================== CRON JOB FUNCTIONS ====================

/**
 * Schließt die aktuelle Woche und bereitet die Auszahlungsliste vor
 * Wird jeden Sonntag um 23:59 aufgerufen
 */
export async function closeCurrentWeek(): Promise<void> {
  try {
    const { weekStart, weekEnd } = getWeekBounds();

    // Berechne Gesamtbetrag
    const payments = await prisma.bonusPayment.findMany({
      where: {
        weekStart,
        weekEnd,
        status: 'PENDING',
      },
    });

    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

    // Erstelle oder aktualisiere BonusWeek
    await prisma.bonusWeek.upsert({
      where: {
        weekStart_weekEnd: { weekStart, weekEnd },
      },
      create: {
        weekStart,
        weekEnd,
        status: 'CLOSED',
        totalAmount,
        closedAt: new Date(),
        submittedToManagement: true,
        submittedAt: new Date(),
      },
      update: {
        status: 'CLOSED',
        totalAmount,
        closedAt: new Date(),
        submittedToManagement: true,
        submittedAt: new Date(),
      },
    });

    console.log(`✅ Bonus week closed: ${weekStart.toISOString()} - ${weekEnd.toISOString()}, Total: ${totalAmount}$`);
  } catch (error) {
    console.error('Error closing bonus week:', error);
  }
}

/**
 * Initialisiert den Cron-Job für wöchentlichen Reset
 */
export function initializeBonusCronJob(): void {
  // Berechne Zeit bis zum nächsten Sonntag 23:59
  const scheduleNextRun = () => {
    const now = new Date();
    const nextSunday = new Date(now);

    // Finde nächsten Sonntag
    const daysUntilSunday = (7 - now.getDay()) % 7;
    if (daysUntilSunday === 0 && now.getHours() >= 23 && now.getMinutes() >= 59) {
      // Es ist schon Sonntag nach 23:59, nächste Woche
      nextSunday.setDate(nextSunday.getDate() + 7);
    } else if (daysUntilSunday > 0) {
      nextSunday.setDate(nextSunday.getDate() + daysUntilSunday);
    }

    nextSunday.setHours(23, 59, 0, 0);

    const msUntilRun = nextSunday.getTime() - now.getTime();

    console.log(`📅 Next bonus week close scheduled for: ${nextSunday.toLocaleString('de-DE')}`);

    setTimeout(async () => {
      await closeCurrentWeek();
      // Schedule next run
      scheduleNextRun();
    }, msUntilRun);
  };

  scheduleNextRun();
}

// Hilfsfunktion: User-ID zu Employee-ID
export async function getEmployeeIdFromUserId(userId: string): Promise<string | null> {
  const employee = await prisma.employee.findUnique({
    where: { userId },
  });
  return employee?.id || null;
}
