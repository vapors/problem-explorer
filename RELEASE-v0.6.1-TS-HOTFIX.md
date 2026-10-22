# v0.6.1 TypeScript build hotfix

Fixed `apps/web/src/main.tsx` `post` helper to accept a generic response type, resolving TS2558 errors on four calls and the derived TS7006 implicit-any error in `.map(x => ...)`.

Old:
```ts
const post=(url:string,body?:unknown)=>api(url,{method:'POST',body:JSON.stringify(body??{})});
```
New:
```ts
const post=<T=any,>(url:string,body?:unknown):Promise<T>=>api<T>(url,{method:'POST',body:JSON.stringify(body??{})});
```

Frontend build was **not independently verified** because installing dependencies was unavailable in this environment. On Windows run `cd apps\web`, `npm ci`, `npm run build`. No Neo4j migration or API change.
