# Independent C# checks
Run `dotnet run --project scripts/unity/contracts/Contracts.csproj` with .NET 8.
These check polling event/ack parsing, sizing, BB rounding, hidden-card safety and best-five selection.
They do not compile UnityEngine or prove the Unity Editor/Android build works. Run Unity EditMode/PlayMode and target builds separately.
