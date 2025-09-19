// Script de test des modèles - backend/scripts/testModels.js

console.log("🧪 === TEST DES MODÈLES SEQUELIZE ===\n");

// Test d'import de la base de données
try {
  console.log("1️⃣  Test import database config...");
  const { sequelize } = require("../config/database");
  console.log("✅ Database config importé");
  console.log(`   Dialect: ${sequelize.getDialect()}`);
  console.log(`   Database: ${sequelize.config.database}`);
} catch (error) {
  console.error("❌ Erreur import database:", error.message);
  process.exit(1);
}

// Test d'import des modèles individuels
const testIndividualModels = () => {
  console.log("\n2️⃣  Test import modèles individuels...");

  try {
    console.log("   🔍 Import User...");
    const User = require("../models/User");
    console.log("   ✅ User importé");
    console.log(`      Type: ${typeof User}`);
    console.log(`      Name: ${User.name}`);
    console.log(`      hasMany: ${typeof User.hasMany}`);
    console.log(`      sequelize: ${!!User.sequelize}`);

    console.log("\n   🔍 Import Quiz...");
    const Quiz = require("../models/Quiz");
    console.log("   ✅ Quiz importé");
    console.log(`      Type: ${typeof Quiz}`);
    console.log(`      Name: ${Quiz.name}`);
    console.log(`      hasMany: ${typeof Quiz.hasMany}`);
    console.log(`      sequelize: ${!!Quiz.sequelize}`);

    console.log("\n   🔍 Import Session...");
    const Session = require("../models/Session");
    console.log("   ✅ Session importé");
    console.log(`      Type: ${typeof Session}`);
    console.log(`      Name: ${Session.name}`);
    console.log(`      hasMany: ${typeof Session.hasMany}`);
    console.log(`      sequelize: ${!!Session.sequelize}`);

    return { User, Quiz, Session };
  } catch (error) {
    console.error("❌ Erreur import modèles individuels:", error.message);
    console.error("Stack:", error.stack);
    process.exit(1);
  }
};

// Test d'import via index.js
const testModelsIndex = () => {
  console.log("\n3️⃣  Test import via models/index.js...");

  try {
    // Avant d'importer index.js, vérifier les modèles individuels
    const individualModels = testIndividualModels();

    console.log("\n   🔍 Import models/index.js...");
    const modelsIndex = require("../models/index");
    console.log("   ✅ models/index.js importé");

    console.log("\n   📊 Contenu de l'export:");
    console.log(`      sequelize: ${!!modelsIndex.sequelize}`);
    console.log(
      `      User: ${typeof modelsIndex.User} (${modelsIndex.User?.name})`
    );
    console.log(
      `      Quiz: ${typeof modelsIndex.Quiz} (${modelsIndex.Quiz?.name})`
    );
    console.log(
      `      Session: ${typeof modelsIndex.Session} (${
        modelsIndex.Session?.name
      })`
    );
    console.log(`      models object: ${!!modelsIndex.models}`);

    // Vérifier si les modèles sont les mêmes
    console.log("\n   🔄 Comparaison des exports:");
    console.log(
      `      User identique: ${individualModels.User === modelsIndex.User}`
    );
    console.log(
      `      Quiz identique: ${individualModels.Quiz === modelsIndex.Quiz}`
    );
    console.log(
      `      Session identique: ${
        individualModels.Session === modelsIndex.Session
      }`
    );

    return modelsIndex;
  } catch (error) {
    console.error("❌ Erreur import models/index.js:", error.message);
    console.error("Stack:", error.stack);
    return null;
  }
};

// Test de connexion à la base de données
const testDatabaseConnection = async (sequelize) => {
  console.log("\n4️⃣  Test connexion base de données...");

  try {
    await sequelize.authenticate();
    console.log("✅ Connexion à la base de données réussie");

    // Test d'une requête simple
    const [results] = await sequelize.query("SELECT 1 as test");
    console.log("✅ Requête de test réussie:", results[0]);

    return true;
  } catch (error) {
    console.error("❌ Erreur connexion base de données:", error.message);
    return false;
  }
};

// Test des associations
const testAssociations = (models) => {
  console.log("\n5️⃣  Test des associations...");

  try {
    const { User, Quiz, Session } = models;

    // Vérifier les associations User
    console.log("   👤 User associations:");
    const userAssocs = User.associations || {};
    console.log(`      quizzes: ${!!userAssocs.quizzes}`);
    console.log(`      hostedSessions: ${!!userAssocs.hostedSessions}`);

    // Vérifier les associations Quiz
    console.log("\n   📋 Quiz associations:");
    const quizAssocs = Quiz.associations || {};
    console.log(`      creator: ${!!quizAssocs.creator}`);
    console.log(`      sessions: ${!!quizAssocs.sessions}`);

    // Vérifier les associations Session
    console.log("\n   🎯 Session associations:");
    const sessionAssocs = Session.associations || {};
    console.log(`      host: ${!!sessionAssocs.host}`);
    console.log(`      quiz: ${!!sessionAssocs.quiz}`);

    const totalAssocs =
      Object.keys(userAssocs).length +
      Object.keys(quizAssocs).length +
      Object.keys(sessionAssocs).length;

    console.log(`\n   📊 Total associations: ${totalAssocs}`);

    if (totalAssocs >= 6) {
      console.log("✅ Toutes les associations semblent être définies");
      return true;
    } else {
      console.log("⚠️  Certaines associations semblent manquer");
      return false;
    }
  } catch (error) {
    console.error("❌ Erreur test associations:", error.message);
    return false;
  }
};

// Test de requête sur les sessions
const testSessionQuery = async (Session) => {
  console.log("\n6️⃣  Test requête Session...");

  try {
    const sessionCount = await Session.count();
    console.log(`✅ Nombre de sessions: ${sessionCount}`);

    if (sessionCount > 0) {
      const firstSession = await Session.findOne({
        order: [["createdAt", "DESC"]],
      });

      console.log("✅ Première session trouvée:");
      console.log(`   ID: ${firstSession.id}`);
      console.log(`   Code: ${firstSession.code}`);
      console.log(`   Titre: ${firstSession.title}`);
      console.log(
        `   Participants: ${typeof firstSession.participants} (${
          Array.isArray(firstSession.participants)
            ? firstSession.participants.length
            : "N/A"
        })`
      );
    }

    return true;
  } catch (error) {
    console.error("❌ Erreur requête Session:", error.message);
    return false;
  }
};

// Fonction principale
async function main() {
  try {
    // Import des modèles
    const models = testModelsIndex();

    if (!models) {
      console.log("\n💥 Impossible de continuer sans les modèles");
      process.exit(1);
    }

    // Test de connexion
    const connectionOk = await testDatabaseConnection(models.sequelize);
    if (!connectionOk) {
      console.log("\n💥 Impossible de continuer sans connexion DB");
      process.exit(1);
    }

    // Test des associations
    const associationsOk = testAssociations(models);

    // Test de requête
    const queryOk = await testSessionQuery(models.Session);

    // Résumé
    console.log("\n🎯 === RÉSUMÉ DES TESTS ===");
    console.log(`✅ Import modèles: ${!!models}`);
    console.log(`✅ Connexion DB: ${connectionOk}`);
    console.log(
      `${associationsOk ? "✅" : "⚠️ "} Associations: ${
        associationsOk ? "OK" : "Partielles"
      }`
    );
    console.log(`✅ Requêtes: ${queryOk}`);

    if (models && connectionOk && associationsOk && queryOk) {
      console.log(
        "\n🎉 Tous les tests sont passés ! Les modèles fonctionnent correctement."
      );

      // Test bonus: créer une session de test pour vérifier le participant count
      console.log("\n7️⃣  Bonus: Test création session...");
      try {
        // Vérifier s'il y a des utilisateurs et des quiz
        const userCount = await models.User.count();
        const quizCount = await models.Quiz.count();

        console.log(`   Utilisateurs disponibles: ${userCount}`);
        console.log(`   Quiz disponibles: ${quizCount}`);

        if (userCount > 0 && quizCount > 0) {
          const user = await models.User.findOne();
          const quiz = await models.Quiz.findOne();

          console.log(`   Test avec utilisateur: ${user.username}`);
          console.log(`   Test avec quiz: ${quiz.title}`);

          // Les modèles sont prêts pour être utilisés
          console.log("✅ Environnement prêt pour les tests avec participants");
        } else {
          console.log(
            "ℹ️  Pas d'utilisateurs ou de quiz pour les tests complets"
          );
        }
      } catch (error) {
        console.log("⚠️  Erreur test bonus:", error.message);
      }
    } else {
      console.log("\n❌ Certains tests ont échoué. Vérifiez la configuration.");
      process.exit(1);
    }

    console.log("\n✨ Tests terminés avec succès !");
    process.exit(0);
  } catch (error) {
    console.error("\n💥 Erreur fatale dans les tests:", error);
    console.error("Stack:", error.stack);
    process.exit(1);
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  main();
}

module.exports = {
  testIndividualModels,
  testModelsIndex,
  testDatabaseConnection,
  testAssociations,
  testSessionQuery,
};
