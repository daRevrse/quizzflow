const jwt = require("jsonwebtoken");
const { Session, Quiz, User } = require("../models");

// Middleware d'authentification pour Socket.IO
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

    // Permet les connexions anonymes
    next();
  } catch (error) {
    console.log("Erreur d'authentification Socket.IO:", error.message);
    // Continuer même en cas d'erreur (connexion anonyme)
    next();
  }
};

// Gestionnaire principal des connexions Socket.IO
const socketHandlers = (io) => {
  // Middleware d'authentification
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

    // Événements pour les hôtes/formateurs
    socket.on("host_session", handleHostSession);
    socket.on("next_question", handleNextQuestion);
    socket.on("previous_question", handlePreviousQuestion);
    socket.on("start_session", handleStartSession);
    socket.on("pause_session", handlePauseSession);
    socket.on("resume_session", handleResumeSession);
    socket.on("end_session", handleEndSession);

    // Événements pour les participants
    socket.on("submit_response", handleSubmitResponse);
    socket.on("participant_ready", handleParticipantReady);

    // Événements de chat (optionnel)
    socket.on("send_message", handleSendMessage);

    // Événements de connection/deconnection
    socket.on("participant_heartbeat", handleParticipantHeartbeat);
    socket.on("disconnect", handleDisconnect);

    // Gestion des erreurs
    socket.on("error", (error) => {
      console.error("Erreur Socket.IO:", error);
    });
  });

  // Handler: Rejoindre une session
  async function handleJoinSession(data) {
    try {
      const { sessionCode, participantName, isAnonymous = false } = data;
      const socket = this;

      if (!sessionCode) {
        return socket.emit("error", { message: "Code de session requis" });
      }

      // Trouver la session
      const session = await Session.findByCode(sessionCode);
      if (!session) {
        return socket.emit("error", { message: "Session non trouvée" });
      }

      // Charger les détails complets
      await session.reload({
        include: [
          {
            model: Quiz,
            as: "quiz",
          },
        ],
      });

      // Vérifications
      if (["finished", "cancelled"].includes(session.status)) {
        return socket.emit("error", { message: "Cette session est terminée" });
      }

      if (session.status === "active" && !session.settings.allowLateJoin) {
        return socket.emit("error", {
          message: "Cette session ne permet plus de nouveaux participants",
        });
      }

      const participantCount = session.participants?.length || 0;
      if (participantCount >= (session.settings.maxParticipants || 100)) {
        return socket.emit("error", {
          message: "Nombre maximum de participants atteint",
        });
      }

      // Créer l'objet participant
      let participantId, name;
      if (socket.user && !isAnonymous) {
        participantId = socket.user.id;
        name =
          participantName || `${socket.user.firstName || socket.user.username}`;
      } else {
        participantId = `anon_${socket.id}`;
        name =
          participantName ||
          `Anonyme_${Math.random().toString(36).substr(2, 4)}`;
      }

      // Rejoindre la room
      socket.join(`session_${session.id}`);
      socket.sessionId = session.id;
      socket.participantId = participantId;

      // Ajouter le participant à la session
      await session.addParticipant({
        id: participantId,
        name: name,
        avatar: socket.user?.avatar || null,
        socketId: socket.id,
      });

      // Notifier tous les participants
      io.to(`session_${session.id}`).emit("participant_joined", {
        participant: {
          id: participantId,
          name: name,
          avatar: socket.user?.avatar || null,
          isConnected: true,
        },
        participantCount: session.participants.length,
      });

      // Confirmer la connexion au participant
      socket.emit("session_joined", {
        sessionId: session.id,
        participantId: participantId,
        session: {
          id: session.id,
          code: session.code,
          title: session.title,
          status: session.status,
          currentQuestionIndex: session.currentQuestionIndex,
          settings: session.settings,
          quiz: {
            id: session.quiz.id,
            title: session.quiz.title,
            questionCount: session.quiz.questions?.length || 0,
          },
        },
      });

      // Envoyer la question actuelle si la session est active
      if (session.status === "active" && session.currentQuestionIndex >= 0) {
        const currentQuestion =
          session.quiz.questions?.[session.currentQuestionIndex];
        if (currentQuestion) {
          socket.emit("current_question", {
            questionIndex: session.currentQuestionIndex,
            question: {
              id: currentQuestion.id,
              type: currentQuestion.type,
              question: currentQuestion.question,
              options: currentQuestion.options?.map((opt) => ({
                text: opt.text,
              })),
              timeLimit: currentQuestion.timeLimit,
              points: currentQuestion.points,
              media: currentQuestion.media,
            },
            startedAt: session.currentQuestionStartedAt,
          });
        }
      }

      console.log(`👤 ${name} a rejoint la session ${session.code}`);
    } catch (error) {
      console.error("Erreur lors de la connexion à la session:", error);
      socket.emit("error", {
        message: "Erreur lors de la connexion à la session",
      });
    }
  }

  // Handler: Quitter une session
  async function handleLeaveSession() {
    const socket = this;

    if (!socket.sessionId || !socket.participantId) {
      return;
    }

    try {
      const session = await Session.findByPk(socket.sessionId);
      if (session) {
        await session.updateParticipantConnection(socket.participantId, false);

        // Notifier les autres participants
        io.to(`session_${session.id}`).emit("participant_left", {
          participantId: socket.participantId,
        });
      }

      socket.leave(`session_${socket.sessionId}`);
      socket.sessionId = null;
      socket.participantId = null;
    } catch (error) {
      console.error("Erreur lors de la déconnexion de la session:", error);
    }
  }

  // Handler: Hébergeur de session
  async function handleHostSession(data) {
    const socket = this;
    const { sessionId } = data;

    if (!socket.user) {
      return socket.emit("error", {
        message: "Authentification requise pour héberger",
      });
    }

    try {
      const session = await Session.findByPk(sessionId, {
        include: [
          {
            model: Quiz,
            as: "quiz",
          },
        ],
      });

      if (!session) {
        return socket.emit("error", { message: "Session non trouvée" });
      }

      // Vérifier les permissions
      const isHost = session.hostId === socket.user.id;
      const isQuizOwner = session.quiz?.creatorId === socket.user.id;
      const isAdmin = socket.user.role === "admin";

      if (!isHost && !isQuizOwner && !isAdmin) {
        return socket.emit("error", { message: "Permission insuffisante" });
      }

      // Rejoindre en tant qu'hôte
      socket.join(`session_${sessionId}`);
      socket.join(`host_${sessionId}`);
      socket.sessionId = sessionId;
      socket.isHost = true;

      // Confirmer la connexion hôte
      socket.emit("host_connected", {
        sessionId: session.id,
        session: {
          id: session.id,
          code: session.code,
          title: session.title,
          status: session.status,
          currentQuestionIndex: session.currentQuestionIndex,
          participants: session.participants || [],
          responses: session.responses || {},
          settings: session.settings,
          quiz: session.quiz,
          stats: session.stats,
        },
      });

      console.log(
        `🎯 ${socket.user.username} héberge la session ${session.code}`
      );
    } catch (error) {
      console.error("Erreur lors de la connexion hôte:", error);
      socket.emit("error", { message: "Erreur lors de la connexion hôte" });
    }
  }

  // Handler: Question suivante
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

      const totalQuestions = session.quiz.questions?.length || 0;
      if (session.currentQuestionIndex >= totalQuestions - 1) {
        return socket.emit("error", { message: "Dernière question atteinte" });
      }

      await session.nextQuestion();
      const currentQuestion =
        session.quiz.questions[session.currentQuestionIndex];

      // Notifier tous les participants
      io.to(`session_${session.id}`).emit("next_question", {
        questionIndex: session.currentQuestionIndex,
        question: {
          id: currentQuestion.id,
          type: currentQuestion.type,
          question: currentQuestion.question,
          options: currentQuestion.options?.map((opt) => ({ text: opt.text })),
          timeLimit: currentQuestion.timeLimit,
          points: currentQuestion.points,
          media: currentQuestion.media,
        },
        startedAt: session.currentQuestionStartedAt,
      });

      // Confirmer à l'hôte
      socket.emit("question_changed", {
        currentQuestionIndex: session.currentQuestionIndex,
        totalQuestions,
      });
    } catch (error) {
      console.error("Erreur lors du passage à la question suivante:", error);
      socket.emit("error", {
        message: "Erreur lors du changement de question",
      });
    }
  }

  // Handler: Question précédente
  async function handlePreviousQuestion() {
    const socket = this;

    if (!socket.isHost || !socket.sessionId) {
      return socket.emit("error", { message: "Permission insuffisante" });
    }

    try {
      const session = await Session.findByPk(socket.sessionId, {
        include: [{ model: Quiz, as: "quiz" }],
      });

      if (!session || session.currentQuestionIndex <= 0) {
        return socket.emit("error", { message: "Première question atteinte" });
      }

      await session.previousQuestion();
      const currentQuestion =
        session.quiz.questions[session.currentQuestionIndex];

      // Notifier tous les participants
      io.to(`session_${session.id}`).emit("previous_question", {
        questionIndex: session.currentQuestionIndex,
        question: {
          id: currentQuestion.id,
          type: currentQuestion.type,
          question: currentQuestion.question,
          options: currentQuestion.options?.map((opt) => ({ text: opt.text })),
          timeLimit: currentQuestion.timeLimit,
          points: currentQuestion.points,
          media: currentQuestion.media,
        },
        startedAt: session.currentQuestionStartedAt,
      });

      socket.emit("question_changed", {
        currentQuestionIndex: session.currentQuestionIndex,
        totalQuestions: session.quiz.questions.length,
      });
    } catch (error) {
      console.error("Erreur lors du retour à la question précédente:", error);
      socket.emit("error", {
        message: "Erreur lors du changement de question",
      });
    }
  }

  // Handler: Démarrer la session
  async function handleStartSession() {
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

      if (session.status !== "waiting") {
        return socket.emit("error", {
          message: "La session ne peut être démarrée",
        });
      }

      await session.startSession();

      // Notifier tous les participants
      io.to(`session_${session.id}`).emit("session_started", {
        sessionId: session.id,
        startedAt: session.startedAt,
      });

      // Envoyer la première question
      if (session.quiz.questions && session.quiz.questions.length > 0) {
        const firstQuestion = session.quiz.questions[0];
        io.to(`session_${session.id}`).emit("current_question", {
          questionIndex: 0,
          question: {
            id: firstQuestion.id,
            type: firstQuestion.type,
            question: firstQuestion.question,
            options: firstQuestion.options?.map((opt) => ({ text: opt.text })),
            timeLimit: firstQuestion.timeLimit,
            points: firstQuestion.points,
            media: firstQuestion.media,
          },
          startedAt: session.currentQuestionStartedAt,
        });
      }
    } catch (error) {
      console.error("Erreur lors du démarrage de la session:", error);
      socket.emit("error", { message: "Erreur lors du démarrage" });
    }
  }

  // Handler: Mettre en pause
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

      await session.pauseSession();

      io.to(`session_${session.id}`).emit("session_paused", {
        sessionId: session.id,
      });
    } catch (error) {
      console.error("Erreur lors de la mise en pause:", error);
      socket.emit("error", { message: "Erreur lors de la mise en pause" });
    }
  }

  // Handler: Reprendre la session
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

      await session.resumeSession();

      io.to(`session_${session.id}`).emit("session_resumed", {
        sessionId: session.id,
        resumedAt: session.currentQuestionStartedAt,
      });
    } catch (error) {
      console.error("Erreur lors de la reprise:", error);
      socket.emit("error", { message: "Erreur lors de la reprise" });
    }
  }

  // Handler: Terminer la session
  async function handleEndSession() {
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

      await session.endSession();

      // Mettre à jour les stats du quiz
      if (session.quiz) {
        const averageScore = session.stats?.averageScore || 0;
        const participantCount = session.participants?.length || 0;
        await session.quiz.incrementStats(participantCount, averageScore);
      }

      // Notifier tous les participants
      io.to(`session_${session.id}`).emit("session_ended", {
        sessionId: session.id,
        endedAt: session.endedAt,
        finalStats: session.stats,
        leaderboard: session.getLeaderboard(),
      });
    } catch (error) {
      console.error("Erreur lors de la fin de session:", error);
      socket.emit("error", { message: "Erreur lors de la fin de session" });
    }
  }

  // Handler: Soumettre une réponse
  async function handleSubmitResponse(data) {
    const socket = this;
    const { questionId, answer, timeSpent } = data;

    if (!socket.sessionId || !socket.participantId) {
      return socket.emit("error", {
        message: "Vous devez rejoindre une session",
      });
    }

    try {
      const session = await Session.findByPk(socket.sessionId, {
        include: [{ model: Quiz, as: "quiz" }],
      });

      if (!session) {
        return socket.emit("error", { message: "Session non trouvée" });
      }

      if (session.status !== "active") {
        return socket.emit("error", { message: "La session n'est pas active" });
      }

      // Trouver la question
      const question = session.quiz.questions?.find((q) => q.id === questionId);
      if (!question) {
        return socket.emit("error", { message: "Question non trouvée" });
      }

      // Calculer les points
      let points = 0;
      let isCorrect = false;

      if (question.type === "qcm" || question.type === "vrai_faux") {
        const correctOption = question.options?.find((opt) => opt.isCorrect);
        isCorrect = correctOption && correctOption.text === answer;
        points = isCorrect ? question.points || 1 : 0;
      } else if (question.type === "reponse_libre") {
        // Comparaison basique - pourrait être améliorée
        isCorrect =
          question.correctAnswer &&
          answer.toLowerCase().trim() ===
            question.correctAnswer.toLowerCase().trim();
        points = isCorrect ? question.points || 1 : 0;
      }

      // Enregistrer la réponse
      await session.addResponse(socket.participantId, questionId, {
        answer,
        timeSpent,
        points,
        isCorrect,
        submittedAt: new Date(),
      });

      // Confirmer la soumission au participant
      socket.emit("response_submitted", {
        questionId,
        answer,
        points,
        isCorrect,
      });

      // Notifier l'hôte de la nouvelle réponse
      io.to(`host_${session.id}`).emit("new_response", {
        participantId: socket.participantId,
        questionId,
        answer,
        points,
        isCorrect,
        timeSpent,
        totalResponses: Object.keys(session.responses[questionId] || {}).length,
      });

      // Mettre à jour le leaderboard si activé
      if (session.settings.showLeaderboard) {
        const leaderboard = session.getLeaderboard();
        io.to(`session_${session.id}`).emit("leaderboard_updated", {
          leaderboard: leaderboard.slice(0, 10), // Top 10
        });
      }
    } catch (error) {
      console.error("Erreur lors de la soumission de réponse:", error);
      socket.emit("error", { message: "Erreur lors de la soumission" });
    }
  }

  // Handler: Participant prêt
  async function handleParticipantReady() {
    const socket = this;

    if (!socket.sessionId || !socket.participantId) {
      return;
    }

    // Notifier l'hôte
    io.to(`host_${socket.sessionId}`).emit("participant_ready", {
      participantId: socket.participantId,
    });
  }

  // Handler: Envoyer un message de chat
  async function handleSendMessage(data) {
    const socket = this;
    const { message } = data;

    if (!socket.sessionId || !message || message.trim().length === 0) {
      return;
    }

    if (message.length > 500) {
      return socket.emit("error", {
        message: "Message trop long (max 500 caractères)",
      });
    }

    const chatMessage = {
      id: Date.now(),
      participantId: socket.participantId,
      participantName: socket.user?.username || "Anonyme",
      message: message.trim(),
      timestamp: new Date(),
    };

    // Diffuser le message à tous dans la session
    io.to(`session_${socket.sessionId}`).emit("new_message", chatMessage);
  }

  // Handler: Heartbeat du participant
  async function handleParticipantHeartbeat() {
    const socket = this;

    if (!socket.sessionId || !socket.participantId) {
      return;
    }

    try {
      const session = await Session.findByPk(socket.sessionId);
      if (session) {
        await session.updateParticipantConnection(socket.participantId, true);
      }
    } catch (error) {
      console.error("Erreur lors du heartbeat:", error);
    }
  }

  // Handler: Déconnexion
  async function handleDisconnect(reason) {
    const socket = this;

    console.log(
      `🔌 Déconnexion Socket.IO: ${socket.id} ${
        socket.user ? `(${socket.user.username})` : "(anonyme)"
      } - Raison: ${reason}`
    );

    if (socket.sessionId && socket.participantId) {
      try {
        const session = await Session.findByPk(socket.sessionId);
        if (session) {
          await session.updateParticipantConnection(
            socket.participantId,
            false
          );

          // Notifier les autres participants (sauf pour les hôtes)
          if (!socket.isHost) {
            io.to(`session_${session.id}`).emit("participant_disconnected", {
              participantId: socket.participantId,
            });
          }
        }
      } catch (error) {
        console.error("Erreur lors de la déconnexion:", error);
      }
    }
  }
};

module.exports = socketHandlers;
