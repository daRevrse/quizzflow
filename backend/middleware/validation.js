const { body, param, query, validationResult } = require("express-validator");

// Middleware pour gérer les erreurs de validation
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: "Données invalides",
      details: errors.array().map((error) => ({
        field: error.param,
        message: error.msg,
        value: error.value,
      })),
    });
  }
  next();
};

/* =============================
   AUTHENTIFICATION
============================= */
const validateRegistration = [
  body("username")
    .isLength({ min: 3, max: 50 })
    .withMessage("Le nom d'utilisateur doit contenir entre 3 et 50 caractères")
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage(
      "Le nom d'utilisateur ne peut contenir que des lettres, chiffres, _ et -"
    ),
  body("email").isEmail().withMessage("Email invalide").normalizeEmail(),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Le mot de passe doit contenir au moins 6 caractères"),
  body("firstName")
    .optional()
    .isLength({ max: 50 })
    .withMessage("Le prénom ne peut pas dépasser 50 caractères")
    .trim(),
  body("lastName")
    .optional()
    .isLength({ max: 50 })
    .withMessage("Le nom ne peut pas dépasser 50 caractères")
    .trim(),
  body("role")
    .optional()
    .isIn(["formateur", "etudiant"])
    .withMessage('Le rôle doit être "formateur" ou "etudiant"'),
  handleValidationErrors,
];

const validateLogin = [
  body("identifier")
    .notEmpty()
    .withMessage("Email ou nom d'utilisateur requis")
    .trim(),
  body("password").notEmpty().withMessage("Mot de passe requis"),
  handleValidationErrors,
];

const validatePasswordChange = [
  body("currentPassword").notEmpty().withMessage("Mot de passe actuel requis"),
  body("newPassword")
    .isLength({ min: 6 })
    .withMessage("Le nouveau mot de passe doit contenir au moins 6 caractères"),
  handleValidationErrors,
];

const validateProfileUpdate = [
  body("firstName")
    .optional()
    .isLength({ max: 50 })
    .withMessage("Max 50 caractères")
    .trim(),
  body("lastName")
    .optional()
    .isLength({ max: 50 })
    .withMessage("Max 50 caractères")
    .trim(),
  body("preferences")
    .optional()
    .isObject()
    .withMessage("Les préférences doivent être un objet"),
  body("preferences.theme")
    .optional()
    .isIn(["light", "dark"])
    .withMessage("Thème invalide"),
  body("preferences.language")
    .optional()
    .isIn(["fr", "en"])
    .withMessage("Langue invalide"),
  body("preferences.notifications")
    .optional()
    .isBoolean()
    .withMessage("Notifications doit être un booléen"),
  handleValidationErrors,
];

/* =============================
   QUIZ
============================= */
const validateQuizCreation = [
  body("title")
    .notEmpty()
    .withMessage("Titre requis")
    .isLength({ max: 200 })
    .withMessage("Max 200 caractères")
    .trim(),
  body("description")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Max 1000 caractères")
    .trim(),
  body("category")
    .optional()
    .isLength({ max: 50 })
    .withMessage("Max 50 caractères")
    .trim(),
  body("difficulty")
    .optional()
    .isIn(["facile", "moyen", "difficile"])
    .withMessage("Difficulté invalide"),
  body("tags").optional().isArray().withMessage("Tags doit être un tableau"),
  body("tags.*")
    .optional()
    .isString()
    .isLength({ max: 30 })
    .withMessage("Chaque tag max 30 caractères"),
  body("questions")
    .optional()
    .isArray()
    .withMessage("Les questions doivent être un tableau"),
  body("settings")
    .optional()
    .isObject()
    .withMessage("Paramètres doivent être un objet"),
  handleValidationErrors,
];

const validateQuestionData = [
  body("type")
    .isIn(["qcm", "vrai_faux", "reponse_libre", "nuage_mots"])
    .withMessage("Type invalide"),
  body("question")
    .notEmpty()
    .withMessage("Texte requis")
    .isLength({ max: 500 })
    .withMessage("Max 500 caractères")
    .trim(),
  body("points")
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage("Points entre 0 et 100"),
  body("timeLimit")
    .optional()
    .isInt({ min: 5, max: 300 })
    .withMessage("Temps entre 5 et 300 secondes"),
  body("explanation")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Explication max 1000 caractères")
    .trim(),
  handleValidationErrors,
];

const validateQuizQuestions = (req, res, next) => {
  const { questions } = req.body;
  if (!questions || !Array.isArray(questions)) return next();
  const errors = [];
  questions.forEach((q, i) => {
    if (
      !q.type ||
      !["qcm", "vrai_faux", "reponse_libre", "nuage_mots"].includes(q.type)
    )
      errors.push(`Question ${i + 1}: Type invalide`);
    if (!q.question || q.question.trim().length === 0)
      errors.push(`Question ${i + 1}: Texte manquant`);
    if (q.type === "qcm") {
      if (!q.options || !Array.isArray(q.options) || q.options.length < 2) {
        errors.push(`Question ${i + 1}: QCM doit avoir au moins 2 options`);
      } else if (!q.options.some((opt) => opt.isCorrect)) {
        errors.push(`Question ${i + 1}: Au moins une réponse correcte requise`);
      }
    }
    if (q.type === "vrai_faux" && (!q.options || q.options.length !== 2))
      errors.push(`Question ${i + 1}: Vrai/Faux doit avoir 2 options`);
    if (
      q.type === "reponse_libre" &&
      (!q.correctAnswer || q.correctAnswer.trim().length === 0)
    )
      errors.push(`Question ${i + 1}: Réponse correcte requise`);
    if (q.points && (q.points < 0 || q.points > 100))
      errors.push(`Question ${i + 1}: Points entre 0 et 100`);
    if (q.timeLimit && (q.timeLimit < 5 || q.timeLimit > 300))
      errors.push(`Question ${i + 1}: Temps entre 5 et 300s`);
  });
  if (errors.length > 0)
    return res
      .status(400)
      .json({ error: "Questions invalides", details: errors });
  next();
};

/* =============================
   SESSIONS
============================= */
const validateSessionCreation = [
  body("quizId").isUUID().withMessage("ID quiz invalide"),
  body("title")
    .optional()
    .isLength({ max: 200 })
    .withMessage("Titre max 200 caractères")
    .trim(),
  body("settings")
    .optional()
    .isObject()
    .withMessage("Paramètres doivent être un objet"),
  body("settings.maxParticipants")
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage("Participants entre 1 et 1000"),
  body("settings.questionTimeLimit")
    .optional()
    .isInt({ min: 5, max: 600 })
    .withMessage("Temps entre 5 et 600 secondes"),
  handleValidationErrors,
];

const validateJoinSession = [
  body("sessionCode")
    .isLength({ min: 6, max: 8 })
    .isAlphanumeric()
    .withMessage("Code invalide")
    .toUpperCase(),
  body("participantName")
    .optional()
    .isLength({ max: 50 })
    .withMessage("Nom max 50 caractères")
    .trim(),
  body("isAnonymous")
    .optional()
    .isBoolean()
    .withMessage("isAnonymous doit être booléen"),
  handleValidationErrors,
];

const validateResponse = [
  body("questionId").notEmpty().withMessage("ID question requis"),
  body("answer").notEmpty().withMessage("Réponse requise"),
  body("timeSpent")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Temps doit être positif"),
  handleValidationErrors,
];

const validateSessionSettings = (req, res, next) => {
  const { settings } = req.body;
  if (!settings || typeof settings !== "object") return next();
  const errors = [];
  if (
    settings.maxParticipants !== undefined &&
    (!Number.isInteger(settings.maxParticipants) ||
      settings.maxParticipants < 1 ||
      settings.maxParticipants > 1000)
  )
    errors.push("maxParticipants doit être entre 1 et 1000");
  if (
    settings.questionTimeLimit !== undefined &&
    (!Number.isInteger(settings.questionTimeLimit) ||
      settings.questionTimeLimit < 5 ||
      settings.questionTimeLimit > 600)
  )
    errors.push("questionTimeLimit doit être entre 5 et 600s");
  ["allowLateJoin", "showLeaderboard", "autoAdvance"].forEach((f) => {
    if (settings[f] !== undefined && typeof settings[f] !== "boolean")
      errors.push(`${f} doit être un booléen`);
  });
  if (errors.length > 0)
    return res
      .status(400)
      .json({ error: "Paramètres invalides", details: errors });
  next();
};

const validateSessionStatus = [
  body("status")
    .optional()
    .isIn(["waiting", "active", "paused", "finished", "cancelled"])
    .withMessage("Statut invalide"),
  handleValidationErrors,
];

/* =============================
   REQUÊTES & PARAMS
============================= */
const validatePagination = [
  query("page").optional().isInt({ min: 1 }).withMessage("Page doit être >= 1"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limite entre 1 et 100"),
  handleValidationErrors,
];

const validateSearch = [
  query("search")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Recherche max 100 caractères")
    .trim(),
  query("category")
    .optional()
    .isLength({ max: 50 })
    .withMessage("Catégorie max 50 caractères")
    .trim(),
  query("difficulty")
    .optional()
    .isIn(["facile", "moyen", "difficile"])
    .withMessage("Difficulté invalide"),
  query("sort")
    .optional()
    .isIn(["recent", "popular", "alphabetical"])
    .withMessage("Tri invalide"),
  handleValidationErrors,
];

const validateUUID = (paramName = "id") => [
  param(paramName)
    .isUUID()
    .withMessage(`${paramName} doit être un UUID valide`),
  handleValidationErrors,
];

const validateSessionCode = [
  param("code")
    .isLength({ min: 6, max: 8 })
    .isAlphanumeric()
    .withMessage("Code invalide")
    .toUpperCase(),
  handleValidationErrors,
];

/* =============================
   COMMUNICATION & FEEDBACK
============================= */
const validateChatMessage = [
  body("message")
    .notEmpty()
    .withMessage("Message requis")
    .isLength({ max: 500 })
    .withMessage("Max 500 caractères")
    .trim(),
  handleValidationErrors,
];

const validateInvitation = [
  body("emails").isArray({ min: 1 }).withMessage("Au moins un email requis"),
  body("emails.*").isEmail().withMessage("Email invalide").normalizeEmail(),
  body("sessionId").isUUID().withMessage("ID session invalide"),
  body("message")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Message max 500 caractères")
    .trim(),
  handleValidationErrors,
];

const validateFeedback = [
  body("rating").isInt({ min: 1, max: 5 }).withMessage("Note entre 1 et 5"),
  body("comment")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Commentaire max 1000 caractères")
    .trim(),
  body("category")
    .optional()
    .isIn(["bug", "feature", "improvement", "other"])
    .withMessage("Catégorie invalide"),
  handleValidationErrors,
];

/* =============================
   UTILITAIRES
============================= */
const sanitizeInput = (req, res, next) => {
  const MAX_DEPTH = 6;
  const seen = new WeakSet();

  const escapeHtml = (str) =>
    String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;")
      .replace(/\//g, "&#x2F;")
      .trim();

  const isSafeKey = (key) =>
    !["__proto__", "constructor", "prototype"].includes(key);

  const sanitize = (value, depth = 0) => {
    if (value == null) return value; // null / undefined
    if (depth > MAX_DEPTH) return value;

    const t = typeof value;
    if (t === "string") return escapeHtml(value);
    if (t === "number" || t === "boolean") return value;
    if (Array.isArray(value)) {
      return value.map((v) => sanitize(v, depth + 1));
    }
    if (t === "object") {
      // protect against circular references
      if (seen.has(value)) return undefined;
      seen.add(value);

      const out = {};
      for (const [k, v] of Object.entries(value)) {
        if (!isSafeKey(k)) continue; // avoid prototype pollution
        out[k] = sanitize(v, depth + 1);
      }
      return out;
    }

    // fallback: return as-is
    return value;
  };

  try {
    req.body = sanitize(req.body);
    req.query = sanitize(req.query);
    req.params = sanitize(req.params);
  } catch (err) {
    // en cas d'erreur inattendue, on ne bloque pas la requête — on logge et on continue
    console.error("sanitizeInput error:", err);
  }

  next();
};

const validateByRole = (validations) => {
  return async (req, res, next) => {
    if (!req.user)
      return res.status(401).json({ error: "Authentification requise" });
    const roleValidations = validations[req.user.role];
    if (!roleValidations)
      return res.status(403).json({ error: "Rôle non autorisé" });
    for (const validation of roleValidations) await validation.run(req);
    return handleValidationErrors(req, res, next);
  };
};

/* =============================
   EXPORTS
============================= */
module.exports = {
  handleValidationErrors,
  // Auth
  validateRegistration,
  validateLogin,
  validatePasswordChange,
  validateProfileUpdate,
  // Quiz
  validateQuizCreation,
  validateQuestionData,
  validateQuizQuestions,
  // Sessions
  validateSessionCreation,
  validateJoinSession,
  validateResponse,
  validateSessionSettings,
  validateSessionStatus,
  // Requêtes
  validatePagination,
  validateSearch,
  validateUUID,
  validateSessionCode,
  // Communication
  validateChatMessage,
  validateInvitation,
  validateFeedback,
  // Utils
  sanitizeInput,
  validateByRole,
};
