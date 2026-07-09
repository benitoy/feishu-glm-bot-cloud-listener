import { spawn } from 'node:child_process';

const bridgeUrl = process.env.BRIDGE_URL || 'https://feishu-glm-bot.benitoy-feishu.workers.dev/bridge/message';
const bridgeSecret = process.env.BRIDGE_SHARED_SECRET;
const eventKey = process.env.FEISHU_EVENT_KEY || 'im.message.receive_v1';
const larkCli = process.env.LARK_CLI_BIN || 'lark-cli';

if (!bridgeSecret) {
  console.error('BRIDGE_SHARED_SECRET is required.');
  process.exit(1);
}

const seen = new Set();
let restartCount = 0;

function log(message) {
  console.log(`[bridge] ${new Date().toISOString()} ${message}`);
}

function startConsumer() {
  const child = spawn(larkCli, ['event', 'consume', eventKey, '--as', 'bot'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      LARKSUITE_CLI_NO_UPDATE_NOTIFIER: '1',
      LARKSUITE_CLI_NO_SKILLS_NOTIFIER: '1',
    },
  });

  child.stdin.write('\n');

  let stdoutBuffer = '';
  let stderrBuffer = '';
  let ready = false;

  child.stderr.on('data', (chunk) => {
    stderrBuffer += chunk.toString('utf8');
    const lines = stderrBuffer.split(/\r?\n/);
    stderrBuffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      if (line.includes('[event] ready')) {
        ready = true;
        restartCount = 0;
        log(`ready event_key=${eventKey}`);
      } else {
        log(`event stderr: ${line}`);
      }
    }
  });

  child.stdout.on('data', (chunk) => {
    stdoutBuffer += chunk.toString('utf8');
    const lines = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      void handleLine(line);
    }
  });

  child.on('exit', (code, signal) => {
    log(`consumer exited code=${code ?? ''} signal=${signal ?? ''} ready=${ready}`);
    const delay = Math.min(60_000, 2_000 * 2 ** restartCount++);
    setTimeout(startConsumer, delay);
  });
}

async function handleLine(line) {
  let event;
  try {
    event = JSON.parse(line);
  } catch (error) {
    log(`skip invalid json: ${error.message}`);
    return;
  }

  const dedupeKey = event.event_id || event.message_id || event.id;
  if (dedupeKey) {
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    if (seen.size > 1000) {
      const [first] = seen;
      seen.delete(first);
    }
  }

  if (event.message_type && event.message_type !== 'text') return;

  const payload = {
    event_id: event.event_id,
    message_id: event.message_id || event.id,
    chat_id: event.chat_id,
    chat_type: event.chat_type,
    message_type: event.message_type || 'text',
    sender_id: event.sender_id,
    content: event.content || '',
    create_time: event.create_time,
  };

  if (!payload.message_id || !payload.chat_id) {
    log('skip event without message_id/chat_id');
    return;
  }

  const response = await fetch(bridgeUrl, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${bridgeSecret}`,
      'content-type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text().catch(() => '');
  if (!response.ok) {
    log(`bridge failed status=${response.status} body=${responseText.slice(0, 300)}`);
    return;
  }

  let result = {};
  try {
    result = JSON.parse(responseText);
  } catch {
    // Keep the bridge alive if a proxy returns a non-JSON success response.
  }

  log(
    `forwarded message_id=${payload.message_id} chat_type=${payload.chat_type} replied=${result.replied ?? 'unknown'} mode=${result.mode || result.reason || 'unknown'}`,
  );
}

startConsumer();
