namespace iCamStudio.Desktop.Preview;

/// <summary>
/// Renderiza o preview principal (Direct3D 11 / swap chain em controle WPF).
/// Recebe frames decodificados como qualquer outro sink. Implementação na Fase 3.
/// </summary>
public interface IPreviewRenderer : Video.IFrameSink
{
    /// <summary>Zona do preview mudou de tamanho; o renderer recria o swap chain.</summary>
    void Resize(int width, int height);
}
