import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Aktuelle Fragen aus dem alten System
const QUESTIONS = [
  'Was macht man vor Dienstbeginn?',
  'Wie lautet die Telefonseelsorge?',
  'Wer ist der Polizeichef?',
  'Wie schnell darf man in der Stadt und außerhalb fahren?',
  'Wie ist der Tacklebefehl?',
  'Wer muss einem Befehl folge leisten und warum? (Befehlskette)',
  'Bei wem müssen Abmeldungen und Dienstfrei beantragt werden?',
  'Was für Streifenfahrzeuge gibt es, nenne 3?',
  'Welche Fraktionsfunkfrequenz nutzen wir?',
  'Wie verhält man sich an einer Unfallstelle?',
  'Was ist der Unterschied zwischen Ermahnung/Verwarnung und wie lange bleiben diese im System?',
];

// Aktuelle Einstellungskriterien aus dem alten System
const CRITERIA = [
  'Stabilisationsschein geprüft',
  'Visumsstufe geprüft',
  'Keine Straftaten (7 Tage)',
  'Angemessenes Aussehen',
  'Keine Fraktionssperre',
  'Keine offenen Rechnungen',
  'Durchsuchen',
  'Blacklist gecheckt',
  'Diensthandbuch ausgegeben',
  'Einstellungstest',
  'RP Situation dargestellt (AVK) & Smalltalk',
];

async function main() {
  console.log('Seeding Academy Questions and Criteria...');

  // Fragen einfügen
  for (let i = 0; i < QUESTIONS.length; i++) {
    const question = QUESTIONS[i];
    const existing = await prisma.academyQuestion.findFirst({
      where: { question },
    });

    if (!existing) {
      await prisma.academyQuestion.create({
        data: {
          question,
          sortOrder: i,
          isActive: true,
        },
      });
      console.log(`✓ Frage erstellt: ${question.substring(0, 50)}...`);
    } else {
      console.log(`- Frage existiert bereits: ${question.substring(0, 50)}...`);
    }
  }

  // Kriterien einfügen
  for (let i = 0; i < CRITERIA.length; i++) {
    const name = CRITERIA[i];
    const existing = await prisma.academyCriterion.findFirst({
      where: { name },
    });

    if (!existing) {
      await prisma.academyCriterion.create({
        data: {
          name,
          sortOrder: i,
          isActive: true,
        },
      });
      console.log(`✓ Kriterium erstellt: ${name}`);
    } else {
      console.log(`- Kriterium existiert bereits: ${name}`);
    }
  }

  console.log('\n✅ Seeding abgeschlossen!');

  // Statistiken
  const questionCount = await prisma.academyQuestion.count();
  const criteriaCount = await prisma.academyCriterion.count();

  console.log(`\nStatistiken:`);
  console.log(`  - Fragen: ${questionCount}`);
  console.log(`  - Kriterien: ${criteriaCount}`);
}

main()
  .catch((e) => {
    console.error('Fehler:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
