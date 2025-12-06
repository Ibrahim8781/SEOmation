import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import bcrypt from 'bcryptjs';

// Import after mocking in setup.js
const { AuthService } = await import('../src/services/auth.service.js');

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Password123!',
        name: 'Test User'
      };

      const hashedPassword = await bcrypt.hash(userData.password, 12);
      const mockUser = {
        id: 'user-1',
        email: userData.email,
        name: userData.name,
        passwordHash: hashedPassword,
        createdAt: new Date()
      };

      global.mockPrisma.user.findUnique.mockResolvedValue(null);
      global.mockPrisma.user.create.mockResolvedValue(mockUser);
      global.mockPrisma.refreshToken.create.mockResolvedValue({ token: 'refresh-token-123' });

      const result = await AuthService.register(userData);

      expect(global.mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: userData.email }
      });
      expect(global.mockPrisma.user.create).toHaveBeenCalled();
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe(userData.email);
    });

    it('should throw error if email already exists', async () => {
      const userData = {
        email: 'existing@example.com',
        password: 'Password123!',
        name: 'Test User'
      };

      const existingUser = { 
        id: 'user-1', 
        email: userData.email,
        passwordHash: 'hashed',
        name: 'Existing User'
      };

      global.mockPrisma.user.findUnique.mockResolvedValue(existingUser);

      await expect(AuthService.register(userData)).rejects.toThrow('Email already in use');
    });
  });

  describe('login', () => {
    it('should login user with correct credentials', async () => {
      const email = 'test@example.com';
      const password = 'Password123!';
      const hashedPassword = await bcrypt.hash(password, 12);

      const mockUser = {
        id: 'user-1',
        email,
        passwordHash: hashedPassword,
        name: 'Test User'
      };

      global.mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      global.mockPrisma.refreshToken.create.mockResolvedValue({ token: 'refresh-token-123' });

      const result = await AuthService.login({ email, password });

      expect(global.mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email }
      });
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw error with invalid email', async () => {
      global.mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        AuthService.login({ email: 'wrong@example.com', password: 'wrongpass' })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw error with invalid password', async () => {
      const hashedPassword = await bcrypt.hash('correctpass', 12);
      
      global.mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: hashedPassword,
        name: 'Test'
      });

      await expect(
        AuthService.login({ email: 'test@example.com', password: 'wrongpass' })
      ).rejects.toThrow('Invalid credentials');
    });
  });
});