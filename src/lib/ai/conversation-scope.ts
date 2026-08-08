export function isConversationInScope(
  storedInstrumentKey: string | null,
  requestedInstrumentKey: string | null
) {
  return storedInstrumentKey === requestedInstrumentKey;
}
