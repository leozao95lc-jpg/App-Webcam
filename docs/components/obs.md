# Componentes: OBS

Diretório `obs/`. Fase 0 contém apenas a estratégia. Nenhum código de integração foi escrito.

## Estágio 1 — Câmera virtual (Fase 4)

Objetivo: o OBS enxerga "iCam Studio 4K" como uma webcam, sem plugin no OBS.

Pesquisa obrigatória antes de codar (critério de saída listado em `docs/validation-checklist.md`):
1. Confirmar como o OBS atual enumera câmeras no Windows (Media Foundation e DirectShow) na versão instalada.
2. Testar uma câmera virtual mínima que entregue frames fixos. Só então ligar ao pipeline.
3. Verificar se é preciso assinatura de driver ou pacote com identidade para cada abordagem.

Estado: **não iniciado**.

## Estágio 2 — Plugin libobs em C/C++ (futuro)

Objetivo: fonte nativa do OBS, sem depender de câmera virtual do sistema.

Pré-requisitos:
- Build com CMake contra os headers da libobs da versão alvo do OBS.
- Compartilhar o fluxo decodificado com o processo do Desktop (IPC ou memória compartilhada). Essa é a parte difícil.
- Licença: o OBS é GPL-2.0; o plugin precisa ser compatível.

Estado: **não iniciado**. Diretório `obs/plugin-libobs/` existe com README apenas.

## Estrutura

```
obs/
├── README.md               este resumo
├── virtual-camera/         estágio 1 (vazio na Fase 0)
└── plugin-libobs/          estágio 2 (vazio na Fase 0)
```
