using iCamStudio.Core.Telemetry;
using Xunit;

namespace iCamStudio.Core.Tests;

public class FpsMeterTests
{
    [Fact]
    public void Steady_30_fps_is_measured_as_30()
    {
        var meter = new FpsMeter();
        // 60 frames a 30 FPS (2 s). A janela é (now-1000, now], portanto medido no último frame
        // a janela contém exatamente 30 frames.
        const int frames = 60;
        for (var i = 0; i < frames; i++)
        {
            meter.RecordFrame(i * 1000 / 30);
        }

        var last = (frames - 1) * 1000 / 30;
        Assert.Equal(30.0, meter.GetFps(nowMs: last), precision: 1);
    }

    [Fact]
    public void Frames_older_than_window_are_discarded()
    {
        var meter = new FpsMeter(windowMs: 1000);
        meter.RecordFrame(0);
        meter.RecordFrame(500);

        Assert.Equal(1.0, meter.GetFps(nowMs: 1200)); // só o frame de 500 ms ainda está na janela
        Assert.Equal(0.0, meter.GetFps(nowMs: 5000));
    }

    [Fact]
    public void Invalid_window_is_rejected()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => new FpsMeter(0));
    }
}
