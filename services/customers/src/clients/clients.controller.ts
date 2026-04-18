import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { FindByEmailQueryDto } from './dto/find-by-email.query.dto';

@Controller('clients')
export class ClientsController {
  constructor(private readonly service: ClientsService) {}

  @Post()
  create(@Body() dto: CreateClientDto) {
    return this.service.create(dto);
  }

  @Get()
  findByEmail(@Query() query: FindByEmailQueryDto) {
    return this.service.findByEmail(query.email);
  }

  @Get('accounts')
  listAccounts(@Query() query: FindByEmailQueryDto) {
    return this.service.listAccountsByEmail(query.email);
  }
}
