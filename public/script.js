const userVideo = document.getElementById("user-video");
const startButton = document.getElementById("start-btn");
const stopButton = document.getElementById("stop-btn");
const status = document.getElementById("status");

const socket = io();

const state = {
  media: null,
  mediaRecorder: null,
  streamId: crypto.randomUUID(),
};


/* =========================================================
   SOCKET
========================================================= */

socket.on("connect", () => {

  console.log(
    "Socket connected:",
    socket.id
  );

  status.textContent =
    "Socket connected";
});


socket.on("disconnect", () => {

  console.log(
    "Socket disconnected"
  );

  status.textContent =
    "Socket disconnected";
});


/* =========================================================
   CAMERA + MICROPHONE
========================================================= */

window.addEventListener("load", async () => {

  try {

    const media =
      await navigator.mediaDevices.getUserMedia({
        video: {
          frameRate: {
            ideal: 25,
            max: 25,
          },
        },
        audio: true,
      });

    state.media = media;

    userVideo.srcObject = media;

    status.textContent =
      "Camera ready";

  } catch (error) {

    console.error(
      "Camera error:",
      error
    );

    status.textContent =
      "Failed to access camera/microphone";
  }

});


/* =========================================================
   START
========================================================= */

startButton.addEventListener("click", () => {

  if (!state.media) {

    console.error(
      "Media stream not available"
    );

    return;
  }


  /* -------------------------------------------------------
     Check supported MIME type
  ------------------------------------------------------- */

  const mimeType =
    "video/webm;codecs=vp8,opus";

  if (!MediaRecorder.isTypeSupported(mimeType)) {

    console.error(
      `${mimeType} is not supported`
    );

    return;
  }


  /* -------------------------------------------------------
     Tell server to create FFmpeg
  ------------------------------------------------------- */

  console.log(
    "Starting stream:",
    state.streamId
  );

  socket.emit(
    "start-stream",
    state.streamId
  );


  /* -------------------------------------------------------
     Create MediaRecorder
  ------------------------------------------------------- */

  const mediaRecorder =
    new MediaRecorder(
      state.media,
      {
        mimeType,
        audioBitsPerSecond: 128000,
        videoBitsPerSecond: 2500000,
      }
    );


  state.mediaRecorder =
    mediaRecorder;


  /* -------------------------------------------------------
     Video chunks
  ------------------------------------------------------- */

  mediaRecorder.ondataavailable =
    async (event) => {

      if (
        !event.data ||
        event.data.size === 0
      ) {
        return;
      }


      const buffer =
        await event.data.arrayBuffer();


      console.log(
        "Sending:",
        buffer.byteLength,
        "bytes"
      );


      socket.emit(
        "binarystream",
        buffer
      );

    };


  /* -------------------------------------------------------
     Started
  ------------------------------------------------------- */

  mediaRecorder.onstart = () => {

    console.log(
      "MediaRecorder started"
    );

    status.textContent =
      "Recording...";
  };


  /* -------------------------------------------------------
     Stopped
  ------------------------------------------------------- */

  mediaRecorder.onstop = () => {

    console.log(
      "MediaRecorder stopped"
    );

    socket.emit(
      "stop-stream"
    );

    status.textContent =
      "Recording stopped";
  };


  /* -------------------------------------------------------
     Error
  ------------------------------------------------------- */

  mediaRecorder.onerror = (event) => {

    console.error(
      "MediaRecorder error:",
      event.error
    );

  };


  /* -------------------------------------------------------
     IMPORTANT:
     1000 = 1 second
  ------------------------------------------------------- */

  mediaRecorder.start(1000);

});


/* =========================================================
   STOP
========================================================= */

stopButton.addEventListener("click", () => {

  if (
    state.mediaRecorder &&
    state.mediaRecorder.state !== "inactive"
  ) {

    state.mediaRecorder.stop();

  }

});
