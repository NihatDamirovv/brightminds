# Bright Minds Academy — Mental Arifmetika

Mental arithmetic training platform with a protected book library.

- **Backend:** Spring Boot 4 (Java 21, Gradle), Spring Data JPA, PostgreSQL
- **Frontend:** static HTML/CSS/JS in `src/main/resources/static`

## Pages

| Path | Section |
|---|---|
| `/` | Home |
| `/mental` | Mental arithmetic training |
| `/books` | Books (requires access code or admin login) |
| `/about` | About |
| `/contact` | Contact |

The server returns `index.html` for these paths (`PageController`); `js/app.js` picks the section from the URL.

## API

| Method | Path | Access |
|---|---|---|
| `POST` | `/api/books/access` `{ "code": "..." }` | public — on success sets a 2-hour HttpOnly cookie |
| `DELETE` | `/api/books/access` | clears the books cookie |
| `GET` | `/api/books` | books cookie |
| `GET` | `/api/books/{id}/file[?download=1]` | books cookie |
| `POST` | `/api/books` (multipart: `title`, `author`, `file`) | admin token (`Authorization` header) |
| `DELETE` | `/api/books/{id}` | admin token |
| `POST` | `/api/auth/login` `{ "username", "password" }` | public — returns admin token (8 h) and the books cookie |
| `POST` | `/api/auth/logout` `{ "token" }` | — |

Security: the access code is never put in URLs; failed code/login attempts are limited to 5 per IP per 15 minutes; basic security headers on every response. Leaving the Books section ends both the books access and the admin session.

## Configuration

All secrets come from environment variables (nothing is stored in the repository):

| Variable | Meaning |
|---|---|
| `DB_URL` | JDBC URL (default `jdbc:postgresql://localhost:5432/arifmetik`) |
| `DB_USERNAME`, `DB_PASSWORD` | PostgreSQL credentials |
| `APP_ADMIN_USERNAME`, `APP_ADMIN_PASSWORD` | admin login for uploading/deleting books |
| `APP_ACCESS_CODE` | code students use to open the books |
| `PORT` | HTTP port (default `8080`) |

The `books` table is created automatically (`ddl-auto: update`).

## Run

```bash
./gradlew bootJar
java -jar build/libs/arifmetik-0.0.1-SNAPSHOT.jar
```

Run it behind an HTTPS reverse proxy in production so the access code and admin password are encrypted in transit.
