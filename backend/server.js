require("dotenv").config();
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

// Import de la configuration optimisée
const config = require("./config");

// Import des routes
const authRoutes = require("./routes/auth");
const quizRoutes = require("./routes/quiz");
const sessionRoutes = require("./routes/session");

// Import de la configuration de la base de données
const { connectDB } = require("./config/database");
// const { connectDB } = require("./config/database-clean");

// Import des gestionnaires Socket.IO optimisés
const socketHandlers = require("./socket/socketHandlers");

// Validation et affichage de la configuration
config.validateConfig();
config.displayConfig();

const app = express();
const server = http.createServer(app);

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (config.cors.origins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }

  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  next();
});

// Configuration Socket.IO simplifiée et compatible
const io = socketIo(server, {
  // Configuration CORS compatible
  cors: {
    origin: config.cors.origins, // Utilise la propriété 'origins' existante
    credentials: config.cors.credentials,
    methods: config.cors.methods,
    allowedHeaders: config.cors.allowedHeaders,
  },

  // Timeouts optimisés
  pingTimeout: config.socket.pingTimeout,
  pingInterval: config.socket.pingInterval,
  maxHttpBufferSize: config.socket.maxHttpBufferSize,

  // Transport et options de base (compatibles)
  transports: ["websocket", "polling"],
  allowEIO3: true, // Compatibilité avec les anciennes versions

  // Options de connexion simplifiées
  connectTimeout: 45000,
  serveClient: false,
});

// Middleware de compression HTTP (seulement si compression disponible)
let compressionAvailable = false;
try {
  const compression = require("compression");
  compressionAvailable = true;

  app.use(
    compression({
      level: 6,
      threshold: 1024,
      filter: (req, res) => {
        if (req.headers["x-no-compression"]) {
          return false;
        }
        return compression.filter(req, res);
      },
    })
  );
  console.log("✅ Compression HTTP activée");
} catch (error) {
  console.warn(
    "⚠️ Compression non disponible - installer avec: npm install compression"
  );
}

// Middlewares de sécurité avec CORS corrigé
app.use(helmet(config.security?.helmet || {}));

app.use(
  cors({
    origin: config.cors.origins, // Utilise directement le tableau d'origins
    credentials: config.cors.credentials,
    methods: config.cors.methods,
    allowedHeaders: config.cors.allowedHeaders,
    optionsSuccessStatus: 200,
  })
);

// Middleware CORS manuel pour les préflight requests
app.options(
  "*",
  cors({
    origin: config.cors.origins,
    credentials: config.cors.credentials,
    methods: config.cors.methods,
    allowedHeaders: config.cors.allowedHeaders,
  })
);

// Trust proxy pour les déploiements derrière un reverse proxy
if (config.server.env === "production") {
  app.set("trust proxy", 1);
}

// Rate limiting global
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: config.rateLimit.message,
  standardHeaders: true,
  legacyHeaders: false,

  // Skip rate limiting pour les health checks
  skip: (req) => {
    return req.path === "/api/health" || req.path === "/health";
  },
});

app.use(limiter);

// Rate limiting spécifique pour l'authentification
const authLimiter = rateLimit({
  windowMs: config.rateLimit.auth.windowMs,
  max: config.rateLimit.auth.max,
  message: config.rateLimit.auth.message,
  standardHeaders: true,
  legacyHeaders: false,
});

// Middlewares de parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Middleware de monitoring des performances (optionnel)
if (config.performance?.monitoring?.enabled) {
  app.use((req, res, next) => {
    const startTime = Date.now();

    res.on("finish", () => {
      const duration = Date.now() - startTime;

      if (duration > 1000) {
        // Log requests > 1s
        console.warn(
          `⚠️ Requête lente: ${req.method} ${req.path} - ${duration}ms`
        );
      }
    });

    next();
  });
}

// Connexion à la base de données avec retry logic
const connectWithRetry = async (retries = 5) => {
  for (let i = 0; i < retries; i++) {
    try {
      await connectDB();
      console.log("✅ Base de données connectée");
      break;
    } catch (error) {
      console.error(
        `❌ Tentative ${i + 1}/${retries} de connexion DB échouée:`,
        error.message
      );

      if (i === retries - 1) {
        console.error("💥 Impossible de se connecter à la base de données");
        if (config.server.env === "production") {
          process.exit(1);
        } else {
          console.warn("⚠️ Continuant en mode développement sans DB");
        }
      } else {
        // Attendre avant la prochaine tentative
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }
};

connectWithRetry();

// Rendre io disponible dans les routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Middleware de maintenance
app.use((req, res, next) => {
  if (config.features?.maintenanceMode && req.path !== "/api/health") {
    return res.status(503).json({
      error: "Service en maintenance",
      code: "MAINTENANCE_MODE",
      estimatedDowntime: process.env.MAINTENANCE_ETA || "Inconnue",
    });
  }
  next();
});

// Routes API
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/session", sessionRoutes);
app.use("/api/admin", require("./routes/admin"));

// Route de santé détaillée
app.get("/api/health", (req, res) => {
  const memUsage = process.memoryUsage();
  const uptime = process.uptime();

  res.json({
    status: "healthy",
    message: "Quiz App Backend API - Fonctionnel (Optimisé)",
    timestamp: new Date().toISOString(),
    env: config.server.env,
    version: "1.0.0-optimized",
    uptime: {
      seconds: Math.floor(uptime),
      human: `${Math.floor(uptime / 3600)}h ${Math.floor(
        (uptime % 3600) / 60
      )}m ${Math.floor(uptime % 60)}s`,
    },
    memory: {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
    },
    sockets: {
      connected: io.engine?.clientsCount || 0,
      maxConnections: config.socket?.maxConnections || 1000,
    },
    features: {
      compression: compressionAvailable,
      monitoring: config.performance?.monitoring?.enabled || false,
      caching: config.cache?.enabled || false,
      openRegistration: config.features?.openRegistration !== false,
      allowAnonymous: config.features?.allowAnonymousParticipation !== false,
      chat: config.features?.enableChat !== false,
      export: config.features?.enableExport !== false,
    },
    maintenance: config.features?.maintenanceMode || false,
  });
});

// Route de métriques simplifiée
app.get("/api/metrics", (req, res) => {
  const memUsage = process.memoryUsage();

  res.json({
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: memUsage,
    sockets: {
      connected: io.engine?.clientsCount || 0,
      rooms: Object.keys(io.sockets.adapter.rooms || {}).length,
    },
    platform: {
      arch: process.arch,
      platform: process.platform,
      version: process.version,
    },
  });
});

// Gestionnaire Socket.IO
socketHandlers(io);

// Monitoring des connexions Socket.IO (simplifié)
const monitorConnections = () => {
  const connectedSockets = io.engine?.clientsCount || 0;
  const maxConnections = config.socket?.maxConnections || 1000;

  if (connectedSockets > maxConnections * 0.9) {
    console.warn(
      `⚠️ Connexions élevées: ${connectedSockets}/${maxConnections}`
    );
  }

  if (config.server.env === "development") {
    console.log(`📊 Connexions actives: ${connectedSockets}`);
  }
};

// Monitoring toutes les 30 secondes
setInterval(monitorConnections, 30000);

// Gestion des erreurs 404
app.use((req, res) => {
  res.status(404).json({
    error: "Ressource non trouvée",
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
    suggestion: "Vérifiez l'URL et la méthode HTTP",
  });
});

// Gestionnaire d'erreurs global
app.use((error, req, res, next) => {
  console.error("💥 Erreur serveur:", error);

  // Erreurs de validation Sequelize
  if (error.name === "SequelizeValidationError") {
    return res.status(400).json({
      error: "Données invalides",
      code: "VALIDATION_ERROR",
      details:
        error.errors?.map((err) => ({
          field: err.path,
          message: err.message,
          value: err.value,
        })) || [],
      timestamp: new Date().toISOString(),
    });
  }

  // Erreurs de contrainte unique
  if (error.name === "SequelizeUniqueConstraintError") {
    return res.status(409).json({
      error: "Ressource déjà existante",
      code: "DUPLICATE_ENTRY",
      field: error.errors?.[0]?.path,
      timestamp: new Date().toISOString(),
    });
  }

  // Erreurs JWT
  if (error.name === "JsonWebTokenError") {
    return res.status(401).json({
      error: "Token invalide",
      code: "INVALID_TOKEN",
      timestamp: new Date().toISOString(),
    });
  }

  // Erreurs de payload trop volumineux
  if (error.type === "entity.too.large") {
    return res.status(413).json({
      error: "Payload trop volumineux",
      code: "PAYLOAD_TOO_LARGE",
      limit: "10MB",
      timestamp: new Date().toISOString(),
    });
  }

  // Erreur générique
  const statusCode = error.status || error.statusCode || 500;
  res.status(statusCode).json({
    error: statusCode === 500 ? "Une erreur est survenue" : error.message,
    code: error.code || "INTERNAL_ERROR",
    ...(config.server.env === "development" && {
      details: error.message,
      stack: error.stack,
    }),
    timestamp: new Date().toISOString(),
  });
});

// Gestion propre des signaux de fermeture
const gracefulShutdown = (signal) => {
  console.log(`📴 Signal ${signal} reçu, fermeture en cours...`);

  server.close((err) => {
    if (err) {
      console.error("❌ Erreur lors de la fermeture du serveur:", err);
      process.exit(1);
    }

    console.log("✅ Serveur fermé proprement");

    // Fermer les connexions Socket.IO
    io.close(() => {
      console.log("✅ Socket.IO fermé");
      process.exit(0);
    });
  });

  // Force la fermeture après 10 secondes
  setTimeout(() => {
    console.error("⏰ Fermeture forcée après timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Gestion des erreurs non capturées
process.on("uncaughtException", (error) => {
  console.error("💥 Exception non capturée:", error);
  gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 Promesse rejetée non gérée:", reason);
  gracefulShutdown("unhandledRejection");
});

// Démarrage du serveur
const PORT = config.server.port;
const HOST = config.server.host;

server.listen(PORT, HOST, () => {
  console.log(`\n🚀 ==========================================`);
  console.log(`   Quiz App Backend OPTIMISÉ CORRIGÉ !`);
  console.log(`🌐 API: http://${HOST}:${PORT}/api`);
  console.log(`🔌 Socket.IO: http://${HOST}:${PORT}`);
  console.log(`📊 Health: http://${HOST}:${PORT}/api/health`);
  console.log(`📈 Métriques: http://${HOST}:${PORT}/api/metrics`);
  console.log(`⚙️  Mode: ${config.server.env}`);
  console.log(`🔧 Compression: ${compressionAvailable ? "✅" : "❌"}`);
  console.log(`💾 Socket: ping=${config.socket.pingInterval}ms`);
  console.log(`==========================================\n`);
});
