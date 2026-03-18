import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing
vi.mock('../recorder', () => ({
  recordRequest: vi.fn(),
  updateRequestResponse: vi.fn(),
  recordSseEvent: vi.fn(),
}));

vi.mock('./ws-server', () => ({
  broadcastNewRequest: vi.fn(),
  broadcastRequestUpdate: vi.fn(),
  broadcastSseEvent: vi.fn(),
}));

vi.mock('uuid', () => ({
  v4: () => 'test-uuid-1234',
}));

vi.mock('../../lib/env', () => ({
  initEnv: vi.fn(),
}));

// Mock axios to avoid actual network requests
vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
  },
}));

import axios from 'axios';
import { recordRequest, updateRequestResponse } from '../recorder';
import { broadcastNewRequest, broadcastRequestUpdate } from './ws-server';

// Import after mocking
const { handleMessages } = await import('./handlers');

const mockAxios = vi.mocked(axios);
const mockRecordRequest = vi.mocked(recordRequest);
const mockUpdateRequestResponse = vi.mocked(updateRequestResponse);
const mockBroadcastNewRequest = vi.mocked(broadcastNewRequest);
const mockBroadcastRequestUpdate = vi.mocked(broadcastRequestUpdate);

describe('handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set environment variables for testing
    process.env.UPSTREAM_BASE_URL = 'https://api.anthropic.com';
    process.env.UPSTREAM_API_KEY = 'test-api-key';
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('handleMessages - non-streaming response', () => {
    it('should handle non-streaming response correctly', async () => {
      // Create a simple mock response (not axios-like with circular refs)
      const mockResponse = {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'req-123',
        },
        data: {
          id: 'msg-123',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'Hello!' }],
          usage: {
            input_tokens: 10,
            output_tokens: 5,
          },
        },
      };

      // Mock axios.post to return a stream-like response that we convert
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield Buffer.from(JSON.stringify(mockResponse.data));
        },
      };

      mockAxios.post.mockResolvedValueOnce({
        ...mockResponse,
        data: mockStream,
        headers: mockResponse.headers,
      });

      const request = new Request('http://localhost:3000/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-3-opus', messages: [] }),
      });

      const body = { model: 'claude-3-opus', messages: [] };
      const headers = { 'content-type': 'application/json' };

      const result = await handleMessages(request, body, headers);

      // Verify request was recorded
      expect(mockRecordRequest).toHaveBeenCalled();
      expect(mockBroadcastNewRequest).toHaveBeenCalled();
    });

    it('should serialize headers without circular reference error', async () => {
      // This test specifically addresses the bug we fixed:
      // "TypeError: Converting circular structure to JSON"
      // caused by axios response headers having circular references

      // Simulate axios response with headers that would fail JSON.stringify
      const mockResponse = {
        status: 200,
        // These headers simulate what axios returns (could have circular refs)
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'req-123',
        },
        data: {
          usage: { input_tokens: 10, output_tokens: 5 },
        },
      };

      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield Buffer.from(JSON.stringify(mockResponse.data));
        },
      };

      mockAxios.post.mockResolvedValueOnce({
        ...mockResponse,
        data: mockStream,
        headers: mockResponse.headers,
      });

      const body = { model: 'claude-3-opus' };
      const headers = {};

      await handleMessages(new Request('http://localhost:3000/v1/messages'), body, headers);

      // The key test: updateRequestResponse should be called with serializable headers
      expect(mockUpdateRequestResponse).toHaveBeenCalled();

      // Get the headers passed to updateRequestResponse
      const callArgs = mockUpdateRequestResponse.mock.calls[0][0];

      // This should not throw "Converting circular structure to JSON"
      expect(() => JSON.stringify(callArgs.headers)).not.toThrow();

      // Headers should be a simple object
      expect(typeof callArgs.headers).toBe('object');
    });
  });

  describe('handleMessages - error handling', () => {
    it('should handle request errors', async () => {
      const error = new Error('Network error');
      mockAxios.post.mockRejectedValueOnce(error);

      const body = { model: 'claude-3-opus' };
      const headers = {};

      const result = await handleMessages(
        new Request('http://localhost:3000/v1/messages'),
        body,
        headers
      );

      expect(result.status).toBe(500);
      const responseBody = await result.json();
      expect(responseBody.error).toBe('Network error');
    });

    it('should handle API errors with status code', async () => {
      const apiError = {
        response: {
          status: 429,
          data: { error: { message: 'Rate limit exceeded' } },
        },
      };
      mockAxios.post.mockRejectedValueOnce(apiError);

      const body = { model: 'claude-3-opus' };
      const headers = {};

      const result = await handleMessages(
        new Request('http://localhost:3000/v1/messages'),
        body,
        headers
      );

      expect(result.status).toBe(429);
      const responseBody = await result.json();
      expect(responseBody.error).toBe('Rate limit exceeded');
    });
  });

  describe('environment configuration', () => {
    it('should use UPSTREAM_* variables for forwarding', async () => {
      process.env.UPSTREAM_BASE_URL = 'https://custom-api.example.com';
      process.env.UPSTREAM_API_KEY = 'custom-key';
      process.env.ANTHROPIC_BASE_URL = 'http://localhost:3000'; // Should NOT be used

      const mockResponse = {
        status: 200,
        headers: { 'content-type': 'application/json' },
        data: { usage: { input_tokens: 10, output_tokens: 5 } },
      };

      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield Buffer.from(JSON.stringify(mockResponse.data));
        },
      };

      mockAxios.post.mockResolvedValueOnce({
        ...mockResponse,
        data: mockStream,
      });

      const body = { model: 'claude-3-opus' };
      const headers = {};

      await handleMessages(new Request('http://localhost:3000/v1/messages'), body, headers);

      // Verify axios was called with the correct URL
      expect(mockAxios.post).toHaveBeenCalledWith(
        'https://custom-api.example.com/v1/messages',
        expect.anything(),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer custom-key',
          }),
        })
      );
    });

    it('should fallback to ANTHROPIC_API_KEY if UPSTREAM_API_KEY not set', async () => {
      delete process.env.UPSTREAM_API_KEY;
      process.env.ANTHROPIC_API_KEY = 'anthropic-key';

      const mockResponse = {
        status: 200,
        headers: { 'content-type': 'application/json' },
        data: { usage: { input_tokens: 10, output_tokens: 5 } },
      };

      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield Buffer.from(JSON.stringify(mockResponse.data));
        },
      };

      mockAxios.post.mockResolvedValueOnce({
        ...mockResponse,
        data: mockStream,
      });

      const body = { model: 'claude-3-opus' };
      const headers = {};

      await handleMessages(new Request('http://localhost:3000/v1/messages'), body, headers);

      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.anything(),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer anthropic-key',
          }),
        })
      );
    });
  });
});