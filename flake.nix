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

        backendNodejsPackage = nodejs_pkgs.buildNpmPackage {
          pname = "ha-tracker-backend-deps";
          version = "0.1.0";
          src = ./backend;
          npmDepsHash = "sha256-pb2JuWstmVGT/yQTHd5V569qviNeRxuGOKu8r1felIg="; # Updated with actual hash
          dontNpmBuild = true;
          dontPatchShebangs = true;
          prePatch = ''
            # Disable patchShebangs function to keep #!/usr/bin/env node
            patchShebangs() { :; }
          '';
        };
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = [
            nodejs_pkgs.nodejs_20
            nodejs_pkgs.nodePackages.npm
            nodejs_pkgs.nodePackages.yarn
            pkgs.git
            backendNodejsPackage
          ];
          shellHook = ''
            echo "Entering development shell for HA Device Tracker"
            echo "Node.js (v20) and npm/yarn are available."
            echo "Run 'cd frontend && npm install' if needed to install frontend dependencies"
            echo "Run 'cd frontend && npm run dev' to start the frontend development server"
            export NODE_PATH="${backendNodejsPackage}/lib/node_modules:$NODE_PATH"
          '';
        };

        apps.backend = {
          type = "app";
          program = "${pkgs.writeScript "run-backend" ''
            #!${pkgs.bash}/bin/bash
            export PORT="''${BACKEND_PORT:-3001}"
            export NODE_PATH="${backendNodejsPackage}/lib/node_modules:$NODE_PATH"
            exec ${nodejs_pkgs.nodejs_20}/bin/node ${./backend}/server.js
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
            # Copy .env from root if it exists
            if [ -f .env ]; then
              cp .env "$TEMP_WORKSPACE/"
            elif [ -f ../.env ]; then
              cp ../.env "$TEMP_WORKSPACE/"
            fi
            cd "$TEMP_WORKSPACE"
            chmod -R u+w .

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
            export PORT="''${BACKEND_PORT:-3001}"
            export NODE_PATH="${backendNodejsPackage}/lib/node_modules:$NODE_PATH"

            # Run backend (it will look for .env in current directory, which is root)
            ${nodejs_pkgs.nodejs_20}/bin/node ${./backend}/server.js &
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
            # Copy .env from root if it exists
            if [ -f .env ]; then
              cp .env "$TEMP_WORKSPACE/"
            elif [ -f ../.env ]; then
              cp ../.env "$TEMP_WORKSPACE/"
            fi
            cd "$TEMP_WORKSPACE"
            chmod -R u+w .

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
