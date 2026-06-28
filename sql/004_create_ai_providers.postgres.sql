CREATE TABLE IF NOT EXISTS ai_providers (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  provider_type VARCHAR(64) NOT NULL,
  api_key_ciphertext TEXT NOT NULL,
  api_key_mask VARCHAR(255) NOT NULL,
  base_url VARCHAR(1000) NULL,
  api_type VARCHAR(64) NOT NULL DEFAULT 'completions',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NULL,
  CONSTRAINT ux_ai_providers_name UNIQUE (name)
);

COMMENT ON TABLE ai_providers IS 'AI提供商配置表';
COMMENT ON COLUMN ai_providers.id IS 'AI提供商主键ID';
COMMENT ON COLUMN ai_providers.name IS 'AI提供商名称，不能为空且唯一';
COMMENT ON COLUMN ai_providers.provider_type IS 'AI提供商类型，只能是openai、claude';
COMMENT ON COLUMN ai_providers.api_key_ciphertext IS '加密后的API Key密文，接口不回显';
COMMENT ON COLUMN ai_providers.api_key_mask IS 'API Key掩码，仅用于列表和详情展示';
COMMENT ON COLUMN ai_providers.base_url IS 'AI提供商接口基础地址，可以为空';
COMMENT ON COLUMN ai_providers.api_type IS 'AI接口类型，固定为completions';
COMMENT ON COLUMN ai_providers.enabled IS '是否启用该AI提供商';
COMMENT ON COLUMN ai_providers.created_at IS '创建时间';
COMMENT ON COLUMN ai_providers.updated_at IS '更新时间';

CREATE INDEX IF NOT EXISTS idx_ai_providers_enabled
  ON ai_providers(enabled);
