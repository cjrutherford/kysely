import { cloneQueryNodeWithFroms } from './operation-node/query-node'
import { QueryBuilder } from './query-builder/query-builder'
import { RawBuilder } from './raw-builder/raw-builder'
import {
  TableArg,
  FromQueryBuilder,
  parseFromArgs,
} from './query-builder/methods/from-method'

/**
 * The main Kysely class.
 *
 * You should create one instance of `Kysely` per database. Each `Kysely` instance
 * maintains it's own connection pool.
 *
 * @example
 * This example assumes your database has tables `person` and `pet`:
 *
 * ```ts
 * interface PersonRow {
 *   id: number
 *   first_name: string
 * }
 *
 * interface PetRow {
 *   id: number
 *   owner_id: number
 *   name: string
 *   species 'cat' | 'dog
 * }
 *
 * interface Database {
 *   person: PersonRow,
 *   pet: PetRow
 * }
 *
 * const db = new Kysely<Database>(config)
 * ```
 *
 * @typeParam DB - The database interface type. Keys of this type must be table names
 *    in the database and values must be interfaces that describe the rows in those
 *    tables. See the examples above.
 */
export class Kysely<DB> {
  /**
   * Creates a query builder against the given table/tables.
   *
   * The tables passed to this method are built as the query's `from` clause in case
   * of `select` and `delete` queries, `into` clause in case of `insert` queries and
   * `update` clause in case of `update` queries.
   *
   * The tables must be either one of the keys of the `DB` type, aliased versions of
   * the keys of the `DB` type, queries or `raw` statements. See the examples.
   *
   * @example
   * Create a select query from one table:
   *
   * ```ts
   * db.query('person').selectAll('person')
   * ```
   *
   * The generated SQL (postgresql):
   *
   * ```sql
   * select "person".* from "person"
   * ```
   *
   * @example
   * Create a select query from one table with an alias:
   *
   * ```ts
   * const persons = await db.query('person as p')
   *   .select(['p.id', 'p.first_name'])
   *   .execute()
   *
   * console.log(persons[0].id)
   * ```
   *
   * The generated SQL (postgresql):
   *
   * ```sql
   * select "p"."id", "p"."first_name" from "person" as "p"
   * ```
   *
   * @example
   * Create a select query from a subquery:
   *
   * ```ts
   * const persons = await db.query(
   *     db.query('person').select('person.id as identifier').as('p')
   *   )
   *   .select('p.identifier')
   *   .execute()
   *
   * console.log(persons[0].identifier)
   * ```
   *
   * The generated SQL (postgresql):
   *
   * ```sql
   * select "p"."identifier",
   * from (
   *   select "person"."id" as "identifier" from "person"
   * ) as p
   * ```
   *
   * @example
   * Create a select query from raw sql:
   *
   * ```ts
   * const items = await db.query(
   *     db.raw<{ one: number }>('select 1 as one').as('q')
   *   )
   *   .select('q.one')
   *   .execute()
   *
   * console.log(items[0].one)
   * ```
   *
   * The generated SQL (postgresql):
   *
   * ```sql
   * select "q"."one",
   * from (
   *   select 1 as one
   * ) as q
   * ```
   *
   * When you use `raw` you need to also provide the result type of the
   * raw segment / query so that Kysely can figure out what columns are
   * available for the query.
   *
   * @example
   * The `query` method also accepts an array for multiple tables. All
   * the above examples can also be used in an array.
   *
   * ```ts
   * const items = await db.query([
   *     'person',
   *     'movie as m',
   *     db.query('pet').select('pet.species').as('a'),
   *     db.raw<{ one: number }>('select 1 as one').as('q')
   *   ])
   *   .select(['person.id', 'm.stars', 'a.species', 'q.one'])
   *   .execute()
   * ```
   *
   * The generated SQL (postgresql):
   *
   * ```sql
   * select "person".id, "m"."stars", "a"."species", "q"."one"
   * from
   *   "person",
   *   "movie" as "m",
   *   (select "pet"."species" from "pet") as a,
   *   (select 1 as one) as "q"
   * ```
   *
   * @example
   * With `insert`, `delete` and `update` you can only use existing tables.
   * You obviously can't insert rows to a subquery or delete rows from a random
   * raw statement (unless that raw statement is simply a table name).
   *
   * ```ts
   * db.query('person').insert(person)
   * db.query('person').delete().where('id', 'in', [1, 2, 3])
   * db.query('person').update({ species: 'cat' }).where('id', 'in', [1, 2, 3])
   * ```
   */
  query<F extends TableArg<DB, keyof DB, {}>>(
    from: F[]
  ): FromQueryBuilder<DB, never, {}, F>

  query<F extends TableArg<DB, keyof DB, {}>>(
    from: F
  ): FromQueryBuilder<DB, never, {}, F>

  query(from: any): any {
    const query = new QueryBuilder()

    return new QueryBuilder(
      cloneQueryNodeWithFroms(
        query.toOperationNode(),
        parseFromArgs(query, from)
      )
    )
  }

  /**
   * Provides a way to pass arbitrary SQL into your query and executing completely
   * raw queries.
   *
   * You can use strings `?` and `??` in the `sql` to bind parameters such as
   * user input to the SQL. You should never EVER concatenate untrusted user
   * input to the SQL string to avoid injection vulnerabilities. Instead use `?`
   * in place of the value and pass the actual value in the `params` list. See
   * the examples below.
   *
   * You should only use `raw` when there is no other way to get the job done. This is
   * because Kysely is not able to use type inference when you use raw SQL. For example
   * Kysely won't be able to automatically provide you with the correct query result
   * type. However, there are ways to manually provide types when you use `raw` in most
   * cases. See the examples below.
   *
   * Raw builder instances can be passed to pretty much anywhere: `select`, `where`,
   * `*Join`, `groupBy`, `orderBy` etc. Just try it. If the method accepts it, it works.
   *
   * @param sql - The raw SQL. Special strings `?` and `??` can be used to provide
   *    parameter bindings. `?` for values and `??` for identifiers such as column names
   *    or `column.table` references.
   *
   * @param params - The parameters that will be bound to the `?` and `??` bindings in
   *    the sql string.
   *
   * @example
   * Example of using `raw` in a select statement:
   *
   * ```ts
   * const [person] = await db.query('person')
   *   .select(db.raw<string>('concat(first_name, ' ', last_name)').as('name'))
   *   .where('id', '=', 1)
   *   .execute()
   *
   * console.log(person.name)
   * ```
   *
   * The generated SQL (postgresql):
   *
   * ```sql
   * select concat(first_name, ' ', last_name) as "name"
   * from "person" where "id" = 1
   * ```
   *
   * The above example selects computed column `name` by concatenating the first name
   * and last name together.
   *
   * There are couple of things worth noticing:
   *
   *   1. You need to provide the output type of your SQL segment for the `raw` method
   *     so that Kysely knows what type to give for the `name` column. In this case it's
   *     a `string` since that's the output type of the `concat` function in SQL.
   *
   *   2. You need to give an alias for the selection using the `as` method so that
   *     Kysely is able to add a column to the output type. The alias needs to be
   *     known at compile time! If you pass a string variable whose value is not known
   *     at compile time, there is no way for Kysely or typescript to add a column to
   *     the output type. In this case you need to use the `castTo` method on the query
   *     to specify a return type for the query.
   *
   * We could've also used `??` bindings to provide `first_name` and `last_name` like
   * this:
   *
   * ```ts
   * db.raw<string>('concat(??, ' ', ??)', ['first_name', 'last_name'])
   * ```
   *
   * or this:
   *
   * ```ts
   * db.raw<string>('concat(??, ' ', ??)', ['person.first_name', 'person.last_name'])
   * ```
   *
   * But it's often cleaner to just write the column names in the SQL. Again remember to
   * never concatenate column names or any other untrusted user input to the SQL string or you
   * are going to create an injection vulnerability. All user input should go to the bindings
   * array, never to the SQL string directly. But if the column names or values are trusted
   * and known at compile time, there is no reason to use bindings.
   *
   * @example
   * Example of using `raw` in `where`:
   *
   * ```ts
   * function getPersonsOlderThan(ageLimit: number) {
   *   return await db.query('person')
   *     .selectAll()
   *     .where(
   *       db.raw('now() - birth_date'),
   *       '>',
   *       db.raw('interval ? year', [ageLimit.toString()])
   *     )
   *     .execute()
   * }
   * ```
   *
   * The generated SQL (postgresql):
   *
   * ```sql
   * select * from "person" where now() - birth_date > interval $1 year
   * ```
   *
   * The function in the above example returns people that are older than the given number of
   * years. The number of years in this example is an untrusted user input, and therefore we use
   * a `?` binding for it.
   *
   * @example
   * Example of creating a completely raw query from scratch:
   *
   * ```ts
   * const persons = await db.raw<Person>('select p.* from person p').execute()
   * ```
   *
   * For a raw query, you need to specify the type of the returned __row__. In
   * this case we know the resulting items will be of type `Person` se specify that.
   * The result of `execute()` method is always an array. In this case the type of
   * the `persons` variable is `Person[]`.
   */
  raw<T = unknown>(sql: string, params?: any[]): RawBuilder<T> {
    return new RawBuilder(sql, params)
  }
}
