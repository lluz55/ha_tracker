{
  description = "HA Device Tracker with Nix Flakes (Go Backend)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};

        backend = pkgs.buildGoModule {
          pname = "ha-tracker-backend";
          version = "0.2.0";
          src = ./backend;
          vendorHash = "sha256-wZGx1uFRkwawxIKWS6/zemLkH0D2+9DdkkyF89IMxRA=";
          proxyVendor = true;
          subPackages = [ "." ];
        };
      in
      {
        packages.default = backend;

        devShells.default = pkgs.mkShell {
          buildInputs = [
            pkgs.go
            pkgs.nodejs_20
            pkgs.git
          ];
          shellHook = ''
            echo "Entering development shell (Go + Node.js)"
          '';
        };

        apps.backend = {
          type = "app";
          program = "${backend}/bin/ha-tracker";
        };
      }
    );
}
