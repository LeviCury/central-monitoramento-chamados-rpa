<p align="center">
  <img src="https://minervafoods.com/wp-content/uploads/2024/08/logo-1920x846.webp" alt="Minerva Foods" width="300"/>
</p>

<h1 align="center">Central de Monitoramento de Chamados RPA</h1>

<p align="center">
  <strong>Dashboard de Gestão e Monitoramento de Chamados para a equipe de RPA da Minerva Foods</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react" alt="React"/>
  <img src="https://img.shields.io/badge/TypeScript-5.5-3178C6?style=flat-square&logo=typescript" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Vite-5.4-646CFF?style=flat-square&logo=vite" alt="Vite"/>
  <img src="https://img.shields.io/badge/TailwindCSS-3.4-06B6D4?style=flat-square&logo=tailwindcss" alt="TailwindCSS"/>
  <img src="https://img.shields.io/badge/Recharts-3.7-FF6384?style=flat-square" alt="Recharts"/>
  <img src="https://img.shields.io/badge/ExcelJS-4.4-217346?style=flat-square&logo=microsoftexcel" alt="ExcelJS"/>
</p>

<p align="center">
  <a href="https://github.com/LeviCury/central-monitoramento-chamados-rpa">
    <img src="https://img.shields.io/badge/GitHub-Repositório-181717?style=flat-square&logo=github" alt="GitHub"/>
  </a>
</p>

---

## 📋 Índice

- [Sobre o Projeto](#-sobre-o-projeto)
- [Funcionalidades](#-funcionalidades)
- [Screenshots](#-screenshots)
- [Tecnologias Utilizadas](#-tecnologias-utilizadas)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Pré-requisitos](#-pré-requisitos)
- [Instalação e Configuração](#-instalação-e-configuração)
- [Variáveis de Ambiente](#-variáveis-de-ambiente)
- [Executando o Projeto](#-executando-o-projeto)
- [Deploy](#-deploy)
- [Integração com GLPI](#-integração-com-glpi)
- [Componentes](#-componentes)
- [Serviços](#-serviços)
- [Paleta de Cores](#-paleta-de-cores)
- [Desenvolvedores](#-desenvolvedores)
- [Licença](#-licença)

---

## 🎯 Sobre o Projeto

A **Central de Monitoramento de Chamados RPA** é um dashboard web desenvolvido para visualização, gestão e monitoramento dos chamados de suporte da equipe de RPA (Robotic Process Automation) da Minerva Foods. 

O sistema consome dados diretamente da API do **GLPI** (sistema de chamados interno) e apresenta informações através de:
- Gráficos interativos em tempo real
- KPIs com atualização automática
- Filtros dinâmicos e avançados
- Tabela detalhada com busca e paginação
- Exportação completa para Excel
- Tema claro/escuro
- Modo apresentação para reuniões

Este dashboard foi desenvolvido para apresentação a diretores, gerentes e coordenadores, oferecendo uma visão clara e profissional do desempenho da equipe.

---

## ✨ Funcionalidades

### 📊 KPIs (Indicadores de Performance)

| KPI | Descrição |
|-----|-----------|
| **Total de Chamados** | Quantidade total de chamados no período selecionado |
| **Taxa de Resolução** | Percentual de chamados finalizados (fechados + solucionados) |
| **Chamados em Aberto** | Soma de chamados em atendimento, pendentes e novos |
| **Média de Horas** | Média de horas trabalhadas por chamado (requer filtro de data) |

### 📈 Gráficos Interativos

- **Evolução de Chamados**: Gráfico de área mostrando a quantidade de chamados por dia
- **Distribuição por Status**: Gráfico de barras com a quantidade de chamados por status
- **Chamados por Técnico**: Ranking dos técnicos com mais chamados atendidos

### 🔍 Filtros Avançados

- **Período**: Filtro por data inicial e final
- **Status**: Filtro por status do chamado (Fechado, Solucionado, Em Atendimento, etc.)
- **Técnico**: Filtro por técnico responsável

### 📋 Tabela de Chamados

- Listagem completa de chamados
- Busca em tempo real por ID, título ou técnico
- Paginação automática
- Link direto para o chamado no GLPI
- Badges de status coloridos

### 🌙 Tema Claro/Escuro

- Alternância entre tema claro e escuro
- Persistência da preferência no localStorage
- Detecção automática da preferência do sistema
- Logos adaptativas para cada tema

### 🎥 Modo Apresentação

- Interface otimizada para apresentações em reuniões
- Oculta filtros para foco nos dados
- KPIs em destaque com tamanho ampliado
- Barra flutuante com controles e indicador de última atualização

### 📥 Exportação para Excel

- Relatório executivo com KPIs formatados
- Planilha completa de chamados
- Cores e estilos profissionais da marca Minerva
- Filtros automáticos na planilha
- Download instantâneo em formato `.xlsx`

### 🔄 Auto-Refresh

- Atualização automática a cada 20 minutos
- Indicador visual de última atualização
- Tempo relativo ("há 5 minutos", "há 1 hora")

---

## 🛠 Tecnologias Utilizadas

### Frontend

| Tecnologia | Versão | Descrição |
|------------|--------|-----------|
| **React** | 18.3.1 | Biblioteca para construção de interfaces |
| **TypeScript** | 5.5.3 | Superset JavaScript com tipagem estática |
| **Vite** | 5.4.8 | Build tool e dev server ultrarrápido |
| **TailwindCSS** | 3.4.1 | Framework CSS utilitário |
| **Recharts** | 3.7.0 | Biblioteca de gráficos para React |
| **Lucide React** | 0.344.0 | Biblioteca de ícones moderna |
| **ExcelJS** | 4.4.0 | Geração de arquivos Excel |
| **FileSaver** | 2.0.5 | Download de arquivos no navegador |

### Desenvolvimento

| Ferramenta | Descrição |
|------------|-----------|
| **ESLint** | Linter para qualidade de código |
| **PostCSS** | Processador CSS |
| **Autoprefixer** | Prefixos CSS automáticos |

---

## 📁 Estrutura do Projeto

```
minerva-project-main/
│
├── 📄 index.html              # HTML principal
├── 📄 package.json            # Dependências e scripts
├── 📄 vite.config.ts          # Configuração do Vite (inclui proxy GLPI)
├── 📄 tailwind.config.js      # Configuração do TailwindCSS
├── 📄 tsconfig.json           # Configuração TypeScript
├── 📄 .env.example            # Exemplo de variáveis de ambiente
│
├── 📂 public/                 # Arquivos estáticos
│   └── 📄 favicon.png         # Ícone da aplicação
│
└── 📂 src/
    │
    ├── 📄 main.tsx            # Entry point da aplicação
    ├── 📄 App.tsx             # Componente raiz (com ThemeProvider)
    ├── 📄 index.css           # Estilos globais e variáveis CSS
    ├── 📄 vite-env.d.ts       # Tipos do Vite
    │
    ├── 📂 components/         # Componentes React
    │   ├── 📄 Dashboard.tsx           # Dashboard principal
    │   ├── 📄 TicketFilterPanel.tsx   # Painel de filtros
    │   ├── 📄 TicketKPICard.tsx       # Card de KPI
    │   ├── 📄 TicketTable.tsx         # Tabela de chamados
    │   ├── 📄 StatusChart.tsx         # Gráfico de status
    │   ├── 📄 TechnicianChart.tsx     # Gráfico de técnicos
    │   └── 📄 TimelineChart.tsx       # Gráfico de evolução
    │
    ├── 📂 contexts/           # Contextos React
    │   └── 📄 ThemeContext.tsx        # Contexto de tema claro/escuro
    │
    ├── 📂 services/           # Serviços e integrações
    │   ├── 📄 glpiApi.ts              # Integração com API GLPI
    │   ├── 📄 analytics.ts            # Funções de agregação e métricas
    │   ├── 📄 excelExport.ts          # Exportação para Excel
    │   └── 📄 minervaApi.ts           # API Minerva (legacy)
    │
    ├── 📂 types/              # Definições de tipos TypeScript
    │   └── 📄 index.ts                # Interfaces e types
    │
    └── 📂 lib/                # Bibliotecas auxiliares
        └── 📄 supabase.ts             # Cliente Supabase (não utilizado)
```

---

## 📋 Pré-requisitos

Antes de começar, você precisará ter instalado:

- **Node.js** (versão 18 ou superior)
- **npm** ou **yarn**
- Acesso à rede interna da Minerva Foods (para API GLPI)

---

## ⚙️ Instalação e Configuração

### 1. Clone o repositório

```bash
git clone https://github.com/LeviCury/central-monitoramento-chamados-rpa.git
cd central-monitoramento-chamados-rpa
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas credenciais (veja seção abaixo).

---

## 🔐 Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# Token de autenticação Basic (base64)
VITE_GLPI_AUTH_BASIC=seu_token_basic_aqui

# App Token gerado no GLPI
VITE_GLPI_APP_TOKEN=seu_app_token_aqui

# ID do grupo técnico (ex: 108 = RPA)
VITE_GLPI_ENTITY_ID=108
```

| Variável | Descrição |
|----------|-----------|
| `VITE_GLPI_AUTH_BASIC` | Token de autenticação em Base64 para criar sessão |
| `VITE_GLPI_APP_TOKEN` | Token da aplicação registrada no GLPI |
| `VITE_GLPI_ENTITY_ID` | ID do grupo/entidade para filtrar chamados |

> ⚠️ **Importante**: Nunca commite o arquivo `.env` no repositório!

---

## 🚀 Executando o Projeto

### Modo Desenvolvimento

```bash
npm run dev
```

O servidor iniciará em `http://localhost:5173`

### Build de Produção

```bash
npm run build
```

Os arquivos serão gerados na pasta `dist/`

### Preview da Build

```bash
npm run preview
```

### Verificar Tipos TypeScript

```bash
npm run typecheck
```

---

## 🌐 Deploy

O projeto pode ser implantado em diversas plataformas gratuitas:

| Plataforma | Descrição |
|------------|-----------|
| **Vercel** | Recomendado - Integração direta com GitHub |
| **Netlify** | Alternativa fácil de configurar |
| **GitHub Pages** | Gratuito para repositórios públicos |
| **Cloudflare Pages** | Muito rápido e gratuito |

### Deploy no Vercel

1. Acesse [vercel.com](https://vercel.com) e faça login com GitHub
2. Importe o repositório
3. Configure as variáveis de ambiente
4. Clique em Deploy

> ⚠️ **Nota sobre CORS**: Em produção, a API GLPI precisa permitir requisições do domínio do deploy.

---

## 🔌 Integração com GLPI

### Endpoints Utilizados

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/initSession` | Cria uma sessão e retorna `session_token` |
| `POST` | `/search/Ticket` | Busca chamados com critérios |
| `GET` | `/User/{id}` | Obtém dados do usuário/técnico |
| `GET` | `/Ticket/{id}/TicketTask` | Obtém tarefas do chamado (horas trabalhadas) |

### Fluxo de Autenticação

```
1. GET /initSession
   Headers: Authorization (Basic), App-Token
   Response: { session_token: "xxx" }

2. POST /search/Ticket
   Headers: Session-Token, App-Token
   Body: { criteria: [...], range: "0-2000" }
```

### Proxy de Desenvolvimento

O Vite está configurado para fazer proxy das requisições `/api/glpi` para a API GLPI real, evitando problemas de CORS durante o desenvolvimento.

```typescript
// vite.config.ts
server: {
  proxy: {
    '/api/glpi': {
      target: 'https://central.minervafoods.com/apirest.php',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/glpi/, ''),
    },
  },
}
```

---

## 🧩 Componentes

### Dashboard.tsx
Componente principal que orquestra toda a aplicação:
- Gerenciamento de estado dos filtros
- Carregamento de dados da API
- Cálculo de métricas
- Auto-refresh a cada 20 minutos
- Controle de tema claro/escuro
- Modo apresentação
- Exportação para Excel

### TicketFilterPanel.tsx
Painel lateral com filtros colapsáveis:
- Período (data inicial/final)
- Status do chamado
- Técnico responsável
- Contador de filtros ativos

### TicketKPICard.tsx
Card reutilizável para exibição de KPIs:
- Ícone personalizado
- Título e valor principal
- Subtítulo informativo
- Cores personalizáveis (navy, green, amber, red)
- Animações de entrada

### StatusChart.tsx
Gráfico de barras verticais com distribuição por status:
- 🟢 Fechado
- 🔵 Solucionado
- 🟣 Novo
- 🔴 Em Atendimento
- 🟡 Pendente

### TechnicianChart.tsx
Gráfico de barras horizontais com ranking dos técnicos:
- Top 10 técnicos
- Cores variadas por técnico
- Tooltip com nome completo

### TimelineChart.tsx
Gráfico de área mostrando evolução diária:
- Total no período
- Média por dia
- Pico máximo

### TicketTable.tsx
Tabela completa de chamados:
- Busca em tempo real
- Paginação
- Link direto para GLPI
- Badges de status coloridos

---

## 🔧 Serviços

### glpiApi.ts
Serviço principal de integração com GLPI:

| Função | Descrição |
|--------|-----------|
| `createSession()` | Cria sessão na API |
| `getValidSessionToken()` | Obtém token válido (com cache) |
| `fetchTicketsFromGLPI()` | Busca chamados com filtros |
| `fetchUserName()` | Busca nome do usuário por ID |
| `fetchTicketWorkHours()` | Busca horas apontadas em tarefas |

### analytics.ts
Funções de agregação e cálculo de métricas:

| Função | Descrição |
|--------|-----------|
| `fetchTickets()` | Wrapper para buscar tickets |
| `getTicketMetrics()` | Calcula KPIs (total, taxa, médias) |
| `aggregateTicketsByStatus()` | Agrupa por status |
| `aggregateTicketsByTechnician()` | Agrupa por técnico |
| `aggregateTicketsByDate()` | Agrupa por data |
| `getUniqueTechnicians()` | Lista técnicos únicos |
| `getUniqueStatuses()` | Lista status únicos |
| `fetchWorkHoursForTickets()` | Busca horas trabalhadas em lote |

### excelExport.ts
Exportação de relatórios para Excel:

| Função | Descrição |
|--------|-----------|
| `exportToExcel()` | Gera relatório Excel completo |

O relatório inclui:
- **Planilha "Resumo Executivo"**: KPIs formatados, detalhamento por status
- **Planilha "Chamados"**: Lista completa com filtros automáticos

---

## 🎨 Paleta de Cores

O dashboard utiliza as cores oficiais da Minerva Foods:

| Cor | Hex | Uso |
|-----|-----|-----|
| **Navy** | `#1D2E40` | Header, textos principais, gráficos |
| **Navy Light** | `#2a4158` | Gradientes, hovers |
| **Red** | `#F84454` | Destaques, alertas, CTAs |
| **Red Light** | `#ff6b78` | Hovers, variações |
| **Branco** | `#FFFFFF` | Backgrounds, cards |

### Logos

| Contexto | Logo |
|----------|------|
| Fundo escuro (header, loading) | Logo branca SVG |
| Fundo claro (footer) | Logo colorida |

### Variáveis CSS

```css
:root {
  --minerva-navy: #1D2E40;
  --minerva-red: #F84454;
  --minerva-white: #FFFFFF;
  --minerva-navy-light: #2a4158;
  --minerva-navy-dark: #152231;
  --minerva-red-light: #ff6b78;
  --minerva-red-dark: #d63644;
}
```

---

## 👨‍💻 Desenvolvedores

<table>
  <tr>
    <td align="center">
      <a href="https://www.linkedin.com/in/levicury/" target="_blank">
        <strong>Levi Cury</strong>
      </a><br/>
      <sub>Desenvolvedor RPA</sub><br/>
      <a href="https://www.linkedin.com/in/levicury/" target="_blank">
        <img src="https://img.shields.io/badge/LinkedIn-0077B5?style=flat-square&logo=linkedin&logoColor=white" alt="LinkedIn"/>
      </a>
    </td>
    <td align="center">
      <a href="https://www.linkedin.com/in/igor-minuncio/" target="_blank">
        <strong>Igor Martins Minuncio</strong>
      </a><br/>
      <sub>Desenvolvedor RPA</sub><br/>
      <a href="https://www.linkedin.com/in/igor-minuncio/" target="_blank">
        <img src="https://img.shields.io/badge/LinkedIn-0077B5?style=flat-square&logo=linkedin&logoColor=white" alt="LinkedIn"/>
      </a>
    </td>
  </tr>
</table>

---

## 📄 Licença

Este projeto é de uso interno da **Minerva Foods S.A.**

© 2026 Minerva Foods S.A. — Todos os direitos reservados.

---

<p align="center">
  <strong>Desenvolvido com ❤️ por <a href="https://www.linkedin.com/in/levicury/">Levi Cury</a> e <a href="https://www.linkedin.com/in/igor-minuncio/">Igor Martins Minuncio</a></strong>
</p>

<p align="center">
  <sub>Equipe de RPA — Minerva Foods</sub>
</p>

<p align="center">
  <img src="https://minervafoods.com/wp-content/uploads/2024/08/logo-1920x846.webp" alt="Minerva Foods" width="150"/>
</p>
