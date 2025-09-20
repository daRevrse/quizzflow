// Configuration database avec création automatique - backend/config/database.js

const { Sequelize } = require("sequelize");

// Fonction pour créer la base de données si elle n'existe pas
const createDatabaseIfNotExists = async () => {
  // Connexion sans spécifier de base de données
  const tempSequelize = new Sequelize({
    dialect: "mysql",
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    username: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    // PAS de database ici pour pouvoir se connecter au serveur MySQL
    logging: false,
  });

  try {
    // Test de connexion au serveur MySQL
    await tempSequelize.authenticate();
    console.log("✅ Connexion au serveur MySQL établie");

    const databaseName = process.env.DB_NAME || "quiz_app";
    
    // Vérifier si la base existe
    const [databases] = await tempSequelize.query(
      `SHOW DATABASES LIKE '${databaseName}'`
    );

    if (databases.length === 0) {
      // Créer la base de données
      console.log(`🏗️  Création de la base de données: ${databaseName}`);
      await tempSequelize.query(`CREATE DATABASE \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      console.log(`✅ Base de données ${databaseName} créée`);
    } else {
      console.log(`📦 Base de données ${databaseName} existe déjà`);
    }

  } catch (error) {
    console.error("❌ Erreur création base de données:", error.message);
    throw error;
  } finally {
    // Fermer la connexion temporaire
    await tempSequelize.close();
  }
};

// Configuration principale Sequelize (avec database)
const sequelize = new Sequelize({
  dialect: "mysql",
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_NAME || "quiz_app", // Maintenant la DB existe
  username: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",

  // Options de configuration optimisées
  logging: process.env.NODE_ENV === "development" ? console.log : false,
  benchmark: process.env.NODE_ENV === "development",

  pool: {
    max: parseInt(process.env.DB_POOL_MAX) || 5,
    min: parseInt(process.env.DB_POOL_MIN) || 0,
    acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 30000,
    idle: parseInt(process.env.DB_POOL_IDLE) || 10000,
    evict: parseInt(process.env.DB_POOL_EVICT) || 10000,
    handleDisconnects: true,
  },

  define: {
    timestamps: true,
    underscored: false,
    freezeTableName: true,
    charset: "utf8mb4",
    indexes: [], // Pas d'index automatiques
  },

  sync: {
    force: false,
    alter: false,
    indexes: false,
  },

  // Options MySQL2 valides uniquement
  dialectOptions: {
    charset: "utf8mb4",
    bigNumberStrings: false,
    supportBigNumbers: true,
    dateStrings: false,
    connectTimeout: 60000,
    acquireTimeout: 60000,
    timeout: 60000,
    debug: false,
    trace: false,
    multipleStatements: false,
  },

  timezone: "+01:00",

  retry: {
    max: 3,
    timeout: 5000,
    backoffBase: 1000,
    backoffExponent: 2,
  },

  hooks: false,
});

const connectDB = async () => {
  try {
    // 1. D'abord créer la base si nécessaire
    await createDatabaseIfNotExists();

    // 2. Ensuite se connecter à la base
    console.log("🔌 Connexion à la base de données...");
    await sequelize.authenticate();
    console.log("✅ MySQL connecté avec succès");
    console.log(`📦 Base: ${process.env.DB_NAME || "quiz_app"}`);
    console.log(`🏠 Host: ${process.env.DB_HOST || "localhost"}:${process.env.DB_PORT || 3306}`);
    
    // Vérification de la version MySQL
    const [version] = await sequelize.query("SELECT VERSION() as version");
    console.log(`🗄️  MySQL version: ${version[0].version}`);

    // En développement, diagnostic des tables
    if (process.env.NODE_ENV === "development") {
      await performDevelopmentChecks();
    }

    return sequelize;
    
  } catch (error) {
    console.error("❌ Erreur de connexion MySQL:", error.message);
    await handleConnectionError(error);
    process.exit(1);
  }
};

// Vérifications en mode développement
const performDevelopmentChecks = async () => {
  try {
    console.log("🔍 Vérifications mode développement...");
    
    const [tables] = await sequelize.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE()
    `);
    
    console.log(`📊 Tables trouvées: ${tables.length}`);
    
    if (tables.length === 0) {
      console.log("⚠️  Aucune table trouvée");
      console.log("💡 Commandes disponibles:");
      console.log("   npm run sync:optimized  - Créer toutes les tables");
      console.log("   npm run db:diagnose     - Diagnostiquer les index");
      return;
    }

    const [indexStats] = await sequelize.query(`
      SELECT 
        TABLE_NAME,
        COUNT(*) as index_count
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() 
      GROUP BY TABLE_NAME
      ORDER BY index_count DESC
    `);

    console.log("📋 Index par table:");
    let hasProblems = false;
    
    indexStats.forEach(stat => {
      const status = stat.index_count > 15 ? "⚠️ " : 
                    stat.index_count > 25 ? "❌" : "✅";
      
      console.log(`   ${status} ${stat.TABLE_NAME}: ${stat.index_count} index`);
      
      if (stat.index_count > 25) {
        hasProblems = true;
      }
    });

    if (hasProblems) {
      console.log("\n🚨 PROBLÈME DÉTECTÉ:");
      console.log("   Trop d'index sur certaines tables");
      console.log("💡 Solutions:");
      console.log("   npm run clean:indexes   - Nettoyer les doublons");
      console.log("   npm run sync:optimized  - Reset complet");
    }

  } catch (error) {
    console.log("⚠️  Impossible d'effectuer les vérifications:", error.message);
  }
};

// Gestion spécifique des erreurs de connexion
const handleConnectionError = async (error) => {
  if (error.original) {
    switch (error.original.code) {
      case "ER_ACCESS_DENIED_ERROR":
        console.error("🔐 Accès refusé:");
        console.error("   - Vérifiez DB_USER et DB_PASSWORD dans .env");
        console.error("   - Vérifiez les permissions MySQL");
        console.error("   - Commande: GRANT ALL PRIVILEGES ON *.* TO 'user'@'localhost';");
        break;
        
      case "ECONNREFUSED":
        console.error("🔌 Connexion refusée:");
        console.error("   - MySQL est-il démarré ?");
        console.error("   - Port correct ? (défaut: 3306)");
        console.error("   - Host accessible ?");
        console.error("   - Commandes Windows: net start mysql");
        console.error("   - Commandes Linux: sudo systemctl start mysql");
        break;
        
      case "ER_BAD_DB_ERROR":
        console.error("📦 Base de données introuvable:");
        console.error("   - Ce problème devrait être résolu automatiquement");
        console.error("   - Si persiste, créez manuellement:");
        console.error(`   - CREATE DATABASE ${process.env.DB_NAME || "quiz_app"};`);
        break;
        
      case "ER_TOO_MANY_KEYS":
        console.error("🔑 TROP D'INDEX:");
        console.error("   Solution: npm run clean:indexes");
        break;
        
      case "ER_DBACCESS_DENIED_ERROR":
        console.error("🚫 Accès refusé à la base:");
        console.error("   - L'utilisateur n'a pas les droits sur cette base");
        console.error(`   - GRANT ALL ON ${process.env.DB_NAME || "quiz_app"}.* TO '${process.env.DB_USER || "root"}'@'localhost';`);
        break;
        
      default:
        console.error(`💥 Erreur MySQL: ${error.original.code}`);
        console.error("   Message:", error.original.message);
    }
  } else {
    console.error("💥 Erreur inconnue:", error.message);
  }
};

// Fonction utilitaire: vérifier l'état des index
const checkIndexHealth = async () => {
  try {
    const [problematicTables] = await sequelize.query(`
      SELECT 
        TABLE_NAME,
        COUNT(*) as index_count
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() 
      GROUP BY TABLE_NAME
      HAVING COUNT(*) > 20
      ORDER BY index_count DESC
    `);

    if (problematicTables.length > 0) {
      console.log("⚠️  Tables avec trop d'index:");
      problematicTables.forEach(table => {
        console.log(`   ${table.TABLE_NAME}: ${table.index_count} index`);
      });
      return false;
    }

    console.log("✅ Santé des index OK");
    return true;
    
  } catch (error) {
    console.error("❌ Erreur vérification index:", error.message);
    return false;
  }
};

// Fonction de synchronisation ultra-sécurisée
const safeSyncModels = async (options = {}) => {
  try {
    console.log("🔄 Synchronisation ultra-sécurisée...");
    
    if (!options.force) {
      const healthy = await checkIndexHealth();
      if (!healthy) {
        console.log("❌ Index en mauvais état - synchronisation annulée");
        console.log("💡 Utilisez { force: true } ou nettoyez les index");
        return false;
      }
    }

    await sequelize.sync({
      force: false,
      alter: false,
      hooks: false,
      logging: false,
    });

    console.log("✅ Synchronisation sécurisée OK");
    return true;

  } catch (error) {
    console.error("❌ Erreur synchronisation:", error.message);
    
    if (error.original?.code === "ER_TOO_MANY_KEYS") {
      console.error("🔑 Problème d'index pendant la sync");
      console.error("💡 Nettoyage requis: npm run clean:indexes");
    }
    
    return false;
  }
};

// Fermeture propre avec timeout
const gracefulShutdown = async (signal) => {
  console.log(`\n🔌 Signal ${signal} - fermeture MySQL...`);
  
  const shutdownTimeout = setTimeout(() => {
    console.error("⏰ Timeout fermeture - forçage");
    process.exit(1);
  }, 5000);

  try {
    await sequelize.close();
    clearTimeout(shutdownTimeout);
    console.log("✅ MySQL fermé proprement");
    process.exit(0);
  } catch (error) {
    console.error("❌ Erreur fermeture:", error.message);
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
};

// Gestionnaires de signaux
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

// Gestion des rejets non capturés
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Rejection non gérée:", reason?.message || reason);
  
  if (reason?.original?.code === "ER_TOO_MANY_KEYS") {
    console.error("💡 Problème d'index détecté");
    console.error("   Redémarrez après: npm run clean:indexes");
  }
});

module.exports = { 
  sequelize, 
  connectDB, 
  checkIndexHealth, 
  safeSyncModels,
  performDevelopmentChecks,
  createDatabaseIfNotExists
};