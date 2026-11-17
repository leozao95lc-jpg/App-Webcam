namespace iCamStudio.Core.Protocol;

/// <summary>Valores do campo "type" do envelope. Strings estáveis: são o contrato no fio.</summary>
public static class MessageTypes
{
    public const string Hello = "hello";                 // iPhone -> Desktop
    public const string HelloAck = "hello_ack";          // Desktop -> iPhone
    public const string PairRequest = "pair_request";    // Desktop -> iPhone
    public const string PairResponse = "pair_response";  // iPhone -> Desktop
    public const string PairConfirm = "pair_confirm";    // ambos (após comparar código SAS)
    public const string Capabilities = "capabilities";   // iPhone -> Desktop
    public const string StreamConfigure = "stream_configure"; // Desktop -> iPhone
    public const string StreamState = "stream_state";    // Desktop -> iPhone (start/stop)
    public const string Command = "command";             // Desktop -> iPhone
    public const string Telemetry = "telemetry";         // iPhone -> Desktop (1 Hz)
    public const string Error = "error";                 // ambos
    public const string Ping = "ping";                   // ambos
    public const string Pong = "pong";                   // ambos
}
