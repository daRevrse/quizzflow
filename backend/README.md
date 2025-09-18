# Quiz App - Backend

Backend de l'application de quiz en temps réel développé avec Node.js, Express, Sequelize (MySQL) et Socket.IO.

## 🚀 Technologies utilisées

- **Node.js** - Runtime JavaScript
- **Express.js** - Framework web
- **Sequelize** - ORM pour MySQL
- **MySQL** - Base de données relationnelle
- **Socket.IO** - Communication temps réel WebSocket
- **JWT** - Authentification par tokens
- **bcryptjs** - Hashage des mots de passe
- **express-validator** - Validation des données
- **helmet** - Sécurité HTTP
- **cors** - Gestion des CORS

## 📁 Structure du projet

```
backend/
├── config/
│   ├── database.js          # Configuration Sequelize MySQL
│   └── index.js             # Configuration générale
├── middleware/
│   ├── auth.js              # Authentification JWT et autorisations
│   └── validation.js        # Middlewares de validation
├── models/
│   ├── index.js             # Gestionnaire des modèles et associations
│   ├── User.js              # Modèle utilisateur
│   ├── Quiz.js              # Modèle quiz
│   └── Session.js           # Modèle session de quiz
├── routes/
│   ├── auth.js              # Routes d'authentification
│   ├── quiz.js              # Routes de gestion des quiz
│   └── session.js           # Routes de gestion des sessions
├── socket/
│   └── socketHandlers.js    # Gestionnaires Socket.IO temps réel
├── .env.example             # Variables d'environnement (template)
├── package.json             # Dépendances et scripts
├── server.js                # Point d'entrée du serveur
└── README.md                # Cette documentation
```

## ⚙️ Installation et configuration

### 1. Installation des dépendances

```bash
cd backend
npm install
```

### 2. Configuration de la base de données MySQL

1. Installez MySQL sur votre système
2. Créez une base de données :

```sql
CREATE DATABASE quiz_app;
CREATE USER 'quiz_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON quiz_app.* TO 'quiz_user'@'localhost';
FLUSH PRIVILEGES;
```

### 3. Configuration des variables d'environnement

Copiez le fichier `.env.example` vers `.env` et configurez :

```bash
cp .env.example .env
```

```env
# Configuration du serveur
PORT=3001
NODE_ENV=development

# Base de données MySQL
DB_HOST=localhost
DB_PORT=3306
DB_NAME=quiz_app
DB_USER=quiz_user
DB_PASSWORD=your_password

# JWT Secret (générez une clé sécurisée)
JWT_SECRET=your-super-secret-jwt-key

# CORS Origins
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

### 4. Démarrage du serveur

```bash
# Mode développement avec rechargement automatique
npm run dev

# Mode production
npm start
```

Le serveur démarre sur `http://localhost:3001`

## 🔐 Authentification

### Système d'authentification JWT

- **Inscription** : `POST /api/auth/register`
- **Connexion** : `POST /api/auth/login`
- **Refresh token** : `POST /api/auth/refresh`
- **Profil** : `GET /api/auth/me`
- **Mise à jour profil** : `PUT /api/auth/me`
- **Changement mot de passe** : `PUT /api/auth/password`

### Rôles utilisateurs

- **admin** : Accès complet à l'application
- **formateur** : Peut créer et gérer des quiz et sessions
- **etudiant** : Peut participer aux sessions

## 📊 API Routes

### Authentification (`/api/auth`)

| Méthode | Route       | Description          | Auth |
| ------- | ----------- | -------------------- | ---- |
| POST    | `/register` | Inscription          | Non  |
| POST    | `/login`    | Connexion            | Non  |
| POST    | `/refresh`  | Renouveler token     | Non  |
| GET     | `/me`       | Profil utilisateur   | Oui  |
| PUT     | `/me`       | Mise à jour profil   | Oui  |
| PUT     | `/password` | Changer mot de passe | Oui  |
| DELETE  | `/account`  | Supprimer compte     | Oui  |

### Quiz (`/api/quiz`)

| Méthode | Route            | Description            | Auth         |
| ------- | ---------------- | ---------------------- | ------------ |
| GET     | `/`              | Liste des quiz         | Optionnel    |
| GET     | `/my`            | Mes quiz               | Oui          |
| GET     | `/categories`    | Catégories disponibles | Non          |
| GET     | `/:id`           | Détails d'un quiz      | Optionnel    |
| POST    | `/`              | Créer un quiz          | Formateur+   |
| PUT     | `/:id`           | Modifier un quiz       | Propriétaire |
| DELETE  | `/:id`           | Supprimer un quiz      | Propriétaire |
| POST    | `/:id/duplicate` | Dupliquer un quiz      | Formateur+   |

### Sessions (`/api/session`)

| Méthode | Route              | Description           | Auth       |
| ------- | ------------------ | --------------------- | ---------- |
| GET     | `/`                | Liste des sessions    | Oui        |
| GET     | `/:id`             | Détails d'une session | Optionnel  |
| GET     | `/code/:code`      | Rejoindre par code    | Optionnel  |
| POST    | `/`                | Créer une session     | Formateur+ |
| PUT     | `/:id`             | Modifier une session  | Hôte       |
| DELETE  | `/:id`             | Supprimer une session | Hôte       |
| POST    | `/:id/start`       | Démarrer une session  | Hôte       |
| POST    | `/:id/pause`       | Mettre en pause       | Hôte       |
| POST    | `/:id/resume`      | Reprendre             | Hôte       |
| POST    | `/:id/end`         | Terminer              | Hôte       |
| GET     | `/:id/leaderboard` | Classement            | Optionnel  |
| GET     | `/:id/results`     | Résultats détaillés   | Hôte       |

## 🔌 Socket.IO Events

### Événements clients → serveur

| Événement           | Description             | Données                                       |
| ------------------- | ----------------------- | --------------------------------------------- |
| `join_session`      | Rejoindre une session   | `{sessionCode, participantName, isAnonymous}` |
| `leave_session`     | Quitter une session     | -                                             |
| `host_session`      | Se connecter comme hôte | `{sessionId}`                                 |
| `start_session`     | Démarrer la session     | -                                             |
| `next_question`     | Question suivante       | -                                             |
| `previous_question` | Question précédente     | -                                             |
| `pause_session`     | Mettre en pause         | -                                             |
| `resume_session`    | Reprendre               | -                                             |
| `end_session`       | Terminer                | -                                             |
| `submit_response`   | Soumettre réponse       | `{questionId, answer, timeSpent}`             |
| `send_message`      | Message chat            | `{message}`                                   |

### Événements serveur → clients

| Événement             | Description               | Données                   |
| --------------------- | ------------------------- | ------------------------- |
| `session_joined`      | Confirmation de connexion | Session info              |
| `participant_joined`  | Nouveau participant       | Participant info          |
| `session_started`     | Session démarrée          | `{sessionId, startedAt}`  |
| `current_question`    | Question actuelle         | Question data             |
| `next_question`       | Nouvelle question         | Question data             |
| `session_paused`      | Session en pause          | `{sessionId}`             |
| `session_ended`       | Session terminée          | `{sessionId, finalStats}` |
| `leaderboard_updated` | Classement mis à jour     | Leaderboard data          |
| `new_response`        | Nouvelle réponse (hôte)   | Response data             |

## 🗄️ Modèles de données

### User

- Gestion des utilisateurs avec authentification
- Rôles et permissions
- Préférences utilisateur

### Quiz

- Structure des quiz avec questions
- Types : QCM, Vrai/Faux, Réponse libre, Nuage de mots
- Paramètres et métadonnées

### Session

- Sessions de quiz en temps réel
- Gestion des participants
- Suivi des réponses et scores

## 🛡️ Sécurité

- **JWT** pour l'authentification
- **bcrypt** pour le hashage des mots de passe
- **Helmet** pour les headers de sécurité
- **Rate limiting** pour éviter les abus
- **CORS** configuré pour les origins autorisés
- **Validation** stricte des données d'entrée
- **Sanitization** pour éviter les attaques XSS

## 🚦 Statuts et codes d'erreur

### Codes de réponse HTTP

- `200` - Succès
- `201` - Créé
- `400` - Données invalides
- `401` - Authentification requise
- `403` - Accès refusé
- `404` - Ressource non trouvée
- `409` - Conflit (ex: utilisateur existant)
- `429` - Trop de requêtes
- `500` - Erreur serveur

### Codes d'erreur personnalisés

- `USER_EXISTS` - Utilisateur déjà existant
- `
