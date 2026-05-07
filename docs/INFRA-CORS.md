# Deploy do dashboard fora da rede Minerva (Vercel) — pedido para o TI

> **TL;DR para quem vai abrir o chamado**:
> O dashboard de chamados RPA (`https://<seu-app>.vercel.app`) precisa que o servidor que serve a API do GLPI (`https://central.minervafoods.com/apirest.php`) responda com headers CORS apropriados. Sem isso, o navegador bloqueia toda chamada cross-origin e nenhum dado carrega.
> Os usuários continuam acessando via VPN/intranet — a infra do Vercel **não** precisa alcançar o GLPI; quem fala com o GLPI é o navegador do usuário, que já está na rede.

---

## Contexto técnico

- **Frontend**: SPA React hospedado no Vercel (`https://<seu-app>.vercel.app`).
- **API**: GLPI (`https://central.minervafoods.com/apirest.php`), interno à rede Minerva.
- **Usuários**: sempre conectados à VPN ou intranet Minerva.
- **Fluxo**: navegador do usuário (na VPN) baixa o JS do Vercel → executa `fetch()` direto para o GLPI → renderiza o dashboard.

A política de **same-origin** dos navegadores bloqueia esse `fetch()` porque o origin do JS (`vercel.app`) é diferente do origin da API (`minervafoods.com`). O servidor GLPI precisa autorizar explicitamente via headers CORS.

## O que precisa ser configurado no servidor que serve `apirest.php`

### Headers de resposta necessários

Para todas as respostas em `/apirest.php/*`:

```
Access-Control-Allow-Origin: https://<seu-app>.vercel.app
Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, App-Token, Session-Token
Access-Control-Allow-Credentials: false
Access-Control-Max-Age: 600
Vary: Origin
```

### Tratamento de preflight (`OPTIONS`)

Toda requisição `OPTIONS` para `/apirest.php/*` deve retornar:
- Status: `204 No Content`
- Headers acima
- Sem corpo

### Exemplo Apache (`.htaccess` em `/apirest.php/`)

```apache
<IfModule mod_headers.c>
  Header always set Access-Control-Allow-Origin "https://<seu-app>.vercel.app"
  Header always set Access-Control-Allow-Methods "GET, POST, DELETE, OPTIONS"
  Header always set Access-Control-Allow-Headers "Content-Type, Authorization, App-Token, Session-Token"
  Header always set Access-Control-Allow-Credentials "false"
  Header always set Access-Control-Max-Age "600"
  Header always append Vary "Origin"
</IfModule>

# Preflight: responder 204 sem rodar o PHP
RewriteEngine On
RewriteCond %{REQUEST_METHOD} OPTIONS
RewriteRule ^(.*)$ $1 [R=204,L]
```

### Exemplo Nginx

```nginx
location /apirest.php {
  if ($request_method = OPTIONS) {
    add_header Access-Control-Allow-Origin  "https://<seu-app>.vercel.app" always;
    add_header Access-Control-Allow-Methods "GET, POST, DELETE, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Content-Type, Authorization, App-Token, Session-Token" always;
    add_header Access-Control-Max-Age       "600" always;
    add_header Vary                         "Origin" always;
    add_header Content-Length 0;
    add_header Content-Type text/plain;
    return 204;
  }
  add_header Access-Control-Allow-Origin  "https://<seu-app>.vercel.app" always;
  add_header Access-Control-Allow-Methods "GET, POST, DELETE, OPTIONS" always;
  add_header Access-Control-Allow-Headers "Content-Type, Authorization, App-Token, Session-Token" always;
  add_header Vary                         "Origin" always;

  # ... demais regras (fastcgi/php-fpm) ...
}
```

### Exemplo IIS (`web.config` na pasta de `apirest.php`)

```xml
<configuration>
  <system.webServer>
    <httpProtocol>
      <customHeaders>
        <add name="Access-Control-Allow-Origin"  value="https://<seu-app>.vercel.app" />
        <add name="Access-Control-Allow-Methods" value="GET, POST, DELETE, OPTIONS" />
        <add name="Access-Control-Allow-Headers" value="Content-Type, Authorization, App-Token, Session-Token" />
        <add name="Access-Control-Max-Age"       value="600" />
        <add name="Vary"                         value="Origin" />
      </customHeaders>
    </httpProtocol>
  </system.webServer>
</configuration>
```

## Lista de origins a autorizar

Substitua `<seu-app>` pelo domínio real do projeto Vercel. Se houver mais de um ambiente:

```
https://<seu-app>.vercel.app                     # produção
https://<seu-app>-git-main-<seu-user>.vercel.app # branch main
https://<seu-app>-<hash>-<seu-user>.vercel.app   # previews (opcional)
```

Se preferir liberar apenas um origin único, basta o primeiro da lista.

## Por que não usar `Access-Control-Allow-Origin: *`

O GLPI exige headers customizados (`App-Token`, `Session-Token`). Navegadores rejeitam preflights com `*` quando `Allow-Headers` lista headers customizados sensíveis. Mantenha o origin específico.

## Como validar depois de configurado

Da máquina de teste **dentro da VPN**, executar:

```bash
curl -i -X OPTIONS \
  -H "Origin: https://<seu-app>.vercel.app" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: app-token,authorization" \
  https://central.minervafoods.com/apirest.php/initSession/
```

Resposta esperada:
- Status `204`
- Header `Access-Control-Allow-Origin: https://<seu-app>.vercel.app`
- Header `Access-Control-Allow-Headers` listando `Authorization, App-Token, Session-Token` (case-insensitive)

---

## Plano B — caso o TI não autorize CORS

Se a política de segurança não permitir liberar CORS para um host externo (Vercel), o app não pode ser hospedado fora da rede Minerva. As alternativas são:

1. **Hospedar o dashboard dentro da rede Minerva**.
   - Qualquer servidor interno com Node.js (≥ 18) ou container Docker basta. Recursos mínimos: 1 vCPU, 512 MB RAM.
   - Servir o build estático (`dist/`) atrás de Nginx/IIS + um proxy reverso `/api/glpi/*` → `https://central.minervafoods.com/apirest.php/*` (mesmo padrão do `vite.config.ts`).
   - URL interna (ex.: `http://rpa-monitor.minerva.local`). Sem necessidade de CORS (mesma origem). Credenciais saem do bundle JS.
2. **Túnel reverso aprovado** (Cloudflare Tunnel / Tailscale Funnel).
   - Expõe o GLPI à internet por um endpoint privado controlado pelo TI. Vercel chama o túnel.
   - Requer apreciação de segurança porque coloca a API do GLPI publicamente acessível.

Em qualquer dos dois cenários, o front-end (este repositório) já está pronto: basta `npm run build` e servir `dist/`.
