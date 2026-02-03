/*
  # Create Support Tickets Table

  ## Overview
  Creates tables to store support ticket data from GLPI system with analytics capabilities.

  ## New Tables

  ### `tickets`
  Stores all support ticket information
  - `id` (text, primary key) - Ticket ID
  - `title` (text) - Ticket title
  - `entity` (text) - Entity/Department
  - `assigned_technician` (text) - Assigned technician name
  - `status` (text) - Ticket status (Fechado, Solucionado, etc)
  - `opened_date` (timestamptz) - When ticket was opened
  - `updated_date` (timestamptz) - Last update timestamp
  - `resolved_date` (timestamptz, nullable) - When ticket was resolved
  - `requester` (text) - Who requested the ticket
  - `priority` (text) - Priority level (Baixa, Média, Alta)
  - `tags` (text) - Tags/Labels
  - `technical_group` (text) - Technical group responsible
  - `resolution_time_hours` (numeric, nullable) - Time to resolution in hours
  - `created_at` (timestamptz) - Record creation timestamp

  ## Security
  - Enable RLS on tickets table
  - Add policies for authenticated users to read data

  ## Analysis Tables

  ### `ticket_metrics`
  Cached metrics for dashboard KPIs
  - `id` (uuid, primary key)
  - `metric_name` (text) - Name of metric
  - `metric_value` (numeric) - Value
  - `data_date` (date) - Date of metric
  - `created_at` (timestamptz)
*/

DROP TABLE IF EXISTS ticket_metrics;
DROP TABLE IF EXISTS tickets;

CREATE TABLE IF NOT EXISTS tickets (
  id text PRIMARY KEY,
  title text NOT NULL,
  entity text NOT NULL,
  assigned_technician text NOT NULL,
  status text NOT NULL,
  opened_date timestamptz NOT NULL,
  updated_date timestamptz NOT NULL,
  resolved_date timestamptz,
  requester text NOT NULL,
  priority text NOT NULL,
  tags text,
  technical_group text NOT NULL,
  resolution_time_hours numeric,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ticket_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name text NOT NULL,
  metric_value numeric NOT NULL,
  data_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_opened_date ON tickets(opened_date);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_technician ON tickets(assigned_technician);
CREATE INDEX IF NOT EXISTS idx_tickets_technical_group ON tickets(technical_group);

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to tickets"
  ON tickets FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert to tickets"
  ON tickets FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update to tickets"
  ON tickets FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public read access to ticket metrics"
  ON ticket_metrics FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert to ticket metrics"
  ON ticket_metrics FOR INSERT
  TO authenticated
  WITH CHECK (true);

INSERT INTO tickets (id, title, entity, assigned_technician, status, opened_date, updated_date, resolved_date, requester, priority, tags, technical_group, resolution_time_hours) VALUES
  ('2601260996', 'RPA NFe | Reconhecer processos de Estados Unidos em Conserva', 'Minerva Foods > Tecnologia', 'Levi Ribeiro Cury', 'Fechado', '2026-01-26 12:36:00+00', '2026-01-27 11:30:00+00', '2026-01-27 09:21:00+00', 'Joao Vitor Martins da Silva', 'Baixa', '', 'Desenvolvimento > RPA', 20.75),
  ('2601200490', 'RPA CSI África do Sul | Porto e endereços incorretos', 'Minerva Foods > Tecnologia', 'Levi Ribeiro Cury', 'Fechado', '2026-01-20 09:08:00+00', '2026-01-29 19:01:00+00', '2026-01-26 11:12:00+00', 'Joao Vitor Martins da Silva', 'Baixa', '', 'Desenvolvimento > RPA', 146.07),
  ('2601240328', 'RPA CSO USA em conserva | Mencionar número da ordem conforme pedido', 'Minerva Foods > Tecnologia', 'Levi Ribeiro Cury', 'Fechado', '2026-01-24 16:05:00+00', '2026-01-29 19:01:00+00', '2026-01-26 11:11:00+00', 'Joao Vitor Martins da Silva', 'Baixa', '', 'Desenvolvimento > RPA', 43.1),
  ('2601221613', 'RPA CSN | Datas de produção incorreta', 'Minerva Foods > Tecnologia', 'Igor Martins Minuncio', 'Fechado', '2026-01-22 17:02:00+00', '2026-01-26 19:01:00+00', '2026-01-23 16:01:00+00', 'Joao Vitor Martins da Silva', 'Baixa', '', 'Desenvolvimento > RPA', 22.97),
  ('2601221591', 'RPA CSI Arábia Saudita | Erro ao executar CSI em PRN', 'Minerva Foods > Tecnologia', 'Levi Ribeiro Cury', 'Fechado', '2026-01-22 16:53:00+00', '2026-01-26 19:01:00+00', '2026-01-23 11:26:00+00', 'Joao Vitor Martins da Silva', 'Baixa', '', 'Desenvolvimento > RPA', 18.55),
  ('2601151301', 'RPA NF | Erro ao anexar documentos', 'Minerva Foods > Tecnologia', 'Igor Martins Minuncio', 'Fechado', '2026-01-15 15:20:00+00', '2026-01-23 11:37:00+00', '2026-01-22 17:41:00+00', 'Joao Vitor Martins da Silva', 'Baixa', '', 'Desenvolvimento > RPA', 170.35),
  ('2601211365', 'RPA DCPOA | Considerar data de abate como produção', 'Minerva Foods > Tecnologia', 'Levi Ribeiro Cury', 'Fechado', '2026-01-21 15:27:00+00', '2026-01-25 19:09:00+00', '2026-01-22 13:52:00+00', 'Joao Vitor Martins da Silva', 'Baixa', '', 'Desenvolvimento > RPA', 22.42),
  ('2601211609', 'RPA NFe | Atualização da natureza do pedido', 'Minerva Foods > Tecnologia', 'Igor Martins Minuncio', 'Fechado', '2026-01-21 16:55:00+00', '2026-01-22 15:05:00+00', '2026-01-22 13:43:00+00', 'Joao Vitor Martins da Silva', 'Baixa', '', 'Desenvolvimento > RPA', 20.8),
  ('2601210575', 'RPA CSI China | Atualização do Cadastro de descrições China', 'Minerva Foods > Tecnologia', 'Igor Martins Minuncio', 'Fechado', '2026-01-21 10:18:00+00', '2026-01-25 19:09:00+00', '2026-01-21 19:36:00+00', 'Joao Vitor Martins da Silva', 'Baixa', '', 'Desenvolvimento > RPA', 9.3),
  ('2601211334', 'RPA CSI USA | Peso líquido total incorreto', 'Minerva Foods > Tecnologia', 'Levi Ribeiro Cury', 'Fechado', '2026-01-21 15:18:00+00', '2026-01-24 19:04:00+00', '2026-01-21 15:20:00+00', 'Joao Vitor Martins da Silva', 'Baixa', '', 'Desenvolvimento > RPA', 0.03),
  ('2601201039', 'RPA CSI UE | Mencionar endereço completo no Local Expedição', 'Minerva Foods > Tecnologia', 'Levi Ribeiro Cury', 'Fechado', '2026-01-20 12:13:00+00', '2026-01-23 11:41:00+00', '2026-01-20 17:44:00+00', 'Joao Vitor Martins da Silva', 'Baixa', '', 'Desenvolvimento > RPA', 5.52),
  ('2601200877', 'RPA CSI UE | Imo do navio não encontrado', 'Minerva Foods > Tecnologia', 'Levi Ribeiro Cury', 'Fechado', '2026-01-20 11:17:00+00', '2026-01-23 19:03:00+00', '2026-01-20 17:43:00+00', 'Joao Vitor Martins da Silva', 'Baixa', '', 'Desenvolvimento > RPA', 6.43),
  ('2601200329', 'RPA DCPOA | Acesso ao RPA agrupamento por DIPOA no IBM', 'Minerva Foods > Tecnologia', 'Igor Martins Minuncio', 'Fechado', '2026-01-20 08:10:00+00', '2026-01-23 19:02:00+00', '2026-01-20 10:34:00+00', 'Joao Vitor Martins da Silva', 'Baixa', '', 'Desenvolvimento > RPA', 2.4),
  ('2601170174', 'RPA CSI USA | Mencionar batchs em ordem crescentes', 'Minerva Foods > Tecnologia', 'Igor Martins Minuncio', 'Fechado', '2026-01-17 12:54:00+00', '2026-01-20 08:37:00+00', '2026-01-19 16:04:00+00', 'Joao Vitor Martins da Silva', 'Baixa', '', 'Desenvolvimento > RPA', 51.17),
  ('2601151295', 'Informe China - Campos em branco', 'Minerva Foods > Tecnologia', 'Igor Martins Minuncio', 'Fechado', '2026-01-15 15:15:00+00', '2026-01-22 19:01:00+00', '2026-01-19 12:07:00+00', 'Sarah Hamina Goncalves dos Santos', 'Média', '', 'Desenvolvimento > RPA', 92.87),
  ('2601190450', 'RPA CSI México | Descrição do produto em português incorreta', 'Minerva Foods > Tecnologia', 'Levi Ribeiro Cury', 'Fechado', '2026-01-19 09:23:00+00', '2026-01-22 19:01:00+00', '2026-01-19 11:02:00+00', 'Joao Vitor Martins da Silva', 'Baixa', '', 'Desenvolvimento > RPA', 1.65),
  ('2601090699', 'RPA CSI | Processos executados mais de uma vez pelo RPA', 'Minerva Foods > Tecnologia', 'Levi Ribeiro Cury', 'Fechado', '2026-01-09 10:49:00+00', '2026-01-22 19:00:00+00', '2026-01-19 09:40:00+00', 'Joao Vitor Martins da Silva', 'Baixa', '', 'Desenvolvimento > RPA', 238.85),
  ('2601140834', 'RPA CSN | Lentidão em processos de Pontes e Lacerda', 'Minerva Foods > Tecnologia', 'Igor Martins Minuncio', 'Fechado', '2026-01-14 10:47:00+00', '2026-01-22 19:00:00+00', '2026-01-19 08:51:00+00', 'Rebeca Medeiros Moura', 'Baixa', '', 'Desenvolvimento > RPA', 118.07),
  ('2601150559', 'RPA DCPOA | Atualização para DCPOA com finalidade Alimentação Animal', 'Minerva Foods > Tecnologia', 'Levi Ribeiro Cury', 'Fechado', '2026-01-15 10:05:00+00', '2026-01-18 19:02:00+00', '2026-01-15 16:49:00+00', 'Joao Vitor Martins da Silva', 'Baixa', '', 'Desenvolvimento > RPA', 6.73),
  ('2601140454', 'RPA DCPOA | Ajustes nas regras de agrupamento por DCPOA', 'Minerva Foods > Tecnologia', 'Levi Ribeiro Cury', 'Fechado', '2026-01-14 09:00:00+00', '2026-01-18 19:00:00+00', '2026-01-15 13:49:00+00', 'Joao Vitor Martins da Silva', 'Baixa', '', 'Desenvolvimento > RPA', 52.82),
  ('2601080350', 'RPA CSI RÚSSIA | Quantidades incorretas', 'Minerva Foods > Tecnologia', 'Igor Martins Minuncio', 'Fechado', '2026-01-08 08:28:00+00', '2026-01-18 19:00:00+00', '2026-01-15 08:35:00+00', 'Joao Vitor Martins da Silva', 'Baixa', '', 'Desenvolvimento > RPA', 168.12),
  ('2601120861', 'RPA CSI União Europeia | Datas de congelamento divergentes', 'Minerva Foods > Tecnologia', 'Igor Martins Minuncio', 'Fechado', '2026-01-12 11:26:00+00', '2026-01-17 19:00:00+00', '2026-01-14 16:33:00+00', 'Joao Vitor Martins da Silva', 'Baixa', '', 'Desenvolvimento > RPA', 53.12),
  ('2601120766', 'RPA CSI Israel | Descrição em português não mencionada e itens ausentes', 'Minerva Foods > Tecnologia', 'Levi Ribeiro Cury', 'Fechado', '2026-01-12 10:52:00+00', '2026-01-14 14:44:00+00', '2026-01-14 14:20:00+00', 'Joao Vitor Martins da Silva', 'Baixa', '', 'Desenvolvimento > RPA', 51.47),
  ('2601131049', 'RPA CSI CHILE | Desmembrar datas na unidade de Tangará', 'Minerva Foods > Tecnologia', 'Levi Ribeiro Cury', 'Fechado', '2026-01-13 12:14:00+00', '2026-01-17 19:00:00+00', '2026-01-14 13:44:00+00', 'Joao Vitor Martins da Silva', 'Baixa', '', 'Desenvolvimento > RPA', 25.5),
  ('2601081019', 'RPA CSN | Mercados não reconhecida pela automação', 'Minerva Foods > Tecnologia', 'Igor Martins Minuncio', 'Fechado', '2026-01-08 12:30:00+00', '2026-01-16 19:01:00+00', '2026-01-13 17:15:00+00', 'Joao Vitor Martins da Silva', 'Baixa', '', 'Desenvolvimento > RPA', 124.75),
  ('2601131464', 'RPA NFe | Falha ao anexar sintético', 'Minerva Foods > Tecnologia', 'Igor Martins Minuncio', 'Fechado', '2026-01-13 15:10:00+00', '2026-01-16 19:03:00+00', '2026-01-13 15:44:00+00', 'Joao Vitor Martins da Silva', 'Baixa', '', 'Desenvolvimento > RPA', 0.57),
  ('2601081431', 'RPA DCPOA | Lote e Validade Vazios em SubProdutos', 'Minerva Foods > Tecnologia', 'Levi Ribeiro Cury', 'Fechado', '2026-01-08 15:51:00+00', '2026-01-16 19:01:00+00', '2026-01-13 12:47:00+00', 'Joao Vitor Martins da Silva', 'Baixa', '', 'Desenvolvimento > RPA', 116.93),
  ('2512290466', 'NXA | RPA Emissão NFe - Estados Unidos / Hilton não Hilton', 'Minerva Foods > Tecnologia', 'Igor Martins Minuncio', 'Fechado', '2025-12-29 09:19:00+00', '2026-01-12 19:01:00+00', '2026-01-09 11:12:00+00', 'Joselia Ribeiro do Nascimento', 'Baixa', '', 'Desenvolvimento > RPA', 233.88),
  ('2601060822', 'RPA CSI Uruguai | Atualização para processos Carne c/ Osso', 'Minerva Foods > Tecnologia', 'Levi Ribeiro Cury', 'Fechado', '2026-01-06 10:54:00+00', '2026-01-07 17:20:00+00', '2026-01-07 16:51:00+00', 'Joao Vitor Martins da Silva', 'Baixa', '', 'Desenvolvimento > RPA', 30.0),
  ('2506200884', 'Ajustes CSI Israel', 'Minerva Foods > Tecnologia', 'Levi Ribeiro Cury', 'Fechado', '2025-06-20 15:10:00+00', '2026-01-09 19:00:00+00', '2026-01-06 11:51:00+00', 'Joao Vitor Martins da Silva', 'Baixa', '', 'Desenvolvimento > RPA', 3407.68),
  ('2601050599', 'Criação de RPA para moedas AED', 'Minerva Foods > Tecnologia', 'Igor Martins Minuncio', 'Fechado', '2026-01-05 10:22:00+00', '2026-01-09 19:00:00+00', '2026-01-06 11:39:00+00', 'Gustavo Salustiano Pacheco', 'Baixa', '', 'Desenvolvimento > RPA', 25.28),
  ('2601060333', 'RPA CSI Argentina | Erro lançar certificados na unidade de Alegrete', 'Minerva Foods > Tecnologia', 'Levi Ribeiro Cury', 'Fechado', '2026-01-06 08:31:00+00', '2026-01-06 11:02:00+00', '2026-01-06 10:38:00+00', 'Joao Vitor Martins da Silva', 'Baixa', '', 'Desenvolvimento > RPA', 2.12),
  ('2507310432', 'IBM-2053 | CSI República Dominicana | Novo Mercado', 'Minerva Foods > Tecnologia', 'Levi Ribeiro Cury', 'Fechado', '2025-07-31 09:44:00+00', '2026-01-02 11:58:00+00', '2026-01-02 11:47:00+00', 'Joao Vitor Martins da Silva', 'Baixa', '', 'Desenvolvimento > RPA', 4455.05),
  ('2510061422', 'IBM-2052 | RPA CSI Paraguai | Novo Mercado', 'Minerva Foods > Tecnologia', 'Levi Ribeiro Cury', 'Fechado', '2025-10-06 15:59:00+00', '2026-01-02 11:59:00+00', '2026-01-02 11:10:00+00', 'Joao Vitor Martins da Silva', 'Baixa', '', 'Desenvolvimento > RPA', 1992.18),
  ('2507241394', 'CSI Cuba | Novo Mercado', 'Minerva Foods > Tecnologia', 'Levi Ribeiro Cury', 'Fechado', '2025-07-24 18:01:00+00', '2026-01-02 11:59:00+00', '2026-01-02 10:39:00+00', 'Joao Vitor Martins da Silva', 'Baixa', '', 'Desenvolvimento > RPA', 4368.63),
  ('2601290632', 'RPA CSI Israel | Local de Carregamento e Desc. do produto em portugues incorreta', 'Minerva Foods > Tecnologia', 'Igor Martins Minuncio', 'Solucionado', '2026-01-29 10:34:00+00', '2026-01-29 16:46:00+00', '2026-01-29 16:46:00+00', 'Joao Vitor Martins da Silva', 'Baixa', '', 'Desenvolvimento > RPA', 6.2),
  ('2601281390', 'RPA CSI Curação | Erro ao executar', 'Minerva Foods > Tecnologia', 'Levi Ribeiro Cury', 'Solucionado', '2026-01-28 16:09:00+00', '2026-01-29 15:03:00+00', '2026-01-29 15:03:00+00', 'Joao Vitor Martins da Silva', 'Baixa', '', 'Desenvolvimento > RPA', 22.9),
  ('2601280490', 'RPA CSN | Erro ao executar cenário', 'Minerva Foods > Tecnologia', 'Igor Martins Minuncio', 'Solucionado', '2026-01-28 09:42:00+00', '2026-01-28 17:53:00+00', '2026-01-28 17:53:00+00', 'Joao Vitor Martins da Silva', 'Baixa', '', 'Desenvolvimento > RPA', 8.18),
  ('2601271146', 'Relatório de acompanhamento de integração Certisgn não funcionando', 'Minerva Foods > Tecnologia', 'Igor Martins Minuncio', 'Solucionado', '2026-01-27 14:12:00+00', '2026-01-28 09:08:00+00', '2026-01-28 09:08:00+00', 'Leticia Sueko Horiquini', 'Média', '', 'Desenvolvimento > RPA', 18.93),
  ('2601261748', 'Falha no RPA ao fazer a DCPOA', 'Minerva Foods > Tecnologia', 'Levi Ribeiro Cury', 'Solucionado', '2026-01-26 17:22:00+00', '2026-01-27 17:56:00+00', '2026-01-27 17:56:00+00', 'Tatiana Lourenco da Silva', 'Baixa', '', 'Desenvolvimento > RPA', 24.57),
  ('2601231229', 'RPA CSI China | Atualização no padrão de preenchimento das datas', 'Minerva Foods > Tecnologia', 'Igor Martins Minuncio', 'Solucionado', '2026-01-23 16:03:00+00', '2026-01-27 14:32:00+00', '2026-01-27 14:32:00+00', 'Joao Vitor Martins da Silva', 'Baixa', '', 'Desenvolvimento > RPA', 94.48)
ON CONFLICT DO NOTHING;
