namespace iCamStudio.Desktop.Video;

/// <summary>Consumidor de frames decodificados (preview, câmera virtual, gravação futura).</summary>
public interface IFrameSink
{
    /// <summary>
    /// Chamado sincronamente, na ordem de registro. Não guarde o frame após o retorno
    /// sem AddRef. O pipeline libera a superfície depois que todos os sinks retornaram.
    /// </summary>
    void OnFrame(DecodedFrame frame);
}

/// <summary>
/// Fan-out de um único fluxo decodificado para N consumidores. Garante que o iPhone
/// tenha uma só sessão de captura e que o frame seja decodificado uma única vez.
/// Implementação na Fase 3.
/// </summary>
public interface IVideoPipeline
{
    void AddSink(IFrameSink sink);

    void RemoveSink(IFrameSink sink);

    /// <summary>Entrega um frame codificado ao decodificador. Chamado pelo VideoReceiver.</summary>
    void Push(iCamStudio.Core.Video.VideoFrame frame);
}
