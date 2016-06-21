This tiny library is using Proxy objects to build a 2-way data binding library
with the current HTML5/ES6 specs.

It uses `<template>` elements as well when needed.

Not all browsers currently support Proxy, or `<template>`, or other cutting
edge features this library may be using, and it's only tested in Chrome.

## Licenses

Be Awesome Public Licence
http://b.leppoc.net/pages/bapl.html

And Apache v2.0 License
http://www.apache.org/licenses/LICENSE-2.0.html

## Documentation

See test.html. It should be pretty simple.

One thing to note: in the current version, `<template>` elements when used for
arrays can only have a single inner node.
