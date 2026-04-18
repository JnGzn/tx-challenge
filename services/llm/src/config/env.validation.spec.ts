import 'reflect-metadata';
import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  const valid = {
    HTTP_PORT: 3000,
    DATABASE_URL: 'postgres://localhost/db',
    KAFKA_BROKERS: 'kafka:9092',
    KAFKA_CLIENT_ID: 'llm',
    KAFKA_GROUP_ID: 'llm-group',
    GEMINI_API_KEY: 'sk-xxxxxxxxxxxxx'
  };

  it('returns the validated config with defaults for optionals', () => {
    const result = validateEnv(valid);
    expect(result.HTTP_PORT).toBe(3000);
    expect(result.GEMINI_MODEL).toBeUndefined();
    expect(result.LLM_TEMPERATURE).toBeUndefined();
    expect(result.LLM_HISTORY_LIMIT).toBeUndefined();
  });

  it('accepts optional LLM_TEMPERATURE within [0,2]', () => {
    const result = validateEnv({ ...valid, LLM_TEMPERATURE: 1.2 });
    expect(result.LLM_TEMPERATURE).toBe(1.2);
  });

  it('rejects LLM_TEMPERATURE out of range', () => {
    expect(() => validateEnv({ ...valid, LLM_TEMPERATURE: 5 })).toThrow(
      /Invalid environment/
    );
  });

  it('accepts LLM_HISTORY_LIMIT within range', () => {
    const result = validateEnv({ ...valid, LLM_HISTORY_LIMIT: 50 });
    expect(result.LLM_HISTORY_LIMIT).toBe(50);
  });

  it('rejects LLM_HISTORY_LIMIT above 200', () => {
    expect(() => validateEnv({ ...valid, LLM_HISTORY_LIMIT: 500 })).toThrow(
      /Invalid environment/
    );
  });

  it('rejects too-short GEMINI_API_KEY', () => {
    expect(() => validateEnv({ ...valid, GEMINI_API_KEY: 'short' })).toThrow(
      /Invalid environment/
    );
  });

  it('rejects missing required fields', () => {
    const { DATABASE_URL: _omit, ...rest } = valid;
    expect(() => validateEnv(rest)).toThrow(/Invalid environment/);
  });
});
