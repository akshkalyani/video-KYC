const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const socket = require("socket.io");
const screenshot = require("screenshot-desktop");
let fs = require("fs"); // calling file system modules :- built in module
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const cookieParser = require("cookie-parser");
const { Script } = require("vm");
const jwt = require("jsonwebtoken");

app.set("view engine", "ejs");
app.set("views", __dirname);
app.set("views", "views"); // setting the directory for the views

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(express.json());

const secretKey = "Navneet";
const port = 3309;

app.get("/login", (req, res) => {
  res.render("login");
});
app.get("/cholaReg", (req, res) => {
  res.render("cholaReg");
});

app.get("/contact_form/v1", (req, res) => {
  res.sendFile(path.join(__dirname, "ContactForm.html"));
});

const userRoute = require("./route/basicRoute");

app.use("/", userRoute);
app.use(cookieParser());

// Define the database connection
const db = new sqlite3.Database("E-KYC.db");

// Create the contacts table if it doesn't exist
db.run(
  "CREATE TABLE IF NOT EXISTS customer_Details (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, email TEXT UNIQUE, password TEXT, phone INT UNIQUE, loggedIn BOOLEAN DEFAULT 0)"
);

// user registration in customer_Details
app.post("/api/register", (req, res) => {
  const userName = req.body.name;
  const userEmail = req.body.email;
  const userPassword = req.body.password;
  const userPhone = req.body.phone;

  // Checks the mail whether the @chola.in
  if (!userEmail.endsWith("@chola.in")) {
    return res
      .status(404)
      .send("Invalid email domain. Please use an @chola.in email address.");
  }

  // Check if the username already exists in the database
  db.get(
    "SELECT * FROM customer_Details WHERE name = ?",
    [userName],
    (err, row) => {
      if (err) {
        return console.error(err.message);
      }
      if (row) {
        // Username already exists
        return res.status(400).send("Username already exists.");
      } else {
        // encodedPassword encodes the Password into string of base64
        const encodedPassword = Buffer.from(userPassword, "utf-8").toString(
          "base64"
        );

        // Inserting data into SQLite database
        db.run(
          "INSERT INTO customer_Details (name, email, password, phone) VALUES (?, ?, ?, ?)",
          [userName, userEmail, userPassword, userPhone],
          function (err) {
            if (err) {
              return console.error(err.message);
            }
            console.log(`A new log has been added with id ${this.lastID}`);
            console.log(`${userEmail} || ${userPassword}`);
          }
        );
        res.redirect("/login");
      }
    }
  );
});

// verifying the details using JWT Auth
app.post("/api-jwt", (req, res) => {
  const userEmail = req.body.email;
  const userPassword = req.body.password;

  db.get(
    "SELECT * FROM customer_Details WHERE email = ?",
    [userEmail],
    (err, row) => {
      if (err) {
        return console.error(err.message);
      }
      if (!row) {
        return res.status(401).send("Invalid email or password");
      } else {
        if (row.password !== userPassword) {
          return res.status(401).send("Invalid email or password");
        }

        // Check if the user is already logged in
        if (row.loggedIn) {
          return res.status(401).send("User is already logged in");
        }

        // Set loggedIn flag to true in the database
        db.run(
          "UPDATE customer_Details SET loggedIn = 1 WHERE email = ?",
          [userEmail],
          (err) => {
            if (err) {
              return console.error(err.message);
            }
            const token = jwt.sign({ email: row.email }, secretKey, {
              expiresIn: "1h",
            });
            console.log({ token });
            res.cookie("token", token, { httpOnly: true });

            res.redirect("/cholaReg");
          }
        );
      }
    }
  );
});

//logout from the session by creating the loggedIn flag
app.post("/logout", (req, res) => {
  // Extract the JWT token from the request cookies
  const token = req.cookies.token;

  if (!token) {
    // If there's no token, the user is not authenticated, so redirect them to the login page
    return res.redirect("/login");
  }

  // Verify the JWT token to get the user's email
  jwt.verify(token, secretKey, (err, decoded) => {
    if (err) {
      // If there's an error with the token, redirect the user to the login page
      return res.redirect("/login");
    }

    // Extract the user's email from the decoded token
    const userEmail = decoded.email;

    // Clear the loggedIn flag in the database for the current user
    db.run(
      "UPDATE customer_Details SET loggedIn = 0 WHERE email = ?",
      [userEmail],
      (err) => {
        if (err) {
          return console.error(err.message);
        }
        // Redirect the user to the login page after logging out
        res.clearCookie("token"); // Clear the token from the cookies
        res.redirect("/login");
      }
    );
  });
});

// API to get the screenshot of the video call page.
app.get("/screenshot", async (req, res) => {
  try {
    const img = await screenshot();
    res.type("image/png"); //type--> image/png
    res.send(img);
  } catch (error) {
    console.error("Error capturing screenshot:", error);
    res.status(500).send("Error capturing screenshot");
  }
});

// Route to render the admin page
app.get("/admin", (req, res) => {
  // Fetch all data from SQLite and render the admin page
  db.all("SELECT * FROM customer_Details", (err, rows) => {
    if (err) {
      console.error(err.message);
      res.status(500).send("Internal Server Error");
    } else {
      res.render("admin", { data: rows });
    }
  });
});

// deleting all the logs from the database
app.get("/api/delete-all-logs", (req, res) => {
  db.run("DELETE FROM customer_Details", function (err) {
    if (err) {
      console.error(err.message);
      res.status(500).send("Internal Server Error");
    } else {
      console.log("All records have been deleted");

      // Respond with a success message or other appropriate response
      // res.json({ message: "All records have been deleted successfully" });
    }
  });
});

const server = app.listen(port, () => {
  console.log(`listening on ${port}`);
});

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
