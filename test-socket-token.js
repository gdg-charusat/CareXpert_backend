/**
 * test-socket-token.js
 *
 * Generates a short-lived JWT for use in Postman / socket tests.
 * Usage:  node test-socket-token.js <userId>
 *
 * If no userId is supplied the script lists the first 5 users in the
 * database so you can pick one.
 *
 * Example:
 *   node test-socket-token.js cm1abc123def
 */

require("dotenv").config();
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const SECRET = process.env.ACCESS_TOKEN_SECRET;

if (!SECRET) {
  console.error("ERROR: ACCESS_TOKEN_SECRET is not set in .env");
  process.exit(1);
}

async function main() {
  const userId = process.argv[2];

  if (!userId) {
    console.log("No userId supplied. Listing first 5 users:\n");
    const users = await prisma.user.findMany({
      take: 5,
      select: { id: true, name: true, email: true, role: true },
    });
    if (!users.length) {
      console.log("No users found in the database.");
    } else {
      users.forEach((u) =>
        console.log(`  id=${u.id}  name=${u.name}  email=${u.email}  role=${u.role}`)
      );
      console.log(
        "\nRun:  node test-socket-token.js <userId>  to generate a token."
      );
    }
    await prisma.$disconnect();
    return;
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true, name: true, email: true, role: true, tokenVersion: true },
  });

  if (!user) {
    console.error(`ERROR: User with id="${userId}" not found or is deleted.`);
    await prisma.$disconnect();
    process.exit(1);
  }

  const token = jwt.sign(
    { userId: user.id, tokenVersion: user.tokenVersion },
    SECRET,
    { expiresIn: "2h" }
  );

  console.log("\n========================================");
  console.log(" Test JWT (valid for 2 hours)");
  console.log("========================================");
  console.log(`  User  : ${user.name} <${user.email}> [${user.role}]`);
  console.log(`  userId: ${user.id}`);
  console.log("\n  TOKEN:");
  console.log(`  ${token}`);
  console.log("\n  Use in Postman Socket.IO → Connection > Auth:");
  console.log('  Key  : token');
  console.log(`  Value: ${token}`);
  console.log("========================================\n");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
