# Auth failure exceptions

Login and refresh-token rejections collapse multiple internal causes into one fixed public message to prevent user enumeration, via `InvalidCredentialsException` and `InvalidRefreshTokenException` in `src/core/exception/auth.exception.ts`; each throw site constructs a fresh instance with an internal `reason` carried as `cause` and never serialized by `ErrorException`.

Considered Options: shared exception instance per method vs fresh `UnauthorizedException` per site with duplicated strings vs custom exception classes. Chose custom classes to fix the shared-instance stack-trace bug, centralize the two public messages once, and keep `ErrorException` as pure formatting with no logging change per Q3 decision.

Consequences: `instanceof UnauthorizedException` still holds so existing guards, tests, and Swagger 401 contracts are unchanged; no auth-failure logging is emitted.
