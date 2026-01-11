import type { DraftArtifact } from './draft-contract';
import { sampleCompiledArtifact } from './sample-compiled';

export const sampleDraft: DraftArtifact = {
  draftId: sampleCompiledArtifact.draftId,
  appId: sampleCompiledArtifact.appId,
  updatedAt: new Date().toISOString(),
  elements: {},
};
