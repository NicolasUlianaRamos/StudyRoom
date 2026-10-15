# Compartilhar o StudyRoom 0.1.11

Baixe os arquivos da execução aprovada em GitHub → Actions → Test and package → Artifacts. É necessário entrar no GitHub para baixar artifacts. Extraia o ZIP recebido e envie somente o instalador apropriado. Não envie a pasta do projeto ou os dados pessoais do aplicativo.

| Computador                                  | Artifact                 | Arquivo a enviar               |
| ------------------------------------------- | ------------------------ | ------------------------------ |
| Windows x64                                 | StudyRoom-windows-latest | StudyRoom Setup 0.1.11.exe     |
| Mac com chip Apple (M1, M2, M3 etc.)        | StudyRoom-macos-15       | StudyRoom-0.1.11-mac-arm64.dmg |
| Mac Intel                                   | StudyRoom-macos-15-intel | StudyRoom-0.1.11-mac-x64.dmg   |
| Ubuntu/Debian e derivados, x64              | StudyRoom-ubuntu-latest  | studyroom_0.1.11_amd64.deb     |
| Outras distribuições Linux compatíveis, x64 | StudyRoom-ubuntu-latest  | StudyRoom-0.1.11.AppImage      |

## Mac

Em menu Apple → Sobre Este Mac, confira se aparece um chip Apple ou processador Intel. Abra o DMG correspondente e arraste StudyRoom para Aplicativos. Abra pela pasta Aplicativos.

Esta distribuição para teste usa assinatura ad hoc, sem certificado Developer ID e sem notarização da Apple. O macOS pode impedir a primeira abertura. Para um arquivo recebido diretamente do autor e cuja origem foi conferida, siga a orientação oficial para autorizar especificamente esse aplicativo em Ajustes do Sistema → Privacidade e Segurança → Abrir Mesmo Assim:
https://support.apple.com/en-us/102445

Não é necessário desativar a proteção geral do Mac. Macs gerenciados por empresas podem impedir essa autorização. A validação no CI não substitui o teste da instalação e do login no computador da pessoa.

## Linux

No Ubuntu/Debian, abra um terminal na pasta do arquivo e instale:

```sh
sudo apt install ./studyroom_0.1.11_amd64.deb
```

Para o AppImage, permita a execução em Propriedades → Permissões ou use:

```sh
chmod +x StudyRoom-0.1.11.AppImage
./StudyRoom-0.1.11.AppImage
```

A disponibilidade de bibliotecas como FUSE depende da distribuição. Se faltar alguma, use o pacote DEB em uma distribuição compatível ou informe a mensagem exata. Não execute o aplicativo como root nem use --no-sandbox como solução.

## Dados e atualizações

Cada pessoa configura o próprio perfil e os próprios logins. O aplicativo salva os estudos localmente. Não exige Docker, Node, banco externo ou hospedagem. As plataformas de questões continuam exigindo internet e suas próprias contas/assinaturas.

O arquivo SHA256SUMS.txt de cada artifact permite conferir a integridade dos instaladores. Atualizações são manuais: envie o novo instalador correspondente ao sistema. Os artifacts do Actions têm retenção limitada; para distribuição permanente, publique posteriormente uma GitHub Release revisada.

## Validação

O workflow executa testes unitários, integrações do Electron e abertura do aplicativo empacotado. Linux é exercitado em X11 e Wayland. Os dois Macs são construídos e testados em suas arquiteturas nativas. Consulte o resultado da execução correspondente ao commit antes de compartilhar.
