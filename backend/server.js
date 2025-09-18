require("dotenv").config();
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

// Import de la configuration
const config = require("./config");

// Import des routes
const authRoutes = require("./routes/auth");
const quizRoutes = require("./routes/quiz");
const sessionRoutes = require("./routes/session");

// Import de la configuration de la base de données
const { connectDB } = require("./config/database");

// Import des gestionnaires Socket.IO
const socketHandlers = require("./socket/socketHandlers");

// Validation et affichage de la configuration
config.validateConfig();
config.displayConfig();

const app = express();
const server = http.createServer(app);

// Configuration Socket.IO avec options avancées
const io = socketIo(server, {
  cors: config.cors,
  pingTimeout: config.socket.pingTimeout,
  pingInterval: config.socket.pingInterval,
  maxHttpBufferSize: config.socket.maxHttpBufferSize,
});

// Middlewares de sécurité
app.use(helmet(config.security.helmet));
app.use(cors(config.cors));

// Rate limiting global
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: config.rateLimit.message,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Middlewares de parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Connexion à la base de données
connectDB();

// Rendre io disponible dans les routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Routes API
app.use("/api/auth", authRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/session", sessionRoutes);

// Route de santé avec informations détaillées
app.get("/api/health", (req, res) => {
  res.json({
    message: "Quiz App Backend API - Fonctionnel",
    timestamp: new Date().toISOString(),
    env: config.server.env,
    version: "1.0.0",
    features: {
      openRegistration: config.features.openRegistration,
      allowAnonymous: config.features.allowAnonymousParticipation,
      chat: config.features.enableChat,
      export: config.features.enableExport,
    },
    maintenance: config.features.maintenanceMode,
  });
});

// Route de statistiques (admin seulement)
app.get(
  "/api/stats",
  require("./middleware/auth").authenticateToken,
  require("./middleware/auth").requireRole("admin"),
  async (req, res) => {
    try {
      const { getDatabaseStats } = require("./models");
      const stats = await getDatabaseStats();

      res.json({
        database: stats,
        server: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          nodeVersion: process.version,
        },
        config: {
          environment: config.server.env,
          features: config.features,
        },
      });
    } catch (error) {
      console.error("Erreur lors de la récupération des statistiques:", error);
      res
        .status(500)
        .json({ error: "Erreur lors de la récupération des statistiques" });
    }
  }
);

// Middleware de maintenance
app.use((req, res, next) => {
  if (config.features.maintenanceMode && !req.path.includes("/health")) {
    return res.status(503).json({
      error: "Application en maintenance",
      message:
        "L'application est temporairement indisponible pour maintenance.",
      code: "MAINTENANCE_MODE",
    });
  }
  next();
});

// Gestionnaire Socket.IO
socketHandlers(io);

// Gestion des erreurs 404
app.use((req, res) => {
  res.status(404).json({
    error: config.messages.errors.notFound,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
});

// Gestionnaire d'erreurs global
app.use((error, req, res, next) => {
  console.error("Erreur serveur:", error);

  // Erreur de validation Sequelize
  if (error.name === "SequelizeValidationError") {
    return res.status(400).json({
      error: "Données invalides",
      details: error.errors.map((err) => ({
        field: err.path,
        message: err.message,
        value: err.value,
      })),
    });
  }

  // Erreur de contrainte unique
  if (error.name === "SequelizeUniqueConstraintError") {
    return res.status(409).json({
      error: "Ressource déjà existante",
      field: error.errors[0]?.path,
      code: "DUPLICATE_ENTRY",
    });
  }

  // Erreur JWT
  if (error.name === "JsonWebTokenError") {
    return res.status(401).json({
      error: "Token invalide",
      code: "INVALID_TOKEN",
    });
  }

  res.status(500).json({
    error: config.messages.errors.generic,
    code: "INTERNAL_ERROR",
    ...(config.server.env === "development" && {
      details: error.message,
      stack: error.stack,
    }),
    timestamp: new Date().toISOString(),
  });
});

// Démarrage du serveur
server.listen(config.server.port, () => {
  console.log(`🚀 Serveur démarré sur le port ${config.server.port}`);
  console.log(`📡 Mode: ${config.server.env}`);
  console.log(
    `🔗 API disponible sur: http://${config.server.host}:${config.server.port}/api`
  );
  console.log(
    `🔌 Socket.IO sur: http://${config.server.host}:${config.server.port}`
  );
  console.log(`📋 Documentation: Voir README.md`);
});
