import express from "express";
import http from "http";
import { corsMiddleware } from "./config/cors.js";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import { Server as SocketIO } from "socket.io";
import { spawn } from "child_process";

const express_app = express();

/* =========================================================
   GLOBAL MIDDLEWARES
========================================================= */

express_app.use(corsMiddleware);
express_app.use(cookieParser());
express_app.use(express.json());
express_app.use(express.urlencoded({ extended: true }));

express_app.use(
  express.static(path.resolve("./public"))
);


/* =========================================================
   UPLOAD DIRECTORY
========================================================= */

const uploadsPath = path.resolve("./uploads");

if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, {
    recursive: true,
  });
}


/* =========================================================
   API ROUTES
========================================================= */

express_app.get("/api/test", function(req, res) {
  res.json({
    message: "Hello World, Video Streaming is Playing!",
  });
});


/* =========================================================
   HTTP + SOCKET.IO
========================================================= */

const app = http.createServer(express_app);

const io = new SocketIO(app);


/* =========================================================
   FFMPEG PROCESSES
========================================================= */

// Store FFmpeg process for each stream
const ffmpegProcesses = new Map();


/* =========================================================
   CREATE FFMPEG PROCESS
========================================================= */

function createFFmpegProcess(streamId) {

  const streamDirectory = path.join(
    uploadsPath,
    streamId
  );

  // Create uploads/{stream-id}
  fs.mkdirSync(streamDirectory, {
    recursive: true,
  });

  const outputPath = path.join(
    streamDirectory,
    "output.mp4"
  );

  const options = [
    "-i",
    "-",

    "-c:v",
    "libx264",

    "-preset",
    "ultrafast",

    "-tune",
    "zerolatency",

    "-r",
    "25",

    "-g",
    "50",

    "-keyint_min",
    "25",

    "-crf",
    "25",

    "-pix_fmt",
    "yuv420p",

    "-sc_threshold",
    "0",

    "-profile:v",
    "main",

    "-level",
    "3.1",

    "-c:a",
    "aac",

    "-b:a",
    "128k",

    "-ar",
    "32000",

    // Important for MP4 recording
    "-movflags",
    "+frag_keyframe+empty_moov",

    "-f",
    "mp4",

    outputPath,
  ];

  console.log(
    `Starting FFmpeg for stream: ${streamId}`
  );

  console.log(
    `Output: ${outputPath}`
  );

  const ffmpegProcess = spawn(
    "ffmpeg",
    options
  );


  /* =====================================================
     FFMPEG STDOUT
  ===================================================== */

  ffmpegProcess.stdout.on("data", (data) => {
    console.log(
      `[FFmpeg ${streamId}] ${data}`
    );
  });


  /* =====================================================
     FFMPEG STDERR
  ===================================================== */

  ffmpegProcess.stderr.on("data", (data) => {
    console.error(
      `[FFmpeg ${streamId}] ${data}`
    );
  });


  /* =====================================================
     FFMPEG CLOSE
  ===================================================== */

  ffmpegProcess.on("close", (code) => {

    console.log(
      `FFmpeg ${streamId} exited with code ${code}`
    );

    ffmpegProcesses.delete(streamId);
  });


  /* =====================================================
     FFMPEG ERROR
  ===================================================== */

  ffmpegProcess.on("error", (error) => {

    console.error(
      `FFmpeg ${streamId} error:`,
      error
    );

    ffmpegProcesses.delete(streamId);
  });


  ffmpegProcesses.set(
    streamId,
    ffmpegProcess
  );

  return ffmpegProcess;
}


/* =========================================================
   SOCKET CONNECTION
========================================================= */

io.on("connection", (socket) => {

  console.log(
    "Socket Connected:",
    socket.id
  );


  /* =======================================================
     START STREAM
  ======================================================= */

  socket.on("start-stream", (streamId) => {

    console.log(
      `Starting stream: ${streamId}`
    );

    // Prevent duplicate process
    if (ffmpegProcesses.has(streamId)) {

      console.log(
        `Stream ${streamId} already running`
      );

      return;
    }

    createFFmpegProcess(streamId);

    // Associate socket with stream
    socket.data.streamId = streamId;
  });


  /* =======================================================
     VIDEO DATA
  ======================================================= */

  socket.on("binarystream", (stream) => {

    const streamId =
      socket.data.streamId;

    if (!streamId) {

      console.error(
        "No streamId associated with socket"
      );

      return;
    }

    const ffmpegProcess =
      ffmpegProcesses.get(streamId);

    if (!ffmpegProcess) {

      console.error(
        `FFmpeg process not found for ${streamId}`
      );

      return;
    }

    if (
      ffmpegProcess.stdin &&
      !ffmpegProcess.stdin.destroyed
    ) {

      ffmpegProcess.stdin.write(
        stream,
        (err) => {

          if (err) {
            console.error(
              `FFmpeg stdin error (${streamId}):`,
              err
            );
          }

        }
      );

    }

  });


  /* =======================================================
     STOP STREAM
  ======================================================= */

  socket.on("stop-stream", () => {

    const streamId =
      socket.data.streamId;

    if (!streamId) {
      return;
    }

    const ffmpegProcess =
      ffmpegProcesses.get(streamId);

    if (!ffmpegProcess) {
      return;
    }

    console.log(
      `Stopping stream: ${streamId}`
    );

    // Close stdin so FFmpeg finalizes the MP4
    ffmpegProcess.stdin.end();

    socket.data.streamId = null;
  });


  /* =======================================================
     DISCONNECT
  ======================================================= */

  socket.on("disconnect", () => {

    console.log(
      "Socket Disconnected:",
      socket.id
    );

    const streamId =
      socket.data.streamId;

    if (!streamId) {
      return;
    }

    const ffmpegProcess =
      ffmpegProcesses.get(streamId);

    if (ffmpegProcess) {

      // Gracefully close FFmpeg
      ffmpegProcess.stdin.end();

    }

    socket.data.streamId = null;
  });

});


export default app;
