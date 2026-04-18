import { Module } from '@nestjs/common';
import { EventsConsumer } from './events.consumer';
import { ExplanationsModule } from '../explanations/explanations.module';

@Module({
  imports: [ExplanationsModule],
  controllers: [EventsConsumer]
})
export class EventsModule {}
