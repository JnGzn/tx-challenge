import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { GEMINI_CLIENT, GeminiProvider } from './gemini.provider';
import { LLM_PROVIDER } from './llm-provider';

@Global()
@Module({
  providers: [
    {
      provide: GEMINI_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new GoogleGenAI({ apiKey: config.getOrThrow<string>('GEMINI_API_KEY') })
    },
    { provide: LLM_PROVIDER, useClass: GeminiProvider }
  ],
  exports: [LLM_PROVIDER]
})
export class LlmModule {}
