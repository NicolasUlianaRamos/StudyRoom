# Ajustes do CI — 15/10/2026

Falhas observadas no workflow 38343110985, commit a0cc88a:

- Windows: 72 testes passaram; os testes de migração v3 e validação de sessões ultrapassaram 5000 ms. Não houve falha de asserção nesses casos.
- Linux: 74 testes unitários e build passaram. A integração X11 falhou no fluxo de tela cheia, seguida por erros em cenários que dependiam do perfil e da janela do cenário anterior. O fluxo de PDF também falhou ao ativar tela cheia.

Correções locais:

- Vitest: no CI, limite de 20 segundos por teste/hook e até dois workers para reduzir concorrência de I/O. Mantém asserções e timeouts finitos.
- X11: instalar Openbox e x11-utils; iniciar e aguardar o gerenciador de janelas dentro do Xvfb antes de executar Electron. Display de 1366 × 768. Mantém o sandbox do navegador.
- Integrações: aguardar confirmação nativa da tela cheia e controles visíveis antes de encerrar. Declarar a jornada compartilhada como serial para interromper após a primeira falha e evitar erros em cascata.
- Workflow: publicar diagnósticos em caso de falha e limitar cada job a 30 minutos. Continua validando Windows, X11 e Wayland.

Verificação local: 74 testes unitários com CI=true, build TypeScript/Vite, sintaxe Bash do novo script e YAML do workflow aprovados. A validação de Linux depende da próxima execução do GitHub Actions; esta máquina é Windows. Nenhuma alteração de dados do usuário, versão do aplicativo ou instalador.
