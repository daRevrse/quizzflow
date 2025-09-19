// Middleware de debug pour Socket.IO - backend/socket/debugMiddleware.js

const debugSocketMiddleware = (socket, next) => {
  console.log(`\n🔧 === DEBUG SOCKET MIDDLEWARE ===`);
  console.log(`   Socket ID: ${socket.id}`);
  console.log(`   Handshake auth:`, socket.handshake.auth);
  console.log(`   Handshake headers:`, {
    authorization: socket.handshake.headers.authorization,
    origin: socket.handshake.headers.origin,
    userAgent: socket.handshake.headers["user-agent"]?.substring(0, 100),
  });
  console.log(`   Query parameters:`, socket.handshake.query);
  console.log(`=== FIN DEBUG SOCKET MIDDLEWARE ===\n`);

  next();
};

// Middleware pour logger tous les événements reçus
const logAllEventsMiddleware = (socket) => {
  const originalEmit = socket.emit;
  const originalOn = socket.on;

  // Intercepter tous les emit (envois)
  socket.emit = function (event, ...args) {
    if (event !== "ping" && event !== "pong") {
      // Éviter le spam des ping/pong
      console.log(
        `📤 [${socket.id}] EMIT "${event}":`,
        args.length > 0
          ? JSON.stringify(args[0], null, 2).substring(0, 500) + "..."
          : "no data"
      );
    }
    return originalEmit.apply(this, [event, ...args]);
  };

  // Intercepter tous les on (réceptions)
  socket.on = function (event, handler) {
    const wrappedHandler = (...args) => {
      if (event !== "ping" && event !== "pong") {
        console.log(
          `📥 [${socket.id}] RECEIVED "${event}":`,
          args.length > 0
            ? JSON.stringify(args[0], null, 2).substring(0, 500) + "..."
            : "no data"
        );
      }
      return handler.apply(this, args);
    };
    return originalOn.call(this, event, wrappedHandler);
  };
};

// À ajouter dans socketHandlers.js
const socketHandlers = (io) => {
  // Middleware de debug global
  io.use(debugSocketMiddleware);
  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    console.log(
      `🔌 Nouvelle connexion Socket.IO: ${socket.id} ${
        socket.user ? `(${socket.user.username})` : "(anonyme)"
      }`
    );

    // Ajouter le logging des événements pour ce socket
    if (process.env.NODE_ENV === "development") {
      logAllEventsMiddleware(socket);
    }

    // Test de communication - répondre immédiatement à join_session pour debug
    socket.on("join_session", function (data) {
      console.log(`\n🧪 === TEST RÉCEPTION join_session ===`);
      console.log(`   Socket ID: ${this.id}`);
      console.log(`   Arguments reçus:`, arguments.length);
      console.log(`   Type de data:`, typeof data);
      console.log(`   Contenu de data:`, data);
      console.log(`   JSON.stringify(data):`, JSON.stringify(data));

      if (data) {
        console.log(`   Object.keys(data):`, Object.keys(data));
        console.log(`   data.hasOwnProperty:`, {
          sessionCode: data.hasOwnProperty("sessionCode"),
          participantName: data.hasOwnProperty("participantName"),
          isAnonymous: data.hasOwnProperty("isAnonymous"),
        });
      }

      console.log(`=== FIN TEST RÉCEPTION ===\n`);

      // Appeler le vrai handler
      handleJoinSession.call(this, data);
    });

    // Reste des événements...
    socket.on("leave_session", handleLeaveSession);
    socket.on("host_session", handleHostSession);
    // ... autres événements
  });
};

module.exports = { debugSocketMiddleware, logAllEventsMiddleware };
