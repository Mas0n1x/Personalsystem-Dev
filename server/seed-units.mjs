import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Units die erstellt werden sollen
const units = [
  {
    name: 'Internal Affairs',
    shortName: 'IA',
    description: 'Interne Ermittlungen und Disziplinarmaßnahmen',
    color: '#ef4444',
    sortOrder: 0,
  },
  {
    name: 'Human Ressource',
    shortName: 'HR',
    description: 'Personalverwaltung und Einstellungen',
    color: '#22c55e',
    sortOrder: 1,
  },
  {
    name: 'Police Academy',
    shortName: 'PA',
    description: 'Ausbildung und Schulungen',
    color: '#3b82f6',
    sortOrder: 2,
  },
  {
    name: 'Quality Assurance',
    shortName: 'QA',
    description: 'Qualitätssicherung und Unit-Überprüfungen',
    color: '#a855f7',
    sortOrder: 3,
  },
  {
    name: 'Biker',
    shortName: null,
    description: 'Motorradstaffel',
    color: '#f97316',
    sortOrder: 4,
  },
  {
    name: 'Management',
    shortName: 'MGMT',
    description: 'Führungsebene und Management',
    color: '#eab308',
    sortOrder: 5,
  },
  {
    name: 'Eventteam',
    shortName: 'ET',
    description: 'Event-Organisation und Durchführung',
    color: '#ec4899',
    sortOrder: 6,
  },
  {
    name: 'Special Weapons & Tactics',
    shortName: 'SWAT',
    description: 'Spezialeinheit für kritische Einsätze',
    color: '#1e293b',
    sortOrder: 7,
  },
  {
    name: 'State & Highway Patrol',
    shortName: 'SHP',
    description: 'Verkehrsüberwachung und Autobahnpatrouille',
    color: '#0ea5e9',
    sortOrder: 8,
  },
  {
    name: 'Detectives',
    shortName: 'DET',
    description: 'Kriminalermittlungen und Aktenführung',
    color: '#6366f1',
    sortOrder: 9,
  },
  {
    name: 'Teamleitung',
    shortName: 'TL',
    description: 'Team-Leitungspositionen',
    color: '#14b8a6',
    sortOrder: 10,
  },
];

async function seed() {
  console.log('🌱 Seeding Units...\n');

  for (const unit of units) {
    // Prüfen ob Unit bereits existiert
    const existing = await prisma.unit.findUnique({
      where: { name: unit.name },
    });

    if (existing) {
      console.log(`⏭️  "${unit.name}" existiert bereits, wird übersprungen`);
      continue;
    }

    const created = await prisma.unit.create({
      data: unit,
    });

    console.log(`✅ "${created.name}" erstellt (ID: ${created.id})`);
  }

  console.log('\n✨ Seed abgeschlossen!');
  console.log('\nHinweis: Die Discord-Rollen müssen manuell über die Admin-Oberfläche zugewiesen werden.');
  console.log('Gehe zu: Administration > Units Verwaltung');
}

seed()
  .catch((e) => {
    console.error('❌ Fehler beim Seeden:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
