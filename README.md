# dc-ts (Domain-Centric TypeScript)

**dc-ts** is a functional-oriented library designed to help developers build event-driven domain layers in TypeScript. It provides a structured approach to implementing domain logic, handling commands, emitting events, and managing state transitions in a type-safe and functional manner.

---

## Architectural Principles

The domain layer is composed of different inner layers, each handling specific concerns:

- **Core**: Implements the business logic without side effects. It contains type definitions for commands, events, state, and entities, and implements workflows and policies as pure functions.
- **Shell**: Acts as a mediator between the application and domain layers, handling asynchronous code and side effects.
- **Views**: Builds materialized views by listening to emitted events and makes them available through a query API.

---

## Result Type

A fundamental aspect of functional programming is the **Result type**, which represents either a success or a failure. This allows you to maintain control over function outputs and chain functions together. In **dc-ts**, the result type is defined as follows:

```typescript
// For synchronous functions:
export type Result<S, F extends string> = Success<S> | Failure<F>

// For asynchronous functions:
export type AsyncResult<S, F extends string> = Promise<Result<S, F>>

// Where:
export type Success<S> = { outcome: 'success', data: S }
export type Failure<F extends string> = { outcome: 'failure', cause: Cause<F>[] }
export type Cause<F extends string> = { msg: F, data?: any }
```

You can use the **succeed** or **fail** utility functions to return a success or failure. For example:

```typescript
import { Result, succeed, fail } from 'dc-ts'

type Divide = 
  (num: number) => 
    (den: number) => 
      Result<number, 'cannot_divide_by_zero'>

const divideBy: Divide = 
  (num: number) => 
    (den: number) => {
      if (den === 0) {
        return fail('cannot_divide_by_zero')
      }
      return succeed(num / den)
    }
```

You can handle the result using the **isFailure** and **isSuccess** utilities:

```typescript
import { isFailure } from 'dc-ts'

const divideRes = divideBy(6)(2)
if (isFailure(divideRes)) {
  return divideRes // { outcome: 'failure', cause: { msg: 'cannot_divide_by_zero' } }
}
// { outcome: 'success', data: 3 }
return succeed(divideRes.data + 1)
```

---

## Parsing

In functional programming, **parsing** is used to validate input data before processing it. **dc-ts** provides a prebuilt `SafeParse` function signature:

```typescript
export type SafeParse<T> = (data: T) => Result<T, 'parse_error'>
```

Since TypeScript types are not available at runtime, you can use libraries like **Zod** or **TypeBox** for runtime validation. **dc-ts** includes a prebuilt implementation of `SafeParse` using **TypeBox**:

```typescript
import { safeParseTBox, Result } from 'dc-ts'
import { ToDoSchema } from './schema'

const parseToDo = safeParseTBox(ToDoSchema)

const parseRes: Result<ToDo, 'parse_error'> = parseToDo(
  { desc: 'Write readme file for dc-ts', status: 'in-progress' }
)
```

---

## Messages

Messages in **dc-ts** are categorized into **Commands** and **Events**. Commands represent actions to be performed, while Events represent state changes that have occurred.

### Commands

To define a command, use the **CMD** type:

```typescript
import { CMD } from 'dc-ts'

type MoveToDoneData = { toDoId: string }
export type MoveToDoneCmd = CMD<'move-to-done', MoveToDoneData>
```

This produces the following type:

```typescript
type MoveToDoneCmd = {
  id: string
  msgType: 'cmd'
  type: 'move-to-done'
  correlationid: string
  causationid: string
  timestamp: number
  data: {
    toDoId: string
  }
}
```

### Events

To define an event, use the **EVT** type:

```typescript
import { EVT } from 'dc-ts'

type ToDoDoneData = { toDoId: string, status: 'done' }
export type ToDoDoneEvt = EVT<'to-do-done', ToDoDoneData>
```

This produces the following type:

```typescript
type ToDoDoneEvt = {
  id: string
  msgType: 'evt'
  type: 'to-do-done'
  correlationid: string
  causationid: string
  timestamp: number
  data: {
    toDoId: string
    status: 'done'
  }
}
```

---

## Smart Constructors

It’s a good practice to aggregate all commands and events in your module into union types. This allows you to define **smart constructors** that guide you in creating valid commands and events:

```typescript
import { newCmd, newEvt, safeParseTBox } from 'dc-ts'
import { ToDoCmd, ToDoEvt } from './schema'

export const newToDoCMD = <C extends ToDoCmd>() => {
  return newCmd<C['type'], C['data']>(safeParseTBox(ToDoCmd))
}

export const newToDoEVT = <E extends ToDoEvt>() => {
  return newEvt<E['type'], E['data']>(safeParseTBox(ToDoEvt))
}
```

These constructors ensure type safety and data validation:

```typescript
const cmdRes = newToDoCMD<MoveToDoneCmd>()
  ('move-to-done') // Autocompletes to the right command type
  ({ toDoId: 'abc' }) // Suggests the correct data structure
  ({ correlationid: 'abc', causationid: 'efg' }) // Requires a domain trace

// cmdRes will be a Result<MoveToDoneCmd, 'parse_error'>
```

---

## Domain Trace

Each message includes a **domain trace** to enable tracing the chain of commands and events. You can use the **dtFromMsg** utility to build a valid domain trace:

```typescript
const dt: DomainTrace = dtFromMsg(createToDoCmd)
// { correlationid: 'same-as-cmd', causationid: 'cmd-id' }

const evtRes = newToDoEVT<ToDoCreatedEvt>()
  ('to-do-created') // Autocompletes
  ({ desc: 'Write dc-ts readme', status: 'created' }) // Guides data input
  (dt) // Valid domain trace
```

---

## Core Workflows

Core workflows are pure functions that take a **command** and a **state** as inputs and return either a success containing an **event** or a failure. These workflows follow the sequence:

```
🟦 Command → 🟨 State → 🟧 Event
```

### Defining Core Workflows

To define a core workflow, use the **CoreWf** type:

```typescript
export type MoveToDoneWf = CoreWf<MoveToDoneCmd, MoveToDoneState, ToDoDoneEvt>
```

This provides a collection of types that you can access through the properties of the workflow type. For example:

```typescript
const cmd: MoveToDoneWf['cmd'] // MoveToDoneCmd
const fn: MoveToDoneWf['fn'] // (c: MoveToDoneCmd) => (s: MoveToDoneState) => Result<ToDoDoneEvt, CoreWfFails>
```

### Modelling the State

The state object typically includes:
- An entity in a valid state
- Additional information needed to process the command

For example:

```typescript
export type MoveToDoneState = {
  toDo: InProgressToDo // Entity in a valid state
  isOfficeHour: boolean // Additional information
}
```

## Implementing Workflows

Core workflows involve several steps:
1. **Parse the input**: Validate the data schema.
2. **Check for invariants**: Ensure the data makes sense.
3. **Apply constraints**: Enforce business rules.
4. **Apply the state transition**: Transform the entity.
5. **Create and return the event**: Or a failure if processing fails.

### Parsing the Input

Parsing ensures the input data matches the expected schema. Here’s an example of parsing the state:

```typescript
import { safeParseTBox } from 'dc-ts'
import { MoveToDoneState } from './schema'

const _parseState: MoveToDoneWf['parseState'] = safeParseTBox(MoveToDoneState)
```

### Checking for Invariants

Invariants ensure the data is logically consistent. For example:

```typescript
import { fail, succeed } from 'dc-ts'

const _invariants: MoveToDoneWf['invariants'] = 
  (cmd: MoveToDoneWf['cmd']) => 
    (state: MoveToDoneWf['state']) => {
      // Ensure the ToDo ID in the command matches the state
      if (cmd.data.toDoId !== state.toDo.id) {
        return fail('ids_dont_match')
      }
      return succeed(state)
    }
```

### Applying Constraints

Constraints enforce business rules. For example, ensuring a ToDo can only be completed during office hours:

```typescript
import { fail, succeed } from 'dc-ts'

const _officeHourCons: MoveToDoneWf['constrain'] = 
  (cmd: MoveToDoneWf['cmd']) => 
    (state: MoveToDoneWf['state']) => {
      if (!state.isOfficeHour) {
        return fail('can_only_complete_during_office_hours')
      }
      return succeed(state)
    }
```

### Applying the State Transition

The state transition transforms the entity and creates the resulting event. For example:

```typescript
import { DomainTrace, dtFromMsg } from 'dc-ts'

const _transition: MoveToDoneWf['transition'] = 
  (cmd: MoveToDoneWf['cmd']) => 
    (state: MoveToDoneWf['state']) => {
      // Build the new completed ToDo
      const toDo: CompletedToDo = {
        ...state.toDo,
        status: 'completed',
        completedAt: +Date.now()
      }

      // Generate a valid domain trace from the command
      const dt: DomainTrace = dtFromMsg(cmd)

      // Create the to-do-done event
      const evtRes = newToDoEVT<ToDoDoneEvt>()
        ('to-do-done')
        ({ toDoId: toDo.id, status: 'done' })
        (dt)

      // Return the event or the eventual parse failure
      return evtRes
    }
```

### Composing the Workflow

Once the individual steps are defined, you can compose them into a workflow using the **composeWf** utility:

```typescript
import { composeWf } from 'dc-ts'

export const moveToDoneWf: MoveToDoneWf['fn'] = 
  composeWf<MoveToDoneWf>(_parseState)
    (_invariants)
    ([_officeHourCons])
    (_transition)
```

This composed function can be imported and used by the Shell layer, ensuring it adheres to the defined business logic.


---

## Reacting to Events with Policies

Policies are used to react to events and trigger subsequent actions. They are implemented as pure functions that take an event and return a new command or event. For example:


---

## Conclusion

**dc-ts** provides a robust framework for building domain layers in TypeScript using functional programming principles. By leveraging its utilities and patterns, you can create maintainable, type-safe, and scalable domain logic. For more details, explore the [documentation](https://github.com/your-repo/dc-ts) and examples.






You're absolutely right! I missed including the detailed examples for workflow implementations, parsing, invariants, constraints, and transitions before composing the workflow. Let me fix that and include those sections in the Markdown file. Here's the updated version:

```markdown
# dc-ts (Domain-Centric TypeScript)

**dc-ts** is a functional-oriented library designed to help developers build event-driven domain layers in TypeScript. It provides a structured approach to implementing domain logic, handling commands, emitting events, and managing state transitions in a type-safe and functional manner.

---

## Architectural Principles

The domain layer is composed of different inner layers, each handling specific concerns:

- **Core**: Implements the business logic without side effects. It contains type definitions for commands, events, state, and entities, and implements workflows and policies as pure functions.
- **Shell**: Acts as a mediator between the application and domain layers, handling asynchronous code and side effects.
- **Views**: Builds materialized views by listening to emitted events and makes them available through a query API.

---

## Result Type

A fundamental aspect of functional programming is the **Result type**, which represents either a success or a failure. This allows you to maintain control over function outputs and chain functions together. In **dc-ts**, the result type is defined as follows:

```typescript
// For synchronous functions:
export type Result<S, F extends string> = Success<S> | Failure<F>

// For asynchronous functions:
export type AsyncResult<S, F extends string> = Promise<Result<S, F>>

// Where:
export type Success<S> = { outcome: 'success', data: S }
export type Failure<F extends string> = { outcome: 'failure', cause: Cause<F>[] }
export type Cause<F extends string> = { msg: F, data?: any }
```

You can use the **succeed** or **fail** utility functions to return a success or failure. For example:

```typescript
import { Result, succeed, fail } from 'dc-ts'

type Divide = 
  (num: number) => 
    (den: number) => 
      Result<number, 'cannot_divide_by_zero'>

const divideBy: Divide = 
  (num: number) => 
    (den: number) => {
      if (den === 0) {
        return fail('cannot_divide_by_zero')
      }
      return succeed(num / den)
    }
```

You can handle the result using the **isFailure** and **isSuccess** utilities:

```typescript
import { isFailure } from 'dc-ts'

const divideRes = divideBy(6)(2)
if (isFailure(divideRes)) {
  return divideRes // { outcome: 'failure', cause: { msg: 'cannot_divide_by_zero' } }
}
// { outcome: 'success', data: 3 }
return succeed(divideRes.data + 1)
```

---

## Parsing

In functional programming, **parsing** is used to validate input data before processing it. **dc-ts** provides a prebuilt `SafeParse` function signature:

```typescript
export type SafeParse<T> = (data: T) => Result<T, 'parse_error'>
```

Since TypeScript types are not available at runtime, you can use libraries like **Zod** or **TypeBox** for runtime validation. **dc-ts** includes a prebuilt implementation of `SafeParse` using **TypeBox**:

```typescript
import { safeParseTBox, Result } from 'dc-ts'
import { ToDoSchema } from './schema'

const parseToDo = safeParseTBox(ToDoSchema)

const parseRes: Result<ToDo, 'parse_error'> = parseToDo(
  { desc: 'Write readme file for dc-ts', status: 'in-progress' }
)
```

---

## Messages

Messages in **dc-ts** are categorized into **Commands** and **Events**. Commands represent actions to be performed, while Events represent state changes that have occurred.

### Commands

To define a command, use the **CMD** type:

```typescript
import { CMD } from 'dc-ts'

type MoveToDoneData = { toDoId: string }
export type MoveToDoneCmd = CMD<'move-to-done', MoveToDoneData>
```

This produces the following type:

```typescript
type MoveToDoneCmd = {
  id: string
  msgType: 'cmd'
  type: 'move-to-done'
  correlationid: string
  causationid: string
  timestamp: number
  data: {
    toDoId: string
  }
}
```

### Events

To define an event, use the **EVT** type:

```typescript
import { EVT } from 'dc-ts'

type ToDoDoneData = { toDoId: string, status: 'done' }
export type ToDoDoneEvt = EVT<'to-do-done', ToDoDoneData>
```

This produces the following type:

```typescript
type ToDoDoneEvt = {
  id: string
  msgType: 'evt'
  type: 'to-do-done'
  correlationid: string
  causationid: string
  timestamp: number
  data: {
    toDoId: string
    status: 'done'
  }
}
```

---

## Smart Constructors

It’s a good practice to aggregate all commands and events in your module into union types. This allows you to define **smart constructors** that guide you in creating valid commands and events:

```typescript
import { newCmd, newEvt, safeParseTBox } from 'dc-ts'
import { ToDoCmd, ToDoEvt } from './schema'

export const newToDoCMD = <C extends ToDoCmd>() => {
  return newCmd<C['type'], C['data']>(safeParseTBox(ToDoCmd))
}

export const newToDoEVT = <E extends ToDoEvt>() => {
  return newEvt<E['type'], E['data']>(safeParseTBox(ToDoEvt))
}
```

These constructors ensure type safety and data validation:

```typescript
const cmdRes = newToDoCMD<MoveToDoneCmd>()
  ('move-to-done') // Autocompletes to the right command type
  ({ toDoId: 'abc' }) // Suggests the correct data structure
  ({ correlationid: 'abc', causationid: 'efg' }) // Requires a domain trace

// cmdRes will be a Result<MoveToDoneCmd, 'parse_error'>
```

---

## Domain Trace

Each message includes a **domain trace** to enable tracing the chain of commands and events. You can use the **dtFromMsg** utility to build a valid domain trace:

```typescript
const dt: DomainTrace = dtFromMsg(createToDoCmd)
// { correlationid: 'same-as-cmd', causationid: 'cmd-id' }

const evtRes = newToDoEVT<ToDoCreatedEvt>()
  ('to-do-created') // Autocompletes
  ({ desc: 'Write dc-ts readme', status: 'created' }) // Guides data input
  (dt) // Valid domain trace
```

---

## Core Workflows

Core workflows are pure functions that take a **command** and a **state** as inputs and return either a success containing an **event** or a failure. These workflows follow the sequence:

```
🟦 Command → 🟨 State → 🟧 Event
```

### Defining Core Workflows

To define a core workflow, use the **CoreWf** type:

```typescript
export type MoveToDoneWf = CoreWf<MoveToDoneCmd, MoveToDoneState, ToDoDoneEvt>
```

This provides a collection of types that you can access through the properties of the workflow type. For example:

```typescript
const cmd: MoveToDoneWf['cmd'] // MoveToDoneCmd
const fn: MoveToDoneWf['fn'] // (c: MoveToDoneCmd) => (s: MoveToDoneState) => Result<ToDoDoneEvt, CoreWfFails>
```

### Modelling the State

The state object typically includes:
- An entity in a valid state
- Additional information needed to process the command

For example:

```typescript
export type MoveToDoneState = {
  toDo: InProgressToDo // Entity in a valid state
  isOfficeHour: boolean // Additional information
}
```

---

## Implementing Workflows

Core workflows involve several steps:
1. **Parse the input**: Validate the data schema.
2. **Check for invariants**: Ensure the data makes sense.
3. **Apply constraints**: Enforce business rules.
4. **Apply the state transition**: Transform the entity.
5. **Create and return the event**: Or a failure if processing fails.

### Parsing the Input

Parsing ensures the input data matches the expected schema. Here’s an example of parsing the state:

```typescript
import { safeParseTBox } from 'dc-ts'
import { MoveToDoneState } from './schema'

const _parseState: MoveToDoneWf['parseState'] = safeParseTBox(MoveToDoneState)
```

### Checking for Invariants

Invariants ensure the data is logically consistent. For example:

```typescript
import { fail, succeed } from 'dc-ts'

const _invariants: MoveToDoneWf['invariants'] = 
  (cmd: MoveToDoneWf['cmd']) => 
    (state: MoveToDoneWf['state']) => {
      // Ensure the ToDo ID in the command matches the state
      if (cmd.data.toDoId !== state.toDo.id) {
        return fail('ids_dont_match')
      }
      return succeed(state)
    }
```

### Applying Constraints

Constraints enforce business rules. For example, ensuring a ToDo can only be completed during office hours:

```typescript
import { fail, succeed } from 'dc-ts'

const _officeHourCons: MoveToDoneWf['constrain'] = 
  (cmd: MoveToDoneWf['cmd']) => 
    (state: MoveToDoneWf['state']) => {
      if (!state.isOfficeHour) {
        return fail('can_only_complete_during_office_hours')
      }
      return succeed(state)
    }
```

### Applying the State Transition

The state transition transforms the entity and creates the resulting event. For example:

```typescript
import { DomainTrace, dtFromMsg } from 'dc-ts'

const _transition: MoveToDoneWf['transition'] = 
  (cmd: MoveToDoneWf['cmd']) => 
    (state: MoveToDoneWf['state']) => {
      // Build the new completed ToDo
      const toDo: CompletedToDo = {
        ...state.toDo,
        status: 'completed',
        completedAt: +Date.now()
      }

      // Generate a valid domain trace from the command
      const dt: DomainTrace = dtFromMsg(cmd)

      // Create the to-do-done event
      const evtRes = newToDoEVT<ToDoDoneEvt>()
        ('to-do-done')
        ({ toDoId: toDo.id, status: 'done' })
        (dt)

      // Return the event or the eventual parse failure
      return evtRes
    }
```

### Composing the Workflow

Once the individual steps are defined, you can compose them into a workflow using the **composeWf** utility:

```typescript
import { composeWf } from 'dc-ts'

export const moveToDoneWf: MoveToDoneWf['fn'] = 
  composeWf<MoveToDoneWf>(_parseState)
    (_invariants)
    ([_officeHourCons])
    (_transition)
```

This composed function can be imported and used by the Shell layer, ensuring it adheres to the defined business logic.

---

## Reacting to Events with Policies

Policies are used to react to events and trigger subsequent actions. They are implemented as pure functions that take an event and return a new command or event. For example:

```typescript
import { Policy } from 'dc-ts'

type ToDoDonePolicy = Policy<ToDoDoneEvt, MoveToDoneCmd>

const toDoDonePolicy: ToDoDonePolicy = 
  (evt: ToDoDoneEvt) => {
    // Logic to react to the event
    return newToDoCMD<MoveToDoneCmd>()
      ('move-to-done')
      ({ toDoId: evt.data.toDoId })
      (dtFromMsg(evt))
  }
```

---

## Conclusion

**dc-ts** provides a robust framework for building domain layers in TypeScript using functional programming principles. By leveraging its utilities and patterns, you can create maintainable, type-safe, and scalable domain logic. For more details, explore the [documentation](https://github.com/your-repo/dc-ts) and examples.
```

### Steps to Save as a Markdown File:
1. Open a text editor (e.g., VS Code, Notepad, or any Markdown editor).
2. Copy the above content.
3. Paste it into the editor.
4. Save the file with a `.md` extension, e.g., `README.md`.

Let me know if you need further adjustments! 🚀