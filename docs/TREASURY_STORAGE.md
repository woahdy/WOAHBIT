# WOAHBIT treasury storage

WOAHBIT stores treasury recovery material only as an authenticated AES-256-GCM envelope.

The storage layer:

- writes wallet files atomically through a temporary file and rename
- applies owner-only file permissions (`0600`)
- never writes plaintext recovery material to disk
- rejects unsupported or malformed storage records
- requires the configured 32-byte wallet encryption key to decrypt

This milestone intentionally does not expose recovery import, signing, transaction construction, or broadcasting through the HTTP interface.
