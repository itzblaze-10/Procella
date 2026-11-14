# Credentials Never Appear in Conversation

Never mention, reference, display, or ask about a credential in conversation — not partially, not
as a placeholder, not as an example value.

**Why:** the owner does not want key material appearing in chat under any circumstances.

**How to apply:** when a credential is needed, say "add it to your `.env` file" and nothing more.
Never name the key format, never show an example value, never confirm what was entered. Every key,
every service, permanently. `.env` is read with python-dotenv and referenced by variable name; it is
never printed, staged, or sourced.
