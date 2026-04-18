import { forwardRef, Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { ACCOUNT_REPOSITORY } from './domain/account.repository';
import { PrismaAccountRepository } from './infrastructure/prisma-account.repository';
import { ClientsModule } from '../clients/clients.module';

@Module({
  imports: [forwardRef(() => ClientsModule)],
  controllers: [AccountsController],
  providers: [
    AccountsService,
    { provide: ACCOUNT_REPOSITORY, useClass: PrismaAccountRepository }
  ],
  exports: [AccountsService, ACCOUNT_REPOSITORY]
})
export class AccountsModule {}
