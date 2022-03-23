const express = require("express");
const app = express();
const http = require("http");
const socketio = require("socket.io");
const expsession = require("express-session");
const { createClient } = require("redis");

const client = createClient({
  legacyMode: true,
});

(async () => await client.connect())();

app.use(express.urlencoded({ extended: false }));

app.set("view engine", "ejs");
app.set("views", "views");

async function sendMessage(socket) {
  await client.lRange("messages", "0", "-1", async (err, data) => {
    data.forEach((element) => {
      const [username, message] = element.split(":");
      socket.emit("message", {
        from: username,
        message: message,
      });
    });
  });
}

app.get("/", (req, res, next) => {
  res.render("index", {
    docTitle: "Home",
  });
});

app.get("/chat", (req, res, next) => {
  const username = req.query.username;

  res.render("chat", { docTitle: "Chat", username: username });
});

const server = app.listen(process.env.PORT || 5000);
const io = require("./config/socket").init(server);

io.on("connection", async (socket) => {
  await sendMessage(socket);

  socket.on("user-joined", (data) => {
    io.emit("joined", data);
  });

  socket.on("message", async ({ message, from }) => {
    try {
      await client.rPush("messages", `${from}:${message}`);
    } catch (error) {
      console.log(error);
    }

    io.emit("message", { from, message });
  });
});
