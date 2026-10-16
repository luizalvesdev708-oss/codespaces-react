import random
import pandas as pd
from faker import Faker

# Inicializa o gerador de dados em português do Brasil
fake = Faker('pt_BR')

def gerar_cpf_falso():
    """Gera um número de CPF fictício formatado."""
    return f"{random.randint(100, 999)}.{random.randint(100, 999)}.{random.randint(100, 999)}-{random.randint(10, 99)}"

def gerar_massa_dados_previdenciarios(qtd_registros=1000):
    regimes = ['IPSS', 'RPPS', 'RGPS']
    fontes = ['Dados fornecidos', 'Integrado via API', 'MIGRAÇÃO_2025', 'BASE_LEGADA']
    status_recenseamento = ['Recenseado', 'Pendente', 'Em Análise', 'Não Recenseado']
    categorias = ['Ativo', 'Aposentado', 'Pensionista']
    
    dados = []

    for i in range(1, qtd_registros + 1):
        categoria = random.choice(categorias)
        idade = random.randint(22, 85) if categoria != 'Ativo' else random.randint(22, 64)
        
        # Regras de salário/benefício simuladas
        if categoria == 'Ativo':
            valor_base = round(random.uniform(2500.00, 18000.00), 2)
            valor_contrib = round(valor_base * random.uniform(0.11, 0.14), 2)
            valor_beneficio = 0.0
        else:
            valor_base = 0.0
            valor_contrib = 0.0
            valor_beneficio = round(random.uniform(1412.00, 12000.00), 2)

        registro = {
            "id_segurado": f"SEG-{i:06d}",
            "nome_completo": fake.name(),
            "cpf": gerar_cpf_falso(),
            "data_nascimento": fake.date_of_birth(minimum_age=20, maximum_age=90).strftime('%Y-%m-%d'),
            "idade": idade,
            "categoria": categoria,
            "status_recenseado": random.choice(status_recenseamento),
            "regime": random.choice(regimes),
            "fonte_dados": random.choice(fontes),
            "tempo_contribuição_anos": random.randint(1, 40),
            "valor_salario_base": valor_base,
            "valor_contribuicao": valor_contrib,
            "valor_beneficio": valor_beneficio,
            "data_ultimo_recenseamento": fake.date_between(start_date='-2y', end_date='today').strftime('%Y-%m-%d'),
            "periodo_referencia": "Março/2026 — Agosto/2026"
        }
        dados.append(registro)

    return pd.DataFrame(dados)

# --- EXECUÇÃO ---
# Altere a quantidade de registros conforme necessário (ex: 5000, 10000, 50000)
QTD = 1000 
df = gerar_massa_dados_previdenciarios(QTD)

# Exportar para múltiplos formatos
df.to_csv("massa_dados_previdenciarios.csv", index=False, encoding='utf-8-sig')
df.to_json("massa_dados_previdenciarios.json", orient="records", indent=2, force_ascii=False)
df.to_excel("massa_dados_previdenciarios.xlsx", index=False)

print(f"✅ Sucesso! {QTD} registros previdenciários falsos foram gerados nos arquivos:")
print(" - massa_dados_previdenciarios.csv")
print(" - massa_dados_previdenciarios.json")
print(" - massa_dados_previdenciarios.xlsx")