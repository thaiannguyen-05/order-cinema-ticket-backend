# Co-located type modules

Inline `type/interface` declarations are extracted to co-located `type/type.ts` (auth-shaped: `<feature>/type/type.ts`); `constant.ts` holds only consts, `dto/` and `repository/` stay untouched. Shared RMQ/bootstrap types (`RmqAckChannel`, `AmqpConnectionLike`) live once in `src/core/type/type.ts` instead of duplicated per consumer.

Considered Options: per-file `type.ts` vs `<feature>/type/type.ts` folder; per-consumer duplicate `RmqAckChannel` vs single shared type. Chose folder form to match `auth/type/type.ts` precedent and shared RMQ type to remove duplication across `email` + `sync-data` consumers.
