using iCamStudio.Core.Devices;
using iCamStudio.Core.Protocol;
using iCamStudio.Core.Transport;
using iCamStudio.Core.Video;
using Xunit;

namespace iCamStudio.Core.Tests;

/// <summary>
/// Teste de contrato de IVideoTransport com um transporte falso em memória.
/// Serve para provar que o restante do sistema depende só da interface, não do meio físico.
/// Não simula câmera nem vídeo: apenas verifica que eventos e estado são repassados.
/// </summary>
public class VideoPipelineContractTests
{
    private sealed class InMemoryTransport : IVideoTransport
    {
        public TransportKind Kind => TransportKind.WifiTcp;
        public ConnectionStatus Status { get; private set; } = ConnectionStatus.Disconnected;
        public event Action<ConnectionStatus>? StatusChanged;
        public event Action<ProtocolEnvelope>? ControlReceived;
        public event Action<VideoFrame>? VideoFrameReceived;
        public List<ProtocolEnvelope> Sent { get; } = [];

        public Task ConnectAsync(DeviceEndpoint endpoint, CancellationToken cancellationToken)
        {
            SetStatus(ConnectionStatus.Connected);
            return Task.CompletedTask;
        }

        public Task DisconnectAsync(CancellationToken cancellationToken)
        {
            SetStatus(ConnectionStatus.Disconnected);
            return Task.CompletedTask;
        }

        public Task SendControlAsync(ProtocolEnvelope envelope, CancellationToken cancellationToken)
        {
            Sent.Add(envelope);
            return Task.CompletedTask;
        }

        public void Emit(ProtocolEnvelope envelope) => ControlReceived?.Invoke(envelope);
        public void EmitFrame(VideoFrame frame) => VideoFrameReceived?.Invoke(frame);

        private void SetStatus(ConnectionStatus status)
        {
            Status = status;
            StatusChanged?.Invoke(status);
        }

        public ValueTask DisposeAsync() => ValueTask.CompletedTask;
    }

    [Fact]
    public async Task Status_changes_are_published_in_order()
    {
        await using var transport = new InMemoryTransport();
        var seen = new List<ConnectionStatus>();
        transport.StatusChanged += seen.Add;

        await transport.ConnectAsync(new DeviceEndpoint(TransportKind.WifiTcp, "192.168.0.10", ProtocolConstants.DefaultControlPort), CancellationToken.None);
        await transport.DisconnectAsync(CancellationToken.None);

        Assert.Equal([ConnectionStatus.Connected, ConnectionStatus.Disconnected], seen);
    }

    [Fact]
    public void Control_and_video_events_reach_subscribers_unchanged()
    {
        var transport = new InMemoryTransport();
        ProtocolEnvelope? control = null;
        VideoFrame? frame = null;
        transport.ControlReceived += e => control = e;
        transport.VideoFrameReceived += f => frame = f;

        var envelope = ProtocolCodec.CreateEnvelope(MessageTypes.Ping, new EmptyPayload(), 7);
        transport.Emit(envelope);
        transport.EmitFrame(new VideoFrame(VideoCodec.H264, true, 1920, 1080, 33_000, new byte[] { 1, 2, 3 }));

        Assert.Equal(envelope.Id, control!.Id);
        Assert.Equal(1920, frame!.Width);
        Assert.Equal(3, frame.Payload.Length);
    }

    [Fact]
    public async Task Sent_control_messages_are_handed_to_the_transport()
    {
        await using var transport = new InMemoryTransport();
        var envelope = ProtocolCodec.CreateEnvelope(MessageTypes.StreamState, new StreamStatePayload(true), 1);

        await transport.SendControlAsync(envelope, CancellationToken.None);

        Assert.Same(envelope, Assert.Single(transport.Sent));
    }
}
