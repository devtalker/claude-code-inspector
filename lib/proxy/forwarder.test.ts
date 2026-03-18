import { describe, it, expect } from 'vitest';
import {
  extractSessionId,
  extractUsage,
  buildForwardHeaders,
  isSseResponse,
} from './forwarder';

describe('extractSessionId', () => {
  it('should extract session id from headers (lowercase)', () => {
    const headers = { 'x-session-id': 'session-123' };
    const body = {};
    expect(extractSessionId(headers, body)).toBe('session-123');
  });

  it('should extract session id from headers (uppercase)', () => {
    const headers = { 'X-Session-Id': 'session-456' };
    const body = {};
    expect(extractSessionId(headers, body)).toBe('session-456');
  });

  it('should extract session id from body metadata', () => {
    const headers = {};
    const body = { metadata: { session_id: 'session-789' } };
    expect(extractSessionId(headers, body)).toBe('session-789');
  });

  it('should prioritize headers over body', () => {
    const headers = { 'x-session-id': 'header-session' };
    const body = { metadata: { session_id: 'body-session' } };
    expect(extractSessionId(headers, body)).toBe('header-session');
  });

  it('should return null when no session id found', () => {
    const headers = {};
    const body = {};
    expect(extractSessionId(headers, body)).toBeNull();
  });
});

describe('extractUsage', () => {
  it('should extract usage from response', () => {
    const response = {
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_read_input_tokens: 20,
        cache_creation_input_tokens: 10,
      },
    };
    const result = extractUsage(response);
    expect(result).toEqual({
      input_tokens: 100,
      output_tokens: 50,
      cache_read_tokens: 20,
      cache_creation_tokens: 10,
    });
  });

  it('should return zeros when no usage', () => {
    const response = {};
    const result = extractUsage(response);
    expect(result).toEqual({
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      cache_creation_tokens: 0,
    });
  });

  it('should handle partial usage', () => {
    const response = {
      usage: {
        input_tokens: 100,
        output_tokens: 50,
      },
    };
    const result = extractUsage(response);
    expect(result).toEqual({
      input_tokens: 100,
      output_tokens: 50,
      cache_read_tokens: 0,
      cache_creation_tokens: 0,
    });
  });

  it('should handle null response', () => {
    const result = extractUsage(null);
    expect(result).toEqual({
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      cache_creation_tokens: 0,
    });
  });
});

describe('buildForwardHeaders', () => {
  it('should build headers with api key', () => {
    const originalHeaders = {};
    const config = { baseUrl: 'https://api.example.com', apiKey: 'test-key' };
    const result = buildForwardHeaders(originalHeaders, config);
    expect(result).toEqual({
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-key',
    });
  });

  it('should preserve specific headers', () => {
    const originalHeaders = {
      'x-api-key': 'original-key',
      'x-request-id': 'req-123',
      'user-agent': 'test-agent',
      'other-header': 'should-not-preserve',
    };
    const config = { baseUrl: 'https://api.example.com', apiKey: 'test-key' };
    const result = buildForwardHeaders(originalHeaders, config);
    expect(result['x-api-key']).toBe('original-key');
    expect(result['x-request-id']).toBe('req-123');
    expect(result['user-agent']).toBe('test-agent');
    expect(result['other-header']).toBeUndefined();
  });

  it('should not preserve headers that are not in the list', () => {
    const originalHeaders = {
      'some-random-header': 'value',
    };
    const config = { baseUrl: 'https://api.example.com', apiKey: 'test-key' };
    const result = buildForwardHeaders(originalHeaders, config);
    expect(result['some-random-header']).toBeUndefined();
  });
});

describe('isSseResponse', () => {
  it('should return true for text/event-stream content type', () => {
    const response = {
      headers: {
        'content-type': 'text/event-stream',
      },
    };
    expect(isSseResponse(response)).toBe(true);
  });

  it('should return true for text/event-stream with charset', () => {
    const response = {
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
      },
    };
    expect(isSseResponse(response)).toBe(true);
  });

  it('should return false for application/json', () => {
    const response = {
      headers: {
        'content-type': 'application/json',
      },
    };
    expect(isSseResponse(response)).toBe(false);
  });

  it('should return false when no content-type', () => {
    const response = { headers: {} };
    expect(isSseResponse(response)).toBe(false);
  });

  it('should return false when no headers', () => {
    const response = {};
    expect(isSseResponse(response)).toBe(false);
  });
});