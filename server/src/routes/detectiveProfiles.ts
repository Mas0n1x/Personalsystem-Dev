import express, { Response } from 'express';
import { prisma } from '../prisma.js';
import { authMiddleware, requirePermission, AuthRequest } from '../middleware/authMiddleware.js';

const router = express.Router();

// ==================== DETECTIVE-PROFILE (Namen-Dokumentation) ====================

// GET alle Detective-Profile
router.get('/', authMiddleware, requirePermission('detectives.view'), async (_req: AuthRequest, res: Response) => {
  try {
    // Alle aktiven Employees mit "Detectives" im Department laden
    const detectives = await prisma.employee.findMany({
      where: {
        status: 'ACTIVE',
        department: {
          contains: 'Detectives',
        },
      },
      select: {
        id: true,
        rank: true,
        rankLevel: true,
        department: true,
        badgeNumber: true,
        user: {
          select: {
            displayName: true,
            username: true,
            avatar: true,
          },
        },
        detectiveProfile: true,
      },
      orderBy: {
        rankLevel: 'desc',
      },
    });

    // Profile erstellen, falls sie nicht existieren
    const profiles = await Promise.all(
      detectives.map(async (detective) => {
        if (!detective.detectiveProfile) {
          // Profil erstellen
          const newProfile = await prisma.detectiveProfile.create({
            data: {
              employeeId: detective.id,
            },
          });
          return {
            ...newProfile,
            employee: {
              id: detective.id,
              rank: detective.rank,
              rankLevel: detective.rankLevel,
              department: detective.department,
              badgeNumber: detective.badgeNumber,
              user: detective.user,
            },
          };
        }
        return {
          ...detective.detectiveProfile,
          employee: {
            id: detective.id,
            rank: detective.rank,
            rankLevel: detective.rankLevel,
            department: detective.department,
            badgeNumber: detective.badgeNumber,
            user: detective.user,
          },
        };
      })
    );

    res.json(profiles);
  } catch (error) {
    console.error('Get detective profiles error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Detective-Profile' });
  }
});

// GET ein Detective-Profil
router.get('/:employeeId', authMiddleware, requirePermission('detectives.view'), async (req: AuthRequest, res: Response) => {
  try {
    let profile = await prisma.detectiveProfile.findUnique({
      where: { employeeId: req.params.employeeId },
      include: {
        employee: {
          select: {
            id: true,
            rank: true,
            rankLevel: true,
            department: true,
            badgeNumber: true,
            user: {
              select: {
                displayName: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    // Wenn noch kein Profil existiert, erstelle ein leeres
    if (!profile) {
      profile = await prisma.detectiveProfile.create({
        data: {
          employeeId: req.params.employeeId,
        },
        include: {
          employee: {
            select: {
              id: true,
              rank: true,
              rankLevel: true,
              department: true,
              badgeNumber: true,
              user: {
                select: {
                  displayName: true,
                  username: true,
                  avatar: true,
                },
              },
            },
          },
        },
      });
    }

    res.json(profile);
  } catch (error) {
    console.error('Get detective profile error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen des Detective-Profils' });
  }
});

// PUT Detective-Profil aktualisieren
router.put('/:employeeId', authMiddleware, requirePermission('detectives.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { civilianCoverName, detectiveName, realName } = req.body;

    // Prüfen ob Profil existiert
    const existing = await prisma.detectiveProfile.findUnique({
      where: { employeeId: req.params.employeeId },
    });

    let profile;

    if (existing) {
      // Update
      profile = await prisma.detectiveProfile.update({
        where: { employeeId: req.params.employeeId },
        data: {
          civilianCoverName: civilianCoverName || null,
          detectiveName: detectiveName || null,
          realName: realName || null,
        },
        include: {
          employee: {
            select: {
              id: true,
              rank: true,
              rankLevel: true,
              department: true,
              badgeNumber: true,
              user: {
                select: {
                  displayName: true,
                  username: true,
                  avatar: true,
                },
              },
            },
          },
        },
      });
    } else {
      // Create
      profile = await prisma.detectiveProfile.create({
        data: {
          employeeId: req.params.employeeId,
          civilianCoverName: civilianCoverName || null,
          detectiveName: detectiveName || null,
          realName: realName || null,
        },
        include: {
          employee: {
            select: {
              id: true,
              rank: true,
              rankLevel: true,
              department: true,
              badgeNumber: true,
              user: {
                select: {
                  displayName: true,
                  username: true,
                  avatar: true,
                },
              },
            },
          },
        },
      });
    }

    res.json(profile);
  } catch (error) {
    console.error('Update detective profile error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Detective-Profils' });
  }
});

// DELETE Detective-Profil löschen
router.delete('/:employeeId', authMiddleware, requirePermission('detectives.manage'), async (req: AuthRequest, res: Response) => {
  try {
    await prisma.detectiveProfile.delete({
      where: { employeeId: req.params.employeeId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete detective profile error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Detective-Profils' });
  }
});

export default router;
