import bcrypt from "bcrypt";

const ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, digest: string): Promise<boolean> {
  return bcrypt.compare(plain, digest);
}
