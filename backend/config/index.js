// Configuration optimisée pour Socket.IO - backend/config/index.js
const config = {
  // Configuration du serveur
  server: {
    port: process.env.PORT || 3001,
    env: process.env.NODE_ENV || "development",
    host: process.env.HOST || "localhost",
  },

  // Configuration de la base de données avec optimisations
  database: {
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    name: process.env.DB_NAME || "quiz_app",
    username: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",

    // Pool de connexions optimisé
    pool: {
      max: parseInt(process.env.DB_POOL_MAX) || 10, // Augmenté de 5 à 10
      min: parseInt(process.env.DB_POOL_MIN) || 2, // Augmenté de 0 à 2
      // acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 60000, // Doublé
      connectTimeout: parseInt(process.env.DB_POOL_ACQUIRE) || 60000, // Doublé
      idle: parseInt(process.env.DB_POOL_IDLE) || 30000, // Triplé
      evict: parseInt(process.env.DB_POOL_EVICT) || 10000, // Nouveau: nettoyage automatique
    },

    // Options de synchronisation
    sync: {
      force: process.env.DB_SYNC_FORCE === "true",
      alter:
        process.env.DB_SYNC_ALTER !== "false" &&
        process.env.NODE_ENV === "development",
    },

    // Nouvelles options de performance
    logging: process.env.NODE_ENV === "development" ? console.log : false,
    benchmark: process.env.NODE_ENV === "development",
    dialectOptions: {
      charset: "utf8mb4",
      collate: "utf8mb4_unicode_ci",
      // Optimisations MySQL
      // acquireTimeout: 60000,
      // timeout: 60000,
      // Pool de connexions plus agressif
      reconnect: true,
      maxReconnects: 3,
      reconnectInterval: 1000,
    },
  },

  // Configuration JWT (inchangée)
  jwt: {
    secret: process.env.JWT_SECRET || "default-secret-change-in-production",
    expiresIn: process.env.JWT_EXPIRES_IN || "24h",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
    issuer: "quiz-app",
    algorithm: "HS256",
  },

  // Configuration CORS optimisée
  // cors: {
  //   origin: function (origin, callback) {
  //     // Permettre les requêtes sans origine (mobile apps, etc.)
  //     if (!origin) return callback(null, true);

  //     const allowedOrigins = process.env.CORS_ORIGINS
  //       ? process.env.CORS_ORIGINS.split(",")
  //       : [
  //           "http://localhost:3000",
  //           "http://localhost:3001",
  //           "http://127.0.0.1:3000",
  //           "http://127.0.0.1:3001",
  //         ];

  //     if (allowedOrigins.indexOf(origin) !== -1) {
  //       callback(null, true);
  //     } else {
  //       callback(new Error("Not allowed by CORS"));
  //     }
  //   },
  //   credentials: true,
  //   methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  //   allowedHeaders: [
  //     "Content-Type",
  //     "Authorization",
  //     "X-Requested-With",
  //     "Accept",
  //     "Origin",
  //   ],
  //   // Nouvelles optimisations CORS
  //   preflightContinue: false,
  //   optionsSuccessStatus: 204,
  // },
  cors: {
    origins: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(",")
      : [
          "http://localhost:3000",
          "http://localhost:3001",
          "http://127.0.0.1:3000",
          "http://127.0.0.1:3001",
          "http://localhost:3002", // au cas où
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
    // Options simplifiées
    optionsSuccessStatus: 200,
  },

  // Configuration Rate Limiting optimisée
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 200, // Augmenté de 100 à 200
    message: {
      error: "Trop de requêtes depuis cette IP, veuillez réessayer plus tard.",
      code: "RATE_LIMIT_EXCEEDED",
    },
    // Nouvelles options
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Ne compter que les erreurs
    skipFailedRequests: false,

    // Rate limiting spécialisé pour l'authentification
    auth: {
      windowMs: 15 * 60 * 1000,
      max: 10, // Augmenté de 5 à 10
      message: {
        error: "Trop de tentatives de connexion. Réessayez dans 15 minutes.",
        code: "TOO_MANY_AUTH_ATTEMPTS",
      },
    },
  },

  // Configuration Socket.IO fortement optimisée
  socket: {
    // Timeouts optimisés pour réduire la consommation
    pingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT) || 120000, // Doublé: 2 min
    pingInterval: parseInt(process.env.SOCKET_PING_INTERVAL) || 60000, // Doublé: 1 min
    maxHttpBufferSize: parseInt(process.env.SOCKET_MAX_BUFFER_SIZE) || 2e6, // Doublé: 2MB

    // Nouvelles optimisations critiques
    transports: ["websocket", "polling"],
    allowUpgrades: true,
    upgradeTimeout: 30000,

    // Compression et sérialisation
    compression: true,
    httpCompression: {
      threshold: 1024,
      level: 6,
      chunkSize: 8192,
    },

    // Parser par défaut (pas de config custom)
    // parser: {
    //   binary: false, // Retiré car incompatible avec certaines versions
    // },

    // Limites pour les sessions (augmentées intelligemment)
    maxParticipants: parseInt(process.env.MAX_PARTICIPANTS_PER_SESSION) || 150, // +50%
    maxSessions: parseInt(process.env.MAX_SESSIONS_PER_HOST) || 15, // +50%
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT) || 6 * 60 * 60 * 1000, // 6h au lieu de 4h

    // Nouvelles limites de performance
    maxConnections: parseInt(process.env.MAX_SOCKET_CONNECTIONS) || 1000,
    connectionsCheckInterval: 30000, // Vérifier toutes les 30s

    // Heartbeat personnalisé optimisé
    customHeartbeat: {
      enabled: true,
      interval: 90000, // 1.5 min au lieu de 30s
      timeout: 180000, // 3 min de grâce
      maxMissed: 2, // 2 heartbeats ratés max
    },

    // Nouvelles options de nettoyage automatique
    cleanup: {
      enabled: true,
      interval: 5 * 60 * 1000, // Nettoyer toutes les 5 minutes
      maxInactiveTime: 10 * 60 * 1000, // 10 minutes d'inactivité max
      batchSize: 50, // Nettoyer par lots de 50
    },

    // Rate limiting par socket
    perSocketRateLimit: {
      enabled: true,
      windowMs: 60 * 1000, // 1 minute
      max: 60, // 60 événements par minute max par socket
      skipInternalEvents: true,
    },
  },

  // Configuration des uploads (inchangée)
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024,
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
    limits: {
      image: 2 * 1024 * 1024,
      audio: 10 * 1024 * 1024,
      video: 50 * 1024 * 1024,
    },
  },

  // Configuration des sessions de quiz (légèrement augmentée)
  quiz: {
    defaults: {
      maxQuestions: 150, // Augmenté de 100 à 150
      maxOptions: 12, // Augmenté de 10 à 12
      maxTimeLimit: 600, // 10 minutes au lieu de 5
      minTimeLimit: 3, // Réduit de 5 à 3 secondes
      maxPoints: 100,
      maxParticipants: 150, // Cohérent avec socket.maxParticipants
      sessionCodeLength: 6,
    },
    questionTypes: ["qcm", "vrai_faux", "reponse_libre", "nuage_mots"],
    difficulties: ["facile", "moyen", "difficile"],
    sessionStatuses: ["waiting", "active", "paused", "finished", "cancelled"],
  },

  // Configuration de logging optimisée
  logging: {
    level:
      process.env.LOG_LEVEL ||
      (process.env.NODE_ENV === "development" ? "debug" : "info"),
    enableConsole: process.env.NODE_ENV === "development",
    enableFile: process.env.LOG_TO_FILE === "true",

    // Nouvelles options de logging pour Socket.IO
    socket: {
      enabled:
        process.env.SOCKET_LOGGING === "true" ||
        process.env.NODE_ENV === "development",
      level: process.env.SOCKET_LOG_LEVEL || "info",
      events: {
        connection: true,
        disconnection: true,
        errors: true,
        performance: process.env.NODE_ENV === "development",
      },
    },

    files: {
      error: "logs/error.log",
      combined: "logs/combined.log",
      access: "logs/access.log",
      socket: "logs/socket.log", // Nouveau log spécifique
      performance: "logs/performance.log", // Nouveau log de performance
    },
  },

  // Configuration de sécurité renforcée
  security: {
    helmet: {
      contentSecurityPolicy: process.env.NODE_ENV === "production",
      crossOriginEmbedderPolicy: false,
      // Nouvelles options de sécurité
      hsts: process.env.NODE_ENV === "production",
      noSniff: true,
      frameguard: { action: "deny" },
    },
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12,
    sessionTimeout:
      parseInt(process.env.SESSION_TIMEOUT) || 24 * 60 * 60 * 1000,
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5,
    lockoutDuration: parseInt(process.env.LOCKOUT_DURATION) || 15 * 60 * 1000,

    // Nouvelles options de sécurité Socket.IO
    socket: {
      origins: "*:*", // À restreindre en production
      authorization: true,
      maxConnections: 1000,
      rateLimit: true,
    },
  },

  // Configuration de cache pour les performances
  cache: {
    enabled:
      process.env.CACHE_ENABLED === "true" ||
      process.env.NODE_ENV === "production",
    type: process.env.CACHE_TYPE || "memory", // memory | redis
    ttl: parseInt(process.env.CACHE_TTL) || 300, // 5 minutes par défaut

    // Cache spécifique pour les sessions
    sessions: {
      enabled: true,
      maxSize: 500, // 500 sessions en cache max
      ttl: 30 * 60 * 1000, // 30 minutes
      cleanupInterval: 5 * 60 * 1000, // Nettoyer toutes les 5 min
    },

    // Cache pour les utilisateurs
    users: {
      enabled: true,
      maxSize: 1000, // 1000 utilisateurs en cache max
      ttl: 10 * 60 * 1000, // 10 minutes
    },
  },

  // Configuration des emails (inchangée)
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

  // Nouvelles options de performance générale
  performance: {
    // Compression des réponses HTTP
    compression: {
      enabled: true,
      level: 6,
      threshold: 1024,
    },

    // Keep-alive pour les connexions HTTP
    keepAlive: {
      enabled: true,
      timeout: 65000,
      maxConnections: 100,
    },

    // Monitoring des performances
    monitoring: {
      enabled:
        process.env.MONITORING_ENABLED === "true" ||
        process.env.NODE_ENV === "development",
      interval: 30000, // Toutes les 30 secondes
      metrics: ["memory", "cpu", "sockets", "database"],
    },
  },

  // Configuration des fonctionnalités
  features: {
    openRegistration: process.env.OPEN_REGISTRATION !== "false",
    allowAnonymousParticipation: process.env.ALLOW_ANONYMOUS !== "false",
    enableChat: process.env.ENABLE_CHAT !== "false",
    enableExport: process.env.ENABLE_EXPORT !== "false",
    enableFileUpload: process.env.ENABLE_FILE_UPLOAD === "true",
    maintenanceMode: process.env.MAINTENANCE_MODE === "true",

    // Nouvelles fonctionnalités d'optimisation
    enableSocketCompression: process.env.SOCKET_COMPRESSION !== "false",
    enableBatching: process.env.ENABLE_BATCHING !== "false",
    enableCaching: process.env.ENABLE_CACHING !== "false",
  },

  // Messages d'erreur
  messages: {
    errors: {
      generic: "Une erreur est survenue",
      notFound: "Ressource non trouvée",
      unauthorized: "Accès non autorisé",
      forbidden: "Action interdite",
      rateLimit: "Trop de requêtes",
      maintenance: "Service en maintenance",
    },
  },
};

// Validation de la configuration avec nouvelles vérifications
const validateConfig = () => {
  const errors = [];
  const warnings = [];

  // Vérifications essentielles existantes
  if (
    !config.jwt.secret ||
    config.jwt.secret === "default-secret-change-in-production"
  ) {
    if (config.server.env === "production") {
      errors.push("JWT_SECRET doit être défini en production");
    } else {
      warnings.push("JWT_SECRET utilise la valeur par défaut");
    }
  }

  if (!config.database.password && config.server.env === "production") {
    errors.push("Mot de passe de base de données requis en production");
  }

  // Nouvelles vérifications de performance
  if (config.socket.maxParticipants > 200) {
    warnings.push(
      `socket.maxParticipants (${config.socket.maxParticipants}) très élevé - impact performance possible`
    );
  }

  if (config.socket.pingInterval < 30000) {
    warnings.push(
      `socket.pingInterval (${config.socket.pingInterval}ms) très fréquent - consommation élevée`
    );
  }

  if (config.database.pool.max < 5) {
    warnings.push("Pool de connexions DB potentiellement insuffisant");
  }

  // Affichage des erreurs et warnings
  if (errors.length > 0) {
    console.error("❌ Erreurs de configuration:");
    errors.forEach((error) => console.error(`   - ${error}`));

    if (config.server.env === "production") {
      process.exit(1);
    }
  }

  if (warnings.length > 0) {
    console.warn("⚠️  Avertissements de configuration:");
    warnings.forEach((warning) => console.warn(`   - ${warning}`));
  }
};

// Affichage optimisé de la configuration
const displayConfig = () => {
  if (config.server.env === "development") {
    console.log("⚙️  Configuration optimisée:");
    console.log(`   - Environnement: ${config.server.env}`);
    console.log(`   - Port: ${config.server.port}`);
    console.log(
      `   - Base de données: ${config.database.host}:${config.database.port}/${config.database.name}`
    );
    console.log(
      `   - Pool DB: min=${config.database.pool.min}, max=${config.database.pool.max}`
    );
    console.log(
      `   - Socket.IO: ping=${config.socket.pingInterval}ms, timeout=${config.socket.pingTimeout}ms`
    );
    console.log(
      `   - Rate Limit: ${config.rateLimit.max} req/${config.rateLimit.windowMs}ms`
    );
    console.log(
      `   - Participants max: ${config.socket.maxParticipants} par session`
    );
    console.log(`   - Cache: ${config.cache.enabled ? "activé" : "désactivé"}`);
    console.log(
      `   - Compression: ${
        config.features.enableSocketCompression ? "activée" : "désactivée"
      }`
    );
    console.log(
      `   - Heartbeat personnalisé: ${config.socket.customHeartbeat.interval}ms`
    );
  }
};

module.exports = {
  ...config,
  validateConfig,
  displayConfig,
};
