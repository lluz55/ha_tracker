{
  description = "HA Device Tracker with Nix Flakes";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    nodejs.follows = "nixpkgs";
  };

  outputs = { self, nixpkgs, flake-utils, nodejs, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        nodejs_pkgs = nodejs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = [
            nodejs_pkgs.nodejs_20
            nodejs_pkgs.nodePackages.npm
            nodejs_pkgs.nodePackages.yarn
            pkgs.git
          ];
          shellHook = ''
            echo "Entering development shell for HA Device Tracker"
            echo "Node.js (v20) and npm/yarn are available."
            echo "Run 'cd frontend && npm install' if needed to install frontend dependencies"
            echo "Run 'cd frontend && npm run dev' to start the frontend development server"
          '';
        };

        apps.backend = {
          type = "app";
          program = "${pkgs.writeScript "run-backend" ''
            #!${pkgs.bash}/bin/bash
            export HA_URL="''${HA_URL:-}"
            export HA_TOKEN="''${HA_TOKEN:-}"
            export HA_DEVICE_ID="''${HA_DEVICE_ID:-}"
            export PORT="''${BACKEND_PORT:-3001}"
            cd ${./backend}
            exec ${nodejs_pkgs.nodejs_20}/bin/node server.js
          ''}";
        };

        apps.frontend = {
          type = "app";
          program = "${pkgs.writeScript "run-frontend" ''
            #!${pkgs.bash}/bin/bash
            export BACKEND_PORT="''${BACKEND_PORT:-3001}"
            # Create a temporary workspace for vite's runtime needs
            TEMP_WORKSPACE=$(mktemp -d)
            cleanup() {
                rm -rf "$TEMP_WORKSPACE"
            }
            trap cleanup EXIT

            # Copy frontend to temp workspace
            cp -r ${./frontend}/. "$TEMP_WORKSPACE/"
            cd "$TEMP_WORKSPACE"

            # Install dependencies to make sure vite and other dev dependencies are available
            ${nodejs_pkgs.nodejs_20}/bin/npm install

            # Run the development server from the writable temp directory
            exec ${nodejs_pkgs.nodejs_20}/bin/npx vite --host --port "''${FRONTEND_PORT:-5000}"
          ''}";
        };

        apps.fullstack = {
          type = "app";
          program = "${pkgs.writeScript "run-fullstack" ''
            #!${pkgs.bash}/bin/bash
            # Start backend in background
            echo "Starting backend..."
            export HA_URL="''${HA_URL:-}"
            export HA_TOKEN="''${HA_TOKEN:-}"
            export HA_DEVICE_ID="''${HA_DEVICE_ID:-}"
            export PORT="''${BACKEND_PORT:-3001}"
            cd ${./backend}
            exec ${nodejs_pkgs.nodejs_20}/bin/node server.js &
            BACKEND_PID=$!

            # Give backend a moment to start
            sleep 2

            # Start frontend in background using temp workspace to fix read-only file system issues
            # Pass the BACKEND_PORT to the frontend
            export BACKEND_PORT="''${BACKEND_PORT:-3001}"

            # Create a temporary workspace for vite's runtime needs
            TEMP_WORKSPACE=$(mktemp -d)
            cleanup() {
                rm -rf "$TEMP_WORKSPACE"
                kill $BACKEND_PID 2>/dev/null
            }
            trap cleanup EXIT

            # Copy frontend to temp workspace
            cp -r ${./frontend}/. "$TEMP_WORKSPACE/"
            cd "$TEMP_WORKSPACE"

            # Install dependencies to make sure vite and other dev dependencies are available
            ${nodejs_pkgs.nodejs_20}/bin/npm install

            echo "Starting frontend..."
            exec ${nodejs_pkgs.nodejs_20}/bin/npx vite --host --port "''${FRONTEND_PORT:-5000}" &
            FRONTEND_PID=$!

            # Function to cleanup on exit
            cleanup_on_exit() {
              echo "Stopping processes..."
              kill $FRONTEND_PID $BACKEND_PID 2>/dev/null
            }

            # Set trap to cleanup on script exit
            trap cleanup_on_exit EXIT

            # Wait for both processes
            wait $BACKEND_PID $FRONTEND_PID
          ''}";
        };
      }
    );
}
