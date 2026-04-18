import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it('connects on module init and disconnects on destroy', async () => {
    const service = new PrismaService();
    const connect = jest.spyOn(service, '$connect').mockResolvedValue(undefined as any);
    const disconnect = jest
      .spyOn(service, '$disconnect')
      .mockResolvedValue(undefined as any);

    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(connect).toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
  });
});
