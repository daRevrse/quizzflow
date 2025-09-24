// src/utils/quizUtils.js

/**
 * Calcule les statistiques d'un quiz basé sur ses questions
 * @param {Array} questions - Tableau des questions du quiz
 * @returns {Object} Statistiques calculées
 */
export const calculateQuizStats = (questions = []) => {
  if (!Array.isArray(questions) || questions.length === 0) {
    return {
      questionCount: 0,
      totalPoints: 0,
      estimatedDuration: 0,
      estimatedMinutes: 0,
      averagePointsPerQuestion: 0,
      averageTimePerQuestion: 0,
    };
  }

  const questionCount = questions.length;
  const totalPoints = questions.reduce((sum, q) => {
    const points = parseInt(q?.points, 10) || 1;
    return sum + points;
  }, 0);

  const estimatedDuration = questions.reduce((sum, q) => {
    const timeLimit = parseInt(q?.timeLimit, 10) || 30;
    return sum + timeLimit;
  }, 0);

  return {
    questionCount,
    totalPoints,
    estimatedDuration, // en secondes
    estimatedMinutes: Math.ceil(estimatedDuration / 60),
    averagePointsPerQuestion:
      Math.round((totalPoints / questionCount) * 10) / 10,
    averageTimePerQuestion: Math.round(estimatedDuration / questionCount),
  };
};

/**
 * Valide une question selon son type
 * @param {Object} question - Question à valider
 * @param {number} index - Index de la question pour les messages d'erreur
 * @returns {Array} Tableau des erreurs de validation
 */
export const validateQuestion = (question, index) => {
  const errors = [];
  const questionNumber = index + 1;

  // Validation du texte de la question
  if (!question.question?.trim()) {
    errors.push(`Question ${questionNumber}: Le texte est requis`);
  }

  // Validation des points
  const points = parseInt(question.points, 10);
  if (isNaN(points) || points < 1 || points > 100) {
    errors.push(
      `Question ${questionNumber}: Les points doivent être entre 1 et 100`
    );
  }

  // Validation du temps limite
  const timeLimit = parseInt(question.timeLimit, 10);
  if (isNaN(timeLimit) || timeLimit < 5 || timeLimit > 300) {
    errors.push(
      `Question ${questionNumber}: Le temps limite doit être entre 5 et 300 secondes`
    );
  }

  // Validation selon le type de question
  switch (question.type) {
    case "qcm":
      const validOptions =
        question.options?.filter((opt) => opt.text?.trim()) || [];
      const correctOptions = validOptions.filter((opt) => opt.isCorrect);

      if (validOptions.length < 2) {
        errors.push(
          `Question ${questionNumber}: Au moins 2 options requises pour un QCM`
        );
      }
      if (correctOptions.length === 0) {
        errors.push(
          `Question ${questionNumber}: Au moins une réponse correcte requise`
        );
      }
      break;

    case "vrai_faux":
      if (
        !question.correctAnswer ||
        (question.correctAnswer !== "true" &&
          question.correctAnswer !== "false")
      ) {
        errors.push(
          `Question ${questionNumber}: Réponse correcte requise pour Vrai/Faux`
        );
      }
      break;

    case "reponse_libre":
      if (!question.correctAnswer?.trim()) {
        errors.push(
          `Question ${questionNumber}: Réponse correcte requise pour une réponse libre`
        );
      }
      break;

    case "nuage_mots":
      // Pas de validation spécifique pour les nuages de mots
      break;

    default:
      errors.push(`Question ${questionNumber}: Type de question invalide`);
  }

  return errors;
};

/**
 * Nettoie les données d'une question selon son type
 * @param {Object} question - Question à nettoyer
 * @param {number} order - Ordre de la question
 * @returns {Object} Question nettoyée
 */
export const cleanQuestionData = (question, order) => {
  const baseQuestion = {
    ...question,
    order: order + 1,
    points: parseInt(question.points, 10) || 1,
    timeLimit: parseInt(question.timeLimit, 10) || 30,
    id: question.id || `temp_${Date.now()}_${order}`,
  };

  switch (question.type) {
    case "qcm":
      return {
        ...baseQuestion,
        options: question.options?.filter((opt) => opt.text?.trim()) || [],
        correctAnswer: undefined, // Supprimer correctAnswer pour QCM
      };

    case "vrai_faux":
      return {
        ...baseQuestion,
        options: [], // Pas d'options pour vrai/faux
        correctAnswer: question.correctAnswer, // Garder "true" ou "false"
      };

    case "reponse_libre":
      return {
        ...baseQuestion,
        options: [], // Pas d'options
        correctAnswer: question.correctAnswer?.trim() || "",
      };

    case "nuage_mots":
      return {
        ...baseQuestion,
        options: [], // Pas d'options
        correctAnswer: question.correctAnswer || "",
      };

    default:
      return baseQuestion;
  }
};

/**
 * Formats pour l'importation en masse
 */
export const BULK_IMPORT_FORMATS = {
  CSV: "csv",
  JSON: "json",
  TEXT: "text",
};

/**
 * Parse les questions depuis différents formats
 * @param {string} content - Contenu à parser
 * @param {string} format - Format du contenu
 * @returns {Array} Questions parsées
 */
export const parseBulkQuestions = (content, format) => {
  switch (format) {
    case BULK_IMPORT_FORMATS.CSV:
      return parseCSVQuestions(content);
    case BULK_IMPORT_FORMATS.JSON:
      return parseJSONQuestions(content);
    case BULK_IMPORT_FORMATS.TEXT:
      return parseTextQuestions(content);
    default:
      throw new Error(`Format non supporté: ${format}`);
  }
};

/**
 * Parse les questions depuis un CSV
 * Format: Question,Type,Option1,Option2,Option3,Option4,CorrectAnswer,Points,TimeLimit,Explanation
 */
const parseCSVQuestions = (csvContent) => {
  const lines = csvContent.trim().split("\n");
  const headers = lines[0].split(",");

  // Vérifier les headers requis
  const requiredHeaders = ["Question", "Type"];
  const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));
  if (missingHeaders.length > 0) {
    throw new Error(`Headers manquants: ${missingHeaders.join(", ")}`);
  }

  const questions = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",");
    const question = {};

    headers.forEach((header, index) => {
      question[header] = values[index]?.trim() || "";
    });

    if (!question.Question) continue;

    const parsedQuestion = {
      question: question.Question,
      type: question.Type?.toLowerCase() || "qcm",
      points: parseInt(question.Points, 10) || 1,
      timeLimit: parseInt(question.TimeLimit, 10) || 30,
      explanation: question.Explanation || "",
    };

    // Parser les options selon le type
    if (parsedQuestion.type === "qcm") {
      const options = [];
      ["Option1", "Option2", "Option3", "Option4"].forEach((optKey) => {
        if (question[optKey]) {
          options.push({
            text: question[optKey],
            isCorrect: question[optKey] === question.CorrectAnswer,
          });
        }
      });
      parsedQuestion.options = options;
    } else if (parsedQuestion.type === "vrai_faux") {
      parsedQuestion.correctAnswer =
        question.CorrectAnswer?.toLowerCase() === "vrai" ? "true" : "false";
    } else {
      parsedQuestion.correctAnswer = question.CorrectAnswer || "";
    }

    questions.push(parsedQuestion);
  }

  return questions;
};

/**
 * Parse les questions depuis du JSON
 */
const parseJSONQuestions = (jsonContent) => {
  try {
    const data = JSON.parse(jsonContent);
    if (!Array.isArray(data)) {
      throw new Error("Le JSON doit contenir un tableau de questions");
    }
    return data;
  } catch (error) {
    throw new Error(`Erreur de parsing JSON: ${error.message}`);
  }
};

/**
 * Parse les questions depuis du texte simple
 * Format: Une question par ligne, séparateur "|" pour les métadonnées
 * Exemple: "Quelle est la capitale de la France?|qcm|Paris,London,Berlin,Madrid|Paris|2|45"
 */
const parseTextQuestions = (textContent) => {
  const lines = textContent.trim().split("\n");
  const questions = [];

  lines.forEach((line, index) => {
    if (!line.trim()) return;

    const parts = line.split("|");
    if (parts.length < 2) {
      throw new Error(`Ligne ${index + 1}: Format invalide`);
    }

    const question = {
      question: parts[0].trim(),
      type: parts[1]?.trim().toLowerCase() || "qcm",
      points: parseInt(parts[4], 10) || 1,
      timeLimit: parseInt(parts[5], 10) || 30,
      explanation: parts[6] || "",
    };

    // Parser selon le type
    if (question.type === "qcm" && parts[2] && parts[3]) {
      const optionTexts = parts[2].split(",").map((opt) => opt.trim());
      const correctAnswer = parts[3].trim();

      question.options = optionTexts.map((text) => ({
        text,
        isCorrect: text === correctAnswer,
      }));
    } else if (question.type === "vrai_faux") {
      question.correctAnswer =
        parts[3]?.toLowerCase() === "vrai" ? "true" : "false";
    } else {
      question.correctAnswer = parts[3] || "";
    }

    questions.push(question);
  });

  return questions;
};

/**
 * Génère un template CSV pour l'import
 */
export const generateCSVTemplate = () => {
  const headers = [
    "Question",
    "Type",
    "Option1",
    "Option2",
    "Option3",
    "Option4",
    "CorrectAnswer",
    "Points",
    "TimeLimit",
    "Explanation",
  ];

  const examples = [
    [
      "Quelle est la capitale de la France?",
      "qcm",
      "Paris",
      "London",
      "Berlin",
      "Madrid",
      "Paris",
      "2",
      "30",
      "Paris est la capitale et plus grande ville de France",
    ],
    [
      "La Terre est ronde",
      "vrai_faux",
      "",
      "",
      "",
      "",
      "true",
      "1",
      "15",
      "La Terre a une forme sphérique",
    ],
    [
      "Combien font 2+2?",
      "reponse_libre",
      "",
      "",
      "",
      "",
      "4",
      "1",
      "20",
      "Addition simple",
    ],
  ];

  return [headers, ...examples].map((row) => row.join(",")).join("\n");
};
