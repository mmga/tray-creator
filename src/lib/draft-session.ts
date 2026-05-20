export interface DraftSession {
  currentDraftId: string | null;
  boundSnapshot: string | null;
}

export function createEmptyDraftSession(): DraftSession {
  return {
    currentDraftId: null,
    boundSnapshot: null,
  };
}

export function bindDraftSession(
  draftId: string,
  serializedSnapshot: string,
): DraftSession {
  return {
    currentDraftId: draftId,
    boundSnapshot: serializedSnapshot,
  };
}

export function clearDraftSession(): DraftSession {
  return createEmptyDraftSession();
}

export function removeDraftSessionBinding(
  session: DraftSession,
  deletedDraftId: string,
): DraftSession {
  if (session.currentDraftId !== deletedDraftId) {
    return session;
  }

  return createEmptyDraftSession();
}

export function hasUnsavedDraftChanges(
  session: DraftSession,
  serializedSnapshot: string,
) {
  return (
    session.currentDraftId !== null &&
    session.boundSnapshot !== null &&
    serializedSnapshot !== session.boundSnapshot
  );
}
