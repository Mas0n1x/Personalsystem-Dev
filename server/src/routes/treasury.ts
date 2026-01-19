import { Router, Response } from 'express';
import { prisma } from '../prisma.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';

const router = Router();

// Hilfsfunktion: Treasury erstellen falls nicht vorhanden
async function getOrCreateTreasury() {
  let treasury = await prisma.treasury.findFirst();
  if (!treasury) {
    treasury = await prisma.treasury.create({
      data: {
        regularCash: 0,
        blackMoney: 0,
      },
    });
  }
  return treasury;
}

// GET aktueller Kassenstand
router.get('/', authMiddleware, requirePermission('treasury.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const treasury = await getOrCreateTreasury();
    res.json(treasury);
  } catch (error) {
    console.error('Get treasury error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen des Kassenstands' });
  }
});

// GET Transaktionshistorie
router.get('/transactions', authMiddleware, requirePermission('treasury.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { moneyType, page = '1', limit = '20' } = req.query;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (moneyType) {
      where.moneyType = moneyType as string;
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [transactions, total] = await Promise.all([
      prisma.treasuryTransaction.findMany({
        where,
        include: {
          createdBy: {
            select: {
              displayName: true,
              username: true,
              avatar: true,
            },
          },
        },
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.treasuryTransaction.count({ where }),
    ]);

    res.json({
      data: transactions,
      total,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      totalPages: Math.ceil(total / parseInt(limit as string)),
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Transaktionen' });
  }
});

// POST Einzahlung
router.post('/deposit', authMiddleware, requirePermission('treasury.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { moneyType, amount, reason } = req.body;

    if (!moneyType || !amount || !reason) {
      res.status(400).json({ error: 'Kassentyp, Betrag und Grund sind erforderlich' });
      return;
    }

    if (!['REGULAR', 'BLACK'].includes(moneyType)) {
      res.status(400).json({ error: 'Ungültiger Kassentyp' });
      return;
    }

    if (amount <= 0) {
      res.status(400).json({ error: 'Betrag muss positiv sein' });
      return;
    }

    const treasury = await getOrCreateTreasury();

    // Transaktion erstellen
    const transaction = await prisma.treasuryTransaction.create({
      data: {
        type: 'DEPOSIT',
        moneyType,
        amount,
        reason,
        createdById: req.user!.id,
      },
      include: {
        createdBy: {
          select: {
            displayName: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    // Kasse aktualisieren
    const updatedTreasury = await prisma.treasury.update({
      where: { id: treasury.id },
      data: {
        regularCash: moneyType === 'REGULAR' ? treasury.regularCash + amount : treasury.regularCash,
        blackMoney: moneyType === 'BLACK' ? treasury.blackMoney + amount : treasury.blackMoney,
      },
    });

    res.status(201).json({
      transaction,
      treasury: updatedTreasury,
    });
  } catch (error) {
    console.error('Deposit error:', error);
    res.status(500).json({ error: 'Fehler bei der Einzahlung' });
  }
});

// POST Auszahlung
router.post('/withdraw', authMiddleware, requirePermission('treasury.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { moneyType, amount, reason } = req.body;

    if (!moneyType || !amount || !reason) {
      res.status(400).json({ error: 'Kassentyp, Betrag und Grund sind erforderlich' });
      return;
    }

    if (!['REGULAR', 'BLACK'].includes(moneyType)) {
      res.status(400).json({ error: 'Ungültiger Kassentyp' });
      return;
    }

    if (amount <= 0) {
      res.status(400).json({ error: 'Betrag muss positiv sein' });
      return;
    }

    const treasury = await getOrCreateTreasury();

    // Prüfen ob genug Geld vorhanden
    const currentBalance = moneyType === 'REGULAR' ? treasury.regularCash : treasury.blackMoney;
    if (currentBalance < amount) {
      res.status(400).json({ error: 'Nicht genügend Guthaben in der Kasse' });
      return;
    }

    // Transaktion erstellen
    const transaction = await prisma.treasuryTransaction.create({
      data: {
        type: 'WITHDRAWAL',
        moneyType,
        amount,
        reason,
        createdById: req.user!.id,
      },
      include: {
        createdBy: {
          select: {
            displayName: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    // Kasse aktualisieren
    const updatedTreasury = await prisma.treasury.update({
      where: { id: treasury.id },
      data: {
        regularCash: moneyType === 'REGULAR' ? treasury.regularCash - amount : treasury.regularCash,
        blackMoney: moneyType === 'BLACK' ? treasury.blackMoney - amount : treasury.blackMoney,
      },
    });

    res.status(201).json({
      transaction,
      treasury: updatedTreasury,
    });
  } catch (error) {
    console.error('Withdraw error:', error);
    res.status(500).json({ error: 'Fehler bei der Auszahlung' });
  }
});

export default router;
