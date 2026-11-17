namespace iCamStudio.Core.Devices;

/// <summary>Identificação de um dispositivo iOS enviada no hello.</summary>
/// <param name="DeviceId">Identificador estável do aparelho (ex.: identifierForVendor), nunca dado pessoal.</param>
/// <param name="Name">Nome exibido ao usuário (ex.: "iPhone de Leonardo"). Pode ser editado pelo usuário no iOS.</param>
/// <param name="Model">Identificador de modelo (ex.: "iPhone18,1") ou nome comercial, conforme a fonte.</param>
/// <param name="OsVersion">Versão do iOS.</param>
/// <param name="AppVersion">Versão do iCam Studio Mobile.</param>
public sealed record DeviceInformation(
    string DeviceId,
    string Name,
    string Model,
    string OsVersion,
    string AppVersion);
