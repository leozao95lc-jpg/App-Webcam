using iCamStudio.Core.Resilience;
using Xunit;

namespace iCamStudio.Core.Tests;

public class ReconnectPolicyTests
{
    [Fact]
    public void Default_policy_follows_documented_backoff()
    {
        var policy = ReconnectPolicy.Default;

        Assert.Equal(TimeSpan.FromMilliseconds(500), policy.GetDelay(1));
        Assert.Equal(TimeSpan.FromSeconds(1), policy.GetDelay(2));
        Assert.Equal(TimeSpan.FromSeconds(2), policy.GetDelay(3));
        Assert.Equal(TimeSpan.FromSeconds(4), policy.GetDelay(4));
        Assert.Equal(TimeSpan.FromSeconds(8), policy.GetDelay(5));
    }

    [Fact]
    public void Delay_is_capped_at_max_delay()
    {
        Assert.Equal(TimeSpan.FromSeconds(10), ReconnectPolicy.Default.GetDelay(6));
        Assert.Equal(TimeSpan.FromSeconds(10), ReconnectPolicy.Default.GetDelay(10_000));
    }

    [Fact]
    public void Unlimited_policy_never_returns_null()
    {
        Assert.NotNull(ReconnectPolicy.Default.GetDelay(int.MaxValue));
    }

    [Fact]
    public void Attempts_beyond_limit_return_null()
    {
        var policy = new ReconnectPolicy(TimeSpan.FromMilliseconds(100), 2, TimeSpan.FromSeconds(1), maxAttempts: 3);

        Assert.NotNull(policy.GetDelay(3));
        Assert.Null(policy.GetDelay(4));
    }

    [Fact]
    public void Attempt_zero_is_rejected()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => ReconnectPolicy.Default.GetDelay(0));
    }

    [Fact]
    public void Multiplier_below_one_is_rejected()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new ReconnectPolicy(TimeSpan.FromSeconds(1), 0.5, TimeSpan.FromSeconds(10)));
    }
}
