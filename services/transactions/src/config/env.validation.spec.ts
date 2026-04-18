import 'reflect-metadata';
import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  const valid = {
    HTTP_PORT: 3000,
    DATABASE_URL: 'postgres://localhost/db',
    KAFKA_BROKERS: 'kafka:9092',
    KAFKA_CLIENT_ID: 'transactions',
    KAFKA_GROUP_ID: 'transactions-group'
  };

  it('returns the validated config', () => {
    const result = validateEnv(valid);
    expect(result.HTTP_PORT).toBe(3000);
    expect(result.TRANSACTIONS_LIST_LIMIT).toBeUndefined();
  });

  it('accepts optional TRANSACTIONS_LIST_LIMIT within range', () => {
    const result = validateEnv({ ...valid, TRANSACTIONS_LIST_LIMIT: 500 });
    expect(result.TRANSACTIONS_LIST_LIMIT).toBe(500);
  });

  it('rejects TRANSACTIONS_LIST_LIMIT out of range', () => {
    expect(() => validateEnv({ ...valid, TRANSACTIONS_LIST_LIMIT: 2000 })).toThrow(
      /Invalid environment/
    );
  });

  it('rejects HTTP_PORT out of range', () => {
    expect(() => validateEnv({ ...valid, HTTP_PORT: 70000 })).toThrow(
      /Invalid environment/
    );
  });

  it('rejects missing required fields', () => {
    const { DATABASE_URL: _omit, ...rest } = valid;
    expect(() => validateEnv(rest)).toThrow(/Invalid environment/);
  });
});
