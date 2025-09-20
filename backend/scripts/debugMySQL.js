// Script de debug MySQL - backend/scripts/debugMySQL.js

const { sequelize } = require("../config/database-clean");
const { QueryTypes } = require("sequelize");

console.log("🔍 === DEBUG CONNEXION ET FORMAT MYSQL ===\n");

async function debugMySQLFormats() {
  try {
    // 1. Test de connexion de base
    console.log("1️⃣ Test de connexion...");
    await sequelize.authenticate();
    console.log("✅ Connexion établie");

    // 2. Test des différentes méthodes de requête
    console.log("\n2️⃣ Test des formats de requête...");
    
    // Méthode 1: Query directe
    console.log("🔍 Méthode 1: Query directe");
    try {
      const result1 = await sequelize.query("SHOW TABLES");
      console.log("   Type résultat:", typeof result1);
      console.log("   IsArray:", Array.isArray(result1));
      console.log("   Length:", result1?.length);
      console.log("   Contenu:", result1);
    } catch (error1) {
      console.log("   ❌ Erreur:", error1.message);
    }

    // Méthode 2: Query avec type SELECT
    console.log("\n🔍 Méthode 2: Query avec type SELECT");
    try {
      const result2 = await sequelize.query("SHOW TABLES", { type: QueryTypes.SELECT });
      console.log("   Type résultat:", typeof result2);
      console.log("   IsArray:", Array.isArray(result2));
      console.log("   Length:", result2?.length);
      console.log("   Premier élément:", result2?.[0]);
      console.log("   Type premier élément:", typeof result2?.[0]);
      if (result2?.[0]) {
        console.log("   Clés premier élément:", Object.keys(result2[0]));
        console.log("   Valeurs premier élément:", Object.values(result2[0]));
      }
    } catch (error2) {
      console.log("   ❌ Erreur:", error2.message);
    }

    // Méthode 3: INFORMATION_SCHEMA
    console.log("\n🔍 Méthode 3: INFORMATION_SCHEMA");
    try {
      const result3 = await sequelize.query(
        "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE()",
        { type: QueryTypes.SELECT }
      );
      console.log("   Type résultat:", typeof result3);
      console.log("   IsArray:", Array.isArray(result3));
      console.log("   Length:", result3?.length);
      console.log("   Premier élément:", result3?.[0]);
    } catch (error3) {
      console.log("   ❌ Erreur:", error3.message);
    }

    // 3. Test avec une table spécifique (si elle existe)
    console.log("\n3️⃣ Test avec tables spécifiques...");
    
    const possibleTables = ["users", "quizzes", "sessions", "user", "quiz", "session"];
    
    for (const table of possibleTables) {
      try {
        console.log(`🔍 Test existence table: ${table}`);
        const result = await sequelize.query(`SHOW TABLES LIKE '${table}'`, { type: QueryTypes.SELECT });
        
        if (result && result.length > 0) {
          console.log(`   ✅ Table ${table} existe`);
          
          // Test SHOW INDEX
          try {
            const indexes = await sequelize.query(`SHOW INDEX FROM ${table}`, { type: QueryTypes.SELECT });
            console.log(`   📊 Index trouvés: ${indexes?.length || 0}`);
            if (indexes && indexes.length > 0) {
              console.log(`   Premier index:`, indexes[0]);
            }
          } catch (indexError) {
            console.log(`   ❌ Erreur index ${table}:`, indexError.message);
          }
        } else {
          console.log(`   ⏭️  Table ${table} n'existe pas`);
        }
      } catch (tableError) {
        console.log(`   ❌ Erreur test ${table}:`, tableError.message);
      }
    }

    // 4. Informations sur la base de données
    console.log("\n4️⃣ Informations base de données...");
    
    try {
      const [dbInfo] = await sequelize.query("SELECT DATABASE() as current_db, VERSION() as version", { type: QueryTypes.SELECT });
      console.log("📊 Info DB:", dbInfo);
    } catch (dbError) {
      console.log("❌ Erreur info DB:", dbError.message);
    }

    // 5. Test création table simple
    console.log("\n5️⃣ Test création table temporaire...");
    
    try {
      await sequelize.query("DROP TABLE IF EXISTS test_debug_table");
      await sequelize.query(`
        CREATE TABLE test_debug_table (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(50),
          INDEX idx_name (name)
        )
      `);
      
      console.log("✅ Table test créée");
      
      // Tester SHOW INDEX sur cette table
      const testIndexes = await sequelize.query("SHOW INDEX FROM test_debug_table", { type: QueryTypes.SELECT });
      console.log("📊 Index table test:", testIndexes?.length);
      console.log("   Détail index:", testIndexes);
      
      // Nettoyer
      await sequelize.query("DROP TABLE test_debug_table");
      console.log("🧹 Table test supprimée");
      
    } catch (testError) {
      console.log("❌ Erreur test table:", testError.message);
    }

  } catch (error) {
    console.error("💥 Erreur générale:", error.message);
    console.error("Stack:", error.stack);
  } finally {
    try {
      await sequelize.close();
      console.log("\n✅ Connexion fermée");
    } catch (closeError) {
      console.error("❌ Erreur fermeture:", closeError.message);
    }
  }
}

// Exécution
if (require.main === module) {
  debugMySQLFormats().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error("💥 Erreur fatale:", error);
    process.exit(1);
  });
}

module.exports = { debugMySQLFormats };