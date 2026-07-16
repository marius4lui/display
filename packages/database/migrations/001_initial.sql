CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(320) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_sessions (
  token_hash CHAR(64) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sessions_user (user_id),
  CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS displays (
  id CHAR(36) NOT NULL PRIMARY KEY,
  edit_token_hash CHAR(64) NOT NULL,
  owner_id CHAR(36) NULL,
  active_version INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_displays_owner (owner_id),
  CONSTRAINT fk_display_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS display_drafts (
  display_id CHAR(36) NOT NULL PRIMARY KEY,
  schema_version INT NOT NULL,
  encryption_version INT NOT NULL,
  kdf VARCHAR(32) NOT NULL,
  iterations INT NOT NULL,
  salt TEXT NOT NULL,
  iv TEXT NOT NULL,
  ciphertext LONGTEXT NOT NULL,
  content_hash CHAR(64) NOT NULL,
  byte_size INT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_draft_display FOREIGN KEY (display_id) REFERENCES displays(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS display_versions (
  display_id CHAR(36) NOT NULL,
  version INT NOT NULL,
  schema_version INT NOT NULL,
  encryption_version INT NOT NULL,
  kdf VARCHAR(32) NOT NULL,
  iterations INT NOT NULL,
  salt TEXT NOT NULL,
  iv TEXT NOT NULL,
  ciphertext LONGTEXT NOT NULL,
  content_hash CHAR(64) NOT NULL,
  byte_size INT NOT NULL,
  published_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (display_id, version),
  CONSTRAINT fk_version_display FOREIGN KEY (display_id) REFERENCES displays(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS encrypted_assets (
  id CHAR(36) NOT NULL PRIMARY KEY,
  display_id CHAR(36) NOT NULL,
  content_type VARCHAR(128) NOT NULL,
  byte_size INT NOT NULL,
  content_hash CHAR(64) NOT NULL,
  ciphertext LONGBLOB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_assets_display (display_id),
  CONSTRAINT fk_asset_display FOREIGN KEY (display_id) REFERENCES displays(id) ON DELETE CASCADE
);
