import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { upsertBuyingCommittee } from './buying-committee-service';

function createMockPrisma() {
  const contact = { create: vi.fn(), update: vi.fn() };
  const contactChannel = { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() };
  return { prisma: { contact, contactChannel } as unknown as PrismaClient, contact, contactChannel };
}

const CONTACT_INPUT = {
  name: 'Jane Doe',
  title: 'CTO',
  role: 'DECISION_MAKER',
  confidence: 0.8,
  channel: { type: 'EMAIL' as const, address: 'jane@acme.com', verified: true },
};

describe('upsertBuyingCommittee', () => {
  it('creates a new contact and channel when none exists for that address', async () => {
    const { prisma, contact, contactChannel } = createMockPrisma();
    contactChannel.findUnique.mockResolvedValue(null);
    contact.create.mockResolvedValue({ id: 'contact-1' });
    contactChannel.create.mockResolvedValue({});

    const result = await upsertBuyingCommittee(prisma, { accountId: 'acc-1', contacts: [CONTACT_INPUT] });

    expect(result.contactIds).toEqual(['contact-1']);
    expect(contact.create).toHaveBeenCalledWith({
      data: {
        accountId: 'acc-1',
        name: 'Jane Doe',
        normalizedName: 'jane doe',
        roleInBuyingCommittee: 'DECISION_MAKER',
        confidence: 0.8,
        title: 'CTO',
      },
    });
    expect(contactChannel.create).toHaveBeenCalledWith({
      data: {
        contactId: 'contact-1',
        channel: 'EMAIL',
        address: 'jane@acme.com',
        status: 'VERIFIED',
        verifiedAt: expect.any(Date),
        verificationSource: 'agent',
      },
    });
  });

  it('persists an unverified channel as UNVERIFIED, never VERIFIED', async () => {
    const { prisma, contact, contactChannel } = createMockPrisma();
    contactChannel.findUnique.mockResolvedValue(null);
    contact.create.mockResolvedValue({ id: 'contact-1' });
    contactChannel.create.mockResolvedValue({});

    await upsertBuyingCommittee(prisma, {
      accountId: 'acc-1',
      contacts: [{ ...CONTACT_INPUT, channel: { ...CONTACT_INPUT.channel, verified: false } }],
    });

    expect(contactChannel.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'UNVERIFIED' }),
    });
    const writtenData = contactChannel.create.mock.calls[0]?.[0].data;
    expect(writtenData).not.toHaveProperty('verifiedAt');
    expect(writtenData).not.toHaveProperty('verificationSource');
  });

  it('updates the existing contact/channel instead of creating a duplicate when the channel address already exists', async () => {
    const { prisma, contact, contactChannel } = createMockPrisma();
    contactChannel.findUnique.mockResolvedValue({ id: 'channel-1', contactId: 'contact-existing' });
    contact.update.mockResolvedValue({ id: 'contact-existing' });
    contactChannel.update.mockResolvedValue({});

    const result = await upsertBuyingCommittee(prisma, { accountId: 'acc-1', contacts: [CONTACT_INPUT] });

    expect(result.contactIds).toEqual(['contact-existing']);
    expect(contact.create).not.toHaveBeenCalled();
    expect(contactChannel.create).not.toHaveBeenCalled();
    expect(contact.update).toHaveBeenCalledWith({
      where: { id: 'contact-existing' },
      data: expect.objectContaining({ name: 'Jane Doe', roleInBuyingCommittee: 'DECISION_MAKER' }),
    });
    expect(contactChannel.update).toHaveBeenCalledWith({
      where: { id: 'channel-1' },
      data: expect.objectContaining({ status: 'VERIFIED' }),
    });
  });

  it('processes multiple contacts and returns their ids in order', async () => {
    const { prisma, contact, contactChannel } = createMockPrisma();
    contactChannel.findUnique.mockResolvedValue(null);
    contact.create.mockResolvedValueOnce({ id: 'contact-1' }).mockResolvedValueOnce({ id: 'contact-2' });
    contactChannel.create.mockResolvedValue({});

    const result = await upsertBuyingCommittee(prisma, {
      accountId: 'acc-1',
      contacts: [
        CONTACT_INPUT,
        { ...CONTACT_INPUT, name: 'John Smith', channel: { ...CONTACT_INPUT.channel, address: 'john@acme.com' } },
      ],
    });

    expect(result.contactIds).toEqual(['contact-1', 'contact-2']);
  });
});
