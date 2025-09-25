const express = require("express");
const router = express.Router();
const { Quiz, User } = require("../models");
const {
  authenticateToken,
  requireRole,
  optionalAuth,
  requireOwnership,
} = require("../middleware/auth");
const { Op } = require("sequelize");

// Middleware pour charger un quiz et vérifier les permissions
const loadQuiz = async (req, res, next) => {
  try {
    const quizId = req.params.id;

    if (!quizId) {
      return res.status(400).json({
        error: "ID du quiz requis",
      });
    }

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

    req.quiz = quiz;
    next();
  } catch (error) {
    console.error("Erreur lors du chargement du quiz:", error);
    res.status(500).json({
      error: "Erreur lors du chargement du quiz",
    });
  }
};

// Validation des données de quiz
const validateQuizData = (req, res, next) => {
  const {
    title,
    description,
    questions,
    settings,
    category,
    tags,
    difficulty,
  } = req.body;
  const errors = [];

  if (!title || title.trim().length === 0) {
    errors.push("Le titre est requis");
  } else if (title.length > 200) {
    errors.push("Le titre ne peut pas dépasser 200 caractères");
  }

  if (description && description.length > 1000) {
    errors.push("La description ne peut pas dépasser 1000 caractères");
  }

  if (questions && !Array.isArray(questions)) {
    errors.push("Les questions doivent être un tableau");
  }

  if (category && category.length > 50) {
    errors.push("La catégorie ne peut pas dépasser 50 caractères");
  }

  if (
    tags &&
    (!Array.isArray(tags) ||
      tags.some((tag) => typeof tag !== "string" || tag.length > 30))
  ) {
    errors.push(
      "Les tags doivent être un tableau de chaînes de moins de 30 caractères"
    );
  }

  if (difficulty && !["facile", "moyen", "difficile"].includes(difficulty)) {
    errors.push("La difficulté doit être: facile, moyen ou difficile");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: "Données invalides",
      details: errors,
    });
  }

  next();
};

// GET /api/quiz - Lister les quiz avec filtres
router.get("/", optionalAuth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      difficulty,
      creator,
      public: isPublic,
      sort = "recent",
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // Construire les conditions de recherche
    const whereConditions = {
      isActive: true,
    };

    // Filtre de recherche textuelle
    if (search) {
      whereConditions[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }

    // Filtres
    if (category) {
      whereConditions.category = category;
    }

    if (difficulty) {
      whereConditions.difficulty = difficulty;
    }

    if (creator) {
      whereConditions.creatorId = creator;
    }

    // Filtre de visibilité
    if (isPublic === "true") {
      whereConditions["settings.isPublic"] = true;
    } else if (!req.user) {
      // Les utilisateurs non connectés ne voient que les quiz publics
      whereConditions["settings.isPublic"] = true;
    } else if (req.user && isPublic !== "false") {
      // Utilisateurs connectés voient leurs quiz + quiz publics
      whereConditions[Op.or] = [
        { "settings.isPublic": true },
        { creatorId: req.user.id },
      ];
    }

    // Définir l'ordre de tri
    let orderClause;
    switch (sort) {
      case "popular":
        orderClause = [["stats.totalSessions", "DESC"]];
        break;
      case "alphabetical":
        orderClause = [["title", "ASC"]];
        break;
      case "recent":
      default:
        orderClause = [["createdAt", "DESC"]];
    }

    const { count, rows: quizzes } = await Quiz.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "username", "firstName", "lastName"],
        },
      ],
      order: orderClause,
      limit: limitNum,
      offset,
      distinct: true,
    });

    // Formater les résultats
    const formattedQuizzes = quizzes.map((quiz) => ({
      ...quiz.getPublicData(),
      creator: quiz.creator,
    }));

    res.json({
      quizzes: formattedQuizzes,
      pagination: {
        current: pageNum,
        pages: Math.ceil(count / limitNum),
        total: count,
        limit: limitNum,
      },
      filters: {
        search,
        category,
        difficulty,
        creator,
        public: isPublic,
        sort,
      },
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des quiz:", error);
    res.status(500).json({
      error: "Erreur lors de la récupération des quiz",
    });
  }
});

// GET /api/quiz/my - Mes quiz

// GET /api/quiz/my - Mes quiz
router.get("/my", authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, category, difficulty } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const whereConditions = {
      creatorId: req.user.id,
      isActive: true,
    };

    if (search) {
      whereConditions[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }

    if (category) {
      whereConditions.category = category;
    }

    if (difficulty) {
      whereConditions.difficulty = difficulty;
    }

    const { count, rows: quizzes } = await Quiz.findAndCountAll({
      where: whereConditions,
      order: [["createdAt", "DESC"]],
      limit: limitNum,
      offset,
    });

    // Formater les quiz avec des valeurs par défaut sécurisées
    const formattedQuizzes = quizzes.map((quiz) => {
      // S'assurer que questions est toujours un tableau
      const safeQuestions = Array.isArray(quiz.questions) ? quiz.questions : [];

      return {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        category: quiz.category,
        tags: quiz.tags || [],
        difficulty: quiz.difficulty,
        questionCount: safeQuestions.length,
        totalPoints: safeQuestions.reduce(
          (total, q) => total + (q.points || 1),
          0
        ),
        estimatedDuration: quiz.estimatedDuration || 0,
        settings: quiz.settings || {},
        stats: quiz.stats || {},
        createdAt: quiz.createdAt,
        updatedAt: quiz.updatedAt,
      };
    });

    res.json({
      quizzes: formattedQuizzes,
      pagination: {
        current: pageNum,
        pages: Math.ceil(count / limitNum),
        total: count,
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des quiz personnels:", error);
    res.status(500).json({
      error: "Erreur lors de la récupération des quiz",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// GET /api/quiz/categories - Lister les catégories
router.get("/categories", async (req, res) => {
  try {
    const categories = await Quiz.getCategories();

    res.json({
      categories,
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des catégories:", error);
    res.status(500).json({
      error: "Erreur lors de la récupération des catégories",
    });
  }
});

// GET /api/quiz/:id - Récupérer un quiz spécifique
// router.get("/:id", optionalAuth, loadQuiz, async (req, res) => {
//   try {
//     const quiz = req.quiz;

//     // Vérifier les permissions de lecture
//     const isOwner = req.user && req.user.id === quiz.creatorId;
//     const isAdmin = req.user && req.user.role === "admin";
//     const isPublic = quiz.settings.isPublic;

//     if (!isPublic && !isOwner && !isAdmin) {
//       return res.status(403).json({
//         error: "Accès refusé - Quiz privé",
//         code: "PRIVATE_QUIZ",
//       });
//     }

//     // Réponse différente selon les permissions
//     if (isOwner || isAdmin) {
//       // Propriétaire/Admin voit tout
//       res.json({
//         quiz: {
//           id: quiz.id,
//           title: quiz.title,
//           description: quiz.description,
//           questions: quiz.questions,
//           settings: quiz.settings,
//           category: quiz.category,
//           tags: quiz.tags,
//           difficulty: quiz.difficulty,
//           estimatedDuration: quiz.estimatedDuration,
//           stats: quiz.stats,
//           creator: quiz.creator,
//           createdAt: quiz.createdAt,
//           updatedAt: quiz.updatedAt,
//         },
//       });
//     } else {
//       // Utilisateur externe ne voit que les infos publiques
//       res.json({
//         quiz: {
//           ...quiz.getPublicData(),
//           creator: quiz.creator,
//           // Questions sans les réponses correctes pour les quiz publics
//           questions: quiz.questions?.map((q) => ({
//             id: q.id,
//             type: q.type,
//             question: q.question,
//             options: q.options?.map((opt) => ({ text: opt.text })),
//             points: q.points,
//             timeLimit: q.timeLimit,
//             order: q.order,
//             media: q.media,
//           })),
//         },
//       });
//     }
//   } catch (error) {
//     console.error("Erreur lors de la récupération du quiz:", error);
//     res.status(500).json({
//       error: "Erreur lors de la récupération du quiz",
//     });
//   }
// });
router.get("/:id", authenticateToken, loadQuiz, async (req, res) => {
  try {
    const quiz = req.quiz;
    const user = req.user;

    // Vérifier les permissions de base
    const isOwner = user.id === quiz.creatorId;
    const isAdmin = user.role === "admin";
    const isFormateur = user.role === "formateur";
    const isPublicQuiz = quiz.settings?.isPublic;
    const isEtudiant = user.role === "etudiant";

    // Permissions d'accès
    const canAccess = isOwner || isAdmin || isFormateur || isPublicQuiz;

    if (!canAccess) {
      return res.status(403).json({
        error: "Accès non autorisé à ce quiz",
      });
    }

    // Pour les étudiants accédant à des quiz publics, rediriger vers la vue publique
    if (isEtudiant && isPublicQuiz && !isOwner) {
      return res.status(200).json({
        message: "Redirection vers la vue publique recommandée",
        quiz: {
          id: quiz.id,
          title: quiz.title,
          isPublic: true,
          redirectTo: `/quiz/${quiz.id}/public`
        }
      });
    }

    // Pour les propriétaires/formateurs/admins, retourner la vue complète
    const fullQuizData = {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      category: quiz.category,
      difficulty: quiz.difficulty,
      tags: quiz.tags,
      questions: quiz.questions,
      settings: quiz.settings,
      creator: quiz.creator,
      createdAt: quiz.createdAt,
      updatedAt: quiz.updatedAt,
      questionCount: quiz.getQuestionCount(),
      totalPoints: quiz.getTotalPoints(),
      estimatedDuration: quiz.estimatedDuration,
      stats: quiz.stats,
    };

    res.json({
      message: "Quiz récupéré avec succès",
      quiz: fullQuizData,
      permissions: {
        canEdit: isOwner || isAdmin,
        canDelete: isOwner || isAdmin,
        canCreateSession: canAccess && !isEtudiant,
        canViewFull: !isEtudiant || isOwner,
      },
    });

  } catch (error) {
    console.error("Erreur lors de la récupération du quiz:", error);
    res.status(500).json({
      error: "Erreur lors de la récupération du quiz",
    });
  }
});

// POST /api/quiz - Créer un nouveau quiz
router.post(
  "/",
  authenticateToken,
  requireRole("formateur", "admin"),
  validateQuizData,
  async (req, res) => {
    try {
      const {
        title,
        description,
        questions = [],
        settings = {},
        category,
        tags = [],
        difficulty = "moyen",
      } = req.body;

      const quiz = await Quiz.create({
        title: title.trim(),
        description: description?.trim(),
        creatorId: req.user.id,
        questions,
        settings: {
          isPublic: false,
          allowAnonymous: true,
          showResults: true,
          showCorrectAnswers: true,
          randomizeQuestions: false,
          randomizeOptions: false,
          maxAttempts: 1,
          passingScore: 50,
          ...settings,
        },
        category: category?.trim(),
        tags,
        difficulty,
      });

      res.status(201).json({
        message: "Quiz créé avec succès",
        quiz: {
          id: quiz.id,
          title: quiz.title,
          description: quiz.description,
          category: quiz.category,
          tags: quiz.tags,
          difficulty: quiz.difficulty,
          questionCount: quiz.getQuestionCount(),
          totalPoints: quiz.getTotalPoints(),
          estimatedDuration: quiz.estimatedDuration,
          settings: quiz.settings,
          createdAt: quiz.createdAt,
        },
      });
    } catch (error) {
      console.error("Erreur lors de la création du quiz:", error);

      if (error.name === "SequelizeValidationError") {
        return res.status(400).json({
          error: "Données invalides",
          details: error.errors.map((err) => err.message),
        });
      }

      res.status(500).json({
        error: "Erreur lors de la création du quiz",
      });
    }
  }
);

// PUT /api/quiz/:id - Mettre à jour un quiz
router.put(
  "/:id",
  authenticateToken,
  loadQuiz,
  requireOwnership("creatorId"),
  validateQuizData,
  async (req, res) => {
    try {
      const quiz = req.quiz;
      const {
        title,
        description,
        questions,
        settings,
        category,
        tags,
        difficulty,
      } = req.body;

      const updates = {};

      if (title !== undefined) updates.title = title.trim();
      if (description !== undefined) updates.description = description?.trim();
      if (questions !== undefined) updates.questions = questions;
      if (settings !== undefined) {
        updates.settings = { ...quiz.settings, ...settings };
      }
      if (category !== undefined) updates.category = category?.trim();
      if (tags !== undefined) updates.tags = tags;
      if (difficulty !== undefined) updates.difficulty = difficulty;

      await quiz.update(updates);

      res.json({
        message: "Quiz mis à jour avec succès",
        quiz: {
          id: quiz.id,
          title: quiz.title,
          description: quiz.description,
          questions: quiz.questions,
          settings: quiz.settings,
          category: quiz.category,
          tags: quiz.tags,
          difficulty: quiz.difficulty,
          questionCount: quiz.getQuestionCount(),
          totalPoints: quiz.getTotalPoints(),
          estimatedDuration: quiz.estimatedDuration,
          updatedAt: quiz.updatedAt,
        },
      });
    } catch (error) {
      console.error("Erreur lors de la mise à jour du quiz:", error);
      res.status(500).json({
        error: "Erreur lors de la mise à jour du quiz",
      });
    }
  }
);

// DELETE /api/quiz/:id - Supprimer un quiz (désactivation)
router.delete(
  "/:id",
  authenticateToken,
  loadQuiz,
  requireOwnership("creatorId"),
  async (req, res) => {
    try {
      const quiz = req.quiz;

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
  }
);

// POST /api/quiz/:id/duplicate - Dupliquer un quiz

router.post(
  "/:id/duplicate",
  authenticateToken,
  requireRole("formateur", "admin"),
  loadQuiz,
  async (req, res) => {
    try {
      const originalQuiz = req.quiz;

      // Vérifier les permissions
      const canDuplicate =
        originalQuiz.creatorId === req.user.id ||
        originalQuiz.settings.isPublic ||
        req.user.role === "admin";

      if (!canDuplicate) {
        return res.status(403).json({
          error: "Permission insuffisante pour dupliquer ce quiz",
        });
      }

      // S'assurer que questions et tags sont des tableaux
      const questions = Array.isArray(originalQuiz.questions)
        ? originalQuiz.questions
        : [];

      const tags = Array.isArray(originalQuiz.tags) ? originalQuiz.tags : [];

      const duplicatedQuiz = await Quiz.create({
        title: `${originalQuiz.title} (Copie)`,
        description: originalQuiz.description,
        creatorId: req.user.id,
        questions: questions,
        settings: {
          ...originalQuiz.settings,
          isPublic: false,
        },
        category: originalQuiz.category,
        tags: tags,
        difficulty: originalQuiz.difficulty,
      });

      res.status(201).json({
        message: "Quiz dupliqué avec succès",
        quiz: {
          id: duplicatedQuiz.id,
          title: duplicatedQuiz.title,
          description: duplicatedQuiz.description,
          category: duplicatedQuiz.category,
          tags: duplicatedQuiz.tags,
          difficulty: duplicatedQuiz.difficulty,
          questionCount: duplicatedQuiz.getQuestionCount(),
          totalPoints: duplicatedQuiz.getTotalPoints(),
          estimatedDuration: duplicatedQuiz.estimatedDuration,
          settings: duplicatedQuiz.settings,
          createdAt: duplicatedQuiz.createdAt,
        },
      });
    } catch (error) {
      console.error("Erreur lors de la duplication du quiz:", error);

      if (error.name === "SequelizeValidationError") {
        return res.status(400).json({
          error: "Données invalides pour la duplication",
          details: error.errors.map((err) => err.message),
        });
      }

      res.status(500).json({
        error: "Erreur lors de la duplication du quiz",
      });
    }
  }
);

// GET /api/quiz/:id/public - Vue publique d'un quiz (sans révéler les réponses)
router.get("/:id/public", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id; // Utilisateur optionnel (peut être null)

    console.log(`🔍 Demande vue publique quiz ${id} par utilisateur ${userId || 'anonyme'}`);

    const quiz = await Quiz.findByPk(id, {
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "firstName", "username"],
        },
      ],
    });

    if (!quiz || !quiz.isActive) {
      return res.status(404).json({
        error: "Quiz non trouvé",
      });
    }

    // Vérifier les permissions d'accès
    const canAccess = 
      quiz.settings?.isPublic || // Quiz public
      (userId && (
        userId === quiz.creatorId || // Propriétaire
        req.user?.role === "admin" || // Admin
        req.user?.role === "formateur" // Formateur
      ));

    if (!canAccess) {
      return res.status(403).json({
        error: "Ce quiz n'est pas accessible publiquement",
      });
    }

    // Préparer la version publique du quiz
    const publicQuizData = {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      category: quiz.category,
      difficulty: quiz.difficulty,
      tags: quiz.tags,
      settings: {
        isPublic: quiz.settings?.isPublic || false,
        allowAnonymous: quiz.settings?.allowAnonymous || false,
        showResults: quiz.settings?.showResults || false,
      },
      creator: quiz.creator ? {
        id: quiz.creator.id,
        firstName: quiz.creator.firstName,
        username: quiz.creator.username,
      } : null,
      createdAt: quiz.createdAt,
      updatedAt: quiz.updatedAt,
      questionCount: quiz.getQuestionCount(),
      totalPoints: quiz.getTotalPoints(),
      estimatedDuration: quiz.estimatedDuration,
    };

    // Ajouter les informations des questions SANS révéler les réponses
    if (quiz.questions && Array.isArray(quiz.questions)) {
      publicQuizData.questions = quiz.questions.map((question, index) => ({
        id: question.id || `question_${index}`,
        type: question.type,
        question: question.question,
        image: question.image,
        // Pour QCM, inclure seulement les textes des options (pas les bonnes réponses)
        ...(question.type === 'qcm' && question.options && {
          options: question.options.map(opt => ({
            text: opt.text || opt
          }))
        }),
        // Ne PAS inclure: correctAnswer, explanation, isCorrect, points, timeLimit
      }));
    }

    // Ajouter les statistiques publiques si disponibles
    if (quiz.stats) {
      publicQuizData.stats = {
        totalSessions: quiz.stats.totalSessions || 0,
        totalParticipants: quiz.stats.totalParticipants || 0,
        averageScore: quiz.stats.averageScore || 0,
        completionRate: quiz.stats.completionRate || 0,
        // Ne pas inclure les statistiques détaillées par question
      };
    }

    console.log(`✅ Vue publique quiz ${id} envoyée`);

    res.json({
      message: "Vue publique du quiz récupérée avec succès",
      quiz: publicQuizData,
    });

  } catch (error) {
    console.error("❌ Erreur vue publique quiz:", error);
    res.status(500).json({
      error: "Erreur lors de la récupération de la vue publique du quiz",
    });
  }
});

module.exports = router;
