const { createWriteQueue } = require('../../src/storage/write-queue');

describe('createWriteQueue', () => {
  it('executes tasks in order', async () => {
    const queue = createWriteQueue();
    const order = [];
    await Promise.all([
      queue.enqueue(async () => { order.push(1); }),
      queue.enqueue(async () => { order.push(2); }),
      queue.enqueue(async () => { order.push(3); }),
    ]);
    expect(order).toEqual([1, 2, 3]);
  });

  it('runs only one task at a time', async () => {
    const queue = createWriteQueue();
    let concurrent = 0;
    let maxConcurrent = 0;
    const task = () => new Promise(resolve => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      setImmediate(() => { concurrent--; resolve(); });
    });
    await Promise.all([queue.enqueue(task), queue.enqueue(task), queue.enqueue(task)]);
    expect(maxConcurrent).toBe(1);
  });
});
