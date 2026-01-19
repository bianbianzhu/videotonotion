---
allowed-tools: Bash(*codex exec*)
description: Pass the question to Codex and get the answer.
argument-hint: your prompt text
model: haiku
---

Run the following command exactly. Don't modify it in any way (except passing the prompt text to the command).

Expect this command to run for a long time. Don't worry if it takes 10 minutes or even longer. Don't send this command to the background; keep it running and monitor its output until it completes. Simply return the output of the command to the user directly.

```bash
if [ -z "$ARGUMENTS" ]; then
  echo "Error: prompt text is required"
  exit 1
fi
inst="Don't switch branch.\n\nFollow these instructions exactly:\n"
args="$ARGUMENTS"
codex exec --profile claude "$inst $args"
```
