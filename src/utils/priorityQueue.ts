// Minimal binary min-heap priority queue used by the search algorithms.
// Lower numeric priority is dequeued first; ties break by insertion order,
// which keeps every search deterministic and repeatable.

interface Entry<T> {
  priority: number;
  seq: number;
  value: T;
}

export class PriorityQueue<T> {
  private heap: Entry<T>[] = [];
  private seq = 0;

  get size(): number {
    return this.heap.length;
  }

  /** Highest number of live entries observed; used for frontier statistics. */
  peakSize = 0;

  push(value: T, priority: number): void {
    const entry: Entry<T> = { priority, seq: this.seq++, value };
    this.heap.push(entry);
    this.bubbleUp(this.heap.length - 1);
    this.peakSize = Math.max(this.peakSize, this.heap.length);
  }

  pop(): T | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    return top.value;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.compare(this.heap[index], this.heap[parent]) < 0) {
        [this.heap[index], this.heap[parent]] = [
          this.heap[parent],
          this.heap[index],
        ];
        index = parent;
      } else break;
    }
  }

  private bubbleDown(index: number): void {
    const n = this.heap.length;
    while (true) {
      const left = index * 2 + 1;
      const right = index * 2 + 2;
      let smallest = index;
      if (left < n && this.compare(this.heap[left], this.heap[smallest]) < 0)
        smallest = left;
      if (right < n && this.compare(this.heap[right], this.heap[smallest]) < 0)
        smallest = right;
      if (smallest === index) break;
      [this.heap[index], this.heap[smallest]] = [
        this.heap[smallest],
        this.heap[index],
      ];
      index = smallest;
    }
  }

  private compare(a: Entry<T>, b: Entry<T>): number {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.seq - b.seq;
  }
}
