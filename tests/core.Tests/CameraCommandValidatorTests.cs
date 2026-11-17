using iCamStudio.Core.Commands;
using Xunit;

namespace iCamStudio.Core.Tests;

public class CameraCommandValidatorTests
{
    [Fact]
    public void Zoom_within_lens_maximum_is_valid()
    {
        Assert.Null(CameraCommandValidator.Validate(new CameraCommand(CameraCommandKind.SetZoom, 2.0), maxZoomFactor: 10));
    }

    [Theory]
    [InlineData(0.5)]
    [InlineData(10.5)]
    public void Zoom_outside_range_is_rejected(double zoom)
    {
        Assert.NotNull(CameraCommandValidator.Validate(new CameraCommand(CameraCommandKind.SetZoom, zoom), maxZoomFactor: 10));
    }

    [Fact]
    public void Zoom_without_value_is_rejected()
    {
        Assert.NotNull(CameraCommandValidator.Validate(new CameraCommand(CameraCommandKind.SetZoom), maxZoomFactor: 10));
    }

    [Theory]
    [InlineData(-0.1)]
    [InlineData(1.1)]
    public void Focus_lens_position_must_be_unit_interval(double value)
    {
        Assert.NotNull(CameraCommandValidator.Validate(new CameraCommand(CameraCommandKind.SetFocusLensPosition, value), 10));
    }

    [Fact]
    public void Exposure_bias_bounds_are_enforced()
    {
        Assert.Null(CameraCommandValidator.Validate(new CameraCommand(CameraCommandKind.SetExposureBias, -8), 10));
        Assert.Null(CameraCommandValidator.Validate(new CameraCommand(CameraCommandKind.SetExposureBias, 8), 10));
        Assert.NotNull(CameraCommandValidator.Validate(new CameraCommand(CameraCommandKind.SetExposureBias, 8.01), 10));
    }

    [Fact]
    public void Automatic_commands_reject_a_value()
    {
        Assert.Null(CameraCommandValidator.Validate(new CameraCommand(CameraCommandKind.SetFocusAuto), 10));
        Assert.NotNull(CameraCommandValidator.Validate(new CameraCommand(CameraCommandKind.SetExposureAuto, 1.0), 10));
    }

    [Fact]
    public void Non_finite_value_is_rejected()
    {
        Assert.NotNull(CameraCommandValidator.Validate(new CameraCommand(CameraCommandKind.SetZoom, double.NaN), 10));
    }
}
