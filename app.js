require("dotenv").config();
const express = require("express");
const app = express();
const http = require("http");
const socketio = require("socket.io");
const expsession = require("express-session");
const { createClient } = require("redis");
const { default: mongoose } = require("mongoose");
const Message = require("./models/message");
const { userJoin, getCurrentUser, userLeave } = require("./utils/users");

const client = createClient({
  legacyMode: true,
});

(async () => await client.connect())();

app.use(express.urlencoded({ extended: false }));

app.set("view engine", "ejs");
app.set("views", "views");

async function sendMessage(socket) {
  await client.lRange("messages", "0", "-1", async (err, data) => {
    if (data.length !== 0) {
      data.forEach((element) => {
        const [username, message] = element.split(":");
        socket.emit("message", {
          from: username,
          message: message,
        });
      });
    } else {
      const messages = await Message.find().sort({ createdAt: 1 });
      messages.forEach(async (message) => {
        await client.rPush("messages", `${message.from}:${message.message}`);
      });
    }
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

mongoose
  .connect(process.env.MONGO_KEY, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then((result) => {
    const server = app.listen(process.env.PORT || 5000);
    const io = require("./config/socket").init(server);

    io.on("connection", async (socket) => {
      await sendMessage(socket);

      socket.on("user-joined", (data) => {
        userJoin(data, socket.id);
        io.emit("joined", data);
      });

      socket.on("message", async ({ message, from }) => {
        try {
          await client.rPush("messages", `${from}:${message}`);
          const newMessage = new Message({
            from,
            message,
          });

          await newMessage.save();
        } catch (error) {
          console.log(error);
        }

        io.emit("message", { from, message });
      });

      socket.on("disconnect", () => {
        const user = getCurrentUser(socket.id);
        io.emit("leftChat", user.userName);
      });
    });
  })
  .catch((err) => {
    console.log(err);
  });
