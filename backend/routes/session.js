const express = require("express");
const router = express.Router();
const { Session, Quiz, User } = require("../models");
const {
  authenticateToken,
  requireRole,
  optionalAuth,
  requireOwnership,
} = require("../middleware/auth");
const { Op } = require("sequelize");

// Middleware pour charger une session
const loadSession = async (req, res, next) => {
  try {
    const sessionId = req.params.id;

    if (!sessionId) {
      return res.status(400).json({
        error: "ID de session requis",
      });
    }

    const session = await Session.findByPk(sessionId, {
      include: [
        {
          model: Quiz,
          as: "quiz",
          include: [
            {
              model: User,
              as: "creator",
              attributes: ["id", "username", "firstName", "lastName"],
            },
          ],
        },
        {
          model: User,
          as: "host",
          attributes: ["id", "username", "firstName", "lastName"],
        },
      ],
    });

    if (!session) {
      return res.status(404).json({
        error: "Session non trouvée",
        code: "SESSION_NOT_FOUND",
      });
    }

    req.session = session;
    next();
  } catch (error) {
    console.error("Erreur lors du chargement de la session:", error);
    res.status(500).json({
      error: "Erreur lors du chargement de la session",
    });
  }
};

// Middleware pour vérifier les permissions sur une session
const requireSessionOwnership = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: "Authentification requise",
    });
  }

  const session = req.session;
  const isHost = session.hostId === req.user.id;
  const isQuizOwner = session.quiz?.creatorId === req.user.id;
  const isAdmin = req.user.role === "admin";

  if (!isHost && !isQuizOwner && !isAdmin) {
    return res.status(403).json({
      error:
        "Permission insuffisante - Vous devez être l'hôte ou le créateur du quiz",
    });
  }

  next();
};

// GET /api/session - Lister les sessions
router.get("/", authenticateToken, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      quizId,
      hostId,
      my = false,
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const whereConditions = {};

    // Filtrer par statut
    if (status) {
      whereConditions.status = status;
    }

    // Filtrer par quiz
    if (quizId) {
      whereConditions.quizId = quizId;
    }

    // Filtrer par hôte
    if (hostId) {
      whereConditions.hostId = hostId;
    }

    // Mes sessions seulement
    if (my === "true") {
      whereConditions.hostId = req.user.id;
    }

    const { count, rows: sessions } = await Session.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: Quiz,
          as: "quiz",
          attributes: ["id", "title", "category", "difficulty"],
        },
        {
          model: User,
          as: "host",
          attributes: ["id", "username", "firstName", "lastName"],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: limitNum,
      offset,
    });

    const formattedSessions = sessions.map((session) => ({
      id: session.id,
      code: session.code,
      title: session.title,
      status: session.status,
      currentQuestionIndex: session.currentQuestionIndex,
      participantCount: session.participants?.length || 0,
      settings: session.settings,
      stats: session.stats,
      quiz: session.quiz,
      host: session.host,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      createdAt: session.createdAt,
    }));

    res.json({
      sessions: formattedSessions,
      pagination: {
        current: pageNum,
        pages: Math.ceil(count / limitNum),
        total: count,
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des sessions:", error);
    res.status(500).json({
      error: "Erreur lors de la récupération des sessions",
    });
  }
});

// GET /api/session/:id - Récupérer une session spécifique
router.get("/:id", optionalAuth, loadSession, async (req, res) => {
  try {
    const session = req.session;

    // Permissions de lecture
    const isHost = req.user && req.user.id === session.hostId;
    const isQuizOwner = req.user && req.user.id === session.quiz?.creatorId;
    const isAdmin = req.user && req.user.role === "admin";
    const isParticipant =
      req.user && session.participants?.some((p) => p.id === req.user.id);

    // Les sessions fermées sont visibles par tous pour consultation
    const canView =
      isHost ||
      isQuizOwner ||
      isAdmin ||
      isParticipant ||
      ["finished", "cancelled"].includes(session.status);

    if (!canView) {
      return res.status(403).json({
        error: "Accès refusé à cette session",
      });
    }

    // Formater la réponse selon les permissions
    const responseData = {
      id: session.id,
      code: session.code,
      title: session.title,
      status: session.status,
      currentQuestionIndex: session.currentQuestionIndex,
      settings: session.settings,
      stats: session.stats,
      quiz: {
        id: session.quiz.id,
        title: session.quiz.title,
        category: session.quiz.category,
        difficulty: session.quiz.difficulty,
        creator: session.quiz.creator,
      },
      host: session.host,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      currentQuestionStartedAt: session.currentQuestionStartedAt,
      createdAt: session.createdAt,
    };

    // Informations détaillées pour l'hôte et le créateur
    if (isHost || isQuizOwner || isAdmin) {
      responseData.participants = session.participants;
      responseData.responses = session.responses;
      responseData.quiz.questions = session.quiz.questions;
    } else {
      // Participants voient seulement la liste des participants et leurs propres réponses
      responseData.participants = session.participants?.map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        isConnected: p.isConnected,
        score: p.score,
      }));

      if (req.user && isParticipant) {
        const participant = session.participants.find(
          (p) => p.id === req.user.id
        );
        responseData.myResponses = participant?.responses;
        responseData.myScore = participant?.score;
      }
    }

    res.json({ session: responseData });
  } catch (error) {
    console.error("Erreur lors de la récupération de la session:", error);
    res.status(500).json({
      error: "Erreur lors de la récupération de la session",
    });
  }
});

// GET /api/session/code/:code - Rejoindre une session par code
router.get("/code/:code", optionalAuth, async (req, res) => {
  try {
    const { code } = req.params;

    const session = await Session.findByCode(code);

    if (!session) {
      return res.status(404).json({
        error: "Session non trouvée avec ce code",
        code: "INVALID_SESSION_CODE",
      });
    }

    // Charger les détails complets
    await session.reload({
      include: [
        {
          model: Quiz,
          as: "quiz",
          attributes: [
            "id",
            "title",
            "description",
            "category",
            "difficulty",
            "estimatedDuration",
          ],
        },
        {
          model: User,
          as: "host",
          attributes: ["id", "username", "firstName", "lastName"],
        },
      ],
    });

    // Vérifier si la session accepte de nouveaux participants
    if (session.status === "finished" || session.status === "cancelled") {
      return res.status(400).json({
        error: "Cette session est terminée",
        code: "SESSION_ENDED",
      });
    }

    if (session.status === "active" && !session.settings.allowLateJoin) {
      return res.status(400).json({
        error: "Cette session ne permet plus de nouveaux participants",
        code: "LATE_JOIN_DISABLED",
      });
    }

    const participantCount = session.participants?.length || 0;
    if (participantCount >= (session.settings.maxParticipants || 100)) {
      return res.status(400).json({
        error: "Nombre maximum de participants atteint",
        code: "MAX_PARTICIPANTS_REACHED",
      });
    }

    // Informations publiques de la session
    res.json({
      session: {
        id: session.id,
        code: session.code,
        title: session.title,
        status: session.status,
        currentQuestionIndex: session.currentQuestionIndex,
        participantCount,
        settings: {
          allowLateJoin: session.settings.allowLateJoin,
          maxParticipants: session.settings.maxParticipants,
          showLeaderboard: session.settings.showLeaderboard,
        },
        quiz: {
          id: session.quiz.id,
          title: session.quiz.title,
          description: session.quiz.description,
          category: session.quiz.category,
          difficulty: session.quiz.difficulty,
          estimatedDuration: session.quiz.estimatedDuration,
        },
        host: session.host,
        createdAt: session.createdAt,
      },
    });
  } catch (error) {
    console.error("Erreur lors de la recherche de session par code:", error);
    res.status(500).json({
      error: "Erreur lors de la recherche de session",
    });
  }
});

// POST /api/session - Créer une nouvelle session
router.post(
  "/",
  authenticateToken,
  requireRole("formateur", "admin"),
  async (req, res) => {
    try {
      const { quizId, title, settings = {} } = req.body;

      if (!quizId) {
        return res.status(400).json({
          error: "ID du quiz requis",
        });
      }

      // Vérifier que le quiz existe et que l'utilisateur peut l'utiliser
      const quiz = await Quiz.findByPk(quizId, {
        include: [
          {
            model: User,
            as: "creator",
            attributes: ["id", "username"],
          },
        ],
      });

      if (!quiz || !quiz.isActive) {
        return res.status(404).json({
          error: "Quiz non trouvé ou inactif",
        });
      }

      // Vérifier les permissions sur le quiz
      const canUseQuiz =
        quiz.creatorId === req.user.id ||
        quiz.settings.isPublic ||
        req.user.role === "admin";

      if (!canUseQuiz) {
        return res.status(403).json({
          error: "Permission insuffisante pour utiliser ce quiz",
        });
      }

      if (!quiz.questions || quiz.questions.length === 0) {
        return res.status(400).json({
          error: "Le quiz doit contenir au moins une question",
        });
      }

      // Générer un code unique
      const code = await Session.generateUniqueCode();

      // Créer la session
      const session = await Session.create({
        code,
        quizId: quiz.id,
        hostId: req.user.id,
        title: title || `Session - ${quiz.title}`,
        settings: {
          allowLateJoin: true,
          showLeaderboard: true,
          autoAdvance: false,
          questionTimeLimit: null,
          maxParticipants: 100,
          ...settings,
        },
      });

      // Recharger avec les relations
      await session.reload({
        include: [
          {
            model: Quiz,
            as: "quiz",
            attributes: ["id", "title", "category", "difficulty"],
          },
          {
            model: User,
            as: "host",
            attributes: ["id", "username", "firstName", "lastName"],
          },
        ],
      });

      res.status(201).json({
        message: "Session créée avec succès",
        session: {
          id: session.id,
          code: session.code,
          title: session.title,
          status: session.status,
          settings: session.settings,
          quiz: session.quiz,
          host: session.host,
          createdAt: session.createdAt,
        },
      });
    } catch (error) {
      console.error("Erreur lors de la création de la session:", error);
      res.status(500).json({
        error: "Erreur lors de la création de la session",
      });
    }
  }
);

// PUT /api/session/:id - Mettre à jour une session
router.put(
  "/:id",
  authenticateToken,
  loadSession,
  requireSessionOwnership,
  async (req, res) => {
    try {
      const session = req.session;
      const { title, settings } = req.body;

      // Ne peut modifier que certains champs selon le statut
      const updates = {};

      if (title !== undefined) {
        updates.title = title.trim();
      }

      if (settings !== undefined) {
        // Certains paramètres ne peuvent être modifiés que si la session n'a pas commencé
        const allowedSettings = { ...session.settings };

        if (session.status === "waiting") {
          // Tous les paramètres modifiables avant le début
          Object.assign(allowedSettings, settings);
        } else {
          // Paramètres modifiables pendant la session
          if (settings.allowLateJoin !== undefined) {
            allowedSettings.allowLateJoin = settings.allowLateJoin;
          }
          if (settings.showLeaderboard !== undefined) {
            allowedSettings.showLeaderboard = settings.showLeaderboard;
          }
        }

        updates.settings = allowedSettings;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          error: "Aucune mise à jour fournie",
        });
      }

      await session.update(updates);

      // Notifier via Socket.IO si disponible
      if (req.io) {
        req.io.to(`session_${session.id}`).emit("session_updated", {
          sessionId: session.id,
          updates: {
            title: session.title,
            settings: session.settings,
          },
        });
      }

      res.json({
        message: "Session mise à jour avec succès",
        session: {
          id: session.id,
          title: session.title,
          settings: session.settings,
          updatedAt: session.updatedAt,
        },
      });
    } catch (error) {
      console.error("Erreur lors de la mise à jour de la session:", error);
      res.status(500).json({
        error: "Erreur lors de la mise à jour de la session",
      });
    }
  }
);

// POST /api/session/:id/start - Démarrer une session
router.post(
  "/:id/start",
  authenticateToken,
  loadSession,
  requireSessionOwnership,
  async (req, res) => {
    try {
      const session = req.session;

      if (session.status !== "waiting") {
        return res.status(400).json({
          error:
            'La session ne peut être démarrée que depuis l\'état "en attente"',
          currentStatus: session.status,
        });
      }

      if (!session.participants || session.participants.length === 0) {
        return res.status(400).json({
          error: "Au moins un participant est requis pour démarrer la session",
        });
      }

      await session.startSession();

      // Notifier via Socket.IO
      if (req.io) {
        req.io.to(`session_${session.id}`).emit("session_started", {
          sessionId: session.id,
          currentQuestionIndex: session.currentQuestionIndex,
          startedAt: session.startedAt,
        });
      }

      res.json({
        message: "Session démarrée avec succès",
        session: {
          id: session.id,
          status: session.status,
          currentQuestionIndex: session.currentQuestionIndex,
          startedAt: session.startedAt,
        },
      });
    } catch (error) {
      console.error("Erreur lors du démarrage de la session:", error);
      res.status(500).json({
        error: "Erreur lors du démarrage de la session",
      });
    }
  }
);

// POST /api/session/:id/pause - Mettre en pause une session
router.post(
  "/:id/pause",
  authenticateToken,
  loadSession,
  requireSessionOwnership,
  async (req, res) => {
    try {
      const session = req.session;

      if (session.status !== "active") {
        return res.status(400).json({
          error: "Seules les sessions actives peuvent être mises en pause",
        });
      }

      await session.pauseSession();

      // Notifier via Socket.IO
      if (req.io) {
        req.io.to(`session_${session.id}`).emit("session_paused", {
          sessionId: session.id,
        });
      }

      res.json({
        message: "Session mise en pause",
        session: {
          id: session.id,
          status: session.status,
        },
      });
    } catch (error) {
      console.error("Erreur lors de la mise en pause:", error);
      res.status(500).json({
        error: "Erreur lors de la mise en pause de la session",
      });
    }
  }
);

// POST /api/session/:id/resume - Reprendre une session
router.post(
  "/:id/resume",
  authenticateToken,
  loadSession,
  requireSessionOwnership,
  async (req, res) => {
    try {
      const session = req.session;

      if (session.status !== "paused") {
        return res.status(400).json({
          error: "Seules les sessions en pause peuvent être reprises",
        });
      }

      await session.resumeSession();

      // Notifier via Socket.IO
      if (req.io) {
        req.io.to(`session_${session.id}`).emit("session_resumed", {
          sessionId: session.id,
          currentQuestionStartedAt: session.currentQuestionStartedAt,
        });
      }

      res.json({
        message: "Session reprise",
        session: {
          id: session.id,
          status: session.status,
          currentQuestionStartedAt: session.currentQuestionStartedAt,
        },
      });
    } catch (error) {
      console.error("Erreur lors de la reprise:", error);
      res.status(500).json({
        error: "Erreur lors de la reprise de la session",
      });
    }
  }
);

// POST /api/session/:id/end - Terminer une session
router.post(
  "/:id/end",
  authenticateToken,
  loadSession,
  requireSessionOwnership,
  async (req, res) => {
    try {
      const session = req.session;

      if (["finished", "cancelled"].includes(session.status)) {
        return res.status(400).json({
          error: "La session est déjà terminée",
        });
      }

      await session.endSession();

      // Mettre à jour les statistiques du quiz
      if (session.quiz) {
        const averageScore = session.stats?.averageScore || 0;
        const participantCount = session.participants?.length || 0;

        await session.quiz.incrementStats(participantCount, averageScore);
      }

      // Notifier via Socket.IO
      if (req.io) {
        req.io.to(`session_${session.id}`).emit("session_ended", {
          sessionId: session.id,
          endedAt: session.endedAt,
          finalStats: session.stats,
        });
      }

      res.json({
        message: "Session terminée avec succès",
        session: {
          id: session.id,
          status: session.status,
          endedAt: session.endedAt,
          stats: session.stats,
        },
      });
    } catch (error) {
      console.error("Erreur lors de la fin de session:", error);
      res.status(500).json({
        error: "Erreur lors de la fin de session",
      });
    }
  }
);

// GET /api/session/:id/leaderboard - Classement de la session
router.get("/:id/leaderboard", optionalAuth, loadSession, async (req, res) => {
  try {
    const session = req.session;

    // Vérifier si le leaderboard est visible
    if (!session.settings.showLeaderboard) {
      const isHost = req.user && req.user.id === session.hostId;
      const isQuizOwner = req.user && req.user.id === session.quiz?.creatorId;
      const isAdmin = req.user && req.user.role === "admin";

      if (!isHost && !isQuizOwner && !isAdmin) {
        return res.status(403).json({
          error: "Le classement n'est pas visible pour cette session",
        });
      }
    }

    const leaderboard = session.getLeaderboard();

    res.json({
      leaderboard,
      sessionId: session.id,
      participantCount: session.participants?.length || 0,
      updatedAt: new Date(),
    });
  } catch (error) {
    console.error("Erreur lors de la récupération du classement:", error);
    res.status(500).json({
      error: "Erreur lors de la récupération du classement",
    });
  }
});

// GET /api/session/:id/results - Résultats détaillés de la session
router.get(
  "/:id/results",
  authenticateToken,
  loadSession,
  requireSessionOwnership,
  async (req, res) => {
    try {
      const session = req.session;

      const results = {
        session: {
          id: session.id,
          code: session.code,
          title: session.title,
          status: session.status,
          stats: session.stats,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
        },
        quiz: {
          id: session.quiz.id,
          title: session.quiz.title,
          questions: session.quiz.questions,
        },
        participants: session.participants || [],
        responses: session.responses || {},
        leaderboard: session.getLeaderboard(),
        questionResults: {},
      };

      // Analyser les résultats par question
      if (session.quiz.questions) {
        session.quiz.questions.forEach((question) => {
          results.questionResults[question.id] = session.getQuestionResults(
            question.id
          );
        });
      }

      res.json(results);
    } catch (error) {
      console.error("Erreur lors de la récupération des résultats:", error);
      res.status(500).json({
        error: "Erreur lors de la récupération des résultats",
      });
    }
  }
);

// DELETE /api/session/:id - Supprimer une session
router.delete(
  "/:id",
  authenticateToken,
  loadSession,
  requireSessionOwnership,
  async (req, res) => {
    try {
      const session = req.session;

      if (session.status === "active") {
        return res.status(400).json({
          error:
            "Impossible de supprimer une session active. Terminez-la d'abord.",
        });
      }

      await session.destroy();

      res.json({
        message: "Session supprimée avec succès",
      });
    } catch (error) {
      console.error("Erreur lors de la suppression de la session:", error);
      res.status(500).json({
        error: "Erreur lors de la suppression de la session",
      });
    }
  }
);

module.exports = router;
