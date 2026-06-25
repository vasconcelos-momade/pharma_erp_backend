-- Índice para filtragem por categoria (seguro em produção: apenas CREATE INDEX).
CREATE INDEX `produtos_categoria_idx` ON `produtos`(`categoria`);
