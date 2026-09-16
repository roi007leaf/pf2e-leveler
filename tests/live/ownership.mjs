export function validateRunId(value) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value ?? '')) {
    throw Error('Invalid live-test run ID; refusing document access');
  }
  return value;
}

export function ownedDocumentIds(
  documents,
  runId,
  moduleId = 'pf2e-leveler',
  marker = 'liveTestRun',
) {
  validateRunId(runId);
  return [...documents]
    .filter((document) => documentRunMarker(document, moduleId, marker) === runId)
    .map((document) => document.id);
}

export function documentRunMarker(document, moduleId = 'pf2e-leveler', marker = 'liveTestRun') {
  const raw =
    document?._source?.flags?.[moduleId]?.[marker] ?? document?.flags?.[moduleId]?.[marker];
  if (raw !== undefined) return raw;
  try {
    return document?.getFlag?.(moduleId, marker) ?? null;
  } catch {
    return null;
  }
}
