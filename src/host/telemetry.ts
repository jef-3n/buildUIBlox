export type ObservationCategory = 'pipeline' | 'selection' | 'artifact';

export type ObservationPacket = {
  id: string;
  sequence: number;
  emittedAt: string;
  source: string;
  category: ObservationCategory;
  event: string;
  payload: Record<string, unknown>;
};
