// Correction models/index.js - backend/models/index.js

const { sequelize } = require("../config/database");

// Import direct avec chemin absolu pour éviter les problèmes de cache
const User = require("./User");
const Quiz = require("./Quiz");
const Session = require("./Session");

// Vérification que les modèles sont bien importés
console.log("🔍 Vérification des modèles:");
console.log("   User:", typeof User, User.name);
console.log("   Quiz:", typeof Quiz, Quiz.name);
console.log("   Session:", typeof Session, Session.name);

// Vérification que ce sont bien des modèles Sequelize
const isSequelizeModel = (model) => {
  return (
    model &&
    typeof model === "function" &&
    model.prototype &&
    model.sequelize &&
    typeof model.hasMany === "function"
  );
};

console.log("🧪 Test modèles Sequelize:");
console.log("   User isModel:", isSequelizeModel(User));
console.log("   Quiz isModel:", isSequelizeModel(Quiz));
console.log("   Session isModel:", isSequelizeModel(Session));

// Si les modèles ne sont pas valides, les recréer
let models = { User, Quiz, Session };

// Vérification et correction si nécessaire
Object.keys(models).forEach((modelName) => {
  if (!isSequelizeModel(models[modelName])) {
    console.error(`❌ ${modelName} n'est pas un modèle Sequelize valide`);
    console.log(`   Type: ${typeof models[modelName]}`);
    console.log(`   Constructor: ${models[modelName]?.constructor?.name}`);
    console.log(`   Properties:`, Object.keys(models[modelName] || {}));
  }
});

// Définition des associations avec vérification
const defineAssociations = () => {
  try {
    console.log("🔗 Définition des associations...");

    // Vérifier que tous les modèles sont disponibles avant de créer les associations
    if (!isSequelizeModel(User)) {
      throw new Error("User n'est pas un modèle Sequelize valide");
    }
    if (!isSequelizeModel(Quiz)) {
      throw new Error("Quiz n'est pas un modèle Sequelize valide");
    }
    if (!isSequelizeModel(Session)) {
      throw new Error("Session n'est pas un modèle Sequelize valide");
    }

    // Un utilisateur peut créer plusieurs quiz
    User.hasMany(Quiz, {
      foreignKey: "creatorId",
      as: "quizzes",
      onDelete: "CASCADE",
    });
    console.log("✅ User.hasMany(Quiz)");

    // Un quiz appartient à un utilisateur (créateur)
    Quiz.belongsTo(User, {
      foreignKey: "creatorId",
      as: "creator",
      onDelete: "CASCADE",
    });
    console.log("✅ Quiz.belongsTo(User)");

    // Un utilisateur peut héberger plusieurs sessions
    User.hasMany(Session, {
      foreignKey: "hostId",
      as: "hostedSessions",
      onDelete: "CASCADE",
    });
    console.log("✅ User.hasMany(Session)");

    // Une session appartient à un utilisateur (hôte)
    Session.belongsTo(User, {
      foreignKey: "hostId",
      as: "host",
      onDelete: "CASCADE",
    });
    console.log("✅ Session.belongsTo(User)");

    // Un quiz peut avoir plusieurs sessions
    Quiz.hasMany(Session, {
      foreignKey: "quizId",
      as: "sessions",
      onDelete: "CASCADE",
    });
    console.log("✅ Quiz.hasMany(Session)");

    // Une session appartient à un quiz
    Session.belongsTo(Quiz, {
      foreignKey: "quizId",
      as: "quiz",
      onDelete: "CASCADE",
    });
    console.log("✅ Session.belongsTo(Quiz)");

    console.log("🎉 Toutes les associations ont été définies avec succès");
    return true;
  } catch (error) {
    console.error("❌ Erreur lors de la définition des associations:", error);

    // Afficher plus de détails sur l'erreur
    console.error("   Stack:", error.stack);

    // Afficher l'état des modèles pour déboguer
    console.log("🔍 État des modèles lors de l'erreur:");
    console.log("   User:", {
      type: typeof User,
      hasMany: typeof User.hasMany,
      sequelize: !!User.sequelize,
    });
    console.log("   Quiz:", {
      type: typeof Quiz,
      hasMany: typeof Quiz.hasMany,
      sequelize: !!Quiz.sequelize,
    });
    console.log("   Session:", {
      type: typeof Session,
      hasMany: typeof Session.hasMany,
      sequelize: !!Session.sequelize,
    });

    throw error;
  }
};

// Exécuter les associations seulement si tous les modèles sont valides
try {
  defineAssociations();
} catch (error) {
  console.error("💥 Impossible de définir les associations:", error.message);
  process.exit(1);
}

// Fonction pour synchroniser tous les modèles
const syncDatabase = async (options = {}) => {
  try {
    console.log("🔄 Synchronisation de la base de données...");
    await sequelize.sync(options);
    console.log("✅ Base de données synchronisée avec succès");
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
        creatorId: formateur.id,
        title: "Quiz de démonstration - Connaissances générales",
        description:
          "Un quiz simple pour tester l'application avec différents types de questions.",
        category: "general",
        tags: ["demo", "test", "general"],
        difficulty: "moyen",
        questions: [
          {
            id: "q1",
            type: "qcm",
            question: "Quelle est la capitale de la France ?",
            options: [
              { text: "Londres", isCorrect: false },
              { text: "Berlin", isCorrect: false },
              { text: "Paris", isCorrect: true },
              { text: "Madrid", isCorrect: false },
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
    throw error;
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

// Export avec vérification finale
console.log("📦 Export des modèles...");
console.log("   Modèles disponibles:", {
  User: !!User,
  Quiz: !!Quiz,
  Session: !!Session,
});

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
