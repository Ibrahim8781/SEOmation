import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock axios
const mockAxios = {
  post: jest.fn()
};

jest.unstable_mockModule('axios', () => ({
  default: mockAxios
}));

describe('AI Adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should pass basic test', () => {
    expect(true).toBe(true);
  });
});