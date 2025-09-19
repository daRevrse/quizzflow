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
// const loadSession = async (req, res, next) => {
//   try {
//     const sessionId = req.params.id;

//     if (!sessionId) {
//       return res.status(400).json({
//         error: "ID de session requis",
//       });
//     }

//     const session = await Session.findByPk(sessionId, {
//       include: [
//         {
//           model: Quiz,
//           as: "quiz",
//           include: [
//             {
//               model: User,
//               as: "creator",
//               attributes: ["id", "username", "firstName", "lastName"],
//             },
//           ],
//         },
//         {
//           model: User,
//           as: "host",
//           attributes: ["id", "username", "firstName", "lastName"],
//         },
//       ],
//     });

//     if (!session) {
//       return res.status(404).json({
//         error: "Session non trouvée",
//         code: "SESSION_NOT_FOUND",
//       });
//     }

//     req.session = session;
//     next();
//   } catch (error) {
//     console.error("Erreur lors du chargement de la session:", error);
//     res.status(500).json({
//       error: "Erreur lors du chargement de la session",
//     });
//   }
// };
const loadSession = async (req, res, next) => {
  try {
    const sessionId = req.params.id;

    if (!sessionId) {
      return res.status(400).json({
        error: "ID de session requis",
        code: "MISSING_SESSION_ID",
      });
    }

    // Support UUID et entier
    let whereClause;
    if (sessionId.includes("-")) {
      whereClause = { id: sessionId };
    } else if (!isNaN(sessionId)) {
      whereClause = { id: parseInt(sessionId) };
    } else {
      return res.status(400).json({
        error: "Format d'ID de session invalide",
        code: "INVALID_SESSION_ID_FORMAT",
      });
    }

    const session = await Session.findOne({
      where: whereClause,
      include: [
        {
          model: Quiz,
          as: "quiz",
          required: false,
          attributes: [
            "id",
            "title",
            "category",
            "difficulty",
            "questions",
            "creatorId",
          ],
        },
        {
          model: User,
          as: "host",
          required: false,
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
    console.error("Erreur dans loadSession:", error.message);

    if (error.name === "SequelizeConnectionError") {
      return res.status(503).json({
        error: "Erreur de connexion à la base de données",
        code: "DATABASE_CONNECTION_ERROR",
      });
    }

    if (error.name === "SequelizeValidationError") {
      return res.status(400).json({
        error: "Erreur de validation des données",
        code: "VALIDATION_ERROR",
      });
    }

    res.status(500).json({
      error: "Erreur lors du chargement de la session",
      code: "SESSION_LOAD_ERROR",
    });
  }
};

// Middleware pour vérifier les permissions sur une session
// const requireSessionOwnership = (req, res, next) => {
//   if (!req.user) {
//     return res.status(401).json({
//       error: "Authentification requise",
//     });
//   }

//   const session = req.session;
//   const isHost = session.hostId === req.user.id;
//   const isQuizOwner = session.quiz?.creatorId === req.user.id;
//   const isAdmin = req.user.role === "admin";

//   if (!isHost && !isQuizOwner && !isAdmin) {
//     return res.status(403).json({
//       error:
//         "Permission insuffisante - Vous devez être l'hôte ou le créateur du quiz",
//     });
//   }

//   next();
// };
const requireSessionOwnership = (req, res, next) => {
  try {
    const session = req.session;
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        error: "Authentification requise",
        code: "AUTH_REQUIRED",
      });
    }

    const isOwner = session.hostId === user.id;
    const isQuizOwner = session.quiz && session.quiz.creatorId === user.id;
    const isAdmin = user.role === "admin";

    if (!isOwner && !isQuizOwner && !isAdmin) {
      return res.status(403).json({
        error: "Accès refusé - Vous n'êtes pas propriétaire de cette session",
        code: "ACCESS_DENIED",
      });
    }

    next();
  } catch (error) {
    console.error(
      "Erreur lors de la vérification de propriété:",
      error.message
    );
    res.status(500).json({
      error: "Erreur de vérification des permissions",
      code: "PERMISSION_CHECK_ERROR",
    });
  }
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
// router.get("/:id", optionalAuth, loadSession, async (req, res) => {
//   try {
//     const session = req.session;

//     // Permissions de lecture
//     const isHost = req.user && req.user.id === session.hostId;
//     const isQuizOwner = req.user && req.user.id === session.quiz?.creatorId;
//     const isAdmin = req.user && req.user.role === "admin";
//     const isParticipant =
//       req.user && session.participants?.some((p) => p.id === req.user.id);

//     // Les sessions fermées sont visibles par tous pour consultation
//     const canView =
//       isHost ||
//       isQuizOwner ||
//       isAdmin ||
//       isParticipant ||
//       ["finished", "cancelled"].includes(session.status);

//     if (!canView) {
//       return res.status(403).json({
//         error: "Accès refusé à cette session",
//       });
//     }

//     // Formater la réponse selon les permissions
//     const responseData = {
//       id: session.id,
//       code: session.code,
//       title: session.title,
//       status: session.status,
//       currentQuestionIndex: session.currentQuestionIndex,
//       settings: session.settings,
//       stats: session.stats,
//       quiz: {
//         id: session.quiz.id,
//         title: session.quiz.title,
//         category: session.quiz.category,
//         difficulty: session.quiz.difficulty,
//         creator: session.quiz.creator,
//       },
//       host: session.host,
//       startedAt: session.startedAt,
//       endedAt: session.endedAt,
//       currentQuestionStartedAt: session.currentQuestionStartedAt,
//       createdAt: session.createdAt,
//     };

//     // Informations détaillées pour l'hôte et le créateur
//     if (isHost || isQuizOwner || isAdmin) {
//       responseData.participants = session.participants;
//       responseData.responses = session.responses;
//       responseData.quiz.questions = session.quiz.questions;
//     } else {
//       // Participants voient seulement la liste des participants et leurs propres réponses
//       responseData.participants = session.participants?.map((p) => ({
//         id: p.id,
//         name: p.name,
//         avatar: p.avatar,
//         isConnected: p.isConnected,
//         score: p.score,
//       }));

//       if (req.user && isParticipant) {
//         const participant = session.participants.find(
//           (p) => p.id === req.user.id
//         );
//         responseData.myResponses = participant?.responses;
//         responseData.myScore = participant?.score;
//       }
//     }

//     res.json({ session: responseData });
//   } catch (error) {
//     console.error("Erreur lors de la récupération de la session:", error);
//     res.status(500).json({
//       error: "Erreur lors de la récupération de la session",
//     });
//   }
// });
router.get("/:id", optionalAuth, loadSession, async (req, res) => {
  try {
    const session = req.session;
    const user = req.user;

    // Vérifications de permissions
    const isHost = user && user.id === session.hostId;
    const isQuizOwner =
      user && session.quiz && user.id === session.quiz.creatorId;
    const isAdmin = user && user.role === "admin";

    const participants = Array.isArray(session.participants)
      ? session.participants
      : [];
    const isParticipant =
      user &&
      participants.some((p) => {
        return (
          p.id === user.id ||
          p.userId === user.id ||
          p.participantId === user.id
        );
      });

    // Logique d'accès
    const isPublicSession = session.settings?.isPublic !== false;
    const isFinishedSession = ["finished", "cancelled"].includes(
      session.status
    );

    const canView =
      isHost ||
      isQuizOwner ||
      isAdmin ||
      isParticipant ||
      (isPublicSession && isFinishedSession) ||
      session.status === "waiting";

    if (!canView) {
      return res.status(403).json({
        error: "Accès refusé à cette session",
        code: "SESSION_ACCESS_DENIED",
      });
    }

    // Construction des données de réponse
    const sessionData = {
      id: session.id,
      code: session.code || "N/A",
      title: session.title || "Session sans titre",
      status: session.status || "unknown",
      currentQuestionIndex: session.currentQuestionIndex || 0,
      settings: session.settings || {},
      participantCount: participants.length,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,

      quiz: session.quiz
        ? {
            id: session.quiz.id,
            title: session.quiz.title || "Quiz sans titre",
            category: session.quiz.category,
            difficulty: session.quiz.difficulty,
            questionCount: Array.isArray(session.quiz.questions)
              ? session.quiz.questions.length
              : 0,
          }
        : null,

      host: session.host
        ? {
            id: session.host.id,
            username: session.host.username,
            displayName:
              session.host.firstName && session.host.lastName
                ? `${session.host.firstName} ${session.host.lastName}`
                : session.host.username,
          }
        : null,
    };

    // Données étendues pour les propriétaires/admins
    const canViewDetails = isHost || isQuizOwner || isAdmin;
    if (canViewDetails) {
      sessionData.participants = participants.map((p) => ({
        id: p.id,
        name: p.name || "Participant",
        score: p.score || 0,
        isConnected: p.isConnected || false,
        joinedAt: p.joinedAt,
        lastSeen: p.lastSeen,
      }));

      sessionData.responses = session.responses || {};
      sessionData.stats = session.stats || {};

      if (session.quiz?.questions) {
        sessionData.quiz.questions = session.quiz.questions;
      }
    }

    res.json({
      session: sessionData,
      permissions: {
        canEdit: isHost || isQuizOwner || isAdmin,
        canViewDetails: canViewDetails,
        canParticipate:
          !isHost && ["waiting", "active"].includes(session.status),
        canStart: isHost && session.status === "waiting",
        canControl:
          isHost && ["waiting", "active", "paused"].includes(session.status),
      },
    });
  } catch (error) {
    console.error("Erreur dans GET session:", error.message);
    res.status(500).json({
      error: "Erreur lors de la récupération de la session",
      code: "GET_SESSION_ERROR",
    });
  }
});

// GET /api/session/code/:code - Rejoindre une session par code
// router.get("/code/:code", optionalAuth, async (req, res) => {
//   try {
//     const { code } = req.params;

//     const session = await Session.findByCode(code);

//     if (!session) {
//       return res.status(404).json({
//         error: "Session non trouvée avec ce code",
//         code: "INVALID_SESSION_CODE",
//       });
//     }

//     // Charger les détails complets
//     await session.reload({
//       include: [
//         {
//           model: Quiz,
//           as: "quiz",
//           attributes: [
//             "id",
//             "title",
//             "description",
//             "category",
//             "difficulty",
//             "estimatedDuration",
//           ],
//         },
//         {
//           model: User,
//           as: "host",
//           attributes: ["id", "username", "firstName", "lastName"],
//         },
//       ],
//     });

//     // Vérifier si la session accepte de nouveaux participants
//     if (session.status === "finished" || session.status === "cancelled") {
//       return res.status(400).json({
//         error: "Cette session est terminée",
//         code: "SESSION_ENDED",
//       });
//     }

//     if (session.status === "active" && !session.settings.allowLateJoin) {
//       return res.status(400).json({
//         error: "Cette session ne permet plus de nouveaux participants",
//         code: "LATE_JOIN_DISABLED",
//       });
//     }

//     const participantCount = session.participants?.length || 0;
//     if (participantCount >= (session.settings.maxParticipants || 100)) {
//       return res.status(400).json({
//         error: "Nombre maximum de participants atteint",
//         code: "MAX_PARTICIPANTS_REACHED",
//       });
//     }

//     // Informations publiques de la session
//     res.json({
//       session: {
//         id: session.id,
//         code: session.code,
//         title: session.title,
//         status: session.status,
//         currentQuestionIndex: session.currentQuestionIndex,
//         participantCount,
//         settings: {
//           allowLateJoin: session.settings.allowLateJoin,
//           maxParticipants: session.settings.maxParticipants,
//           showLeaderboard: session.settings.showLeaderboard,
//         },
//         quiz: {
//           id: session.quiz.id,
//           title: session.quiz.title,
//           description: session.quiz.description,
//           category: session.quiz.category,
//           difficulty: session.quiz.difficulty,
//           estimatedDuration: session.quiz.estimatedDuration,
//         },
//         host: session.host,
//         createdAt: session.createdAt,
//       },
//     });
//   } catch (error) {
//     console.error("Erreur lors de la recherche de session par code:", error);
//     res.status(500).json({
//       error: "Erreur lors de la recherche de session",
//     });
//   }
// });
router.get("/code/:code", optionalAuth, async (req, res) => {
  try {
    const { code } = req.params;

    if (!code || code.trim().length === 0) {
      return res.status(400).json({
        error: "Code de session requis",
        code: "MISSING_SESSION_CODE",
      });
    }

    const sessionCode = code.trim().toUpperCase();

    const session = await Session.findOne({
      where: {
        code: sessionCode,
        status: {
          [Op.in]: ["waiting", "active", "paused"],
        },
      },
      include: [
        {
          model: Quiz,
          as: "quiz",
          required: false,
          attributes: ["id", "title", "category", "difficulty"],
        },
        {
          model: User,
          as: "host",
          required: false,
          attributes: ["id", "username", "firstName", "lastName"],
        },
      ],
    });

    if (!session) {
      return res.status(404).json({
        error: "Aucune session active trouvée avec ce code",
        code: "SESSION_NOT_FOUND_BY_CODE",
      });
    }

    const sessionData = {
      id: session.id,
      code: session.code,
      title: session.title,
      status: session.status,
      settings: {
        allowAnonymous: session.settings?.allowAnonymous !== false,
        allowLateJoin: session.settings?.allowLateJoin !== false,
        requireName: session.settings?.requireName !== false,
      },
      quiz: session.quiz
        ? {
            id: session.quiz.id,
            title: session.quiz.title,
            category: session.quiz.category,
            difficulty: session.quiz.difficulty,
          }
        : null,
      host: session.host
        ? {
            username: session.host.username,
            displayName:
              session.host.firstName && session.host.lastName
                ? `${session.host.firstName} ${session.host.lastName}`
                : session.host.username,
          }
        : null,
      participantCount: Array.isArray(session.participants)
        ? session.participants.length
        : 0,
      canJoin:
        ["waiting", "active"].includes(session.status) &&
        (session.settings?.allowLateJoin !== false ||
          session.status === "waiting"),
    };

    res.json({
      session: sessionData,
      message: sessionData.canJoin
        ? "Session trouvée et accessible"
        : "Session trouvée mais non accessible",
    });
  } catch (error) {
    console.error("Erreur recherche par code:", error.message);
    res.status(500).json({
      error: "Erreur lors de la recherche de session",
      code: "SESSION_SEARCH_ERROR",
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
// router.post(
//   "/:id/start",
//   authenticateToken,
//   loadSession,
//   requireSessionOwnership,
//   async (req, res) => {
//     try {
//       const session = req.session;

//       if (session.status !== "waiting") {
//         return res.status(400).json({
//           error:
//             'La session ne peut être démarrée que depuis l\'état "en attente"',
//           currentStatus: session.status,
//         });
//       }

//       if (!session.participants || session.participants.length === 0) {
//         return res.status(400).json({
//           error: "Au moins un participant est requis pour démarrer la session",
//         });
//       }

//       await session.startSession();

//       // Notifier via Socket.IO
//       if (req.io) {
//         req.io.to(`session_${session.id}`).emit("session_started", {
//           sessionId: session.id,
//           currentQuestionIndex: session.currentQuestionIndex,
//           startedAt: session.startedAt,
//         });
//       }

//       res.json({
//         message: "Session démarrée avec succès",
//         session: {
//           id: session.id,
//           status: session.status,
//           currentQuestionIndex: session.currentQuestionIndex,
//           startedAt: session.startedAt,
//         },
//       });
//     } catch (error) {
//       console.error("Erreur lors du démarrage de la session:", error);
//       res.status(500).json({
//         error: "Erreur lors du démarrage de la session",
//       });
//     }
//   }
// );
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
            "La session ne peut être démarrée que depuis l'état 'en attente'",
          code: "INVALID_SESSION_STATUS",
          currentStatus: session.status,
        });
      }

      const participants = session.participants || [];
      if (participants.length === 0) {
        return res.status(400).json({
          error: "Au moins un participant est requis pour démarrer la session",
          code: "NO_PARTICIPANTS",
        });
      }

      if (
        !session.quiz ||
        !session.quiz.questions ||
        session.quiz.questions.length === 0
      ) {
        return res.status(400).json({
          error: "Le quiz doit contenir au moins une question",
          code: "NO_QUESTIONS",
        });
      }

      await session.startSession();
      await session.reload();

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
      console.error("Erreur lors du démarrage de la session:", error.message);

      if (error.message.includes("état 'waiting'")) {
        return res.status(400).json({
          error: error.message,
          code: "INVALID_SESSION_STATUS",
        });
      }

      res.status(500).json({
        error: "Erreur lors du démarrage de la session",
        code: "START_SESSION_ERROR",
      });
    }
  }
);

// POST /api/session/:id/pause - Mettre en pause une session
// router.post(
//   "/:id/pause",
//   authenticateToken,
//   loadSession,
//   requireSessionOwnership,
//   async (req, res) => {
//     try {
//       const session = req.session;

//       if (session.status !== "active") {
//         return res.status(400).json({
//           error: "Seules les sessions actives peuvent être mises en pause",
//         });
//       }

//       await session.pauseSession();

//       // Notifier via Socket.IO
//       if (req.io) {
//         req.io.to(`session_${session.id}`).emit("session_paused", {
//           sessionId: session.id,
//         });
//       }

//       res.json({
//         message: "Session mise en pause",
//         session: {
//           id: session.id,
//           status: session.status,
//         },
//       });
//     } catch (error) {
//       console.error("Erreur lors de la mise en pause:", error);
//       res.status(500).json({
//         error: "Erreur lors de la mise en pause de la session",
//       });
//     }
//   }
// );
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
          code: "INVALID_SESSION_STATUS",
          currentStatus: session.status,
        });
      }

      await session.pauseSession();
      await session.reload();

      if (req.io) {
        req.io.to(`session_${session.id}`).emit("session_paused", {
          sessionId: session.id,
          pausedAt: new Date(),
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
      console.error("Erreur lors de la mise en pause:", error.message);

      if (error.message.includes("sessions actives")) {
        return res.status(400).json({
          error: error.message,
          code: "INVALID_SESSION_STATUS",
        });
      }

      res.status(500).json({
        error: "Erreur lors de la mise en pause de la session",
        code: "PAUSE_SESSION_ERROR",
      });
    }
  }
);

// POST /api/session/:id/resume - Reprendre une session
// router.post(
//   "/:id/resume",
//   authenticateToken,
//   loadSession,
//   requireSessionOwnership,
//   async (req, res) => {
//     try {
//       const session = req.session;

//       if (session.status !== "paused") {
//         return res.status(400).json({
//           error: "Seules les sessions en pause peuvent être reprises",
//         });
//       }

//       await session.resumeSession();

//       // Notifier via Socket.IO
//       if (req.io) {
//         req.io.to(`session_${session.id}`).emit("session_resumed", {
//           sessionId: session.id,
//           currentQuestionStartedAt: session.currentQuestionStartedAt,
//         });
//       }

//       res.json({
//         message: "Session reprise",
//         session: {
//           id: session.id,
//           status: session.status,
//           currentQuestionStartedAt: session.currentQuestionStartedAt,
//         },
//       });
//     } catch (error) {
//       console.error("Erreur lors de la reprise:", error);
//       res.status(500).json({
//         error: "Erreur lors de la reprise de la session",
//       });
//     }
//   }
// );
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
          code: "INVALID_SESSION_STATUS",
          currentStatus: session.status,
        });
      }

      await session.resumeSession();
      await session.reload();

      if (req.io) {
        req.io.to(`session_${session.id}`).emit("session_resumed", {
          sessionId: session.id,
          resumedAt: new Date(),
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
      console.error("Erreur lors de la reprise:", error.message);

      if (error.message.includes("sessions en pause")) {
        return res.status(400).json({
          error: error.message,
          code: "INVALID_SESSION_STATUS",
        });
      }

      res.status(500).json({
        error: "Erreur lors de la reprise de la session",
        code: "RESUME_SESSION_ERROR",
      });
    }
  }
);

// POST /api/session/:id/end - Terminer une session
// router.post(
//   "/:id/end",
//   authenticateToken,
//   loadSession,
//   requireSessionOwnership,
//   async (req, res) => {
//     try {
//       const session = req.session;

//       if (["finished", "cancelled"].includes(session.status)) {
//         return res.status(400).json({
//           error: "La session est déjà terminée",
//         });
//       }

//       await session.endSession();

//       // Mettre à jour les statistiques du quiz
//       if (session.quiz) {
//         const averageScore = session.stats?.averageScore || 0;
//         const participantCount = session.participants?.length || 0;

//         await session.quiz.incrementStats(participantCount, averageScore);
//       }

//       // Notifier via Socket.IO
//       if (req.io) {
//         req.io.to(`session_${session.id}`).emit("session_ended", {
//           sessionId: session.id,
//           endedAt: session.endedAt,
//           finalStats: session.stats,
//         });
//       }

//       res.json({
//         message: "Session terminée avec succès",
//         session: {
//           id: session.id,
//           status: session.status,
//           endedAt: session.endedAt,
//           stats: session.stats,
//         },
//       });
//     } catch (error) {
//       console.error("Erreur lors de la fin de session:", error);
//       res.status(500).json({
//         error: "Erreur lors de la fin de session",
//       });
//     }
//   }
// );
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
          code: "SESSION_ALREADY_ENDED",
          currentStatus: session.status,
        });
      }

      await session.endSession();
      await session.reload();

      try {
        if (session.quiz && session.quiz.incrementStats) {
          const stats = session.stats || {};
          await session.quiz.incrementStats(
            stats.totalParticipants || 0,
            stats.averageScore || 0
          );
        }
      } catch (statsError) {
        console.warn(
          "Erreur lors de la mise à jour des stats du quiz:",
          statsError.message
        );
      }

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
      console.error("Erreur lors de la fin de session:", error.message);

      res.status(500).json({
        error: "Erreur lors de la fin de session",
        code: "END_SESSION_ERROR",
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
// router.get(
//   "/:id/results",
//   authenticateToken,
//   loadSession,
//   requireSessionOwnership,
//   async (req, res) => {
//     try {
//       const session = req.session;

//       const results = {
//         session: {
//           id: session.id,
//           code: session.code,
//           title: session.title,
//           status: session.status,
//           stats: session.stats,
//           startedAt: session.startedAt,
//           endedAt: session.endedAt,
//         },
//         quiz: {
//           id: session.quiz.id,
//           title: session.quiz.title,
//           questions: session.quiz.questions,
//         },
//         participants: session.participants || [],
//         responses: session.responses || {},
//         leaderboard: session.getLeaderboard(),
//         questionResults: {},
//       };

//       // Analyser les résultats par question
//       if (session.quiz.questions) {
//         session.quiz.questions.forEach((question) => {
//           results.questionResults[question.id] = session.getQuestionResults(
//             question.id
//           );
//         });
//       }

//       res.json(results);
//     } catch (error) {
//       console.error("Erreur lors de la récupération des résultats:", error);
//       res.status(500).json({
//         error: "Erreur lors de la récupération des résultats",
//       });
//     }
//   }
// );
// GET /api/session/:id/results - Résultats détaillés de la session
router.get(
  "/:id/results",
  authenticateToken,
  loadSession,
  requireSessionOwnership,
  async (req, res) => {
    try {
      const session = req.session;

      // Construire les résultats détaillés
      const results = {
        session: {
          id: session.id,
          code: session.code,
          title: session.title,
          status: session.status,
          stats: session.stats || {},
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          createdAt: session.createdAt,
          currentQuestionIndex: session.currentQuestionIndex || 0,
        },
        quiz: session.quiz
          ? {
              id: session.quiz.id,
              title: session.quiz.title,
              category: session.quiz.category,
              difficulty: session.quiz.difficulty,
              questions: session.quiz.questions || [],
            }
          : null,
        participants: session.participants || [],
        responses: session.responses || {},
        leaderboard: [],
        questionResults: {},
      };

      // Générer le classement
      if (session.participants && session.participants.length > 0) {
        results.leaderboard = session.participants
          .filter((p) => p.score !== undefined && p.score !== null)
          .sort((a, b) => (b.score || 0) - (a.score || 0))
          .map((participant, index) => ({
            rank: index + 1,
            id: participant.id,
            name: participant.name || "Participant",
            score: participant.score || 0,
            isConnected: participant.isConnected || false,
            lastSeen: participant.lastSeen || null,
          }));
      }

      // Analyser les résultats par question
      if (session.quiz && session.quiz.questions) {
        session.quiz.questions.forEach((question) => {
          const questionResponses = session.responses?.[question.id] || {};
          const responseArray = [];

          Object.entries(questionResponses).forEach(
            ([participantId, response]) => {
              const participant = session.participants?.find(
                (p) => p.id === participantId
              );
              responseArray.push({
                participantId,
                participantName: participant?.name || "Participant",
                answer: response.answer,
                points: response.points || 0,
                isCorrect: response.isCorrect || false,
                timeSpent: response.timeSpent || 0,
                submittedAt: response.submittedAt,
              });
            }
          );

          // Calculer les statistiques de la question
          const totalResponses = responseArray.length;
          const correctAnswers = responseArray.filter(
            (r) => r.isCorrect
          ).length;
          const averageTimeSpent =
            totalResponses > 0
              ? Math.round(
                  responseArray.reduce(
                    (sum, r) => sum + (r.timeSpent || 0),
                    0
                  ) / totalResponses
                )
              : 0;

          results.questionResults[question.id] = {
            questionId: question.id,
            totalResponses,
            totalParticipants: session.participants?.length || 0,
            responses: responseArray.sort(
              (a, b) => (b.points || 0) - (a.points || 0)
            ),
            stats: {
              correctAnswers,
              correctPercentage:
                totalResponses > 0
                  ? Math.round((correctAnswers / totalResponses) * 100)
                  : 0,
              averageTimeSpent,
              responseRate:
                session.participants?.length > 0
                  ? Math.round(
                      (totalResponses / session.participants.length) * 100
                    )
                  : 0,
            },
          };
        });
      }

      res.json(results);
    } catch (error) {
      console.error("Erreur lors de la récupération des résultats:", error);
      res.status(500).json({
        error: "Erreur lors de la récupération des résultats",
        code: "GET_RESULTS_ERROR",
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
