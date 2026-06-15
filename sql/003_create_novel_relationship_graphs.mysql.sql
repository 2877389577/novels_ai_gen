CREATE TABLE IF NOT EXISTS novel_relationship_graphs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '角色关系图主键ID',
  novel_id BIGINT UNSIGNED NOT NULL COMMENT '所属小说ID',
  viewport_x DOUBLE NOT NULL DEFAULT 0 COMMENT '画布视口X坐标',
  viewport_y DOUBLE NOT NULL DEFAULT 0 COMMENT '画布视口Y坐标',
  viewport_zoom DOUBLE NOT NULL DEFAULT 1 COMMENT '画布视口缩放比例',
  created_at DATETIME(3) NULL COMMENT '创建时间',
  updated_at DATETIME(3) NULL COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY idx_relationship_graphs_novel_id (novel_id),
  CONSTRAINT fk_relationship_graphs_novel
    FOREIGN KEY (novel_id) REFERENCES novels(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='小说角色关系图主表';

CREATE TABLE IF NOT EXISTS novel_relationship_graph_nodes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '角色关系图节点主键ID',
  graph_id BIGINT UNSIGNED NOT NULL COMMENT '所属角色关系图ID',
  novel_id BIGINT UNSIGNED NOT NULL COMMENT '所属小说ID',
  character_id BIGINT UNSIGNED NOT NULL COMMENT '画布节点引用的角色卡ID',
  position_x DOUBLE NOT NULL DEFAULT 0 COMMENT '节点在画布中的X坐标',
  position_y DOUBLE NOT NULL DEFAULT 0 COMMENT '节点在画布中的Y坐标',
  created_at DATETIME(3) NULL COMMENT '创建时间',
  updated_at DATETIME(3) NULL COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY idx_relationship_nodes_novel_character (novel_id, character_id),
  KEY idx_relationship_nodes_graph_id (graph_id),
  KEY idx_relationship_nodes_novel_id (novel_id),
  CONSTRAINT fk_relationship_nodes_graph
    FOREIGN KEY (graph_id) REFERENCES novel_relationship_graphs(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_relationship_nodes_novel
    FOREIGN KEY (novel_id) REFERENCES novels(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_relationship_nodes_character
    FOREIGN KEY (character_id) REFERENCES novel_characters(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='小说角色关系图节点表';

CREATE TABLE IF NOT EXISTS novel_relationship_graph_edges (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '角色关系图关系线主键ID',
  graph_id BIGINT UNSIGNED NOT NULL COMMENT '所属角色关系图ID',
  novel_id BIGINT UNSIGNED NOT NULL COMMENT '所属小说ID',
  character_a_id BIGINT UNSIGNED NOT NULL COMMENT '无方向关系线中较小的角色卡ID',
  character_b_id BIGINT UNSIGNED NOT NULL COMMENT '无方向关系线中较大的角色卡ID',
  note TEXT NULL COMMENT '关系线备注，用于描述两个角色之间的关系',
  created_at DATETIME(3) NULL COMMENT '创建时间',
  updated_at DATETIME(3) NULL COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY idx_relationship_edges_novel_pair (novel_id, character_a_id, character_b_id),
  KEY idx_relationship_edges_graph_id (graph_id),
  KEY idx_relationship_edges_novel_id (novel_id),
  CONSTRAINT fk_relationship_edges_graph
    FOREIGN KEY (graph_id) REFERENCES novel_relationship_graphs(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_relationship_edges_novel
    FOREIGN KEY (novel_id) REFERENCES novels(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_relationship_edges_character_a
    FOREIGN KEY (character_a_id) REFERENCES novel_characters(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_relationship_edges_character_b
    FOREIGN KEY (character_b_id) REFERENCES novel_characters(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='小说角色关系图关系线表';
