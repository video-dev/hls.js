#!/usr/bin/env python

import os
from setuptools import setup
from distutils.util import get_platform

from getdlls import getDLLs


# Get the necessary SDL2 DLLs for the platform

override = os.getenv('SDL2DLL_PLATFORM')
platform = get_platform() if not override else override
getDLLs(platform)


# Gather list of all dll files so that they can be included in wheels, but not sdist

dllpath = os.path.join('sdl2dll', 'dll')
dllfiles = []
for path, _, files in os.walk(dllpath):
    for f in files:
        parentdir = 'sdl2dll' + os.sep
        filepath = os.path.join(path, f).replace(parentdir, '')
        dllfiles.append(filepath)


# Patch wheel naming to be platform-specific but Python version/ABI independent

cmdclass = {}

try:
    from wheel.bdist_wheel import bdist_wheel

    class bdist_wheel_half_pure(bdist_wheel):

        def get_tag(self):
            if 'macosx' in platform:
                system = 'macosx_10_6_x86_64'
            elif platform in ['win32', 'win-amd64']:
                system = platform.replace('-', '_')
            else:
                system = 'any'
            return 'py2.py3', 'none', system

    cmdclass['bdist_wheel'] = bdist_wheel_half_pure

except ImportError:
    pass


# Install the package

with open('README.md', 'r') as f:
    long_description = f.read()

setup(
	name='pysdl2-dll',
	version='2.0.10',
	author='Austin Hurst',
	author_email='mynameisaustinhurst@gmail.com',
    license='Mozilla Public License Version 2.0',
    description='Pre-built SDL2 binaries for PySDL2',
    long_description=long_description,
    long_description_content_type='text/markdown',
    url='https://github.com/a-hurst/pysdl2-dll',
	packages=['sdl2dll'],
	cmdclass=cmdclass,
    package_data={'sdl2dll': dllfiles},
	include_package_data=True,
	install_requires=[],
    classifiers=[
        'Development Status :: 4 - Beta',
        'License :: OSI Approved :: Mozilla Public License 2.0 (MPL 2.0)',
        'Operating System :: MacOS',
        'Operating System :: Microsoft :: Windows',
        'Programming Language :: Python',
        'Programming Language :: Python :: 2.7',
        'Programming Language :: Python :: 3',
        'Topic :: Software Development :: Libraries'
    ]
)
