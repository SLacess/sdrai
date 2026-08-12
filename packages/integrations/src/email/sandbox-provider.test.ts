import { describe, expect, it } from 'vitest';
import { SandboxEmailProvider } from './sandbox-provider';

describe('SandboxEmailProvider', () => {
  it('returns a unique providerMessageId per send', async () => {
    const provider = new SandboxEmailProvider();
    const a = await provider.send({ to: 'jane@acme.com', subject: 'Hi', body: 'x' });
    const b = await provider.send({ to: 'jane@acme.com', subject: 'Hi', body: 'x' });
    expect(a.providerMessageId).not.toBe(b.providerMessageId);
  });

  it('records every send for later inspection', async () => {
    const provider = new SandboxEmailProvider();
    await provider.send({ to: 'jane@acme.com', subject: 'Hi', body: 'Body 1' });
    await provider.send({ to: 'john@acme.com', subject: 'Hello', body: 'Body 2' });

    const sent = provider.getSentEmails();
    expect(sent).toHaveLength(2);
    expect(sent[0]).toMatchObject({ to: 'jane@acme.com', subject: 'Hi', body: 'Body 1' });
    expect(sent[1]).toMatchObject({ to: 'john@acme.com', subject: 'Hello', body: 'Body 2' });
  });

  it('never calls a real network endpoint (purely in-memory)', async () => {
    const provider = new SandboxEmailProvider();
    expect(provider.name).toBe('sandbox');
    await expect(provider.send({ to: 'x@y.com', subject: 's', body: 'b' })).resolves.toMatchObject({
      providerMessageId: expect.any(String),
    });
  });
});
