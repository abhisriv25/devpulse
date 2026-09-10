/**
 * pgvector's textual input format for a vector literal: `[0.1,0.2,0.3]`.
 * Used whenever a JS number[] needs to cross into a raw SQL query as a
 * `::vector`-cast parameter — Prisma Client has no native binding for
 * pgvector's type, so every embedding read/write goes through this.
 */
export function toPgVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}
