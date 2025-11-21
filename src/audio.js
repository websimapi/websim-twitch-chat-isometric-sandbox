export function createAudioSystem(renderer) {
  const ctx = new (window.AudioContext || window.webkitAudioContext || function () {})();
  let listener = null;
  if (ctx && ctx.listener) {
    listener = ctx.listener;
  }

  function playClick(pos) {
    if (!ctx || !listener) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 440;
    gain.gain.value = 0.2;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  }

  function update(dt) {
    // Could sync listener to camera here
  }

  return {
    update,
    playClick,
  };
}

