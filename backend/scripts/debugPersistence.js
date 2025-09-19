// Debug direct du problème de persistance - backend/scripts/debugPersistence.js

const { sequelize } = require("../config/database");
const { QueryTypes } = require("sequelize");

const SESSION_CODE = "JW2CSK";

async function debugPersistenceIssue() {
  console.log("🔬 === DEBUG PERSISTANCE DIRECTE ===\n");

  try {
    // 1. État initial en base pure
    console.log("1️⃣ État initial en base de données...");
    let [session] = await sequelize.query(
      `SELECT id, code, participants, updatedAt FROM sessions WHERE code = ?`,
      {
        type: QueryTypes.SELECT,
        replacements: [SESSION_CODE],
      }
    );

    if (!session) {
      console.log("❌ Session non trouvée");
      return;
    }

    console.log("📊 État initial DB:", {
      id: session.id,
      participantsRaw: session.participants,
      participantsType: typeof session.participants,
      lastUpdate: session.updatedAt,
    });

    // Parse participants
    let initialParticipants = session.participants;
    if (typeof initialParticipants === "string") {
      initialParticipants = JSON.parse(initialParticipants);
    }
    if (!Array.isArray(initialParticipants)) {
      initialParticipants = [];
    }

    console.log(`📋 Participants initiaux: ${initialParticipants.length}`);

    // 2. Test UPDATE SQL direct avec surveillance
    console.log("\n2️⃣ Test UPDATE SQL avec surveillance...");

    const testParticipant = {
      id: `debug_${Date.now()}`,
      name: `DebugTest_${Date.now().toString().slice(-6)}`,
      joinedAt: new Date().toISOString(),
      score: 0,
    };

    const newParticipants = [...initialParticipants, testParticipant];

    console.log("👤 Ajout participant test:", testParticipant.name);
    console.log(`📊 Nouveau total attendu: ${newParticipants.length}`);

    // UPDATE avec monitoring détaillé
    console.log("\n📝 Exécution UPDATE...");
    const updateStart = Date.now();

    const [updateResult] = await sequelize.query(
      `UPDATE sessions 
       SET participants = ?, updatedAt = NOW() 
       WHERE id = ?`,
      {
        type: QueryTypes.UPDATE,
        replacements: [JSON.stringify(newParticipants), session.id],
      }
    );

    const updateEnd = Date.now();
    console.log(`⏱️ UPDATE exécuté en ${updateEnd - updateStart}ms`);
    console.log("📊 Résultat UPDATE:", updateResult);

    // 3. Vérification immédiate (avant commit)
    console.log("\n3️⃣ Vérification immédiate...");

    const [immediateCheck] = await sequelize.query(
      `SELECT participants, updatedAt FROM sessions WHERE id = ?`,
      {
        type: QueryTypes.SELECT,
        replacements: [session.id],
      }
    );

    let immediateParticipants = immediateCheck.participants;
    if (typeof immediateParticipants === "string") {
      immediateParticipants = JSON.parse(immediateParticipants);
    }

    console.log("🔍 Vérification immédiate:", {
      participantsCount: Array.isArray(immediateParticipants)
        ? immediateParticipants.length
        : "invalid",
      updateTime: immediateCheck.updatedAt,
      testParticipantPresent:
        Array.isArray(immediateParticipants) &&
        immediateParticipants.find((p) => p.id === testParticipant.id)
          ? true
          : false,
    });

    // 4. Attendre et re-vérifier
    console.log("\n4️⃣ Attendre 2s et re-vérifier...");
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const [delayedCheck] = await sequelize.query(
      `SELECT participants, updatedAt FROM sessions WHERE id = ?`,
      {
        type: QueryTypes.SELECT,
        replacements: [session.id],
      }
    );

    let delayedParticipants = delayedCheck.participants;
    if (typeof delayedParticipants === "string") {
      delayedParticipants = JSON.parse(delayedParticipants);
    }

    console.log("🕐 Vérification différée:", {
      participantsCount: Array.isArray(delayedParticipants)
        ? delayedParticipants.length
        : "invalid",
      updateTime: delayedCheck.updatedAt,
      identique:
        JSON.stringify(immediateParticipants) ===
        JSON.stringify(delayedParticipants),
    });

    // 5. Test avec Sequelize pour comparaison
    console.log("\n5️⃣ Test avec Sequelize...");

    const Session = require("../models/Session");
    const sessionInstance = await Session.findByPk(session.id);

    if (sessionInstance) {
      console.log("📦 Instance Sequelize:", {
        participantsType: typeof sessionInstance.participants,
        participantsLength: Array.isArray(sessionInstance.participants)
          ? sessionInstance.participants.length
          : "invalid",
        participants: sessionInstance.participants,
      });

      // Test reload
      await sessionInstance.reload();
      console.log("🔄 Après reload:", {
        participantsLength: Array.isArray(sessionInstance.participants)
          ? sessionInstance.participants.length
          : "invalid",
      });
    }

    // 6. Test transaction explicite
    console.log("\n6️⃣ Test avec transaction explicite...");

    const transaction = await sequelize.transaction();

    try {
      const testParticipant2 = {
        id: `transaction_${Date.now()}`,
        name: `TransTest_${Date.now().toString().slice(-6)}`,
        joinedAt: new Date().toISOString(),
        score: 0,
      };

      const transactionParticipants = [
        ...(Array.isArray(delayedParticipants) ? delayedParticipants : []),
        testParticipant2,
      ];

      await sequelize.query(
        `UPDATE sessions SET participants = ?, updatedAt = NOW() WHERE id = ?`,
        {
          type: QueryTypes.UPDATE,
          replacements: [JSON.stringify(transactionParticipants), session.id],
          transaction,
        }
      );

      // Vérification avant commit
      const [preCommitCheck] = await sequelize.query(
        `SELECT participants FROM sessions WHERE id = ?`,
        {
          type: QueryTypes.SELECT,
          replacements: [session.id],
          transaction,
        }
      );

      let preCommitParticipants = preCommitCheck.participants;
      if (typeof preCommitParticipants === "string") {
        preCommitParticipants = JSON.parse(preCommitParticipants);
      }

      console.log("📝 Avant commit:", {
        participantsCount: Array.isArray(preCommitParticipants)
          ? preCommitParticipants.length
          : "invalid",
      });

      await transaction.commit();
      console.log("✅ Transaction commitée");

      // Vérification après commit
      const [postCommitCheck] = await sequelize.query(
        `SELECT participants FROM sessions WHERE id = ?`,
        {
          type: QueryTypes.SELECT,
          replacements: [session.id],
        }
      );

      let postCommitParticipants = postCommitCheck.participants;
      if (typeof postCommitParticipants === "string") {
        postCommitParticipants = JSON.parse(postCommitParticipants);
      }

      console.log("📝 Après commit:", {
        participantsCount: Array.isArray(postCommitParticipants)
          ? postCommitParticipants.length
          : "invalid",
      });
    } catch (transactionError) {
      await transaction.rollback();
      console.log("❌ Transaction rollback:", transactionError.message);
    }

    // 7. Analyse des logs MySQL
    console.log("\n7️⃣ Analyse des modifications récentes...");

    const [recentUpdates] = await sequelize.query(`SHOW PROCESSLIST`, {
      type: QueryTypes.SELECT,
    });

    console.log("📊 Processus MySQL actifs:", recentUpdates.length);

    // 8. Test avec différents formats JSON
    console.log("\n8️⃣ Test formats JSON...");

    const formatTests = [
      { format: "Array direct", data: [{ id: "test1", name: "Test1" }] },
      { format: "JSON string", data: '[{"id":"test2","name":"Test2"}]' },
      { format: "Empty array", data: [] },
    ];

    for (const test of formatTests) {
      console.log(`🧪 Test format: ${test.format}`);

      try {
        await sequelize.query(
          `UPDATE sessions SET participants = ? WHERE id = ?`,
          {
            type: QueryTypes.UPDATE,
            replacements: [
              typeof test.data === "string"
                ? test.data
                : JSON.stringify(test.data),
              session.id,
            ],
          }
        );

        const [formatCheck] = await sequelize.query(
          `SELECT participants FROM sessions WHERE id = ?`,
          {
            type: QueryTypes.SELECT,
            replacements: [session.id],
          }
        );

        let formatParticipants = formatCheck.participants;
        if (typeof formatParticipants === "string") {
          try {
            formatParticipants = JSON.parse(formatParticipants);
          } catch (e) {
            formatParticipants = "PARSE_ERROR";
          }
        }

        console.log(
          `   Résultat: ${
            Array.isArray(formatParticipants)
              ? formatParticipants.length + " participants"
              : formatParticipants
          }`
        );
      } catch (formatError) {
        console.log(`   ❌ Erreur: ${formatError.message}`);
      }
    }

    // 9. Bilan diagnostic
    console.log("\n9️⃣ Bilan diagnostic:");
    console.log("📊 Observations clés:");
    console.log("   - Les UPDATE SQL s'exécutent sans erreur");
    console.log(
      "   - Les vérifications immédiates peuvent montrer le changement"
    );
    console.log("   - La persistance peut échouer entre les requêtes");
    console.log("   - Possible conflit entre Sequelize et SQL direct");

    console.log("\n💡 Hypothèses probables:");
    console.log("   1. Hook Sequelize qui s'exécute en arrière-plan");
    console.log("   2. Constraint ou trigger MySQL");
    console.log("   3. Problème de format JSON dans MySQL");
    console.log("   4. Isolation de transaction");
  } catch (error) {
    console.error("\n💥 Erreur debug:", error);
    console.error("Stack:", error.stack);
  }
}

if (require.main === module) {
  debugPersistenceIssue();
}

module.exports = { debugPersistenceIssue };
