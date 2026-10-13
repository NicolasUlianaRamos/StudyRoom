# StudyRoom
Navegador desktop de estudos para Windows e Linux. Fase 1 implementada em Electron, React, TypeScript, Vite, Tailwind e SQLite local. O QConcursos verdadeiro é exibido por WebContentsView, sem iframe ou recriação de suas funcionalidades.

## Abrir no Windows
Execute `release/StudyRoom Setup 0.1.8.exe` e siga o instalador. Para executar sem instalar, use `release/win-unpacked/StudyRoom.exe` mantendo toda a pasta junto.

Durante uma sessão, pressione **F11** ou clique no ícone de expandir para o modo imersivo. O site ou PDF ocupa a janela em tela cheia, com uma faixa de 36 pixels para o tempo, pausa, anotações e encerramento. **Controles** revela a navegação e o zoom. **F11** ou **Esc** volta à janela normal sem pausar ou encerrar o estudo.

Esta distribuição de desenvolvimento não possui certificado comercial de assinatura. A instalação interativa deve ser validada antes de distribuir a terceiros.

Na pausa, escolha **3 ou 5 minutos** e depois **Descansar** ou **Jogar cobrinha**. A cobrinha usa setas/WASD e pausa ao sair do tabuleiro ou trocar de janela. Ao acabar o intervalo, o jogo para; **Retomar meu estudo** continua a sessão quando você quiser. O intervalo não conta como estudo. O jogo é local, sem rede ou ranking. Seu cronômetro é temporário nesta tela: sair para o planejador ou fechar o aplicativo descarta o intervalo, mantendo a sessão de estudo pausada.

1. Defina seu objetivo na primeira abertura.
2. Clique em **Só começar por 5 minutos**, escolha uma duração ou um site autorizado.
3. Faça login diretamente no QConcursos, com sua conta.
4. Pause quando precisar. O modo forte pede um motivo e um intervalo de reflexão ao encerrar.
5. Cadastre outros sites em **Sites e preferências**, antes de iniciar a sessão.

## Abrir no Linux

Os pacotes x64 estão em `release/StudyRoom-0.1.5.AppImage` e `release/studyroom_0.1.5_amd64.deb`. No Debian/Ubuntu, instale com `sudo apt install ./studyroom_0.1.5_amd64.deb`. Para AppImage, permita execução com `chmod +x StudyRoom-0.1.5.AppImage` e abra o arquivo. O uso por FUSE depende da distribuição; em um ambiente sem FUSE, `APPIMAGE_EXTRACT_AND_RUN=1 ./StudyRoom-0.1.5.AppImage` usa extração temporária. Mantenha o sandbox do Electron ativo.

Build e testes reproduzíveis estão em [docs/LINUX-VALIDATION.md](docs/LINUX-VALIDATION.md); os resultados e limites observados ficam em [docs/VALIDATION.md](docs/VALIDATION.md).

## Desenvolvimento
Requer Node.js 24.x e npm. No diretório do projeto:

```sh
npm ci
npm run dev
```

A interface tem atualização automática pelo Vite. Reinicie `npm run dev` após alterações no processo principal ou preload.

```sh
npm run build             # TypeScript + interface + main/preload
npm run test              # testes unitários com Vitest
npm run test:integration  # build + testes reais no Electron via Playwright
npm run dist:win          # instalador NSIS no Windows
npm run dist:linux        # AppImage e .deb no Linux
```

Em Linux sem sessão gráfica, use `xvfb-run --auto-servernum npm run test:integration`. Não desative o sandbox. O runtime precisa das bibliotecas de desktop usuais do Electron.

Use Windows para gerar/testar NSIS e Linux para AppImage/.deb. O workflow em `.github/workflows/build.yml` prepara os dois ambientes separadamente e publica os pacotes como artefatos da execução, sem criar releases automaticamente. O workflow ainda precisa ser executado em um repositório GitHub.

## Entregue na Fase 1
- Interface em português, onboarding, modo claro/escuro, objetivo diário e histórico básico.
- Início em cinco minutos, durações sugeridas e duração personalizada.
- Navegador real: voltar, avançar, recarregar, início, zoom, domínio e erros amigáveis.
- Sites autorizados com nome, página inicial, ativação, exclusão e escolha explícita de subdomínios.
- Política central de URLs, redirecionamentos e popups, sem abertura automática no navegador externo.
- Cookie/armazenamento persistente em partição separada, permissões negadas e downloads interceptados.
- Sessões persistidas, pausa/retomada, conclusão e extensão, modos leve/forte e recuperação após queda.
- SQLite com migration versionada. Usa node:sqlite do runtime; não exige recompilar um addon SQLite.

## O que a validação cobre
Testes unitários verificam QConcursos, Instagram, domínios desconhecidos/parecidos, protocolos, portas, recursos auxiliares, autenticação restrita, banco, pausas, timestamps, bloqueio de configuração, intervalo de saída e recuperação.

A integração usa uma página HTTP local controlada exclusivamente no modo de teste não empacotado. Verifica interface, cadastro/persistência, formulários, navegação, redirecionamentos, popups e ausência de acesso Node/IPC no conteúdo remoto. Também exercita recuperação, armazenamento do site e limites de redimensionamento.

A página pública real do QConcursos carregou no Electron durante a validação. Isso **não valida login, CAPTCHA, questões, comentários ou simulados autenticados**. Execute o roteiro em [docs/MANUAL-TESTS.md](docs/MANUAL-TESTS.md) com sua própria conta. Um teste público opcional, sem credenciais, está em `node scripts/smoke-qconcursos.cjs` (após build).

## Limitações conhecidas
- Login externo pode ser recusado pelo provedor. O botão de autorização Google permite somente determinadas rotas por cinco minutos. Popups usam a mesma área e fluxos dependentes de window.opener podem não funcionar. Não há bypass de CAPTCHA ou antifraude.
- O aplicativo controla a navegação dentro dele; não bloqueia outros programas, Alt+Tab ou encerramento forçado.
- Durante minimização/suspensão, uma sessão não pausada continua até o alvo. Não há inferência automática de atenção.
- Após queda, recupera em pausa até o último checkpoint (aproximadamente um segundo). Não contabiliza o intervalo fechado.
- Alterar manualmente o relógio para frente pode antecipar o fim; retrocessos não geram tempo negativo.
- O tempo diário das novas sessões é dividido pelos dias de estudo; registros antigos são atribuídos ao dia de início. Histórico na interface mostra as 30 sessões mais recentes.
- Última página remove query/fragmento para reduzir persistência de tokens; filtros nesses campos não são retomados.
- Conteúdo e publicidade originais do QConcursos permanecem sob controle do site.
- Linux foi exercitado em ambiente virtual X11/Wayland. Desktop físico, FUSE, instalação interativa NSIS e login real ainda exigem validação manual.
- `npm audit --omit=dev` não apontou vulnerabilidades conhecidas nesta validação. A auditoria completa mantém 8 alertas moderados na cadeia de ferramentas de electron-builder (sprintf-js/global-agent). Não estão nas dependências de produção; acompanhar atualização upstream antes de publicar versões.

## Dados e privacidade
Os dados ficam em `app.getPath('userData')`: banco `studyroom.sqlite`, arquivos WAL e partição de navegação. Não existem conta StudyRoom, servidor, telemetria, captura de tela ou coleta de teclado. Credenciais são tratadas pelo próprio site e sua sessão Chromium; não são copiadas para o banco.

Para backup, feche o aplicativo e copie a pasta userData inteira. Essa pasta contém sessões de login: trate o backup como privado. Para limpar, feche e remova os dados pelas ferramentas do sistema após fazer backup. A desinstalação não apaga automaticamente seus dados.

## Anotações e Ver depois — início da Fase 2
Abra **Anotações** no menu ou na barra do navegador durante uma sessão. O painel lateral preserva a página atual e também funciona durante as pausas. Crie uma anotação de estudo ou use **Ver depois** para guardar um pensamento sem abrir outro site.

O editor salva automaticamente cada alteração em SQLite e mostra a confirmação de gravação. Pesquise por título, texto ou matéria, altere a categoria e exporte cada nota com **Exportar Markdown**, escolhendo o destino na janela do sistema. A exclusão pede confirmação. Selecione uma matéria do planejador ou mantenha um rótulo livre. Notas criadas numa sessão de assunto recebem sua matéria automaticamente. O conteúdo é texto simples, sem executar HTML ou abrir links.

Limites atuais: 500 notas, 100 mil caracteres por nota. Antes de fechar o aplicativo, aguarde **Salvo neste computador**. A migration 6 preserva os dados das versões anteriores; após atualizar o banco, use a versão 0.1.5 ou posterior.

## Planejador
Crie matérias e assuntos em **Planejador**. Cada assunto tem prioridade, duração prevista, data opcional de revisão e link HTTPS de um site autorizado. **Estudar agora** inicia a sessão com essa duração; o botão de cinco minutos retoma o último assunto com cinco minutos. Um atalho de site inicia uma sessão sem assunto e encerra essa preferência de retomada.

Os links cadastrados no planejador preservam query e filtros. Não use endereços com tokens privados. A autorização é revalidada ao iniciar: se o site tiver sido desativado ou removido, o aplicativo pede a revisão das permissões. O planejador não adiciona permissões.

Durante a pausa, use **Abrir planejador** para consultar ou ajustar seu plano. A revisão é uma data manual; não há notificações nem reagendamento automático. O último estudo registra o início da sessão. Excluir uma matéria remove seus assuntos, preservando notas, rótulos e histórico das sessões. Renomear a matéria atualiza notas vinculadas, mas preserva os nomes históricos das sessões.

## Perfis de estudo
Em **Sites e preferências**, crie perfis como Concurso ou Programação. Cada perfil tem sua própria lista de sites e lembra sua última página e assunto. Os sites já cadastrados são migrados para **Padrão**. Novos perfis começam vazios: selecione o perfil e adicione seus sites antes de estudar. O seletor também fica na página inicial.

Encerre a sessão antes de trocar, criar, renomear ou excluir perfis, inclusive sessões pausadas ou aguardando extensão. A troca limpa a página anterior, o histórico de navegação da janela e a autorização temporária de login Google. O botão de início do navegador abre o primeiro site ativo do perfil. Links de assuntos continuam sujeitos à lista do perfil selecionado.

Notas, matérias, histórico, preferências e cookies de login são compartilhados entre perfis. Perfis organizam permissões de estudo; a sessão do site é a mesma. Para excluir um perfil, selecione outro e confirme a exclusão. Seus sites são removidos, mas as sessões mantêm o nome original do perfil. Limite: 20 perfis.

## Estatísticas
Abra **Estatísticas** para consultar oito semanas, de segunda a domingo, com tempo por dia e por site, sessões iniciadas, concluídas e encerradas antes do alvo. O painel inclui todos os perfis e não limita os cálculos às 30 sessões exibidas no histórico. Os valores de tempo são mostrados em minutos completos, e a sessão em andamento é incluída uma única vez.

As novas sessões registram seus intervalos de estudo e dividem o tempo à meia-noite local, excluindo pausas e o período em que o aplicativo ficou fechado. Registros antigos mantêm o tempo no dia de início. Quantidade de sessões, planejamento, conclusão e pausas são atribuídos ao início da sessão. O objetivo diário na página inicial usa o mesmo cálculo de tempo do painel.

Tentativas bloqueadas usam os registros locais dos últimos 30 dias; semanas anteriores podem não ter esses dados. Repetições consecutivas do mesmo domínio bloqueado contam como um registro. Não há classificação, competição ou acompanhamento de teclado/tela.

## Próximas fases
Os blocos de funcionalidades previstos nas Fases 1 e 2 estão implementados. A aceitação final ainda exige validação autenticada do QConcursos, instalação interativa NSIS e conferência em desktop Linux físico.
Fase 3: [pesquisa e proposta de adaptadores Windows/Linux](docs/FASE-3.md) entregues, com consentimento e recuperação. Não há bloqueio global experimental nesta versão.

Detalhes em [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

Referências oficiais: [segurança do Electron](https://www.electronjs.org/docs/latest/tutorial/security), [WebContentsView](https://www.electronjs.org/docs/latest/api/web-contents-view), [webContents](https://www.electronjs.org/docs/latest/api/web-contents) e [Session](https://www.electronjs.org/docs/latest/api/session).

## Biblioteca e leitor de PDFs
Abra **Biblioteca → Importar PDF** e escolha um arquivo na janela do sistema. O aplicativo guarda uma cópia privada local: mover ou apagar o original não interrompe a leitura. Arquivos com o mesmo conteúdo não são duplicados. Use **Abrir PDF**, navegue pelas páginas, ajuste o zoom e expanda **Texto da página** para consultar/copiar o texto extraído. A última página é salva automaticamente após renderizar.

No leitor, escolha o tempo e clique em **Estudar este PDF** para iniciar uma sessão com cronômetro. Pausas, extensão, modo forte, recuperação e anotações funcionam como no navegador. O botão de cinco minutos retoma o último PDF estudado no perfil atual. Abrir um PDF na biblioteca permite leitura livre; iniciar a sessão é uma ação explícita.

Limites: 100 PDFs, 50 MB por arquivo, 500 MB na biblioteca e 10 mil páginas por documento. PDFs protegidos por senha, anexos, links e formulários interativos não são suportados nesta versão. O leitor renderiza páginas com PDF.js 6.4.299; não executa ações JavaScript nem abre URLs do documento. Texto digitalizado em imagens não recebe OCR. PDFs danificados e cópias locais ausentes exibem orientação para reimportar.

Remover um item apaga apenas a cópia local, após confirmação. O original, as notas e o histórico permanecem. Um PDF em sessão não pode ser removido antes de encerrar. PDFs são compartilhados entre perfis, enquanto a preferência de retomada pertence a cada perfil. O backup da pasta userData inclui o banco e a subpasta `pdfs`.
