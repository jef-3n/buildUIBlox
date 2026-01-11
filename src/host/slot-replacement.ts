export type HostSlotName = 'top' | 'left' | 'right' | 'bottom';

export type HostSlotReplacementState = {
  status: 'idle' | 'loading' | 'ready' | 'failed';
  tagName?: string;
};

export type SlotReplacementInstruction =
  | { kind: 'component'; tagName: string }
  | { kind: 'slot'; name: HostSlotName };

export const getSlotReplacementInstruction = (
  slotName: HostSlotName,
  slotState?: HostSlotReplacementState
): SlotReplacementInstruction => {
  if (slotState?.status === 'ready' && slotState.tagName) {
    return { kind: 'component', tagName: slotState.tagName };
  }
  return { kind: 'slot', name: slotName };
};
