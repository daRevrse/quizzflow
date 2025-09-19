// Socket Handlers avec validation corrigée - backend/socket/socketHandlers.js

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

  // Handler: Rejoindre une session (CORRIGÉ AVEC LOGS DÉTAILLÉS)
  // async function handleJoinSession(data) {
  //   const socket = this;

  //   try {
  //     console.log(`\n🎯 === DEBUT handleJoinSession ===`);
  //     console.log(`   Socket ID: ${socket.id}`);
  //     console.log(`   User: ${socket.user ? socket.user.username : "anonyme"}`);
  //     console.log(`   Data reçue:`, JSON.stringify(data, null, 2));

  //     // Validation des données reçues - PLUS TOLÉRANTE
  //     if (!data) {
  //       console.log(`❌ Pas de données reçues`);
  //       return socket.emit("error", {
  //         message: "Aucune donnée reçue",
  //         code: "NO_DATA_RECEIVED",
  //       });
  //     }

  //     const { sessionCode, participantName, isAnonymous } = data;

  //     console.log(`   Extraction:`, {
  //       sessionCode: sessionCode,
  //       participantName: participantName,
  //       isAnonymous: isAnonymous,
  //     });

  //     // Validation plus flexible
  //     if (
  //       !sessionCode ||
  //       typeof sessionCode !== "string" ||
  //       sessionCode.trim().length === 0
  //     ) {
  //       console.log(`❌ sessionCode invalide:`, sessionCode);
  //       return socket.emit("error", {
  //         message: "Code de session requis",
  //         code: "MISSING_SESSION_CODE",
  //         received: { sessionCode, participantName, isAnonymous },
  //       });
  //     }

  //     if (
  //       !participantName ||
  //       typeof participantName !== "string" ||
  //       participantName.trim().length === 0
  //     ) {
  //       console.log(`❌ participantName invalide:`, participantName);
  //       return socket.emit("error", {
  //         message: "Nom de participant requis",
  //         code: "MISSING_PARTICIPANT_NAME",
  //         received: { sessionCode, participantName, isAnonymous },
  //       });
  //     }

  //     const cleanSessionCode = sessionCode.trim().toUpperCase();
  //     const cleanParticipantName = participantName.trim();

  //     console.log(`   Données nettoyées:`, {
  //       cleanSessionCode,
  //       cleanParticipantName,
  //       isAnonymous: Boolean(isAnonymous),
  //     });

  //     // Chercher la session dans la base de données
  //     console.log(`🔍 Recherche session avec code: "${cleanSessionCode}"`);

  //     const session = await Session.findOne({
  //       where: {
  //         code: cleanSessionCode,
  //         status: ["waiting", "active"],
  //       },
  //       include: [
  //         {
  //           model: Quiz,
  //           as: "quiz",
  //           attributes: ["id", "title", "questions"],
  //         },
  //         {
  //           model: User,
  //           as: "host",
  //           attributes: ["id", "username", "firstName", "lastName"],
  //         },
  //       ],
  //     });

  //     if (!session) {
  //       console.log(
  //         `❌ Session non trouvée pour le code: "${cleanSessionCode}"`
  //       );
  //       return socket.emit("error", {
  //         message: "Session non trouvée ou terminée",
  //         code: "SESSION_NOT_FOUND",
  //         searchedCode: cleanSessionCode,
  //       });
  //     }

  //     console.log(`✅ Session trouvée:`, {
  //       id: session.id,
  //       code: session.code,
  //       title: session.title,
  //       status: session.status,
  //       currentParticipants: session.participants?.length || 0,
  //     });

  //     // Vérifications de session
  //     if (session.status !== "waiting" && session.status !== "active") {
  //       console.log(`❌ Session dans un état invalide: ${session.status}`);
  //       return socket.emit("error", {
  //         message: "Cette session n'est plus accessible",
  //         code: "SESSION_INVALID_STATUS",
  //         status: session.status,
  //       });
  //     }

  //     if (session.status === "active" && !session.settings?.allowLateJoin) {
  //       console.log(`❌ Rejointe tardive interdite`);
  //       return socket.emit("error", {
  //         message: "Cette session n'accepte plus de nouveaux participants",
  //         code: "LATE_JOIN_DISABLED",
  //       });
  //     }

  //     // Générer un ID participant unique
  //     const participantId = `participant_${socket.id}_${Date.now()}`;
  //     console.log(`👤 Création participant avec ID: ${participantId}`);

  //     // Créer l'objet participant
  //     const participant = {
  //       id: participantId,
  //       socketId: socket.id,
  //       name: cleanParticipantName,
  //       isAnonymous: Boolean(isAnonymous),
  //       userId: socket.user?.id || null,
  //       joinedAt: new Date(),
  //       isConnected: true,
  //       score: 0,
  //       responses: {},
  //     };

  //     console.log(`   Participant créé:`, participant);

  //     // Mettre à jour la session avec le nouveau participant
  //     const currentParticipants = Array.isArray(session.participants)
  //       ? session.participants
  //       : [];

  //     console.log(`   Participants actuels: ${currentParticipants.length}`);

  //     // Éviter les doublons par socket ID
  //     const filteredParticipants = currentParticipants.filter(
  //       (p) => p.socketId !== socket.id && p.id !== participantId
  //     );

  //     const updatedParticipants = [...filteredParticipants, participant];

  //     console.log(`   Participants après ajout: ${updatedParticipants.length}`);

  //     // Sauvegarder en base
  //     await session.update({
  //       participants: updatedParticipants,
  //     });

  //     console.log(`✅ Session mise à jour en base`);

  //     // Configurer le socket
  //     socket.sessionId = session.id;
  //     socket.participantId = participantId;
  //     socket.isParticipant = true;
  //     socket.join(`session_${session.id}`);

  //     console.log(`🏠 Socket ajouté à la room: session_${session.id}`);

  //     // Confirmer au participant
  //     const responseData = {
  //       sessionId: session.id,
  //       participantId: participantId,
  //       participantName: participant.name,
  //       sessionStatus: session.status,
  //       session: {
  //         id: session.id,
  //         code: session.code,
  //         title: session.title,
  //         status: session.status,
  //         currentQuestionIndex: session.currentQuestionIndex || 0,
  //       },
  //       quiz: session.quiz
  //         ? {
  //             id: session.quiz.id,
  //             title: session.quiz.title,
  //             questionCount: session.quiz.questions?.length || 0,
  //           }
  //         : null,
  //     };

  //     console.log(`📤 Envoi session_joined au participant`);
  //     socket.emit("session_joined", responseData);

  //     // Notifier l'hôte et autres participants
  //     const hostNotification = {
  //       participantId: participantId,
  //       participantName: participant.name,
  //       totalParticipants: updatedParticipants.length,
  //       participant: {
  //         id: participantId,
  //         name: participant.name,
  //         joinedAt: participant.joinedAt,
  //         isConnected: true,
  //         score: 0,
  //       },
  //     };

  //     console.log(`📢 Notification à l'hôte: host_${session.id}`);
  //     io.to(`host_${session.id}`).emit("participant_joined", hostNotification);

  //     // Notifier tous les participants de la session
  //     socket
  //       .to(`session_${session.id}`)
  //       .emit("participant_joined", hostNotification);

  //     console.log(`✅ === FIN handleJoinSession SUCCESS ===\n`);
  //     console.log(
  //       `   ${participant.name} a rejoint la session ${session.code}`
  //     );
  //     console.log(`   Total participants: ${updatedParticipants.length}`);
  //   } catch (error) {
  //     console.error(`💥 === ERREUR handleJoinSession ===`);
  //     console.error(`   Socket ID: ${socket.id}`);
  //     console.error(`   Error:`, error);
  //     console.error(`   Stack:`, error.stack);

  //     socket.emit("error", {
  //       message: "Erreur lors de la connexion à la session",
  //       code: "JOIN_SESSION_ERROR",
  //       details:
  //         process.env.NODE_ENV === "development" ? error.message : undefined,
  //     });
  //   }
  // }

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

      let sessionCode, participantName, isAnonymous;

      // 🔧 DÉTECTION DU FORMAT ET EXTRACTION FLEXIBLE
      if (data.sessionCode && data.participantName) {
        // Format attendu : { sessionCode, participantName, isAnonymous }
        console.log(`📋 Format standard détecté`);
        sessionCode = data.sessionCode;
        participantName = data.participantName;
        isAnonymous = data.isAnonymous;
      } else if (data.sessionId && data.participant) {
        // Format alternatif : { sessionId, participant: { name, ... } }
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
      } else {
        // Format non reconnu
        console.log(`❌ Format de données non reconnu:`, {
          hasSessionCode: !!data.sessionCode,
          hasParticipantName: !!data.participantName,
          hasSessionId: !!data.sessionId,
          hasParticipant: !!data.participant,
          availableKeys: Object.keys(data),
        });

        return socket.emit("error", {
          message: "Format de données non reconnu",
          code: "INVALID_DATA_FORMAT",
          expected:
            "{ sessionCode, participantName, isAnonymous } OU { sessionId, participant: { name } }",
          received: Object.keys(data),
          data: data,
        });
      }

      console.log(`📊 Données extraites:`, {
        sessionCode,
        participantName,
        isAnonymous: Boolean(isAnonymous),
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
      });

      // Recherche de la session (par code cette fois)
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
        rawParticipants: session.participants,
        participantsType: typeof session.participants,
        isArray: Array.isArray(session.participants),
      });

      // S'assurer que participants est un tableau
      let currentParticipants = session.participants;

      if (!Array.isArray(currentParticipants)) {
        console.log(`⚠️  Participants n'est pas un tableau, initialisation:`, {
          type: typeof currentParticipants,
          value: currentParticipants,
        });
        currentParticipants = [];
      }

      console.log(`✅ Participants array validé:`, {
        length: currentParticipants.length,
        isArray: Array.isArray(currentParticipants),
      });

      // Vérification de la capacité
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
      const participantId = `participant_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      const participant = {
        id: participantId,
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

      // Ajout du participant
      const updatedParticipants = [...currentParticipants, participant];

      // Sauvegarde
      await session.update({
        participants: updatedParticipants,
      });

      // Configuration du socket
      socket.sessionId = session.id;
      socket.participantId = participantId;
      socket.isParticipant = true;

      socket.join(`session_${session.id}`);

      // Réponse au participant
      const responseData = {
        sessionId: session.id,
        participantId: participantId,
        session: {
          id: session.id,
          code: session.code,
          title: session.title,
          status: session.status,
          currentQuestionIndex: session.currentQuestionIndex || -1,
          participantCount: updatedParticipants.length,
          maxParticipants: maxParticipants,
          host: session.host
            ? {
                name: session.host.firstName || session.host.username,
                username: session.host.username,
              }
            : null,
        },
        participant: {
          id: participantId,
          name: participant.name,
          isAnonymous: Boolean(isAnonymous),
          joinedAt: participant.joinedAt,
        },
        quiz: session.quiz
          ? {
              id: session.quiz.id,
              title: session.quiz.title,
              questionCount: session.quiz.questions?.length || 0,
            }
          : null,
      };

      console.log(`📤 Envoi session_joined au participant`);
      socket.emit("session_joined", responseData);

      // Notifications
      const hostNotification = {
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
      };

      console.log(`📢 Notification à l'hôte: host_${session.id}`);
      io.to(`host_${session.id}`).emit("participant_joined", hostNotification);
      socket
        .to(`session_${session.id}`)
        .emit("participant_joined", hostNotification);

      console.log(`✅ === FIN handleJoinSession SUCCESS ===`);
      console.log(
        `   Participant "${participant.name}" ajouté à la session "${session.code}"`
      );
      console.log(`   Total participants: ${updatedParticipants.length}\n`);
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

  // Handlers simplifiés pour les actions (inchangés)
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

      io.to(`session_${session.id}`).emit("session_started", {
        sessionId: session.id,
        currentQuestionIndex: 0,
        startedAt: new Date(),
      });

      console.log(`🚀 Session ${session.code} démarrée`);
    } catch (error) {
      console.error("Erreur lors du démarrage:", error);
      socket.emit("error", { message: "Erreur lors du démarrage" });
    }
  }

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

  // async function handleEndSession() {
  //   const socket = this;
  //   if (!socket.isHost || !socket.sessionId) {
  //     return socket.emit("error", { message: "Permission insuffisante" });
  //   }

  //   try {
  //     const session = await Session.findByPk(socket.sessionId);
  //     if (!session) {
  //       return socket.emit("error", { message: "Session non trouvée" });
  //     }

  //     const participants = session.participants || [];
  //     const stats = {
  //       totalParticipants: participants.length,
  //       averageScore:
  //         participants.length > 0
  //           ? participants.reduce((sum, p) => sum + (p.score || 0), 0) /
  //             participants.length
  //           : 0,
  //       completionRate: 100,
  //     };

  //     await session.update({
  //       status: "finished",
  //       endedAt: new Date(),
  //       stats: stats,
  //     });

  //     io.to(`session_${session.id}`).emit("session_ended", {
  //       sessionId: session.id,
  //       endedAt: new Date(),
  //       finalStats: stats,
  //     });

  //     console.log(`🏁 Session ${session.code} terminée`);
  //   } catch (error) {
  //     console.error("Erreur lors de la fin de session:", error);
  //     socket.emit("error", { message: "Erreur lors de la fin de session" });
  //   }
  // }
  // Correction handleEndSession - backend/socket/socketHandlers.js

  async function handleEndSession() {
    const socket = this;

    console.log(`🏁 === DEBUT handleEndSession ===`);
    console.log(`   Socket ID: ${socket.id}`);
    console.log(`   User: ${socket.user ? socket.user.username : "anonyme"}`);
    console.log(`   Is Host: ${socket.isHost}`);
    console.log(`   Session ID: ${socket.sessionId}`);

    // Vérification des permissions
    if (!socket.isHost || !socket.sessionId) {
      console.log(`❌ Permission insuffisante pour terminer la session`);
      return socket.emit("error", {
        message: "Permission insuffisante",
        code: "INSUFFICIENT_PERMISSIONS",
      });
    }

    try {
      // Récupérer la session avec tous les détails
      const session = await Session.findByPk(socket.sessionId, {
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
        console.log(`❌ Session non trouvée: ${socket.sessionId}`);
        return socket.emit("error", {
          message: "Session non trouvée",
          code: "SESSION_NOT_FOUND",
        });
      }

      console.log(`✅ Session trouvée:`, {
        id: session.id,
        code: session.code,
        status: session.status,
        participantsType: typeof session.participants,
        participantsIsArray: Array.isArray(session.participants),
        participantsLength: session.participants?.length || 0,
      });

      // Vérifier si la session peut être terminée
      if (session.status === "finished") {
        console.log(`⚠️  Session déjà terminée`);
        return socket.emit("error", {
          message: "La session est déjà terminée",
          code: "SESSION_ALREADY_FINISHED",
        });
      }

      if (session.status === "cancelled") {
        console.log(`⚠️  Session déjà annulée`);
        return socket.emit("error", {
          message: "La session est déjà annulée",
          code: "SESSION_CANCELLED",
        });
      }

      // 🔧 VALIDATION PRÉALABLE : S'assurer que participants est un tableau
      let participants = session.participants;
      if (!Array.isArray(participants)) {
        console.log(
          `⚠️  Participants n'est pas un tableau, correction avant endSession:`,
          {
            type: typeof participants,
            value: participants,
          }
        );

        // Corriger en base de données avant d'appeler endSession()
        await session.update({ participants: [] });
        await session.reload();
        participants = session.participants || [];
      }

      console.log(`📊 État avant fin de session:`, {
        participants: participants.length,
        responses: Object.keys(session.responses || {}).length,
        status: session.status,
      });

      // Appel sécurisé de endSession() maintenant que participants est un tableau
      const updatedSession = await session.endSession();
      await updatedSession.reload();

      console.log(`✅ Session terminée avec succès:`, {
        id: updatedSession.id,
        status: updatedSession.status,
        endedAt: updatedSession.endedAt,
        stats: updatedSession.stats,
      });

      // Préparer les données pour les notifications
      const endData = {
        sessionId: updatedSession.id,
        sessionCode: updatedSession.code,
        endedAt: updatedSession.endedAt,
        finalStats: updatedSession.stats || {},
        duration: updatedSession.stats?.duration || 0,
      };

      // Notifier tous les participants de la fin de session
      console.log(`📢 Notification fin de session à tous les participants`);
      io.to(`session_${updatedSession.id}`).emit("session_ended", endData);

      // Notifier l'hôte spécifiquement
      console.log(`📢 Notification fin de session à l'hôte`);
      io.to(`host_${updatedSession.id}`).emit("session_ended", {
        ...endData,
        isHost: true,
        redirectTo: `/session/${updatedSession.id}/results`,
      });

      // Réponse de confirmation à l'hôte qui a déclenché la fin
      socket.emit("session_ended", {
        ...endData,
        success: true,
        message: "Session terminée avec succès",
      });

      console.log(`🏁 === FIN handleEndSession SUCCESS ===`);
      console.log(`   Session ${updatedSession.code} terminée`);
      console.log(
        `   Stats finales: ${JSON.stringify(updatedSession.stats)}\n`
      );
    } catch (error) {
      console.error(`💥 === ERREUR handleEndSession ===`);
      console.error(`   Socket ID: ${socket.id}`);
      console.error(`   Session ID: ${socket.sessionId}`);
      console.error(`   Error name: ${error.name}`);
      console.error(`   Error message: ${error.message}`);
      console.error(`   Stack:`, error.stack);

      // Analyser le type d'erreur
      let errorCode = "END_SESSION_ERROR";
      let errorMessage = "Erreur lors de la fin de session";

      if (error.message.includes("forEach")) {
        errorCode = "PARTICIPANTS_FORMAT_ERROR";
        errorMessage = "Erreur de format des participants";
      } else if (error.message.includes("Cannot read")) {
        errorCode = "DATA_ACCESS_ERROR";
        errorMessage = "Erreur d'accès aux données";
      }

      socket.emit("error", {
        message: errorMessage,
        code: errorCode,
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

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
    if (!socket.isParticipant || !socket.sessionId || !socket.participantId) {
      return socket.emit("error", {
        message: "Vous devez être participant à une session",
      });
    }

    const { questionId, answer, timeSpent } = data;

    try {
      const session = await Session.findByPk(socket.sessionId, {
        include: [{ model: Quiz, as: "quiz" }],
      });

      if (!session || session.status !== "active") {
        return socket.emit("error", { message: "Session non active" });
      }

      const question = session.quiz?.questions?.find((q) => q.id == questionId);
      if (!question) {
        return socket.emit("error", { message: "Question non trouvée" });
      }

      // Calculer le score (logique simple)
      let isCorrect = false;
      let points = 0;

      if (question.type === "qcm" || question.type === "vrai_faux") {
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

      // Mettre à jour en base
      const participants = Array.isArray(session.participants)
        ? session.participants
        : [];
      const responses = session.responses || {};

      if (!responses[questionId]) {
        responses[questionId] = {};
      }
      responses[questionId][socket.participantId] = responseData;

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
        `📝 Réponse: ${socket.participantId} → Q${questionId} (${points} pts)`
      );
    } catch (error) {
      console.error("Erreur soumission réponse:", error);
      socket.emit("error", { message: "Erreur lors de la soumission" });
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
};

module.exports = socketHandlers;
