# Arquitetura e segurança
O processo principal é a única autoridade sobre navegação, configurações e tempo. React não recebe Electron, Node, filesystem, cookies nem SQL.

- `electron/main.ts`: ciclo de vida, esquema local seguro studyroom://, validação de origem e argumentos IPC, comandos explícitos.
- `electron/browser.ts`: WebContentsView, particionamento persistente, permissões, interceptação de documentos, redirecionamentos, popups, downloads, limites e erros.
- `electron/policy.ts`: URLs HTTPS, credenciais e portas rejeitadas, comparação exata de host com limite de subdomínio.
- `electron/database.ts`: SQLite integrado ao Node do Electron, migration transacional versionada via user_version, WAL. Schema 4 adiciona profiles, migra sites para profileId=1 e usa UNIQUE(profileId,url). Operações em sites sempre filtram pelo perfil selecionado. Retomada por perfil é salva/restaurada numa transação.
- `electron/sessions.ts`: máquina de estados persistida, pausas, conclusão, intervalo de reflexão e recuperação.
- `electron/statistics.ts`: oito semanas de segunda a domingo, divisão dos intervalos por dias locais, incluindo horário de verão, sem duplicar sessão ativa. Consulta usa todas as sessões relevantes ao período, sem o limite do histórico. Bloqueios são contados pela data do registro, somente na retenção de 30 dias.
- `electron/pdfs.ts`: importação por caminho fornecido exclusivamente pelo diálogo nativo, validação de cabeçalho/tamanho, cópia com UUID, deduplicação SHA-256 e limites de armazenamento. Schema 6 cria pdfs e acrescenta profiles.lastPdfId. Não guarda o caminho original.
- `electron/planner.ts`: matérias e assuntos, validação de revisão/duração, revalidação da allowlist antes do início e contexto de matéria/assunto nas sessões. A migration 3 cria subjects/topics e o vínculo opcional notes.subjectId. Remoção usa cascade para assuntos e SET NULL para notas. Rótulos antigos não são associados automaticamente pelo nome.
- `electron/notes.ts`: validação dos campos e conversão das notas para Markdown. A migration 2 adiciona a tabela notes. A exportação escolhe o destino exclusivamente pelo diálogo nativo do processo principal; o renderer não fornece caminhos de gravação.
- `electron/preload.ts`: duas APIs estreitas, sem IPC genérico.
- `src/`: componentes React, estilos Tailwind/CSS e contrato TypeScript.
- `tests/`: política, banco, tempo; integração Electron com fixtures locais.

## Fronteiras de confiança
A interface local tem CSP, protocolo próprio, contextIsolation e sandbox. IPC exige WebContents e frame principal exatos e URL da aplicação exata. O conteúdo remoto não tem preload, Node, acesso ao IPC ou ao filesystem. Ambos usam webSecurity. Não há shell.openExternal, bypass de certificado, script injetado no QConcursos ou alteração de user agent.

A política usa URL e compara protocolo, hostname e porta. Páginas principais são verificadas em loadURL (comandos), will-navigate, will-frame-navigate, will-redirect, window.open e webRequest mainFrame. O navegador não cria janelas remotas: popups permitidos são carregados na mesma área; os demais são recusados. Histórico é protegido também na camada de rede.

Recursos auxiliares (scripts, CSS, imagens, fetch) não são promovidos a páginas autorizadas. Iframes são limitados aos sites cadastrados e provedores auxiliares explícitos para CAPTCHA/pagamento. Isso pode exigir ajustes conforme os provedores do QConcursos mudarem. Não se deve liberar indiscriminadamente documentos de terceiros para corrigir um login.

## Autenticação
Cookies e armazenamento do site ficam na partição persist:studyroom-web, sob userData. Não são copiados para o banco de configuração. O site mantém controle de sua expiração.

O botão “Autorizar login Google” concede por 5 minutos apenas determinadas rotas HTTPS em accounts.google.com e accounts.google.com.br, incluindo a passagem regional de cookies em /accounts/SetSID e /CheckCookie. Não inicia login por conta própria: depois use a opção do site. O retorno a um site autorizado encerra a concessão; o vencimento leva de volta ao primeiro site ativo do perfil. Um fluxo que dependa de window.opener ou de etapas não cadastradas pode falhar, pois popups são consolidados. Nenhuma promessa de compatibilidade com login Google incorporado. Login por e-mail/senha, CAPTCHA e resolução de questões precisam de teste manual com conta real.

Perfis compartilham a partição de cookies. A troca exige ausência de sessão ativa, carrega about:blank internamente e limpa navigationHistory antes de ativar a nova política. A exceção a about:blank existe somente durante essa limpeza e não autoriza comandos de navegação remotos. Comandos concorrentes de mutação ficam bloqueados durante a troca. A autorização Google é revogada. Sessões novas guardam ID e nome do perfil; exclusão e renomeação não alteram esses registros históricos.

## Tela de estudo imersiva
F11 alterna a tela cheia nativa somente na tela de estudo; Esc sai desse modo. Os eventos before-input-event são tratados no processo principal tanto na interface local quanto no WebContentsView remoto, sem injeção na página ou atalho global do sistema. Repetição de tecla não alterna várias vezes. O estado immersive é transitório e publicado no snapshot; não muda preferências persistidas, sessão, cookies ou proteção forte.

A interface oculta os cabeçalhos e reserva uma faixa de 36 pixels com domínio/material, tempo e controles essenciais. O botão Controles revela a barra de navegação; anotações continuam em coluna lateral. ResizeObserver mede a área restante e atualiza os limites da view nativa, evitando sobreposição por HTML que ficaria atrás do WebContentsView. Pausa, motivo/intervalo de encerramento e bloqueios continuam nos mesmos fluxos. Ao sair da tela de estudo ou encerrar a sessão, a janela volta ao modo normal. Não usa modo kiosk nem restrições do sistema.

## Dados
Banco: app.getPath('userData')/studyroom.sqlite. Schema 1: settings, sites, sessions, blocks. Sessões guardam timestamps, duração, pausas, motivo e domínio. Bloqueios guardam somente hostname e timestamp (retenção de 30 dias). O último endereço exclui query e fragmento e ignora rotas comuns de autenticação; portanto filtros codificados na query não são restaurados. Links cadastrados manualmente são armazenados como fornecidos; não inclua links privados com tokens.

O cronômetro soma tempo de execução pelos timestamps, exclui pausas explícitas e limita ao alvo. Uma sessão em andamento continua durante minimização/suspensão, até o tempo planejado. Não há monitoramento de atenção. O checkpoint é persistido a cada segundo. Após queda, recupera em pausa até o último checkpoint, sem contar o período fechado. Alterações do relógio para trás não produzem tempo negativo; alterações manuais para frente podem antecipar o fim.

A versão 5 do banco marca a evolução do JSON das sessões: novas sessões têm intervals com início/fim de cada execução contínua. O tick atualiza o último intervalo, sem criar um intervalo por segundo; pausa, conclusão e encerramento registram o fim limitado ao alvo. Pausas não geram intervalos. A divisão por dia usa a meia-noite local, sem assumir dias de 24 horas. O snapshot projeta o intervalo ativo numa cópia, sem alterar a persistência nem duplicar registros. Sessões legadas não recebem intervalos inventados: seu tempo fica no dia de início. Contagem de sessões, conclusão, pausas e planejamento também pertencem ao dia de início. Não há alteração destrutiva dos registros antigos; o versionamento impede versões anteriores de editar o novo formato.

## Escopo e ameaça
Este é um controle voluntário dentro do aplicativo. Não impede Alt+Tab, outros navegadores, alterações do banco por seu proprietário, encerramento forçado nem ferramentas externas. Modo forte é fricção de saída, não bloqueio do SO. Não há componentes administrativos ou bloqueio global. Download, permissões de dispositivos, captura de tela, câmera, geolocalização e notificações são negados.

A exceção HTTP de fixture exige aplicativo não empacotado, flag --studyroom-test e uma origem 127.0.0.1 explícita. Ela não funciona no instalador. Scripts de teste só interagem com as fixtures locais; a aplicação não injeta scripts em sites reais.

## Próximas fases
As funcionalidades previstas nas Fases 1 e 2 estão implementadas. Linux virtual X11/Wayland e pacotes foram validados; restam aceitação com conta real, NSIS interativo e desktop Linux físico/FUSE.
Fase 3: pesquisa e contrato de adaptadores documentados em FASE-3.md, com consentimento e recuperação. Qualquer interface futura deve declarar capacidades por plataforma; não há implementação experimental ativada.

## Leitor local
O renderer solicita bytes por um IPC específico studyroom:pdf-data, autorizado somente para a janela e frame principal da UI local. A entrada aceita apenas um ID de material existente, validado como UUID; não recebe caminhos. O main lê somente `userData/pdfs/<id>.pdf`. Importação recebe o caminho do diálogo do sistema, nunca do comando do renderer. A leitura aloca no máximo o tamanho validado mais um byte, detectando alterações durante a leitura. Start/remove são protegidos contra operações concorrentes; exclusão de PDF em sessão é rejeitada.

PDF.js renderiza canvas, com worker local, fontes/CMaps/Wasm/ICC empacotados e acesso offline. Não há iframe, plugin Chromium de PDF, scripting manager ou camadas interativas de links/anexos/formulários. O texto extraído é renderizado como texto React. A CSP permite worker self, fontes blob e compilação Wasm, sem liberar eval JavaScript. Alocação de canvas é limitada a 16 milhões de pixels e imagens a 25 milhões. Fontes e decodificadores ficam em assets locais; nenhum CDN é usado.

PDF.js fica nas dependências de build: Vite inclui seu código e worker, e scripts/pdf-assets.mjs copia os recursos auxiliares. O instalador não precisa dos módulos Node opcionais de canvas. Durante sessão PDF, a WebContentsView remota permanece oculta. As sessões guardam ID/nome do material e usam o domínio descritivo PDF local nas estatísticas. Remover material não apaga histórico ou notas.
