const jwt = require("jsonwebtoken");
const { User } = require("../models");

// Middleware pour vérifier le token JWT
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: "Token d'accès requis",
        code: "NO_TOKEN",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Vérifier que l'utilisateur existe encore
    const user = await User.findByPk(decoded.userId, {
      attributes: { exclude: ["password"] },
    });

    if (!user) {
      return res.status(401).json({
        error: "Utilisateur non trouvé",
        code: "USER_NOT_FOUND",
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        error: "Compte désactivé",
        code: "ACCOUNT_DISABLED",
      });
    }

    // Ajouter l'utilisateur à la requête
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        error: "Token invalide",
        code: "INVALID_TOKEN",
      });
    }

    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        error: "Token expiré",
        code: "EXPIRED_TOKEN",
      });
    }

    console.error("Erreur d'authentification:", error);
    return res.status(500).json({
      error: "Erreur interne du serveur",
      code: "INTERNAL_ERROR",
    });
  }
};

// Middleware pour vérifier les rôles
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentification requise",
        code: "AUTH_REQUIRED",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: "Permissions insuffisantes",
        code: "INSUFFICIENT_PERMISSIONS",
        required: roles,
        current: req.user.role,
      });
    }

    next();
  };
};

// Middleware optionnel (n'échoue pas si pas de token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.userId, {
        attributes: { exclude: ["password"] },
      });

      if (user && user.isActive) {
        req.user = user;
      }
    }
  } catch (error) {
    // Ignore les erreurs d'authentification en mode optionnel
    console.log("Token optionnel invalide:", error.message);
  }

  next();
};

// Middleware pour vérifier que l'utilisateur est propriétaire de la ressource
// const requireOwnership = (resourceField = "creatorId") => {
//   return (req, res, next) => {
//     if (!req.user) {
//       return res.status(401).json({
//         error: "Authentification requise",
//         code: "AUTH_REQUIRED",
//       });
//     }

//     // Vérifier dans les paramètres ou le body
//     const resourceOwnerId =
//       req.resource?.[resourceField] ||
//       req.params?.[resourceField] ||
//       req.body?.[resourceField];

//     if (!resourceOwnerId) {
//       return res.status(400).json({
//         error: "ID du propriétaire manquant",
//         code: "OWNER_ID_MISSING",
//       });
//     }

//     // Admin peut tout faire
//     if (req.user.role === "admin") {
//       return next();
//     }

//     // Vérifier la propriété
//     if (resourceOwnerId !== req.user.id) {
//       return res.status(403).json({
//         error: "Accès refusé - Vous n'êtes pas propriétaire de cette ressource",
//         code: "NOT_OWNER",
//       });
//     }

//     next();
//   };
// };
const requireOwnership = (resourceField = "creatorId") => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentification requise",
        code: "AUTH_REQUIRED",
      });
    }

    // Chercher l'ID du propriétaire dans diverses sources possibles
    let resourceOwnerId;

    // 1. Dans les ressources chargées (req.quiz, req.session, etc.)
    if (req.quiz && req.quiz[resourceField]) {
      resourceOwnerId = req.quiz[resourceField];
    } else if (req.session && req.session[resourceField]) {
      resourceOwnerId = req.session[resourceField];
    } else if (req.resource && req.resource[resourceField]) {
      resourceOwnerId = req.resource[resourceField];
    }
    // 2. Dans les paramètres de route
    else if (req.params[resourceField]) {
      resourceOwnerId = req.params[resourceField];
    }
    // 3. Dans le body
    else if (req.body[resourceField]) {
      resourceOwnerId = req.body[resourceField];
    }
    // 4. Dans les query params
    else if (req.query[resourceField]) {
      resourceOwnerId = req.query[resourceField];
    } else {
      return res.status(400).json({
        error: "ID du propriétaire manquant",
        code: "OWNER_ID_MISSING",
      });
    }

    // Admin peut tout faire
    if (req.user.role === "admin") {
      return next();
    }

    // Vérifier la propriété
    if (resourceOwnerId !== req.user.id) {
      return res.status(403).json({
        error: "Accès refusé - Vous n'êtes pas propriétaire de cette ressource",
        code: "NOT_OWNER",
      });
    }

    next();
  };
};

// Générer un token JWT
const generateToken = (user) => {
  const payload = {
    userId: user.id,
    username: user.username,
    role: user.role,
  };

  const options = {
    expiresIn: process.env.JWT_EXPIRES_IN || "24h",
    issuer: "quiz-app",
    subject: user.id,
  };

  return jwt.sign(payload, process.env.JWT_SECRET, options);
};

// Générer un refresh token (durée plus longue)
const generateRefreshToken = (user) => {
  const payload = {
    userId: user.id,
    type: "refresh",
  };

  const options = {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
    issuer: "quiz-app",
    subject: user.id,
  };

  return jwt.sign(payload, process.env.JWT_SECRET, options);
};

// Vérifier un refresh token
const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type !== "refresh") {
      throw new Error("Token type invalide");
    }

    return decoded;
  } catch (error) {
    throw error;
  }
};

// Middleware pour logger les requêtes authentifiées
const logAuthenticatedRequest = (req, res, next) => {
  if (req.user && process.env.NODE_ENV === "development") {
    console.log(
      `🔐 Requête authentifiée: ${req.method} ${req.path} - User: ${req.user.username} (${req.user.role})`
    );
  }
  next();
};

// Middleware de rate limiting spécialisé pour l'auth
const authRateLimit = require("express-rate-limit")({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 tentatives par fenêtre
  message: {
    error: "Trop de tentatives de connexion. Réessayez dans 15 minutes.",
    code: "TOO_MANY_AUTH_ATTEMPTS",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip pour les routes qui ne sont pas de login
    return !req.path.includes("/login") && !req.path.includes("/register");
  },
});

module.exports = {
  authenticateToken,
  requireRole,
  optionalAuth,
  requireOwnership,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
  logAuthenticatedRequest,
  authRateLimit,
};
