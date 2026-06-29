---
"@riconext/hermes-repo": patch
---

修复 ESM 打包产物中 `flush` 触发动态 require 导致 `Dynamic require of "fs" is not supported` 的问题。
