// Configuration database optimisée - backend/config/database.js

const { Sequelize } = require("sequelize");

// Configuration de la connexion MySQL avec optimisations pour éviter trop d'index
const sequelize = new Sequelize({
  dialect: "mysql",
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_NAME || "quiz_app",
  username: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",

  // Options de configuration optimisées
  logging: process.env.NODE_ENV === "development" ? console.log : false,

  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
    evict: 10000,
    handleDisconnects: true,
  },

  define: {
    timestamps: true,
    underscored: false,
    freezeTableName: true, // Empêche la pluralisation automatique
    
    // IMPORTANT: Désactiver la création automatique d'index
    indexes: [], // Pas d'index automatiques
  },

  // Options de synchronisation restrictives
  sync: {
    force: false, // Ne jamais forcer
    alter: false, // Ne jamais altérer automatiquement
    indexes: false, // Ne pas créer d'index automatiquement
  },

  // Options MySQL optimisées (options valides uniquement)
  dialectOptions: {
    charset: "utf8mb4",
    // collate retiré - non supporté par mysql2
    
    // Optimisations spécifiques MySQL2
    bigNumberStrings: false,
    supportBigNumbers: true,
    dateStrings: false,
    debug: false,
    trace: false,
    multipleStatements: false,
    
    // Options de connexion valides pour mysql2
    connectTimeout: 60000,
    acquireTimeout: 60000,
    timeout: 60000,
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

    // En développement, vérifier les tables mais NE PAS synchroniser automatiquement
    if (process.env.NODE_ENV === "development") {
      console.log("🔍 Mode développement - vérification des tables...");
      
      try {
        // Vérifier si les tables existent
        const [tables] = await sequelize.query(
          "SHOW TABLES LIKE 'users'"
        );
        
        if (tables.length === 0) {
          console.log("⚠️  Tables non trouvées");
          console.log("💡 Exécutez: npm run sync:optimized");
          console.log("   ou: node scripts/syncModelsOptimized.js");
        } else {
          // Compter les index pour vérifier s'il y a trop d'index
          const [indexCount] = await sequelize.query(`
            SELECT TABLE_NAME, COUNT(*) as index_count 
            FROM INFORMATION_SCHEMA.STATISTICS 
            WHERE TABLE_SCHEMA = DATABASE() 
            GROUP BY TABLE_NAME
          `);
          
          console.log("📊 Index par table:");
          indexCount.forEach(table => {
            const status = table.index_count > 15 ? "⚠️ " : "✅";
            console.log(`   ${status} ${table.TABLE_NAME}: ${table.index_count} index`);
          });
          
          const totalIndexes = indexCount.reduce((sum, table) => sum + table.index_count, 0);
          if (totalIndexes > 50) {
            console.log("⚠️  ATTENTION: Trop d'index détectés");
            console.log("💡 Exécutez: npm run clean:indexes");
          }
        }
        
      } catch (checkError) {
        console.log("⚠️  Impossible de vérifier les tables:", checkError.message);
      }
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
        case "ER_TOO_MANY_KEYS":
          console.error(
            "🔑 ERREUR: Trop d'index sur les tables (limite MySQL: 64 par table)"
          );
          console.error("💡 Solutions:");
          console.error("   1. Exécutez: npm run clean:indexes");
          console.error("   2. Ou: node scripts/cleanIndexes.js");
          console.error("   3. Ou: npm run sync:optimized (recrée tout)");
          break;
        case "ER_CANT_CREATE_TABLE":
          console.error(
            "🚫 Impossible de créer la table - vérifiez les permissions"
          );
          break;
        default:
          console.error(`💥 Erreur MySQL: ${error.original.code}`);
          if (error.original.code && error.original.code.includes("KEY")) {
            console.error("💡 Problème d'index détecté - exécutez: npm run clean:indexes");
          }
      }
    }

    // Si c'est un problème d'index, ne pas quitter
    if (error.original && error.original.code === "ER_TOO_MANY_KEYS") {
      console.error("🔄 Tentative de nettoyage automatique des index...");
      try {
        const { cleanDuplicateIndexes } = require("../scripts/cleanIndexes");
        await cleanDuplicateIndexes();
        console.log("✅ Nettoyage terminé - redémarrez l'application");
      } catch (cleanError) {
        console.error("❌ Échec nettoyage automatique:", cleanError.message);
        console.error("🔧 Nettoyage manuel requis");
      }
    }

    process.exit(1);
  }
};

// Fonction utilitaire pour vérifier l'état des index
const checkIndexHealth = async () => {
  try {
    const [indexStats] = await sequelize.query(`
      SELECT 
        TABLE_NAME,
        COUNT(*) as index_count,
        GROUP_CONCAT(DISTINCT INDEX_NAME ORDER BY INDEX_NAME) as indexes
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() 
      GROUP BY TABLE_NAME
      HAVING COUNT(*) > 10
      ORDER BY index_count DESC
    `);

    if (indexStats.length > 0) {
      console.log("⚠️  Tables avec beaucoup d'index:");
      indexStats.forEach(stat => {
        console.log(`   ${stat.TABLE_NAME}: ${stat.index_count} index`);
        if (stat.index_count > 20) {
          console.log(`      ⚠️  CRITIQUE: trop d'index!`);
        }
      });
      return false;
    }

    return true;
  } catch (error) {
    console.error("❌ Erreur vérification index:", error.message);
    return false;
  }
};

// Fonction pour synchroniser en mode sécurisé (sans création d'index automatique)
const safeSyncModels = async (options = {}) => {
  try {
    console.log("🔄 Synchronisation sécurisée des modèles...");
    
    // Vérifier d'abord l'état des index
    const indexHealthy = await checkIndexHealth();
    if (!indexHealthy && !options.force) {
      console.log("⚠️  Index en mauvais état - synchronisation annulée");
      console.log("💡 Utilisez { force: true } ou nettoyez d'abord les index");
      return false;
    }

    // Synchronisation sans altération automatique
    await sequelize.sync({
      force: false,
      alter: false,
      hooks: false, // Désactiver tous les hooks pour éviter la création d'index
    });

    console.log("✅ Synchronisation sécurisée terminée");
    return true;

  } catch (error) {
    console.error("❌ Erreur synchronisation sécurisée:", error.message);
    
    if (error.original && error.original.code === "ER_TOO_MANY_KEYS") {
      console.error("🔑 Trop d'index détectés pendant la synchronisation");
      console.error("💡 Exécutez le nettoyage: npm run clean:indexes");
    }
    
    return false;
  }
};

// Gestion de la fermeture propre
const gracefulShutdown = async (signal) => {
  console.log(`\n📊 Signal ${signal} reçu - fermeture de la connexion MySQL...`);
  
  try {
    await sequelize.close();
    console.log("📊 Connexion MySQL fermée proprement.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Erreur lors de la fermeture:", error);
    process.exit(1);
  }
};

// Écoute des signaux de fermeture
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

// Gestion des erreurs non capturées
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Rejection non gérée:", reason);
  
  // Si c'est une erreur d'index, suggérer une solution
  if (reason && reason.original && reason.original.code === "ER_TOO_MANY_KEYS") {
    console.error("💡 Erreur d'index détectée - redémarrez après nettoyage");
  }
});

module.exports = { 
  sequelize, 
  connectDB, 
  checkIndexHealth, 
  safeSyncModels 
};