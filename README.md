# Kysely

A type-safe and autocompletion-friendly typescript SQL query builder for node.js. Heavily inspired by
[knex](http://knexjs.org/) but not intended to be a clone.

![](https://github.com/koskimas/kysely/blob/master/assets/demo.gif)

Kysely's typescript typings only allow you to use tables that are available in the database and refer to
columns of the tables that are joined to the query. The result type always only contains the selected
columns with correct types and aliases. This allows tools like vscode autocompletion to make your life
so much easier.

As you can see in the gif above, through the pure magic of modern typescript, Kysely is even able to parse
the alias given to `pet.name` and add a column `pet_name` to the result row type. Kysely is also able to
infer colum names and types from selected subqueries, joined subqueries, with statements and pretty much
anything you can think of. Typescript is always there for you to tell what kind of query you can build and
offer completions.

Of course there are cases where things cannot be typed at compile time, and Kysely offers escape
hatches for these situations. With typescript you can always cast something to `any` if the types
fail you. with Kysely you can also explicitly tell it to ignore the typings, but the default is always
type safety!

All you need to do is define an interface for each table in the database and pass those
interfaces to the `Kysely` constructor:

```ts
import { Kysely } from 'kysely'

interface Person {
  id: number
  first_name: string
  last_name: string
  gender: 'male' | 'female' | 'other'
}

interface Pet {
  id: string
  name: string
  owner_id: number
  species: 'dog' | 'cat'
}

interface Movie {
  id: string
  stars: number
}

// Keys are table names.
interface Database {
  person: Person
  pet: Pet
  movie: Movie
}

// You'd create one of these when you start your app.
const db = new Kysely<Database>()

async function demo() {
  const [person] = await db
    .query('person')
    .innerJoin('pet', 'pet.owner_id', 'person.id')
    .select(['first_name', 'pet.name as pet_name'])
    .where('person.id', '=', 1)
    .execute()

  person.pet_name
}
```

# Work in progress

This whole library is still just a proof of concept and you can't yet start using it for anything
serious. You can't even connect to an actual database yet. Just the query building is partially
implemented.

However, I'd say the concept is pretty much proven! Typescript is amazing! Let me know if this is something
you'd use and I'll continue working on this.

# Why not just contribute to knex

Kysely is very similar to knex, but it also attempts to fix things that I personally find not-so-good
in knex. Bringing the type system and the changes to knex would mean very significantly breaking the
backwards compatibility. That's not possible at this point of the project. Knex was also originally
written for javascript and the typescript typings were added afterwards. That always leads to
compromises in the types. Designing a library for typescript from the ground up produces much
better and simpler types.
