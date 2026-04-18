import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { PrismaTransactionRepository } from './prisma-transaction.repository';

describe('PrismaTransactionRepository', () => {
  let repo: PrismaTransactionRepository;
  let prisma: {
    transaction: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      transaction: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn()
      }
    };
    repo = new PrismaTransactionRepository(prisma as any);
  });

  it('create delegates to prisma.transaction.create', async () => {
    prisma.transaction.create.mockResolvedValue({ id: 't-1' });
    const data = {
      type: TransactionType.DEPOSIT,
      amount: new Prisma.Decimal('10'),
      status: TransactionStatus.PENDING
    };
    await repo.create(data as any);
    expect(prisma.transaction.create).toHaveBeenCalledWith({ data });
  });

  it('findById delegates to findUnique', async () => {
    prisma.transaction.findUnique.mockResolvedValue(null);
    await repo.findById('t-1');
    expect(prisma.transaction.findUnique).toHaveBeenCalledWith({
      where: { id: 't-1' }
    });
  });

  describe('findMany', () => {
    it('applies all filters including OR on accountId', async () => {
      prisma.transaction.findMany.mockResolvedValue([]);
      await repo.findMany(
        {
          status: TransactionStatus.COMPLETED,
          type: TransactionType.TRANSFER,
          accountId: 'a-1'
        },
        50
      );
      expect(prisma.transaction.findMany).toHaveBeenCalledWith({
        where: {
          status: TransactionStatus.COMPLETED,
          type: TransactionType.TRANSFER,
          OR: [{ sourceAccountId: 'a-1' }, { targetAccountId: 'a-1' }]
        },
        orderBy: { requestedAt: 'desc' },
        take: 50
      });
    });

    it('omits missing filters', async () => {
      prisma.transaction.findMany.mockResolvedValue([]);
      await repo.findMany({}, 10);
      expect(prisma.transaction.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { requestedAt: 'desc' },
        take: 10
      });
    });
  });
});
