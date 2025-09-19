// Script de test pour la route join session - backend/scripts/testJoinSession.js

const axios = require("axios");

// Configuration de base
const API_BASE = "http://localhost:3001/api";
const TEST_SESSION_CODE = "JW2CSK"; // Remplacez par un code de session existant

// Helper pour faire des requêtes
const api = axios.create({
  baseURL: API_BASE,
  timeout: 5000,
  headers: {
    "Content-Type": "application/json",
  },
});

async function testJoinSessionFlow() {
  console.log("🧪 === TEST JOIN SESSION FLOW ===\n");

  try {
    // 1. Vérifier qu'une session existe
    console.log("1️⃣ Recherche de session par code...");
    const sessionResponse = await api.get(`/session/code/${TEST_SESSION_CODE}`);

    if (!sessionResponse.data.session) {
      console.error("❌ Aucune session trouvée avec ce code");
      return;
    }

    const session = sessionResponse.data.session;
    console.log("✅ Session trouvée:", {
      id: session.id,
      code: session.code,
      title: session.title,
      status: session.status,
      participantCount: session.participantCount,
      canJoin: session.canJoin,
    });

    if (!session.canJoin) {
      console.error("❌ Session ne peut pas accepter de participants");
      return;
    }

    // 2. Test d'ajout de participant
    console.log("\n2️⃣ Test ajout participant...");
    const participantData = {
      participantName: `TestParticipant_${Date.now()}`,
      isAnonymous: true,
    };

    console.log("📤 Données envoyées:", participantData);

    const joinResponse = await api.post(
      `/session/${session.id}/join`,
      participantData
    );

    console.log("✅ Participant ajouté:", {
      success: joinResponse.data.success,
      participantId: joinResponse.data.participantId,
      participantName: joinResponse.data.participant?.name,
      sessionParticipantCount: joinResponse.data.session?.participantCount,
    });

    // 3. Vérifier que le participant a bien été ajouté
    console.log("\n3️⃣ Vérification ajout...");
    const updatedSessionResponse = await api.get(
      `/session/code/${TEST_SESSION_CODE}`
    );
    const updatedSession = updatedSessionResponse.data.session;

    console.log("✅ Session mise à jour:", {
      participantCount: updatedSession.participantCount,
      différence: updatedSession.participantCount - session.participantCount,
    });

    if (updatedSession.participantCount > session.participantCount) {
      console.log("🎉 SUCCESS: Le participant a bien été ajouté !");
    } else {
      console.log("⚠️  WARNING: Le nombre de participants n'a pas changé");
    }
  } catch (error) {
    console.error("❌ Erreur dans le test:", error.message);

    if (error.response) {
      console.error("📋 Détails erreur:", {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
      });
    }
  }
}

async function testJoinSessionEdgeCases() {
  console.log("\n🧪 === TEST EDGE CASES ===\n");

  try {
    // Test avec session inexistante
    console.log("1️⃣ Test session inexistante...");
    try {
      await api.post("/session/00000000-0000-0000-0000-000000000000/join", {
        participantName: "Test",
      });
      console.log("❌ Devrait avoir échoué");
    } catch (error) {
      if (error.response?.status === 404) {
        console.log("✅ Erreur 404 correcte pour session inexistante");
      } else {
        console.log("⚠️  Erreur inattendue:", error.response?.status);
      }
    }

    // Test avec nom trop court
    console.log("\n2️⃣ Test nom trop court...");
    const sessionResponse = await api.get(`/session/code/${TEST_SESSION_CODE}`);
    const session = sessionResponse.data.session;

    try {
      await api.post(`/session/${session.id}/join`, {
        participantName: "A", // Trop court
      });
      console.log("❌ Devrait avoir échoué");
    } catch (error) {
      if (error.response?.status === 400) {
        console.log("✅ Erreur 400 correcte pour nom trop court");
      } else {
        console.log("⚠️  Erreur inattendue:", error.response?.status);
      }
    }

    // Test avec données manquantes
    console.log("\n3️⃣ Test données manquantes...");
    try {
      await api.post(`/session/${session.id}/join`, {});
      console.log("❌ Devrait avoir échoué");
    } catch (error) {
      if (error.response?.status === 400) {
        console.log("✅ Erreur 400 correcte pour données manquantes");
      } else {
        console.log("⚠️  Erreur inattendue:", error.response?.status);
      }
    }

    console.log("\n🎉 Tests edge cases terminés");
  } catch (error) {
    console.error("❌ Erreur dans les tests edge cases:", error.message);
  }
}

async function showCurrentSessionState() {
  console.log("\n📊 === ÉTAT ACTUEL DE LA SESSION ===\n");

  try {
    const response = await api.get(`/session/code/${TEST_SESSION_CODE}`);
    const session = response.data.session;

    console.log("Session details:", {
      id: session.id,
      code: session.code,
      title: session.title,
      status: session.status,
      participantCount: session.participantCount,
      maxParticipants: session.settings?.maxParticipants,
      canJoin: session.canJoin,
      allowLateJoin: session.settings?.allowLateJoin,
      allowAnonymous: session.settings?.allowAnonymous,
    });
  } catch (error) {
    console.error(
      "❌ Erreur lors de la récupération de l'état:",
      error.message
    );
  }
}

// Fonction principale
async function main() {
  console.log(
    `🚀 Test de l'API Join Session avec le code: ${TEST_SESSION_CODE}\n`
  );

  // Vérifier l'état initial
  await showCurrentSessionState();

  // Test principal
  await testJoinSessionFlow();

  // Tests edge cases
  await testJoinSessionEdgeCases();

  // État final
  await showCurrentSessionState();

  console.log("\n✨ Tests terminés");
}

// Exécuter si appelé directement
if (require.main === module) {
  main();
}

module.exports = {
  testJoinSessionFlow,
  testJoinSessionEdgeCases,
  showCurrentSessionState,
};
