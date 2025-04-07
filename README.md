

```markdown
# ✅ dc-ts

> Domain-Centric TypeScript — a functional, event-driven approach to core domain logic in TypeScript.

---

## What is `dc-ts`?

**dc-ts** is a lightweight library and architecture style for implementing core domain logic using:

- 🧠 **Typed workflows** via `CoreWf`
- 🧪 **Type-safe validation** using [TypeBox](https://github.com/sinclairzx81/typebox)
- ♻️ **Pure business logic**, built around `constrain → decide → evolve`
- 🔍 Designed for event sourcing and collaborative modeling

---

## Architecture

```
📦 Core/
 ├─ domain.ts          # your types and workflows
 └─ _implementation/
     ├─ _schema.ts       # generated TypeBox schemas
     ├─ constructors.ts  # smart type-safe constructors
     ├─ constrain.ts     # constraint logic
     ├─ decide.ts        # decision logic (commands → events)
     ├─ evolve.ts        # state transitions (events → state)
     └─ tests/           # BDD-style tests
```

---

## 🧱 CoreWf

At the heart of dc-ts is the `CoreWf` type:

```ts
export type CoreWf<C, iA, E, oA, F> = {
  cmd: C                 // domain command
  inputAg: iA            // aggregate before
  outputAg: oA           // aggregate after
  aggregate: iA | oA
  evt: E                 // emitted event
  fails: F               // failure messages
  validateAggregate: SafeParse<iA | oA>
}
```

---

## 🧪 Example: ToDo Domain

```ts
export type CreateToDoWf = CoreWf<
  CMD<'create-todo', { title: string }>,
  AGG<'initial', { title?: string }>,
  EVT<'todo-created', { id: string; title: string }>,
  AGG<'created', { id: string; title: string; status: 'pending' }>,
  'title_required'
>
```

---

## ✅ Constrain

Used to **enforce business rules** before deciding.

```ts
export const constrainToDo: Constrain<CreateToDoWf['cmd'], CreateToDoWf['inputAg'], 'title_required'> =
  (cmd) => (state) => {
    if (!cmd.data.title?.trim()) {
      return fail('title_required')
    }
    return succeed(state)
  }
```

---

## 🧠 Decide

Takes a command and a validated state and returns event(s).

```ts
export const decideToDo = (cmd: CreateToDoWf['cmd']) => (state: CreateToDoWf['inputAg']) => {
  const evtRes = newToDoEVT<CreateToDoWf['evt']>()('todo-created')(dtFromMsg(cmd))({
    id: crypto.randomUUID(),
    title: cmd.data.title
  })
  return isFailure(evtRes) ? evtRes : succeed([evtRes.data])
}
```

---

## 🔁 Evolve

Transitions the aggregate to its next state.

```ts
export const evolveToDo = (evt: CreateToDoWf['evt']) => (state: CreateToDoWf['inputAg']): CreateToDoWf['outputAg'] => {
  return {
    _tag: 'created',
    data: {
      id: evt.data.id,
      title: evt.data.title,
      status: 'pending'
    }
  }
}
```

---

## 🧪 Validation

All inputs and state transitions are validated using **TypeBox**:

```ts
export const newToDoCMD = <C extends CreateToDoWf['cmd']>() =>
  newCmd<C['type'], C['data']>(safeParseTBox(ToDoCmdSchema))
```

---

## 🧪 BDD Testing

Tests can be generated and follow a Given/When/Then format:

```ts
Deno.test("Given a valid command, When constraints run, Then succeed", () => {
  const cmd = { ... }
  const state = { ... }
  const result = constrainToDo(cmd)(state)
  assertEquals(result.outcome, "success")
})
```

---

## 🎯 Design Principles

- 🔄 **One source of truth**: models power code, tests, and docs
- 🧩 **Composable and side-effect free**: logic stays pure and testable
- 🛠 **Schema-driven development**: everything is validated at runtime
- 🧠 **Business-first modeling**: workflows match EventStorming patterns

---

## 🧩 Works Best With

- [TypeBox](https://github.com/sinclairzx81/typebox)
- [dcts CLI](https://jsr.io/@your-org/dcts): scaffolding, schema generation, test generation, business docs

---

## 📘 Need business documentation?

Use the `dcts` CLI to generate:

- ✅ Business summaries
- 🔁 Decision tables
- 🧪 BDD-style test templates
- 📬 AsyncAPI specs

---

## 📝 License

MIT — Giovanni & Contributors
```

---
