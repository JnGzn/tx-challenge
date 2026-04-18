import { prompts } from './explanations.prompts';

describe('explanations prompts', () => {
  it('completed prompt includes the serialized payload', () => {
    const req = prompts.completed({ amount: '100' });
    expect(req.system).toMatch(/completadas/);
    expect(req.user).toContain('"amount": "100"');
  });

  it('rejected prompt includes the serialized payload', () => {
    const req = prompts.rejected({ reason: 'nope' });
    expect(req.system).toMatch(/rechazadas/);
    expect(req.user).toContain('"reason": "nope"');
  });

  it('accountHistory prompt includes the account id and the events list', () => {
    const events = [{ eventId: 'e1', eventType: 'x' }];
    const req = prompts.accountHistory('a-1', events);
    expect(req.user).toContain('a-1');
    expect(req.user).toContain('"eventId": "e1"');
  });
});
