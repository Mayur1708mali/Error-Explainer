import { describe, expect, it } from 'vitest'
import { detectLanguage } from './detect'
import { detectLanguageWithFallback } from './classify'

// Real-world-shaped stack traces for each supported language.
const SAMPLES = {
  python: `Traceback (most recent call last):
  File "app.py", line 3, in <module>
    print(user_naem)
NameError: name 'user_naem' is not defined`,

  django: `Traceback (most recent call last):
  File "/app/venv/lib/python3.11/site-packages/django/core/handlers/exception.py", line 47, in inner
    response = get_response(request)
django.db.utils.OperationalError: no such table: users`,

  reactJs: `TypeError: Cannot read properties of undefined (reading 'map')
    at UserList (http://localhost:5173/src/UserList.jsx:12:20)
    at renderWithHooks (http://localhost:5173/node_modules/.vite/deps/react-dom.js:12345:18)`,

  node: `node:internal/modules/cjs/loader:1078
  throw err;
  ^
Error: Cannot find module 'expres'
    at Function.Module._resolveFilename (node:internal/modules/cjs/loader:1075:15)`,

  typescript: `src/index.ts:10:7 - error TS2322: Type 'string' is not assignable to type 'number'.

10   const count: number = "oops";`,

  javaSpring: `Exception in thread "main" java.lang.NullPointerException
\tat com.example.demo.MyService.doWork(MyService.java:23)
\tat org.springframework.web.servlet.DispatcherServlet.doDispatch(DispatcherServlet.java:1089)`,

  rubyRails: `app/models/user.rb:15:in \`full_name': undefined method \`first_name' for nil:NilClass (NoMethodError)
\tfrom /app/vendor/bundle/ruby/3.1.0/gems/actionpack-7.0.4/lib/action_controller/metal.rb:190:in \`dispatch'`,

  go: `panic: runtime error: invalid memory address or nil pointer dereference
[signal SIGSEGV: segmentation violation code=0x1 addr=0x0 pc=0x47a1b2]

goroutine 1 [running]:
main.main()
\t/app/main.go:15 +0x1d`,

  csharp: `Unhandled exception. System.NullReferenceException: Object reference not set to an instance of an object.
   at MyApp.Services.UserService.GetUser(Int32 id) in C:\\proj\\UserService.cs:line 42
   at MyApp.Program.Main(String[] args) in C:\\proj\\Program.cs:line 12`,

  phpLaravel: `PHP Fatal error:  Uncaught Error: Call to undefined function foo() in /var/www/app/index.php:10
Stack trace:
#0 /var/www/app/vendor/laravel/framework/src/Illuminate/Routing/Controller.php(54): Illuminate\\Routing\\Controller->callAction()
#1 {main}
  thrown in /var/www/app/index.php on line 10`,

  rust: `thread 'main' panicked at 'index out of bounds: the len is 3 but the index is 5', src/main.rs:6:5
note: run with \`RUST_BACKTRACE=1\` environment variable to display a backtrace`,
} as const

describe('detectLanguage — language detection', () => {
  const cases: Array<[keyof typeof SAMPLES, string]> = [
    ['python', 'Python'],
    ['django', 'Python'],
    ['reactJs', 'JavaScript'],
    ['node', 'JavaScript'],
    ['typescript', 'TypeScript'],
    ['javaSpring', 'Java'],
    ['rubyRails', 'Ruby'],
    ['go', 'Go'],
    ['csharp', 'C#'],
    ['phpLaravel', 'PHP'],
    ['rust', 'Rust'],
  ]

  it.each(cases)('classifies %s as %s', (key, expected) => {
    const result = detectLanguage(SAMPLES[key])
    expect(result).not.toBeNull()
    expect(result?.language).toBe(expected)
    expect(result?.source).toBe('heuristic')
    expect(result?.confidence).toBeGreaterThanOrEqual(0.6)
    expect(result?.confidence).toBeLessThanOrEqual(0.95)
  })
})

describe('detectLanguage — framework detection', () => {
  const cases: Array<[keyof typeof SAMPLES, string]> = [
    ['django', 'Django'],
    ['reactJs', 'React'],
    ['node', 'Node.js'],
    ['javaSpring', 'Spring'],
    ['rubyRails', 'Ruby on Rails'],
    ['phpLaravel', 'Laravel'],
  ]

  it.each(cases)('detects %s framework as %s', (key, expected) => {
    expect(detectLanguage(SAMPLES[key])?.framework).toBe(expected)
  })
})

describe('detectLanguage — inconclusive input', () => {
  it('returns null for empty input', () => {
    expect(detectLanguage('')).toBeNull()
    expect(detectLanguage('   ')).toBeNull()
  })

  it('returns null for prose with no stack-trace signals', () => {
    expect(detectLanguage('Something went wrong, please try again later.')).toBeNull()
  })

  it('returns null for a bare error message with no language signature', () => {
    expect(detectLanguage('TypeError: bad thing happened')).toBeNull()
  })
})

describe('detectLanguageWithFallback', () => {
  it('uses heuristics (no LLM) when the input is clear', async () => {
    const result = await detectLanguageWithFallback(SAMPLES.python)
    expect(result.source).toBe('heuristic')
    expect(result.language).toBe('Python')
  })
})
