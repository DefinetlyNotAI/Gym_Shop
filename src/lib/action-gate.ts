export function createActionGate() {
  let pending = false;
  return {
    async run(
      action: () => Promise<void>,
      onPending: (value: boolean) => void,
    ): Promise<boolean> {
      if (pending) return false;
      pending = true;
      try {
        onPending(true);
        await action();
        return true;
      } finally {
        pending = false;
        onPending(false);
      }
    },
  };
}
