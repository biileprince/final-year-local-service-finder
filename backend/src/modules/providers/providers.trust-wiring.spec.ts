import { ProvidersService } from "./providers.service";

/**
 * Wiring tests for the trust-score recompute path (Section 4.6.4).
 * Verifies that the service recomputes the composite score and invalidates the
 * cached profile on the events that change its inputs — without touching a
 * real database (the repository and cache are mocked).
 */
describe("ProvidersService trust-score wiring", () => {
  const makeService = () => {
    const repo = {
      updateRating: jest.fn().mockResolvedValue(undefined),
      recomputeTrustScore: jest.fn().mockResolvedValue({ id: "p1", trustScore: 91.2 }),
    };
    const cache = {
      invalidateProviderProfile: jest.fn().mockResolvedValue(undefined),
    };
    const metrics = {};
    const prisma = {};
    const service = new ProvidersService(
      repo as never,
      cache as never,
      metrics as never,
      prisma as never,
    );
    return { service, repo, cache };
  };

  it("recomputes the trust score and invalidates cache when a rating changes", async () => {
    const { service, repo, cache } = makeService();
    await service.updateRating("p1");
    expect(repo.updateRating).toHaveBeenCalledWith("p1");
    expect(repo.recomputeTrustScore).toHaveBeenCalledWith("p1");
    expect(cache.invalidateProviderProfile).toHaveBeenCalledWith("p1");
  });

  it("recomputes the trust score on demand (booking lifecycle events)", async () => {
    const { service, repo, cache } = makeService();
    const result = await service.recomputeTrustScore("p1");
    expect(repo.recomputeTrustScore).toHaveBeenCalledWith("p1");
    expect(cache.invalidateProviderProfile).toHaveBeenCalledWith("p1");
    expect(result).toEqual({ id: "p1", trustScore: 91.2 });
  });
});
