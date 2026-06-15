CREATE TABLE IF NOT EXISTS novel_characters (
  id BIGSERIAL PRIMARY KEY,
  novel_id BIGINT NOT NULL,
  portrait_url VARCHAR(1000) NULL,
  name VARCHAR(255) NOT NULL,
  gender VARCHAR(64) NULL,
  tags VARCHAR(1000) NULL,
  background TEXT NULL,
  personality TEXT NULL,
  ability TEXT NULL,
  goal TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_novel_characters_novel FOREIGN KEY (novel_id) REFERENCES novels (id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_novel_characters_novel_id ON novel_characters (novel_id);

COMMENT ON TABLE novel_characters IS '小说角色卡信息表';
COMMENT ON COLUMN novel_characters.id IS '角色卡主键ID';
COMMENT ON COLUMN novel_characters.novel_id IS '所属小说ID';
COMMENT ON COLUMN novel_characters.portrait_url IS '肖像图链接或对象存储key，可以为空';
COMMENT ON COLUMN novel_characters.name IS '角色姓名，不能为空';
COMMENT ON COLUMN novel_characters.gender IS '角色性别，可以为空';
COMMENT ON COLUMN novel_characters.tags IS '角色标签，可以为空，多个标签使用英文逗号分隔';
COMMENT ON COLUMN novel_characters.background IS '角色背景，可以为空';
COMMENT ON COLUMN novel_characters.personality IS '角色性格，可以为空';
COMMENT ON COLUMN novel_characters.ability IS '角色能力，可以为空';
COMMENT ON COLUMN novel_characters.goal IS '角色目的，可以为空';
COMMENT ON COLUMN novel_characters.created_at IS '创建时间';
COMMENT ON COLUMN novel_characters.updated_at IS '更新时间';
