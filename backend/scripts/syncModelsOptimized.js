// Script de synchronisation optimisée - backend/scripts/syncModelsOptimized.js

// Utiliser la configuration propre (sans warnings MySQL2)
const { sequelize } = require("../config/database-clean");
const { QueryTypes } = require("sequelize");

console.log("🔄 === SYNCHRONISATION OPTIMISÉE DES MODÈLES ===\n");

async function dropAllTables() {
  console.log("🗑️  Suppression de toutes les tables...");
  
  try {
    // Désactiver les contraintes de clés étrangères temporairement
    await sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
    
    const tables = ["sessions", "quizzes", "users"]; // Ordre important
    
    for (const table of tables) {
      try {
        await sequelize.query(`DROP TABLE IF EXISTS ${table}`);
        console.log(`   ✅ Table ${table} supprimée`);
      } catch (error) {
        console.log(`   ⚠️  Table ${table} non trouvée:`, error.message);
      }
    }
    
    // Réactiver les contraintes
    await sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
    
    console.log("✅ Toutes les tables supprimées\n");
    
  } catch (error) {
    console.error("❌ Erreur suppression tables:", error.message);
    throw error;
  }
}

async function createOptimizedTables() {
  console.log("🏗️  Création des tables optimisées...");
  
  try {
    // 1. Table Users avec index minimaux
    console.log("   📝 Création table users...");
    await sequelize.query(`
      CREATE TABLE users (
        id VARCHAR(36) PRIMARY KEY,
        username VARCHAR(50) NOT NULL,
        email VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('user', 'admin') DEFAULT 'user',
        isActive BOOLEAN DEFAULT true,
        avatar VARCHAR(500) NULL,
        preferences JSON NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        -- Index uniques seulement
        UNIQUE KEY uk_users_email (email),
        UNIQUE KEY uk_users_username (username),
        
        -- Index de performance essentiels
        KEY idx_users_role (role),
        KEY idx_users_active (isActive)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    
    // 2. Table Quizzes avec index minimaux
    console.log("   📝 Création table quizzes...");
    await sequelize.query(`
      CREATE TABLE quizzes (
        id VARCHAR(36) PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        description TEXT NULL,
        creatorId VARCHAR(36) NOT NULL,
        questions JSON NOT NULL DEFAULT '[]',
        settings JSON NOT NULL DEFAULT '{}',
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        -- Clé étrangère
        FOREIGN KEY fk_quizzes_creator (creatorId) REFERENCES users(id) ON DELETE CASCADE,
        
        -- Index de performance
        KEY idx_quizzes_creator (creatorId),
        KEY idx_quizzes_created (createdAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    
    // 3. Table Sessions avec index minimaux
    console.log("   📝 Création table sessions...");
    await sequelize.query(`
      CREATE TABLE sessions (
        id VARCHAR(36) PRIMARY KEY,
        code VARCHAR(6) NOT NULL,
        title VARCHAR(255) NOT NULL,
        hostId VARCHAR(36) NOT NULL,
        quizId VARCHAR(36) NOT NULL,
        participants JSON NOT NULL DEFAULT '[]',
        status ENUM('waiting', 'active', 'paused', 'completed') DEFAULT 'waiting',
        settings JSON NOT NULL DEFAULT '{}',
        stats JSON NOT NULL DEFAULT '{}',
        currentQuestionIndex INT NULL,
        currentQuestionStartedAt DATETIME NULL,
        startedAt DATETIME NULL,
        endedAt DATETIME NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        -- Clés étrangères
        FOREIGN KEY fk_sessions_host (hostId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY fk_sessions_quiz (quizId) REFERENCES quizzes(id) ON DELETE CASCADE,
        
        -- Index uniques
        UNIQUE KEY uk_sessions_code (code),
        
        -- Index de performance essentiels
        KEY idx_sessions_status (status),
        KEY idx_sessions_host (hostId),
        KEY idx_sessions_quiz (quizId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    
    console.log("✅ Tables créées avec succès\n");
    
  } catch (error) {
    console.error("❌ Erreur création tables:", error.message);
    throw error;
  }
}

async function verifyTablesStructure() {
  console.log("🔍 Vérification de la structure des tables...");
  
  try {
    const tables = ["users", "quizzes", "sessions"];
    
    for (const table of tables) {
      console.log(`\n📊 Table: ${table.toUpperCase()}`);
      
      // Vérifier les colonnes
      const [columns] = await sequelize.query(
        `DESCRIBE ${table}`,
        { type: QueryTypes.SELECT }
      );
      
      console.log(`   Colonnes: ${columns.length}`);
      columns.forEach(col => {
        const nullStr = col.Null === "NO" ? "NOT NULL" : "NULL";
        const keyStr = col.Key ? ` (${col.Key})` : "";
        console.log(`      - ${col.Field}: ${col.Type} ${nullStr}${keyStr}`);
      });
      
      // Vérifier les index
      const [indexes] = await sequelize.query(
        `SHOW INDEX FROM ${table}`,
        { type: QueryTypes.SELECT }
      );
      
      const uniqueIndexes = [...new Set(indexes.map(idx => idx.Key_name))];
      console.log(`   Index: ${uniqueIndexes.length} (${uniqueIndexes.join(", ")})`);
      
      // Vérifier les contraintes FK
      const [constraints] = await sequelize.query(`
        SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = '${table}' 
        AND REFERENCED_TABLE_NAME IS NOT NULL
      `, { type: QueryTypes.SELECT });
      
      if (constraints.length > 0) {
        console.log(`   Contraintes FK:`);
        constraints.forEach(fk => {
          console.log(`      - ${fk.COLUMN_NAME} → ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
        });
      }
    }
    
    console.log("\n✅ Vérification terminée");
    
  } catch (error) {
    console.error("❌ Erreur vérification:", error.message);
  }
}

async function seedBasicData() {
  console.log("\n🌱 Insertion de données de test...");
  
  try {
    // Utilisateur de test
    const testUserId = "test-user-123-456-789";
    await sequelize.query(`
      INSERT INTO users (id, username, email, password, role, isActive) 
      VALUES (
        '${testUserId}',
        'testuser',
        'test@example.com',
        '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeKMcQpq6mwC7aH1m', -- password: test123
        'user',
        true
      )
    `);
    
    // Quiz de test
    const testQuizId = "test-quiz-123-456-789";
    await sequelize.query(`
      INSERT INTO quizzes (id, title, description, creatorId, questions, settings) 
      VALUES (
        '${testQuizId}',
        'Quiz de Test',
        'Quiz pour tester la base de données',
        '${testUserId}',
        '[]',
        '{}'
      )
    `);
    
    // Session de test
    const testSessionId = "test-session-123-456-789";
    await sequelize.query(`
      INSERT INTO sessions (id, code, title, hostId, quizId, participants, status, settings, stats) 
      VALUES (
        '${testSessionId}',
        'TEST01',
        'Session de Test',
        '${testUserId}',
        '${testQuizId}',
        '[]',
        'waiting',
        '{}',
        '{}'
      )
    `);
    
    console.log("✅ Données de test insérées");
    
    // Vérifier les données
    const [userCount] = await sequelize.query("SELECT COUNT(*) as count FROM users");
    const [quizCount] = await sequelize.query("SELECT COUNT(*) as count FROM quizzes");
    const [sessionCount] = await sequelize.query("SELECT COUNT(*) as count FROM sessions");
    
    console.log(`   Users: ${userCount[0].count}`);
    console.log(`   Quizzes: ${quizCount[0].count}`);
    console.log(`   Sessions: ${sessionCount[0].count}`);
    
  } catch (error) {
    console.error("❌ Erreur insertion données:", error.message);
  }
}

async function testConnections() {
  console.log("\n🧪 Test des connexions et requêtes...");
  
  try {
    // Test requête simple
    const [result] = await sequelize.query("SELECT 1 as test");
    console.log("✅ Connexion DB active");
    
    // Test jointures
    const [joinResult] = await sequelize.query(`
      SELECT u.username, q.title, s.code 
      FROM users u
      JOIN quizzes q ON u.id = q.creatorId
      JOIN sessions s ON q.id = s.quizId
      LIMIT 1
    `);
    
    if (joinResult.length > 0) {
      console.log("✅ Jointures fonctionnent:", joinResult[0]);
    }
    
    // Test JSON
    const [jsonTest] = await sequelize.query(`
      SELECT participants FROM sessions WHERE code = 'TEST01'
    `);
    
    if (jsonTest.length > 0) {
      console.log("✅ Champs JSON fonctionnent:", typeof jsonTest[0].participants);
    }
    
  } catch (error) {
    console.error("❌ Erreur tests:", error.message);
  }
}

// Fonction principale
async function main() {
  try {
    await sequelize.authenticate();
    console.log("✅ Connexion à MySQL établie\n");
    
    // 1. Supprimer toutes les tables
    await dropAllTables();
    
    // 2. Recréer avec structure optimisée
    await createOptimizedTables();
    
    // 3. Vérifier la structure
    await verifyTablesStructure();
    
    // 4. Insérer des données de test
    await seedBasicData();
    
    // 5. Tester les connexions
    await testConnections();
    
    console.log("\n🎉 Synchronisation optimisée terminée avec succès!");
    console.log("💡 Vous pouvez maintenant démarrer votre application");
    
  } catch (error) {
    console.error("\n💥 Erreur lors de la synchronisation:", error.message);
    console.error("Stack:", error.stack);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

// Exécution si appelé directement
if (require.main === module) {
  main();
}

module.exports = {
  dropAllTables,
  createOptimizedTables,
  verifyTablesStructure,
  seedBasicData,
  testConnections
};