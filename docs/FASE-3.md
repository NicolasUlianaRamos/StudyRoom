# Proteções avançadas — pesquisa e proposta

Pesquisa em 10 de outubro de 2026. Este documento é uma proposta; nenhum bloqueio global foi instalado ou ativado.

## Decisão

Manter o StudyRoom normal nos modos leve e forte. Um modo rigoroso que realmente restrinja outros programas exige configuração do sistema e testes em uma conta dedicada. Não é uma extensão universal do cronômetro Electron. Tela cheia, janela sempre visível e interceptação de atalhos não garantem impedir troca de aplicativos ou encerramento forçado.

## Alternativas verificadas

| Ambiente | Recurso | Aplicação ao StudyRoom |
| --- | --- | --- |
| Windows Pro/Enterprise/Education | Assigned Access, experiência restrita com lista de aplicativos | Candidato para uma conta de estudo dedicada. A modalidade de quiosque de aplicativo único é voltada a UWP/Edge; não deve ser apresentada como suporte direto ao Electron. Políticas podem alcançar outras contas, portanto precisam de revisão em VM antes de qualquer implantação. |
| Windows Enterprise/Education/IoT Enterprise | Shell Launcher | Permite usar um aplicativo desktop como shell. Não bloqueia sozinho outros aplicativos; exigiria políticas adicionais e recuperação administrativa. Não é adequado como opção simples para toda instalação do Windows. |
| Linux com KDE Plasma | Kiosk | Restringe ações e configurações de aplicativos que respeitam o framework KDE. Não constitui uma política universal de execução para aplicações Electron e outros desktops. |
| Linux com systemd | Inhibitor locks | Controlam suspensão, desligamento e ociosidade; não bloqueiam distrações ou outros aplicativos. Não servem como implementação do modo rigoroso. |

Fontes primárias: [Assigned Access](https://learn.microsoft.com/en-us/windows/configuration/assigned-access/), [Shell Launcher](https://learn.microsoft.com/en-us/windows/configuration/shell-launcher/), [KDE Kiosk](https://develop.kde.org/docs/administration/kiosk/introduction/), [systemd inhibitor locks](https://github.com/systemd/systemd/blob/main/docs/INHIBITOR_LOCKS.md).

## Contrato proposto para adaptadores

O processo principal deverá consultar um adaptador por plataforma com operações `probe`, `preview`, `apply`, `status` e `restore`. `probe` apenas identifica capacidades. `preview` produz a lista exata de mudanças, permissões, duração e procedimento de recuperação. `apply` só existe para um adaptador comprovado em VM e recebe o consentimento para aquele plano específico. O renderer não recebe execução de comandos, caminhos arbitrários ou acesso administrativo.

Separar o componente privilegiado, quando indispensável, do navegador e da sessão com cookies. Não aceitar comandos de shell pela IPC. Usar operações fixas, validar identidade do solicitante e recusar alteração de políticas já pertencentes a outro administrador. Não alterar hosts, firewall, políticas globais ou matar processos como atalho para bloquear distrações.

## Consentimento e recuperação

Antes da ativação, mostrar o escopo real, programas permitidos, conta afetada, limites e saída de emergência. Exigir confirmação dentro do aplicativo para cada ativação; a instalação normal nunca ativa restrições. Recomenda-se primeiro uma conta de estudo separada, mantendo uma conta administrativa de recuperação acessível.

Registrar o estado anterior e o plano em armazenamento local antes de aplicar mudanças. Restaurar apenas valores que ainda correspondam aos aplicados pelo StudyRoom, preservando mudanças posteriores do usuário/administrador. Caso uma operação falhe, interromper a aplicação e desfazer as mudanças já concluídas. Não prometer recuperação automática após queda até que ela tenha sido comprovada no adaptador e no sistema alvo.

## Critérios antes de implementar em máquina pessoal

- Testar em VM de cada edição/desktop suportado, com snapshot de recuperação.
- Demonstrar ativação e restauração integral, inclusive após término de sessão, falha parcial, reinício, suspensão, falta de energia simulada e encerramento forçado.
- Garantir entrada na conta de recuperação e acesso às ferramentas do sistema.
- Verificar coexistência com políticas preexistentes, atualização/desinstalação e integridade dos dados do StudyRoom.
- Recusar sistemas não suportados com explicação clara, sem falsa indicação de proteção.

A pesquisa e a proposta estão entregues. O adaptador rigoroso permanece condicionado a um ambiente de teste adequado e à escolha explícita do escopo pelo usuário; não existe ainda uma implementação validada para ativar.
