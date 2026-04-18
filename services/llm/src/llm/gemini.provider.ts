import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import {
  CompletionRequest,
  CompletionResult,
  ILLMProvider
} from './llm-provider';

export const GEMINI_CLIENT = Symbol('GEMINI_CLIENT');

const DEFAULT_MODEL = 'gemini-2.0-flash';
const DEFAULT_TEMPERATURE = 0.2;

@Injectable()
export class GeminiProvider implements ILLMProvider {
  private readonly model: string;
  private readonly defaultTemperature: number;

  constructor(
    @Inject(GEMINI_CLIENT) private readonly client: GoogleGenAI,
    config: ConfigService
  ) {
    this.model = config.get<string>('GEMINI_MODEL') ?? DEFAULT_MODEL;
    this.defaultTemperature =
      config.get<number>('LLM_TEMPERATURE') ?? DEFAULT_TEMPERATURE;
  }

  async complete({ system, user, temperature }: CompletionRequest): Promise<CompletionResult> {
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: user,
      config: {
        systemInstruction: system,
        temperature: temperature ?? this.defaultTemperature
      }
    });
    return {
      text: (response.text ?? '').trim(),
      model: this.model,
      raw: response as unknown as Record<string, unknown>
    };
  }
}
