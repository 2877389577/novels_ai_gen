CREATE TABLE IF NOT EXISTS ai_providers (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  provider_type VARCHAR(64) NOT NULL,
  api_key_ciphertext TEXT NOT NULL,
  api_key_mask VARCHAR(255) NOT NULL,
  model VARCHAR(255) NOT NULL,
  base_url VARCHAR(1000) NULL,
  api_type VARCHAR(64) NOT NULL DEFAULT 'response',
  max_tokens INTEGER NOT NULL DEFAULT 1024,
  temperature DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  top_p DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  thinking_level INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NULL,
  CONSTRAINT ux_ai_providers_name UNIQUE (name)
);

COMMENT ON TABLE ai_providers IS 'AI提供商配置表';
COMMENT ON COLUMN ai_providers.id IS 'AI提供商主键ID';
COMMENT ON COLUMN ai_providers.name IS 'AI提供商名称，不能为空且唯一';
COMMENT ON COLUMN ai_providers.provider_type IS 'AI提供商类型，只能是openai、claude、gemini';
COMMENT ON COLUMN ai_providers.api_key_ciphertext IS '加密后的API Key密文，接口不回显';
COMMENT ON COLUMN ai_providers.api_key_mask IS 'API Key掩码，仅用于列表和详情展示';
COMMENT ON COLUMN ai_providers.model IS 'AI模型名称，不能为空';
COMMENT ON COLUMN ai_providers.base_url IS 'AI提供商接口基础地址，可以为空';
COMMENT ON COLUMN ai_providers.api_type IS 'AI接口类型，只能是response或completions，默认response';
COMMENT ON COLUMN ai_providers.max_tokens IS '最大输出token数，必须大于0';
COMMENT ON COLUMN ai_providers.temperature IS '采样温度，不能小于0';
COMMENT ON COLUMN ai_providers.top_p IS 'nucleus sampling参数，必须在0到1之间';
COMMENT ON COLUMN ai_providers.thinking_level IS '思考等级，不能小于0';
COMMENT ON COLUMN ai_providers.enabled IS '是否启用该AI提供商';
COMMENT ON COLUMN ai_providers.created_at IS '创建时间';
COMMENT ON COLUMN ai_providers.updated_at IS '更新时间';

CREATE INDEX IF NOT EXISTS idx_ai_providers_enabled
  ON ai_providers(enabled);
