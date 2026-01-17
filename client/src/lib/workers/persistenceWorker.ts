type PersistenceWorkerRequest = {
  jobId: number;
  sessionsState: unknown;
  globalState: unknown;
};

type PersistenceWorkerResponse = {
  jobId: number;
  sessionsJson: string | null;
  globalJson: string | null;
  error?: string;
};

const ctx = self as unknown as {
  addEventListener: (
    type: "message",
    handler: (event: MessageEvent<PersistenceWorkerRequest>) => void,
  ) => void;
  postMessage: (data: PersistenceWorkerResponse) => void;
};

ctx.addEventListener("message", (event: MessageEvent<PersistenceWorkerRequest>) => {
  const { jobId, sessionsState, globalState } = event.data || {};
  if (!jobId) return;
  try {
    const sessionsJson = sessionsState ? JSON.stringify(sessionsState) : null;
    const globalJson = globalState ? JSON.stringify(globalState) : null;
    const response: PersistenceWorkerResponse = { jobId, sessionsJson, globalJson };
    ctx.postMessage(response);
  } catch (error) {
    const response: PersistenceWorkerResponse = {
      jobId,
      sessionsJson: null,
      globalJson: null,
      error: error instanceof Error ? error.message : "serialization_failed",
    };
    ctx.postMessage(response);
  }
});
