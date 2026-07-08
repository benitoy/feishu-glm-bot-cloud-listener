# Feishu GLM bot cloud listener

This switches the bot from a local Codex computer listener to a cloud listener
running on GitHub Actions.

## What runs in the cloud

- GitHub Actions starts `lark-cli event consume im.message.receive_v1 --as bot`.
- The listener receives Feishu message events over the official long connection.
- Each message is forwarded to the Cloudflare Worker bridge:
  `https://feishu-glm-bot.benitoy-feishu.workers.dev/bridge/message`.
- The Worker calls GLM and replies in Feishu.

## Why there is a separate public repository

Long-running GitHub Actions in a private repository consume private-repository
minutes quickly. The cloud listener is therefore kept in a tiny public
repository that contains only generic code and workflow files.

Secrets are still stored as encrypted GitHub Actions secrets. The public
repository does not contain the Feishu App Secret, bridge secret, or GLM key.

Cloud listener repository:

```text
https://github.com/benitoy/feishu-glm-bot-cloud-listener
```

## Required GitHub configuration

Repository secrets:

```text
FEISHU_APP_ID
FEISHU_APP_SECRET
BRIDGE_SHARED_SECRET
```

Repository variable:

```text
BRIDGE_URL=https://feishu-glm-bot.benitoy-feishu.workers.dev/bridge/message
```

## How it stays online

GitHub Actions is not a paid always-on server. The workflow uses a practical
free-style rotation:

- It starts manually or on a schedule.
- It runs for about 4 hours.
- A scheduled run starts again every 4 hours.
- `concurrency.cancel-in-progress` makes the new run replace the previous one.

This gives a cloud-hosted long-connection listener without relying on the local
Codex desktop app being open.

## Manual test

Open the repository, then run:

```text
Actions -> Feishu GLM bot cloud listener -> Run workflow
```

After the workflow shows the listener as ready, send a message in Feishu:

- private chat with the bot: any question
- group chat: `@bot question`, bot name, or `/q question`

The current Worker configuration also allows the bridge to answer all group
text events unless `BRIDGE_ANSWER_ALL_GROUP_EVENTS` is set to `false`.
