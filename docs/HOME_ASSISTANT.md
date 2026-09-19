# Home Assistant

Create a dedicated, revocable Long-Lived Access Token in the Home Assistant user profile. Enter the base URL and token during Display setup.

- HTTPS is preferred and uses normal Android certificate validation.
- Display never accepts invalid TLS certificates.
- Plain HTTP requires an explicit warning acknowledgement and is accepted only when every resolved address is private, loopback, or link-local.
- The token is encrypted with an Android Keystore key and excluded from backups.
- Supported v0.1 domains are `sensor`, `binary_sensor`, `switch`, `light`, and `climate`.

For least privilege, use a dedicated Home Assistant account with access limited to the entities intended for the display.
