# Recovery UI security notes

WOAHBIT's recovery lookup is read-only and accepts only public 64-character BCH transaction IDs. The client validates the format before calling `/recover/:txid` and renders response values using DOM text nodes.

The recovery flow does not accept or transmit seed phrases, private keys, wallet encryption keys, signing material, or broadcast authorization. Wallet send, import, signing, and broadcasting capabilities remain disabled.
