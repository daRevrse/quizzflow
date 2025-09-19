const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const sessionHooks = {
  beforeCreate: (session) => {
    console.log(`🪝 beforeCreate hook - session:`, session.id);

    // Générer un code unique si pas fourni
    if (!session.code) {
      session.code = generateSessionCode();
      console.log(`✅ Code généré: ${session.code}`);
    }

    // S'assurer que participants est un tableau vide
    if (!Array.isArray(session.participants)) {
      console.log(`🔧 beforeCreate: Initialisation participants array`);
      session.participants = [];
    }

    // Initialiser les stats
    session.stats = calculateSessionStats(session);
  },

  beforeUpdate: (session) => {
    console.log(`🪝 beforeUpdate hook - session:`, session.id);
    console.log(`   Champs modifiés:`, session.changed());

    // S'assurer que participants est un tableau
    if (session.changed("participants")) {
      if (!Array.isArray(session.participants)) {
        console.log(
          `🔧 beforeUpdate: Correction participants non-array:`,
          typeof session.participants
        );
        session.participants = [];
      } else {
        // Nettoyer les participants invalides
        const validParticipants = session.participants.filter(
          (p) => p && typeof p === "object" && p.id
        );
        if (validParticipants.length !== session.participants.length) {
          console.log(
            `🧹 beforeUpdate: Nettoyage participants - ${session.participants.length} -> ${validParticipants.length}`
          );
          session.participants = validParticipants;
        }
      }
    }

    // Recalculer les stats si nécessaire
    if (session.changed("responses") || session.changed("participants")) {
      console.log(`📊 beforeUpdate: Recalcul des stats`);
      session.stats = calculateSessionStats(session);
    }
  },

  beforeValidate: (session) => {
    console.log(`🪝 beforeValidate hook - session:`, session.id);

    // S'assurer que participants est toujours un tableau avant validation
    if (!Array.isArray(session.participants)) {
      console.log(`🔧 beforeValidate: Force participants array`);
      session.participants = [];
    }
  },

  afterFind: (result) => {
    // Hook appelé après récupération depuis la DB
    if (!result) return;

    const sessions = Array.isArray(result) ? result : [result];

    sessions.forEach((session) => {
      if (session && !Array.isArray(session.participants)) {
        console.log(
          `🔧 afterFind: Correction participants pour session ${session.id}:`,
          typeof session.participants
        );
        session.participants = [];
      }
    });
  },
};

// Fonction pour générer un code de session unique
function generateSessionCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const Session = sequelize.define(
  "Session",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    code: {
      type: DataTypes.STRING(8),
      allowNull: false,
      unique: true,
      validate: {
        len: [6, 8],
        isAlphanumeric: true,
        isUppercase: true,
      },
    },
    quizId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "quizzes",
        key: "id",
      },
    },
    hostId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(
        "waiting",
        "active",
        "paused",
        "finished",
        "cancelled"
      ),
      defaultValue: "waiting",
    },
    currentQuestionIndex: {
      type: DataTypes.INTEGER,
      defaultValue: -1,
      validate: {
        min: -1,
      },
    },
    participants: {
      type: DataTypes.JSON,
      defaultValue: [],
      validate: {
        isValidParticipants(value) {
          if (!Array.isArray(value)) {
            throw new Error("Les participants doivent être un tableau");
          }
          value.forEach((participant, index) => {
            if (!participant.id || !participant.name) {
              throw new Error(`Participant invalide à l'index ${index}`);
            }
          });
        },
      },
    },
    responses: {
      type: DataTypes.JSON,
      defaultValue: {},
      validate: {
        isValidResponses(value) {
          if (typeof value !== "object") {
            throw new Error("Les réponses doivent être un objet");
          }
        },
      },
    },
    settings: {
      type: DataTypes.JSON,
      defaultValue: {
        allowLateJoin: true,
        showLeaderboard: true,
        autoAdvance: false,
        questionTimeLimit: null,
        maxParticipants: 100,
      },
      validate: {
        isValidSettings(value) {
          if (value && typeof value === "object") {
            const { maxParticipants, questionTimeLimit } = value;
            if (
              maxParticipants &&
              (maxParticipants < 1 || maxParticipants > 1000)
            ) {
              throw new Error("maxParticipants doit être entre 1 et 1000");
            }
            if (
              questionTimeLimit &&
              (questionTimeLimit < 5 || questionTimeLimit > 600)
            ) {
              throw new Error(
                "questionTimeLimit doit être entre 5 et 600 secondes"
              );
            }
          }
        },
      },
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    endedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    currentQuestionStartedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    stats: {
      type: DataTypes.JSON,
      defaultValue: {
        totalParticipants: 0,
        totalResponses: 0,
        averageScore: 0,
        completionRate: 0,
      },
    },
  },
  {
    tableName: "sessions",
    indexes: [
      {
        unique: true,
        fields: ["code"],
      },
      {
        fields: ["quizId"],
      },
      {
        fields: ["hostId"],
      },
      {
        fields: ["status"],
      },
      {
        fields: ["createdAt"],
      },
    ],
    // hooks: {
    //   beforeCreate: (session) => {
    //     // Générer un code unique si pas fourni
    //     if (!session.code) {
    //       session.code = generateSessionCode();
    //     }
    //   },
    //   beforeUpdate: (session) => {
    //     // Calculer les stats automatiquement
    //     if (session.changed("responses") || session.changed("participants")) {
    //       session.stats = calculateSessionStats(session);
    //     }
    //   },
    // },
    hooks: sessionHooks,
  }
);

// Fonction pour générer un code de session unique
function generateSessionCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Fonction pour calculer les statistiques
// function calculateSessionStats(session) {
//   const participants = session.participants || [];
//   const responses = session.responses || {};

//   const totalParticipants = participants.length;
//   const totalResponses = Object.values(responses).reduce(
//     (total, questionResponses) => {
//       return total + Object.keys(questionResponses || {}).length;
//     },
//     0
//   );

//   let totalScore = 0;
//   let participantsWithScore = 0;

//   participants.forEach((participant) => {
//     if (participant.score !== undefined) {
//       totalScore += participant.score;
//       participantsWithScore++;
//     }
//   });

//   const averageScore =
//     participantsWithScore > 0
//       ? Math.round(totalScore / participantsWithScore)
//       : 0;
//   const completionRate =
//     totalParticipants > 0
//       ? Math.round((participantsWithScore / totalParticipants) * 100)
//       : 0;

//   return {
//     totalParticipants,
//     totalResponses,
//     averageScore,
//     completionRate,
//   };
// }

function calculateSessionStats(session) {
  try {
    // S'assurer que participants est un tableau
    let participants = session.participants;
    if (!Array.isArray(participants)) {
      console.log(
        `⚠️  calculateSessionStats: participants n'est pas un tableau:`,
        typeof participants
      );
      participants = [];
    }

    // Filtrer les participants valides
    const validParticipants = participants.filter(
      (p) => p && typeof p === "object" && p.id
    );

    const responses = session.responses || {};
    const totalParticipants = validParticipants.length;
    const totalResponses = Object.values(responses).reduce(
      (total, questionResponses) => {
        return total + Object.keys(questionResponses || {}).length;
      },
      0
    );

    let totalScore = 0;
    let participantsWithScore = 0;

    validParticipants.forEach((participant) => {
      if (participant.score !== undefined && participant.score !== null) {
        totalScore += Number(participant.score) || 0;
        participantsWithScore++;
      }
    });

    const averageScore =
      participantsWithScore > 0
        ? Math.round((totalScore / participantsWithScore) * 100) / 100
        : 0;

    const completionRate =
      totalParticipants > 0
        ? Math.round((participantsWithScore / totalParticipants) * 100)
        : 0;

    const stats = {
      totalParticipants,
      totalResponses,
      averageScore,
      completionRate,
    };

    console.log(`📊 Stats calculées:`, stats);
    return stats;
  } catch (error) {
    console.error("❌ Erreur dans calculateSessionStats:", error);
    return {
      totalParticipants: 0,
      totalResponses: 0,
      averageScore: 0,
      completionRate: 0,
    };
  }
}

// Méthodes d'instance
// Session.prototype.addParticipant = function (participantData) {
//   const participants = [...(this.participants || [])];
//   const existingIndex = participants.findIndex(
//     (p) => p.id === participantData.id
//   );

//   if (existingIndex !== -1) {
//     // Mettre à jour participant existant
//     participants[existingIndex] = {
//       ...participants[existingIndex],
//       ...participantData,
//     };
//   } else {
//     // Ajouter nouveau participant
//     if (participants.length >= (this.settings?.maxParticipants || 100)) {
//       throw new Error("Nombre maximum de participants atteint");
//     }
//     participants.push({
//       id: participantData.id,
//       name: participantData.name,
//       avatar: participantData.avatar || null,
//       joinedAt: new Date(),
//       score: 0,
//       responses: {},
//       isConnected: true,
//     });
//   }

//   return this.update({ participants });
// };
Session.prototype.addParticipant = function (participantData) {
  // S'assurer que participants est un tableau
  let participants = this.participants;
  if (!Array.isArray(participants)) {
    console.log(
      `⚠️  addParticipant: participants n'est pas un tableau, initialisation:`,
      {
        type: typeof participants,
        value: participants,
      }
    );
    participants = [];
  }

  const participantsList = [...participants];
  const existingIndex = participantsList.findIndex(
    (p) => p && p.id === participantData.id
  );

  if (existingIndex !== -1) {
    // Mettre à jour participant existant
    participantsList[existingIndex] = {
      ...participantsList[existingIndex],
      ...participantData,
    };
  } else {
    // Ajouter nouveau participant
    const maxParticipants = this.settings?.maxParticipants || 100;
    if (participantsList.length >= maxParticipants) {
      throw new Error("Nombre maximum de participants atteint");
    }

    participantsList.push({
      id: participantData.id,
      name: participantData.name,
      avatar: participantData.avatar || null,
      joinedAt: new Date().toISOString(),
      score: 0,
      responses: {},
      isConnected: true,
      ...participantData,
    });
  }

  return this.update({ participants: participantsList });
};

// Session.prototype.removeParticipant = function (participantId) {
//   const participants = (this.participants || []).filter(
//     (p) => p.id !== participantId
//   );
//   return this.update({ participants });
// };
Session.prototype.removeParticipant = function (participantId) {
  // S'assurer que participants est un tableau
  let participants = this.participants;
  if (!Array.isArray(participants)) {
    console.log(`⚠️  removeParticipant: participants n'est pas un tableau:`, {
      type: typeof participants,
      value: participants,
    });
    participants = [];
  }

  const updatedParticipants = participants.filter(
    (p) => p && p.id !== participantId
  );

  return this.update({ participants: updatedParticipants });
};

// Session.prototype.updateParticipantConnection = function (
//   participantId,
//   isConnected
// ) {
//   const participants = [...(this.participants || [])];
//   const participantIndex = participants.findIndex(
//     (p) => p.id === participantId
//   );

//   if (participantIndex !== -1) {
//     participants[participantIndex].isConnected = isConnected;
//     if (!isConnected) {
//       participants[participantIndex].disconnectedAt = new Date();
//     }
//     return this.update({ participants });
//   }

//   return Promise.resolve(this);
// };
Session.prototype.updateParticipantConnection = function (
  participantId,
  isConnected
) {
  try {
    const participants = [...(this.participants || [])];
    const participantIndex = participants.findIndex(
      (p) => p.id === participantId
    );

    if (participantIndex !== -1) {
      participants[participantIndex].isConnected = isConnected;
      participants[participantIndex].lastSeen = new Date();

      return this.update({ participants });
    }

    return Promise.resolve(this);
  } catch (error) {
    console.error("Erreur lors de la mise à jour de connexion:", error);
    throw error;
  }
};

// Session.prototype.addResponse = function (participantId, questionId, response) {
//   const responses = { ...this.responses };

//   if (!responses[questionId]) {
//     responses[questionId] = {};
//   }

//   responses[questionId][participantId] = {
//     answer: response.answer,
//     submittedAt: new Date(),
//     timeSpent: response.timeSpent || 0,
//   };

//   // Mettre à jour le score du participant
//   const participants = [...(this.participants || [])];
//   const participantIndex = participants.findIndex(
//     (p) => p.id === participantId
//   );

//   if (participantIndex !== -1) {
//     if (!participants[participantIndex].responses) {
//       participants[participantIndex].responses = {};
//     }
//     participants[participantIndex].responses[questionId] = response;

//     // Calculer le nouveau score si fourni
//     if (response.points !== undefined) {
//       participants[participantIndex].score =
//         (participants[participantIndex].score || 0) + response.points;
//     }
//   }

//   return this.update({ responses, participants });
// };
Session.prototype.addResponse = function (participantId, questionId, response) {
  try {
    const responses = { ...(this.responses || {}) };
    const participants = [...(this.participants || [])];

    // Initialiser les réponses pour cette question si nécessaire
    if (!responses[questionId]) {
      responses[questionId] = {};
    }

    // Ajouter la réponse
    responses[questionId][participantId] = {
      answer: response.answer,
      submittedAt: response.submittedAt || new Date(),
      timeSpent: response.timeSpent || 0,
      points: response.points || 0,
      isCorrect: response.isCorrect || false,
    };

    // Mettre à jour le participant
    const participantIndex = participants.findIndex(
      (p) => p.id === participantId
    );

    if (participantIndex !== -1) {
      if (!participants[participantIndex].responses) {
        participants[participantIndex].responses = {};
      }

      participants[participantIndex].responses[questionId] = response;

      // Mettre à jour le score
      if (response.points !== undefined) {
        const currentScore = participants[participantIndex].score || 0;
        participants[participantIndex].score = currentScore + response.points;
      }
    }

    return this.update({ responses, participants });
  } catch (error) {
    console.error("Erreur lors de l'ajout de réponse:", error);
    throw error;
  }
};
Session.prototype.nextQuestion = function () {
  const newIndex = this.currentQuestionIndex + 1;
  return this.update({
    currentQuestionIndex: newIndex,
    currentQuestionStartedAt: new Date(),
  });
};

Session.prototype.previousQuestion = function () {
  if (this.currentQuestionIndex > 0) {
    const newIndex = this.currentQuestionIndex - 1;
    return this.update({
      currentQuestionIndex: newIndex,
      currentQuestionStartedAt: new Date(),
    });
  }
  return Promise.resolve(this);
};

// Session.prototype.startSession = function () {
//   return this.update({
//     status: "active",
//     startedAt: new Date(),
//     currentQuestionIndex: 0,
//     currentQuestionStartedAt: new Date(),
//   });
// };
Session.prototype.startSession = function () {
  // Vérifications avant démarrage
  if (this.status !== "waiting") {
    throw new Error(
      "La session ne peut être démarrée que depuis l'état 'waiting'"
    );
  }

  const participants = this.participants || [];
  if (participants.length === 0) {
    throw new Error(
      "Au moins un participant est requis pour démarrer la session"
    );
  }

  return this.update({
    status: "active",
    startedAt: new Date(),
    currentQuestionIndex: 0,
    currentQuestionStartedAt: new Date(),
  });
};

// Session.prototype.pauseSession = function () {
//   return this.update({ status: "paused" });
// };

// Session.prototype.resumeSession = function () {
//   return this.update({
//     status: "active",
//     currentQuestionStartedAt: new Date(),
//   });
// };
Session.prototype.pauseSession = function () {
  if (this.status !== "active") {
    throw new Error("Seules les sessions actives peuvent être mises en pause");
  }

  return this.update({ status: "paused" });
};

// Méthode resumeSession corrigée avec validation
Session.prototype.resumeSession = function () {
  if (this.status !== "paused") {
    throw new Error("Seules les sessions en pause peuvent être reprises");
  }

  return this.update({
    status: "active",
    currentQuestionStartedAt: new Date(),
  });
};

// Session.prototype.endSession = function () {
//   const now = new Date();

//   // Calculer les statistiques finales
//   const participants = this.participants || [];
//   const totalParticipants = participants.length;
//   const totalResponses = Object.keys(this.responses || {}).length;

//   let totalScore = 0;
//   let completedParticipants = 0;

//   participants.forEach((participant) => {
//     if (participant.score !== undefined && participant.score !== null) {
//       totalScore += participant.score;
//       completedParticipants++;
//     }
//   });

//   const averageScore =
//     completedParticipants > 0 ? totalScore / completedParticipants : 0;
//   const completionRate =
//     totalParticipants > 0
//       ? (completedParticipants / totalParticipants) * 100
//       : 0;

//   const finalStats = {
//     totalParticipants,
//     totalResponses,
//     averageScore: Math.round(averageScore * 100) / 100,
//     completionRate: Math.round(completionRate * 100) / 100,
//     duration: this.startedAt
//       ? Math.floor((now - new Date(this.startedAt)) / 1000)
//       : 0,
//   };

//   return this.update({
//     status: "finished",
//     endedAt: now,
//     stats: {
//       ...this.stats,
//       ...finalStats,
//     },
//   });
// };
Session.prototype.endSession = function () {
  const now = new Date();

  // 🔧 CORRECTION : S'assurer que participants est un tableau
  let participants = this.participants;
  if (!Array.isArray(participants)) {
    console.log(`⚠️  endSession: participants n'est pas un tableau:`, {
      type: typeof participants,
      value: participants,
    });
    participants = [];
  }

  console.log(`🏁 Fin de session - participants validés:`, {
    count: participants.length,
    isArray: Array.isArray(participants),
  });

  // Calculer les statistiques finales avec tableau sécurisé
  const totalParticipants = participants.length;
  const totalResponses = Object.keys(this.responses || {}).length;

  let totalScore = 0;
  let completedParticipants = 0;

  // 🔧 Utilisation sécurisée de forEach maintenant que c'est un tableau
  participants.forEach((participant) => {
    // Vérifier que participant est un objet valide
    if (participant && typeof participant === "object") {
      if (participant.score !== undefined && participant.score !== null) {
        totalScore += Number(participant.score) || 0;
        completedParticipants++;
      }
    } else {
      console.warn(`⚠️  Participant invalide ignoré:`, participant);
    }
  });

  const averageScore =
    completedParticipants > 0 ? totalScore / completedParticipants : 0;
  const completionRate =
    totalParticipants > 0
      ? (completedParticipants / totalParticipants) * 100
      : 0;

  // Calcul de la durée de session
  const duration = this.startedAt
    ? Math.floor((now - new Date(this.startedAt)) / 1000)
    : 0;

  const finalStats = {
    totalParticipants,
    totalResponses,
    averageScore: Math.round(averageScore * 100) / 100,
    completionRate: Math.round(completionRate * 100) / 100,
    duration,
    endedAt: now.toISOString(),
  };

  console.log(`📊 Statistiques finales calculées:`, finalStats);

  // Mise à jour de la session avec les stats finales
  return this.update({
    status: "finished",
    endedAt: now,
    stats: {
      ...(this.stats || {}),
      ...finalStats,
    },
  });
};

// Session.prototype.getLeaderboard = function () {
//   try {
//     const participants = [...(this.participants || [])];

//     return participants
//       .filter((p) => p.score !== undefined && p.score !== null)
//       .sort((a, b) => (b.score || 0) - (a.score || 0))
//       .map((participant, index) => ({
//         rank: index + 1,
//         id: participant.id,
//         name: participant.name || "Participant",
//         score: participant.score || 0,
//         avatar: participant.avatar || null,
//         isConnected: participant.isConnected || false,
//         lastSeen: participant.lastSeen || null,
//       }));
//   } catch (error) {
//     console.error("Erreur lors de la génération du leaderboard:", error);
//     return [];
//   }
// };
Session.prototype.getLeaderboard = function () {
  try {
    // S'assurer que participants est un tableau
    let participants = this.participants;
    if (!Array.isArray(participants)) {
      console.log(`⚠️  getLeaderboard: participants n'est pas un tableau:`, {
        type: typeof participants,
        value: participants,
      });
      participants = [];
    }

    return participants
      .filter(
        (p) =>
          p &&
          typeof p === "object" &&
          p.score !== undefined &&
          p.score !== null
      )
      .sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0))
      .map((participant, index) => ({
        rank: index + 1,
        id: participant.id || `participant_${index}`,
        name: participant.name || "Participant",
        score: Number(participant.score) || 0,
        avatar: participant.avatar || null,
        isConnected: Boolean(participant.isConnected),
        lastSeen: participant.lastSeen || null,
      }));
  } catch (error) {
    console.error("❌ Erreur lors de la génération du leaderboard:", error);
    return [];
  }
};

// Session.prototype.getQuestionResults = function (questionId) {
//   const responses = this.responses[questionId] || {};
//   const participants = this.participants || [];

//   const results = {
//     totalResponses: Object.keys(responses).length,
//     totalParticipants: participants.length,
//     responses: [],
//   };

//   Object.entries(responses).forEach(([participantId, response]) => {
//     const participant = participants.find((p) => p.id === participantId);
//     results.responses.push({
//       participantId,
//       participantName: participant?.name || "Anonyme",
//       answer: response.answer,
//       submittedAt: response.submittedAt,
//       timeSpent: response.timeSpent,
//     });
//   });

//   return results;
// };

// Méthodes statiques
Session.prototype.getQuestionResults = function (questionId) {
  try {
    const responses = (this.responses || {})[questionId] || {};
    const participants = this.participants || [];

    const results = {
      questionId,
      totalResponses: Object.keys(responses).length,
      totalParticipants: participants.length,
      responses: [],
      stats: {
        correctAnswers: 0,
        averageTimeSpent: 0,
        responseRate: 0,
      },
    };

    let totalTimeSpent = 0;
    let correctCount = 0;

    Object.entries(responses).forEach(([participantId, response]) => {
      const participant = participants.find((p) => p.id === participantId);

      const responseData = {
        participantId,
        participantName: participant?.name || "Participant",
        answer: response.answer,
        submittedAt: response.submittedAt,
        timeSpent: response.timeSpent || 0,
        points: response.points || 0,
        isCorrect: response.isCorrect || false,
      };

      results.responses.push(responseData);

      // Calculer les statistiques
      if (response.isCorrect) {
        correctCount++;
      }

      totalTimeSpent += response.timeSpent || 0;
    });

    // Calculer les moyennes
    const responseCount = results.responses.length;
    if (responseCount > 0) {
      results.stats.averageTimeSpent = Math.round(
        totalTimeSpent / responseCount
      );
      results.stats.correctAnswers = correctCount;
      results.stats.responseRate = Math.round(
        (responseCount / results.totalParticipants) * 100
      );
    }

    return results;
  } catch (error) {
    console.error("Erreur lors de la récupération des résultats:", error);
    return {
      questionId,
      totalResponses: 0,
      totalParticipants: 0,
      responses: [],
      stats: { correctAnswers: 0, averageTimeSpent: 0, responseRate: 0 },
    };
  }
};

Session.findByCode = function (code) {
  return this.findOne({
    where: { code: code.toUpperCase() },
  });
};

Session.findActiveByHost = function (hostId) {
  return this.findAll({
    where: {
      hostId,
      status: ["waiting", "active", "paused"],
    },
    order: [["createdAt", "DESC"]],
  });
};

Session.findByQuiz = function (quizId, options = {}) {
  return this.findAll({
    where: {
      quizId,
      ...options.where,
    },
    order: options.order || [["createdAt", "DESC"]],
    limit: options.limit || 50,
  });
};

Session.generateUniqueCode = async function () {
  let code;
  let exists = true;
  let attempts = 0;

  while (exists && attempts < 10) {
    code = generateSessionCode();
    const session = await this.findByCode(code);
    exists = !!session;
    attempts++;
  }

  if (exists) {
    throw new Error("Impossible de générer un code unique après 10 tentatives");
  }

  return code;
};

// Scopes
Session.addScope("active", {
  where: { status: ["waiting", "active", "paused"] },
});

Session.addScope("finished", {
  where: { status: ["finished", "cancelled"] },
});

Session.addScope("withQuiz", {
  include: [
    {
      model: require("./Quiz"),
      as: "quiz",
    },
  ],
});

Session.addScope("withHost", {
  include: [
    {
      model: require("./User"),
      as: "host",
      attributes: ["id", "username", "firstName", "lastName"],
    },
  ],
});

// module.exports = Session;
// module.exports = {
//   Session,
//   calculateSessionStats,
//   generateSessionCode,
// };

Session.calculateSessionStats = calculateSessionStats;
Session.generateSessionCode = generateSessionCode;

// Export par défaut
module.exports = Session;
