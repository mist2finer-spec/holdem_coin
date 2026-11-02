# Native client contracts

Run `dotnet run --project scripts/unity/contracts/Contracts.csproj` with .NET8 and NuGet access. These checks use real current RPG service snapshots plus independent wire/cache/socket/display cases. They do not substitute for Unity compilation or PlayMode.

Regenerate the fixtures from the current service:

```sh
POKER_TEST_MODE=1 node --import ./mini-services/poker-server/node_modules/tsx/dist/loader.mjs scripts/unity/export_contract_fixtures.ts
```

The fixture service is in memory. No saved user profile is read or written. This environment lacks .NET, so the C# harness was added and syntax-checked, but not executed.
