# Local security fork of braces 3.0.3

This private fork retains the upstream MIT license and implementation, with depth
limits in the parser and recursive compile, expand, and stringify walkers.
It addresses GHSA-vfj7-8cjw-p6xm without changing the Tailwind/webpack APIs.
Patterns and ASTs nested beyond 128 levels throw RangeError with ERR_BRACES_DEPTH.
Callers cannot disable the guard through options. Ordinary patterns keep the
upstream behavior; regression fixtures and project builds verify compatibility.

The package is vendored because upstream has no patched release as of 2026-10-06.
It is not an upstream release. npm audit does not assess the code of local forks:
the security regression tests are required evidence for this mitigation. Recheck
upstream advisories and remove the fork after a compatible patched release exists.
