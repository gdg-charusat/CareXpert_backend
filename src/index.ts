import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import routes from "./Routes/index";
import cookieParser from "cookie-parser";
import { Server } from "socket.io";
import http from "http";
import { setupChatSocket } from "./chat/index";
import { notFoundHandler, errorHandler } from "./middlewares/errorHandler.middleware";
import { startAppointmentReminderJob } from "./utils/appointmentReminderJob";

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

// Health check endpoint (before rate limiting)
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

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
  // Server continues running even if socket setup fails
});

// Start appointment reminder job
startAppointmentReminderJob();
console.log("✅ Appointment reminder job started");

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}).on("error", (err) => {
  console.error("Server listen error:", err);
  process.exit(1);
});
