const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Quiz = sequelize.define(
  "Quiz",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 200],
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 1000],
      },
    },
    creatorId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },
    questions: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      get() {
        const rawValue = this.getDataValue("questions");
        if (typeof rawValue === "string") {
          try {
            return JSON.parse(rawValue);
          } catch (e) {
            console.error("Erreur parsing questions:", e);
            return [];
          }
        }
        return rawValue || [];
      },
      set(value) {
        this.setDataValue("questions", Array.isArray(value) ? value : []);
      },
      validate: {
        isValidQuestions(value) {
          if (!Array.isArray(value)) {
            throw new Error("Les questions doivent être un tableau");
          }

          value.forEach((question, index) => {
            if (
              !question.type ||
              !["qcm", "vrai_faux", "reponse_libre", "nuage_mots"].includes(
                question.type
              )
            ) {
              throw new Error(`Type de question invalide à l'index ${index}`);
            }
            if (!question.question || question.question.trim().length === 0) {
              throw new Error(`Question vide à l'index ${index}`);
            }
            if (
              question.type === "qcm" &&
              (!question.options || question.options.length < 2)
            ) {
              throw new Error(
                `QCM doit avoir au moins 2 options à l'index ${index}`
              );
            }
          });
        },
      },
    },
    settings: {
      type: DataTypes.JSON,
      defaultValue: {
        isPublic: false,
        allowAnonymous: true,
        showResults: true,
        showCorrectAnswers: true,
        randomizeQuestions: false,
        randomizeOptions: false,
        maxAttempts: 1,
        passingScore: 50,
      },
      validate: {
        isValidSettings(value) {
          if (value && typeof value === "object") {
            const { maxAttempts, passingScore } = value;
            if (maxAttempts && (maxAttempts < 1 || maxAttempts > 10)) {
              throw new Error("maxAttempts doit être entre 1 et 10");
            }
            if (passingScore && (passingScore < 0 || passingScore > 100)) {
              throw new Error("passingScore doit être entre 0 et 100");
            }
          }
        },
      },
    },
    category: {
      type: DataTypes.STRING(50),
      allowNull: true,
      validate: {
        len: [0, 50],
      },
    },
    tags: {
      type: DataTypes.JSON,
      defaultValue: [],
      get() {
        const rawValue = this.getDataValue("tags");
        if (typeof rawValue === "string") {
          try {
            return JSON.parse(rawValue);
          } catch (e) {
            console.error("Erreur parsing tags:", e);
            return [];
          }
        }
        return rawValue || [];
      },
      set(value) {
        this.setDataValue("tags", Array.isArray(value) ? value : []);
      },
      validate: {
        isArrayOfStrings(value) {
          if (!Array.isArray(value)) {
            throw new Error("Les tags doivent être un tableau");
          }
          if (value.some((tag) => typeof tag !== "string" || tag.length > 30)) {
            throw new Error(
              "Chaque tag doit être une chaîne de moins de 30 caractères"
            );
          }
        },
      },
    },
    difficulty: {
      type: DataTypes.ENUM("facile", "moyen", "difficile"),
      defaultValue: "moyen",
    },
    estimatedDuration: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    stats: {
      type: DataTypes.JSON,
      defaultValue: {
        totalSessions: 0,
        totalParticipants: 0,
        averageScore: 0,
        lastUsed: null,
      },
    },
  },
  {
    tableName: "quizzes",
    indexes: [
      {
        fields: ["creatorId", "createdAt"],
      },
      {
        fields: ["category"],
      },
      {
        fields: ["isActive"],
      },
      {
        fields: ["difficulty"],
      },
      {
        type: "FULLTEXT",
        fields: ["title", "description"],
      },
    ],
    hooks: {
      beforeSave: (quiz) => {
        // Calculer la durée estimée basée sur les questions
        if (quiz.questions && quiz.questions.length > 0) {
          const totalTime = quiz.questions.reduce((total, question) => {
            return total + (question.timeLimit || 30);
          }, 0);
          quiz.estimatedDuration = Math.ceil(totalTime / 60);
        }
      },
    },
  }
);

// Getters virtuels
// Quiz.prototype.getQuestionCount = function () {
//   return this.questions ? this.questions.length : 0;
// };
// Quiz.prototype.getQuestionCount = function () {
//   return Array.isArray(this.questions) ? this.questions.length : 0;
// };
Quiz.prototype.getQuestionCount = function () {
  const questions =
    typeof this.questions === "string"
      ? JSON.parse(this.questions)
      : this.questions;
  return Array.isArray(questions) ? questions.length : 0;
};

// Quiz.prototype.getTotalPoints = function () {
//   if (!this.questions) return 0;
//   return this.questions.reduce((total, question) => {
//     return total + (question.points || 1);
//   }, 0);
// };
// Quiz.prototype.getTotalPoints = function () {
//   if (!Array.isArray(this.questions)) return 0;
//   return this.questions.reduce((total, question) => {
//     return total + (question.points || 1);
//   }, 0);
// };
Quiz.prototype.getTotalPoints = function () {
  const questions =
    typeof this.questions === "string"
      ? JSON.parse(this.questions)
      : this.questions;

  if (!Array.isArray(questions)) return 0;
  return questions.reduce((total, question) => {
    return total + (question.points || 1);
  }, 0);
};

// Méthodes d'instance
Quiz.prototype.getPublicData = function () {
  return {
    id: this.id,
    title: this.title,
    description: this.description,
    category: this.category,
    tags: this.tags,
    difficulty: this.difficulty,
    questionCount: this.getQuestionCount(),
    totalPoints: this.getTotalPoints(),
    estimatedDuration: this.estimatedDuration,
    stats: this.stats,
    createdAt: this.createdAt,
  };
};

Quiz.prototype.incrementStats = async function (
  participantsCount = 1,
  averageScore = null
) {
  const currentStats = this.stats || {
    totalSessions: 0,
    totalParticipants: 0,
    averageScore: 0,
    lastUsed: null,
  };

  currentStats.totalSessions += 1;
  currentStats.totalParticipants += participantsCount;
  currentStats.lastUsed = new Date();

  if (averageScore !== null) {
    // Calcul de la moyenne pondérée
    const totalScore =
      currentStats.averageScore * (currentStats.totalSessions - 1) +
      averageScore;
    currentStats.averageScore = Math.round(
      totalScore / currentStats.totalSessions
    );
  }

  return this.update({ stats: currentStats });
};

Quiz.prototype.addQuestion = function (questionData) {
  const questions = [...(this.questions || [])];
  const newQuestion = {
    id: require("uuid").v4(),
    order: questions.length + 1,
    ...questionData,
  };
  questions.push(newQuestion);
  return this.update({ questions });
};

Quiz.prototype.removeQuestion = function (questionId) {
  const questions = (this.questions || []).filter((q) => q.id !== questionId);
  // Réorganiser les ordres
  questions.forEach((q, index) => {
    q.order = index + 1;
  });
  return this.update({ questions });
};

Quiz.prototype.updateQuestion = function (questionId, questionData) {
  const questions = [...(this.questions || [])];
  const questionIndex = questions.findIndex((q) => q.id === questionId);

  if (questionIndex === -1) {
    throw new Error("Question non trouvée");
  }

  questions[questionIndex] = { ...questions[questionIndex], ...questionData };
  return this.update({ questions });
};

// Méthodes statiques
Quiz.findByCreator = function (creatorId, options = {}) {
  return this.findAll({
    where: {
      creatorId,
      isActive: true,
      ...options.where,
    },
    include: options.include || [
      {
        model: require("./User"),
        as: "creator",
        attributes: ["id", "username", "firstName", "lastName"],
      },
    ],
    order: options.order || [["createdAt", "DESC"]],
    limit: options.limit || 50,
    offset: options.offset || 0,
  });
};

Quiz.findPublicQuizzes = function (options = {}) {
  const whereClause = {
    isActive: true,
  };

  // Filtre pour les quiz publics
  whereClause["settings.isPublic"] = true;

  if (options.category) {
    whereClause.category = options.category;
  }

  if (options.difficulty) {
    whereClause.difficulty = options.difficulty;
  }

  if (options.search) {
    whereClause[sequelize.Sequelize.Op.or] = [
      { title: { [sequelize.Sequelize.Op.like]: `%${options.search}%` } },
      { description: { [sequelize.Sequelize.Op.like]: `%${options.search}%` } },
    ];
  }

  return this.findAll({
    where: whereClause,
    include: [
      {
        model: require("./User"),
        as: "creator",
        attributes: ["id", "username", "firstName", "lastName"],
      },
    ],
    order: options.order || [["stats.totalSessions", "DESC"]],
    limit: options.limit || 20,
    offset: options.offset || 0,
  });
};

Quiz.getCategories = async function () {
  const result = await this.findAll({
    attributes: [
      "category",
      [sequelize.fn("COUNT", sequelize.col("id")), "count"],
    ],
    where: {
      isActive: true,
      category: { [sequelize.Sequelize.Op.not]: null },
    },
    group: ["category"],
    order: [[sequelize.fn("COUNT", sequelize.col("id")), "DESC"]],
    raw: true,
  });

  return result.map((item) => ({
    name: item.category,
    count: parseInt(item.count),
  }));
};

// Scopes
Quiz.addScope("active", {
  where: { isActive: true },
});

Quiz.addScope("public", {
  where: {
    isActive: true,
    "settings.isPublic": true,
  },
});

Quiz.addScope("withCreator", {
  include: [
    {
      model: require("./User"),
      as: "creator",
      attributes: ["id", "username", "firstName", "lastName"],
    },
  ],
});

module.exports = Quiz;
