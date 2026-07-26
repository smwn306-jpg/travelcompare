import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma before importing the service, so no real database is touched.
const mockUser = {
  findUnique: vi.fn(),
  create: vi.fn(),
};
const mockRefreshToken = {
  create: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
};

vi.mock("../src/db/prisma.js", () => ({
  prisma: {
    user: mockUser,
    refreshToken: mockRefreshToken,
  },
}));

const { registerUser, loginUser } = await import("../src/modules/auth/auth.service.js");
const { ConflictError, UnauthorizedError } = await import("../src/middleware/errorHandler.js");

describe("auth.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRefreshToken.create.mockResolvedValue({ id: "rt_1" });
  });

  describe("registerUser", () => {
    it("creates a new user and returns tokens when email is free", async () => {
      mockUser.findUnique.mockResolvedValue(null);
      mockUser.create.mockResolvedValue({
        id: "user_1",
        email: "test@example.com",
        fullName: "Test User",
        role: "user",
        passwordHash: "irrelevant-for-this-assertion",
      });

      const result = await registerUser({
        email: "test@example.com",
        password: "StrongPass123",
        fullName: "Test User",
      });

      expect(result.user).toEqual({
        id: "user_1",
        email: "test@example.com",
        fullName: "Test User",
        role: "user",
      });
      expect(result.tokens.accessToken).toEqual(expect.any(String));
      expect(result.tokens.refreshToken).toEqual(expect.any(String));
      expect(mockRefreshToken.create).toHaveBeenCalledOnce();
    });

    it("throws ConflictError when the email is already taken", async () => {
      mockUser.findUnique.mockResolvedValue({ id: "existing_user" });

      await expect(
        registerUser({ email: "taken@example.com", password: "StrongPass123", fullName: "Someone" })
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe("loginUser", () => {
    it("throws UnauthorizedError for a non-existent email", async () => {
      mockUser.findUnique.mockResolvedValue(null);

      await expect(
        loginUser({ email: "nobody@example.com", password: "whatever123" })
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it("throws UnauthorizedError when the account is deactivated", async () => {
      mockUser.findUnique.mockResolvedValue({
        id: "user_1",
        isActive: false,
        passwordHash: "hash",
        role: "user",
      });

      await expect(
        loginUser({ email: "deactivated@example.com", password: "whatever123" })
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });
  });
});
