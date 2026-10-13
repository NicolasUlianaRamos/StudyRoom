# Validação Linux reproduzível

O ambiente de referência desta validação usa Debian Bookworm x64, Node 24 e bibliotecas gráficas do Electron em Docker Desktop/WSL2. Os pacotes são gerados por ferramentas Linux. O contêiner não substitui a aceitação em um desktop físico com GPU, FUSE, gerenciador de arquivos e sessão de usuário.

## Build

```sh
docker build -f scripts/linux-validation.Dockerfile -t studyroom-validation:0.1.5 .
```

O build faz `npm ci`, executa os 49 testes unitários e gera AppImage e .deb. O limite de tempo dos testes é 30 segundos exclusivamente nesse build, pois as migrações SQLite fazem gravações sincronizadas no disco virtual. Nenhuma asserção é removida.

O lockfile inclui as dependências opcionais de assinatura exigidas por uma instalação limpa. O campo `homepage` fica vazio porque o projeto ainda não tem página pública; isso permite ao empacotador Debian omitir a URL em vez de inventar uma.

## Testes gráficos

Em Linux nativo com bibliotecas instaladas:

```sh
xvfb-run --auto-servernum npm run test:integration
node scripts/smoke-package.cjs release/linux-unpacked/studyroom
```

O segundo comando precisa de uma sessão gráfica; use também `xvfb-run --auto-servernum` quando necessário. Ele abre o executável empacotado e verifica versão, snapshot e recursos locais do leitor PDF.

Para Wayland sem monitor, instale Weston no ambiente de teste e execute:

```sh
sh scripts/wayland-test.sh npm run test:integration
sh scripts/wayland-test.sh node scripts/smoke-package.cjs release/linux-unpacked/studyroom
```

O script inicia um compositor Weston isolado e força `--ozone-platform=wayland`. Ele não altera a sessão gráfica do usuário. Esses testes não representam cobertura de todos os compositores ou drivers.

## Sandbox

O Electron continua com sandbox ativado. O perfil padrão do Docker pode impedir `unshare`/namespaces antes de o aplicativo abrir. Nesta máquina, um diagnóstico com usuário não root falhou no perfil padrão e passou com `--security-opt seccomp=unconfined` aplicado somente a um contêiner temporário sem volumes. Essa exceção enfraquece o isolamento do contêiner de teste, não deve ser usada indiscriminadamente nem aplicada à instalação do usuário. Não utilizar `--privileged` ou `--no-sandbox`.

Consulte VALIDATION.md para os resultados efetivamente observados. A existência destes comandos não significa que todos passaram.
