import { Prisma } from '@prisma/client';
import { PrismaAccountRepository } from './prisma-account.repository';

describe('PrismaAccountRepository', () => {
  let repo: PrismaAccountRepository;
  let prisma: { account: { create: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock } };

  beforeEach(() => {
    prisma = {
      account: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn()
      }
    };
    repo = new PrismaAccountRepository(prisma as any);
  });

  it('create wraps initialBalance in Prisma.Decimal', async () => {
    prisma.account.create.mockResolvedValue({ id: 'a-1' });

    await repo.create({ clientId: 'c-1', number: 'ACC-1', initialBalance: 25 });

    expect(prisma.account.create).toHaveBeenCalledWith({
      data: {
        clientId: 'c-1',
        number: 'ACC-1',
        balance: new Prisma.Decimal(25)
      }
    });
  });

  it('findById delegates to prisma.account.findUnique', async () => {
    prisma.account.findUnique.mockResolvedValue({ id: 'a-1' });
    await expect(repo.findById('a-1')).resolves.toEqual({ id: 'a-1' });
    expect(prisma.account.findUnique).toHaveBeenCalledWith({ where: { id: 'a-1' } });
  });

  it('findManyByClientId delegates to prisma.account.findMany', async () => {
    prisma.account.findMany.mockResolvedValue([]);
    await repo.findManyByClientId('c-1');
    expect(prisma.account.findMany).toHaveBeenCalledWith({ where: { clientId: 'c-1' } });
  });
});
