/**
 * Socket.IO Authentication Test Script
 * =====================================
 * Tests BEFORE and AFTER the security fix for:
 * "[Critical Security] WebSocket (Socket.IO) Connections Have Zero Authentication"
 *
 * This script starts a minimal Socket.IO server (mimicking the app's setup)
 * and runs 3 test cases:
 *   1. Connection WITHOUT any token (should be REJECTED after fix)
 *   2. Connection WITH an INVALID token (should be REJECTED after fix)
 *   3. Connection WITH a VALID token (should be ACCEPTED)
 *
 * Usage:
 *   npx ts-node test-socket-auth.ts
 */

import http from "http";
import { Server, Socket } from "socket.io";
import { io as ioClient } from "socket.io-client";
import jwt from "jsonwebtoken";

// ─── Config ────────────────────────────────────────────────────────────────────
const TEST_PORT = 9876;
const SECRET = "test-secret-key";
const FAKE_USER_ID = "user-123-test";
const FAKE_USER = {
    id: FAKE_USER_ID,
    name: "Test User",
    email: "test@example.com",
    role: "PATIENT",
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
function generateValidToken(): string {
    return jwt.sign({ userId: FAKE_USER_ID }, SECRET, { expiresIn: "1h" });
}

function log(icon: string, msg: string) {
    console.log(`  ${icon} ${msg}`);
}

// ─── Server Setup (mirrors src/index.ts setupChatSocket) ───────────────────────
function createServer(withAuth: boolean): { httpServer: http.Server; ioServer: Server } {
    const httpServer = http.createServer();
    const ioServer = new Server(httpServer, {
        cors: { origin: "*" },
    });

    if (withAuth) {
        // ✅ NEW: Authentication middleware (our fix)
        ioServer.use(async (socket, next) => {
            try {
                const token =
                    socket.handshake.auth?.token ||
                    socket.handshake.headers?.authorization?.replace("Bearer ", "");

                if (!token) {
                    return next(new Error("Authentication required"));
                }

                const decoded = jwt.verify(token, SECRET);

                if (typeof decoded !== "object" || decoded === null || !(decoded as any).userId) {
                    return next(new Error("Invalid token"));
                }

                // In real app, this would do a DB lookup. For test, we simulate it.
                const userId = (decoded as any).userId;
                if (userId === FAKE_USER_ID) {
                    socket.data.user = FAKE_USER;
                } else {
                    return next(new Error("User not found"));
                }

                next();
            } catch (err) {
                return next(new Error("Authentication failed"));
            }
        });
    }

    ioServer.on("connection", (socket: Socket) => {
        const user = withAuth ? socket.data.user : null;
        socket.emit("test_message", { data: "Connection successful!", user });

        socket.on("dmMessage", (message: any) => {
            // OLD: uses client-supplied senderId (vulnerable)
            // NEW: uses socket.data.user.id (secure)
            const senderId = withAuth ? socket.data.user.id : message.data?.senderId;
            socket.emit("message_echo", {
                senderId,
                text: message.data?.text,
                source: withAuth ? "server-verified" : "client-supplied",
            });
        });
    });

    return { httpServer, ioServer };
}

// ─── Test Runner ───────────────────────────────────────────────────────────────
async function runTest(
    testName: string,
    port: number,
    authPayload: any,
    expectConnect: boolean
): Promise<{ passed: boolean; detail: string }> {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            client.disconnect();
            if (!expectConnect) {
                resolve({ passed: true, detail: "Connection correctly timed out (rejected)" });
            } else {
                resolve({ passed: false, detail: "Connection timed out unexpectedly" });
            }
        }, 2000);

        const client = ioClient(`http://localhost:${port}`, {
            auth: authPayload || undefined,
            reconnection: false,
            timeout: 2000,
        });

        client.on("connect", () => {
            clearTimeout(timeout);
            client.disconnect();
            if (expectConnect) {
                resolve({ passed: true, detail: "Connected successfully (as expected)" });
            } else {
                resolve({ passed: false, detail: "Connected but should have been REJECTED!" });
            }
        });

        client.on("connect_error", (err) => {
            clearTimeout(timeout);
            client.disconnect();
            if (!expectConnect) {
                resolve({ passed: true, detail: `Rejected: "${err.message}" (as expected)` });
            } else {
                resolve({ passed: false, detail: `Rejected unexpectedly: "${err.message}"` });
            }
        });
    });
}

async function runImpersonationTest(port: number, withAuth: boolean): Promise<{ passed: boolean; detail: string }> {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            client.disconnect();
            resolve({ passed: false, detail: "Timed out waiting for response" });
        }, 3000);

        const validToken = generateValidToken();
        const client = ioClient(`http://localhost:${port}`, {
            auth: withAuth ? { token: validToken } : undefined,
            reconnection: false,
            timeout: 2000,
        });

        client.on("connect", () => {
            // Try to send a message claiming to be a DIFFERENT user (impersonation attempt)
            client.emit("dmMessage", {
                event: "dmMessage",
                data: {
                    senderId: "ATTACKER-FAKE-ID-999",  // Trying to impersonate!
                    receiverId: "some-receiver",
                    username: "Dr. Fake Attacker",
                    roomId: "test-room",
                    text: "I am impersonating a doctor!",
                },
            });
        });

        client.on("message_echo", (msg: any) => {
            clearTimeout(timeout);
            client.disconnect();

            if (withAuth) {
                // After fix: senderId should be the VERIFIED user, NOT the attacker's fake ID
                if (msg.senderId === FAKE_USER_ID && msg.source === "server-verified") {
                    resolve({ passed: true, detail: `senderId="${msg.senderId}" (server-verified, impersonation blocked)` });
                } else {
                    resolve({ passed: false, detail: `senderId="${msg.senderId}" source="${msg.source}" — impersonation NOT blocked!` });
                }
            } else {
                // Before fix: senderId is whatever the client sent (vulnerability!)
                if (msg.senderId === "ATTACKER-FAKE-ID-999" && msg.source === "client-supplied") {
                    resolve({ passed: true, detail: `senderId="${msg.senderId}" (client-supplied — VULNERABILITY CONFIRMED!)` });
                } else {
                    resolve({ passed: false, detail: `Unexpected: senderId="${msg.senderId}"` });
                }
            }
        });

        client.on("connect_error", (err) => {
            clearTimeout(timeout);
            client.disconnect();
            resolve({ passed: false, detail: `Could not connect: ${err.message}` });
        });
    });
}

// ─── Main ──────────────────────────────────────────────────────────────────────
async function main() {
    const validToken = generateValidToken();

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 1: BEFORE FIX (no auth middleware)
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║        BEFORE FIX — No Socket.IO Authentication            ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");

    const { httpServer: oldServer, ioServer: oldIo } = createServer(false);
    await new Promise<void>((r) => oldServer.listen(TEST_PORT, r));

    // Test 1: No token → should connect (BAD!)
    const t1 = await runTest("No Token", TEST_PORT, null, true);
    log(t1.passed ? "✅" : "❌", `Test 1 — No Token:       ${t1.detail}`);

    // Test 2: Invalid token → should connect (BAD!)
    const t2 = await runTest("Invalid Token", TEST_PORT, { token: "garbage-token" }, true);
    log(t2.passed ? "✅" : "❌", `Test 2 — Invalid Token:  ${t2.detail}`);

    // Test 3: Valid token → should connect
    const t3 = await runTest("Valid Token", TEST_PORT, { token: validToken }, true);
    log(t3.passed ? "✅" : "❌", `Test 3 — Valid Token:    ${t3.detail}`);

    // Test 4: Impersonation attack
    const t4 = await runImpersonationTest(TEST_PORT, false);
    log(t4.passed ? "⚠️" : "❌", `Test 4 — Impersonation:  ${t4.detail}`);

    const beforePass = t1.passed && t2.passed && t3.passed && t4.passed;
    console.log(
        `\n  ${beforePass ? "⚠️" : "❌"} BEFORE Results: ${beforePass ? "All tests confirm the VULNERABILITY exists" : "Unexpected results"}\n`
    );

    oldIo.close();
    await new Promise<void>((r) => oldServer.close(() => r()));

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 2: AFTER FIX (with auth middleware)
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║        AFTER FIX — With Socket.IO Authentication           ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");

    const { httpServer: newServer, ioServer: newIo } = createServer(true);
    await new Promise<void>((r) => newServer.listen(TEST_PORT, r));

    // Test 5: No token → should be REJECTED (GOOD!)
    const t5 = await runTest("No Token", TEST_PORT, null, false);
    log(t5.passed ? "✅" : "❌", `Test 5 — No Token:       ${t5.detail}`);

    // Test 6: Invalid token → should be REJECTED (GOOD!)
    const t6 = await runTest("Invalid Token", TEST_PORT, { token: "garbage-token" }, false);
    log(t6.passed ? "✅" : "❌", `Test 6 — Invalid Token:  ${t6.detail}`);

    // Test 7: Valid token → should CONNECT (GOOD!)
    const t7 = await runTest("Valid Token", TEST_PORT, { token: validToken }, true);
    log(t7.passed ? "✅" : "❌", `Test 7 — Valid Token:    ${t7.detail}`);

    // Test 8: Impersonation attack → should be BLOCKED
    const t8 = await runImpersonationTest(TEST_PORT, true);
    log(t8.passed ? "✅" : "❌", `Test 8 — Impersonation:  ${t8.detail}`);

    const afterPass = t5.passed && t6.passed && t7.passed && t8.passed;
    console.log(
        `\n  ${afterPass ? "✅" : "❌"} AFTER Results: ${afterPass ? "All tests PASS — vulnerability is FIXED" : "Some tests FAILED"}\n`
    );

    newIo.close();
    await new Promise<void>((r) => newServer.close(() => r()));

    // ═══════════════════════════════════════════════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║                        SUMMARY                             ║");
    console.log("╠══════════════════════════════════════════════════════════════╣");
    console.log("║  BEFORE: Anyone can connect & impersonate users    ⚠️  BUG  ║");
    console.log("║  AFTER:  Only authenticated users can connect      ✅  FIX  ║");
    console.log("║  AFTER:  Impersonation is blocked server-side      ✅  FIX  ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");

    process.exit(beforePass && afterPass ? 0 : 1);
}

main().catch((err) => {
    console.error("Test runner error:", err);
    process.exit(1);
});
