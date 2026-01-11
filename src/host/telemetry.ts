export type ObservationCategory = 'pipeline' | 'selection' | 'draft';

export type ObservationPacket = {
  id: string;
  sequence: number;
  emittedAt: string;
  source: string;
  category: ObservationCategory;
  event: string;
  payload: Record<string, unknown>;
};
