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
        
        if (questionIndex >= totalQuestions - 1) {
          // Dernière question : terminer la session
          console.log(`🏁 === DERNIÈRE QUESTION TERMINÉE ===`);
          console.log(`   Fin automatique de session ${sessionId}`);
          
          debugTimer(sessionId, "AUTO_END_SESSION", { questionIndex, totalQuestions });
          
          await session.update({ 
            status: "finished", 
            endedAt: new Date() 
          });
  
          console.log(`📢 Notification fin de session automatique`);
          
          // Notifier tous les participants
          io.to(`session_${sessionId}`).emit("session_ended", {
            sessionId,
            finalStats: session.stats || {},
            message: "Session terminée automatiquement",
            autoEnded: true
          });
  
          // Notifier l'hôte spécifiquement
          io.to(`host_${sessionId}`).emit("session_ended", {
            sessionId,
            finalStats: session.stats || {},
            message: "Session terminée automatiquement",
            autoEnded: true,
            isHost: true
          });
  
          console.log(`✅ Session ${sessionId} terminée automatiquement`);
  
        } else {
          // Passer à la question suivante
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
            autoAdvanced: true // Indiquer que c'est un passage automatique
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
      stopQuestionTimer(socket.sessionId);
  
      const session = await Session.findByPk(socket.sessionId);
      if (!session) {
        return socket.emit("error", { message: "Session non trouvée" });
      }
  
      // ... reste du code endSession existant
  
      console.log(`🏁 Session ${session.code} terminée manuellement`);
    } catch (error) {
      console.error("Erreur fin de session:", error);
      socket.emit("error", { message: "Erreur lors de la fin de session" });
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
    
    console.log(`\n📝 === DEBUT handleSubmitResponse ===`);
    console.log(`   Socket ID: ${socket.id}`);
    console.log(`   Socket isParticipant: ${socket.isParticipant}`);
    console.log(`   Socket sessionId: ${socket.sessionId}`);
    console.log(`   Socket participantId: ${socket.participantId}`);
    console.log(`   Data reçue RAW:`, JSON.stringify(data, null, 2));
  
    // Validation des permissions
    if (!socket.isParticipant || !socket.sessionId || !socket.participantId) {
      const error = {
        message: "Vous devez être participant à une session",
        code: "PERMISSION_DENIED",
        details: {
          isParticipant: socket.isParticipant,
          sessionId: socket.sessionId,
          participantId: socket.participantId
        }
      };
      console.log(`❌ Permission refusée:`, error);
      return socket.emit("error", error);
    }
  
    // EXTRACTION DES DONNÉES
    let questionId, answer, timeSpent, sessionId;
  
    questionId = data.questionId;
    answer = data.answer;
    timeSpent = data.timeSpent;
    sessionId = data.sessionId;
  
    console.log(`🔍 Extraction données:`);
    console.log(`   questionId: ${questionId} (type: ${typeof questionId})`);
    console.log(`   answer: ${answer} (type: ${typeof answer})`);
    console.log(`   timeSpent: ${timeSpent} (type: ${typeof timeSpent})`);
  
    // VALIDATION
    if (questionId === undefined || questionId === null) {
      const error = {
        message: "questionId est requis",
        code: "INVALID_DATA",
        field: "questionId",
        received: data
      };
      console.log(`❌ questionId manquant:`, error);
      return socket.emit("error", error);
    }
  
    if (answer === undefined || answer === null) {
      const error = {
        message: "answer est requis",
        code: "INVALID_DATA", 
        field: "answer",
        received: data
      };
      console.log(`❌ answer manquant:`, error);
      return socket.emit("error", error);
    }
  
    try {
      console.log(`🔍 Recherche de la session ${socket.sessionId}...`);
      
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
  
      console.log(`✅ Session trouvée: ${session.code} (status: ${session.status})`);
  
      if (session.status !== "active") {
        const error = {
          message: "Session non active",
          code: "SESSION_NOT_ACTIVE",
          currentStatus: session.status
        };
        console.log(`❌ Session non active:`, error);
        return socket.emit("error", error);
      }
  
      // Récupération de la question courante
      console.log(`🔍 Récupération de la question courante...`);
      console.log(`   Quiz ID: ${session.quiz?.id}`);
      console.log(`   Nombre de questions: ${session.quiz?.questions?.length || 0}`);
      console.log(`   Index question courante: ${session.currentQuestionIndex}`);
  
      const questionIndex = session.currentQuestionIndex;
      
      if (questionIndex === undefined || questionIndex === null) {
        const error = {
          message: "Aucune question active dans la session",
          code: "NO_ACTIVE_QUESTION"
        };
        console.log(`❌ Pas de question active:`, error);
        return socket.emit("error", error);
      }
  
      const questions = session.quiz?.questions || [];
      
      if (questionIndex < 0 || questionIndex >= questions.length) {
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
  
      // CORRECTION PRINCIPALE: Vérifier si le participant a déjà répondu (STRUCTURE TABLEAU)
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
  
      // Calculer le score
      console.log(`🧮 Calcul du score...`);
      let isCorrect = false;
      let points = 0;
  
      if (question.type === "qcm") {
        console.log(`   Type QCM - Options:`, question.options);
        const correctOptions = question.options?.filter(opt => opt.isCorrect) || [];
        
        if (correctOptions.length === 0 && question.correctAnswer !== undefined) {
          isCorrect = question.correctAnswer == answer;
          console.log(`   Comparaison avec correctAnswer: ${question.correctAnswer} == ${answer} => ${isCorrect}`);
        } else {
          isCorrect = correctOptions.some(opt => 
            opt.text === answer || 
            opt.id === answer || 
            correctOptions.indexOf(opt) === parseInt(answer)
          );
          console.log(`   Comparaison avec options correctes: ${isCorrect}`);
        }
      } else if (question.type === "vrai_faux") {
        console.log(`   Type Vrai/Faux - Réponse correcte: ${question.correctAnswer}`);
        isCorrect = question.correctAnswer == answer;
      } else if (question.type === "reponse_libre") {
        console.log(`   Type Réponse libre - Réponse correcte: ${question.correctAnswer}`);
        isCorrect =
          question.correctAnswer &&
          answer.toLowerCase().trim() ===
            question.correctAnswer.toLowerCase().trim();
      }
  
      points = isCorrect ? (question.points || 1) : 0;
      
      console.log(`   Résultat: ${isCorrect ? 'Correct' : 'Incorrect'} (${points} points)`);
  
      // CORRECTION: Créer la réponse et l'ajouter au TABLEAU
      const responseData = {
        participantId: socket.participantId,
        answer,
        timeSpent: timeSpent || 0,
        points,
        isCorrect,
        submittedAt: new Date(),
      };
  
      console.log(`💾 Ajout de la réponse au tableau...`);
      console.log(`   Réponse à ajouter:`, responseData);
      
      // CORRECTION: Ajouter au tableau au lieu d'un objet
      responses[actualQuestionId].push(responseData);
      
      console.log(`   Nouveau tableau réponses pour ${actualQuestionId}:`, responses[actualQuestionId].length, "réponses");
  
      // Mettre à jour le score du participant
      const participants = Array.isArray(session.participants)
        ? session.participants
        : [];
  
      const participantIndex = participants.findIndex(
        (p) => p.id === socket.participantId
      );
      
      if (participantIndex !== -1) {
        if (!participants[participantIndex].responses) {
          participants[participantIndex].responses = {};
        }
        participants[participantIndex].responses[actualQuestionId] = responseData;
        participants[participantIndex].score =
          (participants[participantIndex].score || 0) + points;
          
        console.log(`   Score participant mis à jour: ${participants[participantIndex].score}`);
      }
  
      // CORRECTION: Sauvegarder avec la structure tableau
      console.log(`💾 Sauvegarde en base de données...`);
      await session.update({ participants, responses });
  
      console.log(`✅ Session mise à jour avec succès`);
  
      // Confirmer au participant
      const confirmationData = {
        success: true,
        questionId: actualQuestionId,
        answer,
        points,
        isCorrect,
        message: "Réponse enregistrée avec succès"
      };
      
      console.log(`📤 Envoi de confirmation:`, confirmationData);
      socket.emit("response_submitted", confirmationData);
  
      // Notifier l'hôte
      const hostNotification = {
        participantId: socket.participantId,
        participantName: participants[participantIndex]?.name || "Participant",
        questionId: actualQuestionId,
        answer,
        points,
        isCorrect,
        timeSpent,
        totalResponses: responses[actualQuestionId].length, // CORRECTION: longueur du tableau
      };
      
      console.log(`📤 Notification à l'hôte:`, hostNotification);
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
        details: process.env.NODE_ENV === "development" ? error.message : undefined
      };
  
      socket.emit("error", errorResponse);
      console.log(`📝 === FIN handleSubmitResponse ERROR ===\n`);
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
