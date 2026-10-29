const { ReplicaFailoverService } =
  require('../../../../module/core-module/infra/prisma/replica-failover.service') as {
    ReplicaFailoverService: new (...args: never[]) => {
      useReplica(): boolean;
      onSuccess(): void;
      onFailure(): void;
      reset(): void;
    };
  };

describe('ReplicaFailoverService', () => {
  it('uses replica by default and recovers after success', () => {
    const service = new ReplicaFailoverService();
    expect(service.useReplica()).toBe(true);
    service.onFailure();
    service.onSuccess();
    expect(service.useReplica()).toBe(true);
  });

  it('opens circuit after threshold consecutive failures', () => {
    const config = { get: () => undefined };
    const service = new ReplicaFailoverService(config as never);

    service.onFailure();
    service.onFailure();
    expect(service.useReplica()).toBe(true);

    service.onFailure();
    expect(service.useReplica()).toBe(false);
  });

  it('closes circuit after cooldown', () => {
    const config = {
      get: (key: string) =>
        key === 'REPLICA_FAILOVER_THRESHOLD'
          ? 1
          : key === 'REPLICA_FAILOVER_COOLDOWN_MS'
            ? 50
            : undefined,
    };
    const service = new ReplicaFailoverService(config as never);

    service.onFailure();
    expect(service.useReplica()).toBe(false);

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(service.useReplica()).toBe(true);
        resolve();
      }, 60);
    });
  });
});
