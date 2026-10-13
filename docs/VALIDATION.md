# Validação

## Versão 0.1.7 — modo imersivo para telas pequenas

- F11 e botão de expandir alternam tela cheia durante o estudo. F11/Esc/ícone de recolher restauram a janela sem alterar a sessão. Cabeçalhos são substituídos por faixa de 36 pixels; Controles revela navegação/zoom/login, e anotações seguem disponíveis.
- TypeScript/build e 61 testes unitários passaram. Os sete cenários Electron passaram no Windows. Eventos nativos de teclado verificam F11/Esc com foco na página e na interface; os comandos CDP de teclado do Playwright não acionam before-input-event, por isso a verificação usa webContents.sendInputEvent.
- Integração verifica tela cheia real, limites nativos exatos (y=36, largura e altura restantes), expansão/recolhimento da barra, notas e redução da largura da view, pausa/retomada, resposta digitada preservada e identidade da sessão. O modo forte conserva modal, motivo e espera ao sair; Esc restaura apenas a janela e mantém o modal.
- PDF em sessão abre em tela cheia com a página corrente preservada. Captura test-results/pdf-immersive.png documenta a visualização local; a captura da interface em test-results/immersive.png não inclui a superfície da view nativa, cuja posição e conteúdo são verificados separadamente no teste.
- Sem migração, reset de dados, injeção no QConcursos, kiosk ou Docker. O usuário deve instalar o pacote Windows 0.1.7 com o aplicativo fechado; pacotes Linux permanecem em 0.1.5.
- Instalador gerado em release/StudyRoom Setup 0.1.7.exe, com checksum em release/SHA256SUMS-0.1.7.txt. Metadados e conteúdo do ASAR conferidos: versão 0.1.7, modo imersivo e correção anterior do login regional incluídos.

## Versão 0.1.6 — correção do login Google regional

O usuário observou bloqueio do StudyRoom em accounts.google.com.br após avançar no login Google, mesmo com a autorização temporária ativa. A política passa a aceitar os hosts exatos accounts.google.com e accounts.google.com.br nas rotas limitadas de autenticação e passagem de cookies, incluindo /accounts/SetSID. HTTPS, prazo de cinco minutos e revogação no retorno ao estudo permanecem. Sites de pesquisa, Gmail, YouTube, hosts parecidos e portas alternativas continuam bloqueados.

- 61 testes unitários passaram, incluindo concessão regional, expiração, frames e destinos falsos ou fora das rotas.
- Os sete cenários Electron passaram no Windows. O cenário de navegação usa respostas sintéticas para o redirecionamento accounts.google.com → accounts.google.com.br/accounts/SetSID e para o retorno ao QConcursos. Nenhuma conta, senha ou token real é usado; o protocolo de teste é restaurado ao final. Na primeira execução, o teste tentou revogar a autorização ao retornar à origem HTTP exclusiva da fixture, que não integra a lista real de sites; a simulação foi corrigida para retornar ao host autorizado do QConcursos.
- Instalador Windows gerado em release/StudyRoom Setup 0.1.6.exe. Hash em release/SHA256SUMS-0.1.6.txt. A instalação atual do usuário não foi modificada automaticamente; é necessário executar o novo instalador com o StudyRoom fechado.
- Schema 6 e diretório de dados permanecem; a atualização não exige limpar dados ou cookies.
- A conclusão do login com a conta real depende de nova tentativa do usuário. Esta correção resolve o bloqueio local identificado, sem atestar a aceitação do provedor ou etapas de login ainda não observadas.
- Esta entrega atualiza o Windows; os pacotes Linux anteriores permanecem em 0.1.5.

## Aceitação adicional — 10 de outubro de 2026

- Linux Debian Bookworm x64 em Docker Desktop/WSL2: instalação limpa (`npm ci`), 49 testes unitários, TypeScript/build e geração AppImage/.deb concluídos. O lockfile foi completado com cinco dependências opcionais ausentes, sem mudar versões já registradas. Migrações tiveram timeout de 30 segundos somente no build do contêiner, devido ao fsync lento do disco virtual.
- Linux/X11 com Xvfb: os sete cenários de integração passaram (1,2 minuto). O executável empacotado e o AppImage em modo de extração temporária abriram, confirmaram versão 0.1.5 e carregaram worker/fonte PDF do pacote. A montagem por FUSE não foi exercitada.
- Linux/Wayland nativo com Weston 10 headless e `--ozone-platform=wayland`: os mesmos sete cenários de integração passaram (1,1 minuto), incluindo conteúdo remoto, isolamento, recuperação, layout, notas, planejamento, perfis, estatísticas e renderização de PDF. Não é um teste em XWayland. GPU física, múltiplos monitores e outros compositores permanecem fora dessa validação.
- O executável empacotado também abriu em Wayland e carregou os recursos PDF. Capturas de integração foram copiadas para `test-results/linux-wayland/`; o leitor de PDF foi conferido visualmente.
- `.deb`: instalado com apt no contêiner, registrado como 0.1.5, atalho `/usr/share/applications/studyroom.desktop` conferido e executável `/opt/StudyRoom/studyroom` aberto com sucesso. Após `apt-get remove studyroom`, executável e atalho estavam ausentes e o SHA-256 do banco de teste era idêntico. Isso valida o ciclo no Debian virtual, sem alterar a instalação do Windows.
- Pacotes: `release/StudyRoom-0.1.5.AppImage` (131.295.153 bytes) e `release/studyroom_0.1.5_amd64.deb` (102.908.120 bytes); hashes em `release/SHA256SUMS-0.1.5.txt`. O sandbox do Electron permaneceu ativo. A exceção seccomp foi aplicada somente ao contêiner descartável sem volumes do Windows, para permitir namespaces. Não foi usado `--privileged` ou `--no-sandbox`.
- QConcursos público: nova execução no Electron real, com dados temporários e espera de 45 segundos. Domínio `www.qconcursos.com`, título correto, `loading=false`, sem erro ou bloqueio. A captura `test-results/qconcursos-public.png` mostra navegação e conteúdo principal renderizados. Nenhuma credencial foi usada. O usuário adiou o teste autenticado para depois.
- Instalação interativa: o assistente NSIS abriu, mas a ferramenta de automação falhou com `FrameArrived timed out` e, após recuperação da janela, `foreground window did not report a process id`. Não foi possível atestar instalação/desinstalação pela interface nesta execução.
- Pesquisa/proposta da Fase 3 entregue em `FASE-3.md`, com fontes oficiais, limites por plataforma, consentimento, plano de recuperação e critérios para testes em VM. Não equivale a um adaptador rigoroso implementado.

## Versão 0.1.5 — 10 de outubro de 2026

Biblioteca e leitor de PDFs com cópias locais, deduplicação, páginas, zoom, texto extraído, última página persistida, sessões e anotações. Schema 6 cria pdfs e a retomada de PDF por perfil. PDF.js 6.4.299 fica compilado com worker e recursos locais.

- TypeScript e build de produção passaram.
- 49 testes unitários passaram: migrações v1/v2/v3/v4/v5, cópias e deduplicação, progresso persistido, IDs/cabeçalhos/tamanhos inválidos, arquivo original preservado, leitura após apagar o original, erro de cópia ausente e retomada de PDF por perfil.
- 7 cenários de integração passaram na versão final. O novo cenário verifica importação via diálogo controlado, documento de duas páginas efetivamente renderizado (pixels coloridos no canvas), texto extraído, zoom, persistência após reinício, leitura após apagar o original, início de sessão, proteção contra remoção em sessão, notas, pausa, recuperação, retomada em cinco minutos, cancelamento/confirmação de exclusão e preservação de histórico/notas.
- O PDF de teste contém uma ação JavaScript que não foi executada. A entrada de leitura com caminho em vez de ID foi rejeitada.
- Captura do leitor conferida: página, texto e controles renderizados.
- `npm audit --omit=dev`: nenhuma vulnerabilidade conhecida. A cadeia de ferramentas continua com os oito alertas moderados já documentados.

Limites: 100 materiais, 50 MB por arquivo, 500 MB na biblioteca, 10 mil páginas. Senhas, OCR, formulários interativos, anexos e links do documento não são suportados. PDFs danificados podem ser importados se tiverem cabeçalho válido, mas o leitor apresenta erro e orienta reimportar. Login real, NSIS interativo e Linux continuam pendentes.

Instalador gerado: `release/StudyRoom Setup 0.1.5.exe` (115.662.250 bytes). SHA-256: `B8FB2DB4EC6B8687E9FF554878F13CA298691B0197CEBF3AA086CCB70310EA66`. O executável empacotado abriu na versão 0.1.5 com Electron 44.7.0, sites preservados e biblioteca disponível no snapshot. O teste também carregou o worker do PDF.js e a fonte local diretamente do pacote, confirmando a inclusão desses recursos. A distribuição continua sem certificado comercial.

## Versão 0.1.4 — 10 de outubro de 2026

Estatísticas diárias e semanais (oito semanas), tempo por site, sessões e bloqueios. Schema 5 marca a inclusão de intervals no JSON das novas sessões; versões anteriores não podem editar o novo banco. Dados legados são preservados sem inventar intervalos.

- TypeScript e build de produção passaram.
- 46 testes unitários passaram, incluindo migrações v1/v2/v3/v4, divisão à meia-noite e entre semanas, exclusão de pausas, horário de verão, sessão ao vivo sem duplicação, limite ao alvo, extensão, recuperação e cálculo com mais de mil sessões.
- 6 cenários de integração passaram na versão final. O novo cenário usa registros controlados no banco temporário para verificar totais diários/semanais, contagem de bloqueios, sites, consulta de semanas anteriores, semana vazia, limites dos controles, persistência após reinício e ausência de transbordamento da página em 850×640.
- Captura da tela de estatísticas em tema escuro conferida.

Tempo de sessões legadas, contagens, planejamento e pausas são atribuídos ao dia inicial. Bloqueios têm retenção de 30 dias e repetição consecutiva do mesmo domínio conta uma vez. O painel reúne todos os perfis. Login real, instalação interativa e Linux continuam pendentes.

Instalador gerado: `release/StudyRoom Setup 0.1.4.exe` (113.857.895 bytes). SHA-256: `CFEAD8B74BADED265DD988050418ED9C529DC90A1DBFEB08178A045E059760E6`. Executável empacotado abriu na versão 0.1.4 com Electron 44.7.0, sites preservados e oito semanas no snapshot. A distribuição continua sem certificado comercial.

## Versão 0.1.3 — 10 de outubro de 2026

Perfis de estudo com listas independentes de sites, retomada por perfil e histórico com nome original. Migration 4 migra sites existentes para Padrão, preservando IDs, ativação e subdomínios.

- TypeScript e build de produção passaram.
- 41 testes unitários passaram, incluindo migrações de bancos v1/v2/v3, isolamento de sites e IDs, retomada por perfil, exclusão em cascata dos sites e preservação dos nomes históricos.
- 5 testes de integração passaram no Electron. O cenário de perfis cobre criação, seleção, cadastro, reinício, sessão com perfil registrado, rejeição de alterações via IPC durante estudo e pausa, limpeza da página e histórico de navegação, bloqueio de site do outro perfil, renomeação e cancelamento/confirmação de exclusão.
- Captura da interface de perfis em tema escuro conferida.

Cookies, preferências, notas e planejador são compartilhados. O perfil novo começa sem sites. Login real, instalação interativa e Linux permanecem pendentes.

Instalador gerado: `release/StudyRoom Setup 0.1.3.exe` (113.839.792 bytes). SHA-256: `260E7FEBCDBEEA5955AE5CF28C36408122C91ED59BE6FDFCB08321C30FE7C831`. Abertura do executável empacotado validada: versão 0.1.3, Electron 44.7.0, migração e snapshot com QConcursos preservado. A distribuição continua sem certificado comercial.

## Versão 0.1.2 — 10 de outubro de 2026

Planejador com matérias/assuntos, prioridade, duração, revisão manual, último início, links com filtros, retomada de assunto em cinco minutos e notas vinculadas. Migration 3 preserva os dados e rótulos livres dos bancos v1/v2.

- TypeScript e build de produção passaram.
- 39 testes unitários passaram: migrações com dados legados, datas/durações inválidas, autorização de links, contexto persistido das sessões e preservação das notas/histórico após excluir uma matéria.
- 4 testes de integração passaram. O novo cenário usa um domínio HTTPS fictício autorizado com resposta fornecida pelo protocolo da sessão apenas no teste, sem depender do QConcursos. Verifica formulário, rejeição de Instagram, persistência após reinício, link com query, início de 17 minutos, retomada em cinco, notas vinculadas automaticamente, planejador durante pausa e revogação da permissão antes de iniciar.
- Captura da tela do planejador conferida.

Revisões não geram notificações nem são reagendadas automaticamente. Último estudo representa o início. Histórico conserva os nomes da matéria e assunto no momento da sessão. Validações autenticadas do QConcursos, instalação interativa e Linux continuam pendentes.

Instalador NSIS 0.1.2 gerado. Executável empacotado abriu interface e banco com app.isPackaged=true e versão 0.1.2. SHA-256: 53E24DBC431083CF75BD69CF93E8E09B4FCF756A2B752B61CE65BE7C2C1955E7

## Versão 0.1.1 — 10 de outubro de 2026

Primeiro bloco da Fase 2: anotações e Ver depois com autosave, pesquisa, campo livre de matéria, painel lateral e exportação Markdown. Migration 2 testada sobre um banco v1 existente, preservando configurações.

35 testes unitários e 3 testes de integração passaram; TypeScript e build de produção passaram. A integração cobre digitação e autosave, persistência após reinício, pesquisa por matéria, Ver depois, limites da área nativa ao abrir/fechar o painel, exportação e confirmação/cancelamento da exclusão.

A exportação automatizada substitui apenas a escolha do caminho no diálogo nativo e verifica o arquivo Markdown gravado em disco. O diálogo de salvar do sistema permanece sujeito a conferência manual. Os testes gráficos precisaram executar fora do isolamento do executor; o sandbox de segurança do Electron continuou ativado.

Instalador NSIS 0.1.1 gerado com sucesso. O executável empacotado abriu a interface e o banco, confirmando app.isPackaged=true e versão 0.1.1. SHA-256: F92271D87BBDBFB54AE4957683166372B57308CCCC9EC31C2C7F698229D1FBD6

## Versão 0.1.0 — 9 de outubro de 2026

Ambiente executado: Windows 10 x64, Node 24.5.0, Electron 44.7.0.

| Verificação | Resultado |
| --- | --- |
| Instalação limpa com npm ci | Passou |
| TypeScript estrito e build de produção | Passou |
| Vitest: política, SQLite, sessões | 32 testes passaram |
| Playwright: Electron e fixtures locais | 2 testes passaram |
| Modo Vite + React + IPC | Passou; preâmbulo protegido por nonce aleatório |
| Página pública QConcursos no WebContentsView | Carregou; título e captura conferidos; sem erro/bloqueio |
| Interface clara e escura | Capturas conferidas |
| NSIS Windows x64 | Gerado: release/StudyRoom Setup 0.1.0.exe |
| Executável empacotado | Abriu interface, SQLite e onboarding; app.isPackaged=true |
| Comparação do pacote com build final | index.html, main e preload idênticos |
| Auditoria de dependências de produção | Nenhuma vulnerabilidade conhecida reportada |
| Auditoria completa de ferramentas | 8 alertas moderados na cadeia electron-builder; detalhes no README |

## Cobertura da integração
Onboarding, cadastro e persistência de sites/configurações, início de cinco minutos, preenchimento de formulário, navegação interna, bloqueio de Instagram, redirecionamento bloqueado, popup bloqueado e interno, ausência de Node/preload na página remota, pausa sem contagem, encerramento leve, proteção da lista em modo forte e reflexão. Recuperação em pausa após app.exit (que evita os hooks de fechamento), tempo até checkpoint, localStorage persistente e área nativa dentro dos limites após redimensionamento.

A saída abrupta automatizada usa app.exit. Encerramento forçado pelo sistema e perda de energia permanecem no roteiro manual. Testes de recuperação do banco reabrem um banco real em disco.

## Não validado
- Credenciais, CAPTCHA, login Google, questões, filtros, comentários e simulados autenticados no QConcursos.
- Instalação/desinstalação interativa do NSIS e assinatura comercial. O executável é sem assinatura.
- Execução Linux, AppImage/.deb, X11/Wayland e workflow remoto de CI.
- Fases 2 e 3, que não foram implementadas nesta entrega.

SHA-256 do instalador:
`E306FB08E31C633AA8362951664BF76831A4DACC834384820077D1604E5E46D9`

O carregamento da página pública não substitui os critérios de aceitação autenticados. Consulte MANUAL-TESTS.md.
