-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'OPERATOR', 'AUDITOR', 'MEMBER');

-- CreateEnum
CREATE TYPE "PersonnelType" AS ENUM ('ACTIVE', 'RETIRED', 'PENSIONER');

-- CreateEnum
CREATE TYPE "CensusStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "OccurrenceStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "oidcSub" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServidorAtivo" (
    "id" UUID NOT NULL,
    "nomeCiphertext" TEXT NOT NULL,
    "cpfCiphertext" TEXT NOT NULL,
    "cpfHash" TEXT NOT NULL,
    "matriculaCiphertext" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "admissao" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServidorAtivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aposentado" (
    "id" UUID NOT NULL,
    "nomeCiphertext" TEXT NOT NULL,
    "cpfCiphertext" TEXT NOT NULL,
    "cpfHash" TEXT NOT NULL,
    "matriculaCiphertext" TEXT NOT NULL,
    "beneficio" TEXT NOT NULL,
    "inicioBeneficio" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Aposentado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pensionista" (
    "id" UUID NOT NULL,
    "nomeCiphertext" TEXT NOT NULL,
    "cpfCiphertext" TEXT NOT NULL,
    "cpfHash" TEXT NOT NULL,
    "matriculaCiphertext" TEXT NOT NULL,
    "beneficio" TEXT NOT NULL,
    "instituidorCiphertext" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pensionista_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CensoRegistro" (
    "id" UUID NOT NULL,
    "tipo" "PersonnelType" NOT NULL,
    "status" "CensusStatus" NOT NULL DEFAULT 'PENDING',
    "dataCadastro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataConclusao" TIMESTAMP(3),
    "ultimoAcesso" TIMESTAMP(3),
    "observacao" TEXT,
    "servidorAtivoId" UUID,
    "aposentadoId" UUID,
    "pensionistaId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CensoRegistro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FolhaPagamento" (
    "id" UUID NOT NULL,
    "competencia" DATE NOT NULL,
    "proventos" DECIMAL(15,2) NOT NULL,
    "baseCalculo" DECIMAL(15,2) NOT NULL,
    "descontos" DECIMAL(15,2) NOT NULL,
    "irrf" DECIMAL(15,2) NOT NULL,
    "contribuicaoSegurado" DECIMAL(15,2) NOT NULL,
    "contribuicaoPatronal" DECIMAL(15,2) NOT NULL,
    "servidorAtivoId" UUID,
    "aposentadoId" UUID,
    "pensionistaId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FolhaPagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ocorrencia" (
    "id" UUID NOT NULL,
    "tipoPessoa" "PersonnelType" NOT NULL,
    "pessoaId" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "status" "OccurrenceStatus" NOT NULL DEFAULT 'OPEN',
    "abertoPorId" UUID NOT NULL,
    "resolvidoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ocorrencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActuarialConfig" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "vigenciaInicio" DATE NOT NULL,
    "vigenciaFim" DATE,
    "aliquotaAtivo" DECIMAL(7,6) NOT NULL,
    "aliquotaAposentado" DECIMAL(7,6) NOT NULL,
    "aliquotaPensionista" DECIMAL(7,6) NOT NULL,
    "aliquotaPatronal" DECIMAL(7,6) NOT NULL,
    "deducaoDependente" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tetoPrevidenciario" DECIMAL(15,2),
    "isencaoBeneficioAte" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActuarialConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IrrfBracket" (
    "id" UUID NOT NULL,
    "configId" UUID NOT NULL,
    "limiteInferior" DECIMAL(15,2) NOT NULL,
    "limiteSuperior" DECIMAL(15,2),
    "aliquota" DECIMAL(7,6) NOT NULL,
    "parcelaDeduzir" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "IrrfBracket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_oidcSub_key" ON "User"("oidcSub");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ServidorAtivo_cpfHash_key" ON "ServidorAtivo"("cpfHash");

-- CreateIndex
CREATE INDEX "ServidorAtivo_cargo_idx" ON "ServidorAtivo"("cargo");

-- CreateIndex
CREATE UNIQUE INDEX "Aposentado_cpfHash_key" ON "Aposentado"("cpfHash");

-- CreateIndex
CREATE UNIQUE INDEX "Pensionista_cpfHash_key" ON "Pensionista"("cpfHash");

-- CreateIndex
CREATE INDEX "CensoRegistro_status_dataCadastro_idx" ON "CensoRegistro"("status", "dataCadastro");

-- CreateIndex
CREATE INDEX "CensoRegistro_tipo_dataCadastro_idx" ON "CensoRegistro"("tipo", "dataCadastro");

-- CreateIndex
CREATE INDEX "FolhaPagamento_competencia_idx" ON "FolhaPagamento"("competencia");

-- CreateIndex
CREATE INDEX "Ocorrencia_tipoPessoa_pessoaId_status_idx" ON "Ocorrencia"("tipoPessoa", "pessoaId", "status");

-- CreateIndex
CREATE INDEX "ActuarialConfig_vigenciaInicio_vigenciaFim_idx" ON "ActuarialConfig"("vigenciaInicio", "vigenciaFim");

-- CreateIndex
CREATE INDEX "IrrfBracket_configId_limiteInferior_idx" ON "IrrfBracket"("configId", "limiteInferior");

-- AddForeignKey
ALTER TABLE "CensoRegistro" ADD CONSTRAINT "CensoRegistro_servidorAtivoId_fkey" FOREIGN KEY ("servidorAtivoId") REFERENCES "ServidorAtivo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CensoRegistro" ADD CONSTRAINT "CensoRegistro_aposentadoId_fkey" FOREIGN KEY ("aposentadoId") REFERENCES "Aposentado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CensoRegistro" ADD CONSTRAINT "CensoRegistro_pensionistaId_fkey" FOREIGN KEY ("pensionistaId") REFERENCES "Pensionista"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolhaPagamento" ADD CONSTRAINT "FolhaPagamento_servidorAtivoId_fkey" FOREIGN KEY ("servidorAtivoId") REFERENCES "ServidorAtivo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolhaPagamento" ADD CONSTRAINT "FolhaPagamento_aposentadoId_fkey" FOREIGN KEY ("aposentadoId") REFERENCES "Aposentado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolhaPagamento" ADD CONSTRAINT "FolhaPagamento_pensionistaId_fkey" FOREIGN KEY ("pensionistaId") REFERENCES "Pensionista"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ocorrencia" ADD CONSTRAINT "Ocorrencia_abertoPorId_fkey" FOREIGN KEY ("abertoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IrrfBracket" ADD CONSTRAINT "IrrfBracket_configId_fkey" FOREIGN KEY ("configId") REFERENCES "ActuarialConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

