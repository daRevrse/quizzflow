// Script de diagnostic et nettoyage des index - backend/scripts/cleanIndexes.js

// Utiliser la configuration propre (sans warnings MySQL2)
const { sequelize } = require("../config/database-clean");
const { QueryTypes } = require("sequelize");

console.log("🔍 === DIAGNOSTIC ET NETTOYAGE DES INDEX MYSQL ===\n");

async function analyzeIndexes() {
  try {
    await sequelize.authenticate();
    console.log("✅ Connexion à MySQL établie\n");

    // Vérifier d'abord quelles tables existent - méthode plus robuste
    let existingTables;
    try {
      const result = await sequelize.query(`SHOW TABLES`, { type: QueryTypes.SELECT });
      
      // Le résultat peut être dans différents formats selon MySQL
      if (Array.isArray(result)) {
        existingTables = result;
      } else {
        existingTables = [];
      }
      
      console.log("🔍 Debug - Format du résultat SHOW TABLES:");
      console.log("   Type:", typeof result);
      console.log("   IsArray:", Array.isArray(result));
      console.log("   Length:", result?.length || 0);
      console.log("   Premier élément:", result?.[0]);
      
    } catch (showTablesError) {
      console.error("❌ Erreur SHOW TABLES:", showTablesError.message);
      existingTables = [];
    }
    
    if (!existingTables || existingTables.length === 0) {
      console.log("❌ Aucune table trouvée dans la base de données");
      console.log("💡 Créez les tables avec: npm run sync:optimized");
      return;
    }
    
    console.log("📋 Tables existantes:");
    
    // Extraire les noms de tables de manière robuste
    let tableNames = [];
    try {
      existingTables.forEach((tableRow, index) => {
        console.log(`   Debug table ${index}:`, tableRow);
        
        // Différents formats possibles de retour MySQL
        if (typeof tableRow === 'string') {
          tableNames.push(tableRow.toLowerCase());
          console.log(`   - ${tableRow}`);
        } else if (typeof tableRow === 'object' && tableRow !== null) {
          // Récupérer la première propriété (nom de table)
          const tableName = Object.values(tableRow)[0];
          if (tableName && typeof tableName === 'string') {
            tableNames.push(tableName.toLowerCase());
            console.log(`   - ${tableName}`);
          }
        }
      });
    } catch (forEachError) {
      console.error("❌ Erreur traitement tables:", forEachError.message);
      
      // Fallback: essayer une approche différente
      try {
        const fallbackResult = await sequelize.query(
          `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE()`,
          { type: QueryTypes.SELECT }
        );
        
        console.log("🔄 Fallback avec INFORMATION_SCHEMA:");
        if (Array.isArray(fallbackResult)) {
          fallbackResult.forEach(row => {
            if (row.TABLE_NAME) {
              tableNames.push(row.TABLE_NAME.toLowerCase());
              console.log(`   - ${row.TABLE_NAME}`);
            }
          });
        }
      } catch (fallbackError) {
        console.error("❌ Fallback échoué:", fallbackError.message);
        return;
      }
    }
    
    if (tableNames.length === 0) {
      console.log("❌ Aucune table utilisable trouvée");
      return;
    }
    
    console.log("");
    
    const tables = ["users", "quizzes", "sessions"];
    
    for (const table of tables) {
      if (!tableNames.includes(table)) {
        console.log(`⏭️  Table ${table} non trouvée - ignorée`);
        continue;
      }
      
      console.log(`📊 === ANALYSE TABLE: ${table.toUpperCase()} ===`);
      
      // 1. Récupérer les index de manière plus robuste
      let indexes = [];
      try {
        const indexResult = await sequelize.query(
          `SHOW INDEX FROM ${table}`, 
          { type: QueryTypes.SELECT }
        );
        
        indexes = Array.isArray(indexResult) ? indexResult : [];
        
      } catch (indexError) {
        console.log(`   ❌ Erreur récupération index: ${indexError.message}`);
        continue;
      }
      
      console.log(`   Nombre total d'index: ${indexes.length}`);
      
      if (indexes.length === 0) {
        console.log("   ⚠️  Aucun index trouvé");
        continue;
      }
      
      // 2. Grouper par nom d'index
      const indexGroups = {};
      indexes.forEach(index => {
        if (!indexGroups[index.Key_name]) {
          indexGroups[index.Key_name] = [];
        }
        indexGroups[index.Key_name].push(index);
      });
      
      console.log(`   Nombre d'index uniques: ${Object.keys(indexGroups).length}`);
      
      // 3. Afficher les détails
      console.log("   📋 Détail des index:");
      Object.entries(indexGroups).forEach(([indexName, indexData]) => {
        const columns = indexData.map(idx => idx.Column_name).join(", ");
        const isUnique = indexData[0].Non_unique === 0 ? "UNIQUE" : "INDEX";
        const isPrimary = indexName === "PRIMARY" ? " (🔑 PRIMARY)" : "";
        
        console.log(`      - ${indexName}: ${isUnique} (${columns})${isPrimary}`);
      });
      
      // 4. Identifier les index problématiques
      const duplicateIndexes = [];
      const columnCombinations = {};
      
      Object.entries(indexGroups).forEach(([indexName, indexData]) => {
        if (indexName === "PRIMARY") return; // Ne pas toucher à la clé primaire
        
        const columns = indexData.map(idx => idx.Column_name).sort().join(",");
        
        if (columnCombinations[columns]) {
          duplicateIndexes.push({
            name: indexName,
            duplicate: columnCombinations[columns],
            columns: columns
          });
        } else {
          columnCombinations[columns] = indexName;
        }
      });
      
      if (duplicateIndexes.length > 0) {
        console.log("   ⚠️  Index potentiellement dupliqués:");
        duplicateIndexes.forEach(dup => {
          console.log(`      - ${dup.name} duplique ${dup.duplicate} (${dup.columns})`);
        });
      } else {
        console.log("   ✅ Aucun doublon détecté");
      }
      
      // 5. Avertissements selon le nombre d'index
      const indexCount = Object.keys(indexGroups).length;
      if (indexCount > 25) {
        console.log(`   🚨 CRITIQUE: ${indexCount} index (très élevé!)`);
      } else if (indexCount > 15) {
        console.log(`   ⚠️  ATTENTION: ${indexCount} index (élevé)`);
      } else if (indexCount > 10) {
        console.log(`   ⚡ MODÉRÉ: ${indexCount} index (acceptable)`);
      } else {
        console.log(`   ✅ OPTIMAL: ${indexCount} index`);
      }
      
      console.log("");
    }
    
    // 6. Résumé global
    await showGlobalSummary();
    
  } catch (error) {
    console.error("❌ Erreur lors de l'analyse:", error.message);
    console.error("Stack:", error.stack);
    
    // Debug supplémentaire
    console.log("\n🔍 Debug supplémentaire:");
    try {
      const debugResult = await sequelize.query("SELECT 1 as test", { type: QueryTypes.SELECT });
      console.log("   Connexion active:", Array.isArray(debugResult));
      
      const dbResult = await sequelize.query("SELECT DATABASE() as db", { type: QueryTypes.SELECT });
      console.log("   Base actuelle:", dbResult?.[0]?.db);
      
    } catch (debugError) {
      console.log("   Erreur debug:", debugError.message);
    }
  }
}

async function showGlobalSummary() {
  try {
    console.log("📈 === RÉSUMÉ GLOBAL ===");
    
    const [globalStats] = await sequelize.query(`
      SELECT 
        TABLE_NAME,
        COUNT(*) as index_count
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() 
      GROUP BY TABLE_NAME
      ORDER BY index_count DESC
    `, { type: QueryTypes.SELECT });

    if (!globalStats || globalStats.length === 0) {
      console.log("❌ Impossible de récupérer les statistiques globales");
      return;
    }

    let totalIndexes = 0;
    let problematicTables = 0;

    console.log("📊 Récapitulatif par table:");
    globalStats.forEach(stat => {
      totalIndexes += stat.index_count;
      
      let status = "✅";
      if (stat.index_count > 25) {
        status = "🚨";
        problematicTables++;
      } else if (stat.index_count > 15) {
        status = "⚠️ ";
        problematicTables++;
      } else if (stat.index_count > 10) {
        status = "⚡";
      }
      
      console.log(`   ${status} ${stat.TABLE_NAME}: ${stat.index_count} index`);
    });

    console.log(`\n📊 Statistiques globales:`);
    console.log(`   Total index: ${totalIndexes}`);
    console.log(`   Tables problématiques: ${problematicTables}`);
    console.log(`   Tables au total: ${globalStats.length}`);

    if (problematicTables > 0) {
      console.log(`\n💡 Recommandations:`);
      console.log(`   1. Nettoyage doublons: npm run clean:indexes`);
      console.log(`   2. Reset complet: npm run sync:optimized`);
      console.log(`   3. Vérification: npm run db:status`);
    } else {
      console.log(`\n🎉 Base de données en bon état!`);
    }

  } catch (error) {
    console.log("⚠️  Impossible de générer le résumé global:", error.message);
  }
}

async function cleanDuplicateIndexes() {
  console.log("🧹 === NETTOYAGE DES INDEX DUPLIQUÉS ===\n");
  
  try {
    // Méthode robuste pour récupérer les tables
    let tableNames = [];
    try {
      const result = await sequelize.query(`SHOW TABLES`, { type: QueryTypes.SELECT });
      
      if (Array.isArray(result) && result.length > 0) {
        result.forEach(tableRow => {
          if (typeof tableRow === 'string') {
            tableNames.push(tableRow.toLowerCase());
          } else if (typeof tableRow === 'object' && tableRow !== null) {
            const tableName = Object.values(tableRow)[0];
            if (tableName && typeof tableName === 'string') {
              tableNames.push(tableName.toLowerCase());
            }
          }
        });
      }
      
      // Fallback si SHOW TABLES ne fonctionne pas
      if (tableNames.length === 0) {
        const fallbackResult = await sequelize.query(
          `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE()`,
          { type: QueryTypes.SELECT }
        );
        
        if (Array.isArray(fallbackResult)) {
          fallbackResult.forEach(row => {
            if (row.TABLE_NAME) {
              tableNames.push(row.TABLE_NAME.toLowerCase());
            }
          });
        }
      }
      
    } catch (tablesError) {
      console.error("❌ Erreur récupération tables:", tablesError.message);
      return;
    }
    
    if (tableNames.length === 0) {
      console.log("❌ Aucune table trouvée");
      return;
    }
    
    console.log(`📊 Tables trouvées: ${tableNames.join(", ")}`);
    
    const targetTables = ["users", "quizzes", "sessions"].filter(table => 
      tableNames.includes(table)
    );
    
    let totalRemoved = 0;
    
    for (const table of targetTables) {
      console.log(`🔧 Nettoyage table: ${table}`);
      
      let indexes = [];
      try {
        const result = await sequelize.query(
          `SHOW INDEX FROM ${table}`,
          { type: QueryTypes.SELECT }
        );
        indexes = Array.isArray(result) ? result : [];
      } catch (error) {
        console.log(`   ❌ Erreur accès table ${table}:`, error.message);
        continue;
      }
      
      if (indexes.length === 0) {
        console.log(`   ⏭️  Aucun index dans ${table}`);
        continue;
      }
      
      // Grouper par colonnes pour identifier les doublons
      const columnMap = {};
      const toRemove = new Set();
      
      // Première passe: identifier les index uniques
      indexes.forEach(index => {
        if (index.Key_name === "PRIMARY") return;
        
        const sameIndexRows = indexes.filter(idx => idx.Key_name === index.Key_name);
        const columns = sameIndexRows
          .sort((a, b) => a.Seq_in_index - b.Seq_in_index)
          .map(idx => idx.Column_name)
          .join(",");
        
        const signature = `${columns}_${index.Non_unique}`;
        
        if (columnMap[signature] && columnMap[signature] !== index.Key_name) {
          // Index dupliqué trouvé
          toRemove.add(index.Key_name);
          console.log(`   ⚠️  Doublon: ${index.Key_name} (colonnes: ${columns})`);
        } else {
          columnMap[signature] = index.Key_name;
        }
      });
      
      // Supprimer les index dupliqués
      const uniqueToRemove = Array.from(toRemove);
      
      for (const indexName of uniqueToRemove) {
        try {
          console.log(`   🗑️  Suppression: ${indexName}`);
          await sequelize.query(`DROP INDEX ${indexName} ON ${table}`);
          console.log(`   ✅ Supprimé: ${indexName}`);
          totalRemoved++;
        } catch (error) {
          console.log(`   ❌ Échec suppression ${indexName}:`, error.message);
        }
      }
      
      if (uniqueToRemove.length === 0) {
        console.log(`   ✅ Aucun doublon dans ${table}`);
      }
      
      console.log("");
    }
    
    console.log(`🎯 Total index supprimés: ${totalRemoved}`);
    
  } catch (error) {
    console.error("❌ Erreur lors du nettoyage:", error.message);
  }
}

async function recreateOptimalIndexes() {
  console.log("🏗️  === RECRÉATION DES INDEX OPTIMAUX ===\n");
  
  try {
    // Index optimaux pour chaque table
    const optimalIndexes = {
      users: [
        { name: "idx_users_email", columns: ["email"], unique: true },
        { name: "idx_users_username", columns: ["username"], unique: true },
        { name: "idx_users_role", columns: ["role"], unique: false },
        { name: "idx_users_active", columns: ["isActive"], unique: false }
      ],
      quizzes: [
        { name: "idx_quizzes_creator", columns: ["creatorId"], unique: false },
        { name: "idx_quizzes_created", columns: ["createdAt"], unique: false },
        { name: "idx_quizzes_title", columns: ["title"], unique: false }
      ],
      sessions: [
        { name: "idx_sessions_code", columns: ["code"], unique: true },
        { name: "idx_sessions_status", columns: ["status"], unique: false },
        { name: "idx_sessions_host", columns: ["hostId"], unique: false },
        { name: "idx_sessions_quiz", columns: ["quizId"], unique: false },
        { name: "idx_sessions_created", columns: ["createdAt"], unique: false }
      ]
    };
    
    for (const [table, indexes] of Object.entries(optimalIndexes)) {
      console.log(`🔧 Table: ${table}`);
      
      for (const index of indexes) {
        try {
          const uniqueStr = index.unique ? "UNIQUE" : "";
          const columnsStr = index.columns.join(", ");
          
          // Vérifier si l'index existe déjà
          const [existing] = await sequelize.query(
            `SHOW INDEX FROM ${table} WHERE Key_name = '${index.name}'`,
            { type: QueryTypes.SELECT }
          );
          
          if (existing.length === 0) {
            console.log(`   🔨 Création: ${index.name} (${columnsStr})`);
            
            await sequelize.query(
              `CREATE ${uniqueStr} INDEX ${index.name} ON ${table} (${columnsStr})`
            );
            
            console.log(`   ✅ Index ${index.name} créé`);
          } else {
            console.log(`   ⏭️  Index ${index.name} existe déjà`);
          }
          
        } catch (error) {
          console.log(`   ❌ Erreur création ${index.name}:`, error.message);
        }
      }
      
      console.log("");
    }
    
  } catch (error) {
    console.error("❌ Erreur lors de la recréation:", error.message);
  }
}

async function showFinalStatus() {
  console.log("📊 === ÉTAT FINAL DES INDEX ===\n");
  
  try {
    // Récupérer toutes les tables existantes de manière robuste
    let tableNames = [];
    
    try {
      const result = await sequelize.query(`SHOW TABLES`, { type: QueryTypes.SELECT });
      
      if (Array.isArray(result) && result.length > 0) {
        result.forEach(tableRow => {
          if (typeof tableRow === 'string') {
            tableNames.push(tableRow);
          } else if (typeof tableRow === 'object' && tableRow !== null) {
            const tableName = Object.values(tableRow)[0];
            if (tableName && typeof tableName === 'string') {
              tableNames.push(tableName);
            }
          }
        });
      }
      
      // Fallback avec INFORMATION_SCHEMA
      if (tableNames.length === 0) {
        const fallbackResult = await sequelize.query(
          `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE()`,
          { type: QueryTypes.SELECT }
        );
        
        if (Array.isArray(fallbackResult)) {
          fallbackResult.forEach(row => {
            if (row.TABLE_NAME) {
              tableNames.push(row.TABLE_NAME);
            }
          });
        }
      }
      
    } catch (tablesError) {
      console.error("❌ Erreur récupération tables:", tablesError.message);
      return;
    }
    
    if (tableNames.length === 0) {
      console.log("❌ Aucune table trouvée dans la base");
      return;
    }
    
    for (const tableName of tableNames) {
      try {
        const result = await sequelize.query(
          `SHOW INDEX FROM ${tableName}`,
          { type: QueryTypes.SELECT }
        );
        
        const indexes = Array.isArray(result) ? result : [];
        const uniqueIndexes = [...new Set(indexes.map(idx => idx.Key_name))];
        
        console.log(`📋 ${tableName.toUpperCase()}:`);
        console.log(`   Total index: ${uniqueIndexes.length}`);
        
        if (uniqueIndexes.length > 0) {
          console.log(`   Index: ${uniqueIndexes.join(", ")}`);
        }
        
        if (uniqueIndexes.length > 20) {
          console.log(`   🚨 CRITIQUE: ${uniqueIndexes.length} index (limite MySQL: 64)`);
        } else if (uniqueIndexes.length > 15) {
          console.log(`   ⚠️  ATTENTION: ${uniqueIndexes.length} index (élevé)`);
        } else if (uniqueIndexes.length > 10) {
          console.log(`   ⚡ MODÉRÉ: ${uniqueIndexes.length} index`);
        } else {
          console.log(`   ✅ OPTIMAL: ${uniqueIndexes.length} index`);
        }
        
        console.log("");
        
      } catch (tableError) {
        console.log(`❌ Erreur analyse ${tableName}:`, tableError.message);
      }
    }
    
    // Statistiques globales
    try {
      const [globalStats] = await sequelize.query(`
        SELECT 
          COUNT(DISTINCT TABLE_NAME) as table_count,
          COUNT(*) as total_indexes,
          AVG(index_per_table.index_count) as avg_indexes_per_table
        FROM (
          SELECT TABLE_NAME, COUNT(*) as index_count
          FROM INFORMATION_SCHEMA.STATISTICS 
          WHERE TABLE_SCHEMA = DATABASE() 
          GROUP BY TABLE_NAME
        ) as index_per_table
      `, { type: QueryTypes.SELECT });

      if (globalStats && globalStats.length > 0) {
        const stats = globalStats[0];
        console.log("🌍 STATISTIQUES GLOBALES:");
        console.log(`   Tables: ${stats.table_count}`);
        console.log(`   Index total: ${stats.total_indexes}`);
        console.log(`   Moyenne/table: ${Math.round(stats.avg_indexes_per_table * 10) / 10}`);
        
        if (stats.total_indexes > 100) {
          console.log(`   ⚠️  Beaucoup d'index au total`);
        } else {
          console.log(`   ✅ Nombre total acceptable`);
        }
      }
    } catch (statsError) {
      console.log("⚠️  Impossible de calculer les stats globales");
    }
    
  } catch (error) {
    console.error("❌ Erreur lors de l'affichage final:", error.message);
  }
}

// Fonction principale
async function main() {
  try {
    // 1. Analyser l'état actuel
    await analyzeIndexes();
    
    // 2. Nettoyer les doublons
    await cleanDuplicateIndexes();
    
    // 3. Recréer les index optimaux
    await recreateOptimalIndexes();
    
    // 4. Afficher l'état final
    await showFinalStatus();
    
    console.log("🎉 Nettoyage des index terminé avec succès!");
    
  } catch (error) {
    console.error("💥 Erreur générale:", error.message);
    console.error("Stack:", error.stack);
  } finally {
    try {
      await sequelize.close();
    } catch (closeError) {
      console.error("⚠️  Erreur fermeture connexion:", closeError.message);
    }
    process.exit(0);
  }
}

// Fonctions individuelles pour les scripts npm
async function runAnalysisOnly() {
  try {
    await analyzeIndexes();
  } catch (error) {
    console.error("❌ Erreur analyse:", error.message);
  } finally {
    try {
      await sequelize.close();
    } catch (closeError) {
      console.error("⚠️  Erreur fermeture:", closeError.message);
    }
  }
}

async function runCleanupOnly() {
  try {
    await cleanDuplicateIndexes();
  } catch (error) {
    console.error("❌ Erreur nettoyage:", error.message);
  } finally {
    try {
      await sequelize.close();
    } catch (closeError) {
      console.error("⚠️  Erreur fermeture:", closeError.message);
    }
  }
}

async function runStatusOnly() {
  try {
    await showFinalStatus();
  } catch (error) {
    console.error("❌ Erreur status:", error.message);
  } finally {
    try {
      await sequelize.close();
    } catch (closeError) {
      console.error("⚠️  Erreur fermeture:", closeError.message);
    }
  }
}

// Exécution si appelé directement
if (require.main === module) {
  main();
}

module.exports = {
  analyzeIndexes: runAnalysisOnly,
  cleanDuplicateIndexes: runCleanupOnly,
  recreateOptimalIndexes,
  showFinalStatus: runStatusOnly,
  main
};