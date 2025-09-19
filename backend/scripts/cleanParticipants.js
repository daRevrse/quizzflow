// Script de nettoyage participants corrigé - backend/scripts/cleanParticipants.js

// Import corrigé pour éviter les problèmes de dépendances circulaires
const { sequelize } = require("../config/database");

// Import direct des modèles sans passer par index.js pour éviter les associations
const User = require("../models/User");
const Quiz = require("../models/Quiz");
const Session = require("../models/Session");

console.log("📦 Modèles importés:");
console.log("   User:", typeof User, "- hasMany:", typeof User.hasMany);
console.log("   Quiz:", typeof Quiz, "- hasMany:", typeof Quiz.hasMany);
console.log(
  "   Session:",
  typeof Session,
  "- hasMany:",
  typeof Session.hasMany
);

async function cleanParticipantsData() {
  console.log("🧹 === DÉBUT NETTOYAGE PARTICIPANTS ===");

  try {
    // Test de connexion à la base
    await sequelize.authenticate();
    console.log("✅ Connexion à la base de données établie");

    // Récupérer toutes les sessions directement avec une requête SQL brute
    const [sessions] = await sequelize.query(`
      SELECT id, code, title, participants, status 
      FROM sessions 
      ORDER BY createdAt DESC
    `);

    console.log(`📊 ${sessions.length} sessions trouvées`);

    let fixedCount = 0;
    let duplicatesRemoved = 0;
    let totalParticipantsBefore = 0;
    let totalParticipantsAfter = 0;

    for (const session of sessions) {
      let needsUpdate = false;
      let participants = session.participants;

      console.log(`\n🔍 Session ${session.code} (${session.title}):`);
      console.log(`   Statut: ${session.status}`);
      console.log(`   Type participants: ${typeof participants}`);
      console.log(`   Valeur brute:`, participants);

      // Cas 1: participants n'est pas un tableau
      if (!Array.isArray(participants)) {
        console.log(`   ❌ Participants n'est pas un array`);

        if (participants === null || participants === undefined) {
          console.log(`   🔧 Valeur null/undefined -> array vide`);
          participants = [];
        } else if (typeof participants === "string") {
          try {
            const parsed = JSON.parse(participants);
            if (Array.isArray(parsed)) {
              console.log(
                `   🔧 String JSON valide -> array de ${parsed.length} éléments`
              );
              participants = parsed;
              totalParticipantsBefore += parsed.length;
            } else {
              console.log(
                `   ❌ String JSON invalide (pas un array) -> array vide`
              );
              participants = [];
            }
          } catch (error) {
            console.log(`   ❌ Erreur parsing JSON -> array vide`);
            participants = [];
          }
        } else if (typeof participants === "object") {
          // Cas où participants est un objet au lieu d'un array
          if (participants.length !== undefined) {
            console.log(`   🔧 Object avec length -> conversion en array`);
            participants = Object.values(participants);
            totalParticipantsBefore += participants.length;
          } else {
            console.log(`   ❌ Object sans length -> array vide`);
            participants = [];
          }
        } else {
          console.log(
            `   ❌ Type non géré (${typeof participants}) -> array vide`
          );
          participants = [];
        }

        needsUpdate = true;
        fixedCount++;
      } else {
        totalParticipantsBefore += participants.length;
      }

      // Cas 2: Nettoyer les participants invalides et doublons
      if (Array.isArray(participants)) {
        const originalLength = participants.length;

        // Filtrer les participants valides
        const validParticipants = participants.filter((p, index) => {
          if (!p || typeof p !== "object") {
            console.log(
              `   ⚠️  Participant invalide à l'index ${index}:`,
              typeof p,
              p
            );
            return false;
          }

          if (!p.id) {
            console.log(`   ⚠️  Participant sans id à l'index ${index}:`, p);
            return false;
          }

          if (
            !p.name ||
            typeof p.name !== "string" ||
            p.name.trim().length === 0
          ) {
            console.log(
              `   ⚠️  Participant sans nom valide à l'index ${index}:`,
              p.name
            );
            return false;
          }

          return true;
        });

        // Supprimer les doublons basés sur l'ID
        const uniqueParticipants = [];
        const seenIds = new Set();
        const seenNames = new Set();

        for (const participant of validParticipants) {
          const participantId = participant.id;
          const participantName = participant.name.toLowerCase().trim();

          if (seenIds.has(participantId)) {
            console.log(
              `   🔄 Doublon ID supprimé: ${participant.name} (${participant.id})`
            );
            duplicatesRemoved++;
            continue;
          }

          if (seenNames.has(participantName)) {
            console.log(`   🔄 Doublon nom supprimé: ${participant.name}`);
            duplicatesRemoved++;
            continue;
          }

          seenIds.add(participantId);
          seenNames.add(participantName);
          uniqueParticipants.push(participant);
        }

        totalParticipantsAfter += uniqueParticipants.length;

        if (originalLength !== uniqueParticipants.length || needsUpdate) {
          console.log(
            `   📊 Nettoyage: ${originalLength} -> ${uniqueParticipants.length} participants`
          );
          participants = uniqueParticipants;
          needsUpdate = true;
        } else {
          console.log(
            `   ✅ ${participants.length} participants valides (aucun changement)`
          );
        }
      }

      // Mettre à jour si nécessaire avec requête SQL directe
      if (needsUpdate) {
        try {
          await sequelize.query(
            `
            UPDATE sessions 
            SET participants = :participants, updatedAt = NOW()
            WHERE id = :sessionId
          `,
            {
              replacements: {
                participants: JSON.stringify(participants),
                sessionId: session.id,
              },
            }
          );
          console.log(`   ✅ Session mise à jour en base`);
        } catch (updateError) {
          console.error(
            `   ❌ Erreur mise à jour session ${session.code}:`,
            updateError.message
          );
        }
      }
    }

    console.log(`\n🎉 === NETTOYAGE TERMINÉ ===`);
    console.log(`   Sessions traitées: ${sessions.length}`);
    console.log(`   Sessions corrigées: ${fixedCount}`);
    console.log(`   Doublons supprimés: ${duplicatesRemoved}`);
    console.log(`   Participants avant: ${totalParticipantsBefore}`);
    console.log(`   Participants après: ${totalParticipantsAfter}`);
    console.log(
      `   Participants supprimés: ${
        totalParticipantsBefore - totalParticipantsAfter
      }`
    );

    return {
      sessionsProcessed: sessions.length,
      fixedCount,
      duplicatesRemoved,
      participantsBefore: totalParticipantsBefore,
      participantsAfter: totalParticipantsAfter,
    };
  } catch (error) {
    console.error("❌ Erreur lors du nettoyage:", error);
    throw error;
  }
}

async function showParticipantsStats() {
  console.log("📊 === STATISTIQUES PARTICIPANTS ===");

  try {
    // Requête SQL directe pour éviter les problèmes de modèles
    const [sessions] = await sequelize.query(`
      SELECT id, code, title, participants, status, createdAt
      FROM sessions 
      ORDER BY createdAt DESC
    `);

    let totalSessions = sessions.length;
    let sessionsWithParticipants = 0;
    let totalParticipants = 0;
    let invalidSessions = 0;
    let sessionsByStatus = {};

    console.log(`\n📋 Détail par session:`);

    for (const session of sessions) {
      let participantCount = 0;
      let isValid = true;
      let participants = session.participants;

      // Compter les participants de façon sécurisée
      if (Array.isArray(participants)) {
        const validParticipants = participants.filter(
          (p) => p && typeof p === "object" && p.id && p.name
        );
        participantCount = validParticipants.length;
        totalParticipants += participantCount;

        if (participantCount > 0) {
          sessionsWithParticipants++;
        }
      } else if (typeof participants === "string") {
        try {
          const parsed = JSON.parse(participants);
          if (Array.isArray(parsed)) {
            const validParticipants = parsed.filter(
              (p) => p && typeof p === "object" && p.id && p.name
            );
            participantCount = validParticipants.length;
            totalParticipants += participantCount;
            if (participantCount > 0) {
              sessionsWithParticipants++;
            }
          } else {
            isValid = false;
            invalidSessions++;
          }
        } catch (e) {
          isValid = false;
          invalidSessions++;
        }
      } else if (participants !== null && participants !== undefined) {
        isValid = false;
        invalidSessions++;
      }

      // Statistiques par statut
      sessionsByStatus[session.status] =
        (sessionsByStatus[session.status] || 0) + 1;

      const statusIcon = isValid ? "✅" : "❌";
      const dateStr = new Date(session.createdAt).toLocaleDateString();
      console.log(
        `   ${statusIcon} ${session.code}: ${participantCount} participants (${session.status}) - ${dateStr}`
      );
    }

    console.log(`\n📊 Résumé global:`);
    console.log(`   Total sessions: ${totalSessions}`);
    console.log(`   Sessions avec participants: ${sessionsWithParticipants}`);
    console.log(`   Total participants: ${totalParticipants}`);
    console.log(`   Sessions invalides: ${invalidSessions}`);
    console.log(
      `   Moyenne participants/session: ${
        totalSessions > 0 ? (totalParticipants / totalSessions).toFixed(2) : 0
      }`
    );

    console.log(`\n📈 Répartition par statut:`);
    Object.entries(sessionsByStatus).forEach(([status, count]) => {
      console.log(`   ${status}: ${count} sessions`);
    });

    return {
      totalSessions,
      sessionsWithParticipants,
      totalParticipants,
      invalidSessions,
      sessionsByStatus,
      averageParticipants:
        totalSessions > 0 ? totalParticipants / totalSessions : 0,
    };
  } catch (error) {
    console.error("❌ Erreur lors du calcul des stats:", error);
    throw error;
  }
}

// Fonction principale
async function main() {
  try {
    console.log("🚀 Démarrage du script de nettoyage des participants");
    console.log(`   Environnement: ${process.env.NODE_ENV || "development"}`);
    console.log(`   Base de données: ${process.env.DB_NAME || "quiz_app"}`);

    // Afficher les stats avant
    console.log("\n📊 AVANT NETTOYAGE:");
    const statsBefore = await showParticipantsStats();

    // Demander confirmation si beaucoup de participants
    if (statsBefore.totalParticipants > 50) {
      console.log(
        `\n⚠️  ATTENTION: ${statsBefore.totalParticipants} participants détectés`
      );
      console.log("   Cela semble élevé pour un environnement de test");
      console.log(
        "   Le nettoyage va supprimer les doublons et données invalides"
      );

      // En mode interactif, demander confirmation
      if (process.stdout.isTTY) {
        const readline = require("readline");
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const answer = await new Promise((resolve) => {
          rl.question("   Continuer le nettoyage ? (y/N): ", resolve);
        });

        rl.close();

        if (answer.toLowerCase() !== "y" && answer.toLowerCase() !== "yes") {
          console.log("❌ Nettoyage annulé par l'utilisateur");
          process.exit(0);
        }
      }
    }

    // Nettoyer
    console.log("\n🧹 DÉBUT DU NETTOYAGE:");
    const cleanResults = await cleanParticipantsData();

    // Afficher les stats après
    console.log("\n📊 APRÈS NETTOYAGE:");
    const statsAfter = await showParticipantsStats();

    // Résumé final
    console.log("\n🎯 === RÉSUMÉ FINAL ===");
    console.log(`   Sessions traitées: ${cleanResults.sessionsProcessed}`);
    console.log(`   Sessions corrigées: ${cleanResults.fixedCount}`);
    console.log(`   Doublons supprimés: ${cleanResults.duplicatesRemoved}`);
    console.log(`   Participants avant: ${cleanResults.participantsBefore}`);
    console.log(`   Participants après: ${cleanResults.participantsAfter}`);
    console.log(
      `   Réduction: ${
        cleanResults.participantsBefore - cleanResults.participantsAfter
      } participants`
    );

    if (cleanResults.participantsAfter < cleanResults.participantsBefore) {
      console.log(
        `   💾 Économie d'espace: ${(
          ((cleanResults.participantsBefore - cleanResults.participantsAfter) /
            cleanResults.participantsBefore) *
          100
        ).toFixed(1)}%`
      );
    }

    console.log("\n✅ Nettoyage terminé avec succès !");
    process.exit(0);
  } catch (error) {
    console.error("💥 Erreur fatale:", error);
    console.error("Stack:", error.stack);
    process.exit(1);
  }
}

// Fonctions utilitaires pour usage en module
async function quickStats() {
  try {
    const stats = await showParticipantsStats();
    return stats;
  } catch (error) {
    console.error("❌ Erreur lors du calcul des stats rapides:", error);
    return null;
  }
}

async function quickClean() {
  try {
    console.log("⚡ Nettoyage rapide des participants...");
    const results = await cleanParticipantsData();
    console.log("✅ Nettoyage rapide terminé");
    return results;
  } catch (error) {
    console.error("❌ Erreur lors du nettoyage rapide:", error);
    return null;
  }
}

// Exporter pour utilisation en module ou exécuter directement
if (require.main === module) {
  main();
}

module.exports = {
  cleanParticipantsData,
  showParticipantsStats,
  quickStats,
  quickClean,
};
