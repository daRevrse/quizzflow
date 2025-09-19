// Correction Socket Handlers - backend/socket/socketHandlers.js

const jwt = require("jsonwebtoken");
const { Session, Quiz, User } = require("../models");

// Cache simple pour éviter les sessions multiples
const connectedHosts = new Map(); // sessionId -> socketId
const connectedParticipants = new Map(); // sessionId -> Set(socketIds)

// Middleware d'authentification optimisé
const authenticateSocket = async (socket, next) => {
  try {
    const token =
      socket.handshake.auth.token ||
      socket.handshake.headers.authorization?.split(" ")[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.userId, {
        attributes: { exclude: ["password"] },
      });

      if (user && user.isActive) {
        socket.user = user;
      }
    }

    next();
  } catch (error) {
    console.log("Erreur d'authentification Socket.IO:", error.message);
    next(); // Permettre les connexions anonymes
  }
};

const socketHandlers = (io) => {
  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    console.log(
      `🔌 Nouvelle connexion Socket.IO: ${socket.id} ${
        socket.user ? `(${socket.user.username})` : "(anonyme)"
      }`
    );

    // Événements de gestion des sessions
    socket.on("join_session", handleJoinSession);
    socket.on("leave_session", handleLeaveSession);
    socket.on("host_session", handleHostSession);

    // Événements pour les hôtes seulement
    socket.on("start_session", handleStartSession);
    socket.on("pause_session", handlePauseSession);
    socket.on("resume_session", handleResumeSession);
    socket.on("end_session", handleEndSession);
    socket.on("next_question", handleNextQuestion);
    socket.on("previous_question", handlePreviousQuestion);

    // Événements pour les participants seulement
    socket.on("submit_response", handleSubmitResponse);
    socket.on("participant_ready", handleParticipantReady);
    socket.on("participant_heartbeat", handleParticipantHeartbeat);

    // Chat
    socket.on("send_message", handleSendMessage);

    // Déconnexion
    socket.on("disconnect", handleDisconnect);

    // Gestion des erreurs
    socket.on("error", (error) => {
      console.error("Erreur Socket.IO:", error);
    });
  });

  // Handler: Rejoindre une session (PARTICIPANT SEULEMENT)
  async function handleJoinSession(data) {
    try {
      const { sessionCode, participantName, isAnonymous = false } = data;
      const socket = this;

      console.log(
        `🎯 Tentative de jointure: ${participantName} → ${sessionCode}`
      );

      if (!sessionCode || !participantName?.trim()) {
        return socket.emit("error", {
          message: "Code de session et nom requis",
          code: "MISSING_REQUIRED_FIELDS",
        });
      }

      // Chercher la session active
      const session = await Session.findOne({
        where: {
          code: sessionCode.toUpperCase(),
          status: ["waiting", "active"],
        },
        include: [{ model: Quiz, as: "quiz" }],
      });

      if (!session) {
        return socket.emit("error", {
          message: "Session non trouvée ou terminée",
          code: "SESSION_NOT_FOUND",
        });
      }

      // Vérifier si la session accepte encore des participants
      if (!session.settings?.allowLateJoin && session.status === "active") {
        return socket.emit("error", {
          message: "Cette session n'accepte plus de nouveaux participants",
          code: "LATE_JOIN_DISABLED",
        });
      }

      // Créer un ID unique pour le participant
      const participantId = `participant_${socket.id}_${Date.now()}`;
      const participant = {
        id: participantId,
        socketId: socket.id,
        name: participantName.trim(),
        isAnonymous,
        userId: socket.user?.id || null,
        joinedAt: new Date(),
        isConnected: true,
        score: 0,
        responses: {},
      };

      // Mettre à jour la session avec le nouveau participant
      const currentParticipants = Array.isArray(session.participants)
        ? session.participants
        : [];

      // Éviter les doublons par socket ID
      const filteredParticipants = currentParticipants.filter(
        (p) => p.socketId !== socket.id
      );
      const updatedParticipants = [...filteredParticipants, participant];

      await session.update({
        participants: updatedParticipants,
      });

      // Configurer le socket
      socket.sessionId = session.id;
      socket.participantId = participantId;
      socket.isParticipant = true;
      socket.join(`session_${session.id}`);

      // Ajouter aux participants connectés
      if (!connectedParticipants.has(session.id)) {
        connectedParticipants.set(session.id, new Set());
      }
      connectedParticipants.get(session.id).add(socket.id);

      // Confirmer au participant
      socket.emit("session_joined", {
        sessionId: session.id,
        participantId: participantId,
        participantName: participant.name,
        sessionStatus: session.status,
        quiz: {
          id: session.quiz?.id,
          title: session.quiz?.title,
          questionCount: session.quiz?.questions?.length || 0,
        },
      });

      // Notifier l'hôte
      io.to(`host_${session.id}`).emit("participant_joined", {
        participantId: participantId,
        participantName: participant.name,
        totalParticipants: updatedParticipants.length,
        participant: {
          id: participantId,
          name: participant.name,
          joinedAt: participant.joinedAt,
          isConnected: true,
          score: 0,
        },
      });

      console.log(
        `✅ ${participant.name} a rejoint la session ${session.code} (${updatedParticipants.length} participants)`
      );
    } catch (error) {
      console.error("Erreur lors de la jointure:", error);
      socket.emit("error", {
        message: "Erreur lors de la connexion à la session",
        code: "JOIN_SESSION_ERROR",
      });
    }
  }

  // Handler: Quitter la session
  async function handleLeaveSession() {
    const socket = this;

    if (!socket.sessionId || !socket.participantId) {
      return;
    }

    try {
      const session = await Session.findByPk(socket.sessionId);
      if (session) {
        // Retirer le participant de la session
        const currentParticipants = Array.isArray(session.participants)
          ? session.participants
          : [];
        const updatedParticipants = currentParticipants.filter(
          (p) => p.id !== socket.participantId
        );

        await session.update({ participants: updatedParticipants });

        // Nettoyer les connexions
        const sessionParticipants = connectedParticipants.get(socket.sessionId);
        if (sessionParticipants) {
          sessionParticipants.delete(socket.id);
        }

        // Notifier l'hôte
        io.to(`host_${socket.sessionId}`).emit("participant_left", {
          participantId: socket.participantId,
          totalParticipants: updatedParticipants.length,
        });

        console.log(
          `👋 Participant ${socket.participantId} a quitté la session`
        );
      }

      // Nettoyer le socket
      socket.leave(`session_${socket.sessionId}`);
      socket.sessionId = null;
      socket.participantId = null;
      socket.isParticipant = false;

      socket.emit("session_left");
    } catch (error) {
      console.error("Erreur lors de la sortie de session:", error);
    }
  }

  // Handler: Connexion hôte (HÔTE SEULEMENT)
  async function handleHostSession(data) {
    try {
      const { sessionId } = data;
      const socket = this;

      console.log(
        `🎯 Tentative connexion hôte: ${socket.user?.username} → session ${sessionId}`
      );

      if (!socket.user) {
        return socket.emit("error", {
          message: "Authentification requise pour être hôte",
          code: "AUTH_REQUIRED",
        });
      }

      // Vérifier les permissions
      const session = await Session.findByPk(sessionId, {
        include: [
          { model: Quiz, as: "quiz" },
          { model: User, as: "host" },
        ],
      });

      if (!session) {
        return socket.emit("error", {
          message: "Session non trouvée",
          code: "SESSION_NOT_FOUND",
        });
      }

      const isHost = session.hostId === socket.user.id;
      const isQuizOwner = session.quiz?.creatorId === socket.user.id;
      const isAdmin = socket.user.role === "admin";

      if (!isHost && !isQuizOwner && !isAdmin) {
        return socket.emit("error", {
          message:
            "Permission insuffisante - Vous n'êtes pas l'hôte de cette session",
          code: "INSUFFICIENT_PERMISSIONS",
        });
      }

      // Vérifier s'il y a déjà un hôte connecté
      if (
        connectedHosts.has(session.id) &&
        connectedHosts.get(session.id) !== socket.id
      ) {
        return socket.emit("error", {
          message: "Un hôte est déjà connecté à cette session",
          code: "HOST_ALREADY_CONNECTED",
        });
      }

      // Configurer le socket hôte
      socket.sessionId = session.id;
      socket.isHost = true;
      socket.join(`host_${session.id}`);
      socket.join(`session_${session.id}`);

      // Enregistrer l'hôte connecté
      connectedHosts.set(session.id, socket.id);

      // Confirmer à l'hôte avec toutes les données
      socket.emit("host_connected", {
        sessionId: session.id,
        session: {
          id: session.id,
          code: session.code,
          title: session.title,
          status: session.status,
          currentQuestionIndex: session.currentQuestionIndex || 0,
          participants: session.participants || [],
          responses: session.responses || {},
          settings: session.settings || {},
          stats: session.stats || {},
          quiz: session.quiz
            ? {
                id: session.quiz.id,
                title: session.quiz.title,
                questions: session.quiz.questions || [],
              }
            : null,
        },
      });

      console.log(
        `✅ Hôte ${socket.user.username} connecté à la session ${session.code}`
      );
    } catch (error) {
      console.error("Erreur connexion hôte:", error);
      socket.emit("error", {
        message: "Erreur lors de la connexion hôte",
        code: "HOST_CONNECTION_ERROR",
      });
    }
  }

  // Handler: Démarrer session (HÔTE SEULEMENT)
  async function handleStartSession() {
    const socket = this;

    if (!socket.isHost || !socket.sessionId) {
      return socket.emit("error", { message: "Permission insuffisante" });
    }

    try {
      const session = await Session.findByPk(socket.sessionId);

      if (!session || session.status !== "waiting") {
        return socket.emit("error", {
          message: "Impossible de démarrer la session",
        });
      }

      await session.update({
        status: "active",
        startedAt: new Date(),
        currentQuestionIndex: 0,
        currentQuestionStartedAt: new Date(),
      });

      // Notifier tous les participants
      io.to(`session_${session.id}`).emit("session_started", {
        sessionId: session.id,
        currentQuestionIndex: 0,
        startedAt: new Date(),
      });

      console.log(`🚀 Session ${session.code} démarrée par l'hôte`);
    } catch (error) {
      console.error("Erreur lors du démarrage:", error);
      socket.emit("error", { message: "Erreur lors du démarrage" });
    }
  }

  // Handler: Pause session (HÔTE SEULEMENT)
  async function handlePauseSession() {
    const socket = this;

    if (!socket.isHost || !socket.sessionId) {
      return socket.emit("error", { message: "Permission insuffisante" });
    }

    try {
      const session = await Session.findByPk(socket.sessionId);

      if (!session || session.status !== "active") {
        return socket.emit("error", {
          message: "Impossible de mettre en pause",
        });
      }

      await session.update({ status: "paused" });

      io.to(`session_${session.id}`).emit("session_paused", {
        sessionId: session.id,
      });
    } catch (error) {
      console.error("Erreur lors de la pause:", error);
      socket.emit("error", { message: "Erreur lors de la pause" });
    }
  }

  // Handler: Reprendre session (HÔTE SEULEMENT)
  async function handleResumeSession() {
    const socket = this;

    if (!socket.isHost || !socket.sessionId) {
      return socket.emit("error", { message: "Permission insuffisante" });
    }

    try {
      const session = await Session.findByPk(socket.sessionId);

      if (!session || session.status !== "paused") {
        return socket.emit("error", { message: "Impossible de reprendre" });
      }

      await session.update({
        status: "active",
        currentQuestionStartedAt: new Date(),
      });

      io.to(`session_${session.id}`).emit("session_resumed", {
        sessionId: session.id,
        resumedAt: new Date(),
      });
    } catch (error) {
      console.error("Erreur lors de la reprise:", error);
      socket.emit("error", { message: "Erreur lors de la reprise" });
    }
  }

  // Handler: Terminer session (HÔTE SEULEMENT)
  async function handleEndSession() {
    const socket = this;

    if (!socket.isHost || !socket.sessionId) {
      return socket.emit("error", { message: "Permission insuffisante" });
    }

    try {
      const session = await Session.findByPk(socket.sessionId);

      if (!session) {
        return socket.emit("error", { message: "Session non trouvée" });
      }

      // Calculer les statistiques finales
      const participants = session.participants || [];
      const totalParticipants = participants.length;
      let totalScore = 0;
      let completedParticipants = 0;

      participants.forEach((participant) => {
        if (participant.score !== undefined) {
          totalScore += participant.score;
          completedParticipants++;
        }
      });

      const averageScore =
        completedParticipants > 0 ? totalScore / completedParticipants : 0;

      const finalStats = {
        totalParticipants,
        completedParticipants,
        averageScore: Math.round(averageScore * 100) / 100,
        completionRate:
          totalParticipants > 0
            ? Math.round((completedParticipants / totalParticipants) * 100)
            : 0,
      };

      await session.update({
        status: "finished",
        endedAt: new Date(),
        stats: finalStats,
      });

      // Notifier tout le monde
      io.to(`session_${session.id}`).emit("session_ended", {
        sessionId: session.id,
        endedAt: new Date(),
        finalStats: finalStats,
      });

      console.log(`🏁 Session ${session.code} terminée`);
    } catch (error) {
      console.error("Erreur lors de la fin de session:", error);
      socket.emit("error", { message: "Erreur lors de la fin de session" });
    }
  }

  // Handler: Question suivante (HÔTE SEULEMENT)
  async function handleNextQuestion() {
    const socket = this;

    if (!socket.isHost || !socket.sessionId) {
      return socket.emit("error", { message: "Permission insuffisante" });
    }

    try {
      const session = await Session.findByPk(socket.sessionId, {
        include: [{ model: Quiz, as: "quiz" }],
      });

      if (!session) {
        return socket.emit("error", { message: "Session non trouvée" });
      }

      const totalQuestions = session.quiz?.questions?.length || 0;
      const currentIndex = session.currentQuestionIndex || 0;

      if (currentIndex >= totalQuestions - 1) {
        return socket.emit("error", { message: "Dernière question atteinte" });
      }

      const newIndex = currentIndex + 1;
      await session.update({
        currentQuestionIndex: newIndex,
        currentQuestionStartedAt: new Date(),
      });

      io.to(`session_${session.id}`).emit("next_question", {
        sessionId: session.id,
        questionIndex: newIndex,
        question: session.quiz.questions[newIndex],
        startedAt: new Date(),
      });
    } catch (error) {
      console.error("Erreur question suivante:", error);
      socket.emit("error", {
        message: "Erreur lors du passage à la question suivante",
      });
    }
  }

  // Handler: Question précédente (HÔTE SEULEMENT)
  async function handlePreviousQuestion() {
    const socket = this;

    if (!socket.isHost || !socket.sessionId) {
      return socket.emit("error", { message: "Permission insuffisante" });
    }

    try {
      const session = await Session.findByPk(socket.sessionId, {
        include: [{ model: Quiz, as: "quiz" }],
      });

      if (!session) {
        return socket.emit("error", { message: "Session non trouvée" });
      }

      const currentIndex = session.currentQuestionIndex || 0;

      if (currentIndex <= 0) {
        return socket.emit("error", { message: "Première question atteinte" });
      }

      const newIndex = currentIndex - 1;
      await session.update({
        currentQuestionIndex: newIndex,
        currentQuestionStartedAt: new Date(),
      });

      io.to(`session_${session.id}`).emit("previous_question", {
        sessionId: session.id,
        questionIndex: newIndex,
        question: session.quiz.questions[newIndex],
        startedAt: new Date(),
      });
    } catch (error) {
      console.error("Erreur question précédente:", error);
      socket.emit("error", {
        message: "Erreur lors du retour à la question précédente",
      });
    }
  }

  // Handler: Soumettre réponse (PARTICIPANT SEULEMENT)
  async function handleSubmitResponse(data) {
    const socket = this;
    const { questionId, answer, timeSpent } = data;

    if (!socket.isParticipant || !socket.sessionId || !socket.participantId) {
      return socket.emit("error", {
        message: "Vous devez être participant à une session",
      });
    }

    try {
      const session = await Session.findByPk(socket.sessionId, {
        include: [{ model: Quiz, as: "quiz" }],
      });

      if (!session || session.status !== "active") {
        return socket.emit("error", { message: "Session non active" });
      }

      // Trouver la question
      const question = session.quiz?.questions?.find((q) => q.id == questionId);
      if (!question) {
        return socket.emit("error", { message: "Question non trouvée" });
      }

      // Calculer le score (logique simple)
      let isCorrect = false;
      let points = 0;

      if (question.type === "qcm") {
        isCorrect = question.correctAnswer == answer;
        points = isCorrect ? question.points || 1 : 0;
      } else if (question.type === "vrai_faux") {
        isCorrect = question.correctAnswer == answer;
        points = isCorrect ? question.points || 1 : 0;
      } else if (question.type === "reponse_libre") {
        isCorrect =
          question.correctAnswer &&
          answer.toLowerCase().trim() ===
            question.correctAnswer.toLowerCase().trim();
        points = isCorrect ? question.points || 1 : 0;
      }

      const responseData = {
        questionId,
        answer,
        timeSpent: timeSpent || 0,
        points,
        isCorrect,
        submittedAt: new Date(),
      };

      // Mettre à jour la session avec la réponse
      const participants = Array.isArray(session.participants)
        ? session.participants
        : [];
      const responses = session.responses || {};

      // Initialiser les réponses pour cette question
      if (!responses[questionId]) {
        responses[questionId] = {};
      }
      responses[questionId][socket.participantId] = responseData;

      // Mettre à jour le score du participant
      const participantIndex = participants.findIndex(
        (p) => p.id === socket.participantId
      );
      if (participantIndex !== -1) {
        if (!participants[participantIndex].responses) {
          participants[participantIndex].responses = {};
        }
        participants[participantIndex].responses[questionId] = responseData;
        participants[participantIndex].score =
          (participants[participantIndex].score || 0) + points;
      }

      await session.update({ participants, responses });

      // Confirmer au participant
      socket.emit("response_submitted", {
        questionId,
        answer,
        points,
        isCorrect,
      });

      // Notifier l'hôte
      io.to(`host_${session.id}`).emit("new_response", {
        participantId: socket.participantId,
        participantName: participants[participantIndex]?.name || "Participant",
        questionId,
        answer,
        points,
        isCorrect,
        timeSpent,
        totalResponses: Object.keys(responses[questionId] || {}).length,
      });

      console.log(
        `📝 Réponse soumise: ${socket.participantId} → Q${questionId} (${points} pts)`
      );
    } catch (error) {
      console.error("Erreur soumission réponse:", error);
      socket.emit("error", { message: "Erreur lors de la soumission" });
    }
  }

  // Handler: Participant prêt
  async function handleParticipantReady() {
    const socket = this;

    if (!socket.isParticipant || !socket.sessionId || !socket.participantId) {
      return;
    }

    io.to(`host_${socket.sessionId}`).emit("participant_ready", {
      participantId: socket.participantId,
    });
  }

  // Handler: Heartbeat du participant
  async function handleParticipantHeartbeat() {
    const socket = this;

    if (!socket.isParticipant || !socket.sessionId || !socket.participantId) {
      return;
    }

    try {
      const session = await Session.findByPk(socket.sessionId);
      if (session) {
        const participants = Array.isArray(session.participants)
          ? session.participants
          : [];
        const participantIndex = participants.findIndex(
          (p) => p.id === socket.participantId
        );

        if (participantIndex !== -1) {
          participants[participantIndex].isConnected = true;
          participants[participantIndex].lastSeen = new Date();
          await session.update({ participants });
        }
      }
    } catch (error) {
      console.error("Erreur heartbeat:", error);
    }
  }

  // Handler: Message chat
  async function handleSendMessage(data) {
    const socket = this;
    const { message } = data;

    if (!socket.sessionId || !message?.trim()) {
      return;
    }

    if (message.length > 500) {
      return socket.emit("error", { message: "Message trop long" });
    }

    const chatMessage = {
      id: Date.now(),
      participantId: socket.participantId || null,
      participantName:
        socket.user?.username || socket.participantName || "Anonyme",
      message: message.trim(),
      timestamp: new Date(),
      isHost: socket.isHost || false,
    };

    io.to(`session_${socket.sessionId}`).emit("new_message", chatMessage);
  }

  // Handler: Déconnexion avec nettoyage complet
  async function handleDisconnect(reason) {
    const socket = this;

    console.log(`🔌 Déconnexion: ${socket.id} - Raison: ${reason}`);

    try {
      if (socket.sessionId) {
        // Nettoyage hôte
        if (socket.isHost) {
          connectedHosts.delete(socket.sessionId);
          console.log(`🎯 Hôte déconnecté de la session ${socket.sessionId}`);
        }

        // Nettoyage participant
        if (socket.isParticipant && socket.participantId) {
          const sessionParticipants = connectedParticipants.get(
            socket.sessionId
          );
          if (sessionParticipants) {
            sessionParticipants.delete(socket.id);
          }

          // Marquer comme déconnecté dans la DB
          const session = await Session.findByPk(socket.sessionId);
          if (session) {
            const participants = Array.isArray(session.participants)
              ? session.participants
              : [];
            const participantIndex = participants.findIndex(
              (p) => p.id === socket.participantId
            );

            if (participantIndex !== -1) {
              participants[participantIndex].isConnected = false;
              participants[participantIndex].lastSeen = new Date();
              await session.update({ participants });

              // Notifier l'hôte
              io.to(`host_${socket.sessionId}`).emit(
                "participant_disconnected",
                {
                  participantId: socket.participantId,
                  participantName: participants[participantIndex].name,
                  totalConnected: participants.filter((p) => p.isConnected)
                    .length,
                }
              );
            }
          }

          console.log(`👋 Participant ${socket.participantId} déconnecté`);
        }

        // Quitter toutes les rooms
        socket.rooms.forEach((room) => {
          if (room !== socket.id) {
            socket.leave(room);
          }
        });
      }
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error);
    }
  }
};

module.exports = socketHandlers;
