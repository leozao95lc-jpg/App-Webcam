# Integração com OBS Studio

Duas estratégias, nesta ordem. Nenhuma está implementada ainda.

1. **Browser Source (Fase 4, primeiro):** o OBS abre `http://127.0.0.1:8765/obs` como fonte de navegador. A página consome o mesmo fluxo que o preview do Desktop. Só loopback.
2. **Plugin nativo libobs (futuro, Fase 6 ou depois):** fonte "iCam Studio 4K" direto no OBS, sem navegador. Só será considerado depois que o Browser Source provar estabilidade.

Regra: o iPhone tem **uma** captura. OBS e preview consomem o mesmo fluxo distribuído pelo servidor.
