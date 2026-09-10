import { PrismaClient } from "@prisma/client";

// Single shared Prisma client instance. In dev with tsx's module reload,
// stash it on globalThis so hot-reloads don't open a new connection pool
// every save.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
