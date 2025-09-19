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

// Fonction utilitaire pour calculer le nombre de participants de façon sécurisée
const getParticipantCount = (participants) => {
  if (!participants) {
    console.log("⚠️  getParticipantCount: participants est null/undefined");
    return 0;
  }

  if (Array.isArray(participants)) {
    // Filtrer les participants valides (objets avec un id)
    const validParticipants = participants.filter(
      (p) => p && typeof p === "object" && p.id
    );
    console.log(
      `✅ getParticipantCount: ${validParticipants.length} participants valides sur ${participants.length} entrées`
    );
    return validParticipants.length;
  }

  if (typeof participants === "string") {
    try {
      const parsed = JSON.parse(participants);
      if (Array.isArray(parsed)) {
        const validParticipants = parsed.filter(
          (p) => p && typeof p === "object" && p.id
        );
        console.log(
          `✅ getParticipantCount: ${validParticipants.length} participants valides (parsé depuis string)`
        );
        return validParticipants.length;
      }
    } catch (error) {
      console.error(
        "❌ getParticipantCount: Erreur parsing JSON:",
        error.message
      );
    }
  }

  console.log(
    `⚠️  getParticipantCount: Format non reconnu:`,
    typeof participants
  );
  return 0;
};

// GET /api/session - Lister les sessions
// router.get("/", authenticateToken, async (req, res) => {
//   try {
//     const {
//       page = 1,
//       limit = 20,
//       status,
//       quizId,
//       hostId,
//       my = false,
//     } = req.query;

//     const pageNum = parseInt(page);
//     const limitNum = parseInt(limit);
//     const offset = (pageNum - 1) * limitNum;

//     const whereConditions = {};

//     // Filtrer par statut
//     if (status) {
//       whereConditions.status = status;
//     }

//     // Filtrer par quiz
//     if (quizId) {
//       whereConditions.quizId = quizId;
//     }

//     // Filtrer par hôte
//     if (hostId) {
//       whereConditions.hostId = hostId;
//     }

//     // Mes sessions seulement
//     if (my === "true") {
//       whereConditions.hostId = req.user.id;
//     }

//     const { count, rows: sessions } = await Session.findAndCountAll({
//       where: whereConditions,
//       include: [
//         {
//           model: Quiz,
//           as: "quiz",
//           attributes: ["id", "title", "category", "difficulty"],
//         },
//         {
//           model: User,
//           as: "host",
//           attributes: ["id", "username", "firstName", "lastName"],
//         },
//       ],
//       order: [["createdAt", "DESC"]],
//       limit: limitNum,
//       offset,
//     });

//     const formattedSessions = sessions.map((session) => ({
//       id: session.id,
//       code: session.code,
//       title: session.title,
//       status: session.status,
//       currentQuestionIndex: session.currentQuestionIndex,
//       participantCount: session.participants?.length || 0,
//       settings: session.settings,
//       stats: session.stats,
//       quiz: session.quiz,
//       host: session.host,
//       startedAt: session.startedAt,
//       endedAt: session.endedAt,
//       createdAt: session.createdAt,
//     }));

//     res.json({
//       sessions: formattedSessions,
//       pagination: {
//         current: pageNum,
//         pages: Math.ceil(count / limitNum),
//         total: count,
//         limit: limitNum,
//       },
//     });
//   } catch (error) {
//     console.error("Erreur lors de la récupération des sessions:", error);
//     res.status(500).json({
//       error: "Erreur lors de la récupération des sessions",
//     });
//   }
// });
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

    console.log(`🔍 Recherche sessions avec conditions:`, whereConditions);

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

    console.log(`📊 Sessions trouvées: ${sessions.length}`);

    // 🔧 CORRECTION : Calcul sécurisé du participantCount
    const formattedSessions = sessions.map((session, index) => {
      const participantCount = getParticipantCount(session.participants);

      console.log(`📋 Session ${index + 1}/${sessions.length}:`, {
        id: session.id,
        code: session.code,
        title: session.title,
        rawParticipants: session.participants,
        calculatedCount: participantCount,
      });

      return {
        id: session.id,
        code: session.code,
        title: session.title,
        status: session.status,
        currentQuestionIndex: session.currentQuestionIndex,
        participantCount: participantCount, // 🔧 Utilisation de la fonction sécurisée
        settings: session.settings,
        stats: session.stats,
        quiz: session.quiz,
        host: session.host,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        createdAt: session.createdAt,
      };
    });

    console.log(`✅ Sessions formatées avec succès`);

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
    console.error("❌ Erreur lors de la récupération des sessions:", error);
    res.status(500).json({
      error: "Erreur lors de la récupération des sessions",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// GET /api/session/:id - Récupérer une session spécifique
// router.get("/:id", optionalAuth, loadSession, async (req, res) => {
//   try {
//     const session = req.session;
//     const user = req.user;

//     // Vérifications de permissions
//     const isHost = user && user.id === session.hostId;
//     const isQuizOwner =
//       user && session.quiz && user.id === session.quiz.creatorId;
//     const isAdmin = user && user.role === "admin";

//     const participants = Array.isArray(session.participants)
//       ? session.participants
//       : [];
//     const isParticipant =
//       user &&
//       participants.some((p) => {
//         return (
//           p.id === user.id ||
//           p.userId === user.id ||
//           p.participantId === user.id
//         );
//       });

//     // Logique d'accès
//     const isPublicSession = session.settings?.isPublic !== false;
//     const isFinishedSession = ["finished", "cancelled"].includes(
//       session.status
//     );

//     const canView =
//       isHost ||
//       isQuizOwner ||
//       isAdmin ||
//       isParticipant ||
//       (isPublicSession && isFinishedSession) ||
//       session.status === "waiting";

//     if (!canView) {
//       return res.status(403).json({
//         error: "Accès refusé à cette session",
//         code: "SESSION_ACCESS_DENIED",
//       });
//     }

//     // Construction des données de réponse
//     const sessionData = {
//       id: session.id,
//       code: session.code || "N/A",
//       title: session.title || "Session sans titre",
//       status: session.status || "unknown",
//       currentQuestionIndex: session.currentQuestionIndex || 0,
//       settings: session.settings || {},
//       participantCount: participants.length,
//       startedAt: session.startedAt,
//       endedAt: session.endedAt,
//       createdAt: session.createdAt,
//       updatedAt: session.updatedAt,

//       quiz: session.quiz
//         ? {
//             id: session.quiz.id,
//             title: session.quiz.title || "Quiz sans titre",
//             category: session.quiz.category,
//             difficulty: session.quiz.difficulty,
//             questionCount: Array.isArray(session.quiz.questions)
//               ? session.quiz.questions.length
//               : 0,
//           }
//         : null,

//       host: session.host
//         ? {
//             id: session.host.id,
//             username: session.host.username,
//             displayName:
//               session.host.firstName && session.host.lastName
//                 ? `${session.host.firstName} ${session.host.lastName}`
//                 : session.host.username,
//           }
//         : null,
//     };

//     // Données étendues pour les propriétaires/admins
//     const canViewDetails = isHost || isQuizOwner || isAdmin;
//     if (canViewDetails) {
//       sessionData.participants = participants.map((p) => ({
//         id: p.id,
//         name: p.name || "Participant",
//         score: p.score || 0,
//         isConnected: p.isConnected || false,
//         joinedAt: p.joinedAt,
//         lastSeen: p.lastSeen,
//       }));

//       sessionData.responses = session.responses || {};
//       sessionData.stats = session.stats || {};

//       if (session.quiz?.questions) {
//         sessionData.quiz.questions = session.quiz.questions;
//       }
//     }

//     res.json({
//       session: sessionData,
//       permissions: {
//         canEdit: isHost || isQuizOwner || isAdmin,
//         canViewDetails: canViewDetails,
//         canParticipate:
//           !isHost && ["waiting", "active"].includes(session.status),
//         canStart: isHost && session.status === "waiting",
//         canControl:
//           isHost && ["waiting", "active", "paused"].includes(session.status),
//       },
//     });
//   } catch (error) {
//     console.error("Erreur dans GET session:", error.message);
//     res.status(500).json({
//       error: "Erreur lors de la récupération de la session",
//       code: "GET_SESSION_ERROR",
//     });
//   }
// });
router.get("/:id", optionalAuth, loadSession, async (req, res) => {
  try {
    const session = req.session;

    console.log(`🔍 Récupération session détails:`, {
      id: session.id,
      code: session.code,
      rawParticipants: session.participants,
      participantsType: typeof session.participants,
    });

    // Permissions de lecture
    const isHost = req.user && req.user.id === session.hostId;
    const isQuizOwner = req.user && req.user.id === session.quiz?.creatorId;
    const isAdmin = req.user && req.user.role === "admin";
    const isParticipant =
      req.user && Array.isArray(session.participants)
        ? session.participants.some((p) => p && p.userId === req.user.id)
        : false;

    console.log(
      "isHost",
      isHost,
      "isQuizOwner",
      isQuizOwner,
      "isAdmin",
      isAdmin,
      "isParticipant",
      isParticipant
    );

    // const canView =
    //   // Tout le monde peut voir les sessions terminées
    //   ["finished", "cancelled"].includes(session.status) ||
    //   // Ou si l'utilisateur a un rôle
    //   isHost ||
    //   isQuizOwner ||
    //   isAdmin ||
    //   isParticipant ||
    //   // Ou si la session est ouverte et permet les anonymes
    //   (["waiting", "active", "paused"].includes(session.status) &&
    //     session.settings?.allowAnonymous);

    // if (!canView) {
    //   return res.status(403).json({
    //     error: "Accès refusé à cette session",
    //     code: "ACCESS_DENIED",
    //     suggestion: "Rejoignez la session avec le code d'accès",
    //   });
    // }

    // 🔧 CORRECTION : Calcul sécurisé du participantCount

    const canView =
      // Hôte, propriétaire du quiz, admin
      isHost ||
      isQuizOwner ||
      isAdmin ||
      // Participant existant
      isParticipant ||
      // Sessions publiques terminées
      ["finished", "cancelled"].includes(session.status) ||
      // Sessions en attente qui permettent les anonymes
      (session.status === "waiting" &&
        session.settings?.allowAnonymous !== false);

    const participantCount = getParticipantCount(session.participants);
    console.log(`📊 Participant count calculé: ${participantCount}`);

    // Formater la réponse selon les permissions
    const responseData = {
      session: {
        id: session.id,
        code: session.code,
        title: session.title,
        status: session.status,
        currentQuestionIndex: session.currentQuestionIndex,
        participantCount: participantCount, // 🔧 Utilisation de la fonction sécurisée
        settings: session.settings,
        stats: session.stats,
        quiz: session.quiz,
        host: session.host,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
      permissions: {
        canView: canView,
        canControl: isHost || isQuizOwner || isAdmin,
        canParticipate: ["waiting", "active"].includes(session.status),
        isHost: isHost,
        isParticipant: isParticipant,
      },
    };

    // Ajouter les détails pour les hôtes
    if (isHost || isQuizOwner || isAdmin) {
      // Nettoyer les participants pour l'affichage
      let cleanParticipants = [];
      if (Array.isArray(session.participants)) {
        cleanParticipants = session.participants.filter(
          (p) => p && typeof p === "object" && p.id
        );
      }

      responseData.session.participants = cleanParticipants;
      responseData.session.responses = session.responses || {};
      responseData.session.detailedStats = session.stats || {};
    }

    console.log(
      `✅ Session détails envoyés avec participantCount: ${participantCount}`
    );

    res.json(responseData);
  } catch (error) {
    console.error("❌ Erreur lors de la récupération de la session:", error);
    res.status(500).json({
      error: "Erreur lors de la récupération de la session",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Correction route POST /:id/join - backend/routes/session.js

router.post("/:id/join", optionalAuth, loadSession, async (req, res) => {
  try {
    const session = req.session;
    const { participantName, isAnonymous = false } = req.body;

    console.log("🔄 Join session appelé:", {
      sessionId: session.id,
      participantName,
      isAnonymous,
      userId: req.user?.id,
    });

    // 🔧 VALIDATION : Vérifier le statut de la session
    if (!["waiting", "active"].includes(session.status)) {
      console.log(`❌ Statut session invalide: ${session.status}`);
      return res.status(400).json({
        error: "Cette session n'accepte pas de nouveaux participants",
        code: "SESSION_NOT_JOINABLE",
        currentStatus: session.status,
      });
    }

    // 🔧 VALIDATION : Late join
    if (session.status === "active" && !session.settings?.allowLateJoin) {
      console.log("❌ Late join désactivé");
      return res.status(400).json({
        error: "Rejoindre en cours de session n'est pas autorisé",
        code: "LATE_JOIN_DISABLED",
      });
    }

    // 🔧 VALIDATION : Données requises
    if (
      !participantName ||
      typeof participantName !== "string" ||
      participantName.trim().length < 2
    ) {
      console.log("❌ Nom participant invalide:", participantName);
      return res.status(400).json({
        error: "Nom de participant requis (minimum 2 caractères)",
        code: "INVALID_PARTICIPANT_NAME",
      });
    }

    const cleanParticipantName = participantName.trim();

    // 🔧 VALIDATION : Nom unique
    const currentParticipants = Array.isArray(session.participants)
      ? session.participants
      : [];
    const existingParticipant = currentParticipants.find(
      (p) =>
        p &&
        p.name &&
        p.name.toLowerCase() === cleanParticipantName.toLowerCase()
    );

    if (existingParticipant) {
      console.log("❌ Nom déjà pris:", cleanParticipantName);
      return res.status(409).json({
        error: "Ce nom est déjà pris dans cette session",
        code: "NAME_ALREADY_TAKEN",
        suggestion: `${cleanParticipantName}_${Date.now()
          .toString()
          .slice(-3)}`,
      });
    }

    // 🔧 VALIDATION : Capacité maximale
    const maxParticipants = session.settings?.maxParticipants || 100;
    if (currentParticipants.length >= maxParticipants) {
      console.log(
        `❌ Session pleine: ${currentParticipants.length}/${maxParticipants}`
      );
      return res.status(400).json({
        error: "Nombre maximum de participants atteint",
        code: "SESSION_FULL",
        current: currentParticipants.length,
        max: maxParticipants,
      });
    }

    // 🔧 CRÉATION : Générer un ID unique pour le participant
    const participantId = `participant_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 8)}`;

    // 🔧 STRUCTURE : Données complètes du participant
    const participantData = {
      id: participantId,
      name: cleanParticipantName,
      userId: req.user?.id || null,
      socketId: null, // Sera mis à jour par Socket.IO
      isAnonymous: Boolean(isAnonymous),
      joinedAt: new Date().toISOString(),
      score: 0,
      responses: {},
      isConnected: false, // Sera mis à jour par Socket.IO
      stats: {
        correctAnswers: 0,
        totalAnswers: 0,
        averageTime: 0,
      },
    };

    console.log("📝 Participant à ajouter:", participantData);

    // 🔧 UTILISATION MÉTHODE SÉCURISÉE : Utiliser addParticipant du modèle
    try {
      await session.addParticipant(participantData);
      console.log("✅ Participant ajouté via addParticipant()");
    } catch (addError) {
      console.error("❌ Erreur addParticipant:", addError.message);

      if (addError.message.includes("maximum")) {
        return res.status(400).json({
          error: addError.message,
          code: "MAX_PARTICIPANTS_REACHED",
        });
      }

      throw addError;
    }

    // 🔧 RECHARGER : Récupérer la session mise à jour
    // await session.reload();

    const updatedSession = await session.addParticipant(participantData);

    console.log("📊 Session après ajout:", {
      participantCount: updatedSession.participants?.length,
      participants: updatedSession.participants?.map((p) => ({
        id: p.id,
        name: p.name,
      })),
    });

    // 🔧 NOTIFICATION : Préparer les données pour Socket.IO
    const notificationData = {
      sessionId: updatedSession.id,
      participant: participantData,
      totalParticipants: updatedSession.participants?.length || 0,
    };

    // Notifier via Socket.IO si disponible
    if (req.io) {
      console.log("📢 Notification Socket.IO");
      req.io
        .to(`session_${updatedSession.id}`)
        .emit("participant_joined", notificationData);
      req.io
        .to(`host_${updatedSession.id}`)
        .emit("participant_joined", notificationData);
    }

    // 🔧 RÉPONSE : Données complètes pour le client
    const responseData = {
      success: true,
      message: "Participant ajouté avec succès",
      sessionId: updatedSession.id,
      participantId: participantId,
      participant: {
        id: participantId,
        name: cleanParticipantName,
        isAnonymous: Boolean(isAnonymous),
        joinedAt: participantData.joinedAt,
      },
      // session: {
      //   // id: session.id,
      //   // code: session.code,
      //   // title: session.title,
      //   // status: session.status,
      //   ...session,
      //   participantCount: session.participants?.length || 0,
      //   currentQuestionIndex: session.currentQuestionIndex || -1,
      // },
      session: updatedSession,
    };

    console.log("✅ Join session réussi:", {
      participantId,
      participantName: cleanParticipantName,
      sessionId: updatedSession.id,
      totalParticipants: updatedSession.participants?.length,
    });

    res.status(200).json(responseData);
  } catch (error) {
    console.error("❌ Erreur lors de l'ajout du participant:", error);

    // Gestion d'erreurs spécifiques
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        error: "Conflit lors de l'ajout du participant",
        code: "PARTICIPANT_CONFLICT",
      });
    }

    if (error.name === "SequelizeValidationError") {
      return res.status(400).json({
        error: "Données participant invalides",
        code: "VALIDATION_ERROR",
        details: error.errors?.map((e) => e.message),
      });
    }

    res.status(500).json({
      error: "Erreur lors de l'ajout du participant",
      code: "JOIN_SESSION_ERROR",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// GET /api/session/code/:code - Rejoindre une session par code
// router.get("/code/:code", optionalAuth, async (req, res) => {
//   try {
//     const { code } = req.params;

//     if (!code || code.trim().length === 0) {
//       return res.status(400).json({
//         error: "Code de session requis",
//         code: "MISSING_SESSION_CODE",
//       });
//     }

//     const sessionCode = code.trim().toUpperCase();

//     const session = await Session.findOne({
//       where: {
//         code: sessionCode,
//         status: {
//           [Op.in]: ["waiting", "active", "paused"],
//         },
//       },
//       include: [
//         {
//           model: Quiz,
//           as: "quiz",
//           required: false,
//           attributes: ["id", "title", "category", "difficulty"],
//         },
//         {
//           model: User,
//           as: "host",
//           required: false,
//           attributes: ["id", "username", "firstName", "lastName"],
//         },
//       ],
//     });

//     if (!session) {
//       return res.status(404).json({
//         error: "Aucune session active trouvée avec ce code",
//         code: "SESSION_NOT_FOUND_BY_CODE",
//       });
//     }

//     const sessionData = {
//       id: session.id,
//       code: session.code,
//       title: session.title,
//       status: session.status,
//       settings: {
//         allowAnonymous: session.settings?.allowAnonymous !== false,
//         allowLateJoin: session.settings?.allowLateJoin !== false,
//         requireName: session.settings?.requireName !== false,
//       },
//       quiz: session.quiz
//         ? {
//             id: session.quiz.id,
//             title: session.quiz.title,
//             category: session.quiz.category,
//             difficulty: session.quiz.difficulty,
//           }
//         : null,
//       host: session.host
//         ? {
//             username: session.host.username,
//             displayName:
//               session.host.firstName && session.host.lastName
//                 ? `${session.host.firstName} ${session.host.lastName}`
//                 : session.host.username,
//           }
//         : null,
//       participantCount: Array.isArray(session.participants)
//         ? session.participants.length
//         : 0,
//       canJoin:
//         ["waiting", "active"].includes(session.status) &&
//         (session.settings?.allowLateJoin !== false ||
//           session.status === "waiting"),
//     };

//     res.json({
//       session: sessionData,
//       message: sessionData.canJoin
//         ? "Session trouvée et accessible"
//         : "Session trouvée mais non accessible",
//     });
//   } catch (error) {
//     console.error("Erreur recherche par code:", error.message);
//     res.status(500).json({
//       error: "Erreur lors de la recherche de session",
//       code: "SESSION_SEARCH_ERROR",
//     });
//   }
// });

// router.get("/code/:code", optionalAuth, async (req, res) => {
//   try {
//     const { code } = req.params;
//     const cleanCode = code.trim().toUpperCase();

//     console.log(`🔍 Recherche session par code: "${cleanCode}"`);

//     const session = await Session.findOne({
//       where: {
//         code: cleanCode,
//         status: ["waiting", "active"], // Seules les sessions actives
//       },
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

//     if (!session) {
//       console.log(`❌ Session non trouvée pour le code: "${cleanCode}"`);
//       return res.status(404).json({
//         error: "Session non trouvée",
//         code: "SESSION_NOT_FOUND",
//       });
//     }

//     console.log(`✅ Session trouvée:`, {
//       id: session.id,
//       code: session.code,
//       status: session.status,
//       rawParticipants: session.participants,
//     });

//     // Vérifier si la session accepte de nouveaux participants
//     if (session.status === "finished" || session.status === "cancelled") {
//       return res.status(400).json({
//         error: "Cette session est terminée",
//         code: "SESSION_ENDED",
//       });
//     }

//     if (session.status === "active" && !session.settings?.allowLateJoin) {
//       return res.status(400).json({
//         error: "Cette session ne permet plus de nouveaux participants",
//         code: "LATE_JOIN_DISABLED",
//       });
//     }

//     // 🔧 CORRECTION : Calcul sécurisé du participantCount
//     const participantCount = getParticipantCount(session.participants);
//     const maxParticipants = session.settings?.maxParticipants || 100;

//     console.log(
//       `📊 Vérification capacité: ${participantCount}/${maxParticipants}`
//     );

//     if (participantCount >= maxParticipants) {
//       return res.status(400).json({
//         error: "Nombre maximum de participants atteint",
//         code: "MAX_PARTICIPANTS_REACHED",
//       });
//     }

//     // Informations publiques de la session
//     const responseData = {
//       session: {
//         id: session.id,
//         code: session.code,
//         title: session.title,
//         status: session.status,
//         currentQuestionIndex: session.currentQuestionIndex,
//         participantCount: participantCount, // 🔧 Utilisation de la fonction sécurisée
//         canJoin: true,
//         settings: {
//           allowLateJoin: session.settings?.allowLateJoin,
//           maxParticipants: maxParticipants,
//           showLeaderboard: session.settings?.showLeaderboard,
//         },
//         quiz: {
//           id: session.quiz.id,
//           title: session.quiz.title,
//           description: session.quiz.description,
//           category: session.quiz.category,
//           difficulty: session.quiz.difficulty,
//           estimatedDuration: session.quiz.estimatedDuration,
//         },
//         host: {
//           name: session.host.firstName || session.host.username,
//           username: session.host.username,
//         },
//       },
//     };

//     console.log(
//       `✅ Données session envoyées avec participantCount: ${participantCount}`
//     );

//     res.json(responseData);
//   } catch (error) {
//     console.error("❌ Erreur lors de la récupération par code:", error);
//     res.status(500).json({
//       error: "Erreur lors de la récupération de la session",
//       details:
//         process.env.NODE_ENV === "development" ? error.message : undefined,
//     });
//   }
// });

router.get("/code/:code", optionalAuth, async (req, res) => {
  try {
    const { code } = req.params;
    const cleanCode = code.trim().toUpperCase();

    console.log(`🔍 Recherche session par code: "${cleanCode}"`);

    const session = await Session.findOne({
      where: {
        code: cleanCode,
        status: ["waiting", "active"], // Seules les sessions actives
      },
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

    if (!session) {
      console.log(`❌ Session non trouvée pour le code: "${cleanCode}"`);
      return res.status(404).json({
        error: "Session non trouvée ou terminée",
        code: "SESSION_NOT_FOUND",
      });
    }

    console.log(`✅ Session trouvée:`, {
      id: session.id,
      code: session.code,
      status: session.status,
      rawParticipants: session.participants,
    });

    // Vérifier si la session accepte de nouveaux participants
    if (session.status === "finished" || session.status === "cancelled") {
      return res.status(400).json({
        error: "Cette session est terminée",
        code: "SESSION_ENDED",
      });
    }

    if (session.status === "active" && !session.settings?.allowLateJoin) {
      return res.status(400).json({
        error: "Cette session ne permet plus de nouveaux participants",
        code: "LATE_JOIN_DISABLED",
      });
    }

    // 🔧 CORRECTION : Calcul sécurisé du participantCount
    const participantCount = getParticipantCount(session.participants);
    const maxParticipants = session.settings?.maxParticipants || 100;

    console.log(
      `📊 Vérification capacité: ${participantCount}/${maxParticipants}`
    );

    if (participantCount >= maxParticipants) {
      return res.status(400).json({
        error: "Nombre maximum de participants atteint",
        code: "MAX_PARTICIPANTS_REACHED",
      });
    }

    // Informations publiques de la session
    const responseData = {
      session: {
        id: session.id,
        code: session.code,
        title: session.title,
        status: session.status,
        currentQuestionIndex: session.currentQuestionIndex,
        participantCount: participantCount, // 🔧 Utilisation de la fonction sécurisée
        canJoin: true,
        settings: {
          allowLateJoin: session.settings?.allowLateJoin,
          allowAnonymous: session.settings?.allowAnonymous !== false,
          maxParticipants: maxParticipants,
          showLeaderboard: session.settings?.showLeaderboard,
        },
        quiz: {
          id: session.quiz.id,
          title: session.quiz.title,
          description: session.quiz.description,
          category: session.quiz.category,
          difficulty: session.quiz.difficulty,
          estimatedDuration: session.quiz.estimatedDuration,
        },
        host: {
          name: session.host.firstName || session.host.username,
          username: session.host.username,
        },
      },
    };

    console.log(
      `✅ Données session envoyées avec participantCount: ${participantCount}`
    );

    res.json(responseData);
  } catch (error) {
    console.error("❌ Erreur lors de la récupération par code:", error);
    res.status(500).json({
      error: "Erreur lors de la récupération de la session",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
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

router.get("/:id/stats", optionalAuth, loadSession, async (req, res) => {
  try {
    const session = req.session;

    // Permissions basiques
    const isHost = req.user && req.user.id === session.hostId;
    const isQuizOwner = req.user && req.user.id === session.quiz?.creatorId;
    const isAdmin = req.user && req.user.role === "admin";

    const canViewStats =
      isHost ||
      isQuizOwner ||
      isAdmin ||
      (session.settings?.showLeaderboard &&
        ["active", "finished"].includes(session.status));

    if (!canViewStats) {
      return res.status(403).json({
        error: "Accès refusé aux statistiques",
        code: "STATS_ACCESS_DENIED",
      });
    }

    const participantCount = getParticipantCount(session.participants);

    const stats = {
      sessionId: session.id,
      status: session.status,
      participantCount: participantCount,
      currentQuestionIndex: session.currentQuestionIndex || 0,
      totalQuestions: session.quiz?.questions?.length || 0,
      stats: session.stats || {},
      leaderboard: session.getLeaderboard(),
      updatedAt: new Date().toISOString(),
    };

    res.json(stats);
  } catch (error) {
    console.error("❌ Erreur stats:", error);
    res.status(500).json({
      error: "Erreur lors de la récupération des statistiques",
      code: "STATS_ERROR",
    });
  }
});

router.get("/:id/status", optionalAuth, loadSession, async (req, res) => {
  try {
    const session = req.session;

    const basicInfo = {
      id: session.id,
      code: session.code,
      status: session.status,
      participantCount: getParticipantCount(session.participants),
      currentQuestionIndex: session.currentQuestionIndex || 0,
      canJoin:
        ["waiting", "active"].includes(session.status) &&
        (session.status === "waiting" || session.settings?.allowLateJoin),
      updatedAt: new Date().toISOString(),
    };

    res.json(basicInfo);
  } catch (error) {
    console.error("❌ Erreur status:", error);
    res.status(500).json({
      error: "Erreur lors de la vérification du statut",
      code: "STATUS_ERROR",
    });
  }
});

module.exports = router;
