-- =============================================================
-- Esquema de la base de datos vectorial del proyecto opopdf
-- PostgreSQL + extensión pgvector
-- =============================================================

-- Extensión de búsqueda vectorial
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabla de fragmentos (chunks) extraídos de los PDF
CREATE TABLE IF NOT EXISTS chunks (
    id          SERIAL PRIMARY KEY,
    ruta_pdf    TEXT        NOT NULL,               -- ruta relativa del PDF de origen
    pagina      INTEGER,                            -- número de página (si aplica)
    tipo        TEXT        NOT NULL DEFAULT 'texto',-- 'texto' | 'tabla' | 'imagen'
    contenido   TEXT        NOT NULL,               -- texto del fragmento
    embedding   VECTOR(384),                       -- dimensión según el modelo de embeddings
    creado_en   TIMESTAMP   DEFAULT NOW()
);

-- Índice vectorial para búsqueda semántica (HNSW con distancia coseno)
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON chunks
    USING hnsw (embedding vector_cosine_ops);

-- Índice por PDF para poder re-ingerir sin duplicados
CREATE INDEX IF NOT EXISTS idx_chunks_ruta_pdf ON chunks (ruta_pdf);
