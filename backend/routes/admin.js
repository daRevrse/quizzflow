// backend/routes/admin.js
const express = require("express");
const router = express.Router();
const { authenticateToken, requireRole } = require("../middleware/auth");
const { User, Quiz, Session } = require("../models");
const { Op } = require("sequelize");

// Middleware pour vérifier le rôle admin sur toutes les routes
router.use(authenticateToken);
router.use(requireRole("admin"));

// ==========================================
// STATISTIQUES GLOBALES
// ==========================================

// GET /api/admin/stats - Statistiques générales
router.get("/stats", async (req, res) => {
  try {
    const [
      totalUsers,
      totalQuizzes,
      totalSessions,
      activeUsers,
      activeSessions,
      todayUsers,
      todayQuizzes,
      todaySessions,
    ] = await Promise.all([
      User.count(),
      Quiz.count({ where: { isActive: true } }),
      Session.count(),
      User.count({
        where: {
          isActive: true,
        //   lastLoginAt: {
        //     [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 jours
        //   },
        },
      }),
      Session.count({
        where: {
          status: { [Op.in]: ["waiting", "active"] },
        },
      }),
      User.count({
        where: {
          createdAt: {
            [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      Quiz.count({
        where: {
          createdAt: {
            [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      Session.count({
        where: {
          createdAt: {
            [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    ]);

    // Statistiques par rôle
    const usersByRole = await User.findAll({
      attributes: [
        "role",
        [require("sequelize").fn("COUNT", "id"), "count"],
      ],
      group: ["role"],
    });

    // Statistiques par difficulté de quiz
    const quizzesByDifficulty = await Quiz.findAll({
      attributes: [
        "difficulty",
        [require("sequelize").fn("COUNT", "id"), "count"],
      ],
      where: { isActive: true },
      group: ["difficulty"],
    });

    res.json({
      overview: {
        totalUsers,
        totalQuizzes,
        totalSessions,
        activeUsers,
        activeSessions,
      },
      today: {
        newUsers: todayUsers,
        newQuizzes: todayQuizzes,
        newSessions: todaySessions,
      },
      breakdown: {
        usersByRole: usersByRole.reduce((acc, item) => {
          acc[item.role] = parseInt(item.get("count"));
          return acc;
        }, {}),
        quizzesByDifficulty: quizzesByDifficulty.reduce((acc, item) => {
          acc[item.difficulty] = parseInt(item.get("count"));
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des statistiques:", error);
    res.status(500).json({
      error: "Erreur lors de la récupération des statistiques",
    });
  }
});

// ==========================================
// GESTION DES UTILISATEURS
// ==========================================

// GET /api/admin/users - Liste des utilisateurs avec filtres
router.get("/users", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      role,
      status,
      search,
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};

    // Filtres
    if (role) where.role = role;
    if (status === "active") where.isActive = true;
    if (status === "inactive") where.isActive = false;
    if (search) {
      where[Op.or] = [
        { username: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { firstName: { [Op.like]: `%${search}%` } },
        { lastName: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows: users } = await User.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [[sortBy, sortOrder]],
      attributes: { exclude: ["password", "refreshToken"] },
    });

    res.json({
      users: users.map((user) => user.toPublicJSON()),
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des utilisateurs:", error);
    res.status(500).json({
      error: "Erreur lors de la récupération des utilisateurs",
    });
  }
});

// GET /api/admin/users/:id - Détails d'un utilisateur
router.get("/users/:id", async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ["password", "refreshToken"] },
      include: [
        {
          model: Quiz,
          as: "quizzes",
          where: { isActive: true },
          required: false,
          attributes: ["id", "title", "createdAt", "stats"],
        },
        {
          model: Session,
          as: "hostedSessions",
          required: false,
          attributes: ["id", "code", "status", "createdAt"],
        },
      ],
    });

    if (!user) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    res.json({
      user: {
        ...user.toPublicJSON(),
        quizzes: user.quizzes,
        hostedSessions: user.hostedSessions,
        stats: {
          totalQuizzes: user.quizzes?.length || 0,
          totalSessions: user.hostedSessions?.length || 0,
        },
      },
    });
  } catch (error) {
    console.error("Erreur lors de la récupération de l'utilisateur:", error);
    res.status(500).json({
      error: "Erreur lors de la récupération de l'utilisateur",
    });
  }
});

// PUT /api/admin/users/:id - Modifier un utilisateur
router.put("/users/:id", async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    const { role, isActive, firstName, lastName, preferences } = req.body;

    // Empêcher de se désactiver soi-même
    if (req.user.id === user.id && isActive === false) {
      return res.status(400).json({
        error: "Vous ne pouvez pas désactiver votre propre compte",
      });
    }

    // Empêcher de changer son propre rôle
    if (req.user.id === user.id && role && role !== user.role) {
      return res.status(400).json({
        error: "Vous ne pouvez pas modifier votre propre rôle",
      });
    }

    await user.update({
      ...(role && { role }),
      ...(isActive !== undefined && { isActive }),
      ...(firstName && { firstName }),
      ...(lastName && { lastName }),
      ...(preferences && { preferences }),
    });

    res.json({
      message: "Utilisateur modifié avec succès",
      user: user.toPublicJSON(),
    });
  } catch (error) {
    console.error("Erreur lors de la modification de l'utilisateur:", error);
    res.status(500).json({
      error: "Erreur lors de la modification de l'utilisateur",
    });
  }
});

// DELETE /api/admin/users/:id - Supprimer un utilisateur
router.delete("/users/:id", async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    // Empêcher de se supprimer soi-même
    if (req.user.id === user.id) {
      return res.status(400).json({
        error: "Vous ne pouvez pas supprimer votre propre compte",
      });
    }

    // Désactivation plutôt que suppression
    await user.update({
      isActive: false,
      email: `deleted_${Date.now()}_${user.email}`,
      username: `deleted_${Date.now()}_${user.username}`,
    });

    res.json({
      message: "Utilisateur supprimé avec succès",
    });
  } catch (error) {
    console.error("Erreur lors de la suppression de l'utilisateur:", error);
    res.status(500).json({
      error: "Erreur lors de la suppression de l'utilisateur",
    });
  }
});

// POST /api/admin/users - Créer un utilisateur (admin)
router.post("/users", async (req, res) => {
  try {
    const { username, email, password, role, firstName, lastName } = req.body;

    // Validation
    if (!username || !email || !password || !role) {
      return res.status(400).json({
        error: "Tous les champs obligatoires doivent être remplis",
      });
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ email }, { username }],
      },
    });

    if (existingUser) {
      return res.status(400).json({
        error:
          existingUser.email === email
            ? "Cet email est déjà utilisé"
            : "Ce nom d'utilisateur est déjà utilisé",
      });
    }

    const user = await User.create({
      username,
      email,
      password,
      role,
      firstName,
      lastName,
      isActive: true,
    });

    res.status(201).json({
      message: "Utilisateur créé avec succès",
      user: user.toPublicJSON(),
    });
  } catch (error) {
    console.error("Erreur lors de la création de l'utilisateur:", error);
    res.status(500).json({
      error: "Erreur lors de la création de l'utilisateur",
    });
  }
});

// ==========================================
// GESTION DES QUIZ
// ==========================================

// GET /api/admin/quizzes - Liste de tous les quiz
router.get("/quizzes", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      difficulty,
      category,
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};

    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }
    if (difficulty) where.difficulty = difficulty;
    if (category) where.category = category;

    const { count, rows: quizzes } = await Quiz.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [[sortBy, sortOrder]],
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "username", "firstName", "lastName"],
        },
      ],
    });

    res.json({
      quizzes: quizzes.map((quiz) => ({
        ...quiz.toJSON(),
        questionCount: quiz.getQuestionCount(),
        totalPoints: quiz.getTotalPoints(),
      })),
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des quiz:", error);
    res.status(500).json({
      error: "Erreur lors de la récupération des quiz",
    });
  }
});

// DELETE /api/admin/quizzes/:id - Supprimer un quiz
router.delete("/quizzes/:id", async (req, res) => {
  try {
    const quiz = await Quiz.findByPk(req.params.id);

    if (!quiz) {
      return res.status(404).json({ error: "Quiz non trouvé" });
    }

    await quiz.update({ isActive: false });

    res.json({
      message: "Quiz supprimé avec succès",
    });
  } catch (error) {
    console.error("Erreur lors de la suppression du quiz:", error);
    res.status(500).json({
      error: "Erreur lors de la suppression du quiz",
    });
  }
});

// ==========================================
// GESTION DES SESSIONS
// ==========================================

// GET /api/admin/sessions - Liste de toutes les sessions
router.get("/sessions", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};

    if (status) where.status = status;

    const { count, rows: sessions } = await Session.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [[sortBy, sortOrder]],
      include: [
        {
          model: User,
          as: "host",
          attributes: ["id", "username", "firstName", "lastName"],
        },
        {
          model: Quiz,
          as: "quiz",
          attributes: ["id", "title", "difficulty"],
        },
      ],
    });

    res.json({
      sessions: sessions.map((session) => session.toJSON()),
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des sessions:", error);
    res.status(500).json({
      error: "Erreur lors de la récupération des sessions",
    });
  }
});

// DELETE /api/admin/sessions/:id - Supprimer une session
router.delete("/sessions/:id", async (req, res) => {
  try {
    const session = await Session.findByPk(req.params.id);

    if (!session) {
      return res.status(404).json({ error: "Session non trouvée" });
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
});

// ==========================================
// LOGS ET ACTIVITÉ
// ==========================================

// GET /api/admin/activity - Journal d'activité
router.get("/activity", async (req, res) => {
  try {
    const { page = 1, limit = 50, days = 7 } = req.query;
    const offset = (page - 1) * limit;

    // Récupérer les activités récentes
    const recentUsers = await User.findAll({
      where: {
        createdAt: {
          [Op.gte]: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
        },
      },
      order: [["createdAt", "DESC"]],
      limit: 10,
      attributes: ["id", "username", "role", "createdAt"],
    });

    const recentQuizzes = await Quiz.findAll({
      where: {
        createdAt: {
          [Op.gte]: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
        },
      },
      order: [["createdAt", "DESC"]],
      limit: 10,
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["username"],
        },
      ],
      attributes: ["id", "title", "createdAt"],
    });

    const recentSessions = await Session.findAll({
      where: {
        createdAt: {
          [Op.gte]: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
        },
      },
      order: [["createdAt", "DESC"]],
      limit: 10,
      include: [
        {
          model: User,
          as: "host",
          attributes: ["username"],
        },
      ],
      attributes: ["id", "code", "status", "createdAt"],
    });

    // Formater les activités
    const activities = [
      ...recentUsers.map((user) => ({
        id: `user-${user.id}`,
        type: "user_created",
        description: `Nouvel utilisateur : ${user.username}`,
        user: user.username,
        timestamp: user.createdAt,
        metadata: { role: user.role },
      })),
      ...recentQuizzes.map((quiz) => ({
        id: `quiz-${quiz.id}`,
        type: "quiz_created",
        description: `Nouveau quiz : ${quiz.title}`,
        user: quiz.creator?.username || "Inconnu",
        timestamp: quiz.createdAt,
        metadata: { quizId: quiz.id },
      })),
      ...recentSessions.map((session) => ({
        id: `session-${session.id}`,
        type: "session_created",
        description: `Nouvelle session : ${session.code}`,
        user: session.host?.username || "Inconnu",
        timestamp: session.createdAt,
        metadata: { status: session.status },
      })),
    ]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(offset, offset + parseInt(limit));

    res.json({
      activities,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: activities.length === parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Erreur lors de la récupération de l'activité:", error);
    res.status(500).json({
      error: "Erreur lors de la récupération de l'activité",
    });
  }
});

// ==========================================
// SANTÉ DU SYSTÈME
// ==========================================

// GET /api/admin/health - Santé du système
router.get("/health", async (req, res) => {
  try {
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();

    // Vérifier la connexion à la base de données
    let dbStatus = "healthy";
    try {
      await User.sequelize.authenticate();
    } catch (error) {
      dbStatus = "unhealthy";
      console.error("Erreur de connexion à la base de données:", error);
    }

    res.json({
      status: dbStatus === "healthy" ? "healthy" : "unhealthy",
      uptime: {
        seconds: Math.floor(uptime),
        formatted: `${Math.floor(uptime / 3600)}h ${Math.floor(
          (uptime % 3600) / 60
        )}m ${Math.floor(uptime % 60)}s`,
      },
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024), // MB
        percentage: Math.round(
          (memUsage.heapUsed / memUsage.heapTotal) * 100
        ),
      },
      database: {
        status: dbStatus,
      },
      node: {
        version: process.version,
        environment: process.env.NODE_ENV || "development",
      },
    });
  } catch (error) {
    console.error("Erreur lors de la récupération de la santé système:", error);
    res.status(500).json({
      error: "Erreur lors de la récupération de la santé système",
    });
  }
});

// ==========================================
// ACTIONS SYSTÈME
// ==========================================

// POST /api/admin/system/cleanup - Nettoyer les sessions inactives
router.post("/system/cleanup", async (req, res) => {
  try {
    // Supprimer les sessions terminées de plus de 7 jours
    const deletedSessions = await Session.destroy({
      where: {
        status: "completed",
        endedAt: {
          [Op.lt]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    });

    // Supprimer les sessions abandonnées de plus de 24h
    const abandonedSessions = await Session.destroy({
      where: {
        status: { [Op.in]: ["waiting", "paused"] },
        createdAt: {
          [Op.lt]: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    });

    res.json({
      message: "Nettoyage effectué avec succès",
      deleted: {
        completedSessions: deletedSessions,
        abandonedSessions: abandonedSessions,
      },
    });
  } catch (error) {
    console.error("Erreur lors du nettoyage:", error);
    res.status(500).json({
      error: "Erreur lors du nettoyage",
    });
  }
});

module.exports = router;