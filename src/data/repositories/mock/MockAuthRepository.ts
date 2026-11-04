import type { AdminSession, AuthRepository } from "@/data/repositories/types";

/**
 * Demo „přihlášení“: administrace je přístupná komukoli a je tak jasně označená.
 * Nejde o zabezpečení – v produkci nahradí Supabase Auth + RLS.
 */
export class MockAuthRepository implements AuthRepository {
  async getSession(): Promise<AdminSession> {
    return { isDemo: true, profile: null };
  }

  async signOut() {
    /* v demu není co odhlašovat */
  }
}
