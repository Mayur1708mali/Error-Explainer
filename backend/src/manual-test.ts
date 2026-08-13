/**
 * Manual end-to-end test for the analyze pipeline.
 *
 * Sends a set of real-world stack traces to a running backend and reports
 * detected language/framework, confidence, source count, schema validity, and
 * latency. Flags any failures.
 *
 * Usage: start the backend (npm run dev:backend), then:
 *   npx tsx backend/src/manual-test.ts
 */
import { analyzeResponseSchema } from '../../shared/schema'

const API = process.env.API_BASE_URL ?? 'http://localhost:3001'

interface Case {
  name: string
  expectLang: string
  input: string
}

const CASES: Case[] = [
  {
    name: 'JS: undefined.map (React)',
    expectLang: 'JavaScript',
    input: `TypeError: Cannot read properties of undefined (reading 'map')
    at UserList (http://localhost:5173/src/UserList.jsx:12:20)
    at renderWithHooks (react-dom.js:12345:18)`,
  },
  {
    name: 'JS: ReferenceError',
    expectLang: 'JavaScript',
    input: `Uncaught ReferenceError: userName is not defined
    at handleSubmit (app.js:42:5)
    at HTMLButtonElement.onclick (index.html:1:1)`,
  },
  {
    name: 'JS: JSON.parse SyntaxError',
    expectLang: 'JavaScript',
    input: `SyntaxError: Unexpected token o in JSON at position 1
    at JSON.parse (<anonymous>)
    at parseConfig (config.js:8:17)`,
  },
  {
    name: 'Node: module not found',
    expectLang: 'JavaScript',
    input: `node:internal/modules/cjs/loader:1078
  throw err;
  ^
Error: Cannot find module 'expres'
    at Function.Module._resolveFilename (node:internal/modules/cjs/loader:1075:15)`,
  },
  {
    name: 'Python: NameError',
    expectLang: 'Python',
    input: `Traceback (most recent call last):
  File "app.py", line 3, in <module>
    print(user_naem)
NameError: name 'user_naem' is not defined`,
  },
  {
    name: 'Python: KeyError',
    expectLang: 'Python',
    input: `Traceback (most recent call last):
  File "main.py", line 10, in <module>
    value = config["missing"]
KeyError: 'missing'`,
  },
  {
    name: 'Python: ZeroDivisionError',
    expectLang: 'Python',
    input: `Traceback (most recent call last):
  File "calc.py", line 5, in divide
    return a / b
ZeroDivisionError: division by zero`,
  },
  {
    name: 'Python: Django OperationalError',
    expectLang: 'Python',
    input: `Traceback (most recent call last):
  File "/app/venv/lib/python3.11/site-packages/django/core/handlers/exception.py", line 47, in inner
    response = get_response(request)
django.db.utils.OperationalError: no such table: users`,
  },
  {
    name: 'Java: NullPointerException',
    expectLang: 'Java',
    input: `Exception in thread "main" java.lang.NullPointerException
\tat com.example.demo.MyService.doWork(MyService.java:23)
\tat com.example.demo.App.main(App.java:10)`,
  },
  {
    name: 'Ruby: NoMethodError',
    expectLang: 'Ruby',
    input: `app/models/user.rb:15:in \`full_name': undefined method \`first_name' for nil:NilClass (NoMethodError)
\tfrom app/controllers/users_controller.rb:8:in \`show'`,
  },
  {
    name: 'Go: nil pointer panic',
    expectLang: 'Go',
    input: `panic: runtime error: invalid memory address or nil pointer dereference
[signal SIGSEGV: segmentation violation code=0x1 addr=0x0]

goroutine 1 [running]:
main.main()
\t/app/main.go:15 +0x1d`,
  },
  {
    name: 'C#: NullReferenceException',
    expectLang: 'C#',
    input: `Unhandled exception. System.NullReferenceException: Object reference not set to an instance of an object.
   at MyApp.Services.UserService.GetUser(Int32 id) in C:\\proj\\UserService.cs:line 42`,
  },
  {
    name: 'PHP: undefined function (Laravel)',
    expectLang: 'PHP',
    input: `PHP Fatal error:  Uncaught Error: Call to undefined function foo() in /var/www/app/index.php:10
Stack trace:
#0 /var/www/app/vendor/laravel/framework/src/Illuminate/Routing/Controller.php(54): Illuminate\\Routing\\Controller->callAction()
#1 {main}
  thrown in /var/www/app/index.php on line 10`,
  },
  {
    name: 'TypeScript: TS2322',
    expectLang: 'TypeScript',
    input: `src/index.ts:10:7 - error TS2322: Type 'string' is not assignable to type 'number'.

10   const count: number = "oops";`,
  },
  {
    name: 'Rust: panic index out of bounds',
    expectLang: 'Rust',
    input: `thread 'main' panicked at 'index out of bounds: the len is 3 but the index is 5', src/main.rs:6:5
note: run with \`RUST_BACKTRACE=1\` environment variable to display a backtrace`,
  },
]

interface Row {
  name: string
  ok: boolean
  note: string
}

async function main() {
  const rows: Row[] = []
  for (const c of CASES) {
    const start = Date.now()
    try {
      const res = await fetch(`${API}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: c.input }),
      })
      const ms = Date.now() - start
      if (!res.ok) {
        rows.push({ name: c.name, ok: false, note: `HTTP ${res.status}` })
        continue
      }
      const body = await res.json()
      const parsed = analyzeResponseSchema.safeParse(body)
      if (!parsed.success) {
        rows.push({ name: c.name, ok: false, note: 'schema invalid' })
        continue
      }
      const r = parsed.data
      const langMatch = r.language.toLowerCase().includes(c.expectLang.toLowerCase())
      rows.push({
        name: c.name,
        ok: true,
        note: `lang=${r.language}${langMatch ? '' : `(≠${c.expectLang})`} fw=${r.framework ?? '-'} conf=${r.confidence} src=${r.sources.length} ${ms}ms`,
      })
    } catch (err) {
      rows.push({ name: c.name, ok: false, note: err instanceof Error ? err.message : String(err) })
    }
  }

  console.info('\n=== Manual pipeline test results ===')
  for (const row of rows) {
    console.info(`${row.ok ? 'PASS' : 'FAIL'}  ${row.name.padEnd(34)} ${row.note}`)
  }
  const failures = rows.filter((r) => !r.ok)
  console.info(`\n${rows.length - failures.length}/${rows.length} passed.`)
  if (failures.length > 0) {
    console.info('Failures:', failures.map((f) => f.name).join(', '))
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
