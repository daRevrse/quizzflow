const { Sequelize } = require("sequelize");

// Configuration de la connexion MySQL
const sequelize = new Sequelize({
  dialect: "mysql",
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_NAME || "quiz_app",
  username: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",

  // Options de configuration
  logging: process.env.NODE_ENV === "development" ? console.log : false,

  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },

  define: {
    timestamps: true,
    underscored: false,
    freezeTableName: false,
  },

  timezone: "+01:00", // Fuseau horaire
});

const connectDB = async () => {
  try {
    // Test de la connexion
    await sequelize.authenticate();
    console.log("📊 MySQL connecté avec succès");
    console.log(`📦 Base de données: ${process.env.DB_NAME || "quiz_app"}`);
    console.log(
      `🏠 Host: ${process.env.DB_HOST || "localhost"}:${
        process.env.DB_PORT || 3306
      }`
    );

    // Synchronisation des modèles en mode développement
    if (process.env.NODE_ENV === "development") {
      await sequelize.sync({ alter: true });
      console.log("🔄 Modèles synchronisés avec la base de données");
    }

    return sequelize;
  } catch (error) {
    console.error("❌ Erreur de connexion à MySQL:", error.message);

    // Détails spécifiques selon le type d'erreur
    if (error.original) {
      switch (error.original.code) {
        case "ER_ACCESS_DENIED_ERROR":
          console.error(
            "🔐 Erreur d'authentification - Vérifiez vos identifiants MySQL"
          );
          break;
        case "ECONNREFUSED":
          console.error(
            "🔌 Connexion refusée - Vérifiez que MySQL est démarré"
          );
          break;
        case "ER_BAD_DB_ERROR":
          console.error(
            "📦 Base de données introuvable - Créez la base de données manuellement"
          );
          break;
        default:
          console.error(`💥 Erreur MySQL: ${error.original.code}`);
      }
    }

    process.exit(1);
  }
};

// Gestion de la fermeture propre
process.on("SIGINT", async () => {
  try {
    await sequelize.close();
    console.log("📊 Connexion MySQL fermée proprement.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Erreur lors de la fermeture:", error);
    process.exit(1);
  }
});

process.on("SIGTERM", async () => {
  try {
    await sequelize.close();
    console.log("📊 Connexion MySQL fermée proprement.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Erreur lors de la fermeture:", error);
    process.exit(1);
  }
});

module.exports = { sequelize, connectDB };
