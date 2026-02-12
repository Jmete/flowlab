export interface HistoryStack<T> {
  past: T[];
  future: T[];
}

export function createHistoryStack<T>(): HistoryStack<T> {
  return { past: [], future: [] };
}

export function pushHistory<T>(stack: HistoryStack<T>, snapshot: T, limit = 100): HistoryStack<T> {
  const nextPast = [...stack.past, snapshot];
  if (nextPast.length > limit) {
    nextPast.shift();
  }
  return {
    past: nextPast,
    future: [],
  };
}

export function undoHistory<T>(stack: HistoryStack<T>, present: T): { stack: HistoryStack<T>; present?: T } {
  if (stack.past.length === 0) {
    return { stack };
  }
  const past = [...stack.past];
  const previous = past.pop()!;
  return {
    present: previous,
    stack: {
      past,
      future: [present, ...stack.future],
    },
  };
}

export function redoHistory<T>(stack: HistoryStack<T>, present: T): { stack: HistoryStack<T>; present?: T } {
  if (stack.future.length === 0) {
    return { stack };
  }
  const [next, ...remaining] = stack.future;
  return {
    present: next,
    stack: {
      past: [...stack.past, present],
      future: remaining,
    },
  };
}
