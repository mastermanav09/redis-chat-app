let io;

module.exports = {
  init: (server) => {
    io = require("socket.io")(server, {
      pingTimeout: 60000,
      cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      },
    });

    return io;
  },

  getIO: () => {
    if (!io) {
      console.log("Socket.io not initialized");
      throw new Error("Couldn't connect with the server.");
    }

    return io;
  },
};
