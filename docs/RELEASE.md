# Release process

1. Update `versionName`, monotonic `versionCode`, and `CHANGELOG.md`.
2. Run unit tests, lint, and an Echo Show 5 smoke test.
3. Create a signed tag such as `v0.1.0`.
4. Push the tag. GitHub Actions builds and signs the release APK.
5. Verify the published APK and SHA-256 file before installing it on the reference device.

Required GitHub Actions secrets:

- `DISPLAY_KEYSTORE_BASE64`
- `DISPLAY_KEY_ALIAS`
- `DISPLAY_STORE_PASSWORD`
- `DISPLAY_KEY_PASSWORD`

The signing keystore must also be stored securely outside GitHub. Losing it prevents seamless updates.
