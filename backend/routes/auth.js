const express = require("express");
const router = express.Router();
const { User } = require("../models");
const {
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
  authenticateToken,
  authRateLimit,
} = require("../middleware/auth");

// Validation des données
const validateRegistration = (req, res, next) => {
  const { username, email, password, firstName, lastName } = req.body;
  const errors = [];

  if (!username || username.length < 3 || username.length > 50) {
    errors.push("Le nom d'utilisateur doit contenir entre 3 et 50 caractères");
  }

  if (!email || !/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
    errors.push("Email invalide");
  }

  if (!password || password.length < 6) {
    errors.push("Le mot de passe doit contenir au moins 6 caractères");
  }

  if (firstName && firstName.length > 50) {
    errors.push("Le prénom ne peut pas dépasser 50 caractères");
  }

  if (lastName && lastName.length > 50) {
    errors.push("Le nom ne peut pas dépasser 50 caractères");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: "Données invalides",
      details: errors,
    });
  }

  next();
};

// POST /api/auth/register - Inscription
router.post(
  "/register",
  authRateLimit,
  validateRegistration,
  async (req, res) => {
    try {
      const {
        username,
        email,
        password,
        role = "formateur",
        firstName,
        lastName,
      } = req.body;

      // Vérifier si l'utilisateur existe déjà
      const existingUser = await User.findByEmailOrUsername(email);
      if (existingUser) {
        return res.status(409).json({
          error:
            "Un utilisateur avec cet email ou nom d'utilisateur existe déjà",
          code: "USER_EXISTS",
        });
      }

      // Créer l'utilisateur
      const user = await User.create({
        username: username.trim(),
        email: email.toLowerCase().trim(),
        password,
        role: ["formateur", "etudiant"].includes(role) ? role : "formateur",
        firstName: firstName?.trim(),
        lastName: lastName?.trim(),
      });

      // Générer les tokens
      const token = generateToken(user);
      const refreshToken = generateRefreshToken(user);

      // Mettre à jour la dernière connexion
      await user.updateLastLogin();

      res.status(201).json({
        message: "Utilisateur créé avec succès",
        user: user.toPublicJSON(),
        tokens: {
          accessToken: token,
          refreshToken,
          expiresIn: process.env.JWT_EXPIRES_IN || "24h",
        },
      });
    } catch (error) {
      console.error("Erreur lors de l'inscription:", error);

      if (error.name === "SequelizeUniqueConstraintError") {
        return res.status(409).json({
          error: "Email ou nom d'utilisateur déjà utilisé",
          code: "DUPLICATE_ENTRY",
        });
      }

      if (error.name === "SequelizeValidationError") {
        return res.status(400).json({
          error: "Données invalides",
          details: error.errors.map((err) => err.message),
        });
      }

      res.status(500).json({
        error: "Erreur lors de la création du compte",
      });
    }
  }
);

// POST /api/auth/login - Connexion
router.post("/login", authRateLimit, async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        error: "Email/nom d'utilisateur et mot de passe requis",
        code: "MISSING_CREDENTIALS",
      });
    }

    // Trouver l'utilisateur
    const user = await User.findByEmailOrUsername(identifier);
    if (!user) {
      return res.status(401).json({
        error: "Identifiants invalides",
        code: "INVALID_CREDENTIALS",
      });
    }

    // Vérifier le mot de passe
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({
        error: "Identifiants invalides",
        code: "INVALID_CREDENTIALS",
      });
    }

    // Vérifier que le compte est actif
    if (!user.isActive) {
      return res.status(401).json({
        error: "Compte désactivé",
        code: "ACCOUNT_DISABLED",
      });
    }

    // Générer les tokens
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    // Mettre à jour la dernière connexion
    await user.updateLastLogin();

    res.json({
      message: "Connexion réussie",
      user: user.toPublicJSON(),
      tokens: {
        accessToken: token,
        refreshToken,
        expiresIn: process.env.JWT_EXPIRES_IN || "24h",
      },
    });
  } catch (error) {
    console.error("Erreur lors de la connexion:", error);
    res.status(500).json({
      error: "Erreur lors de la connexion",
    });
  }
});

// POST /api/auth/refresh - Renouveler le token
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: "Refresh token requis",
        code: "NO_REFRESH_TOKEN",
      });
    }

    // Vérifier le refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Récupérer l'utilisateur
    const user = await User.findByPk(decoded.userId, {
      attributes: { exclude: ["password"] },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        error: "Refresh token invalide",
        code: "INVALID_REFRESH_TOKEN",
      });
    }

    // Générer nouveaux tokens
    const newToken = generateToken(user);
    const newRefreshToken = generateRefreshToken(user);

    res.json({
      message: "Token renouvelé",
      tokens: {
        accessToken: newToken,
        refreshToken: newRefreshToken,
        expiresIn: process.env.JWT_EXPIRES_IN || "24h",
      },
    });
  } catch (error) {
    console.error("Erreur lors du renouvellement du token:", error);
    res.status(401).json({
      error: "Refresh token invalide",
      code: "INVALID_REFRESH_TOKEN",
    });
  }
});

// GET /api/auth/me - Récupérer les informations de l'utilisateur connecté
router.get("/me", authenticateToken, async (req, res) => {
  try {
    res.json({
      user: req.user.toPublicJSON(),
    });
  } catch (error) {
    console.error("Erreur lors de la récupération du profil:", error);
    res.status(500).json({
      error: "Erreur lors de la récupération du profil",
    });
  }
});

// PUT /api/auth/me - Mettre à jour le profil
router.put("/me", authenticateToken, async (req, res) => {
  try {
    const { firstName, lastName, preferences } = req.body;
    const updates = {};

    if (firstName !== undefined) {
      if (firstName.length > 50) {
        return res.status(400).json({
          error: "Le prénom ne peut pas dépasser 50 caractères",
        });
      }
      updates.firstName = firstName.trim();
    }

    if (lastName !== undefined) {
      if (lastName.length > 50) {
        return res.status(400).json({
          error: "Le nom ne peut pas dépasser 50 caractères",
        });
      }
      updates.lastName = lastName.trim();
    }

    if (preferences !== undefined) {
      // Valider les préférences
      const validPreferences = {};
      if (preferences.theme && ["light", "dark"].includes(preferences.theme)) {
        validPreferences.theme = preferences.theme;
      }
      if (preferences.language && ["fr", "en"].includes(preferences.language)) {
        validPreferences.language = preferences.language;
      }
      if (preferences.notifications !== undefined) {
        validPreferences.notifications = Boolean(preferences.notifications);
      }

      updates.preferences = { ...req.user.preferences, ...validPreferences };
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: "Aucune mise à jour fournie",
      });
    }

    await req.user.update(updates);

    res.json({
      message: "Profil mis à jour",
      user: req.user.toPublicJSON(),
    });
  } catch (error) {
    console.error("Erreur lors de la mise à jour du profil:", error);
    res.status(500).json({
      error: "Erreur lors de la mise à jour du profil",
    });
  }
});

// PUT /api/auth/password - Changer le mot de passe
router.put("/password", authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: "Mot de passe actuel et nouveau mot de passe requis",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: "Le nouveau mot de passe doit contenir au moins 6 caractères",
      });
    }

    // Récupérer l'utilisateur avec le mot de passe
    const user = await User.findByPk(req.user.id);

    // Vérifier le mot de passe actuel
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        error: "Mot de passe actuel incorrect",
        code: "INVALID_CURRENT_PASSWORD",
      });
    }

    // Mettre à jour le mot de passe
    await user.update({ password: newPassword });

    res.json({
      message: "Mot de passe mis à jour avec succès",
    });
  } catch (error) {
    console.error("Erreur lors de la mise à jour du mot de passe:", error);
    res.status(500).json({
      error: "Erreur lors de la mise à jour du mot de passe",
    });
  }
});

// POST /api/auth/logout - Déconnexion (côté client principalement)
router.post("/logout", authenticateToken, async (req, res) => {
  try {
    // Note: Avec JWT, la déconnexion est principalement côté client
    // On pourrait implémenter une blacklist des tokens si nécessaire

    res.json({
      message: "Déconnexion réussie",
    });
  } catch (error) {
    console.error("Erreur lors de la déconnexion:", error);
    res.status(500).json({
      error: "Erreur lors de la déconnexion",
    });
  }
});

// DELETE /api/auth/account - Supprimer le compte
router.delete("/account", authenticateToken, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        error: "Mot de passe requis pour supprimer le compte",
      });
    }

    // Récupérer l'utilisateur avec le mot de passe
    const user = await User.findByPk(req.user.id);

    // Vérifier le mot de passe
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(400).json({
        error: "Mot de passe incorrect",
        code: "INVALID_PASSWORD",
      });
    }

    // Plutôt que de supprimer, désactiver le compte
    await user.update({
      isActive: false,
      email: `deleted_${Date.now()}_${user.email}`,
      username: `deleted_${Date.now()}_${user.username}`,
    });

    res.json({
      message: "Compte supprimé avec succès",
    });
  } catch (error) {
    console.error("Erreur lors de la suppression du compte:", error);
    res.status(500).json({
      error: "Erreur lors de la suppression du compte",
    });
  }
});

// GET /api/auth/verify - Vérifier la validité d'un token
router.get("/verify", authenticateToken, (req, res) => {
  res.json({
    valid: true,
    user: req.user.toPublicJSON(),
  });
});

module.exports = router;
