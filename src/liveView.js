export function createLiveView(worldManager, playerManager, renderer, audio, opts = {}) {
  let code = Math.random().toString(36).slice(2, 7);
  const codeToPlayer = {};
  const sockets = [];

  function generateCode() {
    code = Math.random().toString(36).slice(2, 7);
    return code;
  }

  function linkPlayer(inputCode, playerId) {
    if (inputCode !== code) return;
    codeToPlayer[inputCode] = playerId;
    opts.onLinked?.(playerId);
  }

  function init() {
    // In a real environment, hook up websocket server here.
  }

  function update(dt) {
    // Mock: nothing yet
  }

  return {
    init,
    update,
    generateCode,
    linkPlayer,
  };
}