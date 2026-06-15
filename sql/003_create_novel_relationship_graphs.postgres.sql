CREATE TABLE IF NOT EXISTS novel_relationship_graphs (
  id BIGSERIAL PRIMARY KEY,
  novel_id BIGINT NOT NULL UNIQUE,
  viewport_x DOUBLE PRECISION NOT NULL DEFAULT 0,
  viewport_y DOUBLE PRECISION NOT NULL DEFAULT 0,
  viewport_zoom DOUBLE PRECISION NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NULL,
  CONSTRAINT fk_relationship_graphs_novel
    FOREIGN KEY (novel_id) REFERENCES novels(id)
    ON UPDATE CASCADE ON DELETE CASCADE
);

COMMENT ON TABLE novel_relationship_graphs IS '小说角色关系图主表';
COMMENT ON COLUMN novel_relationship_graphs.id IS '角色关系图主键ID';
COMMENT ON COLUMN novel_relationship_graphs.novel_id IS '所属小说ID';
COMMENT ON COLUMN novel_relationship_graphs.viewport_x IS '画布视口X坐标';
COMMENT ON COLUMN novel_relationship_graphs.viewport_y IS '画布视口Y坐标';
COMMENT ON COLUMN novel_relationship_graphs.viewport_zoom IS '画布视口缩放比例';
COMMENT ON COLUMN novel_relationship_graphs.created_at IS '创建时间';
COMMENT ON COLUMN novel_relationship_graphs.updated_at IS '更新时间';

CREATE TABLE IF NOT EXISTS novel_relationship_graph_nodes (
  id BIGSERIAL PRIMARY KEY,
  graph_id BIGINT NOT NULL,
  novel_id BIGINT NOT NULL,
  character_id BIGINT NOT NULL,
  position_x DOUBLE PRECISION NOT NULL DEFAULT 0,
  position_y DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NULL,
  CONSTRAINT fk_relationship_nodes_graph
    FOREIGN KEY (graph_id) REFERENCES novel_relationship_graphs(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_relationship_nodes_novel
    FOREIGN KEY (novel_id) REFERENCES novels(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_relationship_nodes_character
    FOREIGN KEY (character_id) REFERENCES novel_characters(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT idx_relationship_nodes_novel_character UNIQUE (novel_id, character_id)
);

COMMENT ON TABLE novel_relationship_graph_nodes IS '小说角色关系图节点表';
COMMENT ON COLUMN novel_relationship_graph_nodes.id IS '角色关系图节点主键ID';
COMMENT ON COLUMN novel_relationship_graph_nodes.graph_id IS '所属角色关系图ID';
COMMENT ON COLUMN novel_relationship_graph_nodes.novel_id IS '所属小说ID';
COMMENT ON COLUMN novel_relationship_graph_nodes.character_id IS '画布节点引用的角色卡ID';
COMMENT ON COLUMN novel_relationship_graph_nodes.position_x IS '节点在画布中的X坐标';
COMMENT ON COLUMN novel_relationship_graph_nodes.position_y IS '节点在画布中的Y坐标';
COMMENT ON COLUMN novel_relationship_graph_nodes.created_at IS '创建时间';
COMMENT ON COLUMN novel_relationship_graph_nodes.updated_at IS '更新时间';

CREATE INDEX IF NOT EXISTS idx_relationship_nodes_graph_id
  ON novel_relationship_graph_nodes(graph_id);
CREATE INDEX IF NOT EXISTS idx_relationship_nodes_novel_id
  ON novel_relationship_graph_nodes(novel_id);

CREATE TABLE IF NOT EXISTS novel_relationship_graph_edges (
  id BIGSERIAL PRIMARY KEY,
  graph_id BIGINT NOT NULL,
  novel_id BIGINT NOT NULL,
  character_a_id BIGINT NOT NULL,
  character_b_id BIGINT NOT NULL,
  note TEXT NULL,
  created_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NULL,
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
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT idx_relationship_edges_novel_pair UNIQUE (novel_id, character_a_id, character_b_id)
);

COMMENT ON TABLE novel_relationship_graph_edges IS '小说角色关系图关系线表';
COMMENT ON COLUMN novel_relationship_graph_edges.id IS '角色关系图关系线主键ID';
COMMENT ON COLUMN novel_relationship_graph_edges.graph_id IS '所属角色关系图ID';
COMMENT ON COLUMN novel_relationship_graph_edges.novel_id IS '所属小说ID';
COMMENT ON COLUMN novel_relationship_graph_edges.character_a_id IS '无方向关系线中较小的角色卡ID';
COMMENT ON COLUMN novel_relationship_graph_edges.character_b_id IS '无方向关系线中较大的角色卡ID';
COMMENT ON COLUMN novel_relationship_graph_edges.note IS '关系线备注，用于描述两个角色之间的关系';
COMMENT ON COLUMN novel_relationship_graph_edges.created_at IS '创建时间';
COMMENT ON COLUMN novel_relationship_graph_edges.updated_at IS '更新时间';

CREATE INDEX IF NOT EXISTS idx_relationship_edges_graph_id
  ON novel_relationship_graph_edges(graph_id);
CREATE INDEX IF NOT EXISTS idx_relationship_edges_novel_id
  ON novel_relationship_graph_edges(novel_id);
