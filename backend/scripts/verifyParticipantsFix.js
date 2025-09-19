// Script de vérification des corrections - backend/scripts/verifyParticipantsFix.js

const axios = require("axios");

const API_BASE_URL = "http://localhost:3001/api";
const TEST_SESSION_CODE = "JW2CSK"; // Utiliser votre code de session

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
});

async function verifyFix() {
  console.log("🔧 === VÉRIFICATION DES CORRECTIONS ===\n");

  try {
    // 1. État initial
    console.log("1️⃣ Récupération état initial...");
    const initialResponse = await api.get(`/session/code/${TEST_SESSION_CODE}`);
    const initialSession = initialResponse.data.session;

    console.log("📊 État initial:", {
      sessionId: initialSession.id,
      sessionCode: initialSession.code,
      participantCount: initialSession.participantCount,
    });

    // 2. Test ajout avec nom unique
    console.log("\n2️⃣ Test ajout participant...");
    const uniqueName = `TestFix_${Date.now().toString().slice(-8)}`;

    console.log(`👤 Ajout: "${uniqueName}"`);

    const joinResponse = await api.post(`/session/${initialSession.id}/join`, {
      participantName: uniqueName,
      isAnonymous: false,
    });

    console.log("📝 Réponse JOIN:", {
      success: joinResponse.data.success,
      participantId: joinResponse.data.participant?.id,
      participantName: joinResponse.data.participant?.name,
      sessionParticipantCount: joinResponse.data.session?.participantCount,
    });

    // ⚠️ POINT CRITIQUE : La réponse doit montrer participantCount > 0
    if (joinResponse.data.session?.participantCount > 0) {
      console.log("✅ SUCCESS: participantCount dans la réponse > 0");
    } else {
      console.log("❌ ÉCHEC: participantCount dans la réponse = 0");
    }

    // 3. Vérification indépendante
    console.log("\n3️⃣ Vérification indépendante...");
    const verifyResponse = await api.get(`/session/code/${TEST_SESSION_CODE}`);
    const verifySession = verifyResponse.data.session;

    console.log("📊 État après ajout:", {
      participantCount: verifySession.participantCount,
      différence:
        verifySession.participantCount - initialSession.participantCount,
    });

    // 4. Test persistance
    console.log("\n4️⃣ Test persistance (attendre 2s)...");
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const persistenceResponse = await api.get(
      `/session/code/${TEST_SESSION_CODE}`
    );
    const persistenceSession = persistenceResponse.data.session;

    console.log("💾 Persistance:", {
      participantCount: persistenceSession.participantCount,
      stable:
        persistenceSession.participantCount === verifySession.participantCount,
    });

    // 5. Test multiple participants
    console.log("\n5️⃣ Test ajout multiple...");
    const secondName = `TestFix2_${Date.now().toString().slice(-8)}`;

    const secondJoinResponse = await api.post(
      `/session/${initialSession.id}/join`,
      {
        participantName: secondName,
        isAnonymous: true,
      }
    );

    console.log("📝 Second participant:", {
      participantId: secondJoinResponse.data.participant?.id,
      sessionParticipantCount:
        secondJoinResponse.data.session?.participantCount,
    });

    // 6. Vérification finale
    console.log("\n6️⃣ Vérification finale...");
    const finalResponse = await api.get(`/session/code/${TEST_SESSION_CODE}`);
    const finalSession = finalResponse.data.session;

    const totalAdded =
      finalSession.participantCount - initialSession.participantCount;

    console.log("🎯 Résultat final:", {
      participantCountInitial: initialSession.participantCount,
      participantCountFinal: finalSession.participantCount,
      participantsAjoutés: totalAdded,
      attendu: 2,
      statut:
        totalAdded === 2
          ? "✅ SUCCESS COMPLET"
          : totalAdded === 1
          ? "⚠️ PARTIEL"
          : "❌ ÉCHEC",
    });

    // 7. Test gestion erreurs
    console.log("\n7️⃣ Test gestion erreurs...");

    // Nom dupliqué
    try {
      await api.post(`/session/${initialSession.id}/join`, {
        participantName: uniqueName, // Même nom
      });
      console.log("❌ Devrait échouer pour nom dupliqué");
    } catch (error) {
      if (error.response?.status === 409) {
        console.log("✅ Erreur 409 correcte pour nom dupliqué");
      } else {
        console.log("⚠️ Erreur inattendue:", error.response?.status);
      }
    }

    // Test récupération avec participants
    console.log("\n8️⃣ Test récupération détails...");
    try {
      const detailsResponse = await api.get(`/session/${initialSession.id}`);

      console.log("📋 Détails session:", {
        hasParticipants: !!detailsResponse.data.session.participants,
        participantsLength:
          detailsResponse.data.session.participants?.length || 0,
        participantCount: detailsResponse.data.session.participantCount,
        coherent:
          (detailsResponse.data.session.participants?.length || 0) ===
          detailsResponse.data.session.participantCount,
      });
    } catch (detailsError) {
      console.log("⚠️ Accès détails limité (authentification)");
    }

    console.log("\n🎉 === VÉRIFICATION TERMINÉE ===");
  } catch (error) {
    console.error("\n💥 === ERREUR VÉRIFICATION ===");
    console.error("Message:", error.message);

    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
    }
  }
}

async function cleanupTestParticipants() {
  console.log("\n🧹 === NETTOYAGE PARTICIPANTS TEST ===");

  // Note: Cette fonction nécessiterait un endpoint admin pour supprimer les participants de test
  // Ou une méthode directe en base de données
  console.log("⚠️ Nettoyage manuel requis pour les participants de test");
}

async function debugSessionDirect(sessionId) {
  console.log(`\n🔍 === DEBUG DIRECT SESSION ${sessionId} ===`);

  try {
    const response = await api.get(`/session/${sessionId}`);
    const session = response.data.session;

    console.log("📋 Debug session:", {
      id: session.id,
      code: session.code,
      status: session.status,
      participantCount: session.participantCount,
      hasParticipantsArray: !!session.participants,
      participantsType: typeof session.participants,
      participantsLength: session.participants?.length || 0,
      rawParticipants: session.participants,
    });
  } catch (error) {
    console.error("Erreur debug:", error.response?.data || error.message);
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args[0] === "debug" && args[1]) {
    debugSessionDirect(args[1]);
  } else if (args[0] === "cleanup") {
    cleanupTestParticipants();
  } else {
    verifyFix();
  }
}

module.exports = { verifyFix, debugSessionDirect };
