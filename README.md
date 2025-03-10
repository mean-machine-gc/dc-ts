# dc-ts (Domain-Centric TypeScript)

**dc-ts** is a pragmatic, functional-oriented library designed to help developers build **event-driven domain layers** in TypeScript. It provides a structured yet flexible approach to implementing complex business logic, enforcing clear separation of concerns while maintaining code readability.

This guide introduces the key concepts and building blocks of **dc-ts** to help you quickly onboard and start building.

---

## **Architectural Principles**
In **dc-ts**, the domain layer is structured into three distinct parts. Each serves a specific purpose:

- **Core Layer:** The heart of your domain logic. This layer:
  - Contains **pure functions** that handle your business rules.
  - Defines types for **commands**, **events**, **state**, and **entities**.
  - Implements **workflows** and **policies** to model system behavior.

- **Shell Layer:** Acts as a bridge between the **Core Layer** and your **Application Layer**. It handles:
  - Asynchronous code.
  - Side effects such as I/O operations, network requests, and database interactions.

- **Views Layer:** Builds **materialized views** by listening to emitted domain events. This layer presents data via a query API for efficient retrieval.

This separation of concerns keeps your Core logic isolated, testable, and pure, while still ensuring the system integrates cleanly with external services.

---

## **Result Type**
**dc-ts** leverages the **Result Type** pattern to ensure predictable outcomes from functions. This approach is common in functional programming, and it provides a reliable way to model success and failure.

### Why Use Result Types?
Instead of relying on exceptions for error handling (which can be unpredictable), **dc-ts** makes all outcomes explicit. Functions return either:
- A **Success** containing data.
- A **Failure** with a detailed explanation of what went wrong.

### Result Type Definitions
```ts
// For synchronous functions:
export type Result<S, F extends string> = Success<S> | Failure<F>

// For asynchronous functions:
export type AsyncResult<S, F extends string> = Promise<Result<S, F>>

// Definitions:
export type Success<S> = { outcome: 'success'; data: S }
export type Failure<F extends string> = { outcome: 'failure'; cause: Cause<F>[] }
export type Cause<F extends string> = { msg: F; data?: any }
```

### Example Usage
```ts
import { Result, succeed, fail } from 'dc-ts'

type Divide = (num: number) => (den: number) => Result<number, 'cannot_divide_by_zero'>

const divideBy: Divide = (num) => (den) => {
    if (den === 0) {
        return fail('cannot_divide_by_zero')
    }
    return succeed(num / den)
}
```

### Handling Results
To manage the result outcome, use the utility functions:

- **`isFailure()`** — Identifies failure outcomes.
- **`isSuccess()`** — Identifies success outcomes.

Example:

```ts
import { isFailure } from 'dc-ts'

const divideRes = divideBy(6)(2)
if (isFailure(divideRes)) {
    return divideRes // { outcome: 'failure', cause: [{ msg: 'cannot_divide_by_zero' }] }
}

// Success result
return succeed(divideRes.data + 1) // { outcome: 'success', data: 4 }
```

---

## **Parsing**
In functional programming, we often validate incoming data to ensure correctness before processing it. This step is called **parsing**.

Since TypeScript types are erased at runtime, runtime validation must be implemented manually or using libraries like **Zod** or **TypeBox**.

### SafeParse
**dc-ts** provides a `SafeParse` signature to model parsing as a function that returns a **Result Type**.

```ts
export type SafeParse<T> = (data: T) => Result<T, 'parse_error'>
```

### Example Using TypeBox
```ts
import { safeParseTBox } from 'dc-ts'
import { ToDoSchema } from './schema'

const parseToDo = safeParseTBox(ToDoSchema)

const parseRes = parseToDo({
    desc: 'Write dc-ts documentation',
    status: 'in-progress'
})

// Result<ToDo, 'parse_error'>
```

This approach ensures data integrity before functions begin their logic.

---

## **Messages**
In **dc-ts**, the core of your system’s interactions is modeled using **Commands** and **Events**.

### What Are Commands and Events?
- **Commands** represent **intent** — actions that a user or system wants to perform.
- **Events** represent **outcomes** — facts about things that have happened.

### Defining a Command
```ts
import { CMD } from 'dc-ts'

type MoveToDoneData = { toDoId: string }
export type MoveToDoneCmd = CMD<'move-to-done', MoveToDoneData>
```

### Defining an Event
```ts
import { EVT } from 'dc-ts'

type ToDoDoneData = { toDoId: string; status: 'done' }
export type ToDoDoneEvt = EVT<'to-do-done', ToDoDoneData>
```

Both types automatically include fields for:
- **`id`** (unique identifier)
- **`msgType`** (either `'cmd'` or `'evt'`)
- **`correlationid`** (to trace message chains)
- **`causationid`** (to track causality)
- **`timestamp`**

---

## **Core Workflows**
A **Core Workflow** defines the sequence in which a command is processed to produce an event.

The typical steps in a workflow are:

1. **Parse** the state to ensure it is valid.
2. **Check Invariants** to ensure consistent data conditions.
3. **Apply Constraints** to enforce business logic rules.
4. **Perform the State Transition** to produce the appropriate event.
5. **Return** the result — either a **Success** (with the event) or a **Failure**.

### Example Workflow
```ts
import { composeWf, safeParseTBox, succeed, fail } from 'dc-ts'
import { MoveToDoneWf } from './schema'

// Parsing the state
const _parseState: MoveToDoneWf['parseState'] = safeParseTBox(MoveToDoneState)

// Invariant: Check command's ToDo ID matches the state
const _invariants: MoveToDoneWf['invariants'] = (cmd) => (state) =>
    cmd.data.id === state.toDo.id ? succeed(state) : fail('ids_dont_match')

// Constraint: Ensure completion only happens during office hours
const _officeHourConstraint: MoveToDoneWf['constrain'] = (cmd) => (state) =>
    state.isOfficeHour ? succeed(state) : fail('can_only_complete_during_office_hours')

// State Transition: Create a "done" event
const _transition: MoveToDoneWf['transition'] = (cmd) => (state) => {
    const evt = newToDoEvt<ToDoDoneEvt>()('to-do-done')({ toDoId: state.toDo.id, status: 'done' })
    return evt
}

// Composing the Workflow
export const moveToDoneWf: MoveToDoneWf['fn'] =
    composeWf<MoveToDoneWf>(_parseState)(_invariants)([_officeHourConstraint])(_transition)
```

---

## **Conclusion**
**dc-ts** provides a solid foundation for building domain layers with a functional programming mindset. By guiding developers to model their domain logic through:
- Clear message types,
- Strongly-typed results,
- Composable workflows,
- And modular constraints,

**dc-ts** encourages pragmatic, maintainable, and testable code.

