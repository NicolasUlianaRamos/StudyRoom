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

## Resultado do PR #2 e ajustes seguintes

No commit 5bafe0e, o Windows do pull request concluiu testes e instalador; Linux X11 passou nos sete cenários tanto no push quanto no PR. Os timeouts unitários anteriores foram resolvidos.

- Windows/push: a troca de jogo ocorreu antes de completar um segundo, e a asserção imediata rejeitou 03:00. O teste agora aguarda o primeiro segundo antes de verificar se a troca preserva o intervalo. Mantém a verificação após a troca.
- Linux/Wayland: Weston rejeitou a geometria 1024 × 684 da janela em uma saída de 1024 × 640 e encerrou a conexão. O script agora define saída de 1366 × 768, equivalente ao X11 de teste.
- O encerramento de testes retém a referência ao processo do Electron, evitando erro secundário ao consultar uma conexão Playwright já fechada.

Correções ainda precisam de nova execução remota para confirmar Wayland.

## Publicação implícita e foco de F11 no PDF

Na execução seguinte, ambos os jobs de pull_request passaram. No push, Windows terminou de gerar o NSIS e falhou ao tentar publicar sem GH_TOKEN. Wayland passou nos seis primeiros cenários, mas o teste de PDF não entrou no modo imersivo após F11.

- Scripts dist:win e dist:linux agora passam --publish never. O workflow continua entregando os instaladores como artifacts; não precisa de token de publicação.
- O helper de teclado agora traz a página à frente, solicita foco na BrowserWindow e WebContents e aguarda confirmação antes de enviar a tecla. Confirma o evento before-input-event sem repetir F11. A documentação de tipos do Electron exige foco na janela para sendInputEvent.
- O teste do PDF aguarda os controles da sessão de estudo; o estado de página carregada também existe no leitor da biblioteca e, sozinho, não indica que a tela de estudo está pronta. Mantém F11 e as verificações nativa e visual de tela cheia.

Validação: TypeScript e sete integrações Windows passaram (46 s). A confirmação do comportamento Wayland depende da próxima execução remota. Apenas empacotamento e testes alterados; dados reais preservados.

## Wayland: entrada nativa no compositor de teste

O commit 653d1d6 passou no Windows, mas a espera por foco nativo falhou no Weston headless. Esse backend não fornece entrada de teclado/mouse; exigir foco nele tornou a falha determinística.

O script Wayland agora executa Weston com backend X11 dentro de Xvfb/Openbox, ativa a janela do compositor e verifica a presença de wl_seat antes de iniciar os testes. Electron continua explicitamente em --ozone-platform=wayland, sem XWayland. Mantém todas as asserções de foco, entrega de F11/Escape e tela cheia. O workflow instala xdotool e wayland-utils para preparar e diagnosticar o ambiente.

Validação remota pendente; não considerar resolvido apenas com testes Windows.
