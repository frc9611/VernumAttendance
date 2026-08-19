# VernumAttendance

Quiosque de presença do **Vernum**. Uma página estática: quem chega marca a entrada, quem sai
marca a saída, e a sala mostra quem está lá e o ranking de tempo.

A API é o [VernumServer](../IdeaProjects/VernumServer) e o login acontece no **VernumCloud** —
a documentação do produto inteiro está em `~/IdeaProjects/VernumServer/docs/`.

## Como a pessoa entra

O botão **Login com VernumCloud** manda a pessoa para o dashboard, ela digita a senha lá (o
quiosque nunca vê a senha), autoriza o app e volta para cá com um código de uso único que esta
página troca por um token.

O quiosque não guarda segredo nenhum — é uma página sem servidor próprio —, então ele se
identifica por **PKCE**: antes de mandar a pessoa para o VernumCloud ele sorteia um verificador,
guarda só aqui e envia apenas o SHA-256 dele. Sem o verificador, o código que aparece na barra de
endereço não vale nada.

Também dá para entrar digitando usuário e senha aqui mesmo, pelo `<details>` embaixo do botão,
para quando o quiosque é a única tela disponível.

## Multi-equipe

A pessoa **não escolhe equipe**. O login já responde todas as equipes dela e entrar na sala conta
para todas de uma vez: o dashboard mostra um card por equipe, com o tempo acumulado em cada uma,
e o painel de baixo (quem está na sala, ranking) segue a equipe que estiver selecionada.

## Rodar

```bash
cd ~/VernumAttendance
python3 -m http.server 8090        # http://localhost:8090
```

A porta importa: o endereço de retorno tem que ser um dos cadastrados no app dentro do
VernumCloud (**Painel admin → Apps da equipe**). O servidor já cadastra
`http://localhost:8090/index.html` no boot; para servir de outro lugar, acrescente o endereço
novo na lista do app (ou ajuste `VERNUM_ATTENDANCE_REDIRECT_URIS` no `.env` do servidor).

Endereços do servidor e do dashboard ficam em `js/config.js`. Para apontar uma máquina para outro
servidor sem editar arquivo:

```js
localStorage.setItem("vernum.api", "http://192.168.0.10:8080")
localStorage.setItem("vernum.cloud", "http://192.168.0.10:8081")
```

## Arquivos

| Arquivo | Para quê |
|---|---|
| `js/config.js` | endereços do servidor e do dashboard, e o `client_id` do quiosque |
| `js/vernum.js` | sessão, chamadas à API e o fluxo do "Entrar com o VernumCloud" |
| `js/index.js` | tela de login, e o retorno do código |
| `js/dashboard.js` | a sala, as equipes, quem está dentro e o ranking |

## Endpoints usados

| Rota | Para quê |
|---|---|
| `POST /public/sso/token` | troca o código do login por um token |
| `POST /login` | login digitado no próprio quiosque |
| `GET /attendance/me` | se está na sala e as equipes da pessoa |
| `POST /attendance/enter` / `leave` | marca entrada e saída em todas as equipes |
| `GET /tenants/{id}/attendance/now` | quem está na sala naquela equipe |
| `GET /tenants/{id}/attendance/ranking` | ranking de tempo daquela equipe |
