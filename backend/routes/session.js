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

// Middleware pour charger une session avec validation robuste
const loadSession = async (req, res, next) => {
  try {
    const sessionId = req.params.id;

    if (!sessionId) {
      return res.status(400).json({
        error: "ID de session requis",
        code: "MISSING_SESSION_ID",
      });
    }

    // Support UUID et entier avec validation
    let whereClause;
    if (sessionId.includes("-")) {
      // UUID format
      whereClause = { id: sessionId };
    } else if (!isNaN(sessionId) && Number.isInteger(Number(sessionId))) {
      // Entier
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

    // Validation et nettoyage des données
    if (!Array.isArray(session.participants)) {
      console.warn(
        `⚠️  Session ${session.id}: participants n'est pas un array, correction...`
      );
      await session.update({ participants: [] });
      session.participants = [];
    }

    if (
      !session.responses ||
      typeof session.responses !== "object" ||
      Array.isArray(session.responses)
    ) {
      console.warn(
        `⚠️  Session ${session.id}: responses invalides, correction...`
      );
      await session.update({ responses: {} });
      session.responses = {};
    }

    req.session = session;
    next();
  } catch (error) {
    console.error("❌ Erreur lors du chargement de la session:", error);
    res.status(500).json({
      error: "Erreur lors du chargement de la session",
      code: "SESSION_LOAD_ERROR",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Middleware pour vérifier les permissions de session
const requireSessionOwnership = (req, res, next) => {
  const session = req.session;
  const user = req.user;

  if (!user || !session) {
    return res.status(401).json({
      error: "Authentification requise",
      code: "AUTH_REQUIRED",
    });
  }

  const isHost = session.hostId === user.id;
  const isQuizOwner = session.quiz?.creatorId === user.id;
  const isAdmin = user.role === "admin";

  if (!isHost && !isQuizOwner && !isAdmin) {
    return res.status(403).json({
      error: "Permissions insuffisantes pour cette session",
      code: "INSUFFICIENT_PERMISSIONS",
    });
  }

  req.permissions = {
    isHost,
    isQuizOwner,
    isAdmin,
    canControl: true,
  };

  next();
};

const getParticipantCount = (session) => {
  if (!session) return 0;

  let participants = session.participants;

  // Parse JSON si nécessaire
  if (typeof participants === "string") {
    try {
      participants = JSON.parse(participants);
    } catch (parseError) {
      console.log(
        `⚠️ Erreur parsing participants pour session ${session.id}:`,
        parseError.message
      );
      return 0;
    }
  }

  if (!Array.isArray(participants)) {
    return 0;
  }

  return participants.filter((p) => {
    return p && typeof p === "object" && p.id && p.name;
  }).length;
};

// 🔧 NOUVELLE FONCTION pour obtenir les participants nettoyés
const getCleanParticipants = (session) => {
  if (!session) return [];

  let participants = session.participants;

  // Parse JSON si nécessaire
  if (typeof participants === "string") {
    try {
      participants = JSON.parse(participants);
    } catch (parseError) {
      console.log(
        `⚠️ Erreur parsing participants pour session ${session.id}:`,
        parseError.message
      );
      return [];
    }
  }

  if (!Array.isArray(participants)) {
    return [];
  }

  return participants.filter((p) => {
    return p && typeof p === "object" && p.id && p.name;
  });
};

// Fonction pour valider les données de participant
const validateParticipantData = (data) => {
  const { participantName, isAnonymous } = data;

  if (!participantName || typeof participantName !== "string") {
    throw new Error("Nom de participant requis");
  }

  const cleanName = participantName.trim();
  if (cleanName.length < 2) {
    throw new Error("Le nom doit contenir au moins 2 caractères");
  }

  if (cleanName.length > 50) {
    throw new Error("Le nom ne peut pas dépasser 50 caractères");
  }

  return {
    name: cleanName,
    isAnonymous: Boolean(isAnonymous),
  };
};

// Fonction pour générer un ID de participant unique
const generateParticipantId = (session, participantName, userId = null) => {
  if (userId) {
    return `user_${userId}`;
  }

  // Pour les participants anonymes, générer un ID basé sur le nom et un timestamp
  const timestamp = Date.now().toString(36);
  const nameHash = participantName.toLowerCase().replace(/\s+/g, "_");
  return `anon_${nameHash}_${timestamp}`;
};

function calculateSessionStats(sessionData) {
  const participants = Array.isArray(sessionData.participants) ? sessionData.participants : [];
  const responses = sessionData.responses || {};
  
  const totalParticipants = participants.length;
  const totalResponses = Object.keys(responses).reduce((total, questionId) => {
    const questionResponses = responses[questionId];
    return total + (Array.isArray(questionResponses) ? questionResponses.length : 0);
  }, 0);
  
  let totalScore = 0;
  let activeParticipants = 0;
  let totalCorrectAnswers = 0;
  let totalQuestionsAnswered = 0;
  
  participants.forEach((participant) => {
    if (participant && typeof participant === "object") {
      const score = participant.score || 0;
      const correctAnswers = participant.correctAnswers || 0;
      const totalQuestions = participant.totalQuestions || 0;
      
      if (typeof score === "number" && !isNaN(score)) {
        totalScore += score;
        activeParticipants++;
      }
      
      totalCorrectAnswers += correctAnswers;
      totalQuestionsAnswered += totalQuestions;
    }
  });
  
  const averageScore = activeParticipants > 0 
    ? Math.round((totalScore / activeParticipants) * 100) / 100 
    : 0;
    
  const participationRate = totalParticipants > 0 
    ? Math.round((activeParticipants / totalParticipants) * 100) 
    : 0;
    
  const accuracyRate = totalQuestionsAnswered > 0 
    ? Math.round((totalCorrectAnswers / totalQuestionsAnswered) * 100) 
    : 0;
  
  return {
    totalParticipants,
    activeParticipants,
    totalResponses,
    averageScore,
    accuracyRate,
    participationRate,
    totalCorrectAnswers,
    totalQuestionsAnswered,
    calculatedAt: new Date(),
  };
}

// Routes

// GET /api/session - Récupérer la liste des sessions
router.get("/", authenticateToken, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      quizId,
      hostId,
      my = false,
    } = req.query;

    const user = req.user;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Construction des filtres
    const where = {};
    const include = [
      {
        model: Quiz,
        as: "quiz",
        attributes: ["id", "title", "category", "difficulty"],
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
    ];

    // Filtrer par utilisateur si demandé
    if (my === "true" && user) {
      where[Op.or] = [{ hostId: user.id }, { "$quiz.creatorId$": user.id }];
    }

    // Autres filtres
    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { code: { [Op.like]: `%${search.toUpperCase()}%` } },
      ];
    }

    if (status && status !== "all") {
      where.status = status;
    }

    if (quizId) {
      where.quizId = parseInt(quizId);
    }

    if (hostId) {
      where.hostId = parseInt(hostId);
    }

    // Requête avec pagination
    const { count, rows: sessions } = await Session.findAndCountAll({
      where,
      include,
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset,
      distinct: true,
    });

    // Formatage des résultats
    const formattedSessions = sessions.map((session) => ({
      id: session.id,
      code: session.code,
      title: session.title,
      description: session.description,
      status: session.status,
      participantCount: getParticipantCount(session), // ← UTILISER LA FONCTION CORRIGÉE
      currentQuestionIndex: session.currentQuestionIndex,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      quiz: session.quiz,
      host: session.host,
      settings: session.settings,
    }));

    const totalPages = Math.ceil(count / parseInt(limit));

    res.json({
      sessions: formattedSessions,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: count,
        itemsPerPage: parseInt(limit),
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1,
      },
    });
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des sessions:", error);
    res.status(500).json({
      error: "Erreur lors de la récupération des sessions",
      code: "GET_SESSIONS_ERROR",
    });
  }
});

// GET /api/session/code/:code - Récupérer les informations d'une session par code
router.get("/code/:code", optionalAuth, async (req, res) => {
  try {
    const { code } = req.params;

    if (!code || code.length !== 6) {
      return res.status(400).json({
        error: "Code de session invalide (doit faire 6 caractères)",
        code: "INVALID_SESSION_CODE",
      });
    }

    const session = await Session.findByCode(code);

    if (!session) {
      return res.status(404).json({
        error: "Session non trouvée",
        code: "SESSION_NOT_FOUND",
      });
    }

    // Charger les relations
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

    const participantCount = getParticipantCount(session);
    const maxParticipants = session.settings?.maxParticipants || 100;

    const responseData = {
      session: {
        id: session.id,
        code: session.code,
        title: session.title,
        description: session.description,
        status: session.status,
        participantCount: getParticipantCount(session), // ← UTILISER LA FONCTION CORRIGÉE
        currentQuestionIndex: session.currentQuestionIndex,
        canJoin:
          ["waiting", "active"].includes(session.status) &&
          (session.status !== "active" || session.settings?.allowLateJoin),
        settings: {
          allowLateJoin: session.settings?.allowLateJoin || false,
          allowAnonymous: session.settings?.allowAnonymous !== false,
          maxParticipants: session.settings?.maxParticipants || 100,
          showLeaderboard: session.settings?.showLeaderboard !== false,
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
      code: "GET_SESSION_BY_CODE_ERROR",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// GET /api/session/:id - Récupérer les détails d'une session
// router.get("/:id", optionalAuth, loadSession, async (req, res) => {
//   try {
//     const session = req.session;
//     const user = req.user;

//     // Déterminer les permissions
//     const isHost = user && session.hostId === user.id;
//     const isQuizOwner = user && session.quiz?.creatorId === user.id;
//     const isAdmin = user && user.role === "admin";
//     const isParticipant =
//       user &&
//       Array.isArray(session.participants) &&
//       session.participants.some((p) => p.userId === user.id);

//     const participantCount = getParticipantCount(session);

//     const responseData = {
//       session: {
//         id: session.id,
//         code: session.code,
//         title: session.title,
//         description: session.description,
//         status: session.status,
//         participantCount,
//         currentQuestionIndex: session.currentQuestionIndex,
//         currentQuestionStartedAt: session.currentQuestionStartedAt,
//         startedAt: session.startedAt,
//         endedAt: session.endedAt,
//         createdAt: session.createdAt,
//         updatedAt: session.updatedAt,
//         settings: session.settings,
//         quiz: session.quiz,
//         host: session.host,
//         stats: session.stats,
//       },
//       permissions: {
//         canControl: isHost || isQuizOwner || isAdmin,
//         canParticipate: ["waiting", "active"].includes(session.status),
//         isHost,
//         isParticipant,
//       },
//     };

//     // Ajouter les détails pour les hôtes
//     if (isHost || isQuizOwner || isAdmin) {
//       // Nettoyer les participants pour l'affichage
//       const cleanParticipants = Array.isArray(session.participants)
//         ? session.participants.filter((p) => p && typeof p === "object" && p.id)
//         : [];

//       responseData.session.participants = cleanParticipants;
//       responseData.session.responses = session.responses || {};
//       responseData.session.detailedStats = session.stats || {};
//     }

//     console.log(
//       `✅ Session détails envoyés avec participantCount: ${participantCount}`
//     );
//     res.json(responseData);
//   } catch (error) {
//     console.error("❌ Erreur lors de la récupération de la session:", error);
//     res.status(500).json({
//       error: "Erreur lors de la récupération de la session",
//       code: "GET_SESSION_ERROR",
//       details:
//         process.env.NODE_ENV === "development" ? error.message : undefined,
//     });
//   }
// });
router.get("/:id", optionalAuth, loadSession, async (req, res) => {
  try {
    const session = req.session;
    const user = req.user;

    // Déterminer les permissions
    const isHost = user && session.hostId === user.id;
    const isQuizOwner = user && session.quiz?.creatorId === user.id;
    const isAdmin = user && user.role === "admin";
    const isParticipant =
      user &&
      Array.isArray(session.participants) &&
      session.participants.some((p) => p.userId === user.id);

    const participantCount = getParticipantCount(session);

    const responseData = {
      session: {
        id: session.id,
        code: session.code,
        title: session.title,
        description: session.description,
        status: session.status,
        participantCount,
        currentQuestionIndex: session.currentQuestionIndex,
        currentQuestionStartedAt: session.currentQuestionStartedAt,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        settings: session.settings,
        quiz: session.quiz,
        host: session.host,
        stats: session.stats,
      },
      permissions: {
        canControl: isHost || isQuizOwner || isAdmin,
        canParticipate: ["waiting", "active"].includes(session.status),
        isHost,
        isParticipant,
      },
    };

    if (isHost || isQuizOwner || isAdmin || isParticipant) {
      const cleanParticipants = getCleanParticipants(session); // ← UTILISER LA FONCTION CORRIGÉE

      responseData.session.participants = cleanParticipants.map((p) => ({
        id: p.id,
        name: p.name,
        isAnonymous: p.isAnonymous,
        joinedAt: p.joinedAt,
        score: p.score || 0,
        // Infos détaillées seulement pour les hôtes
        ...(isHost || isQuizOwner || isAdmin
          ? {
              userId: p.userId,
              socketId: p.socketId,
              isConnected: p.isConnected,
              stats: p.stats,
              responses: p.responses,
            }
          : {}),
      }));

      // Données complètes seulement pour les hôtes
      if (isHost || isQuizOwner || isAdmin) {
        responseData.session.responses = session.responses || {};
        responseData.session.detailedStats = session.stats || {};
      }
    }

    console.log(
      `✅ Session détails envoyés avec ${participantCount} participants`
    );
    res.json(responseData);
  } catch (error) {
    console.error("❌ Erreur lors de la récupération de la session:", error);
    res.status(500).json({
      error: "Erreur lors de la récupération de la session",
      code: "GET_SESSION_ERROR",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// POST /api/session - Créer une nouvelle session
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { quizId, title, description, settings = {} } = req.body;
    const user = req.user;

    console.log("📝 Création session - données reçues:", {
      quizId,
      title,
      description,
      settings,
      userId: user.id,
      userIdType: typeof user.id
    });

    // Validation des données
    if (!quizId) {
      return res.status(400).json({
        error: "ID de quiz requis",
        code: "MISSING_QUIZ_ID",
      });
    }

    // CORRECTION: Valider le format UUID pour quizId
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(quizId)) {
      return res.status(400).json({
        error: "Format d'ID de quiz invalide (UUID requis)",
        code: "INVALID_QUIZ_ID_FORMAT",
      });
    }

    if (!title || typeof title !== "string" || title.trim().length < 3) {
      return res.status(400).json({
        error: "Titre requis (minimum 3 caractères)",
        code: "INVALID_TITLE",
      });
    }

    // Vérifier que le quiz existe et est accessible
    const quiz = await Quiz.findByPk(quizId, {
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "username", "firstName", "lastName"],
        },
      ],
    });

    if (!quiz) {
      return res.status(404).json({
        error: "Quiz non trouvé",
        code: "QUIZ_NOT_FOUND",
      });
    }

    console.log("📚 Quiz trouvé:", {
      id: quiz.id,
      title: quiz.title,
      creatorId: quiz.creatorId,
      userRole: user.role
    });

    // Vérifier les permissions (propriétaire du quiz ou formateur/admin)
    const canCreateSession =
      quiz.creatorId === user.id || ["formateur", "admin"].includes(user.role);

    if (!canCreateSession) {
      return res.status(403).json({
        error: "Permissions insuffisantes pour créer une session avec ce quiz",
        code: "INSUFFICIENT_PERMISSIONS",
      });
    }

    // Vérifier que le quiz a des questions
    if (!quiz.questions || quiz.questions.length === 0) {
      return res.status(400).json({
        error: "Le quiz doit contenir au moins une question",
        code: "QUIZ_NO_QUESTIONS",
      });
    }

    // Générer un code unique
    const code = await Session.generateUniqueCode();

    // Préparer les paramètres par défaut
    const defaultSettings = {
      allowAnonymous: true,
      allowLateJoin: false,
      showLeaderboard: true,
      maxParticipants: 100,
      autoAdvance: false,
      shuffleQuestions: false,
      shuffleAnswers: false,
    };

    const sessionSettings = { ...defaultSettings, ...settings };

    console.log("⚙️ Paramètres session:", sessionSettings);

    // CORRECTION: Créer la session avec les UUID corrects
    const sessionData = {
      code,
      title: title.trim(),
      description: description ? description.trim() : null,
      quizId: quizId, // UUID du quiz
      hostId: user.id, // UUID de l'utilisateur
      settings: sessionSettings,
      participants: [],
      responses: {},
      stats: {
        totalParticipants: 0,
        totalResponses: 0,
        averageScore: 0,
        participationRate: 0,
        activeParticipants: 0,
      },
    };

    console.log("💾 Données session à créer:", {
      ...sessionData,
      quizIdType: typeof sessionData.quizId,
      hostIdType: typeof sessionData.hostId
    });

    const session = await Session.create(sessionData);

    // Recharger avec les relations
    await session.reload({
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

    console.log(`✅ Session créée: ${session.id} (${session.code})`);

    res.status(201).json({
      message: "Session créée avec succès",
      session: {
        id: session.id,
        code: session.code,
        title: session.title,
        description: session.description,
        status: session.status,
        participantCount: 0,
        settings: session.settings,
        quiz: session.quiz,
        host: session.host,
        createdAt: session.createdAt,
      },
    });
  } catch (error) {
    console.error("❌ Erreur lors de la création de la session:", error);
    console.error("❌ Stack trace:", error.stack);

    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        error: "Un code de session identique existe déjà",
        code: "DUPLICATE_SESSION_CODE",
      });
    }

    if (error.name === "SequelizeValidationError") {
      console.error("❌ Détails de validation:", error.errors);
      return res.status(400).json({
        error: "Données de session invalides",
        code: "VALIDATION_ERROR",
        details: error.errors?.map((e) => ({
          field: e.path,
          message: e.message,
          value: e.value
        })),
      });
    }

    if (error.name === "SequelizeForeignKeyConstraintError") {
      return res.status(400).json({
        error: "Référence invalide (quiz ou utilisateur inexistant)",
        code: "FOREIGN_KEY_ERROR",
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }

    res.status(500).json({
      error: "Erreur lors de la création de la session",
      code: "CREATE_SESSION_ERROR",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

router.post("/:id/join", optionalAuth, loadSession, async (req, res) => {
  try {
    const session = req.session;
    const user = req.user;
    const { participantName, isAnonymous = false } = req.body;

    console.log("\n🎯 === JOIN SESSION AVEC SQL BRUT ===");
    console.log(`   Session ID: ${session.id}`);
    console.log(`   Session Code: ${session.code}`);
    console.log(`   Participant Name: ${participantName}`);
    console.log(`   Is Anonymous: ${isAnonymous}`);
    console.log(`   User ID: ${user?.id || "null"}`);

    // Validation du statut de la session
    if (!["waiting", "active"].includes(session.status)) {
      console.log(`❌ Statut session invalide: ${session.status}`);
      return res.status(400).json({
        error: "Cette session n'accepte pas de nouveaux participants",
        code: "SESSION_NOT_JOINABLE",
        currentStatus: session.status,
      });
    }

    // Validation Late join
    if (session.status === "active" && !session.settings?.allowLateJoin) {
      console.log("❌ Late join désactivé");
      return res.status(400).json({
        error: "Rejoindre en cours de session n'est pas autorisé",
        code: "LATE_JOIN_DISABLED",
      });
    }

    // Validation nom participant
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

    // Générer un ID unique pour le participant
    const participantId = `participant_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 8)}`;

    console.log(`👤 ID généré: ${participantId}`);

    // Préparer les données du participant
    const participantData = {
      id: participantId,
      name: cleanParticipantName,
      isAnonymous: Boolean(isAnonymous),
      userId: user?.id || null,
      socketId: null, // Sera mis à jour par Socket.IO
    };

    console.log(`📦 Données participant préparées:`, participantData);

    // ÉTAPE CRITIQUE : Utiliser la méthode SQL directe
    console.log(`🔧 Réparation préventive SQL...`);
    await session.repairParticipantsSQL();

    console.log(`➕ Ajout participant via SQL brut...`);
    try {
      await session.addParticipant(participantData);
      console.log(`✅ addParticipant SQL terminé avec succès`);
    } catch (addError) {
      console.error(`❌ Erreur addParticipant SQL:`, addError.message);

      // Gestion des erreurs spécifiques
      if (addError.message.includes("existe déjà")) {
        return res.status(409).json({
          error: addError.message,
          code: "PARTICIPANT_EXISTS",
        });
      }

      if (addError.message.includes("utilisé")) {
        return res.status(409).json({
          error: addError.message,
          code: "NAME_TAKEN",
          suggestion: `${cleanParticipantName}_${Date.now()
            .toString()
            .slice(-3)}`,
        });
      }

      if (addError.message.includes("limite")) {
        return res.status(400).json({
          error: addError.message,
          code: "PARTICIPANT_LIMIT_REACHED",
        });
      }

      throw addError;
    }

    // Vérification post-ajout avec SQL direct
    console.log(`🔍 Vérification SQL post-ajout...`);
    const wasAdded = await session.verifyParticipantAdded(participantId);

    if (!wasAdded) {
      console.error(`❌ ÉCHEC CRITIQUE: Participant non trouvé via SQL direct`);
      return res.status(500).json({
        error: "Échec de persistance en base de données",
        code: "DATABASE_PERSISTENCE_ERROR",
        details: "Le participant n'a pas été trouvé après ajout SQL",
      });
    }

    console.log(`✅ Participant confirmé en base de données`);

    // Récupérer le nombre réel de participants via SQL
    const { QueryTypes } = require("sequelize");
    const { sequelize } = require("../config/database");

    const [participantCountData] = await sequelize.query(
      `SELECT participants FROM sessions WHERE id = :sessionId`,
      {
        type: QueryTypes.SELECT,
        replacements: { sessionId: session.id },
      }
    );

    let realParticipantCount = 0;
    if (participantCountData && participantCountData.participants) {
      let participants = participantCountData.participants;
      if (typeof participants === "string") {
        participants = JSON.parse(participants);
      }
      if (Array.isArray(participants)) {
        realParticipantCount = participants.length;
      }
    }

    console.log(
      `📈 Nombre réel de participants en DB: ${realParticipantCount}`
    );

    // Notifier via Socket.IO
    if (req.io) {
      const notificationData = {
        sessionId: session.id,
        participant: {
          id: participantId,
          name: cleanParticipantName,
          isAnonymous: Boolean(isAnonymous),
          joinedAt: new Date().toISOString(),
        },
        participantCount: realParticipantCount,
        totalParticipants: realParticipantCount,
      };

      console.log(`📡 Notification Socket.IO`);
      req.io
        .to(`session_${session.id}`)
        .emit("participant_joined", notificationData);
      req.io
        .to(`host_${session.id}`)
        .emit("participant_joined", notificationData);
    }

    // Recharger l'instance Sequelize pour la réponse
    await session.reload();

    // Préparer la réponse avec les données réelles
    const responseData = {
      success: true,
      message: "Session rejointe avec succès",
      participant: {
        id: participantId,
        name: cleanParticipantName,
        isAnonymous: Boolean(isAnonymous),
        joinedAt: new Date().toISOString(),
      },
      session: {
        id: session.id,
        code: session.code,
        title: session.title,
        status: session.status,
        participantCount: realParticipantCount, // VALEUR RÉELLE DEPUIS SQL
        currentQuestionIndex: session.currentQuestionIndex || -1,
        settings: session.settings,
        quiz: session.quiz
          ? {
              id: session.quiz.id,
              title: session.quiz.title,
            }
          : null,
        host: session.host
          ? {
              name: session.host.firstName || session.host.username,
              username: session.host.username,
            }
          : null,
      },
    };

    console.log(`✅ === JOIN SESSION SQL SUCCESS ===`);
    console.log(`   Participant "${cleanParticipantName}" ajouté`);
    console.log(`   Participants réels en DB: ${realParticipantCount}`);
    console.log(
      `   Response participantCount: ${responseData.session.participantCount}`
    );
    console.log(`   Session ID: ${session.id}\n`);

    res.status(200).json(responseData);
  } catch (error) {
    console.error("\n💥 === ERREUR JOIN SESSION SQL ===");
    console.error(`   Session ID: ${req.session?.id}`);
    console.error(`   Error name: ${error.name}`);
    console.error(`   Error message: ${error.message}`);
    console.error(`   Stack:`, error.stack);

    res.status(500).json({
      error: "Erreur lors de l'ajout du participant",
      code: "JOIN_SESSION_ERROR",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// POST /api/session/:id/start - Démarrer une session
router.post(
  "/:id/start",
  authenticateToken,
  loadSession,
  requireSessionOwnership,
  async (req, res) => {
    try {
      const session = req.session;

      // Validation du statut
      if (session.status !== "waiting") {
        return res.status(400).json({
          error: "La session ne peut être démarrée que depuis l'état 'waiting'",
          code: "INVALID_SESSION_STATUS",
          currentStatus: session.status,
        });
      }

      // Validation des participants
      const participantCount = getParticipantCount(session);
      if (participantCount === 0) {
        return res.status(400).json({
          error: "Au moins un participant est requis pour démarrer la session",
          code: "NO_PARTICIPANTS",
        });
      }

      // Démarrer la session
      await session.startSession();
      await session.reload();

      // Notifier via Socket.IO si disponible
      if (req.io) {
        req.io.to(`session_${session.id}`).emit("session_started", {
          sessionId: session.id,
          startedAt: session.startedAt,
          currentQuestionIndex: session.currentQuestionIndex,
        });
      }

      console.log(`✅ Session démarrée: ${session.id}`);

      res.json({
        message: "Session démarrée avec succès",
        session: {
          id: session.id,
          status: session.status,
          startedAt: session.startedAt,
          currentQuestionIndex: session.currentQuestionIndex,
          participantCount,
        },
      });
    } catch (error) {
      console.error("❌ Erreur lors du démarrage:", error);

      if (
        error.message.includes("waiting") ||
        error.message.includes("participants")
      ) {
        return res.status(400).json({
          error: error.message,
          code: "START_SESSION_INVALID_STATE",
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

      console.log(`✅ Session mise en pause: ${session.id}`);

      res.json({
        message: "Session mise en pause",
        session: {
          id: session.id,
          status: session.status,
        },
      });
    } catch (error) {
      console.error("❌ Erreur lors de la mise en pause:", error);

      if (error.message.includes("actives")) {
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
          currentQuestionStartedAt: session.currentQuestionStartedAt,
        });
      }

      console.log(`✅ Session reprise: ${session.id}`);

      res.json({
        message: "Session reprise",
        session: {
          id: session.id,
          status: session.status,
          currentQuestionStartedAt: session.currentQuestionStartedAt,
        },
      });
    } catch (error) {
      console.error("❌ Erreur lors de la reprise:", error);

      if (error.message.includes("pause")) {
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
router.post(
  "/:id/end",
  authenticateToken,
  loadSession,
  requireSessionOwnership,
  async (req, res) => {
    try {
      const session = req.session;

      // Si la session est déjà terminée, retourner un succès avec les données actuelles
      if (session.status === "finished") {
        console.log(`⚠️ Tentative de terminer une session déjà terminée: ${session.id}`);
        
        return res.json({
          message: "Session déjà terminée",
          session: {
            id: session.id,
            status: session.status,
            endedAt: session.endedAt,
            stats: session.stats,
          },
          alreadyFinished: true,
        });
      }

      // Vérifier que la session peut être terminée
      if (!["active", "paused"].includes(session.status)) {
        return res.status(400).json({
          error: `Impossible de terminer une session avec le statut "${session.status}". Seules les sessions actives ou en pause peuvent être terminées.`,
          code: "INVALID_SESSION_STATUS",
          currentStatus: session.status,
        });
      }

      console.log(`🏁 Fin manuelle de session ${session.id} depuis le statut ${session.status}`);

      await session.endSession();
      await session.reload();

      if (req.io) {
        req.io.to(`session_${session.id}`).emit("session_ended", {
          sessionId: session.id,
          endedAt: session.endedAt,
          finalStats: session.stats,
          manualEnd: true,
        });
      }

      console.log(`✅ Session terminée manuellement: ${session.id}`);

      res.json({
        message: "Session terminée",
        session: {
          id: session.id,
          status: session.status,
          endedAt: session.endedAt,
          stats: session.stats,
        },
      });
    } catch (error) {
      console.error("❌ Erreur lors de la fermeture:", error);

      // Gestion spécifique des erreurs de statut
      if (error.message?.includes("statut") || error.message?.includes("terminée")) {
        return res.status(400).json({
          error: error.message,
          code: "INVALID_SESSION_STATUS",
          currentStatus: req.session?.status,
        });
      }

      res.status(500).json({
        error: "Erreur lors de la fermeture de la session",
        code: "END_SESSION_ERROR",
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
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
          code: "CANNOT_DELETE_ACTIVE_SESSION",
        });
      }

      const sessionInfo = {
        id: session.id,
        code: session.code,
        title: session.title,
      };

      await session.destroy();

      console.log(
        `✅ Session supprimée: ${sessionInfo.id} (${sessionInfo.code})`
      );

      res.json({
        message: "Session supprimée avec succès",
        deletedSession: sessionInfo,
      });
    } catch (error) {
      console.error("❌ Erreur lors de la suppression:", error);
      res.status(500).json({
        error: "Erreur lors de la suppression de la session",
        code: "DELETE_SESSION_ERROR",
      });
    }
  }
);

// Route pour obtenir les résultats d'un participant spécifique
router.get("/:sessionId/participant/:participantId/results", async (req, res) => {
  try {
    const { sessionId, participantId } = req.params;
    
    console.log(`📊 Récupération résultats participant ${participantId} session ${sessionId}`);
    
    const session = await Session.findByPk(sessionId, {
      include: [{ model: Quiz, as: "quiz" }],
    });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session non trouvée",
      });
    }
    
    // Vérifier que la session est terminée ou que le participant a le droit de voir ses résultats
    if (session.status !== "completed" && session.status !== "finished") {
      return res.status(403).json({
        success: false,
        message: "Les résultats ne sont pas encore disponibles",
      });
    }
    
    // Obtenir les résultats du participant
    const participantResults = session.getParticipantResults(participantId);
    
    if (!participantResults) {
      return res.status(404).json({
        success: false,
        message: "Participant non trouvé dans cette session",
      });
    }
    
    // Ajouter les informations sur les questions pour le contexte
    const questionsWithResults = [];
    if (session.quiz && session.quiz.questions) {
      participantResults.responses.forEach(response => {
        const questionIndex = parseInt(response.questionId.replace('q_', ''));
        const question = session.quiz.questions[questionIndex];
        
        if (question) {
          questionsWithResults.push({
            ...response,
            questionText: question.question,
            questionType: question.type,
            correctAnswer: question.correctAnswer,
            options: question.options,
          });
        }
      });
    }
    
    res.json({
      success: true,
      participant: participantResults.participant,
      responses: questionsWithResults,
      rank: participantResults.rank,
      sessionInfo: {
        id: session.id,
        code: session.code,
        title: session.title,
        status: session.status,
        endedAt: session.endedAt,
        stats: session.stats,
      },
    });
    
  } catch (error) {
    console.error("Erreur récupération résultats participant:", error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la récupération des résultats",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Route pour obtenir les résultats complets d'une session (pour l'hôte)
router.get("/:sessionId/results/complete", authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;
    
    console.log(`📊 Récupération résultats complets session ${sessionId} par ${userId}`);
    
    const session = await Session.findByPk(sessionId, {
      include: [{ model: Quiz, as: "quiz" }],
    });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session non trouvée",
      });
    }
    
    // Vérifier les permissions (hôte, créateur du quiz, ou admin)
    const isHost = session.hostId === userId;
    const isQuizOwner = session.quiz?.creatorId === userId;
    const isAdmin = req.user.role === "admin";
    
    if (!isHost && !isQuizOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Permission insuffisante pour accéder aux résultats",
      });
    }
    
    // Obtenir les résultats complets
    const comprehensiveResults = session.getComprehensiveResults();
    
    // Ajouter les informations des questions
    if (session.quiz && session.quiz.questions) {
      Object.keys(comprehensiveResults.questionResults).forEach(questionId => {
        const questionIndex = parseInt(questionId.replace('q_', ''));
        const question = session.quiz.questions[questionIndex];
        
        if (question) {
          comprehensiveResults.questionResults[questionId].question = {
            text: question.question,
            type: question.type,
            correctAnswer: question.correctAnswer,
            options: question.options,
            points: question.points || 1,
          };
        }
      });
    }
    
    res.json({
      success: true,
      ...comprehensiveResults,
    });
    
  } catch (error) {
    console.error("Erreur récupération résultats complets:", error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la récupération des résultats",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Route pour obtenir l'historique des sessions d'un participant (basé sur nom ou userId)
router.get("/participant/:participantId/history", authenticateToken, async (req, res) => {
  try {
    const { participantId } = req.params;
    const userId = req.user.id;
    
    console.log(`📊 Récupération historique participant ${participantId}`);
    
    // Rechercher les sessions où ce participant a participé
    const sessions = await Session.findAll({
      include: [{ model: Quiz, as: "quiz" }],
      where: {
        status: ["completed", "finished"]
      },
      order: [["endedAt", "DESC"]],
      limit: 50, // Limiter à 50 sessions récentes
    });
    
    const participantHistory = [];
    
    sessions.forEach(session => {
      if (Array.isArray(session.participants)) {
        const participant = session.participants.find(p => 
          p.id === participantId || 
          p.userId === userId || 
          (p.name && p.name.toLowerCase().includes(req.user.firstName?.toLowerCase() || ''))
        );
        
        if (participant) {
          const participantResults = session.getParticipantResults(participant.id);
          
          participantHistory.push({
            sessionId: session.id,
            sessionCode: session.code,
            sessionTitle: session.title,
            quizTitle: session.quiz?.title,
            endedAt: session.endedAt,
            rank: participantResults?.rank,
            score: participant.score || 0,
            correctAnswers: participant.correctAnswers || 0,
            totalQuestions: participant.totalQuestions || 0,
            accuracyRate: participant.totalQuestions > 0 
              ? Math.round((participant.correctAnswers / participant.totalQuestions) * 100) 
              : 0,
            totalTimeSpent: participant.totalTimeSpent || 0,
          });
        }
      }
    });
    
    // Calculer les statistiques globales
    const globalStats = {
      totalSessions: participantHistory.length,
      totalScore: participantHistory.reduce((sum, s) => sum + s.score, 0),
      totalCorrectAnswers: participantHistory.reduce((sum, s) => sum + s.correctAnswers, 0),
      totalQuestions: participantHistory.reduce((sum, s) => sum + s.totalQuestions, 0),
      averageScore: participantHistory.length > 0 
        ? Math.round(participantHistory.reduce((sum, s) => sum + s.score, 0) / participantHistory.length) 
        : 0,
      averageAccuracy: participantHistory.length > 0 
        ? Math.round(participantHistory.reduce((sum, s) => sum + s.accuracyRate, 0) / participantHistory.length) 
        : 0,
      bestScore: participantHistory.length > 0 
        ? Math.max(...participantHistory.map(s => s.score)) 
        : 0,
      bestAccuracy: participantHistory.length > 0 
        ? Math.max(...participantHistory.map(s => s.accuracyRate)) 
        : 0,
    };
    
    res.json({
      success: true,
      history: participantHistory,
      stats: globalStats,
      participant: {
        id: participantId,
        name: req.user.firstName || req.user.username,
      },
    });
    
  } catch (error) {
    console.error("Erreur récupération historique participant:", error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la récupération de l'historique",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Route pour marquer une session comme terminée et calculer les résultats finaux
router.post("/:sessionId/finalize", async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    console.log(`🏁 Finalisation session ${sessionId}`);
    
    const session = await Session.findByPk(sessionId, {
      include: [{ model: Quiz, as: "quiz" }],
    });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session non trouvée",
      });
    }
    
    // Finaliser la session
    await session.update({
      status: "completed",
      endedAt: new Date(),
    });
    
    // Recalculer les stats finales
    const finalStats = calculateSessionStats({
      participants: session.participants,
      responses: session.responses,
    });
    
    await session.update({ stats: finalStats });
    
    // Mettre à jour les stats du quiz si disponible
    if (session.quiz) {
      const participants = Array.isArray(session.participants) ? session.participants : [];
      const averageScore = finalStats.averageScore || 0;
      
      // Vérifier si la méthode existe avant de l'appeler
      if (typeof session.quiz.incrementStats === 'function') {
        await session.quiz.incrementStats(participants.length, averageScore);
      }
    }
    
    res.json({
      success: true,
      message: "Session finalisée avec succès",
      session: {
        id: session.id,
        status: "completed",
        stats: finalStats,
        endedAt: session.endedAt,
      },
    });
    
  } catch (error) {
    console.error("Erreur finalisation session:", error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la finalisation",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

module.exports = router;
