import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function worker({ fail = false } = {}) {
  const handlers = {},
    shown = [],
    timers = [];
  vm.runInNewContext(
    fs.readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"),
    {
      self: {
        addEventListener: (name, handler) => {
          handlers[name] = handler;
        },
        registration: {
          showNotification: async (...args) => {
            if (fail) throw Error("Permission denied");
            shown.push(args);
          },
        },
      },
      setTimeout: (callback, delay) => {
        timers.push({ callback, delay });
      },
    },
  );
  function send(data) {
    const replies = [];
    let finished = Promise.resolve();
    handlers.message({
      data,
      ports: [{ postMessage: (reply) => replies.push(reply.ok) }],
      waitUntil: (promise) => {
        finished = promise;
      },
    });
    return { replies, finished };
  }
  return { send, shown, timers };
}

test("immediate demo reports success only after the OS notification API succeeds", async () => {
  const w = worker();
  const request = w.send({
    type: "DEMO_NOTIFICATION",
    title: "Demo",
    body: "Care time",
    delay: 0,
  });
  assert.deepEqual(request.replies, []);
  await request.finished;
  assert.deepEqual(request.replies, [true]);
  assert.equal(w.shown[0][0], "Demo");
  assert.equal(w.shown[0][1].body, "Care time");
});

test("notification permission failure is reported instead of false success", async () => {
  const w = worker({ fail: true });
  const request = w.send({ type: "DEMO_NOTIFICATION", title: "Demo" });
  await request.finished;
  assert.deepEqual(request.replies, [false]);
});

test("delayed demo keeps its event alive and only displays after ten seconds", async () => {
  const w = worker();
  const request = w.send({
    type: "DEMO_NOTIFICATION",
    title: "Demo",
    delay: 10000,
  });
  assert.deepEqual(request.replies, [true]);
  assert.equal(w.shown.length, 0);
  assert.equal(w.timers[0].delay, 10000);
  w.timers[0].callback();
  await request.finished;
  assert.equal(w.shown.length, 1);
});

test("turning notifications off cancels an already queued demo", async () => {
  const w = worker();
  const request = w.send({
    type: "DEMO_NOTIFICATION",
    title: "Demo",
    delay: 10000,
  });
  w.send({ type: "CANCEL_DEMO_NOTIFICATIONS" });
  w.timers[0].callback();
  await request.finished;
  assert.equal(w.shown.length, 0);
});

test("rescheduling a demo replaces the previous demo", async () => {
  const w = worker();
  const first = w.send({
    type: "DEMO_NOTIFICATION",
    title: "First",
    delay: 10000,
  });
  const second = w.send({
    type: "DEMO_NOTIFICATION",
    title: "Second",
    delay: 10000,
  });
  w.timers.forEach(({ callback }) => callback());
  await Promise.all([first.finished, second.finished]);
  assert.equal(w.shown.length, 1);
  assert.equal(w.shown[0][0], "Second");
});
