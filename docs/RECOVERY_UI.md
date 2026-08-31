# WOAHBIT read-only recovery UI

The server-rendered `/wallet` page includes a read-only SLP recovery lookup for public Bitcoin Cash transaction IDs.

The browser validates that the value is exactly 64 hexadecimal characters before requesting `/recover/:txid`. Results are rendered with DOM `textContent` rather than raw HTML.

This interface never requests recovery phrases, private keys, wallet encryption keys, signing data, or broadcast authorization. Send, receive, secret import, signing, and broadcasting remain outside this recovery flow.
