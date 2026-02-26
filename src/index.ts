import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import routes from "./Routes/index";
import cookieParser from "cookie-parser";
import { Server } from "socket.io";
import http from "http";
import { setupChatSocket } from "./chat/index";
import { notFoundHandler, errorHandler } from "./middlewares/errorHandler.middleware";
import { globalRateLimiter } from "./middlewares/rateLimiter.middleware";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

app.use("/api", globalRateLimiter);

// Use Routes
app.use("/api", routes);

// 404 handler – must come after all routes
app.use(notFoundHandler);

// Central error handler – must be the last middleware (4-arg signature)
app.use(errorHandler);

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.set("io", io);

setupChatSocket(io).catch((err) => {
  console.error("Failed to initialise chat socket:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
