-- =========================================
-- RECRÉATION COMPLÈTE DE LA BASE QUIZ_APP
-- =========================================

-- 1. CRÉATION DE LA BASE DE DONNÉES ET UTILISATEUR
-- =========================================

-- Créer la base de données
DROP DATABASE IF EXISTS quiz_app;
CREATE DATABASE quiz_app 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

-- Créer l'utilisateur et attribuer les permissions
-- CREATE USER IF NOT EXISTS 'quiz_user'@'localhost' IDENTIFIED BY 'your_password';
-- GRANT ALL PRIVILEGES ON quiz_app.* TO 'quiz_user'@'localhost';
-- FLUSH PRIVILEGES;

-- Utiliser la base de données
USE quiz_app;

-- 2. TABLE USERS
-- =========================================

CREATE TABLE `users` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `role` ENUM('formateur', 'etudiant', 'admin') NOT NULL DEFAULT 'formateur',
  `firstName` VARCHAR(50) NULL,
  `lastName` VARCHAR(50) NULL,
  `avatar` TEXT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
  `lastLogin` DATETIME NULL,
  `preferences` JSON NULL DEFAULT ('{"theme":"light","language":"fr","notifications":true}'),
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Index pour les performances
  INDEX `idx_users_email` (`email`),
  INDEX `idx_users_username` (`username`),
  INDEX `idx_users_role` (`role`),
  INDEX `idx_users_isActive` (`isActive`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. TABLE QUIZZES
-- =========================================

CREATE TABLE `quizzes` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `title` VARCHAR(200) NOT NULL,
  `description` TEXT NULL,
  `creatorId` VARCHAR(36) NOT NULL,
  `questions` JSON NOT NULL DEFAULT ('[]'),
  `settings` JSON NULL DEFAULT ('{"isPublic":false,"allowAnonymous":true,"showResults":true,"showCorrectAnswers":true,"randomizeQuestions":false,"randomizeOptions":false,"maxAttempts":1,"passingScore":50}'),
  `category` VARCHAR(50) NULL,
  `tags` JSON NULL DEFAULT ('[]'),
  `difficulty` ENUM('facile', 'moyen', 'difficile') NOT NULL DEFAULT 'moyen',
  `estimatedDuration` INT NULL DEFAULT 0,
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
  `stats` JSON NULL DEFAULT ('{"totalSessions":0,"totalParticipants":0,"averageScore":0,"lastUsed":null}'),
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Contrainte de clé étrangère
  CONSTRAINT `fk_quizzes_creatorId` 
    FOREIGN KEY (`creatorId`) 
    REFERENCES `users` (`id`) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE,
    
  -- Index pour les performances
  INDEX `idx_quizzes_creatorId` (`creatorId`),
  INDEX `idx_quizzes_isActive` (`isActive`),
  INDEX `idx_quizzes_difficulty` (`difficulty`),
  INDEX `idx_quizzes_createdAt` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. TABLE SESSIONS
-- =========================================

CREATE TABLE `sessions` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(6) NOT NULL UNIQUE,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `hostId` VARCHAR(36) NOT NULL,
  `quizId` VARCHAR(36) NOT NULL,
  `status` ENUM('waiting', 'active', 'paused', 'finished', 'cancelled') NOT NULL DEFAULT 'waiting',
  `participants` JSON NOT NULL DEFAULT ('[]'),
  `responses` JSON NOT NULL DEFAULT ('{}'),
  `settings` JSON NOT NULL DEFAULT ('{"allowAnonymous":true,"allowLateJoin":false,"showLeaderboard":true,"maxParticipants":100,"autoAdvance":false,"shuffleQuestions":false,"shuffleAnswers":false}'),
  `stats` JSON NOT NULL DEFAULT ('{"totalParticipants":0,"totalResponses":0,"averageScore":0,"participationRate":0}'),
  `currentQuestionIndex` INT NULL DEFAULT NULL,
  `currentQuestionStartedAt` DATETIME NULL,
  `startedAt` DATETIME NULL,
  `endedAt` DATETIME NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Contraintes de clés étrangères
  CONSTRAINT `fk_sessions_hostId` 
    FOREIGN KEY (`hostId`) 
    REFERENCES `users` (`id`) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE,
    
  CONSTRAINT `fk_sessions_quizId` 
    FOREIGN KEY (`quizId`) 
    REFERENCES `quizzes` (`id`) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE,
    
  -- Contraintes de validation
  CONSTRAINT `chk_sessions_code_length` 
    CHECK (LENGTH(`code`) = 6),
    
  CONSTRAINT `chk_sessions_currentQuestionIndex` 
    CHECK (`currentQuestionIndex` >= 0 OR `currentQuestionIndex` IS NULL),
    
  -- Index pour les performances
  INDEX `idx_sessions_code` (`code`),
  INDEX `idx_sessions_status` (`status`),
  INDEX `idx_sessions_hostId` (`hostId`),
  INDEX `idx_sessions_quizId` (`quizId`),
  INDEX `idx_sessions_createdAt` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. TRIGGERS ET FONCTIONS UTILITAIRES
-- =========================================

-- Trigger pour générer automatiquement les UUID pour users
DELIMITER $$
CREATE TRIGGER `users_before_insert_uuid` 
  BEFORE INSERT ON `users` 
  FOR EACH ROW 
BEGIN
  IF NEW.id IS NULL OR NEW.id = '' THEN
    SET NEW.id = UUID();
  END IF;
END$$
DELIMITER ;

-- Trigger pour générer automatiquement les UUID pour quizzes
DELIMITER $$
CREATE TRIGGER `quizzes_before_insert_uuid` 
  BEFORE INSERT ON `quizzes` 
  FOR EACH ROW 
BEGIN
  IF NEW.id IS NULL OR NEW.id = '' THEN
    SET NEW.id = UUID();
  END IF;
END$$
DELIMITER ;

-- 6. DONNÉES DE TEST (OPTIONNEL)
-- =========================================

-- Utilisateur administrateur par défaut
INSERT INTO `users` (
  `id`, 
  `username`, 
  `email`, 
  `password`, 
  `role`, 
  `firstName`, 
  `lastName`, 
  `isActive`
) VALUES (
  UUID(),
  'admin',
  'admin@quiz-app.com',
  '$2a$12$LQv3c1yqBw2V6X8z5sF.F.jB6V8y9J5nY7F.7B8C9D0E1F2G3H4I5J', -- motdepasse: admin123
  'admin',
  'Admin',
  'System',
  TRUE
);

-- Quiz d'exemple
SET @admin_id = (SELECT id FROM users WHERE username = 'admin' LIMIT 1);

INSERT INTO `quizzes` (
  `id`,
  `title`,
  `description`,
  `creatorId`,
  `questions`,
  `difficulty`,
  `estimatedDuration`
) VALUES (
  UUID(),
  'Quiz de démonstration',
  'Un quiz d\'exemple pour tester l\'application',
  @admin_id,
  '[
    {
      "id": "q1",
      "type": "multiple",
      "question": "Quelle est la capitale de la France ?",
      "options": ["Paris", "Lyon", "Marseille", "Toulouse"],
      "correctAnswer": 0,
      "points": 10,
      "timeLimit": 30
    },
    {
      "id": "q2",
      "type": "multiple",
      "question": "Combien font 2 + 2 ?",
      "options": ["3", "4", "5", "6"],
      "correctAnswer": 1,
      "points": 10,
      "timeLimit": 30
    }
  ]',
  'facile',
  60
);

-- 7. VÉRIFICATION DE LA CRÉATION
-- =========================================

-- Affichage des tables créées
SHOW TABLES;

-- Vérification des structures
DESCRIBE users;
DESCRIBE quizzes;
DESCRIBE sessions;

-- Vérification des contraintes
SELECT 
  TABLE_NAME,
  CONSTRAINT_NAME,
  CONSTRAINT_TYPE
FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
WHERE TABLE_SCHEMA = 'quiz_app'
ORDER BY TABLE_NAME, CONSTRAINT_TYPE;

-- Vérification des index
SELECT 
  TABLE_NAME,
  INDEX_NAME,
  COLUMN_NAME,
  NON_UNIQUE
FROM INFORMATION_SCHEMA.STATISTICS 
WHERE TABLE_SCHEMA = 'quiz_app'
ORDER BY TABLE_NAME, INDEX_NAME;

-- 8. REQUÊTES DE MAINTENANCE
-- =========================================

-- Nettoyer les sessions inactives de plus de 24h
-- À exécuter périodiquement
/*
DELETE FROM sessions 
WHERE status IN ('waiting', 'paused') 
  AND createdAt < DATE_SUB(NOW(), INTERVAL 24 HOUR);
*/

-- Optimiser les tables (à exécuter occasionnellement)
/*
OPTIMIZE TABLE users, quizzes, sessions;
*/

-- 9. SAUVEGARDE ET RESTAURATION
-- =========================================

-- Commande pour sauvegarder (à exécuter depuis le terminal)
/*
mysqldump -u quiz_user -p quiz_app > quiz_app_backup_$(date +%Y%m%d_%H%M%S).sql
*/

-- Commande pour restaurer (à exécuter depuis le terminal)
/*
mysql -u quiz_user -p quiz_app < quiz_app_backup_YYYYMMDD_HHMMSS.sql
*/

-- =========================================
-- FIN DU SCRIPT DE CRÉATION
-- =========================================

SELECT 'Base de données quiz_app créée avec succès !' as message;