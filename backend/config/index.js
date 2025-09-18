// Configuration générale de l'application
const config = {
  // Configuration du serveur
  server: {
    port: process.env.PORT || 3001,
    env: process.env.NODE_ENV || "development",
    host: process.env.HOST || "localhost",
  },

  // Configuration de la base de données
  database: {
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    name: process.env.DB_NAME || "quiz_app",
    username: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",

    // Options de pool de connexions
    pool: {
      max: parseInt(process.env.DB_POOL_MAX) || 5,
      min: parseInt(process.env.DB_POOL_MIN) || 0,
      acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 30000,
      idle: parseInt(process.env.DB_POOL_IDLE) || 10000,
    },

    // Options de synchronisation
    sync: {
      force: process.env.DB_SYNC_FORCE === "true",
      alter:
        process.env.DB_SYNC_ALTER !== "false" &&
        process.env.NODE_ENV === "development",
    },
  },

  // Configuration JWT
  jwt: {
    secret: process.env.JWT_SECRET || "default-secret-change-in-production",
    expiresIn: process.env.JWT_EXPIRES_IN || "24h",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
    issuer: "quiz-app",
    algorithm: "HS256",
  },

  // Configuration CORS
  cors: {
    origins: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(",")
      : [
          "http://localhost:3000",
          "http://localhost:3001",
          "http://127.0.0.1:3000",
          "http://127.0.0.1:3001",
        ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
  },

  // Configuration Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: {
      error: "Trop de requêtes depuis cette IP, veuillez réessayer plus tard.",
      code: "RATE_LIMIT_EXCEEDED",
    },

    // Rate limiting spécialisé pour l'authentification
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 tentatives
      message: {
        error: "Trop de tentatives de connexion. Réessayez dans 15 minutes.",
        code: "TOO_MANY_AUTH_ATTEMPTS",
      },
    },
  },

  // Configuration Socket.IO
  socket: {
    pingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT) || 60000,
    pingInterval: parseInt(process.env.SOCKET_PING_INTERVAL) || 25000,
    maxHttpBufferSize: parseInt(process.env.SOCKET_MAX_BUFFER_SIZE) || 1e6,

    // Limites pour les sessions
    maxParticipants: parseInt(process.env.MAX_PARTICIPANTS_PER_SESSION) || 100,
    maxSessions: parseInt(process.env.MAX_SESSIONS_PER_HOST) || 10,
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT) || 4 * 60 * 60 * 1000, // 4 heures
  },

  // Configuration des uploads (si nécessaire plus tard)
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "audio/mpeg",
      "audio/wav",
      "video/mp4",
      "video/webm",
    ],
    uploadDir: process.env.UPLOAD_DIR || "uploads/",

    // Limites spécifiques par type
    limits: {
      image: 2 * 1024 * 1024, // 2MB
      audio: 10 * 1024 * 1024, // 10MB
      video: 50 * 1024 * 1024, // 50MB
    },
  },

  // Configuration des sessions de quiz
  quiz: {
    // Limites par défaut
    defaults: {
      maxQuestions: 100,
      maxOptions: 10,
      maxTimeLimit: 300, // 5 minutes par question
      minTimeLimit: 5, // 5 secondes minimum
      maxPoints: 100,
      maxParticipants: 100,
      sessionCodeLength: 6,
    },

    // Types de questions supportés
    questionTypes: ["qcm", "vrai_faux", "reponse_libre", "nuage_mots"],

    // Difficultés disponibles
    difficulties: ["facile", "moyen", "difficile"],

    // Statuts de session
    sessionStatuses: ["waiting", "active", "paused", "finished", "cancelled"],
  },

  // Configuration de logging
  logging: {
    level:
      process.env.LOG_LEVEL ||
      (process.env.NODE_ENV === "development" ? "debug" : "info"),

    // Activé selon l'environnement
    enableConsole: process.env.NODE_ENV === "development",
    enableFile: process.env.LOG_TO_FILE === "true",

    // Fichiers de log
    files: {
      error: "logs/error.log",
      combined: "logs/combined.log",
      access: "logs/access.log",
    },
  },

  // Configuration de sécurité
  security: {
    // Helmet options
    helmet: {
      contentSecurityPolicy: process.env.NODE_ENV === "production",
      crossOriginEmbedderPolicy: false,
    },

    // Hash rounds pour bcrypt
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12,

    // Session timeouts
    sessionTimeout:
      parseInt(process.env.SESSION_TIMEOUT) || 24 * 60 * 60 * 1000, // 24h
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5,
    lockoutDuration: parseInt(process.env.LOCKOUT_DURATION) || 15 * 60 * 1000, // 15 min
  },

  // Configuration des emails (pour les fonctionnalités futures)
  email: {
    enabled: process.env.EMAIL_ENABLED === "true",
    service: process.env.EMAIL_SERVICE || "gmail",
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === "true",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
    from: process.env.EMAIL_FROM || "noreply@quiz-app.local",
  },

  // Configuration de cache (pour Redis si nécessaire)
  cache: {
    enabled: process.env.CACHE_ENABLED === "true",
    type: process.env.CACHE_TYPE || "memory", // memory, redis
    redis: {
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB) || 0,
    },
    ttl: parseInt(process.env.CACHE_TTL) || 300, // 5 minutes
  },

  // Configuration des fonctionnalités
  features: {
    // Inscription ouverte
    openRegistration: process.env.OPEN_REGISTRATION !== "false",

    // Sessions anonymes
    allowAnonymousParticipation: process.env.ALLOW_ANONYMOUS !== "false",

    // Chat dans les sessions
    enableChat: process.env.ENABLE_CHAT !== "false",

    // Export des résultats
    enableExport: process.env.ENABLE_EXPORT !== "false",

    // Mode maintenance
    maintenanceMode: process.env.MAINTENANCE_MODE === "true",

    // Analytics basiques
    enableAnalytics: process.env.ENABLE_ANALYTICS === "true",
  },

  // Messages par défaut
  messages: {
    errors: {
      generic: "Une erreur inattendue s'est produite",
      notFound: "Ressource non trouvée",
      unauthorized: "Authentification requise",
      forbidden: "Accès refusé",
      validation: "Données invalides",
      rateLimit: "Trop de requêtes, veuillez patienter",
    },

    success: {
      created: "Créé avec succès",
      updated: "Mis à jour avec succès",
      deleted: "Supprimé avec succès",
      login: "Connexion réussie",
      logout: "Déconnexion réussie",
    },
  },
};

// Validation de la configuration
const validateConfig = () => {
  const errors = [];

  // Vérifications essentielles
  if (
    !config.jwt.secret ||
    config.jwt.secret === "default-secret-change-in-production"
  ) {
    if (config.server.env === "production") {
      errors.push("JWT_SECRET doit être défini en production");
    }
  }

  if (!config.database.password && config.server.env === "production") {
    errors.push("Mot de passe de base de données requis en production");
  }

  if (errors.length > 0) {
    console.error("❌ Erreurs de configuration:");
    errors.forEach((error) => console.error(`   - ${error}`));

    if (config.server.env === "production") {
      process.exit(1);
    }
  }
};

// Afficher la configuration (masquer les secrets)
const displayConfig = () => {
  if (config.server.env === "development") {
    console.log("⚙️  Configuration:");
    console.log(`   - Environnement: ${config.server.env}`);
    console.log(`   - Port: ${config.server.port}`);
    console.log(
      `   - Base de données: ${config.database.host}:${config.database.port}/${config.database.name}`
    );
    console.log(`   - CORS Origins: ${config.cors.origins.join(", ")}`);
    console.log(
      `   - Rate Limit: ${config.rateLimit.max} requêtes/${config.rateLimit.windowMs}ms`
    );
    console.log(
      `   - Features: Registration=${config.features.openRegistration}, Anonymous=${config.features.allowAnonymousParticipation}, Chat=${config.features.enableChat}`
    );
  }
};

module.exports = {
  ...config,
  validateConfig,
  displayConfig,
};
