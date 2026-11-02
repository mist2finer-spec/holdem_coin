#!/usr/bin/env python3
"""Compile and run the actual pure C# trial model without Unity or NuGet network access.

The SDK-shipped Newtonsoft.Json assembly is used only by this offline test runner.
Normal `dotnet run --project BossTrialChecks.csproj` uses its pinned package reference.
"""
import argparse
import json
import pathlib
import shutil
import subprocess
import tempfile


def version(path):
    return tuple(int(part) for part in path.name.split("-")[0].split("."))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dotnet-root", type=pathlib.Path)
    args = parser.parse_args()
    executable = shutil.which("dotnet")
    root = args.dotnet_root or (pathlib.Path(executable).resolve().parent if executable else None)
    if root is None:
        raise SystemExit(".NET 8 SDK required; pass --dotnet-root PATH")
    dotnet = root / ("dotnet.exe" if (root / "dotnet.exe").exists() else "dotnet")
    sdk = max((root / "sdk").glob("8.*"), key=version)
    refs = max((root / "packs/Microsoft.NETCore.App.Ref").glob("8.*"), key=version) / "ref/net8.0"
    runtime = max((root / "shared/Microsoft.NETCore.App").glob("8.*"), key=version)
    repo = pathlib.Path(__file__).resolve().parents[3]
    model = repo / "unity/IslandGame/Assets/Island/Runtime/BossTrials/BossTrialModel.cs"
    catalog = repo / "unity/IslandGame/Assets/Island/Resources/BossTrials/bosses.json"
    program = pathlib.Path(__file__).with_name("Program.cs")
    with tempfile.TemporaryDirectory(prefix="boss-trial-checks-") as directory:
        output = pathlib.Path(directory)
        assembly = output / "BossTrialChecks.dll"
        quote = lambda path: '"' + str(path) + '"'
        lines = ["-nostdlib+", "-target:exe", "-langversion:latest", "-out:" + quote(assembly)]
        lines += ["-r:" + quote(path) for path in sorted(refs.glob("*.dll"))]
        lines += ["-r:" + quote(sdk / "Newtonsoft.Json.dll"), quote(model), quote(program)]
        response = output / "compile.rsp"
        response.write_text("\n".join(lines), encoding="utf-8")
        subprocess.run([str(dotnet), "exec", str(sdk / "Roslyn/bincore/csc.dll"), "-noconfig", "@" + str(response)], check=True)
        shutil.copy2(sdk / "Newtonsoft.Json.dll", output / "Newtonsoft.Json.dll")
        shutil.copy2(catalog, output / "bosses.json")
        (output / "BossTrialChecks.runtimeconfig.json").write_text(json.dumps({"runtimeOptions": {"tfm": "net8.0", "framework": {"name": "Microsoft.NETCore.App", "version": runtime.name}}}))
        subprocess.run([str(dotnet), str(assembly)], check=True)


if __name__ == "__main__":
    main()
