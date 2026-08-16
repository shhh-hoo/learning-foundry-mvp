# Third-party notices

Learning Foundry MVP intentionally builds on mature open-source UI/runtime primitives rather than reimplementing them.

## assistant-ui

Repository: `assistant-ui/assistant-ui`  
Package: `@assistant-ui/react`  
License: MIT

Used for the learner conversation runtime and chat primitives (`AssistantRuntimeProvider`, external-store runtime, Thread / Message / Composer primitives). Foundry keeps canonical conversation state in its own Product State and adapts it into assistant-ui.

## shadcn/ui

Repository: `shadcn-ui/ui`  
License: MIT

The local files under `client/src/components/ui/` are small JavaScript adaptations of shadcn/ui's open-code Radix-based component patterns. They are deliberately kept in this repository so the product owns and can modify its UI primitives.

MIT License

Copyright (c) 2023 shadcn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## TanStack Query

Repository: `TanStack/query`  
Package: `@tanstack/react-query`  
License: MIT

Used for learner/teacher server state, mutations and query invalidation. Product State remains server-owned.

## Supporting open-source dependencies

- React / React DOM — MIT
- Vite / `@vitejs/plugin-react` — MIT
- Tailwind CSS / `@tailwindcss/vite` — MIT
- Radix UI (`radix-ui`) — MIT
- class-variance-authority — Apache-2.0
- clsx — MIT
- tailwind-merge — MIT
- lucide-react — ISC

Package versions are pinned in `package.json`.