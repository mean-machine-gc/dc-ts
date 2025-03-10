**dc-ts** (domain-centric TypeScript) is a functional-oriented library helping developers build event-driven domain layers in TypeScript.

## Architectural Principles
A domain layer is itself composed of different inner layers, each handling different concerns:

- **Core**: the Core implements the business logic without side effects, contains the types definitions for commands, events, state, and entities, and implements workflows and policies pure functions
- **Shell**: the Shell acts as a mediator between the application and domain layers, handling asynchronous code and side effects
- **Views**: the Views layer builds the materialised views listening to the events emitted and makes them available through a query API

## Result Type
One fundamental aspect of functional programming is the result type, which is a union of either a success or a failure. This enables you to stay in control of what each function returns, and also to chain functions together. In dc-ts we use the following result type:

```ts
	//for sync functions:
	export type Result<S, F extends string> = Success<S> | Failure<F>
	
	//for async functions:
	export type AsyncResult<S, F extends string> = Promise<Result<S, F>>

	//where:
	export type Success<S> = { outcome: 'success', data: S }
	export type Failure<F extends string> = { outcome: 'failure', cause: Cause<F>[] }
	export type Cause<F extends string> = { msg: F, data?: any }
```

You can use the **succeed** or **fail** utility functions to return either a success or a failure. For example:

```ts
	import { Result, succeed, fail } from 'dc-ts'

	type Divide = 
		(num: number) => 
			(den: number) => 
				Result<number, 'cannot_divide_by_zero'>

	const divideBy: Divide = 
		(num: number) => 
			(den: number) => {
				if(den === 0){
					return fail('cannot_divide_by_zero')
				}
				succeed(num/den)
			}
```

You can then handle the result from outside this function using the utilities **isFailure** and **isSuccess**:

```ts
	import { isFailure } from 'dc-ts'
	
	const divideRes = divideBy(6)(2)
	if(isFailure(divideRes)){
		return divideRes // {outcome: 'failure', cause: {msg: 'cannot_divide_by_zero'}}
	}
	//{outcome: 'success', data: 3}
	return succeed(divideRes.data + 1)
```

## Parsing
In OOP it is common to validate the data used to build a new object and in case reject the operation if the data is not valid. This is often called **parsing**. In FP we don't need to build object as in OOP but we still need to parse the input of functions. dc-ts provides a prebuilt SafeParse function signature:

```ts
	export type SafeParse<T> = (data: T) => Result<T, 'parse_error'>
```

Because TypeScript types are not available at runtime, to enable runtime parsing we either need to use libraries like Zod and TypeBox instead of normal TypeScript types, or (as I do) define all the types in TypeScript and then convert them in to TypeBox schemas using TypeBox Workbench or Codegen. 

dc-ts has a prebuilt implementation of SafeParse using TypeBox. Provided you have a TypeBox ToDoSchema in a schema folder, either written by hand or generated:

```ts
	import { safeParseTBox, Result } from 'dc-ts'
	import { ToDoSchema } from './schema'

	const parseToDo = safeParseTBox(ToDoSchema)
	//this will give you a SafeParse function using a TypeBox schema

	//that you can use like so:
	const parseRes: Result<ToDo, 'parse_error'> = parseToDo(
			{desc: 'Write readme file for dc-ts', status: 'in-progress'}
		)
```


## Messages
Messages can be of two types: Commands and Events. To define a command, use the **CMD type** providing a command type literal and a type for the payload:

```ts
	import { CMD } from 'dc-ts'
	
	type MoveToDoneData = { toDoId: string }
	export type MoveToDoneCmd = CMD<'move-to-done', MoveToDoneData>
```

This will produce the following type for you:

```ts
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

To create an event, use the **EVT type**:

```ts
	import { EVT } from 'dc-ts'
	
	type ToDoDoneData = { toDoId: string, status: 'done' }
	export type ToDoDoneEvt = EVT<'to-do-done', ToDoDoneData>
```

This will produce the following type for you:

```ts
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


## Smart Constructors
It is a good idea to aggregate all the commands and events in your module in union types representing all the commands and all the events in your module, like so:

```ts
	export type ToDoCmd = CreateToDoCmd | MoveToDoneCmd
	export type ToDoEvt = ToDoCreatedEvt | ToDoDoneEvt
```

This grouping enables you to define a **constructor function** for all of them (this is convenient but you're welcome to define a constructor for each command instead). The constructor function should take care of **parsing** the data, returning an exception if the data provided is not valid.

Provided you have these TypeBox schemas in a **schema**  folder, you can use them in the constructor to parse and create a new command or event, using the **newCmd** or **newEvt** functions:

```ts
	import { newCmd, newEvt, safeParseTBox } from 'dc-ts'
	import { ToDoCmd, ToDoEvt } from './schema'

	export const newToDoCMD =<C extends ToDoCmd>() =>{
		return newCmd<C['type'], C['data']>(safeParseTBox(ToDoCmd))
	}

	export const newToDoEVT =<E extends ToDoEvt>() =>{
		return newEvt<E['type'], E['data']>(safeParseTBox(ToDoEvt))
	}
```

These constructors are **smart**: they will guide you inputting the right types and they will parse the data you input. You can use them like so:

```ts
	const cmdRes = newToDoCmd<MoveToDoneCmd>()
		('move-to-done') //this will autocomplete to the right cmd type
		({ toDoId: 'abc' })//this will suggest you the right data
		({correlationid: 'abc', causationid: 'efg'})//you also need to pass a domain trace

	//cmdRes will be a Result<MoveToDoneCmd, 'parse_error'>	
```

## Domain Trace
Each message has a domain trace to enable tracing the chain of commands and events. You can use the **dtFromMsg** utility to build a valid domain trace from a message, to use when constructing the next one:

```ts
	//if you're building a ToDoCreatedEvt as a result of a CreateToDoCmd:
	const dt: DomainTrace = dtFromMsg(createToDoCmd)
	//{correlationid: 'same-as-cmd', causationid: 'cmd-id'}
	
	const evtRes = newToDoEvt<ToDoCreatedEvt>()
		('to-do-created')//will autocomplete
		({desc: 'Write dc-ts readme', status: 'created'})//this will guide you in filling with the right data
		(dt)//valid domain trace
```

## Core Workflows
Core Workflows are pure functions that take a **command** and a **state** as inputs and return either a success containing an **event** or a failure. If you know EventStorming, this is like the sequence:
	
	🟦 cmd 🟨 aggregate 🟧 evt
	
But using the word 'state' instead of 'aggregate'

	🟦 cmd 🟨 state 🟧 evt

This is to keep the system more flexible, meaning: 

- The State in a workflow is *whatever* information you need to process the command. If that is your aggregate, then the state is an aggregate too.

- The information in the State will primarily involve information about the Entity you're applying the command to. But it might also contain information that helps you make decision and process the command, and those information could also originate from other bounded-contexts.

- All the information needed in the State will be provided to the Core layer by the Shell layer. The Core layer just assumes it will receive it.

We'll clarify with some examples soon.

## Defining Core Workflows
To define a core workflow you can use the **CoreWf** type:

```ts
	export type MoveToDoneWf = CoreWf<MoveToDoneCmd, MoveToDoneState, ToDoDoneEvt>
```

Remember the colored boxes: 🟦 cmd 🟨 state 🟧 evt

This will give you a handy collection of types that you can access through the properties of the MoveToDoneWf type.  For example, to access the type of the command in this workflow:

```ts
	const cmd: MoveToDoneWf['cmd']//MoveToDoneCmd
```

Or the signature of the workflow function:

```ts
	const fn: MoveToDoneWf['fn']
	//this is the following signature:
	//(c: MoveToDoneCmd) => 
	//(s: MoveToDoneState) => 
	//Result<ToDoDoneEvt, CoreWfFails>
```

You get a bunch of such types for free just by defining the workflow. You can use these types later for the implementation, but it's already good you don't need to remember them all, but you can just access them as properties of the workflow type.

## Modelling the State

A State object will usually contain:
- An Entity in a valid state
- Additional information needed to process the command

### Entity State

It is advised to model the Entity state similarly to what described in the book Domain Modelling Made Functional.

In essence, you should have an understanding of the state transitions for your Entity, and model them as state-machines. The principle is that the same entity at different states will have a different shape, so you should express your entity as a **union of its states**. In doing so, you should **avoid using flags and optional properties**.

For example:

```ts
 //the shape of ToDo depends on its state:
 
 export type CreatedToDo = {
	id: string
	desc: string
	status: 'new'
	createdAt: number
 }

export type InProgressToDo = {
	id: string
	desc: string
	status: 'in-progress'
	createdAt: number
	startedAt: number
 }

export type CompletedToDo = {
	id: string
	desc: string
	status: 'completed'
	createdAt: number
	startedAt: number
	completedAt: number
 }

export type CreatedCancelledToDo = {
	id: string
	desc: string
	status: 'cancelled'
	createdAt: number
	cancelledat: number
	cancellationReason: string
}

export type InProgressCancelledToDo = {
	id: string
	desc: string
	status: 'cancelled'
	createdAt: number
	startedAt: number
	cancelledAt: number
	cancellationReason: string
}

export type CancelledToDo = 
	CreatedCancelledToDo | 
	InProgressCancelledToDo

export type ToDo = 
	CreatedToDo | 
	InProgressToDo | 
	CompletedToDo | 
	CancelledToDo

//this will make invalid states impossible
```

It is not mandatory to use these techniques, but modelling skills will make the code more consistent and robust. If instead you are ok allowing invalid states in the data model, you could write a generic type and then handle the logic for consistency in subsequent steps:

```ts
	export type ToDo = {
		id: string
		desc: string
		status: 'new' | 'in-progress' | 'completed' | 'cancelled'
		createdAt: number
		startedAt?: number
		completedAt?: number
		cancelledAt?: number
		cancellationReason?: string
	}
	//invalid states are possible, e.g. a ToDo with a 'in-progress' status and a 'completedAt' date, which should be impossible
```

### Additional State Properties

In addition to the Entity state, we could include in the workflow state other properties that are needed to process the command. For example, imagine we can only complete ToDos during office hours, and there's another bounded-context dealing with working schedules and calendars. Our ToDo module should just receive the information whether or not it is office hour, so that it can process or reject the command.

The MoveToDoneState would then look like this:

```ts
	export type MoveToDoneState = {
		toDo: InProgressToDo//we restrict the state to a valid state in this stage of the state-machine
		isOfficeHour: boolean//additional info, probably from another bounded context
	}
```

## Implementing Workflows

When processing a command, there are several standard and repetitive steps to take care of:

- **Parse the input**: make sure we are handling data in the right schema
- **Check for invariants**: make sure that the data makes sense, even if the schema is valid
- **Apply constrains**: apply the business logic needed to process the command
- **Apply the state transition**: transform the entity from one state to the next
- **Create and return the event**: or a failure, if processing fails

**dc-ts** provides function signatures for each of these steps, so that the IDE will help you building them. Then, we can chain them together using the **composeWf** function.

For example, to parse the state we can write this function:

```ts
import { safeParseTBox } from 'dc-ts'
import { MoveToDoneState } from './schema'

const _parseState: MoveToDoneWf['parseState'] = safeParseTBox(MoveToDoneState)
```

To check for invariants:

```ts
import { fail, succeed } from 'dc-ts'

const _invariants: MoveToDoneWf['invariants'] = 
	(cmd: MoveToDoneWf['cmd']) => 
		(state: MoveToDoneWf['state']) => {

			//we check if the ToDo id in the command is the one of the ToDo id in the state; 
			//they could both be valid on their own, but they need to match!
			if(cmd.data.id !== state.toDo.id){
				return fail('ids_dont_match')
			}
			return succeed(state)
		}
```

To apply constrains:

```ts
import { fail, succeed } from 'dc-ts'

const _hofficeHourCons: MoveToDoneWf['constrain'] = 
		(cmd: MoveToDoneWf['cmd']) => 
			(state: MoveToDoneWf['state']) => {
				if(!state.isOfficeHour){
					return fail('can_only_complete_during_office_hours')
				}
				return succeed(state)
			}
			
//we can write as many constrains function as we want, doesn't have to be just one
//if for example we used a generic ToDo type we might want to check if
//the ToDo is in 'cancelled' state and reject (cancelled ToDos can't logically be completed!)
```

To apply the state transition:

```ts
import { DomainTrace, dtFromMsg } from 'dc-ts'

const _transition: MoveToDoneWf['transition'] = 
		(cmd: MoveToDoneWf['cmd']) => 
			(state: MoveToDoneWf['state']) => {
			
			//we build the new completed ToDo
			const toDo: CompletedToDo = {
					...state.toDo,
					status: 'completed',
					completedAt: +Date.now()
				}
				
			//we generate a valid domain trace from the cmd
			const dt: DomainTrace = dtFromMsg(cmd)
			
			//we create the to-do-done event
			const evtRes = newToDoEvt<ToDoDoneEvt>()
				('to-do-done')({toDo})(dt)
				
			//we return the event or the eventual parse failure
			return evtRes
		}
```

The beauty of this approach is that each step is cleanly defined and **we can unit test all of these functions separately**. 

Also, this setup enables us to accommodate the majority of new requirements just by adding new constrains functions.

Once we have these building blocks ready, **we can automatically chain them together** using the **composeWf** utility:

```ts
import { composeWf } from 'dc-ts'

export const moveToDoneWf: MoveToDoneWf['fn'] = 
		composeWf<MoveToDoneWf>(_parseState)
			(_invariants)
			([_officeHourCons])
			(_transition)
```

If any of the inner functions fails, the rest of them will not execute and the workflow will return the failure. If none fails, then the workflow will return the event wrapped in a Success type.

This composed function can be imported and used by the Shell, and we can be sure that it will work according to specs.

## Reacting to Events with Policies
