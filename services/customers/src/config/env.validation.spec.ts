import 'reflect-metadata';
import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  const valid = {
    HTTP_PORT: 3000,
    DATABASE_URL: 'postgres://localhost/db',
    KAFKA_BROKERS: 'kafka:9092',
    KAFKA_CLIENT_ID: 'customers',
    KAFKA_GROUP_ID: 'customers-group'
  };

  it('returns validated config when all fields are present', () => {
    const result = validateEnv(valid);
    expect(result.HTTP_PORT).toBe(3000);
    expect(result.DATABASE_URL).toBe('postgres://localhost/db');
  });

  it('coerces string HTTP_PORT to int', () => {
    const result = validateEnv({ ...valid, HTTP_PORT: '4000' });
    expect(result.HTTP_PORT).toBe(4000);
  });

  it('throws when HTTP_PORT is missing', () => {
    const { HTTP_PORT: _omit, ...rest } = valid;
    expect(() => validateEnv(rest)).toThrow(/Invalid environment/);
  });

  it('throws when HTTP_PORT is out of range', () => {
    expect(() => validateEnv({ ...valid, HTTP_PORT: 70000 })).toThrow(
      /Invalid environment/
    );
  });

  it('throws when a required string is missing', () => {
    const { DATABASE_URL: _omit, ...rest } = valid;
    expect(() => validateEnv(rest)).toThrow(/Invalid environment/);
  });
});
