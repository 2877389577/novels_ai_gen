CREATE TABLE IF NOT EXISTS ai_providers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'AI提供商主键ID',
  name VARCHAR(255) NOT NULL COMMENT 'AI提供商名称，不能为空且唯一',
  provider_type VARCHAR(64) NOT NULL COMMENT 'AI提供商类型，只能是openai、claude',
  api_key_ciphertext TEXT NOT NULL COMMENT '加密后的API Key密文，接口不回显',
  api_key_mask VARCHAR(255) NOT NULL COMMENT 'API Key掩码，仅用于列表和详情展示',
  base_url VARCHAR(1000) NULL COMMENT 'AI提供商接口基础地址，可以为空',
  api_type VARCHAR(64) NOT NULL DEFAULT 'completions' COMMENT 'AI接口类型，固定为completions',
  enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用该AI提供商',
  created_at DATETIME(3) NULL COMMENT '创建时间',
  updated_at DATETIME(3) NULL COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY ux_ai_providers_name (name),
  KEY idx_ai_providers_enabled (enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI提供商配置表';
