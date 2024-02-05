const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const socket = require("socket.io");
app.set("view engine", "ejs");
app.set("views", "./views"); // setting the directory for the views
// const favicon = require("serve-favicon");
const jwt = require("jsonwebtoken");

app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static("public"));

const port = 3309;
const server = app.listen(port, () => {
  console.log(`listening on ${port}`);
});

const userRoute = require("./routes/userRoute");
app.use("/", userRoute);

// --- JOINING THE ROOM USING socket ---
//socket io working with the signaling server
var io = socket(server);

//"io.on" is used tp make sure that the connection is established successfully
//Hence, generating the socket id each time the server is being hit.
io.on("connection", function (socket) {
  console.log("Client is connected: " + socket.id);

  socket.on("Join", function (roomName) {
    var rooms = io.sockets.adapter.rooms; // Here rooms is the variable created socket.io  to store all the available room names in an object format.

    var room = rooms.get(roomName);

    if (room == undefined) {
      socket.join(roomName);
      socket.emit("created"); //   console.log("Room Created");  --> it states that the room is CREATED.
    } else if (room.size == 1) {
      socket.join(roomName);
      socket.emit("joined"); // --> it states that the room is joined by the user
    } else {
      // console.log("Can't join ! Room is full");
      socket.emit("full");
    }

    // console.log(rooms);
  });
  //At first, [ signaling server]
  socket.on("ready", function (roomName) {
    //Now we broadcast the message to inform the user that the client has joined his room.
    console.log("ready");
    socket.broadcast.to(roomName).emit("ready");
  });

  //then, ice is being transfered
  socket.on("candidate", function (candidate, roomName) {
    console.log("candidate");
    socket.broadcast.to(roomName).emit("candidate", candidate); // first "candidate" argument is self created and second one candidate is called from abpve "socket.on"
  });

  // Now, offer is being generated from user to signaling server which again will be sent to the client side to verify in terms of some encrypted data
  socket.on("offer", function (offer, roomName) {
    console.log("offer");
    socket.broadcast.to(roomName).emit("offer", offer);
  });

  // Now, after generation of offer and to response of it we give answer
  // answer can be either declined or accepted based on clients  decision
  socket.on("answer", function (answer, roomName) {
    console.log("answer");
    socket.broadcast.to(roomName).emit("answer", answer);
  });

  //leave room  when disconnected from a peer

  socket.on("leave", function (roomName) {
    socket.leave(roomName);
    socket.broadcast.to(roomName).emit("leave");
  });
});
