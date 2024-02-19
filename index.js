const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const socket = require("socket.io");
const screenshot = require("screenshot-desktop");
let fs = require("fs"); 
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const cookieParser = require("cookie-parser");
const { Script } = require("vm");
const jwt = require("jsonwebtoken");
const { time } = require("console");
const axios = require("axios");
const { decode } = require("punycode");

app.set("view engine", "ejs");
app.set("views", __dirname);
app.set("views", "views"); // setting the directory for the views

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(express.json());
app.use(cookieParser());

const secretKey = "Navneet";
const port = 3309;

app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/Cust_login", (req,res)=>{
  res.render("Cust_login");
});


app.get("/cholaReg", verifyToken, (req, res) => {
  res.render("cholaReg");
});

app.get("/contact_form/v1", (req, res) => {
  res.render("ContactForm");
});

app.get("/contact_form/v2", (req, res) => {
  res.render("CustomerForm"); 
});


// Define the Excecutive DB
const ExcecutiveDB = new sqlite3.Database("ExcecutiveDataBase.db");

// Define the Customer DB
const CustomerDB = new sqlite3.Database("CustomerDataBase.db");

// Create the contacts table if it doesn't exist
ExcecutiveDB.run(
  "CREATE TABLE IF NOT EXISTS ExcecutiveTable(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, email TEXT UNIQUE, password TEXT, phone INT UNIQUE, loggedIn BOOLEAN DEFAULT 0)"
);

CustomerDB.run(
  "CREATE TABLE IF NOT EXISTS CustomerTable(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, email TEXT UNIQUE,password TEXT, phone INT UNIQUE,loggedIn BOOLEAN DEFAULT 0)"
);

// Middleware function to verify token
function verifyToken(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    // Redirect to login page based on the URL
    if (req.originalUrl.includes("Cust")) {
      return res.redirect("/Cust_login");
    } else {
      return res.redirect("/login");
    }
  }

  jwt.verify(token, secretKey, (err, decoded) => {
    if (err) {
      // Token verification failed
      if (err.name === 'TokenExpiredError') {
        // Token has expired, clear the cookie and redirect to login
        res.clearCookie("token");
        // Redirect to the appropriate login page based on the URL
        if (req.originalUrl.includes("Cust")) {
          return res.redirect("/Cust_login");
        } else {
          return res.redirect("/login");
        }
      } else {
        // Other errors
        return res.status(500).send("Internal Server Error");
      }
    }

    // Check token expiration
    const currentTimeInSeconds = Math.floor(Date.now() / 1000);
    if (decoded.exp <= currentTimeInSeconds) {
      // Token has expired, clear the cookie and redirect to login
      res.clearCookie("token");
      // Redirect to the appropriate login page based on the URL
      if (req.originalUrl.includes("Cust")) {
        return res.redirect("/Cust_login");
      } else {
        return res.redirect("/login");
      }
    }

    // user information in the request object
    req.user = decoded;
    next();
  });
}


//Excecutive Database registeration
app.post("/api/register/excecutive", (req, res) => {
  const userName = req.body.name;
  const userEmail = req.body.email;
  const userPassword = req.body.password;
  const userPhone = req.body.phone;

  //Checks the mail whether the @chola.in
  if (!userEmail.endsWith("@chola.in")) {
    return res.status(404).send(
      '<script>alert("Invalid Chola ID"); window.location.href = "/contact_form/v1";</script>'
    );
  }
  // Check if the username already exists in the database
  ExcecutiveDB.get(
    "SELECT * FROM ExcecutiveTable WHERE name = ?",
    [userName],
    (err, row) => {
      if (err) {
        return console.error(err.message);
      }
      if (row) {
        // Username already exists
        return res.status(400).send(
          '<script>alert("Username already exists"); window.location.href = "/contact_form/v1";</script>'
        );
      } else {
        // encodedPassword encodes the Password into string of base64
        const encodedPassword = Buffer.from(userPassword, "utf-8").toString(
          "base64"
        );
        // Inserting data into SQLite database
        ExcecutiveDB.run(
          "INSERT INTO ExcecutiveTable (name, email, password, phone) VALUES (?, ?, ?, ?)",
          [userName, userEmail, userPassword, userPhone],
          function (err) {
            if (err) {
              return console.error(err.message);
            }
            console.log(`A new Excecutive log has been added with id ${this.lastID}`);
            console.log(`${userEmail} || ${userPassword}`);
          }
        );
        res.redirect("/login");
      }
    }
  );
});

//Customer Database registration
app.post("/api/register/customer", (req, res) => {
  const userName = req.body.name;
  const userEmail = req.body.email;
  const userPassword = req.body.password;
  const userPhone = req.body.phone;

  //Checks the mail 
  if (userEmail.endsWith("@chola.in")) {
      return res.status(404).send(
        '<script>alert("Invalid Email Entered"); window.location.href = "/contact_form/v2";</script>'
      );
  }
  // Check if the username already exists in the database
  CustomerDB.get(
    "SELECT * FROM CustomerTable WHERE name = ?",
    [userName],
    (err, row) => {
      if (err) {
        return console.error(err.message);
      }
      if (row) {
        // Username already exists
        return res.status(400).send(
          '<script>alert("Username already exists"); window.location.href = "/contact_form/v2";</script>'
        );
      } else {
        // encodedPassword encodes the Password into string of base64
        const encodedPassword = Buffer.from(userPassword, "utf-8").toString(
          "base64"
        );
        // Inserting data into SQLite database
        CustomerDB.run(
          "INSERT INTO CustomerTable (name, email, password, phone) VALUES (?, ?, ?, ?)",
          [userName, userEmail, userPassword, userPhone],
          function (err) {
            if (err) {
              return console.error(err.message);
            }
            console.log(`A new log customer DB has been added with id ${this.lastID}`);
            console.log(`${userEmail} || ${userPassword}`);
          }
        );
        res.redirect("/Cust_login");
      }
    }
  );
});

// Verifying the Executive Detail using JWT Auth
app.post("/api-jwt-excecutive", (req, res) => {
  const userEmail = req.body.email;
  const userPassword = req.body.password;

  ExcecutiveDB.get(
    "SELECT * FROM ExcecutiveTable WHERE email = ?",
    [userEmail],
    (err, row) => {
      if (err) {
        return console.error(err.message);
      }
      if (!row) {
        return res.send(
          '<script>alert("Invalid Email Entered"); window.location.href = "/login";</script>'
        );
      } else {
        if (row.password !== userPassword) {
          return res.send(
            '<script>alert("Invalid Password Entered"); window.location.href = "/login";</script>'
          );
        }

        // Check if the user is already logged in
        if (row.loggedIn) {
          return res.status(401).send("User is already logged in");
        }

        // Set loggedIn flag to true in the database
        ExcecutiveDB.run(
          "UPDATE ExcecutiveTable SET loggedIn = 1 WHERE email = ?",
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

// Verifying the Customer Details using JWT Auth
app.post("/api-jwt-customer", (req, res) => {
  const userEmail = req.body.email;
  const userPassword = req.body.password;

  CustomerDB.get(
    "SELECT * FROM CustomerTable WHERE email = ?",
    [userEmail],
    (err, row) => {
      if (err) {
        return console.error(err.message);
      }
      if (!row) {
        return res.send(
          '<script>alert("Invalid Email Entered"); window.location.href = "/Cust_login";</script>'
        );
      } else {
        if (row.password !== userPassword) {
          return res.send(
            '<script>alert("Invalid Password Entered"); window.location.href = "/Cust_login";</script>'
          );
        }

        // Check if the user is already logged in
        if (row.loggedIn) {
          return res.status(401).send("User is already logged in");
        }

        // Set loggedIn flag to true in the database
        CustomerDB.run(
          "UPDATE CustomerTable SET loggedIn = 1 WHERE email = ?",
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


//logout from the Excecutive session by creating the loggedIn flag
app.post("/logout/excecutive", (req, res) => {
  const token = req.cookies.token;

  if (!token) {
    return res.redirect("/login");
  }

  jwt.verify(token, secretKey, (err, decoded) => {
    if (err) {
      return res.redirect("/login");
    }

    const userEmail = decoded.email;

    // Set loggedIn flag to false in the database
    ExcecutiveDB.run(
      "UPDATE ExcecutiveTable SET loggedIn = 0 WHERE email = ?",
      [userEmail],
      (err) => {
        if (err) {
          return console.error(err.message);
        }
        res.clearCookie("token");
        res.redirect("/login");
      }
    );
  });
});


//logout from the Customer session by creating the loggedIn flag
app.post("/logout/customer", (req, res) => {
  const token = req.cookies.token;

  if (!token) {
    return res.redirect("/Cust_login");
  }

  jwt.verify(token, secretKey, (err, decoded) => {
    if (err) {
      return res.redirect("/Cust_login");
    }

    const userEmail = decoded.email;

    CustomerDB.run(
      "UPDATE CustomerTable SET loggedIn = 0 WHERE email = ?",
      [userEmail],
      (err) => {
        if (err) {
          return console.error(err.message);
        }
        res.clearCookie("token");
        res.redirect("/Cust_login");
      }
    );
  });
});


// Specify the folder where you want to save the screenshots
const saveFolderPath = "C:\Users\intern-navneet\Desktop\video-KYC\ScreenShot";

// API to get the screenshot of the video call page.
app.get("/screenshot", async (req, res) => {
  try {
    // Capture the screenshot
    const img = await screenshot();

    // Write the image to the specified path
    const imagePath = path.join(saveFolderPath, `Screenshot_${Date.now()}.png`);
    fs.writeFileSync(imagePath, img);

    // Send the image as the response
    res.type("image/png");
    res.send(img);
  } catch (error) {
    console.error("Error capturing screenshot:", error);
    res.status(500).send("Error capturing screenshot");
  }
});

// Route to render the Excecutive admin page
app.get("/admin", (req, res) => {
  // Fetch all data from SQLite and render the admin page
  ExcecutiveDB.all("SELECT * FROM ExcecutiveTable", (err, rows) => {
    if (err) {
      console.error(err.message);
      res.status(500).send("Internal Server Error");
    } else {
      res.render("admin", { data: rows });
    }
  });
});

// Route to render the Customer admin page
app.get("/cust_admin", (req, res) => {
  // Fetch all data from SQLite and render the admin page
  CustomerDB.all("SELECT * FROM CustomerTable", (err, rows) => {
    if (err) {
      console.error(err.message);
      res.status(500).send("Internal Server Error");
    } else {
      res.render("cust_admin", { data: rows });
    }
  });
});

// // deleting all Excecutive logs from the database
app.get("/api/delete-all-Excecutive-logs", (req, res) => {
  ExcecutiveDB.run("DELETE FROM ExcecutiveTable", function (err) {
    if (err) {
      console.error(err.message);
      res.status(500).send("Internal Server Error");
    } else {
      res.redirect("/contact_form/v1");
      console.log("All Excecutive records have been deleted");
    }
  });
});

// // deleting all Customer logs from the database
app.get("/api/delete-all-Customer-logs", (req, res) => {
  CustomerDB.run("DELETE FROM CustomerTable", function (err) {
    if (err) {
      console.error(err.message);
      res.status(500).send("Internal Server Error");
    } else {
      console.log("All Customer records have been deleted");
      res.redirect("/contact_form/v2");
    }
  });
});

//OTP Generation
app.post('/generate-otp', async (req, res) => {
  try {
    const generatedOtp = req.body.otp || generateOtp();

    const response = await axios.post('https://d2c-communication-uat.chola.murugappa.com/SMS/SEND', {
      enterpriseid: "chfinotp",
      subEnterpriseid: "chfinotp",
      msisdn: "8210731776",
      intflag: "false",
      msgid: "1603312300682",
      sender: "CHOFIN",
      contenttype: "1",
      language: "en",
      name: "1611209806672",
      msgtext: `Your secret OTP to login to the Chola One APP is ${generatedOtp}. DO NOT disclose your OTP to anyone - Team Chola 76iyyiiiu`,
      productType: "KYC",
      environment: "UAT"
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.status >= 200 && response.status < 300) {
      // Handle the success response
      console.log('API Response:', response.data);
      res.status(200).send('OTP sent successfully');
    } else {
      // Handle the error response
      console.error('Error sending OTP:', response.status, response.statusText);
      
      // Log additional information from the response headers
      console.log('Response Headers:', response.headers);
      
      res.status(response.status).send(`Error sending OTP: ${response.statusText}`);
    }
  } catch (error) {
    // Handle unexpected errors
    console.error('Unexpected error sending OTP:', error.message);
    res.status(500).send('Unexpected error sending OTP');
  }
});

function generateOtp() {
  // Generate a random 4-digit OTP
  return Math.floor(1000 + Math.random() * 9000);
}

const server = app.listen(port, () => {
  console.log(`listening on ${port}`);
});

// --- JOINING THE ROOM USING socket ---
//socket io working with the signaling server
var io = socket(server);

//"io.on" is used to make sure that the connection is established successfully
//Hence, generating the socket id each time the server is being hit.
io.on("connection", function (socket) {
  console.log("Client is connected: " + socket.id);

  socket.on("Join", function (roomName) {
    var rooms = io.sockets.adapter.rooms; // Here rooms is the variable created socket.io  to store all the available room names in an object format.

    var room = rooms.get(roomName);

    if (room == undefined) {
      socket.join(roomName);
      socket.emit("joined");
      socket.emit("created"); // console.log("Room Created");  --> it states that the room is CREATED.
    } else if (room.size == 1) {   
      socket.join(roomName);
      socket.emit("joined"); // --> it states that the room is joined by the user
    } else {
      console.log("Can't join ! Room is full");
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

  //then, ice is being transferred
  socket.on("candidate", function (candidate, roomName) {
    console.log("candidate");
    socket.broadcast.to(roomName).emit("candidate", candidate); // first "candidate" argument is self-created and the second one candidate is called from above "socket.on"
  });

  // Now, offer is being generated from the user to signaling server which again will be sent to the client-side to verify in terms of some encrypted data
  socket.on("offer", function (offer, roomName) {
    console.log("offer");
    socket.broadcast.to(roomName).emit("offer", offer);
  });

  // Now, after the generation of offer and the response of it, we give an answer
  // the answer can be either declined or accepted based on the client's decision
  socket.on("answer", function (answer, roomName) {
    console.log("answer");
    socket.broadcast.to(roomName).emit("answer", answer);
  });

  //leave room when disconnected from a peer
  socket.on("leave", function (roomName) {
    socket.leave(roomName);
    socket.broadcast.to(roomName).emit("leave");
  });
});