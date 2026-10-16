ALTER TABLE "ServidorAtivo"
  ADD COLUMN "idSegurado" TEXT,
  ADD COLUMN "dataNascimentoCiphertext" TEXT,
  ADD COLUMN "tempoContribuicaoAnos" DECIMAL(6,2),
  ADD COLUMN "regime" TEXT,
  ADD COLUMN "fonteDados" TEXT;

ALTER TABLE "Aposentado"
  ADD COLUMN "idSegurado" TEXT,
  ADD COLUMN "dataNascimentoCiphertext" TEXT,
  ADD COLUMN "tempoContribuicaoAnos" DECIMAL(6,2),
  ADD COLUMN "regime" TEXT,
  ADD COLUMN "fonteDados" TEXT;

ALTER TABLE "Pensionista"
  ADD COLUMN "idSegurado" TEXT,
  ADD COLUMN "dataNascimentoCiphertext" TEXT,
  ADD COLUMN "tempoContribuicaoAnos" DECIMAL(6,2),
  ADD COLUMN "regime" TEXT,
  ADD COLUMN "fonteDados" TEXT;

ALTER TABLE "FolhaPagamento"
  ADD COLUMN "valorBeneficio" DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN "periodoReferenciaInicio" DATE,
  ADD COLUMN "periodoReferenciaFim" DATE;

CREATE UNIQUE INDEX "ServidorAtivo_idSegurado_key" ON "ServidorAtivo"("idSegurado");
CREATE UNIQUE INDEX "Aposentado_idSegurado_key" ON "Aposentado"("idSegurado");
CREATE UNIQUE INDEX "Pensionista_idSegurado_key" ON "Pensionista"("idSegurado");
