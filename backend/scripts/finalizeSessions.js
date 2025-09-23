// backend/scripts/finalizeSessions.js

const { Session, Quiz } = require("../models");

async function finalizeActiveSessions() {
  console.log("🏁 === FINALISATION DES SESSIONS ===\n");

  try {
    // Rechercher les sessions actives qui devraient être finalisées
    const activeSessions = await Session.findAll({
      where: {
        status: ["active", "paused"]
      },
      include: [{ model: Quiz, as: "quiz" }],
    });

    console.log(`📊 ${activeSessions.length} sessions actives trouvées`);

    for (const session of activeSessions) {
      console.log(`\n🔄 Traitement session ${session.code} (${session.id})`);
      
      // Vérifier si la session a des participants et des réponses
      const participants = Array.isArray(session.participants) ? session.participants : [];
      const responses = session.responses || {};
      
      console.log(`   Participants: ${participants.length}`);
      console.log(`   Questions avec réponses: ${Object.keys(responses).length}`);

      if (participants.length > 0 && Object.keys(responses).length > 0) {
        // Recalculer les stats des participants
        const updatedParticipants = participants.map(participant => {
          let score = 0;
          let correctAnswers = 0;
          let totalQuestions = 0;
          let totalTimeSpent = 0;

          // Calculer les stats réelles basées sur les réponses
          Object.keys(responses).forEach(questionId => {
            const questionResponses = responses[questionId];
            if (Array.isArray(questionResponses)) {
              const participantResponse = questionResponses.find(r => r.participantId === participant.id);
              if (participantResponse) {
                score += participantResponse.points || 0;
                if (participantResponse.isCorrect) correctAnswers++;
                totalQuestions++;
                totalTimeSpent += participantResponse.timeSpent || 0;
              }
            }
          });

          return {
            ...participant,
            score,
            correctAnswers,
            totalQuestions,
            totalTimeSpent,
          };
        });

        // Calculer les stats de session
        const sessionStats = {
          totalParticipants: updatedParticipants.length,
          activeParticipants: updatedParticipants.length,
          totalResponses: Object.keys(responses).reduce((total, questionId) => {
            return total + (responses[questionId]?.length || 0);
          }, 0),
          averageScore: updatedParticipants.length > 0 
            ? Math.round(updatedParticipants.reduce((sum, p) => sum + p.score, 0) / updatedParticipants.length * 100) / 100
            : 0,
          totalCorrectAnswers: updatedParticipants.reduce((sum, p) => sum + p.correctAnswers, 0),
          totalQuestionsAnswered: updatedParticipants.reduce((sum, p) => sum + p.totalQuestions, 0),
          accuracyRate: updatedParticipants.reduce((sum, p) => sum + p.totalQuestions, 0) > 0
            ? Math.round((updatedParticipants.reduce((sum, p) => sum + p.correctAnswers, 0) / updatedParticipants.reduce((sum, p) => sum + p.totalQuestions, 0)) * 100)
            : 0,
          participationRate: 100,
          calculatedAt: new Date(),
        };

        // Mettre à jour la session
        await session.update({
          status: "completed",
          endedAt: new Date(),
          participants: updatedParticipants,
          stats: sessionStats
        });

        console.log(`   ✅ Session finalisée avec stats:`);
        console.log(`      - Score moyen: ${sessionStats.averageScore}`);
        console.log(`      - Taux de réussite: ${sessionStats.accuracyRate}%`);
        console.log(`      - Réponses totales: ${sessionStats.totalResponses}`);
      } else {
        console.log(`   ⚠️  Session sans données suffisantes - marquée comme terminée`);
        await session.update({
          status: "finished",
          endedAt: new Date()
        });
      }
    }

    console.log(`\n✅ ${activeSessions.length} sessions traitées`);

  } catch (error) {
    console.error("💥 Erreur lors de la finalisation:", error);
    throw error;
  }
}

// Fonction pour tester les stats d'une session spécifique
async function testSessionStats(sessionId) {
  console.log(`🧪 === TEST STATS SESSION ${sessionId} ===\n`);

  try {
    const session = await Session.findByPk(sessionId, {
      include: [{ model: Quiz, as: "quiz" }],
    });

    if (!session) {
      console.log("❌ Session non trouvée");
      return;
    }

    console.log(`📋 Session: ${session.code} (${session.title})`);
    console.log(`   Status: ${session.status}`);
    
    const participants = Array.isArray(session.participants) ? session.participants : [];
    const responses = session.responses || {};
    
    console.log(`\n👥 Participants (${participants.length}):`);
    participants.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.name}`);
      console.log(`      Score: ${p.score || 0} | Correctes: ${p.correctAnswers || 0}/${p.totalQuestions || 0}`);
    });

    console.log(`\n📝 Réponses par question:`);
    Object.keys(responses).forEach(questionId => {
      const questionResponses = responses[questionId] || [];
      const correctCount = questionResponses.filter(r => r.isCorrect).length;
      console.log(`   ${questionId}: ${questionResponses.length} réponses (${correctCount} correctes)`);
    });

    // Tester les méthodes de résultats
    console.log(`\n🔍 Test des méthodes de résultats:`);
    
    if (participants.length > 0) {
      const firstParticipant = participants[0];
      const participantResults = session.getParticipantResults(firstParticipant.id);
      
      if (participantResults) {
        console.log(`   ✅ getParticipantResults fonctionne:`);
        console.log(`      Participant: ${participantResults.participant.name}`);
        console.log(`      Score: ${participantResults.participant.score}`);
        console.log(`      Précision: ${participantResults.participant.accuracyRate}%`);
        console.log(`      Rang: ${participantResults.rank || 'N/A'}`);
      } else {
        console.log(`   ❌ getParticipantResults a échoué`);
      }
    }

    const comprehensiveResults = session.getComprehensiveResults();
    console.log(`   ✅ getComprehensiveResults:`);
    console.log(`      Participants: ${comprehensiveResults.participants.length}`);
    console.log(`      Questions: ${Object.keys(comprehensiveResults.questionResults).length}`);
    console.log(`      Classement: ${comprehensiveResults.leaderboard.length} participants classés`);

  } catch (error) {
    console.error("💥 Erreur test stats:", error);
  }
}

// Exécution du script
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args[0] === "test" && args[1]) {
    // Test d'une session spécifique
    testSessionStats(args[1])
      .then(() => {
        console.log("\n🎯 Test terminé");
        process.exit(0);
      })
      .catch((error) => {
        console.error("\n💥 Test échoué:", error);
        process.exit(1);
      });
  } else {
    // Finalisation de toutes les sessions
    finalizeActiveSessions()
      .then(() => {
        console.log("\n🎯 Finalisation terminée avec succès");
        process.exit(0);
      })
      .catch((error) => {
        console.error("\n💥 Finalisation échouée:", error);
        process.exit(1);
      });
  }
}

module.exports = {
  finalizeActiveSessions,
  testSessionStats,
};