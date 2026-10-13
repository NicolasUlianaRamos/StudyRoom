# Retomada do StudyRoom

Atualizado em 13 de outubro de 2026. Projeto em desenvolvimento incremental.

## Implementado
- Fase 1: navegador real, política de navegação, sessões, persistência e instalador Windows.
- Primeiro bloco da Fase 2: anotações, Ver depois, pesquisa, autosave, exportação Markdown e painel lateral durante o estudo/pausa.
- Segundo bloco da Fase 2: planejador de matérias e assuntos, prioridade, duração, revisão, último estudo iniciado, links autorizados e retomada em cinco minutos. Notas vinculadas por ID com preservação dos rótulos antigos. Sessões guardam matéria e assunto como eram ao iniciar.
- Terceiro bloco da Fase 2: perfis com CRUD, listas independentes de sites, retomada por perfil, seleção na página inicial, troca protegida e histórico com nome original do perfil. Cookies, preferências, notas e planejador compartilhados.
- Quarto bloco da Fase 2: estatísticas diárias e semanais (oito semanas), totais por site, planejamento, pausas, conclusão/encerramento e registros bloqueados. Novas sessões guardam intervalos e dividem tempo à meia-noite local; legado mantém atribuição ao dia inicial.
- Quinto bloco da Fase 2: biblioteca de PDFs, cópias locais, deduplicação, leitura com PDF.js, páginas/zoom/texto, última página persistida, sessões com PDF, notas, recuperação e retomada em cinco minutos por perfil. Remoção preserva original, notas e histórico.
- SQLite migration 6; migrações de bancos v1, v2, v3, v4 e v5 cobertas por testes. Use 0.1.5 ou posterior após atualizar.

## Próxima etapa
Windows 0.1.10 refaz o labirinto para aproximar o visual clássico: 28 × 31 simétrico, paredes azuis contínuas sobre preto, casa com porta exclusiva para fantasmas, quatro fantasmas e túneis laterais. Sem alteração de dados ou schema.
Windows 0.1.9 acrescenta Pac-Man/Labirinto à pausa: mapa próprio, pastilhas normais/especiais, dois fantasmas e três vidas. Usa MazeBreak.tsx/maze.ts. Compartilha o prazo da pausa com a cobrinha, congela por perda de foco/expiração e não altera dados do usuário. Sem dependências novas ou Docker.

Windows 0.1.8 acrescenta descanso/cobrinha na pausa, com 3/5 minutos, teclado setas/WASD, parada na expiração e retomada explícita. Implementação local em StudyBreak.tsx e snake.ts, sem dependências ou alteração de schema. O intervalo é transitório da tela de pausa, não persiste ao ir ao planejador/reabrir. Dados reais do usuário não foram alterados.

As funcionalidades previstas nas Fases 1 e 2 estão implementadas. Pesquisa e proposta da Fase 3 entregues em FASE-3.md. Continuam as validações de aceitação. Não ativar restrições globais automaticamente.

Windows 0.1.7: modo imersivo por F11/ícone, saída por F11/Esc, faixa de 36 pixels, tempo/pausa/notas/encerramento, navegação sob Controles, compatível com sessões de PDF. Não altera schema nem dados, não ativa kiosk. 61 testes unitários e sete integrações Windows passaram. A captura enviada pelo usuário já mostra QConcursos autenticado em elite.qconcursos.com; persistência após reinício e resolução de questões ainda precisam de confirmação manual.

Correção Windows 0.1.6: o usuário iniciou o login Google e encontrou bloqueio local após informar a senha, no domínio accounts.google.com.br. A autorização temporária agora inclui esse host exato e as rotas de passagem de cookies /accounts/SetSID, /CheckCookie e variantes. O prazo de cinco minutos e a revogação ao retornar ao site de estudo permanecem. Não capturar credenciais ou URLs de login com parâmetros. Pacotes Linux continuam em 0.1.5; não iniciar Docker para esta correção Windows.

## Pendências de aceitação
Login, CAPTCHA, questões e demais recursos autenticados do QConcursos precisam da conta do usuário; ele preferiu testar depois. Instalação/desinstalação NSIS interativa permanece pendente por falha da ferramenta de automação da janela. Linux foi validado em Debian virtual: 49 testes unitários, sete integrações X11 e sete Wayland, AppImage, executável empacotado e instalação/remoção .deb com banco preservado. Faltam desktop físico, GPU, outros compositores e montagem FUSE. Consulte VALIDATION.md.

Fase 3: proposta compara Assigned Access, Shell Launcher, KDE Kiosk e systemd; define consentimento, adaptadores e recuperação. Implementação rigorosa depende de ambiente de teste dedicado e escopo explicitamente escolhido. Nenhum bloqueio global foi ativado.

## Comandos
`npm run test`, `npm run test:integration`, `npm run dist:win`, `node scripts/smoke-package.cjs`.

Os testes Electron precisam executar em uma sessão gráfica com acesso permitido ao runtime. Não desativar o sandbox do navegador para corrigir restrições do executor de desenvolvimento.

Os resultados e limites de cada entrega ficam em VALIDATION.md. O código está no workspace; não há PR ou publicação remota criada.
