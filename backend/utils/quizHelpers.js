// backend/utils/quizHelpers.js
/**
 * Utilitaires pour la gestion des quiz et du scoring
 */

/**
 * Normalise une valeur Vrai/Faux en chaîne standard "true" ou "false"
 * @param {*} value - Valeur à normaliser (boolean, number, string)
 * @returns {string} "true" ou "false"
 */
const normalizeVraiFauxValue = (value) => {
    if (typeof value === "boolean") {
      return value ? "true" : "false";
    }
  
    if (typeof value === "number") {
      return value === 0 ? "true" : "false";
    }
  
    if (typeof value === "string") {
      const lower = value.toLowerCase().trim();
      if (["vrai", "true", "1", "oui", "yes"].includes(lower)) {
        return "true";
      }
      if (["faux", "false", "0", "non", "no"].includes(lower)) {
        return "false";
      }
    }
  
    return "true"; // Défaut
  };
  
  /**
   * Valide une réponse QCM
   * @param {*} answer - Réponse donnée (index ou texte)
   * @param {Object} question - Objet question avec options
   * @returns {boolean} true si correcte
   */
  const validateQCMAnswer = (answer, question) => {
    if (!question.options || !Array.isArray(question.options)) {
      return false;
    }
  
    const correctOptions = question.options.filter((opt) => opt.isCorrect);
  
    // Si réponse par index
    const answerIndex = parseInt(answer);
    if (!isNaN(answerIndex) && answerIndex >= 0 && answerIndex < question.options.length) {
      return question.options[answerIndex].isCorrect === true;
    }
  
    // Si réponse par texte ou ID
    return correctOptions.some(
      (opt) =>
        opt.text === answer ||
        opt.id === answer ||
        opt.text.toLowerCase().trim() === String(answer).toLowerCase().trim()
    );
  };
  
  /**
   * Valide une réponse Vrai/Faux
   * @param {*} answer - Réponse donnée
   * @param {Object} question - Objet question
   * @returns {boolean} true si correcte
   */
  const validateVraiFauxAnswer = (answer, question) => {
    const normalizedAnswer = normalizeVraiFauxValue(answer);
    const normalizedCorrect = normalizeVraiFauxValue(question.correctAnswer);
  
    return normalizedAnswer === normalizedCorrect;
  };
  
  /**
   * Valide une réponse libre
   * @param {string} answer - Réponse donnée
   * @param {Object} question - Objet question
   * @param {number} similarityThreshold - Seuil de similarité (0-1)
   * @returns {Object} { isCorrect, similarity }
   */
  const validateReponsLibreAnswer = (answer, question, similarityThreshold = 0.9) => {
    const userAnswer = String(answer).toLowerCase().trim();
    const correctAnswer = String(question.correctAnswer).toLowerCase().trim();
  
    // Correspondance exacte
    if (userAnswer === correctAnswer) {
      return { isCorrect: true, similarity: 1.0 };
    }
  
    // Vérifier similarité si l'option est activée
    if (correctAnswer.length > 3 && similarityThreshold > 0) {
      const similarity = calculateSimilarity(userAnswer, correctAnswer);
      return {
        isCorrect: similarity >= similarityThreshold,
        similarity: similarity,
      };
    }
  
    return { isCorrect: false, similarity: 0 };
  };
  
  /**
   * Valide une réponse de type nuage de mots
   * @param {Array} answer - Tableau de mots
   * @param {Object} question - Objet question
   * @returns {Object} { isCorrect, validWords, points }
   */
  const validateNuageMotsAnswer = (answer, question) => {
    // Valider que c'est un tableau
    if (!Array.isArray(answer)) {
      return { isCorrect: false, validWords: [], points: 0 };
    }
  
    // Limiter à 5 mots maximum
    const limitedWords = answer.slice(0, 5);
  
    // Valider chaque mot
    const validWords = limitedWords.filter((word) => {
      if (typeof word !== "string") return false;
      const trimmed = word.trim();
      return trimmed.length >= 2 && trimmed.length <= 50;
    });
  
    if (validWords.length === 0) {
      return { isCorrect: false, validWords: [], points: 0 };
    }
  
    // Pour le nuage de mots, on attribue des points pour la participation
    const basePoints = Math.min(validWords.length, question.points || 1);
  
    return {
      isCorrect: true,
      validWords: validWords,
      points: basePoints,
    };
  };
  
  /**
   * Calcule la similarité entre deux chaînes (distance de Levenshtein normalisée)
   * @param {string} str1 - Première chaîne
   * @param {string} str2 - Deuxième chaîne
   * @returns {number} Similarité entre 0 et 1
   */
  const calculateSimilarity = (str1, str2) => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
  
    if (longer.length === 0) return 1.0;
  
    const editDistance = getEditDistance(shorter, longer);
    return (longer.length - editDistance) / longer.length;
  };
  
  /**
   * Calcule la distance de Levenshtein entre deux chaînes
   * @param {string} str1 - Première chaîne
   * @param {string} str2 - Deuxième chaîne
   * @returns {number} Distance d'édition
   */
  const getEditDistance = (str1, str2) => {
    const costs = [];
    for (let i = 0; i <= str1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= str2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (str1.charAt(i - 1) !== str2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[str2.length] = lastValue;
    }
    return costs[str2.length];
  };
  
  /**
   * Calcule les statistiques d'une session
   * @param {Object} sessionData - Données de session (participants, responses)
   * @returns {Object} Statistiques calculées
   */
  const calculateSessionStats = (sessionData) => {
    const participants = Array.isArray(sessionData.participants)
      ? sessionData.participants
      : [];
    const responses = sessionData.responses || {};
  
    const totalParticipants = participants.length;
  
    // Calculer le nombre total de réponses
    const totalResponses = Object.keys(responses).reduce((total, questionId) => {
      const questionResponses = responses[questionId];
      return total + (Array.isArray(questionResponses) ? questionResponses.length : 0);
    }, 0);
  
    // Calculer les statistiques des participants
    let totalScore = 0;
    let activeParticipants = 0;
    let totalCorrectAnswers = 0;
    let totalQuestionsAnswered = 0;
    let totalTimeSpent = 0;
    let bestScore = 0;
    let worstScore = Number.MAX_SAFE_INTEGER;
  
    participants.forEach((participant) => {
      if (participant && typeof participant === "object") {
        const score = participant.score || 0;
        const correctAnswers = participant.correctAnswers || 0;
        const totalQuestions = participant.totalQuestions || 0;
  
        if (typeof score === "number" && !isNaN(score)) {
          totalScore += score;
          activeParticipants++;
  
          bestScore = Math.max(bestScore, score);
          if (worstScore === Number.MAX_SAFE_INTEGER) {
            worstScore = score;
          } else {
            worstScore = Math.min(worstScore, score);
          }
        }
  
        totalCorrectAnswers += correctAnswers;
        totalQuestionsAnswered += totalQuestions;
  
        if (participant.responses) {
          Object.values(participant.responses).forEach((response) => {
            if (response && typeof response.timeSpent === "number") {
              totalTimeSpent += response.timeSpent;
            }
          });
        }
      }
    });
  
    // Calculer les moyennes
    const averageScore =
      activeParticipants > 0
        ? Math.round((totalScore / activeParticipants) * 100) / 100
        : 0;
  
    const participationRate =
      totalParticipants > 0
        ? Math.round((activeParticipants / totalParticipants) * 100)
        : 0;
  
    const accuracyRate =
      totalQuestionsAnswered > 0
        ? Math.round((totalCorrectAnswers / totalQuestionsAnswered) * 100)
        : 0;
  
    const averageTimePerQuestion =
      totalQuestionsAnswered > 0
        ? Math.round(totalTimeSpent / totalQuestionsAnswered)
        : 0;
  
    // Réinitialiser les scores min/max si pas de participants actifs
    if (activeParticipants === 0) {
      bestScore = 0;
      worstScore = 0;
    }
  
    // Calculer les stats par question
    const questionStats = {};
    Object.keys(responses).forEach((questionId) => {
      const questionResponses = responses[questionId];
      if (Array.isArray(questionResponses)) {
        const correctCount = questionResponses.filter((r) => r.isCorrect).length;
        const avgTime =
          questionResponses.length > 0
            ? questionResponses.reduce((sum, r) => sum + (r.timeSpent || 0), 0) /
              questionResponses.length
            : 0;
  
        questionStats[questionId] = {
          totalResponses: questionResponses.length,
          correctResponses: correctCount,
          accuracyRate:
            questionResponses.length > 0
              ? Math.round((correctCount / questionResponses.length) * 100)
              : 0,
          averageTimeSpent: Math.round(avgTime),
          responseRate:
            totalParticipants > 0
              ? Math.round((questionResponses.length / totalParticipants) * 100)
              : 0,
        };
      }
    });
  
    return {
      // Stats générales
      totalParticipants,
      activeParticipants,
      totalResponses,
  
      // Stats de performance
      averageScore,
      bestScore,
      worstScore,
      totalCorrectAnswers,
      totalQuestionsAnswered,
      accuracyRate,
  
      // Stats d'engagement
      participationRate,
      averageTimePerQuestion,
      totalTimeSpent,
  
      // Stats détaillées par question
      questionStats,
  
      // Timestamps
      calculatedAt: new Date(),
    };
  };
  
  /**
   * Génère un code de session unique
   * @param {number} length - Longueur du code (défaut: 6)
   * @returns {string} Code généré
   */
  const generateSessionCode = (length = 6) => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Sans I, O, 0, 1 pour éviter confusion
    let code = "";
    for (let i = 0; i < length; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };
  
  module.exports = {
    normalizeVraiFauxValue,
    validateQCMAnswer,
    validateVraiFauxAnswer,
    validateReponsLibreAnswer,
    validateNuageMotsAnswer,
    calculateSimilarity,
    getEditDistance,
    calculateSessionStats,
    generateSessionCode,
  };