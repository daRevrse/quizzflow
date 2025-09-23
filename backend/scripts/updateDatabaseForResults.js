// backend/scripts/simpleDatabaseFix.js

const { sequelize } = require("../config/database");

async function simpleDatabaseFix() {
  console.log("🔄 === CORRECTION SIMPLE DE LA BASE DE DONNÉES ===\n");

  try {
    await sequelize.authenticate();
    console.log("✅ Connexion à la base de données établie");

    // 1. Récupérer toutes les sessions
    console.log("\n1️⃣ Récupération des sessions...");
    
    const sessions = await sequelize.query(
      `SELECT id, participants, responses, stats FROM sessions WHERE participants IS NOT NULL`,
      { type: sequelize.QueryTypes.SELECT }
    );

    console.log(`📊 ${sessions.length} sessions trouvées`);

    // 2. Corriger chaque session
    console.log("\n2️⃣ Correction des sessions...");
    
    let fixedSessions = 0;

    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];
      console.log(`\n📋 Session ${i + 1}/${sessions.length} (ID: ${session.id})`);

      try {
        // Parser les participants
        let participants = [];
        if (session.participants) {
          if (typeof session.participants === 'string') {
            participants = JSON.parse(session.participants);
          } else {
            participants = session.participants;
          }
        }

        // S'assurer que c'est un tableau
        if (!Array.isArray(participants)) {
          console.log("   ⚠️ Participants n'est pas un tableau, correction...");
          participants = [];
        }

        // Parser les réponses
        let responses = {};
        if (session.responses) {
          if (typeof session.responses === 'string') {
            responses = JSON.parse(session.responses);
          } else {
            responses = session.responses;
          }
        }

        // S'assurer que c'est un objet
        if (!responses || typeof responses !== 'object') {
          console.log("   ⚠️ Responses n'est pas un objet, correction...");
          responses = {};
        }

        // Corriger les participants
        let participantsFixed = false;
        const correctedParticipants = participants.map(participant => {
          if (!participant || typeof participant !== 'object') {
            return participant;
          }

          const corrected = { ...participant };

          // Ajouter les champs manquants
          if (typeof corrected.score !== 'number') {
            corrected.score = 0;
            participantsFixed = true;
          }

          if (typeof corrected.correctAnswers !== 'number') {
            corrected.correctAnswers = 0;
            participantsFixed = true;
          }

          if (typeof corrected.totalQuestions !== 'number') {
            corrected.totalQuestions = 0;
            participantsFixed = true;
          }

          if (typeof corrected.totalTimeSpent !== 'number') {
            corrected.totalTimeSpent = 0;
            participantsFixed = true;
          }

          if (!corrected.responses || typeof corrected.responses !== 'object') {
            corrected.responses = {};
            participantsFixed = true;
          }

          return corrected;
        });

        // Corriger les réponses (s'assurer que chaque question a un tableau)
        let responsesFixed = false;
        Object.keys(responses).forEach(questionId => {
          if (!Array.isArray(responses[questionId])) {
            console.log(`   🔧 Question ${questionId}: conversion en tableau`);
            responses[questionId] = [];
            responsesFixed = true;
          }
        });

        // Recalculer les stats des participants basées sur les réponses
        const updatedParticipants = correctedParticipants.map(participant => {
          if (!participant || !participant.id) return participant;

          let score = 0;
          let correctAnswers = 0;
          let totalQuestions = 0;
          let totalTimeSpent = 0;

          // Parcourir toutes les réponses pour ce participant
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
        const stats = calculateSessionStats(updatedParticipants, responses);

        // Mettre à jour la session si nécessaire
        if (participantsFixed || responsesFixed || !session.stats) {
          await sequelize.query(
            `UPDATE sessions 
             SET participants = ?, 
                 responses = ?,
                 stats = ?,
                 updatedAt = NOW()
             WHERE id = ?`,
            {
              replacements: [
                JSON.stringify(updatedParticipants),
                JSON.stringify(responses),
                JSON.stringify(stats),
                session.id
              ],
              type: sequelize.QueryTypes.UPDATE
            }
          );

          console.log(`   ✅ Session mise à jour`);
          fixedSessions++;
        } else {
          console.log(`   ℹ️ Session OK, pas de modification nécessaire`);
        }

      } catch (sessionError) {
        console.error(`   ❌ Erreur session ${session.id}:`, sessionError.message);
      }
    }

    console.log(`\n✅ ${fixedSessions} sessions corrigées sur ${sessions.length}`);

    // 3. Validation finale
    console.log("\n3️⃣ Validation finale...");
    
    const validationResults = await sequelize.query(`
      SELECT 
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN participants IS NOT NULL AND participants != '[]' THEN 1 END) as sessions_with_participants,
        COUNT(CASE WHEN responses IS NOT NULL AND responses != '{}' THEN 1 END) as sessions_with_responses,
        COUNT(CASE WHEN stats IS NOT NULL THEN 1 END) as sessions_with_stats
      FROM sessions
    `, { type: sequelize.QueryTypes.SELECT });

    const result = validationResults[0];

    console.log("📊 Résultats finaux:");
    console.log(`   Sessions totales: ${result.total_sessions}`);
    console.log(`   Sessions avec participants: ${result.sessions_with_participants}`);
    console.log(`   Sessions avec réponses: ${result.sessions_with_responses}`);
    console.log(`   Sessions avec stats: ${result.sessions_with_stats}`);

    console.log("\n🎉 Correction terminée avec succès !");

  } catch (error) {
    console.error("💥 Erreur lors de la correction:", error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Fonction simplifiée pour calculer les stats (au cas où l'import ne marche pas)
function calculateSessionStats(participants, responses) {
  const participantsArray = Array.isArray(participants) ? participants : [];
  const responsesObj = responses || {};

  const totalParticipants = participantsArray.length;
  const totalResponses = Object.keys(responsesObj).reduce((total, questionId) => {
    return total + (responsesObj[questionId]?.length || 0);
  }, 0);

  let totalScore = 0;
  let activeParticipants = 0;
  let totalCorrectAnswers = 0;
  let totalQuestionsAnswered = 0;

  participantsArray.forEach(participant => {
    if (participant && typeof participant === 'object') {
      const score = participant.score || 0;
      const correctAnswers = participant.correctAnswers || 0;
      const totalQuestions = participant.totalQuestions || 0;

      if (typeof score === 'number' && !isNaN(score)) {
        totalScore += score;
        activeParticipants++;
      }

      totalCorrectAnswers += correctAnswers;
      totalQuestionsAnswered += totalQuestions;
    }
  });

  const averageScore = activeParticipants > 0 
    ? Math.round((totalScore / activeParticipants) * 100) / 100 
    : 0;

  const participationRate = totalParticipants > 0 
    ? Math.round((activeParticipants / totalParticipants) * 100) 
    : 0;

  const accuracyRate = totalQuestionsAnswered > 0 
    ? Math.round((totalCorrectAnswers / totalQuestionsAnswered) * 100) 
    : 0;

  return {
    totalParticipants,
    activeParticipants,
    totalResponses,
    averageScore,
    accuracyRate,
    participationRate,
    totalCorrectAnswers,
    totalQuestionsAnswered,
    calculatedAt: new Date(),
  };
}

// Exécution du script
if (require.main === module) {
  simpleDatabaseFix()
    .then(() => {
      console.log("\n🎯 Script terminé avec succès");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Script échoué:", error);
      process.exit(1);
    });
}

module.exports = { simpleDatabaseFix };