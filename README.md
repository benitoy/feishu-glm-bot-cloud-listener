# Feishu GLM bot cloud listener (retired)

The GitHub Actions long-connection listener has been retired.

Feishu now delivers `im.message.receive_v1` events directly to the Cloudflare
endpoint configured in the Feishu Open Platform. Cloudflare calls GLM and
replies to the original Feishu message, so no always-on GitHub Actions runner is
required.

This repository remains as an archived implementation record only. It contains
no active workflow and will not start scheduled GitHub Actions runs.
