const { DataTypes, QueryTypes } = require("sequelize");
const { sequelize } = require("../config/database");

// Fonction utilitaire pour générer un code de session unique
const generateSessionCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Fonction pour calculer les statistiques de session
const calculateSessionStats = (session) => {
  const participants = Array.isArray(session.participants)
    ? session.participants
    : [];
  const responses = session.responses || {};

  const totalParticipants = participants.length;
  const totalResponses = Object.keys(responses).reduce((total, questionId) => {
    return total + (responses[questionId]?.length || 0);
  }, 0);

  let totalScore = 0;
  let activeParticipants = 0;

  participants.forEach((participant) => {
    if (participant && typeof participant === "object") {
      if (typeof participant.score === "number" && !isNaN(participant.score)) {
        totalScore += participant.score;
        activeParticipants++;
      }
    }
  });

  const averageScore =
    activeParticipants > 0
      ? Math.round((totalScore / activeParticipants) * 100) / 100
      : 0;
  const participationRate =
    totalParticipants > 0
      ? Math.round((activeParticipants / totalParticipants) * 100)
      : 0;

  return {
    totalParticipants,
    totalResponses,
    averageScore,
    participationRate,
    activeParticipants,
  };
};

// Définition du modèle Session
const Session = sequelize.define(
  "Session",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    code: {
      type: DataTypes.STRING(6),
      allowNull: false,
      unique: {
        name: "unique_session_code",
        msg: "Ce code de session est déjà utilisé",
      },
      validate: {
        len: {
          args: [6, 6],
          msg: "Le code de session doit faire exactement 6 caractères",
        },
        isAlphanumeric: {
          msg: "Le code de session ne peut contenir que des lettres et des chiffres",
        },
      },
      set(value) {
        // Toujours stocker en majuscules
        this.setDataValue(
          "code",
          value ? value.toString().toUpperCase().trim() : ""
        );
      },
    },

    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Le titre de la session est requis",
        },
        len: {
          args: [3, 255],
          msg: "Le titre doit contenir entre 3 et 255 caractères",
        },
      },
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: {
          args: [0, 1000],
          msg: "La description ne peut pas dépasser 1000 caractères",
        },
      },
    },

    status: {
      type: DataTypes.ENUM(
        "waiting",
        "active",
        "paused",
        "finished",
        "cancelled"
      ),
      allowNull: false,
      defaultValue: "waiting",
      validate: {
        isIn: {
          args: [["waiting", "active", "paused", "finished", "cancelled"]],
          msg: "Statut de session invalide",
        },
      },
    },

    // Clés étrangères
    quizId: {
      type: DataTypes.STRING(36), // UUID format
      allowNull: false,
      references: {
        model: "quizzes",
        key: "id",
      },
      validate: {
        notNull: {
          msg: "Un quiz est requis pour créer une session",
        },
        isUUID: {
          args: 4,
          msg: "ID de quiz invalide",
        },
      },
    },

    hostId: {
      type: DataTypes.STRING(36), // UUID format
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
      validate: {
        notNull: {
          msg: "Un hôte est requis pour créer une session",
        },
        isUUID: {
          args: 4,
          msg: "ID d'hôte invalide",
        },
      },
    },

    // Participants (JSON array)
    participants: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      validate: {
        isValidParticipants(value) {
          if (!Array.isArray(value)) {
            throw new Error("Les participants doivent être un tableau");
          }

          // Validation de chaque participant
          value.forEach((participant, index) => {
            if (!participant || typeof participant !== "object") {
              throw new Error(
                `Participant ${index + 1} invalide : doit être un objet`
              );
            }

            if (!participant.id || typeof participant.id !== "string") {
              throw new Error(`Participant ${index + 1} invalide : ID requis`);
            }

            if (
              !participant.name ||
              typeof participant.name !== "string" ||
              participant.name.trim().length < 2
            ) {
              throw new Error(
                `Participant ${
                  index + 1
                } invalide : nom requis (minimum 2 caractères)`
              );
            }

            // Vérifier l'unicité des IDs
            const duplicateId = value.find(
              (p, i) => i !== index && p.id === participant.id
            );
            if (duplicateId) {
              throw new Error(`ID de participant dupliqué : ${participant.id}`);
            }

            // Vérifier l'unicité des noms
            const duplicateName = value.find(
              (p, i) =>
                i !== index &&
                p.name.toLowerCase() === participant.name.toLowerCase()
            );
            if (duplicateName) {
              throw new Error(
                `Nom de participant dupliqué : ${participant.name}`
              );
            }
          });
        },
      },
    },

    // Réponses (JSON object)
    responses: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
      validate: {
        isValidResponses(value) {
          if (!value || typeof value !== "object") {
            throw new Error("Les réponses doivent être un objet");
          }

          // Validation des réponses par question
          Object.keys(value).forEach((questionId) => {
            const questionResponses = value[questionId];

            if (!Array.isArray(questionResponses)) {
              throw new Error(
                `Réponses pour la question ${questionId} doivent être un tableau`
              );
            }

            questionResponses.forEach((response, index) => {
              if (!response || typeof response !== "object") {
                throw new Error(
                  `Réponse ${index + 1} pour la question ${questionId} invalide`
                );
              }

              if (
                !response.participantId ||
                typeof response.participantId !== "string"
              ) {
                throw new Error(
                  `Réponse ${
                    index + 1
                  } pour la question ${questionId} : participantId requis`
                );
              }

              if (response.answer === undefined || response.answer === null) {
                throw new Error(
                  `Réponse ${
                    index + 1
                  } pour la question ${questionId} : answer requis`
                );
              }
            });
          });
        },
      },
    },

    // Paramètres de la session
    settings: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {
        allowAnonymous: true,
        allowLateJoin: false,
        showLeaderboard: true,
        maxParticipants: 100,
        autoAdvance: false,
        shuffleQuestions: false,
        shuffleAnswers: false,
      },
      validate: {
        isValidSettings(value) {
          if (!value || typeof value !== "object") {
            throw new Error("Les paramètres doivent être un objet");
          }

          // Validation des paramètres optionnels
          if (value.maxParticipants !== undefined) {
            if (
              !Number.isInteger(value.maxParticipants) ||
              value.maxParticipants < 1 ||
              value.maxParticipants > 1000
            ) {
              throw new Error(
                "maxParticipants doit être un entier entre 1 et 1000"
              );
            }
          }

          // Validation des booléens
          const booleanSettings = [
            "allowAnonymous",
            "allowLateJoin",
            "showLeaderboard",
            "autoAdvance",
            "shuffleQuestions",
            "shuffleAnswers",
          ];
          booleanSettings.forEach((setting) => {
            if (
              value[setting] !== undefined &&
              typeof value[setting] !== "boolean"
            ) {
              throw new Error(`${setting} doit être un booléen`);
            }
          });
        },
      },
    },

    // Statistiques (JSON object)
    stats: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
    },

    // Horodatage
    currentQuestionIndex: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      validate: {
        min: {
          args: [0],
          msg: "L'index de question ne peut pas être négatif",
        },
      },
    },

    currentQuestionStartedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },

    startedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },

    endedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    // participantCount: {
    //   type: DataTypes.VIRTUAL,
    //   get() {
    //     return this.getParticipantCount();
    //   },
    // },
  },
  {
    tableName: "sessions",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["code"],
      },
      {
        fields: ["status"],
      },
      {
        fields: ["hostId"],
      },
      {
        fields: ["quizId"],
      },
      {
        fields: ["createdAt"],
      },
    ],
  }
);

Session.prototype.addParticipant = async function (participantData) {
  console.log(`\n🔄 === addParticipant SQL BRUT ===`);
  console.log(`   Session ID: ${this.id}`);
  console.log(`   Participant:`, participantData);

  const {
    id,
    name,
    isAnonymous = false,
    userId = null,
    socketId = null,
  } = participantData;

  // Validation basique
  if (!id || typeof id !== "string") {
    throw new Error("ID de participant requis");
  }
  if (!name || typeof name !== "string" || name.trim().length < 2) {
    throw new Error("Nom de participant requis (minimum 2 caractères)");
  }

  try {
    // 1. RÉCUPÉRER LES PARTICIPANTS ACTUELS DIRECTEMENT DEPUIS LA DB
    console.log(`🔍 Récupération état actuel depuis DB...`);

    const [currentSessionData] = await sequelize.query(
      `SELECT participants, settings FROM sessions WHERE id = :sessionId`,
      {
        type: QueryTypes.SELECT,
        replacements: { sessionId: this.id },
      }
    );

    if (!currentSessionData) {
      throw new Error("Session non trouvée en base de données");
    }

    console.log(`📊 Données DB récupérées:`, {
      participantsType: typeof currentSessionData.participants,
      participantsRaw: currentSessionData.participants,
    });

    // 2. PARSER LES PARTICIPANTS ACTUELS
    let participants = currentSessionData.participants;

    // Gestion des différents formats de stockage
    if (typeof participants === "string") {
      try {
        participants = JSON.parse(participants);
        console.log(`🔧 Parsing JSON string réussi`);
      } catch (parseError) {
        console.log(`⚠️ Erreur parsing JSON, initialisation tableau vide`);
        participants = [];
      }
    }

    if (!Array.isArray(participants)) {
      console.log(`🔧 Conversion en tableau: ${typeof participants} -> array`);
      participants = [];
    }

    console.log(`📋 Participants actuels: ${participants.length}`);

    // 3. VALIDATIONS
    const existingById = participants.find((p) => p && p.id === id);
    if (existingById) {
      throw new Error(`Participant avec l'ID ${id} existe déjà`);
    }

    const existingByName = participants.find(
      (p) => p && p.name && p.name.toLowerCase() === name.toLowerCase()
    );
    if (existingByName) {
      throw new Error(`Le nom "${name}" est déjà utilisé`);
    }

    // Récupérer les settings pour la limite
    let settings = currentSessionData.settings;
    if (typeof settings === "string") {
      try {
        settings = JSON.parse(settings);
      } catch {
        settings = { maxParticipants: 100 };
      }
    }
    if (!settings || typeof settings !== "object") {
      settings = { maxParticipants: 100 };
    }

    const maxParticipants = settings.maxParticipants || 100;
    if (participants.length >= maxParticipants) {
      throw new Error(`Limite de participants atteinte (${maxParticipants})`);
    }

    // 4. CRÉER LE NOUVEAU PARTICIPANT
    const newParticipant = {
      id,
      name: name.trim(),
      isAnonymous: Boolean(isAnonymous),
      userId,
      socketId,
      joinedAt: new Date().toISOString(),
      score: 0,
      responses: {},
      isConnected: !!socketId,
      stats: {
        correctAnswers: 0,
        totalAnswers: 0,
        averageTime: 0,
      },
    };

    // 5. AJOUTER AU TABLEAU
    const updatedParticipants = [...participants, newParticipant];
    console.log(
      `➕ Ajout participant. Nouveau total: ${updatedParticipants.length}`
    );

    // 6. CALCULER LES NOUVELLES STATS
    const newStats = {
      totalParticipants: updatedParticipants.length,
      totalResponses: 0, // Sera calculé plus tard
      averageScore: 0,
      participationRate: 100,
      activeParticipants: updatedParticipants.filter((p) => p.isConnected)
        .length,
    };

    // 7. MISE À JOUR DIRECTE EN BASE AVEC SQL BRUT
    console.log(`💾 Mise à jour SQL directe...`);

    const [updateResult] = await sequelize.query(
      `UPDATE sessions 
       SET participants = :participants, 
           stats = :stats, 
           updatedAt = NOW() 
       WHERE id = :sessionId`,
      {
        type: QueryTypes.UPDATE,
        replacements: {
          sessionId: this.id,
          participants: JSON.stringify(updatedParticipants),
          stats: JSON.stringify(newStats),
        },
      }
    );

    console.log(`📝 Résultat UPDATE SQL:`, updateResult);

    // 8. VÉRIFICATION IMMÉDIATE
    console.log(`🔍 Vérification immédiate...`);

    const [verificationData] = await sequelize.query(
      `SELECT participants FROM sessions WHERE id = :sessionId`,
      {
        type: QueryTypes.SELECT,
        replacements: { sessionId: this.id },
      }
    );

    let verifiedParticipants = verificationData.participants;
    if (typeof verifiedParticipants === "string") {
      verifiedParticipants = JSON.parse(verifiedParticipants);
    }

    const participantFound =
      verifiedParticipants &&
      Array.isArray(verifiedParticipants) &&
      verifiedParticipants.find((p) => p && p.id === id);

    console.log(`📊 Vérification:`, {
      participantsInDB: verifiedParticipants ? verifiedParticipants.length : 0,
      participantFound: !!participantFound,
      targetId: id,
    });

    if (!participantFound) {
      console.error(
        `❌ ÉCHEC CRITIQUE: Participant non trouvé après UPDATE SQL`
      );
      throw new Error("Échec de persistance en base de données");
    }

    // 9. RECHARGER L'INSTANCE SEQUELIZE
    await this.reload();

    console.log(`✅ === addParticipant SQL BRUT RÉUSSI ===`);
    console.log(`   Participant "${name}" ajouté avec succès`);
    console.log(`   Total participants: ${updatedParticipants.length}\n`);

    return this;
  } catch (error) {
    console.error(`💥 Erreur dans addParticipant SQL:`, error.message);
    throw error;
  }
};

// Méthode de vérification améliorée
Session.prototype.verifyParticipantAdded = async function (participantId) {
  console.log(`🔍 Vérification SQL directe participant ${participantId}`);

  try {
    const [sessionData] = await sequelize.query(
      `SELECT participants FROM sessions WHERE id = :sessionId`,
      {
        type: QueryTypes.SELECT,
        replacements: { sessionId: this.id },
      }
    );

    if (!sessionData) {
      console.log(`❌ Session non trouvée en DB`);
      return false;
    }

    let participants = sessionData.participants;

    if (typeof participants === "string") {
      participants = JSON.parse(participants);
    }

    if (!Array.isArray(participants)) {
      console.log(`❌ Participants n'est pas un array en DB`);
      return false;
    }

    const found = participants.find((p) => p && p.id === participantId);

    console.log(`📊 Vérification SQL:`, {
      totalParticipants: participants.length,
      participantFound: !!found,
      searchedId: participantId,
    });

    return !!found;
  } catch (error) {
    console.error(`❌ Erreur vérification SQL:`, error.message);
    return false;
  }
};

// Méthode pour nettoyer/réparer une session spécifique
Session.prototype.repairParticipantsSQL = async function () {
  console.log(`🔧 Réparation SQL session ${this.id}`);

  try {
    const [sessionData] = await sequelize.query(
      `SELECT participants FROM sessions WHERE id = :sessionId`,
      {
        type: QueryTypes.SELECT,
        replacements: { sessionId: this.id },
      }
    );

    let participants = sessionData.participants;
    let needsRepair = false;

    if (typeof participants === "string") {
      try {
        participants = JSON.parse(participants);
      } catch {
        participants = [];
        needsRepair = true;
      }
    }

    if (!Array.isArray(participants)) {
      participants = [];
      needsRepair = true;
    }

    if (needsRepair) {
      await sequelize.query(
        `UPDATE sessions SET participants = :participants WHERE id = :sessionId`,
        {
          type: QueryTypes.UPDATE,
          replacements: {
            sessionId: this.id,
            participants: JSON.stringify(participants),
          },
        }
      );

      console.log(`✅ Session réparée: participants -> array vide`);
    }

    return participants;
  } catch (error) {
    console.error(`❌ Erreur réparation SQL:`, error.message);
    throw error;
  }
};

// Hook beforeCreate simplifié
Session.addHook("beforeCreate", (session) => {
  console.log(`🪝 beforeCreate - nouvelle session`);

  if (!session.code) {
    session.code = generateSessionCode();
  }

  // Initialisation SIMPLE
  if (!Array.isArray(session.participants)) {
    session.participants = [];
  }
  if (!session.responses || typeof session.responses !== "object") {
    session.responses = {};
  }
  if (!session.settings || typeof session.settings !== "object") {
    session.settings = {
      allowAnonymous: true,
      allowLateJoin: false,
      showLeaderboard: true,
      maxParticipants: 100,
      autoAdvance: false,
      shuffleQuestions: false,
      shuffleAnswers: false,
    };
  }

  session.stats = calculateSessionStats(session);
});

// Hook beforeUpdate très simplifié - ÉVITER LES MODIFICATIONS AUTOMATIQUES
Session.addHook("beforeUpdate", (session) => {
  console.log(`🪝 beforeUpdate - session ${session.id}`);
  console.log(`   Champs modifiés:`, session.changed());

  // SEULEMENT recalculer les stats si participants ou responses changent
  if (session.changed("participants") || session.changed("responses")) {
    console.log(`📊 beforeUpdate: Recalcul des stats uniquement`);
    session.stats = calculateSessionStats(session);
  }

  // ⚠️ NE PAS MODIFIER participants ici pour éviter les conflits
});

// Hook afterFind pour nettoyer seulement à la lecture
Session.addHook("afterFind", (result) => {
  if (!result) return;

  const sessions = Array.isArray(result) ? result : [result];

  sessions.forEach((session) => {
    if (!session) return;

    // 🔧 CORRECTION : Parser le JSON au lieu de l'effacer
    if (session.participants && typeof session.participants === "string") {
      try {
        console.log(
          `🔧 afterFind: Parsing JSON participants pour session ${session.id}`
        );
        session.participants = JSON.parse(session.participants);
      } catch (parseError) {
        console.log(
          `⚠️ afterFind: Erreur parsing JSON, initialisation array vide`
        );
        session.participants = [];
      }
    }

    // Seulement initialiser si null/undefined, pas si c'est un string valide
    if (!session.participants) {
      console.log(
        `🔧 afterFind: Initialisation participants vides pour session ${session.id}`
      );
      session.participants = [];
    }

    // S'assurer que c'est un array à la fin
    if (!Array.isArray(session.participants)) {
      console.log(
        `🔧 afterFind: Force conversion array pour session ${session.id}`
      );
      session.participants = [];
    }

    // Même traitement pour responses
    if (session.responses && typeof session.responses === "string") {
      try {
        session.responses = JSON.parse(session.responses);
      } catch (parseError) {
        session.responses = {};
      }
    }
    if (!session.responses || typeof session.responses !== "object") {
      session.responses = {};
    }

    // Même traitement pour settings
    if (session.settings && typeof session.settings === "string") {
      try {
        session.settings = JSON.parse(session.settings);
      } catch (parseError) {
        session.settings = {
          allowAnonymous: true,
          allowLateJoin: false,
          showLeaderboard: true,
          maxParticipants: 100,
          autoAdvance: false,
          shuffleQuestions: false,
          shuffleAnswers: false,
        };
      }
    }
  });
});

// 🔧 FONCTION UTILITAIRE pour calculer participantCount correct
Session.prototype.getParticipantCount = function () {
  if (!this.participants) return 0;

  let participants = this.participants;

  // Parse si c'est un string JSON
  if (typeof participants === "string") {
    try {
      participants = JSON.parse(participants);
    } catch {
      return 0;
    }
  }

  // Compter seulement les participants valides
  if (Array.isArray(participants)) {
    return participants.filter((p) => p && p.id && p.name).length;
  }

  return 0;
};

// 🔧 MÉTHODE pour obtenir les participants nettoyés
Session.prototype.getCleanParticipants = function () {
  if (!this.participants) return [];

  let participants = this.participants;

  // Parse si c'est un string JSON
  if (typeof participants === "string") {
    try {
      participants = JSON.parse(participants);
    } catch {
      return [];
    }
  }

  // Retourner seulement les participants valides
  if (Array.isArray(participants)) {
    return participants.filter((p) => p && p.id && p.name);
  }

  return [];
};

Session.prototype.debugParticipants = function () {
  console.log(`\n📊 === DEBUG PARTICIPANTS SESSION ${this.id} ===`);
  console.log(`   Code: ${this.code}`);
  console.log(`   Status: ${this.status}`);
  console.log(`   Type participants: ${typeof this.participants}`);
  console.log(`   Is Array: ${Array.isArray(this.participants)}`);
  console.log(`   Length: ${this.participants?.length || "undefined"}`);

  if (Array.isArray(this.participants)) {
    console.log(`   Participants détails:`);
    this.participants.forEach((p, i) => {
      console.log(
        `      ${i + 1}. ${p?.name || "NO_NAME"} (ID: ${p?.id || "NO_ID"})`
      );
    });
  } else {
    console.log(`   Valeur brute:`, this.participants);
  }
  console.log(`=== FIN DEBUG ===\n`);

  return this.participants;
};

// Méthodes d'instance

// Ajouter un participant
// Session.prototype.addParticipant = function (participantData) {
//   const { id, name, isAnonymous = false, userId = null } = participantData;

//   // Validation
//   if (!id || typeof id !== "string") {
//     throw new Error("ID de participant requis");
//   }

//   if (!name || typeof name !== "string" || name.trim().length < 2) {
//     throw new Error("Nom de participant requis (minimum 2 caractères)");
//   }

//   const participants = Array.isArray(this.participants)
//     ? [...this.participants]
//     : [];

//   // Vérifier si le participant existe déjà
//   const existingParticipant = participants.find((p) => p.id === id);
//   if (existingParticipant) {
//     throw new Error(`Participant avec l'ID ${id} existe déjà`);
//   }

//   // Vérifier si le nom est déjà utilisé
//   const duplicateName = participants.find(
//     (p) => p.name.toLowerCase() === name.toLowerCase()
//   );
//   if (duplicateName) {
//     throw new Error(`Le nom "${name}" est déjà utilisé`);
//   }

//   // Vérifier la limite de participants
//   const maxParticipants = this.settings?.maxParticipants || 100;
//   if (participants.length >= maxParticipants) {
//     throw new Error(`Limite de participants atteinte (${maxParticipants})`);
//   }

//   // Créer le nouveau participant
//   const newParticipant = {
//     id,
//     name: name.trim(),
//     isAnonymous,
//     userId,
//     joinedAt: new Date().toISOString(),
//     score: 0,
//     answeredQuestions: 0,
//   };

//   participants.push(newParticipant);

//   return this.update({
//     participants,
//     stats: calculateSessionStats({ ...this.toJSON(), participants }),
//   });
// };

Session.prototype.repairParticipants = async function () {
  console.log(`🔧 Réparation participants pour session ${this.id}`);

  let participants = this.participants;
  let needsRepair = false;

  // Cas 1: Pas un tableau
  if (!Array.isArray(participants)) {
    console.log(`   Correction: ${typeof participants} -> array`);
    participants = [];
    needsRepair = true;
  }

  // Cas 2: Participants invalides
  if (Array.isArray(participants)) {
    const validParticipants = participants.filter((p) => {
      return (
        p &&
        typeof p === "object" &&
        p.id &&
        typeof p.id === "string" &&
        p.name &&
        typeof p.name === "string"
      );
    });

    if (validParticipants.length !== participants.length) {
      console.log(
        `   Nettoyage: ${participants.length} -> ${validParticipants.length}`
      );
      participants = validParticipants;
      needsRepair = true;
    }
  }

  if (needsRepair) {
    await this.update({ participants }, { validate: false });
    console.log(`✅ Participants réparés`);
  } else {
    console.log(`✅ Participants déjà valides`);
  }

  return participants;
};

// Retirer un participant
Session.prototype.removeParticipant = function (participantId) {
  const participants = Array.isArray(this.participants)
    ? [...this.participants]
    : [];

  const filteredParticipants = participants.filter(
    (p) => p.id !== participantId
  );

  if (filteredParticipants.length === participants.length) {
    throw new Error(`Participant avec l'ID ${participantId} non trouvé`);
  }

  return this.update({
    participants: filteredParticipants,
    stats: calculateSessionStats({
      ...this.toJSON(),
      participants: filteredParticipants,
    }),
  });
};

// Ajouter une réponse
Session.prototype.addResponse = function (responseData) {
  const { questionId, participantId, answer, submittedAt, timeSpent } =
    responseData;

  // Validation
  if (!questionId || !participantId) {
    throw new Error("questionId et participantId sont requis");
  }

  const responses = { ...this.responses };

  // Initialiser le tableau des réponses pour cette question si nécessaire
  if (!Array.isArray(responses[questionId])) {
    responses[questionId] = [];
  }

  // Vérifier si le participant a déjà répondu à cette question
  const existingResponse = responses[questionId].find(
    (r) => r.participantId === participantId
  );
  if (existingResponse) {
    throw new Error(
      `Le participant ${participantId} a déjà répondu à la question ${questionId}`
    );
  }

  // Ajouter la réponse
  const newResponse = {
    participantId,
    answer,
    submittedAt: submittedAt || new Date().toISOString(),
    timeSpent: timeSpent || null,
    points: 0, // À calculer selon la logique métier
    isCorrect: false, // À calculer selon la logique métier
  };

  responses[questionId].push(newResponse);

  return this.update({
    responses,
    stats: calculateSessionStats({ ...this.toJSON(), responses }),
  });
};

// Démarrer la session
Session.prototype.startSession = function () {
  if (this.status !== "waiting") {
    throw new Error(
      "La session ne peut être démarrée que depuis l'état 'waiting'"
    );
  }

  const participants = Array.isArray(this.participants)
    ? this.participants
    : [];
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

// Mettre en pause la session
Session.prototype.pauseSession = function () {
  if (this.status !== "active") {
    throw new Error("Seules les sessions actives peuvent être mises en pause");
  }

  return this.update({
    status: "paused",
  });
};

// Reprendre la session
Session.prototype.resumeSession = function () {
  if (this.status !== "paused") {
    throw new Error("Seules les sessions en pause peuvent être reprises");
  }

  return this.update({
    status: "active",
    currentQuestionStartedAt: new Date(),
  });
};

// Terminer la session
Session.prototype.endSession = function () {
  if (!["active", "paused"].includes(this.status)) {
    throw new Error(
      "Seules les sessions actives ou en pause peuvent être terminées"
    );
  }

  const now = new Date();
  const finalStats = calculateSessionStats(this);

  return this.update({
    status: "finished",
    endedAt: now,
    stats: {
      ...finalStats,
      duration: this.startedAt
        ? Math.round((now - new Date(this.startedAt)) / 1000)
        : 0,
    },
  });
};

// Obtenir les résultats d'une question
Session.prototype.getQuestionResults = function (questionId) {
  const responses = this.responses || {};
  const questionResponses = responses[questionId] || [];
  const participants = Array.isArray(this.participants)
    ? this.participants
    : [];

  let correctCount = 0;
  let totalTimeSpent = 0;

  const results = {
    questionId,
    totalResponses: questionResponses.length,
    totalParticipants: participants.length,
    responses: [],
    stats: {
      correctAnswers: 0,
      averageTimeSpent: 0,
      responseRate: 0,
    },
  };

  questionResponses.forEach((response) => {
    const participant = participants.find(
      (p) => p.id === response.participantId
    );

    const responseData = {
      participantId: response.participantId,
      participantName: participant?.name || "Participant inconnu",
      answer: response.answer,
      submittedAt: response.submittedAt,
      timeSpent: response.timeSpent || 0,
      points: response.points || 0,
      isCorrect: response.isCorrect || false,
    };

    results.responses.push(responseData);

    if (response.isCorrect) {
      correctCount++;
    }

    totalTimeSpent += response.timeSpent || 0;
  });

  // Calculer les statistiques
  if (questionResponses.length > 0) {
    results.stats.averageTimeSpent = Math.round(
      totalTimeSpent / questionResponses.length
    );
    results.stats.correctAnswers = correctCount;
    results.stats.responseRate = Math.round(
      (questionResponses.length / participants.length) * 100
    );
  }

  return results;
};

// Méthodes statiques

// Trouver par code
Session.findByCode = function (code) {
  if (!code || typeof code !== "string") {
    return Promise.resolve(null);
  }

  return this.findOne({
    where: { code: code.toUpperCase().trim() },
  });
};

// Trouver les sessions actives d'un hôte
Session.findActiveByHost = function (hostId) {
  return this.findAll({
    where: {
      hostId,
      status: ["waiting", "active", "paused"],
    },
    order: [["createdAt", "DESC"]],
  });
};

// Trouver les sessions d'un quiz
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

// Générer un code unique
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

// Scopes pour les requêtes courantes
Session.addScope("active", {
  where: { status: ["waiting", "active", "paused"] },
});

Session.addScope("finished", {
  where: { status: ["finished", "cancelled"] },
});

Session.addScope("withQuiz", {
  include: [
    {
      association: "quiz",
    },
  ],
});

Session.addScope("withHost", {
  include: [
    {
      association: "host",
      attributes: ["id", "username", "firstName", "lastName"],
    },
  ],
});

// Exporter les fonctions utilitaires
Session.calculateSessionStats = calculateSessionStats;
Session.generateSessionCode = generateSessionCode;

module.exports = Session;
