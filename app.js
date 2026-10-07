import express from "express";
import http from "http";
import { corsMiddleware } from "./config/cors.js";
import cookieParser from "cookie-parser";
import path from "path";

const express_app = express();

/* =========================================================
   GLOBAL MIDDLEWARES
========================================================= */
express_app.use(corsMiddleware);
express_app.use(cookieParser());
express_app.use(express.json());
express_app.use(express.urlencoded({ extended: true }));
express_app.use(express.static(path.resolve('./public')))


/* =========================================================
   API ROUTES
========================================================= */

// Health Check
express_app.get('/api/test', function(req, res) {
  res.json({ message: 'Hello World, Video Streaming is Playing!' });
});

const app = http.createServer(express_app);

export default app;
