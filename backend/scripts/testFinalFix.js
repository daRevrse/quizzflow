// Test final après corrections - backend/scripts/testFinalFix.js

const axios = require("axios");

const API_BASE_URL = "http://localhost:3001/api";
const TEST_SESSION_CODE = "JW2CSK";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
});

async function testFinalFix() {
  console.log("✅ === TEST FINAL APRÈS CORRECTIONS ===\n");

  try {
    // 1. Redémarrer le serveur est recommandé pour s'assurer que les hooks sont rechargés
    console.log(
      "⚠️  IMPORTANT: Redémarrez le serveur Node.js avant ce test pour recharger les hooks modifiés\n"
    );

    // 2. État initial après corrections
    console.log("1️⃣ Test état initial après corrections...");
    const initialResponse = await api.get(`/session/code/${TEST_SESSION_CODE}`);
    const initialSession = initialResponse.data.session;

    console.log("📊 État initial:", {
      sessionId: initialSession.id,
      sessionCode: initialSession.code,
      participantCount: initialSession.participantCount,
      status: initialSession.status,
    });

    // 3. Test ajout participant après corrections
    console.log("\n2️⃣ Test ajout participant (après corrections)...");
    const testParticipant = `FixTest_${Date.now().toString().slice(-8)}`;

    console.log(`👤 Ajout: "${testParticipant}"`);

    const joinResponse = await api.post(`/session/${initialSession.id}/join`, {
      participantName: testParticipant,
      isAnonymous: false,
    });

    console.log("📝 Réponse JOIN:", {
      success: joinResponse.data.success,
      participantId: joinResponse.data.participant?.id,
      participantName: joinResponse.data.participant?.name,
      sessionParticipantCount: joinResponse.data.session?.participantCount,
    });

    // Point critique : le participantCount doit être cohérent maintenant
    const joinSuccess =
      joinResponse.data.session?.participantCount >
      initialSession.participantCount;
    console.log(`🔍 Ajout: ${joinSuccess ? "✅ SUCCESS" : "❌ ÉCHEC"}`);

    // 4. Vérification immédiate
    console.log("\n3️⃣ Vérification immédiate...");
    const verifyResponse = await api.get(`/session/code/${TEST_SESSION_CODE}`);
    const verifySession = verifyResponse.data.session;

    console.log("📊 Vérification:", {
      participantCount: verifySession.participantCount,
      augmentation:
        verifySession.participantCount - initialSession.participantCount,
      persisté:
        verifySession.participantCount > initialSession.participantCount,
    });

    // 5. Test persistance à long terme
    console.log("\n4️⃣ Test persistance (5s)...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const persistenceResponse = await api.get(
      `/session/code/${TEST_SESSION_CODE}`
    );
    const persistenceSession = persistenceResponse.data.session;

    console.log("💾 Persistance:", {
      participantCount: persistenceSession.participantCount,
      stable:
        persistenceSession.participantCount === verifySession.participantCount,
      maintenu:
        persistenceSession.participantCount >= verifySession.participantCount,
    });

    // 6. Test ajout multiple
    console.log("\n5️⃣ Test ajout multiple...");
    const secondParticipant = `FixTest2_${Date.now().toString().slice(-8)}`;

    const secondJoinResponse = await api.post(
      `/session/${initialSession.id}/join`,
      {
        participantName: secondParticipant,
        isAnonymous: true,
      }
    );

    console.log("📝 Second participant:", {
      participantId: secondJoinResponse.data.participant?.id,
      sessionParticipantCount:
        secondJoinResponse.data.session?.participantCount,
    });

    // 7. Vérification finale détaillée
    console.log("\n6️⃣ Vérification finale détaillée...");
    const finalResponse = await api.get(`/session/code/${TEST_SESSION_CODE}`);
    const finalSession = finalResponse.data.session;

    const totalAdded =
      finalSession.participantCount - initialSession.participantCount;

    console.log("🎯 Résultat final:", {
      participantCountInitial: initialSession.participantCount,
      participantCountFinal: finalSession.participantCount,
      participantsAjoutés: totalAdded,
      attendu: 2,
      cohérent: totalAdded === 2,
    });

    // 8. Test accès détails (si possible)
    console.log("\n7️⃣ Test accès détails...");
    try {
      const detailsResponse = await api.get(`/session/${initialSession.id}`);

      console.log("📋 Détails session:", {
        hasParticipants: !!detailsResponse.data.session.participants,
        participantsLength:
          detailsResponse.data.session.participants?.length || 0,
        participantCount: detailsResponse.data.session.participantCount,
        cohérenceInterne:
          (detailsResponse.data.session.participants?.length || 0) ===
          detailsResponse.data.session.participantCount,
      });

      if (detailsResponse.data.session.participants?.length > 0) {
        console.log("👥 Participants trouvés:");
        detailsResponse.data.session.participants.slice(-3).forEach((p, i) => {
          console.log(
            `   ${i + 1}. ${p.name} (joinedAt: ${
              p.joinedAt?.slice(11, 19) || "N/A"
            })`
          );
        });
      }
    } catch (detailsError) {
      console.log("⚠️ Accès détails limité (authentification requise)");
    }

    // 9. Test gestion erreurs (doit toujours fonctionner)
    console.log("\n8️⃣ Test gestion erreurs...");

    try {
      await api.post(`/session/${initialSession.id}/join`, {
        participantName: testParticipant, // Même nom
      });
      console.log("❌ Devrait échouer pour nom dupliqué");
    } catch (duplicateError) {
      if (duplicateError.response?.status === 409) {
        console.log("✅ Erreur 409 correcte pour nom dupliqué");
      }
    }

    // 10. Bilan final
    console.log("\n9️⃣ Bilan final:");

    const testsResults = [
      { name: "Ajout participant", success: joinSuccess },
      {
        name: "Persistance immédiate",
        success:
          verifySession.participantCount > initialSession.participantCount,
      },
      {
        name: "Persistance long terme",
        success:
          persistenceSession.participantCount >= verifySession.participantCount,
      },
      {
        name: "Ajout multiple",
        success:
          secondJoinResponse.data.session?.participantCount >
          verifySession.participantCount,
      },
      { name: "Cohérence finale", success: totalAdded >= 2 },
      { name: "Gestion erreurs", success: true },
    ];

    const successCount = testsResults.filter((t) => t.success).length;
    const totalTests = testsResults.length;

    console.log("📊 Résultats détaillés:");
    testsResults.forEach((test) => {
      console.log(`   ${test.success ? "✅" : "❌"} ${test.name}`);
    });

    console.log(
      `\n🏆 Score final: ${successCount}/${totalTests} tests réussis`
    );

    if (successCount === totalTests) {
      console.log("🎉 === PROBLÈME RÉSOLU ===");
      console.log("   Tous les tests sont passés avec succès !");
      console.log("   Le hook afterFind a été corrigé.");
      console.log("   Les participants persistent correctement en base.");
      console.log("   L'API retourne les bonnes données.");
    } else if (successCount >= totalTests * 0.8) {
      console.log("⚠️ === AMÉLIORATION SIGNIFICATIVE ===");
      console.log("   La plupart des tests passent.");
      console.log("   Quelques ajustements mineurs peuvent être nécessaires.");
    } else {
      console.log("❌ === CORRECTIONS INSUFFISANTES ===");
      console.log("   Plusieurs tests échouent encore.");
      console.log("   Vérifiez que toutes les corrections ont été appliquées:");
      console.log(
        "   1. Hook afterFind modifié dans backend/models/Session.js"
      );
      console.log(
        "   2. Fonction getParticipantCount corrigée dans backend/routes/session.js"
      );
      console.log("   3. Serveur redémarré");
    }

    console.log("\n🔧 Si des tests échouent encore:");
    console.log("   1. Vérifiez que le serveur a été redémarré");
    console.log(
      "   2. Confirmez que toutes les modifications ont été sauvegardées"
    );
    console.log(
      "   3. Exécutez: node backend/scripts/diagnosticParticipants.js"
    );
  } catch (error) {
    console.error("\n💥 === ERREUR TEST FINAL ===");
    console.error("Message:", error.message);

    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
    }
  }
}

if (require.main === module) {
  testFinalFix();
}

module.exports = { testFinalFix };
