// Script de diagnostic approfondi - backend/scripts/diagnosticParticipants.js

const { sequelize } = require("../config/database");
const { QueryTypes } = require("sequelize");
const axios = require("axios");

const API_BASE_URL = "http://localhost:3001/api";
const TEST_SESSION_CODE = "JW2CSK";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
});

async function diagnosticComplet() {
  console.log("🔬 === DIAGNOSTIC COMPLET PARTICIPANTS ===\n");

  try {
    // 1. Test de connexion DB
    console.log("1️⃣ Test connexion base de données...");
    await sequelize.authenticate();
    console.log("✅ Connexion DB établie");

    // 2. État actuel en base de données
    console.log("\n2️⃣ État actuel en base de données...");
    const [sessionData] = await sequelize.query(
      `SELECT id, code, title, status, participants, settings, createdAt, updatedAt 
       FROM sessions WHERE code = :code`,
      {
        type: QueryTypes.SELECT,
        replacements: { code: TEST_SESSION_CODE },
      }
    );

    if (!sessionData) {
      console.log("❌ Session non trouvée en base");
      return;
    }

    console.log("📊 Données DB brutes:", {
      id: sessionData.id,
      code: sessionData.code,
      status: sessionData.status,
      participantsType: typeof sessionData.participants,
      participantsValue: sessionData.participants,
      settingsType: typeof sessionData.settings,
      lastUpdate: sessionData.updatedAt,
    });

    // 3. Analyse des participants en DB
    console.log("\n3️⃣ Analyse participants en base...");
    let participantsDB = sessionData.participants;

    if (typeof participantsDB === "string") {
      try {
        participantsDB = JSON.parse(participantsDB);
        console.log("✅ Parsing JSON réussi");
      } catch (parseError) {
        console.log("❌ Erreur parsing JSON:", parseError.message);
        participantsDB = null;
      }
    }

    console.log("🔍 Analyse participants:", {
      isArray: Array.isArray(participantsDB),
      length: participantsDB?.length || 0,
      content: participantsDB,
    });

    if (Array.isArray(participantsDB) && participantsDB.length > 0) {
      console.log("👥 Participants trouvés en DB:");
      participantsDB.forEach((p, i) => {
        console.log(
          `   ${i + 1}. ${p?.name || "NO_NAME"} (ID: ${p?.id || "NO_ID"})`
        );
      });
    }

    // 4. Test via API
    console.log("\n4️⃣ Test via API...");
    try {
      const apiResponse = await api.get(`/session/code/${TEST_SESSION_CODE}`);
      const apiSession = apiResponse.data.session;

      console.log("🌐 Données API:", {
        id: apiSession.id,
        code: apiSession.code,
        participantCount: apiSession.participantCount,
        status: apiSession.status,
      });

      console.log("🔄 Comparaison DB vs API:", {
        participantsDB: participantsDB?.length || 0,
        participantCountAPI: apiSession.participantCount,
        coherent: (participantsDB?.length || 0) === apiSession.participantCount,
      });
    } catch (apiError) {
      console.log("❌ Erreur API:", apiError.message);
    }

    // 5. Test ajout direct SQL
    console.log("\n5️⃣ Test ajout direct SQL...");

    const testParticipant = {
      id: `diagnostic_${Date.now()}`,
      name: `DiagTest_${Date.now().toString().slice(-6)}`,
      isAnonymous: false,
      joinedAt: new Date().toISOString(),
      score: 0,
    };

    console.log("👤 Participant test:", testParticipant);

    // Récupérer les participants actuels
    let currentParticipants = participantsDB;
    if (!Array.isArray(currentParticipants)) {
      currentParticipants = [];
    }

    // Ajouter le participant test
    const updatedParticipants = [...currentParticipants, testParticipant];

    console.log("📝 Tentative UPDATE SQL...");
    const [updateResult] = await sequelize.query(
      `UPDATE sessions 
       SET participants = :participants, updatedAt = NOW() 
       WHERE id = :sessionId`,
      {
        type: QueryTypes.UPDATE,
        replacements: {
          sessionId: sessionData.id,
          participants: JSON.stringify(updatedParticipants),
        },
      }
    );

    console.log("📊 Résultat UPDATE:", updateResult);

    // 6. Vérification immédiate
    console.log("\n6️⃣ Vérification immédiate...");
    const [verificationData] = await sequelize.query(
      `SELECT participants FROM sessions WHERE id = :sessionId`,
      {
        type: QueryTypes.SELECT,
        replacements: { sessionId: sessionData.id },
      }
    );

    let verifiedParticipants = verificationData.participants;
    if (typeof verifiedParticipants === "string") {
      verifiedParticipants = JSON.parse(verifiedParticipants);
    }

    console.log("🔍 Vérification SQL:", {
      participantsEnDB: verifiedParticipants?.length || 0,
      testParticipantTrouvé: verifiedParticipants?.find(
        (p) => p.id === testParticipant.id
      )
        ? true
        : false,
      contenu: verifiedParticipants,
    });

    // 7. Test via API après ajout SQL
    console.log("\n7️⃣ Test API après ajout SQL...");
    try {
      const postSQLResponse = await api.get(
        `/session/code/${TEST_SESSION_CODE}`
      );
      const postSQLSession = postSQLResponse.data.session;

      console.log("🌐 API après SQL:", {
        participantCount: postSQLSession.participantCount,
        augmenté:
          postSQLSession.participantCount > apiSession?.participantCount,
      });
    } catch (postSQLError) {
      console.log("❌ Erreur API post-SQL:", postSQLError.message);
    }

    // 8. Test méthode addParticipant via modèle
    console.log("\n8️⃣ Test méthode addParticipant...");

    try {
      // Importer le modèle Session
      const Session = require("../models/Session");

      const sessionInstance = await Session.findByPk(sessionData.id);
      if (sessionInstance) {
        console.log("📦 Instance Session trouvée");

        const modelTestParticipant = {
          id: `model_test_${Date.now()}`,
          name: `ModelTest_${Date.now().toString().slice(-6)}`,
          isAnonymous: false,
        };

        console.log("👤 Test addParticipant:", modelTestParticipant);

        try {
          await sessionInstance.addParticipant(modelTestParticipant);
          console.log("✅ addParticipant réussi");

          // Vérification
          const postAddResponse = await api.get(
            `/session/code/${TEST_SESSION_CODE}`
          );
          console.log("📊 API après addParticipant:", {
            participantCount: postAddResponse.data.session.participantCount,
          });
        } catch (addError) {
          console.log("❌ Erreur addParticipant:", addError.message);
        }
      } else {
        console.log("❌ Instance Session non trouvée");
      }
    } catch (modelError) {
      console.log("❌ Erreur avec le modèle:", modelError.message);
    }

    // 9. Diagnostic des hooks
    console.log("\n9️⃣ Diagnostic des hooks...");

    // Test UPDATE avec différentes options
    const hookTestData = [
      { participants: [], description: "Array vide" },
      {
        participants: [{ id: "test1", name: "Test1" }],
        description: "Un participant",
      },
      {
        participants: JSON.stringify([{ id: "test2", name: "Test2" }]),
        description: "JSON string",
      },
    ];

    for (const testData of hookTestData) {
      console.log(`🧪 Test: ${testData.description}`);

      try {
        const [hookResult] = await sequelize.query(
          `UPDATE sessions SET participants = :participants WHERE id = :sessionId`,
          {
            type: QueryTypes.UPDATE,
            replacements: {
              sessionId: sessionData.id,
              participants:
                typeof testData.participants === "string"
                  ? testData.participants
                  : JSON.stringify(testData.participants),
            },
          }
        );

        // Vérification immédiate
        const [hookVerif] = await sequelize.query(
          `SELECT participants FROM sessions WHERE id = :sessionId`,
          {
            type: QueryTypes.SELECT,
            replacements: { sessionId: sessionData.id },
          }
        );

        let hookParticipants = hookVerif.participants;
        if (typeof hookParticipants === "string") {
          hookParticipants = JSON.parse(hookParticipants);
        }

        console.log(
          `   Résultat: ${
            Array.isArray(hookParticipants)
              ? hookParticipants.length
              : "invalid"
          } participants`
        );
      } catch (hookError) {
        console.log(`   ❌ Erreur: ${hookError.message}`);
      }
    }

    // 10. Bilan diagnostic
    console.log("\n🔟 Bilan diagnostic:");

    const diagnostics = [
      "✅ Connexion DB fonctionnelle",
      `${sessionData ? "✅" : "❌"} Session trouvée en base`,
      `${
        Array.isArray(participantsDB) ? "✅" : "❌"
      } Structure participants valide`,
      "📊 Tests SQL directs effectués",
      "🔧 Tests hooks analysés",
    ];

    diagnostics.forEach((d) => console.log(`   ${d}`));

    console.log("\n💡 Recommandations:");

    if (!Array.isArray(participantsDB)) {
      console.log("   🔧 Réparer la structure participants en base");
    }

    console.log(
      "   🔄 Remplacer les hooks Sequelize par des UPDATE SQL directs"
    );
    console.log(
      "   🎯 Utiliser exclusivement des requêtes SQL brutes pour participants"
    );
    console.log(
      "   📝 Valider chaque modification par une requête SELECT immédiate"
    );
  } catch (error) {
    console.error("\n💥 Erreur diagnostic:", error);
    console.error("Stack:", error.stack);
  }
}

async function reparerSessionSQL() {
  console.log("\n🔧 === RÉPARATION SESSION SQL ===");

  try {
    const [updateResult] = await sequelize.query(
      `UPDATE sessions 
       SET participants = '[]', 
           stats = '{"totalParticipants":0,"totalResponses":0,"averageScore":0,"participationRate":0}',
           updatedAt = NOW()
       WHERE code = :code`,
      {
        type: QueryTypes.UPDATE,
        replacements: { code: TEST_SESSION_CODE },
      }
    );

    console.log("✅ Session réparée - participants réinitialisés");

    // Vérification
    const [verifData] = await sequelize.query(
      `SELECT participants FROM sessions WHERE code = :code`,
      {
        type: QueryTypes.SELECT,
        replacements: { code: TEST_SESSION_CODE },
      }
    );

    console.log("📊 Vérification:", {
      participants: verifData.participants,
      type: typeof verifData.participants,
    });
  } catch (error) {
    console.error("❌ Erreur réparation:", error.message);
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args[0] === "repair") {
    reparerSessionSQL();
  } else {
    diagnosticComplet();
  }
}

module.exports = { diagnosticComplet, reparerSessionSQL };
