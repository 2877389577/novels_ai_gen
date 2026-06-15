CREATE TABLE IF NOT EXISTS novel_characters (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '角色卡主键ID',
  novel_id BIGINT UNSIGNED NOT NULL COMMENT '所属小说ID',
  portrait_url VARCHAR(1000) NULL COMMENT '肖像图链接或对象存储key，可以为空',
  name VARCHAR(255) NOT NULL COMMENT '角色姓名，不能为空',
  gender VARCHAR(64) NULL COMMENT '角色性别，可以为空',
  tags VARCHAR(1000) NULL COMMENT '角色标签，可以为空，多个标签使用英文逗号分隔',
  background TEXT NULL COMMENT '角色背景，可以为空',
  personality TEXT NULL COMMENT '角色性格，可以为空',
  ability TEXT NULL COMMENT '角色能力，可以为空',
  goal TEXT NULL COMMENT '角色目的，可以为空',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  KEY idx_novel_characters_novel_id (novel_id),
  CONSTRAINT fk_novel_characters_novel FOREIGN KEY (novel_id) REFERENCES novels (id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='小说角色卡信息表';
