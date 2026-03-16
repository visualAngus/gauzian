import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAuth } from "@/composables/useAuth";

vi.mock("~/utils/crypto", () => ({
  getKeyStatus: vi.fn().mockResolvedValue(true),
  clearAllKeys: vi.fn().mockResolvedValue(undefined),
  saveUserKeysToIndexedDb: vi.fn().mockResolvedValue(undefined),
  decryptPrivateKeyPemWithPassword: vi.fn().mockResolvedValue("mock-private-key"),
  encryptPrivateKeyPemWithPassword: vi.fn().mockResolvedValue({
    encrypted_private_key: "",
    private_key_salt: "",
    iv: "",
  }),
  generateRsaKeyPairPem: vi
    .fn()
    .mockResolvedValue({ publicKey: "mock-pub", privateKey: "mock-priv" }),
  generateRecordKey: vi.fn().mockResolvedValue({
    encrypted_private_key_reco: "",
    recovery_key: "mock-recovery",
  }),
  decryptSimpleDataWithDataKey: vi.fn().mockResolvedValue("{}"),
  decryptWithStoredPrivateKey: vi.fn().mockResolvedValue(new Uint8Array(32)),
}));

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // ─── État initial ──────────────────────────────────────────────────────────

  it("commence avec un utilisateur non authentifié", () => {
    const { isAuthenticated, authToken,user } = useAuth();
    expect(isAuthenticated.value).toBe(false);
    expect(localStorage.getItem("gauzian_auth_token")).toBeNull();
    expect(authToken.value).toBeNull();
    expect(user.value).toBeNull();
  });

  it("charge le token et l'état d'authentification depuis localStorage", () => {
    localStorage.setItem("gauzian_auth_token", "existing-token");
    const { isAuthenticated, authToken } = useAuth();
    expect(isAuthenticated.value).toBe(true);
    expect(authToken.value).toBe("existing-token");
  });

  // ─── login ─────────────────────────────────────────────────────────────────

  describe("login", () => {
    it("authentifie un utilisateur après login réussi", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue({ token: "fake-jwt-token", user_id: "123" }),
        }),
      );
      const { isAuthenticated, login } = useAuth();
      await login("testuser@example.com", "password");
      expect(isAuthenticated.value).toBe(true);
    });

    it("rejette si le backend ne retourne pas de token", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue({ user_id: "123" }),
        }),
      );
      const { login } = useAuth();
      await expect(login("testuser@example.com", "password")).rejects.toThrow(
        "Backend did not return token",
      );
    });

    it("rejette avec le message d'erreur du backend (réponse non-ok)", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
          text: vi.fn().mockResolvedValue("Identifiants invalides"),
        }),
      );
      const { isAuthenticated, login } = useAuth();
      await expect(login("testuser@example.com", "password")).rejects.toThrow(
        "Identifiants invalides",
      );
      expect(isAuthenticated.value).toBe(false);
    });

    it('Verifier lerrer Error response with non-text body', async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401
        }),
      );
      const { login } = useAuth();
      await expect(login("testuser@example.com", "password")).rejects.toThrow(
        "Error response with non-text body"
      );
    });

    it("appelle les fonctions crypto si la réponse contient des clés chiffrées", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue({
            token: "fake-jwt-token",
            user_id: "123",
            encrypted_private_key: "mock-encrypted-key",
            private_key_salt: "mock-salt",
            iv: "mock-iv",
            public_key: "mock-public-key",
          }),
        }),
      );
      const { login } = useAuth();
      await login("testuser@example.com", "password");
      const crypto = await import("~/utils/crypto");
      expect(crypto.decryptPrivateKeyPemWithPassword).toHaveBeenCalled();
      expect(crypto.saveUserKeysToIndexedDb).toHaveBeenCalled();
    });
  });

  // ─── logout ────────────────────────────────────────────────────────────────

  describe("logout", () => {
    it("réinitialise isAuthenticated à false", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue({ token: "fake-jwt-token", user_id: "123" }),
        }),
      );
      const { isAuthenticated, login, logout } = useAuth();
      await login("testuser@example.com", "password");
      await logout();
      expect(isAuthenticated.value).toBe(false);
    });

    it("appelle clearAllKeys pour nettoyer l'IndexedDB", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue({ token: "fake-jwt-token", user_id: "123" }),
        }),
      );
      const { login, logout } = useAuth();
      await login("testuser@example.com", "password");
      await logout();
      const crypto = await import("~/utils/crypto");
      expect(crypto.clearAllKeys).toHaveBeenCalled();
    });

    it("nettoie l'état local même si le backend retourne une erreur", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue({ token: "fake-jwt-token", user_id: "123" }),
        }),
      );
      const { login, logout } = useAuth();
      await login("testuser@example.com", "password");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: vi.fn().mockResolvedValue("Erreur serveur"),
        }),
      );
      await logout();
      const crypto = await import("~/utils/crypto");
      expect(crypto.clearAllKeys).toHaveBeenCalled();
      expect(localStorage.getItem("gauzian_auth_token")).toBeNull();
    });
  });

  // ─── validateSession ───────────────────────────────────────────────────────

  describe("validateSession", () => {
    it("retourne true si le token est valide et les clés présentes", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn()
          .mockResolvedValueOnce({
            ok: true,
            json: vi.fn().mockResolvedValue({ token: "valid-token", user_id: "123" }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: vi.fn().mockResolvedValue({ user_id: "123" }),
          }),
      );
      const { isAuthenticated, login, validateSession } = useAuth();
      await login("testuser@example.com", "password");
      const result = await validateSession();
      expect(result).toBe(true);
      expect(isAuthenticated.value).toBe(true);
    });

    it("retourne false si le token est expiré (401)", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn()
          .mockResolvedValueOnce({
            ok: true,
            json: vi.fn().mockResolvedValue({ token: "valid-token", user_id: "123" }),
          })
          .mockResolvedValueOnce({
            ok: false,
            status: 401,
            text: vi.fn().mockResolvedValue("Token invalide"),
          }),
      );
      const { login, validateSession } = useAuth();
      await login("testuser@example.com", "password");
      const result = await validateSession();
      expect(result).toBe(false);
    });

    it("retourne false si getKeyStatus retourne false (clés absentes)", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue({ user_id: "123" }),
        }),
      );
      const crypto = await import("~/utils/crypto");
      crypto.getKeyStatus.mockResolvedValue(false);
      const { validateSession } = useAuth();
      const result = await validateSession();
      expect(result).toBe(false);
    });

    it("retourne false en cas d'erreur réseau", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
      const { validateSession } = useAuth();
      const result = await validateSession();
      expect(result).toBe(false);
    });
  });

  // ─── requestOtp ────────────────────────────────────────────────────────────

  describe("requestOtp", () => {
    it("appelle le bon endpoint avec l'email", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true }),
      });
      vi.stubGlobal("fetch", mockFetch);
      const { requestOtp } = useAuth();
      await requestOtp("testuser@example.com");
      expect(mockFetch).toHaveBeenCalledWith("/api/register/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "testuser@example.com" }),
      });
    });

    it("rejette avec le message d'erreur si le backend retourne une erreur", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          text: vi.fn().mockResolvedValue("Erreur lors de l'envoi de l'OTP"),
        }),
      );
      const { requestOtp } = useAuth();
      await expect(requestOtp("testuser@example.com")).rejects.toThrow(
        "Erreur lors de l'envoi de l'OTP",
      );
    });
  });

  // ─── validateOtp ───────────────────────────────────────────────────────────

  describe("validateOtp", () => {
    it("appelle le bon endpoint avec email et OTP", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true }),
      });
      vi.stubGlobal("fetch", mockFetch);
      const { validateOtp } = useAuth();
      await validateOtp("testuser@example.com", "123456");
      expect(mockFetch).toHaveBeenCalledWith("/api/register/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "testuser@example.com", otp: "123456" }),
      });
    });

    it("rejette avec le message d'erreur si le backend retourne une erreur HTTP", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          text: vi.fn().mockResolvedValue("OTP invalide"),
        }),
      );
      const { validateOtp } = useAuth();
      await expect(validateOtp("testuser@example.com", "123456")).rejects.toThrow("OTP invalide");
    });
  });

  // ─── finalizeRegistration ──────────────────────────────────────────────────

  describe("finalizeRegistration", () => {
    it("appelle le bon endpoint avec les bons headers", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ token: "fake-token", user_id: "123" }),
      });
      vi.stubGlobal("fetch", mockFetch);
      const { finalizeRegistration } = useAuth();
      await finalizeRegistration("myuser", "pass123", "user@example.com", "temp-token");
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/register/finalize",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: "Bearer temp-token",
          }),
          body: expect.stringContaining('"username":"myuser"'),
        }),
      );
    });

    it("retourne la recovery key en cas de succès", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue({ token: "fake-token", user_id: "123" }),
        }),
      );
      const { finalizeRegistration } = useAuth();
      const recoveryKey = await finalizeRegistration(
        "myuser",
        "pass123",
        "user@example.com",
        "temp-token",
      );
      expect(recoveryKey).toBe("mock-recovery");
    });

    it("rejette si le backend ne retourne pas de token", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue({ user_id: "123" }),
        }),
      );
      const { finalizeRegistration } = useAuth();
      await expect(
        finalizeRegistration("myuser", "pass123", "user@example.com", "temp-token"),
      ).rejects.toThrow("Backend did not return token after registration finalization");
    });

    it("rejette avec le message d'erreur si le backend retourne une erreur HTTP", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          text: vi.fn().mockResolvedValue("Données d'inscription invalides"),
        }),
      );
      const { finalizeRegistration } = useAuth();
      await expect(
        finalizeRegistration("myuser", "pass123", "user@example.com", "temp-token"),
      ).rejects.toThrow("Données d'inscription invalides");
    });

    it("appelle les fonctions crypto (generateRsaKeyPairPem, encryptPrivateKeyPemWithPassword)", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue({ token: "fake-token", user_id: "123" }),
        }),
      );
      const { finalizeRegistration } = useAuth();
      await finalizeRegistration("myuser", "pass123", "user@example.com", "temp-token");
      const crypto = await import("~/utils/crypto");
      expect(crypto.generateRsaKeyPairPem).toHaveBeenCalled();
      expect(crypto.encryptPrivateKeyPemWithPassword).toHaveBeenCalled();
    });
  });
});
