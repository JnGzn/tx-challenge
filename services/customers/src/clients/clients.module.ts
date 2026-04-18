import { forwardRef, Module } from '@nestjs/common';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { CLIENT_REPOSITORY } from './domain/client.repository';
import { PrismaClientRepository } from './infrastructure/prisma-client.repository';
import { AccountsModule } from '../accounts/accounts.module';

@Module({
  imports: [forwardRef(() => AccountsModule)],
  controllers: [ClientsController],
  providers: [
    ClientsService,
    { provide: CLIENT_REPOSITORY, useClass: PrismaClientRepository }
  ],
  exports: [ClientsService, CLIENT_REPOSITORY]
})
export class ClientsModule {}
