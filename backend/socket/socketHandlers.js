const jwt = require("jsonwebtoken");
const { Session, Quiz, User } = require("../models");

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

  const timerDebugInfo = new Map();
const activeQuestionTimers = new Map(); 

function calculateSessionStats(sessionData) {
  const participants = Array.isArray(sessionData.participants) ? sessionData.participants : [];
  const responses = sessionData.responses || {};
  
  console.log(`📊 Calcul stats session - ${participants.length} participants`);
  
  const totalParticipants = participants.length;
  
  // Calculer le nombre total de réponses
  const totalResponses = Object.keys(responses).reduce((total, questionId) => {
    const questionResponses = responses[questionId];
    return total + (Array.isArray(questionResponses) ? questionResponses.length : 0);
  }, 0);
  
  // Calculer les statistiques des participants
  let totalScore = 0;
  let activeParticipants = 0;
  let totalCorrectAnswers = 0;
  let totalQuestionsAnswered = 0;
  let totalTimeSpent = 0;
  let bestScore = 0;
  let worstScore = Number.MAX_SAFE_INTEGER;
  
  participants.forEach((participant) => {
    if (participant && typeof participant === "object") {
      const score = participant.score || 0;
      const correctAnswers = participant.correctAnswers || 0;
      const totalQuestions = participant.totalQuestions || 0;
      
      if (typeof score === "number" && !isNaN(score)) {
        totalScore += score;
        activeParticipants++;
        
        bestScore = Math.max(bestScore, score);
        if (worstScore === Number.MAX_SAFE_INTEGER) {
          worstScore = score;
        } else {
          worstScore = Math.min(worstScore, score);
        }
      }
      
      totalCorrectAnswers += correctAnswers;
      totalQuestionsAnswered += totalQuestions;
      
      // Calculer le temps total passé par le participant
      if (participant.responses) {
        Object.values(participant.responses).forEach(response => {
          if (response && typeof response.timeSpent === 'number') {
            totalTimeSpent += response.timeSpent;
          }
        });
      }
    }
  });
  
  // Calculer les moyennes
  const averageScore = activeParticipants > 0 
    ? Math.round((totalScore / activeParticipants) * 100) / 100 
    : 0;
    
  const participationRate = totalParticipants > 0 
    ? Math.round((activeParticipants / totalParticipants) * 100) 
    : 0;
    
  const accuracyRate = totalQuestionsAnswered > 0 
    ? Math.round((totalCorrectAnswers / totalQuestionsAnswered) * 100) 
    : 0;
    
  const averageTimePerQuestion = totalQuestionsAnswered > 0 
    ? Math.round(totalTimeSpent / totalQuestionsAnswered) 
    : 0;
  
  // Réinitialiser les scores min/max si pas de participants actifs
  if (activeParticipants === 0) {
    bestScore = 0;
    worstScore = 0;
  }
  
  // Calculer les stats par question
  const questionStats = {};
  Object.keys(responses).forEach(questionId => {
    const questionResponses = responses[questionId];
    if (Array.isArray(questionResponses)) {
      const correctCount = questionResponses.filter(r => r.isCorrect).length;
      const avgTime = questionResponses.length > 0 
        ? questionResponses.reduce((sum, r) => sum + (r.timeSpent || 0), 0) / questionResponses.length 
        : 0;
      
      questionStats[questionId] = {
        totalResponses: questionResponses.length,
        correctResponses: correctCount,
        accuracyRate: questionResponses.length > 0 
          ? Math.round((correctCount / questionResponses.length) * 100) 
          : 0,
        averageTimeSpent: Math.round(avgTime),
        responseRate: totalParticipants > 0 
          ? Math.round((questionResponses.length / totalParticipants) * 100) 
          : 0
      };
    }
  });
  
  const stats = {
    // Stats générales
    totalParticipants,
    activeParticipants,
    totalResponses,
    
    // Stats de performance
    averageScore,
    bestScore,
    worstScore,
    totalCorrectAnswers,
    totalQuestionsAnswered,
    accuracyRate,
    
    // Stats d'engagement
    participationRate,
    averageTimePerQuestion,
    totalTimeSpent,
    
    // Stats détaillées par question
    questionStats,
    
    // Timestamps
    calculatedAt: new Date(),
  };
  
  console.log(`📊 Stats calculées:`, {
    totalParticipants: stats.totalParticipants,
    averageScore: stats.averageScore,
    accuracyRate: stats.accuracyRate,
    participationRate: stats.participationRate
  });
  
  return stats;
}

  function debugTimer(sessionId, action, details = {}) {
    const timestamp = new Date().toISOString();
    console.log(`⏰ [${timestamp}] TIMER DEBUG - Session ${sessionId}:`);
    console.log(`   Action: ${action}`);
    console.log(`   Détails:`, details);
    console.log(`   Timers actifs: ${activeQuestionTimers.size}`);
    console.log(`   Timer pour cette session: ${activeQuestionTimers.has(sessionId) ? 'OUI' : 'NON'}`);
    
    // Stocker l'info de debug
    if (!timerDebugInfo.has(sessionId)) {
      timerDebugInfo.set(sessionId, []);
    }
    timerDebugInfo.get(sessionId).push({
      timestamp,
      action,
      details
    });
  }
  
  // Fonction pour démarrer le timer automatique d'une question
  function startQuestionTimer(sessionId, questionIndex, timeLimit) {
    debugTimer(sessionId, "START_TIMER", {
      questionIndex,
      timeLimit,
      existingTimer: activeQuestionTimers.has(sessionId)
    });
  
    // Nettoyer le timer précédent s'il existe
    if (activeQuestionTimers.has(sessionId)) {
      clearTimeout(activeQuestionTimers.get(sessionId));
      debugTimer(sessionId, "CLEAR_EXISTING_TIMER");
    }
  
    console.log(`⏰ === DÉMARRAGE TIMER ===`);
    console.log(`   Session: ${sessionId}`);
    console.log(`   Question: ${questionIndex}`);
    console.log(`   Durée: ${timeLimit}s`);
    console.log(`   Fin prévue: ${new Date(Date.now() + timeLimit * 1000).toISOString()}`);
    
    const timerId = setTimeout(async () => {
      console.log(`\n🚨 === TIMER EXPIRÉ ===`);
      console.log(`   Session: ${sessionId}`);
      console.log(`   Question: ${questionIndex}`);
      console.log(`   Heure: ${new Date().toISOString()}`);
      
      debugTimer(sessionId, "TIMER_EXPIRED", { questionIndex });
      
      try {
        console.log(`🔍 Recherche session ${sessionId} pour avancement auto...`);
        
        const session = await Session.findByPk(sessionId, {
          include: [{ model: Quiz, as: "quiz" }],
        });
    
        if (!session) {
          console.log(`❌ Session ${sessionId} non trouvée`);
          debugTimer(sessionId, "SESSION_NOT_FOUND");
          return;
        }
    
        console.log(`✅ Session trouvée: ${session.code} (status: ${session.status})`);
    
        if (session.status !== "active") {
          console.log(`⚠️ Session ${sessionId} non active (${session.status}), timer annulé`);
          debugTimer(sessionId, "SESSION_NOT_ACTIVE", { status: session.status });
          return;
        }
    
        const totalQuestions = session.quiz?.questions?.length || 0;
        console.log(`📊 Questions: ${questionIndex + 1}/${totalQuestions}`);
        
        if (questionIndex >= totalQuestions - 1) {// CORRECTION: Dernière question - terminer proprement la session
          console.log(`🏁 === DERNIÈRE QUESTION TERMINÉE ===`);
          console.log(`   Fin automatique de session ${sessionId}`);
          
          debugTimer(sessionId, "AUTO_END_SESSION", { questionIndex, totalQuestions });
          
          // CORRECTION: Vérifier le statut avant de terminer
          if (session.status === "finished") {
            console.log(`⚠️ Session ${sessionId} déjà terminée, pas d'action nécessaire`);
            debugTimer(sessionId, "SESSION_ALREADY_FINISHED");
            return;
          }
        
          if (!["active", "paused"].includes(session.status)) {
            console.log(`⚠️ Session ${sessionId} dans un état non terminable: ${session.status}`);
            debugTimer(sessionId, "SESSION_NOT_TERMINABLE", { status: session.status });
            return;
          }
        
          try {
            // Utiliser la méthode endSession du modèle
            await session.endSession();
            
            // Calculer les stats finales
            const finalStats = calculateSessionStats({
              participants: session.participants,
              responses: session.responses,
            });
            
            await session.update({ stats: finalStats });
        
            console.log(`📢 Notification fin de session automatique`);
            
            // Notification uniforme avec status "finished"
            const endNotification = {
              sessionId,
              finalStats: finalStats,
              message: "Session terminée automatiquement - temps écoulé",
              autoEnded: true,
              endedAt: session.endedAt,
              reason: "timer_expired"
            };
        
            // Notifier tous les participants
            io.to(`session_${sessionId}`).emit("session_ended", endNotification);
        
            // Notifier l'hôte spécifiquement
            io.to(`host_${sessionId}`).emit("session_ended", {
              ...endNotification,
              isHost: true
            });
        
            console.log(`✅ Session ${sessionId} terminée automatiquement`);
        
          } catch (endError) {
            console.error(`❌ Erreur lors de la fin automatique de session ${sessionId}:`, endError);
            
            // Si l'erreur indique que la session est déjà terminée, ce n'est pas grave
            if (endError.message?.includes("terminée") || endError.message?.includes("finished")) {
              console.log(`⚠️ Session ${sessionId} était déjà terminée - pas d'erreur réelle`);
              debugTimer(sessionId, "SESSION_ALREADY_FINISHED_ON_END");
            } else {
              // Pour d'autres erreurs, on les log mais on continue
              console.error(`❌ Erreur inattendue fin automatique session ${sessionId}:`, endError);
              debugTimer(sessionId, "AUTO_END_ERROR", { error: endError.message });
            }
          }} else {
          // Passer à la question suivante (code existant)
          const newIndex = questionIndex + 1;
          const nextQuestion = session.quiz.questions[newIndex];
          
          console.log(`➡️ === PASSAGE AUTOMATIQUE ===`);
          console.log(`   Session: ${sessionId}`);
          console.log(`   De question ${questionIndex} vers ${newIndex}`);
          console.log(`   Nouvelle question: "${nextQuestion?.question?.substring(0, 50)}..."`);
          
          debugTimer(sessionId, "AUTO_NEXT_QUESTION", { 
            from: questionIndex, 
            to: newIndex,
            nextQuestionTimeLimit: nextQuestion?.timeLimit 
          });
          
          await session.update({
            currentQuestionIndex: newIndex,
            currentQuestionStartedAt: new Date(),
          });
    
          console.log(`📢 Notification nouvelle question automatique`);
    
          // Notifier tous les participants
          io.to(`session_${sessionId}`).emit("next_question", {
            sessionId,
            questionIndex: newIndex,
            question: nextQuestion,
            startedAt: new Date(),
            autoAdvanced: true
          });
    
          // Notifier l'hôte spécifiquement  
          io.to(`host_${sessionId}`).emit("next_question", {
            sessionId,
            questionIndex: newIndex,
            question: nextQuestion,
            startedAt: new Date(),
            autoAdvanced: true,
            isHost: true
          });
    
          console.log(`✅ Passage automatique vers question ${newIndex + 1} réussi`);
    
          // Démarrer le timer pour la nouvelle question si elle a une limite de temps
          if (nextQuestion && nextQuestion.timeLimit) {
            console.log(`⏰ Démarrage timer pour nouvelle question: ${nextQuestion.timeLimit}s`);
            startQuestionTimer(sessionId, newIndex, nextQuestion.timeLimit);
          } else {
            console.log(`⏰ Pas de timer pour la nouvelle question`);
          }
        }
    
      } catch (error) {
        console.error(`💥 === ERREUR TIMER AUTOMATIQUE ===`);
        console.error(`   Session: ${sessionId}`);
        console.error(`   Question: ${questionIndex}`);
        console.error(`   Error:`, error);
        
        debugTimer(sessionId, "TIMER_ERROR", { 
          error: error.message,
          stack: error.stack?.split('\n')[0]
        });
      } finally {
        // Nettoyer le timer
        activeQuestionTimers.delete(sessionId);
        debugTimer(sessionId, "TIMER_CLEANED");
        console.log(`🧹 Timer nettoyé pour session ${sessionId}\n`);
      }
    }, timeLimit * 1000);
  
    // Stocker le timer
    activeQuestionTimers.set(sessionId, timerId);
    debugTimer(sessionId, "TIMER_STORED", { timerId: timerId.toString() });
    
    console.log(`✅ Timer démarré et stocké pour session ${sessionId}`);
    console.log(`   Timer ID: ${timerId}`);
    console.log(`   Timers actifs total: ${activeQuestionTimers.size}\n`);
  }
  
  
  // Fonction pour arrêter le timer d'une session
  function stopQuestionTimer(sessionId, reason = "manual") {
    debugTimer(sessionId, "STOP_TIMER", { reason });
    
    if (activeQuestionTimers.has(sessionId)) {
      clearTimeout(activeQuestionTimers.get(sessionId));
      activeQuestionTimers.delete(sessionId);
      console.log(`⏹️ Timer arrêté pour session ${sessionId} (${reason})`);
    } else {
      console.log(`⚠️ Aucun timer actif à arrêter pour session ${sessionId}`);
    }
  }

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
    socket.on("submit_answer", handleSubmitResponse);
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
  
      // Arrêter le timer de la question courante
      stopQuestionTimer(session.id);
  
      const newIndex = currentIndex + 1;
      const nextQuestion = session.quiz.questions[newIndex];
      
      await session.update({
        currentQuestionIndex: newIndex,
        currentQuestionStartedAt: new Date(),
      });
  
      // AJOUT: Démarrer le timer pour la nouvelle question
      if (nextQuestion && nextQuestion.timeLimit) {
        startQuestionTimer(session.id, newIndex, nextQuestion.timeLimit);
        console.log(`⏰ Timer démarré pour question ${newIndex + 1}: ${nextQuestion.timeLimit}s`);
      }
  
      io.to(`session_${session.id}`).emit("next_question", {
        sessionId: session.id,
        questionIndex: newIndex,
        question: nextQuestion,
        startedAt: new Date(),
      });
  
      console.log(`➡️ Passage manuel à la question ${newIndex + 1}`);
    } catch (error) {
      console.error("Erreur question suivante:", error);
      socket.emit("error", {
        message: "Erreur lors du passage à la question suivante",
      });
    }
  }
  
  // MODIFICATION du handler end session
  async function handleEndSession() {
    const socket = this;
    if (!socket.isHost || !socket.sessionId) {
      return socket.emit("error", { message: "Permission insuffisante" });
    }
  
    try {
      // Arrêter le timer automatique
      stopQuestionTimer(socket.sessionId, "manual_end");
  
      const session = await Session.findByPk(socket.sessionId, {
        include: [{ model: Quiz, as: "quiz" }],
      });
      
      if (!session) {
        return socket.emit("error", { message: "Session non trouvée" });
      }
  
      // CORRECTION: Gérer le cas où la session est déjà terminée
      if (session.status === "finished") {
        console.log(`⚠️ Session ${session.id} déjà terminée, envoi confirmation`);
        
        // Confirmer que la session est terminée sans erreur
        socket.emit("session_ended", {
          sessionId: session.id,
          finalStats: session.stats || {},
          message: "Session déjà terminée",
          autoEnded: false,
          endedAt: session.endedAt,
          alreadyFinished: true
        });
        
        return;
      }
  
      // Vérifier que la session peut être terminée
      if (!["active", "paused"].includes(session.status)) {
        return socket.emit("error", { 
          message: `Impossible de terminer une session avec le statut "${session.status}"`,
          currentStatus: session.status,
          code: "INVALID_SESSION_STATUS"
        });
      }
  
      console.log(`🏁 Fin manuelle de session ${session.code} depuis Socket.IO`);
  
      // Utiliser la méthode endSession du modèle
      await session.endSession();
      await session.reload();
  
      // Calculer les stats finales
      const finalStats = calculateSessionStats({
        participants: session.participants,
        responses: session.responses,
      });
      
      await session.update({ stats: finalStats });
  
      console.log(`✅ Session ${session.code} terminée manuellement via Socket.IO`);
  
      // Notifier tous les participants
      io.to(`session_${session.id}`).emit("session_ended", {
        sessionId: session.id,
        finalStats: finalStats,
        message: "Session terminée par l'hôte",
        autoEnded: false,
        endedAt: session.endedAt,
        manualEnd: true
      });
  
      // Notifier spécifiquement l'hôte
      socket.emit("session_ended", {
        sessionId: session.id,
        finalStats: finalStats,
        message: "Session terminée avec succès",
        autoEnded: false,
        endedAt: session.endedAt,
        manualEnd: true,
        isHost: true
      });
  
      // Nettoyer le timer de la Map
      activeQuestionTimers.delete(session.id);
  
    } catch (error) {
      console.error("Erreur fin de session Socket.IO:", error);
      
      // Gestion spécifique des erreurs de statut
      if (error.message?.includes("statut") || error.message?.includes("terminée")) {
        socket.emit("error", { 
          message: error.message,
          code: "INVALID_SESSION_STATUS",
          currentStatus: session?.status
        });
      } else {
        socket.emit("error", { 
          message: "Erreur lors de la fin de session",
          code: "END_SESSION_ERROR",
          details: process.env.NODE_ENV === "development" ? error.message : undefined
        });
      }
    }
  }
  
  // MODIFICATION du handler pause session
  async function handlePauseSession() {
    const socket = this;
    if (!socket.isHost || !socket.sessionId) {
      return socket.emit("error", { message: "Permission insuffisante" });
    }
  
    try {
      // Arrêter le timer pendant la pause
      stopQuestionTimer(socket.sessionId);
  
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
  
      console.log(`⏸️ Session ${session.code} mise en pause, timer arrêté`);
    } catch (error) {
      console.error("Erreur lors de la pause:", error);
      socket.emit("error", { message: "Erreur lors de la pause" });
    }
  }
  
  // MODIFICATION du handler resume session
  async function handleResumeSession() {
    const socket = this;
    if (!socket.isHost || !socket.sessionId) {
      return socket.emit("error", { message: "Permission insuffisante" });
    }
  
    try {
      const session = await Session.findByPk(socket.sessionId, {
        include: [{ model: Quiz, as: "quiz" }],
      });
  
      if (!session || session.status !== "paused") {
        return socket.emit("error", { message: "Impossible de reprendre" });
      }
  
      await session.update({
        status: "active",
        currentQuestionStartedAt: new Date(),
      });
  
      // AJOUT: Redémarrer le timer pour la question courante
      const currentQuestionIndex = session.currentQuestionIndex || 0;
      const currentQuestion = session.quiz?.questions?.[currentQuestionIndex];
      
      if (currentQuestion && currentQuestion.timeLimit) {
        startQuestionTimer(session.id, currentQuestionIndex, currentQuestion.timeLimit);
        console.log(`⏰ Timer redémarré après pause: ${currentQuestion.timeLimit}s`);
      }
  
      io.to(`session_${session.id}`).emit("session_resumed", {
        sessionId: session.id,
        resumedAt: new Date(),
      });
  
      console.log(`▶️ Session ${session.code} reprise, timer redémarré`);
    } catch (error) {
      console.error("Erreur lors de la reprise:", error);
      socket.emit("error", { message: "Erreur lors de la reprise" });
    }
  }

  async function handleJoinSession(data) {
    const socket = this;

    try {
      console.log(`\n🎯 === DEBUT handleJoinSession ===`);
      console.log(`   Socket ID: ${socket.id}`);
      console.log(`   User: ${socket.user ? socket.user.username : "anonyme"}`);
      console.log(`   Data brute reçue:`, JSON.stringify(data, null, 2));

      // Validation des données reçues
      if (!data || typeof data !== "object") {
        console.log(`❌ Données invalides:`, typeof data);
        return socket.emit("error", {
          message: "Données manquantes ou invalides",
          code: "INVALID_DATA",
          received: data,
        });
      }

      let sessionCode,
        participantName,
        isAnonymous,
        participantId = null;

      // 🔧 DÉTECTION DU FORMAT ET EXTRACTION FLEXIBLE - AJOUT DU 3ème FORMAT
      if (data.sessionCode && data.participantName) {
        // Format 1 : { sessionCode, participantName, isAnonymous }
        console.log(`📋 Format standard détecté`);
        sessionCode = data.sessionCode;
        participantName = data.participantName;
        isAnonymous = data.isAnonymous;
      } else if (data.sessionId && data.participant) {
        // Format 2 : { sessionId, participant: { name, ... } }
        console.log(`📋 Format alternatif détecté (sessionId + participant)`);

        // Chercher la session par ID pour récupérer le code
        try {
          const sessionById = await Session.findByPk(data.sessionId, {
            attributes: ["id", "code", "status"],
          });

          if (!sessionById) {
            console.log(`❌ Session non trouvée avec ID: ${data.sessionId}`);
            return socket.emit("error", {
              message: "Session non trouvée",
              code: "SESSION_NOT_FOUND",
              searchedId: data.sessionId,
            });
          }

          sessionCode = sessionById.code;
          participantName = data.participant.name;
          isAnonymous = data.participant.isAnonymous || false;

          console.log(
            `✅ Session trouvée par ID, code récupéré: ${sessionCode}`
          );
        } catch (error) {
          console.error(`❌ Erreur lors de la recherche par ID:`, error);
          return socket.emit("error", {
            message: "Erreur lors de la recherche de session",
            code: "SESSION_LOOKUP_ERROR",
          });
        }
      } else if (
        data.sessionId &&
        data.participantId &&
        data.role === "participant"
      ) {
        // Format 3 : { sessionId, participantId, role } - NOUVEAU FORMAT
        console.log(
          `📋 Format connexion Socket détecté (reconnexion participant)`
        );

        try {
          // Récupérer la session par ID
          const sessionById = await Session.findByPk(data.sessionId, {
            attributes: ["id", "code", "status", "participants"],
          });

          if (!sessionById) {
            console.log(`❌ Session non trouvée avec ID: ${data.sessionId}`);
            return socket.emit("error", {
              message: "Session non trouvée",
              code: "SESSION_NOT_FOUND",
              searchedId: data.sessionId,
            });
          }

          // Chercher le participant dans la liste existante
          let participants = sessionById.participants;
          if (typeof participants === "string") {
            participants = JSON.parse(participants);
          }
          if (!Array.isArray(participants)) {
            participants = [];
          }

          const existingParticipant = participants.find(
            (p) => p && p.id === data.participantId
          );

          if (!existingParticipant) {
            console.log(
              `❌ Participant non trouvé avec ID: ${data.participantId}`
            );
            return socket.emit("error", {
              message: "Participant non trouvé dans cette session",
              code: "PARTICIPANT_NOT_FOUND",
              participantId: data.participantId,
            });
          }

          // Utiliser les données du participant existant
          sessionCode = sessionById.code;
          participantName = existingParticipant.name;
          isAnonymous = existingParticipant.isAnonymous || false;
          participantId = data.participantId; // Réutiliser l'ID existant

          console.log(
            `✅ Reconnexion participant: ${participantName} (${participantId})`
          );
        } catch (error) {
          console.error(`❌ Erreur lors de la reconnexion:`, error);
          return socket.emit("error", {
            message: "Erreur lors de la reconnexion",
            code: "RECONNECTION_ERROR",
          });
        }
      } else {
        // Format non reconnu
        console.log(`❌ Format de données non reconnu:`, {
          hasSessionCode: !!data.sessionCode,
          hasParticipantName: !!data.participantName,
          hasSessionId: !!data.sessionId,
          hasParticipant: !!data.participant,
          hasParticipantId: !!data.participantId,
          hasRole: !!data.role,
          availableKeys: Object.keys(data),
        });

        return socket.emit("error", {
          message: "Format de données non reconnu",
          code: "INVALID_DATA_FORMAT",
          expected:
            "{ sessionCode, participantName, isAnonymous } OU { sessionId, participant: { name } } OU { sessionId, participantId, role }",
          received: Object.keys(data),
          data: data,
        });
      }

      console.log(`📊 Données extraites:`, {
        sessionCode,
        participantName,
        isAnonymous: Boolean(isAnonymous),
        participantId: participantId || "nouveau",
      });

      // Validation des champs extraits
      if (
        !sessionCode ||
        typeof sessionCode !== "string" ||
        sessionCode.trim().length === 0
      ) {
        console.log(`❌ sessionCode invalide après extraction:`, sessionCode);
        return socket.emit("error", {
          message: "Code de session requis",
          code: "MISSING_SESSION_CODE",
          extracted: { sessionCode, participantName, isAnonymous },
        });
      }

      if (
        !participantName ||
        typeof participantName !== "string" ||
        participantName.trim().length === 0
      ) {
        console.log(
          `❌ participantName invalide après extraction:`,
          participantName
        );
        return socket.emit("error", {
          message: "Nom de participant requis",
          code: "MISSING_PARTICIPANT_NAME",
          extracted: { sessionCode, participantName, isAnonymous },
        });
      }

      const cleanSessionCode = sessionCode.trim().toUpperCase();
      const cleanParticipantName = participantName.trim();

      console.log(`🧹 Données nettoyées:`, {
        cleanSessionCode,
        cleanParticipantName,
        isAnonymous: Boolean(isAnonymous),
        isReconnection: !!participantId,
      });

      // Recherche de la session complète
      console.log(`🔍 Recherche session avec code: "${cleanSessionCode}"`);

      const session = await Session.findOne({
        where: {
          code: cleanSessionCode,
          status: ["waiting", "active"],
        },
        include: [
          {
            model: Quiz,
            as: "quiz",
            attributes: ["id", "title", "questions"],
          },
          {
            model: User,
            as: "host",
            attributes: ["id", "username", "firstName", "lastName"],
          },
        ],
      });

      if (!session) {
        console.log(
          `❌ Session non trouvée pour le code: "${cleanSessionCode}"`
        );
        return socket.emit("error", {
          message: "Session non trouvée ou terminée",
          code: "SESSION_NOT_FOUND",
          searchedCode: cleanSessionCode,
        });
      }

      console.log(`✅ Session trouvée:`, {
        id: session.id,
        code: session.code,
        title: session.title,
        status: session.status,
        participantsType: typeof session.participants,
        isArray: Array.isArray(session.participants),
      });

      // S'assurer que participants est un tableau
      let currentParticipants = session.participants;
      if (typeof currentParticipants === "string") {
        currentParticipants = JSON.parse(currentParticipants);
      }
      if (!Array.isArray(currentParticipants)) {
        console.log(`⚠️ Participants n'est pas un tableau, initialisation`);
        currentParticipants = [];
      }

      console.log(
        `✅ Participants array validé: ${currentParticipants.length} participants`
      );

      // Gestion reconnexion vs nouveau participant
      let finalParticipantId = participantId;
      let isReconnection = false;

      if (participantId) {
        // C'est une reconnexion - vérifier que le participant existe
        const existingParticipant = currentParticipants.find(
          (p) => p && p.id === participantId
        );
        if (existingParticipant) {
          isReconnection = true;
          console.log(
            `🔄 Reconnexion du participant: ${existingParticipant.name}`
          );

          // Mettre à jour le statut de connexion
          const updatedParticipants = currentParticipants.map((p) => {
            if (p.id === participantId) {
              return {
                ...p,
                isConnected: true,
                socketId: socket.id,
                lastSeen: new Date().toISOString(),
              };
            }
            return p;
          });

          await session.update({ participants: updatedParticipants });
          currentParticipants = updatedParticipants;
        } else {
          console.log(
            `⚠️ Participant ${participantId} non trouvé, création d'un nouveau`
          );
          finalParticipantId = null; // Forcer la création d'un nouveau
        }
      }

      if (!isReconnection) {
        // Nouveau participant - vérifications habituelles
        const maxParticipants = session.settings?.maxParticipants || 100;
        if (currentParticipants.length >= maxParticipants) {
          console.log(
            `❌ Session pleine: ${currentParticipants.length}/${maxParticipants}`
          );
          return socket.emit("error", {
            message: "Session complète",
            code: "SESSION_FULL",
            current: currentParticipants.length,
            max: maxParticipants,
          });
        }

        // Vérification du nom unique
        const existingParticipant = currentParticipants.find(
          (p) =>
            p &&
            p.name &&
            p.name.toLowerCase() === cleanParticipantName.toLowerCase()
        );

        if (existingParticipant) {
          console.log(`❌ Nom déjà pris: "${cleanParticipantName}"`);
          return socket.emit("error", {
            message: "Ce nom est déjà pris dans cette session",
            code: "NAME_TAKEN",
            suggestedName: `${cleanParticipantName}_${Date.now()
              .toString()
              .slice(-4)}`,
          });
        }

        // Création du nouveau participant
        finalParticipantId = `participant_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;

        const newParticipant = {
          id: finalParticipantId,
          name: cleanParticipantName,
          socketId: socket.id,
          userId: socket.user?.id || null,
          isAnonymous: Boolean(isAnonymous),
          joinedAt: new Date().toISOString(),
          isConnected: true,
          score: 0,
          responses: {},
          stats: {
            correctAnswers: 0,
            totalAnswers: 0,
            averageTime: 0,
          },
        };

        // Ajouter le participant
        const updatedParticipants = [...currentParticipants, newParticipant];
        await session.update({ participants: updatedParticipants });
        currentParticipants = updatedParticipants;

        console.log(`➕ Nouveau participant créé: ${finalParticipantId}`);
      }

      // Configuration du socket
      socket.sessionId = session.id;
      socket.participantId = finalParticipantId;
      socket.isParticipant = true;
      socket.join(`session_${session.id}`);

      // Réponse au participant
      const responseData = {
        sessionId: session.id,
        participantId: finalParticipantId,
        session: {
          id: session.id,
          code: session.code,
          title: session.title,
          status: session.status,
          currentQuestionIndex: session.currentQuestionIndex || -1,
          participantCount: currentParticipants.length,
          maxParticipants: session.settings?.maxParticipants || 100,
          host: session.host
            ? {
                name: session.host.firstName || session.host.username,
                username: session.host.username,
              }
            : null,
        },
        participant: {
          id: finalParticipantId,
          name: cleanParticipantName,
          isAnonymous: Boolean(isAnonymous),
          joinedAt: new Date().toISOString(),
        },
        quiz: session.quiz
          ? {
              id: session.quiz.id,
              title: session.quiz.title,
              questionCount: session.quiz.questions?.length || 0,
            }
          : null,
        isReconnection: isReconnection,
      };

      console.log(`📤 Envoi session_joined au participant`);
      socket.emit("session_joined", responseData);

      // Notifications aux autres participants et à l'hôte
      if (!isReconnection) {
        const hostNotification = {
          participantId: finalParticipantId,
          participantName: cleanParticipantName,
          totalParticipants: currentParticipants.length,
          participant: {
            id: finalParticipantId,
            name: cleanParticipantName,
            joinedAt: new Date().toISOString(),
            isConnected: true,
            score: 0,
          },
        };

        console.log(`📢 Notification à l'hôte: host_${session.id}`);
        io.to(`host_${session.id}`).emit(
          "participant_joined",
          hostNotification
        );
        socket
          .to(`session_${session.id}`)
          .emit("participant_joined", hostNotification);
      } else {
        // Notification de reconnexion
        const reconnectionNotification = {
          participantId: finalParticipantId,
          participantName: cleanParticipantName,
          totalParticipants: currentParticipants.length,
          isReconnection: true,
        };

        console.log(`🔄 Notification reconnexion à l'hôte`);
        io.to(`host_${session.id}`).emit(
          "participant_reconnected",
          reconnectionNotification
        );
      }

      console.log(`✅ === FIN handleJoinSession SUCCESS ===`);
      console.log(
        `   ${
          isReconnection ? "Reconnexion" : "Nouveau participant"
        }: "${cleanParticipantName}"`
      );
      console.log(`   Total participants: ${currentParticipants.length}\n`);
    } catch (error) {
      console.error(`💥 === ERREUR handleJoinSession ===`);
      console.error(`   Socket ID: ${socket.id}`);
      console.error(`   Error:`, error.message);
      console.error(`   Stack:`, error.stack);

      socket.emit("error", {
        message: "Erreur lors de la connexion à la session",
        code: "JOIN_SESSION_ERROR",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  // Handler: Quitter la session (SIMPLIFIÉ)
  async function handleLeaveSession() {
    const socket = this;
    console.log(`👋 Leave session demandé par ${socket.id}`);

    if (!socket.sessionId || !socket.participantId) {
      console.log(`   Pas de session/participant à quitter`);
      return;
    }

    try {
      const session = await Session.findByPk(socket.sessionId);
      if (session && Array.isArray(session.participants)) {
        const updatedParticipants = session.participants.filter(
          (p) => p.id !== socket.participantId
        );

        await session.update({ participants: updatedParticipants });

        // Notifier l'hôte
        io.to(`host_${socket.sessionId}`).emit("participant_left", {
          participantId: socket.participantId,
          totalParticipants: updatedParticipants.length,
        });

        console.log(
          `✅ Participant ${socket.participantId} retiré de la session`
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

  // Handler: Connexion hôte (SIMPLIFIÉ)
  async function handleHostSession(data) {
    const socket = this;

    try {
      console.log(
        `🎯 Host session demandé par ${socket.user?.username} pour session ${data?.sessionId}`
      );

      if (!socket.user) {
        return socket.emit("error", {
          message: "Authentification requise pour être hôte",
          code: "AUTH_REQUIRED",
        });
      }

      if (!data?.sessionId) {
        return socket.emit("error", {
          message: "ID de session requis",
          code: "MISSING_SESSION_ID",
        });
      }

      const session = await Session.findByPk(data.sessionId, {
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

      // Vérifier les permissions
      const isHost = session.hostId === socket.user.id;
      const isQuizOwner = session.quiz?.creatorId === socket.user.id;
      const isAdmin = socket.user.role === "admin";

      if (!isHost && !isQuizOwner && !isAdmin) {
        return socket.emit("error", {
          message: "Permission insuffisante",
          code: "INSUFFICIENT_PERMISSIONS",
        });
      }

      // Configurer le socket hôte
      socket.sessionId = session.id;
      socket.isHost = true;
      socket.join(`host_${session.id}`);
      socket.join(`session_${session.id}`);

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

  // Handler: Soumettre réponse (simplifié)
  async function handleSubmitResponse(data) {
    const socket = this;
    
    console.log(`🚀 === DÉBUT handleSubmitResponse ===`);
    console.log(`   Socket ID: ${socket.id}`);
    console.log(`   Participant ID: ${socket.participantId}`);
    console.log(`   Data reçue:`, data);
    
    if (!socket.participantId || !socket.sessionId) {
      const error = {
        message: "Participant ou session non identifié",
        code: "UNAUTHORIZED"
      };
      console.log(`❌ Non autorisé:`, error);
      return socket.emit("error", error);
    }
    
    const { questionId, answer, timeSpent } = data;
    
    if (!questionId || answer === undefined || answer === null) {
      const error = {
        message: "Données manquantes (questionId, answer requis)",
        code: "MISSING_DATA"
      };
      console.log(`❌ Données manquantes:`, error);
      return socket.emit("error", error);
    }
    
    try {
      // Récupérer la session avec le quiz
      const session = await Session.findByPk(socket.sessionId, {
        include: [{ model: Quiz, as: "quiz" }],
      });
      
      if (!session) {
        const error = {
          message: "Session non trouvée",
          code: "SESSION_NOT_FOUND"
        };
        console.log(`❌ Session non trouvée:`, error);
        return socket.emit("error", error);
      }
      
      // Vérifier que la session est active
      if (session.status !== "active") {
        const error = {
          message: "La session n'est pas active",
          code: "SESSION_NOT_ACTIVE",
          currentStatus: session.status
        };
        console.log(`❌ Session non active:`, error);
        return socket.emit("error", error);
      }
      
      const questions = session.quiz?.questions || [];
      const questionIndex = session.currentQuestionIndex || 0;
      
      if (questionIndex >= questions.length) {
        const error = {
          message: "Index de question invalide",
          code: "INVALID_QUESTION_INDEX",
          questionIndex,
          totalQuestions: questions.length
        };
        console.log(`❌ Index question invalide:`, error);
        return socket.emit("error", error);
      }
      
      const question = questions[questionIndex];
      const actualQuestionId = `q_${questionIndex}`;
      
      console.log(`✅ Question trouvée à l'index ${questionIndex}:`);
      console.log(`   Question: "${question.question}"`);
      console.log(`   Type: ${question.type}`);
      console.log(`   ID généré: ${actualQuestionId}`);
      console.log(`   Options:`, question.options);
      console.log(`   Réponse correcte:`, question.correctAnswer);
      
      // Vérifier correspondance questionId
      if (questionId !== actualQuestionId && questionId !== questionIndex.toString() && questionId !== questionIndex) {
        const error = {
          message: "Question ID ne correspond pas à la question courante",
          code: "QUESTION_MISMATCH",
          receivedQuestionId: questionId,
          expectedQuestionId: actualQuestionId,
          currentQuestionIndex: questionIndex
        };
        console.log(`❌ Question ID mismatch:`, error);
        return socket.emit("error", error);
      }
      
      // Vérifier si le participant a déjà répondu (STRUCTURE TABLEAU)
      const responses = session.responses || {};
      console.log(`🔍 Vérification des réponses existantes pour question ${actualQuestionId}...`);
      console.log(`   Structure responses:`, typeof responses, Object.keys(responses));
      
      // Initialiser le tableau pour cette question si nécessaire
      if (!Array.isArray(responses[actualQuestionId])) {
        responses[actualQuestionId] = [];
        console.log(`📋 Initialisation tableau réponses pour ${actualQuestionId}`);
      }
      
      // Vérifier si le participant a déjà répondu (dans le tableau)
      const existingResponse = responses[actualQuestionId].find(
        (r) => r.participantId === socket.participantId
      );
      
      if (existingResponse) {
        const error = {
          message: "Vous avez déjà répondu à cette question",
          code: "ALREADY_ANSWERED"
        };
        console.log(`❌ Déjà répondu:`, error);
        return socket.emit("error", error);
      }
      
      // CORRECTION PRINCIPALE: Calculer le score avec logique améliorée
      console.log(`🧮 Calcul du score amélioré...`);
    let isCorrect = false;
    let points = 0;
    
    console.log(`   Réponse reçue: "${answer}" (type: ${typeof answer})`);
    
    // if (question.type === "qcm") {
    //   console.log(`   Type QCM - Options:`, question.options);
      
    //   // Cas 1: Réponse correcte définie directement
    //   if (question.correctAnswer !== undefined && question.correctAnswer !== null) {
    //     // Comparaison directe avec la réponse correcte
    //     isCorrect = String(question.correctAnswer) === String(answer);
    //     console.log(`   Comparaison directe: ${question.correctAnswer} === ${answer} => ${isCorrect}`);
    //   }
    //   // Cas 2: Options avec flag isCorrect (CAS PRINCIPAL)
    //   else if (Array.isArray(question.options)) {
    //     const correctOptions = question.options.filter(opt => opt.isCorrect === true);
    //     console.log(`   Options correctes trouvées:`, correctOptions.length);
        
    //     if (correctOptions.length > 0) {
    //       // CORRECTION PRINCIPALE: Gérer les différents formats de réponse
    //       const answerIndex = parseInt(answer); // Si answer est un index
    //       const answerText = String(answer); // Si answer est du texte
          
    //       console.log(`   Answer index: ${answerIndex}, Answer text: "${answerText}"`);
          
    //       // Vérifier si la réponse correspond à une option correcte
    //       isCorrect = correctOptions.some((opt, correctIndex) => {
    //         const optionIndex = question.options.indexOf(opt);
    //         console.log(`   Checking option "${opt.text}" at index ${optionIndex}`);
            
    //         const matches = (
    //           // Comparaison par index (answer = 0, 1, 2, 3...)
    //           optionIndex === answerIndex ||
    //           // Comparaison par texte
    //           opt.text === answerText ||
    //           opt.text.toLowerCase().trim() === answerText.toLowerCase().trim() ||
    //           // Comparaison par ID si présent
    //           opt.id === answer ||
    //           String(opt.id) === answerText
    //         );
            
    //         if (matches) {
    //           console.log(`   ✅ Match trouvé avec option: "${opt.text}" à l'index ${optionIndex}`);
    //         }
    //         return matches;
    //       });
          
    //       console.log(`   Résultat final QCM: ${isCorrect}`);
    //     }
    //   }
      
    //   // FALLBACK: Si pas de correctAnswer et pas d'options avec isCorrect
    //   if (!isCorrect && question.options && !question.correctAnswer) {
    //     console.log(`   ⚠️ FALLBACK: Tentative de détection automatique de la bonne réponse`);
    //     // Dans ce cas, on ne peut pas déterminer la bonne réponse
    //     // Il faudrait que le quiz soit configuré correctement
    //   }
    // } 
    if (question.type === "qcm") {
      console.log(`   Type QCM - Options:`, question.options);
      const correctOptions = question.options?.filter(opt => opt.isCorrect) || [];
      
      if (correctOptions.length === 0 && question.correctAnswer !== undefined) {
        isCorrect = String(question.correctAnswer) === String(answer);
      } else if (Array.isArray(question.options)) {
        const answerIndex = parseInt(answer);
        
        // CORRECTION: Vérifier si answer est un index valide
        if (!isNaN(answerIndex) && answerIndex >= 0 && answerIndex < question.options.length) {
          // Réponse par index
          isCorrect = question.options[answerIndex].isCorrect === true;
          console.log(`   Réponse par index ${answerIndex}: ${question.options[answerIndex].text} → ${isCorrect}`);
        } else {
          // Réponse par texte ou ID
          isCorrect = correctOptions.some(opt => 
            opt.text === answer || 
            opt.id === answer ||
            opt.text.toLowerCase().trim() === String(answer).toLowerCase().trim()
          );
          console.log(`   Réponse par texte/ID: ${answer} → ${isCorrect}`);
        }
      }
    }
    else if (question.type === "vrai_faux" || question.type === "vraifaux") {
      console.log(`   Type Vrai/Faux - Réponse correcte: ${question.correctAnswer}`);
      console.log(`   Réponse reçue: ${answer} (type: ${typeof answer})`);
      
      // CORRECTION: Gérer tous les formats possibles
      let normalizedAnswer;
      let normalizedCorrect;
      
      // 1. Si la réponse est un index (0 = Vrai, 1 = Faux)
      if (typeof answer === 'number' || !isNaN(parseInt(answer))) {
        const answerIndex = parseInt(answer);
        normalizedAnswer = answerIndex === 0 ? "vrai" : "faux";
        console.log(`   Réponse par index ${answerIndex} → "${normalizedAnswer}"`);
      } else {
        // 2. Si la réponse est du texte
        normalizedAnswer = String(answer).toLowerCase().trim();
        console.log(`   Réponse par texte → "${normalizedAnswer}"`);
      }
      
      // Normaliser la réponse correcte
      if (typeof question.correctAnswer === 'boolean') {
        normalizedCorrect = question.correctAnswer ? "vrai" : "faux";
      } else if (typeof question.correctAnswer === 'number') {
        normalizedCorrect = question.correctAnswer === 0 ? "vrai" : "faux";
      } else {
        normalizedCorrect = String(question.correctAnswer).toLowerCase().trim();
      }
      
      console.log(`   Réponse correcte normalisée → "${normalizedCorrect}"`);
      
      // 3. Comparaison avec toutes les variantes possibles
      isCorrect = (
        normalizedAnswer === normalizedCorrect ||
        // Variantes en français
        (normalizedAnswer === "vrai" && ["true", "vrai", "1", "0"].includes(normalizedCorrect)) ||
        (normalizedAnswer === "faux" && ["false", "faux", "0", "1"].includes(normalizedCorrect)) ||
        // Variantes en anglais
        (normalizedAnswer === "true" && ["true", "vrai", "1", "0"].includes(normalizedCorrect)) ||
        (normalizedAnswer === "false" && ["false", "faux", "0", "1"].includes(normalizedCorrect)) ||
        // Gestion spéciale selon la logique du quiz
        (normalizedAnswer === "vrai" && normalizedCorrect === "0") ||  // 0 = Vrai
        (normalizedAnswer === "faux" && normalizedCorrect === "1")     // 1 = Faux
      );
      
      console.log(`   Résultat comparaison: "${normalizedAnswer}" vs "${normalizedCorrect}" → ${isCorrect}`);
    }
    else if (question.type === "reponse_libre" || question.type === "text") {
      console.log(`   Type Réponse libre - Réponse correcte: "${question.correctAnswer}"`);
      if (question.correctAnswer) {
        // Comparaison flexible pour les réponses libres
        const userAnswer = String(answer).toLowerCase().trim();
        const correctAnswer = String(question.correctAnswer).toLowerCase().trim();
        
        // Comparaison exacte ou partielle selon les paramètres de la question
        if (question.exactMatch === false || question.partialMatch === true) {
          isCorrect = correctAnswer.includes(userAnswer) || userAnswer.includes(correctAnswer);
        } else {
          isCorrect = userAnswer === correctAnswer;
        }
        
        console.log(`   Comparaison flexible: "${userAnswer}" vs "${correctAnswer}" => ${isCorrect}`);
      }
    }
    
    points = isCorrect ? (question.points || 1) : 0;
    
    console.log(`   🎯 Résultat final: ${isCorrect ? 'CORRECT' : 'INCORRECT'} (${points} points)`);

    console.log(`💾 Utilisation de session.addResponse()...`);
      
    const responseDataForModel = {
      questionId: actualQuestionId,
      participantId: socket.participantId,
      answer,
      timeSpent: timeSpent || 0,
      points,
      isCorrect,
      submittedAt: new Date(),
    };
    
    console.log(`📝 Données pour addResponse:`, responseDataForModel);
    
    try {
      // Cette méthode va :
      // 1. Ajouter la réponse au tableau responses
      // 2. Mettre à jour les stats du participant 
      // 3. Recalculer les stats de session
      // 4. Sauvegarder en base de données
      await session.addResponse(responseDataForModel);
      
      console.log(`✅ session.addResponse() terminé avec succès`);
      
      // Recharger la session pour avoir les données à jour
      await session.reload();
      
    } catch (addResponseError) {
      console.error(`❌ Erreur dans session.addResponse():`, addResponseError.message);
      
      // Fallback : sauvegarde manuelle comme avant
      console.log(`🔄 Fallback - sauvegarde manuelle...`);
      
      const responses = session.responses || {};
      if (!Array.isArray(responses[actualQuestionId])) {
        responses[actualQuestionId] = [];
      }
      responses[actualQuestionId].push({
        participantId: socket.participantId,
        answer,
        timeSpent: timeSpent || 0,
        points,
        isCorrect,
        submittedAt: new Date(),
      });
      
      const participants = Array.isArray(session.participants) ? session.participants : [];
      const participantIndex = participants.findIndex(p => p.id === socket.participantId);
      
      if (participantIndex !== -1) {
        participants[participantIndex].score = (participants[participantIndex].score || 0) + points;
        participants[participantIndex].totalQuestions = (participants[participantIndex].totalQuestions || 0) + 1;
        participants[participantIndex].correctAnswers = (participants[participantIndex].correctAnswers || 0) + (isCorrect ? 1 : 0);
      }
      
      const updatedStats = calculateSessionStats({ participants, responses });
      await session.update({ participants, responses, stats: updatedStats });
    }
    
    // Récupérer les participants mis à jour
    const participants = Array.isArray(session.participants) ? session.participants : [];
    const participantIndex = participants.findIndex(p => p.id === socket.participantId);
    const updatedParticipant = participantIndex !== -1 ? participants[participantIndex] : null;
      
      console.log(`✅ Session mise à jour avec succès`);
      
      // ✅ CONFIRMATION AVEC DONNÉES MISES À JOUR
      const confirmationData = {
        success: true,
        questionId: actualQuestionId,
        answer,
        points,
        isCorrect,
        totalScore: updatedParticipant?.score || 0,
        correctAnswers: updatedParticipant?.correctAnswers || 0,
        totalQuestions: updatedParticipant?.totalQuestions || 0,
        message: isCorrect ? "Bonne réponse !" : "Réponse incorrecte"
      };
      
      console.log(`📤 Envoi de confirmation avec stats mises à jour:`, confirmationData);
      socket.emit("response_submitted", confirmationData);
      
      // Notifier l'hôte avec les stats mises à jour
      const currentResponses = session.responses || {};
      const currentQuestionResponses = currentResponses[actualQuestionId] || [];
      
      const hostNotification = {
        participantId: socket.participantId,
        participantName: updatedParticipant?.name || "Participant",
        questionId: actualQuestionId,
        answer,
        points,
        isCorrect,
        timeSpent,
        totalResponses: currentQuestionResponses.length,
        sessionStats: session.stats || {},
        participantStats: {
          score: updatedParticipant?.score || 0,
          correctAnswers: updatedParticipant?.correctAnswers || 0,
          totalQuestions: updatedParticipant?.totalQuestions || 0,
        }
      };
      
      console.log(`📤 Notification à l'hôte avec stats complètes:`, hostNotification);
      io.to(`host_${session.id}`).emit("new_response", hostNotification);
      
      console.log(`✅ === FIN handleSubmitResponse SUCCESS ===\n`);
      
    } catch (error) {
      console.error(`💥 === ERREUR handleSubmitResponse ===`);
      console.error(`   Socket ID: ${socket.id}`);
      console.error(`   Participant ID: ${socket.participantId}`);
      console.error(`   Error name: ${error.name}`);
      console.error(`   Error message: ${error.message}`);
      console.error(`   Stack:`, error.stack);
      
      const errorResponse = {
        message: "Erreur lors de la soumission",
        code: "SUBMISSION_ERROR",
        details: process.env.NODE_ENV === "development" ? error.message : "Erreur serveur"
      };
      
      console.log(`📤 Envoi erreur:`, errorResponse);
      socket.emit("error", errorResponse);
      
      console.log(`❌ === FIN handleSubmitResponse ERROR ===\n`);
    }
  }

  // Handlers simples
  async function handleParticipantReady() {
    const socket = this;
    if (!socket.isParticipant || !socket.sessionId) return;

    io.to(`host_${socket.sessionId}`).emit("participant_ready", {
      participantId: socket.participantId,
    });
  }

  async function handleParticipantHeartbeat() {
    const socket = this;
    if (!socket.isParticipant || !socket.sessionId) return;

    try {
      const session = await Session.findByPk(socket.sessionId);
      if (session && Array.isArray(session.participants)) {
        const participants = session.participants.map((p) => {
          if (p.id === socket.participantId) {
            return { ...p, isConnected: true, lastSeen: new Date() };
          }
          return p;
        });

        await session.update({ participants });
      }
    } catch (error) {
      console.error("Erreur heartbeat:", error);
    }
  }

  async function handleSendMessage(data) {
    const socket = this;
    if (!socket.sessionId || !data?.message?.trim()) return;

    const chatMessage = {
      id: Date.now(),
      participantId: socket.participantId || null,
      participantName:
        socket.user?.username || socket.participantName || "Anonyme",
      message: data.message.trim(),
      timestamp: new Date(),
      isHost: socket.isHost || false,
    };

    io.to(`session_${socket.sessionId}`).emit("new_message", chatMessage);
  }

  // Handler: Déconnexion avec nettoyage complet
  async function handleDisconnect(reason) {
    const socket = this;
    console.log(`🔌 Déconnexion: ${socket.id} - Raison: ${reason}`);

    if (socket.sessionId && socket.isParticipant && socket.participantId) {
      try {
        const session = await Session.findByPk(socket.sessionId);
        if (session && Array.isArray(session.participants)) {
          const updatedParticipants = session.participants.map((p) => {
            if (p.id === socket.participantId) {
              return { ...p, isConnected: false, lastSeen: new Date() };
            }
            return p;
          });

          await session.update({ participants: updatedParticipants });

          // Notifier l'hôte
          io.to(`host_${socket.sessionId}`).emit("participant_disconnected", {
            participantId: socket.participantId,
            totalConnected: updatedParticipants.filter((p) => p.isConnected)
              .length,
          });
        }
      } catch (error) {
        console.error("Erreur lors de la déconnexion:", error);
      }
    }
  }

  const handleJoinSessionSocket = (socket, data) => {
    const { sessionId, participantId, participantName } = data;
  
    console.log("🔌 Connexion Socket participant:", data);
  
    if (!sessionId || !participantId) {
      socket.emit("error", {
        message: "Données de session manquantes",
        code: "MISSING_SESSION_DATA",
      });
      return;
    }
  
    // Rejoindre la room de la session
    socket.join(`session_${sessionId}`);
  
    // Stocker les infos dans le socket
    socket.sessionId = sessionId;
    socket.participantId = participantId;
    socket.participantName = participantName;
    socket.role = "participant";
  
    // Confirmer la connexion
    socket.emit("session_socket_connected", {
      sessionId,
      participantId,
      participantName,
      socketId: socket.id,
    });
  
    // Notifier les autres participants et l'hôte
    socket.to(`session_${sessionId}`).emit("participant_socket_connected", {
      sessionId,
      participantId,
      participantName,
      socketId: socket.id,
    });
  
    console.log(
      `✅ Participant ${participantName} connecté à la session ${sessionId}`
    );
  };
  
  
  async function handleStartSession() {
    const socket = this;
    console.log(`\n🚀 === DÉMARRAGE SESSION ===`);
    console.log(`   Socket ID: ${socket.id}`);
    console.log(`   Is Host: ${socket.isHost}`);
    console.log(`   Session ID: ${socket.sessionId}`);
    
    if (!socket.isHost || !socket.sessionId) {
      console.log(`❌ Permission insuffisante pour démarrage`);
      return socket.emit("error", { message: "Permission insuffisante" });
    }
  
    try {
      const session = await Session.findByPk(socket.sessionId, {
        include: [{ model: Quiz, as: "quiz" }],
      });
  
      if (!session || session.status !== "waiting") {
        console.log(`❌ Impossible de démarrer: session ${session?.status || 'non trouvée'}`);
        return socket.emit("error", {
          message: "Impossible de démarrer cette session",
        });
      }
  
      const participants = Array.isArray(session.participants)
        ? session.participants
        : [];
  
      if (participants.length === 0) {
        console.log(`❌ Aucun participant pour démarrer`);
        return socket.emit("error", {
          message: "Au moins un participant est requis",
        });
      }
  
      console.log(`📋 Démarrage session ${session.code}:`);
      console.log(`   Participants: ${participants.length}`);
      console.log(`   Questions: ${session.quiz?.questions?.length || 0}`);
  
      await session.update({
        status: "active",
        startedAt: new Date(),
        currentQuestionIndex: 0,
        currentQuestionStartedAt: new Date(),
      });
  
      // DÉMARRER LE TIMER POUR LA PREMIÈRE QUESTION
      const firstQuestion = session.quiz?.questions?.[0];
      console.log(`🔍 Première question:`, {
        exists: !!firstQuestion,
        question: firstQuestion?.question?.substring(0, 50),
        timeLimit: firstQuestion?.timeLimit,
        type: firstQuestion?.type
      });
  
      if (firstQuestion && firstQuestion.timeLimit) {
        console.log(`⏰ === CONFIGURATION TIMER PREMIÈRE QUESTION ===`);
        console.log(`   Question: "${firstQuestion.question?.substring(0, 50)}..."`);
        console.log(`   Durée: ${firstQuestion.timeLimit}s`);
        
        startQuestionTimer(session.id, 0, firstQuestion.timeLimit);
      } else {
        console.log(`⏰ Pas de timer pour la première question`);
        debugTimer(session.id, "NO_TIMER_FIRST_QUESTION", {
          hasQuestion: !!firstQuestion,
          timeLimit: firstQuestion?.timeLimit
        });
      }
  
      // Notifier tous les participants
      io.to(`session_${session.id}`).emit("session_started", {
        sessionId: session.id,
        currentQuestionIndex: 0,
        startedAt: new Date(),
      });
  
      console.log(`✅ Session ${session.code} démarrée avec succès`);
      console.log(`   Timer actif: ${activeQuestionTimers.has(session.id)}`);
      console.log(`=== FIN DÉMARRAGE SESSION ===\n`);
      
    } catch (error) {
      console.error(`💥 Erreur lors du démarrage:`, error);
      debugTimer(socket.sessionId, "START_SESSION_ERROR", { error: error.message });
      socket.emit("error", { message: "Erreur lors du démarrage" });
    }
  }
  
  function debugAllTimers() {
    console.log(`\n📊 === ÉTAT DES TIMERS ===`);
    console.log(`   Timers actifs: ${activeQuestionTimers.size}`);
    
    for (const [sessionId, timerId] of activeQuestionTimers.entries()) {
      console.log(`   - Session ${sessionId}: Timer ${timerId}`);
      
      if (timerDebugInfo.has(sessionId)) {
        const history = timerDebugInfo.get(sessionId).slice(-3); // 3 dernières actions
        console.log(`     Historique:`, history.map(h => `${h.action}(${h.timestamp})`).join(', '));
      }
    }
    console.log(`=== FIN ÉTAT TIMERS ===\n`);
  }

  global.debugAllTimers = debugAllTimers;
  global.debugTimer = debugTimer;
  global.activeQuestionTimers = activeQuestionTimers;

  // Appeler le debug toutes les 30 secondes en mode développement
if (process.env.NODE_ENV === "development") {

  setInterval(debugAllTimers, 30000);
}
};


// Nettoyage des timers à la déconnexion
const originalHandleDisconnect = handleDisconnect;
function handleDisconnect() {
  const socket = this;
  
  // Si c'est l'hôte qui se déconnecte, arrêter le timer
  if (socket.isHost && socket.sessionId) {
    stopQuestionTimer(socket.sessionId);
    console.log(`🔌 Hôte déconnecté, timer arrêté pour session ${socket.sessionId}`);
  }
  
  // Appeler le handler original
  if (originalHandleDisconnect) {
    originalHandleDisconnect.call(this);
  }
}

module.exports = socketHandlers;
