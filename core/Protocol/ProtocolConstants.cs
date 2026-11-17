namespace iCamStudio.Core.Protocol;

/// <summary>Constantes do protocolo iCam Studio v1. Ver docs/protocol.md.</summary>
public static class ProtocolConstants
{
    /// <summary>Versão atual do protocolo de controle.</summary>
    public const int Version = 1;

    /// <summary>Versões que este build aceita na negociação (hello / hello_ack).</summary>
    public static readonly int[] SupportedVersions = [Version];

    /// <summary>Tipo de serviço DNS-SD (Bonjour) usado para descoberta na rede local.</summary>
    public const string ServiceType = "_icamstudio._tcp";

    /// <summary>Porta de controle padrão. Provisória: validar na Fase 2.</summary>
    public const int DefaultControlPort = 47800;

    /// <summary>Tamanho máximo de um frame JSON de controle (exclui o prefixo de 4 bytes).</summary>
    public const int MaxMessageBytes = 64 * 1024;

    /// <summary>Tamanho máximo de um payload de vídeo (uma unidade de acesso codificada).</summary>
    public const int MaxVideoPayloadBytes = 8 * 1024 * 1024;

    /// <summary>Bytes do prefixo de tamanho big-endian de cada frame de controle.</summary>
    public const int FrameLengthPrefixBytes = 4;
}
