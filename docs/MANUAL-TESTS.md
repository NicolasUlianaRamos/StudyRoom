# Validação manual pendente

## Planejador — versão 0.1.2
- Cadastre, edite e exclua matérias/assuntos; confirme prioridade, duração e revisão depois de reabrir.
- Inicie um assunto de QConcursos com filtros no link. Confira a página real e a identificação no cabeçalho/histórico.
- Pause, abra o planejador, volte ao estudo e confirme que a pausa não foi contabilizada.
- Crie notas vinculadas, renomeie a matéria e confirme a atualização nas notas. Exclua a matéria e confira preservação das notas e histórico.
- Desative o site antes de iniciar o assunto salvo: o início deve ser recusado, sem acrescentar permissões.

Execute com uma conta própria. Nunca envie senha, cookies ou tokens aos logs ou issues.

## QConcursos real (Windows e Linux)
- Abrir QConcursos, verificar página pública, navegar entre páginas internas.
- Entrar por e-mail/senha; cumprir CAPTCHA normalmente. Fechar/reabrir e verificar persistência, respeitando expiração do provedor.
- Quando necessário, autorizar temporariamente login Google, iniciar pelo site e verificar ida/retorno e expiração. Registrar apenas domínio/etapa que falhou. Provedor pode rejeitar WebViews; não contornar.
- Resolver questão, escolher alternativa, responder, aplicar filtros, abrir comentários e simulados.
- Confirmar que anúncios/links externos não abrem destinos não autorizados. O aplicativo não remove publicidade do site de terceiros.
- Testar popup interno, link externo, redirecionamento, voltar/avançar/recarregar e zoom.
- Testar conexão indisponível, reconexão e erro TLS (não deve ser ignorado).

## Desktop
- Modo imersivo 0.1.7: durante estudo, use F11 com foco dentro da questão e nos controles. Confira faixa compacta, cronômetro, pausa, notas e Controles; F11/Esc devem restaurar a janela e preservar a resposta. Repita com PDF, escala do Windows e múltiplos monitores. Confirme que sair da tela de estudo volta à janela normal e que o modo forte ainda exige motivo/espera para encerrar.
- Instalar/desinstalar via NSIS; conferir atalhos, abertura, fechamento/reabertura e dados preservados.
- Iniciar 5 minutos; pausar/retomar; minimizar; suspender/retomar; aguardar conclusão e estender.
- Modo forte: sites/opções travados, fechar janela apresenta motivo/intervalo, cancelar volta ao estudo, confirmar encerra. Depois é possível fechar normalmente.
- Encerrar processo durante sessão e reabrir: recuperação em pausa, sem tempo offline.
- Redimensionar, testar escala 100/125/150%, foco por Tab, Shift+Tab e teclado.
- Linux: instalar .deb, executar AppImage (permissão de execução; FUSE pode ser necessário), testar separadamente X11 e Wayland com --ozone-platform=wayland. Não usar --no-sandbox como solução.
- Confirmar caminhos de userData apropriados e partição persistente.

## Ainda não validado automaticamente
Login real, CAPTCHA, questões autenticadas, instalação interativa NSIS, desktop Linux físico/FUSE e builds remotos do GitHub Actions. Linux X11 e Wayland foram exercitados em Debian virtual com sete cenários de integração em cada ambiente; instalação/remoção .deb e AppImage por extração temporária também passaram. Os testes controlados não substituem os itens manuais restantes.
# Anotações — versão 0.1.1

- Crie uma anotação e um item Ver depois, aguarde o indicador de salvamento e reabra o aplicativo. Confira texto, acentos e categoria.
- Durante estudo e pausa, abra o painel lateral. Confira que a página permanece na mesma atividade e que os campos de anotação recebem foco pelo teclado.
- Use Exportar Markdown, escolha um diretório, confira o conteúdo do arquivo e depois repita cancelando o diálogo. Verifique também a mensagem em um diretório sem permissão de escrita.
- Confira o painel em 850×640, temas claro/escuro, pesquisa por matéria/texto e confirmação/cancelamento de exclusão.

## Perfis — versão 0.1.3

- Atualize um banco 0.1.2 com sites personalizados: confira que todos aparecem em Padrão, com ativação e subdomínios preservados.
- Crie Concurso e Programação, selecione cada um e cadastre sites diferentes. Reinicie e confira o perfil selecionado, seus sites e a retomada do último assunto em cinco minutos.
- Inicie um assunto cujo site está autorizado somente no outro perfil: deve exigir a revisão das permissões.
- Durante estudo, pausa e conclusão aguardando extensão, confira que a troca e a edição de perfis ficam bloqueadas até encerrar a sessão.
- Após trocar o perfil, confira que a página anterior desaparece, o botão Voltar fica desabilitado e o botão Início usa um site ativo do perfil atual.
- Renomeie um perfil; depois selecione outro e exclua o anterior, cancelando a primeira tentativa. Confira que notas, matérias e histórico permanecem e que sessões antigas mantêm o nome original.
- Confira o compartilhamento de login nos sites autorizados em ambos os perfis, temas e janela mínima 850×640.

## Estatísticas — versão 0.1.4

- Estude dois minutos, pause por alguns minutos e retome: confira que a pausa não aumenta o tempo. Encerre e reabra; os totais devem permanecer.
- Inicie próximo à meia-noite e confira tempo dividido entre os dias; numa virada domingo/segunda, consulte as duas semanas.
- Conclua uma sessão e estenda: deve continuar sendo uma única sessão, com tempo adicional limitado ao novo alvo.
- Confira oito semanas, limites dos botões, semanas sem estudo e tempo por site. Os totais reúnem todos os perfis, inclusive perfis excluídos.
- Confira a mensagem de atribuição ao dia de início para sessões das versões antigas e a limitação de 30 dias dos bloqueios.
- Compare o tempo de hoje na página inicial com o dia correspondente do painel. Confira temas claro/escuro e janela mínima, com rolagem da tabela quando necessário.

## PDFs — versão 0.1.5

- Importe documentos com texto, imagens, fontes incorporadas e acentos. Confira páginas, zoom, ajuste à largura, texto extraído e última página após reinício.
- Cancele o diálogo de importação e importe duas vezes o mesmo arquivo: não deve criar duplicatas. Confira erros com texto renomeado para PDF, documento danificado, documento com senha e arquivos maiores que 50 MB.
- Mova/apague o original depois de importar: a cópia deve continuar legível. Remova o material com confirmação e confira que um original existente permanece intacto.
- Inicie uma sessão PDF e teste pausa, extensão, modo forte, notas, encerramento, recuperação após queda e retomada por cinco minutos no perfil atual. A WebContentsView remota deve permanecer oculta durante o PDF.
- Troque entre perfis após encerrar; confira retomada própria e biblioteca compartilhada. Materiais em sessão não podem ser removidos.
- Clique em regiões com links e ações do PDF: não devem abrir sites, anexos ou executar ações. Os controles do aplicativo continuam funcionando.
- Confira um PDF digitalizado: imagem legível, com indicação de ausência de texto quando aplicável. Confira temas, janela mínima e uso totalmente offline.

## Pausa com cobrinha (0.1.8)

- Em uma questão com resposta em andamento, pausar, escolher 3 ou 5 minutos e iniciar a cobrinha. Conferir setas/WASD, frutas, colisão e nova rodada dentro do mesmo intervalo.
- Clicar fora do tabuleiro ou alternar de janela: o jogo deve parar. Retomar pelo botão do jogo. Testar tema claro/escuro, F11 e monitor pequeno.
- Trocar Descansar/Jogar cobrinha: o cronômetro não deve reiniciar. Ao chegar a zero, o jogo para e a sessão permanece pausada até retomar explicitamente.
- Retomar antes/depois do prazo: resposta no site preservada e pausa não contabilizada como estudo. Repetir com PDF e verificar última página.
- Abrir o planejador ou fechar durante a pausa descarta apenas o intervalo recreativo; a sessão de estudo permanece pausada.

## Labirinto na pausa (0.1.9)

- Selecionar Jogar Pac-Man, iniciar e usar setas/WASD. Viradas solicitadas antes da esquina devem acontecer quando o caminho estiver livre. Paredes impedem passagem.
- Coletar pastilhas, capturar fantasmas após uma pastilha grande, perder vidas e reiniciar ao esgotá-las. Nova rodada mantém o mesmo prazo da pausa.
- Alternar janela, notas e outras atividades: jogo para ao perder foco. Trocar entre cobrinha e labirinto não reinicia o intervalo. Sair do labirinto descarta sua rodada.
- Ao expirar, verificar jogo parado, estudo ainda pausado e retorno explícito. Conferir F11, temas e monitor pequeno.



## Labirinto clássico (0.1.10)
- Conferir contornos azuis contínuos, simetria, quatro fantasmas e tamanho confortável no monitor.
- Atravessar os túneis laterais nos dois sentidos. A porta rosa permite a saída dos fantasmas e impede a entrada do jogador.
- Conferir setas/WASD, pastilhas, perda de vida, prazo compartilhado da pausa e retorno ao estudo.
