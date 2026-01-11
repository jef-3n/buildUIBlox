export type HostSlotName = 'top' | 'left' | 'right' | 'bottom';

export type HostSlotReplacementState = {
  status: 'idle' | 'loading' | 'ready' | 'failed';
  tagName?: string;
};

export type SlotReplacementInstruction =
  | { kind: 'component'; tagName: string }
  | { kind: 'slot'; name: HostSlotName };

const SLOT_REPLACEMENT_TAG_PATTERN = /^[a-z][\w.-]*-[\w.-]*$/;

export const isValidSlotReplacementTagName = (tagName?: string) =>
  typeof tagName === 'string' && SLOT_REPLACEMENT_TAG_PATTERN.test(tagName);

export const getSlotReplacementInstruction = (
  slotName: HostSlotName,
  slotState?: HostSlotReplacementState
): SlotReplacementInstruction => {
  if (
    slotState?.status === 'ready' &&
    slotState.tagName &&
    isValidSlotReplacementTagName(slotState.tagName)
  ) {
    return { kind: 'component', tagName: slotState.tagName };
  }
  return { kind: 'slot', name: slotName };
};
