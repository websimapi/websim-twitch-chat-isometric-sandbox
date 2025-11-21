import tmi from 'tmi.js';

export function createTwitchClient({ channel, onCommand, onState }) {
  const client = new tmi.Client({
    channels: [channel],
    connection: { secure: true, reconnect: true },
    options: { debug: false },
  });

  function handleMessage(_channel, tags, message, self) {
    if (self) return;
    const text = message.trim();
    if (!text.startsWith('!')) return;
    const parts = text.slice(1).split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);
    const known = ['chop', 'gather', 'follow', 'me', 'link'];
    if (!known.includes(command)) return;
    const user = tags['display-name'] || tags['username'] || 'unknown';
    onCommand({ user, command, args });
  }

  client.on('message', handleMessage);
  client.on('connected', () => {
    onState?.(`Connected to #${channel}`);
  });
  client.on('disconnected', () => {
    onState?.('Disconnected from Twitch');
  });

  return {
    async connect() {
      try {
        await client.connect();
      } catch (err) {
        console.error(err);
        onState?.('Failed to connect');
      }
    },
    disconnect() {
      client.disconnect();
    },
  };
}