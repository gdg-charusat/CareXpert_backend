/**
 * test-socket-server.js
 *
 * In-process Socket.IO test server that exercises the REAL production
 * authentication middleware (socketAuth.middleware.ts) with a mock data
 * store injected via the createSocketAuthMiddleware factory.
 *
 * No local re-implementation of auth logic exists here — if the production
 * middleware changes, these tests will immediately reflect it.
 *
 * Usage:  node test-socket-server.js  (or: npm run test:socket)
 *
 * The script:
 *   1. Registers ts-node so the real TypeScript middleware can be imported
 *   2. Starts an in-process Socket.IO server on port 3099 (TEST_PORT env)
 *   3. Injects a mock findUser into createSocketAuthMiddleware
 *   4. Runs all scenarios and exits 0 (pass) or 1 (fail)
 */

const http = require("http");
const jwt  = require("jsonwebtoken");
const { Server } = require("socket.io");
const { io: socketClient } = require("socket.io-client");

// ─── Shared secret injected before importing the production middleware ────────
const TEST_SECRET = "carexpert-test-secret-2026";
process.env.ACCESS_TOKEN_SECRET = TEST_SECRET;

const path = require("path");

// Register ts-node so we can require() TypeScript source files directly
require("ts-node").register({
  transpileOnly: true,          // skip type-checking for speed
  compilerOptions: { module: "commonjs" },
});

// Stub prismClient.ts in the module cache BEFORE any file that imports it is
// loaded.  The production middleware's actual DB call is already replaced by
// mockFindUser (injected via the factory), so the real Prisma instance is
// never invoked during tests.  This prevents the need for `prisma generate`
// or a live database connection.
const prismClientPath = path.resolve(__dirname, "src", "utils", "prismClient.ts");
require.cache[prismClientPath] = {
  id: prismClientPath,
  filename: prismClientPath,
  loaded: true,
  exports: { default: {} }, // empty stub — never called in tests
};

// Import the REAL production factory — no local copy of the logic
const { createSocketAuthMiddleware } = require("./src/middlewares/socketAuth.middleware");

const TEST_PORT = process.env.TEST_PORT || 3099;
const BASE_URL  = `http://localhost:${TEST_PORT}`;

// ─── Mock user store (replaces the Prisma DB call only) ──────────────────────
const MOCK_USER = {
  id:           "user-test-001",
  name:         "Test User",
  role:         "PATIENT",
  tokenVersion: 1,
};

/**
 * Mock findUser — injected into the real middleware factory.
 * Returns MOCK_USER for the known test id, null for everyone else.
 * The authentication logic (JWT parsing, header extraction, tokenVersion
 * checking, error messages) is all exercised from the production source.
 */
async function mockFindUser(userId) {
  return userId === MOCK_USER.id ? { ...MOCK_USER } : null;
}

// Tokens signed with TEST_SECRET (same value injected into ACCESS_TOKEN_SECRET)
const VALID_TOKEN = jwt.sign(
  { userId: MOCK_USER.id, tokenVersion: MOCK_USER.tokenVersion },
  TEST_SECRET,
  { expiresIn: "1h" }
);

// Token for a user that does not exist in the mock store
const GHOST_TOKEN = jwt.sign(
  { userId: "user-ghost-999", tokenVersion: 1 },
  TEST_SECRET,
  { expiresIn: "1h" }
);

// Token with wrong tokenVersion (simulates post-logout invalidation)
const STALE_TOKEN = jwt.sign(
  { userId: MOCK_USER.id, tokenVersion: 0 },
  TEST_SECRET,
  { expiresIn: "1h" }
);

// ─── Build server using the REAL middleware with mock data store ──────────────
const app        = require("express")();
const httpServer = http.createServer(app);
const io         = new Server(httpServer, { cors: { origin: "*" }, transports: ["websocket"] });

const roomNsp = io.of("/chat/room");
const dmNsp   = io.of("/chat/dm");

// createSocketAuthMiddleware is the production factory — only findUser is mocked
roomNsp.use(createSocketAuthMiddleware(mockFindUser));
dmNsp.use(createSocketAuthMiddleware(mockFindUser));

roomNsp.on("connection", (socket) => {
  socket.on("joinRoom", (msg) => {
    const { roomId } = msg.data || {};
    // Use server-verified identity — never trust client-supplied username/userId
    const username = socket.data.name;
    socket.join(roomId);
    socket.emit("message", {
      text: `Welcome to ${roomId} room!`,
      username: "CareXpert Bot",
      createdAt: new Date(),
    });
    socket.broadcast.to(roomId).emit("message", {
      text: `${username} has joined the room.`,
      username: "CareXpert Bot",
      createdAt: new Date(),
    });
  });

  socket.on("roomMessage", (msg) => {
    const { roomId, text } = msg.data || {};
    // Use server-verified identity — never trust client-supplied username/senderId
    const username = socket.data.name;
    socket.to(roomId).emit("message", { text, username, createdAt: new Date() });
  });
});

dmNsp.on("connection", (socket) => {
  // Mirrors the joinRoom envelope: { event, data: { roomId } }
  socket.on("joinDmRoom", (msg) => {
    const { roomId } = msg.data || {};
    socket.join(roomId);
    // Acknowledge back to the joiner — silent to others (private conversation)
    socket.emit("message", {
      username: "CareXpert Bot",
      text: `Connected to DM room.`,
      roomId,
      createdAt: new Date(),
    });
  });

  socket.on("dmMessage", (msg) => {
    const { roomId, text } = msg.data || {};
    // Exclude sender — mirrors roomMessage's socket.to() pattern
    const username = socket.data.name;
    socket.to(roomId).emit("message", { text, username, createdAt: new Date() });
  });
});

// ─── Test Runner ─────────────────────────────────────────────────────────────
const TIMEOUT_MS = 4000;
let passed = 0;
let failed = 0;

function ok(label)      { console.log(`  ✅  PASS  ${label}`); passed++; }
function no(label, why) { console.error(`  ❌  FAIL  ${label}\n            ${why}`); failed++; }

function connect(namespace, token, useHeader = false) {
  return new Promise((resolve, reject) => {
    const opts = {
      transports:   ["websocket"],
      auth:         useHeader ? {} : (token ? { token } : {}),
      extraHeaders: useHeader && token ? { authorization: `Bearer ${token}` } : {},
      timeout:      TIMEOUT_MS,
    };
    const s = socketClient(`${BASE_URL}${namespace}`, opts);
    const cleanup = () => { s.off("connect"); s.off("connect_error"); };
    s.once("connect",       () => { cleanup(); resolve(s); });
    s.once("connect_error", (e) => { cleanup(); s.disconnect(); reject(e.message || String(e)); });
  });
}

function waitFor(socket, event, ms = TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout waiting for "${event}"`)), ms);
    socket.once(event, (d) => { clearTimeout(t); resolve(d); });
  });
}

// ─── Domain suite 1: Authentication rejection scenarios ──────────────────────
// Groups 1-4: every combination of missing / bad / ghost / stale token must be
// rejected with a descriptive "Authentication error: …" message on both namespaces.
async function testAuthRejections() {
  console.log("\n[Group 1] Reject connections with NO token\n");
  for (const ns of ["/chat/room", "/chat/dm"]) {
    try   { const s = await connect(ns, null); s.disconnect(); no(`${ns} → rejected (no token)`, "Connected unexpectedly"); }
    catch (e) { e.includes("Authentication") ? ok(`${ns} → rejected: "${e}"`) : no(`${ns} → rejected (no token)`, e); }
  }

  console.log("\n[Group 2] Reject connections with INVALID (garbage) token\n");
  for (const ns of ["/chat/room", "/chat/dm"]) {
    try   { const s = await connect(ns, "garbage.token.value"); s.disconnect(); no(`${ns} → rejected (invalid token)`, "Connected unexpectedly"); }
    catch (e) { e.includes("Authentication") ? ok(`${ns} → rejected: "${e}"`) : no(`${ns} → rejected (invalid token)`, e); }
  }

  console.log("\n[Group 3] Reject connections for non-existent / deleted user\n");
  for (const ns of ["/chat/room", "/chat/dm"]) {
    try   { const s = await connect(ns, GHOST_TOKEN); s.disconnect(); no(`${ns} → rejected (ghost user)`, "Connected unexpectedly"); }
    catch (e) { e.includes("Authentication") ? ok(`${ns} → rejected: "${e}"`) : no(`${ns} → rejected (ghost user)`, e); }
  }

  console.log("\n[Group 4] Reject connections with invalidated (stale) token\n");
  for (const ns of ["/chat/room", "/chat/dm"]) {
    try   { const s = await connect(ns, STALE_TOKEN); s.disconnect(); no(`${ns} → rejected (stale token)`, "Connected unexpectedly"); }
    catch (e) { e.includes("Authentication") ? ok(`${ns} → rejected: "${e}"`) : no(`${ns} → rejected (stale token)`, e); }
  }
}

// ─── Domain suite 2: Authentication acceptance scenarios ─────────────────────
// Groups 5-6: valid token (via auth payload and Authorization header) must be
// accepted on both namespaces. Returns the two persistent sockets needed by
// the event suites so they share a single authenticated connection.
async function testAuthAcceptance() {
  let roomS, dmS;

  console.log("\n[Group 5] ACCEPT connections with VALID token\n");
  try   { roomS = await connect("/chat/room", VALID_TOKEN); ok(`/chat/room → accepted  id=${roomS.id}`); }
  catch (e) { no("/chat/room → accepted (valid token)", e); }

  try   { dmS = await connect("/chat/dm", VALID_TOKEN); ok(`/chat/dm   → accepted  id=${dmS.id}`); }
  catch (e) { no("/chat/dm → accepted (valid token)", e); }

  console.log("\n[Group 6] ACCEPT connections with valid token passed as Authorization HEADER\n");
  let hRoomS, hDmS;
  try   { hRoomS = await connect("/chat/room", VALID_TOKEN, true); ok(`/chat/room → accepted via header  id=${hRoomS.id}`); }
  catch (e) { no("/chat/room → accepted (header token)", e); }
  try   { hDmS = await connect("/chat/dm",   VALID_TOKEN, true); ok(`/chat/dm   → accepted via header  id=${hDmS.id}`); }
  catch (e) { no("/chat/dm → accepted (header token)", e); }
  hRoomS?.disconnect();
  hDmS?.disconnect();

  return { roomS, dmS };
}

// ─── Domain suite 3: /chat/room event handling ───────────────────────────────
// Group 7: joinRoom welcome ack and roomMessage broadcast to a second socket.
async function testRoomEvents(roomS) {
  console.log("\n[Group 7] /chat/room  –  joinRoom and roomMessage events\n");

  if (!roomS?.connected) {
    no("Group 7", "roomS socket is not connected — skipping room event tests");
    return;
  }

  try {
    const p = waitFor(roomS, "message");
    roomS.emit("joinRoom", { event: "joinRoom", data: { roomId: "room-alpha" } });
    const m = await p;
    m?.text?.includes("Welcome")
      ? ok(`joinRoom → welcome: "${m.text}"`)
      : no("joinRoom → welcome message", JSON.stringify(m));
  } catch (e) { no("joinRoom → welcome message", e.message); }

  let roomS2;
  try {
    roomS2 = await connect("/chat/room", VALID_TOKEN);
    roomS2.emit("joinRoom", { event: "joinRoom", data: { roomId: "room-alpha" } });
    await new Promise((r) => setTimeout(r, 300)); // let join settle
    roomS2.once("message", () => {});             // consume welcome on roomS2

    const broadcast = waitFor(roomS2, "message");
    roomS.emit("roomMessage", { event: "roomMessage", data: { roomId: "room-alpha", text: "Hello namespace!" } });
    const m = await broadcast;
    m?.text === "Hello namespace!"
      ? ok(`roomMessage → broadcast received: "${m.text}"`)
      : no("roomMessage → broadcast", JSON.stringify(m));
  } catch (e) { no("roomMessage → broadcast to second socket", e.message); }
  finally { roomS2?.disconnect(); }
}

// ─── Domain suite 4: /chat/dm event handling ─────────────────────────────────
// Group 8: joinDmRoom welcome ack, dmMessage delivery, and sender-exclusion.
async function testDmEvents(dmS) {
  console.log("\n[Group 8] /chat/dm  –  joinDmRoom and dmMessage events\n");

  if (!dmS?.connected) {
    no("Group 8", "dmS socket is not connected — skipping DM event tests");
    return;
  }

  const DM_ROOM = "dm-alpha-beta";

  try {
    const ackPromise = waitFor(dmS, "message");
    dmS.emit("joinDmRoom", { event: "joinDmRoom", data: { roomId: DM_ROOM } });
    const ack = await ackPromise;
    ack?.text?.includes("Connected")
      ? ok(`joinDmRoom "${DM_ROOM}" → welcome ack received: "${ack.text}"`)
      : no("joinDmRoom → welcome ack", JSON.stringify(ack));
  } catch (e) { no("joinDmRoom → welcome ack", e.message); }

  let dmS2;
  try {
    dmS2 = await connect("/chat/dm", VALID_TOKEN);
    dmS2.emit("joinDmRoom", { event: "joinDmRoom", data: { roomId: DM_ROOM } });
    await waitFor(dmS2, "message"); // consume join ack on dmS2

    let senderEcho = null;
    dmS.once("message", (m) => (senderEcho = m));

    const msgPromise = waitFor(dmS2, "message");
    dmS.emit("dmMessage", { event: "dmMessage", data: { roomId: DM_ROOM, receiverId: "user-receiver-002", text: "DM namespace test!" } });
    const m = await msgPromise;

    m?.text === "DM namespace test!"
      ? ok(`dmMessage → received on second socket: "${m.text}"`)
      : no("dmMessage → received", JSON.stringify(m));

    await new Promise((r) => setTimeout(r, 200)); // wait for any accidental echo
    senderEcho === null
      ? ok("dmMessage → sender is NOT echoed (socket.to behaviour)")
      : no("dmMessage → sender exclusion", `sender received echo: ${JSON.stringify(senderEcho)}`);
  } catch (e) { no("dmMessage → received on second socket", e.message); }
  finally { dmS2?.disconnect(); }
}

// ─── Top-level orchestrator ──────────────────────────────────────────────────
async function run() {
  console.log("\n" + "=".repeat(62));
  console.log("  CareXpert Socket.IO  –  Namespace + Auth Test Suite");
  console.log(`  Server : ${BASE_URL}  (in-process test server)`);
  console.log("=".repeat(62));

  await testAuthRejections();

  const { roomS, dmS } = await testAuthAcceptance();

  await testRoomEvents(roomS);
  await testDmEvents(dmS);

  roomS?.disconnect();
  dmS?.disconnect();

  console.log("\n" + "=".repeat(62));
  const allPassed = failed === 0;
  console.log(` Results:  ${passed} passed  /  ${failed} failed  — ${allPassed ? "ALL TESTS PASSED ✅" : "SOME TESTS FAILED ❌"}`);
  console.log("=".repeat(62) + "\n");

  io.close();
  httpServer.close();
  process.exit(allPassed ? 0 : 1);
}

// Start the in-process test server then run all tests
httpServer.listen(TEST_PORT, () => {
  console.log(`\n[server] Test server started on port ${TEST_PORT}`);
  run().catch((e) => { console.error(e); process.exit(1); });
});
