# Optimization TODO (EcoTrack backend)

- [ ] Update Prisma schema: add composite indexes for EmissionEntry hot query patterns.
- [x] Optimize emissions controller: `getMonthlyData` remove O(12*n) scan.

- [ ] Reduce DB round-trips / tighten `select` fields where safe (emissions + reports controllers).
- [x] Add TTL cache to auth middleware to avoid DB hit on every request.

- [ ] Run Prisma migration/generate.
- [ ] Run quick smoke tests for key endpoints.
- [ ] Document all changes + bottleneck reasoning in README.md.

