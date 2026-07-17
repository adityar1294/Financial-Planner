# Secure Hosted Financial Planner (Vercel Architecture)

This repository contains the refactored, secure, hosted version of the Financial Planner application. The mathematical engine is decoupled from the frontend and runs in a secure Node.js serverless environment.

## 📂 Project Structure

```text
financial-planner/
├── vercel.json           # Vercel rewrite & deployment routing configurations
├── api/
│   └── calculate.js      # Decoupled serverless math & simulation engine (JS)
├── public/
│   └── index.html        # Clean, client-facing HTML/CSS view (Fetch-based wire)
├── verify_math.js        # Mathematical regression parity checking test runner
└── .gitignore            # Git exclusion rules
```

## 🚀 Getting Started

### 1. Verification (Automated Test Parity Check)
Run the cross-verification script to assert that the JS serverless engine compiles and achieves exact parity matching with the production Python calculation runs:

```bash
node verify_math.js
```

*(Note: If utilizing Antigravity agent environments, run: `agy-node verify_math.js`)*

### 2. Vercel Deployment
To deploy this project to your hosted production environment on Vercel:

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm install -g vercel
   ```

2. **Initialize Git & Commit**:
   ```bash
   git init
   # Add your repository remote URL here
   git add .
   git commit -m "Initialize secure Vercel financial planner architecture"
   ```

3. **Deploy with CLI**:
   Run the following command in the root folder of this directory:
   ```bash
   vercel
   ```
   Follow the prompts to link to your account and build. Vercel will automatically read `vercel.json` and deploy:
   - `/public/index.html` as the static index page.
   - `/api/calculate.js` as the serverless API calculation endpoint located at `/api/calculate`.

## 🧠 Behind the Decoupled Calculations
- **Timezone Safety**: Dates are coerced strictly via `UTC midnight` dates to prevent browser/server-time zone daylight savings drifts.
- **Tax Lots (FIFO)**: Redemptions from both the Core Corpus and Debt/Hybrid pools apply FIFO lot liquidation, calculating STCG/LTCG dynamically based on exact days elapsed.
- **Binary Solver limits**: All solver loops (earliest retirement age, minimum SIP required, lumpsum top-ups) are capped at exactly `60 iterations` to avoid Vercel function timeouts.
- **Sabbaticals & EMIs**: Sabbaticals pause accumulation SIP segments, and redirected EMIs dynamically re-enter the portfolio as soon as current loans are paid off.
