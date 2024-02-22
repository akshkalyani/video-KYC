var socket = io();

var videoChatForm = document.getElementById("video-chat-form");
var videoChatRooms = document.getElementById("video-chat-rooms");
var joinBtn = document.getElementById("join");
var roomInput = document.getElementById("roomName");
const userVideo = document.getElementById("user-video");
const peerVideo = document.getElementById("peer-video");
var otpGeneratorBtn = document.getElementById("otpGenerator");
var screenshotButton = document.getElementById("screen-shot");
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
      socket.emit("ready", roomName);
    },
    function (error) {
      //3rd argument is error which is handled below.
      alert("Not accessed");
    }
  );
});
socket.on("full", function () {
  alert("Already In call, can't be accessed.");
});
socket.on("ready", function () {
  if (creator) {
    //creator is working in userFirst end.
    // new rtcPeerConnection object is created
    rtcPeerConnection = new RTCPeerConnection(iceServers);
    rtcPeerConnection.onicecandidate = OnIceCandidateFunction;
    //ontrack function is used to make a audio and video connection vissible to peers
    rtcPeerConnection.ontrack = onTrackFunction;
 
    //addTrack is used to send the userVideo, audio to peer side
    rtcPeerConnection.addTrack(userStream.getTracks()[0], userStream); // for audio track 0th index
    rtcPeerConnection.addTrack(userStream.getTracks()[1], userStream); // for video track 1st index
 
    rtcPeerConnection.createOffer(
      function (offer) {
        rtcPeerConnection.setLocalDescription(offer);
        socket.emit("offer", offer, roomName);
      },
      function (error) {
        console.log(error);
      }
    );
  }
});
socket.on("candidate", function (candidate) {
  var iceCandidate = new RTCIceCandidate(candidate);
  rtcPeerConnection.addIceCandidate(iceCandidate);
});
socket.on("offer", function (offer) {
  // it is running on other user side
  if (!creator) {
    // new rtcPeerConnection object is created
    rtcPeerConnection = new RTCPeerConnection(iceServers);
    rtcPeerConnection.onicecandidate = OnIceCandidateFunction;
    //ontrack function is used to make a audio and video connection vissible to peers
    rtcPeerConnection.ontrack = onTrackFunction;
 
    //addTrack is used to send the userVideo, audio to peer side
    rtcPeerConnection.addTrack(userStream.getTracks()[0], userStream); // for audio track 0th index
    rtcPeerConnection.addTrack(userStream.getTracks()[1], userStream); // for video track 1st index
    rtcPeerConnection.setRemoteDescription(offer);
    rtcPeerConnection.createAnswer(
      function (answer) {
        rtcPeerConnection.setLocalDescription(answer);
        socket.emit("answer", answer, roomName);
      },
      function (error) {
        console.log(error);
      }
    );
  }
});
socket.on("answer", function (answer) {
  rtcPeerConnection.setRemoteDescription(answer);
});
 
//leaving rhe call by click event listener
leaveRoomBtn.addEventListener("click", function () {
  //.addEventListener is used to invoke the click function which checks the below condition.
  socket.emit("leave", roomName);
 
  videoChatForm.style = "display:block";
  BtnGroup.style = "display:none";
 
  //here if user clicks the button below thing will invoke
  if (userVideo.srcObject) {
    userVideo.srcObject.getTracks()[0].stop();
    userVideo.srcObject.getTracks()[1].stop();
  }
  // here if peer click the button it will invoke
 
  if (peerVideo.srcObject) {
    peerVideo.srcObject.getTracks()[0].stop();
    peerVideo.srcObject.getTracks()[1].stop();
  }
 
  if (rtcPeerConnection) {
    rtcPeerConnection.ontrack = null;
    rtcPeerConnection.onicecandidate = null;
    rtcPeerConnection.close();
  }
});
 
socket.on("leave", function () {
  //here if I give "creator = true" means if user1 leaves the call the user2 will be assingned the role
  // but since being an excecutive call cannot make it true.
  if (peerVideo.srcObject) {
    peerVideo.srcObject.getTracks()[0].stop();
    peerVideo.srcObject.getTracks()[1].stop();
  }
 
  // Cleanup peerVideo
  if (peerVideo.srcObject) {
    peerVideo.srcObject.getTracks().forEach((track) => track.stop());
    peerVideo.srcObject = null;
  }
 
  // Close rtcPeerConnection
  if (rtcPeerConnection) {
    rtcPeerConnection.ontrack = null;
    rtcPeerConnection.onicecandidate = null;
    rtcPeerConnection.close();
  }
});
function OnIceCandidateFunction(event) {
  if (event.candidate) {
    socket.emit("candidate", event.candidate, roomName);
  }
}
 
function onTrackFunction(event) {
  peerVideo.srcObject = event.streams[0]; // event.stream is an array where at 0th index audio and video is stored and we store it in peerVideo.srcObject
  peerVideo.onloadedmetadata = function (e) {
    peerVideo.play(); // it is used to play the video using .onloadmetadata using peerVideo.play -> plays peer video
  };
}

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
