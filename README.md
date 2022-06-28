# pysdl2-dll

[![Build Status](https://travis-ci.org/a-hurst/pysdl2-dll.svg?branch=master)](https://travis-ci.org/a-hurst/pysdl2-dll)
[![Build Status](https://ci.appveyor.com/api/projects/status/lnwpe9v50bne3afu?svg=true)](https://ci.appveyor.com/project/a-hurst/pysdl2-dll)

pysdl2-dll is a Python package that bundles the SDL2 binaries in pip-installable form for macOS and Windows, making it easier to create and run scripts/packages that use the [PySDL2](https://github.com/marcusva/py-sdl2) library.

It uses the official SDL2, SDL2\_mixer, SDL2\_ttf, and SDL2\_image binaries for macOS and Windows, as well as [unofficial SDL2\_gfx binaries](https://github.com/a-hurst/sdl2gfx-builds) for the same platforms.

The latest release includes the following versions of the SDL2 binaries:

SDL2 | SDL2\_ttf | SDL2\_mixer | SDL2\_image | SDL2_gfx
--- | --- | --- | --- | ---
2.0.10 | 2.0.15 | 2.0.4 | 2.0.5 | 1.0.4


## Installation

You can install the latest version of pysdl2-dll via pip:

```bash
pip install pysdl2-dll # install latest release version
```


## Requirements

At present, the following platforms are supported:

* macOS (10.6+, 64-bit)
* Windows 32-bit
* Windows 64-bit

Linux is not currently supported as no official binaries are available, though support may be added in future with a manylinux build system (pull requests welcome). The pysdl2-dll package can be *installed* on Linux and other unsupported platforms without issue, but it won't have any effect.

pysdl2-dll requires PySDL2 0.9.7 or later in order to work correctly on macOS, and for PySDL2 to load the binaries automatically when available. To update to the latest PySDL2, you can run:

```bash
pip install -U pysdl2
```

## Usage

If you are using PySDL2 0.9.7 or later, you don't need to do anything special to use the pysdl2-dll binaries in your project: PySDL2 will load them automatically (and print a message indicating such) if they are available. For older versions of PySDL2, you will need to import this module manually in your scripts (`import sdl2dll`) before PySDL2 is imported.

To override pysdl2-dll and use a different set of binaries, you can set the `PYSDL2_DLL_PATH` environment variable to the path of the folder containing the binaries you want to use instead, or alternatively set it to "system" to force PySDL2 to use the system install of SDL2 if available (e.g. SDL2 installed with `brew` on macOS).

