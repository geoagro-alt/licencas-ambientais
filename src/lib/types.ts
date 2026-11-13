export type Papel = "admin" | "editor" | "leitor";
export type SituacaoLicenca = "ativa" | "em_renovacao" | "encerrada";
export type TipoCondicionante = "unica" | "periodica" | "permanente";
export type SituacaoCondicionante = "pendente" | "em_andamento" | "cumprida" | "nao_aplicavel";

export interface Empresa {
  id: string;
  org_id: string;
  razao_social: string;
  cnpj_cpf: string | null;
  contato_nome: string | null;
  contato_email: string | null;
  telefone: string | null;
  observacoes: string | null;
}

export interface Empreendimento {
  id: string;
  org_id: string;
  empresa_id: string;
  nome: string;
  atividade: string | null;
  municipio: string | null;
  uf: string | null;
  car: string | null;
  latitude: number | null;
  longitude: number | null;
  observacoes: string | null;
}

export interface Licenca {
  id: string;
  org_id: string;
  empreendimento_id: string;
  tipo: string;
  numero: string | null;
  orgao: string | null;
  processo: string | null;
  descricao: string | null;
  data_emissao: string | null;
  data_validade: string | null;
  antecedencia_renovacao_dias: number;
  situacao: SituacaoLicenca;
  protocolo_renovacao: string | null;
  data_protocolo_renovacao: string | null;
  responsavel_id: string | null;
  observacoes: string | null;
}

export interface Condicionante {
  id: string;
  org_id: string;
  licenca_id: string;
  numero: string | null;
  descricao: string;
  tipo: TipoCondicionante;
  periodicidade_meses: number | null;
  prazo: string | null;
  situacao: SituacaoCondicionante;
  responsavel_id: string | null;
  observacoes: string | null;
}

export interface Membro {
  org_id: string;
  user_id: string;
  papel: Papel;
  nome: string | null;
  email: string;
  receber_alertas: boolean;
}

export const TIPOS_LICENCA = [
  "LP – Licença Prévia",
  "LI – Licença de Instalação",
  "LO – Licença de Operação",
  "LP/LI – Licença Prévia e de Instalação",
  "LAU – Licença Ambiental Única",
  "LAS – Licença Ambiental Simplificada",
  "LAC – Licença por Adesão e Compromisso",
  "AuA – Autorização Ambiental",
  "ASV – Autorização de Supressão de Vegetação",
  "Outorga de uso de recursos hídricos",
  "Dispensa de outorga / Uso insignificante",
  "CTF/IBAMA",
  "CADRI",
  "CAR – Cadastro Ambiental Rural",
  "Alvará",
  "Registro MAPA",
  "AVCB – Corpo de Bombeiros",
  "Outro",
] as const;

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];
