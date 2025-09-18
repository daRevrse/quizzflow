const { sequelize } = require("../config/database");

// Import des modèles
const User = require("./User");
const Quiz = require("./Quiz");
const Session = require("./Session");

// Définition des associations
const defineAssociations = () => {
  // Un utilisateur peut créer plusieurs quiz
  User.hasMany(Quiz, {
    foreignKey: "creatorId",
    as: "quizzes",
    onDelete: "CASCADE",
  });

  // Un quiz appartient à un utilisateur (créateur)
  Quiz.belongsTo(User, {
    foreignKey: "creatorId",
    as: "creator",
    onDelete: "CASCADE",
  });

  // Un utilisateur peut héberger plusieurs sessions
  User.hasMany(Session, {
    foreignKey: "hostId",
    as: "hostedSessions",
    onDelete: "CASCADE",
  });

  // Une session appartient à un utilisateur (hôte)
  Session.belongsTo(User, {
    foreignKey: "hostId",
    as: "host",
    onDelete: "CASCADE",
  });

  // Un quiz peut avoir plusieurs sessions
  Quiz.hasMany(Session, {
    foreignKey: "quizId",
    as: "sessions",
    onDelete: "CASCADE",
  });

  // Une session appartient à un quiz
  Session.belongsTo(Quiz, {
    foreignKey: "quizId",
    as: "quiz",
    onDelete: "CASCADE",
  });
};

// Exécuter les associations
defineAssociations();

// Fonction pour synchroniser tous les modèles
const syncDatabase = async (options = {}) => {
  try {
    await sequelize.sync(options);
    console.log("🔄 Base de données synchronisée avec succès");
    return true;
  } catch (error) {
    console.error("❌ Erreur lors de la synchronisation:", error);
    throw error;
  }
};

// Fonction pour initialiser les données de test (optionnel)
const seedDatabase = async () => {
  try {
    const userCount = await User.count();

    if (userCount === 0 && process.env.NODE_ENV === "development") {
      console.log("📋 Création des données de test...");

      // Créer un utilisateur admin de test
      const adminUser = await User.create({
        username: "admin",
        email: "admin@quiz-app.local",
        password: "password123",
        role: "admin",
        firstName: "Admin",
        lastName: "System",
        preferences: {
          theme: "dark",
          language: "fr",
          notifications: true,
        },
      });

      // Créer un formateur de test
      const formateur = await User.create({
        username: "formateur_demo",
        email: "formateur@quiz-app.local",
        password: "password123",
        role: "formateur",
        firstName: "Jean",
        lastName: "Dupont",
        preferences: {
          theme: "light",
          language: "fr",
          notifications: true,
        },
      });

      // Créer un quiz de démonstration
      const demoQuiz = await Quiz.create({
        title: "Quiz de démonstration - Connaissances générales",
        description:
          "Un quiz simple pour tester l'application avec différents types de questions.",
        creatorId: formateur.id,
        category: "Général",
        tags: ["demo", "test", "général"],
        difficulty: "facile",
        questions: [
          {
            id: "q1",
            type: "qcm",
            question: "Quelle est la capitale de la France ?",
            options: [
              { text: "Paris", isCorrect: true },
              { text: "Lyon", isCorrect: false },
              { text: "Marseille", isCorrect: false },
              { text: "Toulouse", isCorrect: false },
            ],
            explanation:
              "Paris est la capitale et la plus grande ville de France.",
            points: 1,
            timeLimit: 15,
            order: 1,
          },
          {
            id: "q2",
            type: "vrai_faux",
            question: "Le Soleil est une planète.",
            options: [
              { text: "Vrai", isCorrect: false },
              { text: "Faux", isCorrect: true },
            ],
            explanation: "Le Soleil est une étoile, pas une planète.",
            points: 1,
            timeLimit: 10,
            order: 2,
          },
          {
            id: "q3",
            type: "reponse_libre",
            question: "En quelle année a été créé JavaScript ?",
            correctAnswer: "1995",
            explanation:
              "JavaScript a été créé en 1995 par Brendan Eich chez Netscape.",
            points: 2,
            timeLimit: 30,
            order: 3,
          },
        ],
        settings: {
          isPublic: true,
          allowAnonymous: true,
          showResults: true,
          showCorrectAnswers: true,
          randomizeQuestions: false,
          randomizeOptions: false,
          maxAttempts: 3,
          passingScore: 60,
        },
      });

      console.log("✅ Données de test créées:");
      console.log(`   - Admin: admin@quiz-app.local / password123`);
      console.log(`   - Formateur: formateur@quiz-app.local / password123`);
      console.log(`   - Quiz demo: "${demoQuiz.title}"`);
    }
  } catch (error) {
    console.error("❌ Erreur lors de la création des données de test:", error);
  }
};

// Fonction pour nettoyer la base de données
const cleanDatabase = async () => {
  try {
    await sequelize.drop();
    console.log("🧹 Base de données nettoyée");
    return true;
  } catch (error) {
    console.error("❌ Erreur lors du nettoyage:", error);
    throw error;
  }
};

// Fonction pour obtenir les statistiques de la base
const getDatabaseStats = async () => {
  try {
    const userCount = await User.count();
    const quizCount = await Quiz.count();
    const sessionCount = await Session.count();
    const activeQuizCount = await Quiz.count({ where: { isActive: true } });
    const activeSessionCount = await Session.count({
      where: { status: ["waiting", "active", "paused"] },
    });

    return {
      users: userCount,
      quizzes: quizCount,
      sessions: sessionCount,
      activeQuizzes: activeQuizCount,
      activeSessions: activeSessionCount,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("❌ Erreur lors du calcul des statistiques:", error);
    return null;
  }
};

module.exports = {
  sequelize,
  User,
  Quiz,
  Session,
  syncDatabase,
  seedDatabase,
  cleanDatabase,
  getDatabaseStats,

  // Export des modèles pour faciliter l'import
  models: {
    User,
    Quiz,
    Session,
  },
};
