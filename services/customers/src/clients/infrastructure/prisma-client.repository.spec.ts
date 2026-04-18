import { PrismaClientRepository } from './prisma-client.repository';

describe('PrismaClientRepository', () => {
  let repo: PrismaClientRepository;
  let prisma: {
    client: { create: jest.Mock; findUnique: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      client: {
        create: jest.fn(),
        findUnique: jest.fn()
      }
    };
    repo = new PrismaClientRepository(prisma as any);
  });

  it('create delegates to prisma.client.create', async () => {
    prisma.client.create.mockResolvedValue({ id: 'c-1' });
    await repo.create({ name: 'Ada', email: 'ada@example.com' });
    expect(prisma.client.create).toHaveBeenCalledWith({
      data: { name: 'Ada', email: 'ada@example.com' }
    });
  });

  it('findById delegates to findUnique with id', async () => {
    prisma.client.findUnique.mockResolvedValue(null);
    await repo.findById('c-1');
    expect(prisma.client.findUnique).toHaveBeenCalledWith({ where: { id: 'c-1' } });
  });

  it('findByEmail delegates to findUnique with email', async () => {
    prisma.client.findUnique.mockResolvedValue({ id: 'c-1' });
    await repo.findByEmail('ada@example.com');
    expect(prisma.client.findUnique).toHaveBeenCalledWith({
      where: { email: 'ada@example.com' }
    });
  });
});
