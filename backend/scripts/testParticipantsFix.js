const axios = require("axios");

// Configuration
const API_BASE_URL = "http://localhost:3001/api";
const TEST_SESSION_CODE = "JW2CSK"; // Remplacer par un code de session valide

// Instance axios configurée
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

async function testParticipantsFix() {
  console.log("🧪 === TEST CORRECTION PARTICIPANTS VIDES ===\n");

  try {
    // 1. Récupérer l'état initial de la session
    console.log("1️⃣ Récupération état initial...");
    const initialResponse = await api.get(`/session/code/${TEST_SESSION_CODE}`);
    const initialSession = initialResponse.data.session;

    console.log("📊 État initial:", {
      sessionId: initialSession.id,
      sessionCode: initialSession.code,
      title: initialSession.title,
      status: initialSession.status,
      participantCount: initialSession.participantCount,
      canJoin: initialSession.canJoin,
    });

    // 2. Test d'ajout de participant via API
    console.log("\n2️⃣ Test ajout participant via API...");
    const participantName = `TestUser_${Date.now().toString().slice(-6)}`;

    console.log(`👤 Tentative d'ajout: "${participantName}"`);

    const joinResponse = await api.post(`/session/${initialSession.id}/join`, {
      participantName: participantName,
      isAnonymous: false,
    });

    console.log("✅ Réponse JOIN:", {
      success: joinResponse.data.success,
      participantId: joinResponse.data.participant?.id,
      participantName: joinResponse.data.participant?.name,
      sessionParticipantCount: joinResponse.data.session?.participantCount,
    });

    // 3. Vérifier l'état après ajout
    console.log("\n3️⃣ Vérification après ajout...");
    const updatedResponse = await api.get(`/session/code/${TEST_SESSION_CODE}`);
    const updatedSession = updatedResponse.data.session;

    console.log("📊 État après ajout:", {
      participantCount: updatedSession.participantCount,
      différence:
        updatedSession.participantCount - initialSession.participantCount,
    });

    // 4. Test de récupération des détails de session
    console.log("\n4️⃣ Test récupération détails...");
    try {
      // Simuler un utilisateur connecté (remplacer par un vrai token si nécessaire)
      const detailsResponse = await api.get(`/session/${initialSession.id}`);

      console.log("📋 Détails session:", {
        hasParticipants: !!detailsResponse.data.session.participants,
        participantsType: typeof detailsResponse.data.session.participants,
        participantsLength:
          detailsResponse.data.session.participants?.length || 0,
      });

      if (detailsResponse.data.session.participants?.length > 0) {
        console.log("👥 Premier participant:", {
          id: detailsResponse.data.session.participants[0]?.id,
          name: detailsResponse.data.session.participants[0]?.name,
          joinedAt: detailsResponse.data.session.participants[0]?.joinedAt,
        });
      }
    } catch (error) {
      console.log("⚠️ Détails nécessitent une authentification");
    }

    // 5. Test ajout d'un second participant
    console.log("\n5️⃣ Test second participant...");
    const secondParticipantName = `TestUser2_${Date.now()
      .toString()
      .slice(-6)}`;

    const secondJoinResponse = await api.post(
      `/session/${initialSession.id}/join`,
      {
        participantName: secondParticipantName,
        isAnonymous: true,
      }
    );

    console.log("✅ Second participant ajouté:", {
      participantId: secondJoinResponse.data.participant?.id,
      sessionParticipantCount:
        secondJoinResponse.data.session?.participantCount,
    });

    // 6. Vérification finale
    console.log("\n6️⃣ Vérification finale...");
    const finalResponse = await api.get(`/session/code/${TEST_SESSION_CODE}`);
    const finalSession = finalResponse.data.session;

    console.log("🎯 Résultat final:", {
      participantCountInitial: initialSession.participantCount,
      participantCountFinal: finalSession.participantCount,
      participantsAjoutés:
        finalSession.participantCount - initialSession.participantCount,
      statut:
        finalSession.participantCount > initialSession.participantCount
          ? "✅ SUCCESS"
          : "❌ ÉCHEC",
    });

    // 7. Test de gestion des erreurs
    console.log("\n7️⃣ Test gestion erreurs...");

    // Test nom dupliqué
    try {
      await api.post(`/session/${initialSession.id}/join`, {
        participantName: participantName, // Même nom que le premier
        isAnonymous: false,
      });
      console.log("❌ Devrait avoir échoué pour nom dupliqué");
    } catch (error) {
      if (error.response?.status === 409) {
        console.log("✅ Erreur 409 correcte pour nom dupliqué");
      } else {
        console.log("⚠️ Erreur inattendue:", error.response?.status);
      }
    }

    // Test nom trop court
    try {
      await api.post(`/session/${initialSession.id}/join`, {
        participantName: "A", // Trop court
        isAnonymous: false,
      });
      console.log("❌ Devrait avoir échoué pour nom trop court");
    } catch (error) {
      if (error.response?.status === 400) {
        console.log("✅ Erreur 400 correcte pour nom trop court");
      } else {
        console.log("⚠️ Erreur inattendue:", error.response?.status);
      }
    }

    console.log("\n🎉 === TEST TERMINÉ ===");
  } catch (error) {
    console.error("\n💥 === ERREUR DANS LE TEST ===");
    console.error("Message:", error.message);

    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
    }

    if (error.code === "ECONNREFUSED") {
      console.error(
        "🔌 Serveur non accessible. Vérifiez que l'API est démarrée."
      );
    }
  }
}

async function debugSpecificSession(sessionId) {
  console.log(`\n🔍 === DEBUG SESSION ${sessionId} ===\n`);

  try {
    // Récupérer par ID
    const response = await api.get(`/session/${sessionId}`);
    const session = response.data.session;

    console.log("📋 Informations session:", {
      id: session.id,
      code: session.code,
      title: session.title,
      status: session.status,
      participantCount: session.participantCount,
      hasParticipants: !!session.participants,
      participantsType: typeof session.participants,
      participantsIsArray: Array.isArray(session.participants),
      participantsLength: session.participants?.length || 0,
    });

    if (session.participants && session.participants.length > 0) {
      console.log("\n👥 Liste des participants:");
      session.participants.forEach((p, index) => {
        console.log(
          `   ${index + 1}. ${p.name} (ID: ${p.id}) - ${
            p.isAnonymous ? "Anonyme" : "Connecté"
          }`
        );
      });
    } else {
      console.log("\n👥 Aucun participant trouvé");
    }
  } catch (error) {
    console.error(
      "Erreur debug session:",
      error.response?.data || error.message
    );
  }
}

// Exécution
if (require.main === module) {
  // Vérifier les arguments de ligne de commande
  const args = process.argv.slice(2);

  if (args[0] === "debug" && args[1]) {
    debugSpecificSession(args[1]);
  } else {
    testParticipantsFix();
  }
}

module.exports = {
  testParticipantsFix,
  debugSpecificSession,
};
