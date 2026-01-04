import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';
import { triggerExamConducted, triggerRetrainingCompleted, triggerAcademyModuleCompleted, getEmployeeIdFromUserId } from '../services/bonusService.js';

const router = Router();

router.use(authMiddleware);

// ==================== ACADEMY MODULES (Admin) ====================

// Get all modules
router.get('/modules', requirePermission('academy.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const modules = await prisma.academyModule.findMany({
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });

    res.json(modules);
  } catch (error) {
    console.error('Error fetching academy modules:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Module' });
  }
});

// Create module (Admin)
router.post('/modules', requirePermission('academy.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, category, sortOrder } = req.body;

    if (!name || !category) {
      res.status(400).json({ error: 'Name und Kategorie sind erforderlich' });
      return;
    }

    if (!['JUNIOR_OFFICER', 'OFFICER'].includes(category)) {
      res.status(400).json({ error: 'Kategorie muss JUNIOR_OFFICER oder OFFICER sein' });
      return;
    }

    const module = await prisma.academyModule.create({
      data: {
        name,
        description,
        category,
        sortOrder: sortOrder || 0,
      },
    });

    res.status(201).json(module);
  } catch (error) {
    console.error('Error creating academy module:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen des Moduls' });
  }
});

// Update module (Admin)
router.put('/modules/:id', requirePermission('academy.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, category, sortOrder, isActive } = req.body;

    const module = await prisma.academyModule.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json(module);
  } catch (error) {
    console.error('Error updating academy module:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Moduls' });
  }
});

// Delete module (Admin)
router.delete('/modules/:id', requirePermission('academy.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.academyModule.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting academy module:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Moduls' });
  }
});

// Reorder modules (Admin)
router.put('/modules/reorder', requirePermission('academy.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { modules } = req.body; // Array of { id, sortOrder }

    if (!Array.isArray(modules)) {
      res.status(400).json({ error: 'Module-Array erforderlich' });
      return;
    }

    await Promise.all(
      modules.map((m: { id: string; sortOrder: number }) =>
        prisma.academyModule.update({
          where: { id: m.id },
          data: { sortOrder: m.sortOrder },
        })
      )
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error reordering modules:', error);
    res.status(500).json({ error: 'Fehler beim Neuordnen der Module' });
  }
});

// ==================== TRAINEES (Azubis) ====================

// Get all trainees (Rang 1-2) with their progress
router.get('/trainees', requirePermission('academy.view'), async (_req: AuthRequest, res: Response) => {
  try {
    // Hole alle aktiven Module
    const modules = await prisma.academyModule.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });

    // Hole alle Mitarbeiter mit Rang 1-2 (Junior Officer und darunter)
    const trainees = await prisma.employee.findMany({
      where: {
        status: 'ACTIVE',
        rankLevel: { in: [1, 2] }, // Rang 1 = Cadet/Junior Officer, Rang 2 = Officer
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            username: true,
            avatar: true,
          },
        },
        academyProgress: {
          include: {
            module: true,
            completedBy: {
              select: {
                displayName: true,
                username: true,
              },
            },
          },
        },
      },
      orderBy: { user: { displayName: 'asc' } },
    });

    // Strukturiere die Daten
    const traineesWithProgress = trainees.map(trainee => {
      const juniorOfficerModules = modules.filter(m => m.category === 'JUNIOR_OFFICER');
      const officerModules = modules.filter(m => m.category === 'OFFICER');

      const getModuleProgress = (moduleId: string) => {
        return trainee.academyProgress.find(p => p.moduleId === moduleId);
      };

      const juniorOfficerProgress = juniorOfficerModules.map(m => ({
        module: m,
        progress: getModuleProgress(m.id),
      }));

      const officerProgress = officerModules.map(m => ({
        module: m,
        progress: getModuleProgress(m.id),
      }));

      const juniorOfficerCompleted = juniorOfficerProgress.filter(p => p.progress?.completed).length;
      const officerCompleted = officerProgress.filter(p => p.progress?.completed).length;

      return {
        ...trainee,
        juniorOfficerModules: juniorOfficerProgress,
        officerModules: officerProgress,
        juniorOfficerCompleted,
        juniorOfficerTotal: juniorOfficerModules.length,
        officerCompleted,
        officerTotal: officerModules.length,
        canRequestJuniorOfficerUprank: juniorOfficerCompleted === juniorOfficerModules.length && juniorOfficerModules.length > 0,
        canRequestOfficerUprank: officerCompleted === officerModules.length && officerModules.length > 0,
      };
    });

    res.json(traineesWithProgress);
  } catch (error) {
    console.error('Error fetching trainees:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Azubis' });
  }
});

// ==================== PROGRESS ====================

// Toggle module completion for a trainee
router.post('/progress/toggle', requirePermission('academy.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId, moduleId } = req.body;
    const userId = req.user!.id;

    if (!employeeId || !moduleId) {
      res.status(400).json({ error: 'employeeId und moduleId sind erforderlich' });
      return;
    }

    // Prüfe ob Progress existiert
    const existingProgress = await prisma.academyProgress.findUnique({
      where: {
        moduleId_employeeId: { moduleId, employeeId },
      },
    });

    if (existingProgress) {
      // Toggle: Wenn completed, dann uncomplete und umgekehrt
      const updated = await prisma.academyProgress.update({
        where: { id: existingProgress.id },
        data: {
          completed: !existingProgress.completed,
          completedAt: !existingProgress.completed ? new Date() : null,
          completedById: !existingProgress.completed ? userId : null,
        },
        include: {
          module: true,
          completedBy: {
            select: { displayName: true, username: true },
          },
        },
      });

      // Bonus-Trigger wenn Modul abgeschlossen wird (nicht wenn es wieder geöffnet wird)
      if (updated.completed && !existingProgress.completed) {
        const completedByEmployeeId = await getEmployeeIdFromUserId(userId);
        if (completedByEmployeeId) {
          await triggerAcademyModuleCompleted(completedByEmployeeId, updated.module.name, updated.id);
        }
      }

      res.json(updated);
    } else {
      // Erstelle neuen Progress als completed
      const created = await prisma.academyProgress.create({
        data: {
          moduleId,
          employeeId,
          completed: true,
          completedAt: new Date(),
          completedById: userId,
        },
        include: {
          module: true,
          completedBy: {
            select: { displayName: true, username: true },
          },
        },
      });

      // Bonus-Trigger für neu abgeschlossenes Modul
      const completedByEmployeeId = await getEmployeeIdFromUserId(userId);
      if (completedByEmployeeId) {
        await triggerAcademyModuleCompleted(completedByEmployeeId, created.module.name, created.id);
      }

      res.json(created);
    }
  } catch (error) {
    console.error('Error toggling progress:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Fortschritts' });
  }
});

// ==================== NOTES ====================

// Get notes for a trainee
router.get('/notes/:employeeId', requirePermission('academy.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId } = req.params;

    const notes = await prisma.academyNote.findMany({
      where: { employeeId },
      include: {
        createdBy: {
          select: {
            id: true,
            displayName: true,
            username: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(notes);
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Notizen' });
  }
});

// Create note for a trainee
router.post('/notes', requirePermission('academy.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId, content } = req.body;
    const userId = req.user!.id;

    if (!employeeId || !content) {
      res.status(400).json({ error: 'employeeId und content sind erforderlich' });
      return;
    }

    const note = await prisma.academyNote.create({
      data: {
        employeeId,
        content,
        createdById: userId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            displayName: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    res.status(201).json(note);
  } catch (error) {
    console.error('Error creating note:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Notiz' });
  }
});

// Delete note
router.delete('/notes/:id', requirePermission('academy.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.academyNote.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ error: 'Fehler beim Löschen der Notiz' });
  }
});

// ==================== UPRANK REQUEST ====================

// Request uprank from academy
router.post('/request-uprank', requirePermission('academy.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId, targetRank } = req.body;
    const userId = req.user!.id;

    if (!employeeId || !targetRank) {
      res.status(400).json({ error: 'employeeId und targetRank sind erforderlich' });
      return;
    }

    // Hole Employee
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        user: { select: { displayName: true, username: true } },
        academyProgress: { include: { module: true } },
      },
    });

    if (!employee) {
      res.status(404).json({ error: 'Mitarbeiter nicht gefunden' });
      return;
    }

    // Prüfe ob alle Module für den Zielrang abgeschlossen sind
    const requiredCategory = targetRank === 'Junior Officer' ? 'JUNIOR_OFFICER' : 'OFFICER';
    const modules = await prisma.academyModule.findMany({
      where: { category: requiredCategory, isActive: true },
    });

    const completedModules = employee.academyProgress.filter(
      p => p.completed && modules.some(m => m.id === p.moduleId)
    );

    if (completedModules.length < modules.length) {
      res.status(400).json({
        error: `Nicht alle ${requiredCategory === 'JUNIOR_OFFICER' ? 'Junior Officer' : 'Officer'} Module abgeschlossen`
      });
      return;
    }

    // Prüfe ob bereits ein offener Antrag existiert
    const existingRequest = await prisma.uprankRequest.findFirst({
      where: {
        employeeId,
        status: 'PENDING',
      },
    });

    if (existingRequest) {
      res.status(400).json({ error: 'Es existiert bereits ein offener Uprank-Antrag für diesen Mitarbeiter' });
      return;
    }

    // Erstelle Uprank-Antrag
    const modulesCompleted = completedModules.map(p => p.module.name).join(', ');
    const reason = `Academy-Ausbildung abgeschlossen. Absolvierte Module: ${modulesCompleted}`;

    const request = await prisma.uprankRequest.create({
      data: {
        employeeId,
        currentRank: employee.rank,
        targetRank,
        reason,
        achievements: `Alle ${modules.length} Module der ${requiredCategory === 'JUNIOR_OFFICER' ? 'Junior Officer' : 'Officer'} Ausbildung erfolgreich abgeschlossen.`,
        requestedById: userId,
        isAcademyRequest: true,
      },
      include: {
        employee: {
          include: { user: { select: { displayName: true, username: true } } },
        },
        requestedBy: {
          select: { displayName: true, username: true },
        },
      },
    });

    res.status(201).json(request);
  } catch (error) {
    console.error('Error creating uprank request:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen des Uprank-Antrags' });
  }
});

// ==================== EXAMS (Prüfungsprotokolle) ====================

// Get all exams
router.get('/exams', requirePermission('academy.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId, examType, passed } = req.query;

    const where: Record<string, unknown> = {};
    if (employeeId) where.employeeId = employeeId;
    if (examType) where.examType = examType;
    if (passed !== undefined) where.passed = passed === 'true';

    const exams = await prisma.academyExam.findMany({
      where,
      include: {
        employee: {
          include: {
            user: {
              select: { displayName: true, username: true, avatar: true },
            },
          },
        },
        examiner: {
          select: { id: true, displayName: true, username: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(exams);
  } catch (error) {
    console.error('Error fetching exams:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Prüfungen' });
  }
});

// Get single exam
router.get('/exams/:id', requirePermission('academy.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const exam = await prisma.academyExam.findUnique({
      where: { id },
      include: {
        employee: {
          include: {
            user: {
              select: { displayName: true, username: true, avatar: true },
            },
          },
        },
        examiner: {
          select: { id: true, displayName: true, username: true, avatar: true },
        },
      },
    });

    if (!exam) {
      res.status(404).json({ error: 'Prüfung nicht gefunden' });
      return;
    }

    res.json(exam);
  } catch (error) {
    console.error('Error fetching exam:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Prüfung' });
  }
});

// Create exam
router.post('/exams', requirePermission('academy.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      employeeId,
      examType = 'WIEDEREINSTELLUNG',
      theoryScore = 0,
      theoryMax = 13,
      funcCodesScore = 0,
      funcCodesMax = 10,
      lawScore = 0,
      lawMax = 10,
      reportScore = 0,
      reportMax = 25,
      situationsPassed = false,
      examinerNotes,
    } = req.body;

    const userId = req.user!.id;

    if (!employeeId) {
      res.status(400).json({ error: 'employeeId ist erforderlich' });
      return;
    }

    // Calculate total score and grade
    const totalScore = theoryScore + funcCodesScore + lawScore + reportScore;
    const maxScore = theoryMax + funcCodesMax + lawMax + reportMax;
    const percentage = (totalScore / maxScore) * 100;

    // Grade calculation: 1 = 90-100%, 2 = 80-89%, 3 = 70-79%, 4 = 60-69%, 5 = 50-59%, 6 = <50%
    let grade: number;
    if (percentage >= 90) grade = 1;
    else if (percentage >= 80) grade = 2;
    else if (percentage >= 70) grade = 3;
    else if (percentage >= 60) grade = 4;
    else if (percentage >= 50) grade = 5;
    else grade = 6;

    // Passed if grade <= 4 AND situationsPassed
    const passed = grade <= 4 && situationsPassed;

    const exam = await prisma.academyExam.create({
      data: {
        employeeId,
        examType,
        theoryScore,
        theoryMax,
        funcCodesScore,
        funcCodesMax,
        lawScore,
        lawMax,
        reportScore,
        reportMax,
        situationsPassed,
        totalScore,
        maxScore,
        grade,
        passed,
        examinerNotes,
        examinerId: userId,
      },
      include: {
        employee: {
          include: {
            user: {
              select: { displayName: true, username: true, avatar: true },
            },
          },
        },
        examiner: {
          select: { id: true, displayName: true, username: true, avatar: true },
        },
      },
    });

    // Bonus-Trigger für abgenommene Prüfung
    const examinerEmployeeId = await getEmployeeIdFromUserId(userId);
    if (examinerEmployeeId) {
      const candidateName = exam.employee.user.displayName || exam.employee.user.username;
      await triggerExamConducted(examinerEmployeeId, candidateName, exam.id);
    }

    res.status(201).json(exam);
  } catch (error) {
    console.error('Error creating exam:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Prüfung' });
  }
});

// Update exam
router.put('/exams/:id', requirePermission('academy.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      theoryScore,
      theoryMax,
      funcCodesScore,
      funcCodesMax,
      lawScore,
      lawMax,
      reportScore,
      reportMax,
      situationsPassed,
      examinerNotes,
    } = req.body;

    // Get existing exam to calculate new values
    const existing = await prisma.academyExam.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Prüfung nicht gefunden' });
      return;
    }

    const newTheoryScore = theoryScore ?? existing.theoryScore;
    const newTheoryMax = theoryMax ?? existing.theoryMax;
    const newFuncCodesScore = funcCodesScore ?? existing.funcCodesScore;
    const newFuncCodesMax = funcCodesMax ?? existing.funcCodesMax;
    const newLawScore = lawScore ?? existing.lawScore;
    const newLawMax = lawMax ?? existing.lawMax;
    const newReportScore = reportScore ?? existing.reportScore;
    const newReportMax = reportMax ?? existing.reportMax;
    const newSituationsPassed = situationsPassed ?? existing.situationsPassed;

    const totalScore = newTheoryScore + newFuncCodesScore + newLawScore + newReportScore;
    const maxScore = newTheoryMax + newFuncCodesMax + newLawMax + newReportMax;
    const percentage = (totalScore / maxScore) * 100;

    let grade: number;
    if (percentage >= 90) grade = 1;
    else if (percentage >= 80) grade = 2;
    else if (percentage >= 70) grade = 3;
    else if (percentage >= 60) grade = 4;
    else if (percentage >= 50) grade = 5;
    else grade = 6;

    const passed = grade <= 4 && newSituationsPassed;

    const exam = await prisma.academyExam.update({
      where: { id },
      data: {
        theoryScore: newTheoryScore,
        theoryMax: newTheoryMax,
        funcCodesScore: newFuncCodesScore,
        funcCodesMax: newFuncCodesMax,
        lawScore: newLawScore,
        lawMax: newLawMax,
        reportScore: newReportScore,
        reportMax: newReportMax,
        situationsPassed: newSituationsPassed,
        totalScore,
        maxScore,
        grade,
        passed,
        ...(examinerNotes !== undefined && { examinerNotes }),
      },
      include: {
        employee: {
          include: {
            user: {
              select: { displayName: true, username: true, avatar: true },
            },
          },
        },
        examiner: {
          select: { id: true, displayName: true, username: true, avatar: true },
        },
      },
    });

    res.json(exam);
  } catch (error) {
    console.error('Error updating exam:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Prüfung' });
  }
});

// Delete exam
router.delete('/exams/:id', requirePermission('academy.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.academyExam.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting exam:', error);
    res.status(500).json({ error: 'Fehler beim Löschen der Prüfung' });
  }
});

// ==================== RETRAININGS (Nachschulungen) ====================

// Get all retrainings
router.get('/retrainings', requirePermission('academy.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId, status, type } = req.query;

    const where: Record<string, unknown> = {};
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;
    if (type) where.type = type;

    const retrainings = await prisma.academyRetraining.findMany({
      where,
      include: {
        employee: {
          include: {
            user: {
              select: { displayName: true, username: true, avatar: true },
            },
          },
        },
        createdBy: {
          select: { id: true, displayName: true, username: true, avatar: true },
        },
        completedBy: {
          select: { id: true, displayName: true, username: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(retrainings);
  } catch (error) {
    console.error('Error fetching retrainings:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Nachschulungen' });
  }
});

// Create retraining
router.post('/retrainings', requirePermission('academy.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId, type, reason, notes } = req.body;
    const userId = req.user!.id;

    if (!employeeId || !type || !reason) {
      res.status(400).json({ error: 'employeeId, type und reason sind erforderlich' });
      return;
    }

    const retraining = await prisma.academyRetraining.create({
      data: {
        employeeId,
        type,
        reason,
        notes,
        createdById: userId,
      },
      include: {
        employee: {
          include: {
            user: {
              select: { displayName: true, username: true, avatar: true },
            },
          },
        },
        createdBy: {
          select: { id: true, displayName: true, username: true, avatar: true },
        },
      },
    });

    res.status(201).json(retraining);
  } catch (error) {
    console.error('Error creating retraining:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Nachschulung' });
  }
});

// Update retraining (complete or update notes)
router.put('/retrainings/:id', requirePermission('academy.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const userId = req.user!.id;

    // Hole vorherigen Status für Bonus-Trigger
    const previousRetraining = await prisma.academyRetraining.findUnique({
      where: { id },
      select: { status: true }
    });

    const updateData: Record<string, unknown> = {};
    if (notes !== undefined) updateData.notes = notes;
    if (status) {
      updateData.status = status;
      if (status === 'COMPLETED') {
        updateData.completedAt = new Date();
        updateData.completedById = userId;
      }
    }

    const retraining = await prisma.academyRetraining.update({
      where: { id },
      data: updateData,
      include: {
        employee: {
          include: {
            user: {
              select: { displayName: true, username: true, avatar: true },
            },
          },
        },
        createdBy: {
          select: { id: true, displayName: true, username: true, avatar: true },
        },
        completedBy: {
          select: { id: true, displayName: true, username: true, avatar: true },
        },
      },
    });

    // Bonus-Trigger wenn Nachschulung abgeschlossen wird
    if (status === 'COMPLETED' && previousRetraining?.status !== 'COMPLETED') {
      const completedByEmployeeId = await getEmployeeIdFromUserId(userId);
      if (completedByEmployeeId) {
        const employeeName = retraining.employee.user.displayName || retraining.employee.user.username;
        await triggerRetrainingCompleted(completedByEmployeeId, employeeName, id);
      }
    }

    res.json(retraining);
  } catch (error) {
    console.error('Error updating retraining:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Nachschulung' });
  }
});

// Delete retraining
router.delete('/retrainings/:id', requirePermission('academy.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.academyRetraining.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting retraining:', error);
    res.status(500).json({ error: 'Fehler beim Löschen der Nachschulung' });
  }
});

// ==================== STATS ====================

// Get academy stats
router.get('/stats', requirePermission('academy.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const [
      totalTrainees,
      totalModules,
      juniorOfficerModules,
      officerModules,
    ] = await Promise.all([
      prisma.employee.count({ where: { status: 'ACTIVE', rankLevel: { in: [1, 2] } } }),
      prisma.academyModule.count({ where: { isActive: true } }),
      prisma.academyModule.count({ where: { isActive: true, category: 'JUNIOR_OFFICER' } }),
      prisma.academyModule.count({ where: { isActive: true, category: 'OFFICER' } }),
    ]);

    res.json({
      totalTrainees,
      totalModules,
      juniorOfficerModules,
      officerModules,
    });
  } catch (error) {
    console.error('Error fetching academy stats:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Statistiken' });
  }
});

export default router;
