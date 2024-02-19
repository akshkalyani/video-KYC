var socket = io();

var videoChatForm = document.getElementById("video-chat-form");
var videoChatRooms = document.getElementById("video-chat-rooms");
var joinBtn = document.getElementById("join");
var roomInput = document.getElementById("roomName");
const userVideo = document.getElementById("user-video");
const peerVideo = document.getElementById("peer-video");
var otpGeneratorBtn = document.getElementById("otpGenerator");
var screenshotButton = document.getElementById("screen-shot");
var logoutBtn = document.getElementById("logout");
// working with buttons
var BtnGroup = document.getElementById("btn-group");
var muteBtn = document.getElementById("mute-btn");
var HideCamBtn = document.getElementById("Hide-cam");
var leaveRoomBtn = document.getElementById("leave-btn");
var recordBtn = document.getElementById("record-btn");
var stopRecordBtn = document.getElementById("stop-btn");
var muteFlag = false;
var hideCamFlag = false;

var roomName;

var creator = false;

var rtcPeerConnection;
var userStream;

//STUN SERVER by 'GOOGLE'
var iceServers = {
  iceServers: [
    {
      urls: "stun:stun.1.google.com:19302",
    },
    {
      urls: "stun:stun1.l.google.com:19302",
    },
  ],
};

// "variable" will be used in client side.
//io is used to connect the  server and client side using URL
// can also give as io.connect("URL")

navigator.getUserMedia =
  navigator.getUserMedia ||
  navigator.webkitGetUserMedia ||
  navigator.mozGetUserMedia;

joinBtn.addEventListener("click", function () {
  //.addEventListener is used to invoke the click function which checks the below condition.
  if (roomInput.value === "") {
    alert("Please enter a valid room name!");
  } else {
    roomName = roomInput.value;
    socket.emit("Join", roomName); // we are hiting an event called .emit which passes an argument "join" and gives room.value i.e. the value entered by them to connect btw server and client side. "Updated globally as roomInput"
  }
});

// Add event listener for logout button
logoutBtn.addEventListener("click", function () {
  fetch("/logout/excecutive", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
  })
    .then(function (response) {
      if (response.redirected) {
        window.location.href = response.url;
        recorder.stop();
      }
    })

    .catch(function (error) {
      console.error("Error logging out:", error);
      recorder.stop(); // Stopping the recorder after redirecting
    });
});

logoutBtn.addEventListener("click", function () {
  fetch("/logout/customer", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
  })
    .then(function (response) {
      if (response.redirected) {
        window.location.href = response.url;
        recorder.stop();
      }
    })

    .catch(function (error) {
      console.error("Error logging out:", error);
      recorder.stop(); // Stopping the recorder after redirecting
    });
});
recordBtn.addEventListener("click", async () => {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });
    const recorder = new MediaRecorder(stream);
    recorder.start();
    const buffer = [];
    recorder.addEventListener("dataavailable", (event) => {
      buffer.push(event.data);
    });
    recorder.addEventListener("stop", () => {
      const blob = new Blob(buffer, {
        type: "video/mp4",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "Recording.mp4";
      a.click();
    });
  } catch (error) {
    console.error("Error taking screenshot:", error);
  }
});

// on clicking the screenshotButton get triggered and function invokes
screenshotButton.addEventListener("click", async () => {
  try {
    const response = await fetch("/screenshot");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "screenshot.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error taking screenshot:", error);
  }
});

muteBtn.addEventListener("click", function () {
  //.addEventListener is used to invoke the click function which checks the below condition.
  muteFlag = !muteFlag;
  if (muteFlag) {
    userStream.getTracks()[0].enabled = false;
    muteBtn.textContent = "Unmute";
  } else {
    userStream.getTracks()[0].enabled = true;
    muteBtn.textContent = "Mute";
  }
});

HideCamBtn.addEventListener("click", function () {
  hideCamFlag = !hideCamFlag;
  if (hideCamFlag) {
    userStream.getTracks()[1].enabled = false;
    HideCamBtn.textContent = "Show Cam";
  } else {
    userStream.getTracks()[1].enabled = true;
    // Update the text content of the button here
    HideCamBtn.textContent = "Hide Cam";
  }
});

// Client Side event is created
socket.on("created", function () {
  creator = true;
  navigator.getUserMedia(
    // getUserMedia is user to enable the features like audio , video
    // .getUserMedia takes 3 argument
    {
      audio: true,
      video: { width: 1280, height: 720, frameRate: { ideal: 30, max: 60 } },
      audio: { echoCancellation: true, noiseSuppression: true },
    },
    function (stream) {
      userStream = stream;
      videoChatForm.style = "display: none"; // stream is used  for "video Streaming" in user-video *above refer.
      userVideo.srcObject = stream; //2nd argument is a function.
      BtnGroup.style = "display:flex";
      userVideo.onloadedmetadata = function (e) {
        userVideo.play(); // it is used to play the video using .onloadmetadata
      };
    },
    function (error) {
      //3rd argument is error which is handled below.
      alert("Browser cannot be acessed");
    }
  );
});
socket.on("joined", function () {
  creator = false;
  // getUserMedia is user to enable the features like audio , video
  navigator.getUserMedia(
    // .getUserMedia takes 3 argument
    {
      audio: true,
      video: { width: 1280, height: 720, frameRate: { ideal: 30, max: 60 } },
      audio: { echoCancellation: true, noiseSuppression: true },
    },
    function (stream) {
      userStream = stream;
      videoChatForm.style = "display: none"; // stream is used  for "video Streaming" in user-video *above refer.
      BtnGroup.style = "display:flex";
      userVideo.srcObject = stream; //2nd argument is a function.
      userVideo.onloadedmetadata = function (e) {
        userVideo.play(); // it is used to play the video using .onloadmetadata
      };
      socket.emit("ready", roomName); // .emit will create and send an event when room is ready.
    },
    function (error) {
      //3rd argument is error which is handled below.
      alert("Browser cannot be acessed");
    }
  );
});

socket.on("candidate", function (candidate) {
  // on candidate event
  var iceCandidate = new RTCIceCandidate(candidate); //New instance is created of class RTCIceCandidate
  rtcPeerConnection.addIceCandidate(iceCandidate); // .addIceCandidate() is used to pass and return the new instance of class "rtcPeerConnection" and that instance value is stored to variable.
});

socket.on("offer", function (offer) {
  // on offer event
  rtcPeerConnection = new RTCPeerConnection(iceServers); // new instance of RTCpeerConnection
  rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(offer)); // .setRemoteDescription is a method to pass and return the new instance of class "RTCSessionDescription"
  rtcPeerConnection.onicecandidate = function (event) {
    // .onicecandidate checks if the candidate is null
    if (event.candidate) {
      socket.emit("candidate", {
        // emits "candidate"
        candidate: event.candidate,
        room: roomName,
      });
    }
  };
  rtcPeerConnection.ontrack = function (event) {
    // event handler for when a track is added to the connection
    peerVideo.srcObject = event.streams[0];
    peerVideo.onloadedmetadata = function (e) {
      peerVideo.play();
    };
  };

  navigator.getUserMedia(
    // getUserMedia is user to enable the features like audio , video
    {
      audio: true,
      video: { width: 1280, height: 720, frameRate: { ideal: 30, max: 60 } },
      audio: { echoCancellation: true, noiseSuppression: true },
    },
    function (stream) {
      userStream = stream;
      videoChatForm.style = "display: none"; // stream is used  for "video Streaming" in user-video *above refer.
      userVideo.srcObject = stream; //2nd argument is a function.
      BtnGroup.style = "display:flex";
      userVideo.onloadedmetadata = function (e) {
        userVideo.play(); // it is used to play the video using .onloadmetadata
      };
      userStream.getTracks().forEach(function (track) {
        rtcPeerConnection.addTrack(track, userStream); // it is used to add the media stream (tracks) to the connection
      });

      rtcPeerConnection.createAnswer(
        // .createAnswer is used to create the connection and returns the instance to the variable.
        function (answer) {
          rtcPeerConnection.setLocalDescription(answer); // .setLocalDescription is used to pass and return the new instance of class "answer"
          socket.emit("answer", {
            // emits answer
            answer: answer,
            room: roomName,
          });
        },
        function (error) {
          console.log(error);
        }
      );
    },
    function (error) {
      //3rd argument is error which is handled below.
      alert("Browser cannot be acessed");
    }
  );
});

socket.on("answer", function (answer) {
  // on answer event
  rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(answer)); // .setRemoteDescription is a method to pass and return the new instance of class "RTCSessionDescription"
});

socket.on("roomFull", function () {
  // Handling event when the room is already occupied
  alert("Room is already occupied by a user from the same domain.");
  // You can add any other handling logic here, such as redirecting the user or displaying a message.
});

// on click event
videoChatForm.addEventListener("submit", function (event) {
  event.preventDefault();
  var roomName = document.getElementById("roomName").value; // getting room value and store it to the variable
  if (roomName === "") {
    alert("Please enter a room name"); // if entered value is empty then alert will appear.
  } else {
    window.location.href = "/room/" + roomName; // if value entered is correct then it will redirect it to next page.
  }
});
