function createWriteQueue() {
  let tail = Promise.resolve();

  function enqueue(task) {
    tail = tail.then(() => task()).catch(() => {});
    return tail;
  }

  return { enqueue };
}

module.exports = { createWriteQueue };
