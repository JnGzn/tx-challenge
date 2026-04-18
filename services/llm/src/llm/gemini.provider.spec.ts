import { ConfigService } from '@nestjs/config';
import { GeminiProvider } from './gemini.provider';

describe('GeminiProvider', () => {
  let generateContent: jest.Mock;
  let client: { models: { generateContent: jest.Mock } };

  const buildProvider = (configValues: Record<string, unknown> = {}) => {
    const config = {
      get: jest.fn((key: string) => configValues[key])
    } as unknown as ConfigService;
    return new GeminiProvider(client as any, config);
  };

  beforeEach(() => {
    generateContent = jest.fn();
    client = { models: { generateContent } };
  });

  it('uses defaults when config is absent', async () => {
    generateContent.mockResolvedValue({ text: '  hello  ', raw: true });
    const provider = buildProvider();

    const result = await provider.complete({
      system: 'you are helpful',
      user: 'hola'
    });

    expect(generateContent).toHaveBeenCalledWith({
      model: 'gemini-2.0-flash',
      contents: 'hola',
      config: { systemInstruction: 'you are helpful', temperature: 0.2 }
    });
    expect(result.text).toBe('hello');
    expect(result.model).toBe('gemini-2.0-flash');
  });

  it('respects GEMINI_MODEL and LLM_TEMPERATURE from config', async () => {
    generateContent.mockResolvedValue({ text: 'ok' });
    const provider = buildProvider({
      GEMINI_MODEL: 'gemini-1.5-pro',
      LLM_TEMPERATURE: 0.7
    });

    await provider.complete({ system: 's', user: 'u' });

    expect(generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-1.5-pro',
        config: expect.objectContaining({ temperature: 0.7 })
      })
    );
  });

  it('prefers request-level temperature over default', async () => {
    generateContent.mockResolvedValue({ text: 'ok' });
    const provider = buildProvider({ LLM_TEMPERATURE: 0.5 });

    await provider.complete({ system: 's', user: 'u', temperature: 0.9 });

    expect(generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ temperature: 0.9 })
      })
    );
  });

  it('returns empty string when response.text is missing', async () => {
    generateContent.mockResolvedValue({});
    const provider = buildProvider();

    const result = await provider.complete({ system: 's', user: 'u' });
    expect(result.text).toBe('');
  });
});
