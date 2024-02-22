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
const { deserialize } = require("v8");

app.set("view engine", "ejs");
app.set("views", __dirname);
app.set("views", "views"); // setting the directory for the views

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(express.json());
app.use(cookieParser());

const secretKey = "Navneet";
const port = 3309;

app.get("/Cust_login", (req,res)=>{
  res.render("Cust_login");
});

app.get("/cholaReg", verifyToken, (req, res) => {
  res.render("cholaReg");
});

app.get("/contact_form/v2", (req, res) => {
  res.render("CustomerForm"); 
});

app.get("/Chola_Meeting", (req, res) => {
  res.render("meeting");
});


// Connect to SQLite database
const Meetingdb = new sqlite3.Database("MeetingDatabase.db");

// Define the Customer DB
const CustomerDB = new sqlite3.Database("CustomerDataBase.db");


// Create a meetings table
Meetingdb.run("CREATE TABLE IF NOT EXISTS MeetingTable (id INTEGER PRIMARY KEY AUTOINCREMENT, time TEXT, date TEXT, day TEXT, description TEXT UNIQUE)");


CustomerDB.run(
  "CREATE TABLE IF NOT EXISTS CustomerTable (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, email TEXT UNIQUE,password TEXT, phone INT UNIQUE,loggedIn BOOLEAN DEFAULT 0)"
);

// Middleware function to verify token
function verifyToken(req, res, next) {
  const token = req.cookies.token;
  const referer = req.headers.referer;

  // Check if the request is coming from the /Meet route
  if (referer && referer.includes("/Meet")) {
    // If yes, skip authentication and proceed to the next middleware
    return next();
  }

  // If not from /Meet route, redirect to the /Cust_login route
  if (!token) {
    // Redirect to login page based on the URL
    return res.redirect("/Cust_login");
  }
  
  jwt.verify(token, secretKey, (err, decoded) => {
    if (err) {
      return res.redirect("/Cust_login");
    }
    // user information in the request object
    req.user = decoded;
    next();
  });
}


// Handle form submission to schedule a meeting
app.post('/schedule-meeting', (req, res) => {
  const { time, date, description } = req.body;

  // Calculate the day from the provided date
  const day = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });

  Meetingdb.run(
    "INSERT INTO MeetingTable ( time, date, day, description) VALUES (?,  ?, ?, ?)",
    [time, date, day, description],
    function (err,rows) {
        if (err) {
            return console.error(err.message);
        }
        res.send("Meeting Scheduled");
    }
);

});

// Render the result page with all meetings
app.get("/Meet", (req, res) => {
  // Fetch all data from SQLite and render the admin page
  Meetingdb.all("SELECT date, time, day, description FROM MeetingTable GROUP BY date, time, day, description", (err, rows) => {
      if (err) {
          console.error(err.message);
          return res.status(500).send(
            '<script>alert("Internal Server Error");</script>'
          );
      } else {
        console.log(rows);
        res.render("result", { data: rows }); 
      }
  });
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


// Verifying the Customer Details using JWT Auth
app.post("/api-jwt-customer", (req, res) => {
  const userEmail = req.body.email;
  const userPassword = req.body.password;

  CustomerDB.get(
    "SELECT * FROM CustomerTable WHERE email = ? AND password = ?",
    [userEmail, userPassword],
    (err, row) => {
      if (err) {
        return console.error(err.message);
      }
      if (!row) {
        // Send an error response with the script tag
        return res.send('<script>alert("Invalid Email or Password Entered"); window.location.href = "/Cust_login";</script>');
      } else {
        // Check if the data entered matches the Database if yes PROCEED else REVOKE
        if (row.password !== userPassword) {
          // Send an error response with the script tag
          return res.send('<script>alert("Invalid Password Entered"); window.location.href = "/Cust_login";</script>');
        }
      }
      // If email and password are correct, create JWT token
      const token = jwt.sign({ email: row.email, password: row.password }, secretKey);
      // Set token as cookie
      res.cookie("token", token, { httpOnly: true });
      console.log({ token });
      // Redirect user to a specific page
      res.redirect("/cholaReg");
    }
  );
});

// API to join a room with JWT authentication and roomName verification
app.post("/api-join-jwt", (req, res) => {
  const description = req.body.roomName;
  const referer = req.headers.referer;

  // Check if the request is coming from the /Meet route
  if (referer && referer.includes("/Meet")) {
    // If yes, redirect directly to /cholaReg
    return res.redirect("/cholaReg");
  }

  // If not from /Meet route, proceed with the regular authentication process
  verifyToken(req, res, () => {
    Meetingdb.get(
      "SELECT * FROM MeetingTable WHERE description = ?",
      [description],
      (err, row) => {
        if (err) {
          return console.error(err.message);
        }
        if (!row || row.description !== description) {
          // If the roomName doesn't match any unique ID in the database, deny access
          return res.status(403).send(
            '<script>alert("Access denied: Invalid roomName")</script>'
          );
        }
        // If roomName is verified, generate JWT token for room access
        const token = jwt.sign({ roomName: row.roomName }, secretKey);
        console.log("Print :", { token });
        res.cookie("token", token, { httpOnly: true });
        res.redirect("/cholaReg");
      }
    );
  });
});
// Specify the folder where you want to save the screenshots
const saveFolderPath = "C:\\Users\\intern-navneet\\Desktop\\video-KYC\\ScreenShot";


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

// Delete all Executive logs from the database
app.get("/api/delete-all-Meeting-logs", (req, res) => {
  Meetingdb.run("DELETE FROM MeetingTable", function (err) {
      if (err) {
          console.error(err.message);
          res.status(500).send("Internal Server Error");
          return res.status(500).send('<script>alert("Internal Server Error")</script>');
      } else {
          console.log("All Meeting records have been deleted");
          res.redirect("/Chola_Meeting");
      }
  });
});

// Delete all Executive logs from the database
app.get("/api/delete-all-Customer-logs", (req, res) => {
  CustomerDB.run("DELETE FROM CustomerTable", function (err) {
      if (err) {
          console.error(err.message);
          return res.status(500).send('<script>alert("Error Occured")</script>');
      } else {
          console.log("All Customer records have been deleted");
          res.redirect("/contact_form/v2");
      }
  });
});

app.post('/send-otp', async (err,res)=>{
  try {
    const generatedOtp = generateOTP();

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

function generateOTP(){
  let digit = '0123456789abcdefghijklmnopqrstuvwxyz';
  let OTP = '';

  for(let i = 0; i < 6; i++){
    OTP+= digit[Math.floor(Math.random() * 10)];
  }
  return OTP;
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

  socket.on("Join", function (join) {
    // Check if the roomName matches any unique ID in the database
    Meetingdb.get(
      "SELECT * FROM MeetingTable WHERE description = ?",
      [join],
      (err, row) => {
        if (err) {
          return console.error(err.message);
        }
  
        if (!row || row.description !== join) {
          // If the description doesn't match any unique ID in the database, emit an error event
          socket.emit("invalidRoom");
        } else {
          // Convert scheduled time from the database to a JavaScript Date object
          const scheduledTime = new Date(`${row.date} ${row.time}`);
  
          // Get the current time
          const currentTime = new Date();
  
          // Check if the scheduled time has passed
          if (scheduledTime <= currentTime) {
            // Scheduled time has passed, deny access to the meeting
            socket.emit("meetingOver");
          } else {
            // Proceed with checking room availability
            var rooms = io.sockets.adapter.rooms;
            var roomName = join; // Use join as roomName
            var room = rooms.get(roomName);
  
            if (room === undefined) {
              // Room doesn't exist, create and join it
              socket.join(roomName);
              socket.emit("created");
            } else if (room.size == 1) {
              // Room exists and has one participant, join it
              socket.join(roomName);
              socket.emit("joined");
            } else {
              // Room is full, emit a full event
              socket.emit("full");
            }
          }
        }
      }
    );
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
