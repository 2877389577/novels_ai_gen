CREATE TABLE IF NOT EXISTS novels (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  author_name VARCHAR(255) NULL,
  description TEXT NULL,
  tags VARCHAR(1000) NULL,
  cover_url VARCHAR(1000) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE novels IS '小说信息表';
COMMENT ON COLUMN novels.id IS '小说主键ID';
COMMENT ON COLUMN novels.name IS '小说名，不能为空';
COMMENT ON COLUMN novels.author_name IS '作者名，可以为空';
COMMENT ON COLUMN novels.description IS '简介，可以为空';
COMMENT ON COLUMN novels.tags IS '标签，可以为空，多个标签使用英文逗号分隔';
COMMENT ON COLUMN novels.cover_url IS '封面链接，可以为空';
COMMENT ON COLUMN novels.created_at IS '创建时间';
COMMENT ON COLUMN novels.updated_at IS '更新时间';
