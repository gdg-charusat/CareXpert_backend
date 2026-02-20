# Contributing to CareXpert Backend

Thank you for your interest in contributing to **CareXpert** as part of the **GDG CHARUSAT Open Source Contri Sprintathon**! 🎉

---


## Contribution Rules (Strict Enforcement)

> **Read this section carefully before doing anything. Violations will result in your PR being closed without review.**

- ❌ **Do NOT open PRs for issues unless you are officially assigned**
- ❌ **PRs without a linked issue (or team number) will be closed immediately**
- ❌ **PRs for unassigned issues will be closed without merging**
- ❌ **Do NOT self-assign issues**
- ✅ **Contributors may create new issues for bugs, enhancements, or documentation improvements**, following the Issue Guidelines below
- ✅ **One issue per contributor at a time** - finish and submit before picking another
- ✅ **Only maintainers can assign, review, and merge PRs** - do not ask others to merge your PR
- ✅ **Every PR must include your Team Number** in the description
- ✅ **General improvement PRs** (bug fixes or enhancements outside existing issues) are allowed but reviewed strictly - you must still include your team number and clearly explain the change

---

## Issue Policy

- Contributors may create new issues for:
  - Bugs
  - UI/UX inconsistencies
  - Documentation improvements
  - Feature suggestions
- Before creating a new issue, check that a similar issue does not already exist
- Use clear, descriptive titles and provide proper details
- To work on an issue, **comment on it requesting assignment** (e.g., *"I'd like to work on this, Team XX"*)
- **Wait for a maintainer to officially assign you** before writing any code
- Once assigned, you must submit your PR within **3-5 days** or the issue will be reassigned
- If you're stuck or unavailable, **comment on the issue** so maintainers can help or reassign

---

## Reporting Bugs or Proposing Improvements

If you identify:

- A functional bug  
- A UI/UX inconsistency  
- A documentation error  
- A minor or major enhancement  
- A refactor that improves code quality or maintainability  

You must **create a new issue and wait for it to be approved**.

---

### Important Guidelines

- ✅ Open a new issue describing the problem clearly and wait for maintainer acknowledgment before submitting a Pull Request.
- ✅ Submit a Pull Request with a clear and structured description.  
- ✅ Include your **Team Number** in the PR description.  
- ✅ Clearly explain the problem and the rationale behind your proposed change.  
- ✅ Attach screenshots if the change affects UI. 

Maintainers reserve the right to close any PR that is:

- Trivial or low-effort  
- Outside the intended scope  
- Poorly documented  
- Not aligned with repository standards  

Please ensure that your contribution is meaningful, well-tested, and professionally presented.

---

## Environment Variables & Secrets

Some issues may require environment variables (API keys, secrets, credentials, etc.).

**Do NOT ask for environment variables in issues or pull requests.**  
**Do NOT commit secrets to the repository.**

If you need environment variables to work on an assigned issue, please contact the organizers privately:

- **WhatsApp:** +91-8347036131 || +91-9227448882
- **Email:** jadejakrishnapal04@gmail.com || aaleya2604@gmail.com

Environment details will be shared **only after the issue is officially assigned to you**.

---

## Tech Stack

This project uses:
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Authentication**: JWT (JSON Web Tokens)
- **Package Manager**: npm

---

## Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/) (comes with Node.js)
- [Git](https://git-scm.com/)
- [PostgreSQL](https://www.postgresql.org/download/) (v14 or higher)
- A code editor (VS Code recommended)
- A REST API client like [Postman](https://www.postman.com/) or [Thunder Client](https://www.thunderclient.com/) (VS Code extension)

---

## Getting Started

### Step 1: Fork the Repository

1. Navigate to the [CareXpert Backend repository](https://github.com/gdg-charusat/CareXpert_backend)
2. Click the **Fork** button in the top-right corner
3. This creates a copy of the repository in your GitHub account

### Step 2: Clone Your Fork

```bash
git clone https://github.com/YOUR-USERNAME/CareXpert_backend.git
cd CareXpert_backend
```

Replace `YOUR-USERNAME` with your GitHub username.

### Step 3: Add Upstream Remote

```bash
git remote add upstream https://github.com/gdg-charusat/CareXpert_backend.git
```

Verify the remotes:

```bash
git remote -v
```

You should see:
- `origin` — your fork (`https://github.com/YOUR-USERNAME/CareXpert_backend.git`)
- `upstream` — the original repository (`https://github.com/gdg-charusat/CareXpert_backend.git`)

### Step 4: Set Up Environment Variables

```bash
# Copy the example env file
cp .env.example .env
```

Then open `.env` and fill in your values. Contact organizers for shared credentials (see [Environment Variables](#-environment-variables--secrets) section above).

```env
# Example .env structure
PORT=5000
DATABASE_URL=postgresql://username:password@localhost:5432/carexpert_db
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d
NODE_ENV=development
```

> **Never commit your `.env` file.** It is already listed in `.gitignore`.

### Step 5: Install Dependencies

```bash
npm install
```

### Step 6: Set Up the Database

```bash
# Run database migrations
npm run migrate

# (Optional) Seed the database with initial data
npm run seed
```

### Step 7: Start the Development Server

```bash
npm run dev
```

The server should now be running at `http://localhost:5000` (or whichever port is in your `.env`).

Verify it's working:
```bash
curl http://localhost:5000/health
# Expected: { "status": "ok" }
```

### Step 8: Create a New Branch

**IMPORTANT**: Always create a new branch for your work. Never work directly on the `main` branch.

```bash
# First, sync your fork with upstream
git fetch upstream
git checkout main
git merge upstream/main

# Create and switch to a new branch
git checkout -b feature/your-feature-name
```

**Branch Naming Convention:**
- `feature/` — for new features (e.g., `feature/add-appointment-endpoint`)
- `fix/` — for bug fixes (e.g., `fix/patient-query-error`)
- `docs/` — for documentation changes (e.g., `docs/update-api-readme`)
- `refactor/` — for code refactoring (e.g., `refactor/optimize-db-queries`)
- `chore/` — for maintenance tasks (e.g., `chore/update-dependencies`)

---

## Development Workflow

### 1. Pick an Issue

- Browse the [Issues](https://github.com/gdg-charusat/CareXpert_backend/issues) page
- Look for issues labeled:
  - `good-first-issue` or `beginner` — for beginners (Level 1)
  - `intermediate` — for intermediate level (Level 2)
- **Comment on the issue** with your request and team number, e.g.:
  > *"Hi, I'd like to work on this issue. — Team 07"*
- **Wait to be officially assigned** — do not start writing any code until a maintainer assigns you
- **Do not work on an issue already assigned to someone else**

### 2. Make Your Changes

- Write clean, readable code
- Test all your API endpoints using Postman or Thunder Client
- Ensure the server runs without errors or warnings

### 3. Test Your Changes

```bash
# Run the development server
npm run dev

# Run tests (if applicable)
npm run test

# Check for linting errors
npm run lint
```

Always test your endpoints manually before submitting a PR:
- ✅ Success cases (200, 201)
- ✅ Error cases (400, 401, 403, 404, 500)
- ✅ Edge cases (empty input, invalid data, missing fields)

### 4. Commit Your Changes

```bash
git add .
git commit -m "feat: add appointment booking endpoint"
```

**Commit Message Format:**
- `feat:` — new feature (e.g., `feat: add doctor availability endpoint`)
- `fix:` — bug fix (e.g., `fix: handle null value in patient query`)
- `docs:` — documentation (e.g., `docs: add API endpoint docs`)
- `refactor:` — code restructuring (e.g., `refactor: simplify auth middleware`)
- `test:` — adding tests (e.g., `test: add unit tests for patient service`)
- `chore:` — maintenance tasks (e.g., `chore: update dependencies`)

**Examples of Good Commit Messages:**
```bash
feat: add POST /api/appointments endpoint with validation
fix: resolve 500 error on invalid JWT token
refactor: move database logic to service layer
docs: document appointment API in README
chore: add zod schema for request validation
```

### 5. Push to Your Fork

```bash
git push origin feature/your-feature-name
```

### 6. Create a Pull Request

1. Go to your fork on GitHub: `https://github.com/YOUR-USERNAME/CareXpert_backend`
2. Click **"Compare & pull request"** button
3. Fill out the PR template completely:
   - **Title**: Clear, descriptive title (e.g., `feat: add appointment booking endpoint`)
   - **Team Number**: You **must** state your team number (e.g., `Team 07`) — PRs without this will be closed
   - **Issue Reference**: Link the assigned issue (e.g., `Closes #42`) — PRs without a linked issue will be closed unless it's a general improvement PR
   - **Description**: Explain what endpoint/logic you added or changed and why
   - **API Changes**: Document any new or modified endpoints (method, route, request body, response)
4. Click **"Create pull request"**

---

## Issue Guidelines

### Finding Issues

Issues are categorized by difficulty level and **created exclusively by organizers**:

**Beginner Level (Good First Issues)**
- Adding input validation to existing routes
- Writing helper/utility functions
- Adding error handling to existing endpoints
- Writing documentation for existing APIs
- Labels: `good-first-issue`, `beginner`, `level-1`

**Intermediate Level**
- Building new API endpoints end-to-end
- Database schema changes and migrations
- Authentication/authorization logic
- Business logic implementation
- Labels: `intermediate`, `level-2`

## Need Help?

- **Issue Discussion**: Comment on the issue you're working on
- **WhatsApp**: Join the GDG CHARUSAT event group
- **Maintainers**: Tag @maintainer-username in your issue comments
- **Documentation**: Check [React Docs](https://react.dev/), [Vite Docs](https://vitejs.dev/), [Tailwind Docs](https://tailwindcss.com/), [pnpm Docs](https://pnpm.io/)

---

## Tips for Success

1. **Start Small**: Begin with beginner issues to understand the codebase
2. **Read Existing Code**: Look at how similar features are implemented
3. **Always use pnpm**: Never switch to npm or yarn mid-project
4. **Ask Questions**: It's better to ask than to waste time going in the wrong direction
5. **Be Patient**: Code review takes time, be responsive to feedback
6. **Have Fun**: Open source is about learning and community!

---

**Happy Coding! **

If you have any questions or need clarification, feel free to reach out to the maintainers or ask in the issue comments.

Thank you for contributing to CareXpert!
