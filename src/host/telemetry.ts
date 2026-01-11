export type ObservationCategory = 'pipeline' | 'selection' | 'artifact';

export type ObservationPacket = {
  id: string;
  sequence: number;
  emittedAt: string;
  source: 'nuwa-host';
  category: ObservationCategory;
  event: string;
  payload: Record<string, unknown>;
};
