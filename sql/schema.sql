CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(128) NOT NULL,
  salt VARCHAR(64) NOT NULL,
  avatar_url LONGTEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sender_id INT NOT NULL,
  receiver_id INT NOT NULL,
  message_type VARCHAR(20) NOT NULL DEFAULT 'text',
  message_encrypted TEXT NOT NULL,
  media_url LONGTEXT NULL,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  iv VARCHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_messages_receiver FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_messages_sender_receiver_created (sender_id, receiver_id, created_at),
  INDEX idx_messages_receiver_sender_created (receiver_id, sender_id, created_at)
);

CREATE TABLE IF NOT EXISTS direct_invites (
  id INT PRIMARY KEY AUTO_INCREMENT,
  pair_key VARCHAR(64) NOT NULL UNIQUE,
  sender_id INT NOT NULL,
  receiver_id INT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP NULL DEFAULT NULL,
  CONSTRAINT fk_direct_invites_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_direct_invites_receiver FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_direct_invites_receiver_status (receiver_id, status, created_at),
  INDEX idx_direct_invites_sender_status (sender_id, status, created_at)
);

DROP TABLE IF EXISTS group_messages;
DROP TABLE IF EXISTS group_members;
DROP TABLE IF EXISTS `groups`;

CREATE TABLE `groups` (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  avatar_url LONGTEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE group_members (
  id INT PRIMARY KEY AUTO_INCREMENT,
  group_id INT NOT NULL,
  user_id INT NOT NULL,
  CONSTRAINT fk_group_members_group FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
  CONSTRAINT fk_group_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT uq_group_members UNIQUE (group_id, user_id),
  INDEX idx_group_members_user_group (user_id, group_id)
);

CREATE TABLE group_messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  group_id INT NOT NULL,
  sender_id INT NOT NULL,
  message_encrypted LONGTEXT NOT NULL,
  iv VARCHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_group_messages_group FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
  CONSTRAINT fk_group_messages_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_group_messages_group_created (group_id, created_at, id),
  INDEX idx_group_messages_sender_created (sender_id, created_at, id)
);
